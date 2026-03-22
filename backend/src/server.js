import http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { env, isAllowedOrigin } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureDb, ensureDevAdmin, seedDefaults } from "./db/index.js";

async function bootstrap() {
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

  if (env.redisUrl) {
    const pubClient = new Redis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.ping(), subClient.ping()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO adapter: redis");
  } else {
    console.log("Socket.IO adapter: memory");
  }

  const app = createApp(io);
  const server = http.createServer(app);
  io.attach(server);

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true, now: new Date().toISOString() });
  });

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap backend", error);
  process.exit(1);
});
