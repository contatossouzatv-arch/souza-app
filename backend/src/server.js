import http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { env, isAllowedOrigin } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureDb, ensureDevAdmin, seedDefaults } from "./db/index.js";

async function bootstrap() {
  console.log("[startup] bootstrap:start", {
    nodeEnv: env.nodeEnv,
    port: env.port,
    host: "0.0.0.0",
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

  let socketAdapterMode = "memory";
  if (env.redisUrl) {
    try {
      const pubClient = new Redis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.ping(), subClient.ping()]);
      io.adapter(createAdapter(pubClient, subClient));
      socketAdapterMode = "redis";
    } catch (error) {
      console.error("[startup] redis adapter init failed, falling back to memory", {
        message: error?.message || "Unknown Redis startup error",
        stack: error?.stack || null,
      });
    }
  }
  console.log(`Socket.IO adapter: ${socketAdapterMode}`);

  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true, now: new Date().toISOString() });
  });

  const host = "0.0.0.0";
  console.log("[startup] server:listen", {
    port: env.port,
    host,
  });
  server.listen(env.port, host, () => {
    console.log("[startup] server:ready", {
      port: env.port,
      host,
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
