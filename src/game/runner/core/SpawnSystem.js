import {
  LANES,
  RUNNER_ELEVATED_SEGMENT_TUNING,
  RUNNER_MONEY_RAIN_DURATION_MS,
  RUNNER_OBSTACLE_SPAWN_MAX_MS,
  RUNNER_OBSTACLE_SPAWN_MIN_MS,
  RUNNER_POWER_BOX_SPAWN_MAX_MS,
  RUNNER_POWER_BOX_SPAWN_MIN_MS,
  RUNNER_WORLD_FLOW_SCALE,
} from "@/game/runner/core/RunnerConstants";
import {
  resolveElevatedTrackForDistance,
  spawnRunnerElevatedSegment,
} from "@/game/runner/core/RunnerElevatedSystem";
import {
  activateRunnerPowerUp,
  advanceRunnerPowerUps,
  applyRunnerScoreGain,
  createRunnerPerkModifiers,
  getRunnerCoinMultiplier,
  getRunnerSpeedMultiplier,
} from "@/game/runner/core/RunnerEffectSystem";
import {
  createCollectibleEntity,
  createObstacleEntity,
  createPowerUpEntity,
  getCollectibleDefinition,
  getPowerUpDefinition,
  pickSpawnableCollectibleDefinition,
  pickSpawnableObstacleDefinition,
  pickSpawnablePowerUpDefinition,
} from "@/game/runner/core/RunnerEntityDefinitions";
import { getRunnerCharacterScoreMultiplier } from "@/game/progression/characterPassiveService";

function readOccupiedLanes(lane, laneOccupation) {
  const offsets = Array.isArray(laneOccupation?.offsets) && laneOccupation.offsets.length ? laneOccupation.offsets : [0];
  return Array.from(new Set(offsets.map((offset) => Number(lane || 0) + Number(offset || 0))));
}

function buildTrackContextForDistance(runner, logicalDistance) {
  const trackState = resolveElevatedTrackForDistance(runner, logicalDistance);
  return {
    trackYOffset: Number(trackState?.height || 0),
    trackPhase: String(trackState?.phase || "ground"),
    elevatedSegmentId: String(trackState?.segment?.id || ""),
    elevatedSurface: trackState?.height > 0 ? "high" : "ground",
  };
}

export function advanceRunnerFrame(runner, dt, runnerConfig) {
  advanceRunnerPowerUps(runner, dt);
  if (runner.jumpTimer > 0) runner.jumpTimer = Math.max(0, runner.jumpTimer - dt);
  if (runner.slideTimer > 0) runner.slideTimer = Math.max(0, runner.slideTimer - dt);
  if (runner.collectAnimTimer > 0) runner.collectAnimTimer = Math.max(0, runner.collectAnimTimer - dt);

  runner.powerBreaks = runner.powerBreaks
    .map((entry) => ({ ...entry, life: entry.life - dt * 2.4 }))
    .filter((entry) => entry.life > 0);

  const elapsedSec = runner.elapsedMs / 1000;
  const speedStart = Math.max(1.05, runnerConfig.speed_start);
  const speedCap = Math.max(4.2, runnerConfig.speed_cap);
  const rampSec = Math.max(10, runnerConfig.speed_ramp_ms / 1000);
  const linearAccel = elapsedSec / rampSec;
  const progressiveAccel = 0.32 * Math.pow(elapsedSec / 45, 1.28);
  runner.baseSpeed = Math.min(speedCap, speedStart + linearAccel + progressiveAccel);
  runner.speed = runner.baseSpeed * getRunnerSpeedMultiplier(runner);
  runner.elapsedMs += dt * 1000;
  runner.worldFlow += runner.speed * dt * RUNNER_WORLD_FLOW_SCALE;
  runner.laneVisual += (runner.lane - runner.laneVisual) * Math.min(1, dt * 13);
  runner.laneLean += (0 - runner.laneLean) * Math.min(1, dt * 8.5);
}

