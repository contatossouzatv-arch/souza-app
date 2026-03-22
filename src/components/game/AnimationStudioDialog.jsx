import React from "react";
import * as THREE from "three";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { resolveAssetUrl } from "@/api/base44Client";

function resolveSceneUploadUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/api/uploads/")) return resolveAssetUrl(raw);
  if (raw.startsWith("uploads/") || raw.startsWith("api/uploads/")) return resolveAssetUrl(`/${raw}`);
  if (raw.startsWith("\\uploads\\") || raw.startsWith("uploads\\") || raw.startsWith("\\api\\uploads\\")) {
    return resolveAssetUrl(raw.replace(/\\/g, "/").replace(/^\/?/, "/"));
  }
  return raw;
}

function detectModelExt(url) {
  const safe = String(url || "").toLowerCase().split("?")[0].split("#")[0];
  if (safe.endsWith(".fbx")) return "fbx";
  if (safe.endsWith(".obj")) return "obj";
  if (safe.endsWith(".stl")) return "stl";
  return "gltf";
}

const BLANK_TEXTURE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg6nxsV0AAAAASUVORK5CYII=";

function isLikelyImageUrl(url) {
  const safe = String(url || "").trim().toLowerCase().split("?")[0].split("#")[0];
  return /\.(png|jpg|jpeg|webp|bmp|tga|gif)$/i.test(safe);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function createFrame(time, rotation = {}, position = {}, easing = "smooth") {
  return {
    id: uid("kf"),
    time: Math.round(clamp(time, 0, 60) * 1000) / 1000,
    rotation: { x: Number(rotation.x || 0), y: Number(rotation.y || 0), z: Number(rotation.z || 0) },
    position: { x: Number(position.x || 0), y: Number(position.y || 0), z: Number(position.z || 0) },
    easing,
  };
}

function createClip(name = "Idle", duration = 1.2) {
  return {
    id: uid("clip"),
    name,
    duration: clamp(duration, 0.2, 20),
    loop: true,
    dynamics: { enabled: true, gravity: 0.25, softness: 0.45, bounce: 0.2, glow: 0, pulse: 0.15 },
    tracks: {},
  };
}

function normalizeStudioData(value) {
  if (!value || typeof value !== "object") {
    const clip = createClip("Idle", 1.2);
    return { version: 1, activeClipId: clip.id, clips: [clip], rigLayout: null, autoBind: null, autoBindMap: null, extraControls: [], savedAt: null };
  }
  const clips = Array.isArray(value.clips) && value.clips.length ? value.clips.map((clip, index) => ({
    ...createClip(String(clip?.name || `Clip ${index + 1}`), Number(clip?.duration || 1.2)),
    ...clip,
    id: String(clip?.id || uid("clip")),
    duration: clamp(clip?.duration, 0.2, 20),
    tracks: Object.fromEntries(
      Object.entries(clip?.tracks || {}).map(([targetId, frames]) => [
        targetId,
        Array.isArray(frames)
          ? frames.map((frame) => ({
            id: String(frame?.id || uid("kf")),
            time: Math.round(clamp(frame?.time, 0, 60) * 1000) / 1000,
            rotation: { x: Number(frame?.rotation?.x || 0), y: Number(frame?.rotation?.y || 0), z: Number(frame?.rotation?.z || 0) },
            position: { x: Number(frame?.position?.x || 0), y: Number(frame?.position?.y || 0), z: Number(frame?.position?.z || 0) },
            easing: String(frame?.easing || "smooth"),
          })).sort((a, b) => a.time - b.time)
          : [],
      ])
    ),
    dynamics: {
      enabled: clip?.dynamics?.enabled !== false,
      gravity: clamp(clip?.dynamics?.gravity, 0, 1),
      softness: clamp(clip?.dynamics?.softness, 0, 1),
      bounce: clamp(clip?.dynamics?.bounce, 0, 1),
      glow: clamp(clip?.dynamics?.glow, 0, 1),
      pulse: clamp(clip?.dynamics?.pulse, 0, 1),
    },
  })) : [createClip("Idle", 1.2)];
  return {
    version: 1,
    activeClipId: String(value.activeClipId || clips[0].id),
    clips,
    rigLayout: value.rigLayout && typeof value.rigLayout === "object" ? value.rigLayout : null,
    autoBind: value.autoBind && typeof value.autoBind === "object" ? value.autoBind : null,
    autoBindMap: value.autoBindMap && typeof value.autoBindMap === "object" ? value.autoBindMap : null,
    extraControls: Array.isArray(value.extraControls) ? value.extraControls.map((item, index) => ({
      id: String(item?.id || uid("extra")),
      label: String(item?.label || `Controle ${index + 1}`),
      normalized: {
        x: Number(clamp(item?.normalized?.x, 0, 1).toFixed(4)),
        y: Number(clamp(item?.normalized?.y, 0, 1).toFixed(4)),
        z: Number(clamp(item?.normalized?.z, 0, 1).toFixed(4)),
      },
    })) : [],
    landmarks: value.landmarks && typeof value.landmarks === "object" ? value.landmarks : null,
    savedAt: value.savedAt || null,
  };
}

function easeValue(alpha, easing) {
  if (easing === "step") return 0;
  if (easing === "linear") return alpha;
  return alpha * alpha * (3 - 2 * alpha);
}

function sampleFrames(frames, time) {
  if (!Array.isArray(frames) || !frames.length) return { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } };
  if (frames.length === 1 || time <= frames[0].time) return frames[0];
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i += 1) {
    const current = frames[i];
    const next = frames[i + 1];
    if (time < current.time || time > next.time) continue;
    const span = Math.max(0.0001, next.time - current.time);
    const alpha = easeValue((time - current.time) / span, next.easing || current.easing || "smooth");
    return {
      rotation: {
        x: THREE.MathUtils.lerp(current.rotation.x, next.rotation.x, alpha),
        y: THREE.MathUtils.lerp(current.rotation.y, next.rotation.y, alpha),
        z: THREE.MathUtils.lerp(current.rotation.z, next.rotation.z, alpha),
      },
      position: {
        x: THREE.MathUtils.lerp(current.position.x, next.position.x, alpha),
        y: THREE.MathUtils.lerp(current.position.y, next.position.y, alpha),
        z: THREE.MathUtils.lerp(current.position.z, next.position.z, alpha),
      },
    };
  }
  return frames[frames.length - 1];
}

function formatSeconds(value) {
  return `${Number(value || 0).toFixed(2)}s`;
}

function parseTrackNodeName(trackName) {
  const raw = String(trackName || "");
  const dotIndex = raw.indexOf(".");
  return dotIndex >= 0 ? raw.slice(0, dotIndex) : raw;
}

function compactImportedFrames(frames) {
  if (!Array.isArray(frames) || frames.length <= 2) return Array.isArray(frames) ? frames : [];
  const kept = [frames[0]];
  for (let index = 1; index < frames.length - 1; index += 1) {
    const prev = kept[kept.length - 1];
    const current = frames[index];
    const next = frames[index + 1];
    const rotDeltaPrev =
      Math.abs(current.rotation.x - prev.rotation.x) +
      Math.abs(current.rotation.y - prev.rotation.y) +
      Math.abs(current.rotation.z - prev.rotation.z);
    const posDeltaPrev =
      Math.abs(current.position.x - prev.position.x) +
      Math.abs(current.position.y - prev.position.y) +
      Math.abs(current.position.z - prev.position.z);
    const rotDeltaNext =
      Math.abs(next.rotation.x - current.rotation.x) +
      Math.abs(next.rotation.y - current.rotation.y) +
      Math.abs(next.rotation.z - current.rotation.z);
    const posDeltaNext =
      Math.abs(next.position.x - current.position.x) +
      Math.abs(next.position.y - current.position.y) +
      Math.abs(next.position.z - current.position.z);
    const isFlat = rotDeltaPrev < 0.0015 && posDeltaPrev < 0.0015 && rotDeltaNext < 0.0015 && posDeltaNext < 0.0015;
    if (!isFlat) kept.push(current);
  }
  kept.push(frames[frames.length - 1]);
  return kept;
}

const LANDMARK_POINTS = [
  { id: "chin", label: "Queixo" },
  { id: "pelvis", label: "Bacia" },
  { id: "elbow_l", label: "Cotovelo E" },
  { id: "elbow_r", label: "Cotovelo D" },
  { id: "wrist_l", label: "Pulso E" },
  { id: "wrist_r", label: "Pulso D" },
  { id: "knee_l", label: "Joelho E" },
  { id: "knee_r", label: "Joelho D" },
  { id: "foot_l", label: "Pe E" },
  { id: "foot_r", label: "Pe D" },
];

const CENTER_LANDMARK_IDS = new Set(["chin", "pelvis"]);

const MIRROR_LANDMARK_MAP = {
  elbow_l: "elbow_r",
  elbow_r: "elbow_l",
  wrist_l: "wrist_r",
  wrist_r: "wrist_l",
  knee_l: "knee_r",
  knee_r: "knee_l",
  foot_l: "foot_r",
  foot_r: "foot_l",
};

function createDefaultGuideOptions() {
  return {
    centerX: 0.5,
    snapCenter: true,
    forceSymmetry: true,
    insideMesh: true,
    modelYaw: 0,
  };
}

const AUTO_RIG_TEMPLATES = {
  biped: {
    label: "Bipede",
    icon: "Hum",
    accent: "cyan",
    description: "Personagens runner, humanos e NPCs com mochila.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.08, 0] },
      { id: "hips", label: "Quadril", pos: [0, 0.26, 0] },
      { id: "spine", label: "Tronco", pos: [0, 0.52, 0] },
      { id: "head", label: "Cabeca", pos: [0, 0.9, 0] },
      { id: "arm_l", label: "Braco E", pos: [-0.34, 0.62, 0] },
      { id: "arm_r", label: "Braco D", pos: [0.34, 0.62, 0] },
      { id: "leg_l", label: "Perna E", pos: [-0.16, 0.08, 0] },
      { id: "leg_r", label: "Perna D", pos: [0.16, 0.08, 0] },
      { id: "bag", label: "Mochila", pos: [0, 0.58, -0.18] },
    ],
  },
  quadruped: {
    label: "Quadrupede",
    icon: "Pet",
    accent: "emerald",
    description: "Animais de quatro patas, montarias e criaturas baixas.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.14, 0] },
      { id: "hips", label: "Quadril", pos: [0, 0.34, -0.24] },
      { id: "spine", label: "Tronco", pos: [0, 0.42, 0.02] },
      { id: "head", label: "Cabeca", pos: [0, 0.58, 0.46] },
      { id: "arm_l", label: "Pata F E", pos: [-0.22, 0.14, 0.28] },
      { id: "arm_r", label: "Pata F D", pos: [0.22, 0.14, 0.28] },
      { id: "leg_l", label: "Pata T E", pos: [-0.22, 0.12, -0.3] },
      { id: "leg_r", label: "Pata T D", pos: [0.22, 0.12, -0.3] },
      { id: "tail", label: "Cauda", pos: [0, 0.36, -0.52] },
    ],
  },
  prop: {
    label: "Objeto",
    icon: "Obj",
    accent: "amber",
    description: "Baus, props articulados, portas, tampas e mecanismos.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.08, 0] },
      { id: "core", label: "Corpo", pos: [0, 0.5, 0] },
      { id: "lid", label: "Tampa", pos: [0, 0.86, 0] },
      { id: "arm_l", label: "Aleta E", pos: [-0.42, 0.52, 0] },
      { id: "arm_r", label: "Aleta D", pos: [0.42, 0.52, 0] },
    ],
  },
  bird: {
    label: "Ave",
    icon: "Fly",
    accent: "fuchsia",
    description: "Aves, asas, drones leves e personagens voadores.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.1, 0] },
      { id: "spine", label: "Tronco", pos: [0, 0.44, 0] },
      { id: "head", label: "Cabeca", pos: [0, 0.72, 0.26] },
      { id: "arm_l", label: "Asa E", pos: [-0.42, 0.46, 0] },
      { id: "arm_r", label: "Asa D", pos: [0.42, 0.46, 0] },
      { id: "leg_l", label: "Perna E", pos: [-0.12, 0.08, -0.06] },
      { id: "leg_r", label: "Perna D", pos: [0.12, 0.08, -0.06] },
    ],
  },
  fish: {
    label: "Peixe",
    icon: "Sea",
    accent: "sky",
    description: "Corpos alongados com cauda e nadadeiras laterais.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.5, 0] },
      { id: "spine", label: "Corpo", pos: [0, 0.5, 0] },
      { id: "head", label: "Cabeca", pos: [0, 0.54, 0.42] },
      { id: "tail", label: "Cauda", pos: [0, 0.48, -0.48] },
      { id: "fin_l", label: "Nadadeira E", pos: [-0.34, 0.44, 0.04] },
      { id: "fin_r", label: "Nadadeira D", pos: [0.34, 0.44, 0.04] },
    ],
  },
  snake: {
    label: "Serpente",
    icon: "Rig",
    accent: "violet",
    description: "Corpos segmentados, correntes orgânicas e tentáculos.",
    controls: [
      { id: "root", label: "Root", pos: [0, 0.14, -0.4] },
      { id: "spine_1", label: "Corpo 1", pos: [0, 0.18, -0.15] },
      { id: "spine_2", label: "Corpo 2", pos: [0, 0.2, 0.15] },
      { id: "head", label: "Cabeca", pos: [0, 0.24, 0.5] },
    ],
  },
};

const AUTO_BIND_MODES = {
  proximity: {
    label: "Proximidade",
    short: "Perto",
    description: "Pega partes próximas do controle. Melhor para personagens simples.",
    accent: "sky",
  },
  envelope: {
    label: "Envelope",
    short: "Suave",
    description: "Cria volumes mais macios ao redor do osso. Bom para animais.",
    accent: "emerald",
  },
  hinge: {
    label: "Dobradiça",
    short: "Duro",
    description: "Articula partes rígidas como tampa, porta e hélice.",
    accent: "amber",
  },
};

const PRESET_LIBRARY = [
  { key: "idle", label: "Idle", tone: "emerald", description: "Base parada com leve balanço." },
  { key: "run", label: "Corrida", tone: "cyan", description: "Loop principal para runner." },
  { key: "jump", label: "Pulo", tone: "fuchsia", description: "Salto curto com arco." },
  { key: "slide", label: "Slide", tone: "amber", description: "Deslize rápido para obstáculo." },
  { key: "lane_left", label: "Pista E", tone: "sky", description: "Troca de faixa para esquerda." },
  { key: "lane_right", label: "Pista D", tone: "violet", description: "Troca de faixa para direita." },
];

function getAccentClasses(accent, active) {
  const palette = {
    cyan: active ? "border-cyan-400/70 bg-cyan-900/35 text-cyan-100" : "border-cyan-900/40 bg-cyan-950/14 text-cyan-100/90",
    emerald: active ? "border-emerald-400/70 bg-emerald-900/35 text-emerald-100" : "border-emerald-900/40 bg-emerald-950/14 text-emerald-100/90",
    amber: active ? "border-amber-400/70 bg-amber-900/35 text-amber-100" : "border-amber-900/40 bg-amber-950/14 text-amber-100/90",
    fuchsia: active ? "border-fuchsia-400/70 bg-fuchsia-900/35 text-fuchsia-100" : "border-fuchsia-900/40 bg-fuchsia-950/14 text-fuchsia-100/90",
    sky: active ? "border-sky-400/70 bg-sky-900/35 text-sky-100" : "border-sky-900/40 bg-sky-950/14 text-sky-100/90",
    violet: active ? "border-violet-400/70 bg-violet-900/35 text-violet-100" : "border-violet-900/40 bg-violet-950/14 text-violet-100/90",
  };
  return palette[accent] || (active ? "border-cyan-400/70 bg-cyan-900/35 text-cyan-100" : "border-slate-700 bg-slate-950/85 text-slate-300");
}

function buildAutoRigLayout(templateKey = "biped") {
  const template = AUTO_RIG_TEMPLATES[templateKey] || AUTO_RIG_TEMPLATES.biped;
  return {
    template: templateKey,
    controls: template.controls.map((control) => ({
      id: control.id,
      label: control.label,
      pos: [...control.pos],
    })),
  };
}

