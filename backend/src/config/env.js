import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";
const rawOrigin = process.env.ORIGIN || "*";
const productionAllowedOrigins = ["https://souzatv.app", "https://www.souzatv.app"];
const developmentAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function readEnv(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function isStrongSecret(value) {
  return String(value || "").trim().length >= 32;
}

function assertProductionEnv(condition, message) {
  if (!condition && isProd) {
    throw new Error(message);
  }
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3001),
  origin: rawOrigin,
  origins: rawOrigin.split(",").map((v) => v.trim()).filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || "",
  dbPoolMax: Number(process.env.DB_POOL_MAX || 10),
  dbIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  dbConnectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  redisUrl: process.env.REDIS_URL || "",
  jwtSecret: readEnv("JWT_SECRET", isProd ? "" : "dev-secret"),
  jwtAccessSecret: readEnv("JWT_ACCESS_SECRET", readEnv("JWT_SECRET", isProd ? "" : "dev-access-secret")),
  jwtRefreshSecret: readEnv("JWT_REFRESH_SECRET", readEnv("JWT_SECRET", isProd ? "" : "dev-refresh-secret")),
  accessTokenTtlMin: Number(process.env.ACCESS_TOKEN_TTL_MIN || 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  resetTokenTtlMin: Number(process.env.RESET_TOKEN_TTL_MIN || 20),
  rateLimitApiWindowMin: Number(process.env.RATE_LIMIT_API_WINDOW_MIN || 1),
  rateLimitApiMax: Number(process.env.RATE_LIMIT_API_MAX || 600),
  rateLimitAuthApiWindowMin: Number(process.env.RATE_LIMIT_AUTH_API_WINDOW_MIN || 1),
  rateLimitAuthApiMax: Number(process.env.RATE_LIMIT_AUTH_API_MAX || 120),
  rateLimitUploadWindowMin: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MIN || 1),
  rateLimitUploadMax: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 30),
  rateLimitNavigationWindowMin: Number(process.env.RATE_LIMIT_NAV_WINDOW_MIN || 1),
  rateLimitNavigationMax: Number(process.env.RATE_LIMIT_NAV_MAX || 90),
  rateLimitLoginWindowMin: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MIN || 10),
  rateLimitLoginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX || 20),
  lockoutMaxFails: Number(process.env.LOCKOUT_MAX_FAILS || 5),
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES || 10),
  appBaseUrl: readEnv("APP_BASE_URL", isProd ? "" : "http://localhost:3000"),
  mailMode: process.env.MAIL_MODE || "console",
  resendApiKey: readEnv("RESEND_API_KEY", ""),
  resendFromEmail: readEnv("RESEND_FROM_EMAIL", ""),
  resendFromName: readEnv("RESEND_FROM_NAME", "SouzaTV"),
  uploadsBaseUrl: process.env.UPLOADS_BASE_URL || "",
  genericUploadsDir: readEnv("GENERIC_UPLOADS_DIR", ""),
  cloudinaryUrl: readEnv("CLOUDINARY_URL", ""),
  cloudinaryCloudName: readEnv("CLOUDINARY_CLOUD_NAME", ""),
  cloudinaryApiKey: readEnv("CLOUDINARY_API_KEY", ""),
  cloudinaryApiSecret: readEnv("CLOUDINARY_API_SECRET", ""),
  cloudinaryUploadsFolder: readEnv("CLOUDINARY_UPLOADS_FOLDER", "souza-app/uploads"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  adminEmail: readEnv("ADMIN_EMAIL", isProd ? "" : "admin@local.dev"),
  adminPassword: readEnv("ADMIN_PASSWORD", isProd ? "" : "admin123456"),
  adminName: readEnv("ADMIN_NAME", "Admin Local"),
  adminNick: readEnv("ADMIN_NICK", "admin"),
  profileImageRequireReview: String(process.env.PROFILE_IMAGE_REQUIRE_REVIEW || "true") === "true",
  profileImageMaxSizeMb: Number(process.env.PROFILE_IMAGE_MAX_SIZE_MB || 5),
  authAccessCookieName: readEnv("AUTH_ACCESS_COOKIE_NAME", "souza_access_token"),
  authRefreshCookieName: readEnv("AUTH_REFRESH_COOKIE_NAME", "souza_refresh_token"),
  authCookieDomain: readEnv("AUTH_COOKIE_DOMAIN", ""),
  authCookiePath: readEnv("AUTH_COOKIE_PATH", "/"),
  authCookieSameSite: readEnv("AUTH_COOKIE_SAMESITE", "lax").toLowerCase(),
  authCookieSecure: readEnv("AUTH_COOKIE_SECURE", isProd ? "true" : "false") === "true",
  authCookieHttpOnly: readEnv("AUTH_COOKIE_HTTPONLY", "true") !== "false",
};

const normalizedOriginSet = new Set(
  [...env.origins, ...(isProd ? productionAllowedOrigins : developmentAllowedOrigins)]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
);

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (env.origin === "*" && !isProd) return true;

  const value = String(origin || "").trim();
  if (!value) return true;
  if (normalizedOriginSet.has(value)) return true;

  return false;
}

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

assertProductionEnv(env.origin !== "*", "ORIGIN cannot be '*' in production");
assertProductionEnv(env.origins.length > 0, "ORIGIN must list at least one allowed origin in production");
assertProductionEnv(
  env.origins.every((origin) => productionAllowedOrigins.includes(origin)),
  "ORIGIN in production must contain only https://souzatv.app and https://www.souzatv.app"
);
assertProductionEnv(Boolean(env.jwtSecret), "JWT_SECRET is required in production");
assertProductionEnv(isStrongSecret(env.jwtSecret), "JWT_SECRET must have at least 32 characters in production");
assertProductionEnv(Boolean(env.jwtAccessSecret), "JWT_ACCESS_SECRET is required in production");
assertProductionEnv(isStrongSecret(env.jwtAccessSecret), "JWT_ACCESS_SECRET must have at least 32 characters in production");
assertProductionEnv(Boolean(env.jwtRefreshSecret), "JWT_REFRESH_SECRET is required in production");
assertProductionEnv(isStrongSecret(env.jwtRefreshSecret), "JWT_REFRESH_SECRET must have at least 32 characters in production");
assertProductionEnv(Boolean(String(env.appBaseUrl || "").trim()), "APP_BASE_URL is required in production");
assertProductionEnv(
  String(env.appBaseUrl || "").startsWith("https://"),
  "APP_BASE_URL must use https in production"
);
assertProductionEnv(env.authCookieSecure, "AUTH_COOKIE_SECURE must be true in production");
assertProductionEnv(env.authCookieHttpOnly, "AUTH_COOKIE_HTTPONLY must be true in production");
assertProductionEnv(
  ["lax", "strict", "none"].includes(env.authCookieSameSite),
  "AUTH_COOKIE_SAMESITE must be lax, strict or none in production"
);
assertProductionEnv(
  env.mailMode !== "resend" || Boolean(env.resendApiKey),
  "RESEND_API_KEY is required when MAIL_MODE=resend in production"
);
assertProductionEnv(
  env.mailMode !== "resend" || Boolean(env.resendFromEmail),
  "RESEND_FROM_EMAIL is required when MAIL_MODE=resend in production"
);
