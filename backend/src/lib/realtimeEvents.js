export function emitLegacyEntityChanged(io, { entity = "", action = "updated", payload = {}, entityId = "" } = {}) {
  if (!io || !entity) return;
  io.emit("entity:changed", {
    entity,
    entityName: entity,
    entityId: String(entityId || payload?.id || payload?.entity_id || ""),
    action,
    payload,
    emittedAt: new Date().toISOString(),
  });
}

export function emitDomainEvent(io, eventName, payload = {}) {
  if (!io || !eventName) return;
  io.emit(String(eventName), {
    ...payload,
    emittedAt: payload?.emittedAt || new Date().toISOString(),
  });
}

export function emitDashboardLiveUpdated(io, payload = {}) {
  emitDomainEvent(io, "dashboard:live-updated", payload);
}

export function emitDashboardInstantUpdated(io, payload = {}) {
  emitDomainEvent(io, "dashboard:instant-updated", payload);
}

export function emitDashboardGamecallUpdated(io, payload = {}) {
  emitDomainEvent(io, "dashboard:gamecall-updated", payload);
}

export function emitDepositUserUpdated(io, payload = {}) {
  emitDomainEvent(io, "deposit:user-updated", payload);
}

export function emitDepositLeaderboardUpdated(io, payload = {}) {
  emitDomainEvent(io, "deposit:leaderboard-updated", payload);
}

export function emitProfileCompetitionBoardUpdated(io, payload = {}) {
  emitDomainEvent(io, "profile:competition-board-updated", payload);
}
