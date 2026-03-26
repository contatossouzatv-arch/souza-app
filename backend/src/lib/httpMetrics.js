const routeMetrics = new Map();

function createBucket() {
  return {
    count: 0,
    errors5xx: 0,
    errors4xx: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastStatus: 0,
    lastDurationMs: 0,
    lastSeenAt: null,
  };
}

export function recordHttpMetric(path, status, durationMs) {
  const key = String(path || "").trim() || "unknown";
  const bucket = routeMetrics.get(key) || createBucket();
  const safeStatus = Number(status || 0);
  const safeDuration = Math.max(0, Number(durationMs || 0));

  bucket.count += 1;
  bucket.totalDurationMs += safeDuration;
  bucket.maxDurationMs = Math.max(bucket.maxDurationMs, safeDuration);
  bucket.lastStatus = safeStatus;
  bucket.lastDurationMs = safeDuration;
  bucket.lastSeenAt = new Date().toISOString();

  if (safeStatus >= 500) {
    bucket.errors5xx += 1;
  } else if (safeStatus >= 400) {
    bucket.errors4xx += 1;
  }

  routeMetrics.set(key, bucket);
}

export function getHttpMetricsSnapshot() {
  const routes = Array.from(routeMetrics.entries())
    .map(([path, bucket]) => ({
      path,
      count: bucket.count,
      errors5xx: bucket.errors5xx,
      errors4xx: bucket.errors4xx,
      avgDurationMs: bucket.count > 0 ? Math.round(bucket.totalDurationMs / bucket.count) : 0,
      maxDurationMs: bucket.maxDurationMs,
      lastStatus: bucket.lastStatus,
      lastDurationMs: bucket.lastDurationMs,
      lastSeenAt: bucket.lastSeenAt,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs);

  return {
    startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
    uptimeSec: Math.round(process.uptime()),
    routeCount: routes.length,
    routes,
  };
}
