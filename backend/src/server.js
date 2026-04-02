import http from "node:http";
import dotenv from "dotenv";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { getRuntimeBuildInfo } from "./lib/runtimeBuildInfo.js";

// Ensure .env is loaded before reading process.env (e.g., PORT) in bootstrap
dotenv.config();

const buildInfo = getRuntimeBuildInfo();

function logStartup(message, details = {}) {
  console.log(`[startup] ${message}`, {
    ...details,
    buildInfo,
  });
}

function logStartupError(message, error, details = {}) {
  console.error(`[startup] ${message}`, {
    ...details,
    buildInfo,
    message: error?.message || "Unknown startup error",
    stack: error?.stack || null,
  });
}

process.on("uncaughtException", (error) => {
  logStartupError("uncaught-exception", error);
});

process.on("unhandledRejection", (reason) => {
  logStartupError("unhandled-rejection", reason instanceof Error ? reason : new Error(String(reason || "Unknown promise rejection")));
});

function createFallbackApp(error, startedAt) {
  const startupError = {
    message: error?.message || "Startup failed before Express app initialization",
    stack: error?.stack || null,
  };

  return (req, res) => {
    const path = String(req.url || "").split("?")[0];
    const payload = {
      ok: false,
      degraded: true,
      service: "app-souza-cass-backend",
      timestamp: new Date().toISOString(),
      startedAt,
      build: buildInfo,
      startupError,
    };

    if (path === "/health" || path === "/version") {
      res.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(payload));
  };
}

async function bootstrapRuntime(io, runtime) {
  const { env, ensureDb, ensureDevAdmin, seedDefaults } = runtime;

  logStartup("runtime-bootstrap:start", {
    nodeEnv: env.nodeEnv,
    hasRedis: Boolean(env.redisUrl),
    hasDatabaseUrl: Boolean(env.databaseUrl),
  });

  await ensureDb();
  if (env.nodeEnv !== "production") {
    const adminPasswordHash = await bcrypt.hash(env.adminPassword, 10);
    await ensureDevAdmin({
      email: env.adminEmail,
      fullName: env.adminName,
      nick: env.adminNick,
      passwordHash: adminPasswordHash,
    });
  }
  await seedDefaults();

  let socketAdapterMode = "memory";
  if (env.redisUrl) {
    try {
      const pubClient = new Redis(env.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.ping(), subClient.ping()]);
      io.adapter(createAdapter(pubClient, subClient));
      socketAdapterMode = "redis";
    } catch (error) {
      logStartupError("redis-adapter:init-failed", error, {
        nodeEnv: env.nodeEnv,
      });
      console.warn("[startup] redis-adapter:fallback-memory", { buildInfo });
    }
  }

  logStartup("runtime-bootstrap:ready", {
    socketAdapterMode,
  });
}

async function loadRuntimeModules() {
  const [{ env, isAllowedOrigin }, { createApp }, db] = await Promise.all([
    import("./config/env.js"),
    import("./app.js"),
    import("./db/index.js"),
  ]);

  return {
    env,
    isAllowedOrigin,
    createApp,
    ensureDb: db.ensureDb,
    ensureDevAdmin: db.ensureDevAdmin,
    seedDefaults: db.seedDefaults,
  };
}

async function bootstrap() {
  const port = Number(process.env.PORT) || 8080;
  const host = "0.0.0.0";
  const startedAt = new Date().toISOString();

  logStartup("bootstrap:start", {
    port,
    host,
    nodeEnv: process.env.NODE_ENV || "development",
    hasRedis: Boolean(process.env.REDIS_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  });

  if (!process.env.DATABASE_URL) {
    console.warn("[startup] DATABASE_URL missing, skipping DB init", {
      buildInfo,
    });
  }

  let runtime = null;
  let app = null;
  let startupError = null;

  try {
    logStartup("bootstrap:load-runtime-modules:start");
    runtime = await loadRuntimeModules();
    logStartup("bootstrap:load-runtime-modules:ready", {
      nodeEnv: runtime.env.nodeEnv,
    });
  } catch (error) {
    startupError = error;
    logStartupError("bootstrap:load-runtime-modules:failed", error);
  }

  const placeholderServer = http.createServer();
  const io = new Server(placeholderServer, {
    cors: {
      origin(origin, callback) {
        if (!runtime?.isAllowedOrigin) return callback(null, true);
        if (runtime.isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  if (!startupError && runtime) {
    try {
      app = runtime.createApp(io);
    } catch (error) {
      startupError = error;
      logStartupError("bootstrap:create-app:failed", error);
      app = null;
    }
  }

  if (runtime && !startupError) {
    try {
      await bootstrapRuntime(io, runtime);
    } catch (error) {
      startupError = error;
      app = null;
      logStartupError("runtime-bootstrap:failed", error);
    }
  } else if (startupError) {
    logStartup("runtime-bootstrap:skipped", {
      reason: "startup_error",
    });
  }

  const requestHandler = app || createFallbackApp(startupError, startedAt);
  const server = http.createServer(requestHandler);
  io.attach(server);

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true, now: new Date().toISOString(), build: buildInfo });
  });

  logStartup("server:listen:start", {
    port,
    host,
    degradedMode: Boolean(startupError),
  });

  server.on("error", (error) => {
    logStartupError("server:error", error, {
      port,
      host,
      degradedMode: Boolean(startupError),
    });
  });

  server.listen(port, host, () => {
    console.log("[startup] server:ready", { port, host });
  });
}

bootstrap().catch((error) => {
  logStartupError("bootstrap:failed", error);
});
