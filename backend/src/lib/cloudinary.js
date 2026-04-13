import crypto from "node:crypto";
import path from "node:path";
import { env } from "../config/env.js";

function parseCloudinaryUrl(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const apiKey = decodeURIComponent(parsed.username || "");
    const apiSecret = decodeURIComponent(parsed.password || "");
    const cloudName = String(parsed.hostname || "").split(".")[0] || "";
    if (!apiKey || !apiSecret || !cloudName) return null;
    return { apiKey, apiSecret, cloudName };
  } catch {
    return null;
  }
}

export function getCloudinaryConfig() {
  const parsed = parseCloudinaryUrl(env.cloudinaryUrl);
  const apiKey = String(parsed?.apiKey || env.cloudinaryApiKey || "").trim();
  const apiSecret = String(parsed?.apiSecret || env.cloudinaryApiSecret || "").trim();
  const cloudName = String(parsed?.cloudName || env.cloudinaryCloudName || "").trim();
  const folder = String(env.cloudinaryUploadsFolder || "souza-app/uploads").trim().replace(/^\/+|\/+$/g, "");

  return {
    apiKey,
    apiSecret,
    cloudName,
    folder,
    enabled: Boolean(apiKey && apiSecret && cloudName),
  };
}

function buildSignature(params = {}, apiSecret = "") {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

function sanitizePublicIdSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9/_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getResourceType(mimetype = "", originalName = "") {
  const normalizedMime = String(mimetype || "").toLowerCase();
  const ext = String(path.extname(originalName || "") || "").toLowerCase();
  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime.startsWith("video/")) return "video";
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext) || normalizedMime.startsWith("audio/")) return "video";
  return "raw";
}

function extractCloudinaryPublicId(url = "", cloudName = "") {
  const value = String(url || "").trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!String(parsed.hostname || "").includes("cloudinary.com")) return null;
    if (cloudName && !String(parsed.pathname || "").includes(`/${cloudName}/`)) return null;

    const parts = String(parsed.pathname || "")
      .split("/")
      .filter(Boolean);
    const uploadIndex = parts.findIndex((part) => part === "upload");
    if (uploadIndex === -1) return null;

    const tail = parts.slice(uploadIndex + 1);
    if (tail[0] && /^v\d+$/.test(tail[0])) {
      tail.shift();
    }
    if (tail.length === 0) return null;

    const joined = tail.join("/");
    const ext = path.extname(joined);
    return ext ? joined.slice(0, -ext.length) : joined;
  } catch {
    return null;
  }
}

export async function uploadToCloudinary({ buffer, originalName = "", mimetype = "", folder = "", publicId = "" } = {}) {
  const config = getCloudinaryConfig();
  if (!config.enabled) {
    const error = new Error("Cloudinary is not configured");
    error.status = 500;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const normalizedFolder = String(folder || config.folder || "").trim().replace(/^\/+|\/+$/g, "");
  const normalizedPublicId = sanitizePublicIdSegment(publicId || "");
  const resourceType = getResourceType(mimetype, originalName);
  const signPayload = {
    folder: normalizedFolder || undefined,
    public_id: normalizedPublicId || undefined,
    timestamp,
  };
  const signature = buildSignature(signPayload, config.apiSecret);
  const form = new FormData();

  if (normalizedFolder) form.append("folder", normalizedFolder);
  if (normalizedPublicId) form.append("public_id", normalizedPublicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", config.apiKey);
  form.append("signature", signature);
  form.append("file", new Blob([buffer], { type: mimetype || "application/octet-stream" }), originalName || "arquivo");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const message = payload?.error?.message || `Cloudinary upload failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status || 500;
    throw error;
  }

  const url = String(payload?.secure_url || payload?.url || "").trim();
  if (!url) {
    throw Object.assign(new Error("Cloudinary upload returned no URL"), { status: 500 });
  }

  return {
    url,
    publicId: String(payload?.public_id || "").trim(),
    resourceType: String(payload?.resource_type || resourceType).trim(),
    originalFilename: String(payload?.original_filename || "").trim(),
    bytes: Number(payload?.bytes || 0),
    format: String(payload?.format || "").trim(),
  };
}

export async function deleteFromCloudinaryByUrl(fileUrl = "") {
  const config = getCloudinaryConfig();
  if (!config.enabled) return { ok: false, skipped: true };

  const publicId = extractCloudinaryPublicId(fileUrl, config.cloudName);
  if (!publicId) return { ok: false, skipped: true };

  const resourceType = "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const signPayload = { public_id: publicId, timestamp };
  const signature = buildSignature(signPayload, config.apiSecret);
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", config.apiKey);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || "Cloudinary delete failed";
    const error = new Error(message);
    error.status = response.status || 500;
    throw error;
  }

  return {
    ok: payload?.result === "ok" || payload?.result === "not found",
    result: String(payload?.result || "").trim(),
    publicId,
  };
}
