import {
  createEntityRecordData,
  normalizeRecord,
  updateEntityRecordData,
} from "../db/index.js";

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNumber(value) {
  return Math.max(0, Number(value || 0));
}

export async function upsertPrizeGalleryItem(client, payload) {
  const userId = String(payload?.userId || "").trim();
  const sourceType = String(payload?.sourceType || "").trim();
  const sourceRefId = String(payload?.sourceRefId || "").trim();

  if (!userId || !sourceType || !sourceRefId) {
    throw new Error("Prize gallery item requires userId, sourceType and sourceRefId.");
  }

  // Direct query (no COALESCE) so expression indexes on data->>'source_ref_id' are used
  const _tq = Date.now();
  const existingResult = await client.query(
    `SELECT * FROM entity_records
     WHERE entity_name = 'UserPrizeGalleryItem'
       AND data->>'user_id' = $1
       AND data->>'source_type' = $2
       AND data->>'source_ref_id' = $3
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE`,
    [userId, sourceType, sourceRefId]
  );
  console.info("[prize-gallery] upsert:select-for-update", { ms: Date.now() - _tq, found: existingResult.rows.length });
  const existing = existingResult.rows[0] ? normalizeRecord(existingResult.rows[0]) : null;
  const claimedAt = String(payload?.claimedAt || new Date().toISOString());
  const metadata = {
    ...(existing?.metadata || {}),
    ...(payload?.metadata || {}),
  };

  const nextRecord = {
    ...(existing || {}),
    user_id: userId,
    source_type: sourceType,
    source_ref_id: sourceRefId,
    chest_day_key: normalizeText(payload?.chestDayKey, existing?.chest_day_key || ""),
    title: normalizeText(payload?.title, existing?.title || "Prêmio confirmado"),
    subtitle: normalizeText(payload?.subtitle, existing?.subtitle || ""),
    reward_type: normalizeText(payload?.rewardType, existing?.reward_type || "cash_prize"),
    reward_amount: normalizeNumber(payload?.rewardAmount ?? existing?.reward_amount),
    reward_unit: normalizeText(payload?.rewardUnit, existing?.reward_unit || ""),
    rarity: normalizeText(payload?.rarity, existing?.rarity || "epic"),
    visual_theme: normalizeText(payload?.visualTheme, existing?.visual_theme || "premium"),
    icon: normalizeText(payload?.icon, existing?.icon || "trophy"),
    special_label: normalizeText(payload?.specialLabel, existing?.special_label || ""),
    gallery_image_url: normalizeText(payload?.galleryImageUrl, existing?.gallery_image_url || ""),
    xp_awarded: normalizeNumber(payload?.xpAwarded ?? existing?.xp_awarded),
    claimed_at: claimedAt,
    claim_status: normalizeText(payload?.claimStatus, existing?.claim_status || "validated"),
    metadata,
    updated_date: new Date().toISOString(),
  };

  if (!existing) {
    return createEntityRecordData(client, "UserPrizeGalleryItem", {
      ...nextRecord,
      created_date: claimedAt,
    });
  }

  return updateEntityRecordData(client, "UserPrizeGalleryItem", existing.id, nextRecord);
}

export async function removePrizeGalleryItem(client, { userId, sourceType, sourceRefId }) {
  const result = await client.query(
    `DELETE FROM entity_records
     WHERE entity_name = 'UserPrizeGalleryItem'
       AND data->>'user_id' = $1
       AND data->>'source_type' = $2
       AND data->>'source_ref_id' = $3`,
    [String(userId || "").trim(), String(sourceType || "").trim(), String(sourceRefId || "").trim()]
  );
  return result.rowCount;
}
