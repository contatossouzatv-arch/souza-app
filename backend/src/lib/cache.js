import Redis from "ioredis";
import { env } from "../config/env.js";

const memoryStore = new Map();
const inflight = new Map();
const MISS = Symbol("cache-miss");

let redisClient = null;
let redisUnavailable = false;

function getRedisClient() {
  if (!env.redisUrl || redisUnavailable) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redisClient.on("error", (error) => {
      console.warn("[cache] redis error", { message: error?.message || "unknown" });
    });
    return redisClient;
  } catch (error) {
    redisUnavailable = true;
    console.warn("[cache] redis init failed, falling back to memory", {
      message: error?.message || "unknown",
    });
    return null;
  }
}

function readMemory(key) {
  const cached = memoryStore.get(key);
  if (!cached) return MISS;
  if (Date.now() >= cached.expiresAt) {
    memoryStore.delete(key);
    return MISS;
  }
  return cached.value;
}

function writeMemory(key, value, ttlMs) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, Number(ttlMs || 1)),
  });
  return value;
}

export async function getCacheJson(key) {
  const client = getRedisClient();
  if (!client) {
    return readMemory(key);
  }

  try {
    await client.connect().catch(() => {});
    const raw = await client.get(key);
    if (!raw) return MISS;
    const parsed = JSON.parse(raw);
    return Object.prototype.hasOwnProperty.call(parsed || {}, "value") ? parsed.value : MISS;
  } catch (error) {
    console.warn("[cache] redis get failed, using memory", {
      key,
      message: error?.message || "unknown",
    });
    return readMemory(key);
  }
}

export async function setCacheJson(key, value, ttlMs) {
  const client = getRedisClient();
  writeMemory(key, value, ttlMs);

  if (!client) return value;

  try {
    await client.connect().catch(() => {});
    await client.set(key, JSON.stringify({ value }), "PX", Math.max(1, Number(ttlMs || 1)));
  } catch (error) {
    console.warn("[cache] redis set failed, keeping memory cache", {
      key,
      message: error?.message || "unknown",
    });
  }

  return value;
}

export async function deleteCacheKey(key) {
  memoryStore.delete(key);
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.connect().catch(() => {});
    await client.del(key);
  } catch (error) {
    console.warn("[cache] redis delete failed", {
      key,
      message: error?.message || "unknown",
    });
  }
}

export async function deleteCacheByPrefix(prefix) {
  const normalizedPrefix = String(prefix || "");
  if (!normalizedPrefix) return;

  for (const key of memoryStore.keys()) {
    if (String(key).startsWith(normalizedPrefix)) {
      memoryStore.delete(key);
    }
  }

  const client = getRedisClient();
  if (!client) return;

  try {
    await client.connect().catch(() => {});
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", `${normalizedPrefix}*`, "COUNT", 100);
      cursor = String(nextCursor || "0");
      if (Array.isArray(keys) && keys.length > 0) {
        await client.del(keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.warn("[cache] redis delete by prefix failed", {
      prefix: normalizedPrefix,
      message: error?.message || "unknown",
    });
  }
}

export async function getOrComputeCacheJson(key, ttlMs, producer) {
  const cached = await getCacheJson(key);
  if (cached !== MISS) return cached;

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    const value = await producer();
    await setCacheJson(key, value, ttlMs);
    return value;
  })();

  inflight.set(key, promise);

  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export function cacheMiss(value) {
  return value === MISS;
}
