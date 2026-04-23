import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { env, isAllowedOrigin } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import adminEventsRoutes from "./routes/adminEvents.js";
import depositsRoutes from "./routes/deposits.js";
import gamificationRoutes from "./routes/gamification.js";
import engagementRoutes from "./routes/engagement.js";
import socialRoutes from "./routes/social.js";
import pointsRoutes from "./routes/points.js";
import dailyChestRoutes from "./routes/dailyChest.js";
import createEntitiesRouter from "./routes/entities.js";
import uploadsRoutes from "./routes/uploads.js";
import { appendNavigationLog, checkDbHealth } from "./db/index.js";
import { getClientIp, getForwardedForChain, recordClientTraffic } from "./lib/clientTrafficMonitor.js";
import { genericUploadsDir, uploadsDir } from "./lib/paths.js";
import { getHttpMetricsSnapshot, recordHttpMetric } from "./lib/httpMetrics.js";
import { getRuntimeBuildInfo } from "./lib/runtimeBuildInfo.js";

const SLOW_HTTP_THRESHOLD_MS = 700;
const EXPLICIT_CORS_ORIGINS = [
  "https://souzatv.app",
  "https://www.souzatv.app",
  "http://localhost:3000",
];

function normalizeMetricPath(req) {
  const basePath = String(req.baseUrl || "").trim();
  const routePath =
    typeof req.route?.path === "string"
      ? req.route.path
      : Array.isArray(req.route?.path)
        ? req.route.path.join("|")
        : "";
  const normalized = `${basePath}${routePath}`.trim();
  if (normalized) {
    return normalized.replace(/\/+/g, "/");
  }

  const rawPath = String(req.path || req.originalUrl || "").split("?")[0].trim();
  if (!rawPath) return "unknown";

  return rawPath
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

function buildCors() {
  const allowedOrigins = [...new Set([...EXPLICIT_CORS_ORIGINS, ...(env.origins || [])])];

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || isAllowedOrigin(origin)) return callback(null, true);
      console.warn("[cors] blocked origin", { origin: origin || null });
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}

function buildRateLimiter({ windowMs, limit, prefix = "ratelimit:" } = {}) {
  const isProd = env.nodeEnv === "production";

  if (!isProd) {
    return (_req, _res, next) => next();
  }

  const resolvedWindowMs = windowMs ?? Math.max(1, env.rateLimitApiWindowMin) * 60 * 1000;
  const resolvedLimit = limit ?? Math.max(1, env.rateLimitApiMax);
  const baseConfig = {
    windowMs: resolvedWindowMs,
    limit: resolvedLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests" },
    handler(req, res, _next, options) {
      console.warn("[ratelimit] blocked", {
        method: req.method,
        path: req.originalUrl,
        clientIp: req._clientIp || getClientIp(req),
        forwardedFor: req._forwardedForChain || getForwardedForChain(req),
        origin: req.headers.origin || null,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
        statusCode: Number(options?.statusCode || 429),
        limit: Number(options?.limit || resolvedLimit),
        windowMs: Number(options?.windowMs || resolvedWindowMs),
      });
      return res.status(Number(options?.statusCode || 429)).json(options?.message || { error: "Too many requests" });
    },
  };

  if (!env.redisUrl) {
    return rateLimit(baseConfig);
  }

  const redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Não bloqueia o startup se Redis ainda não estiver pronto
    lazyConnect: true,
    connectTimeout: 5000,
  });
  redisClient.on("error", (err) => {
    console.warn("[ratelimit] redis error", { message: err?.message || "unknown" });
  });

  return rateLimit({
    ...baseConfig,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix,
    }),
  });
}

