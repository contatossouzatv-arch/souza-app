import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { OAuth2Client } from "google-auth-library";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  countFailedLoginAttemptsSince,
  createLoginAttempt,
  createPasswordResetToken,
  createUserProfileImageVersion,
  createRefreshToken,
  createSecurityEvent,
  findUserRowById,
  findActiveRefreshTokenByHash,
  findValidPasswordResetTokenByHash,
  findOrCreateUserByEmail,
  findRefreshTokenByHash,
  findUserById,
  findUserPrivateById,
  findUserRowByEmail,
  findUserRowByNickInsensitive,
  findUserRowByPhoneNormalized,
  getUserProfileImageVersion,
  listUsersByProfileImageStatus,
  listUserProfileImageVersions,
  markPasswordResetTokenUsed,
  getUserProfileImages,
  revokeRefreshTokenById,
  revokeRefreshTokensByUserId,
  upsertUserProfileImages,
  updateUserById,
  findUserByGoogleId,
  updateUserGoogleLink,
  deleteUserById,
} from "../db/index.js";
import {
  buildRefreshExpiryDate,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from "../auth.js";
import { env } from "../config/env.js";
import { deleteFromCloudinaryByUrl, getCloudinaryConfig, uploadToCloudinary } from "../lib/cloudinary.js";
import { deleteCacheByPrefix, deleteCacheKey, getOrComputeCacheJson, setCacheJson } from "../lib/cache.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";
import { privateUploadsDir, uploadsDir } from "../lib/paths.js";

const router = Router();
const googleClient = new OAuth2Client();
const profilePendingDir = path.resolve(privateUploadsDir, "profile-pending");
const profilePublicDir = path.resolve(uploadsDir, "profile");
const bannedNameTokens = ["nude", "porn", "sexo", "sex", "nsfw"];
const profileImageCloudinaryConfig = getCloudinaryConfig();
const ADMIN_PROFILE_IMAGES_TTL_MS = 10_000;
const AUTH_SESSION_USER_TTL_MS = 5 * 60 * 1000;

fs.mkdirSync(profilePendingDir, { recursive: true });
fs.mkdirSync(profilePublicDir, { recursive: true });

const loginRateLimiter = rateLimit({
  windowMs: Math.max(1, env.rateLimitLoginWindowMin) * 60 * 1000,
  limit: Math.max(1, env.rateLimitLoginMax),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em instantes." },
});

const forgotRateLimiter = rateLimit({
  windowMs: Math.max(1, env.rateLimitLoginWindowMin) * 60 * 1000,
  limit: Math.max(1, Math.floor(env.rateLimitLoginMax / 2)),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em instantes." },
});

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, env.profileImageMaxSizeMb) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Formato invalido. Use JPG, PNG ou WEBP."));
    }
    cb(null, true);
  },
});

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeNick(nick) {
  return String(nick || "").trim().replace(/^@+/, "").toLowerCase();
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function buildAdminProfileImagesCacheKey(status = "") {
  return `auth:admin-profile-images:${String(status || "").trim().toLowerCase() || "manual_review"}`;
}

function buildAuthSessionUserCacheKey(userId = "") {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId ? `auth:session-user:${normalizedUserId}` : "";
}

async function primeAuthSessionUserCache(user) {
  const safeUser = user && typeof user === "object" ? user : null;
  const cacheKey = buildAuthSessionUserCacheKey(safeUser?.id || "");
  if (!cacheKey || !safeUser) return safeUser;
  await setCacheJson(cacheKey, safeUser, AUTH_SESSION_USER_TTL_MS).catch(() => {});
  return safeUser;
}

async function clearAuthSessionUserCache(userId = "") {
  const cacheKey = buildAuthSessionUserCacheKey(userId);
  if (!cacheKey) return;
  await deleteCacheKey(cacheKey).catch(() => {});
}

async function resolveSessionUser(userId = "") {
  const cacheKey = buildAuthSessionUserCacheKey(userId);
  if (!cacheKey) return null;
  return getOrComputeCacheJson(cacheKey, AUTH_SESSION_USER_TTL_MS, async () => {
    const loadedUser = await findUserById(userId);
    return loadedUser || null;
  });
}

async function ensureUniqueIdentityFields({ email = "", nick = "", phone = "", excludeUserId = "" }) {
  const normalizedEmail = sanitizeEmail(email);
  const normalizedNick = sanitizeNick(nick);
  const normalizedPhone = sanitizePhone(phone);

  if (normalizedEmail) {
    const emailOwner = await findUserRowByEmail(normalizedEmail);
    if (emailOwner && String(emailOwner.id || "") !== String(excludeUserId || "")) {
      const error = new Error("Email já cadastrado");
      error.status = 409;
      throw error;
    }
  }

  if (normalizedNick) {
    const nickOwner = await findUserRowByNickInsensitive(normalizedNick, excludeUserId);
    if (nickOwner) {
      const error = new Error("Esse @ já está em uso");
      error.status = 409;
      throw error;
    }
  }

  if (normalizedPhone) {
    const phoneOwner = await findUserRowByPhoneNormalized(normalizedPhone, excludeUserId);
    if (phoneOwner) {
      const error = new Error("Esse telefone já está em uso");
      error.status = 409;
      throw error;
    }
  }

  return {
    normalizedEmail,
    normalizedNick,
    normalizedPhone,
  };
}

function emitEntityChanged(req, entityName, entityId, action = "updated") {
  req.app?.locals?.io?.emit("entity:changed", {
    entity: entityName,
    entityName,
    entityId,
    action,
    emittedAt: new Date().toISOString(),
  });
}

function validatePasswordStrength(password) {
  const value = String(password || "");
  if (value.length < 8) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(input) {
  const normalized = String(input || "").toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of normalized) {
    const idx = base32Alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

function generateTotpCode(secret, counter) {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  let c = Number(counter);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

function verifyTotp(secret, otp) {
  const raw = String(otp || "").trim().replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(raw)) return false;
  const cleanOtp = raw.length === 8 ? raw.slice(-6) : raw;
  const nowCounter = Math.floor(Date.now() / 30000);
  // Accept a slightly wider skew window to avoid false negatives
  // when device clocks are a bit out of sync in local/dev usage.
  for (let i = -4; i <= 4; i++) {
    if (generateTotpCode(secret, nowCounter + i) === cleanOtp) return true;
  }
  return false;
}

function buildProfileImageUrl(req, userId) {
  const configuredBase = String(env.uploadsBaseUrl || "").trim().replace(/\/$/, "");
  const relativePath = `/api/auth/profile-image/${userId}`;

  // In local/dev, storing relative paths avoids "localhost" URLs that break on mobile.
  if (!configuredBase) {
    return relativePath;
  }

  try {
    const url = new URL(configuredBase);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return relativePath;
    }
  } catch {
    return relativePath;
  }

  return `${configuredBase}${relativePath}`;
}

function buildProfileImageVersionUrl(req, versionId) {
  const configuredBase = String(env.uploadsBaseUrl || "").trim().replace(/\/$/, "");
  const relativePath = `/api/auth/profile-image-version/${versionId}`;
  if (!configuredBase) return relativePath;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredBase)) {
    return relativePath;
  }
  return `${configuredBase}${relativePath}`;
}

