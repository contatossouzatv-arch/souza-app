import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createSecurityEvent } from "../db/index.js";
import { gameCallAdmin, liveDrawAdmin } from "../services/adminLiveGameService.js";
import { depositDrawAdmin, instantRaffleAdmin, syncParticipationPhones } from "../services/adminInstantDepositService.js";

const router = Router();

function meta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

async function logSecurity(req, type, metadata = {}) {
  await createSecurityEvent({
    user_id: req.auth.sub,
    type,
    ip: meta(req).ip,
    user_agent: meta(req).user_agent,
    metadata,
  });
}

function emitEntityChanged(req, entity, action, payload) {
  req.app.locals.io?.emit("entity:changed", { entity, action, payload });
}

router.post("/admin/live-draws", requireAuth, requireAdmin, async (req, res) => {
  const result = await liveDrawAdmin.create({
    title: req.body?.title,
    maxWinners: req.body?.maxWinners,
    prizeAmount: req.body?.prizeAmount,
    requestId: req.body?.requestId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  emitEntityChanged(req, "LiveDrawRaffle", "created", result.raffle);
  await logSecurity(req, "ADMIN_LIVE_DRAW_CREATED", { raffle_id: result.raffle?.id || "", idempotent: result.idempotent });
  res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/admin/live-draws/:id/draw", requireAuth, requireAdmin, async (req, res) => {
  const result = await liveDrawAdmin.draw({
    raffleId: req.params.id,
    winnerCount: req.body?.winnerCount,
    requestId: req.body?.requestId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  await logSecurity(req, "ADMIN_LIVE_DRAW_DRAWN", { raffle_id: req.params.id, winner_count: result?.winners?.length || 0, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/live-draws/:id/end", requireAuth, requireAdmin, async (req, res) => {
  const result = await liveDrawAdmin.end({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "LiveDrawRaffle", "updated", result?.raffle || null);
  await logSecurity(req, "ADMIN_LIVE_DRAW_ENDED", { raffle_id: req.params.id, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/live-draws/participants/:id/:action", requireAuth, requireAdmin, async (req, res) => {
  const action = String(req.params.action || "").trim();
  if (!["validate", "invalidate", "reactivate"].includes(action)) {
    return res.status(400).json({ error: "Ação inválida." });
  }
  const handler = action === "validate" ? liveDrawAdmin.validate : action === "invalidate" ? liveDrawAdmin.invalidate : liveDrawAdmin.reactivate;
  const result = await handler({ participantId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "LiveDrawParticipant", "updated", result?.participant || null);
  await logSecurity(req, "ADMIN_LIVE_DRAW_PARTICIPANT_UPDATED", { participant_id: req.params.id, action, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/live-draws/:id/participants/clear", requireAuth, requireAdmin, async (req, res) => {
  const result = await liveDrawAdmin.clearParticipants({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  await logSecurity(req, "ADMIN_LIVE_DRAW_PARTICIPANTS_CLEARED", { raffle_id: req.params.id, cleared_count: result?.cleared_count || 0, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.delete("/admin/live-draws/participants/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await liveDrawAdmin.removeParticipant({ participantId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "LiveDrawParticipant", "deleted", { id: req.params.id });
  await logSecurity(req, "ADMIN_LIVE_DRAW_PARTICIPANT_REMOVED", { participant_id: req.params.id, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 200).json(result);
});

router.post("/admin/game-calls", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.create({ title: req.body?.title, prizeAmount: req.body?.prizeAmount, maxAttempts: req.body?.maxAttempts, maxWinners: req.body?.maxWinners, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "GameCallRaffle", "created", result?.raffle || null);
  await logSecurity(req, "ADMIN_GAME_CALL_CREATED", { raffle_id: result?.raffle?.id || "", idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.patch("/admin/game-calls/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.update({ raffleId: req.params.id, maxAttempts: req.body?.maxAttempts, maxWinners: req.body?.maxWinners, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "GameCallRaffle", "updated", result?.raffle || null);
  await logSecurity(req, "ADMIN_GAME_CALL_UPDATED", { raffle_id: req.params.id, idempotent: result?.idempotent });
  res.json(result);
});

router.post("/admin/game-calls/:id/draw", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.draw({ raffleId: req.params.id, winnerCount: req.body?.winnerCount, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  await logSecurity(req, "ADMIN_GAME_CALL_DRAWN", { raffle_id: req.params.id, winner_count: result?.winners?.length || 0, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/game-calls/:id/end", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.end({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "GameCallRaffle", "updated", result?.raffle || null);
  await logSecurity(req, "ADMIN_GAME_CALL_ENDED", { raffle_id: req.params.id, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/game-calls/participants/:id/:action", requireAuth, requireAdmin, async (req, res) => {
  const action = String(req.params.action || "").trim();
  if (!["validate", "invalidate", "reactivate"].includes(action)) {
    return res.status(400).json({ error: "Ação inválida." });
  }
  const handler = action === "validate" ? gameCallAdmin.validate : action === "invalidate" ? gameCallAdmin.invalidate : gameCallAdmin.reactivate;
  const result = await handler({ participantId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "GameCallParticipant", "updated", result?.participant || null);
  await logSecurity(req, "ADMIN_GAME_CALL_PARTICIPANT_UPDATED", { participant_id: req.params.id, action, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/game-calls/:id/participants/clear", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.clearParticipants({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  await logSecurity(req, "ADMIN_GAME_CALL_PARTICIPANTS_CLEARED", { raffle_id: req.params.id, cleared_count: result?.cleared_count || 0, idempotent: result?.idempotent });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.delete("/admin/game-calls/participants/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await gameCallAdmin.removeParticipant({ participantId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "GameCallParticipant", "deleted", { id: req.params.id });
  await logSecurity(req, "ADMIN_GAME_CALL_PARTICIPANT_REMOVED", { participant_id: req.params.id, idempotent: result?.idempotent });
  res.json(result);
});

router.post("/admin/instant-raffles", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.create({ payload: req.body || {}, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffle", "created", result?.raffle || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.patch("/admin/instant-raffles/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.update({ raffleId: req.params.id, payload: req.body || {}, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffle", "updated", result?.raffle || null);
  res.json(result);
});

router.post("/admin/instant-raffles/:id/draw", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.draw({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/instant-raffles/:id/end", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.end({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffle", "updated", result?.raffle || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/instant-raffles/:id/clone", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.cloneWithParticipants({ sourceRaffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffle", "created", result?.raffle || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/instant-raffles/:id/reactivate", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.reactivateParticipants({ raffleId: req.params.id, participants: req.body?.participants || [], requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/instant-raffles/participants/:id/validate", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.validateWinner({ participantId: req.params.id, validated: Boolean(req.body?.validated), requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffleParticipant", "updated", result?.participant || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.delete("/admin/instant-raffles/participants/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.removeParticipant({ participantId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffleParticipant", "deleted", { id: req.params.id });
  res.json(result);
});

router.delete("/admin/instant-raffles/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await instantRaffleAdmin.delete({ raffleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "InstantRaffle", "deleted", { id: req.params.id });
  res.json(result);
});

router.post("/admin/deposit-draws/:id/draw", requireAuth, requireAdmin, async (req, res) => {
  const result = await depositDrawAdmin.draw({ cycleId: req.params.id, prizeAmount: req.body?.prizeAmount, winnerCount: req.body?.winnerCount, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/deposit-draws/winners/:id/validate", requireAuth, requireAdmin, async (req, res) => {
  const result = await depositDrawAdmin.validate({ winnerId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "DepositantDrawWinner", "updated", result?.winner || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.delete("/admin/deposit-draws/winners/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await depositDrawAdmin.deleteWinner({ winnerId: req.params.id, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "DepositantDrawWinner", "deleted", { id: req.params.id });
  res.json(result);
});

router.post("/admin/deposit-draws/:id/complete", requireAuth, requireAdmin, async (req, res) => {
  const result = await depositDrawAdmin.complete({ cycleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  emitEntityChanged(req, "DepositantDrawCycle", "updated", result?.cycle || null);
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/admin/deposit-draws/:id/reset-tickets", requireAuth, requireAdmin, async (req, res) => {
  const result = await depositDrawAdmin.resetTickets({ cycleId: req.params.id, requestId: req.body?.requestId, adminUserId: req.auth.sub, adminEmail: req.auth.email });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

router.post("/profile/sync-phone", requireAuth, async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  if (!phone) return res.status(400).json({ error: "Telefone obrigatório." });
  const result = await syncParticipationPhones({ userId: req.auth.sub, phone, requestId: req.body?.requestId });
  res.status(result?.idempotent ? 200 : 201).json(result);
});

export default router;
