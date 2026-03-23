import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  adjustDepositTicketsAdmin,
  createDepositRecord,
  createSecurityEvent,
  deleteDepositAdmin,
  getDepositAdminHistory,
  invalidateDepositAdmin,
  listAdminDeposits,
  listDepositCycleLeaderboard,
  listDepositsByUserId,
  approveDepositRecord,
  rejectDepositRecord,
  updateDepositAdminRecord,
} from "../db/index.js";

const router = Router();

function emitEntityChanged(req, entity, action, payload = {}) {
  req.app?.locals?.io?.emit("entity:changed", {
    entity,
    action,
    payload,
  });
}

function requestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

function normalizeCreatePayload(body = {}) {
  return {
    requestId: String(body.requestId || "").trim(),
    userName: String(body.userName || "").trim(),
    platformName: String(body.platformName || "").trim(),
    userPlatformId: String(body.userPlatformId || "").trim(),
    cycleId: String(body.cycleId || "").trim(),
    proofImageUrl: String(body.proofImageUrl || "").trim(),
    proofImageUrls: Array.isArray(body.proofImageUrls) ? body.proofImageUrls.map((item) => String(item || "").trim()).filter(Boolean) : [],
    amount: Number(body.amount),
  };
}

function normalizeAdminPatchPayload(body = {}) {
  const patch = {};
  if ("amount" in body) patch.amount = Number(body.amount);
  if ("platformName" in body) patch.platform_name = String(body.platformName || "").trim();
  if ("userPlatformId" in body) patch.user_platform_id = String(body.userPlatformId || "").trim();
  if ("proofImageUrl" in body) patch.proof_image_url = String(body.proofImageUrl || "").trim();
  if ("proofImageUrls" in body) {
    patch.proof_image_urls = Array.isArray(body.proofImageUrls)
      ? body.proofImageUrls.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  }
  return patch;
}

router.post("/deposits", requireAuth, async (req, res) => {
  const payload = normalizeCreatePayload(req.body || {});
  if (!payload.platformName || !payload.userPlatformId || !payload.cycleId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return res.status(400).json({ error: "Campos obrigatórios: amount, platformName, userPlatformId e cycleId." });
  }

  const result = await createDepositRecord({
    userId: req.auth.sub,
    userEmail: req.auth.email,
    userName: payload.userName,
    platformName: payload.platformName,
    userPlatformId: payload.userPlatformId,
    amount: payload.amount,
    proofImageUrl: payload.proofImageUrl,
    proofImageUrls: payload.proofImageUrls,
    cycleId: payload.cycleId,
    requestId: payload.requestId,
  });

  emitEntityChanged(req, "Deposit", result.idempotent ? "create-idempotent" : "create", {
    deposit_id: result?.deposit?.id || "",
    user_id: req.auth.sub,
    status: result?.deposit?.status || "pending",
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.get("/deposits/my", requireAuth, async (req, res) => {
  const deposits = await listDepositsByUserId(req.auth.sub);
  return res.json({ items: deposits });
});

router.get("/deposits/leaderboard", requireAuth, async (req, res) => {
  const items = await listDepositCycleLeaderboard({
    cycleId: String(req.query.cycleId || "").trim(),
    limit: req.query.limit,
  });
  return res.json({ items });
});

router.get("/admin/deposits", requireAuth, requireAdmin, async (req, res) => {
  const items = await listAdminDeposits({
    status: String(req.query.status || "").trim(),
    cycleId: String(req.query.cycleId || "").trim(),
    limit: req.query.limit,
  });
  return res.json({ items });
});

router.get("/admin/deposits/:id/history", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });
  const items = await getDepositAdminHistory(depositId);
  return res.json({ items });
});

router.post("/admin/deposits/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await approveDepositRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_APPROVED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      idempotent: result.idempotent,
      tickets_granted: result.processing_event?.tickets_granted || 0,
    },
  });

  emitEntityChanged(req, "Deposit", result.idempotent ? "approve-idempotent" : "approve", {
    deposit_id: result?.deposit?.id || depositId,
    user_id: result?.deposit?.user_id || "",
    status: result?.deposit?.status || "approved",
    tickets_granted: result?.processing_event?.tickets_granted || 0,
  });
  emitEntityChanged(req, "Gamification", "refresh", {
    user_id: result?.deposit?.user_id || "",
    reason: "deposit_approved",
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.patch("/admin/deposits/:id", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await updateDepositAdminRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
    patch: normalizeAdminPatchPayload(req.body || {}),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_EDITED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      idempotent: result.idempotent,
      reason: String(req.body?.reason || "").trim(),
    },
  });

  emitEntityChanged(req, "Deposit", "update", {
    deposit_id: result?.deposit?.id || depositId,
    user_id: result?.deposit?.user_id || "",
    status: result?.deposit?.status || "",
  });

  return res.status(result.idempotent ? 200 : 200).json(result);
});

router.post("/admin/deposits/:id/adjust-tickets", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await adjustDepositTicketsAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
    adjustment: Number(req.body?.adjustment),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_TICKETS_ADJUSTED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      idempotent: result.idempotent,
      adjustment: Number(req.body?.adjustment || 0),
      reason: String(req.body?.reason || "").trim(),
    },
  });

  emitEntityChanged(req, "Deposit", result.idempotent ? "adjust-idempotent" : "adjust-tickets", {
    deposit_id: result?.deposit?.id || depositId,
    user_id: result?.deposit?.user_id || "",
    status: result?.deposit?.status || "",
  });
  emitEntityChanged(req, "Gamification", "refresh", {
    user_id: result?.deposit?.user_id || "",
    reason: "deposit_tickets_adjusted",
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/admin/deposits/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await rejectDepositRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_REJECTED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      idempotent: result.idempotent,
      reason: String(req.body?.reason || "").trim(),
    },
  });

  emitEntityChanged(req, "Deposit", result.idempotent ? "reject-idempotent" : "reject", {
    deposit_id: result?.deposit?.id || depositId,
    user_id: result?.deposit?.user_id || "",
    status: result?.deposit?.status || "rejected",
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/admin/deposits/:id/invalidate", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await invalidateDepositAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_INVALIDATED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      idempotent: result.idempotent,
      reason: String(req.body?.reason || "").trim(),
    },
  });

  emitEntityChanged(req, "Deposit", result.idempotent ? "invalidate-idempotent" : "invalidate", {
    deposit_id: result?.deposit?.id || depositId,
    user_id: result?.deposit?.user_id || "",
    status: result?.deposit?.status || "invalidated",
  });
  emitEntityChanged(req, "Gamification", "refresh", {
    user_id: result?.deposit?.user_id || "",
    reason: "deposit_invalidated",
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.delete("/admin/deposits/:id", requireAuth, requireAdmin, async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await deleteDepositAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  });

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await createSecurityEvent({
    user_id: req.auth.sub,
    type: "DEPOSIT_DELETED",
    ip: requestMeta(req).ip,
    user_agent: requestMeta(req).user_agent,
    metadata: {
      deposit_id: depositId,
      user_id: result?.deposit?.user_id || "",
      reason: String(req.body?.reason || "").trim(),
    },
  });

  emitEntityChanged(req, "Deposit", "delete", {
    deposit_id: depositId,
    user_id: result?.deposit?.user_id || "",
    status: "deleted",
  });
  emitEntityChanged(req, "Gamification", "refresh", {
    user_id: result?.deposit?.user_id || "",
    reason: "deposit_deleted",
  });

  return res.status(200).json(result);
});

export default router;