function buildRigLayoutFromLandmarks(landmarks = {}, guideOptions = {}) {
  const centerX = clamp(guideOptions.centerX, 0.1, 0.9);
  const pelvis = landmarks.pelvis || { x: centerX, y: 0.28, z: 0.5 };
  const chin = landmarks.chin || { x: centerX, y: 0.82, z: 0.5 };
  const wristL = landmarks.wrist_l || { x: 0.18, y: 0.54, z: 0.5 };
  const wristR = landmarks.wrist_r || { x: 0.82, y: 0.54, z: 0.5 };
  const elbowL = landmarks.elbow_l || { x: 0.28, y: 0.58, z: 0.5 };
  const elbowR = landmarks.elbow_r || { x: 0.72, y: 0.58, z: 0.5 };
  const kneeL = landmarks.knee_l || { x: 0.4, y: 0.16, z: 0.5 };
  const kneeR = landmarks.knee_r || { x: 0.6, y: 0.16, z: 0.5 };
  const footL = landmarks.foot_l || { x: 0.4, y: 0.03, z: 0.56 };
  const footR = landmarks.foot_r || { x: 0.6, y: 0.03, z: 0.56 };
  const toTemplate = (point) => [Number(((point.x - 0.5) * 2).toFixed(4)), Number(point.y.toFixed(4)), Number(((point.z - 0.5) * 2).toFixed(4))];
  const toNormalized = (point) => ({
    x: Number(clamp(point.x, 0, 1).toFixed(4)),
    y: Number(clamp(point.y, 0, 1).toFixed(4)),
    z: Number(clamp(point.z, 0, 1).toFixed(4)),
  });
  const avg = (a, b, axis) => Number((((a?.[axis] ?? 0.5) + (b?.[axis] ?? 0.5)) * 0.5).toFixed(4));
  const torsoHeight = Math.max(0.08, chin.y - pelvis.y);
  const headLift = clamp(torsoHeight * 0.08, 0.015, 0.04);
  const rootPoint = {
    x: Number(centerX.toFixed(4)),
    y: Number((Math.max(0.02, Math.min(footL.y, footR.y) + 0.015)).toFixed(4)),
    z: Number(avg(footL, footR, "z").toFixed(4)),
  };
  const spinePoint = {
    x: Number(centerX.toFixed(4)),
    y: Number((pelvis.y + torsoHeight * 0.56).toFixed(4)),
    z: Number(avg(pelvis, chin, "z").toFixed(4)),
  };
  const headPoint = {
    x: Number(centerX.toFixed(4)),
    y: Number(clamp(chin.y + headLift, 0, 1).toFixed(4)),
    z: Number(chin.z.toFixed(4)),
  };
  const armLPoint = landmarks.elbow_l
    ? { x: Number(elbowL.x.toFixed(4)), y: Number(elbowL.y.toFixed(4)), z: Number(elbowL.z.toFixed(4)) }
    : { x: Number(avg(elbowL, wristL, "x").toFixed(4)), y: Number(avg(elbowL, wristL, "y").toFixed(4)), z: Number(avg(elbowL, wristL, "z").toFixed(4)) };
  const armRPoint = landmarks.elbow_r
    ? { x: Number(elbowR.x.toFixed(4)), y: Number(elbowR.y.toFixed(4)), z: Number(elbowR.z.toFixed(4)) }
    : { x: Number(avg(elbowR, wristR, "x").toFixed(4)), y: Number(avg(elbowR, wristR, "y").toFixed(4)), z: Number(avg(elbowR, wristR, "z").toFixed(4)) };
  const legLPoint = { x: Number(avg(kneeL, footL, "x").toFixed(4)), y: Number(avg(kneeL, footL, "y").toFixed(4)), z: Number(avg(kneeL, footL, "z").toFixed(4)) };
  const legRPoint = { x: Number(avg(kneeR, footR, "x").toFixed(4)), y: Number(avg(kneeR, footR, "y").toFixed(4)), z: Number(avg(kneeR, footR, "z").toFixed(4)) };
  const bagPoint = {
    x: Number(spinePoint.x.toFixed(4)),
    y: Number((spinePoint.y + torsoHeight * 0.08).toFixed(4)),
    z: Number(clamp(spinePoint.z - 0.05, 0, 1).toFixed(4)),
  };
  return {
    template: "biped_custom",
    source: "landmarks",
    controls: [
      { id: "root", label: "Root", pos: toTemplate(rootPoint), normalized: toNormalized(rootPoint) },
      { id: "hips", label: "Quadril", pos: toTemplate(pelvis), normalized: toNormalized(pelvis) },
      { id: "spine", label: "Tronco", pos: toTemplate(spinePoint), normalized: toNormalized(spinePoint) },
      { id: "head", label: "Cabeca", pos: toTemplate(headPoint), normalized: toNormalized(headPoint) },
      { id: "arm_l", label: "Braco E", pos: toTemplate(armLPoint), normalized: toNormalized(armLPoint) },
      { id: "arm_r", label: "Braco D", pos: toTemplate(armRPoint), normalized: toNormalized(armRPoint) },
      { id: "leg_l", label: "Perna E", pos: toTemplate(legLPoint), normalized: toNormalized(legLPoint) },
      { id: "leg_r", label: "Perna D", pos: toTemplate(legRPoint), normalized: toNormalized(legRPoint) },
      { id: "bag", label: "Mochila", pos: toTemplate(bagPoint), normalized: toNormalized(bagPoint) },
    ],
  };
}

function createDefaultAutoBind(templateKey = "biped") {
  const base = templateKey === "prop"
    ? { mode: "hinge", radius: 0.28, falloff: 0.42, mirror: false, normalize: true, stiffness: 0.78 }
    : templateKey === "quadruped"
      ? { mode: "envelope", radius: 0.34, falloff: 0.56, mirror: true, normalize: true, stiffness: 0.62 }
      : { mode: "proximity", radius: 0.3, falloff: 0.5, mirror: true, normalize: true, stiffness: 0.58 };
  return {
    template: templateKey,
    ...base,
  };
}

function instantiateAutoRigTargets(modelRoot, layout) {
  if (!modelRoot || !layout?.controls?.length) return [];
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  const safeSize = new THREE.Vector3(
    Math.max(size.x, 0.001),
    Math.max(size.y, 0.001),
    Math.max(size.z, 0.001)
  );
  return layout.controls.map((control) => {
    const anchor = new THREE.Object3D();
    anchor.name = `auto_rig_${control.id}`;
    const normalized = control.normalized && typeof control.normalized === "object"
      ? {
        x: clamp(control.normalized.x, 0, 1),
        y: clamp(control.normalized.y, 0, 1),
        z: clamp(control.normalized.z, 0, 1),
      }
      : {
        x: clamp(control.pos[0] * 0.5 + 0.5, 0, 1),
        y: clamp(control.pos[1], 0, 1),
        z: clamp(control.pos[2] * 0.5 + 0.5, 0, 1),
      };
    anchor.position.set(
      min.x + safeSize.x * normalized.x,
      min.y + safeSize.y * normalized.y,
      min.z + safeSize.z * normalized.z
    );
    modelRoot.add(anchor);
    return {
      id: control.id,
      label: control.label,
      object: anchor,
      objectName: anchor.name,
      baseRotation: anchor.rotation.clone(),
      basePosition: anchor.position.clone(),
    };
  });
}

function instantiateExtraControls(modelRoot, controls) {
  if (!modelRoot || !Array.isArray(controls) || !controls.length) return [];
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  const safeSize = new THREE.Vector3(
    Math.max(size.x, 0.001),
    Math.max(size.y, 0.001),
    Math.max(size.z, 0.001)
  );
  return controls.map((control) => {
    const anchor = new THREE.Object3D();
    anchor.name = `extra_ctrl_${control.id}`;
    anchor.position.set(
      min.x + safeSize.x * clamp(control?.normalized?.x, 0, 1),
      min.y + safeSize.y * clamp(control?.normalized?.y, 0, 1),
      min.z + safeSize.z * clamp(control?.normalized?.z, 0, 1)
    );
    modelRoot.add(anchor);
    return {
      id: control.id,
      label: control.label,
      object: anchor,
      objectName: anchor.name,
      baseRotation: anchor.rotation.clone(),
      basePosition: anchor.position.clone(),
      isExtraControl: true,
    };
  });
}

function smoothFalloff(value) {
  const alpha = clamp(value, 0, 1);
  return alpha * alpha * (3 - 2 * alpha);
}

function resolveBindRadius(bind) {
  const radius = Number(bind?.radius || 0.3);
  return clamp(radius, 0.08, 1) * 1.85;
}

function computeBindWeight(localPoint, anchorPoint, bind, controlId) {
  const dx = localPoint.x - anchorPoint.x;
  const dy = localPoint.y - anchorPoint.y;
  const dz = localPoint.z - anchorPoint.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const radius = Math.max(0.0001, resolveBindRadius(bind));
  let weight = 1 - distance / radius;
  if (bind?.mode === "hinge") {
    weight = 1 - Math.abs(dy) / Math.max(0.0001, radius * 1.35);
    if (/lid|head|tail/i.test(String(controlId || ""))) weight *= 1 - Math.min(1, Math.abs(dx) / (radius * 1.8));
  }
  const falloff = clamp(bind?.falloff, 0.05, 1);
  if (bind?.mode === "envelope") {
    weight = smoothFalloff(weight) * (1 - falloff * 0.35) + Math.max(0, weight) * falloff * 0.35;
  } else if (bind?.mode === "hinge") {
    weight = Math.max(0, weight);
  } else {
    weight = Math.pow(Math.max(0, weight), THREE.MathUtils.lerp(0.6, 2.2, falloff));
  }
  return clamp(weight, 0, 1);
}

function buildAutoBindPreview(meshes, targets, bindSettings) {
  if (!Array.isArray(meshes) || !meshes.length || !Array.isArray(targets) || !targets.length) return [];
  const bind = bindSettings || createDefaultAutoBind("biped");
  const result = [];
  const tempVertex = new THREE.Vector3();
  const tempAnchor = new THREE.Vector3();
  targets.forEach((target) => target.object?.updateWorldMatrix?.(true, false));
  meshes.forEach((mesh) => {
    const positionAttr = mesh.geometry?.getAttribute?.("position");
    if (!positionAttr?.count) return;
    const restArray = mesh.userData?.__studioRestPositionArray instanceof Float32Array
      ? mesh.userData.__studioRestPositionArray
      : new Float32Array(positionAttr.array);
    if (!(mesh.userData?.__studioRestPositionArray instanceof Float32Array)) {
      mesh.userData.__studioRestPositionArray = restArray.slice(0);
    }
    const meshEntry = {
      mesh,
      baseArray: restArray.slice(0),
      items: [],
    };
    const totals = bind?.normalize ? new Float32Array(positionAttr.count) : null;
    targets.forEach((target) => {
      if (!target.object) return;
      tempAnchor.copy(mesh.worldToLocal(target.object.getWorldPosition(new THREE.Vector3())));
      const weighted = [];
      for (let i = 0; i < positionAttr.count; i += 1) {
        tempVertex.fromArray(restArray, i * 3);
        const weight = computeBindWeight(tempVertex, tempAnchor, bind, target.id);
        if (weight <= 0.001) continue;
        weighted.push(i, weight);
        if (totals) totals[i] += weight;
      }
      if (weighted.length) {
        meshEntry.items.push({
          targetId: target.id,
          anchorLocal: tempAnchor.clone(),
          weights: new Float32Array(weighted),
        });
      }
    });
    if (totals) {
      meshEntry.items = meshEntry.items.map((item) => {
        const normalized = new Float32Array(item.weights.length);
        for (let i = 0; i < item.weights.length; i += 2) {
          const vertexIndex = item.weights[i];
          const total = totals[vertexIndex];
          normalized[i] = vertexIndex;
          normalized[i + 1] = total > 0.0001 ? item.weights[i + 1] / total : item.weights[i + 1];
        }
        return { ...item, weights: normalized };
      });
    }
    if (meshEntry.items.length) result.push(meshEntry);
  });
  return result;
}

function buildAutoBindSnapshot(autoBindPreview, bindSettings, targets) {
  if (!Array.isArray(autoBindPreview) || !autoBindPreview.length) return null;
  const controls = (targets || []).map((target) => {
    const samples = [];
    let influenced = 0;
    let peak = 0;
    autoBindPreview.forEach((meshEntry, meshIndex) => {
      const item = meshEntry.items.find((entry) => entry.targetId === target.id);
      if (!item?.weights?.length) return;
      const samplePairs = [];
      for (let i = 0; i < item.weights.length && samplePairs.length < 24; i += 12) {
        const vertexIndex = item.weights[i];
        const weight = item.weights[i + 1];
        if (!Number.isFinite(vertexIndex) || !Number.isFinite(weight)) continue;
        samplePairs.push([Number(vertexIndex), Number(weight.toFixed(4))]);
      }
      influenced += Math.floor(item.weights.length / 2);
      for (let i = 1; i < item.weights.length; i += 2) peak = Math.max(peak, Number(item.weights[i] || 0));
      samples.push({
        meshIndex,
        anchor: [
          Number(item.anchorLocal.x.toFixed(4)),
          Number(item.anchorLocal.y.toFixed(4)),
          Number(item.anchorLocal.z.toFixed(4)),
        ],
        pairs: samplePairs,
      });
    });
    return {
      id: target.id,
      label: target.label,
      influenced,
      peak: Number(peak.toFixed(4)),
      samples,
    };
  }).filter((entry) => entry.influenced > 0);
  return {
    version: 1,
    bind: {
      mode: String(bindSettings?.mode || "proximity"),
      radius: Number(Number(bindSettings?.radius || 0.3).toFixed(4)),
      falloff: Number(Number(bindSettings?.falloff || 0.5).toFixed(4)),
      stiffness: Number(Number(bindSettings?.stiffness || 0.6).toFixed(4)),
      mirror: !!bindSettings?.mirror,
      normalize: !!bindSettings?.normalize,
    },
    meshVertexCounts: autoBindPreview.map((meshEntry) => Number(meshEntry.mesh.geometry?.getAttribute?.("position")?.count || 0)),
    controls,
    generatedAt: new Date().toISOString(),
  };
}

function collectGroups(bones) {
  const pick = (...patterns) => bones.find((bone) => patterns.some((pattern) => pattern.test(String(bone.name || ""))));
  return [
    { id: "root", label: "Root", boneName: "" },
    { id: "hips", label: "Quadril", boneName: pick(/hips|pelvis|root/i)?.name || "" },
    { id: "spine", label: "Tronco", boneName: pick(/spine|chest|torso/i)?.name || "" },
    { id: "head", label: "Cabeca", boneName: pick(/head|neck/i)?.name || "" },
    { id: "arm_l", label: "Braco E", boneName: pick(/left.*arm|arm.*left|upperarm_l|l_arm/i)?.name || "" },
    { id: "arm_r", label: "Braco D", boneName: pick(/right.*arm|arm.*right|upperarm_r|r_arm/i)?.name || "" },
    { id: "leg_l", label: "Perna E", boneName: pick(/left.*leg|leg.*left|upperleg_l|l_leg/i)?.name || "" },
    { id: "leg_r", label: "Perna D", boneName: pick(/right.*leg|leg.*right|upperleg_r|r_leg/i)?.name || "" },
    { id: "bag", label: "Mochila", boneName: pick(/bag|backpack|pack|cape/i)?.name || "" },
  ].filter((item, index, arr) => item.id === "root" || (item.boneName && arr.findIndex((entry) => entry.boneName === item.boneName) === index));
}

function collectBoneTargets(modelRoot, bones) {
  if (!modelRoot || !Array.isArray(bones) || !bones.length) return [];
  const unique = [];
  const seen = new Set();
  bones.forEach((bone, index) => {
    const name = String(bone?.name || `bone_${index}`);
    if (seen.has(name)) return;
    seen.add(name);
    unique.push({
      id: `bone_${name}`,
      label: name.replace(/^mixamorig:/i, ""),
      boneName: name,
      object: bone,
      objectName: name,
      baseRotation: bone.rotation.clone(),
      basePosition: bone.position.clone(),
      isImportedBone: true,
      isBoneTarget: true,
    });
  });
  return [{
    id: "root",
    label: "Root",
    boneName: "",
    object: modelRoot,
    objectName: "scene_root",
    baseRotation: modelRoot.rotation.clone(),
    basePosition: modelRoot.position.clone(),
  }, ...unique];
}

function collectNamedObjects(root) {
  const map = new Map();
  root?.traverse?.((node) => {
    const name = String(node?.name || "").trim();
    if (!name || map.has(name)) return;
    map.set(name, node);
  });
  return map;
}

function buildStudioClipFromAnimationClip(animationClip, sourceRoot, availableTargets) {
  if (!animationClip || !sourceRoot || !Array.isArray(availableTargets) || !availableTargets.length) return null;
  const objectMap = collectNamedObjects(sourceRoot);
  const clip = createClip(String(animationClip.name || "Clip importado"), Number(animationClip.duration || 1.2));
  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(animationClip);
  action.play();
  mixer.setTime(0);
  const samplesPerSecond = 18;
  const duration = Math.max(Number(animationClip.duration || 0), 0.2);
  const matchedTargets = availableTargets
    .map((target) => ({ target, source: objectMap.get(String(target.objectName || "")) }))
    .filter((entry) => entry.source);
  if (!matchedTargets.length) return null;
  const matchedNames = new Set(matchedTargets.map((entry) => String(entry.source?.name || entry.target.objectName || "")));
  const sampledTimes = new Set([0, Number(duration.toFixed(4))]);
  (animationClip.tracks || []).forEach((track) => {
    const nodeName = parseTrackNodeName(track?.name);
    if (!matchedNames.has(nodeName)) return;
    const times = Array.isArray(track?.times) || track?.times?.length ? Array.from(track.times) : [];
    times.forEach((time) => sampledTimes.add(Number(clamp(time, 0, duration).toFixed(4))));
  });
  if (sampledTimes.size <= 2) {
    const step = 1 / samplesPerSecond;
    for (let time = 0; time <= duration + 0.0001; time += step) {
      sampledTimes.add(Number(Math.min(duration, time).toFixed(4)));
    }
  }
  const orderedTimes = Array.from(sampledTimes).sort((a, b) => a - b);
  const basePoseMap = new Map();
  matchedTargets.forEach(({ target, source }) => {
    basePoseMap.set(target.id, {
      rotation: source.rotation.clone(),
      position: source.position.clone(),
    });
  });
  for (const safeTime of orderedTimes) {
    mixer.setTime(safeTime);
    matchedTargets.forEach(({ target, source }) => {
      const base = basePoseMap.get(target.id);
      if (!base) return;
      if (!clip.tracks[target.id]) clip.tracks[target.id] = [];
      clip.tracks[target.id].push(createFrame(
        safeTime,
        {
          x: Number((source.rotation.x - base.rotation.x).toFixed(4)),
          y: Number((source.rotation.y - base.rotation.y).toFixed(4)),
          z: Number((source.rotation.z - base.rotation.z).toFixed(4)),
        },
        {
          x: Number((source.position.x - base.position.x).toFixed(4)),
          y: Number((source.position.y - base.position.y).toFixed(4)),
          z: Number((source.position.z - base.position.z).toFixed(4)),
        }
      ));
    });
  }
  Object.keys(clip.tracks || {}).forEach((targetId) => {
    clip.tracks[targetId] = compactImportedFrames((clip.tracks[targetId] || []).sort((a, b) => a.time - b.time));
  });
  mixer.stopAllAction();
  mixer.uncacheClip(animationClip);
  mixer.uncacheRoot(sourceRoot);
  return clip;
}

