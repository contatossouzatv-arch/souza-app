import {
  consumeRunnerShield,
  runnerHasShield,
} from "@/game/runner/core/RunnerEffectSystem";
import {
  RUNNER_COLLISION_TUNING,
  RUNNER_COLLISION_LANE_TOLERANCE,
  RUNNER_COLLISION_Z_TOLERANCE,
  RUNNER_JUMP_DURATION,
  RUNNER_SLIDE_DURATION,
  RUNNER_VIEW_OBSTACLE_Z_OFFSET,
  RUNNER_VIEW_PLAYER_Z,
  RUNNER_VIEW_Z_SCALE,
  RUNNER_PIT_GAP_TUNING,
} from "@/game/runner/core/RunnerConstants";
import { getRunnerJumpForward, getRunnerJumpHeight } from "@/game/runner/core/RunnerSnapshotBuilder";
import { resolveRunnerPitGapAtFlow } from "@/game/runner/core/RunnerElevatedSystem";

function clampLane(lane) {
  return Math.max(-1, Math.min(1, lane));
}

function readOccupiedLanes(obstacle) {
  const offsets = Array.isArray(obstacle?.laneOccupation?.offsets) && obstacle.laneOccupation.offsets.length
    ? obstacle.laneOccupation.offsets
    : [0];
  return Array.from(new Set(offsets.map((offset) => clampLane(Number(obstacle.lane || 0) + Number(offset || 0)))));
}

function resolveRequiredAction(obstacle) {
  if (obstacle?.requiredAction && obstacle.requiredAction !== "basic") return obstacle.requiredAction;
  if (obstacle?.heightType === "low") return "jump";
  if (obstacle?.heightType === "high") return "slide";
  if (obstacle?.widthType === "double" || obstacle?.widthType === "wide") return "lane-change";
  return "basic";
}

function playerSatisfiesRequiredAction(runner, obstacle) {
  const requiredAction = resolveRequiredAction(obstacle);
  const jumpProgress = runner.jumpTimer > 0 ? 1 - runner.jumpTimer / RUNNER_JUMP_DURATION : 0;
  const jumpHeight = runner.jumpTimer > 0 ? getRunnerJumpHeight(jumpProgress) : 0;
  const slideProgress = runner.slideTimer > 0 ? runner.slideTimer / RUNNER_SLIDE_DURATION : 0;

  if (requiredAction === "jump") {
    return jumpHeight >= RUNNER_COLLISION_TUNING.obstacleLowMinJump;
  }
  if (requiredAction === "slide") {
    return slideProgress >= RUNNER_COLLISION_TUNING.obstacleHighMinSlide;
  }
  if (requiredAction === "lane-change") {
    return false;
  }
  return false;
}

export function updateRunnerObstacles(
  runner,
  dt,
  {
    isNoCollisionEnabled = false,
    onGhostImpact,
    onCollision,
  } = {}
) {
  let collided = false;

  runner.obstacles = runner.obstacles.filter((obstacle) => {
    obstacle.z -= runner.speed * dt;
    const jumpProgress = runner.jumpTimer > 0 ? 1 - runner.jumpTimer / RUNNER_JUMP_DURATION : 0;
    const playerWorldZ = RUNNER_VIEW_PLAYER_Z + getRunnerJumpForward(jumpProgress);
    const obstacleWorldZ = -obstacle.z * RUNNER_VIEW_Z_SCALE + RUNNER_VIEW_OBSTACLE_Z_OFFSET;
    const collisionSweepPadding = Math.min(
      0.72,
      runner.speed * dt * RUNNER_VIEW_Z_SCALE * RUNNER_COLLISION_TUNING.maxDepthWindowScale
    );
    const configDepthMultiplier =
      obstacle?.widthType === "double" || obstacle?.widthType === "wide"
        ? RUNNER_COLLISION_TUNING.wideDepthWindowMultiplier
        : RUNNER_COLLISION_TUNING.baseDepthWindowMultiplier;
    const depthMultiplier = Math.max(0.7, Number(obstacle.collisionDepth || configDepthMultiplier));
    const collisionZTolerance = (RUNNER_COLLISION_Z_TOLERANCE + collisionSweepPadding) * depthMultiplier;
    const collisionLaneTolerance =
      RUNNER_COLLISION_LANE_TOLERANCE +
      Math.min(RUNNER_COLLISION_TUNING.laneToleranceSpeedBonusCap, runner.speed * 0.01);
    const sameDepth = Math.abs(obstacleWorldZ - playerWorldZ) <= collisionZTolerance;
    const occupiedLanes = readOccupiedLanes(obstacle);
    const intersectsLane = occupiedLanes.some((lane) => Math.abs(lane - runner.laneVisual) <= collisionLaneTolerance);
    const actionAvoided = playerSatisfiesRequiredAction(runner, obstacle);
    const obstacleCollided = intersectsLane && sameDepth && !actionAvoided;
    if (obstacleCollided) {
      if (runnerHasShield(runner)) {
        consumeRunnerShield(runner);
        onGhostImpact?.({ ...obstacle, lane: obstacle.lane });
        return false;
      }
      if (isNoCollisionEnabled) {
        onGhostImpact?.(obstacle);
        return false;
      }
      collided = true;
      onCollision?.(obstacle);
      return false;
    }
    return obstacle.z >= -0.2;
  });

  return { collided };
}

export function updateRunnerPitGaps(
  runner,
  {
    isNoCollisionEnabled = false,
    onGhostImpact,
    onCollision,
  } = {}
) {
  const activeGap = resolveRunnerPitGapAtFlow(runner, runner.worldFlow);
  if (!activeGap) return { collided: false, activeGap: null };
  const jumpProgress = runner.jumpTimer > 0 ? 1 - runner.jumpTimer / RUNNER_JUMP_DURATION : 0;
  const jumpHeight = runner.jumpTimer > 0 ? getRunnerJumpHeight(jumpProgress) : 0;
  const safeJump = jumpHeight >= RUNNER_PIT_GAP_TUNING.minJumpHeight;
  const startFlow = Number(activeGap.startFlow || 0) - RUNNER_PIT_GAP_TUNING.collisionPadding;
  const endFlow = Number(activeGap.endFlow || 0) + RUNNER_PIT_GAP_TUNING.collisionPadding;
  const insideGap = runner.worldFlow >= startFlow && runner.worldFlow <= endFlow;
  if (!insideGap || safeJump) {
    runner.activePitGapId = insideGap ? String(activeGap.id || "") : "";
    return { collided: false, activeGap };
  }
  if (runnerHasShield(runner)) {
    consumeRunnerShield(runner);
    onGhostImpact?.({
      id: `pit-${activeGap.id || "gap"}`,
      lane: runner.lane,
      trackYOffset: 0,
      kind: "pit-gap",
    });
    return { collided: false, activeGap };
  }
  if (isNoCollisionEnabled) {
    onGhostImpact?.({
      id: `pit-${activeGap.id || "gap"}`,
      lane: runner.lane,
      trackYOffset: 0,
      kind: "pit-gap",
    });
    return { collided: false, activeGap };
  }
  onCollision?.(activeGap);
  return { collided: true, activeGap };
}
