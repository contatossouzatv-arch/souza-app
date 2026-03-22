import {
  RUNNER_DEFAULT_LOADOUT,
  RUNNER_PERK_TUNING,
  RUNNER_POWER_UP_TUNING,
  RUNNER_SPAWN_WEIGHTS,
} from "@/game/runner/core/RunnerConstants";

const DEFAULT_ISLANDS = [];

export const OBSTACLE_DEFINITIONS = {
  obstacle_basic: {
    id: "obstacle_basic",
    kind: "obstacle",
    laneOccupation: { offsets: [0] },
    widthType: "single",
    heightType: "basic",
    requiredAction: "basic",
    collisionDepth: 1,
    rewardOnAvoid: null,
    penaltyOnHit: { type: "collision" },
    visualType: "crate",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.obstacles.obstacle_basic,
    spawnEnabled: true,
    allowedInPhases: ["runner"],
    allowedInIslands: DEFAULT_ISLANDS,
  },
  obstacle_low: {
    id: "obstacle_low",
    kind: "obstacle",
    laneOccupation: { offsets: [0] },
    widthType: "single",
    heightType: "low",
    requiredAction: "jump",
    collisionDepth: 1,
    rewardOnAvoid: null,
    penaltyOnHit: { type: "collision" },
    visualType: "crate",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.obstacles.obstacle_low,
    spawnEnabled: true,
    allowedInPhases: ["runner"],
    allowedInIslands: DEFAULT_ISLANDS,
  },
  obstacle_high: {
    id: "obstacle_high",
    kind: "obstacle",
    laneOccupation: { offsets: [0] },
    widthType: "single",
    heightType: "high",
    requiredAction: "slide",
    collisionDepth: 1,
    rewardOnAvoid: null,
    penaltyOnHit: { type: "collision" },
    visualType: "crate",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.obstacles.obstacle_high,
    spawnEnabled: true,
    allowedInPhases: ["runner"],
    allowedInIslands: DEFAULT_ISLANDS,
  },
  obstacle_wide: {
    id: "obstacle_wide",
    kind: "obstacle",
    laneOccupation: { offsets: [0, 1] },
    widthType: "double",
    heightType: "basic",
    requiredAction: "lane-change",
    collisionDepth: 1.08,
    rewardOnAvoid: null,
    penaltyOnHit: { type: "collision" },
    visualType: "crate",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.obstacles.obstacle_wide,
    spawnEnabled: true,
    allowedInPhases: ["runner"],
    allowedInIslands: DEFAULT_ISLANDS,
  },
};

export const COLLECTIBLE_DEFINITIONS = {
  coin: {
    id: "coin",
    kind: "collectible",
    value: 1,
    rarity: "common",
    laneOccupation: { offsets: [0] },
    spawnWeight: RUNNER_SPAWN_WEIGHTS.collectibles.coin,
    spawnEnabled: true,
    effectOnCollect: { type: "score", score: 1, chestMode: "config" },
    visualType: "block",
  },
  diamond: {
    id: "diamond",
    kind: "collectible",
    value: 3,
    rarity: "rare",
    laneOccupation: { offsets: [0] },
    spawnWeight: RUNNER_SPAWN_WEIGHTS.collectibles.diamond,
    spawnEnabled: true,
    effectOnCollect: { type: "score", score: 3, chestMode: "config_multiplier", chestMultiplier: 2 },
    visualType: "block",
  },
};

export const POWER_UP_DEFINITIONS = {
  money_multiplier: {
    id: "money_multiplier",
    kind: "powerUp",
    durationMs: RUNNER_POWER_UP_TUNING.moneyMultiplierDurationMs,
    stackBehavior: "refresh",
    visualType: "power-box",
    effectDefinition: { type: "money_multiplier", scoreMultiplier: RUNNER_POWER_UP_TUNING.moneyMultiplierScore, blockBurst: true },
    rarity: "uncommon",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.powerUps.money_multiplier,
    spawnEnabled: true,
  },
  shield: {
    id: "shield",
    kind: "powerUp",
    durationMs: RUNNER_POWER_UP_TUNING.shieldDurationMs,
    stackBehavior: "refresh",
    visualType: "power-box",
    effectDefinition: { type: "shield", maxHits: 1 },
    rarity: "rare",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.powerUps.shield,
    spawnEnabled: true,
  },
  slow_motion: {
    id: "slow_motion",
    kind: "powerUp",
    durationMs: RUNNER_POWER_UP_TUNING.slowMotionDurationMs,
    stackBehavior: "refresh",
    visualType: "power-box",
    effectDefinition: { type: "slow_motion", speedMultiplier: RUNNER_POWER_UP_TUNING.slowMotionSpeedMultiplier },
    rarity: "rare",
    spawnWeight: RUNNER_SPAWN_WEIGHTS.powerUps.slow_motion,
    spawnEnabled: true,
  },
};

