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
  normalizeRecord,
  approveDepositRecord,
  pool,
  rejectDepositRecord,
  updateDepositAdminRecord,
} from "../db/index.js";
import { deleteCacheByPrefix, deleteCacheKey, getOrComputeCacheJson } from "../lib/cache.js";
import { emitLegacyEntityChanged } from "../lib/realtimeEvents.js";
import { projectDepositMutation } from "../services/depositProjectionService.js";

const router = Router();
const DEPOSIT_LEADERBOARD_TTL_MS = 15000;
const DEPOSIT_DASHBOARD_SUMMARY_TTL_MS = 10000;
const USER_DEPOSITS_TTL_MS = 5000;
const ADMIN_DEPOSITS_TTL_MS = 5000;
const DEPOSIT_ROUTE_SLOW_MS = 800;

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function withRouteTiming(label, meta, task) {
  const startedAt = Date.now();
  try {
    const result = await task();
    const durationMs = Date.now() - startedAt;
    if (durationMs >= DEPOSIT_ROUTE_SLOW_MS) {
      console.warn(`[deposits-route] slow ${label}`, {
        durationMs,
        ...meta,
      });
    }
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(`[deposits-route] failed ${label}`, {
      durationMs,
      ...meta,
      message: error?.message || "unknown error",
    });
    throw error;
  }
}

function emitEntityChanged(req, entity, action, payload = {}) {
  emitLegacyEntityChanged(req.app?.locals?.io, {
    entity,
    action,
    payload,
    entityId: payload?.deposit_id || payload?.id || "",
  });
}

function requestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

