import { randomInt } from "node:crypto";
import {
  createEngagementProcessingEvent,
  createEntityRecordData,
  findEngagementProcessingEventByRequestId,
  findEntityRecordByNameAndIdForUpdate,
  getEntityById,
  getEntityRecordData,
  listEntityRecordsForUpdate,
  normalizeRecord,
  pool,
  updateEntityRecordData,
} from "../db/index.js";
import { removePrizeGalleryItem, upsertPrizeGalleryItem } from "./prizeGalleryService.js";

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAdminName(value) {
  return String(value || "").trim().slice(0, 120);
}

function normalizeAdminPhone(value) {
  return String(value || "").trim().slice(0, 40);
}

function shuffle(items = []) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

async function findEvent(domain, requestId) {
  const normalized = String(requestId || "").trim();
  if (!normalized) return null;
  const existing = await findEngagementProcessingEventByRequestId(normalized);
  if (!existing || existing.domain !== domain) return null;
  return existing;
}

async function createEvent(client, { domain, action, requestId, entityName, entityId, userId = null, metadata = {}, adminUserId, adminEmail }) {
  return createEngagementProcessingEvent(client, {
    domain,
    action,
    request_id: String(requestId || "").trim() || null,
    user_id: userId,
    entity_name: entityName,
    entity_id: entityId,
    status: "accepted",
    metadata,
    processed_by_user_id: adminUserId,
    processed_by_email: adminEmail,
  });
}

async function createAudit(client, payload) {
  return createEntityRecordData(client, "DrawWinnerAudit", {
    ...(payload || {}),
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  });
}

async function syncRafflePrizeGalleryItem(client, { participant, raffle, sourceType, audit, active }) {
  if (!participant?.user_id || !participant?.id) return null;
  if (!active) {
    await removePrizeGalleryItem(client, {
      userId: participant.user_id,
      sourceType,
      sourceRefId: participant.id,
    });
    return null;
  }

  const isGameCall = sourceType === "game_call";
  return upsertPrizeGalleryItem(client, {
    userId: participant.user_id,
    sourceType,
    sourceRefId: participant.id,
    title: raffle?.title || (isGameCall ? "Call de Jogo" : "Sorteio ao Vivo"),
    subtitle: isGameCall
      ? "Sua call foi confirmada e o prêmio entrou na sua galeria."
      : "Vitória confirmada em sorteio ao vivo e registrada na sua galeria.",
    rewardType: "cash_prize",
    rewardAmount: Number(participant?.prize_amount || raffle?.prize_amount || 0),
    rewardUnit: "BRL",
    rarity: "epic",
    visualTheme: isGameCall ? "electric" : "spotlight",
    icon: "trophy",
    claimStatus: "validated",
    claimedAt: audit?.validated_at || new Date().toISOString(),
    metadata: {
      raffle_id: participant?.raffle_id || "",
      raffle_title: raffle?.title || "",
      audit_id: audit?.id || "",
      participant_id: participant?.id || "",
      source_type: sourceType,
      admin_name: raffle?.admin_name || "",
      admin_phone: raffle?.admin_phone || "",
      reward_snapshot: {
        adminContactName: raffle?.admin_name || "",
        adminContactPhone: raffle?.admin_phone || "",
        rewardType: "cash_prize",
        rewardAmount: Number(participant?.prize_amount || raffle?.prize_amount || 0),
      },
    },
  });
}

async function listRowsByIds(client, entityName, ids = []) {
  const normalized = [...new Set(ids.map((item) => String(item || "")).filter(Boolean))];
  if (normalized.length === 0) return [];
  const placeholders = normalized.map((_, index) => `$${index + 2}`).join(", ");
  const result = await client.query(
    `SELECT * FROM entity_records WHERE entity_name = $1 AND id IN (${placeholders}) FOR UPDATE`,
    [String(entityName || ""), ...normalized]
  );
  return result.rows.map(normalizeRecord);
}

