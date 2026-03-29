import { normalizeRecord, pool } from "../db/index.js";
import { deleteCacheByPrefix, getOrComputeCacheJson } from "../lib/cache.js";

const DASHBOARD_DYNAMICS_TTL_MS = 10_000;
const DASHBOARD_DYNAMICS_PREFIX = "dashboard:dynamics-summary:";

function dedupeRecordsByUser(records = []) {
  const uniqueRecords = new Map();
  for (const record of records) {
    const userId = String(record?.user_id || "").trim();
    if (!userId || uniqueRecords.has(userId)) continue;
    uniqueRecords.set(userId, record);
  }
  return Array.from(uniqueRecords.values());
}

async function findActiveEntity(entityName) {
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = $1
        AND COALESCE(data->>'active', 'false') = 'true'
        AND COALESCE(data->>'ended', 'false') <> 'true'
      ORDER BY created_at DESC
      LIMIT 1`,
    [entityName]
  );
  return normalizeRecord(result.rows[0] || null);
}

async function listActivePromoBoxes(limit = 12) {
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = 'PromoBox'
        AND COALESCE(data->>'active', 'false') = 'true'
      ORDER BY created_at DESC
      LIMIT $1`,
    [Math.max(1, Math.min(50, Number(limit || 12)))]
  );
  return result.rows.map(normalizeRecord);
}

async function getInstantRaffleSummary(raffleId, userId) {
  const [myParticipationResult, previewParticipantsResult, participantCountResult, winnersResult] = await Promise.all([
    pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'InstantRaffleParticipant'
          AND data->>'raffle_id' = $1
          AND data->>'user_id' = $2
        ORDER BY created_at DESC
        LIMIT 8`,
      [raffleId, userId]
    ),
    pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'InstantRaffleParticipant'
          AND data->>'raffle_id' = $1
        ORDER BY created_at DESC
        LIMIT 120`,
      [raffleId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT data->>'user_id')::int AS total
         FROM entity_records
        WHERE entity_name = 'InstantRaffleParticipant'
          AND data->>'raffle_id' = $1`,
      [raffleId]
    ),
    pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'InstantRaffleParticipant'
          AND data->>'raffle_id' = $1
          AND COALESCE(data->>'won', 'false') = 'true'
          AND COALESCE(data->>'validated', 'true') <> 'false'
        ORDER BY created_at DESC
        LIMIT 32`,
      [raffleId]
    ),
  ]);

  const myParticipation = myParticipationResult.rows.map(normalizeRecord);
  const participantsPreview = dedupeRecordsByUser(previewParticipantsResult.rows.map(normalizeRecord));
  const winners = dedupeRecordsByUser(winnersResult.rows.map(normalizeRecord)).filter(
    (record) => String(record?.won || "").toLowerCase() === "true" && record?.validated !== false
  );

  return {
    myParticipation,
    participantsPreview,
    participantsCount: Number(participantCountResult.rows[0]?.total || 0),
    winners,
  };
}

async function getLiveDrawSummary(raffleId, userId) {
  const myParticipationResult = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = 'LiveDrawParticipant'
        AND data->>'raffle_id' = $1
        AND data->>'user_id' = $2
      ORDER BY created_at DESC
      LIMIT 4`,
    [raffleId, userId]
  );

  return { myParticipation: myParticipationResult.rows.map(normalizeRecord) };
}

async function getGameCallSummary(raffleId, userId) {
  const myParticipationResult = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = 'GameCallParticipant'
        AND data->>'raffle_id' = $1
        AND data->>'user_id' = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [raffleId, userId]
  );

  return { myParticipation: normalizeRecord(myParticipationResult.rows[0] || null) };
}

export async function getDashboardDynamicsSummary({ userId } = {}) {
  const safeUserId = String(userId || "").trim();
  return getOrComputeCacheJson(`${DASHBOARD_DYNAMICS_PREFIX}${safeUserId}`, DASHBOARD_DYNAMICS_TTL_MS, async () => {
    const [promoBoxes, activeInstantRaffle, activeLiveDraw, activeGameCall] = await Promise.all([
      listActivePromoBoxes(),
      findActiveEntity("InstantRaffle"),
      findActiveEntity("LiveDrawRaffle"),
      findActiveEntity("GameCallRaffle"),
    ]);

    const [instantSummary, liveDrawSummary, gameCallSummary] = await Promise.all([
      activeInstantRaffle?.id
        ? getInstantRaffleSummary(activeInstantRaffle.id, safeUserId)
        : Promise.resolve({
            myParticipation: [],
            participantsPreview: [],
            participantsCount: 0,
            winners: [],
          }),
      activeLiveDraw?.id
        ? getLiveDrawSummary(activeLiveDraw.id, safeUserId)
        : Promise.resolve({ myParticipation: [] }),
      activeGameCall?.id
        ? getGameCallSummary(activeGameCall.id, safeUserId)
        : Promise.resolve({ myParticipation: null }),
    ]);

    return {
      promoBoxes,
      instantRaffle: {
        raffle: activeInstantRaffle,
        ...instantSummary,
      },
      liveDraw: {
        raffle: activeLiveDraw,
        ...liveDrawSummary,
      },
      gameCall: {
        raffle: activeGameCall,
        ...gameCallSummary,
      },
    };
  });
}

export async function invalidateDashboardDynamicsSummary(userId = "") {
  const safeUserId = String(userId || "").trim();
  if (safeUserId) {
    await deleteCacheByPrefix(`${DASHBOARD_DYNAMICS_PREFIX}${safeUserId}`);
    return;
  }
  await deleteCacheByPrefix(DASHBOARD_DYNAMICS_PREFIX);
}
