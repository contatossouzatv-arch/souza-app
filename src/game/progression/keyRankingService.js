import { KEY_PROGRESSION_SEASON } from "@/game/progression/keyProgressionConfig";

export function buildKeyRankingSnapshot({ playerId, playerName, totalKeys }) {
  const safeTotalKeys = Math.max(0, Math.round(Number(totalKeys) || 0));
  const safePlayerId = String(playerId || "guest");
  const safePlayerName = String(playerName || "Jogador").trim() || "Jogador";
  const rankingEntries = [
    ...KEY_PROGRESSION_SEASON.mockRanking.map((entry) => ({
      ...entry,
      isPlayer: false,
    })),
    {
      id: `player:${safePlayerId}`,
      name: safePlayerName,
      keys: safeTotalKeys,
      isPlayer: true,
    },
  ].sort((left, right) => {
    const keyDiff = Number(right?.keys || 0) - Number(left?.keys || 0);
    if (keyDiff !== 0) return keyDiff;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });

  const ranking = rankingEntries.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));
  const playerEntry = ranking.find((entry) => entry.isPlayer) || {
    id: `player:${safePlayerId}`,
    name: safePlayerName,
    keys: safeTotalKeys,
    isPlayer: true,
    position: ranking.length + 1,
  };
  const nextRewardTier =
    KEY_PROGRESSION_SEASON.rewardTiers.find((tier) => safeTotalKeys < Number(tier.minKeys || 0)) || null;

  return {
    seasonId: KEY_PROGRESSION_SEASON.seasonId,
    seasonLabel: KEY_PROGRESSION_SEASON.seasonLabel,
    totalKeys: safeTotalKeys,
    playerEntry,
    topRanking: ranking.slice(0, 8),
    nextRewardTier,
    rewardTiers: KEY_PROGRESSION_SEASON.rewardTiers,
  };
}
