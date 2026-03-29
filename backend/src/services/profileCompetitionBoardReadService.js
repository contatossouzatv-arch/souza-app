import { getWeeklyLeaderboard } from "./weeklyLeaderboardReadService.js";

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

export async function getProfileCompetitionBoard({ userId, limit = 50, ttlMs = PROFILE_COMPETITION_BOARD_TTL_MS } = {}) {
  const safeUserId = String(userId || "").trim();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const leaderboardPayload = await getWeeklyLeaderboard({ userId: safeUserId, limit: safeLimit });
  return buildPayloadFromLeaderboard(safeUserId, leaderboardPayload, ttlMs);
}