export function spawnRunnerEntities(runner, dt, runnerConfig, { selectedIslandId } = {}) {
  spawnRunnerElevatedSegment(runner);

  runner.blockSpawnMs -= dt * 1000;
  if (runner.blockSpawnMs <= 0) {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const moneyRainActive = runner.moneyRainTimer > 0;
    const perkModifiers = createRunnerPerkModifiers(runner.equippedPerkIds);
    const collectibleDefinition = pickSpawnableCollectibleDefinition({
      moneyRainActive,
      islandId: selectedIslandId,
      weightMultipliersById: perkModifiers.collectibleWeightMultipliers,
    });
    const spawnZ = moneyRainActive ? 2.08 + Math.random() * 0.1 : 1.94 + Math.random() * 0.12;
    const trackContext = buildTrackContextForDistance(runner, spawnZ * RUNNER_WORLD_FLOW_SCALE);
    runner.blocks.push(
      createCollectibleEntity(collectibleDefinition, {
        id: `b-${runner.nextId++}`,
        lane,
        z: spawnZ,
        y: moneyRainActive ? 0.72 + Math.random() * 0.06 : 0.78 + Math.random() * 0.08,
        vy: moneyRainActive ? -1.28 - Math.random() * 0.1 : -1.12 - Math.random() * 0.08,
        bounce: 0,
        impact: 0,
        settled: false,
        moneyRainDrop: moneyRainActive,
        settleAtZ: moneyRainActive ? 1.96 + Math.random() * 0.05 : 1.84 + Math.random() * 0.06,
        ...trackContext,
      })
    );
    if (
      trackContext.elevatedSurface === "high" &&
      trackContext.trackPhase === "plateau" &&
      Math.random() <= RUNNER_ELEVATED_SEGMENT_TUNING.bonusCollectibleTrailChance
    ) {
      const extraTrailCount = 1 + Math.floor(Math.random() * RUNNER_ELEVATED_SEGMENT_TUNING.bonusCollectibleTrailMax);
      for (let index = 1; index <= extraTrailCount; index += 1) {
        const trailZ = spawnZ + index * 0.34;
        runner.blocks.push(
          createCollectibleEntity(collectibleDefinition, {
            id: `b-${runner.nextId++}`,
            lane,
            z: trailZ,
            y: 0.34 + Math.random() * 0.04,
            vy: 0,
            bounce: 0,
            impact: 0,
            settled: true,
            moneyRainDrop: false,
            settleAtZ: null,
            ...buildTrackContextForDistance(runner, trailZ * RUNNER_WORLD_FLOW_SCALE),
          })
        );
      }
    }
    runner.blockSpawnMs = moneyRainActive
      ? Math.max(54, 92 - runner.speed * 4 + Math.random() * 14)
      : Math.max(
          runnerConfig.block_spawn_min_ms,
          runnerConfig.block_spawn_max_ms - runner.speed * 120 + Math.random() * 260
        );
  }

  runner.powerBoxSpawnMs -= dt * 1000;
  if (runner.powerBoxSpawnMs <= 0) {
    const powerUpDefinition = pickSpawnablePowerUpDefinition({ islandId: selectedIslandId });
    const spawnZ = 2.08 + Math.random() * 0.28;
    runner.powerBoxes.push(
      createPowerUpEntity(powerUpDefinition, {
        id: `pb-${runner.nextId++}`,
        lane: LANES[Math.floor(Math.random() * LANES.length)],
        z: spawnZ,
        y: 0,
        spin: (Math.random() - 0.5) * 1.8,
        bob: Math.random() * Math.PI * 2,
        ...buildTrackContextForDistance(runner, spawnZ * RUNNER_WORLD_FLOW_SCALE),
      })
    );
    runner.powerBoxSpawnMs =
      RUNNER_POWER_BOX_SPAWN_MIN_MS + Math.random() * (RUNNER_POWER_BOX_SPAWN_MAX_MS - RUNNER_POWER_BOX_SPAWN_MIN_MS);
  }

  runner.obstacleSpawnMs -= dt * 1000;
  if (runner.obstacleSpawnMs <= 0) {
    const obstacleDefinition = pickSpawnableObstacleDefinition({ islandId: selectedIslandId });
    const allowedLaneOffsets = Array.isArray(obstacleDefinition?.laneOccupation?.offsets)
      ? obstacleDefinition.laneOccupation.offsets
      : [0];
    const candidateLanes = LANES.filter((lane) =>
      allowedLaneOffsets.every((offset) => LANES.includes(lane + offset))
    );
    const obstacleLane = candidateLanes[Math.floor(Math.random() * candidateLanes.length)] ?? 0;
    const occupiedLanes = readOccupiedLanes(obstacleLane, obstacleDefinition.laneOccupation);
    const blocksLane = runner.blocks.filter(
      (entry) => occupiedLanes.includes(entry.lane) && entry.z > 0.8 && entry.z < 2.4
    ).length;
    const powerBoxSameLane = runner.powerBoxes.some(
      (entry) => occupiedLanes.includes(entry.lane) && entry.z > 0.9 && entry.z < 2.5
    );
    const spawnZ = 2.46 + Math.random() * 0.36;
    const trackContext = buildTrackContextForDistance(runner, spawnZ * RUNNER_WORLD_FLOW_SCALE);
    if (!powerBoxSameLane && blocksLane < 3) {
      const canSpawnOnCurrentSurface =
        !RUNNER_ELEVATED_SEGMENT_TUNING.obstacleGroundOnly || trackContext.elevatedSurface === "ground";
      if (canSpawnOnCurrentSurface) {
        runner.obstacles.push(
          createObstacleEntity(obstacleDefinition, {
            id: `ob-${runner.nextId++}`,
            lane: obstacleLane,
            z: spawnZ,
            ...trackContext,
          })
        );
      }
    }
    runner.obstacleSpawnMs = Math.max(
      RUNNER_OBSTACLE_SPAWN_MIN_MS,
      RUNNER_OBSTACLE_SPAWN_MAX_MS - runner.speed * 120 + Math.random() * 420
    );
  }
}

