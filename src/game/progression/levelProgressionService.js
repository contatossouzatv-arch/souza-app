import { PLAYER_CHARACTER_DEFINITIONS } from "@/game/progression/playerInventoryConfig";
import { PLAYER_LEVEL_THRESHOLDS, PLAYER_RUN_XP_CONFIG } from "@/game/progression/levelProgressionConfig";

function getSortedThresholds() {
  return [...PLAYER_LEVEL_THRESHOLDS].sort((a, b) => Number(a.level || 0) - Number(b.level || 0));
}

export function resolveLevelProgressSnapshot(xpTotal = 0) {
  const totalXp = Math.max(0, Number(xpTotal) || 0);
  const thresholds = getSortedThresholds();

  let currentLevelEntry = thresholds[0] || { level: 1, xpRequired: 0 };
  for (const entry of thresholds) {
    if (totalXp >= Math.max(0, Number(entry.xpRequired) || 0)) {
      currentLevelEntry = entry;
    } else {
      break;
    }
  }

  const nextLevelEntry = thresholds.find((entry) => Number(entry.level || 0) > Number(currentLevelEntry.level || 1)) || null;
  const currentLevel = Math.max(1, Number(currentLevelEntry.level) || 1);
  const levelXpFloor = Math.max(0, Number(currentLevelEntry.xpRequired) || 0);
  const nextLevelXp = nextLevelEntry ? Math.max(levelXpFloor, Number(nextLevelEntry.xpRequired) || levelXpFloor) : levelXpFloor;
  const xpIntoLevel = Math.max(0, totalXp - levelXpFloor);
  const xpForNextLevel = nextLevelEntry ? Math.max(1, nextLevelXp - levelXpFloor) : 0;
  const xpRemainingToNextLevel = nextLevelEntry ? Math.max(0, nextLevelXp - totalXp) : 0;
  const progressRatio = nextLevelEntry ? Math.max(0, Math.min(1, xpIntoLevel / xpForNextLevel)) : 1;

  return {
    xpTotal: totalXp,
    currentLevel,
    levelXpFloor,
    nextLevel: nextLevelEntry ? Math.max(currentLevel + 1, Number(nextLevelEntry.level) || currentLevel + 1) : null,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemainingToNextLevel,
    progressRatio,
  };
}

export function resolveRunXpReward({ score = 0, completed = true, isNewBest = false } = {}) {
  const normalizedScore = Math.max(0, Number(score) || 0);
  const scoreXp = Math.floor(normalizedScore / Math.max(1, Number(PLAYER_RUN_XP_CONFIG.scoreDivisor) || 1));
  const completionXp = completed ? Math.max(0, Number(PLAYER_RUN_XP_CONFIG.completionXp) || 0) : 0;
  const newBestBonusXp = isNewBest ? Math.max(0, Number(PLAYER_RUN_XP_CONFIG.newBestBonusXp) || 0) : 0;
  const totalXp = Math.max(
    Math.max(0, Number(PLAYER_RUN_XP_CONFIG.minimumRunXp) || 0),
    completionXp + scoreXp + newBestBonusXp
  );

  return {
    totalXp,
    breakdown: {
      completionXp,
      scoreXp,
      newBestBonusXp,
    },
  };
}

export function resolveNextCharacterUnlock(currentLevel = 1) {
  const level = Math.max(1, Number(currentLevel) || 1);
  return (
    Object.values(PLAYER_CHARACTER_DEFINITIONS)
      .filter((character) => !character.unlockedByDefault && Math.max(1, Number(character.unlockLevel) || 1) > level)
      .sort((a, b) => Math.max(1, Number(a.unlockLevel) || 1) - Math.max(1, Number(b.unlockLevel) || 1))[0] || null
  );
}
