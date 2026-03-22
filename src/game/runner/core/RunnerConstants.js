export const LANES = [-1, 0, 1];
export const RUNNER_WORLD_FLOW_SCALE = 17;
export const RUNNER_VIEW_Z_SCALE = 17;
export const RUNNER_VIEW_PLAYER_Z = -2.15;
export const RUNNER_VIEW_OBSTACLE_Z_OFFSET = 1.3;
export const RUNNER_COLLISION_Z_TOLERANCE = 0.58;
export const RUNNER_COLLISION_LANE_TOLERANCE = 0.42;
export const RUNNER_JUMP_DURATION = 0.86;
export const RUNNER_SLIDE_DURATION = 0.72;
export const RUNNER_MONEY_RAIN_DURATION_MS = 15000;
export const RUNNER_MONEY_RAIN_SCORE_MULTIPLIER = 2;
export const RUNNER_OBSTACLE_SPAWN_MIN_MS = 1600;
export const RUNNER_OBSTACLE_SPAWN_MAX_MS = 2600;
export const RUNNER_POWER_BOX_SPAWN_MIN_MS = 6200;
export const RUNNER_POWER_BOX_SPAWN_MAX_MS = 9800;
export const UI_SNAPSHOT_INTERVAL_MS = 80;

export const RUNNER_ELEVATED_SEGMENT_TUNING = {
  autoSpawnEnabled: false,
  spawnAheadFlowMin: 112,
  spawnAheadFlowMax: 148,
  gapAfterSegmentMin: 150,
  gapAfterSegmentMax: 228,
  trackHeightLerp: 10.5,
  bonusCollectibleTrailChance: 0.74,
  bonusCollectibleTrailMax: 3,
  obstacleGroundOnly: true,
};

export const RUNNER_PIT_GAP_TUNING = {
  minJumpHeight: 0.38,
  collisionPadding: 0.18,
  previewRangeBehind: 40,
  previewRangeAhead: 220,
};

export const RUNNER_COLLISION_TUNING = {
  obstacleLowMinJump: 0.42,
  obstacleHighMinSlide: 0.16,
  baseDepthWindowMultiplier: 1,
  wideDepthWindowMultiplier: 0.94,
  maxDepthWindowScale: 0.9,
  laneToleranceSpeedBonusCap: 0.08,
};

export const RUNNER_SPAWN_WEIGHTS = {
  obstacles: {
    obstacle_basic: 1,
    obstacle_low: 0.09,
    obstacle_high: 0.08,
    obstacle_wide: 0.05,
  },
  collectibles: {
    coin: 1,
    diamond: 0.05,
  },
  powerUps: {
    money_multiplier: 0.9,
    shield: 0.5,
    slow_motion: 0.4,
  },
};

export const RUNNER_POWER_UP_TUNING = {
  moneyMultiplierDurationMs: 10000,
  moneyMultiplierScore: 2.5,
  shieldDurationMs: 9000,
  slowMotionDurationMs: 4500,
  slowMotionSpeedMultiplier: 0.78,
};

export const RUNNER_PERK_TUNING = {
  coinsPlus10Multiplier: 1.1,
  diamondLuckWeightMultiplier: 1.55,
  powerUpDurationMultiplier: 1.18,
};

export const RUNNER_PERK_LOADOUT_LIMIT = 3;

export const RUNNER_DEFAULT_LOADOUT = {
  perkIds: ["coins_plus_10", "diamond_luck", "power_up_duration_plus"],
};