export function updateRunnerBlocks(
  runner,
  dt,
  {
    selectedIslandId,
    dailyIslandId,
    runnerConfig,
    onMoneyPickup,
  } = {}
) {
  runner.blocks = runner.blocks.flatMap((block) => {
    const collectibleDefinition = getCollectibleDefinition(block.definitionId);
    const perkModifiers = createRunnerPerkModifiers(runner.equippedPerkIds);
    const next = { ...block };
    const previousZ = next.z;
    next.z -= runner.speed * dt;
    next.impact = Math.max(0, next.impact - dt * 2.4);
    if (!next.settled) {
      next.vy -= 2.8 * dt;
      next.y += next.vy * dt;
    }

    if (!next.settled && next.settleAtZ !== null && next.z <= next.settleAtZ) {
      next.y = 0;
      next.vy = 0;
      next.bounce = 2;
      next.settled = true;
      next.settleAtZ = null;
      next.impact = 0;
    }

    if (!next.settled && next.y <= 0) {
      next.y = 0;
      next.impact = 1;
      if (next.settleAtZ !== null) {
        next.bounce = 2;
        next.vy = 0;
        next.settled = true;
        next.settleAtZ = null;
        next.impact = 0;
      } else if (next.bounce < 1) {
        next.bounce += 1;
        next.vy = 0.18 + Math.random() * 0.08;
      } else {
        next.vy = 0;
        next.settled = true;
        next.impact = 0;
      }
    }

    const sameLane = next.lane === runner.lane;
    const sweepPadding = Math.min(0.34, runner.speed * dt * 1.55);
    const collectibleHeightTolerance = 0.34 + Math.min(0.14, runner.speed * 0.012);
    const collectible = next.y <= collectibleHeightTolerance;
    const crossedCueWindow = previousZ >= 0.26 - sweepPadding && next.z <= 0.26 + sweepPadding;
    if (sameLane && collectible && !next.collectCue && crossedCueWindow) {
      next.collectCue = true;
      runner.collectAnimTimer = Math.max(runner.collectAnimTimer, 0.16);
    }

    const crossedCollectWindow = previousZ >= -0.14 - sweepPadding && next.z <= 0.18 + sweepPadding;
    if (crossedCollectWindow) {
      if (sameLane && collectible) {
        const collectEffect = collectibleDefinition.effectOnCollect || { type: "score", score: 1, chestMode: "config" };
        const gainMultiplier = getRunnerCoinMultiplier(runner, perkModifiers);
        const isMoneyRainPickup = gainMultiplier > Number(perkModifiers.coinMultiplier || 1);
        const baseGain =
          selectedIslandId === dailyIslandId ? runnerConfig.chest_gain_daily : runnerConfig.chest_gain_regular;
        const scoreGain =
          Number(collectEffect.score || collectibleDefinition.value || 1) *
          gainMultiplier *
          getRunnerCharacterScoreMultiplier(runner);
        const chestMultiplier = Number(collectEffect.chestMultiplier || 1);
        const chestGain = collectEffect.chestMode === "config_multiplier" ? baseGain * chestMultiplier : baseGain;
        const awardedScore = applyRunnerScoreGain(runner, scoreGain);
        runner.chestChance = Math.min(95, runner.chestChance + chestGain * gainMultiplier);
        runner.collectAnimTimer = Math.max(runner.collectAnimTimer, 0.2);
        onMoneyPickup?.({ isMoneyRainPickup, collectibleId: collectibleDefinition.id, scoreGain: awardedScore });
      }
      return [];
    }

    if (next.z <= -0.28) return [];
    return [next];
  });
}

