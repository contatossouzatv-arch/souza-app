const WINDOW_MS = 60_000;
const MAX_CLIENT_BUCKETS = 4000;
const WARN_COOLDOWN_MS = 15_000;
const TOTAL_HITS_WARN_THRESHOLD = 80;
const ERROR_4XX_WARN_THRESHOLD = 30;
const ERROR_5XX_WARN_THRESHOLD = 10;
const RATE_LIMIT_WARN_THRESHOLD = 5;
const SLOW_REQUEST_WARN_THRESHOLD = 20;

function normalizeIp(value = "") {
  let ip = String(value || "").trim();
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}

export function getForwardedForChain(req) {
  return String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter(Boolean)
    .slice(0, 8);
}

export function getClientIp(req) {
  const forwardedFor = getForwardedForChain(req);
  if (forwardedFor.length > 0) return forwardedFor[0];
  return normalizeIp(req?.ip || req?.socket?.remoteAddress || "");
}

function createBucket(now) {
  return {
    windowStartedAt: now,
    total: 0,
    errors4xx: 0,
    errors5xx: 0,
    rateLimited: 0,
    slowCount: 0,
    maxDurationMs: 0,
    lastSeenAt: null,
    lastWarnAt: 0,
    paths: new Map(),
  };
}

const clientBuckets = new Map();

function getBucket(clientIp, now) {
  const key = String(clientIp || "").trim();
  if (!key) return null;

  const existing = clientBuckets.get(key);
  if (!existing || now - existing.windowStartedAt >= WINDOW_MS) {
    const next = createBucket(now);
    clientBuckets.set(key, next);
    return next;
  }

  return existing;
}

function pruneClientBuckets(now) {
  if (clientBuckets.size <= MAX_CLIENT_BUCKETS) return;
  for (const [key, bucket] of clientBuckets.entries()) {
    if (now - bucket.windowStartedAt >= WINDOW_MS) {
      clientBuckets.delete(key);
    }
    if (clientBuckets.size <= MAX_CLIENT_BUCKETS) break;
  }
}

function topPathsSnapshot(pathMap) {
  return Array.from(pathMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, hits]) => ({ path, hits }));
}

export function recordClientTraffic({ clientIp = "", path = "", status = 0, durationMs = 0, slowThresholdMs = 700 } = {}) {
  const now = Date.now();
  const bucket = getBucket(clientIp, now);
  if (!bucket) return null;

  bucket.total += 1;
  bucket.lastSeenAt = new Date(now).toISOString();
  bucket.maxDurationMs = Math.max(bucket.maxDurationMs, Math.max(0, Number(durationMs || 0)));

  const normalizedPath = String(path || "").trim() || "unknown";
  bucket.paths.set(normalizedPath, Number(bucket.paths.get(normalizedPath) || 0) + 1);

  const safeStatus = Number(status || 0);
  if (safeStatus === 429) {
    bucket.rateLimited += 1;
  } else if (safeStatus >= 500) {
    bucket.errors5xx += 1;
  } else if (safeStatus >= 400) {
    bucket.errors4xx += 1;
  }

  if (Number(durationMs || 0) >= Math.max(1, Number(slowThresholdMs || 700))) {
    bucket.slowCount += 1;
  }

  pruneClientBuckets(now);

  const shouldWarn =
    bucket.total >= TOTAL_HITS_WARN_THRESHOLD ||
    bucket.errors4xx >= ERROR_4XX_WARN_THRESHOLD ||
    bucket.errors5xx >= ERROR_5XX_WARN_THRESHOLD ||
    bucket.rateLimited >= RATE_LIMIT_WARN_THRESHOLD ||
    bucket.slowCount >= SLOW_REQUEST_WARN_THRESHOLD;

  if (!shouldWarn) return null;
  if (now - bucket.lastWarnAt < WARN_COOLDOWN_MS) return null;

  bucket.lastWarnAt = now;

  return {
    clientIp,
    windowMs: WINDOW_MS,
    total: bucket.total,
    errors4xx: bucket.errors4xx,
    errors5xx: bucket.errors5xx,
    rateLimited: bucket.rateLimited,
    slowCount: bucket.slowCount,
    maxDurationMs: bucket.maxDurationMs,
    lastSeenAt: bucket.lastSeenAt,
    topPaths: topPathsSnapshot(bucket.paths),
  };
}
