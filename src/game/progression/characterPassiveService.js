import { PLAYER_CHARACTER_DEFINITIONS, getDefaultSelectedCharacterId } from "@/game/progression/playerInventoryConfig";

const DEFAULT_CHARACTER_PASSIVE_MODIFIERS = Object.freeze({
  rewardCoinMultiplier: 1,
  rewardKeyFlatBonus: 0,
  rewardDiamondScoreBonus: 0,
  rewardDiamondChestChanceBonus: 0,
  scoreMultiplier: 1,
  startingShieldCharges: 0,
});

function getResolvedCharacterDefinition(characterId) {
  const resolvedId = String(characterId || "").trim() || getDefaultSelectedCharacterId();
  return (
    PLAYER_CHARACTER_DEFINITIONS[resolvedId] ||
    PLAYER_CHARACTER_DEFINITIONS[getDefaultSelectedCharacterId()] ||
    null
  );
}

export function getCharacterPassiveModifiers(characterId) {
  const definition = getResolvedCharacterDefinition(characterId);
  return {
    characterId: definition?.id || getDefaultSelectedCharacterId(),
    ...DEFAULT_CHARACTER_PASSIVE_MODIFIERS,
    ...(definition?.passiveEffect || {}),
  };
}

export function createRunnerCharacterPassiveState(characterId) {
  const modifiers = getCharacterPassiveModifiers(characterId);
  const activePowerUps = {};

  if (modifiers.startingShieldCharges > 0) {
    activePowerUps.shield = {
      id: "shield",
      kind: "character_passive",
      effectDefinition: { type: "shield", source: "character_passive" },
      remainingMs: 24 * 60 * 60 * 1000,
      stackBehavior: "refresh",
      charges: Math.max(0, Number(modifiers.startingShieldCharges) || 0),
    };
  }

  return {
    modifiers,
    activePowerUps,
  };
}

export function getRunnerCharacterScoreMultiplier(runner) {
  return Math.max(1, Number(runner?.characterPassiveModifiers?.scoreMultiplier || 1));
}

export function getCharacterRewardContext({ score = 0, chestChance = 0, selectedCharacterId } = {}) {
  const modifiers = getCharacterPassiveModifiers(selectedCharacterId);
  const baseScore = Math.max(0, Number(score) || 0);
  const baseChestChance = Math.max(0, Number(chestChance) || 0);
  return {
    modifiers,
    baseScore,
    baseChestChance,
    effectiveDiamondScore: baseScore + Math.max(0, Number(modifiers.rewardDiamondScoreBonus) || 0),
    effectiveDiamondChestChance: baseChestChance + Math.max(0, Number(modifiers.rewardDiamondChestChanceBonus) || 0),
  };
}

export function applyCharacterPassiveToRunReward(runReward, selectedCharacterId) {
  const modifiers = getCharacterPassiveModifiers(selectedCharacterId);
  return {
    ...runReward,
    coins: Math.max(0, Math.round(Number(runReward?.coins || 0) * Math.max(1, Number(modifiers.rewardCoinMultiplier) || 1))),
    keys: Math.max(0, Math.round(Number(runReward?.keys || 0) + Math.max(0, Number(modifiers.rewardKeyFlatBonus) || 0))),
  };
}

export function applyCharacterPassiveToChestReward(chestReward, selectedCharacterId) {
  const modifiers = getCharacterPassiveModifiers(selectedCharacterId);
  return {
    ...chestReward,
    coins: Math.max(
      0,
      Math.round(Number(chestReward?.coins || 0) * Math.max(1, Number(modifiers.rewardCoinMultiplier) || 1))
    ),
  };
}
