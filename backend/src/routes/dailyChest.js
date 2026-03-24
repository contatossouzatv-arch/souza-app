import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  createDailyChestOpening,
  createDailyChestDepositTicketGrant,
  createEntity,
  createPointsLedgerEntry,
  findEntityRecordByNameAndIdForUpdate,
  findLatestDailyChestOpeningByUserDay,
  findPointsLedgerByRequestId,
  getEntityById,
  getPointsBalanceByUserId,
  getDailyChestAccessUnlock,
  listDailyChestBonusGrantsByUserDay,
  listDailyChestOpeningsByUserDay,
  listEntity,
  markDailyChestOpeningClaimed,
  pool,
  upsertDailyChestAccessUnlock,
  updateEntity,
} from "../db/index.js";

const router = Router();

const DEFAULT_DAILY_CHEST_SETTINGS = {
  enabled: false,
  tapGoal: 4,
  messageOfDay: "Toque no baú para abrir",
  resetHour: 0,
  resetMinute: 0,
  timezone: "America/Sao_Paulo",
  rarityVisual: "rare",
  sceneTheme: "aurora",
  baseDailyChests: 0,
  xpPerOpen: 0,
  scheduleStartAt: "",
  scheduleEndAt: "",
  depositBonusEnabled: false,
  bonusChestsPerApproved: 1,
  bonusAmountStep: 0,
  bonusChestsPerStep: 0,
  balanceWinsPerUserDay: 1,
  accessGroupLink: "",
};

