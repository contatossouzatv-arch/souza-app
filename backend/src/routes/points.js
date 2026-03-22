import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  createPointsLedgerEntry,
  createSecurityEvent,
  findPointsLedgerByRequestId,
  getPointsBalanceByUserId,
  listPointsLedgerByUserId,
} from "../db/index.js";

const router = Router();

function requestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const balance = await getPointsBalanceByUserId(req.auth.sub);
  const ledger = await listPointsLedgerByUserId(req.auth.sub, req.query.limit || 50);
  return res.json({ user_id: req.auth.sub, balance, ledger });
});

router.post("/award", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  const requestId = String(req.body?.requestId || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
  const amount = Number(req.body?.amount);

  if (!userId || !requestId || !reason || !Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({
      error: "Campos obrigatórios: userId, amount (int != 0), reason e requestId.",
    });
  }

  const existing = await findPointsLedgerByRequestId(requestId);
  if (existing) {
    const balance = await getPointsBalanceByUserId(userId);
    return res.status(200).json({
      ok: true,
      idempotent: true,
      entry: {
        id: existing.id,
        user_id: existing.user_id,
        amount: Number(existing.amount || 0),
        reason: existing.reason || "",
        request_id: existing.request_id || "",
        metadata: existing.metadata || {},
      },
      balance,
    });
  }

  const entry = await createPointsLedgerEntry({
    user_id: userId,
    amount,
    reason,
    request_id: requestId,
    metadata,
  });

  const balance = await getPointsBalanceByUserId(userId);
  const meta = requestMeta(req);
  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "POINTS_AWARDED",
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: {
      target_user_id: userId,
      amount,
      reason,
      request_id: requestId,
    },
  });

  return res.status(201).json({
    ok: true,
    idempotent: false,
    entry: {
      id: entry.id,
      user_id: entry.user_id,
      amount: Number(entry.amount || 0),
      reason: entry.reason || "",
      request_id: entry.request_id || "",
      metadata: entry.metadata || {},
    },
    balance,
  });
});

export default router;