async function recordSecurityEventSafe(payload) {
  try {
    await createSecurityEvent(payload);
  } catch (error) {
    console.error("[deposits-route] security event failed", {
      type: String(payload?.type || ""),
      user_id: String(payload?.user_id || ""),
      message: error?.message || "unknown error",
    });
  }
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

function buildUserDepositsCacheKey(userId = "") {
  return `deposits:my:${String(userId || "").trim() || "anon"}`;
}

function buildAdminDepositsCacheKey({ status = "", cycleId = "", limit = 200 } = {}) {
  return `deposits:admin-list:${String(status || "").trim() || "all"}:${String(cycleId || "").trim() || "all"}:${Math.max(1, Math.min(500, Number(limit || 200) || 200))}`;
}

async function invalidateDepositReadCaches({ userId = "", includeAdmin = false } = {}) {
  const tasks = [
    deleteCacheKey("deposits:dashboard-summary"),
    deleteCacheByPrefix("deposits:leaderboard:"),
  ];
  const safeUserId = String(userId || "").trim();

  if (safeUserId) {
    tasks.push(deleteCacheKey(buildUserDepositsCacheKey(safeUserId)));
  }

  if (includeAdmin) {
    tasks.push(deleteCacheByPrefix("deposits:admin-list:"));
  }

  await Promise.all(tasks).catch((error) => {
    console.error("[deposits-route] cache invalidation failed", {
      userId: safeUserId,
      includeAdmin,
      message: error?.message || "unknown error",
    });
  });
}

async function runDepositProjection(req, deposit, action) {
  await projectDepositMutation({ io: req, action, deposit });
}

async function listDepositCycles() {
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
     FROM entity_records
     WHERE entity_name = 'DepositantDrawCycle'
     ORDER BY created_at DESC`
  );
  return result.rows.map(normalizeRecord).map((cycle) => ({
    ...cycle,
    top_participants: [
      cycle.first_place_user_id ? { user_id: cycle.first_place_user_id, user_name: cycle.first_place_user_name, total: Number(cycle.first_place_amount || 0) } : null,
      cycle.second_place_user_id ? { user_id: cycle.second_place_user_id, user_name: cycle.second_place_user_name, total: Number(cycle.second_place_amount || 0) } : null,
      cycle.third_place_user_id ? { user_id: cycle.third_place_user_id, user_name: cycle.third_place_user_name, total: Number(cycle.third_place_amount || 0) } : null,
    ].filter(Boolean),
  }));
}

async function listDepositDrawWinners(limit = 200) {
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
     FROM entity_records
     WHERE entity_name = 'DepositantDrawWinner'
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(1000, Number(limit || 200)))]
  );
  return result.rows.map(normalizeRecord);
}

async function listUsersBasicByIds(ids = []) {
  const normalized = [...new Set(ids.map((item) => String(item || "").trim()).filter(Boolean))];
  if (normalized.length === 0) return [];
  const result = await pool.query(
    `SELECT
       id::text AS id,
       full_name,
       nick,
       email,
       phone,
       platform_id,
       profile_avatar_id,
       profile_image_mode,
       profile_image_url,
       profile_image_status
     FROM users
     WHERE id::text = ANY($1::text[])`,
    [normalized]
  );
  return result.rows.map((row) => ({
    id: String(row.id || ""),
    full_name: String(row.full_name || "").trim(),
    nick: String(row.nick || "").trim(),
    email: String(row.email || "").trim(),
    phone: String(row.phone || "").trim(),
    platform_id: String(row.platform_id || "").trim(),
    profile_avatar_id: String(row.profile_avatar_id || "").trim(),
    profile_image_mode: String(row.profile_image_mode || "").trim(),
    profile_image_url:
      String(row.profile_image_status || "").trim().toLowerCase() === "approved"
        ? String(row.profile_image_url || "").trim() || (row.id ? `/api/auth/profile-image/${row.id}` : "")
        : "",
    profile_image_status: String(row.profile_image_status || "").trim(),
  }));
}

router.post("/deposits", requireAuth, asyncHandler(async (req, res) => {
  const payload = normalizeCreatePayload(req.body || {});
  if (!payload.platformName || !payload.userPlatformId || !payload.cycleId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return res.status(400).json({ error: "Campos obrigatórios: amount, platformName, userPlatformId e cycleId." });
  }

  const cycles = await listDepositCycles();
  const targetCycle = cycles.find((c) => String(c.id) === String(payload.cycleId));
  if (!targetCycle) {
    return res.status(400).json({ error: "Ciclo não encontrado." });
  }
  if (!targetCycle.active) {
    return res.status(400).json({ error: "Este ciclo foi encerrado. Novos depósitos não são permitidos." });
  }

  const result = await withRouteTiming("create", {
    userId: String(req.auth?.sub || ""),
    cycleId: payload.cycleId,
  }, () => createDepositRecord({
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
  }));

  emitEntityChanged(req, "Deposit", result.idempotent ? "create-idempotent" : "create", {
    deposit_id: result?.deposit?.id || "",
    user_id: req.auth.sub,
    status: result?.deposit?.status || "pending",
  });
  await runDepositProjection(req, result?.deposit || {}, result.idempotent ? "create-idempotent" : "create");
  await invalidateDepositReadCaches({
    userId: req.auth.sub,
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

router.get("/deposits/my", requireAuth, asyncHandler(async (req, res) => {
  const userId = String(req.auth?.sub || "").trim();
  const deposits = await withRouteTiming("my", { userId }, () =>
    getOrComputeCacheJson(buildUserDepositsCacheKey(userId), USER_DEPOSITS_TTL_MS, () => listDepositsByUserId(userId))
  );
  return res.json({ items: deposits });
}));

router.get("/deposits/dashboard-summary", requireAuth, asyncHandler(async (_req, res) => {
  const result = await withRouteTiming("dashboard-summary", {}, () => getOrComputeCacheJson("deposits:dashboard-summary", DEPOSIT_DASHBOARD_SUMMARY_TTL_MS, async () => {
    const [cycles, drawWinners] = await Promise.all([
      listDepositCycles(),
      listDepositDrawWinners(),
    ]);

    const userIds = [
      ...drawWinners.map((item) => item.user_id),
      ...cycles.flatMap((cycle) => [
        cycle.first_place_user_id,
        cycle.second_place_user_id,
        cycle.third_place_user_id,
      ]),
    ];

    const profiles = await listUsersBasicByIds(userIds);
    return {
      cycles,
      drawWinners,
      profiles,
    };
  }));
  return res.json(result);
}));

router.get("/deposits/leaderboard", requireAuth, asyncHandler(async (req, res) => {
  const cycleId = String(req.query.cycleId || "").trim();
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10) || 10));
  const currentUserId = String(req.auth.sub || "").trim();
  const cacheKey = `deposits:leaderboard:${cycleId || "all"}:${limit}:user:${currentUserId || "anon"}`;
  const result = await withRouteTiming("leaderboard", { cycleId, limit }, () => getOrComputeCacheJson(cacheKey, DEPOSIT_LEADERBOARD_TTL_MS, () =>
    listDepositCycleLeaderboard({
      cycleId,
      limit,
      currentUserId,
    })
  ));
  return res.json(result);
}));

router.get("/admin/deposits", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").trim();
  const cycleId = String(req.query.cycleId || "").trim();
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200) || 200));
  const items = await withRouteTiming("admin-list", {
    status,
    cycleId,
    limit,
  }, () =>
    getOrComputeCacheJson(
      buildAdminDepositsCacheKey({ status, cycleId, limit }),
      ADMIN_DEPOSITS_TTL_MS,
      () => listAdminDeposits({ status, cycleId, limit })
    )
  );
  return res.json({ items });
}));

router.get("/admin/deposits/:id/history", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });
  const items = await getDepositAdminHistory(depositId);
  return res.json({ items });
}));

router.post("/admin/deposits/:id/approve", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-approve", { depositId }, () => approveDepositRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, result.idempotent ? "approve-idempotent" : "approve");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

router.patch("/admin/deposits/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-update", { depositId }, () => updateDepositAdminRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
    patch: normalizeAdminPatchPayload(req.body || {}),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, "update");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 200).json(result);
}));

router.post("/admin/deposits/:id/adjust-tickets", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-adjust-tickets", { depositId }, () => adjustDepositTicketsAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
    adjustment: Number(req.body?.adjustment),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, result.idempotent ? "adjust-idempotent" : "adjust-tickets");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

router.post("/admin/deposits/:id/reject", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-reject", { depositId }, () => rejectDepositRecord({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, result.idempotent ? "reject-idempotent" : "reject");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

router.post("/admin/deposits/:id/invalidate", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-invalidate", { depositId }, () => invalidateDepositAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, result.idempotent ? "invalidate-idempotent" : "invalidate");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

router.delete("/admin/deposits/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const depositId = String(req.params.id || "").trim();
  if (!depositId) return res.status(400).json({ error: "Deposit id obrigatório." });

  const result = await withRouteTiming("admin-delete", { depositId }, () => deleteDepositAdmin({
    depositId,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
    requestId: String(req.body?.requestId || "").trim(),
    reason: String(req.body?.reason || "").trim(),
  }));

  if (!result) {
    return res.status(404).json({ error: "Depósito não encontrado." });
  }

  await recordSecurityEventSafe({
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
  await runDepositProjection(req, result?.deposit || {}, "delete");
  await invalidateDepositReadCaches({
    userId: result?.deposit?.user_id || "",
    includeAdmin: true,
  });

  return res.status(200).json(result);
}));

export default router;