function buildPresetClip(kind, targets) {
  const clip = createClip(
    kind === "run" ? "Corrida" :
      kind === "jump" ? "Pulo" :
        kind === "slide" ? "Deslizar" :
          kind === "lane_left" ? "Pista E" :
            kind === "lane_right" ? "Pista D" : "Idle",
    kind === "jump" ? 0.9 : kind.startsWith("lane") ? 0.42 : 1
  );
  const add = (id, frames) => {
    if (targets.some((target) => target.id === id)) clip.tracks[id] = frames;
  };
  if (kind === "idle") {
    add("spine", [createFrame(0, { x: 0.02 }), createFrame(0.5, { x: -0.03 }), createFrame(1, { x: 0.02 })]);
    add("head", [createFrame(0, { y: -0.04 }), createFrame(0.5, { y: 0.04 }), createFrame(1, { y: -0.04 })]);
  } else if (kind === "run") {
    add("arm_l", [createFrame(0, { x: 0.65 }), createFrame(0.5, { x: -0.75 }), createFrame(1, { x: 0.65 })]);
    add("arm_r", [createFrame(0, { x: -0.75 }), createFrame(0.5, { x: 0.65 }), createFrame(1, { x: -0.75 })]);
    add("leg_l", [createFrame(0, { x: -0.82 }), createFrame(0.5, { x: 0.74 }), createFrame(1, { x: -0.82 })]);
    add("leg_r", [createFrame(0, { x: 0.74 }), createFrame(0.5, { x: -0.82 }), createFrame(1, { x: 0.74 })]);
  } else if (kind === "jump") {
    add("root", [createFrame(0, {}, { y: 0 }), createFrame(0.35, {}, { y: 0.32 }), createFrame(0.9, {}, { y: 0 })]);
    add("arm_l", [createFrame(0, { x: -0.2 }), createFrame(0.32, { x: -1.1 }), createFrame(0.9, { x: -0.2 })]);
    add("arm_r", [createFrame(0, { x: -0.2 }), createFrame(0.32, { x: -1.1 }), createFrame(0.9, { x: -0.2 })]);
  } else if (kind === "slide") {
    add("root", [createFrame(0, {}, { y: 0 }), createFrame(0.18, {}, { y: -0.22 }), createFrame(1, {}, { y: -0.18 })]);
    add("spine", [createFrame(0, { x: 0 }), createFrame(0.18, { x: -0.7 }), createFrame(1, { x: -0.62 })]);
  } else if (kind === "lane_left" || kind === "lane_right") {
    const dir = kind === "lane_left" ? -1 : 1;
    add("root", [createFrame(0, {}, { x: 0 }), createFrame(0.2, {}, { x: dir * 0.18 }), createFrame(0.42, {}, { x: 0 })]);
    add("spine", [createFrame(0, { z: 0 }), createFrame(0.2, { z: dir * -0.28 }), createFrame(0.42, { z: 0 })]);
  }
  return clip;
}

function TimelineRow({ label, frames, duration, active, playhead = 0, onAddFrame, onSelectFrame, onSeek }) {
  return (
    <div className={`grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-2 ${active ? "border-cyan-400/40 bg-cyan-950/25" : "border-slate-800 bg-slate-900/65"}`}>
      <div className="truncate text-[11px] font-medium text-slate-200">{label}</div>
      <div
        className="relative h-9 rounded-lg border border-slate-800 bg-slate-950/90"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
          onSeek?.(ratio * Math.max(duration, 0.0001));
        }}
      >
        <div className="absolute inset-0 grid grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="border-r border-slate-800/80 last:border-r-0" />)}
        </div>
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-cyan-300/90"
          style={{ left: `${(clamp(playhead / Math.max(duration, 0.0001), 0, 1) * 100).toFixed(2)}%` }}
        />
        {frames.map((frame) => (
          <button
            key={frame.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectFrame?.(frame);
            }}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-fuchsia-300/90 bg-fuchsia-500"
            style={{ left: `${(clamp(frame.time / Math.max(duration, 0.0001), 0, 1) * 100).toFixed(2)}%` }}
            title={formatSeconds(frame.time)}
          />
        ))}
        <button type="button" onClick={(event) => { event.stopPropagation(); onAddFrame?.(); }} className="absolute right-1.5 top-1/2 h-5 -translate-y-1/2 rounded-md border border-cyan-500/40 bg-cyan-950/40 px-1.5 text-[10px] text-cyan-100">+KF</button>
      </div>
    </div>
  );
}

