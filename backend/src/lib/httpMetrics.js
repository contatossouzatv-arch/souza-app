const routeMetrics = new Map();
const MAX_DURATION_SAMPLES = 120;

function createBucket() {
  return {
    count: 0,
    errors5xx: 0,
    errors4xx: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    slowCount: 0,
    lastStatus: 0,
    lastDurationMs: 0,
    lastSeenAt: null,
    durations: [],
  };
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index] || 0);
}

export function recordHttpMetric(path, status, durationMs, options = {}) {
  const key = String(path || "").trim() || "unknown";
  const bucket = routeMetrics.get(key) || createBucket();
  const safeStatus = Number(status || 0);
  const safeDuration = Math.max(0, Number(durationMs || 0));
  const slowThresholdMs = Math.max(1, Number(options?.slowThresholdMs || 700));

  bucket.count += 1;
  bucket.totalDurationMs += safeDuration;
  bucket.maxDurationMs = Math.max(bucket.maxDurationMs, safeDuration);
  bucket.lastStatus = safeStatus;
  bucket.lastDurationMs = safeDuration;
  bucket.lastSeenAt = new Date().toISOString();
  bucket.durations.push(safeDuration);
  if (bucket.durations.length > MAX_DURATION_SAMPLES) {
    bucket.durations.shift();
  }
  if (safeDuration >= slowThresholdMs) {
    bucket.slowCount += 1;
  }

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
      slowCount: bucket.slowCount,
      avgDurationMs: bucket.count > 0 ? Math.round(bucket.totalDurationMs / bucket.count) : 0,
      p95DurationMs: percentile(bucket.durations, 0.95),
      p99DurationMs: percentile(bucket.durations, 0.99),
      maxDurationMs: bucket.maxDurationMs,
      lastStatus: bucket.lastStatus,
      lastDurationMs: bucket.lastDurationMs,
      lastSeenAt: bucket.lastSeenAt,
    }))
    .sort((a, b) => {
      if (b.p95DurationMs !== a.p95DurationMs) return b.p95DurationMs - a.p95DurationMs;
      if (b.avgDurationMs !== a.avgDurationMs) return b.avgDurationMs - a.avgDurationMs;
      return b.count - a.count;
    });

  return {
    startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
    uptimeSec: Math.round(process.uptime()),
    routeCount: routes.length,
    routes,
  };
}
