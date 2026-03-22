import {
  RUNNER_ELEVATED_SEGMENT_TUNING,
  RUNNER_JUMP_DURATION,
  RUNNER_SLIDE_DURATION,
} from "@/game/runner/core/RunnerConstants";
import { createRunnerPerkModifiers, getRunnerCoinMultiplier } from "@/game/runner/core/RunnerEffectSystem";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function createDefaultRunnerState() {
  return {
    status: "idle",
    collisionType: "",
    lane: 0,
    laneVisual: 0,
    laneLean: 0,
    jump: 0,
    jumpForward: 0,
    slide: 0,
    collectPulse: 0,
    collisionProgress: 0,
    elapsedMs: 0,
    worldFlow: 0,
    score: 0,
    chestChance: 5,
    speed: 0.64,
    trackHeight: 0,
    trackHeightVisual: 0,
    activeTrackPhase: "ground",
    elevatedSegments: [],
    blocks: [],
    powerBoxes: [],
    powerBreaks: [],
    obstacles: [],
    impacts: [],
    powerUpsAtivos: [],
    shieldCharges: 0,
    coinMultiplierAtual: 1,
    slowMotionAtivo: false,
    loadout: { perkIds: [], consumableId: "" },
    moneyRainMs: 0,
    moneyRainActive: false,
    moneyRainMultiplier: 1,
  };
}

export function createDefaultRunnerRuntimeState() {
  return {
    running: false,
    rafId: 0,
    lastTs: 0,
    blockSpawnMs: 0,
    powerBoxSpawnMs: 0,
    obstacleSpawnMs: 0,
    nextId: 1,
    lane: 0,
    laneVisual: 0,
    laneLean: 0,
    jumpTimer: 0,
    slideTimer: 0,
    collectAnimTimer: 0,
    moneyMultiplierTimer: 0,
    moneyRainTimer: 0,
    scoreFractionCarry: 0,
    elapsedMs: 0,
    worldFlow: 0,
    cycleFlowBase: 0,
    score: 0,
    chestChance: 5,
    speed: 0.64,
    baseSpeed: 0.64,
    collisionType: "",
    trackHeight: 0,
    trackHeightVisual: 0,
    activeElevatedSegmentId: "",
    activeTrackPhase: "ground",
    elevatedSegments: [],
    dynamicElevatedSegments: [],
    mapSpecialSegments: {
      cycleLength: 600,
      elevatedTemplates: [],
      pitTemplates: [],
    },
    useMapSpecialSegments: false,
    nextElevatedSpawnFlow: 0,
    trackHeightLerp: RUNNER_ELEVATED_SEGMENT_TUNING.trackHeightLerp,
    equippedPerkIds: [],
    loadout: { perkIds: [], consumableId: "" },
    activePowerUps: {},
    blocks: [],
    powerBoxes: [],
    powerBreaks: [],
    obstacles: [],
    impacts: [],
  };
}

export function getRunnerJumpHeight(progress01) {
  const t = clamp01(progress01);
  const apexSplit = 0.34;
  let arcT = 0;
  if (t <= apexSplit) {
    const rise = t / apexSplit;
    arcT = Math.pow(rise, 0.72) * 0.5;
  } else {
    const fall = (t - apexSplit) / Math.max(0.0001, 1 - apexSplit);
    arcT = 0.5 + Math.pow(fall, 1.95) * 0.5;
  }
  return Math.sin(arcT * Math.PI) * 1.08;
}

export function getRunnerJumpForward(progress01) {
  const t = clamp01(progress01);
  const push = Math.sin(t * Math.PI) * 0.11;
  const linger = t < 0.42 ? t / 0.42 : 1 - (t - 0.42) / 0.58;
  return Math.max(0, push * Math.max(0, linger));
}

export function writeRunnerState(target, next) {
  const output = target && typeof target === "object" ? target : createDefaultRunnerState();
  output.status = next.status;
  output.collisionType = next.collisionType;
  output.lane = next.lane;
  output.laneVisual = next.laneVisual;
  output.laneLean = next.laneLean;
  output.jump = next.jump;
  output.jumpForward = next.jumpForward;
  output.slide = next.slide;
  output.collectPulse = next.collectPulse;
  output.collisionProgress = next.collisionProgress;
  output.elapsedMs = next.elapsedMs;
  output.worldFlow = next.worldFlow;
  output.score = next.score;
  output.chestChance = next.chestChance;
  output.speed = next.speed;
  output.trackHeight = next.trackHeight;
  output.trackHeightVisual = next.trackHeightVisual;
  output.activeTrackPhase = next.activeTrackPhase;
  output.elevatedSegments = next.elevatedSegments;
  output.blocks = next.blocks;
  output.powerBoxes = next.powerBoxes;
  output.powerBreaks = next.powerBreaks;
  output.obstacles = next.obstacles;
  output.impacts = next.impacts;
  output.powerUpsAtivos = next.powerUpsAtivos;
  output.shieldCharges = next.shieldCharges;
  output.coinMultiplierAtual = next.coinMultiplierAtual;
  output.slowMotionAtivo = next.slowMotionAtivo;
  output.loadout = next.loadout;
  output.moneyRainMs = next.moneyRainMs;
  output.moneyRainActive = next.moneyRainActive;
  output.moneyRainMultiplier = next.moneyRainMultiplier;
  return output;
}