export default function AnimationStudioDialog({
  open,
  onOpenChange,
  modelUrl = "",
  modelLabel = "",
  studioData: studioDataProp = null,
  onStudioDataChange,
}) {
  const previewRef = React.useRef(null);
  const viewerRef = React.useRef({ getCurrentPose: () => null, setPose: () => {}, setTime: () => {}, getAutoBindSnapshot: () => null, setGuideView: () => {}, resetCamera: () => {}, setModelYaw: () => {} });
  const importMotionInputRef = React.useRef(null);
  const importedMotionSourcesRef = React.useRef({});
  const studioDataRef = React.useRef(normalizeStudioData(studioDataProp));
  const selectedClipIdRef = React.useRef(studioDataRef.current.activeClipId);
  const selectedTargetIdRef = React.useRef("root");
  const playheadRef = React.useRef(0);
  const isPlayingRef = React.useRef(false);
  const autoBindRef = React.useRef(createDefaultAutoBind(String(normalizeStudioData(studioDataProp)?.rigLayout?.template || "biped")));
  const activeLandmarkIdRef = React.useRef("");
  const landmarkDraftRef = React.useRef(normalizeStudioData(studioDataProp)?.landmarks || {});
  const guideOptionsRef = React.useRef(createDefaultGuideOptions());
  const lastEmittedRef = React.useRef("");
  const [studioData, setStudioData] = React.useState(() => normalizeStudioData(studioDataProp));
  const [selectedClipId, setSelectedClipId] = React.useState(() => normalizeStudioData(studioDataProp).activeClipId);
  const [selectedTargetId, setSelectedTargetId] = React.useState("root");
  const [selectedKeyframeId, setSelectedKeyframeId] = React.useState("");
  const [availableTargets, setAvailableTargets] = React.useState([{ id: "root", label: "Root", objectName: "scene_root" }]);
  const [playhead, setPlayhead] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [loadInfo, setLoadInfo] = React.useState({ message: "", bones: 0, skinnedMeshes: 0, hasSkeleton: false });
  const [detectedBoneNames, setDetectedBoneNames] = React.useState([]);
  const [sourceAnimations, setSourceAnimations] = React.useState([]);
  const [selectedRigTemplate, setSelectedRigTemplate] = React.useState(() => String(normalizeStudioData(studioDataProp)?.rigLayout?.template || "biped"));
  const [autoBindDraft, setAutoBindDraft] = React.useState(() => createDefaultAutoBind(String(normalizeStudioData(studioDataProp)?.rigLayout?.template || "biped")));
  const [libraryFilter, setLibraryFilter] = React.useState("all");
  const [bindInspector, setBindInspector] = React.useState({ influenced: 0, peak: 0, meshes: 0 });
  const [activeLandmarkId, setActiveLandmarkId] = React.useState("");
  const [landmarkDraft, setLandmarkDraft] = React.useState(() => normalizeStudioData(studioDataProp)?.landmarks || {});
  const [guideOptions, setGuideOptions] = React.useState(() => createDefaultGuideOptions());
  const [guideView, setGuideView] = React.useState("front");
  const [addControlMode, setAddControlMode] = React.useState(false);
  const [newControlLabel, setNewControlLabel] = React.useState("Controle extra");
  const [viewerLayoutNonce, setViewerLayoutNonce] = React.useState(0);
  const [dragPoseAutoKey, setDragPoseAutoKey] = React.useState(true);
  const [humanLegAssist, setHumanLegAssist] = React.useState(true);
  const [floppyMode, setFloppyMode] = React.useState(false);
  const [floppyGravity, setFloppyGravity] = React.useState(0.45);
  const [floppySoftness, setFloppySoftness] = React.useState(0.6);
  const [floppyScope, setFloppyScope] = React.useState("dangly");
  const [floppyAutoKey, setFloppyAutoKey] = React.useState(true);
  const [importedMotionClips, setImportedMotionClips] = React.useState([]);
  const [importedMotionLabel, setImportedMotionLabel] = React.useState("");
  const [motionImportStatus, setMotionImportStatus] = React.useState("");
  const guideViewRef = React.useRef("front");
  const dragPoseAutoKeyRef = React.useRef(true);
  const humanLegAssistRef = React.useRef(true);
  const floppyModeRef = React.useRef(false);
  const floppyGravityRef = React.useRef(0.45);
  const floppySoftnessRef = React.useRef(0.6);
  const floppyScopeRef = React.useRef("dangly");
  const floppyAutoKeyRef = React.useRef(true);

  React.useEffect(() => {
    studioDataRef.current = studioData;
  }, [studioData]);

  React.useEffect(() => {
    setSelectedRigTemplate(String(studioData?.rigLayout?.template || "biped"));
  }, [studioData?.rigLayout?.template]);

  React.useEffect(() => {
    const rigTemplate = String(studioData?.rigLayout?.template || selectedRigTemplate || "biped");
    const saved = studioData?.autoBind && typeof studioData.autoBind === "object" ? studioData.autoBind : null;
    setAutoBindDraft(saved ? { ...createDefaultAutoBind(rigTemplate), ...saved } : createDefaultAutoBind(rigTemplate));
  }, [selectedRigTemplate, studioData?.autoBind, studioData?.rigLayout?.template]);

  React.useEffect(() => {
    selectedClipIdRef.current = selectedClipId;
  }, [selectedClipId]);

  React.useEffect(() => {
    selectedTargetIdRef.current = selectedTargetId;
  }, [selectedTargetId]);

  React.useEffect(() => {
    setSelectedKeyframeId("");
  }, [selectedTargetId, selectedClipId]);

  React.useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  React.useEffect(() => {
    activeLandmarkIdRef.current = activeLandmarkId;
  }, [activeLandmarkId]);

  React.useEffect(() => {
    landmarkDraftRef.current = landmarkDraft || {};
  }, [landmarkDraft]);

  React.useEffect(() => {
    guideOptionsRef.current = guideOptions;
  }, [guideOptions]);

  React.useEffect(() => {
    dragPoseAutoKeyRef.current = dragPoseAutoKey;
  }, [dragPoseAutoKey]);

  React.useEffect(() => {
    humanLegAssistRef.current = humanLegAssist;
  }, [humanLegAssist]);

  React.useEffect(() => {
    floppyModeRef.current = floppyMode;
  }, [floppyMode]);

  React.useEffect(() => {
    floppyGravityRef.current = floppyGravity;
  }, [floppyGravity]);

  React.useEffect(() => {
    floppySoftnessRef.current = floppySoftness;
  }, [floppySoftness]);

  React.useEffect(() => {
    floppyScopeRef.current = floppyScope;
  }, [floppyScope]);

  React.useEffect(() => {
    floppyAutoKeyRef.current = floppyAutoKey;
  }, [floppyAutoKey]);

  React.useEffect(() => {
    viewerRef.current.setModelYaw?.(guideOptions.modelYaw);
  }, [guideOptions.modelYaw]);

  React.useEffect(() => {
    autoBindRef.current = {
      ...createDefaultAutoBind(selectedRigTemplate || "biped"),
      ...(studioData?.autoBind || {}),
      ...autoBindDraft,
      template: selectedRigTemplate || "biped",
    };
  }, [autoBindDraft, selectedRigTemplate, studioData?.autoBind]);

  React.useEffect(() => {
    const payload = { ...studioData, activeClipId: selectedClipId };
    const serialized = JSON.stringify(payload);
    if (lastEmittedRef.current === serialized) return;
    lastEmittedRef.current = serialized;
    onStudioDataChange?.(payload);
  }, [onStudioDataChange, selectedClipId, studioData]);

  const activeClip = React.useMemo(() => studioData.clips.find((clip) => clip.id === selectedClipId) || studioData.clips[0] || null, [selectedClipId, studioData]);
  const selectedTarget = React.useMemo(() => availableTargets.find((target) => target.id === selectedTargetId) || availableTargets[0] || null, [availableTargets, selectedTargetId]);
  const selectedFrames = React.useMemo(() => Array.isArray(activeClip?.tracks?.[selectedTargetId]) ? activeClip.tracks[selectedTargetId] : [], [activeClip, selectedTargetId]);
  const selectedFrame = React.useMemo(() => {
    const exact = selectedFrames.find((frame) => frame.id === selectedKeyframeId);
    if (exact) return exact;
    return selectedFrames.find((frame) => Math.abs(frame.time - playhead) < 0.001) || null;
  }, [playhead, selectedFrames, selectedKeyframeId]);
  const sampledPose = React.useMemo(() => sampleFrames(selectedFrames, playhead), [selectedFrames, playhead]);

  const patchStudio = React.useCallback((updater) => {
    setStudioData((prev) => normalizeStudioData(typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const patchActiveClip = React.useCallback((updater) => {
    patchStudio((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => {
        if (clip.id !== selectedClipId) return clip;
        return { ...clip, ...(typeof updater === "function" ? updater(clip) : updater) };
      }),
    }));
  }, [patchStudio, selectedClipId]);

  const upsertKeyframeForTarget = React.useCallback((targetId, poseOverride = null) => {
    const pose = poseOverride || viewerRef.current.getCurrentPose?.(targetId) || sampledPose;
    const targetLabel = availableTargets.find((target) => target.id === targetId)?.label || "controle";
    patchActiveClip((clip) => {
      const frames = Array.isArray(clip.tracks?.[targetId]) ? clip.tracks[targetId] : [];
      const frame = createFrame(playhead, pose.rotation, pose.position, "smooth");
      const exact = frames.findIndex((item) => Math.abs(item.time - playhead) < 0.001);
      const nextFrames = exact >= 0
        ? frames.map((item, index) => (index === exact ? { ...item, ...frame, id: item.id } : item))
        : [...frames, frame].sort((a, b) => a.time - b.time);
      return { tracks: { ...clip.tracks, [targetId]: nextFrames } };
    });
    setStatusMessage(`Keyframe salvo em ${formatSeconds(playhead)} para ${String(targetLabel)}.`);
  }, [availableTargets, patchActiveClip, playhead, sampledPose]);

  const upsertKeyframe = React.useCallback((poseOverride = null) => {
    upsertKeyframeForTarget(selectedTargetId, poseOverride);
  }, [selectedTargetId, upsertKeyframeForTarget]);

  const removeKeyframe = React.useCallback(() => {
    patchActiveClip((clip) => ({
      tracks: {
        ...clip.tracks,
        [selectedTargetId]: (clip.tracks?.[selectedTargetId] || []).filter((frame) => Math.abs(frame.time - playhead) >= 0.001),
      },
    }));
    setSelectedKeyframeId("");
  }, [patchActiveClip, playhead, selectedTargetId]);

  const selectFrame = React.useCallback((targetId, frame) => {
    if (!frame) return;
    setSelectedTargetId(targetId);
    setSelectedKeyframeId(frame.id);
    setIsPlaying(false);
    setPlayhead(frame.time);
  }, []);

  const stepToNeighborKeyframe = React.useCallback((direction) => {
    const frames = selectedFrames || [];
    if (!frames.length) return;
    let next = null;
    if (direction < 0) {
      for (let index = frames.length - 1; index >= 0; index -= 1) {
        if (frames[index].time < playhead - 0.0005) {
          next = frames[index];
          break;
        }
      }
      next = next || frames[0];
    } else {
      next = frames.find((frame) => frame.time > playhead + 0.0005) || frames[frames.length - 1];
    }
    if (next) selectFrame(selectedTargetId, next);
  }, [playhead, selectFrame, selectedFrames, selectedTargetId]);

  const updateSelectedKeyframe = React.useCallback((patch) => {
    if (!selectedFrame) return;
    patchActiveClip((clip) => {
      const frames = Array.isArray(clip.tracks?.[selectedTargetId]) ? clip.tracks[selectedTargetId] : [];
      const nextFrames = frames
        .map((frame) => (frame.id === selectedFrame.id ? { ...frame, ...patch } : frame))
        .sort((a, b) => a.time - b.time);
      return { tracks: { ...clip.tracks, [selectedTargetId]: nextFrames } };
    });
  }, [patchActiveClip, selectedFrame, selectedTargetId]);

  const nudgeSelectedKeyframe = React.useCallback((delta) => {
    if (!selectedFrame || !activeClip) return;
    const nextTime = clamp(Number(selectedFrame.time || 0) + delta, 0, Math.max(activeClip.duration || 0.2, 0.2));
    updateSelectedKeyframe({ time: Number(nextTime.toFixed(3)) });
    setPlayhead(Number(nextTime.toFixed(3)));
  }, [activeClip, selectedFrame, updateSelectedKeyframe]);

  const duplicateSelectedKeyframe = React.useCallback(() => {
    if (!selectedFrame || !activeClip) return;
    const nextTime = Number(clamp(Number(selectedFrame.time || 0) + 0.08, 0, Math.max(activeClip.duration || 0.2, 0.2)).toFixed(3));
    const duplicated = {
      ...selectedFrame,
      id: uid("kf"),
      time: nextTime,
    };
    patchActiveClip((clip) => {
      const frames = Array.isArray(clip.tracks?.[selectedTargetId]) ? clip.tracks[selectedTargetId] : [];
      return { tracks: { ...clip.tracks, [selectedTargetId]: [...frames, duplicated].sort((a, b) => a.time - b.time) } };
    });
    setSelectedKeyframeId(duplicated.id);
    setPlayhead(nextTime);
  }, [activeClip, patchActiveClip, selectedFrame, selectedTargetId]);

  const updateAxis = React.useCallback((kind, axis, nextValue) => {
    const pose = { rotation: { ...sampledPose.rotation }, position: { ...sampledPose.position } };
    pose[kind][axis] = clamp(nextValue, kind === "rotation" ? -2.4 : -0.8, kind === "rotation" ? 2.4 : 0.8);
    upsertKeyframe(pose);
    viewerRef.current.setPose?.(selectedTargetId, pose);
  }, [sampledPose.position, sampledPose.rotation, selectedTargetId, upsertKeyframe]);

  React.useEffect(() => {
    if (selectedFrame?.id) {
      setSelectedKeyframeId(selectedFrame.id);
    }
  }, [selectedFrame?.id]);

  React.useEffect(() => {
    viewerRef.current.commitDraggedPose = (targetId) => {
      if (!dragPoseAutoKeyRef.current || !targetId) return;
      const pose = viewerRef.current.getCurrentPose?.(targetId);
      if (!pose) return;
      setIsPlaying(false);
      setSelectedTargetId(targetId);
      upsertKeyframeForTarget(targetId, pose);
    };
  }, [upsertKeyframeForTarget]);

  React.useEffect(() => () => {
    Object.values(importedMotionSourcesRef.current || {}).forEach((entry) => {
      if (entry?.url) URL.revokeObjectURL(entry.url);
    });
    importedMotionSourcesRef.current = {};
  }, []);

  const applyPreset = React.useCallback((kind) => {
    const clip = buildPresetClip(kind, availableTargets);
    patchStudio((prev) => ({ ...prev, activeClipId: clip.id, clips: [...prev.clips.filter((item) => item.id !== selectedClipId), clip] }));
    setSelectedClipId(clip.id);
    setPlayhead(0);
    setStatusMessage(`Preset ${clip.name} aplicado.`);
  }, [availableTargets, patchStudio, selectedClipId]);

  const applyImportedMotionClip = React.useCallback((motionId, clipName) => {
    const motionEntry = importedMotionSourcesRef.current[String(motionId || "")];
    const animationClip = motionEntry?.clips?.find((item) => String(item?.name || "") === String(clipName || ""));
    if (!motionEntry?.root || !animationClip) {
      setMotionImportStatus("Nao foi possivel localizar esse clip importado.");
      return;
    }
    const converted = buildStudioClipFromAnimationClip(animationClip, motionEntry.root, availableTargets);
    if (!converted) {
      setMotionImportStatus("Esse arquivo nao bateu com os nomes do rig atual. Tente um arquivo com bones compativeis.");
      return;
    }
    patchStudio((prev) => ({ ...prev, activeClipId: converted.id, clips: [...prev.clips.filter((item) => item.id !== selectedClipId), converted] }));
    setSelectedClipId(converted.id);
    setPlayhead(0);
    const keyedTargets = Object.values(converted.tracks || {}).filter((frames) => Array.isArray(frames) && frames.length).length;
    setMotionImportStatus(`Clip ${converted.name} importado com ${keyedTargets} trilha(s) editavel(is).`);
    setStatusMessage(`Movimento ${converted.name} importado com keyframes prontos para ajuste fino na timeline.`);
  }, [availableTargets, patchStudio, selectedClipId]);

  const importMotionFile = React.useCallback(async (file) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const ext = detectModelExt(file.name || objectUrl);
    setMotionImportStatus(`Importando movimento ${String(file.name || "arquivo")}...`);
    try {
      let loaded = null;
      if (ext === "fbx") {
        const loader = new FBXLoader();
        loaded = await loader.loadAsync(objectUrl);
      } else {
        const loader = new GLTFLoader();
        loaded = await loader.loadAsync(objectUrl);
      }
      const root = loaded?.scene || loaded;
      const clips = Array.isArray(loaded?.animations) ? loaded.animations : [];
      if (!root || !clips.length) {
        setMotionImportStatus("O arquivo abriu, mas nao trouxe clips de animacao.");
        URL.revokeObjectURL(objectUrl);
        return;
      }
      const motionId = uid("motion");
      importedMotionSourcesRef.current[motionId] = {
        url: objectUrl,
        name: String(file.name || "movimento"),
        root: cloneSkeleton(root),
        clips,
      };
      setImportedMotionLabel(String(file.name || "movimento"));
      setImportedMotionClips(clips.map((clip) => ({
        id: motionId,
        name: String(clip?.name || "clip"),
        duration: Number(clip?.duration || 0),
      })));
      setMotionImportStatus(`${clips.length} clip(s) detectado(s). Escolha um para aplicar na timeline.`);
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      setMotionImportStatus(`Falha ao importar movimento: ${String(error?.message || error || "erro desconhecido")}`);
    }
  }, []);

  const handleMotionImportInput = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importMotionFile(file);
    event.target.value = "";
  }, [importMotionFile]);

  const applyAutoRigTemplate = React.useCallback((templateKey) => {
    const nextLayout = buildAutoRigLayout(templateKey);
    const nextBind = createDefaultAutoBind(templateKey);
    const allowedIds = new Set(nextLayout.controls.map((control) => control.id));
    setSelectedRigTemplate(templateKey);
    setAutoBindDraft(nextBind);
    setSelectedTargetId(nextLayout.controls[0]?.id || "root");
    patchStudio((prev) => ({
      ...prev,
      rigLayout: nextLayout,
      autoBind: nextBind,
      autoBindMap: null,
      landmarks: templateKey === "biped_custom" ? prev.landmarks || null : null,
      clips: prev.clips.map((clip) => {
        const nextTracks = Object.fromEntries(
          Object.entries(clip.tracks || {}).filter(([targetId]) => allowedIds.has(targetId))
        );
        nextLayout.controls.forEach((control) => {
          if (!nextTracks[control.id]) nextTracks[control.id] = [];
        });
        return { ...clip, tracks: nextTracks };
      }),
    }));
    setViewerLayoutNonce((value) => value + 1);
    setStatusMessage(`Auto rig ${AUTO_RIG_TEMPLATES[templateKey]?.label || templateKey} aplicado.`);
  }, [patchStudio]);

  const applyLandmarkRig = React.useCallback(() => {
    const nextLayout = buildRigLayoutFromLandmarks(landmarkDraftRef.current || {}, guideOptionsRef.current || createDefaultGuideOptions());
    const nextBind = createDefaultAutoBind("biped");
    const allowedIds = new Set(nextLayout.controls.map((control) => control.id));
    setSelectedRigTemplate("biped");
    setAutoBindDraft(nextBind);
    setSelectedTargetId(nextLayout.controls[0]?.id || "root");
    patchStudio((prev) => ({
      ...prev,
      rigLayout: nextLayout,
      autoBind: nextBind,
      autoBindMap: null,
      landmarks: landmarkDraftRef.current || {},
      clips: prev.clips.map((clip) => {
        const nextTracks = Object.fromEntries(
          Object.entries(clip.tracks || {}).filter(([targetId]) => allowedIds.has(targetId))
        );
        nextLayout.controls.forEach((control) => {
          if (!nextTracks[control.id]) nextTracks[control.id] = [];
        });
        return { ...clip, tracks: nextTracks };
      }),
    }));
    setViewerLayoutNonce((value) => value + 1);
    setActiveLandmarkId("");
    setStatusMessage(`Rig gerado pelas marcacoes: ${Object.keys(landmarkDraftRef.current || {}).length} pontos.`);
  }, [patchStudio]);

  const startGuideCalibration = React.useCallback(() => {
    const count = Object.keys(landmarkDraftRef.current || {}).length;
    setStatusMessage(`Guias prontos para calibrar. ${count} pontos marcados; ajuste a linha central e gere o rig quando estiver certo.`);
  }, []);

  const useImportedSkeleton = React.useCallback(() => {
    patchStudio((prev) => ({ ...prev, rigLayout: null }));
    setViewerLayoutNonce((value) => value + 1);
    setStatusMessage("Usando o esqueleto detectado do arquivo importado como base.");
  }, [patchStudio]);

  const applyAutoBindSettings = React.useCallback(() => {
    const nextBind = {
      ...createDefaultAutoBind(selectedRigTemplate || "biped"),
      ...autoBindDraft,
      template: selectedRigTemplate || "biped",
    };
    const autoBindMap = viewerRef.current.getAutoBindSnapshot?.(nextBind) || null;
    patchStudio((prev) => ({
      ...prev,
      autoBind: nextBind,
      autoBindMap,
    }));
    setStatusMessage(`Auto bind aplicado: ${String(autoBindDraft.mode || "proximity")} • raio ${Number(autoBindDraft.radius || 0).toFixed(2)} • ${Number(autoBindMap?.controls?.length || 0)} controles.`);
  }, [autoBindDraft, patchStudio, selectedRigTemplate]);

  const resetStudio = React.useCallback(() => {
    const clip = createClip("Idle", 1.2);
    const fresh = normalizeStudioData({
      version: 1,
      activeClipId: clip.id,
      clips: [clip],
      rigLayout: null,
      autoBind: null,
      autoBindMap: null,
      extraControls: [],
      landmarks: null,
      savedAt: null,
    });
    setSelectedRigTemplate("biped");
    setAutoBindDraft(createDefaultAutoBind("biped"));
    setLandmarkDraft({});
    setActiveLandmarkId("");
    setSelectedClipId(fresh.activeClipId);
    setSelectedTargetId("root");
    setPlayhead(0);
    setIsPlaying(false);
    setGuideOptions(createDefaultGuideOptions());
    setBindInspector({ influenced: 0, peak: 0, meshes: 0 });
    setDetectedBoneNames([]);
    setAddControlMode(false);
    setNewControlLabel("Controle extra");
    setAvailableTargets([{ id: "root", label: "Root", objectName: "scene_root" }]);
    setViewerLayoutNonce((value) => value + 1);
    setStatusMessage("Studio resetado. Comece do zero.");
    setStudioData(fresh);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const root = previewRef.current;
    if (!root) return undefined;
    const width = root.clientWidth || 760;
    const height = root.clientHeight || 480;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030712");
    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.01, 2000);
    camera.position.set(2.7, 1.9, 3.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.innerHTML = "";
    root.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x7dd3fc, 0.5);
    fill.position.set(-4, 3, -3);
    scene.add(fill);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.95, 0.06, 48), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.02 }));
    stage.position.y = -0.03;
    scene.add(stage);
    const grid = new THREE.GridHelper(8, 16, 0x15304a, 0x0f172a);
    grid.position.y = 0.001;
    scene.add(grid);
    const placeholder = new THREE.Group();
    const placeholderBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.42, metalness: 0.08 })
    );
    placeholderBody.position.y = 0.72;
    const placeholderHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.02 })
    );
    placeholderHead.position.y = 1.42;
    const placeholderBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.35, metalness: 0.1 })
    );
    placeholderBase.rotation.x = Math.PI / 2;
    placeholderBase.position.y = 0.08;
    placeholder.add(placeholderBody, placeholderHead, placeholderBase);
    scene.add(placeholder);
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const loadingManager = new THREE.LoadingManager();
    const dracoLoader = new DRACOLoader(loadingManager);
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    const ktx2Loader = new KTX2Loader(loadingManager);
    ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.162.0/examples/jsm/libs/basis/");
    ktx2Loader.detectSupport(renderer);
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setKTX2Loader(ktx2Loader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const fbxLoader = new FBXLoader(loadingManager);
    const objLoader = new OBJLoader(loadingManager);
    const stlLoader = new STLLoader(loadingManager);
    const safeUrl = resolveSceneUploadUrl(modelUrl);
    const ext = detectModelExt(safeUrl);
    const fallbackTextureWarnings = new Set();
    let loadSettled = false;
    let loadTimeoutId = 0;
    let raf = 0;
    let modelRoot = null;
    let meshes = [];
    let targets = [];
    let autoBindPreview = [];
    let usingAutoRigPreview = false;
    let autoBindSignature = "";
    let bindInspectorSignature = "";
    let draggingTargetId = "";
    let draggingTargetDepth = 0;
    let draggingTargetMode = "";
    let dragPointerX = 0;
    let dragPointerY = 0;
    let hoveredTargetId = "";
    let skeletonHelper = null;
    let floppyHandle = null;
    let floppyHandleOffset = new THREE.Vector3();
    let floppyHandleWorldPosition = null;
    const markers = new THREE.Group();
    const bindOverlay = new THREE.Group();
    const landmarkOverlay = new THREE.Group();
    const guideOverlay = new THREE.Group();
    scene.add(markers);
    scene.add(bindOverlay);
    scene.add(landmarkOverlay);
    scene.add(guideOverlay);

    const createFloppyHandle = () => {
      const group = new THREE.Group();
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 18, 18),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })
      );
      orb.userData.targetId = "__floppy_handle__";
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.008, 12, 36),
        new THREE.MeshBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.targetId = "__floppy_handle__";
      group.add(orb, ring);
      group.visible = false;
      scene.add(group);
      return group;
    };
    floppyHandle = createFloppyHandle();

    const fitCamera = (object3d) => {
      const box = new THREE.Box3().setFromObject(object3d);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.2);
      const distance = maxDim * 2.1;
      camera.position.set(center.x + distance * 0.75, center.y + distance * 0.48, center.z + distance);
      camera.near = Math.max(0.01, distance / 180);
      camera.far = Math.max(120, distance * 30);
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };

    const setGuideViewCamera = (view) => {
      const object3d = modelRoot || placeholder;
      const box = new THREE.Box3().setFromObject(object3d);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.2);
      const distance = maxDim * 2.1;
      const yaw = Number(guideOptionsRef.current?.modelYaw || 0);
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
      const upOffset = new THREE.Vector3(0, distance * 0.18, 0);
      let offset = forward.clone().multiplyScalar(distance);
      if (view === "right") offset = right.clone().multiplyScalar(distance);
      else if (view === "left") offset = right.clone().multiplyScalar(-distance);
      else if (view === "back") offset = forward.clone().multiplyScalar(-distance);
      camera.position.copy(center).add(offset).add(upOffset);
      controls.target.copy(center);
      controls.update();
    };

    const setModelYaw = (nextYaw) => {
      if (!modelRoot) return;
      modelRoot.rotation.y = Number(nextYaw || 0);
      refreshMarkers();
      refreshLandmarkOverlay();
      refreshGuideOverlay();
      setGuideViewCamera(guideViewRef.current || "front");
    };

    fitCamera(placeholder);

    setLoadInfo({
      message: safeUrl
        ? `Carregando preview ${ext.toUpperCase()}...`
        : "Modelo importado indisponivel para animacao.",
      bones: 0,
      skinnedMeshes: 0,
      hasSkeleton: false,
    });

    loadingManager.setURLModifier((url) => {
      if (ext !== "fbx") return url;
      const raw = String(url || "").trim();
      if (!raw) return BLANK_TEXTURE_DATA_URL;
      if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
      if (raw.startsWith("/uploads/") || raw.startsWith("/api/uploads/") || raw.startsWith("uploads/") || raw.startsWith("api/uploads/")) {
        return resolveSceneUploadUrl(raw);
      }
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith("\\uploads\\") || raw.startsWith("uploads\\") || raw.startsWith("\\api\\uploads\\")) {
        return resolveSceneUploadUrl(raw);
      }
      if (isLikelyImageUrl(raw)) {
        fallbackTextureWarnings.add(raw);
        return BLANK_TEXTURE_DATA_URL;
      }
      return raw;
    });

    const normalizeModel = (object3d) => {
      const box = new THREE.Box3().setFromObject(object3d);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      const scale = 1.85 / maxDim;
      object3d.scale.setScalar(scale);
      object3d.rotation.y = Number(guideOptionsRef.current?.modelYaw || 0);
      const scaledBox = new THREE.Box3().setFromObject(object3d);
      const center = scaledBox.getCenter(new THREE.Vector3());
      object3d.position.sub(center);
      const groundedBox = new THREE.Box3().setFromObject(object3d);
      object3d.position.y -= groundedBox.min.y;
      object3d.position.y += 0.12;
    };

    const createLabelSprite = (text, selected = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 96;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = selected ? "rgba(8, 145, 178, 0.92)" : "rgba(15, 23, 42, 0.9)";
      context.strokeStyle = selected ? "rgba(103, 232, 249, 0.95)" : "rgba(244, 114, 182, 0.9)";
      context.lineWidth = 4;
      const x = 8;
      const y = 12;
      const w = canvas.width - 16;
      const h = canvas.height - 24;
      context.beginPath();
      context.roundRect(x, y, w, h, 18);
      context.fill();
      context.stroke();
      context.fillStyle = "#f8fafc";
      context.font = "600 28px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(text || ""), canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.42, 0.16, 1);
      return sprite;
    };

    const refreshMarkers = () => {
      markers.children.forEach((child) => {
        child.traverse?.((node) => {
          node.geometry?.dispose?.();
          if (node.material?.map) node.material.map.dispose?.();
          node.material?.dispose?.();
        });
      });
      markers.clear();
      targets.forEach((target) => {
        if (!target.object) return;
        const isSelected = target.id === selectedTargetIdRef.current;
        const point = target.proxyPosition
          ? modelRoot.localToWorld(target.proxyPosition.clone())
          : target.object.getWorldPosition(new THREE.Vector3());
        const markerGroup = new THREE.Group();
        markerGroup.position.copy(point);
        markerGroup.userData.targetId = target.id;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(isSelected ? 0.04 : 0.028, 10, 10),
          new THREE.MeshBasicMaterial({
            color: target.isImportedBone
              ? (isSelected ? 0x34d399 : 0xf59e0b)
              : (isSelected ? 0x22d3ee : 0xf472b6),
            depthWrite: false,
            depthTest: false,
          })
        );
        marker.userData.targetId = target.id;
        markerGroup.add(marker);
        const label = createLabelSprite(target.label, isSelected);
        if (label) {
          label.position.set(isSelected ? 0.16 : 0.14, isSelected ? 0.03 : 0.025, 0);
          label.userData.targetId = target.id;
          label.visible = hoveredTargetId === target.id;
          markerGroup.add(label);
        }
        markers.add(markerGroup);
      });
      if (floppyHandle) {
        const rootTarget = targets.find((target) => target.id === "root" || /root/i.test(String(target.label || target.objectName || "")));
        const rootPoint = rootTarget?.object?.getWorldPosition?.(new THREE.Vector3()) || modelRoot?.getWorldPosition?.(new THREE.Vector3()) || new THREE.Vector3();
        if (!floppyHandleWorldPosition) {
          floppyHandleWorldPosition = rootPoint.clone();
          floppyHandleWorldPosition.y += 0.34;
        }
        floppyHandle.position.copy(floppyHandleWorldPosition);
        floppyHandle.visible = !!(floppyModeRef.current && modelRoot && targets.some((target) => target.isImportedBone));
      }
    };

    const persistRigLayoutFromTargets = () => {
      if (!modelRoot || !targets.length) return;
      const box = new THREE.Box3().setFromObject(modelRoot);
      const size = box.getSize(new THREE.Vector3());
      const min = box.min.clone();
      const rigTargets = targets.filter((target) => !target.isExtraControl);
      const extraTargets = targets.filter((target) => target.isExtraControl);
      const hasProxyTargets = rigTargets.some((target) => target.proxyPosition);
      const nextLayout = !usingAutoRigPreview && !hasProxyTargets ? studioDataRef.current?.rigLayout : {
        ...(studioDataRef.current?.rigLayout || {}),
        template: studioDataRef.current?.rigLayout?.template || selectedRigTemplate || "biped",
        controls: rigTargets.map((target) => {
          const world = target.proxyPosition
            ? modelRoot.localToWorld(target.proxyPosition.clone())
            : target.object.getWorldPosition(new THREE.Vector3());
          const normalized = {
            x: clamp((world.x - min.x) / Math.max(size.x, 0.0001), 0, 1),
            y: clamp((world.y - min.y) / Math.max(size.y, 0.0001), 0, 1),
            z: clamp((world.z - min.z) / Math.max(size.z, 0.0001), 0, 1),
          };
          return {
            id: target.id,
            label: target.label,
            pos: [
              Number(((normalized.x - 0.5) * 2).toFixed(4)),
              Number(normalized.y.toFixed(4)),
              Number(((normalized.z - 0.5) * 2).toFixed(4)),
            ],
            normalized: {
              x: Number(normalized.x.toFixed(4)),
              y: Number(normalized.y.toFixed(4)),
              z: Number(normalized.z.toFixed(4)),
            },
          };
        }),
      };
      const nextExtraControls = extraTargets.map((target) => {
        const world = target.proxyPosition
          ? modelRoot.localToWorld(target.proxyPosition.clone())
          : target.object.getWorldPosition(new THREE.Vector3());
        return {
          id: target.id,
          label: target.label,
          normalized: {
            x: Number(clamp((world.x - min.x) / Math.max(size.x, 0.0001), 0, 1).toFixed(4)),
            y: Number(clamp((world.y - min.y) / Math.max(size.y, 0.0001), 0, 1).toFixed(4)),
            z: Number(clamp((world.z - min.z) / Math.max(size.z, 0.0001), 0, 1).toFixed(4)),
          },
        };
      });
      patchStudio((prev) => ({ ...prev, rigLayout: nextLayout || prev.rigLayout || null, extraControls: nextExtraControls }));
    };

    const refreshLandmarkOverlay = () => {
      landmarkOverlay.clear();
      const box = modelRoot ? new THREE.Box3().setFromObject(modelRoot) : null;
      if (!box) return;
      const size = box.getSize(new THREE.Vector3());
      const min = box.min.clone();
      Object.entries(landmarkDraftRef.current || {}).forEach(([id, point]) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(activeLandmarkIdRef.current === id ? 0.05 : 0.032, 12, 12),
          new THREE.MeshBasicMaterial({ color: activeLandmarkIdRef.current === id ? 0x22d3ee : 0xf59e0b })
        );
        marker.position.set(
          min.x + size.x * Number(point.x || 0),
          min.y + size.y * Number(point.y || 0),
          min.z + size.z * Number(point.z || 0)
        );
        landmarkOverlay.add(marker);
      });
    };

    const refreshGuideOverlay = () => {
      guideOverlay.children.forEach((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      });
      guideOverlay.clear();
      const box = modelRoot ? new THREE.Box3().setFromObject(modelRoot) : null;
      if (!box) return;
      const centerX = clamp(guideOptionsRef.current?.centerX, 0.1, 0.9);
      const size = box.getSize(new THREE.Vector3());
      const min = box.min.clone();
      const x = min.x + size.x * centerX;
      const z = min.z + size.z * 0.5;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, min.y - 0.02, z),
        new THREE.Vector3(x, min.y + size.y + 0.08, z),
      ]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        depthTest: false,
      }));
      guideOverlay.add(line);
    };

    const intersectDragSurface = () => {
      const hits = raycaster.intersectObjects(meshes, true);
      if (hits[0]?.point) return hits[0].point.clone();
      const target = targets.find((entry) => entry.id === draggingTargetId);
      if (!target?.object) return null;
      const targetWorld = target.object.getWorldPosition(new THREE.Vector3());
      const planeNormal = camera.getWorldDirection(new THREE.Vector3()).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, new THREE.Vector3(0, targetWorld.y, 0));
      const fallbackPoint = new THREE.Vector3();
      const ok = raycaster.ray.intersectPlane(plane, fallbackPoint);
      if (!ok) return null;
      fallbackPoint.z = draggingTargetDepth;
      return fallbackPoint;
    };

    const refreshBindOverlay = () => {
      bindOverlay.children.forEach((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      });
      bindOverlay.clear();
      if (!usingAutoRigPreview || !autoBindPreview.length) {
        if (bindInspectorSignature !== "0|0|0") {
          bindInspectorSignature = "0|0|0";
          setBindInspector({ influenced: 0, peak: 0, meshes: 0 });
        }
        return;
      }
      const selectedId = selectedTargetIdRef.current;
      const positions = [];
      const colors = [];
      let influenced = 0;
      let peak = 0;
      let meshesCount = 0;
      const sampleStride = 6;
      const tempColor = new THREE.Color();
      autoBindPreview.forEach((meshEntry) => {
        const positionAttr = meshEntry.mesh.geometry?.getAttribute?.("position");
        const item = meshEntry.items.find((entry) => entry.targetId === selectedId);
        if (!positionAttr?.count || !item?.weights?.length) return;
        meshesCount += 1;
        const tempWorld = new THREE.Vector3();
        for (let i = 0; i < item.weights.length; i += 2 * sampleStride) {
          const vertexIndex = item.weights[i];
          const weight = item.weights[i + 1];
          if (!Number.isFinite(vertexIndex) || !Number.isFinite(weight) || weight <= 0.01) continue;
          influenced += 1;
          peak = Math.max(peak, weight);
          tempWorld.set(
            positionAttr.getX(vertexIndex),
            positionAttr.getY(vertexIndex),
            positionAttr.getZ(vertexIndex)
          );
          meshEntry.mesh.localToWorld(tempWorld);
          positions.push(tempWorld.x, tempWorld.y, tempWorld.z);
          tempColor.setRGB(
            THREE.MathUtils.lerp(0.14, 1, weight),
            THREE.MathUtils.lerp(0.3, 0.18, weight),
            THREE.MathUtils.lerp(1, 0.2, weight)
          );
          colors.push(tempColor.r, tempColor.g, tempColor.b);
        }
      });
      if (positions.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({
          size: 0.016,
          vertexColors: true,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          sizeAttenuation: true,
        }));
        bindOverlay.add(points);
      }
      const nextSignature = `${influenced}|${meshesCount}|${peak.toFixed(4)}|${selectedId}`;
      if (nextSignature !== bindInspectorSignature) {
        bindInspectorSignature = nextSignature;
        setBindInspector({ influenced, peak, meshes: meshesCount });
      }
    };

    const ensureDragPose = (target) => {
      if (!target) return { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } };
      if (!target.dragPose) {
        target.dragPose = {
          rotation: { x: 0, y: 0, z: 0 },
          position: { x: 0, y: 0, z: 0 },
        };
      }
      return target.dragPose;
    };

    const ensureFloppyState = (target) => {
      if (!target) return { velocity: { x: 0, y: 0, z: 0 } };
      if (!target.floppyState) {
        target.floppyState = { velocity: { x: 0, y: 0, z: 0 } };
      }
      return target.floppyState;
    };

    const findTargetByPattern = (pattern) => targets.find((entry) => pattern.test(String(entry.label || entry.objectName || entry.id || "")));

    const getFloppyGroup = (target) => {
      const name = String(target?.label || target?.objectName || target?.id || "").toLowerCase();
      if (/head|neck|cabeca|pescoc/i.test(name)) return "head";
      if (/shoulder|arm|forearm|hand|finger|thumb|braco|ombro|mao|dedo/i.test(name)) return "arm";
      if (/upleg|leg|calf|shin|foot|toe|perna|joelho|pe\b|pé\b/i.test(name)) return "leg";
      if (/spine|chest|torso|trunk|tronco|upperchest/i.test(name)) return "torso";
      if (/hips|pelvis|quadril|root/i.test(name)) return "core";
      return "other";
    };

    const getFloppyTargets = () => {
      const importedBones = targets.filter((target) => target.isImportedBone);
      const scope = String(floppyScopeRef.current || "dangly");
      if (scope === "all") return importedBones;
      if (scope === "upper") {
        return importedBones.filter((target) => {
          const group = getFloppyGroup(target);
          return group === "head" || group === "arm";
        });
      }
      return importedBones.filter((target) => {
        const group = getFloppyGroup(target);
        const name = String(target.label || target.objectName || target.id || "").toLowerCase();
        return group === "head" || group === "arm" || group === "leg";
      });
    };

    const resetFloppyState = () => {
      floppyHandleOffset.set(0, 0, 0);
      floppyHandleWorldPosition = null;
      targets.forEach((target) => {
        if (!target?.isImportedBone) return;
        target.dragPose = {
          rotation: { x: 0, y: 0, z: 0 },
          position: { x: 0, y: 0, z: 0 },
        };
        target.floppyState = { velocity: { x: 0, y: 0, z: 0 } };
      });
      refreshMarkers();
    };

    const pullModelTowardFloppyHandle = () => {
      if (!modelRoot || !floppyHandleWorldPosition) return;
      const rootTarget = targets.find((target) => target.id === "root" || /root/i.test(String(target.label || target.objectName || "")));
      const currentRootPoint = rootTarget?.object?.getWorldPosition?.(new THREE.Vector3()) || modelRoot.getWorldPosition(new THREE.Vector3());
      const desiredRootPoint = floppyHandleWorldPosition.clone();
      desiredRootPoint.y -= 0.34;
      const delta = desiredRootPoint.sub(currentRootPoint);
      modelRoot.position.add(delta);
    };

    const applyFloppyImpulse = (deltaX, deltaY) => {
      const importedBones = getFloppyTargets();
      if (!importedBones.length) return;
      const rootY = modelRoot?.getWorldPosition?.(new THREE.Vector3())?.y ?? 0;
      importedBones.forEach((target) => {
        const pose = ensureDragPose(target);
        const floppy = ensureFloppyState(target);
        const worldY = target.object.getWorldPosition(new THREE.Vector3()).y;
        const heightRatio = clamp((worldY - rootY) / 1.6, 0, 1.25);
        const group = getFloppyGroup(target);
        let xBoost = deltaY * THREE.MathUtils.lerp(0.08, 0.34, heightRatio);
        let zBoost = deltaX * THREE.MathUtils.lerp(0.06, 0.24, heightRatio);
        if (group === "head") {
          xBoost *= 1.2;
          zBoost *= 1.1;
        } else if (group === "arm") {
          xBoost *= 1.05;
          zBoost *= 1.15;
        } else if (/leg|foot|toe|perna|pe |pé /i.test(name)) {
          xBoost *= 0.92;
          zBoost *= 0.65;
        } else if (/spine|chest|torso|quadril|hips|pelvis/i.test(name)) {
          xBoost *= 0.4;
          zBoost *= 0.35;
        }
        if (group === "leg") {
          xBoost = deltaY * THREE.MathUtils.lerp(0.05, 0.18, heightRatio);
          zBoost = deltaX * THREE.MathUtils.lerp(0.02, 0.08, heightRatio);
        } else if (group === "torso") {
          xBoost = deltaY * 0.02;
          zBoost = deltaX * 0.01;
        } else if (group === "core") {
          xBoost = deltaY * 0.008;
          zBoost = deltaX * 0.006;
        }
        floppy.velocity.x += xBoost;
        floppy.velocity.z += zBoost;
        pose.rotation.x = clamp(Number(pose.rotation.x || 0) + floppy.velocity.x, -0.72, 0.72);
        pose.rotation.z = clamp(Number(pose.rotation.z || 0) + floppy.velocity.z, -0.62, 0.62);
        if (group === "leg") {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.45, 0.55);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.12, 0.12);
        } else if (group === "arm") {
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.35, 0.35);
        } else if (group === "head") {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.4, 0.4);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.22, 0.22);
        } else {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.12, 0.12);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.08, 0.08);
        }
      });
    };

    const updateFloppyPhysics = (delta) => {
      if (!floppyModeRef.current) return;
      const importedBones = getFloppyTargets();
      if (!importedBones.length) return;
      const damping = THREE.MathUtils.lerp(0.76, 0.95, clamp(floppySoftnessRef.current, 0, 1));
      const gravity = THREE.MathUtils.lerp(0.003, 0.016, clamp(floppyGravityRef.current, 0, 1));
      importedBones.forEach((target) => {
        const pose = ensureDragPose(target);
        const floppy = ensureFloppyState(target);
        const name = String(target.label || target.objectName || target.id || "").toLowerCase();
        const gravityMul = /head|hand|foot|toe|cabeca|pe |pé /i.test(name) ? 1.2 : /arm|leg|braco|perna/i.test(name) ? 1 : 0.45;
        floppy.velocity.x *= Math.pow(damping, Math.max(1, delta * 60));
        floppy.velocity.z *= Math.pow(damping, Math.max(1, delta * 60));
        floppy.velocity.x -= gravity * gravityMul;
        pose.rotation.x = clamp(Number(pose.rotation.x || 0) + floppy.velocity.x * delta * 60, -0.8, 0.8);
        pose.rotation.z = clamp(Number(pose.rotation.z || 0) + floppy.velocity.z * delta * 60, -0.65, 0.65);
        pose.rotation.x *= 0.992;
        pose.rotation.z *= 0.992;
        const group = getFloppyGroup(target);
        if (group === "leg") {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.45, 0.55);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.12, 0.12);
        } else if (group === "arm") {
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.35, 0.35);
        } else if (group === "head") {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.4, 0.4);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.22, 0.22);
        } else {
          pose.rotation.x = clamp(Number(pose.rotation.x || 0), -0.12, 0.12);
          pose.rotation.z = clamp(Number(pose.rotation.z || 0), -0.08, 0.08);
        }
      });
    };

    const applyHumanLegDrag = (target, deltaX, deltaY) => {
      const name = String(target?.label || target?.objectName || target?.id || "").toLowerCase();
      const pose = ensureDragPose(target);
      const sagittal = clamp(deltaY, -0.12, 0.12);
      const side = /left|esquer|_l|\be\b/.test(name) ? "left" : /right|direit|_r|\bd\b/.test(name) ? "right" : "";
      const hips = findTargetByPattern(/quadril|hips|pelvis/i);
      const foot = side === "left"
        ? findTargetByPattern(/leftfoot|foot.*left|pe e|pé e|foot_l|toe.*left/i)
        : side === "right"
          ? findTargetByPattern(/rightfoot|foot.*right|pe d|pé d|foot_r|toe.*right/i)
          : null;
      const lowerLeg = side === "left"
        ? findTargetByPattern(/leftleg|leftforeleg|leftlowerleg|calf.*left|shin.*left|joelho e|leg_l/i)
        : side === "right"
          ? findTargetByPattern(/rightleg|rightforeleg|rightlowerleg|calf.*right|shin.*right|joelho d|leg_r/i)
          : null;
      if (/upleg|thigh|perna e|perna d|leftupleg|rightupleg/i.test(name)) {
        pose.rotation.x = clamp(Number(pose.rotation.x || 0) + sagittal, -1.35, 1.1);
        pose.rotation.z = clamp(Number(pose.rotation.z || 0) + deltaX * 0.12, -0.18, 0.18);
        if (hips) {
          const hipsPose = ensureDragPose(hips);
          const swayDir = side === "left" ? -1 : 1;
          hipsPose.rotation.z = clamp(Number(hipsPose.rotation.z || 0) + deltaX * 0.05 * swayDir, -0.12, 0.12);
          hipsPose.rotation.x = clamp(Number(hipsPose.rotation.x || 0) - sagittal * 0.18, -0.2, 0.2);
        }
        if (lowerLeg) {
          const kneePose = ensureDragPose(lowerLeg);
          kneePose.rotation.x = clamp(Number(kneePose.rotation.x || 0) + Math.max(0, -sagittal) * 0.92, -0.12, 1.45);
        }
        if (foot) {
          const footPose = ensureDragPose(foot);
          footPose.rotation.x = clamp(Number(footPose.rotation.x || 0) - sagittal * 0.48, -0.65, 0.65);
        }
        return true;
      }
      if (/leftleg|rightleg|lowerleg|calf|shin|joelho/i.test(name)) {
        pose.rotation.x = clamp(Number(pose.rotation.x || 0) + Math.max(0, sagittal) * 0.9, -0.08, 1.5);
        if (foot) {
          const footPose = ensureDragPose(foot);
          footPose.rotation.x = clamp(Number(footPose.rotation.x || 0) - sagittal * 0.35, -0.65, 0.65);
        }
        return true;
      }
      if (/foot|toe|pe |pé /i.test(name)) {
        pose.rotation.x = clamp(Number(pose.rotation.x || 0) - sagittal * 0.7, -0.75, 0.75);
        pose.rotation.z = clamp(Number(pose.rotation.z || 0) + deltaX * 0.08, -0.16, 0.16);
        return true;
      }
      return false;
    };

    const rebuildAutoBindPreview = () => {
      if (!usingAutoRigPreview) return;
      autoBindPreview = buildAutoBindPreview(meshes, targets, autoBindRef.current);
      autoBindSignature = JSON.stringify({
        mode: autoBindRef.current?.mode,
        radius: Number(autoBindRef.current?.radius || 0),
        falloff: Number(autoBindRef.current?.falloff || 0),
        stiffness: Number(autoBindRef.current?.stiffness || 0),
        mirror: !!autoBindRef.current?.mirror,
        normalize: !!autoBindRef.current?.normalize,
      });
    };

    const applyClip = (time) => {
      const studio = studioDataRef.current;
      const clip = studio.clips.find((item) => item.id === selectedClipIdRef.current) || studio.clips[0];
      if (!clip) return;
      const duration = Math.max(clip.duration || 1, 0.0001);
      const localTime = clip.loop ? (time % duration + duration) % duration : clamp(time, 0, duration);
      targets.forEach((target) => {
        if (!target.object) return;
        const sample = sampleFrames(clip.tracks?.[target.id] || [], localTime);
        const dragRotation = target.dragPose?.rotation || { x: 0, y: 0, z: 0 };
        const dragPosition = target.dragPose?.position || { x: 0, y: 0, z: 0 };
        target.object.rotation.set(
          target.baseRotation.x + Number(sample.rotation.x || 0) + Number(dragRotation.x || 0),
          target.baseRotation.y + Number(sample.rotation.y || 0) + Number(dragRotation.y || 0),
          target.baseRotation.z + Number(sample.rotation.z || 0) + Number(dragRotation.z || 0)
        );
        target.object.position.set(
          target.basePosition.x + Number(sample.position.x || 0) + Number(dragPosition.x || 0),
          target.basePosition.y + Number(sample.position.y || 0) + Number(dragPosition.y || 0),
          target.basePosition.z + Number(sample.position.z || 0) + Number(dragPosition.z || 0)
        );
        if (clip.dynamics?.enabled && /head|bag|arm_/i.test(target.id)) {
          target.object.rotation.z += Math.sin(localTime * Math.PI * 2) * Number(clip.dynamics.softness || 0) * 0.06;
          target.object.rotation.x -= Number(clip.dynamics.gravity || 0) * 0.05;
        }
      });
      meshes.forEach((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (!material) return;
          if (material.emissive) material.emissive.setRGB(Number(clip.dynamics?.glow || 0) * 0.06, Number(clip.dynamics?.glow || 0) * 0.12, Number(clip.dynamics?.glow || 0) * 0.18);
          if ("emissiveIntensity" in material) material.emissiveIntensity = 0.1 + Number(clip.dynamics?.glow || 0) * 0.85;
        });
      });
      if (usingAutoRigPreview && autoBindPreview.length) {
        const bind = autoBindRef.current || createDefaultAutoBind(selectedRigTemplate || "biped");
        const influenceStrength = THREE.MathUtils.lerp(1.05, 0.38, clamp(bind?.stiffness, 0, 1));
        const tempBase = new THREE.Vector3();
        const tempRelative = new THREE.Vector3();
        const tempRotated = new THREE.Vector3();
        const tempPositionDelta = new THREE.Vector3();
        const tempQuat = new THREE.Quaternion();
        autoBindPreview.forEach((meshEntry) => {
          const positionAttr = meshEntry.mesh.geometry?.getAttribute?.("position");
          const restArray = meshEntry.mesh.userData?.__studioRestPositionArray instanceof Float32Array
            ? meshEntry.mesh.userData.__studioRestPositionArray
            : meshEntry.baseArray;
          if (!positionAttr?.array || !restArray) return;
          positionAttr.array.set(restArray);
          meshEntry.items.forEach((item) => {
            const target = targets.find((entry) => entry.id === item.targetId);
            if (!target?.object) return;
            tempPositionDelta.set(
              target.object.position.x - target.basePosition.x,
              target.object.position.y - target.basePosition.y,
              target.object.position.z - target.basePosition.z
            );
            tempQuat.setFromEuler(new THREE.Euler(
              target.object.rotation.x - target.baseRotation.x,
              target.object.rotation.y - target.baseRotation.y,
              target.object.rotation.z - target.baseRotation.z,
              "XYZ"
            ));
            for (let i = 0; i < item.weights.length; i += 2) {
              const vertexIndex = item.weights[i];
              const weight = item.weights[i + 1] * influenceStrength;
              const baseOffset = vertexIndex * 3;
              tempBase.fromArray(restArray, baseOffset);
              tempRelative.copy(tempBase).sub(item.anchorLocal);
              tempRotated.copy(tempRelative).applyQuaternion(tempQuat).sub(tempRelative);
              positionAttr.array[baseOffset] += (tempPositionDelta.x + tempRotated.x) * weight;
              positionAttr.array[baseOffset + 1] += (tempPositionDelta.y + tempRotated.y) * weight;
              positionAttr.array[baseOffset + 2] += (tempPositionDelta.z + tempRotated.z) * weight;
            }
          });
          positionAttr.needsUpdate = true;
          meshEntry.mesh.geometry.computeVertexNormals();
        });
      }
    };

    const onLoaded = (loaded) => {
      loadSettled = true;
      if (loadTimeoutId) window.clearTimeout(loadTimeoutId);
      const source = loaded?.scene || loaded;
      if (!source) return;
      modelRoot = source.isObject3D ? cloneSkeleton(source) : source;
      modelRoot.traverse((node) => {
        if (!node.isMesh) return;
        meshes.push(node);
        const positionAttr = node.geometry?.getAttribute?.("position");
        if (positionAttr?.array && !(node.userData?.__studioRestPositionArray instanceof Float32Array)) {
          node.userData.__studioRestPositionArray = new Float32Array(positionAttr.array);
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          if (!material) return;
          if (material.map?.isTexture) {
            const image = material.map.image || material.map.source?.data || null;
            if (!image) {
              material.map = null;
            } else {
              material.map.colorSpace = THREE.SRGBColorSpace;
              material.map.needsUpdate = true;
            }
          }
          material.needsUpdate = true;
        });
      });
      normalizeModel(modelRoot);
      scene.add(modelRoot);
      placeholder.visible = false;
      fitCamera(modelRoot);
      const bones = [];
      let skinnedMeshes = 0;
      modelRoot.traverse((node) => {
        if (node.isBone) bones.push(node);
        if (node.isSkinnedMesh) skinnedMeshes += 1;
      });
      const extraTargets = instantiateExtraControls(modelRoot, studioDataRef.current?.extraControls || []);
      const savedLayout = studioDataRef.current?.rigLayout;
      if (savedLayout?.controls?.length) {
        targets = instantiateAutoRigTargets(modelRoot, savedLayout);
        usingAutoRigPreview = true;
      } else {
        targets = bones.length ? collectBoneTargets(modelRoot, bones) : [];
      }
      if (!targets.length) {
        const fallbackLayout = buildAutoRigLayout(selectedRigTemplate || "biped");
        targets = instantiateAutoRigTargets(modelRoot, fallbackLayout);
        usingAutoRigPreview = true;
      }
      targets = [...targets, ...extraTargets];
      if (!targets.length) targets = [{ id: "root", label: "Root", object: modelRoot, objectName: "scene_root", baseRotation: modelRoot.rotation.clone(), basePosition: modelRoot.position.clone() }];
      if (bones.length && !usingAutoRigPreview) {
        skeletonHelper = new THREE.SkeletonHelper(modelRoot);
        skeletonHelper.material.depthTest = false;
        skeletonHelper.material.transparent = true;
        skeletonHelper.material.opacity = 0.9;
        skeletonHelper.material.linewidth = 2;
        scene.add(skeletonHelper);
      }
      if (usingAutoRigPreview) rebuildAutoBindPreview();
      setDetectedBoneNames(bones.map((bone) => String(bone.name || "bone")).filter(Boolean));
      setAvailableTargets(targets.map((target) => ({ id: target.id, label: target.label, objectName: target.objectName })));
      setSelectedTargetId((prev) => (targets.some((target) => target.id === prev) ? prev : targets[0].id));
      setLoadInfo({
        message: savedLayout?.controls?.length
          ? `Auto rig ${AUTO_RIG_TEMPLATES[savedLayout.template]?.label || savedLayout.template} carregado com ${savedLayout.controls.length} controles.`
          : bones.length
            ? `${bones.length} bones detectados. Clique no modelo ou use a lista para animar as partes.`
            : "Sem skeleton nativo. O studio gerou controles de referencia para animacao leve.",
        bones: bones.length,
        skinnedMeshes,
        hasSkeleton: bones.length > 0,
      });
      if (fallbackTextureWarnings.size) {
        setStatusMessage(`Preview aberto com ${fallbackTextureWarnings.size} textura(s) externa(s) substituida(s) para nao travar a animacao.`);
      }
      const clips = Array.isArray(loaded?.animations) ? loaded.animations : [];
      setSourceAnimations(clips.map((clip) => ({ name: String(clip?.name || "clip"), duration: Number(clip?.duration || 0) })));
      refreshMarkers();
      refreshBindOverlay();
      refreshLandmarkOverlay();
      refreshGuideOverlay();
      setGuideViewCamera(guideView);
    };

    const onError = (error) => {
      loadSettled = true;
      if (loadTimeoutId) window.clearTimeout(loadTimeoutId);
      placeholder.visible = true;
      fitCamera(placeholder);
      setLoadInfo({ message: `Falha ao carregar preview: ${String(error?.message || error || "erro desconhecido")}`, bones: 0, skinnedMeshes: 0, hasSkeleton: false });
    };

    try {
      if (safeUrl) {
        loadTimeoutId = window.setTimeout(() => {
          if (loadSettled) return;
          onError(new Error("timeout no preview. O arquivo pode ter textura externa/referencia invalida."));
        }, ext === "fbx" ? 12000 : 18000);
        if (ext === "fbx") fbxLoader.load(safeUrl, onLoaded, undefined, onError);
        else if (ext === "obj") objLoader.load(safeUrl, onLoaded, undefined, onError);
        else if (ext === "stl") stlLoader.load(safeUrl, (geometry) => onLoaded(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78, metalness: 0.04 }))), undefined, onError);
        else gltfLoader.load(safeUrl, onLoaded, undefined, onError);
      } else {
        setLoadInfo({ message: "Modelo importado indisponivel para animacao.", bones: 0, skinnedMeshes: 0, hasSkeleton: false });
      }
    } catch (error) {
      onError(error);
    }

    const onPointerDown = (event) => {
      if (!modelRoot) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const markerHits = raycaster.intersectObjects(markers.children, true);
      if (markerHits[0]?.object?.userData?.targetId) {
        draggingTargetId = String(markerHits[0].object.userData.targetId);
        const dragTarget = targets.find((entry) => entry.id === draggingTargetId);
        draggingTargetMode = dragTarget?.isImportedBone && !usingAutoRigPreview ? "rotate_bone" : "move_point";
        dragPointerX = event.clientX;
        dragPointerY = event.clientY;
        draggingTargetDepth = dragTarget?.proxyPosition
          ? modelRoot.localToWorld(dragTarget.proxyPosition.clone()).z
          : dragTarget?.object?.getWorldPosition(new THREE.Vector3())?.z ?? 0;
        setSelectedTargetId(draggingTargetId);
        controls.enabled = false;
        return;
      }
      if (floppyHandle?.visible) {
        const floppyHits = raycaster.intersectObjects(floppyHandle.children, true);
        if (floppyHits[0]?.object?.userData?.targetId === "__floppy_handle__") {
          draggingTargetId = "__floppy_handle__";
          draggingTargetMode = "floppy_drag";
          dragPointerX = event.clientX;
          dragPointerY = event.clientY;
          draggingTargetDepth = floppyHandle.position.z;
          floppyHandleWorldPosition = floppyHandle.position.clone();
          controls.enabled = false;
          return;
        }
      }
      const hits = raycaster.intersectObjects(meshes, true);
      if (!hits[0]) return;
      if (activeLandmarkIdRef.current) {
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = box.getSize(new THREE.Vector3());
        const min = box.min.clone();
        const allHits = raycaster.intersectObjects(meshes, true);
        let hit = hits[0].point.clone();
        if (guideOptionsRef.current?.insideMesh && allHits.length >= 2) {
          const first = allHits[0].point;
          const last = allHits[allHits.length - 1].point;
          hit = new THREE.Vector3(
            (first.x + last.x) * 0.5,
            (first.y + last.y) * 0.5,
            (first.z + last.z) * 0.5
          );
        }
        const nextPoint = {
          x: clamp((hit.x - min.x) / Math.max(size.x, 0.0001), 0, 1),
          y: clamp((hit.y - min.y) / Math.max(size.y, 0.0001), 0, 1),
          z: clamp((hit.z - min.z) / Math.max(size.z, 0.0001), 0, 1),
        };
        if (guideOptionsRef.current?.snapCenter && CENTER_LANDMARK_IDS.has(activeLandmarkIdRef.current)) {
          nextPoint.x = clamp(guideOptionsRef.current?.centerX, 0, 1);
        }
        if (guideOptionsRef.current?.forceSymmetry && MIRROR_LANDMARK_MAP[activeLandmarkIdRef.current]) {
          const mirrorId = MIRROR_LANDMARK_MAP[activeLandmarkIdRef.current];
          const centerX = clamp(guideOptionsRef.current?.centerX, 0, 1);
          const mirrorPoint = {
            x: clamp(centerX - (nextPoint.x - centerX), 0, 1),
            y: nextPoint.y,
            z: nextPoint.z,
          };
          setLandmarkDraft((prev) => ({
            ...(prev || {}),
            [activeLandmarkIdRef.current]: nextPoint,
            [mirrorId]: mirrorPoint,
          }));
          setStatusMessage(`${LANDMARK_POINTS.find((item) => item.id === activeLandmarkIdRef.current)?.label || "Ponto"} marcado com simetria.`);
          return;
        }
        setLandmarkDraft((prev) => ({ ...(prev || {}), [activeLandmarkIdRef.current]: nextPoint }));
        setStatusMessage(`${LANDMARK_POINTS.find((item) => item.id === activeLandmarkIdRef.current)?.label || "Ponto"} marcado.`);
        return;
      }
      if (addControlMode) {
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = box.getSize(new THREE.Vector3());
        const min = box.min.clone();
        const hit = hits[0].point;
        const nextControl = {
          id: uid("extra"),
          label: String(newControlLabel || "Controle extra").trim() || "Controle extra",
          normalized: {
            x: Number(clamp((hit.x - min.x) / Math.max(size.x, 0.0001), 0, 1).toFixed(4)),
            y: Number(clamp((hit.y - min.y) / Math.max(size.y, 0.0001), 0, 1).toFixed(4)),
            z: Number(clamp((hit.z - min.z) / Math.max(size.z, 0.0001), 0, 1).toFixed(4)),
          },
        };
        patchStudio((prev) => ({ ...prev, extraControls: [...(prev.extraControls || []), nextControl] }));
        setAddControlMode(false);
        setViewerLayoutNonce((value) => value + 1);
        setStatusMessage(`Controle extra ${nextControl.label} adicionado.`);
        return;
      }
      let nearest = targets[0];
      let nearestDistance = Infinity;
      targets.forEach((target) => {
        const point = target.proxyPosition
          ? modelRoot.localToWorld(target.proxyPosition.clone())
          : target.object.getWorldPosition(new THREE.Vector3());
        const distance = point.distanceToSquared(hits[0].point);
        if (distance < nearestDistance) {
          nearest = target;
          nearestDistance = distance;
        }
      });
      if (nearest) setSelectedTargetId(nearest.id);
    };
    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hoverHits = raycaster.intersectObjects(markers.children, true);
      const nextHoveredId = hoverHits[0]?.object?.userData?.targetId ? String(hoverHits[0].object.userData.targetId) : "";
      if (nextHoveredId !== hoveredTargetId) {
        hoveredTargetId = nextHoveredId;
        refreshMarkers();
      }
      if (!draggingTargetId || !modelRoot) return;
      const hitPoint = intersectDragSurface();
      const target = targets.find((entry) => entry.id === draggingTargetId);
      if (draggingTargetMode === "floppy_drag") {
        const deltaX = (event.clientX - dragPointerX) * 0.01;
        const deltaY = (event.clientY - dragPointerY) * 0.01;
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();
        const up = camera.up.clone().normalize();
        floppyHandleOffset.add(right.multiplyScalar(deltaX * 0.18));
        floppyHandleOffset.add(up.multiplyScalar(-deltaY * 0.18));
        if (!floppyHandleWorldPosition) floppyHandleWorldPosition = floppyHandle.position.clone();
        floppyHandleWorldPosition.add(floppyHandleOffset);
        floppyHandleOffset.set(0, 0, 0);
        pullModelTowardFloppyHandle();
        applyFloppyImpulse(deltaX, deltaY);
        dragPointerX = event.clientX;
        dragPointerY = event.clientY;
        refreshMarkers();
        return;
      }
      if (!target?.object) return;
      if (draggingTargetMode === "rotate_bone" && target.isImportedBone) {
        const deltaX = (event.clientX - dragPointerX) * 0.012;
        const deltaY = (event.clientY - dragPointerY) * 0.012;
        const assisted = humanLegAssistRef.current ? applyHumanLegDrag(target, deltaX, deltaY) : false;
        if (!assisted) {
          target.dragPose = {
            rotation: {
              x: Number((target.dragPose?.rotation?.x || 0) + deltaY),
              y: Number(target.dragPose?.rotation?.y || 0),
              z: Number((target.dragPose?.rotation?.z || 0) + deltaX),
            },
            position: { ...(target.dragPose?.position || { x: 0, y: 0, z: 0 }) },
          };
        }
        dragPointerX = event.clientX;
        dragPointerY = event.clientY;
        refreshMarkers();
        return;
      }
      if (!hitPoint) return;
      const localPoint = modelRoot.worldToLocal(hitPoint.clone());
      if (target.isImportedBone && !usingAutoRigPreview) {
        target.proxyPosition = localPoint.clone();
      } else {
        target.object.position.copy(localPoint);
        target.basePosition.copy(localPoint);
      }
      refreshMarkers();
      if (usingAutoRigPreview) rebuildAutoBindPreview();
    };
    const onPointerUp = () => {
      if (!draggingTargetId) return;
      controls.enabled = true;
      const target = targets.find((item) => item.id === draggingTargetId);
      if (draggingTargetMode === "rotate_bone") {
        viewerRef.current.commitDraggedPose?.(draggingTargetId);
        if (target) {
          target.dragPose = {
            rotation: { x: 0, y: 0, z: 0 },
            position: { x: 0, y: 0, z: 0 },
          };
        }
      }
      if (draggingTargetMode === "floppy_drag" && floppyAutoKeyRef.current) {
        targets.filter((item) => item.isImportedBone && item.dragPose && (
          Math.abs(Number(item.dragPose.rotation?.x || 0)) > 0.001 ||
          Math.abs(Number(item.dragPose.rotation?.y || 0)) > 0.001 ||
          Math.abs(Number(item.dragPose.rotation?.z || 0)) > 0.001
        )).forEach((item) => {
          viewerRef.current.commitDraggedPose?.(item.id);
        });
      }
      persistRigLayoutFromTargets();
      setStatusMessage(draggingTargetMode === "floppy_drag" ? "Modo molengo aplicado." : `Controle ${target?.label || draggingTargetId} ajustado.`);
      draggingTargetId = "";
      draggingTargetDepth = 0;
      draggingTargetMode = "";
      hoveredTargetId = "";
      refreshMarkers();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    viewerRef.current = {
      getCurrentPose: (targetId) => {
        const target = targets.find((item) => item.id === targetId);
        if (!target?.object) return null;
        const dragRotation = target.dragPose?.rotation || { x: 0, y: 0, z: 0 };
        const dragPosition = target.dragPose?.position || { x: 0, y: 0, z: 0 };
        return {
          rotation: {
            x: (target.object.rotation.x - target.baseRotation.x) + Number(dragRotation.x || 0),
            y: (target.object.rotation.y - target.baseRotation.y) + Number(dragRotation.y || 0),
            z: (target.object.rotation.z - target.baseRotation.z) + Number(dragRotation.z || 0),
          },
          position: {
            x: (target.object.position.x - target.basePosition.x) + Number(dragPosition.x || 0),
            y: (target.object.position.y - target.basePosition.y) + Number(dragPosition.y || 0),
            z: (target.object.position.z - target.basePosition.z) + Number(dragPosition.z || 0),
          },
        };
      },
      setPose: (targetId, pose) => {
        const target = targets.find((item) => item.id === targetId);
        if (!target?.object) return;
        target.dragPose = {
          rotation: {
            x: Number(pose?.rotation?.x || 0),
            y: Number(pose?.rotation?.y || 0),
            z: Number(pose?.rotation?.z || 0),
          },
          position: {
            x: Number(pose?.position?.x || 0),
            y: Number(pose?.position?.y || 0),
            z: Number(pose?.position?.z || 0),
          },
        };
        target.object.rotation.set(target.baseRotation.x + Number(pose?.rotation?.x || 0), target.baseRotation.y + Number(pose?.rotation?.y || 0), target.baseRotation.z + Number(pose?.rotation?.z || 0));
        target.object.position.set(target.basePosition.x + Number(pose?.position?.x || 0), target.basePosition.y + Number(pose?.position?.y || 0), target.basePosition.z + Number(pose?.position?.z || 0));
      },
      setTime: applyClip,
      getAutoBindSnapshot: (bindOverride) => buildAutoBindSnapshot(autoBindPreview, bindOverride || autoBindRef.current, targets),
      setGuideView: setGuideViewCamera,
      resetCamera: () => setGuideViewCamera(guideViewRef.current || "front"),
      resetFloppy: resetFloppyState,
      setModelYaw,
    };

    const animate = () => {
      const delta = clock.getDelta();
      const currentStudio = studioDataRef.current;
      const currentClip = currentStudio.clips.find((item) => item.id === selectedClipIdRef.current) || currentStudio.clips[0] || null;
      if (isPlayingRef.current && currentClip) {
        setPlayhead((prev) => {
          const duration = Math.max(currentClip.duration || 1, 0.0001);
          const next = prev + delta;
          return currentClip.loop ? next % duration : Math.min(duration, next);
        });
      }
      if (usingAutoRigPreview) {
        const nextSignature = JSON.stringify({
          mode: autoBindRef.current?.mode,
          radius: Number(autoBindRef.current?.radius || 0),
          falloff: Number(autoBindRef.current?.falloff || 0),
          stiffness: Number(autoBindRef.current?.stiffness || 0),
          mirror: !!autoBindRef.current?.mirror,
          normalize: !!autoBindRef.current?.normalize,
        });
        if (nextSignature !== autoBindSignature) rebuildAutoBindPreview();
      }
      applyClip(playheadRef.current);
      updateFloppyPhysics(delta);
      refreshMarkers();
      if (usingAutoRigPreview) refreshBindOverlay();
      if (modelRoot) refreshLandmarkOverlay();
      if (modelRoot) refreshGuideOverlay();
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = root.clientWidth || width;
      const h = root.clientHeight || height;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      loadSettled = true;
      if (loadTimeoutId) window.clearTimeout(loadTimeoutId);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      skeletonHelper?.geometry?.dispose?.();
      skeletonHelper?.material?.dispose?.();
      dracoLoader.dispose();
      ktx2Loader.dispose();
      renderer.dispose();
      scene.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry?.dispose?.();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material?.dispose?.());
      });
      if (root.contains(renderer.domElement)) root.removeChild(renderer.domElement);
    };
  }, [modelUrl, open, selectedRigTemplate, viewerLayoutNonce]);

  React.useEffect(() => {
    viewerRef.current.setTime?.(playhead);
  }, [playhead]);

  React.useEffect(() => {
    guideViewRef.current = guideView;
    viewerRef.current.setGuideView?.(guideView);
  }, [guideView]);

  const timelineTargets = React.useMemo(() => {
    if (!activeClip) return [];
    return availableTargets.filter((target) => target.id === selectedTargetId || (activeClip.tracks?.[target.id] || []).length);
  }, [activeClip, availableTargets, selectedTargetId]);

  const filteredPresets = React.useMemo(() => {
    if (libraryFilter === "runner") return PRESET_LIBRARY.filter((item) => item.key !== "idle");
    return PRESET_LIBRARY;
  }, [libraryFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[132] bg-slate-950/76 backdrop-blur-sm" className="z-[133] left-0 top-0 flex h-[100dvh] w-[100vw] max-h-[100dvh] max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border border-cyan-500/30 bg-[#020617] p-0 text-white">
        <DialogHeader className="border-b border-slate-800 bg-gradient-to-r from-cyan-950/70 via-slate-950 to-fuchsia-950/45 px-5 py-4">
          <DialogTitle className="flex items-center justify-between gap-3 text-base font-bold text-cyan-100">
            <span>Studio de animacao e esqueleto</span>
            <span className="truncate text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">{String(modelLabel || "personagem").trim() || "personagem"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-y-auto border-r border-slate-800 bg-slate-950/92 px-3 py-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/18 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Rig automatico</p>
                <p className="mt-2 text-[11px] text-slate-300">{loadInfo.message || "Carregando modelo..."}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-2">Bones: {loadInfo.bones}</div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-2">Skins: {loadInfo.skinnedMeshes}</div>
                </div>
                {loadInfo.hasSkeleton ? (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Esqueleto importado</span>
                      <button type="button" onClick={useImportedSkeleton} className="rounded-lg border border-emerald-400/40 bg-emerald-900/30 px-2 py-1 text-[10px] text-emerald-100">Usar bones do arquivo</button>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-300">O modelo trouxe skeleton nativo. Você pode usar esses bones como base e acrescentar controles extras.</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detectedBoneNames.slice(0, 8).map((name) => (
                        <span key={name} className="rounded-full border border-emerald-500/25 bg-slate-950/70 px-2 py-1 text-[9px] text-emerald-100">{name}</span>
                      ))}
                      {detectedBoneNames.length > 8 ? <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[9px] text-slate-300">+{detectedBoneNames.length - 8}</span> : null}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(AUTO_RIG_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyAutoRigTemplate(key)}
                      className={`rounded-2xl border p-3 text-left transition ${getAccentClasses(template.accent, selectedRigTemplate === key)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]">{template.icon}</span>
                        <span className="text-[9px] uppercase tracking-[0.18em] text-white/55">{template.controls.length} ctrl</span>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold">{template.label}</div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-white/68">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/12 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Guia por pontos</p>
                  <span className="rounded-full border border-amber-500/25 bg-amber-950/30 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-amber-100">{Object.keys(landmarkDraft || {}).length}/{LANDMARK_POINTS.length}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-300">Escolha um ponto e clique no personagem para marcar. A linha laranja mostra o centro do corpo para pontos centrais e espelhamento.</p>
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-slate-950/55 p-3">
                  <div className="flex items-center justify-between gap-3 text-[10px] text-amber-100">
                    <span className="font-semibold uppercase tracking-[0.16em]">Linha central</span>
                    <span>{Number(guideOptions.centerX || 0.5).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.01"
                    value={guideOptions.centerX}
                    onChange={(event) => setGuideOptions((prev) => ({ ...prev, centerX: Number(event.target.value) }))}
                    className="mt-2 w-full accent-amber-400"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, snapCenter: !prev.snapCenter }))} className={`rounded-xl border px-3 py-2 text-[10px] ${guideOptions.snapCenter ? "border-amber-400/60 bg-amber-900/35 text-amber-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Snap no centro: {guideOptions.snapCenter ? "ON" : "OFF"}</button>
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, forceSymmetry: !prev.forceSymmetry }))} className={`rounded-xl border px-3 py-2 text-[10px] ${guideOptions.forceSymmetry ? "border-emerald-400/60 bg-emerald-950/30 text-emerald-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Forcar simetria: {guideOptions.forceSymmetry ? "ON" : "OFF"}</button>
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, insideMesh: !prev.insideMesh }))} className={`rounded-xl border px-3 py-2 text-[10px] ${guideOptions.insideMesh ? "border-cyan-400/60 bg-cyan-950/30 text-cyan-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Inside mesh: {guideOptions.insideMesh ? "ON" : "OFF"}</button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      ["front", "Frente"],
                      ["right", "Direita"],
                      ["left", "Esquerda"],
                      ["back", "Costas"],
                    ].map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setGuideView(id)} className={`rounded-xl border px-2 py-2 text-[10px] ${guideView === id ? "border-fuchsia-400/60 bg-fuchsia-900/35 text-fuchsia-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>{label}</button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, modelYaw: Number(prev.modelYaw || 0) - Math.PI / 2 }))} className="rounded-xl border border-slate-700 bg-slate-950/85 px-2 py-2 text-[10px] text-slate-200">Girar -90</button>
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, modelYaw: 0 }))} className="rounded-xl border border-slate-700 bg-slate-950/85 px-2 py-2 text-[10px] text-slate-200">Frente original</button>
                    <button type="button" onClick={() => setGuideOptions((prev) => ({ ...prev, modelYaw: Number(prev.modelYaw || 0) + Math.PI / 2 }))} className="rounded-xl border border-slate-700 bg-slate-950/85 px-2 py-2 text-[10px] text-slate-200">Girar +90</button>
                  </div>
                  <button type="button" onClick={() => viewerRef.current.resetCamera?.()} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/85 px-3 py-2 text-[10px] text-slate-200">Reposicionar camera</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {LANDMARK_POINTS.map((point) => (
                    <button
                      key={point.id}
                      type="button"
                      onClick={() => setActiveLandmarkId((prev) => prev === point.id ? "" : point.id)}
                      className={`rounded-xl border px-2 py-2 text-[10px] ${activeLandmarkId === point.id ? "border-amber-400/70 bg-amber-900/35 text-amber-100" : landmarkDraft?.[point.id] ? "border-emerald-500/45 bg-emerald-950/20 text-emerald-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}
                    >
                      {point.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" onClick={resetStudio} className="rounded-xl border border-rose-400/45 bg-rose-950/30 px-3 py-2 text-[10px] font-semibold text-rose-100">Resetar tudo</button>
                  <button type="button" onClick={() => setLandmarkDraft({})} className="rounded-xl border border-slate-700 bg-slate-950/85 px-3 py-2 text-[10px] text-slate-200">Limpar pontos</button>
                  <button type="button" onClick={startGuideCalibration} className="rounded-xl border border-cyan-400/45 bg-cyan-950/30 px-3 py-2 text-[10px] font-semibold text-cyan-100">Calibrar</button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <button type="button" onClick={applyLandmarkRig} className="rounded-xl border border-amber-400/55 bg-amber-900/35 px-3 py-2 text-[10px] font-semibold text-amber-100">Gerar rig</button>
                </div>
                <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/12 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Controles extras</p>
                  <p className="mt-2 text-[10px] text-slate-300">Acrescente pontos extras por cima do esqueleto importado ou do rig gerado.</p>
                  <input value={newControlLabel} onChange={(event) => setNewControlLabel(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/85 px-3 py-2 text-[11px] text-slate-100 outline-none" placeholder="Nome do controle" />
                  <button type="button" onClick={() => setAddControlMode((prev) => !prev)} className={`mt-2 w-full rounded-xl border px-3 py-2 text-[10px] font-semibold ${addControlMode ? "border-fuchsia-400/60 bg-fuchsia-900/35 text-fuchsia-100" : "border-slate-700 bg-slate-950/85 text-slate-200"}`}>{addControlMode ? "Clique no personagem para adicionar" : "Adicionar controle por clique"}</button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Clips</p>
                  <button
                    type="button"
                    onClick={() => {
                      const clip = createClip(`Clip ${studioData.clips.length + 1}`, 1.2);
                      patchStudio((prev) => ({ ...prev, activeClipId: clip.id, clips: [...prev.clips, clip] }));
                      setSelectedClipId(clip.id);
                      setPlayhead(0);
                    }}
                    className="rounded-md border border-fuchsia-500/40 bg-fuchsia-950/35 px-2 py-1 text-[10px] text-fuchsia-100"
                  >
                    Novo
                  </button>
                </div>
                <div className="space-y-2">
                  {studioData.clips.map((clip) => (
                    <button key={clip.id} type="button" onClick={() => { setSelectedClipId(clip.id); setPlayhead(0); }} className={`w-full rounded-xl border px-3 py-2 text-left ${selectedClipId === clip.id ? "border-fuchsia-400/60 bg-fuchsia-950/38 text-fuchsia-100" : "border-slate-800 bg-slate-950/85 text-slate-300"}`}>
                      <div className="truncate text-[11px] font-semibold">{clip.name}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{formatSeconds(clip.duration)} • {clip.loop ? "loop" : "one-shot"}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-950/12 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">Importar movimento</p>
                  <button type="button" onClick={() => importMotionInputRef.current?.click()} className="rounded-lg border border-violet-400/40 bg-violet-900/30 px-2 py-1 text-[10px] text-violet-100">Upload FBX/GLB</button>
                  <input ref={importMotionInputRef} type="file" accept=".fbx,.glb,.gltf" onChange={handleMotionImportInput} className="hidden" />
                </div>
                <p className="mt-2 text-[10px] text-slate-300">Importe um arquivo com animacao pronta e aplique um clip na timeline para ajustar por cima.</p>
                <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-300">
                  {motionImportStatus || "Nenhum movimento externo carregado."}
                </div>
                {importedMotionLabel ? (
                  <div className="mt-2 rounded-xl border border-violet-500/20 bg-slate-950/65 px-3 py-2 text-[10px] text-violet-100">
                    Arquivo: {importedMotionLabel}
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {importedMotionClips.length ? importedMotionClips.map((clip) => (
                    <div key={`${clip.id}_${clip.name}`} className="rounded-xl border border-slate-800 bg-slate-950/85 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold text-slate-100">{clip.name}</div>
                          <div className="text-[10px] text-slate-400">{formatSeconds(clip.duration)}</div>
                        </div>
                        <button type="button" onClick={() => applyImportedMotionClip(clip.id, clip.name)} className="rounded-lg border border-violet-400/40 bg-violet-950/35 px-2 py-1 text-[10px] text-violet-100">Aplicar</button>
                      </div>
                    </div>
                  )) : <p className="text-[10px] text-slate-500">Sem movimento externo importado.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Controles</p>
                <div className="space-y-2">
                  {availableTargets.map((target) => (
                    <button key={target.id} type="button" onClick={() => setSelectedTargetId(target.id)} className={`w-full rounded-xl border px-3 py-2 text-left ${selectedTargetId === target.id ? "border-cyan-400/60 bg-cyan-950/35 text-cyan-100" : "border-slate-800 bg-slate-950/80 text-slate-300"}`}>
                      <div className="truncate text-[11px] font-semibold">{target.label}</div>
                      <div className="truncate text-[10px] text-slate-400">{target.objectName}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Presets</p>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setLibraryFilter("all")} className={`rounded-xl border px-2 py-1.5 text-[10px] ${libraryFilter === "all" ? "border-emerald-400/60 bg-emerald-950/35 text-emerald-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Todos</button>
                  <button type="button" onClick={() => setLibraryFilter("runner")} className={`rounded-xl border px-2 py-1.5 text-[10px] ${libraryFilter === "runner" ? "border-cyan-400/60 bg-cyan-950/35 text-cyan-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Runner</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredPresets.map((preset) => (
                    <button key={preset.key} type="button" onClick={() => applyPreset(preset.key)} className={`rounded-2xl border p-3 text-left ${getAccentClasses(preset.tone, false)}`}>
                      <div className="text-[11px] font-semibold">{preset.label}</div>
                      <div className="mt-1 text-[10px] text-white/70">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">Auto bind visual</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["proximity", "Proximidade"],
                    ["envelope", "Envelope"],
                    ["hinge", "Dobradiça"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAutoBindDraft((prev) => ({ ...prev, mode: key }))}
                      className={`rounded-xl border px-2 py-2 text-[10px] ${
                        autoBindDraft.mode === key
                          ? "border-sky-400/60 bg-sky-900/35 text-sky-100"
                          : "border-slate-700 bg-slate-950/85 text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/65 p-3 text-[10px] text-slate-300">
                  {AUTO_BIND_MODES[autoBindDraft.mode]?.description}
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>Raio de influencia</span><span>{Number(autoBindDraft.radius || 0).toFixed(2)}</span></div>
                    <input type="range" min="0.08" max="1" step="0.01" value={String(autoBindDraft.radius || 0.3)} onChange={(event) => setAutoBindDraft((prev) => ({ ...prev, radius: clamp(event.target.value, 0.08, 1) }))} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>Falloff</span><span>{Number(autoBindDraft.falloff || 0).toFixed(2)}</span></div>
                    <input type="range" min="0.05" max="1" step="0.01" value={String(autoBindDraft.falloff || 0.5)} onChange={(event) => setAutoBindDraft((prev) => ({ ...prev, falloff: clamp(event.target.value, 0.05, 1) }))} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>Rigidez</span><span>{Number(autoBindDraft.stiffness || 0).toFixed(2)}</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={String(autoBindDraft.stiffness || 0.6)} onChange={(event) => setAutoBindDraft((prev) => ({ ...prev, stiffness: clamp(event.target.value, 0, 1) }))} className="w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAutoBindDraft((prev) => ({ ...prev, mirror: !prev.mirror }))} className={`rounded-xl border px-2 py-2 text-[10px] ${autoBindDraft.mirror ? "border-sky-400/60 bg-sky-900/35 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>{autoBindDraft.mirror ? "Mirror: ON" : "Mirror: OFF"}</button>
                    <button type="button" onClick={() => setAutoBindDraft((prev) => ({ ...prev, normalize: !prev.normalize }))} className={`rounded-xl border px-2 py-2 text-[10px] ${autoBindDraft.normalize ? "border-sky-400/60 bg-sky-900/35 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>{autoBindDraft.normalize ? "Normalize: ON" : "Normalize: OFF"}</button>
                  </div>
                  <button type="button" onClick={applyAutoBindSettings} className="w-full rounded-xl border border-sky-400/60 bg-sky-900/40 px-3 py-2 text-[11px] font-semibold text-sky-100">Aplicar auto bind</button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_250px]">
            <div className="relative min-h-0 border-b border-slate-800 bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%,#01030a_100%)]">
              <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setIsPlaying((prev) => !prev)} className="rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-3 py-2 text-[11px] font-semibold text-cyan-100">{isPlaying ? "Pausar" : "Tocar"}</button>
                <button type="button" onClick={() => { setIsPlaying(false); setPlayhead(0); }} className="rounded-xl border border-slate-700 bg-slate-950/85 px-3 py-2 text-[11px] text-slate-200">Voltar</button>
                <button type="button" onClick={() => upsertKeyframe()} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/50 px-3 py-2 text-[11px] text-fuchsia-100">Gravar keyframe</button>
                <button type="button" onClick={() => setDragPoseAutoKey((prev) => !prev)} className={`rounded-xl border px-3 py-2 text-[11px] ${dragPoseAutoKey ? "border-emerald-400/50 bg-emerald-950/40 text-emerald-100" : "border-slate-700 bg-slate-950/85 text-slate-200"}`}>{dragPoseAutoKey ? "Arrastar grava KF: ON" : "Arrastar grava KF: OFF"}</button>
                <button type="button" onClick={() => setHumanLegAssist((prev) => !prev)} className={`rounded-xl border px-3 py-2 text-[11px] ${humanLegAssist ? "border-amber-400/50 bg-amber-950/40 text-amber-100" : "border-slate-700 bg-slate-950/85 text-slate-200"}`}>{humanLegAssist ? "Perna humana: ON" : "Perna humana: OFF"}</button>
                <button type="button" onClick={() => setFloppyMode((prev) => !prev)} className={`rounded-xl border px-3 py-2 text-[11px] ${floppyMode ? "border-sky-400/50 bg-sky-950/40 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-200"}`}>{floppyMode ? "Modo molengo: ON" : "Modo molengo: OFF"}</button>
                <span className="rounded-full border border-slate-700 bg-slate-950/88 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">{String(selectedTarget?.label || "Controle")} • {formatSeconds(playhead)}</span>
              </div>
              {floppyMode ? (
                <div className="absolute left-4 top-16 z-10 w-[280px] rounded-2xl border border-sky-500/25 bg-slate-950/82 px-3 py-3 text-[10px] text-sky-100">
                  <div className="font-semibold uppercase tracking-[0.18em] text-sky-200">Molengo</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setFloppyScope("dangly")} className={`rounded-lg border px-2 py-1.5 ${floppyScope === "dangly" ? "border-sky-400/60 bg-sky-900/35 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Pendentes</button>
                    <button type="button" onClick={() => setFloppyScope("upper")} className={`rounded-lg border px-2 py-1.5 ${floppyScope === "upper" ? "border-sky-400/60 bg-sky-900/35 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Bracos</button>
                    <button type="button" onClick={() => setFloppyScope("all")} className={`rounded-lg border px-2 py-1.5 ${floppyScope === "all" ? "border-sky-400/60 bg-sky-900/35 text-sky-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>Tudo</button>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-slate-300"><span>Gravidade</span><span>{Number(floppyGravity).toFixed(2)}</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={String(floppyGravity)} onChange={(event) => setFloppyGravity(clamp(event.target.value, 0, 1))} className="w-full" />
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-slate-300"><span>Suavidade</span><span>{Number(floppySoftness).toFixed(2)}</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={String(floppySoftness)} onChange={(event) => setFloppySoftness(clamp(event.target.value, 0, 1))} className="w-full" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFloppyAutoKey((prev) => !prev)} className={`rounded-lg border px-2 py-1.5 ${floppyAutoKey ? "border-emerald-400/60 bg-emerald-950/35 text-emerald-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}>{floppyAutoKey ? "Gravar ao soltar" : "Nao gravar"}</button>
                    <button type="button" onClick={() => { viewerRef.current.resetFloppy?.(); setStatusMessage("Molengo resetado."); }} className="rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1.5 text-slate-200">Resetar molengo</button>
                  </div>
                </div>
              ) : null}
              <div className="absolute right-4 top-16 z-10 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-cyan-500/25 bg-slate-950/80 px-3 py-2 text-[10px] text-cyan-100">
                  <div className="uppercase tracking-[0.18em] text-cyan-300/70">Rig</div>
                  <div className="mt-1 text-[11px] font-semibold">{AUTO_RIG_TEMPLATES[selectedRigTemplate]?.label || "Bipede"}</div>
                </div>
                <div className="rounded-2xl border border-sky-500/25 bg-slate-950/80 px-3 py-2 text-[10px] text-sky-100">
                  <div className="uppercase tracking-[0.18em] text-sky-300/70">Bind</div>
                  <div className="mt-1 text-[11px] font-semibold">{AUTO_BIND_MODES[autoBindDraft.mode]?.label || "Proximidade"}</div>
                </div>
                <div className="rounded-2xl border border-fuchsia-500/25 bg-slate-950/80 px-3 py-2 text-[10px] text-fuchsia-100">
                  <div className="uppercase tracking-[0.18em] text-fuchsia-300/70">Clip</div>
                  <div className="mt-1 truncate text-[11px] font-semibold">{String(activeClip?.name || "Idle")}</div>
                </div>
              </div>
              <div ref={previewRef} className="h-full w-full" />
              <div className="pointer-events-none absolute left-4 top-16 z-10 max-w-[420px] rounded-2xl border border-slate-700/80 bg-slate-950/82 px-3 py-2 text-[11px] text-slate-200">
                {loadInfo.message || "Carregando preview..."}
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-slate-800 bg-slate-950/78 px-3 py-2 text-[11px] text-slate-200">Clique numa bolinha do esqueleto para posar. No `Modo molengo`, arraste a bolinha azul central para o boneco balancar em tempo real. `Pendentes` costuma ficar mais natural. Scroll aproxima, botao esquerdo gira, direito move.</div>
            </div>
            <div className="min-h-0 overflow-y-auto bg-slate-950/96 px-4 py-4">
              <div className="mb-3 flex items-center gap-3">
                <input type="range" min="0" max={String(Math.max(activeClip?.duration || 1, 0.2))} step="0.01" value={String(playhead)} onChange={(event) => { setIsPlaying(false); setPlayhead(clamp(event.target.value, 0, Math.max(activeClip?.duration || 1, 0.2))); }} className="w-full" />
                <div className="min-w-[88px] rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-right text-[11px] text-slate-200">{formatSeconds(playhead)}</div>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => stepToNeighborKeyframe(-1)} className="rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1.5 text-[10px] text-slate-200">KF anterior</button>
                <button type="button" onClick={() => stepToNeighborKeyframe(1)} className="rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1.5 text-[10px] text-slate-200">Proximo KF</button>
                <button type="button" onClick={() => nudgeSelectedKeyframe(-0.02)} className="rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1.5 text-[10px] text-slate-200">-0.02s</button>
                <button type="button" onClick={() => nudgeSelectedKeyframe(0.02)} className="rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1.5 text-[10px] text-slate-200">+0.02s</button>
                <button type="button" onClick={duplicateSelectedKeyframe} className="rounded-lg border border-fuchsia-500/35 bg-fuchsia-950/30 px-2 py-1.5 text-[10px] text-fuchsia-100">Duplicar KF</button>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-[10px] text-slate-300">
                  {selectedFrame ? `KF selecionado: ${formatSeconds(selectedFrame.time)}` : "Clique num KF para editar"}
                </div>
              </div>
              <div className="space-y-2">
                {timelineTargets.map((target) => (
                  <TimelineRow
                    key={target.id}
                    label={target.label}
                    frames={activeClip?.tracks?.[target.id] || []}
                    duration={Math.max(activeClip?.duration || 1, 0.2)}
                    playhead={playhead}
                    active={target.id === selectedTargetId}
                    onSeek={(time) => {
                      setSelectedTargetId(target.id);
                      setIsPlaying(false);
                      setPlayhead(time);
                    }}
                    onSelectFrame={(frame) => selectFrame(target.id, frame)}
                    onAddFrame={() => {
                      setSelectedTargetId(target.id);
                      upsertKeyframe();
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto border-l border-slate-800 bg-slate-950/95 px-4 py-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Inspector</p>
                <div className="mt-3 space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[10px] text-slate-400">Nome do clip</span>
                    <input type="text" value={String(activeClip?.name || "")} onChange={(event) => patchActiveClip({ name: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                  </label>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>Duracao</span><span>{formatSeconds(activeClip?.duration || 0)}</span></div>
                    <input type="range" min="0.2" max="8" step="0.05" value={String(activeClip?.duration || 1)} onChange={(event) => patchActiveClip({ duration: clamp(event.target.value, 0.2, 8) })} className="w-full" />
                  </div>
                  <button type="button" onClick={() => patchActiveClip({ loop: !activeClip?.loop })} className={`h-9 w-full rounded-xl border text-[11px] ${activeClip?.loop ? "border-cyan-400/60 bg-cyan-950/35 text-cyan-100" : "border-slate-700 bg-slate-950 text-slate-200"}`}>{activeClip?.loop ? "Loop: ON" : "Loop: OFF"}</button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Transform</p>
                <div className="mt-3 space-y-3">
                  {selectedFrame ? (
                    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/15 p-3 text-[10px] text-fuchsia-100">
                      <div className="mb-2 flex items-center justify-between">
                        <span>KF selecionado</span>
                        <span>{formatSeconds(selectedFrame.time)}</span>
                      </div>
                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between text-slate-300"><span>Tempo</span><span>{formatSeconds(selectedFrame.time)}</span></div>
                        <input type="range" min="0" max={String(Math.max(activeClip?.duration || 1, 0.2))} step="0.01" value={String(selectedFrame.time)} onChange={(event) => { const next = Number(clamp(event.target.value, 0, Math.max(activeClip?.duration || 1, 0.2)).toFixed(3)); updateSelectedKeyframe({ time: next }); setPlayhead(next); }} className="w-full" />
                      </div>
                      <div>
                        <div className="mb-1 text-slate-300">Interpolacao</div>
                        <div className="grid grid-cols-3 gap-2">
                          {["smooth", "linear", "step"].map((easing) => (
                            <button
                              key={easing}
                              type="button"
                              onClick={() => updateSelectedKeyframe({ easing })}
                              className={`rounded-lg border px-2 py-1.5 ${selectedFrame.easing === easing ? "border-fuchsia-400/60 bg-fuchsia-950/40 text-fuchsia-100" : "border-slate-700 bg-slate-950/85 text-slate-300"}`}
                            >
                              {easing}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {[["rotation", "x", "Rot X"], ["rotation", "y", "Rot Y"], ["rotation", "z", "Rot Z"], ["position", "x", "Pos X"], ["position", "y", "Pos Y"], ["position", "z", "Pos Z"]].map(([kind, axis, label]) => (
                    <div key={`${kind}-${axis}`}>
                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>{label}</span><span>{Number(sampledPose?.[kind]?.[axis] || 0).toFixed(2)}</span></div>
                      <input type="range" min={kind === "rotation" ? "-2.4" : "-0.8"} max={kind === "rotation" ? "2.4" : "0.8"} step="0.01" value={String(sampledPose?.[kind]?.[axis] || 0)} onChange={(event) => updateAxis(kind, axis, event.target.value)} className="w-full" />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => upsertKeyframe()} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/45 px-3 py-2 text-[11px] text-fuchsia-100">Atualizar KF</button>
                    <button type="button" onClick={removeKeyframe} className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-100">Remover KF</button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Dinamica leve</p>
                <div className="mt-3 space-y-3">
                  <button type="button" onClick={() => patchActiveClip({ dynamics: { ...activeClip?.dynamics, enabled: !activeClip?.dynamics?.enabled } })} className={`h-9 w-full rounded-xl border text-[11px] ${activeClip?.dynamics?.enabled ? "border-emerald-400/60 bg-emerald-950/30 text-emerald-100" : "border-slate-700 bg-slate-950 text-slate-200"}`}>{activeClip?.dynamics?.enabled ? "Molengo/gravidade: ON" : "Molengo/gravidade: OFF"}</button>
                  {[["gravity", "Gravidade"], ["softness", "Suavidade"], ["bounce", "Bounce"], ["glow", "Glow"], ["pulse", "Pulse"]].map(([field, label]) => (
                    <div key={field}>
                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>{label}</span><span>{Number(activeClip?.dynamics?.[field] || 0).toFixed(2)}</span></div>
                      <input type="range" min="0" max="1" step="0.01" value={String(activeClip?.dynamics?.[field] || 0)} onChange={(event) => patchActiveClip({ dynamics: { ...activeClip?.dynamics, [field]: clamp(event.target.value, 0, 1) } })} className="w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Clips originais</p>
                <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2 text-[10px] text-slate-300">
                    Bind atual: <span className="font-semibold text-sky-200">{String((studioData?.autoBind?.mode || autoBindDraft.mode || "proximity")).toUpperCase()}</span>
                    {" • "}
                    raio {Number(studioData?.autoBind?.radius || autoBindDraft.radius || 0).toFixed(2)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2">
                      <div className="text-slate-400">Vertices</div>
                      <div className="mt-1 font-semibold text-cyan-100">{bindInspector.influenced}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2">
                      <div className="text-slate-400">Malhas</div>
                      <div className="mt-1 font-semibold text-cyan-100">{bindInspector.meshes}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2">
                      <div className="text-slate-400">Pico</div>
                      <div className="mt-1 font-semibold text-cyan-100">{Number(bindInspector.peak || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2 text-[10px] text-slate-300">
                    Snapshot salvo: <span className="font-semibold text-cyan-100">{Number(studioData?.autoBindMap?.controls?.length || 0)}</span> controles
                  </div>
                  {sourceAnimations.length ? sourceAnimations.slice(0, 5).map((clip) => <div key={clip.name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5 text-[10px]"><span className="truncate">{clip.name}</span><span className="text-slate-400">{formatSeconds(clip.duration)}</span></div>) : <p className="text-slate-400">Sem clips originais detectados.</p>}
                </div>
              </div>
              {statusMessage ? <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-3 text-[11px] text-cyan-100">{statusMessage}</div> : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
