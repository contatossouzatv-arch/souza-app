import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  claimCashbackReward,
  claimWinning,
  createSecurityEvent,
  dismissInstantRaffle,
  dismissWinning,
  joinGameCall,
  joinInstantRaffle,
  joinLiveDraw,
  submitGameCall,
} from "../db/index.js";

const router = Router();

function requestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

async function logSecurityEvent(req, type, metadata = {}) {
  await createSecurityEvent({
    user_id: req.auth.sub,
    type,
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata,
  });
}

router.post("/live-draws/:id/join", requireAuth, async (req, res) => {
  const raffleId = String(req.params.id || "").trim();
  if (!raffleId) return res.status(400).json({ error: "ID do sorteio obrigatorio." });

  const result = await joinLiveDraw({
    raffleId,
    userId: req.auth.sub,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "LIVE_DRAW_JOINED", {
    raffle_id: raffleId,
    participant_id: result.participation?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/game-call/:id/join", requireAuth, async (req, res) => {
  const raffleId = String(req.params.id || "").trim();
  if (!raffleId) return res.status(400).json({ error: "ID do sorteio obrigatorio." });

  const result = await joinGameCall({
    raffleId,
    userId: req.auth.sub,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "GAME_CALL_JOINED", {
    raffle_id: raffleId,
    participant_id: result.participation?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/game-call/:id/submit", requireAuth, async (req, res) => {
  const raffleId = String(req.params.id || "").trim();
  const gameCall = String(req.body?.gameCall || "").trim();
  if (!raffleId) return res.status(400).json({ error: "ID do sorteio obrigatorio." });
  if (!gameCall) return res.status(400).json({ error: "Digite a call do jogo." });

  const result = await submitGameCall({
    raffleId,
    userId: req.auth.sub,
    gameCall,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "GAME_CALL_SUBMITTED", {
    raffle_id: raffleId,
    participant_id: result.participation?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/instant-raffles/:id/join", requireAuth, async (req, res) => {
  const raffleId = String(req.params.id || "").trim();
  const platformId = String(req.body?.platformId || "").trim();
  if (!raffleId) return res.status(400).json({ error: "ID do sorteio obrigatorio." });

  const result = await joinInstantRaffle({
    raffleId,
    userId: req.auth.sub,
    platformId,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "INSTANT_RAFFLE_JOINED", {
    raffle_id: raffleId,
    participant_id: result.participation?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/instant-raffles/:id/dismiss", requireAuth, async (req, res) => {
  const raffleId = String(req.params.id || "").trim();
  if (!raffleId) return res.status(400).json({ error: "ID do sorteio obrigatorio." });

  const result = await dismissInstantRaffle({
    raffleId,
    userId: req.auth.sub,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "INSTANT_RAFFLE_DISMISSED", {
    raffle_id: raffleId,
    participant_id: result.participation?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/winnings/:kind/:id/claim", requireAuth, async (req, res) => {
  const kind = String(req.params.kind || "").trim();
  const recordId = String(req.params.id || "").trim();
  if (!recordId) return res.status(400).json({ error: "ID da premiacao obrigatorio." });

  const result = await claimWinning({
    kind,
    recordId,
    userId: req.auth.sub,
    requestId: String(req.body?.requestId || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Premiacao nao encontrada." });
  }

  await logSecurityEvent(req, "WINNING_CLAIMED", {
    kind,
    record_id: recordId,
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/winnings/:kind/:id/dismiss", requireAuth, async (req, res) => {
  const kind = String(req.params.kind || "").trim();
  const recordId = String(req.params.id || "").trim();
  if (!recordId) return res.status(400).json({ error: "ID da premiacao obrigatorio." });

  const result = await dismissWinning({
    kind,
    recordId,
    userId: req.auth.sub,
    requestId: String(req.body?.requestId || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Premiacao nao encontrada." });
  }

  await logSecurityEvent(req, "WINNING_DISMISSED", {
    kind,
    record_id: recordId,
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/cashback/claim", requireAuth, async (req, res) => {
  const goalType = String(req.body?.goalType || "").trim();
  if (!goalType) return res.status(400).json({ error: "goalType obrigatorio." });

  const result = await claimCashbackReward({
    userId: req.auth.sub,
    goalType,
    requestId: String(req.body?.requestId || "").trim(),
  });

  await logSecurityEvent(req, "CASHBACK_CLAIMED", {
    goal_type: goalType,
    claim_id: result.claim?.id || "",
    idempotent: result.idempotent,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

export default router;
