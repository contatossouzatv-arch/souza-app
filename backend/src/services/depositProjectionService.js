import {
  emitDepositLeaderboardUpdated,
  emitDepositUserUpdated,
  emitProfileCompetitionBoardUpdated,
} from "../lib/realtimeEvents.js";
import { invalidateProfileReadModels } from "./appReadModelService.js";
import { deleteCacheByPrefix, deleteCacheKey } from "../lib/cache.js";

function safeIo(ioOrReq) {
  if (ioOrReq?.emit) return ioOrReq;
  return ioOrReq?.app?.locals?.io || null;
}

export async function projectDepositMutation({
  io: ioOrReq,
  action = "updated",
  deposit = {},
  refreshGamification = false,
  scheduleGamificationRefresh = null,
} = {}) {
  const io = safeIo(ioOrReq);
  const userId = String(deposit?.user_id || "").trim();
  const cycleId = String(deposit?.cycle_id || deposit?.cycleId || "").trim();
  const status = String(deposit?.status || "").trim();

  await Promise.all([
    deleteCacheKey("deposits:dashboard-summary"),
    deleteCacheByPrefix("deposits:leaderboard:"),
    userId ? invalidateProfileReadModels(userId) : Promise.resolve(),
  ]);

  if (refreshGamification && typeof scheduleGamificationRefresh === "function") {
    scheduleGamificationRefresh({ persistDerived: true });
  }

  emitDepositUserUpdated(io, {
    action,
    userId,
    depositId: String(deposit?.id || ""),
    cycleId,
    status,
  });
  emitDepositLeaderboardUpdated(io, {
    action,
    cycleId,
    depositId: String(deposit?.id || ""),
    userId,
    status,
  });
  if (userId) {
    emitProfileCompetitionBoardUpdated(io, {
      action,
      userId,
      reason: "deposit_projection",
      cycleId,
      depositId: String(deposit?.id || ""),
      status,
    });
  }
}
