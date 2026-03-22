import { randomInt } from "node:crypto";
import {
  createEngagementProcessingEvent,
  createEntityRecordData,
  findEngagementProcessingEventByRequestId,
  findEntityRecordByNameAndIdForUpdate,
  getEntityById,
  getEntityRecordData,
  listEntityRecordsForUpdate,
  pool,
  updateEntityRecordData,
} from "../db/index.js";
import { removePrizeGalleryItem, upsertPrizeGalleryItem } from "./prizeGalleryService.js";

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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

async function syncInstantPrizeGalleryItem(client, { participant, raffle, active }) {
  if (!participant?.user_id || !participant?.id) return null;
  if (!active) {
    await removePrizeGalleryItem(client, {
      userId: participant.user_id,
      sourceType: "instant_raffle",
      sourceRefId: participant.id,
    });
    return null;
  }

  return upsertPrizeGalleryItem(client, {
    userId: participant.user_id,
    sourceType: "instant_raffle",
    sourceRefId: participant.id,
    title: raffle?.title || "Sorteio Rápido",
    subtitle: "Vitória confirmada no sorteio rápido e registrada na sua galeria.",
    rewardType: "cash_prize",
    rewardAmount: Number(raffle?.prize_amount || 0),
    rewardUnit: "BRL",
    rarity: "epic",
    visualTheme: "neon",
    icon: "trophy",
    claimStatus: "validated",
    claimedAt: new Date().toISOString(),
    metadata: {
      raffle_id: participant?.raffle_id || "",
      participant_id: participant?.id || "",
      source_type: "instant_raffle",
    },
  });
}

async function syncDepositPrizeGalleryItem(client, { winner, cycle, active }) {
  if (!winner?.user_id || !winner?.id) return null;
  if (!active) {
    await removePrizeGalleryItem(client, {
      userId: winner.user_id,
      sourceType: "deposit_draw",
      sourceRefId: winner.id,
    });
    return null;
  }

  return upsertPrizeGalleryItem(client, {
    userId: winner.user_id,
    sourceType: "deposit_draw",
    sourceRefId: winner.id,
    title: `Sorteio Depositantes Ciclo #${cycle?.cycle_number || ""}`.trim(),
    subtitle: "Prêmio validado no sorteio geral dos depositantes e salvo na sua galeria.",
    rewardType: "cash_prize",
    rewardAmount: Number(winner?.prize_amount || 0),
    rewardUnit: "BRL",
    rarity: "legendary",
    visualTheme: "gold",
    icon: "trophy",
    claimStatus: "validated",
    claimedAt: new Date().toISOString(),
    metadata: {
      cycle_id: winner?.cycle_id || "",
      cycle_number: cycle?.cycle_number || null,
      winner_id: winner?.id || "",
      ticket_number: Array.isArray(winner?.ticket_numbers) ? winner.ticket_numbers[0] || "" : "",
      source_type: "deposit_draw",
    },
  });
}

