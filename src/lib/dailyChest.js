export const DAILY_CHEST_RARITY_META = {
  common: {
    label: "Comum",
    accent: "from-slate-200 via-slate-100 to-white",
    glow: "rgba(226,232,240,0.32)",
  },
  rare: {
    label: "Raro",
    accent: "from-cyan-200 via-sky-200 to-blue-200",
    glow: "rgba(34,211,238,0.34)",
  },
  epic: {
    label: "Épico",
    accent: "from-fuchsia-200 via-violet-200 to-cyan-200",
    glow: "rgba(168,85,247,0.34)",
  },
  legendary: {
    label: "Lendário",
    accent: "from-amber-200 via-yellow-200 to-orange-200",
    glow: "rgba(251,191,36,0.36)",
  },
};

export function getDailyChestRarityMeta(rarity) {
  const key = String(rarity || "rare").trim().toLowerCase();
  return DAILY_CHEST_RARITY_META[key] || DAILY_CHEST_RARITY_META.rare;
}

export function formatDailyChestPrize(reward) {
  const rewardAmount = Number(reward?.rewardAmount ?? reward?.reward_amount ?? 0);
  const rewardType = String(reward?.rewardType || reward?.reward_type || "").trim().toLowerCase();
  const rewardUnit = String(reward?.rewardUnit || reward?.reward_unit || "").trim();

  if (rewardUnit) {
    return `${rewardAmount} ${rewardUnit}`;
  }

  if (rewardType === "points_balance" || rewardType === "saldo" || rewardType === "bonus") {
    return `R$ ${rewardAmount.toFixed(2)}`;
  }

  if (rewardType === "ticket_bonus" || rewardType === "bilhetes") {
    return `${rewardAmount} bilhetes`;
  }

  if (rewardType === "rank_points" || rewardType === "weekly_rank_points") {
    return `${rewardAmount} pts rank`;
  }

  if (rewardType === "visual_item" || rewardType === "item_visual" || rewardType === "rare_item") {
    return reward?.specialLabel || reward?.special_label || "Item visual";
  }

  return reward?.specialLabel || reward?.special_label || `${rewardAmount}`;
}

export function isDailyChestRewardAvailable(reward) {
  if (!reward || reward.active === false) return false;

  const remainingStockRaw =
    reward.remainingStock ??
    reward.remaining_stock ??
    (Number(reward.stockTotal ?? reward.stock_total ?? 0) > 0
      ? Number(reward.stockTotal ?? reward.stock_total ?? 0) - Number(reward.claimedCount ?? reward.claimed_count ?? 0)
      : null);
  const remainingStock = remainingStockRaw === null ? null : Math.max(0, Number(remainingStockRaw || 0));
  if (remainingStock !== null && remainingStock <= 0) return false;

  const dailyCap = Math.max(0, Number(reward.dailyCap ?? reward.daily_cap ?? 0));
  const claimedToday = Math.max(0, Number(reward.claimedToday ?? reward.claimed_today ?? 0));
  if (dailyCap > 0 && claimedToday >= dailyCap) return false;

  return true;
}

export function filterAvailableDailyChestRewards(rewardPool = []) {
  return Array.isArray(rewardPool) ? rewardPool.filter((entry) => isDailyChestRewardAvailable(entry)) : [];
}

export function formatCountdownParts(targetDate) {
  const target = new Date(targetDate);
  const diffMs = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, days, hours, minutes, seconds };
}

export function formatCountdownLabel(targetDate) {
  const { days, hours, minutes, seconds } = formatCountdownParts(targetDate);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
