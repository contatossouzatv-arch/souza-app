import { RUNNER_ELEVATED_SEGMENT_TUNING } from "@/game/runner/core/RunnerConstants";
import woodBridgeFbxUrl from "../../../../assets-para-app/jogos/ponte_01.fbx?url";

export const ELEVATED_SEGMENT_DEFINITIONS = {
  wood_bridge: {
    id: "wood_bridge",
    label: "Ponte de madeira",
    visualType: "bridge_wood",
    height: 1.18,
    entryLength: 16,
    flatLength: 34,
    exitLength: 16,
    placeholderProfile: "bridge",
    assetRefs: {
      entry: "",
      flat: woodBridgeFbxUrl,
      exit: "",
    },
    assetPlacement: {
      mode: "single_bridge",
      rotationY: 0,
      yOffset: 0.04,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    spawnWeight: 1,
    spawnEnabled: true,
  },
  stone_ruin: {
    id: "stone_ruin",
    label: "Ruina de pedra",
    visualType: "stone_ruin",
    height: 1.52,
    entryLength: 14,
    flatLength: 24,
    exitLength: 14,
    placeholderProfile: "ruin",
    assetRefs: {
      entry: "",
      flat: "",
      exit: "",
    },
    assetPlacement: {
      mode: "segmented",
      rotationY: 0,
      yOffset: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    spawnWeight: 0.18,
    spawnEnabled: false,
  },
  giant_log: {
    id: "giant_log",
    label: "Tronco gigante",
    visualType: "giant_log",
    height: 1.12,
    entryLength: 10,
    flatLength: 20,
    exitLength: 10,
    placeholderProfile: "log",
    assetRefs: {
      entry: "",
      flat: "",
      exit: "",
    },
    assetPlacement: {
      mode: "segmented",
      rotationY: 0,
      yOffset: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    spawnWeight: 0.12,
    spawnEnabled: false,
  },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function normalizeCycleFlow(value, cycleLength) {
  const safeCycle = Math.max(1, Number(cycleLength || 600));
  const raw = Number(value || 0);
  return ((raw % safeCycle) + safeCycle) % safeCycle;
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

export function pickSpawnableElevatedSegmentDefinition() {
  return (
    pickWeightedDefinition(Object.values(ELEVATED_SEGMENT_DEFINITIONS).filter((definition) => definition.spawnEnabled !== false)) ||
    ELEVATED_SEGMENT_DEFINITIONS.wood_bridge
  );
}

export function createElevatedSegmentEntity(definition, overrides = {}) {
  const entryLength = Math.max(0.05, Number(overrides.entryLength || definition.entryLength || 12));
  const flatLength = Math.max(0.05, Number(overrides.flatLength || definition.flatLength || 24));
  const exitLength = Math.max(0.05, Number(overrides.exitLength || definition.exitLength || 12));
  const startFlow = Number(overrides.startFlow || 0);
  const plateauStartFlow = startFlow + entryLength;
  const descentStartFlow = plateauStartFlow + flatLength;
  const endFlow = descentStartFlow + exitLength;
  return {
    id: String(overrides.id || definition.id),
    definitionId: definition.id,
    label: definition.label,
    visualType: definition.visualType,
    placeholderProfile: String(definition.placeholderProfile || "bridge"),
    assetRefs: {
      entry: String(definition.assetRefs?.entry || ""),
      flat: String(definition.assetRefs?.flat || ""),
      exit: String(definition.assetRefs?.exit || ""),
    },
    assetPlacement: {
      mode: String(definition.assetPlacement?.mode || "segmented"),
      rotationY: Number(definition.assetPlacement?.rotationY || 0),
      yOffset: Number(definition.assetPlacement?.yOffset || 0),
      scaleX: Number(definition.assetPlacement?.scaleX || 1),
      scaleY: Number(definition.assetPlacement?.scaleY || 1),
      scaleZ: Number(definition.assetPlacement?.scaleZ || 1),
    },
    height: Math.max(0.02, Number(overrides.height || definition.height || 1.2)),
    entryLength,
    flatLength,
    exitLength,
    startFlow,
    plateauStartFlow,
    descentStartFlow,
    endFlow,
    hiddenRuntimeVisual: !!overrides.hiddenRuntimeVisual,
  };
}

export function buildRunnerMapSpecialSegments(sceneConfig) {
  const customObjects = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
  const objectOverrides =
    sceneConfig?.object_overrides && typeof sceneConfig.object_overrides === "object"
      ? sceneConfig.object_overrides
      : {};
  const rawCycle = Number(sceneConfig?.object_overrides?.road_base?.map_cycle_length);
  const cycleLength = Number.isFinite(rawCycle) ? Math.max(80, Math.min(5000, rawCycle)) : 600;
  const elevatedTemplates = [];
  const pitTemplates = [];

  customObjects.forEach((entry, index) => {
    const key = String(entry?.key || `custom_${index}`);
    const override = objectOverrides?.[key] && typeof objectOverrides[key] === "object" ? objectOverrides[key] : {};
    const merged = { ...entry, ...override };
    const type = String(merged?.special_segment_type || "").trim().toLowerCase();
    if (!type) return;
    const logicOffsetZ = Number(merged?.segment_logic_offset_z || 0);
    const logicHeightOffset = Number(merged?.segment_logic_height_offset || 0);
    const centerFlow = normalizeCycleFlow(-(Number(merged?.z || 0) + logicOffsetZ), cycleLength);
    if (type === "pit_gap") {
      const gapLength = Math.max(0.05, Number(merged?.segment_gap_length || 7.5));
      const startFlow = centerFlow - gapLength * 0.5;
      pitTemplates.push({
        id: key,
        key,
        type,
        centerFlow,
        gapLength,
        dropDepth: Math.max(0.4, Number(merged?.segment_drop_depth || 2.4)),
        logicOffsetZ,
        startFlow,
        endFlow: startFlow + gapLength,
      });
      return;
    }
    const profile = String(merged?.special_profile || "wood_bridge").trim().toLowerCase();
    const definition = ELEVATED_SEGMENT_DEFINITIONS[profile] || ELEVATED_SEGMENT_DEFINITIONS.wood_bridge;
    const entryLength = Math.max(0.05, Number(merged?.segment_entry_length || definition.entryLength || 16));
    const flatLength = Math.max(0.05, Number(merged?.segment_flat_length || definition.flatLength || 24));
    const exitLength = Math.max(0.05, Number(merged?.segment_exit_length || definition.exitLength || 16));
    const totalLength = entryLength + flatLength + exitLength;
    const startFlow = centerFlow - totalLength * 0.5;
    elevatedTemplates.push({
      id: key,
      key,
      type,
      profile,
      definition,
      centerFlow,
      height: Math.max(0.02, Number(merged?.segment_height || definition.height || 1.18) + logicHeightOffset),
      logicOffsetZ,
      logicHeightOffset,
      entryLength,
      flatLength,
      exitLength,
      startFlow,
      assetRefs: {
        entry: "",
        flat: String(merged?.model_url || ""),
        exit: "",
      },
      assetPlacement: {
        ...(definition.assetPlacement || {}),
      },
      hiddenRuntimeVisual: true,
    });
  });

  return {
    cycleLength,
    elevatedTemplates,
    pitTemplates,
    hasSegments: elevatedTemplates.length > 0 || pitTemplates.length > 0,
  };
}

export function materializeRunnerMapElevatedSegments(runner) {
  const templates = Array.isArray(runner?.mapSpecialSegments?.elevatedTemplates)
    ? runner.mapSpecialSegments.elevatedTemplates
    : [];
  const cycleLength = Math.max(1, Number(runner?.mapSpecialSegments?.cycleLength || 600));
  const currentFlow = Number(runner?.worldFlow || 0);
  const windowStart = currentFlow - 60;
  const windowEnd = currentFlow + 260;
  const segments = [];
  templates.forEach((template) => {
    const totalLength = template.entryLength + template.flatLength + template.exitLength;
    const minRepeat = Math.floor((windowStart - (template.startFlow + totalLength)) / cycleLength);
    const maxRepeat = Math.ceil((windowEnd - template.startFlow) / cycleLength);
    for (let repeat = minRepeat; repeat <= maxRepeat; repeat += 1) {
      const repeatOffset = repeat * cycleLength;
      const segment = createElevatedSegmentEntity(template.definition, {
        id: `map-${template.id}-${repeat}`,
        height: template.height,
        entryLength: template.entryLength,
        flatLength: template.flatLength,
        exitLength: template.exitLength,
        startFlow: template.startFlow + repeatOffset,
        hiddenRuntimeVisual: true,
      });
      segment.assetRefs = { ...template.assetRefs };
      segment.assetPlacement = { ...template.assetPlacement };
      segment.hiddenRuntimeVisual = true;
      segment.sourceKey = template.key;
      segments.push(segment);
    }
  });
  return segments;
}

export function resolveRunnerPitGapAtFlow(runner, flow) {
  const templates = Array.isArray(runner?.mapSpecialSegments?.pitTemplates)
    ? runner.mapSpecialSegments.pitTemplates
    : [];
  const cycleLength = Math.max(1, Number(runner?.mapSpecialSegments?.cycleLength || 600));
  const targetFlow = Number(flow || 0);
  for (const template of templates) {
    const minRepeat = Math.floor((targetFlow - template.endFlow) / cycleLength) - 1;
    const maxRepeat = Math.ceil((targetFlow - template.startFlow) / cycleLength) + 1;
    for (let repeat = minRepeat; repeat <= maxRepeat; repeat += 1) {
      const repeatOffset = repeat * cycleLength;
      const startFlow = template.startFlow + repeatOffset;
      const endFlow = template.endFlow + repeatOffset;
      if (targetFlow >= startFlow && targetFlow <= endFlow) {
        return {
          ...template,
          startFlow,
          endFlow,
          repeat,
        };
      }
    }
  }
  return null;
}

export function resolveElevatedTrackAtFlow(elevatedSegments, flow) {
  const segments = Array.isArray(elevatedSegments) ? elevatedSegments : [];
  for (const segment of segments) {
    const startFlow = Number(segment?.startFlow || 0);
    const plateauStartFlow = Number(segment?.plateauStartFlow || startFlow);
    const descentStartFlow = Number(segment?.descentStartFlow || plateauStartFlow);
    const endFlow = Number(segment?.endFlow || descentStartFlow);
    const height = Math.max(0, Number(segment?.height || 0));
    if (flow < startFlow || flow > endFlow) continue;
    if (flow <= plateauStartFlow) {
      const progress = smoothstep01((flow - startFlow) / Math.max(0.0001, plateauStartFlow - startFlow));
      return {
        segment,
        phase: "entry",
        height: height * progress,
        plateauHeight: height,
      };
    }
    if (flow <= descentStartFlow) {
      return {
        segment,
        phase: "plateau",
        height,
        plateauHeight: height,
      };
    }
    const progress = smoothstep01((flow - descentStartFlow) / Math.max(0.0001, endFlow - descentStartFlow));
    return {
      segment,
      phase: "exit",
      height: height * (1 - progress),
      plateauHeight: height,
    };
  }
  return {
    segment: null,
    phase: "ground",
    height: 0,
    plateauHeight: 0,
  };
}

export function updateRunnerElevatedSegments(runner, dt = 0.016) {
  runner.dynamicElevatedSegments = (runner.dynamicElevatedSegments || []).filter(
    (segment) => Number(segment?.endFlow || 0) >= runner.worldFlow - 28
  );
  const fixedSegments = runner.useMapSpecialSegments ? materializeRunnerMapElevatedSegments(runner) : [];
  runner.elevatedSegments = [...fixedSegments, ...(runner.dynamicElevatedSegments || [])];
  const activeTrack = resolveElevatedTrackAtFlow(runner.elevatedSegments, runner.worldFlow);
  runner.trackHeight = activeTrack.height;
  const lerpFactor = Math.min(1, (runner.trackHeightLerp || RUNNER_ELEVATED_SEGMENT_TUNING.trackHeightLerp) * dt);
  runner.trackHeightVisual += (runner.trackHeight - runner.trackHeightVisual) * lerpFactor;
  runner.activeElevatedSegmentId = String(activeTrack.segment?.id || "");
  runner.activeTrackPhase = activeTrack.phase;
  return activeTrack;
}

export function ensureRunnerElevatedSegmentSpawn(runner) {
  if (!RUNNER_ELEVATED_SEGMENT_TUNING.autoSpawnEnabled) {
    runner.nextElevatedSpawnFlow = Number.POSITIVE_INFINITY;
    return;
  }
  if (typeof runner.nextElevatedSpawnFlow !== "number" || runner.nextElevatedSpawnFlow <= 0) {
    runner.nextElevatedSpawnFlow =
      runner.worldFlow +
      RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMin +
      Math.random() * (RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMax - RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMin);
  }
}

export function spawnRunnerElevatedSegment(runner) {
  if (!RUNNER_ELEVATED_SEGMENT_TUNING.autoSpawnEnabled) return null;
  if (runner.useMapSpecialSegments) return null;
  ensureRunnerElevatedSegmentSpawn(runner);
  if (runner.worldFlow < runner.nextElevatedSpawnFlow) return null;
  const definition = pickSpawnableElevatedSegmentDefinition();
  if (!definition) return null;
  const spawnAheadFlow =
    RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMin +
    Math.random() * (RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMax - RUNNER_ELEVATED_SEGMENT_TUNING.spawnAheadFlowMin);
  const segment = createElevatedSegmentEntity(definition, {
    id: `seg-${runner.nextId++}`,
    startFlow: runner.worldFlow + spawnAheadFlow,
  });
  runner.dynamicElevatedSegments.push(segment);
  runner.nextElevatedSpawnFlow =
    segment.endFlow +
    RUNNER_ELEVATED_SEGMENT_TUNING.gapAfterSegmentMin +
    Math.random() * (RUNNER_ELEVATED_SEGMENT_TUNING.gapAfterSegmentMax - RUNNER_ELEVATED_SEGMENT_TUNING.gapAfterSegmentMin);
  return segment;
}

export function resolveElevatedTrackForDistance(runner, logicalDistance) {
  const futureFlow = runner.worldFlow + Math.max(0, Number(logicalDistance || 0));
  return resolveElevatedTrackAtFlow(runner.elevatedSegments, futureFlow);
}
