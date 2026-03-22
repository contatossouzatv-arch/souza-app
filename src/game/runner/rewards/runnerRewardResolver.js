import { RUNNER_RESULT_REWARD_CONFIG } from "@/game/runner/rewards/runnerRewardConfig";
import { resolveRunnerChestReward } from "@/game/runner/rewards/runnerChestResolver";
import {
  applyCharacterPassiveToRunReward,
  getCharacterRewardContext,
} from "@/game/progression/characterPassiveService";

export function resolveRunnerRunRewards({ score, isNewBest, selectedCharacterId }) {
  const rewardContext = getCharacterRewardContext({ score, selectedCharacterId });
  const safeScore = Math.max(0, Math.round(Number(rewardContext.baseScore) || 0));
  const diamondScore = Math.max(0, Math.round(Number(rewardContext.effectiveDiamondScore) || 0));
  const config = RUNNER_RESULT_REWARD_CONFIG.run;
  const coins = Math.max(config.minCoins, Math.round(safeScore * config.scoreToCoinsMultiplier));
  const scoreBonusKeys = config.bonusKeysByScore.reduce((total, entry) => {
    if (safeScore >= Number(entry?.score || 0)) {
      return total + Math.max(0, Number(entry?.keys || 0));
    }
    return total;
  }, 0);
  const scoreDiamonds = config.bonusDiamondsByScore.reduce((diamonds, entry) => {
    if (diamondScore >= Number(entry?.score || 0)) {
      return Math.max(diamonds, Math.max(0, Number(entry?.diamonds || 0)));
    }
    return diamonds;
  }, 0);
  return applyCharacterPassiveToRunReward({
    coins,
    diamonds: scoreDiamonds,
    keys:
      Math.max(0, Number(config.baseKeysPerRun || 0)) +
      scoreBonusKeys +
      (isNewBest ? Number(config.bonusKeysNewBest || 0) : 0),
  }, selectedCharacterId);
}

export function resolveRunnerResultRewards({ score, chestChance, isNewBest, selectedCharacterId }) {
  const run = resolveRunnerRunRewards({ score, isNewBest, selectedCharacterId });
  const chest = resolveRunnerChestReward({ score, chestChance, selectedCharacterId });
  return {
    run,
    chest,
    total: {
      coins: run.coins + chest.coins,
      diamonds: run.diamonds + chest.diamonds,
      keys: run.keys + chest.keys,
    },
  };
}