export const instantRaffleAdmin = {
  async create({ payload, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_create", requestId);
    if (existing?.entity_id) return { raffle: await getEntityById("InstantRaffle", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const raffle = await createEntityRecordData(client, "InstantRaffle", {
        title: String(payload.title || "").trim(),
        prize_amount: Math.max(0, Number(payload.prizeAmount || 0)),
        max_winners: Math.max(1, Number(payload.maxWinners || 1)),
        draw_time: payload.drawTime,
        admin_name: String(payload.adminName || "").trim(),
        telegram_link: String(payload.telegramLink || "").trim(),
        auto_draw: Boolean(payload.autoDraw),
        active: true,
        ended: false,
        winners_drawn: false,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_create", action: "create_raffle", requestId, entityName: "InstantRaffle", entityId: raffle.id, metadata: payload, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { raffle, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async update({ raffleId, payload, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_update", requestId);
    if (existing?.entity_id) return { raffle: await getEntityById("InstantRaffle", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffle", raffleId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const current = getEntityRecordData(locked);
      const updated = await updateEntityRecordData(client, "InstantRaffle", raffleId, {
        ...current,
        title: String(payload.title || current.title || "").trim(),
        prize_amount: Math.max(0, Number(payload.prizeAmount ?? current.prize_amount ?? 0)),
        max_winners: Math.max(1, Number(payload.maxWinners ?? current.max_winners ?? 1)),
        draw_time: payload.drawTime || current.draw_time,
        admin_name: String(payload.adminName ?? current.admin_name ?? "").trim(),
        telegram_link: String(payload.telegramLink ?? current.telegram_link ?? "").trim(),
        auto_draw: "autoDraw" in payload ? Boolean(payload.autoDraw) : Boolean(current.auto_draw),
        updated_date: new Date().toISOString(),
      });
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_update", action: "update_raffle", requestId, entityName: "InstantRaffle", entityId: raffleId, metadata: { before: current, after: updated }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { raffle: updated, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async draw({ raffleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_draw", requestId);
    if (existing?.entity_id) return { raffle: await getEntityById("InstantRaffle", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const raffleLocked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffle", raffleId);
      if (!raffleLocked) return await client.query("ROLLBACK").then(() => null);
      const raffle = getEntityRecordData(raffleLocked);
      if (raffle.winners_drawn) throw httpError("Este sorteio já foi realizado.", 409);
      const participants = await listEntityRecordsForUpdate(client, "InstantRaffleParticipant", { raffle_id: raffleId });
      if (participants.length === 0) throw httpError("Nenhum participante para sortear.", 409);
      const winners = shuffle(participants).slice(0, Math.min(Number(raffle.max_winners || 1), participants.length));
      const now = new Date().toISOString();
      for (const winner of winners) {
        await updateEntityRecordData(client, "InstantRaffleParticipant", winner.id, { ...winner, won: true, updated_date: now });
        await createAudit(client, {
          raffle_id: raffle.id,
          raffle_title: raffle.title,
          user_id: winner.user_id,
          user_name: winner.user_name,
          user_nick: winner.user_nick,
          user_email: winner.user_email || "",
          user_phone: winner.user_phone || "",
          user_avatar: winner.user_avatar || "",
          user_platform_id: winner.platform_id || "",
          prize_amount: Number(raffle.prize_amount || 0),
          drawn_at: now,
          status: "validated",
          validated_at: now,
        });
      }
      const updatedRaffle = await updateEntityRecordData(client, "InstantRaffle", raffleId, { ...raffle, winners_drawn: true, updated_date: now });
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_draw", action: "draw", requestId, entityName: "InstantRaffle", entityId: raffleId, metadata: { winner_ids: winners.map((item) => item.id), winner_count: winners.length }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { raffle: updatedRaffle, winners, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async end({ raffleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_end", requestId);
    if (existing?.entity_id) return { raffle: await getEntityById("InstantRaffle", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffle", raffleId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const raffle = getEntityRecordData(locked);
      const updated = await updateEntityRecordData(client, "InstantRaffle", raffleId, { ...raffle, active: false, ended: true, ended_date: raffle.ended_date || new Date().toISOString(), updated_date: new Date().toISOString() });
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_end", action: "end_raffle", requestId, entityName: "InstantRaffle", entityId: raffleId, metadata: { previous_active: Boolean(raffle.active) }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { raffle: updated, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async validateWinner({ participantId, validated, requestId = "", adminUserId, adminEmail }) {
    const domain = validated ? "admin_instant_raffle_validate" : "admin_instant_raffle_invalidate";
    const existing = await findEvent(domain, requestId);
    if (existing?.entity_id) return { participant: await getEntityById("InstantRaffleParticipant", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffleParticipant", participantId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const participant = getEntityRecordData(locked);
      const updated = await updateEntityRecordData(client, "InstantRaffleParticipant", participantId, { ...participant, validated: Boolean(validated), updated_date: new Date().toISOString() });
      const raffleLocked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffle", participant.raffle_id);
      const raffle = getEntityRecordData(raffleLocked);
      await syncInstantPrizeGalleryItem(client, { participant: updated, raffle, active: Boolean(validated) });
      const processingEvent = await createEvent(client, { domain, action: validated ? "confirm_winner" : "invalidate_winner", requestId, entityName: "InstantRaffleParticipant", entityId: participantId, userId: participant.user_id, metadata: { raffle_id: participant.raffle_id }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { participant: updated, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async removeParticipant({ participantId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_remove_participant", requestId);
    if (existing?.entity_id) return { participant: null, processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffleParticipant", participantId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const participant = getEntityRecordData(locked);
      await syncInstantPrizeGalleryItem(client, { participant, raffle: null, active: false });
      await client.query("DELETE FROM entity_records WHERE entity_name = 'InstantRaffleParticipant' AND id = $1", [participantId]);
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_remove_participant", action: "remove_participant", requestId, entityName: "InstantRaffleParticipant", entityId: participantId, userId: participant.user_id, metadata: { raffle_id: participant.raffle_id }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { participant, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async reactivateParticipants({ raffleId, participants, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_reactivate", requestId);
    if (existing?.entity_id === String(raffleId || "")) return { added_count: Number(existing.metadata?.added_count || 0), skipped_count: Number(existing.metadata?.skipped_count || 0), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let added = 0;
      let skipped = 0;
      for (const participant of Array.isArray(participants) ? participants : []) {
        const found = await listEntityRecordsForUpdate(client, "InstantRaffleParticipant", { raffle_id: raffleId, user_id: participant.user_id });
        if (found.length > 0) {
          skipped += 1;
          continue;
        }
        await createEntityRecordData(client, "InstantRaffleParticipant", {
          raffle_id: raffleId,
          user_id: participant.user_id,
          user_email: participant.user_email || "",
          user_name: participant.user_name || "",
          user_nick: participant.user_nick || "",
          user_avatar: participant.user_avatar || "",
          user_phone: participant.user_phone || "",
          platform_id: participant.platform_id || "",
          won: false,
          prize_claimed: false,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        });
        added += 1;
      }
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_reactivate", action: "reactivate_participants", requestId, entityName: "InstantRaffle", entityId: raffleId, metadata: { added_count: added, skipped_count: skipped }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { added_count: added, skipped_count: skipped, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async cloneWithParticipants({ sourceRaffleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_clone", requestId);
    if (existing?.entity_id) return { raffle: await getEntityById("InstantRaffle", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sourceLocked = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffle", sourceRaffleId);
      if (!sourceLocked) return await client.query("ROLLBACK").then(() => null);
      const source = getEntityRecordData(sourceLocked);
      const activeRaffles = await listEntityRecordsForUpdate(client, "InstantRaffle", { active: true, ended: false });
      for (const active of activeRaffles) {
        await updateEntityRecordData(client, "InstantRaffle", active.id, { ...active, active: false, ended: true, ended_date: new Date().toISOString(), updated_date: new Date().toISOString() });
      }
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(20, 0, 0, 0);
      const raffle = await createEntityRecordData(client, "InstantRaffle", {
        title: source.title,
        prize_amount: source.prize_amount,
        max_winners: source.max_winners,
        draw_time: tomorrow.toISOString(),
        admin_name: source.admin_name,
        telegram_link: source.telegram_link,
        auto_draw: Boolean(source.auto_draw),
        active: true,
        ended: false,
        winners_drawn: false,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });
      const participants = await listEntityRecordsForUpdate(client, "InstantRaffleParticipant", { raffle_id: sourceRaffleId });
      for (const participant of participants) {
        await createEntityRecordData(client, "InstantRaffleParticipant", {
          raffle_id: raffle.id,
          user_id: participant.user_id,
          user_email: participant.user_email || "",
          user_name: participant.user_name || "",
          user_nick: participant.user_nick || "",
          user_avatar: participant.user_avatar || "",
          user_phone: participant.user_phone || "",
          platform_id: participant.platform_id || "",
          won: false,
          prize_claimed: false,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        });
      }
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_clone", action: "clone_with_participants", requestId, entityName: "InstantRaffle", entityId: raffle.id, metadata: { source_raffle_id: sourceRaffleId, participant_count: participants.length }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { raffle, participant_count: participants.length, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async delete({ raffleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_instant_raffle_delete", requestId);
    if (existing?.entity_id === String(raffleId || "")) return { deleted: true, processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const participants = await listEntityRecordsForUpdate(client, "InstantRaffleParticipant", { raffle_id: raffleId });
      for (const participant of participants) {
        await syncInstantPrizeGalleryItem(client, { participant, raffle: null, active: false });
        await client.query("DELETE FROM entity_records WHERE entity_name = 'InstantRaffleParticipant' AND id = $1", [participant.id]);
      }
      await client.query("DELETE FROM entity_records WHERE entity_name = 'InstantRaffle' AND id = $1", [raffleId]);
      const processingEvent = await createEvent(client, { domain: "admin_instant_raffle_delete", action: "delete_raffle", requestId, entityName: "InstantRaffle", entityId: raffleId, metadata: { removed_participants: participants.length }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { deleted: true, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export const depositDrawAdmin = {
  async draw({ cycleId, prizeAmount, winnerCount = 1, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_deposit_draw", requestId);
    if (existing?.entity_id === String(cycleId || "")) return { winners: [], processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cycleLocked = await findEntityRecordByNameAndIdForUpdate(client, "DepositantDrawCycle", cycleId);
      if (!cycleLocked) return await client.query("ROLLBACK").then(() => null);
      const deposits = await listEntityRecordsForUpdate(client, "Deposit", { cycle_id: cycleId, status: "approved" });
      const ticketPool = [];
      deposits.forEach((deposit) => {
        (Array.isArray(deposit.ticket_numbers) ? deposit.ticket_numbers : []).forEach((ticketNumber) => {
          ticketPool.push({ deposit, ticketNumber: String(ticketNumber) });
        });
      });
      if (ticketPool.length === 0) throw httpError("Não há bilhetes para sortear.", 409);
      const selected = shuffle(ticketPool).slice(0, Math.min(Math.max(1, Number(winnerCount || 1)), ticketPool.length));
      const winners = [];
      for (const entry of selected) {
        winners.push(await createEntityRecordData(client, "DepositantDrawWinner", {
          user_id: entry.deposit.user_id,
          user_name: entry.deposit.user_name,
          user_email: entry.deposit.user_email,
          user_nick: entry.deposit.user_name,
          user_avatar: "",
          prize_type: "raffle",
          prize_amount: Math.max(0, Number(prizeAmount || 0)),
          total_deposited: Number(entry.deposit.amount || 0),
          tickets_count: Array.isArray(entry.deposit.ticket_numbers) ? entry.deposit.ticket_numbers.length : 0,
          ticket_numbers: [entry.ticketNumber],
          draw_date: new Date().toISOString(),
          cycle_id: cycleId,
          validated: false,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        }));
      }
      const processingEvent = await createEvent(client, { domain: "admin_deposit_draw", action: "draw", requestId, entityName: "DepositantDrawCycle", entityId: cycleId, metadata: { winner_ids: winners.map((item) => item.id), ticket_numbers: winners.map((item) => item.ticket_numbers?.[0] || "") }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { winners, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async validate({ winnerId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_deposit_draw_validate", requestId);
    if (existing?.entity_id) return { winner: await getEntityById("DepositantDrawWinner", existing.entity_id), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "DepositantDrawWinner", winnerId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const winner = getEntityRecordData(locked);
      const cycleLocked = await findEntityRecordByNameAndIdForUpdate(client, "DepositantDrawCycle", winner.cycle_id);
      const cycle = getEntityRecordData(cycleLocked);
      const updated = await updateEntityRecordData(client, "DepositantDrawWinner", winnerId, { ...winner, validated: true, validated_date: new Date().toISOString(), updated_date: new Date().toISOString() });
      await createAudit(client, {
        raffle_id: "depositant_draw",
        raffle_title: `Sorteio Depositantes Ciclo #${cycle?.cycle_number || ""}`,
        cycle_number: cycle?.cycle_number || null,
        user_id: winner.user_id,
        user_name: winner.user_name,
        user_nick: winner.user_nick,
        user_email: winner.user_email || "",
        user_phone: winner.user_phone || "",
        user_avatar: winner.user_avatar || "",
        user_platform_id: winner.user_platform_id || "",
        prize_amount: winner.prize_amount,
        drawn_at: winner.draw_date,
        status: "validated",
        validated_at: new Date().toISOString(),
      });
      await syncDepositPrizeGalleryItem(client, { winner: updated, cycle, active: true });
      const processingEvent = await createEvent(client, { domain: "admin_deposit_draw_validate", action: "validate_winner", requestId, entityName: "DepositantDrawWinner", entityId: winnerId, userId: winner.user_id, metadata: { cycle_id: winner.cycle_id }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { winner: updated, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async complete({ cycleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_deposit_draw_complete", requestId);
    if (existing?.entity_id === String(cycleId || "")) return { cycle: await getEntityById("DepositantDrawCycle", cycleId), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "DepositantDrawCycle", cycleId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const cycle = getEntityRecordData(locked);
      const updated = await updateEntityRecordData(client, "DepositantDrawCycle", cycleId, { ...cycle, raffle_completed: true, updated_date: new Date().toISOString() });
      const processingEvent = await createEvent(client, { domain: "admin_deposit_draw_complete", action: "complete_cycle", requestId, entityName: "DepositantDrawCycle", entityId: cycleId, metadata: { previous_completed: Boolean(cycle.raffle_completed) }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { cycle: updated, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteWinner({ winnerId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_deposit_draw_delete_winner", requestId);
    if (existing?.entity_id === String(winnerId || "")) return { deleted: true, processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await findEntityRecordByNameAndIdForUpdate(client, "DepositantDrawWinner", winnerId);
      if (!locked) return await client.query("ROLLBACK").then(() => null);
      const winner = getEntityRecordData(locked);
      await syncDepositPrizeGalleryItem(client, { winner, cycle: { cycle_number: winner.cycle_number || null }, active: false });
      await client.query("DELETE FROM entity_records WHERE entity_name = 'DepositantDrawWinner' AND id = $1", [winnerId]);
      const processingEvent = await createEvent(client, { domain: "admin_deposit_draw_delete_winner", action: "delete_winner", requestId, entityName: "DepositantDrawWinner", entityId: winnerId, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { deleted: true, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async resetTickets({ cycleId, requestId = "", adminUserId, adminEmail }) {
    const existing = await findEvent("admin_deposit_draw_reset_tickets", requestId);
    if (existing?.entity_id === String(cycleId || "")) return { reset_count: Number(existing.metadata?.reset_count || 0), processing_event: existing, idempotent: true };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const deposits = await listEntityRecordsForUpdate(client, "Deposit", { cycle_id: cycleId, status: "approved" });
      let resetCount = 0;
      for (const deposit of deposits) {
        if ((Array.isArray(deposit.ticket_numbers) && deposit.ticket_numbers.length > 0) || Number(deposit.tickets_count || 0) > 0) {
          await updateEntityRecordData(client, "Deposit", deposit.id, { ...deposit, ticket_numbers: [], tickets_count: 0, basic_ticket_count: 0, bonus_ticket_count: 0, updated_date: new Date().toISOString() });
          resetCount += 1;
        }
      }
      const processingEvent = await createEvent(client, { domain: "admin_deposit_draw_reset_tickets", action: "reset_tickets", requestId, entityName: "DepositantDrawCycle", entityId: cycleId, metadata: { reset_count: resetCount }, adminUserId, adminEmail });
      await client.query("COMMIT");
      return { reset_count: resetCount, processing_event: processingEvent, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export async function syncParticipationPhones({ userId, phone, requestId = "" }) {
  const existing = await findEvent("profile_sync_phone", requestId);
  if (existing?.user_id === String(userId || "")) return { updated_count: Number(existing.metadata?.updated_count || 0), processing_event: existing, idempotent: true };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updatedCount = 0;
    for (const entityName of ["LiveDrawParticipant", "GameCallParticipant", "InstantRaffleParticipant"]) {
      const rows = await listEntityRecordsForUpdate(client, entityName, { user_id: userId });
      for (const row of rows) {
        await updateEntityRecordData(client, entityName, row.id, { ...row, user_phone: String(phone || "").trim(), updated_date: new Date().toISOString() });
        updatedCount += 1;
      }
    }
    const processingEvent = await createEvent(client, { domain: "profile_sync_phone", action: "sync_phone", requestId, entityName: "User", entityId: userId, userId, metadata: { updated_count: updatedCount }, adminUserId: userId, adminEmail: null });
    await client.query("COMMIT");
    return { updated_count: updatedCount, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
