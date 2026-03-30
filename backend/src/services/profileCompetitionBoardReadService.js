import { getWeeklyCompetitionContext, getWeeklyLeaderboard } from "./weeklyLeaderboardReadService.js";

const PROFILE_COMPETITION_BOARD_TTL_MS = 15_000;

function buildPayloadFromContext(userId, competitionContext, refreshInMs = PROFILE_COMPETITION_BOARD_TTL_MS) {
  const safeUserId = String(userId || "").trim();
  const competitionBoard = {
    config: competitionContext?.weeklyConfig || {},
    cycle: competitionContext?.cycle || { remainingMs: 0, progressPct: 0 },
    entries: [],
    rewardLabel: String(competitionContext?.rewardLabel || ""),
  };

  return {
    competitionBoard,
    currentCompetitionEntry: {
      user_id: safeUserId,
      position: 0,
      weekly_points: 0,
      points: 0,
    },
    updatedAt: new Date().toISOString(),
    refreshInMs: Number(refreshInMs || PROFILE_COMPETITION_BOARD_TTL_MS),
  };
}

export async function getProfileCompetitionBoard({ userId, limit = 50, ttlMs = PROFILE_COMPETITION_BOARD_TTL_MS } = {}) {
  const startedAt = Date.now();
  const safeUserId = String(userId || "").trim();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const payload = await getWeeklyLeaderboard({ userId: safeUserId, limit: safeLimit });
  const durationMs = Date.now() - startedAt;
  if (durationMs >= 800) {
    console.warn("[profile-competition-board] slow lightweight read", {
      userId: safeUserId,
      durationMs,
      limit: safeLimit,
    });
  }

  if (!payload?.competitionBoard || !Array.isArray(payload.competitionBoard.entries)) {
    const competitionContext = await getWeeklyCompetitionContext();
    return buildPayloadFromContext(safeUserId, competitionContext, ttlMs);
  }

  return {
    competitionBoard: payload.competitionBoard,
    currentCompetitionEntry: payload.currentCompetitionEntry,
    updatedAt: new Date().toISOString(),
    refreshInMs: Number(ttlMs || PROFILE_COMPETITION_BOARD_TTL_MS),
  };
}