async function removePendingCandidate(client, raffleEntity, raffleId, participantId) {
  const locked = await findEntityRecordByNameAndIdForUpdate(client, raffleEntity, raffleId);
  if (!locked) return null;
  const raffle = getEntityRecordData(locked);
  const nextCandidates = (Array.isArray(raffle.pending_draw_candidates) ? raffle.pending_draw_candidates : []).filter((id) => String(id) !== String(participantId));
  return updateEntityRecordData(client, raffleEntity, raffleId, {
    ...raffle,
    pending_draw_candidates: nextCandidates,
    pending_draw_count: nextCandidates.length,
    updated_date: new Date().toISOString(),
  });
}

async function createRaffle({ domain, entityName, requestId, adminUserId, adminEmail, payload }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id) return { raffle: await getEntityById(entityName, existing.entity_id), processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const raffle = await createEntityRecordData(client, entityName, { ...(payload || {}), created_date: new Date().toISOString(), updated_date: new Date().toISOString() });
    const processingEvent = await createEvent(client, { domain, action: "create_raffle", requestId, entityName, entityId: raffle.id, metadata: payload, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { raffle, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function endRaffle({ domain, entityName, raffleId, requestId, adminUserId, adminEmail }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id) return { raffle: await getEntityById(entityName, existing.entity_id), processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await findEntityRecordByNameAndIdForUpdate(client, entityName, raffleId);
    if (!locked) return await client.query("ROLLBACK").then(() => null);
    const raffle = getEntityRecordData(locked);
    const updated = await updateEntityRecordData(client, entityName, raffleId, { ...raffle, active: false, ended: true, ended_date: raffle.ended_date || new Date().toISOString(), updated_date: new Date().toISOString() });
    const processingEvent = await createEvent(client, { domain, action: "end_raffle", requestId, entityName, entityId: raffleId, metadata: { previous_active: Boolean(raffle.active), previous_ended: Boolean(raffle.ended) }, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { raffle: updated, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function drawCandidates({ domain, raffleEntity, participantEntity, raffleId, requestId, adminUserId, adminEmail, winnerCount, eligibility }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id) {
    const winners = await Promise.all((existing.metadata?.candidate_ids || []).map((id) => getEntityById(participantEntity, id)));
    return { raffle: await getEntityById(raffleEntity, raffleId), winners: winners.filter(Boolean), processing_event: existing, idempotent: true };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const raffleLocked = await findEntityRecordByNameAndIdForUpdate(client, raffleEntity, raffleId);
    if (!raffleLocked) return await client.query("ROLLBACK").then(() => null);
    const raffle = getEntityRecordData(raffleLocked);
    const pendingIds = Array.isArray(raffle.pending_draw_candidates) ? raffle.pending_draw_candidates : [];
    if (pendingIds.length > 0) {
      const winners = await listRowsByIds(client, participantEntity, pendingIds);
      if (winners.length === pendingIds.length && winners.length > 0) {
        await client.query("COMMIT");
        return { raffle, winners, processing_event: null, idempotent: true };
      }

      await updateEntityRecordData(client, raffleEntity, raffleId, {
        ...raffle,
        pending_draw_candidates: [],
        pending_draw_count: 0,
        pending_draw_created_at: null,
        updated_date: new Date().toISOString(),
      });
    }
    const candidates = (await listEntityRecordsForUpdate(client, participantEntity, { raffle_id: raffleId })).filter((item) => eligibility(item, raffle));
    if (candidates.length === 0) throw httpError("Não há participantes elegíveis para sortear.", 409);
    const winners = shuffle(candidates).slice(0, Math.min(Math.max(1, Number(winnerCount || 1)), candidates.length));
    const updatedRaffle = await updateEntityRecordData(client, raffleEntity, raffleId, { ...raffle, pending_draw_candidates: winners.map((item) => item.id), pending_draw_count: winners.length, pending_draw_created_at: new Date().toISOString(), updated_date: new Date().toISOString() });
    const processingEvent = await createEvent(client, { domain, action: "draw_candidates", requestId, entityName: raffleEntity, entityId: raffleId, metadata: { candidate_ids: winners.map((item) => item.id), candidate_count: winners.length }, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { raffle: updatedRaffle, winners, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveCandidate({ domain, raffleEntity, participantEntity, participantId, requestId, adminUserId, adminEmail, transform, buildAudit, syncPrizeGallery }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id) return { participant: await getEntityById(participantEntity, existing.entity_id), processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await findEntityRecordByNameAndIdForUpdate(client, participantEntity, participantId);
    if (!locked) return await client.query("ROLLBACK").then(() => null);
    const participant = getEntityRecordData(locked);
    const raffleLocked = await findEntityRecordByNameAndIdForUpdate(client, raffleEntity, participant.raffle_id);
    const raffle = getEntityRecordData(raffleLocked);
    const updated = await updateEntityRecordData(client, participantEntity, participantId, transform(participant, raffle));
    await removePendingCandidate(client, raffleEntity, participant.raffle_id, participantId);
    const auditPayload = buildAudit?.(participant, raffle);
    const audit = auditPayload ? await createAudit(client, auditPayload) : null;
    if (typeof syncPrizeGallery === "function") {
      await syncPrizeGallery({ client, participant: updated, raffle, audit });
    }
    const processingEvent = await createEvent(client, { domain, action: domain, requestId, entityName: participantEntity, entityId: participantId, userId: participant.user_id, metadata: { raffle_id: participant.raffle_id }, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { participant: updated, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteParticipant({ domain, entityName, participantId, requestId, adminUserId, adminEmail }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id) return { participant: null, processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await findEntityRecordByNameAndIdForUpdate(client, entityName, participantId);
    if (!locked) return await client.query("ROLLBACK").then(() => null);
    const participant = getEntityRecordData(locked);
    const sourceType = entityName === "GameCallParticipant" ? "game_call" : "live_draw";
    await removePrizeGalleryItem(client, {
      userId: participant.user_id,
      sourceType,
      sourceRefId: participant.id,
    });
    await removePendingCandidate(client, entityName === "GameCallParticipant" ? "GameCallRaffle" : "LiveDrawRaffle", participant.raffle_id, participant.id);
    await client.query("DELETE FROM entity_records WHERE entity_name = $1 AND id = $2", [entityName, participantId]);
    const processingEvent = await createEvent(client, { domain, action: "delete_participant", requestId, entityName, entityId: participantId, userId: participant.user_id, metadata: { raffle_id: participant.raffle_id }, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { participant, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function clearParticipants({ domain, entityName, raffleId, requestId, adminUserId, adminEmail }) {
  const existing = await findEvent(domain, requestId);
  if (existing?.entity_id === String(raffleId || "")) return { cleared_count: Number(existing.metadata?.cleared_count || 0), processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const raffleEntityName = entityName === "GameCallParticipant" ? "GameCallRaffle" : "LiveDrawRaffle";
    const participants = await listEntityRecordsForUpdate(client, entityName, { raffle_id: raffleId });
    for (const participant of participants) {
      const sourceType = entityName === "GameCallParticipant" ? "game_call" : "live_draw";
      await removePrizeGalleryItem(client, {
        userId: participant.user_id,
        sourceType,
        sourceRefId: participant.id,
      });
      await client.query("DELETE FROM entity_records WHERE entity_name = $1 AND id = $2", [entityName, participant.id]);
    }
    const raffleLocked = await findEntityRecordByNameAndIdForUpdate(client, raffleEntityName, raffleId);
    if (raffleLocked) {
      const raffle = getEntityRecordData(raffleLocked);
      await updateEntityRecordData(client, raffleEntityName, raffleId, {
        ...raffle,
        pending_draw_candidates: [],
        pending_draw_count: 0,
        pending_draw_created_at: null,
        updated_date: new Date().toISOString(),
      });
    }
    const processingEvent = await createEvent(client, { domain, action: "clear_participants", requestId, entityName, entityId: raffleId, metadata: { cleared_count: participants.length }, adminUserId, adminEmail });
    await client.query("COMMIT");
    return { cleared_count: participants.length, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const liveDrawAdmin = {
  create: (input) => createRaffle({ domain: "admin_live_draw_create", entityName: "LiveDrawRaffle", ...input, payload: { title: String(input.title || "").trim(), active: true, max_winners: Math.max(1, Number(input.maxWinners || 1)), prize_amount: Math.max(0, Number(input.prizeAmount || 0)), admin_name: normalizeAdminName(input.adminName), admin_phone: normalizeAdminPhone(input.adminPhone), ended: false, pending_draw_candidates: [], pending_draw_count: 0 } }),
  update: ({ raffleId, adminName, adminPhone, ...input }) => {
    return (async () => {
      const existing = await findEvent("admin_live_draw_update", input.requestId);
      if (existing?.entity_id) return { raffle: await getEntityById("LiveDrawRaffle", existing.entity_id), processing_event: existing, idempotent: true };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await findEntityRecordByNameAndIdForUpdate(client, "LiveDrawRaffle", raffleId);
        if (!locked) return await client.query("ROLLBACK").then(() => null);
        const current = getEntityRecordData(locked);
        const updated = await updateEntityRecordData(client, "LiveDrawRaffle", raffleId, {
          ...current,
          admin_name: normalizeAdminName(adminName ?? current.admin_name ?? ""),
          admin_phone: normalizeAdminPhone(adminPhone ?? current.admin_phone ?? ""),
          updated_date: new Date().toISOString(),
        });
        const processingEvent = await createEvent(client, { domain: "admin_live_draw_update", action: "update_raffle", requestId: input.requestId, entityName: "LiveDrawRaffle", entityId: raffleId, metadata: { before: current, after: updated }, adminUserId: input.adminUserId, adminEmail: input.adminEmail });
        await client.query("COMMIT");
        return { raffle: updated, processing_event: processingEvent, idempotent: false };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })();
  },
  end: (input) => endRaffle({ domain: "admin_live_draw_end", entityName: "LiveDrawRaffle", ...input }),
  draw: (input) => drawCandidates({ domain: "admin_live_draw_draw", raffleEntity: "LiveDrawRaffle", participantEntity: "LiveDrawParticipant", ...input, eligibility: (participant) => String(participant.validation_status || "pending") === "pending" && !participant.validated }),
  validate: ({ participantId, ...input }) => resolveCandidate({
    domain: "admin_live_draw_validate",
    raffleEntity: "LiveDrawRaffle",
    participantEntity: "LiveDrawParticipant",
    participantId,
    ...input,
    transform: (participant, raffle) => ({
      ...participant,
      validated: true,
      validation_status: "validated",
      won: true,
      prize_amount: Number(raffle?.prize_amount || participant?.prize_amount || 0),
      validated_at: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    }),
    buildAudit: (participant, raffle) => ({
      raffle_id: participant.raffle_id,
      raffle_title: raffle?.title || "Sorteio ao Vivo",
      participant_id: participant.id,
      user_id: participant.user_id,
      user_name: participant.user_name,
      user_nick: participant.user_nick,
      user_email: participant.user_email || "",
      user_phone: participant.user_phone || "",
      user_avatar: participant.user_avatar || "",
      prize_amount: Number(raffle?.prize_amount || participant?.prize_amount || 0),
      admin_name: raffle?.admin_name || "",
      admin_phone: raffle?.admin_phone || "",
      drawn_at: new Date().toISOString(),
      status: "validated",
      validated_at: new Date().toISOString(),
    }),
    syncPrizeGallery: ({ client, participant, raffle, audit }) => syncRafflePrizeGalleryItem(client, { participant, raffle, audit, sourceType: "live_draw", active: true }),
  }),
  invalidate: ({ participantId, ...input }) => resolveCandidate({
    domain: "admin_live_draw_invalidate",
    raffleEntity: "LiveDrawRaffle",
    participantEntity: "LiveDrawParticipant",
    participantId,
    ...input,
    transform: (participant) => ({
      ...participant,
      validated: false,
      validation_status: "pending",
      won: false,
      prize_amount: 0,
      validated_at: null,
      updated_date: new Date().toISOString(),
    }),
    buildAudit: (participant, raffle) => ({
      raffle_id: participant.raffle_id,
      raffle_title: raffle?.title || "Sorteio ao Vivo",
      participant_id: participant.id,
      user_id: participant.user_id,
      user_name: participant.user_name,
      user_nick: participant.user_nick,
      user_email: participant.user_email || "",
      user_phone: participant.user_phone || "",
      user_avatar: participant.user_avatar || "",
      prize_amount: Number(raffle?.prize_amount || participant?.prize_amount || 0),
      admin_name: raffle?.admin_name || "",
      admin_phone: raffle?.admin_phone || "",
      drawn_at: new Date().toISOString(),
      status: "invalidated",
      validated_at: new Date().toISOString(),
    }),
    syncPrizeGallery: ({ client, participant, raffle, audit }) => syncRafflePrizeGalleryItem(client, { participant, raffle, audit, sourceType: "live_draw", active: false }),
  }),
  reactivate: ({ participantId, ...input }) => resolveCandidate({
    domain: "admin_live_draw_reactivate",
    raffleEntity: "LiveDrawRaffle",
    participantEntity: "LiveDrawParticipant",
    participantId,
    ...input,
    transform: (participant) => ({
      ...participant,
      validated: false,
      validation_status: "pending",
      won: false,
      prize_amount: 0,
      claimed_at: null,
      dismissed_at: null,
      validated_at: null,
      updated_date: new Date().toISOString(),
    }),
    buildAudit: null,
  }),
  removeParticipant: (input) => deleteParticipant({ domain: "admin_live_draw_remove_participant", entityName: "LiveDrawParticipant", ...input }),
  clearParticipants: (input) => clearParticipants({ domain: "admin_live_draw_clear_participants", entityName: "LiveDrawParticipant", ...input }),
};

export const gameCallAdmin = {
  create: (input) => createRaffle({ domain: "admin_game_call_create", entityName: "GameCallRaffle", ...input, payload: { title: String(input.title || "").trim(), active: true, prize_amount: Math.max(0, Number(input.prizeAmount || 0)), max_attempts: Math.max(1, Number(input.maxAttempts || 3)), max_winners: Math.max(1, Number(input.maxWinners || 1)), admin_name: normalizeAdminName(input.adminName), admin_phone: normalizeAdminPhone(input.adminPhone), ended: false, pending_draw_candidates: [], pending_draw_count: 0 } }),
  update: ({ raffleId, maxAttempts, maxWinners, adminName, adminPhone, ...input }) => {
    return (async () => {
      const existing = await findEvent("admin_game_call_update", input.requestId);
      if (existing?.entity_id) return { raffle: await getEntityById("GameCallRaffle", existing.entity_id), processing_event: existing, idempotent: true };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await findEntityRecordByNameAndIdForUpdate(client, "GameCallRaffle", raffleId);
        if (!locked) return await client.query("ROLLBACK").then(() => null);
        const current = getEntityRecordData(locked);
        const updated = await updateEntityRecordData(client, "GameCallRaffle", raffleId, { ...current, max_attempts: Math.max(1, Number(maxAttempts || current.max_attempts || 3)), max_winners: Math.max(1, Number(maxWinners || current.max_winners || 1)), admin_name: normalizeAdminName(adminName ?? current.admin_name ?? ""), admin_phone: normalizeAdminPhone(adminPhone ?? current.admin_phone ?? ""), updated_date: new Date().toISOString() });
        const processingEvent = await createEvent(client, { domain: "admin_game_call_update", action: "update_raffle", requestId: input.requestId, entityName: "GameCallRaffle", entityId: raffleId, metadata: { before: current, after: updated }, adminUserId: input.adminUserId, adminEmail: input.adminEmail });
        await client.query("COMMIT");
        return { raffle: updated, processing_event: processingEvent, idempotent: false };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })();
  },
  end: (input) => endRaffle({ domain: "admin_game_call_end", entityName: "GameCallRaffle", ...input }),
  draw: (input) => drawCandidates({ domain: "admin_game_call_draw", raffleEntity: "GameCallRaffle", participantEntity: "GameCallParticipant", ...input, eligibility: (participant, raffle) => String(participant.validation_status || "pending") === "pending" && !participant.validated && Number(participant.attempts || 0) < Number(raffle.max_attempts || 3) }),
  validate: ({ participantId, ...input }) => resolveCandidate({ domain: "admin_game_call_validate", raffleEntity: "GameCallRaffle", participantEntity: "GameCallParticipant", participantId, ...input, transform: (participant, raffle) => ({ ...participant, validated: true, validation_status: "validated", won: true, prize_amount: Number(raffle?.prize_amount || 0), updated_date: new Date().toISOString() }), buildAudit: (participant, raffle) => ({ raffle_id: participant.raffle_id, raffle_title: raffle?.title || "Call de Jogo", user_id: participant.user_id, user_name: participant.user_name, user_nick: participant.user_nick, user_email: participant.user_email || "", user_phone: participant.user_phone || "", user_avatar: participant.user_avatar || "", user_platform_id: participant.user_platform_id || "", game_call: participant.game_call || "", prize_amount: Number(raffle?.prize_amount || 0), admin_name: raffle?.admin_name || "", admin_phone: raffle?.admin_phone || "", drawn_at: new Date().toISOString(), status: "validated", validated_at: new Date().toISOString() }), syncPrizeGallery: ({ client, participant, raffle, audit }) => syncRafflePrizeGalleryItem(client, { participant, raffle, audit, sourceType: "game_call", active: true }) }),
  invalidate: ({ participantId, ...input }) => resolveCandidate({ domain: "admin_game_call_invalidate", raffleEntity: "GameCallRaffle", participantEntity: "GameCallParticipant", participantId, ...input, transform: (participant) => ({ ...participant, validated: false, validation_status: "pending", won: false, attempts: Number(participant.attempts || 0) + 1, updated_date: new Date().toISOString() }), buildAudit: (participant, raffle) => ({ raffle_id: participant.raffle_id, raffle_title: raffle?.title || "Call de Jogo", user_id: participant.user_id, user_name: participant.user_name, user_nick: participant.user_nick, user_email: participant.user_email || "", user_phone: participant.user_phone || "", user_avatar: participant.user_avatar || "", user_platform_id: participant.user_platform_id || "", game_call: participant.game_call || "", prize_amount: Number(raffle?.prize_amount || 0), admin_name: raffle?.admin_name || "", admin_phone: raffle?.admin_phone || "", drawn_at: new Date().toISOString(), status: "invalidated", validated_at: new Date().toISOString() }), syncPrizeGallery: ({ client, participant, raffle, audit }) => syncRafflePrizeGalleryItem(client, { participant, raffle, audit, sourceType: "game_call", active: false }) }),
  reactivate: ({ participantId, ...input }) => resolveCandidate({ domain: "admin_game_call_reactivate", raffleEntity: "GameCallRaffle", participantEntity: "GameCallParticipant", participantId, ...input, transform: (participant) => ({ ...participant, validated: false, validation_status: "pending", won: false, attempts: 0, claimed_at: null, dismissed_at: null, updated_date: new Date().toISOString() }), buildAudit: null }),
  removeParticipant: (input) => deleteParticipant({ domain: "admin_game_call_remove_participant", entityName: "GameCallParticipant", ...input }),
  clearParticipants: (input) => clearParticipants({ domain: "admin_game_call_clear_participants", entityName: "GameCallParticipant", ...input }),
};
