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
import dailyChestRoutes from "./routes/dailyChest.js";
import depositsRoutes from "./routes/deposits.js";
import engagementRoutes from "./routes/engagement.js";
import gamificationRoutes from "./routes/gamification.js";
import socialRoutes from "./routes/social.js";
import createEntitiesRouter from "./routes/entities.js";
import pointsRoutes from "./routes/points.js";
import uploadsRoutes from "./routes/uploads.js";
import { appendNavigationLog } from "./db/index.js";
import { genericUploadsDir, uploadsDir } from "./lib/paths.js";
import { getHttpMetricsSnapshot, recordHttpMetric } from "./lib/httpMetrics.js";

function buildCors() {
  if (env.origin === "*") {
    return cors({ origin: true, credentials: false });
  }

  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
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

  const baseConfig = {
    windowMs: windowMs ?? Math.max(1, env.rateLimitApiWindowMin) * 60 * 1000,
    limit: limit ?? Math.max(1, env.rateLimitApiMax),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests" },
  };

  if (!env.redisUrl) {
    return rateLimit(baseConfig);
  }

  const redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return rateLimit({
    ...baseConfig,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix,
    }),
  });
}

function shouldLogRouteTiming(path = "") {
  const normalized = String(path || "").trim();
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
  app.options(/.*/, buildCors());
  app.use((req, res, next) => {
    req._startedAtMs = Date.now();

    if (shouldLogRouteTiming(req.path)) {
      console.info("[http] request:start", {
        method: req.method,
        path: req.originalUrl,
        origin: req.headers.origin || null,
        host: req.headers.host || null,
        hasCookieHeader: Boolean(req.headers.cookie),
        hasAuthorizationHeader: Boolean(req.headers.authorization),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
      });

      res.on("finish", () => {
        const durationMs = Date.now() - req._startedAtMs;
        recordHttpMetric(req.path, res.statusCode, durationMs);
        console.info("[http] request:finish", {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs,
          origin: req.headers.origin || null,
          hasCookieHeader: Boolean(req.headers.cookie),
          hasAuthorizationHeader: Boolean(req.headers.authorization),
        });
      });
    }

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
  const engagementMutationRateLimiter = buildRateLimiter({
    windowMs: 60 * 1000,
    limit: 120,
    prefix: "ratelimit:engagement:",
  });
  const engagementMutationOnly = (req, res, next) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(String(req.method || "").toUpperCase())) {
      return next();
    }
    return engagementMutationRateLimiter(req, res, next);
  };

  app.get("/", (_req, res) => {
    res.type("text/plain").send("API SOUZA ONLINE");
  });

  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      service: "app-souza-cass-backend",
      timestamp: new Date().toISOString(),
      startedAt: app.locals.startedAt,
      uptimeSec: Math.round(process.uptime()),
      redis: Boolean(env.redisUrl),
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

  app.use("/uploads", express.static(genericUploadsDir));
  if (path.resolve(genericUploadsDir) !== path.resolve(uploadsDir)) {
    app.use("/uploads", express.static(uploadsDir));
  }
  app.use("/api/uploads", express.static(genericUploadsDir));
  if (path.resolve(genericUploadsDir) !== path.resolve(uploadsDir)) {
    app.use("/api/uploads", express.static(uploadsDir));
  }

  app.use("/api/auth", authApiRateLimiter, authRoutes);
  app.use("/api", apiRateLimiter);
  app.use("/api/admin", adminRateLimiter);
  app.use("/api", adminEventsRoutes);
  app.use("/api/daily-chest", dailyChestRoutes);
  app.use("/api", depositsRoutes);
  app.use(
    [
      "/api/live-draws",
      "/api/game-call",
      "/api/instant-raffles",
      "/api/winnings",
      "/api/cashback",
    ],
    engagementMutationOnly
  );
  app.use("/api", engagementRoutes);
  app.use("/api", gamificationRoutes);
  app.use("/api", socialRoutes);
  app.use("/api/points", pointsRoutes);
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
    if (error?.message === "Not allowed by CORS") {
      return res.status(403).json({ error: error.message });
    }

    console.error("[http] request:error", {
      method: req.method,
      path: req.originalUrl,
      status: Number(error?.status || 500),
      durationMs: Date.now() - Number(req._startedAtMs || Date.now()),
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
