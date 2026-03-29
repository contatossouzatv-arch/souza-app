import http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { env, isAllowedOrigin } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureDb, ensureDevAdmin, seedDefaults } from "./db/index.js";

async function bootstrapRuntime(io) {
  console.log("[startup] runtime-bootstrap:start", {
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
      console.error("[startup] redis adapter init failed", {
        message: error?.message || "Unknown Redis startup error",
        stack: error?.stack || null,
        nodeEnv: env.nodeEnv,
      });
      if (env.nodeEnv === "production") {
        throw new Error("Redis adapter initialization failed in production");
      }
      console.warn("[startup] falling back to memory Socket.IO adapter outside production");
    }
  }
  console.log(`Socket.IO adapter: ${socketAdapterMode}`);
  console.log("[startup] runtime-bootstrap:ready");
}

async function bootstrap() {
  const port = Number(process.env.PORT || 8080);
  const host = "0.0.0.0";

  console.log("[startup] bootstrap:start", {
    nodeEnv: env.nodeEnv,
    port,
    host,
    hasRedis: Boolean(env.redisUrl),
    hasDatabaseUrl: Boolean(env.databaseUrl),
  });

  const appPlaceholder = http.createServer();
  const io = new Server(appPlaceholder, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true, now: new Date().toISOString() });
  });

  console.log("[startup] server:listen", {
    port,
    host,
  });
  server.listen(port, host, () => {
    console.log("[startup] server:ready", {
      port,
      host,
    });
  });

  bootstrapRuntime(io).catch((error) => {
    console.error("[startup] runtime-bootstrap:failed", {
      message: error?.message || "Unknown startup error",
      stack: error?.stack || null,
    });
  });
}

bootstrap().catch((error) => {
  console.error("[startup] bootstrap:failed", {
    message: error?.message || "Unknown startup error",
    stack: error?.stack || null,
  });
  process.exit(1);
});
