import { RUNNER_RESULT_REWARD_CONFIG } from "@/game/runner/rewards/runnerRewardConfig";
import {
  applyCharacterPassiveToChestReward,
  getCharacterRewardContext,
} from "@/game/progression/characterPassiveService";

export function resolveRunnerChestReward({ score, chestChance, selectedCharacterId }) {
  const rewardContext = getCharacterRewardContext({ score, chestChance, selectedCharacterId });
  const safeScore = Math.max(0, Math.round(Number(rewardContext.baseScore) || 0));
  const safeChestChance = Math.max(0, Number(rewardContext.effectiveDiamondChestChance) || 0);
  const config = RUNNER_RESULT_REWARD_CONFIG.chest;
  const diamonds = config.diamondsByChestChance.reduce((value, entry) => {
    if (safeChestChance >= Number(entry?.chestChance || 0)) {
      return Math.max(value, Math.max(0, Number(entry?.diamonds || 0)));
    }
    return value;
  }, 0);
  return applyCharacterPassiveToChestReward({
    type: config.type,
    title: config.title,
    subtitle: config.subtitle,
    coins: Math.max(
      0,
      Math.round(
        Number(config.coinsBase || 0) +
          safeScore * Number(config.coinsByScoreMultiplier || 0) +
          safeChestChance * Number(config.coinsByChestChanceMultiplier || 0)
      )
    ),
    diamonds,
    keys: Math.max(0, Number(config.keysBase || 0)),
    rarity: "common",
  }, selectedCharacterId);
}