function readBooleanSetting(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readNumberSetting(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getSettingsMap(items = []) {
  const map = new Map();
  items.forEach((item) => {
    map.set(String(item.key || ""), item.value);
  });
  return map;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseOptionalDate(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAccessCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

function getLocalWindow({ resetHour, resetMinute }) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(resetHour, resetMinute, 0, 0);
  if (now < start) {
    start.setDate(start.getDate() - 1);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const chestDayKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  return {
    now,
    availableAt: start,
    resetAt: end,
    chestDayKey,
  };
}

async function loadDailyChestSettings() {
  const items = await listEntity("AppSettings");
  const map = getSettingsMap(items);
  return {
    enabled: readBooleanSetting(map.get("daily_chest_enabled"), DEFAULT_DAILY_CHEST_SETTINGS.enabled),
    tapGoal: readNumberSetting(map.get("daily_chest_tap_goal"), DEFAULT_DAILY_CHEST_SETTINGS.tapGoal, 1, 12),
    messageOfDay: String(map.get("daily_chest_message_of_day") || DEFAULT_DAILY_CHEST_SETTINGS.messageOfDay).trim(),
    resetHour: readNumberSetting(map.get("daily_chest_reset_hour"), DEFAULT_DAILY_CHEST_SETTINGS.resetHour, 0, 23),
    resetMinute: readNumberSetting(map.get("daily_chest_reset_minute"), DEFAULT_DAILY_CHEST_SETTINGS.resetMinute, 0, 59),
    timezone: String(map.get("daily_chest_timezone") || DEFAULT_DAILY_CHEST_SETTINGS.timezone).trim(),
    rarityVisual: String(map.get("daily_chest_rarity_visual") || DEFAULT_DAILY_CHEST_SETTINGS.rarityVisual).trim(),
    sceneTheme: String(map.get("daily_chest_scene_theme") || DEFAULT_DAILY_CHEST_SETTINGS.sceneTheme).trim(),
    baseDailyChests: readNumberSetting(map.get("daily_chest_base_daily_chests"), DEFAULT_DAILY_CHEST_SETTINGS.baseDailyChests, 0, 20),
    xpPerOpen: readNumberSetting(map.get("daily_chest_xp_per_open"), DEFAULT_DAILY_CHEST_SETTINGS.xpPerOpen, 0, 5000),
    scheduleStartAt: String(map.get("daily_chest_schedule_start_at") || DEFAULT_DAILY_CHEST_SETTINGS.scheduleStartAt).trim(),
    scheduleEndAt: String(map.get("daily_chest_schedule_end_at") || DEFAULT_DAILY_CHEST_SETTINGS.scheduleEndAt).trim(),
    depositBonusEnabled: readBooleanSetting(
      map.get("daily_chest_deposit_bonus_enabled"),
      DEFAULT_DAILY_CHEST_SETTINGS.depositBonusEnabled
    ),
    bonusChestsPerApproved: readNumberSetting(
      map.get("daily_chest_bonus_chests_per_approved"),
      DEFAULT_DAILY_CHEST_SETTINGS.bonusChestsPerApproved,
      0,
      20
    ),
    bonusAmountStep: readNumberSetting(
      map.get("daily_chest_bonus_amount_step"),
      DEFAULT_DAILY_CHEST_SETTINGS.bonusAmountStep,
      0,
      1000000
    ),
    bonusChestsPerStep: readNumberSetting(
      map.get("daily_chest_bonus_chests_per_step"),
      DEFAULT_DAILY_CHEST_SETTINGS.bonusChestsPerStep,
      0,
      20
    ),
    balanceWinsPerUserDay: readNumberSetting(
      map.get("daily_chest_balance_wins_per_user_day"),
      DEFAULT_DAILY_CHEST_SETTINGS.balanceWinsPerUserDay,
      0,
      10
    ),
    accessCode: normalizeAccessCode(map.get("daily_chest_access_code")),
    accessCodeDayKey: String(map.get("daily_chest_access_code_day_key") || "").trim(),
    accessGroupLink: String(map.get("daily_chest_access_group_link") || DEFAULT_DAILY_CHEST_SETTINGS.accessGroupLink).trim(),
  };
}

function normalizeRewardConfig(source, settings) {
  const rewardAmount = Number(source?.reward_amount || 0);
  const stockTotal = Math.max(0, Number(source?.stock_total || 0));
  const claimedCount = Math.max(0, Number(source?.claimed_count || 0));
  const weight = Math.max(1, Number(source?.weight || 100));
  const dailyCap = Math.max(0, Number(source?.daily_cap || 0));
  return {
    id: String(source?.id || ""),
    title: String(source?.title || "Baú Diário").trim() || "Baú Diário",
    subtitle: String(source?.subtitle || settings.messageOfDay || "Recompensa diária pronta para abrir").trim(),
    rewardType: String(source?.reward_type || "points_balance").trim() || "points_balance",
    rewardAmount: Number.isFinite(rewardAmount) ? rewardAmount : 0,
    rewardUnit: String(source?.reward_unit || "").trim(),
    rarity: String(source?.rarity || settings.rarityVisual || "rare").trim() || "rare",
    specialLabel: String(source?.special_label || "").trim(),
    autoApply: readBooleanSetting(source?.auto_apply, true),
    messageOfDay: String(source?.message_of_day || settings.messageOfDay || "").trim(),
    visualTheme: String(source?.visual_theme || settings.sceneTheme || "aurora").trim() || "aurora",
    icon: String(source?.icon || "sparkles").trim(),
    metadata: source?.metadata && typeof source.metadata === "object" ? source.metadata : {},
    appliesOn: String(source?.applies_on || "").trim(),
    activeFrom: String(source?.active_from || "").trim(),
    activeUntil: String(source?.active_until || "").trim(),
    galleryImageUrl: String(source?.gallery_image_url || "").trim(),
    stockTotal,
    claimedCount,
    dailyCap,
    remainingStock: stockTotal > 0 ? Math.max(0, stockTotal - claimedCount) : null,
    weight,
    grantMode: String(source?.grant_mode || "auto").trim() || "auto",
    isFallback: readBooleanSetting(source?.is_fallback, source?.is_default !== false),
    sortOrder: Math.max(0, Number(source?.sort_order || 100)),
    assetRef: String(source?.asset_ref || "").trim(),
    adminContactName: String(source?.admin_contact_name || source?.adminContactName || "").trim(),
    adminContactPhone: String(source?.admin_contact_phone || source?.adminContactPhone || "").trim(),
  };
}

function isRewardAvailableForNow(reward, now, chestDayKey, claimedToday = 0) {
  if (!readBooleanSetting(reward?.active, true)) return false;
  const appliesOn = String(reward?.applies_on || "").trim();
  if (appliesOn && appliesOn !== chestDayKey) return false;
  const activeFrom = parseOptionalDate(reward?.active_from);
  const activeUntil = parseOptionalDate(reward?.active_until);
  if (activeFrom && now < activeFrom) return false;
  if (activeUntil && now > activeUntil) return false;
  const stockTotal = Math.max(0, Number(reward?.stock_total || 0));
  const claimedCount = Math.max(0, Number(reward?.claimed_count || 0));
  if (stockTotal > 0 && claimedCount >= stockTotal) return false;
  const dailyCap = Math.max(0, Number(reward?.daily_cap || 0));
  if (dailyCap > 0 && claimedToday >= dailyCap) return false;
  return true;
}

function pickWeightedReward(rewards = []) {
  const nonFallback = rewards.filter((reward) => !reward.isFallback);
  const source = nonFallback.length > 0 ? nonFallback : rewards;
  const totalWeight = source.reduce((sum, reward) => sum + Math.max(1, Number(reward.weight || 1)), 0);
  let cursor = Math.random() * totalWeight;
  for (const reward of source) {
    cursor -= Math.max(1, Number(reward.weight || 1));
    if (cursor <= 0) return reward;
  }
  return source[0] || rewards[0] || null;
}

async function loadRewardDailyUsageMap(chestDayKey) {
  const result = await pool.query(
    `SELECT reward_config_id, claimed_count
     FROM daily_chest_reward_daily_usage
     WHERE chest_day_key = $1`,
    [String(chestDayKey || "")]
  );
  const map = new Map();
  result.rows.forEach((row) => {
    map.set(String(row.reward_config_id || ""), Math.max(0, Number(row.claimed_count || 0)));
  });
  return map;
}

async function loadRewardPoolForDay(chestDayKey, settings, now = new Date()) {
  const allRewards = await listEntity("DailyChestRewardConfig", "-updated_date");
  const usageMap = await loadRewardDailyUsageMap(chestDayKey);
  const exactRewards = allRewards.filter((entry) => String(entry?.applies_on || "").trim() === chestDayKey);
  const genericRewards = allRewards.filter((entry) => !String(entry?.applies_on || "").trim());
  const source = exactRewards.length > 0 ? exactRewards : genericRewards.length > 0 ? genericRewards : allRewards;
  const available = source
    .filter((entry) => isRewardAvailableForNow(entry, now, chestDayKey, usageMap.get(String(entry.id || "")) || 0))
    .map((entry) => {
      const normalized = normalizeRewardConfig(entry, settings);
      return {
        ...normalized,
        claimedToday: usageMap.get(String(entry.id || "")) || 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  if (available.length > 0) return available;

  return [
    normalizeRewardConfig(
      {
        id: "daily-chest-default",
        title: "Baú Diário",
        subtitle: settings.messageOfDay,
        reward_type: "points_balance",
        reward_amount: 25,
        reward_unit: "saldo",
        rarity: settings.rarityVisual,
        auto_apply: true,
        visual_theme: settings.sceneTheme,
        applies_on: chestDayKey,
        is_default: true,
        active: true,
        weight: 100,
        is_fallback: true,
        daily_cap: 0,
      },
      settings
    ),
  ];
}

function countRewardTypeWinsForDay(openings = [], rewardType) {
  const normalizedTarget = String(rewardType || "").trim().toLowerCase();
  return openings.reduce((sum, entry) => {
    const snapshotType = String(entry?.reward_snapshot?.rewardType || "").trim().toLowerCase();
    return snapshotType === normalizedTarget ? sum + 1 : sum;
  }, 0);
}

function isBalanceLikeRewardType(rewardType) {
  return ["points_balance", "saldo", "bonus", "cash_prize"].includes(String(rewardType || "").trim().toLowerCase());
}

function filterRewardPoolForUserDay(rewardPool = [], openings = [], settings) {
  const maxBalanceWins = Math.max(0, Number(settings?.balanceWinsPerUserDay || 0));
  if (maxBalanceWins <= 0) return rewardPool;

  const balanceWinsToday = openings.reduce((sum, entry) => {
    const snapshotType = String(entry?.reward_snapshot?.rewardType || "").trim().toLowerCase();
    return isBalanceLikeRewardType(snapshotType) ? sum + 1 : sum;
  }, 0);
  if (balanceWinsToday < maxBalanceWins) return rewardPool;

  return rewardPool.filter((reward) => !isBalanceLikeRewardType(reward?.rewardType));
}

function summarizeSlots({ openings = [], baseSlots = 0, bonusSlots = 0, baseUnlocked = false }) {
  const safeOpenings = Array.isArray(openings) ? openings : [];
  const usedBase = safeOpenings.filter((entry) => String(entry?.slot_source || "base") === "base").length;
  const usedBonus = safeOpenings.filter((entry) => String(entry?.slot_source || "base") === "bonus").length;
  const remainingBase = Math.max(0, Number(baseSlots || 0) - usedBase);
  const remainingBonus = Math.max(0, Number(bonusSlots || 0) - usedBonus);
  return {
    base: Math.max(0, Number(baseSlots || 0)),
    bonus: Math.max(0, Number(bonusSlots || 0)),
    total: Math.max(0, Number(baseSlots || 0)) + Math.max(0, Number(bonusSlots || 0)),
    used: safeOpenings.length,
    usedBase,
    usedBonus,
    remainingBase,
    remainingBonus,
    availableBase: baseUnlocked ? remainingBase : 0,
    availableBonus: remainingBonus,
    remaining: (baseUnlocked ? remainingBase : 0) + remainingBonus,
  };
}

async function resolveAccessGate({ userId, settings, windowInfo, scheduleUnlocked }) {
  const required = scheduleUnlocked && Math.max(0, Number(settings.baseDailyChests || 0)) > 0;
  const codeAvailable =
    Boolean(settings.accessCode) && String(settings.accessCodeDayKey || "") === String(windowInfo.chestDayKey || "");

  if (!required) {
    return {
      required: false,
      unlocked: true,
      codeAvailable,
      currentDayKey: windowInfo.chestDayKey,
      groupLink: settings.accessGroupLink || "",
    };
  }

  const unlock = await getDailyChestAccessUnlock(userId, windowInfo.chestDayKey);
  return {
    required: true,
    unlocked: Boolean(unlock),
    codeAvailable,
    unlockedAt: unlock?.unlocked_at || null,
    currentDayKey: windowInfo.chestDayKey,
    groupLink: settings.accessGroupLink || "",
  };
}

function isWithinSchedule(settings, now) {
  if (!settings.enabled) return false;
  const startAt = parseOptionalDate(settings.scheduleStartAt);
  const endAt = parseOptionalDate(settings.scheduleEndAt);
  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;
  return true;
}

async function incrementRewardClaimCount(rewardId) {
  if (!rewardId || rewardId === "daily-chest-default") return;
  const reward = await listEntity("DailyChestRewardConfig").then((items) =>
    items.find((entry) => String(entry.id || "") === String(rewardId))
  );
  if (!reward) return;
  await updateEntity("DailyChestRewardConfig", reward.id, {
    claimed_count: Math.max(0, Number(reward.claimed_count || 0)) + 1,
  });
}

async function incrementRewardDailyUsage(rewardId, chestDayKey) {
  if (!rewardId || rewardId === "daily-chest-default") return;
  await pool.query(
    `INSERT INTO daily_chest_reward_daily_usage (reward_config_id, chest_day_key, claimed_count, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (reward_config_id, chest_day_key)
     DO UPDATE SET
       claimed_count = daily_chest_reward_daily_usage.claimed_count + 1,
       updated_at = NOW()`,
    [String(rewardId), String(chestDayKey || "")]
  );
}

async function listDailyChestOpeningsByUserDayForUpdate(client, userId, chestDayKey) {
  const result = await client.query(
    `SELECT *
     FROM daily_chest_openings
     WHERE user_id = $1 AND chest_day_key = $2
     ORDER BY slot_index DESC, opened_at DESC
     FOR UPDATE`,
    [String(userId || ""), String(chestDayKey || "")]
  );
  return result.rows;
}

async function tryReserveRewardForDay(client, reward, chestDayKey) {
  if (!reward?.id || reward.id === "daily-chest-default") {
    return true;
  }

  await client.query(
    `INSERT INTO daily_chest_reward_daily_usage (reward_config_id, chest_day_key, claimed_count, updated_at)
     VALUES ($1, $2, 0, NOW())
     ON CONFLICT (reward_config_id, chest_day_key) DO NOTHING`,
    [String(reward.id), String(chestDayKey || "")]
  );

  const dailyCap = Math.max(0, Number(reward.dailyCap || 0));
  const reservation =
    dailyCap > 0
      ? await client.query(
          `UPDATE daily_chest_reward_daily_usage
           SET claimed_count = claimed_count + 1,
               updated_at = NOW()
           WHERE reward_config_id = $1
             AND chest_day_key = $2
             AND claimed_count < $3
           RETURNING claimed_count`,
          [String(reward.id), String(chestDayKey || ""), dailyCap]
        )
      : await client.query(
          `UPDATE daily_chest_reward_daily_usage
           SET claimed_count = claimed_count + 1,
               updated_at = NOW()
           WHERE reward_config_id = $1
             AND chest_day_key = $2
           RETURNING claimed_count`,
          [String(reward.id), String(chestDayKey || "")]
        );

  if (reservation.rowCount === 0) {
    return false;
  }

  const lockedReward = await findEntityRecordByNameAndIdForUpdate(client, "DailyChestRewardConfig", reward.id);
  if (lockedReward) {
    const lockedRewardData =
      lockedReward?.data && typeof lockedReward.data === "object"
        ? { ...lockedReward.data }
        : {};
    const nextClaimed = Math.max(0, Number(lockedRewardData.claimed_count || 0)) + 1;
    const merged = {
      ...lockedRewardData,
      claimed_count: nextClaimed,
      updated_date: new Date().toISOString(),
    };
    await client.query(
      `UPDATE entity_records
       SET data = $1::jsonb, updated_at = NOW()
       WHERE entity_name = 'DailyChestRewardConfig' AND id = $2`,
      [JSON.stringify(merged), String(reward.id)]
    );
  }

  return true;
}

async function reserveWeightedRewardForDay(client, rewardPool, chestDayKey) {
  const candidates = [...rewardPool];
  while (candidates.length > 0) {
    const selected = pickWeightedReward(candidates) || candidates[0];
    if (!selected) break;
    const reserved = await tryReserveRewardForDay(client, selected, chestDayKey);
    if (reserved) {
      return selected;
    }
    const selectedId = String(selected.id || "");
    const nextCandidates = candidates.filter((entry) => String(entry.id || "") !== selectedId);
    candidates.splice(0, candidates.length, ...nextCandidates);
  }
  return null;
}

async function reserveRewardFromPool(rewardPool, chestDayKey) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selectedReward = await reserveWeightedRewardForDay(client, rewardPool, chestDayKey);
    if (!selectedReward) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query("COMMIT");
    return selectedReward;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createDailyChestOpeningTx(client, { userId, chestDayKey, slotIndex, slotSource = "base", rewardConfigId, rewardSnapshot, xpAwarded = 0, xpGrantRefId = "" }) {
  const result = await client.query(
    `INSERT INTO daily_chest_openings (
      user_id,
      chest_day_key,
      slot_index,
      slot_source,
      status,
      reward_config_id,
      reward_snapshot,
      xp_awarded,
      xp_grant_ref_id,
      opened_at,
      updated_at
    )
     VALUES ($1, $2, $3, $4, 'opened', $5, $6::jsonb, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      String(userId || ""),
      String(chestDayKey || ""),
      Number(slotIndex || 0),
      String(slotSource || "base"),
      rewardConfigId || null,
      JSON.stringify(rewardSnapshot || {}),
      Math.max(0, Number(xpAwarded || 0)),
      String(xpGrantRefId || ""),
    ]
  );
  return result.rows[0] || null;
}

function buildResponseState({
  settings,
  opening,
  rewardPreview,
  rewardPool = [],
  windowInfo,
  slots,
  isUnlocked,
  accessGate,
  recentInventory = [],
}) {
  let state = "available";
  if (!isUnlocked) state = "locked";
  else if (opening && opening.status !== "claimed" && opening.status !== "claimed_pending") state = "opened";
  else if (slots.remaining <= 0) state = accessGate?.required && !accessGate?.unlocked && slots.remainingBase > 0 ? "locked" : "cooldown";

  return {
    enabled: isUnlocked,
    state,
    chestDayKey: windowInfo.chestDayKey,
    availableAt: windowInfo.availableAt.toISOString(),
    resetAt: windowInfo.resetAt.toISOString(),
    tapGoal: settings.tapGoal,
    messageOfDay: rewardPreview?.messageOfDay || settings.messageOfDay,
    rewardPreview,
    rewardPool,
      opening: opening
        ? {
            id: opening.id,
            slotIndex: opening.slot_index,
            slotSource: opening.slot_source || "base",
            status: opening.status,
            openedAt: opening.opened_at,
          claimedAt: opening.claimed_at,
          rewardSnapshot: opening.reward_snapshot || rewardPreview,
          grantResult: opening.grant_result || {},
          xpAwarded: Number(opening.xp_awarded || 0),
        }
      : null,
    slots,
    inventoryPreview: recentInventory,
    theme: {
      sceneTheme: rewardPreview?.visualTheme || settings.sceneTheme,
      rarityVisual: rewardPreview?.rarity || settings.rarityVisual,
      timezone: settings.timezone,
    },
    schedule: {
      startAt: settings.scheduleStartAt || null,
      endAt: settings.scheduleEndAt || null,
    },
    settingsSnapshot: {
      xpPerOpen: settings.xpPerOpen,
      depositBonusEnabled: settings.depositBonusEnabled,
      baseDailyChests: settings.baseDailyChests,
    },
    accessGate: accessGate || {
      required: false,
      unlocked: true,
      codeAvailable: false,
      currentDayKey: windowInfo.chestDayKey,
      groupLink: settings.accessGroupLink || "",
    },
  };
}

async function resolveChestStateForUser(userId) {
  const settings = await loadDailyChestSettings();
  const windowInfo = getLocalWindow(settings);
  const rewardPool = await loadRewardPoolForDay(windowInfo.chestDayKey, settings, windowInfo.now);
  const openings = await listDailyChestOpeningsByUserDay(userId, windowInfo.chestDayKey);
  const filteredRewardPool = filterRewardPoolForUserDay(rewardPool, openings, settings);
  const rewardPreview = filteredRewardPool[0] || null;
  const activeOpening =
    openings.find((entry) => entry.status === "opened" || entry.status === "claimed_pending") ||
    null;
  const bonusGrants = await listDailyChestBonusGrantsByUserDay(userId, windowInfo.chestDayKey);
  const bonusSlots = bonusGrants.reduce((sum, entry) => sum + Math.max(0, Number(entry.slots_awarded || 0)), 0);
  const scheduleUnlocked = isWithinSchedule(settings, windowInfo.now);
  const accessGate = await resolveAccessGate({ userId, settings, windowInfo, scheduleUnlocked });
  const slotSummary = summarizeSlots({
    openings,
    baseSlots: Math.max(0, Number(settings.baseDailyChests || 0)),
    bonusSlots,
    baseUnlocked: accessGate.unlocked,
  });
  const recentInventory = await listEntity("UserPrizeGalleryItem", "-claimed_at", 50).then((items) =>
    items.filter((entry) => entry.user_id === userId).slice(0, 4)
  );

  return buildResponseState({
    settings,
    opening: activeOpening || openings[0] || null,
    rewardPreview,
    rewardPool: filteredRewardPool,
    windowInfo,
    isUnlocked: scheduleUnlocked,
    accessGate,
    recentInventory,
    slots: { ...slotSummary, grants: bonusGrants },
  });
}

async function awardChestXp({ userId, openingId, chestDayKey, xpAmount }) {
  const safeAmount = Math.max(0, Math.round(Number(xpAmount || 0)));
  if (safeAmount <= 0) return null;
  return createEntity("DailyChestXpGrant", {
    user_id: userId,
    opening_id: openingId,
    chest_day_key: chestDayKey,
    xp_amount: safeAmount,
    source: "daily_chest",
  });
}

async function getActiveWeeklyCycleKey() {
  const result = await pool.query(
    `SELECT cycle_key
       FROM weekly_cycles
      WHERE status = 'active'
      ORDER BY starts_at DESC
      LIMIT 1`
  );
  return String(result.rows[0]?.cycle_key || "").trim();
}

async function applyMetricGrant({ userId, metricKey, amount, requestId, rewardSnapshot, chestDayKey, openingId }) {
  const safeAmount = Math.max(0, Math.round(Number(amount || 0)));
  if (safeAmount <= 0) {
    return {
      applyStatus: "applied",
      target: metricKey,
      requestId,
      metricKey,
      cycleKey: "",
      pointsAwarded: 0,
    };
  }

  const cycleKey = metricKey === "weekly_points" ? await getActiveWeeklyCycleKey() : "";
  if (metricKey === "weekly_points" && !cycleKey) {
    const error = new Error("Nao ha ciclo semanal ativo para aplicar pontos do bau.");
    error.status = 409;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT amount
         FROM user_metric_ledger
        WHERE user_id = $1
          AND metric_key = $2
          AND cycle_key = $3
          AND source_type = 'daily_chest_reward'
          AND source_ref = $4
        LIMIT 1`,
      [userId, metricKey, cycleKey, requestId]
    );

    const currentBalance = await client.query(
      `SELECT amount
         FROM user_metric_balances
        WHERE user_id = $1
          AND metric_key = $2
          AND cycle_key = $3
        FOR UPDATE`,
      [userId, metricKey, cycleKey]
    );

    const beforeValue = Number(currentBalance.rows[0]?.amount || 0);
    const appliedAmount = existing.rows[0] ? Number(existing.rows[0].amount || 0) : safeAmount;

    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO user_metric_ledger (
          user_id, metric_key, cycle_key, amount, source_type, source_ref, occurred_at, metadata, updated_at
        )
         VALUES ($1, $2, $3, $4, 'daily_chest_reward', $5, NOW(), $6::jsonb, NOW())`,
        [
          userId,
          metricKey,
          cycleKey,
          safeAmount,
          requestId,
          JSON.stringify({
            source: "daily_chest",
            exact_event: true,
            source_ref_id: openingId,
            chest_day_key: chestDayKey,
            reward_title: String(rewardSnapshot?.title || "Recompensa do baú").trim() || "Recompensa do baú",
            reward_type: String(rewardSnapshot?.rewardType || metricKey).trim(),
          }),
        ]
      );

      await client.query(
        `INSERT INTO user_metric_balances (user_id, metric_key, cycle_key, amount, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (user_id, metric_key, cycle_key)
         DO UPDATE SET
           amount = user_metric_balances.amount + EXCLUDED.amount,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          userId,
          metricKey,
          cycleKey,
          safeAmount,
          JSON.stringify({
            source: "daily_chest",
            last_opening_id: openingId,
            chest_day_key: chestDayKey,
          }),
        ]
      );
    }

    await client.query("COMMIT");
    return {
      applyStatus: "applied",
      target: metricKey,
      requestId,
      metricKey,
      cycleKey,
      pointsAwarded: appliedAmount,
      finalValue: beforeValue + (existing.rows[0] ? 0 : safeAmount),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function applyChestGrant({ userId, chestDayKey, rewardSnapshot, openingId }) {
  const rewardType = String(rewardSnapshot?.rewardType || "points_balance").trim().toLowerCase();
  const rewardAmount = Number(rewardSnapshot?.rewardAmount || 0);
  const requestId = `daily-chest:${openingId}:${rewardType}:${chestDayKey}`;

  if (rewardType === "points_balance" || rewardType === "saldo" || rewardType === "bonus") {
    const existing = await findPointsLedgerByRequestId(requestId);
    const entry =
      existing ||
      (await createPointsLedgerEntry({
        user_id: userId,
        amount: Math.round(rewardAmount),
        reason: `Baú diário: ${rewardSnapshot?.title || "Recompensa diária"}`,
        request_id: requestId,
        metadata: {
          source: "daily_chest",
          chest_day_key: chestDayKey,
          opening_id: openingId,
          reward_type: rewardType,
        },
      }));
    const balance = await getPointsBalanceByUserId(userId);
    return {
      applyStatus: "applied",
      target: "points_balance",
      requestId,
      balance,
      ledgerEntryId: entry?.id || "",
    };
  }

  if (rewardType === "rank_points" || rewardType === "weekly_rank_points") {
    const bonusEvent = await createEntity("CompetitionPointEvent", {
      user_id: userId,
      source: "daily_chest",
      source_ref_id: openingId,
      chest_day_key: chestDayKey,
      points: Math.max(0, Math.round(rewardAmount)),
      title: rewardSnapshot?.title || "Pontos de ranking",
      status: "applied",
    });
    return {
      applyStatus: "applied",
      target: "competition_rank",
      requestId,
      bonusEventId: bonusEvent?.id || "",
      pointsAwarded: Math.max(0, Math.round(rewardAmount)),
    };
  }

  if (rewardType === "weekly_points") {
    return applyMetricGrant({
      userId,
      metricKey: "weekly_points",
      amount: rewardAmount,
      requestId,
      rewardSnapshot,
      chestDayKey,
      openingId,
    });
  }

  if (rewardType === "engagement_points") {
    return applyMetricGrant({
      userId,
      metricKey: "engagement_points",
      amount: rewardAmount,
      requestId,
      rewardSnapshot,
      chestDayKey,
      openingId,
    });
  }

  if (rewardType === "xp_total" || rewardType === "xp") {
    return applyMetricGrant({
      userId,
      metricKey: "xp_total",
      amount: rewardAmount,
      requestId,
      rewardSnapshot,
      chestDayKey,
      openingId,
    });
  }

  if (["tickets_active", "tickets_bonus", "ticket_bonus", "bilhetes"].includes(rewardType)) {
    const depositTicketGrant = await createDailyChestDepositTicketGrant({
      userId,
      openingId,
      chestDayKey,
      rewardSnapshot,
      ticketsGranted: rewardAmount,
    });
    return {
      applyStatus: "applied",
      target: "deposit_tickets",
      requestId,
      depositId: depositTicketGrant?.id || "",
      pointsAwarded: Math.max(0, Math.round(rewardAmount)),
    };
  }

  const grantEntityByType = {
    ticket_bonus: "DailyChestTicketGrant",
    bilhetes: "DailyChestTicketGrant",
    visual_item: "DailyChestInventoryGrant",
    item_visual: "DailyChestInventoryGrant",
    rare_item: "DailyChestInventoryGrant",
    special: "DailyChestSpecialGrant",
    special_rare: "DailyChestSpecialGrant",
  };

  const grantEntity = grantEntityByType[rewardType] || "DailyChestManualGrant";
  const status = rewardSnapshot?.grantMode === "manual" ? "pending_manual_review" : "applied";
  const grantRecord = await createEntity(grantEntity, {
    user_id: userId,
    chest_day_key: chestDayKey,
    opening_id: openingId,
    reward_snapshot: rewardSnapshot,
    status,
  });

  return {
    applyStatus: status,
    target: grantEntity,
    requestId,
    grantRecordId: grantRecord?.id || "",
  };
}

async function createPrizeGalleryItem({ userId, chestDayKey, opening, grantResult }) {
  const snapshot = opening?.reward_snapshot || {};
  const adminName = String(snapshot?.adminContactName || snapshot?.admin_contact_name || "").trim();
  const adminPhone = String(snapshot?.adminContactPhone || snapshot?.admin_contact_phone || "").trim();
  return createEntity("UserPrizeGalleryItem", {
    user_id: userId,
    source_type: "daily_chest",
    source_ref_id: opening?.id || "",
    chest_day_key: chestDayKey,
    title: snapshot?.title || "Baú Diário",
    subtitle: snapshot?.subtitle || "",
    reward_type: snapshot?.rewardType || "points_balance",
    reward_amount: Number(snapshot?.rewardAmount || 0),
    reward_unit: snapshot?.rewardUnit || "",
    rarity: snapshot?.rarity || "rare",
    visual_theme: snapshot?.visualTheme || "aurora",
    icon: snapshot?.icon || "sparkles",
    special_label: snapshot?.specialLabel || "",
    gallery_image_url: snapshot?.galleryImageUrl || "",
    xp_awarded: Number(opening?.xp_awarded || 0),
    claimed_at: new Date().toISOString(),
    claim_status: grantResult?.applyStatus || "applied",
    metadata: {
      audit_id: grantResult?.auditId || "",
      validation_code: grantResult?.validationCode || opening?.id || "",
      admin_name: adminName,
      admin_phone: adminPhone,
      reward_snapshot: snapshot,
      grant_result: grantResult || {},
    },
  });
}

function shouldCreateAuditForReward(rewardType) {
  const normalized = String(rewardType || "").trim().toLowerCase();
  return ["points_balance", "saldo", "bonus", "cash_prize"].includes(normalized);
}

function resolveAuditPrizeKind(rewardType) {
  const normalized = String(rewardType || "").trim().toLowerCase();
  if (["points_balance", "saldo", "bonus"].includes(normalized)) return "points_balance";
  return "cash_prize";
}

async function createDailyChestAuditRecord({ userId, opening, grantResult, chestDayKey }) {
  const snapshot = opening?.reward_snapshot || {};
  const rewardType = String(snapshot?.rewardType || "").trim().toLowerCase();
  if (!shouldCreateAuditForReward(rewardType)) return null;

  const openingId = String(opening?.id || "").trim();
  if (openingId) {
    const existingAudits = await listEntity("DrawWinnerAudit", "-drawn_at", 1000);
    const existing = existingAudits.find((entry) => String(entry?.opening_id || "").trim() === openingId);
    if (existing) {
      return existing;
    }
  }

  const user = await getEntityById("User", userId);
  const now = new Date().toISOString();
  return createEntity("DrawWinnerAudit", {
    raffle_id: "daily_chest",
    raffle_title: "Baú Diário",
    cycle_number: null,
    user_id: userId,
    user_name: user?.full_name || user?.nick || "Sem nome",
    user_nick: user?.nick || "",
    user_email: user?.email || "",
    user_phone: user?.phone || "",
    user_avatar: user?.avatar_emoji || "",
    user_platform_id: user?.platform_id || "",
    prize_amount: Number(snapshot?.rewardAmount || 0),
    reward_type: resolveAuditPrizeKind(rewardType),
    admin_name: String(snapshot?.adminContactName || snapshot?.admin_contact_name || "").trim(),
    admin_phone: String(snapshot?.adminContactPhone || snapshot?.admin_contact_phone || "").trim(),
    validation_code: String(opening?.id || ""),
    opening_id: String(opening?.id || ""),
    chest_day_key: String(chestDayKey || ""),
    source_type: "daily_chest",
    status: "validated",
    drawn_at: now,
    validated_at: now,
    redemption_status: "pending",
    redemption_notes: "",
    grant_target: grantResult?.target || "",
  });
}

router.get("/state", requireAuth, async (req, res) => {
  const state = await resolveChestStateForUser(req.auth.sub);
  res.json(state);
});

router.post("/unlock", requireAuth, async (req, res) => {
  const settings = await loadDailyChestSettings();
  const windowInfo = getLocalWindow(settings);
  const scheduleUnlocked = isWithinSchedule(settings, windowInfo.now);
  if (!scheduleUnlocked) {
    return res.status(409).json({ error: "Bau diario indisponivel neste periodo." });
  }

  if (Math.max(0, Number(settings.baseDailyChests || 0)) <= 0) {
    return res.json(await resolveChestStateForUser(req.auth.sub));
  }

  const expectedCode = normalizeAccessCode(settings.accessCode);
  const submittedCode = normalizeAccessCode(req.body?.code);
  if (!expectedCode || String(settings.accessCodeDayKey || "") !== String(windowInfo.chestDayKey || "")) {
    return res.status(409).json({ error: "A chave diaria ainda nao foi gerada no painel." });
  }

  if (!submittedCode || submittedCode !== expectedCode) {
    return res.status(400).json({ error: "Codigo invalido. Confira a chave publicada na comunidade." });
  }

  await upsertDailyChestAccessUnlock({
    userId: req.auth.sub,
    chestDayKey: windowInfo.chestDayKey,
    codeValue: submittedCode,
  });

  return res.json(await resolveChestStateForUser(req.auth.sub));
});

router.post("/open", requireAuth, async (req, res) => {
  const settings = await loadDailyChestSettings();
  const windowInfo = getLocalWindow(settings);
  const rewardPool = await loadRewardPoolForDay(windowInfo.chestDayKey, settings, windowInfo.now);
  const openings = await listDailyChestOpeningsByUserDay(req.auth.sub, windowInfo.chestDayKey);
  const filteredRewardPool = filterRewardPoolForUserDay(rewardPool, openings, settings);
  const activeOpening =
    openings.find((entry) => entry.status === "opened" || entry.status === "claimed_pending") || null;
  const bonusGrants = await listDailyChestBonusGrantsByUserDay(req.auth.sub, windowInfo.chestDayKey);
  const bonusSlots = bonusGrants.reduce((sum, entry) => sum + Math.max(0, Number(entry.slots_awarded || 0)), 0);
  const unlocked = isWithinSchedule(settings, windowInfo.now);
  const accessGate = await resolveAccessGate({
    userId: req.auth.sub,
    settings,
    windowInfo,
    scheduleUnlocked: unlocked,
  });
  const slotSummary = summarizeSlots({
    openings,
    baseSlots: Math.max(0, Number(settings.baseDailyChests || 0)),
    bonusSlots,
    baseUnlocked: accessGate.unlocked,
  });
  const requestedSlotType = String(req.body?.slotType || "").trim().toLowerCase();
  const slotType =
    requestedSlotType === "bonus" || requestedSlotType === "base"
      ? requestedSlotType
      : slotSummary.availableBase > 0
      ? "base"
      : "bonus";

  if (!unlocked) {
    return res.status(409).json({ error: "Bau diario indisponivel neste periodo." });
  }

  if (activeOpening) {
    return res.json(
      buildResponseState({
        settings,
        opening: activeOpening,
        rewardPreview: activeOpening.reward_snapshot || filteredRewardPool[0] || null,
        rewardPool: filteredRewardPool,
        windowInfo,
        isUnlocked: true,
        accessGate,
        recentInventory: [],
        slots: { ...slotSummary, grants: bonusGrants },
      })
    );
  }

  if (slotType === "base" && !accessGate.unlocked) {
    return res.status(409).json({ error: "Liberacao diaria pendente. Informe o codigo para liberar o bau do dia." });
  }

  if (slotType === "base" && slotSummary.availableBase <= 0) {
    return res.status(409).json({ error: "Voce ja usou o Bau Diario liberado para hoje." });
  }

  if (slotType === "bonus" && slotSummary.availableBonus <= 0) {
    return res.status(409).json({ error: "Voce nao tem giros extras disponíveis agora." });
  }

  if (filteredRewardPool.length <= 0) {
    return res.status(409).json({ error: "Voce ja atingiu o limite de bancas permitido para hoje." });
  }

  const selectedReward = await reserveRewardFromPool(filteredRewardPool, windowInfo.chestDayKey);
  if (!selectedReward) {
    return res.status(409).json({ error: "Nao ha premios disponíveis para este ciclo no momento." });
  }

  const opening = await createDailyChestOpening({
    userId: req.auth.sub,
    chestDayKey: windowInfo.chestDayKey,
    slotIndex: openings.length + 1,
    slotSource: slotType,
    rewardConfigId: selectedReward?.id || "",
    rewardSnapshot: selectedReward || {},
    xpAwarded: settings.xpPerOpen,
    xpGrantRefId: "",
  });

  const xpGrant = await awardChestXp({
    userId: req.auth.sub,
    openingId: opening.id,
    chestDayKey: windowInfo.chestDayKey,
    xpAmount: settings.xpPerOpen,
  });

  const hydratedOpening = {
    ...opening,
    xp_grant_ref_id: xpGrant?.id || "",
  };

  res.status(201).json(
    buildResponseState({
      settings,
      opening: hydratedOpening,
      rewardPreview: selectedReward,
      rewardPool: filteredRewardPool,
      windowInfo,
      isUnlocked: true,
      accessGate,
      recentInventory: [],
      slots: {
        ...summarizeSlots({
          openings: [...openings, hydratedOpening],
          baseSlots: Math.max(0, Number(settings.baseDailyChests || 0)),
          bonusSlots,
          baseUnlocked: accessGate.unlocked,
        }),
        grants: bonusGrants,
      },
    })
  );
});

router.post("/claim", requireAuth, async (req, res) => {
  const settings = await loadDailyChestSettings();
  const windowInfo = getLocalWindow(settings);
  const openings = await listDailyChestOpeningsByUserDay(req.auth.sub, windowInfo.chestDayKey);
  const opening =
    openings.find((entry) => entry.status === "opened" || entry.status === "claimed_pending") ||
    (await findLatestDailyChestOpeningByUserDay(req.auth.sub, windowInfo.chestDayKey));

  if (!opening) {
    return res.status(409).json({ error: "Abra o baú antes de resgatar o prêmio." });
  }

  if (opening.status === "claimed") {
    const state = await resolveChestStateForUser(req.auth.sub);
    return res.json(state);
  }

  const grantResult = await applyChestGrant({
    userId: req.auth.sub,
    chestDayKey: windowInfo.chestDayKey,
    rewardSnapshot: opening.reward_snapshot,
    openingId: opening.id,
  });
  const auditRecord = await createDailyChestAuditRecord({
    userId: req.auth.sub,
    opening,
    grantResult,
    chestDayKey: windowInfo.chestDayKey,
  });
  const enrichedGrantResult = {
    ...grantResult,
    auditId: auditRecord?.id || "",
    validationCode: String(opening.id || ""),
  };
  const nextStatus = grantResult.applyStatus === "applied" ? "claimed" : "claimed_pending";
  const updatedOpening = await markDailyChestOpeningClaimed({
    openingId: opening.id,
    grantResult: enrichedGrantResult,
    status: nextStatus,
  });

  await createPrizeGalleryItem({
    userId: req.auth.sub,
    chestDayKey: windowInfo.chestDayKey,
    opening: updatedOpening,
    grantResult: enrichedGrantResult,
  });

  const state = await resolveChestStateForUser(req.auth.sub);
  return res.json({
    ...state,
    opening: {
      id: updatedOpening.id,
      slotIndex: updatedOpening.slot_index,
      slotSource: updatedOpening.slot_source || "base",
      status: updatedOpening.status,
      openedAt: updatedOpening.opened_at,
      claimedAt: updatedOpening.claimed_at,
      rewardSnapshot: updatedOpening.reward_snapshot || state.rewardPreview,
      grantResult: updatedOpening.grant_result || {},
      xpAwarded: Number(updatedOpening.xp_awarded || 0),
    },
  });
});

router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  const settings = await loadDailyChestSettings();
  const rewards = await listEntity("DailyChestRewardConfig", "-updated_date", 50);
  const recentInventory = await listEntity("UserPrizeGalleryItem", "-claimed_at", 12);
  const recentXpGrants = await listEntity("DailyChestXpGrant", "-created_date", 12);
  const recentRankBonus = await listEntity("CompetitionPointEvent", "-created_date", 12);
  return res.json({ settings, rewards, recentInventory, recentXpGrants, recentRankBonus });
});

export default router;
