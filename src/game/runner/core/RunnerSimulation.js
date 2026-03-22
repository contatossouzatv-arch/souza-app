import { updateRunnerObstacles, updateRunnerPitGaps } from "@/game/runner/core/CollisionSystem";
import {
  RUNNER_DEFAULT_LOADOUT,
  RUNNER_JUMP_DURATION,
  RUNNER_OBSTACLE_SPAWN_MAX_MS,
  RUNNER_OBSTACLE_SPAWN_MIN_MS,
  RUNNER_POWER_BOX_SPAWN_MAX_MS,
  RUNNER_POWER_BOX_SPAWN_MIN_MS,
  RUNNER_SLIDE_DURATION,
  UI_SNAPSHOT_INTERVAL_MS,
} from "@/game/runner/core/RunnerConstants";
import {
  buildUiSnapshot,
  buildVisualState,
  createDefaultRunnerRuntimeState,
  createDefaultRunnerState,
  writeRunnerState,
} from "@/game/runner/core/RunnerSnapshotBuilder";
import {
  advanceRunnerFrame,
  decayRunnerImpacts,
  spawnRunnerEntities,
  updateRunnerBlocks,
  updateRunnerPowerBoxes,
} from "@/game/runner/core/SpawnSystem";
import {
  buildRunnerMapSpecialSegments,
  ensureRunnerElevatedSegmentSpawn,
  updateRunnerElevatedSegments,
} from "@/game/runner/core/RunnerElevatedSystem";
import { activateRunnerPowerUp, createRunnerPerkModifiers } from "@/game/runner/core/RunnerEffectSystem";
import { getPowerUpDefinition } from "@/game/runner/core/RunnerEntityDefinitions";
import { createRunnerCharacterPassiveState } from "@/game/progression/characterPassiveService";
import { PLAYER_CONSUMABLE_DEFINITIONS } from "@/game/progression/playerInventoryConfig";

export { createDefaultRunnerRuntimeState, createDefaultRunnerState };

