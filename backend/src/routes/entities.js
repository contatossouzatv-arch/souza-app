import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createSecurityEvent,
  createEntity,
  deleteEntity,
  filterEntity,
  getEntityById,
  listEntity,
  updateEntity,
} from "../db/index.js";
import {
  canCreateEntity,
  canDeleteEntity,
  canReadEntity,
  canUpdateEntity,
  sanitizeCreatePayload,
  sanitizeUpdatePayload,
  scopeEntityRow,
  scopeEntityRows,
} from "../security/entityAccess.js";

function toLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function applyLimit(rows, limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return rows;
  return rows.slice(0, parsed);
}

async function denyEntityAccess(req, res, entity, action, reason = "Access denied") {
  try {
    await createSecurityEvent({
      user_id: req.auth?.sub || null,
      type: "entity_access_denied",
      ip: req.ip,
      user_agent: req.get("user-agent") || "",
      metadata: {
        entity,
        action,
        reason,
      },
    });
  } catch {
    // best effort logging
  }

  return res.status(403).json({ error: reason });
}

export default function createEntitiesRouter(io) {
  const router = Router();

  router.get("/:entity", requireAuth, async (req, res) => {
    const { entity } = req.params;
    const { sort, limit } = req.query;
    const parsedLimit = toLimit(limit);
    if (!canReadEntity(entity, req.auth)) {
      return denyEntityAccess(req, res, entity, "list");
    }

    const rows = await listEntity(entity, sort, parsedLimit);
    const scoped = scopeEntityRows(entity, req.auth, rows);
    res.json(applyLimit(scoped, parsedLimit));
  });

  router.post("/:entity/filter", requireAuth, async (req, res) => {
    const { entity } = req.params;
    const { filters = {}, sort, limit } = req.body || {};
    const parsedLimit = toLimit(limit);
    if (!canReadEntity(entity, req.auth)) {
      return denyEntityAccess(req, res, entity, "filter");
    }

    const rows = await filterEntity(entity, filters, sort, parsedLimit);
    const scoped = scopeEntityRows(entity, req.auth, rows);
    res.json(applyLimit(scoped, parsedLimit));
  });

  router.post("/:entity", requireAuth, async (req, res) => {
    const { entity } = req.params;
    if (!canCreateEntity(entity, req.auth)) {
      return denyEntityAccess(req, res, entity, "create");
    }

    const payload = sanitizeCreatePayload(entity, req.body || {}, req.auth);
    const created = await createEntity(entity, payload);
    const responsePayload = scopeEntityRow(entity, req.auth, created);

    io.emit("entity:changed", {
      entity,
      action: "created",
      payload: responsePayload,
    });

    res.status(201).json(responsePayload);
  });

  router.patch("/:entity/:id", requireAuth, async (req, res) => {
    const { entity, id } = req.params;
    const current = await getEntityById(entity, id);
    if (!current) return res.status(404).json({ error: "Not found" });

    if (!canUpdateEntity(entity, req.auth, current)) {
      return denyEntityAccess(req, res, entity, "update");
    }

    const updated = await updateEntity(entity, id, sanitizeUpdatePayload(entity, req.body || {}, req.auth));
    if (!updated) return res.status(404).json({ error: "Not found" });
    const responsePayload = scopeEntityRow(entity, req.auth, updated);

    io.emit("entity:changed", {
      entity,
      action: "updated",
      payload: responsePayload,
    });

    res.json(responsePayload);
  });

  router.delete("/:entity/:id", requireAuth, async (req, res) => {
    const { entity, id } = req.params;
    const current = await getEntityById(entity, id);
    if (!current) return res.status(404).json({ error: "Not found" });

    if (!canDeleteEntity(entity, req.auth, current)) {
      return denyEntityAccess(req, res, entity, "delete");
    }

    const deleted = await deleteEntity(entity, id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    const responsePayload = scopeEntityRow(entity, req.auth, deleted);

    io.emit("entity:changed", {
      entity,
      action: "deleted",
      payload: { id },
    });

    res.json(responsePayload);
  });

  router.get("/:entity/:id", requireAuth, async (req, res) => {
    const { entity, id } = req.params;
    if (!canReadEntity(entity, req.auth)) {
      return denyEntityAccess(req, res, entity, "get");
    }

    const row = await getEntityById(entity, id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const scoped = scopeEntityRow(entity, req.auth, row);
    if (!scoped) return res.status(404).json({ error: "Not found" });
    res.json(scoped);
  });

  return router;
}