function shouldLogRouteTiming(path = "", durationMs = 0, status = 200) {
  const normalized = String(path || "").trim();
  if (Number(status || 0) >= 400) return true;
  if (Number(durationMs || 0) >= SLOW_HTTP_THRESHOLD_MS) return true;
  return [
    "/health",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/refresh",
    "/api/profile/metrics",
    "/api/home/summary",
    "/api/home/feed-summary",
    "/api/dynamics/summary",
    "/api/ui/public-config",
    "/api/leaderboards/weekly",
    "/api/winnings/summary",
  ].includes(normalized);
}

export function createApp(io) {
  const app = express();
  app.locals.io = io;
  app.locals.startedAt = new Date().toISOString();
  app.locals.buildInfo = getRuntimeBuildInfo();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: { action: "deny" },
      hsts:
        env.nodeEnv === "production"
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );
  app.use(buildCors());
  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "").trim();
    const allowedOrigins = [...new Set([...EXPLICIT_CORS_ORIGINS, ...(env.origins || [])])];
    const allowOrigin = allowedOrigins.includes(origin) || isAllowedOrigin(origin) ? origin : allowedOrigins[0];

    if (allowOrigin) {
      res.header("Access-Control-Allow-Origin", allowOrigin);
    }
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
  app.use((req, res, next) => {
    req._clientIp = getClientIp(req);
    req._forwardedForChain = getForwardedForChain(req);
    req._startedAtMs = Date.now();
    const shouldLogStart = shouldLogRouteTiming(req.path);

    if (shouldLogStart) {
      console.info("[http] request:start", {
        method: req.method,
        path: req.originalUrl,
        clientIp: req._clientIp || null,
        forwardedFor: req._forwardedForChain || [],
        origin: req.headers.origin || null,
        host: req.headers.host || null,
        hasCookieHeader: Boolean(req.headers.cookie),
        hasAuthorizationHeader: Boolean(req.headers.authorization),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
      });
    }

    res.on("finish", () => {
      const durationMs = Date.now() - req._startedAtMs;
      const metricPath = normalizeMetricPath(req);
      recordHttpMetric(metricPath, res.statusCode, durationMs, {
        slowThresholdMs: SLOW_HTTP_THRESHOLD_MS,
      });
      const suspiciousClient = recordClientTraffic({
        clientIp: req._clientIp || "",
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        slowThresholdMs: SLOW_HTTP_THRESHOLD_MS,
      });
      if (suspiciousClient) {
        console.warn("[traffic-monitor] suspicious-client", suspiciousClient);
      }
      if (shouldLogStart || shouldLogRouteTiming(metricPath, durationMs, res.statusCode)) {
        console.info("[http] request:finish", {
          method: req.method,
          path: req.originalUrl,
          metricPath,
          status: res.statusCode,
          durationMs,
          clientIp: req._clientIp || null,
          forwardedFor: req._forwardedForChain || [],
          origin: req.headers.origin || null,
          hasCookieHeader: Boolean(req.headers.cookie),
          hasAuthorizationHeader: Boolean(req.headers.authorization),
        });
      }
    });

    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.use(express.urlencoded({ extended: true }));

  const apiRateLimiter = buildRateLimiter({
    windowMs: Math.max(1, env.rateLimitApiWindowMin) * 60 * 1000,
    limit: Math.max(1, env.rateLimitApiMax),
    prefix: "ratelimit:api:",
  });
  const authApiRateLimiter = buildRateLimiter({
    windowMs: Math.max(1, env.rateLimitAuthApiWindowMin) * 60 * 1000,
    limit: Math.max(1, env.rateLimitAuthApiMax),
    prefix: "ratelimit:auth:",
  });
  const uploadRateLimiter = buildRateLimiter({
    windowMs: Math.max(1, env.rateLimitUploadWindowMin) * 60 * 1000,
    limit: Math.max(1, env.rateLimitUploadMax),
    prefix: "ratelimit:uploads:",
  });
  const navigationRateLimiter = buildRateLimiter({
    windowMs: Math.max(1, env.rateLimitNavigationWindowMin) * 60 * 1000,
    limit: Math.max(1, env.rateLimitNavigationMax),
    prefix: "ratelimit:navigation:",
  });
  const adminRateLimiter = buildRateLimiter({
    windowMs: 60 * 1000,
    limit: 180,
    prefix: "ratelimit:admin:",
  });
  app.get("/", (_req, res) => {
    res.type("text/plain").send("API SOUZA ONLINE");
  });

  app.get("/health", async (_req, res) => {
    const dbOk = await checkDbHealth();
    const status = dbOk ? 200 : 503;
    res.setHeader("Cache-Control", "no-store");
    res.status(status).json({
      ok: dbOk,
      service: "app-souza-cass-backend",
      timestamp: new Date().toISOString(),
      startedAt: app.locals.startedAt,
      uptimeSec: Math.round(process.uptime()),
      db: dbOk,
      redis: Boolean(env.redisUrl),
      build: app.locals.buildInfo,
    });
  });

  app.get("/version", (_req, res) => {
    // Runtime probe route used to verify that the latest backend revision is active in production.
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      startedAt: app.locals.startedAt,
      build: app.locals.buildInfo,
    });
  });

  app.get("/health/metrics", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const snapshot = getHttpMetricsSnapshot();
    res.json({
      ok: true,
      service: "app-souza-cass-backend",
      timestamp: new Date().toISOString(),
      redis: Boolean(env.redisUrl),
      metrics: snapshot,
    });
  });

  const uploadsStaticOptions = {
    etag: true,
    maxAge: "15m",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=900");
    },
  };

  app.use("/uploads", express.static(genericUploadsDir, uploadsStaticOptions));
  if (path.resolve(genericUploadsDir) !== path.resolve(uploadsDir)) {
    app.use("/uploads", express.static(uploadsDir, uploadsStaticOptions));
  }
  app.use("/api/uploads", express.static(genericUploadsDir, uploadsStaticOptions));
  if (path.resolve(genericUploadsDir) !== path.resolve(uploadsDir)) {
    app.use("/api/uploads", express.static(uploadsDir, uploadsStaticOptions));
  }

  app.use("/api/auth", authApiRateLimiter, authRoutes);
  app.use("/api", apiRateLimiter);
  app.use("/api/admin", adminRateLimiter);
  app.use("/api", adminEventsRoutes);
  app.use("/api", depositsRoutes);
  app.use("/api", gamificationRoutes);
  app.use("/api", engagementRoutes);
  app.use("/api", socialRoutes);
  app.use("/api/points", pointsRoutes);
  app.use("/api/daily-chest", dailyChestRoutes);
  app.use("/api/entities", createEntitiesRouter(io));
  app.use("/api/uploads", uploadRateLimiter, uploadsRoutes);

  app.post("/api/logs/navigation", navigationRateLimiter, async (req, res) => {
    try {
      await appendNavigationLog({
        pageName: req.body?.pageName || "unknown",
        userId: req.body?.userId || null,
      });
    } catch (error) {
      console.error("Failed to append navigation log", error);
    }

    res.status(204).send();
  });

  app.use((error, req, res, _next) => {
    console.error("[global-error-handler]", {
      path: req.originalUrl,
      method: req.method,
      message: error?.message || "Internal server error",
      stack: error?.stack || null,
    });

    if (error?.message === "Not allowed by CORS") {
      return res.status(403).json({ error: error.message });
    }

    console.error("[http] request:error", {
      method: req.method,
      path: req.originalUrl,
      status: Number(error?.status || 500),
      durationMs: Date.now() - Number(req._startedAtMs || Date.now()),
      clientIp: req._clientIp || getClientIp(req),
      forwardedFor: req._forwardedForChain || getForwardedForChain(req),
      origin: req.headers.origin || null,
      hasCookieHeader: Boolean(req.headers.cookie),
      hasAuthorizationHeader: Boolean(req.headers.authorization),
      message: error?.message || "Internal server error",
    });
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: error?.message || "Internal server error" });
  });

  return app;
}
