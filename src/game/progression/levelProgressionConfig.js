export const PLAYER_LEVEL_THRESHOLDS = Object.freeze([
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 120 },
  { level: 3, xpRequired: 280 },
  { level: 4, xpRequired: 470 },
  { level: 5, xpRequired: 690 },
  { level: 6, xpRequired: 940 },
  { level: 7, xpRequired: 1220 },
  { level: 8, xpRequired: 1530 },
  { level: 9, xpRequired: 1870 },
  { level: 10, xpRequired: 2240 },
]);

export const PLAYER_RUN_XP_CONFIG = Object.freeze({
  completionXp: 24,
  scoreDivisor: 5,
  newBestBonusXp: 16,
  minimumRunXp: 18,
});