function isExternalHttpUrl(value = "") {
  return /^https?:\/\//i.test(String(value || "").trim());
}

async function uploadProfileImageToCloudinary(userId, buffer, mimetype, originalName) {
  if (!profileImageCloudinaryConfig.enabled || !buffer) return "";
  const folder = [profileImageCloudinaryConfig.folder, "profile-images"].filter(Boolean).join("/");
  const result = await uploadToCloudinary({
    buffer,
    mimetype: mimetype || "image/jpeg",
    originalName: originalName || `profile-${userId}.jpg`,
    folder,
    publicId: `users/${userId}/profile-current`,
  });
  return String(result?.url || "").trim();
}

function extractProfileImageVersionId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/\/api\/auth\/profile-image-version\/([^/?#]+)/i);
  return match?.[1] || "";
}

function evaluateImageModeration(originalname = "") {
  const normalized = String(originalname || "").toLowerCase();
  const hasBannedToken = bannedNameTokens.some((token) => normalized.includes(token));

  if (hasBannedToken) {
    return { status: "rejected", score: 0.99, reason: "Conteudo suspeito detectado." };
  }

  if (env.profileImageRequireReview) {
    return { status: "manual_review", score: null, reason: "Aguardando analise de moderacao." };
  }

  return { status: "approved", score: 0.1, reason: "" };
}

function removePublicFileByUrl(url) {
  const value = String(url || "");
  if (!value) return;
  if (isExternalHttpUrl(value)) {
    Promise.resolve(deleteFromCloudinaryByUrl(value)).catch((err) => {
      console.warn("[auth] cloudinary delete failed", { url: value, message: err?.message || "unknown" });
    });
    return;
  }
  const marker = "/uploads/profile/";
  const idx = value.indexOf(marker);
  if (idx === -1) return;
  const filename = value.slice(idx + marker.length);
  if (!filename) return;
  const filePath = path.resolve(profilePublicDir, filename);
  fs.promises.unlink(filePath).catch((err) => {
    if (err?.code !== "ENOENT") {
      console.warn("[auth] file delete failed", { filePath, message: err?.message || "unknown" });
    }
  });
}

function removePendingFileByName(name) {
  const safeName = String(name || "").trim();
  if (!safeName) return;
  if (safeName.includes("/") || safeName.includes("\\")) return;

  const filePath = path.resolve(profilePendingDir, safeName);
  fs.promises.unlink(filePath).catch((err) => {
    if (err?.code !== "ENOENT") {
      console.warn("[auth] pending file delete failed", { filePath, message: err?.message || "unknown" });
    }
  });
}

function canAccessPendingFile(fileName) {
  const safeName = String(fileName || "").trim();
  if (!safeName) return false;
  if (safeName.includes("/") || safeName.includes("\\")) return false;
  return fs.existsSync(path.resolve(profilePendingDir, safeName));
}

async function reactivateIfNeeded(userId) {
  const current = await findUserById(userId);
  if (!current) return null;
  if (current.account_status !== "deactivated") return current;
  return updateUserById(userId, { account_status: "active", deactivated_at: null });
}

function requestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

async function isLockedOut(identifier, ip) {
  const since = new Date(Date.now() - Math.max(1, env.lockoutMinutes) * 60 * 1000).toISOString();
  const fails = await countFailedLoginAttemptsSince(identifier, ip, since);
  return fails >= Math.max(1, env.lockoutMaxFails);
}

async function auditEvent(req, type, userId = null, metadata = {}) {
  try {
    const meta = requestMeta(req);
    await createSecurityEvent({
      user_id: userId,
      type,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata,
    });
  } catch (error) {
    console.error("security_event_failed", type, error?.message || error);
  }
}

function parseCookies(rawCookie = "") {
  const input = String(rawCookie || "").trim();
  if (!input) return {};

  return input.split(";").reduce((acc, chunk) => {
    const [rawName, ...rawValue] = chunk.split("=");
    const name = String(rawName || "").trim();
    if (!name) return acc;
    acc[name] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {});
}

function normalizeCookieDomain(value) {
  const raw = String(value || "").trim().replace(/^['"]+|['"]+$/g, "");
  if (!raw) return "";
  if (raw.includes("://")) return "";
  if (raw.includes("/")) return "";
  if (raw.includes(" ")) return "";
  if (raw.includes("*")) return "";
  if (raw.startsWith(".")) {
    return raw.length > 1 ? raw : "";
  }
  return raw;
}

function buildCookieOptions(maxAgeMs) {
  const sameSite =
    env.nodeEnv === "production"
      ? "none"
      : ["lax", "strict", "none"].includes(env.authCookieSameSite)
        ? env.authCookieSameSite
        : "lax";
  const options = {
    httpOnly: env.nodeEnv === "production" ? true : env.authCookieHttpOnly,
    secure: env.nodeEnv === "production" ? true : env.authCookieSecure,
    sameSite,
    path: env.authCookiePath || "/",
    maxAge: maxAgeMs,
  };
  const normalizedDomain = normalizeCookieDomain(env.authCookieDomain);
  if (normalizedDomain) {
    options.domain = normalizedDomain;
  }

  return options;
}

function isInvalidCookieDomainError(error) {
  return String(error?.message || "").toLowerCase().includes("option domain is invalid");
}

function withoutCookieDomain(options) {
  if (!options || !Object.prototype.hasOwnProperty.call(options, "domain")) return options;
  const next = { ...options };
  delete next.domain;
  return next;
}

function setSessionCookies(res, session) {
  const accessMaxAgeMs = Math.max(1, Number(env.accessTokenTtlMin || 15)) * 60 * 1000;
  const refreshMaxAgeMs = Math.max(1, Number(env.refreshTokenTtlDays || 30)) * 24 * 60 * 60 * 1000;
  const accessOptions = buildCookieOptions(accessMaxAgeMs);
  const refreshOptions = buildCookieOptions(refreshMaxAgeMs);
  console.info("[auth-cookie] setting session cookies", {
    accessCookieName: env.authAccessCookieName,
    refreshCookieName: env.authRefreshCookieName,
    sameSite: refreshOptions.sameSite,
    secure: Boolean(refreshOptions.secure),
    httpOnly: Boolean(refreshOptions.httpOnly),
    domain: refreshOptions.domain || null,
    path: refreshOptions.path || "/",
    refreshMaxAgeMs,
  });
  try {
    res.cookie(env.authAccessCookieName, session.token, accessOptions);
    res.cookie(env.authRefreshCookieName, session.refreshToken, refreshOptions);
  } catch (error) {
    if (!isInvalidCookieDomainError(error)) throw error;
    console.warn("[auth-cookie] invalid domain while setting cookies, retrying without domain");
    res.cookie(env.authAccessCookieName, session.token, withoutCookieDomain(accessOptions));
    res.cookie(env.authRefreshCookieName, session.refreshToken, withoutCookieDomain(refreshOptions));
  }
}

function clearSessionCookies(res) {
  const options = buildCookieOptions(0);
  try {
    res.clearCookie(env.authAccessCookieName, options);
    res.clearCookie(env.authRefreshCookieName, options);
  } catch (error) {
    if (!isInvalidCookieDomainError(error)) throw error;
    console.warn("[auth-cookie] invalid domain while clearing cookies, retrying without domain");
    const fallbackOptions = withoutCookieDomain(options);
    res.clearCookie(env.authAccessCookieName, fallbackOptions);
    res.clearCookie(env.authRefreshCookieName, fallbackOptions);
  }
}

function readRefreshToken(req) {
  const bodyToken = String(req.body?.refreshToken || "").trim();
  if (bodyToken) return bodyToken;
  const cookies = parseCookies(req.headers.cookie || "");
  return String(cookies[env.authRefreshCookieName] || "").trim();
}

function logAuthRoute(req, message, details = {}) {
  console.info(`[auth-backend] ${message}`, {
    path: req.originalUrl,
    method: req.method,
    origin: req.headers.origin || null,
    hasCookieHeader: Boolean(req.headers.cookie),
    hasAccessCookie: Boolean(parseCookies(req.headers.cookie || "")[env.authAccessCookieName]),
    hasRefreshCookie: Boolean(parseCookies(req.headers.cookie || "")[env.authRefreshCookieName]),
    ...details,
  });
}


async function issueSession(req, user, familyId = null) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const rotateFamilyId = familyId || crypto.randomUUID();
  const meta = requestMeta(req);

  await createRefreshToken({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: buildRefreshExpiryDate(),
    user_agent: meta.user_agent,
    ip: meta.ip,
    rotate_family_id: rotateFamilyId,
  });

  await primeAuthSessionUserCache(user);
  const token = signAccessToken(user);
  return { token, refreshToken, user };
}

router.post("/register", loginRateLimiter, async (req, res) => {
  const { email, password, full_name, nick, phone } = req.body || {};
  const normalizedName = String(full_name || "").trim();
  const requestedNick = String(nick || "").trim() || String(email || "").split("@")[0] || "";

  if (!email || !password || !normalizedName || !phone) {
    return res.status(400).json({ error: "email, nome e telefone são obrigatórios" });
  }

  let normalizedIdentity;
  try {
    normalizedIdentity = await ensureUniqueIdentityFields({
      email,
      nick: requestedNick,
      phone,
    });
  } catch (error) {
    return res.status(error.status || 409).json({ error: error.message || "Dados já cadastrados" });
  }

  const password_hash = await bcrypt.hash(String(password), 10);
  const user = await findOrCreateUserByEmail(normalizedIdentity.normalizedEmail, {
    password_hash,
    full_name: normalizedName,
    nick: normalizedIdentity.normalizedNick || requestedNick,
    phone: normalizedIdentity.normalizedPhone,
    terms_accepted: false,
    privacy_accepted: false,
    onboarding_completed: false,
  });

  const session = await issueSession(req, user);
  setSessionCookies(res, session);
  logAuthRoute(req, "session issued", { userId: user.id, reason: "register" });
  await auditEvent(req, "USER_REGISTERED", user.id, { method: "password" });
  emitEntityChanged(req, "user", user.id, "created");
  return res.status(201).json(session);
});

router.get("/availability", requireAuth, async (req, res) => {
  try {
    const nick = String(req.query?.nick || "").trim();
    const phone = String(req.query?.phone || "").trim();
    const excludeUserId = String(req.auth?.sub || "").trim();

    const normalizedNick = sanitizeNick(nick);
    const normalizedPhone = sanitizePhone(phone);

    const [nickOwner, phoneOwner] = await Promise.all([
      normalizedNick ? findUserRowByNickInsensitive(normalizedNick, excludeUserId) : Promise.resolve(null),
      normalizedPhone ? findUserRowByPhoneNormalized(normalizedPhone, excludeUserId) : Promise.resolve(null),
    ]);

    return res.json({
      nick: {
        value: normalizedNick,
        available: normalizedNick ? !nickOwner : null,
      },
      phone: {
        value: normalizedPhone,
        available: normalizedPhone ? !phoneOwner : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Falha ao consultar disponibilidade." });
  }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  const { email, password, otp } = req.body || {};
  const normalizedEmail = sanitizeEmail(email);
  const meta = requestMeta(req);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (await isLockedOut(normalizedEmail, meta.ip)) {
    await auditEvent(req, "LOGIN_BLOCKED_LOCKOUT", null, { identifier: normalizedEmail });
    return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
  }

  const userRow = await findUserRowByEmail(normalizedEmail);
  if (!userRow?.password_hash) {
    await createLoginAttempt({
      identifier: normalizedEmail,
      ip: meta.ip,
      user_agent: meta.user_agent,
      success: false,
    });
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const valid = await bcrypt.compare(String(password), userRow.password_hash);
  if (!valid) {
    await createLoginAttempt({
      identifier: normalizedEmail,
      ip: meta.ip,
      user_agent: meta.user_agent,
      success: false,
    });
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  if (Boolean(userRow.two_factor_enabled) && userRow.two_factor_secret) {
    const otpOk = verifyTotp(userRow.two_factor_secret, otp);
    if (!otpOk) {
      await Promise.all([
        createLoginAttempt({
          identifier: normalizedEmail,
          ip: meta.ip,
          user_agent: meta.user_agent,
          success: false,
        }),
        auditEvent(req, "LOGIN_2FA_FAILED", userRow.id, { identifier: normalizedEmail }),
      ]);
      return res.status(401).json({ error: "Código 2FA inválido." });
    }
  }

  const activeUser = await reactivateIfNeeded(userRow.id);
  const session = await issueSession(req, activeUser);
  setSessionCookies(res, session);
  logAuthRoute(req, "session issued", { userId: activeUser.id, reason: "login" });
  await Promise.all([
    createLoginAttempt({
      identifier: normalizedEmail,
      ip: meta.ip,
      user_agent: meta.user_agent,
      success: true,
    }),
    auditEvent(req, "USER_LOGGED_IN", activeUser.id, { method: "password" }),
  ]);
  return res.json(session);
});

router.post("/google", loginRateLimiter, async (req, res) => {
  const { credential, otp } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: "credential is required" });
  }

  if (!env.googleClientId) {
    return res.status(503).json({ error: "Google login não configurado no backend" });
  }

  try {
    const meta = requestMeta(req);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();
    const email = sanitizeEmail(payload?.email);
    const googleId = payload?.sub;

    if (!email || !googleId) {
      await createLoginAttempt({
        identifier: email || googleId || "google",
        ip: meta.ip,
        user_agent: meta.user_agent,
        success: false,
      });
      return res.status(400).json({ error: "Token Google inválido" });
    }

    let user = await findUserByGoogleId(googleId);

    if (!user) {
      const existingByEmail = await findUserRowByEmail(email);
      if (existingByEmail) {
        user = await updateUserGoogleLink(existingByEmail.id, googleId);
      } else {
        const requestedNick = payload?.given_name || email.split("@")[0];
        await ensureUniqueIdentityFields({
          email,
          nick: requestedNick,
          phone: "",
        });
        user = await findOrCreateUserByEmail(email, {
          google_id: googleId,
          full_name: payload?.name || "",
          nick: sanitizeNick(requestedNick) || requestedNick,
          terms_accepted: false,
          privacy_accepted: false,
          onboarding_completed: false,
        });
      }
    }

    const userRow = await findUserRowById(user.id);

    if (Boolean(userRow?.two_factor_enabled) && userRow?.two_factor_secret) {
      if (!String(otp || "").trim()) {
        await createLoginAttempt({
          identifier: email,
          ip: meta.ip,
          user_agent: meta.user_agent,
          success: false,
        });
        await auditEvent(req, "LOGIN_2FA_REQUIRED", user.id, { method: "google" });
        return res.status(401).json({ error: "2FA_REQUIRED" });
      }

      const otpOk = verifyTotp(userRow.two_factor_secret, otp);
      if (!otpOk) {
        await createLoginAttempt({
          identifier: email,
          ip: meta.ip,
          user_agent: meta.user_agent,
          success: false,
        });
        await auditEvent(req, "LOGIN_2FA_FAILED", user.id, { method: "google" });
        return res.status(401).json({ error: "Código 2FA inválido." });
      }
    }

    const activeUser = await reactivateIfNeeded(user.id);
    await createLoginAttempt({
      identifier: email,
      ip: meta.ip,
      user_agent: meta.user_agent,
      success: true,
    });
    const session = await issueSession(req, activeUser);
    setSessionCookies(res, session);
    logAuthRoute(req, "session issued", { userId: activeUser.id, reason: "google" });
    await auditEvent(req, "USER_LOGGED_IN", activeUser.id, { method: "google" });
    emitEntityChanged(req, "user", activeUser.id, "updated");
    return res.json(session);
  } catch (error) {
    console.error("[auth-google] login failed", {
      message: error?.message || "unknown",
      name: error?.name || null,
      code: error?.code || null,
      origin: req.headers.origin || null,
      host: req.headers.host || null,
      hasCredential: Boolean(credential),
      hasOtp: Boolean(String(otp || "").trim()),
    });
    return res.status(401).json({ error: "Falha na autenticação Google" });
  }
});

router.post("/dev-login", async (req, res) => {
  if (env.nodeEnv === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const { email, full_name, nick, role } = req.body || {};
  const normalizedEmail = sanitizeEmail(email || env.adminEmail);

  const user = await findOrCreateUserByEmail(normalizedEmail, {
    full_name: full_name || "Usuário Local",
    nick: nick || normalizedEmail.split("@")[0],
    role: role || (normalizedEmail === "admin@local.dev" ? "admin" : "user"),
    onboarding_completed: true,
    terms_accepted: true,
    privacy_accepted: true,
  });

  const session = await issueSession(req, user);
  setSessionCookies(res, session);
  logAuthRoute(req, "session issued", { userId: user.id, reason: "dev-login" });
  await auditEvent(req, "USER_LOGGED_IN", user.id, { method: "dev-login" });
  return res.json(session);
});

router.post("/2fa/setup", requireAuth, async (req, res) => {
  const userRow = await findUserRowById(req.auth.sub);
  if (!userRow) return res.status(404).json({ error: "User not found" });

  const secret = generateTotpSecret();
  const updatedUser = await updateUserById(req.auth.sub, {
    two_factor_secret: secret,
    two_factor_enabled: false,
  });
  await primeAuthSessionUserCache(updatedUser);

  const appName = "APP do Souza";
  const label = encodeURIComponent(`${appName}:${userRow.email}`);
  const issuer = encodeURIComponent(appName);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  await auditEvent(req, "2FA_SETUP_CREATED", req.auth.sub);
  return res.json({
    secret,
    otpauth_url: otpauthUrl,
    message: "Escaneie o QR no app autenticador e confirme com um código.",
  });
});

router.post("/2fa/enable", requireAuth, async (req, res) => {
  const otp = String(req.body?.otp || "").trim();
  const userRow = await findUserRowById(req.auth.sub);
  if (!userRow) return res.status(404).json({ error: "User not found" });
  if (!userRow.two_factor_secret) {
    return res.status(400).json({ error: "2FA não configurado. Execute /2fa/setup antes." });
  }

  if (!verifyTotp(userRow.two_factor_secret, otp)) {
    await auditEvent(req, "2FA_ENABLE_FAILED", req.auth.sub);
    return res.status(400).json({ error: "Código 2FA inválido." });
  }

  const updatedUser = await updateUserById(req.auth.sub, { two_factor_enabled: true });
  await primeAuthSessionUserCache(updatedUser);
  await auditEvent(req, "2FA_ENABLED", req.auth.sub);
  return res.json({ ok: true, two_factor_enabled: true });
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
  const otp = String(req.body?.otp || "").trim();
  const userRow = await findUserRowById(req.auth.sub);
  if (!userRow) return res.status(404).json({ error: "User not found" });
  if (!userRow.two_factor_enabled || !userRow.two_factor_secret) {
    return res.json({ ok: true, two_factor_enabled: false });
  }

  if (!verifyTotp(userRow.two_factor_secret, otp)) {
    await auditEvent(req, "2FA_DISABLE_FAILED", req.auth.sub);
    return res.status(400).json({ error: "Código 2FA inválido." });
  }

  const updatedUser = await updateUserById(req.auth.sub, {
    two_factor_enabled: false,
    two_factor_secret: null,
  });
  await primeAuthSessionUserCache(updatedUser);
  await auditEvent(req, "2FA_DISABLED", req.auth.sub);
  return res.json({ ok: true, two_factor_enabled: false });
});

router.post("/2fa/diagnose", requireAuth, async (req, res) => {
  const otp = String(req.body?.otp || "").trim();
  const userRow = await findUserRowById(req.auth.sub);
  if (!userRow) return res.status(404).json({ error: "User not found" });

  const nowMs = Date.now();
  const currentCounter = Math.floor(nowMs / 30000);
  const remainingMs = 30000 - (nowMs % 30000);
  const response = {
    has_secret: Boolean(userRow.two_factor_secret),
    two_factor_enabled: Boolean(userRow.two_factor_enabled),
    server_time_iso: new Date(nowMs).toISOString(),
    seconds_remaining: Math.ceil(remainingMs / 1000),
    server_current_code: null,
    is_valid: false,
    matched_window_steps: null,
    drift_seconds_estimate: null,
    clock_drift_warning: "",
    hint: "",
  };

  if (!userRow.two_factor_secret) {
    response.hint = "2FA ainda não foi configurado. Gere um segredo novo primeiro.";
    return res.json(response);
  }

  if (!/^\d{6}$/.test(otp)) {
    response.server_current_code = generateTotpCode(userRow.two_factor_secret, currentCounter);
    response.hint = "Digite um código de 6 dígitos.";
    return res.json(response);
  }

  for (let i = -6; i <= 6; i += 1) {
    const candidate = generateTotpCode(userRow.two_factor_secret, currentCounter + i);
    if (candidate === otp) {
      response.is_valid = true;
      response.matched_window_steps = i;
      break;
    }
  }

  if (!response.is_valid) {
    response.server_current_code = generateTotpCode(userRow.two_factor_secret, currentCounter);
    response.hint = "Código não confere com o segredo salvo. Gere novo segredo e tente novamente.";
    return res.json(response);
  }

  if (response.matched_window_steps === 0) {
    response.hint = "Código válido no tempo atual.";
  } else if (response.matched_window_steps < 0) {
    response.hint = "Código válido, mas o relógio do celular parece atrasado em relação ao servidor.";
  } else {
    response.hint = "Código válido, mas o relógio do celular parece adiantado em relação ao servidor.";
  }
  response.drift_seconds_estimate = response.matched_window_steps * 30;
  if (Math.abs(response.matched_window_steps) >= 2) {
    response.clock_drift_warning =
      "Diferença de horário detectada entre dispositivo e servidor. Ative sincronização automática de hora.";
  }

  return res.json(response);
});

router.post("/forgot-password", forgotRateLimiter, async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const neutral = { message: "Se o email existir, enviaremos instruções." };
  if (!email) return res.json(neutral);

  const userRow = await findUserRowByEmail(email);
  if (!userRow) {
    await auditEvent(req, "PASSWORD_RESET_REQUESTED", null, { email });
    return res.json(neutral);
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + Math.max(1, env.resetTokenTtlMin) * 60 * 1000
  ).toISOString();
  await createPasswordResetToken({
    user_id: userRow.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  const resetLink = `${env.appBaseUrl}/reset-password?token=${rawToken}`;
  try {
    await sendPasswordResetEmail({
      to: email,
      resetLink,
    });
  } catch (error) {
    console.error("[MAIL] Password reset send failed:", error);
    return res.status(500).json({ error: "Não foi possível enviar o e-mail de recuperação agora." });
  }

  await auditEvent(req, "PASSWORD_RESET_REQUESTED", userRow.id, { email });
  return res.json(neutral);
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }
  if (!validatePasswordStrength(newPassword)) {
    return res.status(400).json({ error: "Senha fraca. Use ao menos 8 caracteres com letras e números." });
  }

  const stored = await findValidPasswordResetTokenByHash(hashToken(token));
  if (!stored) {
    return res.status(400).json({ error: "Token inválido ou expirado." });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await updateUserById(stored.user_id, { password_hash: newHash });
  await primeAuthSessionUserCache(updatedUser);
  await markPasswordResetTokenUsed(stored.id);
  await revokeRefreshTokensByUserId(stored.user_id);
  await auditEvent(req, "PASSWORD_RESET_COMPLETED", stored.user_id);
  return res.json({ ok: true });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (!validatePasswordStrength(newPassword)) {
    return res.status(400).json({ error: "Senha fraca. Use ao menos 8 caracteres com letras e números." });
  }

  const userRow = await findUserRowById(req.auth.sub);
  if (!userRow?.password_hash) {
    return res.status(400).json({ error: "Conta sem senha local." });
  }

  const valid = await bcrypt.compare(currentPassword, userRow.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Senha atual inválida." });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await updateUserById(req.auth.sub, { password_hash: newHash });
  await primeAuthSessionUserCache(updatedUser);
  await revokeRefreshTokensByUserId(req.auth.sub);
  await auditEvent(req, "PASSWORD_CHANGED", req.auth.sub);
  return res.json({ ok: true });
});

router.post("/refresh", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const bodyToken = String(req.body?.refreshToken || "").trim();
  const cookieToken = String(cookies[env.authRefreshCookieName] || "").trim();
  logAuthRoute(req, "refresh requested", {
    hasRefreshCookieToken: Boolean(cookieToken),
    hasRefreshBodyToken: Boolean(bodyToken),
    refreshCookieName: env.authRefreshCookieName,
    cookieDomain: normalizeCookieDomain(env.authCookieDomain) || null,
    cookieSameSite: env.nodeEnv === "production" ? "none" : env.authCookieSameSite,
    cookieSecure: env.nodeEnv === "production" ? true : env.authCookieSecure,
    refreshTtlDays: Number(env.refreshTokenTtlDays || 30),
  });

  const rawToken = readRefreshToken(req);
  if (!rawToken) {
    clearSessionCookies(res);
    logAuthRoute(req, "refresh denied", { reason: "missing_refresh_token" });
    return res.status(401).json({ error: "Refresh token ausente", code: "REFRESH_TOKEN_MISSING" });
  }

  const tokenHash = hashToken(rawToken);
  const stored = await findActiveRefreshTokenByHash(tokenHash);
  if (!stored) {
    const storedAny = await findRefreshTokenByHash(tokenHash);
    clearSessionCookies(res);
    const isExpired =
      Boolean(storedAny?.expires_at) && new Date(storedAny.expires_at).getTime() <= Date.now();
    const isRevoked = Boolean(storedAny?.revoked_at);
    const reason = storedAny ? (isExpired ? "expired_refresh_token" : isRevoked ? "revoked_refresh_token" : "inactive_refresh_token") : "unknown_refresh_token";
    logAuthRoute(req, "refresh denied", {
      reason,
      tokenSource: bodyToken ? "body" : cookieToken ? "cookie" : "unknown",
      refreshExpiresAt: storedAny?.expires_at || null,
      refreshRevokedAt: storedAny?.revoked_at || null,
    });
    return res.status(401).json({
      error: isExpired ? "Refresh token expirado" : isRevoked ? "Refresh token revogado" : "Refresh token inválido",
      code: isExpired ? "REFRESH_TOKEN_EXPIRED" : isRevoked ? "REFRESH_TOKEN_REVOKED" : "REFRESH_TOKEN_INVALID",
    });
  }

  const user = await resolveSessionUser(stored.user_id);
  if (!user) {
    await revokeRefreshTokenById(stored.id);
    await clearAuthSessionUserCache(stored.user_id);
    clearSessionCookies(res);
    logAuthRoute(req, "refresh denied", { reason: "missing_user", userId: stored.user_id });
    return res.status(401).json({ error: "Sessão inválida", code: "SESSION_INVALID" });
  }

  await revokeRefreshTokenById(stored.id);
  const session = await issueSession(req, user, stored.rotate_family_id);
  setSessionCookies(res, session);
  logAuthRoute(req, "session refreshed", { userId: user.id });
  await auditEvent(req, "TOKEN_REFRESHED", user.id, { family: stored.rotate_family_id });
  return res.json(session);
});

router.post("/logout", async (req, res) => {
  const rawToken = readRefreshToken(req);
  if (rawToken) {
    const stored = await findActiveRefreshTokenByHash(hashToken(rawToken));
    if (stored) {
      await revokeRefreshTokenById(stored.id);
      await auditEvent(req, "USER_LOGGED_OUT", stored.user_id);
    }
  }
  clearSessionCookies(res);
  logAuthRoute(req, "session cleared", { reason: "logout" });
  return res.status(204).send();
});

router.post("/logout-all", requireAuth, async (req, res) => {
  await revokeRefreshTokensByUserId(req.auth.sub);
  clearSessionCookies(res);
  logAuthRoute(req, "session cleared", { userId: req.auth.sub, reason: "logout-all" });
  await auditEvent(req, "USER_LOGGED_OUT_ALL", req.auth.sub);
  return res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  logAuthRoute(req, "me request", {
    authSource: req.authSource || "unknown",
    userId: req.auth?.sub || null,
  });
  const user = await resolveSessionUser(req.auth.sub);
  if (!user) {
    await clearAuthSessionUserCache(req.auth.sub);
    clearSessionCookies(res);
    logAuthRoute(req, "me denied", { reason: "missing_user", userId: req.auth.sub });
    return res.status(401).json({ error: "User not found" });
  }
  if (user.account_status === "deactivated") {
    logAuthRoute(req, "me blocked", { reason: "deactivated", userId: req.auth.sub });
    return res.status(403).json({ error: "Conta desativada. Faca login novamente para reativar." });
  }
  logAuthRoute(req, "me success", { userId: req.auth.sub });
  return res.json(user);
});

router.post("/me/deactivate", requireAuth, async (req, res) => {
  const user = await findUserById(req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

  const updated = await updateUserById(req.auth.sub, {
    account_status: "deactivated",
    deactivated_at: new Date().toISOString(),
  });
  await primeAuthSessionUserCache(updated);

  return res.json({ ok: true, user: updated });
});

router.delete("/me", requireAuth, async (req, res) => {
  const user = await findUserPrivateById(req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (canAccessPendingFile(user.profile_image_pending_name)) {
    const pendingPath = path.resolve(profilePendingDir, user.profile_image_pending_name);
    await fs.promises.unlink(pendingPath).catch((err) => {
      if (err?.code !== "ENOENT") {
        console.warn("[auth] pending file delete failed", { message: err?.message || "unknown" });
      }
    });
  }

  removePublicFileByUrl(user.profile_image_url);
  await deleteUserById(req.auth.sub);
  await clearAuthSessionUserCache(req.auth.sub);

  return res.status(204).send();
});

router.post(
  "/me/profile-image",
  requireAuth,
  (req, res, next) => {
    profileImageUpload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: `Arquivo muito grande. Maximo ${env.profileImageMaxSizeMb}MB.` });
      }
      return res.status(400).json({ error: error.message || "Falha no upload da imagem." });
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo de imagem obrigatorio." });
    }

    const user = await findUserPrivateById(req.auth.sub);
    if (!user) return res.status(401).json({ error: "User not found" });

    const moderation = evaluateImageModeration(req.file.originalname);
    removePendingFileByName(user.profile_image_pending_name);
    const currentPublicUrl = String(user.profile_image_url || "").trim();
    const updatePayload = {
      profile_image_mode: "photo",
      profile_image_status: moderation.status,
      profile_image_reject_reason: moderation.reason,
      profile_image_moderation_score: moderation.score,
      profile_image_uploaded_at: new Date().toISOString(),
      profile_image_pending_name: "",
    };

    if (moderation.status === "approved") {
      const approvedVersion = await createUserProfileImageVersion(req.auth.sub, {
        mime_type: req.file.mimetype,
        file_name: req.file.originalname || `profile-${req.auth.sub}`,
        data: req.file.buffer,
      });
      await upsertUserProfileImages(req.auth.sub, {
        approved_mime_type: req.file.mimetype,
        approved_file_name: req.file.originalname || `profile-${req.auth.sub}`,
        approved_data: req.file.buffer,
        pending_mime_type: null,
        pending_file_name: null,
        pending_data: null,
      });
      const cloudinaryUrl = await uploadProfileImageToCloudinary(
        req.auth.sub,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname || `profile-${req.auth.sub}`
      );
      updatePayload.profile_image_url = cloudinaryUrl || buildProfileImageVersionUrl(req, approvedVersion.id);
      updatePayload.profile_image_reject_reason = "";
    } else if (moderation.status === "rejected") {
      await upsertUserProfileImages(req.auth.sub, {
        pending_mime_type: null,
        pending_file_name: null,
        pending_data: null,
      });
      updatePayload.profile_image_url = currentPublicUrl;
    } else {
      await upsertUserProfileImages(req.auth.sub, {
        pending_mime_type: req.file.mimetype,
        pending_file_name: req.file.originalname || `pending-${req.auth.sub}`,
        pending_data: req.file.buffer,
      });
      updatePayload.profile_image_url = currentPublicUrl;
      updatePayload.profile_image_pending_name = req.file.originalname || `pending-${req.auth.sub}`;
    }

    const updated = await updateUserById(req.auth.sub, updatePayload);
    await primeAuthSessionUserCache(updated);
    emitEntityChanged(req, "user", req.auth.sub, "updated");
    return res.status(201).json({
      ok: true,
      moderation: {
        status: moderation.status,
        reason: moderation.reason,
        score: moderation.score,
      },
      user: updated,
    });
  }
);

router.delete("/me/profile-image/pending", requireAuth, async (req, res) => {
  const user = await findUserPrivateById(req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (canAccessPendingFile(user.profile_image_pending_name)) {
    const pendingPath = path.resolve(profilePendingDir, user.profile_image_pending_name);
    await fs.promises.unlink(pendingPath).catch((err) => {
      if (err?.code !== "ENOENT") {
        console.warn("[auth] pending file delete failed", { message: err?.message || "unknown" });
      }
    });
  }
  await upsertUserProfileImages(req.auth.sub, {
    pending_mime_type: null,
    pending_file_name: null,
    pending_data: null,
  });

  const updated = await updateUserById(req.auth.sub, {
    profile_image_status: user.profile_image_url ? "approved" : "none",
    profile_image_pending_name: "",
    profile_image_reject_reason: "",
    profile_image_moderation_score: null,
    profile_image_uploaded_at: null,
  });
  await primeAuthSessionUserCache(updated);

  emitEntityChanged(req, "user", req.auth.sub, "updated");
  return res.json({ ok: true, user: updated });
});

router.get("/me/profile-image/private", requireAuth, async (req, res) => {
  const user = await findUserPrivateById(req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

  const profileImages = await getUserProfileImages(req.auth.sub);
  if (profileImages?.pending_data) {
    res.setHeader("Content-Type", profileImages.pending_mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(profileImages.pending_data);
  }

  if (!canAccessPendingFile(user.profile_image_pending_name)) {
    return res.status(404).json({ error: "Imagem privada nao encontrada." });
  }

  const pendingPath = path.resolve(profilePendingDir, user.profile_image_pending_name);
  return res.sendFile(pendingPath);
});

router.get("/me/profile-images", requireAuth, async (req, res) => {
  const user = await findUserPrivateById(req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

  const versions = await listUserProfileImageVersions(req.auth.sub);
  const approved_urls = versions.map((item) => buildProfileImageVersionUrl(req, item.id));
  const current_url = String(user.profile_image_url || "").trim();

  return res.json({
    current_url: current_url || "",
    approved_urls: current_url && !approved_urls.includes(current_url)
      ? [current_url, ...approved_urls]
      : approved_urls,
  });
});

router.get("/admin/profile-images", requireAuth, requireAdmin, async (req, res) => {
  const status = String(req.query.status || "manual_review").toLowerCase();
  const allowed = new Set(["manual_review", "approved", "rejected", "none"]);
  const normalizedStatus = allowed.has(status) ? status : "manual_review";
  const cacheKey = buildAdminProfileImagesCacheKey(normalizedStatus);

  try {
    const items = await getOrComputeCacheJson(cacheKey, ADMIN_PROFILE_IMAGES_TTL_MS, async () => {
      const rows = await listUsersByProfileImageStatus(normalizedStatus);
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        nick: row.nick,
        profile_image_status: row.profile_image_status,
        profile_image_reject_reason: row.profile_image_reject_reason,
        profile_image_moderation_score: row.profile_image_moderation_score,
        profile_image_uploaded_at: row.profile_image_uploaded_at,
        profile_image_url: row.profile_image_url,
        has_pending_image: Boolean(row.profile_image_pending_name),
      }));
    });

    return res.json(Array.isArray(items) ? items : []);
  } catch (error) {
    console.error("[auth-admin-profile-images] load failed", {
      status: normalizedStatus,
      message: error?.message || "unknown error",
    });
    await setCacheJson(cacheKey, [], 5000).catch(() => {});
    return res.json([]);
  }
});

router.get("/admin/profile-images/:userId/preview", requireAuth, requireAdmin, async (req, res) => {
  const user = await findUserPrivateById(req.params.userId);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

  const profileImages = await getUserProfileImages(user.id);

  if (user.profile_image_status === "manual_review" && profileImages?.pending_data) {
    res.setHeader("Content-Type", profileImages.pending_mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(profileImages.pending_data);
  }

  if (user.profile_image_status === "manual_review" && canAccessPendingFile(user.profile_image_pending_name)) {
    const pendingPath = path.resolve(profilePendingDir, user.profile_image_pending_name);
    return res.sendFile(pendingPath);
  }

  if (profileImages?.approved_data) {
    res.setHeader("Content-Type", profileImages.approved_mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(profileImages.approved_data);
  }

  if (user.profile_image_status === "approved" && user.profile_image_url) {
    if (isExternalHttpUrl(user.profile_image_url)) {
      return res.redirect(user.profile_image_url);
    }
    const marker = "/uploads/profile/";
    const idx = user.profile_image_url.indexOf(marker);
    if (idx !== -1) {
      const fileName = user.profile_image_url.slice(idx + marker.length);
      if (fileName && !fileName.includes("/") && !fileName.includes("\\")) {
        const filePath = path.resolve(profilePublicDir, fileName);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
    }
  }

  return res.status(404).json({ error: "Imagem nao encontrada." });
});

router.post("/admin/profile-images/:userId/approve", requireAuth, requireAdmin, async (req, res) => {
  const user = await findUserPrivateById(req.params.userId);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

  if (user.profile_image_status !== "manual_review") {
    return res.status(400).json({ error: "Apenas fotos em analise podem ser aprovadas." });
  }

  const profileImages = await getUserProfileImages(user.id);
  let approvedVersion = null;
  let approvedBuffer = null;
  let approvedMimeType = "image/jpeg";
  let approvedFileName = `profile-${user.id}`;
  if (profileImages?.pending_data) {
    approvedBuffer = profileImages.pending_data;
    approvedMimeType = profileImages.pending_mime_type || "image/jpeg";
    approvedFileName = profileImages.pending_file_name || `profile-${user.id}`;
    approvedVersion = await createUserProfileImageVersion(user.id, {
      mime_type: approvedMimeType,
      file_name: approvedFileName,
      data: approvedBuffer,
    });
    await upsertUserProfileImages(user.id, {
      approved_mime_type: approvedMimeType,
      approved_file_name: approvedFileName,
      approved_data: approvedBuffer,
      pending_mime_type: null,
      pending_file_name: null,
      pending_data: null,
    });
  } else {
    if (!canAccessPendingFile(user.profile_image_pending_name)) {
      return res.status(404).json({ error: "Arquivo pendente nao encontrado." });
    }

    const ext = path.extname(user.profile_image_pending_name || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    const publicFilename = `profile-${user.id}-${Date.now()}${safeExt}`;
    const sourcePath = path.resolve(profilePendingDir, user.profile_image_pending_name);
    const targetPath = path.resolve(profilePublicDir, publicFilename);

    await fs.promises.rename(sourcePath, targetPath);
    const fileBuffer = await fs.promises.readFile(targetPath);
    approvedBuffer = fileBuffer;
    approvedMimeType = safeExt === ".png" ? "image/png" : safeExt === ".webp" ? "image/webp" : "image/jpeg";
    approvedFileName = user.profile_image_pending_name || publicFilename;
    approvedVersion = await createUserProfileImageVersion(user.id, {
      mime_type: approvedMimeType,
      file_name: approvedFileName,
      data: approvedBuffer,
    });
    await upsertUserProfileImages(user.id, {
      approved_mime_type: approvedMimeType,
      approved_file_name: approvedFileName,
      approved_data: approvedBuffer,
      pending_mime_type: null,
      pending_file_name: null,
      pending_data: null,
    });
  }
  removePublicFileByUrl(user.profile_image_url);
  const cloudinaryUrl = approvedVersion
    ? await uploadProfileImageToCloudinary(
        user.id,
        approvedBuffer,
        approvedMimeType,
        approvedFileName
      )
    : "";

  const updated = await updateUserById(user.id, {
    profile_image_status: "approved",
    profile_image_url:
      cloudinaryUrl ||
      (approvedVersion ? buildProfileImageVersionUrl(req, approvedVersion.id) : buildProfileImageUrl(req, user.id)),
    profile_image_pending_name: "",
    profile_image_reject_reason: "",
    profile_image_mode: "photo",
  });
  await primeAuthSessionUserCache(updated);

  await deleteCacheByPrefix("auth:admin-profile-images:").catch(() => {});
  emitEntityChanged(req, "user", user.id, "updated");
  return res.json({ ok: true, user: updated });
});

router.post("/admin/profile-images/:userId/reject", requireAuth, requireAdmin, async (req, res) => {
  const user = await findUserPrivateById(req.params.userId);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

  const reason = String(req.body?.reason || "").trim() || "Rejeitada pela moderacao.";

  if (canAccessPendingFile(user.profile_image_pending_name)) {
    const pendingPath = path.resolve(profilePendingDir, user.profile_image_pending_name);
    await fs.promises.unlink(pendingPath).catch((err) => {
      if (err?.code !== "ENOENT") {
        console.warn("[auth] pending file delete failed", { message: err?.message || "unknown" });
      }
    });
  }
  await upsertUserProfileImages(user.id, {
    pending_mime_type: null,
    pending_file_name: null,
    pending_data: null,
  });

  const updated = await updateUserById(user.id, {
    profile_image_status: user.profile_image_url ? "approved" : "rejected",
    profile_image_url: user.profile_image_url || "",
    profile_image_pending_name: "",
    profile_image_reject_reason: reason,
  });
  await primeAuthSessionUserCache(updated);

  await deleteCacheByPrefix("auth:admin-profile-images:").catch(() => {});
  emitEntityChanged(req, "user", user.id, "updated");
  return res.json({ ok: true, user: updated });
});

router.get("/profile-image/:userId", async (req, res) => {
  const user = await findUserPrivateById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: "Imagem nao encontrada." });
  }

  const currentVersionId = extractProfileImageVersionId(user.profile_image_url);
  if (currentVersionId) {
    const version = await getUserProfileImageVersion(currentVersionId);
    if (version?.data) {
      res.setHeader("Content-Type", version.mime_type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(version.data);
    }
  }

  const profileImages = await getUserProfileImages(user.id);
  if (profileImages?.approved_data) {
    res.setHeader("Content-Type", profileImages.approved_mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(profileImages.approved_data);
  }

  if (user.profile_image_url) {
    if (isExternalHttpUrl(user.profile_image_url)) {
      return res.redirect(user.profile_image_url);
    }
    const marker = "/uploads/profile/";
    const idx = user.profile_image_url.indexOf(marker);
    if (idx !== -1) {
      const fileName = user.profile_image_url.slice(idx + marker.length);
      if (fileName && !fileName.includes("/") && !fileName.includes("\\")) {
        const filePath = path.resolve(profilePublicDir, fileName);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
    }
  }

  return res.status(404).json({ error: "Imagem nao encontrada." });
});

router.get("/profile-image-version/:imageId", async (req, res) => {
  const version = await getUserProfileImageVersion(req.params.imageId);
  if (!version?.data) {
    return res.status(404).json({ error: "Imagem nao encontrada." });
  }

  if (version.user_id) {
    const linkedUser = await findUserPrivateById(version.user_id);
    if (
      linkedUser &&
      String(linkedUser.profile_image_status || "").toLowerCase() === "approved" &&
      isExternalHttpUrl(linkedUser.profile_image_url)
    ) {
      return res.redirect(linkedUser.profile_image_url);
    }
  }

  res.setHeader("Content-Type", version.mime_type || "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(version.data);
});

router.patch("/me", requireAuth, async (req, res) => {
  const payload = req.body || {};
  const allowedFields = [
    "full_name",
    "nick",
    "phone",
    "platform_id",
    "avatar_emoji",
    "profile_avatar_id",
    "profile_image_mode",
    "terms_accepted",
    "privacy_accepted",
    "onboarding_completed",
  ];

  const update = {};
  for (const key of allowedFields) {
    if (key in payload) {
      update[key] = payload[key];
    }
  }

  try {
    if ("nick" in update) {
      update.nick = sanitizeNick(update.nick);
    }

    if ("phone" in update) {
      update.phone = sanitizePhone(update.phone);
    }

    await ensureUniqueIdentityFields({
      nick: "nick" in update ? update.nick : "",
      phone: "phone" in update ? update.phone : "",
      excludeUserId: req.auth.sub,
    });
  } catch (error) {
    return res.status(error.status || 409).json({ error: error.message || "Dados já cadastrados" });
  }

  if ("profile_image_mode" in update) {
    const mode = String(update.profile_image_mode || "").toLowerCase();
    if (!["avatar", "photo"].includes(mode)) {
      return res.status(400).json({ error: "profile_image_mode invalido" });
    }
    update.profile_image_mode = mode;
  }

  if ("profile_avatar_id" in update) {
    update.profile_avatar_id = String(update.profile_avatar_id || "").trim();
  }

  const updated = await updateUserById(req.auth.sub, update);
  if (!updated) return res.status(404).json({ error: "User not found" });
  await primeAuthSessionUserCache(updated);
  emitEntityChanged(req, "user", req.auth.sub, "updated");
  return res.json(updated);
});

export default router;

