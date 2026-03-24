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

function buildCors() {
  if (env.origin === "*") {
    return cors({ origin: true, credentials: false });
  }

  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
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
    // Local development has heavy polling in dashboard/admin.
    // Disable rate limiting locally to avoid blocking core flows.
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

export function createApp(io) {
  const app = express();
  app.locals.io = io;

  app.set("trust proxy", 1);
  app.use(
    helmet({
      // Permite carregar imagens/arquivos estáticos do backend em outra origem
      // (ex.: front em :5173 consumindo uploads em :3011).
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(buildCors());
  app.options(/.*/, buildCors());
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

  app.get("/", (_req, res) => {
    res.type("text/plain").send("API SOUZA ONLINE");
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "app-souza-cass-backend",
      timestamp: new Date().toISOString(),
      redis: Boolean(env.redisUrl),
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
  app.use("/api", adminEventsRoutes);
  app.use("/api/daily-chest", dailyChestRoutes);
  app.use("/api", depositsRoutes);
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

  app.use((error, _req, res, _next) => {
    if (error?.message === "Not allowed by CORS") {
      return res.status(403).json({ error: error.message });
    }

    console.error(error);
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: error?.message || "Internal server error" });
  });

  return app;
}