export function createRunnerSimulation({
  runner,
  runnerStateRef,
  onUiSnapshot,
  onCollision,
  onMoneyPickup,
  onPowerBoxPickup,
} = {}) {
  if (!runner) {
    throw new Error("RunnerSimulation requires a mutable runner runtime object");
  }

  let lastUiPushAt = 0;

  const pushVisualState = (overrides = {}) => {
    const next = buildVisualState(runner, overrides);
    runnerStateRef.current = writeRunnerState(runnerStateRef.current, next);
    return runnerStateRef.current;
  };

  const pushUiSnapshot = ({ force = false, overrides = {} } = {}) => {
    if (typeof onUiSnapshot !== "function") return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - lastUiPushAt < UI_SNAPSHOT_INTERVAL_MS) return;
    lastUiPushAt = now;
    onUiSnapshot(buildUiSnapshot(runner, overrides));
  };

  const stop = () => {
    runner.running = false;
    if (runner.rafId) {
      cancelAnimationFrame(runner.rafId);
      runner.rafId = 0;
    }
  };

  const start = ({
    startPaused = false,
    cycleFlowBase = 0,
    runnerConfig,
    selectedIslandId,
    dailyIslandId,
    selectedCharacterId,
    equippedPerkIds,
    selectedConsumableId,
    sceneConfig,
    isPausedRef,
    timeScaleRef,
    isNoCollisionRef,
  } = {}) => {
    stop();

    const resolvedPerkIds =
      Array.isArray(equippedPerkIds) && equippedPerkIds.length
        ? [...equippedPerkIds]
        : [...(RUNNER_DEFAULT_LOADOUT.perkIds || [])];
    const characterPassiveState = createRunnerCharacterPassiveState(selectedCharacterId);

    const mapSpecialSegments = buildRunnerMapSpecialSegments(sceneConfig);
    Object.assign(runner, createDefaultRunnerRuntimeState(), {
      running: true,
      blockSpawnMs: 220,
      powerBoxSpawnMs:
        RUNNER_POWER_BOX_SPAWN_MIN_MS + Math.random() * (RUNNER_POWER_BOX_SPAWN_MAX_MS - RUNNER_POWER_BOX_SPAWN_MIN_MS),
      obstacleSpawnMs:
        RUNNER_OBSTACLE_SPAWN_MIN_MS + Math.random() * (RUNNER_OBSTACLE_SPAWN_MAX_MS - RUNNER_OBSTACLE_SPAWN_MIN_MS),
      cycleFlowBase,
      chestChance: runnerConfig.chest_base,
      speed: runnerConfig.speed_start,
      baseSpeed: runnerConfig.speed_start,
      selectedCharacterId: String(selectedCharacterId || "sam"),
      characterPassiveModifiers: characterPassiveState.modifiers,
      equippedPerkIds: resolvedPerkIds,
      loadout: {
        perkIds: resolvedPerkIds,
        characterId: String(selectedCharacterId || "sam"),
        consumableId: String(selectedConsumableId || ""),
      },
      activePowerUps: characterPassiveState.activePowerUps,
      mapSpecialSegments,
      useMapSpecialSegments: !!mapSpecialSegments?.hasSegments,
    });

    if (!mapSpecialSegments?.hasSegments) {
      ensureRunnerElevatedSegmentSpawn(runner);
    }
    updateRunnerElevatedSegments(runner);

    const consumableDefinition = PLAYER_CONSUMABLE_DEFINITIONS[String(selectedConsumableId || "").trim()] || null;
    if (consumableDefinition?.linkedPowerUpId) {
      activateRunnerPowerUp(
        runner,
        getPowerUpDefinition(consumableDefinition.linkedPowerUpId),
        createRunnerPerkModifiers(resolvedPerkIds)
      );
    }

    if (isPausedRef) {
      isPausedRef.current = startPaused;
    }

    pushVisualState({ status: "running" });
    pushUiSnapshot({ force: true });

    const loop = (ts) => {
      if (!runner.running) return;
      if (!runner.lastTs) runner.lastTs = ts;
      if (isPausedRef?.current) {
        runner.lastTs = ts;
        runner.rafId = requestAnimationFrame(loop);
        return;
      }

      const timeScale = Number(timeScaleRef?.current || 1);
      const dt = (Math.min(34, ts - runner.lastTs) / 1000) * timeScale;
      runner.lastTs = ts;
      advanceRunnerFrame(runner, dt, runnerConfig);
      spawnRunnerEntities(runner, dt, runnerConfig, { selectedIslandId });
      updateRunnerElevatedSegments(runner, dt);
      updateRunnerBlocks(runner, dt, {
        selectedIslandId,
        dailyIslandId,
        runnerConfig,
        onMoneyPickup,
      });
      updateRunnerPowerBoxes(runner, dt, { onPowerBoxPickup });
      const pitResult = updateRunnerPitGaps(runner, {
        isNoCollisionEnabled: Boolean(isNoCollisionRef?.current),
        onGhostImpact(gap) {
          runner.impacts.push({
            id: `i-${runner.nextId++}`,
            lane: runner.lane,
            trackYOffset: 0,
            life: 1,
            kind: gap?.kind || "ghost",
          });
        },
        onCollision(gap) {
          runner.collisionType = "pit_gap";
          pushVisualState({ status: "collision", collisionProgress: 0, collisionType: "pit_gap" });
          pushUiSnapshot({ force: true, overrides: { status: "collision", collisionType: "pit_gap" } });
          onCollision?.(gap);
        },
      });
      if (pitResult?.collided) {
        return;
      }
      updateRunnerObstacles(runner, dt, {
        isNoCollisionEnabled: Boolean(isNoCollisionRef?.current),
        onGhostImpact(obstacle) {
          runner.impacts.push({
            id: `i-${runner.nextId++}`,
            lane: obstacle.lane,
            trackYOffset: Number(obstacle?.trackYOffset || 0),
            life: 1,
            kind: "ghost",
          });
        },
        onCollision(obstacle) {
          runner.collisionType = "obstacle";
          pushVisualState({ status: "collision", collisionProgress: 0, collisionType: "obstacle" });
          pushUiSnapshot({ force: true, overrides: { status: "collision", collisionType: "obstacle" } });
          onCollision?.(obstacle);
        },
      });

      if (!runner.running) return;

      decayRunnerImpacts(runner, dt);

      pushVisualState({ status: "running" });
      pushUiSnapshot();
      runner.rafId = requestAnimationFrame(loop);
    };

    runner.rafId = requestAnimationFrame(loop);
  };

  return {
    start,
    stop,
    moveLane(direction) {
      if (!runner.running) return false;
      const nextLane = Math.max(-1, Math.min(1, runner.lane + direction));
      if (nextLane === runner.lane) return false;
      runner.lane = nextLane;
      runner.laneLean = direction;
      pushVisualState({ status: "running" });
      pushUiSnapshot({ force: true });
      return true;
    },
    jump() {
      if (!runner.running || runner.jumpTimer > 0.02) return false;
      runner.jumpTimer = RUNNER_JUMP_DURATION;
      runner.slideTimer = 0;
      pushVisualState({ status: "running" });
      pushUiSnapshot({ force: true });
      return true;
    },
    slide() {
      if (!runner.running || runner.slideTimer > 0.02) return false;
      runner.slideTimer = RUNNER_SLIDE_DURATION;
      runner.jumpTimer = 0;
      pushVisualState({ status: "running" });
      pushUiSnapshot({ force: true });
      return true;
    },
    syncVisualState(overrides = {}) {
      return pushVisualState(overrides);
    },
    pushUiSnapshot,
    resetVisualState() {
      runnerStateRef.current = writeRunnerState(runnerStateRef.current, createDefaultRunnerState());
    },
  };
}