export const PERK_DEFINITIONS = {
  coins_plus_10: {
    id: "coins_plus_10",
    kind: "perk",
    name: "+10% moedas",
    description: "Aumenta o ganho total de moedas durante a run.",
    badge: "Economia",
    tone: "from-amber-200 via-yellow-400 to-orange-500",
    effectDefinition: { type: "coin_bonus", coinMultiplier: RUNNER_PERK_TUNING.coinsPlus10Multiplier },
  },
  diamond_luck: {
    id: "diamond_luck",
    kind: "perk",
    name: "Sorte de diamond",
    description: "Aumenta a chance de diamantes aparecerem na pista.",
    badge: "Drop",
    tone: "from-cyan-300 via-sky-400 to-blue-500",
    effectDefinition: { type: "diamond_chance", weightMultiplier: RUNNER_PERK_TUNING.diamondLuckWeightMultiplier },
  },
  power_up_duration_plus: {
    id: "power_up_duration_plus",
    kind: "perk",
    name: "Power-up longo",
    description: "Estende a duracao dos power-ups coletados na run.",
    badge: "Suporte",
    tone: "from-fuchsia-300 via-pink-500 to-rose-500",
    effectDefinition: { type: "power_up_duration", durationMultiplier: RUNNER_PERK_TUNING.powerUpDurationMultiplier },
  },
};

function definitionAllowedInIsland(definition, islandId) {
  const allowed = Array.isArray(definition?.allowedInIslands) ? definition.allowedInIslands : [];
  if (!allowed.length) return true;
  return allowed.includes(islandId);
}

function pickWeightedDefinition(definitions) {
  const pool = definitions.filter((definition) => Number(definition?.spawnWeight || 0) > 0);
  if (!pool.length) return null;
  const totalWeight = pool.reduce((sum, definition) => sum + Number(definition.spawnWeight || 0), 0);
  let cursor = Math.random() * totalWeight;
  for (const definition of pool) {
    cursor -= Number(definition.spawnWeight || 0);
    if (cursor <= 0) return definition;
  }
  return pool[pool.length - 1] || null;
}

export function getObstacleDefinition(definitionId) {
  return OBSTACLE_DEFINITIONS[definitionId] || OBSTACLE_DEFINITIONS.obstacle_basic;
}

export function getCollectibleDefinition(definitionId) {
  return COLLECTIBLE_DEFINITIONS[definitionId] || COLLECTIBLE_DEFINITIONS.coin;
}

export function getPowerUpDefinition(definitionId) {
  return POWER_UP_DEFINITIONS[definitionId] || POWER_UP_DEFINITIONS.money_multiplier;
}

export function getDefaultEquippedPerkIds() {
  return [...(RUNNER_DEFAULT_LOADOUT.perkIds || [])];
}

export function pickSpawnableObstacleDefinition({ islandId } = {}) {
  return (
    pickWeightedDefinition(
      Object.values(OBSTACLE_DEFINITIONS).filter(
        (definition) => definition.spawnEnabled !== false && definitionAllowedInIsland(definition, islandId)
      )
    ) || OBSTACLE_DEFINITIONS.obstacle_basic
  );
}

export function pickSpawnableCollectibleDefinition({ weightMultipliersById = {} } = {}) {
  return (
    pickWeightedDefinition(
      Object.values(COLLECTIBLE_DEFINITIONS)
        .filter((definition) => definition.spawnEnabled !== false)
        .map((definition) => ({
          ...definition,
          spawnWeight: Number(definition.spawnWeight || 0) * Number(weightMultipliersById?.[definition.id] || 1),
        }))
    ) ||
    COLLECTIBLE_DEFINITIONS.coin
  );
}

export function pickSpawnablePowerUpDefinition() {
  return (
    pickWeightedDefinition(Object.values(POWER_UP_DEFINITIONS).filter((definition) => definition.spawnEnabled !== false)) ||
    POWER_UP_DEFINITIONS.money_multiplier
  );
}

export function createObstacleEntity(definition, overrides = {}) {
  return {
    definitionId: definition.id,
    kind: definition.visualType,
    visualType: definition.visualType,
    laneOccupation: definition.laneOccupation,
    widthType: definition.widthType,
    heightType: definition.heightType,
    requiredAction: definition.requiredAction,
    collisionDepth: definition.collisionDepth,
    rewardOnAvoid: definition.rewardOnAvoid,
    penaltyOnHit: definition.penaltyOnHit,
    ...overrides,
  };
}

export function createCollectibleEntity(definition, overrides = {}) {
  return {
    definitionId: definition.id,
    kind: definition.visualType,
    laneOccupation: definition.laneOccupation,
    value: definition.value,
    rarity: definition.rarity,
    effectOnCollect: definition.effectOnCollect,
    visualType: definition.visualType,
    ...overrides,
  };
}

export function createPowerUpEntity(definition, overrides = {}) {
  return {
    definitionId: definition.id,
    kind: definition.visualType,
    durationMs: definition.durationMs,
    stackBehavior: definition.stackBehavior,
    effectDefinition: definition.effectDefinition,
    rarity: definition.rarity,
    visualType: definition.visualType,
    ...overrides,
  };
}
