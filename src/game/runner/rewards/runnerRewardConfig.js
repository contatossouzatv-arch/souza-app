export const RUNNER_RESULT_REWARD_CONFIG = {
  run: {
    minCoins: 12,
    scoreToCoinsMultiplier: 1,
    baseKeysPerRun: 1,
    bonusKeysByScore: [
      { score: 45, keys: 1 },
      { score: 95, keys: 1 },
    ],
    bonusKeysNewBest: 1,
    bonusDiamondsByScore: [
      { score: 150, diamonds: 1 },
      { score: 230, diamonds: 2 },
    ],
  },
  chest: {
    type: "common",
    title: "Baú comum",
    subtitle: "Recompensa base liberada no fim da corrida.",
    coinsBase: 18,
    coinsByScoreMultiplier: 0.22,
    coinsByChestChanceMultiplier: 0.35,
    diamondsByChestChance: [
      { chestChance: 72, diamonds: 1 },
      { chestChance: 90, diamonds: 2 },
    ],
    keysBase: 0,
  },
};
