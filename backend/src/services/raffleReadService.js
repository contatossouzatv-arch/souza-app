import { normalizeRecord, pool } from "../db/index.js";
import { getOrComputeCacheJson } from "../lib/cache.js";

const DYNAMICS_SUMMARY_TTL_MS = 15000;
const WINNING_SUMMARY_TTL_MS = 10000;
const ENTITY_BASIC_TTL_MS = 30000;

function isTruthyJsonBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function dedupeRecordsByUser(records = []) {
  const uniqueRecords = new Map();
  for (const record of records) {
    const userId = String(record?.user_id || "").trim();
    if (!userId || uniqueRecords.has(userId)) continue;
    uniqueRecords.set(userId, record);
  }
  return Array.from(uniqueRecords.values());
}

export async function findEntityById(entityName, id) {
  const cacheKey = `${entityName}:${id}`;
  return getOrComputeCacheJson(`raffles:entity:${cacheKey}`, ENTITY_BASIC_TTL_MS, async () => {
    const result = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = $1
          AND id = $2
        LIMIT 1
      `,
      [entityName, id]
    );
    return normalizeRecord(result.rows[0] || null);
  });
}

export async function findActiveEntity(entityName) {
  return getOrComputeCacheJson(`raffles:entity:active:${entityName}`, ENTITY_BASIC_TTL_MS, async () => {
    const result = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = $1
          AND COALESCE(data->>'active', 'false') = 'true'
          AND COALESCE(data->>'ended', 'false') <> 'true'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [entityName]
    );
    return normalizeRecord(result.rows[0] || null);
  });
}

export async function listActivePromoBoxes(limit = 12) {
  return getOrComputeCacheJson(`raffles:promo-boxes:${limit}`, ENTITY_BASIC_TTL_MS, async () => {
    const result = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = 'PromoBox'
          AND COALESCE(data->>'active', 'false') = 'true'
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit]
    );
    return result.rows.map(normalizeRecord);
  });
}

export async function getInstantRaffleSummary(raffleId, userId) {
  const cacheKey = `${raffleId}:${userId}`;
  return getOrComputeCacheJson(`raffles:instant-summary:${cacheKey}`, DYNAMICS_SUMMARY_TTL_MS, async () => {
    const [myParticipationResult, previewParticipantsResult, participantCountResult, winnersResult] =
      await Promise.all([
        pool.query(
          `
            SELECT *
            FROM entity_records
            WHERE entity_name = 'InstantRaffleParticipant'
              AND data->>'raffle_id' = $1
              AND data->>'user_id' = $2
            ORDER BY created_at DESC
            LIMIT 8
          `,
          [raffleId, userId]
        ),
        pool.query(
          `
            SELECT *
            FROM entity_records
            WHERE entity_name = 'InstantRaffleParticipant'
              AND data->>'raffle_id' = $1
            ORDER BY created_at DESC
            LIMIT 120
          `,
          [raffleId]
        ),
        pool.query(
          `
            SELECT COUNT(DISTINCT data->>'user_id')::int AS total
            FROM entity_records
            WHERE entity_name = 'InstantRaffleParticipant'
              AND data->>'raffle_id' = $1
          `,
          [raffleId]
        ),
        pool.query(
          `
            SELECT *
            FROM entity_records
            WHERE entity_name = 'InstantRaffleParticipant'
              AND data->>'raffle_id' = $1
              AND COALESCE(data->>'won', 'false') = 'true'
              AND COALESCE(data->>'validated', 'true') <> 'false'
            ORDER BY created_at DESC
            LIMIT 32
          `,
          [raffleId]
        ),
      ]);

    const myParticipation = myParticipationResult.rows.map(normalizeRecord);
    const participantsPreview = dedupeRecordsByUser(previewParticipantsResult.rows.map(normalizeRecord));
    const winners = dedupeRecordsByUser(winnersResult.rows.map(normalizeRecord)).filter(
      (record) => isTruthyJsonBoolean(record?.won) && record?.validated !== false
    );

    return {
      myParticipation,
      participantsPreview,
      participantsCount: Number(participantCountResult.rows[0]?.total || 0),
      winners,
    };
  });
}

export async function getLiveDrawSummary(raffleId, userId) {
  const cacheKey = `${raffleId}:${userId}`;
  return getOrComputeCacheJson(`raffles:live-summary:${cacheKey}`, DYNAMICS_SUMMARY_TTL_MS, async () => {
    const myParticipationResult = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = 'LiveDrawParticipant'
          AND data->>'raffle_id' = $1
          AND data->>'user_id' = $2
        ORDER BY created_at DESC
        LIMIT 4
      `,
      [raffleId, userId]
    );

    return { myParticipation: myParticipationResult.rows.map(normalizeRecord) };
  });
}

export async function getGameCallSummary(raffleId, userId) {
  const cacheKey = `${raffleId}:${userId}`;
  return getOrComputeCacheJson(`raffles:gamecall-summary:${cacheKey}`, DYNAMICS_SUMMARY_TTL_MS, async () => {
    const myParticipationResult = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = 'GameCallParticipant'
          AND data->>'raffle_id' = $1
          AND data->>'user_id' = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [raffleId, userId]
    );

    return { myParticipation: normalizeRecord(myParticipationResult.rows[0] || null) };
  });
}

export async function getWinningSummary(userId) {
  return getOrComputeCacheJson(`raffles:winnings:${userId}`, WINNING_SUMMARY_TTL_MS, async () => {
    const [liveWinningResult, depositWinningResult] = await Promise.all([
      pool.query(
        `
          SELECT *
          FROM entity_records
          WHERE entity_name = 'LiveDrawParticipant'
            AND data->>'user_id' = $1
            AND COALESCE(data->>'validated', 'false') = 'true'
            AND COALESCE(data->>'won', 'false') = 'true'
            AND COALESCE(data->>'claimed_at', '') = ''
          ORDER BY created_at DESC
          LIMIT 8
        `,
        [userId]
      ),
      pool.query(
        `
          SELECT *
          FROM entity_records
          WHERE entity_name = 'DepositantDrawWinner'
            AND data->>'user_id' = $1
            AND COALESCE(data->>'prize_type', '') = 'raffle'
            AND COALESCE(data->>'claimed_at', '') = ''
          ORDER BY created_at DESC
          LIMIT 8
        `,
        [userId]
      ),
    ]);

    const liveWinnings = liveWinningResult.rows.map(normalizeRecord);
    const depositantWinnings = depositWinningResult.rows.map(normalizeRecord);
    const activeLiveWinning = liveWinnings.find((item) => !item?.claimed_at) || null;
    const activeDepositWinning = depositantWinnings.find((item) => !item?.claimed_at) || null;
    const raffle = activeLiveWinning?.raffle_id
      ? await findEntityById("LiveDrawRaffle", String(activeLiveWinning.raffle_id || "").trim())
      : null;

    return {
      liveWinnings,
      depositantWinnings,
      activeLiveWinning,
      activeDepositWinning,
      raffle,
    };
  });
}

export async function getLiveDrawDisplaySummary(raffleId, limit = 120) {
  const cacheKey = `${raffleId}:${Number(limit || 120)}`;
  return getOrComputeCacheJson(`raffles:live-display:${cacheKey}`, DYNAMICS_SUMMARY_TTL_MS, async () => {
    const result = await pool.query(
      `
        SELECT *
        FROM entity_records
        WHERE entity_name = 'LiveDrawParticipant'
          AND data->>'raffle_id' = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [raffleId, Math.max(1, Math.min(500, Number(limit || 120)))]
    );

    return { participants: result.rows.map(normalizeRecord) };
  });
}
