# Production Scale Checklist

## Base URL
- Frontend: `https://souzatv.app`
- API: `https://api.souzatv.app`

## Required Railway variables
- `ORIGIN=https://souzatv.app,https://www.souzatv.app`
- `APP_BASE_URL=https://souzatv.app`
- `UPLOADS_BASE_URL=https://api.souzatv.app`
- `AUTH_COOKIE_DOMAIN=`
- `AUTH_COOKIE_PATH=/`
- `AUTH_COOKIE_SAMESITE=lax`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_HTTPONLY=true`
- `REDIS_URL=redis://...`

## Required Vercel variables
- `VITE_API_BASE_URL=https://api.souzatv.app`
- `VITE_GAME_MAIN_ENABLED=false`

## Health endpoints
- `GET /health`
- `GET /health/metrics`

`/health/metrics` now returns:
- route count
- avg and max duration by route
- 4xx and 5xx counts
- last status and last seen time

## Redis
The backend already supports Redis with fallback to memory.

When `REDIS_URL` is configured:
- hot reads can be shared across instances
- duplicated recomputation drops
- cache invalidation becomes more useful under scale

Deploy note:
- review production env vars before promoting a new revision

## Immediate next phase
- create persisted read models for:
  - profile summary
  - weekly leaderboard
  - home feed/cards
  - social state
- use Redis in production
- run a load test
- watch `/health/metrics`

## Load test smoke script
Run:

```powershell
$env:LOADTEST_BASE_URL='https://api.souzatv.app'
$env:LOADTEST_BEARER_TOKEN='YOUR_TOKEN_OPTIONAL'
$env:LOADTEST_CONCURRENCY='20'
$env:LOADTEST_ROUNDS='20'
node .\scripts\loadtest-smoke.mjs
```

Notes:
- without `LOADTEST_BEARER_TOKEN`, authenticated routes are skipped
- this is a smoke/load script, not a full benchmark harness
- use it to spot obvious failures, latency spikes, and 5xx bursts
