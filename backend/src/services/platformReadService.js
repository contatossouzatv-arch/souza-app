import { normalizeRecord, pool } from "../db/index.js";
import { getOrComputeCacheJson } from "../lib/cache.js";

const ACTIVE_PLATFORMS_TTL_MS = 60000;
const CURRENT_PLATFORM_TTL_MS = 30000;

export async function listActivePlatforms(limit = 12) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 12)));
  const rows = await getOrComputeCacheJson(`platform-read:active:${safeLimit}`, ACTIVE_PLATFORMS_TTL_MS, async () => {
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'Platform'
          AND COALESCE(data->>'active', 'false') = 'true'
        ORDER BY
          CASE
            WHEN COALESCE(data->>'order', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (data->>'order')::numeric
            ELSE 999999
          END ASC,
          created_at ASC
        LIMIT $1`,
      [safeLimit]
    );
    return result.rows || [];
  });
  return rows.map(normalizeRecord);
}

export async function getCurrentPlatform() {
  const row = await getOrComputeCacheJson("platform-read:current", CURRENT_PLATFORM_TTL_MS, async () => {
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'CurrentPlatform'
        ORDER BY created_at DESC
        LIMIT 1`
    );
    return result.rows[0] || null;
  });
  return row ? normalizeRecord(row) : null;
}
