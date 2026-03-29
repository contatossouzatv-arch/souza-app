import { deleteCacheKey, getOrComputeCacheJson } from "../lib/cache.js";
import { getWeeklyLeaderboard } from "./weeklyLeaderboardReadService.js";

const PROFILE_COMPETITION_BOARD_PREFIX = "profile:competition-board:";
const PROFILE_COMPETITION_BOARD_TTL_MS = 15_000;

function buildPayloadFromLeaderboard(userId, leaderboardPayload, refreshInMs = PROFILE_COMPETITION_BOARD_TTL_MS) {
  const safeUserId = String(userId || "").trim();
  const competitionBoard = leaderboardPayload?.competitionBoard || {
    config: {},
    cycle: { remainingMs: 0, progressPct: 0 },
    entries: [],
    rewardLabel: "",
  };
  const currentCompetitionEntry =
    leaderboardPayload?.currentCompetitionEntry || {
      user_id: safeUserId,
      position: 0,
      weekly_points: 0,
      points: 0,
    };

  return {
    competitionBoard,
    currentCompetitionEntry,
    updatedAt: new Date().toISOString(),
    refreshInMs: Number(refreshInMs || PROFILE_COMPETITION_BOARD_TTL_MS),
  };
}

export async function getProfileCompetitionBoard({ userId, limit = 50, forceFresh = false, ttlMs = PROFILE_COMPETITION_BOARD_TTL_MS } = {}) {
  const safeUserId = String(userId || "").trim();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const cacheKey = `${PROFILE_COMPETITION_BOARD_PREFIX}${safeUserId}:${safeLimit}`;

  if (forceFresh) {
    await deleteCacheKey(cacheKey);
  }

  return getOrComputeCacheJson(cacheKey, ttlMs, async () => {
    const leaderboardPayload = await getWeeklyLeaderboard({ userId: safeUserId, limit: safeLimit });
    return buildPayloadFromLeaderboard(safeUserId, leaderboardPayload, ttlMs);
  });
}

export async function invalidateProfileCompetitionBoard(userId = "") {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return;
  await Promise.all([
    deleteCacheKey(`${PROFILE_COMPETITION_BOARD_PREFIX}${safeUserId}:50`),
    deleteCacheKey(`${PROFILE_COMPETITION_BOARD_PREFIX}${safeUserId}:20`),
    deleteCacheKey(`${PROFILE_COMPETITION_BOARD_PREFIX}${safeUserId}:10`),
  ]);
}
