import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadsDir } from "../lib/paths.js";

const MAX_UPLOAD_SIZE_BYTES = 40 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const MODEL_EXTENSIONS = new Set([".glb", ".gltf", ".fbx", ".obj", ".stl"]);
const DOC_EXTENSIONS = new Set([".pdf"]);
const ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...MODEL_EXTENSIONS,
  ...DOC_EXTENSIONS,
]);
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "model/gltf-binary",
  "model/gltf+json",
  "model/stl",
  "application/octet-stream",
  "application/json",
]);

function sanitizeSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeFolder(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/[\\/]+/)
    .map((part) => sanitizeSegment(part))
    .filter(Boolean);
  return parts.join("/");
}

function sanitizeFileName(value, originalName) {
  const original = String(originalName || "arquivo");
  const ext = path.extname(original) || "";
  const base = path.basename(String(value || "").trim(), path.extname(String(value || "").trim() || ""));
  const safeBase = sanitizeSegment(base || path.basename(original, ext));
  return `${safeBase || "arquivo"}${ext}`;
}

function buildUploadUrl(relativePath) {
  const configuredBase = String(env.uploadsBaseUrl || "").trim().replace(/\/$/, "");
  const rawNormalized = `/${String(relativePath || "").replace(/^\/+/, "")}`;
  const normalized = rawNormalized.startsWith("/uploads/")
    ? `/api${rawNormalized}`
    : rawNormalized;
  if (!configuredBase) return normalized;
  try {
    const url = new URL(configuredBase);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return normalized;
  } catch {
    return normalized;
  }
  return `${configuredBase}${normalized}`;
}

function getRelativeUploadPathFromInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const parsed = new URL(raw);
      const pathName = String(parsed.pathname || "");
      if (pathName.startsWith("/uploads/")) return pathName.slice("/uploads/".length);
      return "";
    }
  } catch {
    // Keep raw fallback parsing
  }
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return normalized.slice("uploads/".length);
  if (normalized.startsWith("api/uploads/")) return normalized.slice("api/uploads/".length);
  return "";
}

function isAdminRequest(req) {
  return String(req.auth?.role || "user") === "admin";
}

function isAllowedFile(file) {
  const ext = String(path.extname(file?.originalname || "") || "").toLowerCase();
  const mimetype = String(file?.mimetype || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (ALLOWED_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix))) return true;
  return ALLOWED_MIME_TYPES.has(mimetype);
}

function resolveScopedFolder(req) {
  const requestedFolder = sanitizeFolder(req.body?.folder);
  if (isAdminRequest(req)) {
    return requestedFolder;
  }

  const userRoot = sanitizeFolder(`users/${req.auth?.sub || ""}`);
  if (!requestedFolder) return userRoot;
  return sanitizeFolder(`${userRoot}/${requestedFolder}`);
}

function canDeleteRelativePath(req, relativePath) {
  if (isAdminRequest(req)) return true;
  const userPrefix = `users/${sanitizeSegment(req.auth?.sub || "")}/`;
  return String(relativePath || "").replace(/\\/g, "/").startsWith(userPrefix);
}

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const subFolder = resolveScopedFolder(req);
      const fullDir = subFolder ? path.resolve(uploadsDir, subFolder) : uploadsDir;
      await fs.promises.mkdir(fullDir, { recursive: true });
      cb(null, fullDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const customName = String(req.body?.filename || "").trim();
    const safeName = customName
      ? sanitizeFileName(customName, file.originalname)
      : file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (!isAllowedFile(file)) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
  }

  const absoluteSavedPath = path.resolve(req.file.path);
  const relativeToUploadDir = path.relative(uploadsDir, absoluteSavedPath).replace(/\\/g, "/");
  const safeRelative = String(relativeToUploadDir || req.file.filename).replace(/^\/+/, "");
  const relativeFilePath = `uploads/${safeRelative}`;
  const fileUrl = buildUploadUrl(relativeFilePath);

  return res.status(201).json({
    file_url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

router.delete("/", async (req, res) => {
  const fromBody = req.body?.file_url || req.body?.fileUrl || req.body?.path || "";
  const fromQuery = req.query?.file_url || req.query?.fileUrl || req.query?.path || "";
  const relativePath = getRelativeUploadPathFromInput(fromBody || fromQuery);
  if (!relativePath) {
    return res.status(400).json({ error: "Valid upload path is required" });
  }

  const absolutePath = path.resolve(uploadsDir, relativePath);
  const normalizedRoot = path.resolve(uploadsDir);
  if (!absolutePath.startsWith(normalizedRoot)) {
    return res.status(400).json({ error: "Invalid upload path" });
  }
  if (!canDeleteRelativePath(req, relativePath)) {
    return res.status(403).json({ error: "You cannot delete this file" });
  }

  try {
    await fs.promises.unlink(absolutePath);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.status(404).json({ error: "File not found" });
    }
    return res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