export function buildVisualState(runner, overrides = {}) {
  const jumpProgress = runner.jumpTimer > 0 ? 1 - runner.jumpTimer / RUNNER_JUMP_DURATION : 0;
  const perkModifiers = createRunnerPerkModifiers(runner.equippedPerkIds);
  const moneyMultiplierEntry = runner.activePowerUps?.money_multiplier || null;
  const shieldEntry = runner.activePowerUps?.shield || null;
  const slowMotionEntry = runner.activePowerUps?.slow_motion || null;
  const moneyMultiplier =
    Number(moneyMultiplierEntry?.effectDefinition?.scoreMultiplier || 0) > 0
      ? Number(moneyMultiplierEntry.effectDefinition.scoreMultiplier)
      : 1;
  const powerUpsAtivos = Object.values(runner.activePowerUps || {})
    .filter((entry) => entry && (entry.remainingMs || 0) > 0)
    .map((entry) => ({
      id: entry.id,
      tipo: entry.effectDefinition?.type || entry.kind || "unknown",
      duracaoRestanteMs: Math.round(Number(entry.remainingMs || 0)),
      charges: Math.max(0, Number(entry.charges || 0)),
    }));
  return {
    status: overrides.status || "running",
    collisionType: String(overrides.collisionType || runner.collisionType || ""),
    lane: runner.lane,
    laneVisual: runner.laneVisual,
    laneLean: runner.laneLean,
    jump: runner.jumpTimer > 0 ? getRunnerJumpHeight(jumpProgress) : 0,
    jumpForward: runner.jumpTimer > 0 ? getRunnerJumpForward(jumpProgress) : 0,
    slide: runner.slideTimer > 0 ? clamp01(runner.slideTimer / RUNNER_SLIDE_DURATION) : 0,
    collectPulse: runner.collectAnimTimer > 0 ? clamp01(runner.collectAnimTimer / 0.16) : 0,
    collisionProgress: Number(overrides.collisionProgress || 0),
    elapsedMs: runner.elapsedMs,
    worldFlow: runner.worldFlow,
    score: runner.score,
    chestChance: runner.chestChance,
    speed: runner.speed,
    trackHeight: Number(runner.trackHeight || 0),
    trackHeightVisual: Number(runner.trackHeightVisual || 0),
    activeTrackPhase: String(runner.activeTrackPhase || "ground"),
    elevatedSegments: runner.elevatedSegments || [],
    blocks: runner.blocks,
    powerBoxes: runner.powerBoxes,
    powerBreaks: runner.powerBreaks,
    obstacles: runner.obstacles,
    impacts: runner.impacts,
    powerUpsAtivos,
    shieldCharges: Math.max(0, Number(shieldEntry?.charges || 0)),
    coinMultiplierAtual: getRunnerCoinMultiplier(runner, perkModifiers),
    slowMotionAtivo: Boolean(slowMotionEntry && (slowMotionEntry.remainingMs || 0) > 0),
    loadout: {
      perkIds: [...(runner.loadout?.perkIds || runner.equippedPerkIds || [])],
      characterId: String(runner.loadout?.characterId || runner.selectedCharacterId || "sam"),
      consumableId: String(runner.loadout?.consumableId || ""),
    },
    moneyRainMs: runner.moneyMultiplierTimer,
    moneyRainActive: runner.moneyMultiplierTimer > 0,
    moneyRainMultiplier: runner.moneyMultiplierTimer > 0 ? moneyMultiplier : 1,
  };
}

export function buildUiSnapshot(runner, overrides = {}) {
  const visualState = buildVisualState(runner, overrides);
  return {
    ...createDefaultRunnerState(),
    ...visualState,
    blocks: [],
    powerBoxes: [],
    powerBreaks: [],
    obstacles: [],
    impacts: [],
    elevatedSegments: [],
  };
}
