const targetBaseUrl = String(process.env.LOADTEST_BASE_URL || "").trim().replace(/\/+$/, "");
const bearerToken = String(process.env.LOADTEST_BEARER_TOKEN || "").trim();
const concurrency = Math.max(1, Number(process.env.LOADTEST_CONCURRENCY || 10));
const rounds = Math.max(1, Number(process.env.LOADTEST_ROUNDS || 10));
const timeoutMs = Math.max(1000, Number(process.env.LOADTEST_TIMEOUT_MS || 15000));

if (!targetBaseUrl) {
  console.error("LOADTEST_BASE_URL is required");
  process.exit(1);
}

const routes = [
  { path: "/health", auth: false },
  { path: "/health/metrics", auth: false },
  { path: "/api/ui/public-config", auth: false },
  { path: "/api/dynamics/summary", auth: true },
  { path: "/api/home/summary", auth: true },
  { path: "/api/home/feed-summary", auth: true },
  { path: "/api/profile/metrics", auth: true },
];

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function requestRoute(route) {
  if (route.auth && !bearerToken) {
    return { path: route.path, skipped: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = nowMs();

  try {
    const response = await fetch(`${targetBaseUrl}${route.path}`, {
      method: "GET",
      headers: route.auth
        ? {
            Authorization: `Bearer ${bearerToken}`,
          }
        : undefined,
      signal: controller.signal,
    });

    return {
      path: route.path,
      status: response.status,
      ok: response.ok,
      durationMs: nowMs() - startedAt,
    };
  } catch (error) {
    return {
      path: route.path,
      status: 0,
      ok: false,
      durationMs: nowMs() - startedAt,
      error: error?.name === "AbortError" ? "timeout" : error?.message || "request_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runWorker() {
  const results = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const route of routes) {
      results.push(await requestRoute(route));
    }
  }
  return results;
}

const batches = await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
const results = batches.flat();

const grouped = results.reduce((acc, item) => {
  const current = acc.get(item.path) || {
    path: item.path,
    total: 0,
    skipped: 0,
    failed: 0,
    maxMs: 0,
    sumMs: 0,
    statuses: {},
    errors: {},
  };

  current.total += 1;
  if (item.skipped) {
    current.skipped += 1;
  } else {
    current.maxMs = Math.max(current.maxMs, Number(item.durationMs || 0));
    current.sumMs += Number(item.durationMs || 0);
    const statusKey = String(item.status || 0);
    current.statuses[statusKey] = (current.statuses[statusKey] || 0) + 1;
    if (!item.ok) {
      current.failed += 1;
      const errorKey = String(item.error || "http_error");
      current.errors[errorKey] = (current.errors[errorKey] || 0) + 1;
    }
  }

  acc.set(item.path, current);
  return acc;
}, new Map());

const summary = Array.from(grouped.values()).map((item) => ({
  path: item.path,
  total: item.total,
  skipped: item.skipped,
  failed: item.failed,
  avgMs: item.total - item.skipped > 0 ? Math.round(item.sumMs / Math.max(1, item.total - item.skipped)) : 0,
  maxMs: item.maxMs,
  statuses: item.statuses,
  errors: item.errors,
}));

console.log(
  JSON.stringify(
    {
      targetBaseUrl,
      concurrency,
      rounds,
      timeoutMs,
      hasBearerToken: Boolean(bearerToken),
      summary,
    },
    null,
    2
  )
);