export function updateRunnerPowerBoxes(runner, dt, { onPowerBoxPickup } = {}) {
  runner.powerBoxes = runner.powerBoxes.flatMap((box) => {
    const powerUpDefinition = getPowerUpDefinition(box.definitionId);
    const perkModifiers = createRunnerPerkModifiers(runner.equippedPerkIds);
    const next = { ...box };
    const previousZ = next.z;
    next.z -= runner.speed * dt;
    next.bob += dt * 3.8;
    const sameLane = next.lane === runner.lane;
    const playerBusy = runner.jumpTimer > 0.08 || runner.slideTimer > 0.08;
    const powerBoxSweepPadding = Math.min(0.4, runner.speed * dt * 1.7);
    const powerBoxInReach = previousZ >= -0.2 - powerBoxSweepPadding && next.z <= 0.24 + powerBoxSweepPadding;
    if (sameLane && !playerBusy && powerBoxInReach) {
      const activated = activateRunnerPowerUp(
        runner,
        {
          ...powerUpDefinition,
          durationMs: Number(box.durationMs || powerUpDefinition.durationMs || RUNNER_MONEY_RAIN_DURATION_MS),
        },
        perkModifiers
      );
      runner.collectAnimTimer = Math.max(runner.collectAnimTimer, 0.32);
      if (activated?.effectDefinition?.blockBurst) {
        runner.blockSpawnMs = Math.min(runner.blockSpawnMs, 70);
      }
      runner.powerBreaks.push({
        id: `pbr-${runner.nextId++}`,
        lane: next.lane,
        z: next.z,
        trackYOffset: Number(next.trackYOffset || 0),
        life: 1,
        seed: Math.random(),
      });
      runner.impacts.push({
        id: `i-${runner.nextId++}`,
        lane: next.lane,
        trackYOffset: Number(next.trackYOffset || 0),
        life: 1,
        kind: "power-break",
      });
      onPowerBoxPickup?.({ powerUpId: powerUpDefinition.id, effectType: activated?.effectDefinition?.type });
      return [];
    }
    if (next.z <= -0.24) return [];
    return [next];
  });
}

export function decayRunnerImpacts(runner, dt) {
  runner.impacts = runner.impacts
    .map((impact) => ({ ...impact, life: impact.life - dt * 2.2 }))
    .filter((impact) => impact.life > 0);
}
