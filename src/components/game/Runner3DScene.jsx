import React from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { resolveAssetUrl } from "@/api/base44Client";
import defaultRoadChunkModelUrl from "../../../assets-para-app/jogos/chunk_road_01.glb?url";
import powerCrateGlbUrl from "../../../assets-para-app/jogos/box+surpresa+estrada.glb?url";
import playerIdleFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM IDLE.fbx?url";
import playerRunFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM correndo.fbx?url";
import playerChestBgRunFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM correndo p frente ca camera background tela bau.fbx?url";
import playerCollectFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM CORRENDO E COLETANDO AS MOEDAS DA ESTRADA.fbx?url";
import playerJumpFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM PULANDO POR CIMA.fbx?url";
import playerRunJumpFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM RUN JUMP.fbx?url";
import playerSlideFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM DESLIZANDO POR BAIXO.fbx?url";
import playerHitFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM BATENDO NO ITEM DA ESTRADA E SENDO ELIMINADO.fbx?url";
import playerScaredFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM PARADA ASSUSTADO.fbx?url";
import playerCelebrateChestFbxUrl from "../../../assets-para-app/jogos/personagem principal/PERSONAGEM comemorando quando bau abre.fbx?url";

const loadOrbitControlsModule = () => import("three/examples/jsm/controls/OrbitControls.js");
const loadBufferGeometryUtilsModule = () => import("three/examples/jsm/utils/BufferGeometryUtils.js");
const loadTessellateModifierModule = () => import("three/examples/jsm/modifiers/TessellateModifier.js");

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function safeColor(value, fallback) {
  try {
    const input = String(value || fallback);
    const rgbaMatch = input.match(
      /^\s*rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)\s*$/i
    );
    if (rgbaMatch) {
      const r = Math.max(0, Math.min(255, Number(rgbaMatch[1]) || 0)) / 255;
      const g = Math.max(0, Math.min(255, Number(rgbaMatch[2]) || 0)) / 255;
      const b = Math.max(0, Math.min(255, Number(rgbaMatch[3]) || 0)) / 255;
      return new THREE.Color(r, g, b);
    }
    return new THREE.Color(input);
  } catch {
    return new THREE.Color(fallback);
  }
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePreviewModelRoot(object3d, targetHeight) {
  if (!object3d) return;
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  const reference = size.y > 0.0001 ? size.y : maxDim;
  const scale = targetHeight / reference;
  object3d.scale.setScalar(scale);
  box.setFromObject(object3d);
  box.getCenter(center);
  object3d.position.set(-center.x, -box.min.y, -center.z);
  object3d.rotation.y = Math.PI;
}

function disposeObjectMaterialsOnly(root) {
  if (!root) return;
  const disposed = new Set();
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material || disposed.has(material)) return;
      disposed.add(material);
      material.dispose?.();
    });
  });
}

function hasFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

const DEFAULT_LOADOUT_CAMERA_RIG = Object.freeze({
  cameraX: 0,
  cameraYOffset: 0.74,
  cameraZ: -6.95,
  targetX: 0,
  targetYOffset: 2.54,
  targetZ: -9.28,
});
const DEFAULT_SCENE_RENDER = {
  masterDistance: 260,
  vegetationDistance: 150,
  roadDistance: 120,
  objectDistance: 110,
  shadowsEnabled: true,
  lightX: 2,
  lightY: 8,
  lightZ: 6,
};

const DEFAULT_ROAD_CHUNK_MODEL_URL = defaultRoadChunkModelUrl;
const DEFAULT_POWER_CRATE_MODEL_URL = powerCrateGlbUrl;

function normalizeLoadoutCameraRig(value) {
  const source = value && typeof value === "object" ? value : {};
  const clamp = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    cameraX: clamp(source.cameraX, DEFAULT_LOADOUT_CAMERA_RIG.cameraX, -18, 18),
    cameraYOffset: clamp(source.cameraYOffset, DEFAULT_LOADOUT_CAMERA_RIG.cameraYOffset, -2, 12),
    cameraZ: clamp(source.cameraZ, DEFAULT_LOADOUT_CAMERA_RIG.cameraZ, -22, 10),
    targetX: clamp(source.targetX, DEFAULT_LOADOUT_CAMERA_RIG.targetX, -18, 18),
    targetYOffset: clamp(source.targetYOffset, DEFAULT_LOADOUT_CAMERA_RIG.targetYOffset, -2, 12),
    targetZ: clamp(source.targetZ, DEFAULT_LOADOUT_CAMERA_RIG.targetZ, -22, 10),
  };
}
const LOADOUT_WARDROBE_SLOT_ANCHORS = Object.freeze({
  head: { x: 0, y: 1.56, z: 0.02 },
  top: { x: 0, y: 1.02, z: 0.02 },
  bottom: { x: 0, y: 0.54, z: 0.01 },
  shoes: { x: 0, y: 0.02, z: 0.04 },
  hands: { x: 0, y: 0.98, z: 0.08 },
  back: { x: 0, y: 1.02, z: -0.18 },
  accessory: { x: 0, y: 1.08, z: 0.18 },
});
const LOADOUT_WARDROBE_AUTO_RIG_SLOT_KEYS = new Set(["top", "bottom", "shoes", "hands"]);
const LOADOUT_WARDROBE_BONE_ATTACHMENTS = Object.freeze({
  back: {
    boneHints: ["spine2", "spine_02", "upperchest", "upper_chest", "chest", "spine1", "spine_01", "spine"],
    offset: { x: 0, y: 0.04, z: -0.16 },
  },
});

function normalizeWardrobeTransform(value) {
  const source = value && typeof value === "object" ? value : {};
  const clamp = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    offsetX: clamp(source.offsetX, 0, -3, 3),
    offsetY: clamp(source.offsetY, 0, -3, 3),
    offsetZ: clamp(source.offsetZ, 0, -3, 3),
    rotationX: clamp(source.rotationX, 0, -180, 180),
    rotationY: clamp(source.rotationY, 0, -180, 180),
    rotationZ: clamp(source.rotationZ, 0, -180, 180),
    scale: clamp(source.scale, 1, 0.2, 4),
  };
}

const DEFAULT_ELEVATED_BRIDGE_DEBUG_TRANSFORM = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
});

function normalizeElevatedBridgeDebugTransform(value) {
  const source = value && typeof value === "object" ? value : {};
  const clamp = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    positionX: clamp(source.positionX, 0, -20, 20),
    positionY: clamp(source.positionY, 0, -10, 10),
    positionZ: clamp(source.positionZ, 0, -20, 20),
    rotationX: clamp(source.rotationX, 0, -180, 180),
    rotationY: clamp(source.rotationY, 0, -180, 180),
    rotationZ: clamp(source.rotationZ, 0, -180, 180),
    scaleX: clamp(source.scaleX, 1, 0.05, 8),
    scaleY: clamp(source.scaleY, 1, 0.05, 8),
    scaleZ: clamp(source.scaleZ, 1, 0.05, 8),
  };
}

function readGraphicsSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const fpsNum = Number(raw.fpsCap);
  const imageQualityNum = Number(raw.imageQuality);
  const antiAlias = String(raw.antiAlias || "auto").toLowerCase();
  const detailLevel = String(raw.detailLevel || "medium").toLowerCase();
  return {
    fpsCap: Number.isFinite(fpsNum) ? Math.max(24, Math.min(120, fpsNum)) : 45,
    imageQuality: Number.isFinite(imageQualityNum) ? Math.max(0.7, Math.min(1.35, imageQualityNum)) : 1,
    antiAlias: antiAlias === "on" || antiAlias === "off" ? antiAlias : "auto",
    detailLevel: ["low", "medium", "high", "maximum"].includes(detailLevel) ? detailLevel : "medium",
  };
}

function isPowerOfTwoSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return false;
  return (n & (n - 1)) === 0;
}

function nextPowerOfTwoSize(value) {
  let n = Math.max(1, Math.floor(Number(value) || 1));
  n -= 1;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
}

function readTextureBudgetProfile(graphicsSettings, isLowPerfDevice, isVeryLowPerfDevice) {
  const settings = readGraphicsSettings(graphicsSettings);
  const quality = Number(settings.imageQuality) || 1;
  const detailLevel = settings.detailLevel;
  const lowDetail = detailLevel === "low";
  const mediumDetail = detailLevel === "medium";
  if (isVeryLowPerfDevice || lowDetail || quality <= 0.85) {
    return {
      maxTextureSize: 512,
      anisotropy: 1,
      loadShadowOverlay: false,
      loadRoadShoulderSecondaryMaps: false,
    };
  }
  if (isLowPerfDevice || mediumDetail || quality <= 1) {
    return {
      maxTextureSize: 1024,
      anisotropy: 2,
      loadShadowOverlay: true,
      loadRoadShoulderSecondaryMaps: true,
    };
  }
  return {
    maxTextureSize: 2048,
    anisotropy: 4,
    loadShadowOverlay: true,
    loadRoadShoulderSecondaryMaps: true,
  };
}

function downscaleTextureImageIfNeeded(texture, maxTextureSize) {
  const image = texture?.image;
  const maxSize = Math.max(0, Number(maxTextureSize) || 0);
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (!image || !maxSize || !width || !height) return;
  if (width <= maxSize && height <= maxSize) return;
  try {
    const scale = Math.min(maxSize / width, maxSize / height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    texture.image = canvas;
    texture.needsUpdate = true;
  } catch {
    // Keep original texture if runtime downscale fails.
  }
}

function detectAssetTypeFromUrl(url) {
  const safe = String(url || "").toLowerCase().split("?")[0].split("#")[0];
  if (!safe) return "image";
  if (safe.endsWith(".webm") || safe.endsWith(".mp4")) return "video";
  if (
    safe.endsWith(".glb") ||
    safe.endsWith(".gltf") ||
    safe.endsWith(".fbx") ||
    safe.endsWith(".obj") ||
    safe.endsWith(".stl")
  ) {
    return "model3d";
  }
  return "image";
}

function getSceneAssetFileName(rawPath) {
  const input = String(rawPath || "").trim();
  if (!input) return "arquivo";
  let clean = input;
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep raw value when decode fails.
  }
  const noQuery = clean.split("?")[0].split("#")[0];
  const normalized = noQuery.replace(/\\/g, "/");
  return normalized.split("/").pop() || normalized || "arquivo";
}

function getCanonicalSceneAssetName(rawPath) {
  const fileName = getSceneAssetFileName(rawPath);
  const dotIndex = fileName.lastIndexOf(".");
  const hasExt = dotIndex > 0;
  const ext = hasExt ? fileName.slice(dotIndex).toLowerCase() : "";
  let base = hasExt ? fileName.slice(0, dotIndex) : fileName;
  base = base.replace(/^\d{10,}-/, "");
  base = base.replace(/-\d{10,}(?:-[a-z0-9]{4,})?$/i, "");
  base = base.replace(/-\d{10,}(?:-[a-z0-9]{4,})?$/i, "");
  return `${base || "arquivo"}${ext}`;
}

function normalizeDefaultRoadChunkUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return DEFAULT_ROAD_CHUNK_MODEL_URL;
  const canonical = getCanonicalSceneAssetName(value).toLowerCase();
  if (canonical === "chunk_road_01.fbx" || canonical === "chunk_road_01.glb") {
    return DEFAULT_ROAD_CHUNK_MODEL_URL;
  }
  return value;
}

function isEnvironmentInstancingCandidateName(rawPath) {
  const canonical = getCanonicalSceneAssetName(rawPath).toLowerCase();
  return /(arvore|tree|pedra|rock|rocha|tronco|log|mato|bush|arbusto|estrada|road|muro|wall|barranco|slope|bank)/i.test(canonical);
}

function resolveSceneUploadUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/api/uploads/")) return resolveAssetUrl(raw);
  if (raw.startsWith("uploads/") || raw.startsWith("api/uploads/")) return resolveAssetUrl(`/${raw}`);
  if (raw.startsWith("\\uploads\\") || raw.startsWith("uploads\\") || raw.startsWith("\\api\\uploads\\")) {
    return resolveAssetUrl(raw.replace(/\\/g, "/").replace(/^\/?/, "/"));
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      const pathname = String(parsed.pathname || "");
      if (pathname.startsWith("/uploads/") || pathname.startsWith("/api/uploads/")) {
        return resolveAssetUrl(raw);
      }
      // Keep non-upload absolute URLs on original host (frontend static assets).
      return raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

function createFallbackOrbitControls(camera) {
  return {
    enabled: false,
    enableDamping: false,
    dampingFactor: 0,
    enablePan: false,
    screenSpacePanning: false,
    panSpeed: 1,
    rotateSpeed: 1,
    zoomSpeed: 1,
    minDistance: 0,
    maxDistance: 0,
    maxPolarAngle: Math.PI,
    mouseButtons: {},
    target: new THREE.Vector3(0, 1.2, -20),
    update() {},
    dispose() {},
    addEventListener() {},
    removeEventListener() {},
  };
}

let mergeVerticesFn = null;
let mergeVerticesLoadPromise = null;
let TessellateModifierCtor = null;
let tessellateModifierLoadPromise = null;

function ensureMergeVerticesLoaded() {
  if (mergeVerticesFn) return Promise.resolve(mergeVerticesFn);
  if (mergeVerticesLoadPromise) return mergeVerticesLoadPromise;
  mergeVerticesLoadPromise = loadBufferGeometryUtilsModule()
    .then((module) => {
      mergeVerticesFn = module?.mergeVertices || null;
      return mergeVerticesFn;
    })
    .catch(() => null);
  return mergeVerticesLoadPromise;
}

function ensureTessellateModifierLoaded() {
  if (TessellateModifierCtor) return Promise.resolve(TessellateModifierCtor);
  if (tessellateModifierLoadPromise) return tessellateModifierLoadPromise;
  tessellateModifierLoadPromise = loadTessellateModifierModule()
    .then((module) => {
      TessellateModifierCtor = module?.TessellateModifier || null;
      return TessellateModifierCtor;
    })
    .catch(() => null);
  return tessellateModifierLoadPromise;
}

function mergeVerticesWhenReady(geometry, tolerance = 1e-4) {
  if (mergeVerticesFn) {
    return mergeVerticesFn(geometry, tolerance);
  }
  ensureMergeVerticesLoaded().catch(() => null);
  return geometry;
}

function createTessellateModifierWhenReady(maxEdgeLength, iterations = 2) {
  if (TessellateModifierCtor) {
    return new TessellateModifierCtor(maxEdgeLength, iterations);
  }
  ensureTessellateModifierLoaded().catch(() => null);
  return null;
}

const sharedCharacterAssetLoadingManager = new THREE.LoadingManager();
const sharedCharacterAssetFbxLoader = new FBXLoader(sharedCharacterAssetLoadingManager);
const sharedCharacterAssetObjLoader = new OBJLoader(sharedCharacterAssetLoadingManager);
const sharedCharacterAssetStlLoader = new STLLoader(sharedCharacterAssetLoadingManager);
const sharedCharacterAssetDracoLoader = new DRACOLoader(sharedCharacterAssetLoadingManager);
sharedCharacterAssetDracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
const sharedCharacterAssetGltfLoader = new GLTFLoader(sharedCharacterAssetLoadingManager);
sharedCharacterAssetGltfLoader.setDRACOLoader(sharedCharacterAssetDracoLoader);
sharedCharacterAssetGltfLoader.setMeshoptDecoder(MeshoptDecoder);
const sharedCharacterAssetTemplateCache = new Map();
const sharedCharacterAssetPromiseCache = new Map();

function cloneCharacterTemplateRoot(root) {
  if (!root) return null;
  try {
    return SkeletonUtils.clone(root);
  } catch {
    return root.clone(true);
  }
}

function cloneCharacterAnimationList(animations) {
  return Array.isArray(animations) ? animations.map((clip) => (clip?.clone ? clip.clone() : clip)).filter(Boolean) : [];
}

function loadSharedCharacterAsset(rawUrl) {
  const requestedUrl = String(rawUrl || "").trim();
  const resolvedUrl = resolveSceneUploadUrl(requestedUrl);
  const cacheKey = resolvedUrl || requestedUrl;
  if (!requestedUrl || !resolvedUrl) {
    return Promise.resolve({ root: null, animations: [], sourceUrl: requestedUrl });
  }
  if (sharedCharacterAssetTemplateCache.has(cacheKey)) {
    return Promise.resolve(sharedCharacterAssetTemplateCache.get(cacheKey));
  }
  if (sharedCharacterAssetPromiseCache.has(cacheKey)) {
    return sharedCharacterAssetPromiseCache.get(cacheKey);
  }
  const promise = new Promise((resolve) => {
    const finish = (root, animations = []) => {
      const entry = {
        root: root || null,
        animations: Array.isArray(animations) ? animations : [],
        sourceUrl: requestedUrl,
      };
      sharedCharacterAssetTemplateCache.set(cacheKey, entry);
      resolve(entry);
    };
    const fail = () => finish(null, []);
    if (/\.fbx(?:\?|#|$)/i.test(resolvedUrl)) {
      sharedCharacterAssetFbxLoader.load(resolvedUrl, (fbx) => finish(fbx || null, fbx?.animations || []), undefined, fail);
      return;
    }
    if (/\.glb(?:\?|#|$)|\.gltf(?:\?|#|$)/i.test(resolvedUrl)) {
      sharedCharacterAssetGltfLoader.load(
        resolvedUrl,
        (gltf) => finish(gltf?.scene || null, gltf?.animations || []),
        undefined,
        fail
      );
      return;
    }
    if (/\.obj(?:\?|#|$)/i.test(resolvedUrl)) {
      sharedCharacterAssetObjLoader.load(resolvedUrl, (obj) => finish(obj || null, []), undefined, fail);
      return;
    }
    if (/\.stl(?:\?|#|$)/i.test(resolvedUrl)) {
      sharedCharacterAssetStlLoader.load(
        resolvedUrl,
        (geometry) =>
          finish(
            new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                color: 0xcbd5e1,
                roughness: 0.78,
                metalness: 0.04,
              })
            ),
            []
          ),
        undefined,
        fail
      );
      return;
    }
    fail();
  }).finally(() => {
    sharedCharacterAssetPromiseCache.delete(cacheKey);
  });
  sharedCharacterAssetPromiseCache.set(cacheKey, promise);
  return promise;
}

export function warmRunnerCharacterAsset(rawUrl) {
  return loadSharedCharacterAsset(rawUrl).then((entry) => !!entry?.root);
}

function instantiateSharedCharacterAsset(rawUrl) {
  return loadSharedCharacterAsset(rawUrl).then((entry) => ({
    root: cloneCharacterTemplateRoot(entry?.root || null),
    animations: cloneCharacterAnimationList(entry?.animations || []),
    sourceUrl: String(entry?.sourceUrl || rawUrl || "").trim(),
  }));
}

function findModelAnchorLocalPosition(root, anchorName) {
  if (!root || !anchorName) return null;
  const wanted = String(anchorName).trim().toUpperCase();
  let anchorNode = null;
  root.traverse((node) => {
    if (anchorNode || !node?.name) return;
    if (String(node.name).trim().toUpperCase() === wanted) {
      anchorNode = node;
    }
  });
  if (!anchorNode) return null;
  root.updateWorldMatrix(true, true);
  const worldPos = new THREE.Vector3();
  const localPos = new THREE.Vector3();
  const rootInverse = new THREE.Matrix4();
  anchorNode.getWorldPosition(worldPos);
  rootInverse.copy(root.matrixWorld).invert();
  localPos.copy(worldPos).applyMatrix4(rootInverse);
  return localPos;
}

function inferRoadChunkAnchorsFromBounds(bounds, startAnchor, endAnchor) {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bounds.getCenter(center);
  bounds.getSize(size);
  const useX = (size.x || 0) >= (size.z || 0);
  const axisLength = Math.max(0.001, useX ? size.x || 0 : size.z || 0);
  const startFallback = useX
    ? new THREE.Vector3(bounds.min.x, center.y, center.z)
    : new THREE.Vector3(center.x, center.y, bounds.min.z);
  const endFallback = useX
    ? new THREE.Vector3(bounds.max.x, center.y, center.z)
    : new THREE.Vector3(center.x, center.y, bounds.max.z);
  if (startAnchor && endAnchor) {
    return { start: startAnchor.clone(), end: endAnchor.clone() };
  }
  if (startAnchor && !endAnchor) {
    const inferredEnd = startAnchor.clone();
    if (useX) inferredEnd.x += axisLength;
    else inferredEnd.z += axisLength;
    return { start: startAnchor.clone(), end: inferredEnd };
  }
  if (!startAnchor && endAnchor) {
    const inferredStart = endAnchor.clone();
    if (useX) inferredStart.x -= axisLength;
    else inferredStart.z -= axisLength;
    return { start: inferredStart, end: endAnchor.clone() };
  }
  return { start: startFallback, end: endFallback };
}

function assignDevPick(object3d, payload) {
  if (!object3d || !payload) return;
  object3d.userData.devPick = payload;
}

function applyCurvedHorizonShader(material, uniforms) {
  if (!material || material.userData?.curvedHorizonShaderApplied) return;
  material.userData.curvedHorizonShaderApplied = true;
  material.customProgramCacheKey = () => "curved-horizon-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHorizonCurveSide = uniforms.curveSide;
    shader.uniforms.uHorizonCurveDown = uniforms.curveDown;
    shader.uniforms.uHorizonHalfWidth = uniforms.halfWidth;
    shader.uniforms.uHorizonGrade = uniforms.grade;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uHorizonCurveSide;
uniform float uHorizonCurveDown;
uniform float uHorizonHalfWidth;
uniform float uHorizonGrade;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float horizonXNorm = abs(position.x) / max(1.0, uHorizonHalfWidth);
float horizonSideCurve = pow(horizonXNorm, 1.78);
transformed.z += uHorizonCurveSide * horizonSideCurve;
transformed.y -= uHorizonCurveDown * pow(horizonXNorm, 1.48);
float horizonYNorm = clamp((position.y + 40.0) / 80.0, 0.0, 1.0);
transformed.y += uHorizonGrade * pow(horizonYNorm, 1.35);`
      );
  };
  material.needsUpdate = true;
}

const PLAYER_BASE_HEIGHT = 1.92;
const PLAYER_ANIMATION_SOURCES = [
  { key: "idle", url: playerIdleFbxUrl },
  { key: "run", url: playerRunFbxUrl },
  { key: "result_bg_run", url: playerChestBgRunFbxUrl },
  { key: "collect", url: playerCollectFbxUrl },
  { key: "jump", url: playerJumpFbxUrl },
  { key: "run_jump", url: playerRunJumpFbxUrl },
  { key: "slide", url: playerSlideFbxUrl },
  { key: "hit", url: playerHitFbxUrl },
  { key: "scared", url: playerScaredFbxUrl },
  { key: "celebrate", url: playerCelebrateChestFbxUrl },
];

function remapUvByBoxProjection(geometry) {
  const pos = geometry?.attributes?.position;
  if (!pos) return;
  const normalAttr = geometry?.attributes?.normal;
  if (!normalAttr) return;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return;
  const sx = Math.max(0.0001, bbox.max.x - bbox.min.x);
  const sy = Math.max(0.0001, bbox.max.y - bbox.min.y);
  const sz = Math.max(0.0001, bbox.max.z - bbox.min.z);
  const count = Math.floor(pos.array.length / 3);
  let uv = geometry.attributes.uv;
  if (!uv || !uv.array || uv.array.length / 2 !== count) {
    uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
    geometry.setAttribute("uv", uv);
  }
  for (let i = 0; i < count; i += 1) {
    const pi = i * 3;
    const ui = i * 2;
    const x = pos.array[pi];
    const y = pos.array[pi + 1];
    const z = pos.array[pi + 2];
    const nx = Math.abs(normalAttr.array[pi]);
    const ny = Math.abs(normalAttr.array[pi + 1]);
    const nz = Math.abs(normalAttr.array[pi + 2]);
    let u = 0;
    let v = 0;
    if (ny >= nx && ny >= nz) {
      u = (x - bbox.min.x) / sx;
      v = (z - bbox.min.z) / sz;
    } else if (nx >= ny && nx >= nz) {
      u = (z - bbox.min.z) / sz;
      v = (y - bbox.min.y) / sy;
    } else {
      u = (x - bbox.min.x) / sx;
      v = (y - bbox.min.y) / sy;
    }
    uv.array[ui] = u;
    uv.array[ui + 1] = v;
  }
  uv.needsUpdate = true;
}

function cloneUvAttribute(attr) {
  if (!attr || attr.itemSize !== 2 || !attr.array) return null;
  return new THREE.BufferAttribute(new Float32Array(attr.array), 2);
}

function ensureImportedOriginalUvBackup(geometry) {
  if (!geometry?.userData) geometry.userData = {};
  if (geometry.userData.originalImportedUv) return;
  const uv = geometry?.attributes?.uv;
  if (uv && uv.count === geometry?.attributes?.position?.count) {
    const cloned = cloneUvAttribute(uv);
    if (cloned) geometry.userData.originalImportedUv = cloned;
  }
}

function restoreImportedOriginalUv(geometry) {
  const backup = geometry?.userData?.originalImportedUv;
  const pos = geometry?.attributes?.position;
  if (!pos || !backup || backup.count !== pos.count) return false;
  geometry.setAttribute("uv", cloneUvAttribute(backup));
  geometry.attributes.uv.needsUpdate = true;
  return true;
}

function normalizeImportedProjectionMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "side" || mode === "back") return mode;
  return "front";
}

function remapUvByViewProjection(geometry, view = "front") {
  const pos = geometry?.attributes?.position;
  if (!pos) return;
  geometry.computeBoundingBox();
  const bbox = geometry?.boundingBox;
  if (!bbox) return;
  const count = pos.count;
  let uv = geometry.attributes.uv;
  if (!uv || !uv.array || uv.array.length / 2 !== count) {
    uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
    geometry.setAttribute("uv", uv);
  }
  const min = bbox.min;
  const size = bbox.getSize(new THREE.Vector3());
  const sx = Math.max(1e-6, size.x);
  const sy = Math.max(1e-6, size.y);
  const sz = Math.max(1e-6, size.z);
  const mode = normalizeImportedProjectionMode(view);
  for (let i = 0; i < count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u = 0;
    let v = 0;
    if (mode === "side") {
      u = (z - min.z) / sz;
      v = 1 - (y - min.y) / sy;
    } else if (mode === "back") {
      u = 1 - (x - min.x) / sx;
      v = 1 - (y - min.y) / sy;
    } else {
      u = (x - min.x) / sx;
      v = 1 - (y - min.y) / sy;
    }
    const ui = i * 2;
    uv.array[ui] = u;
    uv.array[ui + 1] = v;
  }
  uv.needsUpdate = true;
}

export default function Runner3DScene({
  runnerState,
  runnerStateRef = null,
  islandTheme,
  roadCurve,
  bossLane = 0,
  bossDrift,
  bossBump,
  bossTilt,
  isPaused = false,
  enableFreeCamera = false,
  freeCameraPreset = "player",
  cameraResetToken = 0,
  sandTextureUrl,
  roadBaseNormalUrl,
  roadBaseRoughnessUrl,
  roadBaseAoUrl,
  treeTextureUrl,
  vegetationTextureUrls = [],
  edgeVegetationTextureUrls = [],
  disableAmbientVegetation = false,
  obstacleTextureUrl,
  horizonTextureUrl,
  shadowOverlayTextureUrl,
  roadShoulderTextureUrl,
  roadShoulderNormalUrl,
  roadShoulderRoughnessUrl,
  roadShoulderAoUrl,
  roadSlopeTextureUrl,
  grassTopTextureUrl,
  showGuides = false,
  mode = "challenge",
  className = "",
  sceneConfig = null,
  graphicsSettings = null,
  devDraftOverrides = null,
  selectedObjectKey = "",
  devInteractionMode = "select",
  devModelTool = "move",
  devBrushRadius = 0.9,
  devBrushStrength = 0.09,
  devPaintColor = "#9ca3af",
  devToolStrengths = null,
  devConveyorOffset = 0,
  devStageEditMode = "map",
  devMapCursorZ = 0,
  devRoadSculpt = null,
  devRoadEvents = null,
  devSelectedRoadEventId = "",
  sceneRenderDraft = DEFAULT_SCENE_RENDER,
  devCameraFollowDistance = null,
  resultCameraVariant = "default",
  loadoutCameraRig = null,
  loadoutWardrobe = null,
  loadoutCharacterVariant = "hero",
  loadoutBaseModelUrl = "",
  loadoutCharacterSwapDirection = 1,
  loadoutCharacterSwapToken = 0,
  loadoutCameraEditMode = false,
  showElevatedSegmentDevPanel = false,
  elevatedBridgeDebugTransform = null,
  transparentBackground = false,
  hideEnvironment = false,
  onDevObjectPick,
  onDevObjectTransform,
  onDevProceduralEdit,
  onDevRoadEventAdjust,
  onDevCameraInteract,
  onDevSelectedScreenPosition,
  onLoadoutCameraRigChange,
  onSceneReady,
  onIntroComplete,
}) {
  const mountRef = React.useRef(null);
  const dataRef = React.useRef({
    runnerState,
    runnerStateRef,
    islandTheme,
    roadCurve,
    bossLane,
    bossDrift,
    bossBump,
    bossTilt,
    isPaused,
    enableFreeCamera,
    freeCameraPreset,
    cameraResetToken,
    showGuides,
    mode,
    sceneConfig,
    graphicsSettings,
    resultCameraVariant,
    devDraftOverrides,
    selectedObjectKey,
    devInteractionMode,
    devModelTool,
    devBrushRadius,
    devBrushStrength,
    devPaintColor,
    devToolStrengths,
    devConveyorOffset,
    devStageEditMode,
    devMapCursorZ,
    devRoadSculpt,
    devRoadEvents,
    devSelectedRoadEventId,
    devCameraFollowDistance,
    loadoutCameraRig,
    loadoutWardrobe,
    loadoutCharacterVariant,
    loadoutBaseModelUrl,
    loadoutCharacterSwapDirection,
    loadoutCharacterSwapToken,
    loadoutCameraEditMode,
    showElevatedSegmentDevPanel,
    elevatedBridgeDebugTransform: normalizeElevatedBridgeDebugTransform(elevatedBridgeDebugTransform),
    transparentBackground,
    hideEnvironment,
  });
  const onDevObjectPickRef = React.useRef(onDevObjectPick);
  const onDevObjectTransformRef = React.useRef(onDevObjectTransform);
  const onDevProceduralEditRef = React.useRef(onDevProceduralEdit);
  const onDevRoadEventAdjustRef = React.useRef(onDevRoadEventAdjust);
  const onDevCameraInteractRef = React.useRef(onDevCameraInteract);
  const onDevSelectedScreenPositionRef = React.useRef(onDevSelectedScreenPosition);
  const onLoadoutCameraRigChangeRef = React.useRef(onLoadoutCameraRigChange);

  React.useEffect(() => {
    onDevObjectPickRef.current = onDevObjectPick;
  }, [onDevObjectPick]);

  React.useEffect(() => {
    onDevObjectTransformRef.current = onDevObjectTransform;
  }, [onDevObjectTransform]);
  React.useEffect(() => {
    onDevProceduralEditRef.current = onDevProceduralEdit;
  }, [onDevProceduralEdit]);
  React.useEffect(() => {
    onDevRoadEventAdjustRef.current = onDevRoadEventAdjust;
  }, [onDevRoadEventAdjust]);
  React.useEffect(() => {
    onDevCameraInteractRef.current = onDevCameraInteract;
  }, [onDevCameraInteract]);
  React.useEffect(() => {
    onDevSelectedScreenPositionRef.current = onDevSelectedScreenPosition;
  }, [onDevSelectedScreenPosition]);
  React.useEffect(() => {
    onLoadoutCameraRigChangeRef.current = onLoadoutCameraRigChange;
  }, [onLoadoutCameraRigChange]);

  React.useEffect(() => {
    dataRef.current = {
      runnerState,
      runnerStateRef,
      islandTheme,
      roadCurve,
      bossLane,
      bossDrift,
      bossBump,
      bossTilt,
      isPaused,
      enableFreeCamera,
      freeCameraPreset,
      cameraResetToken,
      showGuides,
      mode,
      sceneConfig,
      sceneRenderDraft,
      graphicsSettings,
      resultCameraVariant,
      devDraftOverrides,
      devInteractionMode,
      devModelTool,
      devBrushRadius,
      devBrushStrength,
      devPaintColor,
      devToolStrengths,
      selectedObjectKey,
      devConveyorOffset,
      devStageEditMode,
      devMapCursorZ,
      devRoadSculpt,
      devRoadEvents,
      devSelectedRoadEventId,
      devCameraFollowDistance,
      loadoutCameraRig,
      loadoutWardrobe,
      loadoutCharacterVariant,
      loadoutBaseModelUrl,
      loadoutCharacterSwapDirection,
      loadoutCharacterSwapToken,
      loadoutCameraEditMode,
      showElevatedSegmentDevPanel,
      elevatedBridgeDebugTransform: normalizeElevatedBridgeDebugTransform(elevatedBridgeDebugTransform),
      transparentBackground,
      hideEnvironment,
    };
  }, [
    runnerState,
    runnerStateRef,
    islandTheme,
    roadCurve,
    bossLane,
    bossDrift,
    bossBump,
    bossTilt,
    isPaused,
    enableFreeCamera,
    freeCameraPreset,
    cameraResetToken,
    showGuides,
    mode,
    sceneConfig,
    sceneRenderDraft,
    graphicsSettings,
    resultCameraVariant,
    devDraftOverrides,
    devInteractionMode,
    devModelTool,
    devBrushRadius,
    devBrushStrength,
    devPaintColor,
    devToolStrengths,
    selectedObjectKey,
    devConveyorOffset,
    devStageEditMode,
    devMapCursorZ,
    devRoadSculpt,
    devRoadEvents,
    devSelectedRoadEventId,
    devCameraFollowDistance,
    loadoutCameraRig,
    loadoutWardrobe,
    loadoutCharacterVariant,
    loadoutBaseModelUrl,
    loadoutCharacterSwapDirection,
    loadoutCharacterSwapToken,
    loadoutCameraEditMode,
    showElevatedSegmentDevPanel,
    elevatedBridgeDebugTransform,
    transparentBackground,
    hideEnvironment,
  ]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = null;
    const isSmallViewport = window.innerWidth <= 900;
    const hwThreads = Number(window.navigator?.hardwareConcurrency || 0);
    const deviceMemory = Number(window.navigator?.deviceMemory || 0);
    const hardwareVeryLowPerf =
      isSmallViewport && ((hwThreads > 0 && hwThreads <= 4) || (deviceMemory > 0 && deviceMemory <= 3));
    const hardwareLowPerf =
      isSmallViewport && ((hwThreads > 0 && hwThreads <= 6) || (deviceMemory > 0 && deviceMemory <= 4));
    const initialGraphicsSettings = readGraphicsSettings(dataRef.current.graphicsSettings);
    const forceHighDetail =
      initialGraphicsSettings.detailLevel === "high" || initialGraphicsSettings.detailLevel === "maximum";
    const isVeryLowPerfDevice = forceHighDetail ? false : hardwareVeryLowPerf;
    const isLowPerfDevice = forceHighDetail ? false : hardwareLowPerf;
    const resolvePixelRatioCap = (settings) => {
      const detailSettings = readGraphicsSettings(settings);
      const qualityMultiplier = detailSettings.imageQuality;
      const baseCap = isVeryLowPerfDevice ? 0.85 : isLowPerfDevice ? 1.0 : isSmallViewport ? 1.1 : 1.2;
      return Math.max(0.7, Math.min(1.6, baseCap * qualityMultiplier));
    };
    const resolveAntialias = (settings) => {
      const detailSettings = readGraphicsSettings(settings);
      if (detailSettings.antiAlias === "on") return true;
      if (detailSettings.antiAlias === "off") return false;
      return !isVeryLowPerfDevice;
    };
    const renderer = new THREE.WebGLRenderer({
      antialias: resolveAntialias(initialGraphicsSettings),
      alpha: !!dataRef.current.transparentBackground,
      powerPreference: "high-performance",
    });
    renderer.localClippingEnabled = true;
    const applyRendererPixelRatio = (settings) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, resolvePixelRatioCap(settings)));
    };
    applyRendererPixelRatio(initialGraphicsSettings);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearAlpha(dataRef.current.transparentBackground ? 0 : 1);
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1400);
    camera.position.set(0, 4.7, 9.4);
    camera.lookAt(0, 1.2, -20);
    let orbitControls = createFallbackOrbitControls(camera);
    let orbitControlsActiveInstance = null;
    orbitControls.enabled = false;
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.enablePan = true;
    orbitControls.screenSpacePanning = false;
    orbitControls.panSpeed = 1.35;
    orbitControls.rotateSpeed = 0.85;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.minDistance = 2.5;
    orbitControls.maxDistance = 320;
    orbitControls.maxPolarAngle = Math.PI - 0.04;
    orbitControls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    orbitControls.target.set(0, 1.2, -20);
    let orbitControlsDisposed = false;

    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambient);
    const hemisphere = new THREE.HemisphereLight(0xf4fbff, 0x24435b, 0.68);
    scene.add(hemisphere);
    const directional = new THREE.DirectionalLight(0xffffff, 0.95);
    directional.position.set(2, 8, 6);
    scene.add(directional);
    const fillDirectional = new THREE.DirectionalLight(0xfff1cf, 0.52);
    fillDirectional.position.set(-3.8, 5.8, 4.2);
    scene.add(fillDirectional);
    const rimDirectional = new THREE.DirectionalLight(0x9bdcff, 0.42);
    rimDirectional.position.set(0.8, 4.5, -6.8);
    scene.add(rimDirectional);

    let readyNotified = false;
    let introStarted = false;
    let introCompleted = false;
    let optionalSceneUpgradeScheduled = false;
    let optionalSceneUpgradeCancelled = false;
    const optionalSceneUpgradeTasks = [];
    const flushOptionalSceneUpgrades = () => {
      if (optionalSceneUpgradeCancelled) return;
      const tasks = optionalSceneUpgradeTasks.splice(0);
      tasks.forEach((task) => {
        try {
          task();
        } catch {
          // Optional visual upgrades must never block the scene.
        }
      });
    };
    const queueOptionalSceneUpgrade = (task) => {
      if (typeof task !== "function") return;
      optionalSceneUpgradeTasks.push(task);
      if (optionalSceneUpgradeScheduled) return;
      optionalSceneUpgradeScheduled = true;
      const schedule =
        typeof window.requestIdleCallback === "function"
          ? (cb) => window.requestIdleCallback(cb, { timeout: 1200 })
          : (cb) => window.setTimeout(cb, 140);
      schedule(() => {
        optionalSceneUpgradeScheduled = false;
        flushOptionalSceneUpgrades();
      });
    };
    const notifyReady = () => {
      if (readyNotified) return;
      readyNotified = true;
      renderer.domElement.style.opacity = "1";
      flushOptionalSceneUpgrades();
      if (typeof onSceneReady === "function") onSceneReady();
    };
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 220ms ease";
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = notifyReady;
    loadingManager.onError = () => {
      // Keep gameplay resilient even if one optional asset fails.
      window.setTimeout(notifyReady, 120);
    };
    const readyFallbackTimer = window.setTimeout(notifyReady, 2600);
    const textureLoader = new THREE.TextureLoader(loadingManager);
    const optionalTextureLoader = new THREE.TextureLoader();
    const maxAnisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1));
    const textureBudgetProfile = readTextureBudgetProfile(
      dataRef.current.graphicsSettings,
      isLowPerfDevice,
      isVeryLowPerfDevice
    );
    const cappedAnisotropy = Math.max(
      1,
      Math.min(
        maxAnisotropy,
        Number(textureBudgetProfile.anisotropy) || maxAnisotropy
      )
    );
    const applyTextureBudget = (texture, { maxTextureSize = textureBudgetProfile.maxTextureSize } = {}) => {
      if (!texture) return texture;
      const applyNow = () => {
        texture.anisotropy = cappedAnisotropy;
        downscaleTextureImageIfNeeded(texture, maxTextureSize);
      };
      applyNow();
      const previousOnUpdate = texture.onUpdate;
      texture.onUpdate = (...args) => {
        applyNow();
        if (typeof previousOnUpdate === "function") previousOnUpdate(...args);
      };
      return texture;
    };
    const loadOptionalTexture = (rawUrl, configure, onLoad, budgetOptions) => {
      const resolvedUrl = rawUrl ? resolveSceneUploadUrl(rawUrl) : "";
      if (!resolvedUrl) return null;
      let texture = null;
      let disposed = false;
      queueOptionalSceneUpgrade(() => {
        if (disposed || optionalSceneUpgradeCancelled) return;
        optionalTextureLoader.load(
          resolvedUrl,
          (loadedTexture) => {
            if (disposed || optionalSceneUpgradeCancelled) {
              loadedTexture.dispose();
              return;
            }
            texture = loadedTexture;
            try {
              applyTextureBudget(loadedTexture, budgetOptions);
              configure?.(loadedTexture);
              onLoad?.(loadedTexture);
            } catch {
              // Ignore optional upgrade failures.
            }
          },
          undefined,
          () => {}
        );
      });
      return {
        dispose() {
          disposed = true;
          if (texture) {
            texture.dispose();
            texture = null;
          }
        },
      };
    };
    const readSceneLook = (state) => {
      const configRaw =
        state?.sceneConfig?.scene_lighting && typeof state.sceneConfig.scene_lighting === "object"
          ? state.sceneConfig.scene_lighting
          : {};
      const draftRaw =
        state?.devDraftOverrides?.scene_lighting && typeof state.devDraftOverrides.scene_lighting === "object"
          ? state.devDraftOverrides.scene_lighting
          : {};
      const raw = { ...configRaw, ...draftRaw };
      const toNum = (value, fallback, min, max) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.max(min, Math.min(max, num));
      };
      const toOffsets = (value) => (value && typeof value === "object" ? normalizeProceduralOffsets(value) : {});
      return {
        exposure: toNum(raw.exposure, 1.08, 0.4, 2.2),
        ambientIntensity: toNum(raw.ambientIntensity, 0.72, 0, 3),
        hemisphereIntensity: toNum(raw.hemisphereIntensity, 0.68, 0, 3),
        keyIntensity: toNum(raw.keyIntensity, 0.95, 0, 3),
        fillIntensity: toNum(raw.fillIntensity, 0.52, 0, 3),
        rimIntensity: toNum(raw.rimIntensity, 0.42, 0, 3),
        saturation: toNum(raw.saturation, 1.08, 0.2, 2.2),
        contrast: toNum(raw.contrast, 1.02, 0.4, 2),
        brightness: toNum(raw.brightness, 1, 0.4, 1.8),
      };
    };
    const ROAD_WIDTH = 8.2;
    const ROAD_LENGTH = 112;
    const GRASS_WIDTH = 6.8;
    const GRASS_CENTER_OFFSET = 7.35;
    const SIDE_FILL_WIDTH = 24;
    const SIDE_FILL_CENTER_OFFSET = 22.6;
    const readRoadVisualConfig = (state) => {
      const persisted =
        state?.sceneConfig?.object_overrides?.road_base && typeof state.sceneConfig.object_overrides.road_base === "object"
          ? state.sceneConfig.object_overrides.road_base
          : {};
      const draft =
        state?.devDraftOverrides?.road_base && typeof state.devDraftOverrides.road_base === "object"
          ? state.devDraftOverrides.road_base
          : {};
      const raw = { ...persisted, ...draft };
      const toNum = (value, fallback, min, max) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.max(min, Math.min(max, num));
      };
      const toOffsets = (value) => {
        const source = value && typeof value === "object" ? value : {};
        const out = {};
        Object.entries(source).forEach(([k, v]) => {
          const idx = Math.floor(Number(k));
          const val = Number(v);
          if (!Number.isFinite(idx) || idx < 0) return;
          if (!Number.isFinite(val)) return;
          if (Math.abs(val) < 0.00001) return;
          out[String(idx)] = Math.max(-40, Math.min(40, val));
        });
        return out;
      };
      return {
        roadSurfaceY: toNum(raw.roadSurfaceY ?? raw.road_surface_y, 0, -20, 20),
        roadModelUrl: normalizeDefaultRoadChunkUrl((raw.modelUrl ?? raw.model_url) || DEFAULT_ROAD_CHUNK_MODEL_URL),
        roadModelX: toNum(raw.roadModelX ?? raw.road_model_x, 0, -40, 40),
        roadModelY: toNum(raw.roadModelY ?? raw.road_model_y, 0, -20, 20),
        roadModelZ: toNum(raw.roadModelZ ?? raw.road_model_z, 0, -40, 40),
        roadModelRotX: toNum(raw.roadModelRotX ?? raw.road_model_rot_x, 0, -180, 180),
        roadModelRotY: toNum(raw.roadModelRotY ?? raw.road_model_rot_y, 0, -180, 180),
        roadModelRotZ: toNum(raw.roadModelRotZ ?? raw.road_model_rot_z, 0, -180, 180),
        roadModelScale: toNum(raw.roadModelScale ?? raw.road_model_scale, 1, 0.1, 12),
        roadModelScaleX: toNum(raw.roadModelScaleX ?? raw.road_model_scale_x, 1, 0.1, 12),
        roadModelScaleY: toNum(raw.roadModelScaleY ?? raw.road_model_scale_y, 1, 0.1, 12),
        roadModelScaleZ: toNum(raw.roadModelScaleZ ?? raw.road_model_scale_z, 1, 0.1, 12),
        roadChunkLength: toNum(raw.roadChunkLength ?? raw.road_chunk_length, 0, 0, 240),
        roadRepeatEnabled:
          getCanonicalSceneAssetName(raw.modelUrl ?? raw.model_url).toLowerCase() === "chunk_road_01.glb"
            ? true
            : (raw.roadRepeatEnabled ?? raw.road_repeat_enabled) !== false,
        outerGrassY: toNum(raw.outerGrassY ?? raw.outer_grass_y, 0, -20, 20),
        outerGrassWidth: toNum(raw.outerGrassWidth ?? raw.outer_grass_width, SIDE_FILL_WIDTH, 2, 80),
        outerGrassOffset: toNum(raw.outerGrassOffset ?? raw.outer_grass_offset, SIDE_FILL_CENTER_OFFSET, 6, 90),
        proceduralEdgeEnabled: (raw.proceduralEdgeEnabled ?? raw.procedural_edge_enabled) === true,
        proceduralGrassLift: toNum(raw.proceduralGrassLift ?? raw.procedural_grass_lift, 0.9, 0, 8),
        proceduralGrassWidth: toNum(raw.proceduralGrassWidth ?? raw.procedural_grass_width, 5.4, 0.5, 30),
        proceduralGrassOffset: toNum(raw.proceduralGrassOffset ?? raw.procedural_grass_offset, 8.3, 4.5, 40),
        proceduralGrassY: toNum(raw.proceduralGrassY ?? raw.procedural_grass_y, 0, -8, 8),
        proceduralGrassTextureUrl: String((raw.proceduralGrassTextureUrl ?? raw.procedural_grass_texture_url) || "").trim(),
        proceduralGrassVertexOffsetsLeft: toOffsets(
          raw.proceduralGrassVertexOffsetsLeft ?? raw.procedural_grass_vertex_offsets_left
        ),
        proceduralGrassVertexOffsetsRight: toOffsets(
          raw.proceduralGrassVertexOffsetsRight ?? raw.procedural_grass_vertex_offsets_right
        ),
      };
    };
    const getRoadSurfaceYOffset = (state) => {
      const draft =
        state?.devDraftOverrides?.road_base && typeof state.devDraftOverrides.road_base === "object"
          ? state.devDraftOverrides.road_base
          : null;
      const persisted =
        state?.sceneConfig?.object_overrides?.road_base && typeof state.sceneConfig.object_overrides.road_base === "object"
          ? state.sceneConfig.object_overrides.road_base
          : null;
      const draftValue = Number(draft?.road_surface_y);
      if (Number.isFinite(draftValue)) return Math.max(-20, Math.min(20, draftValue));
      const persistedValue = Number(persisted?.road_surface_y);
      if (Number.isFinite(persistedValue)) return Math.max(-20, Math.min(20, persistedValue));
      return 0;
    };
    const RUNNER_WORLD_Z_SCALE = 17;
    const ROAD_EVENT_START_Z_MIN = -5000;
    const ROAD_EVENT_START_Z_MAX = 200;
    const sandTexture = textureLoader.load(resolveSceneUploadUrl(sandTextureUrl), () => {
      ensureRoadTextureRepeatable();
      applyRoadBaseRepeatFromTexture();
    });
    applyTextureBudget(sandTexture);
    sandTexture.wrapS = THREE.ClampToEdgeWrapping;
    sandTexture.wrapT = THREE.ClampToEdgeWrapping;
    sandTexture.repeat.set(1, 1);
    sandTexture.colorSpace = THREE.SRGBColorSpace;
    let roadMat = null;
    let shoulderMaterial = null;
    let roadBaseNormal = null;
    let roadBaseRoughness = null;
    let roadBaseAo = null;
    const roadBaseNormalHandle = loadOptionalTexture(
      roadBaseNormalUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.copy(sandTexture.repeat);
      },
      (texture) => {
        roadBaseNormal = texture;
        if (roadMat) {
          roadMat.normalMap = texture;
          roadMat.needsUpdate = true;
        }
      }
    );
    const roadBaseRoughnessHandle = loadOptionalTexture(
      roadBaseRoughnessUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.copy(sandTexture.repeat);
        texture.colorSpace = THREE.NoColorSpace;
      },
      (texture) => {
        roadBaseRoughness = texture;
        if (roadMat) {
          roadMat.roughnessMap = texture;
          roadMat.roughness = 1;
          roadMat.needsUpdate = true;
        }
      }
    );
    const roadBaseAoHandle = loadOptionalTexture(
      roadBaseAoUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.copy(sandTexture.repeat);
        texture.colorSpace = THREE.NoColorSpace;
      },
      (texture) => {
        roadBaseAo = texture;
        if (roadMat) {
          roadMat.aoMap = texture;
          roadMat.aoMapIntensity = 0.35;
          roadMat.needsUpdate = true;
        }
      }
    );
    function applyRoadBaseRepeatFromTexture() {
      const w = sandTexture?.image?.width;
      const h = sandTexture?.image?.height;
      if (!w || !h) return;
      sandTexture.wrapS = THREE.RepeatWrapping;
      sandTexture.wrapT = THREE.RepeatWrapping;
      const texAspect = w / h;
      const repeatX = 1;
      const repeatY = Math.max(1, (ROAD_LENGTH / ROAD_WIDTH) * texAspect * repeatX);
      sandTexture.repeat.set(repeatX, repeatY);
      sandTexture.needsUpdate = true;
      if (roadBaseNormal) roadBaseNormal.repeat.copy(sandTexture.repeat);
      if (roadBaseRoughness) roadBaseRoughness.repeat.copy(sandTexture.repeat);
      if (roadBaseAo) roadBaseAo.repeat.copy(sandTexture.repeat);
    }

    function ensureRoadTextureRepeatable() {
      const image = sandTexture?.image;
      const w = image?.width;
      const h = image?.height;
      if (!w || !h) return;
      if (isPowerOfTwoSize(w) && isPowerOfTwoSize(h)) return;
      try {
        const potW = nextPowerOfTwoSize(w);
        const potH = nextPowerOfTwoSize(h);
        const canvas = document.createElement("canvas");
        canvas.width = potW;
        canvas.height = potH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, potW, potH);
        sandTexture.image = canvas;
        sandTexture.needsUpdate = true;
      } catch {
        // Keep original texture if conversion fails.
      }
    }

    const treeTexture = treeTextureUrl ? textureLoader.load(resolveSceneUploadUrl(treeTextureUrl)) : null;
    if (treeTexture) applyTextureBudget(treeTexture, { maxTextureSize: Math.min(textureBudgetProfile.maxTextureSize, 1024) });
    if (treeTexture) treeTexture.colorSpace = THREE.SRGBColorSpace;
    const obstacleTexture = obstacleTextureUrl ? textureLoader.load(resolveSceneUploadUrl(obstacleTextureUrl)) : null;
    if (obstacleTexture) {
      applyTextureBudget(obstacleTexture, { maxTextureSize: Math.min(textureBudgetProfile.maxTextureSize, 1024) });
    }
    if (obstacleTexture) obstacleTexture.colorSpace = THREE.SRGBColorSpace;
    const roadShoulderTexture = roadShoulderTextureUrl ? textureLoader.load(resolveSceneUploadUrl(roadShoulderTextureUrl)) : null;
    if (roadShoulderTexture) {
      applyTextureBudget(roadShoulderTexture);
      roadShoulderTexture.wrapS = THREE.RepeatWrapping;
      roadShoulderTexture.wrapT = THREE.RepeatWrapping;
      roadShoulderTexture.repeat.set(1.8, 52);
      roadShoulderTexture.colorSpace = THREE.SRGBColorSpace;
    }
    let roadShoulderNormal = null;
    let roadShoulderRoughness = null;
    let roadShoulderAo = null;
    const roadShoulderNormalHandle = textureBudgetProfile.loadRoadShoulderSecondaryMaps ? loadOptionalTexture(
      roadShoulderNormalUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.8, 52);
      },
      (texture) => {
        roadShoulderNormal = texture;
        if (shoulderMaterial) {
          shoulderMaterial.normalMap = texture;
          shoulderMaterial.needsUpdate = true;
        }
      }
    ) : null;
    const roadShoulderRoughnessHandle = textureBudgetProfile.loadRoadShoulderSecondaryMaps ? loadOptionalTexture(
      roadShoulderRoughnessUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.8, 52);
        texture.colorSpace = THREE.NoColorSpace;
      },
      (texture) => {
        roadShoulderRoughness = texture;
        if (shoulderMaterial) {
          shoulderMaterial.roughnessMap = texture;
          shoulderMaterial.roughness = 1;
          shoulderMaterial.needsUpdate = true;
        }
      }
    ) : null;
    const roadShoulderAoHandle = textureBudgetProfile.loadRoadShoulderSecondaryMaps ? loadOptionalTexture(
      roadShoulderAoUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.8, 52);
        texture.colorSpace = THREE.NoColorSpace;
      },
      (texture) => {
        roadShoulderAo = texture;
        if (shoulderMaterial) {
          shoulderMaterial.aoMap = texture;
          shoulderMaterial.aoMapIntensity = 1;
          shoulderMaterial.needsUpdate = true;
        }
      }
    ) : null;
    const roadSlopeTexture = roadSlopeTextureUrl ? textureLoader.load(resolveSceneUploadUrl(roadSlopeTextureUrl)) : null;
    if (roadSlopeTexture) {
      applyTextureBudget(roadSlopeTexture);
      roadSlopeTexture.wrapS = THREE.RepeatWrapping;
      roadSlopeTexture.wrapT = THREE.RepeatWrapping;
      roadSlopeTexture.repeat.set(1.4, 52);
      roadSlopeTexture.colorSpace = THREE.SRGBColorSpace;
    }
    const grassTopTexture = grassTopTextureUrl ? textureLoader.load(resolveSceneUploadUrl(grassTopTextureUrl)) : null;
    function applyGrassTopRepeatFromTexture() {
      const w = grassTopTexture?.image?.width;
      const h = grassTopTexture?.image?.height;
      if (!w || !h) return;
      const texAspect = w / h;
      const GRASS_LENGTH = 112;
      const repeatX = 1;
      const repeatY = Math.max(1, (GRASS_LENGTH / GRASS_WIDTH) * texAspect * repeatX);
      grassTopTexture.repeat.set(repeatX, repeatY);
    }
    if (grassTopTexture) {
      applyTextureBudget(grassTopTexture);
      grassTopTexture.wrapS = THREE.RepeatWrapping;
      grassTopTexture.wrapT = THREE.RepeatWrapping;
      grassTopTexture.colorSpace = THREE.SRGBColorSpace;
      applyGrassTopRepeatFromTexture();
      if (!grassTopTexture.image) {
        const previousOnUpdate = grassTopTexture.onUpdate;
        grassTopTexture.onUpdate = (...args) => {
          applyGrassTopRepeatFromTexture();
          if (typeof previousOnUpdate === "function") previousOnUpdate(...args);
        };
      }
    }
    const horizonTexture = horizonTextureUrl ? textureLoader.load(resolveSceneUploadUrl(horizonTextureUrl)) : null;
    if (horizonTexture) {
      applyTextureBudget(horizonTexture, { maxTextureSize: Math.min(textureBudgetProfile.maxTextureSize, 1024) });
      horizonTexture.colorSpace = THREE.SRGBColorSpace;
    }
    const shadowOverlayTexture = textureBudgetProfile.loadShadowOverlay && shadowOverlayTextureUrl
      ? textureLoader.load(resolveSceneUploadUrl(shadowOverlayTextureUrl))
      : null;
    if (shadowOverlayTexture) {
      applyTextureBudget(shadowOverlayTexture, { maxTextureSize: Math.min(textureBudgetProfile.maxTextureSize, 1024) });
      shadowOverlayTexture.wrapS = THREE.RepeatWrapping;
      shadowOverlayTexture.wrapT = THREE.RepeatWrapping;
      shadowOverlayTexture.repeat.set(1, 1);
      shadowOverlayTexture.colorSpace = THREE.SRGBColorSpace;
    }

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);
    const selectedMarkerGroup = new THREE.Group();
    selectedMarkerGroup.visible = false;
    worldGroup.add(selectedMarkerGroup);
    const selectedMarkerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.48, 36),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    selectedMarkerRing.rotation.x = -Math.PI / 2;
    selectedMarkerGroup.add(selectedMarkerRing);
    const selectedMarkerHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.66, 36),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    selectedMarkerHalo.rotation.x = -Math.PI / 2;
    selectedMarkerGroup.add(selectedMarkerHalo);
    const selectedMarkerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.9, 10),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
    );
    selectedMarkerBeam.position.set(0, 0.46, 0);
    selectedMarkerGroup.add(selectedMarkerBeam);
    const selectedMarkerTick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 0.34),
      new THREE.MeshBasicMaterial({
        color: 0xecfeff,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    selectedMarkerTick.position.set(0, 1.0, 0);
    selectedMarkerGroup.add(selectedMarkerTick);
    const loadoutCameraMarker = new THREE.Group();
    loadoutCameraMarker.visible = false;
    loadoutCameraMarker.userData.devPick = { type: "loadout_camera", key: "loadout_camera" };
    worldGroup.add(loadoutCameraMarker);
    const loadoutCameraMarkerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.22, 18),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    loadoutCameraMarkerBase.position.y = 0.11;
    loadoutCameraMarker.add(loadoutCameraMarkerBase);
    const loadoutCameraMarkerHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.46, 28),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    loadoutCameraMarkerHalo.rotation.x = -Math.PI / 2;
    loadoutCameraMarkerHalo.position.y = 0.02;
    loadoutCameraMarker.add(loadoutCameraMarkerHalo);
    const loadoutCameraMarkerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.05, 10),
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    loadoutCameraMarkerBeam.position.y = 0.64;
    loadoutCameraMarker.add(loadoutCameraMarkerBeam);
    const loadoutLookMarker = new THREE.Group();
    loadoutLookMarker.visible = false;
    loadoutLookMarker.userData.devPick = { type: "loadout_look", key: "loadout_look" };
    worldGroup.add(loadoutLookMarker);
    const loadoutLookMarkerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 0.18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    loadoutLookMarkerBase.position.y = 0.09;
    loadoutLookMarker.add(loadoutLookMarkerBase);
    const loadoutLookMarkerHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.38, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfcd34d,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    loadoutLookMarkerHalo.rotation.x = -Math.PI / 2;
    loadoutLookMarkerHalo.position.y = 0.02;
    loadoutLookMarker.add(loadoutLookMarkerHalo);
    const loadoutLookMarkerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.82, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    loadoutLookMarkerBeam.position.y = 0.48;
    loadoutLookMarker.add(loadoutLookMarkerBeam);
    const devGrid = new THREE.GridHelper(128, 128, 0x2dd4bf, 0x134e4a);
    devGrid.position.set(0, 0.02, -42);
    devGrid.material.transparent = true;
    devGrid.material.opacity = 0.16;
    worldGroup.add(devGrid);
    const devBlockGuides = new THREE.Group();
    for (let z = -118; z <= 14; z += 8) {
      const blockLine = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 0.07),
        new THREE.MeshBasicMaterial({
          color: z % 16 === 0 ? 0x22d3ee : 0x0ea5e9,
          transparent: true,
          opacity: z % 16 === 0 ? 0.42 : 0.26,
          depthWrite: false,
        })
      );
      blockLine.rotation.x = -Math.PI / 2;
      blockLine.position.set(0, 0.055, z);
      devBlockGuides.add(blockLine);
    }
    worldGroup.add(devBlockGuides);
    const makeSceneCutLabelSprite = (text, color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 72;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(5.6, 1.6, 1);
      sprite.userData.drawLabel = (nextText) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        ctx.fillStyle = color;
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nextText, canvas.width / 2, canvas.height / 2);
        texture.needsUpdate = true;
      };
      sprite.userData.drawLabel(text);
      return sprite;
    };
    const sceneCutoffGuideGroup = new THREE.Group();
    const createSceneCutoffGuide = (colorHex, label) => {
      const group = new THREE.Group();
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 1.3, 1, 1),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.06;
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 7.5, 1, 1),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      wall.position.y = 3.7;
      const labelSprite = makeSceneCutLabelSprite(label, `#${colorHex.toString(16).padStart(6, "0")}`);
      labelSprite.position.set(0, 6.7, 0);
      group.add(floor);
      group.add(wall);
      group.add(labelSprite);
      group.userData.floor = floor;
      group.userData.wall = wall;
      group.userData.labelSprite = labelSprite;
      group.userData.lastLabel = "";
      return group;
    };
    const sceneCutoffGuides = {
      vegetation: createSceneCutoffGuide(0x22c55e, "VEGETACAO"),
      road: createSceneCutoffGuide(0xf59e0b, "ESTRADA"),
      object: createSceneCutoffGuide(0x38bdf8, "OBJETOS"),
    };
    sceneCutoffGuideGroup.add(sceneCutoffGuides.vegetation);
    sceneCutoffGuideGroup.add(sceneCutoffGuides.road);
    sceneCutoffGuideGroup.add(sceneCutoffGuides.object);
    worldGroup.add(sceneCutoffGuideGroup);
    const roadEventHandleGroup = new THREE.Group();
    worldGroup.add(roadEventHandleGroup);
    const roadEventHandleGeometry = new THREE.PlaneGeometry(ROAD_WIDTH * 0.88, 1, 1, 1);
    roadEventHandleGeometry.rotateX(-Math.PI / 2);
    const roadEventHandleTipGeometry = new THREE.ConeGeometry(0.2, 0.38, 8);
    const roadEventHandleMeshes = new Map();

    const HORIZON_WIDTH = 236;
    const HORIZON_HEIGHT = 96;
    const HORIZON_BASE_POS = { x: 0, y: 18.5, z: -102 };
    const horizonGeometry = new THREE.PlaneGeometry(HORIZON_WIDTH, HORIZON_HEIGHT, isLowPerfDevice ? 20 : 40, isLowPerfDevice ? 8 : 12);
    const horizonMaterial = new THREE.MeshBasicMaterial({
      map: horizonTexture || null,
      transparent: true,
      alphaTest: 0.02,
      color: 0xffffff,
      opacity: 1,
      depthWrite: false,
    });
    const horizonCurveUniforms = {
      curveSide: { value: 12 },
      curveDown: { value: 3.2 },
      grade: { value: 0 },
      halfWidth: { value: HORIZON_WIDTH * 0.5 },
    };
    applyCurvedHorizonShader(horizonMaterial, horizonCurveUniforms);
    const horizonMesh = new THREE.Mesh(
      horizonGeometry,
      horizonMaterial
    );
    horizonMesh.position.set(HORIZON_BASE_POS.x, HORIZON_BASE_POS.y, HORIZON_BASE_POS.z);
    assignDevPick(horizonMesh, { key: "horizon", type: "horizon", label: "Horizonte" });
    worldGroup.add(horizonMesh);
    const hazeNearRoadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 12, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xe8edf1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    hazeNearRoadMesh.position.set(0, 1.6, -74);
    worldGroup.add(hazeNearRoadMesh);
    const hazeMidRoadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(210, 14, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xe1e8ee,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    hazeMidRoadMesh.position.set(0, 4.1, -88);
    worldGroup.add(hazeMidRoadMesh);
    const roadCutoffClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 9999);
    const roadRearClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 9999);
    const vegetationCutoffClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 9999);
    const vegetationRearClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 9999);
    const objectCutoffClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 9999);
    const objectRearClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 9999);

    const roadDeformSegmentsZ = isLowPerfDevice ? 72 : 144;
    const shoulderDeformSegmentsZ = isLowPerfDevice ? 72 : 144;
    const laneDeformSegmentsZ = isLowPerfDevice ? 72 : 132;
    const roadGeo = new THREE.PlaneGeometry(8.2, 112, 24, roadDeformSegmentsZ);
    roadGeo.rotateX(-Math.PI / 2);
    roadGeo.translate(0, 0, -50);
    roadGeo.setAttribute("uv2", new THREE.BufferAttribute(roadGeo.attributes.uv.array, 2));
    const roadBase = new Float32Array(roadGeo.attributes.position.array);
    roadMat = new THREE.MeshStandardMaterial({
      map: sandTexture,
      normalMap: roadBaseNormal,
      roughnessMap: roadBaseRoughness,
      aoMap: roadBaseAo,
      aoMapIntensity: roadBaseAo ? 0.35 : 0,
      roughness: roadBaseRoughness ? 1 : 0.78,
      metalness: 0.02,
      color: 0xffffff,
      clippingPlanes: [roadCutoffClipPlane, roadRearClipPlane],
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    assignDevPick(roadMesh, { key: "road_base", type: "road", label: "Piso central" });
    worldGroup.add(roadMesh);

    shoulderMaterial = new THREE.MeshStandardMaterial({
      map: roadShoulderTexture || sandTexture,
      normalMap: roadShoulderNormal,
      roughnessMap: roadShoulderRoughness,
      aoMap: roadShoulderAo,
      aoMapIntensity: roadShoulderAo ? 1 : 0,
      roughness: roadShoulderRoughness ? 1 : 0.82,
      metalness: 0.02,
      color: roadShoulderTexture ? 0xffffff : 0xd4b483,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      clippingPlanes: [roadCutoffClipPlane, roadRearClipPlane],
    });
    const shoulderMeshes = [];
    const shoulderGeometries = [];
    const shoulderBases = [];
    [-1, 1].forEach((side) => {
      const shoulderGeo = new THREE.PlaneGeometry(1.5, 112, 4, shoulderDeformSegmentsZ);
      shoulderGeo.rotateX(-Math.PI / 2);
      shoulderGeo.translate(side * 4.86, 0.05, -50);
      shoulderGeo.setAttribute("uv2", new THREE.BufferAttribute(shoulderGeo.attributes.uv.array, 2));
      shoulderGeometries.push(shoulderGeo);
      shoulderBases.push(new Float32Array(shoulderGeo.attributes.position.array));
      const mesh = new THREE.Mesh(shoulderGeo, shoulderMaterial);
      shoulderMeshes.push(mesh);
      worldGroup.add(mesh);
    });

    const grassMaterial = new THREE.MeshBasicMaterial({
      map: grassTopTexture || null,
      color: grassTopTexture ? 0xffffff : 0x3f8f43,
      transparent: true,
      opacity: 1,
      clippingPlanes: [vegetationCutoffClipPlane, vegetationRearClipPlane],
    });
    const grassMeshes = [];
    const grassGeometries = [];
    const grassBases = [];
    const roadPlaneSegmentsZ = isLowPerfDevice ? 40 : 72;
    const proceduralGrassSegmentsZ = isLowPerfDevice ? 4 : 8;
    [-1, 1].forEach((side) => {
      const grassGeo = new THREE.PlaneGeometry(GRASS_WIDTH, 112, 4, roadPlaneSegmentsZ);
      grassGeo.rotateX(-Math.PI / 2);
      grassGeo.translate(side * GRASS_CENTER_OFFSET, 0.02, -50);
      grassGeometries.push(grassGeo);
      grassBases.push(new Float32Array(grassGeo.attributes.position.array));
      const mesh = new THREE.Mesh(grassGeo, grassMaterial);
      grassMeshes.push(mesh);
      worldGroup.add(mesh);
    });
    const sideFillMeshes = [];
    const sideFillGeometries = [];
    const sideFillBases = [];
    [-1, 1].forEach((side) => {
      const sideGeo = new THREE.PlaneGeometry(SIDE_FILL_WIDTH, 112, 4, roadPlaneSegmentsZ);
      sideGeo.rotateX(-Math.PI / 2);
      sideGeo.translate(side * SIDE_FILL_CENTER_OFFSET, 0.01, -50);
      sideFillGeometries.push(sideGeo);
      sideFillBases.push(new Float32Array(sideGeo.attributes.position.array));
      const mesh = new THREE.Mesh(sideGeo, grassMaterial);
      sideFillMeshes.push(mesh);
      worldGroup.add(mesh);
    });

    const proceduralGrassMaterial = new THREE.MeshStandardMaterial({
      color: 0x5fb85d,
      roughness: 0.86,
      metalness: 0,
      clippingPlanes: [vegetationCutoffClipPlane, vegetationRearClipPlane],
    });
    const proceduralGrassBlockMeshes = [];
    const proceduralGrassBlockGeometries = [];
    const proceduralGrassBlockBases = [];
    [-1, 1].forEach((side) => {
      const grassBlockGeo = new THREE.PlaneGeometry(1, 1, 1, proceduralGrassSegmentsZ);
      grassBlockGeo.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2);
      grassBlockGeo.translate(0, 0.5, -50);
      proceduralGrassBlockGeometries.push(grassBlockGeo);
      proceduralGrassBlockBases.push(new Float32Array(grassBlockGeo.attributes.position.array));
      const grassBlockMesh = new THREE.Mesh(grassBlockGeo, proceduralGrassMaterial);
      grassBlockMesh.frustumCulled = true;
      grassBlockMesh.position.x = side * 8.3;
      grassBlockMesh.userData.roadProceduralOffsetField =
        side < 0 ? "procedural_grass_vertex_offsets_left" : "procedural_grass_vertex_offsets_right";
      grassBlockMesh.userData.isRoadProceduralGrass = true;
      assignDevPick(grassBlockMesh, {
        key: "road_base",
        type: "road",
        label: side < 0 ? "Borda da grama esquerda" : "Borda da grama direita",
      });
      proceduralGrassBlockMeshes.push(grassBlockMesh);
      worldGroup.add(grassBlockMesh);
    });

    const laneMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      clippingPlanes: [roadCutoffClipPlane],
    });
    const laneMeshes = [];
    const laneGeos = [];
    const laneBases = [];
    [-1, 1].forEach((side) => {
      const laneGeo = new THREE.PlaneGeometry(0.09, 112, 1, laneDeformSegmentsZ);
      laneGeo.rotateX(-Math.PI / 2);
      laneGeo.translate(side * 1.37, 0.01, -50);
      laneGeos.push(laneGeo);
      laneBases.push(new Float32Array(laneGeo.attributes.position.array));
      const laneMesh = new THREE.Mesh(laneGeo, laneMat);
      laneMesh.visible = false;
      laneMeshes.push(laneMesh);
      worldGroup.add(laneMesh);
    });
    const proceduralBrushCursor = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff4fd8,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    proceduralBrushCursor.visible = false;
    scene.add(proceduralBrushCursor);
    const roadModelGroup = new THREE.Group();
    worldGroup.add(roadModelGroup);
    const roadModelVisualState = {
      token: "",
      loading: false,
      ready: false,
      template: null,
      anchorStartX: 0,
      anchorStartY: 0,
      anchorStartZ: 0,
      boundsMinY: 0,
      measuredLength: 0,
      repeatSpacing: 0,
      autoScaleFactor: 1,
      localForwardYaw: 0,
      parts: [],
      count: 0,
    };
    const roadModelRootInverse = new THREE.Matrix4();
    const roadModelBaseOffsetMatrix = new THREE.Matrix4();
    const roadModelRootMatrix = new THREE.Matrix4();
    const roadModelPartMatrix = new THREE.Matrix4();
    const roadModelPosition = new THREE.Vector3();
    const roadModelScale = new THREE.Vector3();
    const roadModelQuaternion = new THREE.Quaternion();
    const roadModelEuler = new THREE.Euler();
    const proceduralTextureState = {
      wallUrl: "",
      wallTexture: null,
      grassUrl: "",
      grassTexture: null,
    };

    const makeRoadWearTexture = () => {
      const width = isLowPerfDevice ? 256 : 512;
      const height = isLowPerfDevice ? 1024 : 2048;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.clearRect(0, 0, width, height);

      const drawTrack = (x, alpha) => {
        const grad = ctx.createLinearGradient(x - 28, 0, x + 28, 0);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.5, `rgba(44,34,22,${alpha})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - 42, 0, 84, height);
      };
      drawTrack(width * 0.37, 0.2);
      drawTrack(width * 0.63, 0.2);

      for (let i = 0; i < 180; i += 1) {
        const x = 40 + Math.random() * (width - 80);
        const y = Math.random() * height;
        const r = 18 + Math.random() * 72;
        const alpha = 0.03 + Math.random() * 0.1;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(54,40,26,${alpha})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };
    const roadWearTexture = makeRoadWearTexture();
    const roadWearGeo = new THREE.PlaneGeometry(8.2, 112, 24, roadDeformSegmentsZ);
    roadWearGeo.rotateX(-Math.PI / 2);
    roadWearGeo.translate(0, 0, -50);
    const roadWearBase = new Float32Array(roadWearGeo.attributes.position.array);
    const roadWearMat = new THREE.MeshBasicMaterial({
      map: roadWearTexture || null,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      clippingPlanes: [roadCutoffClipPlane],
    });
    const roadWearMesh = new THREE.Mesh(roadWearGeo, roadWearMat);
    worldGroup.add(roadWearMesh);
    const treeShadowGroup = new THREE.Group();
    worldGroup.add(treeShadowGroup);
    const treeShadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowOverlayTexture || null,
      transparent: true,
      opacity: shadowOverlayTexture ? 0.34 : 0,
      depthWrite: false,
    });
    const treeShadowGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    treeShadowGeometry.rotateX(-Math.PI / 2);

    const playerGroup = new THREE.Group();
    const playerVisualPivot = new THREE.Group();
    playerGroup.add(playerVisualPivot);
    const loadoutWardrobeGroup = new THREE.Group();
    playerVisualPivot.add(loadoutWardrobeGroup);
    const loadoutWardrobeSlotGroups = new Map();
    const loadoutWardrobeSkinnedSlotGroups = new Map();
    Object.entries(LOADOUT_WARDROBE_SLOT_ANCHORS).forEach(([slotKey, anchor]) => {
      const slotGroup = new THREE.Group();
      slotGroup.position.set(anchor.x, anchor.y, anchor.z);
      loadoutWardrobeGroup.add(slotGroup);
      loadoutWardrobeSlotGroups.set(slotKey, slotGroup);
      const skinnedSlotGroup = new THREE.Group();
      loadoutWardrobeGroup.add(skinnedSlotGroup);
      loadoutWardrobeSkinnedSlotGroups.set(slotKey, skinnedSlotGroup);
    });
    const loadoutWardrobeState = {
      token: "",
      revision: 0,
      instances: new Map(),
    };
    const loadoutWardrobeBoneFollowers = new Map();
    const playerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.64, 6, 10),
      new THREE.MeshStandardMaterial({
        color: safeColor(islandTheme.player, "#67e8f9"),
        emissive: safeColor(islandTheme.player, "#67e8f9"),
        emissiveIntensity: 0.34,
        roughness: 0.5,
        metalness: 0.08,
      })
    );
    playerBody.castShadow = false;
    playerVisualPivot.add(playerBody);
    assignDevPick(playerGroup, { key: "player", type: "player", label: "Jogador" });
    worldGroup.add(playerGroup);
    const playerFbxLoader = new FBXLoader(loadingManager);
    const playerAnimationState = {
      root: null,
      mixer: null,
      actions: new Map(),
      clips: new Map(),
      currentKey: "",
      ready: false,
      collectTimer: 0,
      hitTimer: 0,
    };
    const loadoutAltModelState = {
      root: null,
      sourceUrl: "",
      basePosition: new THREE.Vector3(),
      requestId: 0,
      mixer: null,
      idleAction: null,
      readyForSwap: false,
    };
    const loadoutSwapState = {
      token: 0,
      activeVariant: String(dataRef.current.loadoutCharacterVariant || "hero"),
      pendingVariant: String(dataRef.current.loadoutCharacterVariant || "hero"),
      direction: 1,
      phase: "idle",
      sameVariantSwap: false,
      startedAt: 0,
      offsetX: 0,
      outgoingVariant: String(dataRef.current.loadoutCharacterVariant || "hero"),
      incomingVariant: String(dataRef.current.loadoutCharacterVariant || "hero"),
      outgoingOffsetX: 0,
      incomingOffsetX: 0,
    };
    playerBody.visible = !(dataRef.current.mode === "result" && String(dataRef.current.resultCameraVariant || "") === "loadout_hero");
    const playerAnimBox = new THREE.Box3();
    const playerAnimSize = new THREE.Vector3();
    const playerAnimCenter = new THREE.Vector3();
    const playerAnimBasePos = new THREE.Vector3();
    const playerRuntimeBox = new THREE.Box3();
    const playerRuntimeCenter = new THREE.Vector3();
    const playerRuntimeCenterLocal = new THREE.Vector3();
    const playerRuntimePivotWorld = new THREE.Vector3();
    const playerAnimBaseQuat = new THREE.Quaternion();
    const playerAnimTmpQuat = new THREE.Quaternion();
    const playerAnimEuler = new THREE.Euler(0, 0, 0, "XYZ");
    const loadoutAltSyncPosition = new THREE.Vector3();
    const loadoutAltSyncScale = new THREE.Vector3();
    const loadoutAltSyncQuaternion = new THREE.Quaternion();
    const wardrobeFollowWorldPosition = new THREE.Vector3();
    const wardrobeFollowLocalPosition = new THREE.Vector3();
    const wardrobeFollowOffset = new THREE.Vector3();
    const wardrobeFollowWorldQuaternion = new THREE.Quaternion();
    const wardrobeFollowLocalQuaternion = new THREE.Quaternion();
    const wardrobePivotWorldQuaternion = new THREE.Quaternion();
    const wardrobePivotWorldQuaternionInverse = new THREE.Quaternion();
    const wardrobeSamplerWorldPos = new THREE.Vector3();
    const wardrobeSamplerLocalPos = new THREE.Vector3();
    const wardrobeProbeWorldPos = new THREE.Vector3();
    const wardrobeProbeLocalPos = new THREE.Vector3();
    const wardrobeInversePivotMatrix = new THREE.Matrix4();
    const normalizePlayerMaterial = (material) => {
      if (!material) return material;
      const nextMat = material?.clone ? material.clone() : material;
      if (nextMat.map) {
        nextMat.map.colorSpace = THREE.SRGBColorSpace;
        nextMat.map.anisotropy = maxAnisotropy;
        nextMat.map.needsUpdate = true;
      }
      if (nextMat.emissiveMap) {
        nextMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        nextMat.emissiveMap.anisotropy = maxAnisotropy;
        nextMat.emissiveMap.needsUpdate = true;
      }
      if (nextMat.normalMap) nextMat.normalMap.colorSpace = THREE.NoColorSpace;
      if (nextMat.roughnessMap) nextMat.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (nextMat.metalnessMap) nextMat.metalnessMap.colorSpace = THREE.NoColorSpace;
      if (nextMat.aoMap) nextMat.aoMap.colorSpace = THREE.NoColorSpace;
      if ("vertexColors" in nextMat) nextMat.vertexColors = false;
      if ("metalness" in nextMat) nextMat.metalness = 0.02;
      if ("roughness" in nextMat) nextMat.roughness = nextMat.map ? 0.72 : 0.58;
      if (nextMat.color?.setRGB) nextMat.color.setRGB(1.08, 1.08, 1.08);
      if (nextMat.emissive?.setRGB) nextMat.emissive.setRGB(0.12, 0.12, 0.12);
      if ("emissiveIntensity" in nextMat) nextMat.emissiveIntensity = nextMat.map ? 0.3 : 0.22;
      nextMat.needsUpdate = true;
      return nextMat;
    };
const normalizeImportedSceneMaterial = (material) => {
  if (!material) return material;
  const nextMat = material?.clone ? material.clone() : material;
  if (nextMat.map) {
    nextMat.map.colorSpace = THREE.SRGBColorSpace;
        nextMat.map.anisotropy = maxAnisotropy;
        nextMat.map.needsUpdate = true;
      }
      if (nextMat.emissiveMap) {
        nextMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        nextMat.emissiveMap.anisotropy = maxAnisotropy;
        nextMat.emissiveMap.needsUpdate = true;
      }
      if (nextMat.normalMap) {
        nextMat.normalMap.colorSpace = THREE.NoColorSpace;
        nextMat.normalMap.needsUpdate = true;
      }
      if (nextMat.roughnessMap) {
        nextMat.roughnessMap.colorSpace = THREE.NoColorSpace;
        nextMat.roughnessMap.needsUpdate = true;
      }
      if (nextMat.metalnessMap) {
        nextMat.metalnessMap.colorSpace = THREE.NoColorSpace;
        nextMat.metalnessMap.needsUpdate = true;
      }
  if (nextMat.aoMap) {
    nextMat.aoMap.colorSpace = THREE.NoColorSpace;
    nextMat.aoMap.needsUpdate = true;
  }
  if ("vertexColors" in nextMat) nextMat.vertexColors = false;
  if ("metalness" in nextMat) nextMat.metalness = 0;
  if ("roughness" in nextMat) nextMat.roughness = nextMat.map ? 0.52 : 0.42;
  if ("envMapIntensity" in nextMat) nextMat.envMapIntensity = 0.72;
  if ("aoMapIntensity" in nextMat) nextMat.aoMapIntensity = Math.min(0.08, Number(nextMat.aoMapIntensity ?? 0.05));
  if (nextMat.normalScale?.set) nextMat.normalScale.set(0.55, 0.55);
  if (nextMat.color?.multiplyScalar) nextMat.color.multiplyScalar(nextMat.map ? 1.2 : 1.14);
  if (nextMat.emissive?.setRGB) nextMat.emissive.setRGB(0.12, 0.12, 0.12);
  if ("emissiveIntensity" in nextMat) nextMat.emissiveIntensity = nextMat.map ? 0.28 : 0.18;
  nextMat.needsUpdate = true;
  return nextMat;
};
    const buildBoneMap = (root) => {
      const map = new Map();
      root?.traverse?.((node) => {
        if (!node?.isBone) return;
        const boneName = String(node.name || "").trim().toLowerCase();
        if (boneName && !map.has(boneName)) {
          map.set(boneName, node);
        }
      });
      return map;
    };
    const findBoneByHints = (boneMap, boneHints = []) => {
      if (!boneMap?.size || !Array.isArray(boneHints) || !boneHints.length) return null;
      for (const hintRaw of boneHints) {
        const hint = String(hintRaw || "").trim().toLowerCase();
        if (!hint) continue;
        if (boneMap.has(hint)) return boneMap.get(hint) || null;
        for (const [boneName, bone] of boneMap.entries()) {
          if (boneName === hint || boneName.endsWith(hint) || boneName.includes(hint)) {
            return bone || null;
          }
        }
      }
      return null;
    };
    const findPrimarySkeleton = (root) => {
      let found = null;
      root?.traverse?.((node) => {
        if (found || !node?.isSkinnedMesh || !node.skeleton) return;
        found = node.skeleton;
      });
      return found;
    };
    const findPrimarySkinnedMesh = (root) => {
      let found = null;
      root?.traverse?.((node) => {
        if (found || !node?.isSkinnedMesh || !node?.skeleton || !node?.geometry?.attributes?.position) return;
        found = node;
      });
      return found;
    };
    const getPreferredWardrobeSkeletonRoot = (state) => {
      const isLoadoutHeroShot =
        state?.mode === "result" && String(state?.resultCameraVariant || "") === "loadout_hero";
      if (!isLoadoutHeroShot) return playerAnimationState.root || null;
      if (String(state?.loadoutCharacterVariant || "hero") === "shadow" && loadoutAltModelState.root) {
        return loadoutAltModelState.root;
      }
      return playerAnimationState.root || loadoutAltModelState.root || null;
    };
    const syncRigidWardrobeSlotAnchors = (characterRoot) => {
      const boneMap = buildBoneMap(characterRoot);
      Object.entries(LOADOUT_WARDROBE_SLOT_ANCHORS).forEach(([slotKey, fallbackAnchor]) => {
        const slotGroup = loadoutWardrobeSlotGroups.get(slotKey);
        if (!slotGroup) return;
        const attachment = LOADOUT_WARDROBE_BONE_ATTACHMENTS[slotKey] || null;
        const targetBone = attachment ? findBoneByHints(boneMap, attachment.boneHints) : null;
        if (slotGroup.parent !== loadoutWardrobeGroup) {
          loadoutWardrobeGroup.add(slotGroup);
        }
        loadoutWardrobeBoneFollowers.set(
          slotKey,
          targetBone
            ? {
                bone: targetBone,
                offset: attachment.offset,
              }
            : null
        );
        slotGroup.position.set(fallbackAnchor.x, fallbackAnchor.y, fallbackAnchor.z);
        slotGroup.rotation.set(0, 0, 0);
        slotGroup.scale.set(1, 1, 1);
      });
    };
    const updateRigidWardrobeBoneFollowers = () => {
      playerVisualPivot.updateWorldMatrix(true, false);
      playerVisualPivot.getWorldQuaternion(wardrobePivotWorldQuaternion);
      wardrobePivotWorldQuaternionInverse.copy(wardrobePivotWorldQuaternion).invert();
      loadoutWardrobeSlotGroups.forEach((slotGroup, slotKey) => {
        const follower = loadoutWardrobeBoneFollowers.get(slotKey);
        if (!follower?.bone) return;
        follower.bone.updateWorldMatrix(true, false);
        follower.bone.getWorldPosition(wardrobeFollowWorldPosition);
        wardrobeFollowLocalPosition.copy(wardrobeFollowWorldPosition);
        playerVisualPivot.worldToLocal(wardrobeFollowLocalPosition);
        follower.bone.getWorldQuaternion(wardrobeFollowWorldQuaternion);
        wardrobeFollowLocalQuaternion.copy(wardrobePivotWorldQuaternionInverse).multiply(wardrobeFollowWorldQuaternion);
        wardrobeFollowOffset.set(follower.offset.x, follower.offset.y, follower.offset.z).applyQuaternion(wardrobeFollowLocalQuaternion);
        slotGroup.position.copy(wardrobeFollowLocalPosition).add(wardrobeFollowOffset);
        slotGroup.quaternion.copy(wardrobeFollowLocalQuaternion);
      });
    };
    const bindWardrobeToCharacterSkeleton = (instance, characterRoot) => {
      if (!instance || !characterRoot) return false;
      const targetBoneMap = buildBoneMap(characterRoot);
      if (!targetBoneMap.size) return false;
      let reboundAny = false;
      instance.traverse((node) => {
        if (!node?.isSkinnedMesh || !node.skeleton) return;
        const sourceBones = Array.isArray(node.skeleton.bones) ? node.skeleton.bones : [];
        if (!sourceBones.length) return;
        const reboundBones = [];
        for (const bone of sourceBones) {
          const targetBone = targetBoneMap.get(String(bone?.name || "").trim().toLowerCase());
          if (!targetBone) return;
          reboundBones.push(targetBone);
        }
        const reboundSkeleton = new THREE.Skeleton(
          reboundBones,
          Array.isArray(node.skeleton.boneInverses) ? node.skeleton.boneInverses.map((inverse) => inverse.clone()) : []
        );
        node.bind(reboundSkeleton, node.bindMatrix?.clone?.() || new THREE.Matrix4());
        node.frustumCulled = false;
        reboundAny = true;
      });
      return reboundAny;
    };
    const buildWardrobeSkinSampler = (characterRoot) => {
      const skinnedMesh = findPrimarySkinnedMesh(characterRoot);
      if (!skinnedMesh?.skeleton || !skinnedMesh.geometry?.attributes?.position) return null;
      skinnedMesh.updateWorldMatrix(true, false);
      playerVisualPivot.updateWorldMatrix(true, false);
      wardrobeInversePivotMatrix.copy(playerVisualPivot.matrixWorld).invert();
      const geometry = skinnedMesh.geometry;
      const positionAttr = geometry.attributes.position;
      const skinIndexAttr = geometry.attributes.skinIndex;
      const skinWeightAttr = geometry.attributes.skinWeight;
      if (!skinIndexAttr || !skinWeightAttr) return null;
      const cellSize = 0.18;
      const hash = new Map();
      const entries = [];
      const tempVertex = new THREE.Vector3();
      const addHashEntry = (entry) => {
        const cx = Math.floor(entry.position.x / cellSize);
        const cy = Math.floor(entry.position.y / cellSize);
        const cz = Math.floor(entry.position.z / cellSize);
        const key = `${cx}|${cy}|${cz}`;
        const list = hash.get(key);
        if (list) list.push(entry);
        else hash.set(key, [entry]);
      };
      for (let i = 0; i < positionAttr.count; i += 1) {
        tempVertex.fromBufferAttribute(positionAttr, i);
        wardrobeSamplerWorldPos.copy(tempVertex).applyMatrix4(skinnedMesh.matrixWorld);
        wardrobeSamplerLocalPos.copy(wardrobeSamplerWorldPos).applyMatrix4(wardrobeInversePivotMatrix);
        const entry = {
          position: wardrobeSamplerLocalPos.clone(),
          indices: [
            skinIndexAttr.getX(i),
            skinIndexAttr.getY(i),
            skinIndexAttr.getZ(i),
            skinIndexAttr.getW(i),
          ],
          weights: [
            skinWeightAttr.getX(i),
            skinWeightAttr.getY(i),
            skinWeightAttr.getZ(i),
            skinWeightAttr.getW(i),
          ],
        };
        entries.push(entry);
        addHashEntry(entry);
      }
      return { skinnedMesh, skeleton: skinnedMesh.skeleton, cellSize, hash, entries };
    };
    const findNearestWardrobeSkinEntry = (sampler, position) => {
      if (!sampler) return null;
      const cellSize = sampler.cellSize || 0.18;
      const baseX = Math.floor(position.x / cellSize);
      const baseY = Math.floor(position.y / cellSize);
      const baseZ = Math.floor(position.z / cellSize);
      let best = null;
      let bestDistSq = Number.POSITIVE_INFINITY;
      for (let radius = 0; radius <= 2; radius += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              const list = sampler.hash.get(`${baseX + dx}|${baseY + dy}|${baseZ + dz}`);
              if (!list?.length) continue;
              for (const entry of list) {
                const distSq = entry.position.distanceToSquared(position);
                if (distSq < bestDistSq) {
                  bestDistSq = distSq;
                  best = entry;
                }
              }
            }
          }
        }
        if (best) return best;
      }
      for (const entry of sampler.entries) {
        const distSq = entry.position.distanceToSquared(position);
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = entry;
        }
      }
      return best;
    };
    const autoRigWardrobeInstance = (instance, characterRoot) => {
      if (!instance || !characterRoot) return false;
      const sampler = buildWardrobeSkinSampler(characterRoot);
      if (!sampler?.skeleton) return false;
      instance.updateWorldMatrix(true, true);
      playerVisualPivot.updateWorldMatrix(true, false);
      wardrobeInversePivotMatrix.copy(playerVisualPivot.matrixWorld).invert();
      let convertedAny = false;
      instance.traverse((node) => {
        if (!node?.isMesh || node.isSkinnedMesh || !node.geometry?.attributes?.position) return;
        const sourceGeometry = node.geometry;
        const geometry = sourceGeometry.clone();
        const positionAttr = geometry.attributes.position;
        const skinIndices = new Uint16Array(positionAttr.count * 4);
        const skinWeights = new Float32Array(positionAttr.count * 4);
        const tempVertex = new THREE.Vector3();
        for (let i = 0; i < positionAttr.count; i += 1) {
          tempVertex.fromBufferAttribute(positionAttr, i);
          wardrobeProbeWorldPos.copy(tempVertex).applyMatrix4(node.matrixWorld);
          wardrobeProbeLocalPos.copy(wardrobeProbeWorldPos).applyMatrix4(wardrobeInversePivotMatrix);
          const nearest = findNearestWardrobeSkinEntry(sampler, wardrobeProbeLocalPos);
          const offset = i * 4;
          if (nearest) {
            for (let j = 0; j < 4; j += 1) {
              skinIndices[offset + j] = Number(nearest.indices[j] || 0);
              skinWeights[offset + j] = Number(nearest.weights[j] || 0);
            }
          } else {
            skinIndices[offset] = 0;
            skinWeights[offset] = 1;
          }
        }
        geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
        geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
        const skinnedMesh = new THREE.SkinnedMesh(
          geometry,
          Array.isArray(node.material) ? node.material.map((mat) => (mat?.clone ? mat.clone() : mat)) : node.material?.clone ? node.material.clone() : node.material
        );
        skinnedMesh.name = node.name;
        skinnedMesh.castShadow = false;
        skinnedMesh.receiveShadow = false;
        skinnedMesh.frustumCulled = false;
        skinnedMesh.position.copy(node.position);
        skinnedMesh.quaternion.copy(node.quaternion);
        skinnedMesh.scale.copy(node.scale);
        skinnedMesh.bind(sampler.skeleton);
        node.parent?.add(skinnedMesh);
        node.parent?.remove(node);
        convertedAny = true;
      });
      if (convertedAny) {
        instance.userData.isSkinnedWardrobe = true;
      }
      return convertedAny;
    };
    const normalizePlayerModelRoot = (object3d) => {
      if (!object3d) return;
      playerAnimBox.setFromObject(object3d);
      playerAnimBox.getSize(playerAnimSize);
      const maxDim = Math.max(playerAnimSize.x, playerAnimSize.y, playerAnimSize.z, 0.0001);
      const reference = playerAnimSize.y > 0.0001 ? playerAnimSize.y : maxDim;
      const scale = PLAYER_BASE_HEIGHT / reference;
      object3d.scale.setScalar(scale);
      playerAnimBox.setFromObject(object3d);
      playerAnimBox.getCenter(playerAnimCenter);
      playerAnimBasePos.set(-playerAnimCenter.x, -playerAnimBox.min.y, -playerAnimCenter.z);
      object3d.position.copy(playerAnimBasePos);
      object3d.rotation.y = Math.PI;
    };
    const registerPlayerClip = (key, clip) => {
      if (!clip || !playerAnimationState.root || !playerAnimationState.mixer) return;
      const sanitizedClip = clip.clone();
      sanitizedClip.tracks =
        key === "hit"
          ? Array.isArray(sanitizedClip.tracks)
            ? sanitizedClip.tracks
            : []
          : (Array.isArray(sanitizedClip.tracks) ? sanitizedClip.tracks : []).filter(
              (track) => !/\.position$/i.test(String(track?.name || ""))
            );
      const action = playerAnimationState.mixer.clipAction(sanitizedClip, playerAnimationState.root);
      action.enabled = true;
      action.clampWhenFinished = key === "hit" || key === "jump" || key === "run_jump";
      action.loop =
        key === "hit" ? THREE.LoopOnce : key === "jump" || key === "run_jump" ? THREE.LoopRepeat : THREE.LoopRepeat;
      playerAnimationState.actions.set(key, action);
      playerAnimationState.clips.set(key, sanitizedClip);
      if (!playerAnimationState.currentKey && (key === "idle" || key === "run")) {
        action.reset().play();
        playerAnimationState.currentKey = key;
      }
    };
    const switchPlayerAnimation = (nextKey, fade = 0.18) => {
      const fallbackKey = playerAnimationState.actions.has(nextKey)
        ? nextKey
        : playerAnimationState.actions.has("run")
          ? "run"
          : playerAnimationState.actions.has("idle")
            ? "idle"
            : "";
      if (!fallbackKey || playerAnimationState.currentKey === fallbackKey) return;
      const currentAction = playerAnimationState.actions.get(playerAnimationState.currentKey) || null;
      const nextAction = playerAnimationState.actions.get(fallbackKey) || null;
      if (!nextAction) return;
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      nextAction.fadeIn(fade);
      nextAction.play();
      if (currentAction) currentAction.fadeOut(fade);
      playerAnimationState.currentKey = fallbackKey;
    };
    const choosePlayerAnimationKey = (state) => {
      const isLoadoutHeroShot =
        state?.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        String(state?.runnerState?.resultPhase || "arrival") !== "arrival";
      if (isLoadoutHeroShot) {
        if (playerAnimationState.actions.has("idle")) return "idle";
        return "";
      }
      const runnerStatus = String(state?.runnerState?.status || "");
      const collisionType = String(state?.runnerState?.collisionType || "");
      if (runnerStatus === "result_scared" && playerAnimationState.actions.has("scared")) return "scared";
      if (runnerStatus === "result_celebrate" && playerAnimationState.actions.has("celebrate")) return "celebrate";
      if (runnerStatus === "result_bg_run" && playerAnimationState.actions.has("result_bg_run")) return "result_bg_run";
      if (runnerStatus === "result_bg_run" && playerAnimationState.actions.has("run")) return "run";
      if (playerAnimationState.hitTimer > 0 && playerAnimationState.actions.has("hit")) return "hit";
      if (Number(state?.runnerState?.slide || 0) > 0.08 && playerAnimationState.actions.has("slide")) return "slide";
      if (Number(state?.runnerState?.jump || 0) > 0.08) {
        if (playerAnimationState.actions.has("run_jump")) return "run_jump";
        if (playerAnimationState.actions.has("jump")) return "jump";
      }
      if (playerAnimationState.collectTimer > 0 && playerAnimationState.actions.has("collect")) return "collect";
      if (runnerStatus === "running") {
        if (playerAnimationState.actions.has("run")) return "run";
      }
      if (runnerStatus === "collision" && String(state?.runnerState?.collisionType || "") !== "pit_gap" && playerAnimationState.actions.has("scared")) {
        return "scared";
      }
      return playerAnimationState.actions.has("idle") ? "idle" : "run";
    };
    const applyPlayerRuntimePose = (state, laneVisual) => {
      if (!playerAnimationState.root) return;
      const isResultMode = state?.mode === "result";
      const resultPosePhase = String(state?.runnerState?.resultPhase || "arrival");
      const isLoadoutHeroPose =
        isResultMode &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        resultPosePhase !== "arrival";
      playerVisualPivot.rotation.y = isLoadoutHeroPose ? animateRefs.loadoutCharacterYaw : 0;
      const laneLean = isResultMode ? 0 : THREE.MathUtils.clamp(Number(state?.runnerState?.laneLean || 0), -1, 1);
      const curveLean = isResultMode ? 0 : THREE.MathUtils.clamp(-Number(state?.roadCurve || 0) * 0.0065, -0.12, 0.12);
      const laneTilt = -laneLean * 0.24;
      playerAnimEuler.set(0, 0, laneTilt + curveLean);
      playerAnimTmpQuat.setFromEuler(playerAnimEuler);
      playerAnimationState.root.quaternion.copy(playerAnimBaseQuat).multiply(playerAnimTmpQuat);
      if (playerAnimationState.currentKey !== "hit") {
        playerAnimationState.root.position.copy(playerAnimBasePos);
      }
      // Recenter the animated FBX every frame so the loadout spin stays on-axis
      // and the feet remain grounded even if the source rig drifts.
      playerVisualPivot.updateWorldMatrix(true, false);
      playerAnimationState.root.updateWorldMatrix(true, true);
      playerRuntimeBox.setFromObject(playerAnimationState.root);
      if (Number.isFinite(playerRuntimeBox.min.x) && Number.isFinite(playerRuntimeBox.max.x)) {
        playerRuntimeBox.getCenter(playerRuntimeCenter);
        playerRuntimeCenterLocal.copy(playerRuntimeCenter);
        playerVisualPivot.worldToLocal(playerRuntimeCenterLocal);
        playerAnimationState.root.position.x -= playerRuntimeCenterLocal.x;
        playerAnimationState.root.position.z -= playerRuntimeCenterLocal.z;
        playerRuntimePivotWorld.set(0, 0, 0);
        playerVisualPivot.localToWorld(playerRuntimePivotWorld);
        playerAnimationState.root.position.y -= playerRuntimeBox.min.y - playerRuntimePivotWorld.y;
      }
      if (playerAnimationState.mixer && playerAnimationState.currentKey) {
        const action = playerAnimationState.actions.get(playerAnimationState.currentKey) || null;
        if (action) {
          const runnerElapsedMs = Number(state?.runnerState?.elapsedMs || 0);
          const launchBoost = runnerElapsedMs < 2600 ? THREE.MathUtils.lerp(1.34, 1.04, clamp01(runnerElapsedMs / 2600)) : 1;
          const speedFactor = Math.max(0.95, Math.min(2.1, Number(state?.runnerState?.speed || 0.82) * 0.84 * launchBoost));
          action.setEffectiveTimeScale(
            playerAnimationState.currentKey === "run" || playerAnimationState.currentKey === "collect" ? speedFactor : 1
          );
        }
      }
    };
    const finalizePlayerBaseLoaded = (modelRoot, animations = []) => {
      if (!modelRoot) return;
      let hasRenderableMesh = false;
      modelRoot.traverse((node) => {
        if (!node.isMesh) return;
        hasRenderableMesh = true;
        node.castShadow = false;
        node.receiveShadow = false;
        node.frustumCulled = false;
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => normalizePlayerMaterial(mat));
        } else if (node.material) {
          node.material = normalizePlayerMaterial(node.material);
        }
      });
      if (!hasRenderableMesh) return;
      normalizePlayerModelRoot(modelRoot);
      playerAnimBaseQuat.copy(modelRoot.quaternion);
      playerAnimationState.root = modelRoot;
      playerAnimationState.mixer = new THREE.AnimationMixer(modelRoot);
      playerVisualPivot.add(modelRoot);
      modelRoot.visible = true;
      playerBody.visible = false;
      const baseClip = Array.isArray(animations) && animations.length ? animations[0] : null;
      if (baseClip) registerPlayerClip("idle", baseClip);
      const shouldLoadExtendedRunnerAnimations =
        !(dataRef.current.mode === "result" && String(dataRef.current.resultCameraVariant || "") === "loadout_hero");
      if (baseClip && shouldLoadExtendedRunnerAnimations) {
        PLAYER_ANIMATION_SOURCES.filter((entry) => entry.key !== "idle").forEach((entry) => {
          playerFbxLoader.load(
            entry.url,
            (loadedFbx) => {
              const clip = Array.isArray(loadedFbx?.animations) && loadedFbx.animations.length ? loadedFbx.animations[0] : null;
              if (clip) registerPlayerClip(entry.key, clip);
            },
            undefined,
            () => null
          );
        });
      }
      playerAnimationState.ready = true;
    };
    const handlePlayerBaseLoaded = (fbx) => {
      if (!fbx) return;
      finalizePlayerBaseLoaded(fbx, fbx.animations);
    };
    const clearLoadoutAltModel = () => {
      if (!loadoutAltModelState.root) return;
      loadoutAltModelState.idleAction?.stop?.();
      loadoutAltModelState.mixer?.stopAllAction?.();
      loadoutAltModelState.root.parent?.remove?.(loadoutAltModelState.root);
      loadoutAltModelState.root.traverse((node) => {
        if (!node?.isMesh) return;
        if (Array.isArray(node.material)) {
          node.material.forEach((mat) => mat?.dispose?.());
        } else {
          node.material?.dispose?.();
        }
        node.geometry?.dispose?.();
      });
      loadoutAltModelState.root = null;
      loadoutAltModelState.mixer = null;
      loadoutAltModelState.idleAction = null;
      loadoutAltModelState.readyForSwap = false;
    };
    const finalizeLoadoutAltModelLoaded = (modelRoot, animations = []) => {
      if (!modelRoot) return;
      let hasRenderableMesh = false;
      modelRoot.traverse((node) => {
        if (!node.isMesh) return;
        hasRenderableMesh = true;
        node.castShadow = false;
        node.receiveShadow = false;
        node.frustumCulled = false;
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => normalizePlayerMaterial(mat));
        } else if (node.material) {
          node.material = normalizePlayerMaterial(node.material);
        }
      });
      if (!hasRenderableMesh) return;
      normalizePreviewModelRoot(modelRoot, PLAYER_BASE_HEIGHT);
      loadoutAltModelState.basePosition.copy(modelRoot.position);
      clearLoadoutAltModel();
      loadoutAltModelState.root = modelRoot;
      const baseClip = Array.isArray(animations) && animations.length ? animations[0]?.clone?.() || animations[0] : null;
      if (baseClip) {
        baseClip.tracks = (Array.isArray(baseClip.tracks) ? baseClip.tracks : []).filter(
          (track) => !/\.position$/i.test(String(track?.name || ""))
        );
        loadoutAltModelState.mixer = new THREE.AnimationMixer(modelRoot);
        loadoutAltModelState.idleAction = loadoutAltModelState.mixer.clipAction(baseClip, modelRoot);
        loadoutAltModelState.idleAction.enabled = true;
        loadoutAltModelState.idleAction.clampWhenFinished = false;
        loadoutAltModelState.idleAction.loop = THREE.LoopRepeat;
        loadoutAltModelState.idleAction.reset().play();
        loadoutAltModelState.readyForSwap = false;
      } else {
        loadoutAltModelState.mixer = null;
        loadoutAltModelState.idleAction = null;
        loadoutAltModelState.readyForSwap = true;
      }
      modelRoot.visible = true;
      playerVisualPivot.add(modelRoot);
    };
    const loadAlternatePlayerBaseModel = (url) => {
      const requestedUrl = String(url || "").trim();
      loadoutAltModelState.sourceUrl = requestedUrl;
      loadoutAltModelState.requestId += 1;
      const requestId = loadoutAltModelState.requestId;
      if (!requestedUrl) {
        clearLoadoutAltModel();
        return;
      }
      instantiateSharedCharacterAsset(requestedUrl)
        .then(({ root, animations }) => {
          if (loadoutAltModelState.requestId !== requestId) return;
          if (!root) {
            clearLoadoutAltModel();
            return;
          }
          finalizeLoadoutAltModelLoaded(root, animations);
        })
        .catch(() => {
          if (loadoutAltModelState.requestId !== requestId) return;
          clearLoadoutAltModel();
        });
    };
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const easeInCubic = (t) => t * t * t;
    const loadCustomPlayerBaseModel = (url) => {
      const requestedUrl = String(url || "").trim();
      if (!requestedUrl) return false;
      instantiateSharedCharacterAsset(requestedUrl)
        .then(({ root, animations }) => {
          if (!root) return;
          finalizePlayerBaseLoaded(root, animations);
        })
        .catch(() => null);
      return true;
    };
    instantiateSharedCharacterAsset(playerIdleFbxUrl)
      .then(({ root, animations }) => {
        if (!root) return;
        finalizePlayerBaseLoaded(root, animations);
      })
      .catch(() => null);
    loadAlternatePlayerBaseModel(
      mode === "result" && String(resultCameraVariant || "") === "loadout_hero"
        ? String(loadoutBaseModelUrl || sceneConfig?.loadout_base_model_url || "").trim()
        : ""
    );

    const bossGroup = new THREE.Group();
    const bossBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.76, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.44, metalness: 0.22 })
    );
    bossGroup.add(bossBody);
    const bossTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.44, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.44, metalness: 0.2 })
    );
    bossTop.position.y = 0.55;
    bossTop.position.z = -0.08;
    bossGroup.add(bossTop);
    assignDevPick(bossGroup, { key: "boss", type: "boss", label: "Carro do dinheiro" });
    worldGroup.add(bossGroup);

    const wheelGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.2, 14);
    const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const wheelOffsets = [
      [-0.75, -0.36, 0.46],
      [0.75, -0.36, 0.46],
      [-0.75, -0.36, -0.46],
      [0.75, -0.36, -0.46],
    ];
    wheelOffsets.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      bossGroup.add(wheel);
    });

    const makeDustTexture = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      gradient.addColorStop(0.55, "rgba(236, 220, 188, 0.55)");
      gradient.addColorStop(1, "rgba(236, 220, 188, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const dustTexture = makeDustTexture();
    const ambientDustGroup = new THREE.Group();
    worldGroup.add(ambientDustGroup);
    const ambientDustMaterial = new THREE.SpriteMaterial({
      map: dustTexture || null,
      color: 0xe7dcc2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      clippingPlanes: [objectCutoffClipPlane],
    });
    const ambientDustSprites = [];
    const ambientDustCount = isLowPerfDevice ? 12 : 44;
    for (let i = 0; i < ambientDustCount; i += 1) {
      const sprite = new THREE.Sprite(ambientDustMaterial);
      sprite.userData = {
        z: -16 - Math.random() * 118,
        x: (Math.random() - 0.5) * 13.8,
        y: 0.24 + Math.random() * 1.35,
        drift: (Math.random() - 0.5) * 0.22,
        size: 0.22 + Math.random() * 0.26,
      };
      ambientDustSprites.push(sprite);
      ambientDustGroup.add(sprite);
    }

    const wheelDustGroup = new THREE.Group();
    worldGroup.add(wheelDustGroup);
    const wheelDustSprites = [];
    const wheelDustPoolSize = isLowPerfDevice ? 10 : 24;
    const wheelDustBaseMaterial = new THREE.SpriteMaterial({
      map: dustTexture || null,
      color: 0xe8d4ae,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      clippingPlanes: [objectCutoffClipPlane],
    });
    for (let i = 0; i < wheelDustPoolSize; i += 1) {
      const sprite = new THREE.Sprite(wheelDustBaseMaterial.clone());
      sprite.visible = false;
      sprite.scale.set(0.3, 0.3, 1);
      sprite.userData = {
        active: false,
        life: 0,
        maxLife: 0.35,
        velocity: new THREE.Vector3(),
      };
      wheelDustSprites.push(sprite);
      wheelDustGroup.add(sprite);
    }
    const loadoutAtmosphereGroup = new THREE.Group();
    loadoutAtmosphereGroup.visible = false;
    playerGroup.add(loadoutAtmosphereGroup);
    const loadoutAtmosphereHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dustTexture || null,
        color: 0xfff0c2,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
    );
    loadoutAtmosphereHalo.position.set(0, 1.18, 0.28);
    loadoutAtmosphereHalo.scale.set(2.15, 1.62, 1);
    loadoutAtmosphereGroup.add(loadoutAtmosphereHalo);
    const loadoutAtmosphereSprites = [];
    const loadoutAtmosphereCount = isLowPerfDevice ? 5 : 9;
    for (let i = 0; i < loadoutAtmosphereCount; i += 1) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dustTexture || null,
          color: i % 3 === 0 ? 0xfef3c7 : i % 2 === 0 ? 0xfde68a : 0xffffff,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );
      sprite.userData = {
        angle: (i / Math.max(1, loadoutAtmosphereCount)) * Math.PI * 2,
        radius: 0.68 + Math.random() * 0.42,
        height: 0.78 + Math.random() * 1.25,
        speed: 0.34 + Math.random() * 0.34,
        bob: 0.04 + Math.random() * 0.06,
        size: 0.07 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
      };
      loadoutAtmosphereSprites.push(sprite);
      loadoutAtmosphereGroup.add(sprite);
    }
    let wheelDustHead = 0;
    let wheelDustSpawnAcc = 0;
    let wheelDustSide = 0;
    const bossDustOffsets = [
      new THREE.Vector3(-0.72, -0.31, 0.58),
      new THREE.Vector3(0.72, -0.31, 0.58),
    ];
    const tempWheelPos = new THREE.Vector3();
    const vegetationBillboardGeometryLeft = new THREE.PlaneGeometry(1, 1);
    vegetationBillboardGeometryLeft.translate(0.5, 0.5, 0);
    const vegetationBillboardGeometryRight = new THREE.PlaneGeometry(1, 1);
    vegetationBillboardGeometryRight.translate(-0.5, 0.5, 0);

    const vegetationUrls = disableAmbientVegetation
      ? []
      : Array.from(new Set([treeTextureUrl, ...(vegetationTextureUrls || [])].filter(Boolean)));
    const vegetationDefs = vegetationUrls.map((url) => {
      const normalized = String(url).toLowerCase();
      const kind = normalized.includes("arvores-rua-3")
        ? "tree_side_large"
        : normalized.includes("arbusto-003")
          ? "shrub_back_large"
        : normalized.includes("arbusto")
          ? "shrub"
          : normalized.includes("rocha")
            ? "rock"
            : "tree";
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { kind, texture };
    });
    const vegetationGroup = new THREE.Group();
    worldGroup.add(vegetationGroup);
    const vegetationMaterials = vegetationDefs.map(
      (def) =>
        new THREE.MeshBasicMaterial({
          map: def.texture,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.05,
          side: THREE.DoubleSide,
          opacity: 0.98,
        })
    );
    const vegetationSprites = [];
    const treeShadowMeshes = [];
    const edgeTreeShadowMeshes = [];
    const weightedMatIndices = [];
    vegetationDefs.forEach((def, idx) => {
      const weight = def.kind === "shrub_back_large" ? 4 : 1;
      for (let i = 0; i < weight; i += 1) weightedMatIndices.push(idx);
    });
    if (weightedMatIndices.length === 0 && vegetationDefs.length > 0) weightedMatIndices.push(0);
    const spriteCountPerSide = isLowPerfDevice ? 16 : 42;
    if (vegetationMaterials.length > 0) {
      for (let i = 0; i < spriteCountPerSide * 2; i += 1) {
        const side = i < spriteCountPerSide ? -1 : 1;
        const sideIndex = i % spriteCountPerSide;
        const spread = sideIndex / Math.max(1, spriteCountPerSide - 1);
        const matIdx = weightedMatIndices[i % weightedMatIndices.length];
        const geometry = side < 0 ? vegetationBillboardGeometryRight : vegetationBillboardGeometryLeft;
        const sprite = new THREE.Mesh(geometry, vegetationMaterials[matIdx]);
        const kind = vegetationDefs[matIdx]?.kind || "tree";
        const objectKey = `vegetation_${i}`;
        sprite.userData = {
          objectKey,
          side,
          z: -26 - spread * 176 - Math.random() * 3.5,
          jitter: Math.random() * 2.8,
          kind,
          laneBand: kind === "shrub_back_large" ? (Math.random() < 0.55 ? "edge" : "back") : "normal",
          baseTextureUrl: vegetationUrls[matIdx] || "",
          baseMaterial: vegetationMaterials[matIdx],
        };
        assignDevPick(sprite, {
          key: objectKey,
          type: "vegetation",
          index: i,
          kind,
          texture_url: vegetationUrls[matIdx] || "",
          label: `Vegetacao ${i + 1}`,
        });
        vegetationSprites.push(sprite);
        vegetationGroup.add(sprite);

        const shadowMesh = new THREE.Mesh(treeShadowGeometry, treeShadowMaterial);
        shadowMesh.visible = false;
        shadowMesh.userData = {
          yaw: (Math.random() - 0.5) * 0.34,
        };
        treeShadowMeshes.push(shadowMesh);
        treeShadowGroup.add(shadowMesh);
      }
    }

    const edgeVegetationUrls = disableAmbientVegetation
      ? []
      : Array.from(new Set((edgeVegetationTextureUrls || []).filter(Boolean)));
    const edgeVegetationDefs = edgeVegetationUrls.map((url) => {
      const normalized = String(url).toLowerCase();
      const kind = normalized.includes("pedrinha") ? "pebbles" : "edge";
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { kind, texture };
    });
    const edgeVegetationMaterials = edgeVegetationDefs.map(
      (def) =>
        new THREE.MeshBasicMaterial({
          map: def.texture,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.08,
          side: THREE.DoubleSide,
          opacity: 0.98,
        })
    );
    const edgeVegetationGroup = new THREE.Group();
    worldGroup.add(edgeVegetationGroup);
    const edgeVegetationSprites = [];
    const edgeSpriteCountPerSide = isLowPerfDevice ? 18 : 64;
    if (edgeVegetationMaterials.length > 0) {
      for (let i = 0; i < edgeSpriteCountPerSide * 2; i += 1) {
        const side = i < edgeSpriteCountPerSide ? -1 : 1;
        const sideIndex = i % edgeSpriteCountPerSide;
        const spread = sideIndex / Math.max(1, edgeSpriteCountPerSide - 1);
        const matIdx = i % edgeVegetationMaterials.length;
        const geometry = side < 0 ? vegetationBillboardGeometryRight : vegetationBillboardGeometryLeft;
        const sprite = new THREE.Mesh(geometry, edgeVegetationMaterials[matIdx]);
        sprite.userData = {
          objectKey: `edge_vegetation_${i}`,
          side,
          z: -24 - spread * 184 - Math.random() * 3.2,
          jitter: Math.random() * 1.25,
          typeScale: 0.75 + ((i + matIdx) % 5) * 0.1,
          kind: edgeVegetationDefs[matIdx]?.kind || "edge",
          baseTextureUrl: edgeVegetationUrls[matIdx] || "",
          baseMaterial: edgeVegetationMaterials[matIdx],
        };
        assignDevPick(sprite, {
          key: sprite.userData.objectKey,
          type: "edge_vegetation",
          index: i,
          kind: sprite.userData.kind,
          texture_url: edgeVegetationUrls[matIdx] || "",
          label: `Borda ${i + 1}`,
        });
        edgeVegetationSprites.push(sprite);
        edgeVegetationGroup.add(sprite);

        const shadowMesh = new THREE.Mesh(treeShadowGeometry, treeShadowMaterial);
        shadowMesh.visible = false;
        shadowMesh.userData = {
          yaw: (Math.random() - 0.5) * 0.24,
        };
        edgeTreeShadowMeshes.push(shadowMesh);
        treeShadowGroup.add(shadowMesh);
      }
    }

    const customObjectGroup = new THREE.Group();
    worldGroup.add(customObjectGroup);
    const customObjectTextureCache = new Map();
    const customObjectMaterialCache = new Map();
    const customObjectVideoCache = new Map();
    const customObjectMeshes = new Map();
    const customObjectInstancedBatches = new Map();
    const customModelTemplatePromiseCache = new Map();
    const customModelTemplateObjectCache = new Map();
    const overrideTextureCache = new Map();
    const overrideBillboardMaterialCache = new Map();
    const overrideVideoCache = new Map();
    const proceduralTextureBaseCache = new Map();
    const importedModelTextureBaseCache = new Map();
    const importedModelTextureVariantCache = new Map();
    const importedModelMaterialCache = new Map();
    const instancedModelDummy = new THREE.Object3D();
    const instancedModelRootInverse = new THREE.Matrix4();
    const instancedModelPartMatrix = new THREE.Matrix4();
    let customObjectsEnabled = true;
    const proceduralFallbackMaterial = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.05,
    });
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
    const createBillboardMaterial = (url, materialCache, textureCache, videoCache) => {
      if (!url) return null;
      const key = String(url);
      const resolvedKey = resolveSceneUploadUrl(key);
      if (materialCache.has(key)) return materialCache.get(key);
      const type = detectAssetTypeFromUrl(key);
      try {
        if (type === "video") {
          const video = document.createElement("video");
          video.src = resolvedKey;
          video.crossOrigin = "anonymous";
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.play().catch(() => {});
          const videoTexture = new THREE.VideoTexture(video);
          videoTexture.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.MeshBasicMaterial({
            map: videoTexture,
            transparent: true,
            depthWrite: false,
            alphaTest: 0.05,
            side: THREE.DoubleSide,
            opacity: 0.98,
          });
          materialCache.set(key, material);
          videoCache.set(key, { video, texture: videoTexture });
          return material;
        }
        const texture = textureLoader.load(resolvedKey);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: true,
          alphaTest: 0.05,
          side: THREE.DoubleSide,
          opacity: 0.98,
        });
        textureCache.set(key, texture);
        materialCache.set(key, material);
        return material;
      } catch {
        return null;
      }
    };
    const getCustomMaterial = (textureUrl) => {
      return createBillboardMaterial(
        textureUrl,
        customObjectMaterialCache,
        customObjectTextureCache,
        customObjectVideoCache
      );
    };
    const getOverrideBillboardMaterial = (textureUrl) => {
      return createBillboardMaterial(
        textureUrl,
        overrideBillboardMaterialCache,
        overrideTextureCache,
        overrideVideoCache
      );
    };
    const createModelPlaceholder = () => {
      const geo = new THREE.BoxGeometry(2, 2, 2);
      const fill = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );
      const wire = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.9,
          wireframe: true,
        })
      );
      const box = new THREE.Group();
      box.add(fill);
      box.add(wire);
      box.userData.placeholder = true;
      box.renderOrder = 10;
      return box;
    };
    const prepareWardrobeInstance = (root, slotKey, options = null) => {
      if (!root) return null;
      const preserveLayout = !!options?.preserveLayout;
      const hasSkinnedMesh = !!findPrimarySkeleton(root);
      const instance = hasSkinnedMesh ? SkeletonUtils.clone(root) : root.clone(true);
      instance.traverse((node) => {
        if (!node?.isMesh) return;
        node.frustumCulled = false;
        node.castShadow = false;
        node.receiveShadow = false;
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => (mat?.clone ? mat.clone() : mat));
        } else if (node.material?.clone) {
          node.material = node.material.clone();
        }
      });
      instance.userData.isSkinnedWardrobe = hasSkinnedMesh;
      if (hasSkinnedMesh || preserveLayout) {
        return instance;
      }
      const box = new THREE.Box3().setFromObject(instance);
      const center = new THREE.Vector3();
      box.getCenter(center);
      if (slotKey === "shoes" || slotKey === "bottom") {
        instance.position.set(-center.x, -box.min.y, -center.z);
      } else {
        instance.position.set(-center.x, -center.y, -center.z);
      }
      return instance;
    };
    const loadModelTemplate = (modelUrl, modelNameHint = "") => {
      const key = String(modelUrl || "");
      const resolvedKey = resolveSceneUploadUrl(key);
      if (!key) return Promise.resolve({ template: null, error: "missing_url" });
      if (customModelTemplateObjectCache.has(key)) {
        return Promise.resolve({ template: customModelTemplateObjectCache.get(key), error: null });
      }
      if (customModelTemplatePromiseCache.has(key)) return customModelTemplatePromiseCache.get(key);
      const modelType = detectAssetTypeFromUrl(key);
      const typeHint = `${getCanonicalSceneAssetName(key)} ${getCanonicalSceneAssetName(modelNameHint)}`.trim();
      const promise = new Promise((resolve) => {
        const handleLoaded = (root) => {
          if (!root) {
            resolve({ template: null, error: "empty_root" });
            return;
          }
          const template = root;
          customModelTemplateObjectCache.set(key, template);
          resolve({ template, error: null });
        };
        const handleError = () => resolve({ template: null, error: "load_failed" });
        if (modelType === "model3d" && /\.glb(?:\?|#|$)|\.glb\b/i.test(typeHint)) {
          gltfLoader.load(resolvedKey, (gltf) => handleLoaded(gltf?.scene || null), undefined, handleError);
          return;
        }
        if (modelType === "model3d" && /\.gltf(?:\?|#|$)|\.gltf\b/i.test(typeHint)) {
          gltfLoader.load(resolvedKey, (gltf) => handleLoaded(gltf?.scene || null), undefined, handleError);
          return;
        }
        if (modelType === "model3d" && /\.fbx(?:\?|#|$)|\.fbx\b/i.test(typeHint)) {
          fbxLoader.load(resolvedKey, (fbx) => handleLoaded(fbx || null), undefined, handleError);
          return;
        }
        if (modelType === "model3d" && /\.obj(?:\?|#|$)|\.obj\b/i.test(typeHint)) {
          objLoader.load(resolvedKey, (obj) => handleLoaded(obj || null), undefined, handleError);
          return;
        }
        if (modelType === "model3d" && /\.stl(?:\?|#|$)|\.stl\b/i.test(typeHint)) {
          stlLoader.load(
            resolvedKey,
            (geometry) =>
              handleLoaded(
                new THREE.Mesh(
                  geometry,
                  new THREE.MeshStandardMaterial({
                    color: 0xcbd5e1,
                    roughness: 0.78,
                    metalness: 0.04,
                  })
                )
              ),
            undefined,
            handleError
          );
          return;
        }
        resolve({ template: null, error: "unsupported_type" });
      }).finally(() => {
        customModelTemplatePromiseCache.delete(key);
      });
      customModelTemplatePromiseCache.set(key, promise);
      return promise;
    };
    const ensurePowerCrateTemplate = () => {
      if (powerCrateVisualState.ready || powerCrateVisualState.loading) return;
      powerCrateVisualState.loading = true;
      loadModelTemplate(DEFAULT_POWER_CRATE_MODEL_URL).then((result) => {
        powerCrateVisualState.loading = false;
        const template = result?.template || null;
        powerCrateVisualState.template = template;
        powerCrateVisualState.ready = !!template;
        powerCrateVisualState.failed = !template;
      });
    };
    const createPowerCrateInstance = ({ fragment = false } = {}) => {
      const template = powerCrateVisualState.template;
      if (!template) {
        return null;
      }
      const root = template.clone(true);
      root.traverse((node) => {
        if (!node?.isMesh) return;
        if (/collider/i.test(String(node.name || ""))) {
          node.visible = false;
          return;
        }
        node.frustumCulled = false;
        node.castShadow = false;
        node.receiveShadow = false;
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => (mat?.clone ? mat.clone() : mat));
        } else if (node.material?.clone) {
          node.material = node.material.clone();
        }
        const tint = fragment ? 0.88 + Math.random() * 0.18 : 1.18;
        const materialList = Array.isArray(node.material) ? node.material : [node.material];
        materialList.forEach((material) => {
          if (!material) return;
          material.transparent = true;
          material.opacity = fragment ? 0.98 : 1;
          if (material.color) {
            material.color.offsetHSL(0.01, fragment ? 0.08 : 0.22, fragment ? 0.02 : 0.1);
            material.color.multiplyScalar(tint);
          }
          if ("emissive" in material && material.emissive) {
            material.emissive.set(fragment ? 0xff9f43 : 0xffc14d);
          }
          if ("emissiveIntensity" in material) {
            material.emissiveIntensity = fragment ? 0.24 : 0.88;
          }
          if ("roughness" in material) material.roughness = fragment ? 0.42 : 0.2;
          if ("metalness" in material) material.metalness = fragment ? 0.28 : 0.46;
        });
      });
      if (!fragment) {
        const aura = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: powerCrateAuraTexture,
            color: new THREE.Color("#ffb703"),
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        aura.scale.set(1.9, 1.9, 1);
        aura.position.set(0, 0.34, 0);
        root.add(aura);
        const sparks = [];
        for (let i = 0; i < 6; i += 1) {
          const spark = new THREE.Mesh(
            powerCrateSparkGeometry,
            new THREE.MeshBasicMaterial({
              color: i % 2 === 0 ? 0xfff0a8 : 0xff9f1c,
              transparent: true,
              opacity: 0.9,
            })
          );
          spark.position.set(0, 0.25, 0);
          root.add(spark);
          sparks.push({
            mesh: spark,
            phase: (i / 6) * Math.PI * 2,
            radius: 0.42 + (i % 3) * 0.06,
            lift: 0.1 + (i % 2) * 0.08,
          });
        }
        root.userData.aura = aura;
        root.userData.sparks = sparks;
      }
      root.userData.disposeSelf = () => disposeObjectMaterialsOnly(root);
      return root;
    };
    const createPowerCrateBreakEffect = () => {
      const group = new THREE.Group();
      const fragments = [];
      for (let i = 0; i < 3; i += 1) {
        const fragment = createPowerCrateInstance({ fragment: true });
        if (!fragment) continue;
        fragment.scale.setScalar(0.62 + i * 0.12);
        group.add(fragment);
        fragments.push({
          node: fragment,
          offset: new THREE.Vector3((i - 1) * 0.82, 0.58 + i * 0.12, -0.12 - i * 0.16),
          rotation: new THREE.Euler(0.8 + i * 0.35, (i - 1) * 0.8, i % 2 === 0 ? -0.55 : 0.55),
        });
      }
      group.userData.fragments = fragments;
      group.userData.disposeSelf = () => {
        fragments.forEach(({ node }) => node?.userData?.disposeSelf?.());
      };
      return group;
    };
    const createResultChestFallback = () => {
      const root = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.78, 0.82),
        new THREE.MeshStandardMaterial({
          color: 0xa24b16,
          emissive: 0x3a1706,
          emissiveIntensity: 0.36,
          roughness: 0.42,
          metalness: 0.2,
        })
      );
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, 0.34, 0.88),
        new THREE.MeshStandardMaterial({
          color: 0xd2862e,
          emissive: 0x5a2a08,
          emissiveIntensity: 0.46,
          roughness: 0.36,
          metalness: 0.24,
        })
      );
      base.position.y = 0.34;
      lid.position.y = 0.88;
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: powerCrateAuraTexture,
          color: new THREE.Color("#ffb703"),
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      aura.scale.set(1.85, 1.85, 1);
      aura.position.set(0, 0.7, 0);
      const sparks = [];
      for (let i = 0; i < 6; i += 1) {
        const spark = new THREE.Mesh(
          powerCrateSparkGeometry,
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xfff0a8 : 0xff9f1c,
            transparent: true,
            opacity: 0.82,
          })
        );
        spark.position.set(0, 0.48, 0);
        root.add(spark);
        sparks.push({
          mesh: spark,
          phase: (i / 6) * Math.PI * 2,
          radius: 0.42 + (i % 3) * 0.06,
          lift: 0.12 + (i % 2) * 0.08,
        });
      }
      root.add(base);
      root.add(lid);
      root.add(aura);
      root.userData.aura = aura;
      root.userData.sparks = sparks;
      root.userData.disposeSelf = () => {
        base.geometry?.dispose?.();
        lid.geometry?.dispose?.();
        base.material?.dispose?.();
        lid.material?.dispose?.();
        aura.material?.dispose?.();
        sparks.forEach(({ mesh }) => {
          mesh.geometry?.dispose?.();
          mesh.material?.dispose?.();
        });
      };
      return root;
    };
    const warmPowerCrateVisuals = () => {
      if (!powerCrateVisualState.ready || powerCrateVisualState.warmed) return;
      const preview = createPowerCrateInstance();
      const breakPreview = createPowerCrateBreakEffect();
      if (!preview || !breakPreview) return;
      powerCrateVisualState.warmed = true;
      preview.position.set(0, -999, 0);
      breakPreview.position.set(0, -999, 0);
      dynamicGroup.add(preview);
      dynamicGroup.add(breakPreview);
      renderer.compile(scene, camera);
      dynamicGroup.remove(preview);
      dynamicGroup.remove(breakPreview);
      preview.userData?.disposeSelf?.();
      breakPreview.userData?.disposeSelf?.();
    };
    const disposeInstancedBatch = (batch) => {
      if (!batch) return;
      if (Array.isArray(batch.parts)) {
        batch.parts.forEach((part) => {
          if (!part?.mesh) return;
          customObjectGroup.remove(part.mesh);
          part.mesh.geometry?.dispose?.();
          if (Array.isArray(part.mesh.material)) {
            part.mesh.material.forEach((mat) => mat?.dispose?.());
          } else {
            part.mesh.material?.dispose?.();
          }
        });
      }
    };
    const canUseInstancedCustomModel = ({
      key,
      state,
      entry,
      override,
      mediaType,
      modelUrl,
      importedTextureUrl,
      pieceCurveSide,
      pieceCurveDown,
      movementMode,
    }) => {
      if (mediaType !== "model3d" || !modelUrl) return false;
      if (movementMode !== "anchored") return false;
      if (!isEnvironmentInstancingCandidateName(modelUrl)) return false;
      const selectedObjectKey = String(state?.selectedObjectKey || "");
      if (selectedObjectKey && selectedObjectKey === String(key || "")) return false;
      if (state?.showGuides && String(state?.devInteractionMode || "select") === "select") return false;
      if (Math.abs(Number(pieceCurveSide || 0)) > 0.0001 || Math.abs(Number(pieceCurveDown || 0)) > 0.0001) return false;
      if (String(importedTextureUrl || "").trim()) return false;
      return true;
    };
    const ensureInstancedBatch = (batchKey, modelUrl) => {
      const existing = customObjectInstancedBatches.get(batchKey);
      if (existing) return existing;
      const batch = {
        key: batchKey,
        modelUrl,
        canonicalName: getCanonicalSceneAssetName(modelUrl),
        loading: false,
        ready: false,
        autoScaleFactor: 1,
        sourceMaxDim: 0,
        parts: [],
        count: 0,
      };
      customObjectInstancedBatches.set(batchKey, batch);
      batch.loading = true;
      loadModelTemplate(modelUrl).then((result) => {
        if (!customObjectInstancedBatches.has(batchKey)) return;
        const targetBatch = customObjectInstancedBatches.get(batchKey);
        if (!targetBatch) return;
        targetBatch.loading = false;
        const template = result?.template || null;
        if (!template) return;
        const sourceProbe = template.clone(true);
        const sourceBounds = new THREE.Box3().setFromObject(sourceProbe);
        const sourceSize = new THREE.Vector3();
        sourceBounds.getSize(sourceSize);
        const sourceMaxDim = Math.max(sourceSize.x || 0, sourceSize.y || 0, sourceSize.z || 0);
        const autoScaleFactor = sourceMaxDim > 0 && sourceMaxDim < 1.5 ? 1.5 / sourceMaxDim : 1;
        template.updateWorldMatrix(true, true);
        instancedModelRootInverse.copy(template.matrixWorld).invert();
        const nextParts = [];
        template.traverse((node) => {
          if (!node?.isMesh || !node.geometry || Array.isArray(node.material)) return;
          const geometry = node.geometry.clone();
          const material = normalizeImportedSceneMaterial(node.material);
          const instancedMesh = new THREE.InstancedMesh(geometry, material, 512);
          instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          instancedMesh.castShadow = false;
          instancedMesh.receiveShadow = false;
          instancedMesh.frustumCulled = true;
          instancedModelPartMatrix.copy(instancedModelRootInverse).multiply(node.matrixWorld);
          nextParts.push({
            baseMatrix: instancedModelPartMatrix.clone(),
            mesh: instancedMesh,
          });
          customObjectGroup.add(instancedMesh);
        });
        targetBatch.parts = nextParts;
        targetBatch.autoScaleFactor = autoScaleFactor;
        targetBatch.sourceMaxDim = sourceMaxDim;
        targetBatch.ready = nextParts.length > 0;
      });
      return batch;
    };
    const syncLoadoutWardrobe = (state) => {
      const rawWardrobe = state?.loadoutWardrobe;
      const isLoadoutHeroShot =
        state?.mode === "result" && String(state?.resultCameraVariant || "") === "loadout_hero";
      const shouldShowWardrobe =
        state?.mode === "challenge" ||
        state?.mode === "intro" ||
        state?.mode === "result";
      const equipped = rawWardrobe && typeof rawWardrobe === "object" && rawWardrobe.equipped && typeof rawWardrobe.equipped === "object"
        ? rawWardrobe.equipped
        : {};
      const library = Array.isArray(rawWardrobe?.library) ? rawWardrobe.library : [];
      const skeletonRoot = getPreferredWardrobeSkeletonRoot(state);
      syncRigidWardrobeSlotAnchors(skeletonRoot);
      const skeletonNamesToken = skeletonRoot
        ? Array.from(buildBoneMap(skeletonRoot).keys()).slice(0, 128).join("|")
        : "";
      const nextToken = shouldShowWardrobe ? JSON.stringify({ equipped, library, variant: state?.loadoutCharacterVariant || "hero", skeletonNamesToken, mode: state?.mode || "" }) : "";
      if (loadoutWardrobeState.token === nextToken) return;
      loadoutWardrobeState.token = nextToken;
      loadoutWardrobeState.revision += 1;
      const revision = loadoutWardrobeState.revision;
      loadoutWardrobeSlotGroups.forEach((slotGroup, slotKey) => {
        while (slotGroup.children.length) {
          slotGroup.remove(slotGroup.children[0]);
        }
        const skinnedSlotGroup = loadoutWardrobeSkinnedSlotGroups.get(slotKey);
        while (skinnedSlotGroup && skinnedSlotGroup.children.length) {
          skinnedSlotGroup.remove(skinnedSlotGroup.children[0]);
        }
        loadoutWardrobeState.instances.delete(slotKey);
        const equippedEntry = equipped?.[slotKey];
        const itemId = String(equippedEntry?.itemId || "");
        if (!itemId || !shouldShowWardrobe) return;
        const libraryEntry = library.find((item) => String(item?.id || "") === itemId);
        const modelUrl = String(libraryEntry?.model_url || "");
        if (!modelUrl) return;
        const shouldAutoRig = LOADOUT_WARDROBE_AUTO_RIG_SLOT_KEYS.has(slotKey) && !!libraryEntry?.auto_rig;
        const transform = normalizeWardrobeTransform(equippedEntry?.transform);
        loadModelTemplate(modelUrl).then((result) => {
          const template = result?.template || null;
          if (loadoutWardrobeState.revision !== revision) return;
          if (!template) {
            const placeholder = createModelPlaceholder();
            placeholder.scale.setScalar(Math.max(0.28, transform.scale * 0.5));
            placeholder.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
            placeholder.rotation.set(toRad(transform.rotationX), toRad(transform.rotationY), toRad(transform.rotationZ));
            slotGroup.add(placeholder);
            loadoutWardrobeState.instances.set(slotKey, placeholder);
            return;
          }
          const instance = prepareWardrobeInstance(template, slotKey, { preserveLayout: shouldAutoRig });
          if (!instance) return;
          const autoRigged = !instance.userData?.isSkinnedWardrobe && shouldAutoRig
            ? autoRigWardrobeInstance(instance, skeletonRoot)
            : false;
          const isSkinnedWardrobe = !!instance.userData?.isSkinnedWardrobe || autoRigged;
          if (isSkinnedWardrobe) {
            const bound = bindWardrobeToCharacterSkeleton(instance, skeletonRoot);
            instance.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
            instance.rotation.set(toRad(transform.rotationX), toRad(transform.rotationY), toRad(transform.rotationZ));
            instance.scale.multiplyScalar(transform.scale);
            (bound ? skinnedSlotGroup || slotGroup : slotGroup).add(instance);
          } else {
            instance.position.x += transform.offsetX;
            instance.position.y += transform.offsetY;
            instance.position.z += transform.offsetZ;
            instance.rotation.set(toRad(transform.rotationX), toRad(transform.rotationY), toRad(transform.rotationZ));
            instance.scale.multiplyScalar(transform.scale);
            slotGroup.add(instance);
          }
          loadoutWardrobeState.instances.set(slotKey, instance);
        });
      });
    };
    const toProceduralNumber = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const toProceduralInt = (value, fallback, min, max) => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const normalizeProceduralTextureSettings = (rawSettings) => {
      const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
      const wrap = String(raw.wrap || "repeat").toLowerCase();
      return {
        repeat_x: toProceduralNumber(raw.repeat_x, 1, 0.05, 64),
        repeat_y: toProceduralNumber(raw.repeat_y, 1, 0.05, 64),
        offset_x: toProceduralNumber(raw.offset_x, 0, -4, 4),
        offset_y: toProceduralNumber(raw.offset_y, 0, -4, 4),
        rotation_deg: toProceduralNumber(raw.rotation_deg, 0, -360, 360),
        wrap: wrap === "clamp" || wrap === "mirror" ? wrap : "repeat",
      };
    };
    const applyProceduralTextureSettings = (texture, settingsRaw) => {
      if (!texture) return;
      const settings = normalizeProceduralTextureSettings(settingsRaw);
      texture.wrapS =
        settings.wrap === "clamp"
          ? THREE.ClampToEdgeWrapping
          : settings.wrap === "mirror"
          ? THREE.MirroredRepeatWrapping
          : THREE.RepeatWrapping;
      texture.wrapT = texture.wrapS;
      texture.repeat.set(settings.repeat_x, settings.repeat_y);
      texture.offset.set(settings.offset_x, settings.offset_y);
      texture.center.set(0.5, 0.5);
      texture.rotation = THREE.MathUtils.degToRad(settings.rotation_deg);
      if (texture.image) texture.needsUpdate = true;
    };
    const getImportedModelMaterial = (url, settingsRaw) => {
      const safe = String(url || "").trim();
      if (!safe) return null;
      const resolved = resolveSceneUploadUrl(safe);
      if (!resolved) return null;
      const settings = normalizeProceduralTextureSettings(settingsRaw);
      if (!importedModelTextureBaseCache.has(safe)) {
        try {
          const texture = textureLoader.load(resolved);
          texture.colorSpace = THREE.SRGBColorSpace;
          importedModelTextureBaseCache.set(safe, texture);
        } catch {
          return null;
        }
      }
      const baseTexture = importedModelTextureBaseCache.get(safe);
      if (!baseTexture) return null;
      const variantKey = `${safe}::${JSON.stringify(settings)}`;
      if (!importedModelTextureVariantCache.has(variantKey)) {
        const variantTexture = baseTexture.clone();
        variantTexture.flipY = false;
        applyProceduralTextureSettings(variantTexture, settings);
        importedModelTextureVariantCache.set(variantKey, variantTexture);
      }
      if (!importedModelMaterialCache.has(variantKey)) {
        importedModelMaterialCache.set(
          variantKey,
          new THREE.MeshStandardMaterial({
            map: importedModelTextureVariantCache.get(variantKey),
            color: 0xffffff,
            roughness: 0.78,
            metalness: 0.05,
          })
        );
      }
      return importedModelMaterialCache.get(variantKey);
    };
    const prepareImportedModelInstance = (root) => {
      if (!root) return;
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry) return;
        node.geometry = node.geometry.clone();
        if (!node.userData) node.userData = {};
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => normalizeImportedSceneMaterial(mat));
        } else {
          node.material = normalizeImportedSceneMaterial(node.material);
        }
        node.userData.originalImportedMaterial = node.material;
        ensureImportedOriginalUvBackup(node.geometry);
        if (node.geometry?.attributes?.position) {
          node.userData.roadCurveBasePositions = new Float32Array(node.geometry.attributes.position.array);
          node.userData.roadCurveGeometryReady = true;
        }
      });
    };
    const prepareImportedModelForRoadBend = (root, estimatedLength = 1) => {
      if (!root) return;
      const maxEdgeLength = Math.max(0.35, Math.min(1.4, Number(estimatedLength || 1) / 18));
      const tessellate = createTessellateModifierWhenReady(maxEdgeLength, 2);
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry?.attributes?.position) return;
        try {
          let geometry = node.geometry.clone();
          if (geometry.index) geometry = geometry.toNonIndexed();
          const vertexCount = Number(geometry.attributes?.position?.count || 0);
          if (vertexCount > 18000) {
            node.geometry = geometry;
            ensureImportedOriginalUvBackup(node.geometry);
            return;
          }
          if (tessellate) {
            geometry = tessellate.modify(geometry);
          }
          node.geometry = geometry;
          ensureImportedOriginalUvBackup(node.geometry);
        } catch {
          // Keep original cloned geometry if tessellation fails for a specific mesh.
        }
      });
    };
    const markImportedModelRoadCurveBase = (root) => {
      if (!root) return;
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry?.attributes?.position) return;
        if (!node.userData) node.userData = {};
        const attr = node.geometry.attributes.position;
        node.userData.roadCurveBasePositions = new Float32Array(attr.array);
        node.userData.roadCurveGeometryReady = true;
      });
    };
    const applyImportedModelRoadCurve = (
      root,
      centerZ,
      curveValue,
      roadSculpt,
      flow,
      roadEvents,
      selectedFocus,
      scaleX,
      scaleY,
      scaleZ,
      forwardAxis = "z",
      pieceCurveSide = 0,
      pieceCurveDown = 0,
      pieceCurveSideRadius = 1,
      pieceCurveDownRadius = 1
    ) => {
      if (!root) return;
      const axis = String(forwardAxis || "z").toLowerCase() === "x" ? "x" : "z";
      const lengthScale = Math.max(0.001, axis === "x" ? scaleX : scaleZ);
      const lateralScale = Math.max(0.001, axis === "x" ? scaleZ : scaleX);
      const safeCurveSide = Number(pieceCurveSide || 0);
      const safeCurveDown = Number(pieceCurveDown || 0);
      const safeSideRadius = Math.max(0.15, Number(pieceCurveSideRadius || 1));
      const safeDownRadius = Math.max(0.15, Number(pieceCurveDownRadius || 1));
      const centerCurve = curveOffsetAt(centerZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
      const centerDrop = dropAt(centerZ, roadSculpt, flow, roadEvents, selectedFocus);
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry?.attributes?.position) return;
        const basePositions = node.userData?.roadCurveBasePositions;
        if (!basePositions) return;
        const attr = node.geometry.attributes.position;
        const array = attr.array;
        for (let i = 0; i < array.length; i += 3) {
          const baseX = basePositions[i];
          const baseY = basePositions[i + 1];
          const baseZ = basePositions[i + 2];
          const localForward = (axis === "x" ? baseX : baseZ) * lengthScale;
          const localLateral = (axis === "x" ? baseZ : baseX) * lateralScale;
          const forwardNorm = localForward / Math.max(0.001, lengthScale);
          const sideT = Math.max(0, Math.min(1, (forwardNorm / safeSideRadius) + 0.5));
          const downT = Math.max(0, Math.min(1, (forwardNorm / safeDownRadius) + 0.5));
          const sideCurve = Math.pow(sideT, 1.45);
          const downCurve = Math.pow(downT, 1.35);
          const worldZ = centerZ + localForward;
          array[i] =
            localLateral +
            safeCurveSide * sideCurve +
            (curveOffsetAt(worldZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus) - centerCurve);
          array[i + 1] =
            baseY * scaleY -
            safeCurveDown * downCurve +
            (dropAt(worldZ, roadSculpt, flow, roadEvents, selectedFocus) - centerDrop);
          array[i + 2] = localForward;
        }
        attr.needsUpdate = true;
        node.geometry.computeBoundingBox?.();
        node.geometry.computeBoundingSphere?.();
      });
    };
    const applyImportedModelPieceCurve = (
      root,
      curveSide = 0,
      curveDown = 0,
      curveSideRadius = 1,
      curveDownRadius = 1,
      scaleX = 1,
      scaleY = 1,
      scaleZ = 1,
      forwardAxis = "z"
    ) => {
      if (!root) return;
      const axis = String(forwardAxis || "z").toLowerCase() === "x" ? "x" : "z";
      const lengthScale = Math.max(0.001, axis === "x" ? scaleX : scaleZ);
      const lateralScale = Math.max(0.001, axis === "x" ? scaleZ : scaleX);
      const safeCurveSide = Number(curveSide || 0);
      const safeCurveDown = Number(curveDown || 0);
      const safeSideRadius = Math.max(0.15, Number(curveSideRadius || 1));
      const safeDownRadius = Math.max(0.15, Number(curveDownRadius || 1));
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry?.attributes?.position) return;
        const basePositions = node.userData?.roadCurveBasePositions;
        if (!basePositions) return;
        const attr = node.geometry.attributes.position;
        const array = attr.array;
        for (let i = 0; i < array.length; i += 3) {
          const baseX = basePositions[i];
          const baseY = basePositions[i + 1];
          const baseZ = basePositions[i + 2];
          const localForward = (axis === "x" ? baseX : baseZ) * lengthScale;
          const localLateral = (axis === "x" ? baseZ : baseX) * lateralScale;
          const forwardNorm = localForward / Math.max(0.001, lengthScale);
          const sideT = Math.max(0, Math.min(1, (forwardNorm / safeSideRadius) + 0.5));
          const downT = Math.max(0, Math.min(1, (forwardNorm / safeDownRadius) + 0.5));
          const sideCurve = Math.pow(sideT, 1.45);
          const downCurve = Math.pow(downT, 1.35);
          array[i] = localLateral + safeCurveSide * sideCurve;
          array[i + 1] = baseY * scaleY - safeCurveDown * downCurve;
          array[i + 2] = localForward;
        }
        attr.needsUpdate = true;
        node.geometry.computeBoundingBox?.();
        node.geometry.computeBoundingSphere?.();
      });
    };
    const pickImportedTextureSlot = (projection, sideTextures, fallbackUrl) => {
      const mode = normalizeImportedProjectionMode(projection);
      if (mode === "side") {
        return String(sideTextures?.side || sideTextures?.surface || fallbackUrl || "");
      }
      if (mode === "back") {
        return String(sideTextures?.back || sideTextures?.surface || fallbackUrl || "");
      }
      return String(sideTextures?.front || sideTextures?.surface || fallbackUrl || "");
    };
    const pickImportedTextureSettings = (projection, sideTextureSettings, fallbackSettings) => {
      const mode = normalizeImportedProjectionMode(projection);
      if (mode === "side") return sideTextureSettings?.side || fallbackSettings;
      if (mode === "back") return sideTextureSettings?.back || fallbackSettings;
      return sideTextureSettings?.front || fallbackSettings;
    };
    const applyImportedModelVisualState = (
      root,
      projection,
      textureUrl,
      textureSettings,
      stateToken
    ) => {
      if (!root) return;
      const mode = normalizeImportedProjectionMode(projection);
      const importedMaterial = getImportedModelMaterial(textureUrl, textureSettings);
      root.traverse((node) => {
        if (!node?.isMesh || !node.geometry) return;
        if (!node.userData) node.userData = {};
        if (node.userData.importedVisualToken === stateToken) return;
        if (importedMaterial) {
          ensureImportedOriginalUvBackup(node.geometry);
          remapUvByViewProjection(node.geometry, mode);
          node.material = importedMaterial;
        } else {
          restoreImportedOriginalUv(node.geometry);
          if (node.userData.originalImportedMaterial) node.material = node.userData.originalImportedMaterial;
        }
        node.userData.importedVisualToken = stateToken;
      });
    };
    const getProceduralMaterial = (url, settings) => {
      const safe = String(url || "").trim();
      if (!safe) return proceduralFallbackMaterial;
      const resolved = resolveSceneUploadUrl(safe);
      if (!resolved) return proceduralFallbackMaterial;
      if (!proceduralTextureBaseCache.has(safe)) {
        try {
          const texture = textureLoader.load(resolved);
          texture.colorSpace = THREE.SRGBColorSpace;
          proceduralTextureBaseCache.set(safe, texture);
        } catch {
          return proceduralFallbackMaterial;
        }
      }
      const baseTexture = proceduralTextureBaseCache.get(safe);
      if (!baseTexture) return proceduralFallbackMaterial;
      const variantTexture = baseTexture.clone();
      applyProceduralTextureSettings(variantTexture, settings);
      return new THREE.MeshStandardMaterial({
        map: variantTexture,
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.05,
      });
    };
    const buildProceduralGeometry = (primitive, entry, override) => {
      const weldVertices = !!(override?.weld_vertices ?? entry?.weld_vertices);
      const width = toProceduralNumber(override?.width ?? entry?.width, 1.8, 0.05, 120);
      const height = toProceduralNumber(override?.height ?? entry?.height, 1.2, 0.05, 120);
      const depth = toProceduralNumber(override?.depth ?? entry?.depth, 1.4, 0.05, 120);
      const radiusTop = toProceduralNumber(override?.radius_top ?? entry?.radius_top, 0.7, 0.02, 120);
      const radiusBottom = toProceduralNumber(override?.radius_bottom ?? entry?.radius_bottom, 0.9, 0.02, 120);
      const widthSegments = toProceduralInt(override?.width_segments ?? entry?.width_segments, 1, 1, 24);
      const heightSegments = toProceduralInt(override?.height_segments ?? entry?.height_segments, 1, 1, 24);
      const depthSegments = toProceduralInt(override?.depth_segments ?? entry?.depth_segments, 1, 1, 24);
      const radialSegments = toProceduralInt(override?.radial_segments ?? entry?.radial_segments, 8, 3, 48);
      const weldByPosition = (geometry) => {
        if (!weldVertices) return geometry;
        geometry.deleteAttribute("normal");
        geometry.deleteAttribute("uv");
        return mergeVerticesWhenReady(geometry, 1e-4);
      };
      if (primitive === "cylinder") {
        return weldByPosition(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, false));
      }
      if (primitive === "plane") {
        return weldByPosition(new THREE.PlaneGeometry(width, height, widthSegments, heightSegments));
      }
      if (primitive === "sphere") {
        const radius = Math.max(width, height, depth) * 0.5;
        return weldByPosition(new THREE.SphereGeometry(radius, Math.max(3, widthSegments), Math.max(2, heightSegments)));
      }
      return weldByPosition(new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments));
    };
    const buildProceduralMaterial = (primitive, textureUrl, sideTextures, textureSettings, sideTextureSettings) => {
      const fallbackUrl = String(textureUrl || "").trim();
      const weldVertices = !!(sideTextures?.__weld_vertices);
      if (weldVertices) {
        return getProceduralMaterial(
          sideTextures?.surface ||
          sideTextures?.side ||
          sideTextures?.front ||
          sideTextures?.px ||
          fallbackUrl,
          textureSettings
        );
      }
      if (primitive === "cylinder") {
        return [
          getProceduralMaterial(sideTextures?.side || fallbackUrl, sideTextureSettings?.side || textureSettings),
          getProceduralMaterial(sideTextures?.top || fallbackUrl, sideTextureSettings?.top || textureSettings),
          getProceduralMaterial(sideTextures?.bottom || fallbackUrl, sideTextureSettings?.bottom || textureSettings),
        ];
      }
      if (primitive === "plane") {
        return getProceduralMaterial(
          sideTextures?.front || sideTextures?.back || fallbackUrl,
          sideTextureSettings?.front || sideTextureSettings?.back || textureSettings
        );
      }
      if (primitive === "sphere") {
        return getProceduralMaterial(sideTextures?.surface || fallbackUrl, sideTextureSettings?.surface || textureSettings);
      }
      return [
        getProceduralMaterial(sideTextures?.px || fallbackUrl, sideTextureSettings?.px || textureSettings),
        getProceduralMaterial(sideTextures?.nx || fallbackUrl, sideTextureSettings?.nx || textureSettings),
        getProceduralMaterial(sideTextures?.py || fallbackUrl, sideTextureSettings?.py || textureSettings),
        getProceduralMaterial(sideTextures?.ny || fallbackUrl, sideTextureSettings?.ny || textureSettings),
        getProceduralMaterial(sideTextures?.pz || fallbackUrl, sideTextureSettings?.pz || textureSettings),
        getProceduralMaterial(sideTextures?.nz || fallbackUrl, sideTextureSettings?.nz || textureSettings),
      ];
    };
    const normalizeProceduralOffsets = (rawOffsets) => {
      const source = rawOffsets && typeof rawOffsets === "object" ? rawOffsets : {};
      const out = {};
      Object.entries(source).forEach(([k, v]) => {
        const idx = Math.floor(Number(k));
        const val = Number(v);
        if (!Number.isFinite(idx) || idx < 0) return;
        if (!Number.isFinite(val)) return;
        if (Math.abs(val) < 0.00001) return;
        out[String(idx)] = Math.max(-40, Math.min(40, val));
      });
      return out;
    };
    const normalizeProceduralVertexColors = (rawColors) => {
      const source = rawColors && typeof rawColors === "object" ? rawColors : {};
      const out = {};
      Object.entries(source).forEach(([k, v]) => {
        const idx = Math.floor(Number(k));
        if (!Number.isFinite(idx) || idx < 0) return;
        let value = v;
        if (typeof value === "string") {
          const hex = value.trim().replace(/^#/, "");
          if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
          value = Number.parseInt(hex, 16);
        }
        const colorInt = Math.floor(Number(value));
        if (!Number.isFinite(colorInt)) return;
        out[String(idx)] = Math.max(0, Math.min(0xffffff, colorInt));
      });
      return out;
    };
    const applyProceduralVertexColorsToGeometry = (geometry, colorMap) => {
      if (!geometry?.attributes?.position) return;
      const attr = geometry.attributes.position;
      const count = Math.floor(attr.array.length / 3);
      const colorArray = new Float32Array(count * 3);
      colorArray.fill(1);
      const normalized = normalizeProceduralVertexColors(colorMap);
      Object.entries(normalized).forEach(([idxRaw, colorRaw]) => {
        const idx = Number(idxRaw);
        const ci = idx * 3;
        if (ci < 0 || ci + 2 >= colorArray.length) return;
        const c = new THREE.Color(Number(colorRaw) || 0xffffff);
        colorArray[ci] = c.r;
        colorArray[ci + 1] = c.g;
        colorArray[ci + 2] = c.b;
      });
      geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
      geometry.attributes.color.needsUpdate = true;
      geometry.userData = geometry.userData || {};
      geometry.userData.proceduralVertexColors = normalized;
    };
    const applyProceduralOffsetsToGeometry = (geometry, offsets) => {
      if (!geometry?.attributes?.position) return;
      const attr = geometry.attributes.position;
      geometry.computeVertexNormals();
      const normalAttr = geometry.attributes.normal;
      if (!normalAttr) return;
      const base = new Float32Array(attr.array.length);
      base.set(attr.array);
      const baseNormals = new Float32Array(normalAttr.array.length);
      baseNormals.set(normalAttr.array);
      const normalized = normalizeProceduralOffsets(offsets);
      Object.entries(normalized).forEach(([idxRaw, deltaY]) => {
        const idx = Number(idxRaw);
        const ai = idx * 3;
        if (ai < 0 || ai + 2 >= attr.array.length) return;
        const amount = Number(deltaY);
        attr.array[ai] = base[ai] + baseNormals[ai] * amount;
        attr.array[ai + 1] = base[ai + 1] + baseNormals[ai + 1] * amount;
        attr.array[ai + 2] = base[ai + 2] + baseNormals[ai + 2] * amount;
      });
      attr.needsUpdate = true;
      geometry.computeVertexNormals();
      remapUvByBoxProjection(geometry);
      geometry.userData = geometry.userData || {};
      geometry.userData.basePositions = base;
      geometry.userData.baseNormals = baseNormals;
    };
    const applyBrushToProceduralMesh = (mesh, localPoint, tool, radius, strength, invert = false) => {
      if (!mesh?.isMesh || !mesh.userData?.isProcedural) return null;
      const geometry = mesh.geometry;
      const attr = geometry?.attributes?.position;
      const base = geometry?.userData?.basePositions;
      if (!attr || !base) return null;
      const vertexCount = Math.floor(attr.array.length / 3);
      const nextOffsets = {
        ...normalizeProceduralOffsets(mesh.userData?.proceduralOffsets),
      };
      let smoothTarget = 0;
      let smoothWeight = 0;
      if (tool === "smooth") {
        for (let i = 0; i < vertexCount; i += 1) {
          const ai = i * 3;
          const bx = base[ai];
          const by = base[ai + 1];
          const bz = base[ai + 2];
          const distance = Math.hypot(bx - localPoint.x, by - localPoint.y, bz - localPoint.z);
          if (distance > radius) continue;
          const falloff = 1 - distance / radius;
          const eased = falloff * falloff * (3 - 2 * falloff);
          smoothTarget += Number(nextOffsets[String(i)] || 0) * eased;
          smoothWeight += eased;
        }
        smoothTarget = smoothWeight > 0.000001 ? smoothTarget / smoothWeight : 0;
      }
      const sign = invert ? -1 : 1;
      let changed = false;
      for (let i = 0; i < vertexCount; i += 1) {
        const ai = i * 3;
        const bx = base[ai];
        const by = base[ai + 1];
        const bz = base[ai + 2];
        const dx = bx - localPoint.x;
        const dy = by - localPoint.y;
        const dz = bz - localPoint.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance > radius) continue;
        const falloff = 1 - distance / radius;
        const eased = falloff * falloff * (3 - 2 * falloff);
        const current = Number(nextOffsets[String(i)] || 0);
        let next = current;
        if (tool === "sculpt") {
          next = current + strength * eased * sign;
        } else if (tool === "flatten") {
          if (sign > 0) next = THREE.MathUtils.lerp(current, 0, Math.min(1, 0.14 + eased * 0.42));
          else next = current + strength * 0.75 * eased;
        } else if (tool === "inflate") {
          next = current + strength * 1.15 * eased * sign;
        } else if (tool === "pinch") {
          next = current - strength * 0.95 * eased * sign;
        } else if (tool === "smooth") {
          if (sign > 0) next = THREE.MathUtils.lerp(current, smoothTarget, Math.min(1, 0.16 + eased * 0.44));
          else next = current + (current - smoothTarget) * Math.min(0.45, 0.12 + eased * 0.28);
        }
        next = Math.max(-40, Math.min(40, next));
        if (Math.abs(next) < 0.00001) {
          if (String(i) in nextOffsets) {
            delete nextOffsets[String(i)];
            changed = true;
          }
          attr.array[ai + 1] = by;
          continue;
        }
        if (Math.abs(next - current) > 0.000001) changed = true;
        nextOffsets[String(i)] = next;
        attr.array[ai + 1] = by + next;
      }
      if (!changed) return null;
      attr.needsUpdate = true;
      geometry.computeVertexNormals();
      mesh.userData.proceduralOffsets = nextOffsets;
      return nextOffsets;
    };
    const applyPaintToProceduralMesh = (mesh, localPoint, radius, paintColor, invert = false) => {
      if (!mesh?.isMesh || !mesh.userData?.isProcedural) return null;
      const geometry = mesh.geometry;
      const attr = geometry?.attributes?.position;
      if (!attr) return null;
      const colorRaw = String(paintColor || "#9ca3af").trim().replace(/^#/, "");
      const paintInt = /^[0-9a-fA-F]{6}$/.test(colorRaw) ? Number.parseInt(colorRaw, 16) : 0x9ca3af;
      const nextColors = {
        ...normalizeProceduralVertexColors(mesh.userData?.proceduralVertexColors),
      };
      const vertexCount = Math.floor(attr.array.length / 3);
      let changed = false;
      for (let i = 0; i < vertexCount; i += 1) {
        const ai = i * 3;
        const bx = attr.array[ai];
        const by = attr.array[ai + 1];
        const bz = attr.array[ai + 2];
        const d = Math.hypot(bx - localPoint.x, by - localPoint.y, bz - localPoint.z);
        if (d > radius) continue;
        const key = String(i);
        if (invert) {
          if (key in nextColors) {
            delete nextColors[key];
            changed = true;
          }
        } else if (nextColors[key] !== paintInt) {
          nextColors[key] = paintInt;
          changed = true;
        }
      }
      if (!changed) return null;
      applyProceduralVertexColorsToGeometry(geometry, nextColors);
      mesh.userData.proceduralVertexColors = normalizeProceduralVertexColors(nextColors);
      return mesh.userData.proceduralVertexColors;
    };
    const disposeProceduralGeometry = (mesh) => {
      if (!mesh?.isMesh || !mesh.userData?.isProcedural) return;
      mesh.geometry?.dispose?.();
    };

    const dynamicGroup = new THREE.Group();
    worldGroup.add(dynamicGroup);
    if (dataRef.current.hideEnvironment) {
      scene.background = null;
      horizonMesh.visible = false;
      roadMesh.visible = false;
      roadWearMesh.visible = false;
      shoulderMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      grassMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      sideFillMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      proceduralGrassBlockMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      hazeNearRoadMesh.visible = false;
      hazeMidRoadMesh.visible = false;
      ambientDustGroup.visible = false;
      wheelDustGroup.visible = false;
      roadModelGroup.visible = false;
      vegetationGroup.visible = false;
      edgeVegetationGroup.visible = false;
      treeShadowGroup.visible = false;
      customObjectGroup.visible = false;
    }

    const blockGeometry = new THREE.BoxGeometry(0.5, 0.28, 0.32);
    const obstacleGeometry = new THREE.BoxGeometry(0.7, 0.9, 0.7);
    const elevatedRampGeometry = new THREE.BoxGeometry(8.1, 0.28, 1);
    const elevatedFlatGeometry = new THREE.BoxGeometry(8.1, 0.28, 1);
    const powerCrateSparkGeometry = new THREE.SphereGeometry(0.06, 10, 10);
    const powerCrateAuraTexture = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
      gradient.addColorStop(0, "rgba(255,245,180,0.95)");
      gradient.addColorStop(0.28, "rgba(255,188,56,0.75)");
      gradient.addColorStop(0.62, "rgba(251,146,60,0.28)");
      gradient.addColorStop(1, "rgba(251,146,60,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();
    const obstacleSpriteMaterial = obstacleTexture
      ? new THREE.SpriteMaterial({
          map: obstacleTexture,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.08,
        })
      : null;
    const impactGeometry = new THREE.RingGeometry(0.18, 0.43, 20);
    impactGeometry.rotateX(-Math.PI / 2);
    const elevatedSegmentPalette = {
      bridge_wood: { color: 0x8b5a2b, emissive: 0x3f2410 },
      stone_ruin: { color: 0x8892a0, emissive: 0x2c3440 },
      giant_log: { color: 0x7c4a23, emissive: 0x31190a },
    };

    const blockMap = new Map();
    const powerBoxMap = new Map();
    const powerBreakMap = new Map();
    const obstacleMap = new Map();
    const impactMap = new Map();
    const elevatedSegmentMap = new Map();
    const powerCrateVisualState = {
      loading: false,
      ready: false,
      failed: false,
      template: null,
      warmed: false,
    };
    ensurePowerCrateTemplate();

    const animateRefs = {
      rafId: 0,
      lastTs: 0,
      lastRenderTs: 0,
      introStartTs: 0,
      collisionStartTs: 0,
      pitCollisionStartRealTs: 0,
      sceneMs: 0,
      lowPerfHeavyFrame: false,
      smoothedGameplayTargetX: 0,
      smoothedGameplayLookX: 0,
      lastCameraResetToken: cameraResetToken,
      lastConveyorOffset: Number(devConveyorOffset) || 0,
      lastRunnerStatus: "",
      loadoutCharacterYaw: 0,
      loadoutCharacterYawTarget: 0,
      roadDeformInitialized: false,
      roadDeformCounter: 0,
      lastRoadSurfaceFlow: 0,
      lastRoadSurfaceZOffset: 0,
      lastRoadSurfaceEvents: null,
      lastRoadSurfaceSelectedFocus: null,
      lastResultChestTapCount: 0,
      lastResultChestShowOnly: false,
      resultChestEntranceStartMs: 0,
      resultChestSpinQueue: 0,
      resultChestSpinDurationMs: 560,
      resultChestSpinElapsedMs: 0,
      resultChestSpinBaseRotationY: 0,
      pitFallCameraStartX: 0,
      pitFallCameraStartY: 0,
      pitFallCameraStartZ: 0,
      pitFallLookStartX: 0,
      pitFallLookStartY: 0,
      pitFallLookStartZ: 0,
      pitFallFocusX: 0,
      pitFallFocusZ: 0,
    };
    const playerViewCameraPos = new THREE.Vector3();
    const playerViewCameraLook = new THREE.Vector3();
    const pitFallCameraLookCapture = new THREE.Vector3();
    const roadFlowState = { value: 0 };
    const pickRaycaster = new THREE.Raycaster();
    const pickPointerNdc = new THREE.Vector2();
    const pickFallbackWorld = new THREE.Vector3();
    const pickFallbackNdc = new THREE.Vector3();
    const pickCameraWorld = new THREE.Vector3();
    const pickWorldScale = new THREE.Vector3();
    const pickLowPriorityTypes = new Set(["road", "horizon"]);
    const alphaSampleCache = new WeakMap();

    const getOverrideFor = (state, key) => {
      if (!key) return null;
      const overrides = state?.sceneConfig?.object_overrides || {};
      const drafts = state?.devDraftOverrides || {};
      const raw = overrides[key] && typeof overrides[key] === "object" ? overrides[key] : null;
      const draft = drafts[key] && typeof drafts[key] === "object" ? drafts[key] : null;
      if (raw && draft) return { ...raw, ...draft };
      return draft || raw || null;
    };
    const isHiddenByOverride = (state, key) => {
      const override = getOverrideFor(state, key);
      return !!override?.hidden;
    };
    const readRoadSculpt = (state) => {
      const base = getOverrideFor(state, "road_base") || {};
      const draft = state?.devRoadSculpt && typeof state.devRoadSculpt === "object" ? state.devRoadSculpt : {};
      const src = { ...base, ...draft };
      const toNum = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      return {
        depthScale: toNum(src.depthScale ?? src.road_depth_scale, 1, 0.6, 12),
        curveExtra: toNum(src.curveExtra ?? src.road_curve_extra, 0, -140, 140),
        curveGlobal: toNum(src.curveGlobal ?? src.road_curve_global, 0, -180, 180),
        curveStartZ: toNum(src.curveStartZ ?? src.road_curve_start_z, -38, -120, -4),
        curveFadeZ: toNum(src.curveFadeZ ?? src.road_curve_fade_z, 30, 2, 120),
        dropExtra: toNum(src.dropExtra ?? src.road_drop_extra, 0, -12, 12),
        gradeGlobal: toNum(src.gradeGlobal ?? src.road_grade_global, 0, -40, 40),
        gradeHorizonBoost: toNum(src.gradeHorizonBoost ?? src.road_grade_horizon_boost, 0, -200, 200),
        dropStartZ: toNum(src.dropStartZ ?? src.road_drop_start_z, -44, -120, -4),
        dropFadeZ: toNum(src.dropFadeZ ?? src.road_drop_fade_z, 34, 2, 120),
      };
    };
    const readRoadEvents = (state, includeDisabled = false) => {
      const base = getOverrideFor(state, "road_base") || {};
      const draft = Array.isArray(state?.devRoadEvents) ? state.devRoadEvents : null;
      const source = draft || base?.road_events || [];
      const toNum = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      const normalized = (Array.isArray(source) ? source : [])
        .map((entry, idx) => {
          const typeRaw = String(entry?.type || "curve").toLowerCase();
          const type = typeRaw === "grade" || typeRaw === "drop" || typeRaw === "curve" ? typeRaw : "curve";
          return {
            id: String(entry?.id || `evt_${idx}`),
            type,
            enabled: entry?.enabled !== false,
            strength: toNum(entry?.strength, type === "curve" ? 18 : 6, -180, 180),
            startZ: toNum(entry?.startZ, -34, ROAD_EVENT_START_Z_MIN, ROAD_EVENT_START_Z_MAX),
            length: toNum(entry?.length, 24, 4, 160),
            loopEnabled: entry?.loopEnabled === true || entry?.loop_enabled === true,
            loopEverySeconds: toNum(entry?.loopEverySeconds ?? entry?.loop_every_seconds, 9, 1.5, 120),
          };
        });
      return includeDisabled ? normalized : normalized.filter((event) => event.enabled);
    };
    const readMapCycleLength = (state) => {
      const base = getOverrideFor(state, "road_base") || {};
      const raw = Number(base?.map_cycle_length);
      if (!Number.isFinite(raw)) return 0;
      return Math.max(80, Math.min(5000, raw));
    };
    const readHorizonStyle = (state) => {
      const override = getOverrideFor(state, "horizon") || {};
      const roadSculpt = readRoadSculpt(state);
      const toNum = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      const visualGrade =
        Math.max(-28, Math.min(28, Number(roadSculpt.gradeGlobal || 0) * 0.18 + Number(roadSculpt.dropExtra || 0) * 0.55)) +
        Math.max(-22, Math.min(22, Number(roadSculpt.gradeHorizonBoost || 0) * 0.04));
      const depthVisual = Math.max(-8, Math.min(18, (Number(roadSculpt.depthScale || 1) - 1) * 2.8));
      return {
        curveSide: toNum(
          override.horizon_curve_side ?? override.curve_side,
          12,
          -42,
          42
        ),
        curveDown: toNum(
          override.horizon_curve_down ?? override.curve_down,
          3.2,
          -18,
          22
        ) + depthVisual * 0.22,
        visualGrade: visualGrade + depthVisual * 0.35,
      };
    };
    const applyHorizonShape = (geometry, basePositions, style) => {
      const attr = geometry?.attributes?.position;
      if (!attr) return;
      const array = attr.array;
      const halfW = HORIZON_WIDTH * 0.5;
      const sideForward = Number(style?.curveSide || 0);
      const sideDown = Number(style?.curveDown || 0);
      for (let i = 0; i < array.length; i += 3) {
        const baseX = basePositions[i];
        const baseY = basePositions[i + 1];
        const baseZ = basePositions[i + 2];
        const xn = Math.abs(baseX) / Math.max(1, halfW);
        const sideCurve = Math.pow(xn, 1.78);
        array[i] = baseX;
        // Positive curveSide bends sides toward camera ("para frente").
        array[i + 2] = baseZ + sideForward * sideCurve;
        array[i + 1] = baseY - sideDown * Math.pow(xn, 1.48);
      }
      attr.needsUpdate = true;
    };
    const findRoadEventById = (state, eventId, includeDisabled = true) => {
      const targetId = String(eventId || "");
      if (!targetId) return null;
      const events = readRoadEvents(state, includeDisabled);
      return events.find((event) => String(event.id || "") === targetId) || null;
    };
    const getSelectedRoadEventFocus = (state) => {
      if (!(state?.mode === "challenge" && state?.showGuides)) return null;
      if (String(state?.devStageEditMode || "conveyor") === "map" || String(state?.devStageEditMode || "conveyor") === "full_map") return null;
      const isRunning = String(state?.runnerState?.status || "") === "running";
      const isPaused = !!state?.isPaused;
      // Keep gameplay normal while actively running. In editor pause mode, allow focus.
      if (isRunning && !isPaused) return null;
      const selectedId = String(state?.devSelectedRoadEventId || "");
      if (!selectedId) return null;
      const selectedEvent = findRoadEventById(state, selectedId, true);
      if (!selectedEvent) return null;
      const focusStartZ = -18;
      const focusFlow = focusStartZ - Number(selectedEvent.startZ || -34);
      return { id: selectedId, flow: focusFlow };
    };
    const resolveEventFlowForRender = (event, fallbackFlow, selectedFocus = null) => {
      const eventId = String(event?.id || "");
      if (selectedFocus && eventId && selectedFocus.id === eventId) return Number(selectedFocus.flow || 0);
      return Number(fallbackFlow || 0);
    };
    const getPreviewFlowContext = (state, fallbackFlow = 0) => {
      const cycleLength = readMapCycleLength(state);
      if (String(state?.devStageEditMode || "conveyor") === "map" || String(state?.devStageEditMode || "conveyor") === "full_map") {
        const mapCursor = Number(state?.devMapCursorZ || 0);
        const gameplayFlow = Number(fallbackFlow || 0);
        const previewFlow = gameplayFlow + mapCursor;
        return { flow: previewFlow, zOffset: 0 };
      }
      const selectedFocus = getSelectedRoadEventFocus(state);
      if (!selectedFocus) {
        return { flow: Number(fallbackFlow || 0), zOffset: 0 };
      }
      const flow = Number(selectedFocus.flow || 0);
      const base = Number(fallbackFlow || 0);
      return { flow, zOffset: flow - base };
    };
    const resolveCycleWrappedValueNear = (value, cycleLength, target, minTarget = -112, maxTarget = 18) => {
      const raw = Number(value || 0);
      const cycle = Number(cycleLength || 0);
      const targetValue = Number(target || 0);
      if (!(cycle > 0) || !Number.isFinite(raw) || !Number.isFinite(targetValue)) return raw;
      let wrapped = raw;
      const nearestK = Math.round((targetValue - raw) / cycle);
      wrapped = raw + nearestK * cycle;
      while (wrapped > maxTarget) wrapped -= cycle;
      while (wrapped <= minTarget) wrapped += cycle;
      const altBehind = wrapped - cycle;
      if (Math.abs(altBehind - targetValue) < Math.abs(wrapped - targetValue) && altBehind > minTarget - cycle) {
        wrapped = altBehind;
      }
      return wrapped;
    };
    const resolveEventFlowShift = (event, flow) => {
      const flowValue = Number(flow || 0);
      if (!event?.loopEnabled) return flowValue;
      const length = Math.max(0.01, Number(event.length) || 24);
      // Keep loop spacing stable in world units so waves do not pop/disappear when speed changes.
      const playerZ = -3.2;
      const startZ = Number(event.startZ || -34);
      // Ensure the event can travel from its start to pass through the player before restarting.
      const passDistance = Math.max(0, playerZ - startZ) + length + 3.5;
      const cycleDistance = Math.max(
        length + 0.8,
        RUNNER_WORLD_Z_SCALE * Math.max(1.5, Number(event.loopEverySeconds) || 9),
        passDistance
      );
      return ((flowValue % cycleDistance) + cycleDistance) % cycleDistance;
    };
    const roadInfluenceAt = (z, startZ, fadeZ, flow = 0, loopEnabled = false, loopEverySeconds = 7) => {
      let start = Number(startZ);
      const length = Math.max(0.01, Number(fadeZ) || 0.01);
      const shiftedFlow = loopEnabled
        ? resolveEventFlowShift({ length, loopEnabled: true, loopEverySeconds }, flow)
        : Number(flow || 0);
      const shiftedZ = z - shiftedFlow;
      const cycleLength = readMapCycleLength(dataRef.current);
      if (!loopEnabled && cycleLength > 0) {
        start = resolveCycleWrappedValueNear(start, cycleLength, shiftedZ, -140, 24);
      }
      const end = start - length;
      if (shiftedZ > start || shiftedZ < end) return 0;
      const t = (start - shiftedZ) / length;
      return Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
    };
    const roadEventContributionAt = (z, events, flow = 0, selectedFocus = null) => {
      const list = Array.isArray(events) ? events : [];
      let curveExtra = 0;
      let dropExtra = 0;
      for (let i = 0; i < list.length; i += 1) {
        const event = list[i];
        const eventFlow = resolveEventFlowForRender(event, flow, selectedFocus);
        const influence = roadInfluenceAt(
          z,
          event.startZ,
          event.length,
          eventFlow,
          event.loopEnabled,
          event.loopEverySeconds
        );
        if (influence <= 0) continue;
        if (event.type === "curve") curveExtra += event.strength * influence;
        else dropExtra += event.strength * influence;
      }
      return { curveExtra, dropExtra };
    };

    const curveOffsetAt = (z, curveValue, roadSculpt = null, flow = 0, roadEvents = null, selectedFocus = null) => {
      const sculpt = roadSculpt || readRoadSculpt(dataRef.current);
      const events = roadEvents || readRoadEvents(dataRef.current);
      const depth = clamp01((-z) / (102 * Math.max(0.6, sculpt.depthScale || 1)));
      const extraInfluence = roadInfluenceAt(z, sculpt.curveStartZ, sculpt.curveFadeZ, flow);
      const eventContribution = roadEventContributionAt(z, events, flow, selectedFocus);
      const globalCurveInfluence = Math.pow(depth, 1.05);
      const curveFinal =
        curveValue +
        sculpt.curveExtra * extraInfluence +
        sculpt.curveGlobal * globalCurveInfluence +
        eventContribution.curveExtra;
      const curveAbs = Math.abs(curveFinal);
      const extremeBoost = 1 + Math.pow(curveAbs / 28, 1.35) * 2.2;
      const base = curveFinal * 0.072 * (0.28 + depth * depth * 2.18) * extremeBoost;
      // Stronger S profile for high intensity curves so horizon can leave frame.
      const sWave = Math.sin(depth * Math.PI * 1.85) * curveFinal * 0.038 * (0.9 + curveAbs / 56);
      return base + sWave;
    };

    const dropAt = (z, roadSculpt = null, flow = 0, roadEvents = null, selectedFocus = null) => {
      const sculpt = roadSculpt || readRoadSculpt(dataRef.current);
      const events = roadEvents || readRoadEvents(dataRef.current);
      const depth = clamp01((-z) / (105 * Math.max(0.6, sculpt.depthScale || 1)));
      const base = -Math.pow(depth, 1.62) * 3.6;
      const extraInfluence = roadInfluenceAt(z, sculpt.dropStartZ, sculpt.dropFadeZ, flow);
      const eventContribution = roadEventContributionAt(z, events, flow, selectedFocus);
      const localEventDrop = eventContribution.dropExtra * extraInfluence * (1.02 - depth * 0.28);
      return base + localEventDrop + getRoadSurfaceYOffset(dataRef.current);
    };

    const laneToX = (lane, z, curveValue, roadSculpt = null, flow = 0, roadEvents = null, selectedFocus = null) => {
      const sculpt = roadSculpt || readRoadSculpt(dataRef.current);
      const depth = clamp01((-z) / (92 * Math.max(0.6, sculpt.depthScale || 1)));
      const laneSpacing = 1.12 + depth * 0.58;
      return curveOffsetAt(z, curveValue, sculpt, flow, roadEvents, selectedFocus) + lane * laneSpacing;
    };

    const rutProfileAt = (x, z, flow, strength = 1) => {
      const zz = z - flow * 0.82;
      const wave = Math.sin(zz * 0.22 + x * 1.7) * 0.018;
      const centerRut = Math.exp(-(x * x) / 1.6) * (0.03 + 0.02 * Math.sin(zz * 0.11));
      const leftTrack = Math.exp(-Math.pow(x + 1.08, 2) / 0.22) * 0.028;
      const rightTrack = Math.exp(-Math.pow(x - 1.08, 2) / 0.22) * 0.028;
      return (-centerRut - leftTrack - rightTrack + wave) * strength;
    };

    const applyRoadDeform = (
      geometry,
      basePositions,
      curveValue,
      roadSculpt,
      flow,
      roadEvents = null,
      selectedFocus = null,
      yBias = 0,
      rutStrength = 1
    ) => {
      const attr = geometry.attributes.position;
      const array = attr.array;
      for (let i = 0; i < array.length; i += 3) {
        const baseX = basePositions[i];
        const baseY = basePositions[i + 1];
        const baseZ = basePositions[i + 2];
        array[i] = baseX + curveOffsetAt(baseZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        array[i + 1] = baseY + dropAt(baseZ, roadSculpt, flow, roadEvents, selectedFocus) + yBias + rutProfileAt(baseX, baseZ, flow, rutStrength);
        array[i + 2] = baseZ;
      }
      attr.needsUpdate = true;
    };
    const buildRoadEdgeOffsetSampler = (basePositions, vertexOffsets) => {
      const normalized = vertexOffsets && typeof vertexOffsets === "object" ? vertexOffsets : {};
      const groups = new Map();
      Object.entries(normalized).forEach(([idxRaw, valueRaw]) => {
        const idx = Number(idxRaw);
        const value = Number(valueRaw);
        if (!Number.isFinite(idx) || !Number.isFinite(value)) return;
        const ai = idx * 3;
        if (ai < 0 || ai + 2 >= basePositions.length) return;
        const key = `${basePositions[ai].toFixed(3)}|${basePositions[ai + 1].toFixed(3)}`;
        const list = groups.get(key) || [];
        list.push({ z: basePositions[ai + 2], value });
        groups.set(key, list);
      });
      groups.forEach((list) => list.sort((a, b) => a.z - b.z));
      return { groups };
    };
    const sampleRoadEdgeOffset = (sampler, baseX, baseY, baseZ, flow) => {
      if (!sampler?.groups?.size) return 0;
      const key = `${baseX.toFixed(3)}|${baseY.toFixed(3)}`;
      const list = sampler.groups.get(key);
      if (!list?.length) return 0;
      const minZ = -106;
      const maxZ = 6;
      const spanZ = maxZ - minZ;
      const flowShift = ((Number(flow) || 0) % spanZ + spanZ) % spanZ;
      const sourceZRaw = baseZ - flowShift;
      const sourceZ = sourceZRaw < minZ ? sourceZRaw + spanZ : sourceZRaw > maxZ ? sourceZRaw - spanZ : sourceZRaw;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < list.length; i += 1) {
        const dz = Math.min(Math.abs(list[i].z - sourceZ), spanZ - Math.abs(list[i].z - sourceZ));
        if (dz < bestDist) {
          bestDist = dz;
          best = list[i].value;
        }
      }
      return bestDist <= 3.6 ? best : 0;
    };
    const applyProceduralGrassEdgeDeform = (
      geometry,
      basePositions,
      curveValue,
      roadSculpt,
      flow,
      roadEvents = null,
      selectedFocus = null,
      vertexOffsetSampler = null
    ) => {
      const attr = geometry.attributes.position;
      const array = attr.array;
      const smoothstep = (edge0, edge1, value) => {
        const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
        return t * t * (3 - 2 * t);
      };
      for (let i = 0; i < array.length; i += 3) {
        const baseX = basePositions[i];
        const baseY = basePositions[i + 1];
        const baseZ = basePositions[i + 2];
        const normalizedY = Math.max(0, Math.min(1, baseY));
        const riseCurve = Math.sin(normalizedY * Math.PI * 0.5);
        const wallBlend = smoothstep(0.04, 0.96, normalizedY);
        const softLift = Math.pow(riseCurve, 1.05) * 0.06;
        const offsetY = sampleRoadEdgeOffset(vertexOffsetSampler, baseX, baseY, baseZ, flow);
        array[i] =
          baseX + curveOffsetAt(baseZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        array[i + 1] =
          baseY +
          dropAt(baseZ, roadSculpt, flow, roadEvents, selectedFocus) +
          rutProfileAt(baseX, baseZ, flow, 0.004) +
          softLift * wallBlend +
          offsetY;
        array[i + 2] = baseZ;
      }
      attr.needsUpdate = true;
    };
    const applyBrushToRoadEdgeMesh = (mesh, localPoint, tool, radius, strength, invert = false) => {
      if (!mesh?.isMesh || !mesh.userData?.isRoadProceduralGrass) return null;
      const geometry = mesh.geometry;
      const attr = geometry?.attributes?.position;
      if (!attr) return null;
      const nextOffsets = {
        ...normalizeProceduralOffsets(mesh.userData?.proceduralOffsets),
      };
      const vertexCount = Math.floor(attr.array.length / 3);
      let smoothTarget = 0;
      let smoothWeight = 0;
      if (tool === "smooth") {
        for (let i = 0; i < vertexCount; i += 1) {
          const ai = i * 3;
          const distance = Math.hypot(
            attr.array[ai] - localPoint.x,
            attr.array[ai + 1] - localPoint.y,
            attr.array[ai + 2] - localPoint.z
          );
          if (distance > radius) continue;
          const falloff = 1 - distance / radius;
          const eased = falloff * falloff * (3 - 2 * falloff);
          smoothTarget += Number(nextOffsets[String(i)] || 0) * eased;
          smoothWeight += eased;
        }
        smoothTarget = smoothWeight > 0.000001 ? smoothTarget / smoothWeight : 0;
      }
      const sign = invert ? -1 : 1;
      let changed = false;
      for (let i = 0; i < vertexCount; i += 1) {
        const ai = i * 3;
        const distance = Math.hypot(
          attr.array[ai] - localPoint.x,
          attr.array[ai + 1] - localPoint.y,
          attr.array[ai + 2] - localPoint.z
        );
        if (distance > radius) continue;
        const falloff = 1 - distance / radius;
        const eased = falloff * falloff * (3 - 2 * falloff);
        const key = String(i);
        const current = Number(nextOffsets[key] || 0);
        let next = current;
        if (tool === "sculpt") next = current + strength * eased * sign;
        else if (tool === "flatten") {
          if (sign > 0) next = THREE.MathUtils.lerp(current, 0, Math.min(1, 0.16 + eased * 0.4));
          else next = current + strength * 0.75 * eased;
        } else if (tool === "inflate") next = current + strength * 1.1 * eased * sign;
        else if (tool === "pinch") next = current - strength * 0.9 * eased * sign;
        else if (tool === "smooth") {
          if (sign > 0) next = THREE.MathUtils.lerp(current, smoothTarget, Math.min(1, 0.18 + eased * 0.42));
          else next = current + (current - smoothTarget) * Math.min(0.45, 0.12 + eased * 0.28);
        }
        next = Math.max(-2.5, Math.min(2.5, next));
        if (Math.abs(next) < 0.00001) {
          if (key in nextOffsets) {
            delete nextOffsets[key];
            changed = true;
          }
          continue;
        }
        if (Math.abs(next - current) > 0.000001) changed = true;
        nextOffsets[key] = next;
      }
      if (!changed) return null;
      mesh.userData.proceduralOffsets = nextOffsets;
      return nextOffsets;
    };

    const syncProceduralEdgeTextures = (roadVisual) => {
      const readTextureAspect = (texture) => {
        const width = texture?.image?.width;
        const height = texture?.image?.height;
        if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 1;
        return Math.max(0.1, width / height);
      };
      const applyTexture = (key, url, material) => {
        const urlKey = key === "wall" ? "wallUrl" : "grassUrl";
        const texKey = key === "wall" ? "wallTexture" : "grassTexture";
        if (proceduralTextureState[urlKey] === url) {
          if (proceduralTextureState[texKey] && material.map !== proceduralTextureState[texKey]) {
            material.map = proceduralTextureState[texKey];
            material.color.setHex(0xffffff);
            material.needsUpdate = true;
          }
          return;
        }
        if (proceduralTextureState[texKey]) {
          proceduralTextureState[texKey].dispose();
          proceduralTextureState[texKey] = null;
        }
        proceduralTextureState[urlKey] = url;
        material.map = null;
        material.color.setHex(key === "wall" ? 0xcdb38d : 0x5fb85d);
        material.needsUpdate = true;
        if (!url) return;
        const texture = textureLoader.load(resolveSceneUploadUrl(url), () => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          texture.repeat.set(1, 1);
          texture.offset.set(0, 0);
          texture.needsUpdate = true;
          material.map = texture;
          material.color.setHex(0xffffff);
          material.needsUpdate = true;
        });
        proceduralTextureState[texKey] = texture;
        material.map = texture;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
      };
      applyTexture("grass", String(roadVisual.proceduralGrassTextureUrl || ""), proceduralGrassMaterial);
      if (!roadVisual.proceduralGrassTextureUrl) proceduralGrassMaterial.color.setHex(0x5fb85d);
      return {
        grassAspect: readTextureAspect(proceduralTextureState.grassTexture),
      };
    };

    const syncRoadModelVisuals = (
      state,
      curveValue,
      roadSculpt,
      flow,
      roadEvents = null,
      selectedFocus = null,
      renderConfig = DEFAULT_SCENE_RENDER
    ) => {
      const roadVisual = readRoadVisualConfig(state);
      const modelUrl = String(roadVisual.roadModelUrl || "");
      const roadHidden = !!isHiddenByOverride(state, "road_base");
      const hideEnvironmentVisuals = !!state?.hideEnvironment;
      const roadModelToken = String(modelUrl || "");
      const roadDistanceCutoff = -Math.abs(renderConfig?.roadDistance ?? DEFAULT_SCENE_RENDER.roadDistance);
      const clearRoadModelBatch = () => {
        roadModelVisualState.parts.forEach((part) => {
          if (!part?.mesh) return;
          roadModelGroup.remove(part.mesh);
          part.mesh.geometry?.dispose?.();
          if (Array.isArray(part.mesh.material)) {
            part.mesh.material.forEach((mat) => mat?.dispose?.());
          } else {
            part.mesh.material?.dispose?.();
          }
        });
        roadModelVisualState.parts = [];
        roadModelVisualState.ready = false;
        roadModelVisualState.count = 0;
      };

      if (hideEnvironmentVisuals || !modelUrl || roadHidden) {
        clearRoadModelBatch();
        roadModelVisualState.token = roadModelToken;
        roadModelVisualState.loading = false;
        roadModelVisualState.template = null;
        roadModelGroup.visible = false;
        return;
      }

      roadModelGroup.visible = true;
      if (roadModelVisualState.token !== roadModelToken) {
        clearRoadModelBatch();
        roadModelVisualState.token = roadModelToken;
        roadModelVisualState.loading = true;
        roadModelVisualState.template = null;
        roadModelVisualState.anchorStartX = 0;
        roadModelVisualState.anchorStartY = 0;
        roadModelVisualState.anchorStartZ = 0;
        roadModelVisualState.measuredLength = 0;
        roadModelVisualState.repeatSpacing = 0;
        roadModelVisualState.autoScaleFactor = 1;
        roadModelVisualState.boundsMinY = 0;
        roadModelVisualState.localForwardYaw = 0;
        loadModelTemplate(modelUrl).then((result) => {
          const template = result?.template || null;
          if (!template || roadModelVisualState.token !== roadModelToken) return;
          roadModelVisualState.template = template;
          roadModelVisualState.loading = false;
          const probe = template.clone(true);
          const bounds = new THREE.Box3().setFromObject(probe);
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          bounds.getCenter(center);
          bounds.getSize(size);
          const startAnchor = findModelAnchorLocalPosition(probe, "START");
          const endAnchor = findModelAnchorLocalPosition(probe, "END");
          const inferredAnchors = inferRoadChunkAnchorsFromBounds(bounds, startAnchor, endAnchor);
          const effectiveStart = inferredAnchors.start;
          const effectiveEnd = inferredAnchors.end;
          const dx = effectiveEnd.x - effectiveStart.x;
          const dz = effectiveEnd.z - effectiveStart.z;
          const horizontalLength = Math.hypot(dx, dz);
          roadModelVisualState.anchorStartX = effectiveStart.x;
          roadModelVisualState.anchorStartY = effectiveStart.y;
          roadModelVisualState.anchorStartZ = effectiveStart.z;
          roadModelVisualState.boundsMinY = bounds.min.y;
          roadModelVisualState.localForwardYaw = horizontalLength > 0.0001 ? Math.atan2(dx, dz) : 0;
          const rawMeasuredLength = Math.max(1, horizontalLength || size.z || size.x || ROAD_LENGTH);
          const canonicalName = getCanonicalSceneAssetName(modelUrl).toLowerCase();
          let autoScaleFactor = 1;
          if (canonicalName === "chunk_road_01.glb") {
            autoScaleFactor = Math.max(0.25, Math.min(40, 32 / rawMeasuredLength));
          } else if (rawMeasuredLength < 4) {
            autoScaleFactor = Math.max(1, Math.min(12, 12 / rawMeasuredLength));
          } else if (rawMeasuredLength > 48) {
            autoScaleFactor = Math.max(0.1, Math.min(1, 24 / rawMeasuredLength));
          }
          roadModelVisualState.autoScaleFactor = autoScaleFactor;
          roadModelVisualState.measuredLength = rawMeasuredLength * autoScaleFactor;
          const axisSpan = Math.max(1, (Math.abs(dx) >= Math.abs(dz) ? size.x : size.z) || rawMeasuredLength);
          roadModelVisualState.repeatSpacing = Math.min(rawMeasuredLength, axisSpan) * autoScaleFactor;
          template.updateWorldMatrix(true, true);
          roadModelRootInverse.copy(template.matrixWorld).invert();
          roadModelBaseOffsetMatrix.makeTranslation(
            -roadModelVisualState.anchorStartX,
            -roadModelVisualState.anchorStartY,
            -roadModelVisualState.anchorStartZ
          );
          const nextParts = [];
          template.traverse((node) => {
            if (!node?.isMesh || !node.geometry || Array.isArray(node.material)) return;
            const geometry = node.geometry.clone();
            const material = normalizeImportedSceneMaterial(node.material);
            material.clippingPlanes = [roadCutoffClipPlane, roadRearClipPlane];
            const instancedMesh = new THREE.InstancedMesh(geometry, material, 64);
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            instancedMesh.castShadow = false;
            instancedMesh.receiveShadow = false;
            instancedMesh.frustumCulled = false;
            assignDevPick(instancedMesh, { key: "road_base", type: "road", label: "Estrada 3D" });
            roadModelPartMatrix.copy(roadModelRootInverse).multiply(node.matrixWorld);
            nextParts.push({
              baseMatrix: roadModelPartMatrix.clone(),
              mesh: instancedMesh,
            });
            roadModelGroup.add(instancedMesh);
          });
          roadModelVisualState.parts = nextParts;
          roadModelVisualState.ready = nextParts.length > 0;
        });
      }

      if (!roadModelVisualState.ready) return;

      const chunkLength = Math.max(
        1,
        roadVisual.roadChunkLength > 0 ? roadVisual.roadChunkLength : roadModelVisualState.measuredLength || ROAD_LENGTH
      );
      const repeatSpacing = Math.max(
        1,
        roadVisual.roadChunkLength > 0 ? roadVisual.roadChunkLength : roadModelVisualState.repeatSpacing || chunkLength
      );
      const showSingleChunkPreview = false;
      const runtimeRepeatEnabled = !showSingleChunkPreview;
      const useRoadChunkDebugPlacement = false;
      const visibleStart = roadDistanceCutoff - repeatSpacing;
      const visibleEnd = Math.max(6, Math.min(12, repeatSpacing * 0.3));
      const roadModelFlow = -flow;
      const normalizedFlow = ((roadModelFlow % repeatSpacing) + repeatSpacing) % repeatSpacing;
      const isDefaultRoadChunk = getCanonicalSceneAssetName(modelUrl).toLowerCase() === "chunk_road_01.glb";
      const repeatingBaseStart =
        Math.floor((visibleStart + normalizedFlow - roadVisual.roadModelZ) / repeatSpacing) * repeatSpacing -
        normalizedFlow +
        roadVisual.roadModelZ;
      const chunkCount = useRoadChunkDebugPlacement
        ? 4
        : runtimeRepeatEnabled
          ? Math.max(3, Math.ceil((visibleEnd - visibleStart) / repeatSpacing) + 2)
          : 1;
      const maxChunkCount = Math.min(64, chunkCount);
      const singleChunkPreviewCenterZ = -18;
      const runtimeRoadModelScale = roadModelVisualState.autoScaleFactor * roadVisual.roadModelScale;
      const defaultChunkPitchCorrection = isDefaultRoadChunk ? toRad(-1.35) : 0;
      const defaultChunkYOffset = isDefaultRoadChunk ? -(runtimeRoadModelScale * 0.42) : 0;
      const manualRotX = toRad(roadVisual.roadModelRotX) + defaultChunkPitchCorrection;
      const manualRotY = toRad(roadVisual.roadModelRotY);
      const manualRotZ = toRad(roadVisual.roadModelRotZ);
      roadModelScale.set(
        runtimeRoadModelScale * roadVisual.roadModelScaleX,
        runtimeRoadModelScale * (isDefaultRoadChunk ? 0.5 : 1) * roadVisual.roadModelScaleY,
        runtimeRoadModelScale * roadVisual.roadModelScaleZ
      );
      roadModelVisualState.parts.forEach((part) => {
        if (part?.mesh) part.mesh.count = 0;
      });
      let visibleChunkCount = 0;
      for (let index = 0; index < maxChunkCount; index += 1) {
        const segmentStart = useRoadChunkDebugPlacement
          ? -repeatSpacing * 1.5 + index * repeatSpacing - normalizedFlow + roadVisual.roadModelZ
          : runtimeRepeatEnabled
            ? repeatingBaseStart + index * repeatSpacing
            : singleChunkPreviewCenterZ - chunkLength * 0.5 + roadVisual.roadModelZ;
        const segmentEnd = segmentStart + chunkLength;
        const segmentVisible = segmentEnd >= roadDistanceCutoff && segmentStart <= visibleEnd + repeatSpacing;
        if (!segmentVisible) continue;
        const sampleStartX = curveOffsetAt(segmentStart, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const sampleStartY = dropAt(segmentStart, roadSculpt, flow, roadEvents, selectedFocus);
        const tangentSampleZ = segmentStart + Math.max(0.6, Math.min(chunkLength * 0.5, 2.2));
        const tangentX = curveOffsetAt(tangentSampleZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const tangentY = dropAt(tangentSampleZ, roadSculpt, flow, roadEvents, selectedFocus);
        const dz = tangentSampleZ - segmentStart;
        const dx = tangentX - sampleStartX;
        const dy = tangentY - sampleStartY;
        const yaw = useRoadChunkDebugPlacement ? 0 : Math.atan2(dx, dz);
        const horizontalLength = Math.max(0.0001, Math.hypot(dx, dz));
        const pitch = useRoadChunkDebugPlacement || isDefaultRoadChunk ? 0 : Math.atan2(dy, horizontalLength);
        roadModelPosition.set(
          sampleStartX + roadVisual.roadModelX,
          sampleStartY + roadVisual.roadModelY + defaultChunkYOffset,
          segmentStart
        );
        roadModelEuler.set(
          manualRotX + pitch,
          yaw - roadModelVisualState.localForwardYaw + manualRotY,
          manualRotZ
        );
        roadModelQuaternion.setFromEuler(roadModelEuler);
        roadModelRootMatrix.compose(roadModelPosition, roadModelQuaternion, roadModelScale);
        roadModelVisualState.parts.forEach((part) => {
          if (!part?.mesh) return;
          roadModelPartMatrix.copy(roadModelRootMatrix).multiply(roadModelBaseOffsetMatrix).multiply(part.baseMatrix);
          part.mesh.setMatrixAt(visibleChunkCount, roadModelPartMatrix);
        });
        visibleChunkCount += 1;
      }
      roadModelVisualState.count = visibleChunkCount;
      roadModelVisualState.parts.forEach((part) => {
        if (!part?.mesh) return;
        part.mesh.count = visibleChunkCount;
        part.mesh.instanceMatrix.needsUpdate = true;
        part.mesh.visible = visibleChunkCount > 0;
      });
      roadModelGroup.visible = visibleChunkCount > 0;
    };

    const syncDynamicMeshes = (
      state,
      curveValue,
      roadSculpt,
      dt,
      flow,
      zOffset = 0,
      roadEvents = null,
      selectedFocus = null,
      obstacleFlow = flow,
      obstacleZOffset = zOffset,
      obstacleRoadEvents = roadEvents,
      obstacleSelectedFocus = selectedFocus,
      sceneRender = DEFAULT_SCENE_RENDER
    ) => {
      const objectDistanceCutoff = -Math.abs(sceneRender?.objectDistance ?? DEFAULT_SCENE_RENDER.objectDistance);
      blockMap.forEach((mesh) => {
        mesh.visible = false;
      });
      powerBoxMap.forEach((mesh) => {
        mesh.visible = false;
      });
      powerBreakMap.forEach((mesh) => {
        mesh.visible = false;
      });
      obstacleMap.forEach((mesh) => {
        mesh.visible = false;
      });
      impactMap.forEach((mesh) => {
        mesh.visible = false;
      });
      elevatedSegmentMap.forEach((entry) => {
        if (entry?.group) entry.group.visible = false;
      });

      if (state.mode === "result" && String(state?.resultCameraVariant || "default") !== "loadout_hero") {
        const resultPhase = String(state?.runnerState?.resultPhase || "arrival");
        const resultShowChestOnly = !!state?.runnerState?.resultShowChestOnly;
        const chestKey = "__result_chest__";
        const burstKey = "__result_chest_burst__";
        if (powerCrateVisualState.ready && !powerCrateVisualState.warmed) {
          warmPowerCrateVisuals();
        } else if (!powerCrateVisualState.ready && !powerCrateVisualState.loading && !powerCrateVisualState.failed) {
          ensurePowerCrateTemplate();
        }
        if (resultShowChestOnly && !animateRefs.lastResultChestShowOnly) {
          animateRefs.resultChestEntranceStartMs = animateRefs.sceneMs || 0;
          animateRefs.resultChestSpinQueue = 0;
          animateRefs.resultChestSpinElapsedMs = 0;
        }
        if (!resultShowChestOnly) {
          animateRefs.resultChestSpinQueue = 0;
          animateRefs.resultChestSpinElapsedMs = 0;
        }
        if (Number(state?.runnerState?.resultChestTapCount || 0) > animateRefs.lastResultChestTapCount) {
          const tapDelta = Number(state?.runnerState?.resultChestTapCount || 0) - animateRefs.lastResultChestTapCount;
          animateRefs.resultChestSpinQueue += tapDelta;
        }
        animateRefs.lastResultChestShowOnly = resultShowChestOnly;
        animateRefs.lastResultChestTapCount = Number(state?.runnerState?.resultChestTapCount || 0);

        let resultChest = powerBoxMap.get(chestKey);
        if (!resultChest) {
          resultChest = powerCrateVisualState.ready ? createPowerCrateInstance() : createResultChestFallback();
          if (resultChest) {
            dynamicGroup.add(resultChest);
            powerBoxMap.set(chestKey, resultChest);
          }
        }
        let resultBurst = powerBreakMap.get(burstKey);
        if (!resultBurst && powerCrateVisualState.ready) {
          resultBurst = createPowerCrateBreakEffect();
          if (resultBurst) {
            dynamicGroup.add(resultBurst);
            powerBreakMap.set(burstKey, resultBurst);
          }
        }

        const chestZ = resultShowChestOnly ? -3.02 : resultPhase === "arrival" ? -2.85 : -3.2;
        const chestGroundY = THREE.MathUtils.clamp(dropAt(chestZ, roadSculpt, flow, roadEvents, selectedFocus), -0.18, 1.12);
        const chestY = 0.52 + chestGroundY;
        const entranceElapsed = Math.max(0, (animateRefs.sceneMs || 0) - (animateRefs.resultChestEntranceStartMs || 0));
        const entranceProgress = resultShowChestOnly ? clamp01(entranceElapsed / 520) : 0;
        const easedEntrance = 1 - Math.pow(1 - entranceProgress, 3);
        const springEntranceRaw = 1 - Math.exp(-6.4 * entranceProgress) * Math.cos(9.2 * entranceProgress);
        const springEntrance = Math.max(0.16, Math.min(1.08, 0.18 + springEntranceRaw * 0.82));
        const chestBob = resultPhase === "opened" ? 0 : Math.sin((animateRefs.sceneMs || 0) * 0.0016) * 0.08;
        if (resultChest && animateRefs.resultChestSpinQueue > 0 && animateRefs.resultChestSpinElapsedMs <= 0) {
          animateRefs.resultChestSpinQueue -= 1;
          animateRefs.resultChestSpinElapsedMs = 0.0001;
          animateRefs.resultChestSpinBaseRotationY = resultChest.rotation.y || 0;
        }
        let spinProgress = 0;
        let spinVelocityFactor = 0;
        if (animateRefs.resultChestSpinElapsedMs > 0) {
          animateRefs.resultChestSpinElapsedMs = Math.min(
            animateRefs.resultChestSpinDurationMs,
            animateRefs.resultChestSpinElapsedMs + dt * 1000
          );
          spinProgress = clamp01(animateRefs.resultChestSpinElapsedMs / animateRefs.resultChestSpinDurationMs);
          spinVelocityFactor = Math.sin(spinProgress * Math.PI);
          if (spinProgress >= 1) {
            animateRefs.resultChestSpinElapsedMs = 0;
          }
        }
        const spinAngle = Math.PI * 4 * (1 - Math.pow(1 - spinProgress, 2.2));
        const spinGlow = clamp01(spinVelocityFactor * 1.1 + animateRefs.resultChestSpinQueue * 0.14);

        if (resultChest) {
          resultChest.visible = resultShowChestOnly && resultPhase !== "burst" && resultPhase !== "opened";
          if (resultChest.visible) {
            const baseScale = resultShowChestOnly ? 1.4 : resultPhase === "arrival" ? 1.46 : 1.38;
            const entryFloat = (1 - easedEntrance) * 0.74 + Math.sin((animateRefs.sceneMs || 0) * 0.0105) * (1 - entranceProgress) * 0.12;
            resultChest.position.set(0, chestY + chestBob + entryFloat, chestZ + (1 - easedEntrance) * 0.34);
            resultChest.rotation.y =
              (animateRefs.resultChestSpinElapsedMs > 0 ? animateRefs.resultChestSpinBaseRotationY + spinAngle : resultChest.rotation.y + dt * 0.03);
            resultChest.rotation.x =
              Math.sin((animateRefs.sceneMs || 0) * 0.0012) * 0.04 +
              (1 - easedEntrance) * 0.08 +
              spinVelocityFactor * 0.06;
            resultChest.rotation.z = Math.sin((animateRefs.sceneMs || 0) * 0.0046) * 0.015 + spinVelocityFactor * 0.04;
            resultChest.scale.set(
              baseScale * springEntrance * (1 + spinVelocityFactor * 0.08),
              baseScale * springEntrance * (1 - spinVelocityFactor * 0.04),
              baseScale * springEntrance * (1 + spinVelocityFactor * 0.03)
            );
            const aura = resultChest.userData?.aura || null;
            if (aura?.material) {
              aura.material.opacity = 0.36 + spinGlow * 0.38 + (1 - entranceProgress) * 0.18;
              aura.scale.setScalar(1.78 + spinGlow * 1 + (1 - entranceProgress) * 0.3);
            }
            const sparks = Array.isArray(resultChest.userData?.sparks) ? resultChest.userData.sparks : [];
            sparks.forEach((entry, idx) => {
              if (!entry?.mesh?.material) return;
              entry.phase += dt * (2.2 + spinGlow * 24 + idx * 0.16);
              entry.mesh.position.set(
                Math.cos(entry.phase) * entry.radius * (0.46 + spinGlow * 0.92),
                0.28 + entry.lift * (0.5 + spinGlow * 0.92),
                Math.sin(entry.phase) * entry.radius * (0.28 + spinGlow * 0.72)
              );
              entry.mesh.scale.set(0.38 + spinGlow * 0.52 + idx * 0.025, 0.14 + spinGlow * 0.12, 1);
              entry.mesh.lookAt(camera.position);
              entry.mesh.material.opacity = 0.18 + spinGlow * 0.74 + (1 - entranceProgress) * 0.12;
            });
          }
        }

        if (resultBurst) {
          resultBurst.visible = resultShowChestOnly && resultPhase === "burst";
          if (resultBurst.visible) {
            resultBurst.position.set(0, chestY + 0.05, chestZ);
            const explode = clamp01(((animateRefs.sceneMs || 0) % 900) / 900);
            const fragments = Array.isArray(resultBurst.userData?.fragments) ? resultBurst.userData.fragments : [];
            fragments.forEach((fragment, idx) => {
              if (!fragment?.node) return;
              const drift = 0.26 + idx * 0.12;
              fragment.node.position.copy(fragment.offset).multiplyScalar(explode * (1.35 + drift));
              fragment.node.position.y += explode * 0.3;
              fragment.node.rotation.x = fragment.rotation.x * explode * 2.1;
              fragment.node.rotation.y = fragment.rotation.y * explode * 2.1;
              fragment.node.rotation.z = fragment.rotation.z * explode * 2.1;
            });
          }
        }
        return;
      }

      // Cenas cinematicas sem objetos de gameplay na pista.
      if (state.mode === "intro") return;

      const activeElevatedSegmentIds = new Set((state.runnerState?.elevatedSegments || []).map((segment) => segment.id));
      elevatedSegmentMap.forEach((entry, key) => {
        if (activeElevatedSegmentIds.has(key)) return;
        if (entry?.group) {
          dynamicGroup.remove(entry.group);
          entry.group.traverse((node) => {
            if (!node?.isMesh) return;
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) {
              node.material.forEach((mat) => mat?.dispose?.());
            } else {
              node.material?.dispose?.();
            }
          });
        }
        elevatedSegmentMap.delete(key);
      });
      (state.runnerState?.elevatedSegments || []).forEach((segment) => {
        if (segment?.hiddenRuntimeVisual) return;
        let entry = elevatedSegmentMap.get(segment.id);
        if (!entry) {
          const palette =
            elevatedSegmentPalette[String(segment.visualType || "")] || elevatedSegmentPalette.bridge_wood;
          const group = new THREE.Group();
          const makePieceMaterial = (emissiveBoost = 0.14) =>
            new THREE.MeshStandardMaterial({
              color: palette.color,
              emissive: palette.emissive,
              emissiveIntensity: emissiveBoost,
              roughness: 0.74,
              metalness: 0.08,
            });
          const entryRamp = new THREE.Mesh(elevatedRampGeometry.clone(), makePieceMaterial(0.12));
          const plateau = new THREE.Mesh(elevatedFlatGeometry.clone(), makePieceMaterial(0.08));
          const exitRamp = new THREE.Mesh(elevatedRampGeometry.clone(), makePieceMaterial(0.12));
          group.add(entryRamp);
          group.add(plateau);
          group.add(exitRamp);
          const railMaterial = makePieceMaterial(0.16);
          const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1), railMaterial);
          const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1), railMaterial.clone());
          group.add(railLeft);
          group.add(railRight);
          const modelGroup = new THREE.Group();
          group.add(modelGroup);
          dynamicGroup.add(group);
          entry = {
            group,
            entryRamp,
            plateau,
            exitRamp,
            railLeft,
            railRight,
            modelGroup,
            modelReady: false,
            modelToken: "",
            modelBounds: { sizeX: 1, sizeY: 1, sizeZ: 1 },
          };
          elevatedSegmentMap.set(segment.id, entry);
        }
        const bridgeAssetUrl = String(segment.assetRefs?.flat || "");
        const bridgeUsesSingleModel =
          String(segment.assetPlacement?.mode || "segmented") === "single_bridge" && !!bridgeAssetUrl;
        if (bridgeUsesSingleModel && entry.modelToken !== bridgeAssetUrl) {
          entry.modelToken = bridgeAssetUrl;
          entry.modelReady = false;
          entry.modelGroup.clear();
          loadModelTemplate(bridgeAssetUrl).then((result) => {
            const template = result?.template || null;
            if (!template || entry.modelToken !== bridgeAssetUrl) return;
            const instance = template.clone(true);
            instance.traverse((node) => {
              if (!node?.isMesh) return;
              node.castShadow = false;
              node.receiveShadow = false;
              if (Array.isArray(node.material)) {
                node.material = node.material.map((mat) => normalizeImportedSceneMaterial(mat));
              } else {
                node.material = normalizeImportedSceneMaterial(node.material);
              }
            });
            const bounds = new THREE.Box3().setFromObject(instance);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bounds.getCenter(center);
            bounds.getSize(size);
            instance.position.set(-center.x, -bounds.min.y, -center.z);
            entry.modelBounds = {
              sizeX: Math.max(0.001, size.x || 1),
              sizeY: Math.max(0.001, size.y || 1),
              sizeZ: Math.max(0.001, size.z || 1),
            };
            entry.modelGroup.add(instance);
            entry.modelReady = true;
          });
        }
        const startWorldZ = 1.3 - (Number(segment.startFlow || 0) - Number(state.runnerState?.worldFlow || 0));
        const plateauStartWorldZ = 1.3 - (Number(segment.plateauStartFlow || 0) - Number(state.runnerState?.worldFlow || 0));
        const descentStartWorldZ = 1.3 - (Number(segment.descentStartFlow || 0) - Number(state.runnerState?.worldFlow || 0));
        const endWorldZ = 1.3 - (Number(segment.endFlow || 0) - Number(state.runnerState?.worldFlow || 0));
        const segmentCenterZ = (startWorldZ + endWorldZ) * 0.5;
        const segmentVisible = endWorldZ >= objectDistanceCutoff && startWorldZ <= 16;
        entry.group.visible = segmentVisible;
        if (!segmentVisible) return;
        const anchorX = laneToX(0, segmentCenterZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const anchorY = dropAt(segmentCenterZ, roadSculpt, flow, roadEvents, selectedFocus);
        entry.group.position.set(anchorX, anchorY, 0);
        entry.group.rotation.set(0, 0, 0);
        const plateauHeight = Number(segment.height || 0);
        const entryLength = Math.max(0.5, Number(segment.entryLength || 12));
        const flatLength = Math.max(0.5, Number(segment.flatLength || 24));
        const exitLength = Math.max(0.5, Number(segment.exitLength || 12));
        const entryCenterZ = (startWorldZ + plateauStartWorldZ) * 0.5;
        const flatCenterZ = (plateauStartWorldZ + descentStartWorldZ) * 0.5;
        const exitCenterZ = (descentStartWorldZ + endWorldZ) * 0.5;
        const entryCenterX = laneToX(0, entryCenterZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus) - anchorX;
        const flatCenterX = laneToX(0, flatCenterZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus) - anchorX;
        const exitCenterX = laneToX(0, exitCenterZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus) - anchorX;
        const entryCenterY = dropAt(entryCenterZ, roadSculpt, flow, roadEvents, selectedFocus) - anchorY;
        const flatCenterY = dropAt(flatCenterZ, roadSculpt, flow, roadEvents, selectedFocus) - anchorY;
        const exitCenterY = dropAt(exitCenterZ, roadSculpt, flow, roadEvents, selectedFocus) - anchorY;
        const entryPitch = -Math.atan2(plateauHeight, Math.max(0.001, entryLength));
        const exitPitch = Math.atan2(plateauHeight, Math.max(0.001, exitLength));
        const totalLength = entryLength + flatLength + exitLength;
        const bridgeUsesModel = bridgeUsesSingleModel && entry.modelReady;
        entry.entryRamp.visible = !bridgeUsesModel;
        entry.plateau.visible = !bridgeUsesModel;
        entry.exitRamp.visible = !bridgeUsesModel;
        entry.entryRamp.position.set(entryCenterX, entryCenterY + plateauHeight * 0.5, entryCenterZ);
        entry.entryRamp.scale.set(1, 1, entryLength);
        entry.entryRamp.rotation.set(entryPitch, 0, 0);
        entry.plateau.position.set(flatCenterX, flatCenterY + plateauHeight, flatCenterZ);
        entry.plateau.scale.set(1, 1, flatLength);
        entry.plateau.rotation.set(0, 0, 0);
        entry.exitRamp.position.set(exitCenterX, exitCenterY + plateauHeight * 0.5, exitCenterZ);
        entry.exitRamp.scale.set(1, 1, exitLength);
        entry.exitRamp.rotation.set(exitPitch, 0, 0);
        const railCenterZ = flatCenterZ;
        const railCenterY = flatCenterY + plateauHeight + 0.22;
        const railSpan = Math.max(10, flatLength + 6);
        const railOffsetX = 3.34;
        if (entry.railLeft) {
          entry.railLeft.visible = String(segment.placeholderProfile || "bridge") === "bridge" && !bridgeUsesModel;
          entry.railLeft.position.set(flatCenterX - railOffsetX, railCenterY, railCenterZ);
          entry.railLeft.scale.set(1, 1, railSpan);
          entry.railLeft.rotation.set(0, 0, 0);
        }
        if (entry.railRight) {
          entry.railRight.visible = String(segment.placeholderProfile || "bridge") === "bridge" && !bridgeUsesModel;
          entry.railRight.position.set(flatCenterX + railOffsetX, railCenterY, railCenterZ);
          entry.railRight.scale.set(1, 1, railSpan);
          entry.railRight.rotation.set(0, 0, 0);
        }
        if (entry.modelGroup) {
          entry.modelGroup.visible = bridgeUsesModel;
          if (bridgeUsesModel) {
            const placement = segment.assetPlacement || {};
            const debugTransform = normalizeElevatedBridgeDebugTransform(
              dataRef.current.elevatedBridgeDebugTransform
            );
            const targetWidth = 7.55;
            const scaleX = (targetWidth / Math.max(0.001, entry.modelBounds.sizeX)) * Number(placement.scaleX || 1);
            const scaleZ = (totalLength / Math.max(0.001, entry.modelBounds.sizeZ)) * Number(placement.scaleZ || 1);
            const scaleY =
              ((scaleX + scaleZ) * 0.5) * Number(placement.scaleY || 1);
            entry.modelGroup.position.set(
              flatCenterX + debugTransform.positionX,
              flatCenterY + plateauHeight + Number(placement.yOffset || 0) + debugTransform.positionY,
              (startWorldZ + endWorldZ) * 0.5 + debugTransform.positionZ
            );
            entry.modelGroup.rotation.set(
              toRad(debugTransform.rotationX),
              Number(placement.rotationY || 0) + toRad(debugTransform.rotationY),
              toRad(debugTransform.rotationZ)
            );
            entry.modelGroup.scale.set(
              scaleX * debugTransform.scaleX,
              scaleY * debugTransform.scaleY,
              scaleZ * debugTransform.scaleZ
            );
          }
        }
      });

      const blockColor = safeColor(state.islandTheme.block, "#34d399");
      state.runnerState.blocks.forEach((block) => {
        let mesh = blockMap.get(block.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            blockGeometry,
            new THREE.MeshStandardMaterial({
              color: blockColor,
              emissive: blockColor,
              emissiveIntensity: 0.38,
              roughness: 0.36,
              metalness: 0.16,
            })
          );
          dynamicGroup.add(mesh);
          blockMap.set(block.id, mesh);
          mesh.userData.positionInitialized = false;
        }
        const logicalZ = -block.z * RUNNER_WORLD_Z_SCALE + 1.6;
        const z = logicalZ + zOffset;
        const withinDistance = z >= objectDistanceCutoff;
        mesh.visible = withinDistance;
        if (!withinDistance) return;
        const x = laneToX(block.lane, z, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const targetY =
          0.34 + block.y * 1.7 + Number(block.trackYOffset || 0) + dropAt(z, roadSculpt, flow, roadEvents, selectedFocus);
        mesh.position.set(x, targetY, z);
        mesh.userData.positionInitialized = true;
        const s = 0.9 + block.y * 0.2;
        mesh.scale.set(s, s, s);
      });

      const activePowerBoxIds = new Set(state.runnerState.powerBoxes.map((box) => box.id));
      powerBoxMap.forEach((mesh, key) => {
        if (activePowerBoxIds.has(key)) return;
        dynamicGroup.remove(mesh);
        mesh.userData?.disposeSelf?.();
        powerBoxMap.delete(key);
      });
      if (powerCrateVisualState.ready && !powerCrateVisualState.warmed) {
        warmPowerCrateVisuals();
      } else if (!powerCrateVisualState.ready && !powerCrateVisualState.loading && !powerCrateVisualState.failed) {
        ensurePowerCrateTemplate();
      }
      if ((state.runnerState.powerBoxes?.length || 0) > 0 && !powerCrateVisualState.ready && !powerCrateVisualState.failed) {
        ensurePowerCrateTemplate();
      }
      state.runnerState.powerBoxes.forEach((box) => {
        let mesh = powerBoxMap.get(box.id);
        const sceneMsNow = animateRefs.sceneMs || 0;
        if (!mesh) {
          if (!powerCrateVisualState.ready) return;
          mesh = createPowerCrateInstance();
          if (!mesh) return;
          dynamicGroup.add(mesh);
          powerBoxMap.set(box.id, mesh);
          mesh.userData.positionInitialized = false;
        }
        const logicalZ = -box.z * RUNNER_WORLD_Z_SCALE + 2.08;
        const z = logicalZ + zOffset;
        const withinDistance = z >= objectDistanceCutoff;
        mesh.visible = withinDistance;
        if (!withinDistance) return;
        const x = laneToX(box.lane, z, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const targetY = 0.3 + Number(box.trackYOffset || 0) + dropAt(z, roadSculpt, flow, roadEvents, selectedFocus);
        mesh.position.set(x, targetY, z);
        mesh.userData.positionInitialized = true;
        mesh.rotation.set(0, Number(box.spin || 0) * 0.08, 0);
        mesh.scale.setScalar(1.28);
        const aura = mesh.userData?.aura || null;
        if (aura) {
          aura.material.opacity = 0.36;
          aura.scale.set(2.4, 2.4, 1);
        }
        const sparks = Array.isArray(mesh.userData?.sparks) ? mesh.userData.sparks : [];
        sparks.forEach((entry, idx) => {
          if (!entry?.mesh) return;
          entry.mesh.position.set(
            Math.cos(entry.phase) * entry.radius * 0.42,
            0.22 + entry.lift * 0.45,
            Math.sin(entry.phase) * entry.radius * 0.42
          );
          entry.mesh.scale.setScalar(0.58 + idx * 0.04);
          entry.mesh.material.opacity = 0.4;
        });
      });

      const activePowerBreakIds = new Set(state.runnerState.powerBreaks.map((entry) => entry.id));
      powerBreakMap.forEach((mesh, key) => {
        if (activePowerBreakIds.has(key)) return;
        dynamicGroup.remove(mesh);
        mesh.userData?.disposeSelf?.();
        powerBreakMap.delete(key);
      });
      state.runnerState.powerBreaks.forEach((entry) => {
        let group = powerBreakMap.get(entry.id);
        if (!group) {
          group = createPowerCrateBreakEffect();
          dynamicGroup.add(group);
          powerBreakMap.set(entry.id, group);
        }
        const logicalZ = -entry.z * RUNNER_WORLD_Z_SCALE + 0.96;
        const z = logicalZ + zOffset;
        const withinDistance = z >= objectDistanceCutoff;
        group.visible = withinDistance;
        if (!withinDistance) return;
        const x = laneToX(entry.lane, z, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        const y = 0.3 + Number(entry.trackYOffset || 0) + dropAt(z, roadSculpt, flow, roadEvents, selectedFocus);
        group.position.set(x, y, z);
        const explode = 1 - clamp01(Number(entry.life || 0));
        const fragments = Array.isArray(group.userData?.fragments) ? group.userData.fragments : [];
        fragments.forEach((fragment, idx) => {
          if (!fragment?.node) return;
          const drift = 0.28 + idx * 0.12;
          fragment.node.position.copy(fragment.offset).multiplyScalar(explode * (1.55 + drift));
          fragment.node.position.y += explode * 0.26;
          fragment.node.rotation.x = fragment.rotation.x * explode * 2.2;
          fragment.node.rotation.y = fragment.rotation.y * explode * 2.2;
          fragment.node.rotation.z = fragment.rotation.z * explode * 2.2;
          fragment.node.scale.setScalar(Math.max(0.12, 0.88 - explode * 0.24 + idx * 0.06));
          fragment.node.traverse((node) => {
            if (!node?.isMesh) return;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => {
              if (!material) return;
              material.transparent = true;
              material.opacity = Math.max(0, 1 - explode * 1.35);
            });
          });
        });
      });

      const obstacleColor = safeColor(state.islandTheme.obstacle, "#f43f5e");
      state.runnerState.obstacles.forEach((obstacle) => {
        let mesh = obstacleMap.get(obstacle.id);
        if (!mesh) {
          if (obstacleSpriteMaterial) {
            mesh = new THREE.Sprite(obstacleSpriteMaterial);
            mesh.center.set(0.5, 0.0);
          } else {
            mesh = new THREE.Mesh(
              obstacleGeometry,
              new THREE.MeshStandardMaterial({
                color: obstacleColor,
                roughness: 0.58,
                metalness: 0.1,
              })
            );
          }
          dynamicGroup.add(mesh);
          obstacleMap.set(obstacle.id, mesh);
          mesh.userData.positionInitialized = false;
        }
        const logicalZ = -obstacle.z * RUNNER_WORLD_Z_SCALE + 1.3;
        const z = logicalZ + obstacleZOffset;
        const withinDistance = z >= objectDistanceCutoff;
        mesh.visible = withinDistance;
        if (!withinDistance) return;
        const x = laneToX(
          obstacle.lane,
          z,
          curveValue,
          roadSculpt,
          obstacleFlow,
          obstacleRoadEvents,
          obstacleSelectedFocus
        );
        if (mesh.isSprite) {
          const tex = mesh.material?.map;
          const imgW = tex?.image?.width || 1024;
          const imgH = tex?.image?.height || 1024;
          const aspect = Math.max(0.45, Math.min(2.4, imgW / Math.max(1, imgH)));
          const h = 1.55;
          mesh.scale.set(h * aspect, h, 1);
          const targetY =
            0.02 + Number(obstacle.trackYOffset || 0) + dropAt(z, roadSculpt, obstacleFlow, obstacleRoadEvents, obstacleSelectedFocus);
          mesh.position.set(x, targetY, z);
          mesh.userData.positionInitialized = true;
        } else {
          const targetY =
            0.5 + Number(obstacle.trackYOffset || 0) + dropAt(z, roadSculpt, obstacleFlow, obstacleRoadEvents, obstacleSelectedFocus);
          mesh.position.set(x, targetY, z);
          mesh.userData.positionInitialized = true;
        }
      });

      state.runnerState.impacts.forEach((impact) => {
        let mesh = impactMap.get(impact.id);
        if (!mesh) {
          const impactColor = impact.kind === "power-break" ? 0xf59e0b : impact.kind === "collect" ? 0x10b981 : 0xfacc15;
          mesh = new THREE.Mesh(
            impactGeometry,
            new THREE.MeshBasicMaterial({
              color: impactColor,
              transparent: true,
              opacity: 0.62,
              side: THREE.DoubleSide,
            })
          );
          dynamicGroup.add(mesh);
          impactMap.set(impact.id, mesh);
        }
        const z = 1.4 + zOffset;
        const withinDistance = z >= objectDistanceCutoff;
        mesh.visible = withinDistance;
        if (!withinDistance) return;
        const x = laneToX(impact.lane, z, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
        mesh.position.set(
          x,
          0.06 + Number(impact.trackYOffset || 0) + dropAt(z, roadSculpt, flow, roadEvents, selectedFocus),
          z
        );
        const scale = 0.85 + (1 - impact.life) * 2.1;
        mesh.scale.set(scale, scale, scale);
        mesh.material.opacity = Math.max(0, impact.life * 0.58);
      });
    };

    const syncCustomObjects = (
      state,
      curveValue,
      roadSculpt,
      flow,
      zOffset = 0,
      roadEvents = null,
      selectedFocus = null,
      sceneRenderConfig = null
    ) => {
      if (!customObjectsEnabled) {
        customObjectInstancedBatches.forEach((batch) => disposeInstancedBatch(batch));
        customObjectInstancedBatches.clear();
        return;
      }
      const effectiveSceneRender = sceneRenderConfig || DEFAULT_SCENE_RENDER;
      const objectDistanceCutoff = -Math.max(18, Math.abs(Number(effectiveSceneRender?.objectDistance || 110)));
      const objectRearCutoffZ = 8;
      const list = Array.isArray(state?.sceneConfig?.custom_objects) ? state.sceneConfig.custom_objects : [];
      const cycleLength = readMapCycleLength(state);
      const activeKeys = new Set();
      const instancedBatchesInUse = new Map();
      const createSpecialSegmentVisuals = (segmentType, profile) => {
        const visuals = {
          type: segmentType,
        };
        const makeDevGuideMaterial = (color, opacity = 0.18, wireframe = false) =>
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            wireframe,
            depthWrite: false,
          });
        const makeDevAnchor = (color) => {
          const anchor = new THREE.Group();
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.72, 28),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.95,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          ring.rotation.x = -Math.PI / 2;
          anchor.add(ring);
          const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.25, 10),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            })
          );
          beam.position.y = 0.62;
          anchor.add(beam);
          const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 12, 12),
            new THREE.MeshBasicMaterial({
              color: 0xf8fafc,
              transparent: true,
              opacity: 0.95,
              depthWrite: false,
            })
          );
          cap.position.y = 1.3;
          anchor.add(cap);
          return anchor;
        };
        if (segmentType === "pit_gap") {
          const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x6b7280,
            roughness: 0.88,
            metalness: 0.04,
          });
          const voidMaterial = new THREE.MeshBasicMaterial({
            color: 0x020617,
            transparent: true,
            opacity: 0.96,
            depthWrite: false,
          });
          visuals.frontEdge = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.26, 1), edgeMaterial);
          visuals.backEdge = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.26, 1), edgeMaterial.clone());
          visuals.voidMesh = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1, 1), voidMaterial);
          visuals.devAnchor = makeDevAnchor(0xf97316);
          visuals.devGapGuide = new THREE.Mesh(
            new THREE.BoxGeometry(7.55, 0.16, 1),
            makeDevGuideMaterial(0xfb923c, 0.28, true)
          );
          visuals.devGapFloor = new THREE.Mesh(
            new THREE.BoxGeometry(7.1, 0.04, 1),
            makeDevGuideMaterial(0xfdba74, 0.12, false)
          );
        } else {
          const baseColor = profile === "wood_bridge" ? 0x8b5a2b : 0x7c6953;
          const railColor = profile === "wood_bridge" ? 0x5b3a1a : 0x475569;
          const makeMaterial = (color, emissiveIntensity = 0.08) =>
            new THREE.MeshStandardMaterial({
              color,
              emissive: new THREE.Color(color).multiplyScalar(0.12),
              emissiveIntensity,
              roughness: 0.82,
              metalness: 0.05,
            });
          visuals.entryRamp = new THREE.Mesh(elevatedRampGeometry.clone(), makeMaterial(baseColor, 0.06));
          visuals.plateau = new THREE.Mesh(elevatedFlatGeometry.clone(), makeMaterial(baseColor, 0.04));
          visuals.exitRamp = new THREE.Mesh(elevatedRampGeometry.clone(), makeMaterial(baseColor, 0.06));
          visuals.railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1), makeMaterial(railColor, 0.1));
          visuals.railRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1), makeMaterial(railColor, 0.1));
          visuals.modelGroup = new THREE.Group();
          visuals.modelReady = false;
          visuals.modelToken = "";
          visuals.modelBounds = { sizeX: 1, sizeY: 1, sizeZ: 1 };
          visuals.devAnchor = makeDevAnchor(0x22d3ee);
          visuals.devEntryGuide = new THREE.Mesh(
            new THREE.BoxGeometry(7.25, 0.16, 1),
            makeDevGuideMaterial(0x22d3ee, 0.26, true)
          );
          visuals.devFlatGuide = new THREE.Mesh(
            new THREE.BoxGeometry(7.25, 0.16, 1),
            makeDevGuideMaterial(0x67e8f9, 0.18, true)
          );
          visuals.devExitGuide = new THREE.Mesh(
            new THREE.BoxGeometry(7.25, 0.16, 1),
            makeDevGuideMaterial(0x22d3ee, 0.26, true)
          );
          visuals.devSurfaceFilm = new THREE.Mesh(
            new THREE.BoxGeometry(7.05, 0.03, 1),
            makeDevGuideMaterial(0xa5f3fc, 0.12, false)
          );
        }
        return visuals;
      };
      const attachSpecialSegmentVisuals = (group, visuals) => {
        if (!group || !visuals) return;
        if (visuals.frontEdge) group.add(visuals.frontEdge);
        if (visuals.backEdge) group.add(visuals.backEdge);
        if (visuals.voidMesh) group.add(visuals.voidMesh);
        if (visuals.entryRamp) group.add(visuals.entryRamp);
        if (visuals.plateau) group.add(visuals.plateau);
        if (visuals.exitRamp) group.add(visuals.exitRamp);
        if (visuals.railLeft) group.add(visuals.railLeft);
        if (visuals.railRight) group.add(visuals.railRight);
        if (visuals.modelGroup) group.add(visuals.modelGroup);
        if (visuals.devAnchor) group.add(visuals.devAnchor);
        if (visuals.devGapGuide) group.add(visuals.devGapGuide);
        if (visuals.devGapFloor) group.add(visuals.devGapFloor);
        if (visuals.devEntryGuide) group.add(visuals.devEntryGuide);
        if (visuals.devFlatGuide) group.add(visuals.devFlatGuide);
        if (visuals.devExitGuide) group.add(visuals.devExitGuide);
        if (visuals.devSurfaceFilm) group.add(visuals.devSurfaceFilm);
      };
      let minFlowSeedZ = Number.POSITIVE_INFINITY;
      list.forEach((entry, index) => {
        const key = String(entry?.key || `custom_${index}`);
        const override = getOverrideFor(state, key);
        const movementMode = String(override?.movement_mode || entry?.movement_mode || "");
        if (movementMode === "anchored") return;
        const seedZ = hasFiniteNumber(override?.z)
          ? toFiniteNumber(override?.z, -10)
          : toFiniteNumber(entry?.z, -10);
        minFlowSeedZ = Math.min(minFlowSeedZ, seedZ);
      });
      if (!Number.isFinite(minFlowSeedZ)) minFlowSeedZ = -118;

      list.forEach((entry, index) => {
        try {
          const key = String(entry?.key || `custom_${index}`);
          const override = getOverrideFor(state, key);
          const proceduralType = String(override?.procedural_type || entry?.procedural_type || "").trim().toLowerCase();
          const objectKind = String(override?.kind || entry?.kind || "custom").trim().toLowerCase();
          const specialSegmentType = String(
            override?.special_segment_type || entry?.special_segment_type || ""
          ).trim().toLowerCase();
          const specialProfile = String(override?.special_profile || entry?.special_profile || "").trim().toLowerCase();
          const textureUrl = String(override?.texture_url || entry?.texture_url || "");
          const modelUrl = String(override?.model_url || entry?.model_url || "");
          const modelName = String(override?.model_name || entry?.model_name || "");
          const mediaType = String(override?.media_type || entry?.media_type || detectAssetTypeFromUrl(modelUrl || textureUrl));
          const sideTextures = {
            ...((entry?.side_textures && typeof entry.side_textures === "object") ? entry.side_textures : {}),
            ...((override?.side_textures && typeof override.side_textures === "object") ? override.side_textures : {}),
          };
          const textureSettings = normalizeProceduralTextureSettings(
            (override?.texture_settings && typeof override.texture_settings === "object")
              ? override.texture_settings
              : entry?.texture_settings
          );
          const sideTextureSettings = {
            ...((entry?.side_texture_settings && typeof entry.side_texture_settings === "object")
              ? entry.side_texture_settings
              : {}),
            ...((override?.side_texture_settings && typeof override.side_texture_settings === "object")
              ? override.side_texture_settings
              : {}),
          };
          const importedTextureProjection = normalizeImportedProjectionMode(
            override?.imported_texture_projection || entry?.imported_texture_projection || "front"
          );
          const importedTextureUrl = pickImportedTextureSlot(importedTextureProjection, sideTextures, textureUrl);
          const importedTextureSettings = normalizeProceduralTextureSettings(
            pickImportedTextureSettings(importedTextureProjection, sideTextureSettings, textureSettings)
          );
          const weldVertices = !!(override?.weld_vertices ?? entry?.weld_vertices);
          const proceduralSideTextures = { ...sideTextures, __weld_vertices: weldVertices };
          const proceduralOffsets = normalizeProceduralOffsets(
            (override?.procedural_vertex_offsets && typeof override.procedural_vertex_offsets === "object")
              ? override.procedural_vertex_offsets
              : entry?.procedural_vertex_offsets
          );
          const proceduralVertexColors = normalizeProceduralVertexColors(
            (override?.procedural_vertex_colors && typeof override.procedural_vertex_colors === "object")
              ? override.procedural_vertex_colors
              : entry?.procedural_vertex_colors
          );
          const isProcedural = mediaType === "procedural" || !!proceduralType;
          const usesModel = mediaType === "model3d" && !!modelUrl;
          const isSpecialSegment = objectKind === "special_segment" && !!specialSegmentType;
          const logicOnlySpecialSegment = !!(override?.logic_only ?? entry?.logic_only);
          const renderSpecialSegmentAsModel =
            isSpecialSegment && specialSegmentType !== "pit_gap" && usesModel;
          if (!textureUrl && !usesModel && !isProcedural && !isSpecialSegment) return;
          activeKeys.add(key);
          let mesh = customObjectMeshes.get(key);
          if (!mesh) {
            if (isSpecialSegment && !renderSpecialSegmentAsModel) {
              mesh = new THREE.Group();
              mesh.userData.isSpecialSegment = true;
              const visuals = createSpecialSegmentVisuals(specialSegmentType, specialProfile);
              attachSpecialSegmentVisuals(mesh, visuals);
              mesh.userData.specialSegmentVisuals = visuals;
            } else if (usesModel) {
              mesh = new THREE.Group();
              mesh.userData.modelRoot = null;
              mesh.add(createModelPlaceholder());
            } else if (isProcedural) {
              const primitive = proceduralType || "box";
              const geometry = buildProceduralGeometry(primitive, entry, override);
              applyProceduralOffsetsToGeometry(geometry, proceduralOffsets);
              applyProceduralVertexColorsToGeometry(geometry, proceduralVertexColors);
              const material = buildProceduralMaterial(
                primitive,
                textureUrl,
                proceduralSideTextures,
                textureSettings,
                sideTextureSettings
              );
              mesh = new THREE.Mesh(geometry, material);
              mesh.userData.isProcedural = true;
            } else {
              const side = Number(entry?.x) < 0 ? -1 : 1;
              const geometry = side < 0 ? vegetationBillboardGeometryRight : vegetationBillboardGeometryLeft;
              const material = getCustomMaterial(textureUrl);
              if (!material) return;
              mesh = new THREE.Mesh(geometry, material);
            }
            mesh.userData.objectKey = key;
            customObjectMeshes.set(key, mesh);
            customObjectGroup.add(mesh);
          } else if (!usesModel && !isProcedural && mesh.isMesh) {
            const currentMaterialUrl = String(mesh.userData.textureUrl || "");
            if (currentMaterialUrl !== textureUrl) {
              const material = getCustomMaterial(textureUrl);
              if (material) mesh.material = material;
            }
          }

          const side = Number(entry?.x) < 0 ? -1 : 1;
          if (isSpecialSegment && !renderSpecialSegmentAsModel) {
            if (!mesh.isGroup || !mesh.userData?.isSpecialSegment) {
              customObjectGroup.remove(mesh);
              const replacement = new THREE.Group();
              replacement.userData = { ...mesh.userData, isSpecialSegment: true };
              const visuals = createSpecialSegmentVisuals(specialSegmentType, specialProfile);
              attachSpecialSegmentVisuals(replacement, visuals);
              replacement.userData.specialSegmentVisuals = visuals;
              customObjectMeshes.set(key, replacement);
              customObjectGroup.add(replacement);
              mesh = replacement;
            }
            if (!mesh.userData?.specialSegmentVisuals) {
              const visuals = createSpecialSegmentVisuals(specialSegmentType, specialProfile);
              attachSpecialSegmentVisuals(mesh, visuals);
              mesh.userData.specialSegmentVisuals = visuals;
            }
          } else if (renderSpecialSegmentAsModel) {
            if (!mesh.isGroup) {
              customObjectGroup.remove(mesh);
              if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
              const replacement = new THREE.Group();
              replacement.userData = {
                ...mesh.userData,
                isSpecialSegment: true,
                specialSegmentVisuals: null,
                modelRoot: null,
              };
              customObjectMeshes.set(key, replacement);
              customObjectGroup.add(replacement);
              mesh = replacement;
            }
            if (!mesh.userData?.specialSegmentVisuals) {
              const visuals = createSpecialSegmentVisuals(specialSegmentType, specialProfile);
              attachSpecialSegmentVisuals(mesh, visuals);
              mesh.userData.specialSegmentVisuals = visuals;
            }
          } else
          if (isProcedural) {
            if (!mesh.isMesh || !mesh.userData?.isProcedural) {
              customObjectGroup.remove(mesh);
              if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
              const primitive = proceduralType || "box";
              const replacementGeometry = buildProceduralGeometry(primitive, entry, override);
              applyProceduralOffsetsToGeometry(replacementGeometry, proceduralOffsets);
              applyProceduralVertexColorsToGeometry(replacementGeometry, proceduralVertexColors);
              const replacement = new THREE.Mesh(
                replacementGeometry,
                buildProceduralMaterial(
                  primitive,
                  textureUrl,
                  proceduralSideTextures,
                  textureSettings,
                  sideTextureSettings
                )
              );
              replacement.userData = { ...mesh.userData, isProcedural: true };
              customObjectMeshes.set(key, replacement);
              customObjectGroup.add(replacement);
              mesh = replacement;
            }
            const primitive = proceduralType || "box";
            const proceduralToken = JSON.stringify({
              primitive,
              width: override?.width ?? entry?.width,
              height: override?.height ?? entry?.height,
              depth: override?.depth ?? entry?.depth,
              radius_top: override?.radius_top ?? entry?.radius_top,
              radius_bottom: override?.radius_bottom ?? entry?.radius_bottom,
              width_segments: override?.width_segments ?? entry?.width_segments,
              height_segments: override?.height_segments ?? entry?.height_segments,
              depth_segments: override?.depth_segments ?? entry?.depth_segments,
              radial_segments: override?.radial_segments ?? entry?.radial_segments,
              weld_vertices: weldVertices,
              texture: textureUrl,
              texture_settings: textureSettings,
              side_textures: sideTextures,
              side_texture_settings: sideTextureSettings,
              offsets: proceduralOffsets,
              colors: proceduralVertexColors,
            });
            if (mesh.userData.proceduralToken !== proceduralToken) {
              disposeProceduralGeometry(mesh);
              const nextGeometry = buildProceduralGeometry(primitive, entry, override);
              applyProceduralOffsetsToGeometry(nextGeometry, proceduralOffsets);
              applyProceduralVertexColorsToGeometry(nextGeometry, proceduralVertexColors);
              mesh.geometry = nextGeometry;
              mesh.material = buildProceduralMaterial(
                primitive,
                textureUrl,
                proceduralSideTextures,
                textureSettings,
                sideTextureSettings
              );
              mesh.userData.proceduralToken = proceduralToken;
            }
            mesh.userData.proceduralOffsets = proceduralOffsets;
            mesh.userData.proceduralVertexColors = proceduralVertexColors;
          } else if (!usesModel) {
            if (!mesh.isMesh) {
              const replacementMaterial = getCustomMaterial(textureUrl);
              if (!replacementMaterial) return;
              customObjectGroup.remove(mesh);
              const replacement = new THREE.Mesh(
                side < 0 ? vegetationBillboardGeometryRight : vegetationBillboardGeometryLeft,
                replacementMaterial
              );
              replacement.userData = { ...mesh.userData };
              customObjectMeshes.set(key, replacement);
              customObjectGroup.add(replacement);
              mesh = replacement;
            }
            const expectedGeometry = side < 0 ? vegetationBillboardGeometryRight : vegetationBillboardGeometryLeft;
            if (mesh.geometry !== expectedGeometry) mesh.geometry = expectedGeometry;
          } else if (!mesh.isGroup) {
            customObjectGroup.remove(mesh);
            if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
            const replacement = new THREE.Group();
            replacement.userData = { ...mesh.userData, modelRoot: null };
            customObjectMeshes.set(key, replacement);
            customObjectGroup.add(replacement);
            mesh = replacement;
          }

          mesh.userData.textureUrl = textureUrl;
          mesh.userData.modelUrl = modelUrl;
          mesh.userData.modelName = modelName;
          mesh.userData.mediaType = mediaType;
          mesh.userData.importedTextureProjection = importedTextureProjection;
          mesh.userData.kind = objectKind;
          mesh.userData.proceduralType = proceduralType || "";
          const movementMode = String(override?.movement_mode || entry?.movement_mode || "");
          const forceAnchoredPreview = String(state?.devStageEditMode || "conveyor") === "map";
          const shouldFlow = !forceAnchoredPreview && movementMode !== "anchored";
          const ox = hasFiniteNumber(override?.x) ? toFiniteNumber(override?.x, 0) : toFiniteNumber(entry?.x, 0);
          const xMode = String(override?.x_mode || entry?.x_mode || "relative_curve");
          const oy = hasFiniteNumber(override?.y) ? toFiniteNumber(override?.y, 0) : toFiniteNumber(entry?.y, 0);
          const yMode = String(override?.y_mode || entry?.y_mode || "relative_ground");
          const seedZ = hasFiniteNumber(override?.z) ? toFiniteNumber(override?.z, -10) : toFiniteNumber(entry?.z, -10);
          if (shouldFlow) {
            const flowSeedToken = String(seedZ.toFixed(3));
            if (mesh.userData.flowSeedToken !== flowSeedToken || !Number.isFinite(mesh.userData.z)) {
              mesh.userData.z = seedZ;
              mesh.userData.flowSeedToken = flowSeedToken;
              mesh.userData.lastRoadFlow = roadFlowState.value;
            }
            const flowDelta = roadFlowState.value - (Number(mesh.userData.lastRoadFlow) || 0);
            mesh.userData.lastRoadFlow = roadFlowState.value;
            mesh.userData.z += flowDelta;
            if (mesh.userData.z > 9) {
              mesh.userData.z = minFlowSeedZ - (2.2 + Math.random() * 3.6);
            }
            const z = mesh.userData.z + zOffset;
            const worldX =
              xMode === "relative_curve"
                ? curveOffsetAt(z, curveValue, roadSculpt, flow, roadEvents, selectedFocus) + ox
                : ox;
            const worldY =
              yMode === "relative_ground"
                ? dropAt(z, roadSculpt, flow, roadEvents, selectedFocus) + oy
                : oy;
            mesh.position.set(worldX, worldY, z);
          } else {
            mesh.userData.lastRoadFlow = roadFlowState.value;
            const rawZ = seedZ + Number(flow || 0) + zOffset;
            const z = resolveCycleWrappedValueNear(rawZ, cycleLength, -36, -140, 24);
            const worldX =
              xMode === "relative_curve"
                ? curveOffsetAt(z, curveValue, roadSculpt, flow, roadEvents, selectedFocus) + ox
                : ox;
            const worldY =
              yMode === "relative_ground"
                ? dropAt(z, roadSculpt, flow, roadEvents, selectedFocus) + oy
                : oy;
            mesh.position.set(worldX, worldY, z);
          }
          const meshZ = Number(mesh.position.z) || 0;
          const withinDistance = meshZ >= objectDistanceCutoff && meshZ <= objectRearCutoffZ;
          const entryScale = Math.max(0.1, toFiniteNumber(entry?.scale, 1));
          const overrideScale = Math.max(0.1, toFiniteNumber(override?.scale, 1));
          const scaleX = Math.max(0.1, toFiniteNumber(override?.scale_x, 1));
          const scaleY = Math.max(0.1, toFiniteNumber(override?.scale_y, 1));
          const scaleZ = Math.max(0.1, toFiniteNumber(override?.scale_z, 1));
          const pieceCurveSide = toFiniteNumber(override?.model_curve_side, 0);
          const pieceCurveDown = toFiniteNumber(override?.model_curve_down, 0);
          const pieceCurveSideRadius = Math.max(0.15, toFiniteNumber(override?.model_curve_side_radius, 1));
          const pieceCurveDownRadius = Math.max(0.15, toFiniteNumber(override?.model_curve_down_radius, 1));
          const manualRotX = toRad(toFiniteNumber(override?.rotation_x, entry?.rotation_x || 0));
          const manualRotY = toRad(toFiniteNumber(override?.rotation_y, entry?.rotation_y || 0));
          const manualRotZ = toRad(toFiniteNumber(override?.rotation_z, entry?.rotation_z || 0));
          if (isSpecialSegment && !renderSpecialSegmentAsModel) {
            const segmentHeightBase = Math.max(0.02, toFiniteNumber(override?.segment_height, entry?.segment_height || 1.18));
            const logicOffsetZ = toFiniteNumber(override?.segment_logic_offset_z, entry?.segment_logic_offset_z || 0);
            const logicHeightOffset = toFiniteNumber(
              override?.segment_logic_height_offset,
              entry?.segment_logic_height_offset || 0
            );
            const logicWidth = Math.max(0.05, toFiniteNumber(override?.segment_logic_width, entry?.segment_logic_width || 7.25));
            const segmentHeight = Math.max(0.02, segmentHeightBase + logicHeightOffset);
            const entryLength = Math.max(0.05, toFiniteNumber(override?.segment_entry_length, entry?.segment_entry_length || 16));
            const flatLength = Math.max(0.05, toFiniteNumber(override?.segment_flat_length, entry?.segment_flat_length || 20));
            const exitLength = Math.max(0.05, toFiniteNumber(override?.segment_exit_length, entry?.segment_exit_length || 16));
            const gapLength = Math.max(0.05, toFiniteNumber(override?.segment_gap_length, entry?.segment_gap_length || 7.5));
            const dropDepth = Math.max(0.4, toFiniteNumber(override?.segment_drop_depth, entry?.segment_drop_depth || 2.4));
            const totalLength = entryLength + flatLength + exitLength;
            const uniformScale = entryScale * overrideScale;
            mesh.scale.set(uniformScale * scaleX, uniformScale * scaleY, uniformScale * scaleZ);
            mesh.visible = withinDistance && !isHiddenByOverride(state, key);
            mesh.rotation.set(manualRotX, manualRotY, manualRotZ);
            const visuals = mesh.userData.specialSegmentVisuals || {};
            const selectedSegment = String(state?.selectedObjectKey || "") === key;
            const showSegmentGuides = !!state?.showGuides && selectedSegment;
            if (specialSegmentType === "pit_gap") {
              const edgeDepth = Math.max(1.4, Math.min(4, gapLength * 0.34));
              const halfGap = gapLength * 0.5;
              if (visuals.frontEdge) {
                visuals.frontEdge.visible = !logicOnlySpecialSegment;
                visuals.frontEdge.position.set(0, 0, logicOffsetZ - halfGap - edgeDepth * 0.5);
                visuals.frontEdge.scale.set(1, 1, edgeDepth);
              }
              if (visuals.backEdge) {
                visuals.backEdge.visible = !logicOnlySpecialSegment;
                visuals.backEdge.position.set(0, 0, logicOffsetZ + halfGap + edgeDepth * 0.5);
                visuals.backEdge.scale.set(1, 1, edgeDepth);
              }
              if (visuals.voidMesh) {
                visuals.voidMesh.visible = !logicOnlySpecialSegment;
                visuals.voidMesh.position.set(0, -dropDepth * 0.5 - 0.06, logicOffsetZ);
                visuals.voidMesh.scale.set(1, dropDepth, gapLength);
              }
              if (visuals.devAnchor) {
                visuals.devAnchor.visible = !!state?.showGuides && (selectedSegment || logicOnlySpecialSegment);
                visuals.devAnchor.position.set(0, 0.06, logicOffsetZ);
                visuals.devAnchor.scale.setScalar(selectedSegment ? 1.2 : 1);
              }
              if (visuals.devGapGuide) {
                visuals.devGapGuide.visible = showSegmentGuides;
                visuals.devGapGuide.position.set(0, 0.16, logicOffsetZ);
                visuals.devGapGuide.scale.set(logicWidth / 7.55, 1, gapLength);
                if (visuals.devGapGuide.material) {
                  visuals.devGapGuide.material.opacity = selectedSegment ? 0.68 : 0.4;
                }
              }
              if (visuals.devGapFloor) {
                visuals.devGapFloor.visible = showSegmentGuides;
                visuals.devGapFloor.position.set(0, -dropDepth * 0.5, logicOffsetZ);
                visuals.devGapFloor.scale.set(logicWidth / 7.1, 1, gapLength);
                if (visuals.devGapFloor.material) {
                  visuals.devGapFloor.material.opacity = selectedSegment ? 0.28 : 0.16;
                }
              }
            } else {
              const startZ = logicOffsetZ - totalLength * 0.5;
              const plateauStartZ = startZ + entryLength;
              const descentStartZ = plateauStartZ + flatLength;
              const endZ = descentStartZ + exitLength;
              const entryCenterZ = (startZ + plateauStartZ) * 0.5;
              const flatCenterZ = (plateauStartZ + descentStartZ) * 0.5;
              const exitCenterZ = (descentStartZ + endZ) * 0.5;
              const bridgeUsesModel = usesModel && !!visuals.modelGroup;
              const showBridgePlaceholder = !logicOnlySpecialSegment && !bridgeUsesModel;
              if (bridgeUsesModel && visuals.modelToken !== `${modelUrl}|${modelName}`) {
                visuals.modelToken = `${modelUrl}|${modelName}`;
                visuals.modelReady = false;
                visuals.modelGroup.clear();
                loadModelTemplate(modelUrl, modelName).then((result) => {
                  const template = result?.template || null;
                  if (!template || visuals.modelToken !== `${modelUrl}|${modelName}`) return;
                  const instance = template.clone(true);
                  instance.traverse((node) => {
                    if (!node?.isMesh) return;
                    node.castShadow = false;
                    node.receiveShadow = false;
                    if (Array.isArray(node.material)) {
                      node.material = node.material.map((mat) => normalizeImportedSceneMaterial(mat));
                    } else {
                      node.material = normalizeImportedSceneMaterial(node.material);
                    }
                  });
                  const bounds = new THREE.Box3().setFromObject(instance);
                  const center = new THREE.Vector3();
                  const size = new THREE.Vector3();
                  bounds.getCenter(center);
                  bounds.getSize(size);
                  instance.position.set(-center.x, -bounds.min.y, -center.z);
                  visuals.modelBounds = {
                    sizeX: Math.max(0.001, size.x || 1),
                    sizeY: Math.max(0.001, size.y || 1),
                    sizeZ: Math.max(0.001, size.z || 1),
                  };
                  visuals.modelGroup.add(instance);
                  visuals.modelReady = true;
                });
              }
              const hideBridgePlaceholder = bridgeUsesModel;
              if (visuals.entryRamp) {
                visuals.entryRamp.visible = showBridgePlaceholder;
                visuals.entryRamp.position.set(0, segmentHeight * 0.5, entryCenterZ);
                visuals.entryRamp.scale.set(1, 1, entryLength);
                visuals.entryRamp.rotation.set(-Math.atan2(segmentHeight, Math.max(0.001, entryLength)), 0, 0);
              }
              if (visuals.plateau) {
                visuals.plateau.visible = showBridgePlaceholder;
                visuals.plateau.position.set(0, segmentHeight, flatCenterZ);
                visuals.plateau.scale.set(1, 1, flatLength);
                visuals.plateau.rotation.set(0, 0, 0);
              }
              if (visuals.exitRamp) {
                visuals.exitRamp.visible = showBridgePlaceholder;
                visuals.exitRamp.position.set(0, segmentHeight * 0.5, exitCenterZ);
                visuals.exitRamp.scale.set(1, 1, exitLength);
                visuals.exitRamp.rotation.set(Math.atan2(segmentHeight, Math.max(0.001, exitLength)), 0, 0);
              }
              const railSpan = Math.max(10, flatLength + 6);
              if (visuals.railLeft) {
                visuals.railLeft.visible = showBridgePlaceholder;
                visuals.railLeft.position.set(-3.34, segmentHeight + 0.22, flatCenterZ);
                visuals.railLeft.scale.set(1, 1, railSpan);
              }
              if (visuals.railRight) {
                visuals.railRight.visible = showBridgePlaceholder;
                visuals.railRight.position.set(3.34, segmentHeight + 0.22, flatCenterZ);
                visuals.railRight.scale.set(1, 1, railSpan);
              }
              if (visuals.modelGroup) {
                visuals.modelGroup.visible = bridgeUsesModel && visuals.modelReady;
                if (bridgeUsesModel && visuals.modelReady) {
                  const placementScaleX = Math.max(0.05, toFiniteNumber(override?.bridge_scale_x, 1));
                  const placementScaleY = Math.max(0.05, toFiniteNumber(override?.bridge_scale_y, 1));
                  const placementScaleZ = Math.max(0.05, toFiniteNumber(override?.bridge_scale_z, 1));
                  const placementPosX = toFiniteNumber(override?.bridge_offset_x, 0);
                  const placementPosY = toFiniteNumber(override?.bridge_offset_y, 0);
                  const placementPosZ = toFiniteNumber(override?.bridge_offset_z, 0);
                  const placementRotX = toRad(toFiniteNumber(override?.bridge_rotation_x, 0));
                  const placementRotY = toRad(toFiniteNumber(override?.bridge_rotation_y, 0));
                  const placementRotZ = toRad(toFiniteNumber(override?.bridge_rotation_z, 0));
                  visuals.modelGroup.position.set(placementPosX, segmentHeight + placementPosY, placementPosZ);
                  visuals.modelGroup.rotation.set(placementRotX, placementRotY, placementRotZ);
                  visuals.modelGroup.scale.set(
                    (totalLength / Math.max(0.001, visuals.modelBounds?.sizeZ || 1)) * placementScaleX,
                    placementScaleY,
                    placementScaleZ
                  );
                }
              }
              if (visuals.devAnchor) {
                visuals.devAnchor.visible = !!state?.showGuides && (selectedSegment || logicOnlySpecialSegment);
                visuals.devAnchor.position.set(0, segmentHeight + 0.08, flatCenterZ);
                visuals.devAnchor.scale.setScalar(selectedSegment ? 1.2 : 1);
              }
              if (visuals.devEntryGuide) {
                visuals.devEntryGuide.visible = showSegmentGuides;
                visuals.devEntryGuide.position.set(0, segmentHeight * 0.5, entryCenterZ);
                visuals.devEntryGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, entryLength);
                visuals.devEntryGuide.rotation.set(-Math.atan2(segmentHeight, Math.max(0.001, entryLength)), 0, 0);
                if (visuals.devEntryGuide.material) {
                  visuals.devEntryGuide.material.opacity = selectedSegment ? 0.58 : 0.36;
                }
              }
              if (visuals.devFlatGuide) {
                visuals.devFlatGuide.visible = showSegmentGuides;
                visuals.devFlatGuide.position.set(0, segmentHeight, flatCenterZ);
                visuals.devFlatGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, flatLength);
                visuals.devFlatGuide.rotation.set(0, 0, 0);
                if (visuals.devFlatGuide.material) {
                  visuals.devFlatGuide.material.opacity = selectedSegment ? 0.5 : 0.28;
                }
              }
              if (visuals.devExitGuide) {
                visuals.devExitGuide.visible = showSegmentGuides;
                visuals.devExitGuide.position.set(0, segmentHeight * 0.5, exitCenterZ);
                visuals.devExitGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, exitLength);
                visuals.devExitGuide.rotation.set(Math.atan2(segmentHeight, Math.max(0.001, exitLength)), 0, 0);
                if (visuals.devExitGuide.material) {
                  visuals.devExitGuide.material.opacity = selectedSegment ? 0.58 : 0.36;
                }
              }
              if (visuals.devSurfaceFilm) {
                visuals.devSurfaceFilm.visible = showSegmentGuides;
                visuals.devSurfaceFilm.position.set(0, segmentHeight + 0.035, flatCenterZ);
                visuals.devSurfaceFilm.scale.set(logicWidth / 7.05, 1, flatLength);
                if (visuals.devSurfaceFilm.material) {
                  visuals.devSurfaceFilm.material.opacity = selectedSegment ? 0.3 : 0.16;
                }
              }
            }
            assignDevPick(mesh, {
              key,
              type: "custom",
              kind: objectKind,
              special_segment_type: specialSegmentType,
              special_profile: specialProfile,
              model_url: modelUrl,
              model_name: modelName,
              media_type: mediaType,
              label: String(entry?.label || `Segmento ${index + 1}`),
            });
            return;
          }
          if (isSpecialSegment && renderSpecialSegmentAsModel) {
            const segmentHeightBase = Math.max(0.02, toFiniteNumber(override?.segment_height, entry?.segment_height || 1.18));
            const logicOffsetZ = toFiniteNumber(override?.segment_logic_offset_z, entry?.segment_logic_offset_z || 0);
            const logicHeightOffset = toFiniteNumber(
              override?.segment_logic_height_offset,
              entry?.segment_logic_height_offset || 0
            );
            const logicWidth = Math.max(0.05, toFiniteNumber(override?.segment_logic_width, entry?.segment_logic_width || 7.25));
            const segmentHeight = Math.max(0.02, segmentHeightBase + logicHeightOffset);
            const entryLength = Math.max(0.05, toFiniteNumber(override?.segment_entry_length, entry?.segment_entry_length || 16));
            const flatLength = Math.max(0.05, toFiniteNumber(override?.segment_flat_length, entry?.segment_flat_length || 20));
            const exitLength = Math.max(0.05, toFiniteNumber(override?.segment_exit_length, entry?.segment_exit_length || 16));
            const totalLength = entryLength + flatLength + exitLength;
            const startZ = logicOffsetZ - totalLength * 0.5;
            const plateauStartZ = startZ + entryLength;
            const descentStartZ = plateauStartZ + flatLength;
            const endZ = descentStartZ + exitLength;
            const entryCenterZ = (startZ + plateauStartZ) * 0.5;
            const flatCenterZ = (plateauStartZ + descentStartZ) * 0.5;
            const exitCenterZ = (descentStartZ + endZ) * 0.5;
            const selectedSegment = String(state?.selectedObjectKey || "") === key;
            const showSegmentGuides = !!state?.showGuides && selectedSegment;
            const visuals = mesh.userData.specialSegmentVisuals || {};
            if (visuals.entryRamp) visuals.entryRamp.visible = false;
            if (visuals.plateau) visuals.plateau.visible = false;
            if (visuals.exitRamp) visuals.exitRamp.visible = false;
            if (visuals.railLeft) visuals.railLeft.visible = false;
            if (visuals.railRight) visuals.railRight.visible = false;
            if (visuals.modelGroup) {
              visuals.modelGroup.visible = false;
            }
            if (visuals.devAnchor) {
              visuals.devAnchor.visible = showSegmentGuides;
              visuals.devAnchor.position.set(0, segmentHeight + 0.08, flatCenterZ);
              visuals.devAnchor.scale.setScalar(selectedSegment ? 1.2 : 1);
            }
            if (visuals.devEntryGuide) {
              visuals.devEntryGuide.visible = showSegmentGuides;
              visuals.devEntryGuide.position.set(0, segmentHeight * 0.5, entryCenterZ);
              visuals.devEntryGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, entryLength);
              visuals.devEntryGuide.rotation.set(-Math.atan2(segmentHeight, Math.max(0.001, entryLength)), 0, 0);
              if (visuals.devEntryGuide.material) visuals.devEntryGuide.material.opacity = selectedSegment ? 0.58 : 0.36;
            }
            if (visuals.devFlatGuide) {
              visuals.devFlatGuide.visible = showSegmentGuides;
              visuals.devFlatGuide.position.set(0, segmentHeight, flatCenterZ);
              visuals.devFlatGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, flatLength);
              visuals.devFlatGuide.rotation.set(0, 0, 0);
              if (visuals.devFlatGuide.material) visuals.devFlatGuide.material.opacity = selectedSegment ? 0.5 : 0.28;
            }
            if (visuals.devExitGuide) {
              visuals.devExitGuide.visible = showSegmentGuides;
              visuals.devExitGuide.position.set(0, segmentHeight * 0.5, exitCenterZ);
              visuals.devExitGuide.scale.set(logicWidth / 7.25, segmentHeight / 0.16, exitLength);
              visuals.devExitGuide.rotation.set(Math.atan2(segmentHeight, Math.max(0.001, exitLength)), 0, 0);
              if (visuals.devExitGuide.material) visuals.devExitGuide.material.opacity = selectedSegment ? 0.58 : 0.36;
            }
            if (visuals.devSurfaceFilm) {
              visuals.devSurfaceFilm.visible = showSegmentGuides;
              visuals.devSurfaceFilm.position.set(0, segmentHeight + 0.035, flatCenterZ);
              visuals.devSurfaceFilm.scale.set(logicWidth / 7.05, 1, flatLength);
              if (visuals.devSurfaceFilm.material) visuals.devSurfaceFilm.material.opacity = selectedSegment ? 0.3 : 0.16;
            }
          }
          const followRoadAlignment = usesModel && !!override?.follow_road_curve;
          let autoRotX = 0;
          let autoRotZ = 0;
          if (followRoadAlignment) {
            const zForSlope = Number(mesh.position.z) || 0;
            const slopeSample = 0.65;
            const nextZ = zForSlope + slopeSample;
            const prevZ = zForSlope - slopeSample;
            const xNext = curveOffsetAt(nextZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
            const xPrev = curveOffsetAt(prevZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus);
            const yNext = dropAt(nextZ, roadSculpt, flow, roadEvents, selectedFocus);
            const yPrev = dropAt(prevZ, roadSculpt, flow, roadEvents, selectedFocus);
            const dx = (xNext - xPrev) / (slopeSample * 2);
            const dy = (yNext - yPrev) / (slopeSample * 2);
            autoRotX = Math.max(-0.85, Math.min(0.85, Math.atan(dy)));
            autoRotZ = Math.max(-0.65, Math.min(0.65, -dx * 0.24));
          }
          const instancingEligible =
            mediaType === "model3d" &&
            !!modelUrl &&
            movementMode === "anchored" &&
            isEnvironmentInstancingCandidateName(modelUrl) &&
            Math.abs(Number(pieceCurveSide || 0)) <= 0.0001 &&
            Math.abs(Number(pieceCurveDown || 0)) <= 0.0001 &&
            !String(importedTextureUrl || "").trim();
          const instancingCandidate = canUseInstancedCustomModel({
            key,
            state,
            entry,
            override,
            mediaType,
            modelUrl,
            importedTextureUrl,
            pieceCurveSide,
            pieceCurveDown,
            movementMode,
          });
          if (instancingCandidate) {
            if (!withinDistance) {
              activeKeys.delete(key);
              if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
              customObjectGroup.remove(mesh);
              customObjectMeshes.delete(key);
              return;
            }
            const uniformScale = entryScale * overrideScale;
            const finalScaleX = uniformScale * scaleX;
            const finalScaleY = uniformScale * scaleY;
            const finalScaleZ = uniformScale * scaleZ;
            instancedModelDummy.position.copy(mesh.position);
            instancedModelDummy.rotation.set(manualRotX + autoRotX, manualRotY, manualRotZ + autoRotZ);
            instancedModelDummy.scale.set(finalScaleX, finalScaleY, finalScaleZ);
            instancedModelDummy.updateMatrix();
            const batchKey = `env:${getCanonicalSceneAssetName(modelUrl)}`;
            const batchEntry = instancedBatchesInUse.get(batchKey) || {
              modelUrl,
              matrices: [],
            };
            batchEntry.matrices.push(instancedModelDummy.matrix.clone());
            instancedBatchesInUse.set(batchKey, batchEntry);
            activeKeys.delete(key);
            if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
            customObjectGroup.remove(mesh);
            customObjectMeshes.delete(key);
            return;
          }
          const isRoadKind = String(mesh.userData.kind || "").toLowerCase() === "road";
          const shouldCurveRoadModel = false;
          if (isProcedural) {
            mesh.scale.set(entryScale * overrideScale * scaleX, entryScale * overrideScale * scaleY, entryScale * overrideScale * scaleZ);
          } else if (usesModel) {
            const modelToken = `${modelUrl}|${mediaType}|${shouldCurveRoadModel ? "curved" : "plain"}`;
            const visualToken = `${importedTextureProjection}|${importedTextureUrl}|${JSON.stringify(importedTextureSettings)}`;
            if (mesh.userData.modelToken !== modelToken) {
              mesh.userData.modelToken = modelToken;
              while (mesh.children.length) mesh.remove(mesh.children[0]);
              mesh.userData.modelRoot = null;
              mesh.userData.modelScaleRoot = null;
              mesh.userData.modelOrientationRoot = null;
              mesh.userData.modelContentRoot = null;
              mesh.userData.modelFlow = null;
              mesh.userData.modelAxisRotationY = 0;
              mesh.userData.modelMeasuredLength = 0;
              loadModelTemplate(modelUrl, modelName).then((result) => {
                const template = result?.template || null;
                if (mesh.userData.modelToken !== modelToken) return;
                if (!template) {
                  mesh.userData.modelLoadError = result?.error || "load_failed";
                  return;
                }
                mesh.children
                  .filter((child) => child.userData?.placeholder)
                  .forEach((child) => {
                    child.geometry?.dispose?.();
                    child.material?.dispose?.();
                    mesh.remove(child);
                  });
                const sourceInstance = template.clone(true);
                const sourceBounds = new THREE.Box3().setFromObject(sourceInstance);
                const sourceSize = new THREE.Vector3();
                sourceBounds.getSize(sourceSize);
                const sourceMaxDim = Math.max(sourceSize.x || 0, sourceSize.y || 0, sourceSize.z || 0);
                const autoScaleFactor = sourceMaxDim > 0 && sourceMaxDim < 1.5 ? 1.5 / sourceMaxDim : 1;
                if (shouldCurveRoadModel) {
                  const curvedInstance = template.clone(true);
                  curvedInstance.scale.multiplyScalar(autoScaleFactor);
                  const curvedBounds = new THREE.Box3().setFromObject(curvedInstance);
                  const curvedCenter = new THREE.Vector3();
                  const curvedSize = new THREE.Vector3();
                  curvedBounds.getCenter(curvedCenter);
                  curvedBounds.getSize(curvedSize);
                  const forwardAxis = curvedSize.x >= curvedSize.z ? "x" : "z";
                  const axisRotationY = 0;
                  const measuredLength = Math.max(0.001, Math.max(curvedSize.x || 0, curvedSize.z || 0, 1));
                  curvedInstance.position.set(0, -curvedBounds.min.y, 0);
                  prepareImportedModelInstance(curvedInstance);
                  prepareImportedModelForRoadBend(curvedInstance, measuredLength);
                  markImportedModelRoadCurveBase(curvedInstance);
                  applyImportedModelVisualState(
                    curvedInstance,
                    importedTextureProjection,
                    importedTextureUrl,
                    importedTextureSettings,
                    visualToken
                  );
                  const orientationRoot = new THREE.Group();
                  orientationRoot.add(curvedInstance);
                  mesh.add(orientationRoot);
                  mesh.userData.modelRoot = orientationRoot;
                  mesh.userData.modelScaleRoot = null;
                  mesh.userData.modelOrientationRoot = orientationRoot;
                  mesh.userData.modelContentRoot = curvedInstance;
                  mesh.userData.modelFlow = null;
                  mesh.userData.modelUseVertexRoadCurve = true;
                  mesh.userData.modelBoundsMinY = 0;
                  mesh.userData.modelAxisRotationY = axisRotationY;
                  mesh.userData.modelForwardAxis = forwardAxis;
                  mesh.userData.modelMeasuredLength = measuredLength;
                  mesh.userData.modelAutoScaleFactor = autoScaleFactor;
                  mesh.userData.modelSourceMaxDim = sourceMaxDim;
                } else {
                  const instance = template.clone(true);
                  instance.scale.multiplyScalar(autoScaleFactor);
                  const instanceBounds = new THREE.Box3().setFromObject(instance);
                  const instanceSize = new THREE.Vector3();
                  instanceBounds.getSize(instanceSize);
                  const forwardAxis = instanceSize.x >= instanceSize.z ? "x" : "z";
                  prepareImportedModelInstance(instance);
                  applyImportedModelVisualState(
                    instance,
                    importedTextureProjection,
                    importedTextureUrl,
                    importedTextureSettings,
                    visualToken
                  );
                  mesh.add(instance);
                  mesh.userData.modelRoot = instance;
                  mesh.userData.modelScaleRoot = null;
                  mesh.userData.modelOrientationRoot = null;
                  mesh.userData.modelContentRoot = instance;
                  mesh.userData.modelFlow = null;
                  mesh.userData.modelUseVertexRoadCurve = false;
                  mesh.userData.modelAxisRotationY = 0;
                  mesh.userData.modelForwardAxis = forwardAxis;
                  mesh.userData.modelMeasuredLength = 0;
                  mesh.userData.modelAutoScaleFactor = autoScaleFactor;
                  mesh.userData.modelSourceMaxDim = sourceMaxDim;
                }
                mesh.userData.modelLoadError = null;
              });
            } else if (mesh.userData.modelContentRoot || mesh.userData.modelRoot) {
              applyImportedModelVisualState(
                mesh.userData.modelContentRoot || mesh.userData.modelRoot,
                importedTextureProjection,
                importedTextureUrl,
                importedTextureSettings,
                visualToken
              );
            }
            if (shouldCurveRoadModel && mesh.userData.modelContentRoot) {
              const uniformScale = entryScale * overrideScale;
              const finalScaleX = uniformScale * scaleX;
              const finalScaleY = uniformScale * scaleY;
              const finalScaleZ = uniformScale * scaleZ;
              mesh.scale.set(1, 1, 1);
              const centerZ = Number(mesh.position.z) || 0;
              applyImportedModelRoadCurve(
                mesh.userData.modelContentRoot,
                centerZ,
                curveValue,
                roadSculpt,
                flow,
                roadEvents,
                selectedFocus,
                finalScaleX,
                finalScaleY,
                finalScaleZ,
                mesh.userData.modelForwardAxis || "z",
                pieceCurveSide,
                pieceCurveDown,
                pieceCurveSideRadius,
                pieceCurveDownRadius
              );
              if (mesh.userData.modelOrientationRoot) {
                mesh.userData.modelOrientationRoot.rotation.set(
                  manualRotX,
                  Number(mesh.userData.modelAxisRotationY || 0) + manualRotY,
                  manualRotZ
                );
              }
            } else {
              mesh.scale.set(entryScale * overrideScale * scaleX, entryScale * overrideScale * scaleY, entryScale * overrideScale * scaleZ);
              if (mesh.userData.modelContentRoot && mesh.userData.modelUseVertexRoadCurve) {
                applyImportedModelPieceCurve(
                  mesh.userData.modelContentRoot,
                  pieceCurveSide,
                  pieceCurveDown,
                  pieceCurveSideRadius,
                  pieceCurveDownRadius,
                  1,
                  1,
                  1,
                  mesh.userData.modelForwardAxis || "z"
                );
              } else if (mesh.userData.modelContentRoot) {
                applyImportedModelPieceCurve(
                  mesh.userData.modelContentRoot,
                  pieceCurveSide,
                  pieceCurveDown,
                  pieceCurveSideRadius,
                  pieceCurveDownRadius,
                  1,
                  1,
                  1,
                  mesh.userData.modelForwardAxis || "z"
                );
              }
            }
          } else {
            const map = mesh.material?.map;
            const rawW = map?.image?.videoWidth || map?.image?.width || 1024;
            const rawH = map?.image?.videoHeight || map?.image?.height || 1024;
            const aspect = Math.max(0.3, Math.min(4, rawW / Math.max(1, rawH)));
            const baseHeight = Math.max(2.2, Math.min(10, rawH / 220));
            const uniform = entryScale * overrideScale;
            mesh.scale.set(baseHeight * aspect * uniform * scaleX, baseHeight * uniform * scaleY, 1);
          }
          mesh.visible = withinDistance && !isHiddenByOverride(state, key);
          mesh.userData.hasManualRotation =
            hasFiniteNumber(override?.rotation_x) ||
            hasFiniteNumber(override?.rotation_y) ||
            hasFiniteNumber(override?.rotation_z) ||
            hasFiniteNumber(entry?.rotation_x) ||
            hasFiniteNumber(entry?.rotation_y) ||
            hasFiniteNumber(entry?.rotation_z);
          if (shouldCurveRoadModel) {
            mesh.rotation.set(0, 0, 0);
          } else if (followRoadAlignment) {
            mesh.rotation.set(manualRotX + autoRotX, manualRotY, manualRotZ + autoRotZ);
          } else {
            mesh.rotation.set(manualRotX, manualRotY, manualRotZ);
          }
          assignDevPick(mesh, {
            key,
            type: "custom",
            kind: mesh.userData.kind,
            special_segment_type: isSpecialSegment ? specialSegmentType : "",
            special_profile: isSpecialSegment ? specialProfile : "",
            texture_url: textureUrl,
            model_url: modelUrl,
            media_type: mediaType,
            procedural_type: proceduralType || "",
            imported_texture_projection: importedTextureProjection,
            label: String(entry?.label || `Custom ${index + 1}`),
            model_native_max_dim: Number(mesh.userData?.modelSourceMaxDim || 0),
            model_auto_scale_factor: Number(mesh.userData?.modelAutoScaleFactor || 1),
            model_instancing_eligible: instancingEligible,
            model_instancing_candidate: instancingCandidate,
          });
        } catch {
          // Ignore malformed custom object entries without breaking the scene.
        }
      });

      customObjectInstancedBatches.forEach((batch, batchKey) => {
        const usage = instancedBatchesInUse.get(batchKey);
        if (!usage) {
          disposeInstancedBatch(batch);
          customObjectInstancedBatches.delete(batchKey);
          return;
        }
          const liveBatch = ensureInstancedBatch(batchKey, usage.modelUrl);
          if (!liveBatch?.ready || !Array.isArray(liveBatch.parts) || !liveBatch.parts.length) return;
          const instanceCount = usage.matrices.length;
          liveBatch.count = instanceCount;
          liveBatch.parts.forEach((part) => {
            if (!part?.mesh) return;
          if (instanceCount > part.mesh.instanceMatrix.count) return;
          for (let index = 0; index < instanceCount; index += 1) {
            instancedModelPartMatrix.copy(usage.matrices[index]).multiply(part.baseMatrix);
            part.mesh.setMatrixAt(index, instancedModelPartMatrix);
          }
          part.mesh.count = instanceCount;
          part.mesh.instanceMatrix.needsUpdate = true;
          part.mesh.computeBoundingSphere?.();
        });
      });
      instancedBatchesInUse.forEach((usage, batchKey) => {
        if (customObjectInstancedBatches.has(batchKey)) return;
        ensureInstancedBatch(batchKey, usage.modelUrl);
      });

      customObjectMeshes.forEach((mesh, key) => {
        if (activeKeys.has(key)) return;
        if (mesh?.isMesh && mesh.userData?.isProcedural) disposeProceduralGeometry(mesh);
        customObjectGroup.remove(mesh);
        customObjectMeshes.delete(key);
      });
    };
    const syncRoadEventHandles = (state, curveValue, roadSculpt, flow, sceneMs, roadCutoffZ) => {
      const isEditableScene = state.mode === "challenge" && state.showGuides;
      roadEventHandleGroup.visible = isEditableScene;
      if (!isEditableScene) return;
      const events = readRoadEvents(state, true);
      const selectedId = String(state.devSelectedRoadEventId || "");
      const selectedFocus = getSelectedRoadEventFocus(state);
      const activeIds = new Set();
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        const id = String(event.id || "");
        if (!id) continue;
        activeIds.add(id);
        let handle = roadEventHandleMeshes.get(id);
        if (!handle) {
          const baseMaterial = new THREE.MeshBasicMaterial({
            color: 0xa78bfa,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
            clippingPlanes: [roadCutoffClipPlane],
          });
          const tipMaterial = new THREE.MeshBasicMaterial({
            color: 0xe9d5ff,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            clippingPlanes: [roadCutoffClipPlane],
          });
          const band = new THREE.Mesh(roadEventHandleGeometry, baseMaterial);
          const tip = new THREE.Mesh(roadEventHandleTipGeometry, tipMaterial);
          tip.rotation.x = Math.PI;
          tip.position.y = 0.2;
          const group = new THREE.Group();
          group.add(band);
          group.add(tip);
          assignDevPick(group, {
            key: `road_event_${id}`,
            id,
            type: "road_event_handle",
            label: "Bloco de estrada",
          });
          group.userData.band = band;
          group.userData.tip = tip;
          roadEventHandleGroup.add(group);
          roadEventHandleMeshes.set(id, group);
          handle = group;
        }
        const band = handle.userData.band;
        const tip = handle.userData.tip;
        const eventFlow = resolveEventFlowForRender(event, flow, selectedFocus);
        const worldStartZ = Number(event.startZ || 0) + resolveEventFlowShift(event, eventFlow);
        const worldLength = Math.max(4, Number(event.length) || 24);
        const worldCenterZ = worldStartZ - worldLength * 0.5;
        const worldX = curveOffsetAt(worldCenterZ, curveValue, roadSculpt, flow, events);
        const worldY = dropAt(worldCenterZ, roadSculpt, flow, events) + 0.07;
        handle.position.set(worldX, worldY, worldCenterZ);
        handle.visible = worldCenterZ >= roadCutoffZ;
        const pulse = 1 + Math.sin(sceneMs * 0.012 + i * 0.8) * 0.05;
        band.scale.set(1, worldLength, 1);
        if (tip) {
          tip.position.z = worldLength * 0.5 - 0.24;
          tip.scale.setScalar(pulse);
        }
        const isSelected = selectedId && selectedId === id;
        const isCurve = event.type === "curve";
        const isEnabled = event.enabled !== false;
        const baseColor = isCurve ? 0xc084fc : 0x22d3ee;
        const selectedColor = isCurve ? 0xe879f9 : 0x67e8f9;
        if (band?.material) {
          band.material.color.setHex(isSelected ? selectedColor : baseColor);
          band.material.opacity = isEnabled ? (isSelected ? 0.56 : 0.32) : 0.12;
        }
        if (tip?.material) {
          tip.material.color.setHex(isSelected ? 0xffffff : isCurve ? 0xf5d0fe : 0xcffafe);
          tip.material.opacity = isEnabled ? 0.92 : 0.35;
        }
      }
      roadEventHandleMeshes.forEach((handle, id) => {
        if (activeIds.has(id)) return;
        if (handle?.userData?.band?.material) handle.userData.band.material.dispose();
        if (handle?.userData?.tip?.material) handle.userData.tip.material.dispose();
        roadEventHandleGroup.remove(handle);
        roadEventHandleMeshes.delete(id);
      });
    };
    const findObjectByDevKey = (key) => {
      if (!key) return null;
      const matchByKey = (obj) => obj?.userData?.devPick?.key === key;
      if (matchByKey(horizonMesh)) return horizonMesh;
      if (matchByKey(roadMesh)) return roadMesh;
      if (matchByKey(playerGroup)) return playerGroup;
      if (matchByKey(bossGroup)) return bossGroup;
      const veg = vegetationSprites.find(matchByKey);
      if (veg) return veg;
      const edge = edgeVegetationSprites.find(matchByKey);
      if (edge) return edge;
      let customMatch = null;
      customObjectMeshes.forEach((mesh) => {
        if (!customMatch && matchByKey(mesh)) customMatch = mesh;
      });
      return customMatch;
    };
    const resolveSelectedWorldPosition = (
      state,
      key,
      object3d,
      curveValue,
      roadSculpt,
      flow,
      zOffset,
      roadEvents,
      selectedFocus,
      out
    ) => {
      if (!key || !out) return false;
      if (object3d) {
        object3d.getWorldPosition(out);
        return Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z);
      }
      const entry = getCustomObjectEntryByKey(state, key);
      if (!entry) return false;
      const override = getOverrideFor(state, key);
      const movementMode = String(override?.movement_mode || "");
      const shouldFlow = movementMode !== "anchored";
      const ox = hasFiniteNumber(override?.x) ? toFiniteNumber(override?.x, 0) : toFiniteNumber(entry?.x, 0);
      const oy = hasFiniteNumber(override?.y) ? toFiniteNumber(override?.y, 0) : toFiniteNumber(entry?.y, 0);
      const seedZ = hasFiniteNumber(override?.z) ? toFiniteNumber(override?.z, -10) : toFiniteNumber(entry?.z, -10);
      const xMode = String(override?.x_mode || entry?.x_mode || "relative_curve");
      const yMode = String(override?.y_mode || entry?.y_mode || "relative_ground");
      const mesh = customObjectMeshes.get(String(key || ""));
      const logicalZ =
        shouldFlow && Number.isFinite(mesh?.userData?.z)
          ? Number(mesh.userData.z)
          : seedZ;
      const worldZ = logicalZ + zOffset;
      const worldX =
        xMode === "relative_curve"
          ? curveOffsetAt(worldZ, curveValue, roadSculpt, flow, roadEvents, selectedFocus) + ox
          : ox;
      const worldY =
        yMode === "relative_ground"
          ? dropAt(worldZ, roadSculpt, flow, roadEvents, selectedFocus) + oy
          : oy;
      out.set(worldX, worldY, worldZ);
      return Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z);
    };

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, mount.clientWidth || 1);
      const height = Math.max(1, mount.clientHeight || 1);
      applyRendererPixelRatio(dataRef.current.graphicsSettings);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    let clickStartX = 0;
    let clickStartY = 0;
    const pickWorldPosition = new THREE.Vector3();
    const pickScenePosition = new THREE.Vector3();
    const dragPlaneHit = new THREE.Vector3();
    const dragState = {
      active: false,
      pointerId: null,
      object: null,
      key: "",
      xMode: "world",
      plane: new THREE.Plane(),
      y: 0,
      yMode: "world",
      yOffset: 0,
      didMove: false,
      startX: 0,
      startZ: 0,
      startClientX: 0,
      startClientY: 0,
      lastClientX: 0,
      lastClientY: 0,
      engaged: false,
    };
    const proceduralEditState = {
      active: false,
      pointerId: null,
      object: null,
      key: "",
      tool: "move",
      invert: false,
      primitive: "box",
      startClientX: 0,
      startClientY: 0,
      startHeight: 1,
      lastHeight: 1,
      brushRadius: 0.9,
      brushStrength: 0.09,
      paintColor: "#9ca3af",
    };
    const roadEventEditState = {
      active: false,
      pointerId: null,
      eventId: "",
      startClientX: 0,
      startClientY: 0,
      startStrength: 0,
      startLength: 24,
      startStartZ: -34,
      didMove: false,
    };
    const loadoutSpinState = {
      active: false,
      pointerId: null,
      startClientX: 0,
      startYaw: 0,
      didMove: false,
    };
    const clearDragState = (pointerId = null) => {
      if (pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(pointerId);
      } else if (dragState.pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(dragState.pointerId);
      }
      dragState.active = false;
      dragState.pointerId = null;
      dragState.object = null;
      dragState.key = "";
      dragState.xMode = "world";
      dragState.yMode = "world";
      dragState.yOffset = 0;
      dragState.didMove = false;
      dragState.startX = 0;
      dragState.startZ = 0;
      dragState.startClientX = 0;
      dragState.startClientY = 0;
      dragState.lastClientX = 0;
      dragState.lastClientY = 0;
      dragState.engaged = false;
    };
    const clearProceduralEditState = (pointerId = null) => {
      if (pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(pointerId);
      } else if (proceduralEditState.pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(proceduralEditState.pointerId);
      }
      proceduralEditState.active = false;
      proceduralEditState.pointerId = null;
      proceduralEditState.object = null;
      proceduralEditState.key = "";
      proceduralEditState.tool = "move";
      proceduralEditState.invert = false;
      proceduralEditState.primitive = "box";
      proceduralEditState.startClientX = 0;
      proceduralEditState.startClientY = 0;
      proceduralEditState.startHeight = 1;
      proceduralEditState.lastHeight = 1;
      proceduralEditState.brushRadius = 0.9;
      proceduralEditState.brushStrength = 0.09;
      proceduralEditState.paintColor = "#9ca3af";
      proceduralBrushCursor.visible = false;
    };
    const clearRoadEventEditState = (pointerId = null) => {
      if (pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(pointerId);
      } else if (roadEventEditState.pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(roadEventEditState.pointerId);
      }
      roadEventEditState.active = false;
      roadEventEditState.pointerId = null;
      roadEventEditState.eventId = "";
      roadEventEditState.startClientX = 0;
      roadEventEditState.startClientY = 0;
      roadEventEditState.startStrength = 0;
      roadEventEditState.startLength = 24;
      roadEventEditState.startStartZ = -34;
      roadEventEditState.didMove = false;
    };
    const clearLoadoutSpinState = (pointerId = null) => {
      if (pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(pointerId);
      } else if (loadoutSpinState.pointerId !== null) {
        renderer.domElement.releasePointerCapture?.(loadoutSpinState.pointerId);
      }
      loadoutSpinState.active = false;
      loadoutSpinState.pointerId = null;
      loadoutSpinState.startClientX = 0;
      loadoutSpinState.startYaw = animateRefs.loadoutCharacterYawTarget || 0;
      loadoutSpinState.didMove = false;
    };
    const snapToGrid = (value, step = 0.5) => {
      const safe = Math.max(0.05, Number(step) || 0.5);
      return Math.round(value / safe) * safe;
    };
    const findPickTarget = (object3d) => {
      let node = object3d;
      while (node) {
        if (node.userData?.devPick) return node;
        node = node.parent || null;
      }
      return null;
    };
    const getSpriteAlphaAtUv = (sprite, uv) => {
      if (!sprite?.isSprite || !uv) return 1;
      const map = sprite.material?.map;
      const image = map?.image;
      if (!image || !image.width || !image.height) return 1;
      let cached = alphaSampleCache.get(image);
      if (!cached) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return 1;
          ctx.drawImage(image, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          cached = { width: canvas.width, height: canvas.height, data };
          alphaSampleCache.set(image, cached);
        } catch {
          return 1;
        }
      }
      const u = Math.max(0, Math.min(1, Number(uv.x) || 0));
      const v = Math.max(0, Math.min(1, Number(uv.y) || 0));
      const x = Math.max(0, Math.min(cached.width - 1, Math.round(u * (cached.width - 1))));
      const y = Math.max(0, Math.min(cached.height - 1, Math.round((1 - v) * (cached.height - 1))));
      const idx = (y * cached.width + x) * 4 + 3;
      return (cached.data[idx] || 0) / 255;
    };
    const isIntersectionSelectable = (target, intersection) => {
      if (!target?.visible) return false;
      if (target.isSprite) {
        const alpha = getSpriteAlphaAtUv(target, intersection?.uv);
        return alpha > 0.12;
      }
      return true;
    };
    const isLowPriorityPickTarget = (target) => {
      const type = String(target?.userData?.devPick?.type || "");
      return pickLowPriorityTypes.has(type);
    };
    const isPickTypeInteractive = (target) => {
      const type = String(target?.userData?.devPick?.type || "");
      if (!type) return false;
      const state = dataRef.current;
      const isLoadoutCameraEditor =
        state?.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        !!state?.loadoutCameraEditMode;
      if (type === "loadout_camera" || type === "loadout_look") {
        return isLoadoutCameraEditor;
      }
      if (pickLowPriorityTypes.has(type)) {
        const allowLowPriorityPick = !!(state?.enableFreeCamera && state?.mode === "challenge" && state?.showGuides);
        return allowLowPriorityPick;
      }
      return true;
    };
    const toPointerNdc = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      pickPointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pickPointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      return true;
    };
    const getRoadHitPoint = (event) => {
      if (!toPointerNdc(event)) return null;
      pickRaycaster.setFromCamera(pickPointerNdc, camera);
      const hits = pickRaycaster.intersectObject(roadMesh, true);
      if (!hits.length) return null;
      return hits[0]?.point || null;
    };
    const resolvePickObject = (event) => {
      if (!toPointerNdc(event)) return null;
      pickRaycaster.setFromCamera(pickPointerNdc, camera);
      const intersections = pickRaycaster.intersectObjects(scene.children, true);
      if (intersections.length) {
        const seen = new Set();
        for (let i = 0; i < intersections.length; i += 1) {
          const hit = intersections[i];
          const target = findPickTarget(hit.object);
          if (!target) continue;
          if (seen.has(target.uuid)) continue;
          seen.add(target.uuid);
          if (!isIntersectionSelectable(target, hit)) continue;
          if (!isPickTypeInteractive(target)) continue;
          return target;
        }
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const maxPickDistancePx = 80;
      let best = null;
      let bestScore = Number.POSITIVE_INFINITY;
      camera.getWorldPosition(pickCameraWorld);
      const pixelsPerWorldAt = (worldPos) => {
        const distance = Math.max(0.001, pickCameraWorld.distanceTo(worldPos));
        const fovRad = THREE.MathUtils.degToRad(camera.fov || 52);
        return rect.height / (2 * Math.tan(fovRad * 0.5) * distance);
      };
      scene.traverse((node) => {
        if (!node?.visible || !node.userData?.devPick) return;
        if (!isPickTypeInteractive(node)) return;
        node.getWorldPosition(pickFallbackWorld);
        pickFallbackNdc.copy(pickFallbackWorld).project(camera);
        if (pickFallbackNdc.z < -1 || pickFallbackNdc.z > 1) return;
        const sx = ((pickFallbackNdc.x + 1) * 0.5) * rect.width + rect.left;
        const sy = ((-pickFallbackNdc.y + 1) * 0.5) * rect.height + rect.top;
        const d = Math.hypot(event.clientX - sx, event.clientY - sy);
        let worldRadius = 0.7;
        if (node.isSprite) {
          worldRadius = Math.max(0.35, Math.max(node.scale?.x || 0.7, node.scale?.y || 0.7) * 0.55);
        } else if (node.geometry?.boundingSphere) {
          node.getWorldScale(pickWorldScale);
          const scaleMax = Math.max(pickWorldScale.x, pickWorldScale.y, pickWorldScale.z, 0.1);
          worldRadius = Math.max(0.35, node.geometry.boundingSphere.radius * scaleMax);
        }
        const projectedRadiusPx = Math.max(16, Math.min(140, worldRadius * pixelsPerWorldAt(pickFallbackWorld)));
        const acceptanceRadius = Math.min(maxPickDistancePx, projectedRadiusPx + 22);
        if (d > acceptanceRadius) return;
        const depthPenalty = Math.max(0, pickFallbackNdc.z) * 0.28;
        const score = d / Math.max(12, projectedRadiusPx) + depthPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = node;
        }
      });
      return best;
    };
    const canDragObject = (type) => {
      return (
        type === "vegetation" ||
        type === "edge_vegetation" ||
        type === "custom" ||
        type === "boss" ||
        type === "horizon" ||
        type === "loadout_camera" ||
        type === "loadout_look"
      );
    };
    const getCustomObjectEntryByKey = (state, key) => {
      const list = Array.isArray(state?.sceneConfig?.custom_objects) ? state.sceneConfig.custom_objects : [];
      return list.find((item) => String(item?.key || "") === String(key || "")) || null;
    };
    const isCustomObjectProcedural = (entry, override) => {
      const mediaType = String(override?.media_type || entry?.media_type || "");
      const primitive = String(override?.procedural_type || entry?.procedural_type || "");
      return mediaType === "procedural" || !!primitive.trim();
    };
    const emitDevPick = (event) => {
      const state = dataRef.current;
      if (!(state.mode === "challenge" && state.showGuides)) return;
      const target = resolvePickObject(event);
      if (!target?.userData?.devPick) return;
      target.getWorldPosition(pickWorldPosition);
      pickScenePosition.copy(target.position);
      const payload = {
        ...target.userData.devPick,
        scenePosition: { x: pickScenePosition.x, y: pickScenePosition.y, z: pickScenePosition.z },
        worldPosition: { x: pickWorldPosition.x, y: pickWorldPosition.y, z: pickWorldPosition.z },
        texture_url: String(
          getOverrideFor(state, target.userData?.devPick?.key)?.texture_url ||
            target.userData?.textureUrl ||
            target.userData?.baseTextureUrl ||
            target.userData?.devPick?.texture_url ||
            ""
        ),
        procedural_vertex_offsets:
          String(target.userData?.mediaType || "") === "procedural"
            ? normalizeProceduralOffsets(target.userData?.proceduralOffsets)
            : undefined,
        procedural_vertex_colors:
          String(target.userData?.mediaType || "") === "procedural"
            ? normalizeProceduralVertexColors(target.userData?.proceduralVertexColors)
            : undefined,
        pointer: { x: event.clientX, y: event.clientY },
      };
      if (typeof onDevObjectPickRef.current === "function") {
        onDevObjectPickRef.current(payload);
      }
    };
    const onCanvasPointerDown = (event) => {
      clickStartX = event.clientX;
      clickStartY = event.clientY;
      const state = dataRef.current;
      const isChallengeEditor = state.mode === "challenge" && state.showGuides;
      const isLoadoutCameraEditor =
        state.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        !!state?.loadoutCameraEditMode;
      const isLoadoutCharacterPreview =
        state.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        !state?.loadoutCameraEditMode;
      if (!(isChallengeEditor || isLoadoutCameraEditor || isLoadoutCharacterPreview)) return;
      const selectedRoadEventId = String(state.devSelectedRoadEventId || "");
      const selectedRoadEvent = findRoadEventById(state, selectedRoadEventId, true);
      const selectedFocus = getSelectedRoadEventFocus(state);
      const target = resolvePickObject(event);
      const pickMeta = target?.userData?.devPick || null;
      if (isLoadoutCharacterPreview) {
        if (event.button !== 0) return;
        if (pickMeta?.type !== "player") return;
        event.preventDefault();
        event.stopPropagation();
        loadoutSpinState.active = true;
        loadoutSpinState.pointerId = event.pointerId;
        loadoutSpinState.startClientX = event.clientX;
        loadoutSpinState.startYaw = animateRefs.loadoutCharacterYawTarget || 0;
        loadoutSpinState.didMove = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      if (isLoadoutCameraEditor) {
        if (!(pickMeta?.type === "loadout_camera" || pickMeta?.type === "loadout_look")) return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        dragState.active = true;
        dragState.pointerId = event.pointerId;
        dragState.object = target;
        dragState.key = String(pickMeta.key || "");
        dragState.y = target.position.y;
        dragState.xMode = "world";
        dragState.yMode = "world";
        dragState.yOffset = target.position.y;
        dragState.startX = target.position.x;
        dragState.startZ = target.position.z;
        dragState.didMove = false;
        dragState.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dragState.y, 0));
        orbitControls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      if (
        state.devInteractionMode === "select" &&
        event.button === 0 &&
        selectedRoadEvent &&
        (!pickMeta || pickMeta.type === "road_event_handle" || isLowPriorityPickTarget(target))
      ) {
        const roadHit = getRoadHitPoint(event);
        if (roadHit) {
          const previewFlow = getPreviewFlowContext(state, roadFlowState.value).flow;
          const selectedFlow = selectedRoadEvent
            ? resolveEventFlowForRender(selectedRoadEvent, previewFlow, selectedFocus)
            : previewFlow;
          const snappedStartZ = snapToGrid(roadHit.z - selectedFlow, 0.5);
          if (typeof onDevRoadEventAdjustRef.current === "function") {
            onDevRoadEventAdjustRef.current({
              id: selectedRoadEvent.id,
              select: true,
              patch: { startZ: snappedStartZ },
              isFinal: false,
            });
          }
          event.preventDefault();
          event.stopPropagation();
          roadEventEditState.active = true;
          roadEventEditState.pointerId = event.pointerId;
          roadEventEditState.eventId = String(selectedRoadEvent.id || "");
          roadEventEditState.startClientX = event.clientX;
          roadEventEditState.startClientY = event.clientY;
          roadEventEditState.startStrength = Number(selectedRoadEvent.strength || 0);
          roadEventEditState.startLength = Math.max(4, Number(selectedRoadEvent.length) || 24);
          roadEventEditState.startStartZ = snappedStartZ;
          roadEventEditState.didMove = false;
          orbitControls.enabled = false;
          renderer.domElement.setPointerCapture?.(event.pointerId);
          return;
        }
      }
      if (!pickMeta) return;
      if (pickMeta.type === "road_event_handle") {
        const eventId = String(pickMeta.id || "");
        const eventDef = findRoadEventById(state, eventId, true);
        if (!eventDef) return;
        if (typeof onDevRoadEventAdjustRef.current === "function") {
          onDevRoadEventAdjustRef.current({
            id: eventId,
            select: true,
            isFinal: false,
          });
        }
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        roadEventEditState.active = true;
        roadEventEditState.pointerId = event.pointerId;
        roadEventEditState.eventId = eventId;
        roadEventEditState.startClientX = event.clientX;
        roadEventEditState.startClientY = event.clientY;
        roadEventEditState.startStrength = Number(eventDef.strength || 0);
        roadEventEditState.startLength = Math.max(4, Number(eventDef.length) || 24);
        roadEventEditState.startStartZ = Number(eventDef.startZ || -34);
        roadEventEditState.didMove = false;
        orbitControls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      const pickKey = String(pickMeta.key || "");
      target.getWorldPosition(pickWorldPosition);
      pickScenePosition.copy(target.position);
      if (typeof onDevObjectPickRef.current === "function") {
        onDevObjectPickRef.current({
          ...pickMeta,
          scenePosition: { x: pickScenePosition.x, y: pickScenePosition.y, z: pickScenePosition.z },
          worldPosition: { x: pickWorldPosition.x, y: pickWorldPosition.y, z: pickWorldPosition.z },
          texture_url: String(
            getOverrideFor(state, pickMeta?.key)?.texture_url ||
              target.userData?.textureUrl ||
              target.userData?.baseTextureUrl ||
            pickMeta?.texture_url ||
            ""
          ),
          pointer: { x: event.clientX, y: event.clientY },
        });
      }
      const activeModelTool = String(state.devModelTool || "move");
      const isModelToolActive =
        activeModelTool === "sculpt" ||
        activeModelTool === "flatten" ||
        activeModelTool === "smooth" ||
        activeModelTool === "inflate" ||
        activeModelTool === "pinch" ||
        activeModelTool === "paint";
      const customEntry = pickMeta.type === "custom" ? getCustomObjectEntryByKey(state, pickKey) : null;
      const customOverride = pickMeta.type === "custom" ? getOverrideFor(state, pickKey) : null;
      const isProcedural = pickMeta.type === "custom" && isCustomObjectProcedural(customEntry, customOverride);
      const isRoadProceduralEdgeBrush =
        pickMeta.type === "road" &&
        pickKey === "road_base" &&
        !!target?.userData?.roadProceduralOffsetField &&
        !!readRoadVisualConfig(state).proceduralEdgeEnabled &&
        activeModelTool !== "paint";
      if (isModelToolActive && (isProcedural || isRoadProceduralEdgeBrush) && String(state.selectedObjectKey || "") === pickKey) {
        if (!(event.button === 0 || event.button === 2)) return;
        event.preventDefault();
        event.stopPropagation();
        const startHeight = isProcedural
          ? toFiniteNumber(customOverride?.height ?? customEntry?.height, 1.2)
          : 1;
        proceduralEditState.active = true;
        proceduralEditState.pointerId = event.pointerId;
        proceduralEditState.key = pickKey;
        proceduralEditState.tool = activeModelTool;
        proceduralEditState.invert = event.button === 2;
        proceduralEditState.primitive = isProcedural
          ? String(customOverride?.procedural_type || customEntry?.procedural_type || "box")
          : "road_edge";
        proceduralEditState.startClientX = event.clientX;
        proceduralEditState.startClientY = event.clientY;
        proceduralEditState.startHeight = startHeight;
        proceduralEditState.lastHeight = startHeight;
        proceduralEditState.object = target;
        proceduralEditState.brushRadius = Math.max(0.05, Number(state.devBrushRadius) || 0.9);
        const baseStrength = Math.max(0.0005, Number(state.devBrushStrength) || 0.025);
        const toolScale = Math.max(0.05, Number(state.devToolStrengths?.[activeModelTool]) || 0.35);
        proceduralEditState.brushStrength = baseStrength * toolScale;
        proceduralEditState.paintColor = String(state.devPaintColor || "#9ca3af");
        orbitControls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      if (state.devInteractionMode !== "move") return;
      if (!canDragObject(pickMeta.type)) return;
      const disableSceneDragForMapEditor =
        state.mode === "challenge" &&
        String(state.devStageEditMode || "map") === "map";
      if (disableSceneDragForMapEditor) return;
      event.preventDefault();
      event.stopPropagation();
      target.getWorldPosition(pickWorldPosition);
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.object = target;
      dragState.key = pickKey;
      dragState.y = target.position.y;
      const isGroundRelativeType =
        pickMeta.type === "custom" ||
        pickMeta.type === "vegetation" ||
        pickMeta.type === "edge_vegetation" ||
        pickMeta.type === "boss";
      const xModeRaw =
        pickMeta.type === "custom"
          ? String(customOverride?.x_mode || customEntry?.x_mode || "relative_curve")
          : pickMeta.type === "boss"
            ? String(getOverrideFor(state, pickKey)?.x_mode || "relative_curve")
          : isGroundRelativeType
            ? String(getOverrideFor(state, pickKey)?.x_mode || "relative_curve")
            : "world";
      const yModeRaw =
        pickMeta.type === "custom"
          ? String(customOverride?.y_mode || customEntry?.y_mode || "relative_ground")
          : pickMeta.type === "boss"
            ? String(getOverrideFor(state, pickKey)?.y_mode || "relative_ground")
          : isGroundRelativeType
            ? String(getOverrideFor(state, pickKey)?.y_mode || "relative_ground")
            : "world";
      dragState.xMode = xModeRaw === "relative_curve" ? "relative_curve" : "world";
      dragState.yMode = yModeRaw === "relative_ground" ? "relative_ground" : "world";
      const dragRoadSculpt = readRoadSculpt(state);
      const dragRenderFlow = getPreviewFlowContext(state, roadFlowState.value).flow;
      dragState.yOffset =
        dragState.yMode === "relative_ground"
          ? target.position.y - dropAt(target.position.z, dragRoadSculpt, dragRenderFlow)
          : target.position.y;
      dragState.startX = target.position.x;
      dragState.startZ = target.position.z;
      dragState.startClientX = event.clientX;
      dragState.startClientY = event.clientY;
      dragState.lastClientX = event.clientX;
      dragState.lastClientY = event.clientY;
      dragState.engaged = false;
      dragState.didMove = false;
      dragState.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dragState.y, 0));
      orbitControls.enabled = false;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const onCanvasPointerMove = (event) => {
      if (roadEventEditState.active && roadEventEditState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        const dx = event.clientX - roadEventEditState.startClientX;
        const dy = event.clientY - roadEventEditState.startClientY;
        const nextStrength = Math.max(-180, Math.min(180, roadEventEditState.startStrength + dx * 0.06));
        const nextLength = Math.max(4, Math.min(160, roadEventEditState.startLength - dy * 0.2));
        const nextStartZ = event.ctrlKey || event.metaKey
          ? Math.max(ROAD_EVENT_START_Z_MIN, Math.min(ROAD_EVENT_START_Z_MAX, roadEventEditState.startStartZ - dy * 0.16))
          : roadEventEditState.startStartZ;
        roadEventEditState.didMove =
          Math.abs(nextStrength - roadEventEditState.startStrength) > 0.0001 ||
          Math.abs(nextLength - roadEventEditState.startLength) > 0.0001 ||
          Math.abs(nextStartZ - roadEventEditState.startStartZ) > 0.0001;
        if (typeof onDevRoadEventAdjustRef.current === "function") {
          onDevRoadEventAdjustRef.current({
            id: roadEventEditState.eventId,
            patch: {
              strength: Number(nextStrength.toFixed(2)),
              length: Number(nextLength.toFixed(1)),
              startZ: Number(nextStartZ.toFixed(1)),
            },
            isFinal: false,
          });
        }
        return;
      }
      if (proceduralEditState.active && proceduralEditState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        if (!toPointerNdc(event)) return;
        pickRaycaster.setFromCamera(pickPointerNdc, camera);
        const targetObject = proceduralEditState.object;
        if (!targetObject) return;
        const hits = pickRaycaster.intersectObject(targetObject, true);
        if (!hits.length) {
          proceduralBrushCursor.visible = false;
          return;
        }
        const hit = hits[0];
        const hitPointLocal = targetObject.worldToLocal(hit.point.clone());
        proceduralBrushCursor.visible = true;
        proceduralBrushCursor.position.copy(hit.point);
        proceduralBrushCursor.scale.setScalar(Math.max(0.08, proceduralEditState.brushRadius));
        if (proceduralEditState.tool === "paint") {
          const appliedColors = applyPaintToProceduralMesh(
            targetObject,
            hitPointLocal,
            proceduralEditState.brushRadius,
            proceduralEditState.paintColor,
            proceduralEditState.invert
          );
          if (!appliedColors) return;
          if (typeof onDevProceduralEditRef.current === "function") {
            onDevProceduralEditRef.current({
              key: proceduralEditState.key,
              patch: { procedural_vertex_colors: normalizeProceduralVertexColors(appliedColors) },
              isFinal: false,
            });
          }
          return;
        }
        const appliedOffsets = targetObject.userData?.isRoadProceduralGrass
          ? applyBrushToRoadEdgeMesh(
              targetObject,
              hitPointLocal,
              proceduralEditState.tool,
              proceduralEditState.brushRadius,
              proceduralEditState.brushStrength,
              proceduralEditState.invert
            )
          : applyBrushToProceduralMesh(
              targetObject,
              hitPointLocal,
              proceduralEditState.tool,
              proceduralEditState.brushRadius,
              proceduralEditState.brushStrength,
              proceduralEditState.invert
            );
        if (!appliedOffsets) return;
        if (typeof onDevProceduralEditRef.current === "function") {
          onDevProceduralEditRef.current({
            key: proceduralEditState.key,
            patch: targetObject.userData?.isRoadProceduralGrass
              ? {
                  [String(targetObject.userData?.roadProceduralOffsetField || "procedural_grass_vertex_offsets_left")]:
                    normalizeProceduralOffsets(appliedOffsets),
                }
              : { procedural_vertex_offsets: normalizeProceduralOffsets(appliedOffsets) },
            isFinal: false,
          });
        }
        return;
      }
      if (loadoutSpinState.active && loadoutSpinState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        const dx = event.clientX - loadoutSpinState.startClientX;
        if (Math.abs(dx) > 1) loadoutSpinState.didMove = true;
        animateRefs.loadoutCharacterYawTarget = loadoutSpinState.startYaw + dx * 0.0125;
        return;
      }
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const stateNow = dataRef.current;
      let nx = dragState.object.position.x;
      let nz = dragState.object.position.z;
      const useFineMapDrag =
        String(stateNow?.devStageEditMode || "map") === "map" &&
        dragState.key !== "loadout_camera" &&
        dragState.key !== "loadout_look";
      if (useFineMapDrag) {
        const totalDx = event.clientX - dragState.startClientX;
        const totalDy = event.clientY - dragState.startClientY;
        if (!dragState.engaged) {
          if (Math.hypot(totalDx, totalDy) < 14) return;
          dragState.engaged = true;
          dragState.lastClientX = event.clientX;
          dragState.lastClientY = event.clientY;
          return;
        }
        const dx = Math.max(-10, Math.min(10, event.clientX - dragState.lastClientX));
        const dy = Math.max(-10, Math.min(10, event.clientY - dragState.lastClientY));
        dragState.lastClientX = event.clientX;
        dragState.lastClientY = event.clientY;
        const sensitivity = event.shiftKey ? 0.0006 : 0.0016;
        nx = snapToGrid(dragState.object.position.x + dx * sensitivity, 0.02);
        nz = snapToGrid(dragState.object.position.z + dy * sensitivity, 0.02);
      } else {
        if (!toPointerNdc(event)) return;
        pickRaycaster.setFromCamera(pickPointerNdc, camera);
        if (!pickRaycaster.ray.intersectPlane(dragState.plane, dragPlaneHit)) return;
        nx = snapToGrid(dragPlaneHit.x, 0.5);
        nz = snapToGrid(dragPlaneHit.z, 0.5);
      }
      const moved = Math.abs(nx - dragState.startX) > 0.0001 || Math.abs(nz - dragState.startZ) > 0.0001;
      if (!moved) return;
      dragState.didMove = true;
      if (dragState.key === "loadout_camera" || dragState.key === "loadout_look") {
        dragState.object.position.set(nx, dragState.y, nz);
        if (typeof onLoadoutCameraRigChangeRef.current === "function") {
          onLoadoutCameraRigChangeRef.current({
            part: dragState.key === "loadout_camera" ? "camera" : "target",
            x: nx,
            z: nz,
            isFinal: false,
          });
        }
        return;
      }
      const movingRoadSculpt = readRoadSculpt(stateNow);
      const movingRenderFlow = getPreviewFlowContext(stateNow, roadFlowState.value).flow;
      const ny =
        dragState.yMode === "relative_ground"
          ? dropAt(nz, movingRoadSculpt, movingRenderFlow) + dragState.yOffset
          : dragState.y;
      dragState.object.position.set(nx, ny, nz);
      const storedX =
        dragState.xMode === "relative_curve"
          ? dragState.object.position.x - curveOffsetAt(nz, stateNow.roadCurve || 0, movingRoadSculpt, movingRenderFlow)
          : dragState.object.position.x;
      const storedY =
        dragState.yMode === "relative_ground"
          ? dragState.object.position.y - dropAt(nz, movingRoadSculpt, movingRenderFlow)
          : dragState.object.position.y;
      if (typeof onDevObjectTransformRef.current === "function") {
        onDevObjectTransformRef.current({
          key: dragState.key,
          scenePosition: {
            x: dragState.object.position.x,
            y: dragState.object.position.y,
            z: dragState.object.position.z,
          },
          storedPosition: {
            x: storedX,
            y: storedY,
            z: nz,
          },
          x_mode: dragState.xMode,
          y_mode: dragState.yMode,
          isFinal: false,
        });
      }
    };
    const onCanvasPointerUp = (event) => {
      if (roadEventEditState.active && roadEventEditState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onDevRoadEventAdjustRef.current === "function") {
          onDevRoadEventAdjustRef.current({
            id: roadEventEditState.eventId,
            select: true,
            isFinal: true,
          });
        }
        clearRoadEventEditState(event.pointerId);
        return;
      }
      if (proceduralEditState.active && proceduralEditState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onDevProceduralEditRef.current === "function") {
          onDevProceduralEditRef.current({
            key: proceduralEditState.key,
            patch: proceduralEditState.object?.userData?.isRoadProceduralGrass
              ? {
                  [String(
                    proceduralEditState.object?.userData?.roadProceduralOffsetField ||
                      "procedural_grass_vertex_offsets_left"
                  )]: normalizeProceduralOffsets(proceduralEditState.object?.userData?.proceduralOffsets),
                }
              : {
                  procedural_vertex_offsets: normalizeProceduralOffsets(
                    proceduralEditState.object?.userData?.proceduralOffsets
                  ),
                  procedural_vertex_colors: normalizeProceduralVertexColors(
                    proceduralEditState.object?.userData?.proceduralVertexColors
                  ),
                },
            isFinal: true,
          });
        }
        clearProceduralEditState(event.pointerId);
        return;
      }
      if (loadoutSpinState.active && loadoutSpinState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        clearLoadoutSpinState(event.pointerId);
        return;
      }
      if (dragState.active && dragState.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        if (
          dragState.didMove &&
          (dragState.key === "loadout_camera" || dragState.key === "loadout_look") &&
          typeof onLoadoutCameraRigChangeRef.current === "function"
        ) {
          onLoadoutCameraRigChangeRef.current({
            part: dragState.key === "loadout_camera" ? "camera" : "target",
            x: dragState.object.position.x,
            z: dragState.object.position.z,
            isFinal: true,
          });
        }
        if (
          dragState.didMove &&
          dragState.key !== "loadout_camera" &&
          dragState.key !== "loadout_look" &&
          typeof onDevObjectTransformRef.current === "function"
        ) {
          const stateNow = dataRef.current;
          const sculptNow = readRoadSculpt(stateNow);
          const flowNow = getPreviewFlowContext(stateNow, roadFlowState.value).flow;
          const zNow = Number(dragState.object.position.z) || 0;
          const storedX =
            dragState.xMode === "relative_curve"
              ? dragState.object.position.x - curveOffsetAt(zNow, stateNow.roadCurve || 0, sculptNow, flowNow)
              : dragState.object.position.x;
          const storedY =
            dragState.yMode === "relative_ground"
              ? dragState.object.position.y - dropAt(zNow, sculptNow, flowNow)
              : dragState.object.position.y;
          onDevObjectTransformRef.current({
            key: dragState.key,
            scenePosition: {
              x: dragState.object.position.x,
              y: dragState.object.position.y,
              z: dragState.object.position.z,
            },
            storedPosition: {
              x: storedX,
              y: storedY,
              z: zNow,
            },
            x_mode: dragState.xMode,
            y_mode: dragState.yMode,
            isFinal: true,
          });
        }
        clearDragState(event.pointerId);
        return;
      }
      const moved = Math.hypot(event.clientX - clickStartX, event.clientY - clickStartY);
      if (moved > 6) return;
    };
    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown, { capture: true });
    renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
    renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
    renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
    const onCanvasContextMenu = (event) => {
      const state = dataRef.current;
      const activeTool = String(state?.devModelTool || "move");
      const isSurfaceTool =
        activeTool === "sculpt" ||
        activeTool === "flatten" ||
        activeTool === "smooth" ||
        activeTool === "inflate" ||
        activeTool === "pinch";
      if (state?.mode === "challenge" && state?.showGuides && isSurfaceTool) {
        event.preventDefault();
      }
    };
    renderer.domElement.addEventListener("contextmenu", onCanvasContextMenu);
    const onControlsStart = () => {
      const state = dataRef.current;
      if (!(state?.mode === "challenge" && state?.showGuides)) return;
      if (typeof onDevCameraInteractRef.current === "function") {
        onDevCameraInteractRef.current();
      }
    };
    loadOrbitControlsModule()
      .then(({ OrbitControls }) => {
        if (orbitControlsDisposed) return;
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enabled = orbitControls.enabled;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.screenSpacePanning = false;
        controls.panSpeed = 1.35;
        controls.rotateSpeed = 0.85;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 2.5;
        controls.maxDistance = 320;
        controls.maxPolarAngle = Math.PI - 0.04;
        controls.mouseButtons = { ...orbitControls.mouseButtons };
        controls.target.copy(orbitControls.target);
        controls.update();
        controls.addEventListener("start", onControlsStart);
        orbitControls = controls;
        orbitControlsActiveInstance = controls;
      })
      .catch(() => {});

    const animate = (ts) => {
      const rawState = dataRef.current;
      const liveRunnerState = rawState?.runnerStateRef?.current || rawState?.runnerState || null;
      const state = liveRunnerState === rawState?.runnerState ? rawState : { ...rawState, runnerState: liveRunnerState };
      const graphicsSettingsNow = readGraphicsSettings(state.graphicsSettings);
      const sceneRenderBase = state.sceneRenderDraft || DEFAULT_SCENE_RENDER;
      const lowDetailScale =
        graphicsSettingsNow.detailLevel === "low"
          ? (isLowPerfDevice ? 0.4 : 0.52)
          : graphicsSettingsNow.detailLevel === "medium"
            ? (isLowPerfDevice ? 0.58 : 0.82)
            : isLowPerfDevice
              ? 0.72
              : 1;
      const sceneRender = {
        ...sceneRenderBase,
        masterDistance: Math.max(80, Number(sceneRenderBase.masterDistance || DEFAULT_SCENE_RENDER.masterDistance) * lowDetailScale),
        vegetationDistance: Math.max(20, Number(sceneRenderBase.vegetationDistance || DEFAULT_SCENE_RENDER.vegetationDistance) * lowDetailScale),
        roadDistance: Math.max(28, Number(sceneRenderBase.roadDistance || DEFAULT_SCENE_RENDER.roadDistance) * lowDetailScale),
        objectDistance: Math.max(18, Number(sceneRenderBase.objectDistance || DEFAULT_SCENE_RENDER.objectDistance) * lowDetailScale),
      };
      const masterDistance = Math.max(10, Math.abs(sceneRender.masterDistance ?? DEFAULT_SCENE_RENDER.masterDistance));
      const vegetationCutoffZ = -Math.abs(Math.min(sceneRender.vegetationDistance, masterDistance));
      const roadCutoffZ = -Math.abs(Math.min(sceneRender.roadDistance, masterDistance));
      const objectCutoffZ = -Math.abs(Math.min(sceneRender.objectDistance, masterDistance));
      const roadRearCutoffZ = 7.5;
      const vegetationRearCutoffZ = 6.5;
      const objectRearCutoffZ = 8;
      const shadowsVisible = Boolean(sceneRender.shadowsEnabled);
      directional.position.set(sceneRender.lightX, sceneRender.lightY, sceneRender.lightZ);
      fillDirectional.position.set(sceneRender.lightX - 3.8, Math.max(2, sceneRender.lightY - 1.6), sceneRender.lightZ + 1.6);
      rimDirectional.position.set(sceneRender.lightX + 0.8, Math.max(2, sceneRender.lightY - 2.2), sceneRender.lightZ - 5.2);
      directional.visible = fillDirectional.visible = rimDirectional.visible = shadowsVisible;
      if (!animateRefs.lastTs) animateRefs.lastTs = ts;
      if (!animateRefs.lastRenderTs) animateRefs.lastRenderTs = ts;
      if (!animateRefs.introStartTs) animateRefs.introStartTs = ts;
      const frameBudgetMs = graphicsSettingsNow.fpsCap > 0 ? 1000 / graphicsSettingsNow.fpsCap : 0;
      if (frameBudgetMs > 0 && ts - animateRefs.lastRenderTs < frameBudgetMs) {
        animateRefs.rafId = requestAnimationFrame(animate);
        return;
      }
      const rawDt = Math.max(0.001, Math.min(0.034, (ts - animateRefs.lastTs) / 1000));
      animateRefs.lastTs = ts;
      animateRefs.lastRenderTs = ts;
      const dt = state.isPaused ? 0 : rawDt;
      const runnerStatusNow = String(state?.runnerState?.status || "");
      const collisionTypeNow = String(state?.runnerState?.collisionType || "");
      const cinematicDt =
        runnerStatusNow === "collision" && collisionTypeNow === "pit_gap"
          ? rawDt
          : dt;
      animateRefs.sceneMs += cinematicDt * 1000;
      const sceneMs = animateRefs.sceneMs;
      animateRefs.loadoutCharacterYaw +=
        (animateRefs.loadoutCharacterYawTarget - animateRefs.loadoutCharacterYaw) * Math.min(1, cinematicDt * 10);
      const runnerStatus = runnerStatusNow;
      const collisionType = collisionTypeNow;
      if (runnerStatus !== animateRefs.lastRunnerStatus) {
        if (runnerStatus === "collision") {
          animateRefs.collisionStartTs = sceneMs;
          animateRefs.pitCollisionStartRealTs = ts;
          if (collisionType === "pit_gap") {
            animateRefs.pitFallCameraStartX = camera.position.x;
            animateRefs.pitFallCameraStartY = camera.position.y;
            animateRefs.pitFallCameraStartZ = camera.position.z;
            camera.getWorldDirection(pitFallCameraLookCapture);
            pitFallCameraLookCapture.multiplyScalar(8).add(camera.position);
            animateRefs.pitFallLookStartX = pitFallCameraLookCapture.x;
            animateRefs.pitFallLookStartY = pitFallCameraLookCapture.y;
            animateRefs.pitFallLookStartZ = pitFallCameraLookCapture.z;
            animateRefs.pitFallFocusZ = -1.95;
            animateRefs.pitFallFocusX = camera.position.x;
          }
        }
        animateRefs.lastRunnerStatus = runnerStatus;
      }
      const collisionProgress =
        runnerStatus !== "collision"
          ? 0
          : collisionType === "pit_gap"
            ? clamp01((ts - animateRefs.pitCollisionStartRealTs) / 1800)
            : clamp01((sceneMs - animateRefs.collisionStartTs) / 1200);

      let introProgress = 0;
      if (state.mode === "intro") {
        if (readyNotified && !introStarted) {
          animateRefs.introStartTs = sceneMs;
          introStarted = true;
        }
        introProgress = introStarted ? clamp01((sceneMs - animateRefs.introStartTs) / 1800) : 0;
      }
      const curveValue = state.roadCurve || 0;
      const roadSculpt = readRoadSculpt(state);
      const followDistance = Math.max(4, Math.min(24, Number(state.devCameraFollowDistance) || 8.5));
      const isFullMapStageMode =
        state.mode === "challenge" &&
        state.showGuides &&
        String(state?.devStageEditMode || "map") === "full_map";
      const allowResultLoadoutFreeCamera =
        state.mode === "result" && String(state.resultCameraVariant || "") === "loadout_hero";
      const freeCameraActive = isFullMapStageMode || (state.enableFreeCamera && (state.mode === "challenge" || allowResultLoadoutFreeCamera));
      if (state.mode === "challenge" && state.showGuides) {
        const selected = findObjectByDevKey(String(state.selectedObjectKey || ""));
        const selectedProcedural =
          !!selected &&
          String(selected?.userData?.mediaType || "") === "procedural";
        const hasRoadEventSelected = !!findRoadEventById(state, state.devSelectedRoadEventId, true);
        const activeTool = String(state.devModelTool || "move");
        let nextCursor = "default";
        if (selectedProcedural && activeTool === "sculpt") nextCursor = "ns-resize";
        else if (selectedProcedural && activeTool === "flatten") nextCursor = "row-resize";
        else if (selectedProcedural && activeTool === "smooth") nextCursor = "alias";
        else if (selectedProcedural && activeTool === "inflate") nextCursor = "copy";
        else if (selectedProcedural && activeTool === "pinch") nextCursor = "not-allowed";
        else if (roadEventEditState.active) nextCursor = "grabbing";
        else if (hasRoadEventSelected && state.devInteractionMode === "select") nextCursor = "crosshair";
        else if (state.devInteractionMode === "move") nextCursor = "grab";
        renderer.domElement.style.cursor = nextCursor;
      } else {
        renderer.domElement.style.cursor = "default";
      }
      if (dragState.active && (!dragState.object || state.devInteractionMode !== "move")) {
        clearDragState();
      }
      if (proceduralEditState.active && state.mode !== "challenge") {
        clearProceduralEditState();
      }
      if (roadEventEditState.active && state.mode !== "challenge") {
        clearRoadEventEditState();
      }
      const previewFlowForView = getPreviewFlowContext(state, roadFlowState.value).flow;
      const previewRoadEvents = readRoadEvents(state);
      const previewSelectedFocus = getSelectedRoadEventFocus(state);
      const gameplayPlayerZ = -2.15;
      const gameplayLane = Number(state.runnerState?.laneVisual) || 0;
      const gameplayRoadCenterX = curveOffsetAt(
        gameplayPlayerZ,
        curveValue,
        roadSculpt,
        previewFlowForView,
        previewRoadEvents,
        previewSelectedFocus
      );
      const gameplayPlayerX = laneToX(
        gameplayLane,
        gameplayPlayerZ,
        curveValue,
        roadSculpt,
        previewFlowForView,
        previewRoadEvents,
        previewSelectedFocus
      );
      const gameplayCamHalfWidth = Math.max(1.1, ROAD_WIDTH * 0.5 - 0.52);
      const gameplayTargetX = THREE.MathUtils.clamp(
        gameplayPlayerX * 0.86 + gameplayRoadCenterX * 0.14,
        gameplayRoadCenterX - gameplayCamHalfWidth,
        gameplayRoadCenterX + gameplayCamHalfWidth
      );
      const gameplayGroundY = dropAt(gameplayPlayerZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus);
      const gameplayLookZ = -10.8;
      const gameplayLookLane = THREE.MathUtils.clamp(gameplayLane * 0.58, -1.25, 1.25);
      const gameplayLookXLane = laneToX(
        gameplayLookLane,
        gameplayLookZ,
        curveValue,
        roadSculpt,
        previewFlowForView,
        previewRoadEvents,
        previewSelectedFocus
      );
      const gameplayLookXCurve =
        curveOffsetAt(gameplayLookZ, curveValue, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus) * 0.45;
      const gameplayLookX = gameplayLookXLane * 0.82 + gameplayLookXCurve * 0.18;
      if (!animateRefs.smoothedGameplayTargetX && animateRefs.smoothedGameplayTargetX !== 0) {
        animateRefs.smoothedGameplayTargetX = gameplayTargetX;
      }
      if (!animateRefs.smoothedGameplayLookX && animateRefs.smoothedGameplayLookX !== 0) {
        animateRefs.smoothedGameplayLookX = gameplayLookX;
      }
      const mobileCurveSmoothing = isSmallViewport ? Math.min(1, dt * 6.5) : 1;
      animateRefs.smoothedGameplayTargetX += (gameplayTargetX - animateRefs.smoothedGameplayTargetX) * mobileCurveSmoothing;
      animateRefs.smoothedGameplayLookX += (gameplayLookX - animateRefs.smoothedGameplayLookX) * mobileCurveSmoothing;
      const stableGameplayTargetX = isSmallViewport ? animateRefs.smoothedGameplayTargetX : gameplayTargetX;
      const stableGameplayLookX = isSmallViewport ? animateRefs.smoothedGameplayLookX : gameplayLookX;
      const gameplayTurnStress = clamp01(Math.abs(gameplayLookX - gameplayTargetX) / 3.2);
      const gameplayTargetY = 4.48 + gameplayGroundY + gameplayTurnStress * 0.86;
      const gameplayTargetZ = followDistance - 0.82 + gameplayTurnStress * 1.08;
      const gameplayLookY = 1.24 + dropAt(gameplayLookZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus) * 0.9;

      const resultPhase = String(state?.runnerState?.resultPhase || "arrival");
      const resultCameraVariant = String(state?.resultCameraVariant || "default");
      const resultShowChestOnly = !!state?.runnerState?.resultShowChestOnly;
      const resultPlayerZ = resultShowChestOnly ? -5.4 : resultPhase === "arrival" ? -3.8 : -6.2;
      const rawResultGroundY = state?.hideEnvironment
        ? 0
        : dropAt(resultPlayerZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus);
      const resultGroundY = state?.hideEnvironment ? 0 : THREE.MathUtils.clamp(rawResultGroundY, -0.18, 1.12);
      const isLoadoutHeroShot = resultCameraVariant === "loadout_hero" && resultPhase !== "arrival";
      const loadoutRig = normalizeLoadoutCameraRig(state?.loadoutCameraRig);
      const chestFocusZ = resultShowChestOnly ? -3.02 : resultPhase === "arrival" ? -2.85 : -3.2;
      const chestFocusGroundY = state?.hideEnvironment
        ? 0
        : THREE.MathUtils.clamp(
            dropAt(chestFocusZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus),
            -0.18,
            1.12
          );
      const resultCameraPos = new THREE.Vector3(
        isLoadoutHeroShot ? loadoutRig.cameraX : 0,
        resultShowChestOnly
          ? chestFocusGroundY + 2.05
          : resultGroundY + (resultPhase === "arrival" ? 2.18 : isLoadoutHeroShot ? loadoutRig.cameraYOffset : 1.24),
        resultShowChestOnly
          ? 1.65
          : resultPhase === "arrival"
            ? 2.2
            : isLoadoutHeroShot
              ? loadoutRig.cameraZ
              : 0.35
      );
      const resultCameraLook = new THREE.Vector3(
        isLoadoutHeroShot ? loadoutRig.targetX : 0,
        resultShowChestOnly
          ? chestFocusGroundY + 0.92
          : resultGroundY + (resultPhase === "arrival" ? 1.38 : isLoadoutHeroShot ? loadoutRig.targetYOffset : 2.24),
        resultShowChestOnly
          ? chestFocusZ - 0.04
          : resultPhase === "arrival"
            ? resultPlayerZ + 0.02
            : isLoadoutHeroShot
              ? loadoutRig.targetZ
              : resultPlayerZ - 0.32
      );
      if (isFullMapStageMode) {
        const fullMapFocusZ = THREE.MathUtils.clamp(-56 + Number(state?.devMapCursorZ || 0), -180, 8);
        playerViewCameraPos.set(0, 56, fullMapFocusZ + 2);
        playerViewCameraLook.set(0, 0.8, fullMapFocusZ);
      } else if (state.mode === "result") {
        playerViewCameraPos.copy(resultCameraPos);
        playerViewCameraLook.copy(resultCameraLook);
      } else if (state.mode === "intro") {
        const t = introProgress * introProgress * (3 - 2 * introProgress);
        const settle = clamp01((t - 0.78) / 0.22);
        playerViewCameraPos.set(
          THREE.MathUtils.lerp(curveValue * 0.03 + Math.sin(t * Math.PI) * 1.15, stableGameplayTargetX, settle),
          THREE.MathUtils.lerp(15.2 - t * 10.5 + Math.sin(t * Math.PI * 1.4) * 0.35, gameplayTargetY, settle),
          THREE.MathUtils.lerp(25.5 - t * 16.8, gameplayTargetZ, settle)
        );
        const introLookY = 3.8 - t * 2.6;
        const introLookZ = -46 + t * 30;
        const introLookX =
          curveOffsetAt(introLookZ, curveValue, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus) *
          (0.12 + t * 0.32);
        playerViewCameraLook.set(
          THREE.MathUtils.lerp(introLookX, stableGameplayLookX, settle),
          THREE.MathUtils.lerp(introLookY, gameplayLookY, settle),
          THREE.MathUtils.lerp(introLookZ, gameplayLookZ, settle)
        );
      } else {
        const playerViewGroundY =
          dropAt(gameplayPlayerZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus) +
          Number(state?.runnerState?.trackHeightVisual || 0);
        const lookZ = gameplayLookZ;
        const lookY = 1.22 + dropAt(lookZ, roadSculpt, previewFlowForView, previewRoadEvents, previewSelectedFocus) * 0.85;
        playerViewCameraPos.set(stableGameplayTargetX, 4.7, gameplayTargetZ);
        playerViewCameraPos.y = 4.7 + playerViewGroundY;
        playerViewCameraLook.set(
          stableGameplayLookX,
          lookY,
          lookZ
        );
      }
      const effectiveSpeed =
        state.isPaused
          ? 0
          : state.mode === "intro"
          ? 0
          : state.mode === "result"
          ? 0
          : String(state?.runnerState?.status || "") === "collision"
          ? 0
          : Math.max(0.45, Number(state.runnerState?.speed) || 0.72);
      const frameResultPhase = String(state?.runnerState?.resultPhase || "arrival");
      const frameIsLoadoutHeroPose =
        state.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        frameResultPhase !== "arrival";
      const frameUseAlternateLoadoutCharacter =
        frameIsLoadoutHeroPose &&
        String(loadoutSwapState.activeVariant || state?.loadoutCharacterVariant || "hero") === "shadow" &&
        !!loadoutAltModelState.root &&
        !!loadoutAltModelState.readyForSwap;
      const conveyorOffsetNow = Number(state.devConveyorOffset) || 0;
      const conveyorDelta = conveyorOffsetNow - (Number(animateRefs.lastConveyorOffset) || 0);
      animateRefs.lastConveyorOffset = conveyorOffsetNow;
      const manualConveyorFlow = state.mode === "challenge" && state.showGuides ? conveyorDelta : 0;
      if (playerAnimationState.mixer && !frameUseAlternateLoadoutCharacter) {
        const collectPulse = Number(state?.runnerState?.collectPulse || 0);
        const isSliding = Number(state?.runnerState?.slide || 0) > 0.08;
        const isJumping = Number(state?.runnerState?.jump || 0) > 0.08;
        if (!isSliding && !isJumping && collectPulse > 0.02) {
          playerAnimationState.collectTimer = Math.max(playerAnimationState.collectTimer, 0.28);
        } else {
          playerAnimationState.collectTimer = Math.max(0, playerAnimationState.collectTimer - dt);
        }
        if (String(state?.runnerState?.status || "") === "collision") {
          playerAnimationState.hitTimer = Math.max(playerAnimationState.hitTimer, 0.9);
        } else {
          playerAnimationState.hitTimer = Math.max(0, playerAnimationState.hitTimer - dt);
        }
        switchPlayerAnimation(choosePlayerAnimationKey(state));
        playerAnimationState.mixer.update(dt || 0.001);
      }
      if (loadoutAltModelState.mixer && frameIsLoadoutHeroPose) {
        loadoutAltModelState.mixer.update(dt || 0.001);
        if (!loadoutAltModelState.readyForSwap) {
          loadoutAltModelState.readyForSwap = true;
        }
      }
      syncLoadoutWardrobe(state);

      scene.background = state?.transparentBackground || state?.hideEnvironment
        ? null
        : safeColor(state.islandTheme.sky_top, "#0f172a");
      const sceneLook = readSceneLook(state);
      applyRendererPixelRatio(graphicsSettingsNow);
      renderer.toneMappingExposure = sceneLook.exposure;
      ambient.intensity = sceneLook.ambientIntensity;
      hemisphere.intensity = sceneLook.hemisphereIntensity;
      directional.intensity = sceneLook.keyIntensity;
      fillDirectional.intensity = sceneLook.fillIntensity;
      rimDirectional.intensity = sceneLook.rimIntensity;
      renderer.domElement.style.filter = `saturate(${sceneLook.saturation}) contrast(${sceneLook.contrast}) brightness(${sceneLook.brightness})`;
      if (state.showGuides) {
        roadMat.color.setHex(0xe3e3e3); // road_base
        shoulderMaterial.color.setHex(0xf5c58d); // road_shoulder
        grassMaterial.color.setHex(0x57b25f); // grass_top
        proceduralGrassMaterial.color.setHex(proceduralGrassMaterial.map ? 0xffffff : 0x57b25f);
      }
      laneMeshes.forEach((mesh) => {
        mesh.visible = !!state.showGuides;
      });
      devGrid.visible = !!state.showGuides;
      devBlockGuides.visible = !!state.showGuides;
      sceneCutoffGuideGroup.visible = !!state.showGuides;
      if (state.showGuides) {
        const guideConfigs = [
          { guide: sceneCutoffGuides.vegetation, z: vegetationCutoffZ, y: 0.04, text: `VEGETACAO ${Math.abs(Math.round(sceneRender.vegetationDistance))}m` },
          { guide: sceneCutoffGuides.road, z: roadCutoffZ, y: 0.08, text: `ESTRADA ${Math.abs(Math.round(sceneRender.roadDistance))}m` },
          { guide: sceneCutoffGuides.object, z: objectCutoffZ, y: 0.12, text: `OBJETOS ${Math.abs(Math.round(sceneRender.objectDistance))}m` },
        ];
        guideConfigs.forEach(({ guide, z, y, text }) => {
          guide.position.set(0, y, z);
          if (guide.userData.lastLabel !== text) {
            guide.userData.labelSprite?.userData?.drawLabel?.(text);
            guide.userData.lastLabel = text;
          }
        });
      }
      const roadVisual = readRoadVisualConfig(state);
      const proceduralTextureMeta = syncProceduralEdgeTextures(roadVisual);
      const hasRoadChunkModel = !!roadVisual.roadModelUrl;
      const isResultStage = state.mode === "result" && String(state?.resultCameraVariant || "default") !== "loadout_hero";
      const showBaseRoadSurface = isResultStage ? true : !hasRoadChunkModel;
      const hideEnvironmentVisuals = !!state?.hideEnvironment;
      const horizonOverride = getOverrideFor(state, "horizon") || {};
      const horizonStyle = readHorizonStyle(state);
      horizonCurveUniforms.curveSide.value = Number(horizonStyle?.curveSide || 0);
      horizonCurveUniforms.curveDown.value = Number(horizonStyle?.curveDown || 0);
      horizonCurveUniforms.grade.value = Number(horizonStyle?.visualGrade || 0);
      horizonMesh.visible = !hideEnvironmentVisuals && !isFullMapStageMode;
      horizonMesh.material.color.set(isLoadoutHeroShot ? 0x7e8a9a : isResultStage ? 0xf7efe0 : 0xffffff);
      horizonMesh.material.opacity = isLoadoutHeroShot ? 0.78 : isResultStage ? 0.96 : 1;
      roadMesh.visible = !hideEnvironmentVisuals && !isHiddenByOverride(state, "road_base") && showBaseRoadSurface;
      roadWearMesh.visible = !hideEnvironmentVisuals && !isHiddenByOverride(state, "road_base") && showBaseRoadSurface;
      shoulderMeshes.forEach((mesh) => {
        mesh.visible = !hideEnvironmentVisuals && !isHiddenByOverride(state, "road_base") && showBaseRoadSurface;
      });
      grassMeshes.forEach((mesh) => {
        mesh.visible = !hideEnvironmentVisuals && !isHiddenByOverride(state, "road_base") && showBaseRoadSurface;
      });
      proceduralGrassBlockMeshes.forEach((mesh) => {
        mesh.visible =
          !hideEnvironmentVisuals && !isHiddenByOverride(state, "road_base") && roadVisual.proceduralEdgeEnabled && showBaseRoadSurface;
      });
      const horizonScale = Math.max(0.6, toFiniteNumber(horizonOverride?.scale, 1));
      const horizonScaleX = Math.max(0.2, toFiniteNumber(horizonOverride?.scale_x, 1));
      const horizonScaleY = Math.max(0.2, toFiniteNumber(horizonOverride?.scale_y, 1));
      const horizonWorldZ = HORIZON_BASE_POS.z + Math.max(-260, Math.min(120, toFiniteNumber(horizonOverride?.z, 0)));
      horizonMesh.scale.set(horizonScale * horizonScaleX, horizonScale * horizonScaleY, 1);
      horizonMesh.rotation.y = toRad(toFiniteNumber(horizonOverride?.rotation_y, 0));
      horizonMesh.position.set(
        HORIZON_BASE_POS.x + curveValue * 0.2 + Math.max(-60, Math.min(60, toFiniteNumber(horizonOverride?.x, 0))),
        HORIZON_BASE_POS.y + Math.max(-20, Math.min(20, toFiniteNumber(horizonOverride?.y, 0))) + Number(horizonStyle?.visualGrade || 0) * 0.08,
        horizonWorldZ
      );
      hazeNearRoadMesh.position.x = curveValue * 0.22;
      hazeMidRoadMesh.position.x = curveValue * 0.24;
      hazeNearRoadMesh.visible = !hideEnvironmentVisuals && !isFullMapStageMode;
      hazeMidRoadMesh.visible = !hideEnvironmentVisuals && !isFullMapStageMode;
      hazeNearRoadMesh.material.opacity = isResultStage ? 0.12 : 0;
      hazeMidRoadMesh.material.opacity = isResultStage ? 0.08 : 0;
      hazeNearRoadMesh.material.color.set(isLoadoutHeroShot ? 0x0f172a : 0xe8edf1);
      hazeMidRoadMesh.material.color.set(isLoadoutHeroShot ? 0x111827 : 0xe1e8ee);
      ambientDustGroup.visible = !hideEnvironmentVisuals;
      wheelDustGroup.visible = !hideEnvironmentVisuals;
      roadModelGroup.visible = !hideEnvironmentVisuals;
      vegetationGroup.visible = !hideEnvironmentVisuals;
      edgeVegetationGroup.visible = !hideEnvironmentVisuals;
      treeShadowGroup.visible = !hideEnvironmentVisuals;
      customObjectGroup.visible = !hideEnvironmentVisuals;
      const roadsideFlow =
        dt * effectiveSpeed * RUNNER_WORLD_Z_SCALE * (state.mode === "intro" ? 0.62 : 1) + manualConveyorFlow;
      const worldToUv = roadsideFlow / 112;
      roadFlowState.value += roadsideFlow;
      const previewContext = getPreviewFlowContext(state, roadFlowState.value);
      const renderFlow = previewContext.flow;
      const renderZOffset = previewContext.zOffset;
      const renderRoadEvents = readRoadEvents(state);
      const renderSelectedFocus = getSelectedRoadEventFocus(state);
      const proceduralFlow = roadFlowState.value;
      const proceduralZOffset = 0;
      const proceduralRoadEvents = renderRoadEvents;
      const proceduralSelectedFocus = null;
      animateRefs.lowPerfHeavyFrame = !animateRefs.lowPerfHeavyFrame;
      animateRefs.roadDeformCounter += 1;
      const runHeavySceneUpdate = !isLowPerfDevice || animateRefs.lowPerfHeavyFrame;
      const roadAuxStride =
        !isLowPerfDevice
          ? 1
          : graphicsSettingsNow.detailLevel === "low"
            ? 8
            : 6;
      const runRoadSurfaceUpdate =
        true;
      const runRoadAuxUpdate =
        !isLowPerfDevice ||
        !animateRefs.roadDeformInitialized ||
        animateRefs.roadDeformCounter % roadAuxStride === 0;
      const shiftTexture = (texture) => {
        if (!texture) return;
        const repeatY = texture.repeat?.y || 1;
        texture.offset.y = (texture.offset.y + worldToUv * repeatY) % 1;
        texture.offset.x = 0;
      };
      const shiftTextureFixedTile = (texture, speedScale = 1, axis = "y") => {
        if (!texture) return;
        if (axis === "x") {
          texture.offset.x = (texture.offset.x + worldToUv * speedScale) % 1;
        } else {
          texture.offset.y = (texture.offset.y + worldToUv * speedScale) % 1;
        }
        texture.needsUpdate = true;
      };
      shiftTexture(sandTexture);
      shiftTexture(roadBaseNormal);
      shiftTexture(roadBaseRoughness);
      shiftTexture(roadBaseAo);
      shiftTexture(roadShoulderTexture);
      shiftTexture(roadShoulderNormal);
      shiftTexture(roadShoulderRoughness);
      shiftTexture(roadShoulderAo);
      shiftTexture(grassTopTexture);
      shiftTexture(proceduralTextureState.wallTexture);
      shiftTexture(proceduralTextureState.grassTexture);

      if (runRoadSurfaceUpdate) {
        applyRoadDeform(
          roadGeo,
          roadBase,
          curveValue,
          roadSculpt,
          renderFlow,
          renderRoadEvents,
          renderSelectedFocus,
          0,
          isLowPerfDevice ? 0.2 : 1
        );
        if (roadWearMesh.visible && runRoadAuxUpdate) {
          applyRoadDeform(
            roadWearGeo,
            roadWearBase,
            curveValue,
            roadSculpt,
            renderFlow,
            renderRoadEvents,
            renderSelectedFocus,
            0.018,
            isLowPerfDevice ? 0.14 : 1
          );
        }
        if (state.showGuides && runRoadAuxUpdate) {
          laneGeos.forEach((laneGeo, idx) => {
            applyRoadDeform(laneGeo, laneBases[idx], curveValue, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus, 0.008, 1);
          });
        }
        if (shoulderMaterial.opacity > 0.001 && runRoadAuxUpdate) {
          shoulderGeometries.forEach((geo, idx) => {
            applyRoadDeform(geo, shoulderBases[idx], curveValue, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus, 0, 0.35);
          });
        }
        if (runRoadAuxUpdate) {
          grassGeometries.forEach((geo, idx) => {
            applyRoadDeform(
              geo,
              grassBases[idx],
              curveValue,
              roadSculpt,
              renderFlow,
              renderRoadEvents,
              renderSelectedFocus,
              0,
              isLowPerfDevice ? 0 : 0.15
            );
          });
          sideFillGeometries.forEach((geo, idx) => {
            if (!sideFillMeshes[idx]?.visible) return;
            applyRoadDeform(
              geo,
              sideFillBases[idx],
              curveValue,
              roadSculpt,
              renderFlow,
              renderRoadEvents,
              renderSelectedFocus,
              -0.01,
              isLowPerfDevice ? 0 : 0.08
            );
          });
        }
        animateRefs.lastRoadSurfaceFlow = renderFlow;
        animateRefs.lastRoadSurfaceZOffset = renderZOffset;
        animateRefs.lastRoadSurfaceEvents = renderRoadEvents;
        animateRefs.lastRoadSurfaceSelectedFocus = renderSelectedFocus;
      }
      const dynamicMeshFlow =
        animateRefs.roadDeformInitialized
          ? animateRefs.lastRoadSurfaceFlow
          : renderFlow;
      const dynamicMeshZOffset =
        animateRefs.roadDeformInitialized
          ? animateRefs.lastRoadSurfaceZOffset
          : renderZOffset;
      const dynamicMeshRoadEvents =
        animateRefs.roadDeformInitialized
          ? animateRefs.lastRoadSurfaceEvents
          : renderRoadEvents;
      const dynamicMeshSelectedFocus =
        animateRefs.roadDeformInitialized
          ? animateRefs.lastRoadSurfaceSelectedFocus
          : renderSelectedFocus;
      if (runRoadSurfaceUpdate) {
        animateRefs.roadDeformInitialized = true;
      }
      sideFillMeshes.forEach((mesh, idx) => {
        const side = idx === 0 ? -1 : 1;
        mesh.position.set(
          side * (roadVisual.outerGrassOffset - SIDE_FILL_CENTER_OFFSET),
          roadVisual.outerGrassY,
          0
        );
        mesh.scale.set(Math.max(0.12, roadVisual.outerGrassWidth / SIDE_FILL_WIDTH), 1, 1);
        mesh.visible = !state?.hideEnvironment && !isHiddenByOverride(state, "road_base");
      });
      if (!state?.hideEnvironment && roadVisual.proceduralEdgeEnabled && runRoadAuxUpdate) {
        proceduralGrassBlockGeometries.forEach((geo, idx) => {
          const vertexOffsets =
            idx === 0 ? roadVisual.proceduralGrassVertexOffsetsLeft : roadVisual.proceduralGrassVertexOffsetsRight;
          const mesh = proceduralGrassBlockMeshes[idx];
          mesh.userData.proceduralOffsets = vertexOffsets;
          const samplerKey = JSON.stringify(vertexOffsets || {});
          if (mesh.userData.roadProceduralOffsetSamplerKey !== samplerKey) {
            mesh.userData.roadProceduralOffsetSampler = buildRoadEdgeOffsetSampler(
              proceduralGrassBlockBases[idx],
              vertexOffsets
            );
            mesh.userData.roadProceduralOffsetSamplerKey = samplerKey;
          }
          applyProceduralGrassEdgeDeform(
            geo,
            proceduralGrassBlockBases[idx],
            curveValue,
            roadSculpt,
            renderFlow,
            renderRoadEvents,
            renderSelectedFocus,
            mesh.userData.roadProceduralOffsetSampler
          );
        });
      }
      proceduralGrassBlockMeshes.forEach((mesh, idx) => {
        const side = idx === 0 ? -1 : 1;
        mesh.position.set(side * roadVisual.proceduralGrassOffset, roadVisual.roadSurfaceY + roadVisual.proceduralGrassY, 0);
        const grassScaleX = Math.max(0.2, roadVisual.proceduralGrassWidth);
        const grassScaleY = Math.max(0.05, roadVisual.proceduralGrassLift);
        mesh.scale.set(grassScaleX, grassScaleY, 1);
        if (proceduralTextureState.grassTexture) {
          const grassTileWidth = 2.4;
          const grassWorldLength = 112;
          const grassAspect = Math.max(0.1, proceduralTextureMeta?.grassAspect || 1);
          proceduralTextureState.grassTexture.repeat.set(
            Math.max(1, grassScaleX / grassTileWidth),
            Math.max(1, (grassWorldLength * grassAspect) / grassTileWidth)
          );
        }
      });
      roadCutoffClipPlane.constant = -roadCutoffZ;
      roadRearClipPlane.constant = roadRearCutoffZ;
      vegetationCutoffClipPlane.constant = -vegetationCutoffZ;
      vegetationRearClipPlane.constant = vegetationRearCutoffZ;
      objectCutoffClipPlane.constant = -objectCutoffZ;
      objectRearClipPlane.constant = objectRearCutoffZ;
      syncRoadModelVisuals(state, curveValue, roadSculpt, roadFlowState.value, renderRoadEvents, null, sceneRender);

      if (roadWearTexture) {
        const repeatY = roadWearTexture.repeat?.y || 1;
        roadWearTexture.offset.y = (roadWearTexture.offset.y + worldToUv * repeatY) % 1;
        roadWearTexture.offset.x = 0;
      }
      const minVegetationZ = vegetationSprites.reduce(
        (min, s) => Math.min(min, s.userData.z || 0),
        Number.POSITIVE_INFINITY
      );
      vegetationSprites.forEach((sprite, idx) => {
        const override = getOverrideFor(state, sprite.userData.objectKey);
        const overrideMaterial = getOverrideBillboardMaterial(override?.texture_url);
        sprite.material = overrideMaterial || sprite.userData.baseMaterial;
        const movementMode = String(override?.movement_mode || "");
        const shouldFlow = movementMode !== "anchored";
        const hasFlowSeed = hasFiniteNumber(override?.z);
        const flowSeedToken = hasFlowSeed ? String(Number(override.z).toFixed(3)) : "";
        if (shouldFlow && hasFlowSeed && sprite.userData.flowSeedToken !== flowSeedToken) {
          sprite.userData.z = toFiniteNumber(override?.z, sprite.userData.z);
          sprite.userData.flowSeedToken = flowSeedToken;
        }
        if (shouldFlow) {
          sprite.userData.z += roadsideFlow;
          if (sprite.userData.z > 9) {
            sprite.userData.z = minVegetationZ - (2.6 + Math.random() * 3.6);
            sprite.userData.jitter = Math.random() * 2.8;
          }
        }
        const zLogical = shouldFlow ? sprite.userData.z : toFiniteNumber(override?.z, sprite.userData.z);
        const z = zLogical + proceduralZOffset;
        const side = sprite.userData.side;
        const near = clamp01(1 - Math.abs(Math.min(0, z)) / 96);
        const isSideLargeTree = sprite.userData.kind === "tree_side_large";
        const isBackLargeShrub = sprite.userData.kind === "shrub_back_large";
        const shoulder = isSideLargeTree
          ? 5.05 + sprite.userData.jitter * 0.38 + near * 0.24
          : isBackLargeShrub
            ? sprite.userData.laneBand === "edge"
              ? 3.96 + sprite.userData.jitter * 0.2 + near * 0.1
              : 5.48 + sprite.userData.jitter * 0.44 + near * 0.28
            : 4.15 + sprite.userData.jitter * 0.22 + near * 0.12;
        const xDefault =
          curveOffsetAt(z, curveValue, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + side * shoulder;
        const hasOverrideX = hasFiniteNumber(override?.x);
        const overrideX = toFiniteNumber(override?.x, xDefault);
        const xMode = String(override?.x_mode || "");
        const x = !shouldFlow || !hasOverrideX
          ? (hasOverrideX ? overrideX : xDefault)
          : (xMode === "relative_curve"
              ? curveOffsetAt(z, curveValue, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + overrideX
              : overrideX);
        const hasOverrideY = hasFiniteNumber(override?.y);
        const yMode = String(override?.y_mode || (hasOverrideY ? "world" : "relative_ground"));
        const yRaw = hasOverrideY ? toFiniteNumber(override?.y, 0.06) : 0.06;
        const y =
          yMode === "relative_ground"
            ? dropAt(z, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + yRaw
            : yRaw;
        sprite.position.set(x, y, z);
        const reveal = clamp01((z + 118) / 26);
        const withinVegetationRange = z >= vegetationCutoffZ && z <= vegetationRearCutoffZ;
        const shouldShowVegetation = reveal > 0.02 && withinVegetationRange && !isHiddenByOverride(state, sprite.userData.objectKey);
        sprite.visible = shouldShowVegetation;

        const kind = sprite.userData.kind;
        const rawH =
          kind === "rock"
            ? 3.2 + near * 6.4
            : kind === "shrub"
              ? 5.1 + near * 9.2
              : kind === "shrub_back_large"
                ? 8.6 + near * 15.2
              : kind === "tree_side_large"
                ? 10.8 + near * 19.5
              : 7.2 + near * 13.2;
        const tex = sprite.material?.map;
        const imgW = tex?.image?.width || 1024;
        const imgH = tex?.image?.height || 1024;
        const imgMin = Math.min(imgW, imgH);
        const sizeFactor = imgMin < 900 ? 0.62 : imgMin < 1300 ? 0.78 : 1;
        const h = rawH * sizeFactor * reveal;
        const aspect = Math.max(0.45, Math.min(2.2, imgW / Math.max(1, imgH)));
        const kindWidthBias =
          kind === "rock" ? 0.92 : kind === "shrub" ? 0.84 : kind === "shrub_back_large" ? 0.92 : 0.78;
        const scaleU = Math.max(0.2, toFiniteNumber(override?.scale, 1));
        const scaleX = Math.max(0.2, toFiniteNumber(override?.scale_x, 1));
        const scaleY = Math.max(0.2, toFiniteNumber(override?.scale_y, 1));
        sprite.scale.set(h * aspect * kindWidthBias * scaleU * scaleX, h * scaleU * scaleY, 1);

        const shadowMesh = treeShadowMeshes[idx];
        if (!shadowMesh) return;
        const isTreeLike = kind === "tree" || kind === "shrub" || kind === "shrub_back_large";
        const castsRoadShadow = override?.casts_road_shadow === true;
        shadowMesh.visible = sprite.visible && isTreeLike && castsRoadShadow && !!shadowOverlayTexture;
        if (!shadowMesh.visible) return;

        const roadHalf = ROAD_WIDTH * 0.5 - 0.18;
        const projectedX = x - side * (1.95 + near * 0.4);
        const roadX = Math.max(-roadHalf, Math.min(roadHalf, projectedX));
        const roadY = dropAt(z, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + 0.055;
        const roadZ = z + 0.08;
        const shadowWidth = Math.max(2.8, sprite.scale.x * 1.35);
        const shadowDepth = Math.max(2.3, h * 1.2);
        shadowMesh.position.set(roadX, roadY, roadZ);
        shadowMesh.scale.set(shadowWidth, shadowDepth, 1);
        shadowMesh.rotation.y = side * -0.08 + (shadowMesh.userData.yaw || 0) * 0.28;
      });

      const minEdgeVegetationZ = edgeVegetationSprites.reduce(
        (min, s) => Math.min(min, s.userData.z || 0),
        Number.POSITIVE_INFINITY
      );
      edgeVegetationSprites.forEach((sprite, idx) => {
        const override = getOverrideFor(state, sprite.userData.objectKey);
        const overrideMaterial = getOverrideBillboardMaterial(override?.texture_url);
        sprite.material = overrideMaterial || sprite.userData.baseMaterial;
        const movementMode = String(override?.movement_mode || "");
        const shouldFlow = movementMode !== "anchored";
        const hasFlowSeed = hasFiniteNumber(override?.z);
        const flowSeedToken = hasFlowSeed ? String(Number(override.z).toFixed(3)) : "";
        if (shouldFlow && hasFlowSeed && sprite.userData.flowSeedToken !== flowSeedToken) {
          sprite.userData.z = toFiniteNumber(override?.z, sprite.userData.z);
          sprite.userData.flowSeedToken = flowSeedToken;
        }
        if (shouldFlow) {
          sprite.userData.z += roadsideFlow;
          if (sprite.userData.z > 9) {
            sprite.userData.z = minEdgeVegetationZ - (1.6 + Math.random() * 2.2);
            sprite.userData.jitter = Math.random() * 1.25;
          }
        }
        const zLogical = shouldFlow ? sprite.userData.z : toFiniteNumber(override?.z, sprite.userData.z);
        const z = zLogical + proceduralZOffset;
        const side = sprite.userData.side;
        const near = clamp01(1 - Math.abs(Math.min(0, z)) / 96);
        const shoulder = 3.82 + sprite.userData.jitter * 0.03 + near * 0.015;
        const xDefault =
          curveOffsetAt(z, curveValue, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + side * shoulder;
        const hasOverrideX = hasFiniteNumber(override?.x);
        const overrideX = toFiniteNumber(override?.x, xDefault);
        const xMode = String(override?.x_mode || "");
        const x = !shouldFlow || !hasOverrideX
          ? (hasOverrideX ? overrideX : xDefault)
          : (xMode === "relative_curve"
              ? curveOffsetAt(z, curveValue, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + overrideX
              : overrideX);
        const isPebbles = sprite.userData.kind === "pebbles";
        const baseYOffset = isPebbles ? -0.02 : 0.04;
        const hasOverrideY = hasFiniteNumber(override?.y);
        const yMode = String(override?.y_mode || (hasOverrideY ? "world" : "relative_ground"));
        const yRaw = hasOverrideY ? toFiniteNumber(override?.y, baseYOffset) : baseYOffset;
        const y =
          yMode === "relative_ground"
            ? dropAt(z, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + yRaw
            : yRaw;
        sprite.position.set(x, y, z);
        const reveal = clamp01((z + 155) / 78);
        const withinVegetationRange = z >= vegetationCutoffZ && z <= vegetationRearCutoffZ;
        sprite.visible = reveal > 0.03 && withinVegetationRange && !isHiddenByOverride(state, sprite.userData.objectKey);

        const tex = sprite.material?.map;
        const imgW = tex?.image?.width || 1024;
        const imgH = tex?.image?.height || 1024;
        const aspect = Math.max(0.45, Math.min(2.6, imgW / Math.max(1, imgH)));
        const hBase = isPebbles ? 0.66 : 1.2;
        const hGain = isPebbles ? 0.55 : 1.35;
        const grow = Math.pow(reveal, 1.15);
        const h = (hBase + near * hGain) * (sprite.userData.typeScale || 1) * grow;
        const scaleU = Math.max(0.2, toFiniteNumber(override?.scale, 1));
        const scaleX = Math.max(0.2, toFiniteNumber(override?.scale_x, 1));
        const scaleY = Math.max(0.2, toFiniteNumber(override?.scale_y, 1));
        sprite.scale.set(h * aspect * scaleU * scaleX, h * scaleU * scaleY, 1);

        const shadowMesh = edgeTreeShadowMeshes[idx];
        if (!shadowMesh) return;
        const castsRoadShadow = override?.casts_road_shadow === true;
        shadowMesh.visible = sprite.visible && !isPebbles && castsRoadShadow && !!shadowOverlayTexture;
        if (!shadowMesh.visible) return;

        const roadHalf = ROAD_WIDTH * 0.5 - 0.18;
        const projectedX = x - side * (1.18 + near * 0.18);
        const roadX = Math.max(-roadHalf, Math.min(roadHalf, projectedX));
        const roadY = dropAt(z, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + 0.05;
        const roadZ = z + 0.04;
        const shadowWidth = Math.max(1.1, sprite.scale.x * 0.9);
        const shadowDepth = Math.max(1.4, h * 0.9);
        shadowMesh.position.set(roadX, roadY, roadZ);
        shadowMesh.scale.set(shadowWidth, shadowDepth, 1);
        shadowMesh.rotation.y = side * -0.05 + (shadowMesh.userData.yaw || 0) * 0.2;
      });

      ambientDustSprites.forEach((sprite) => {
        sprite.userData.z += roadsideFlow * 0.88;
        sprite.userData.x += sprite.userData.drift * dt;
        if (sprite.userData.z > 12) {
          sprite.userData.z = Math.min(-18, horizonWorldZ - (10 + Math.random() * 22));
          sprite.userData.x = (Math.random() - 0.5) * 13.8;
          sprite.userData.y = 0.24 + Math.random() * 1.35;
          sprite.userData.drift = (Math.random() - 0.5) * 0.22;
          sprite.userData.size = 0.22 + Math.random() * 0.26;
        }
        const z = sprite.userData.z + proceduralZOffset;
        const x =
          sprite.userData.x +
          curveOffsetAt(z, curveValue, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) * 0.74;
        const y = dropAt(z, roadSculpt, proceduralFlow, proceduralRoadEvents, proceduralSelectedFocus) + sprite.userData.y;
        sprite.position.set(x, y, z);
        sprite.visible = z >= objectCutoffZ;
        if (!sprite.visible) return;
        const alpha = clamp01((-z - 10) / 90);
        const s = sprite.userData.size * (0.88 + alpha * 0.8);
        sprite.scale.set(s, s, 1);
      });

      const laneVisual = state.runnerState?.laneVisual || 0;
      const jump = state.runnerState?.jump || 0;
      const jumpForward = state.runnerState?.jumpForward || 0;
      const resultPosePhase = String(state?.runnerState?.resultPhase || "arrival");
      const isResultMode = state.mode === "result";
      const isLoadoutHeroPose =
        isResultMode &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        resultPosePhase !== "arrival";
      const desiredLoadoutAltUrl =
        state?.mode === "result" && String(state?.resultCameraVariant || "") === "loadout_hero"
          ? String(state?.loadoutBaseModelUrl || state?.sceneConfig?.loadout_base_model_url || "").trim()
          : "";
      if (desiredLoadoutAltUrl !== loadoutAltModelState.sourceUrl) {
        loadAlternatePlayerBaseModel(desiredLoadoutAltUrl);
      }
      const requestedVariant = String(state?.loadoutCharacterVariant || "hero");
      if (!isLoadoutHeroPose) {
        loadoutSwapState.activeVariant = requestedVariant;
        loadoutSwapState.pendingVariant = requestedVariant;
        loadoutSwapState.outgoingVariant = requestedVariant;
        loadoutSwapState.incomingVariant = requestedVariant;
        loadoutSwapState.phase = "idle";
        loadoutSwapState.sameVariantSwap = false;
        loadoutSwapState.offsetX = 0;
        loadoutSwapState.outgoingOffsetX = 0;
        loadoutSwapState.incomingOffsetX = 0;
        loadoutSwapState.token = Number(state?.loadoutCharacterSwapToken || 0);
      } else {
        const nextToken = Number(state?.loadoutCharacterSwapToken || 0);
        const canUseRequestedVariant =
          requestedVariant !== "shadow" || (!!loadoutAltModelState.root && !!loadoutAltModelState.readyForSwap);
        if (nextToken !== loadoutSwapState.token) {
          loadoutSwapState.token = nextToken;
          loadoutSwapState.pendingVariant = requestedVariant;
          loadoutSwapState.direction = Number(state?.loadoutCharacterSwapDirection || 1) >= 0 ? 1 : -1;
          loadoutSwapState.sameVariantSwap = canUseRequestedVariant && requestedVariant === loadoutSwapState.activeVariant;
          loadoutSwapState.phase =
            canUseRequestedVariant && requestedVariant !== loadoutSwapState.activeVariant
              ? "swap"
              : loadoutSwapState.sameVariantSwap
                ? "pulse"
                : "idle";
          loadoutSwapState.startedAt = sceneMs;
          loadoutSwapState.offsetX = 0;
          loadoutSwapState.outgoingVariant = loadoutSwapState.activeVariant;
          loadoutSwapState.incomingVariant = requestedVariant;
          loadoutSwapState.outgoingOffsetX = 0;
          loadoutSwapState.incomingOffsetX =
            canUseRequestedVariant && !loadoutSwapState.sameVariantSwap ? loadoutSwapState.direction * 5.6 : 0;
        }
        if (loadoutSwapState.activeVariant === "shadow" && !loadoutAltModelState.root) {
          loadoutSwapState.activeVariant = "hero";
          loadoutSwapState.pendingVariant = "hero";
          loadoutSwapState.outgoingVariant = "hero";
          loadoutSwapState.incomingVariant = "hero";
          loadoutSwapState.phase = "idle";
          loadoutSwapState.sameVariantSwap = false;
          loadoutSwapState.offsetX = 0;
          loadoutSwapState.outgoingOffsetX = 0;
          loadoutSwapState.incomingOffsetX = 0;
        }
        if (loadoutSwapState.phase === "swap") {
          const progress = clamp01((sceneMs - loadoutSwapState.startedAt) / 360);
          loadoutSwapState.outgoingOffsetX = -loadoutSwapState.direction * easeInCubic(progress) * 5.6;
          loadoutSwapState.incomingOffsetX = loadoutSwapState.direction * (1 - easeOutCubic(progress)) * 5.6;
          if (progress >= 1) {
            loadoutSwapState.activeVariant = loadoutSwapState.incomingVariant;
            loadoutSwapState.pendingVariant = loadoutSwapState.activeVariant;
            loadoutSwapState.phase = "idle";
            loadoutSwapState.sameVariantSwap = false;
            loadoutSwapState.offsetX = 0;
            loadoutSwapState.outgoingVariant = loadoutSwapState.activeVariant;
            loadoutSwapState.incomingVariant = loadoutSwapState.activeVariant;
            loadoutSwapState.outgoingOffsetX = 0;
            loadoutSwapState.incomingOffsetX = 0;
          }
        } else if (loadoutSwapState.phase === "pulse") {
          const progress = clamp01((sceneMs - loadoutSwapState.startedAt) / 320);
          const pulseDistance = loadoutSwapState.direction * 1.9;
          if (progress < 0.5) {
            const exitT = easeInCubic(progress / 0.5);
            loadoutSwapState.offsetX = pulseDistance * exitT;
          } else {
            const returnT = easeOutCubic((progress - 0.5) / 0.5);
            loadoutSwapState.offsetX = pulseDistance * (1 - returnT);
          }
          if (progress >= 1) {
            loadoutSwapState.phase = "idle";
            loadoutSwapState.sameVariantSwap = false;
            loadoutSwapState.offsetX = 0;
          }
        } else if (canUseRequestedVariant) {
          loadoutSwapState.activeVariant = requestedVariant;
          loadoutSwapState.pendingVariant = requestedVariant;
          loadoutSwapState.sameVariantSwap = false;
          loadoutSwapState.offsetX = 0;
          loadoutSwapState.outgoingVariant = requestedVariant;
          loadoutSwapState.incomingVariant = requestedVariant;
          loadoutSwapState.outgoingOffsetX = 0;
          loadoutSwapState.incomingOffsetX = 0;
        }
      }
      const useAlternateLoadoutCharacter =
        isLoadoutHeroPose &&
        requestedVariant === "shadow" &&
        !!loadoutAltModelState.root &&
        !!loadoutAltModelState.readyForSwap;
      const isResultChestStage =
        isResultMode &&
        String(state?.resultCameraVariant || "default") !== "loadout_hero" &&
        !!state?.runnerState?.resultShowChestOnly;
      const playerZ = isResultMode ? (resultPosePhase === "arrival" ? -4.8 : -9.4) : -2.15;
      const playerX = isResultMode
        ? (isLoadoutHeroPose ? loadoutSwapState.offsetX : 0)
        : laneToX(laneVisual, playerZ, curveValue, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus);
      const playerOverride = getOverrideFor(state, "player");
      const playerBaseYOffset = state?.hideEnvironment ? 0.12 : playerAnimationState.root ? 0 : isLoadoutHeroPose ? 0.96 : 0.84;
      const playerTrackYOffset = Number(state?.runnerState?.trackHeightVisual || 0);
      const playerGroundYRaw = state?.hideEnvironment
        ? 0
        : dropAt(playerZ, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus) + playerTrackYOffset;
      const playerGroundY =
        state?.hideEnvironment
          ? 0
          : isResultMode
            ? THREE.MathUtils.clamp(playerGroundYRaw, -0.18, 1.12)
            : playerGroundYRaw;
      playerGroup.position.set(
        playerX + toFiniteNumber(playerOverride?.x, 0),
        playerBaseYOffset +
          jump * 1.02 +
          (runnerStatus === "collision" && collisionType === "pit_gap"
            ? -THREE.MathUtils.lerp(0, 14.5, collisionProgress)
            : 0) +
          playerGroundY +
          toFiniteNumber(playerOverride?.y, 0),
        playerZ +
          jumpForward +
          (runnerStatus === "collision" && collisionType === "pit_gap"
            ? THREE.MathUtils.lerp(0, 2.8, collisionProgress)
            : 0) +
          toFiniteNumber(playerOverride?.z, 0)
      );
      playerGroup.visible = !isResultChestStage && !isHiddenByOverride(state, "player");
      playerGroup.rotation.z =
        runnerStatus === "collision" && collisionType === "pit_gap"
          ? THREE.MathUtils.lerp(0, -0.62, collisionProgress)
          : playerAnimationState.root
            ? 0
            : -laneVisual * 0.24;
      playerGroup.rotation.y = isResultMode ? Math.PI + toRad(toFiniteNumber(playerOverride?.rotation_y, 0)) : toRad(toFiniteNumber(playerOverride?.rotation_y, 0));
      playerGroup.scale.set(
        Math.max(0.2, toFiniteNumber(playerOverride?.scale, 1) * toFiniteNumber(playerOverride?.scale_x, 1)),
        Math.max(0.2, toFiniteNumber(playerOverride?.scale, 1) * toFiniteNumber(playerOverride?.scale_y, 1)),
        Math.max(0.2, toFiniteNumber(playerOverride?.scale, 1) * toFiniteNumber(playerOverride?.scale_z, 1))
      );
      applyPlayerRuntimePose(state, laneVisual);
      if (loadoutAltModelState.root && playerAnimationState.root) {
        loadoutAltSyncPosition.copy(playerAnimationState.root.position);
        loadoutAltModelState.root.position.copy(loadoutAltSyncPosition);
        loadoutAltSyncQuaternion.copy(playerAnimationState.root.quaternion);
        loadoutAltModelState.root.quaternion.copy(loadoutAltSyncQuaternion);
        loadoutAltSyncScale.copy(playerAnimationState.root.scale);
        loadoutAltModelState.root.scale.copy(loadoutAltSyncScale);
      }
      const isLoadoutSwapActive = isLoadoutHeroPose && loadoutSwapState.phase === "swap";
      const heroOffsetX = isLoadoutSwapActive
        ? loadoutSwapState.outgoingVariant === "hero"
          ? loadoutSwapState.outgoingOffsetX
          : loadoutSwapState.incomingVariant === "hero"
            ? loadoutSwapState.incomingOffsetX
            : 0
        : 0;
      const shadowOffsetX = isLoadoutSwapActive
        ? loadoutSwapState.outgoingVariant === "shadow"
          ? loadoutSwapState.outgoingOffsetX
          : loadoutSwapState.incomingVariant === "shadow"
            ? loadoutSwapState.incomingOffsetX
            : 0
        : 0;
      if (playerAnimationState.root) {
        playerAnimationState.root.position.x += heroOffsetX;
      }
      if (loadoutAltModelState.root) {
        loadoutAltModelState.root.position.x += shadowOffsetX;
      }
      if (isLoadoutHeroPose) {
        const loadoutTime = sceneMs * 0.001;
        loadoutAtmosphereGroup.visible = true;
        loadoutAtmosphereGroup.position.set(0, 0.06, 0);
        loadoutAtmosphereHalo.material.opacity = 0.07 + (Math.sin(loadoutTime * 1.9) * 0.5 + 0.5) * 0.05;
        const haloScale = 1 + Math.sin(loadoutTime * 1.4 + 0.5) * 0.04;
        loadoutAtmosphereHalo.scale.set(2.15 * haloScale, 1.62 * haloScale, 1);
        loadoutAtmosphereSprites.forEach((sprite, idx) => {
          const spin = loadoutTime * sprite.userData.speed + sprite.userData.phase;
          const swirl = sprite.userData.angle + spin;
          const radius = sprite.userData.radius + Math.sin(loadoutTime * 1.2 + idx * 0.7) * 0.04;
          sprite.position.set(
            Math.cos(swirl) * radius * 0.72,
            sprite.userData.height + Math.sin(loadoutTime * 2.2 + sprite.userData.phase) * sprite.userData.bob,
            Math.sin(swirl * 1.25) * radius * 0.24
          );
          const twinkle = 0.86 + (Math.sin(loadoutTime * 3.1 + sprite.userData.phase) * 0.5 + 0.5) * 0.54;
          const size = sprite.userData.size * twinkle;
          sprite.scale.set(size, size, 1);
          sprite.material.opacity = 0.08 + (Math.sin(loadoutTime * 2.7 + sprite.userData.phase) * 0.5 + 0.5) * 0.12;
        });
      } else {
        loadoutAtmosphereGroup.visible = false;
      }
      updateRigidWardrobeBoneFollowers();
      loadoutWardrobeGroup.position.x =
        isLoadoutSwapActive
          ? String(state?.loadoutCharacterVariant || "hero") === "shadow"
            ? shadowOffsetX
            : heroOffsetX
          : 0;
      if (playerAnimationState.root) {
        playerAnimationState.root.visible =
          isLoadoutSwapActive
            ? loadoutSwapState.outgoingVariant === "hero" || loadoutSwapState.incomingVariant === "hero"
            : !useAlternateLoadoutCharacter;
      }
      if (loadoutAltModelState.root) {
        loadoutAltModelState.root.visible =
          isLoadoutSwapActive
            ? loadoutSwapState.outgoingVariant === "shadow" || loadoutSwapState.incomingVariant === "shadow"
            : useAlternateLoadoutCharacter;
      }
      playerBody.material.color.copy(safeColor(state.islandTheme.player, "#67e8f9"));
      playerBody.material.emissive.copy(safeColor(state.islandTheme.player, "#67e8f9"));

      const bossBaseZ = state.runnerState?.moneyRainActive ? -42 : -34;
      const bossOverride = getOverrideFor(state, "boss");
      const bossOffsetX = Math.max(-2.8, Math.min(2.8, toFiniteNumber(bossOverride?.x, 0)));
      const bossOffsetY = Math.max(-1.5, Math.min(3.5, toFiniteNumber(bossOverride?.y, 0)));
      const bossOffsetZ = Math.max(-16, Math.min(16, toFiniteNumber(bossOverride?.z, 0)));
      const bossZ = bossBaseZ + bossOffsetZ;
      const bossLaneCenterX = laneToX(
        Number.isFinite(Number(bossLane)) ? Number(bossLane) : 0,
        bossZ,
        curveValue,
        roadSculpt,
        renderFlow,
        renderRoadEvents,
        renderSelectedFocus
      );
      bossGroup.position.set(
        bossLaneCenterX +
          (state.bossDrift || 0) * 0.02 +
          bossOffsetX,
        1.52 +
          dropAt(bossZ, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus) +
          (state.bossBump || 0) * 0.03 +
          bossOffsetY,
        bossZ
      );
      const bossWithinDistance = bossZ >= objectCutoffZ && bossZ <= objectRearCutoffZ;
      bossGroup.visible = !isResultMode && bossWithinDistance;
      bossGroup.rotation.z = toRad((state.bossTilt || 0) * 0.34);
      bossGroup.rotation.y = toRad(toFiniteNumber(bossOverride?.rotation_y, 0));
      bossGroup.rotation.x = toRad(Math.sin(sceneMs * 0.0028) * 1.5);
      const bossScale = Math.max(0.6, toFiniteNumber(bossOverride?.scale, 1));
      bossGroup.scale.set(
        Math.max(0.6, bossScale * toFiniteNumber(bossOverride?.scale_x, 1)),
        Math.max(0.6, bossScale * toFiniteNumber(bossOverride?.scale_y, 1)),
        Math.max(0.6, bossScale * toFiniteNumber(bossOverride?.scale_z, 1))
      );
      bossGroup.updateMatrixWorld();

      if (!isResultMode && bossWithinDistance) {
        wheelDustSpawnAcc += dt * (2.6 + effectiveSpeed * 3.6);
        while (wheelDustSpawnAcc >= 1) {
          wheelDustSpawnAcc -= 1;
          const sprite = wheelDustSprites[wheelDustHead];
          wheelDustHead = (wheelDustHead + 1) % wheelDustSprites.length;
          const offset = bossDustOffsets[wheelDustSide];
          wheelDustSide = (wheelDustSide + 1) % bossDustOffsets.length;
          tempWheelPos.copy(offset).applyMatrix4(bossGroup.matrixWorld);
          sprite.userData.active = true;
          sprite.userData.maxLife = 0.28 + Math.random() * 0.22;
          sprite.userData.life = sprite.userData.maxLife;
          sprite.userData.velocity.set(
            (Math.random() - 0.5) * 0.6,
            0.35 + Math.random() * 0.32,
            1.3 + Math.random() * 0.65
          );
          sprite.position.copy(tempWheelPos);
          const s = 0.26 + Math.random() * 0.18;
          sprite.scale.set(s, s, 1);
          sprite.visible = true;
        }
      }
      wheelDustSprites.forEach((sprite) => {
        if (isResultMode || !bossWithinDistance) {
          sprite.userData.active = false;
          sprite.visible = false;
          return;
        }
        if (!sprite.userData.active) return;
        sprite.userData.life -= dt;
        if (sprite.userData.life <= 0) {
          sprite.userData.active = false;
          sprite.visible = false;
          return;
        }
        sprite.position.addScaledVector(sprite.userData.velocity, dt);
        sprite.userData.velocity.multiplyScalar(0.93);
        const life01 = sprite.userData.life / sprite.userData.maxLife;
        const grow = 1 + (1 - life01) * 1.4;
        const base = 0.26;
        sprite.scale.set(base * grow, base * grow, 1);
        if (sprite.material) {
          sprite.material.opacity = 0.28 * Math.pow(life01, 1.1);
        }
      });

      syncDynamicMeshes(
        state,
        curveValue,
        roadSculpt,
        dt,
        dynamicMeshFlow,
        dynamicMeshZOffset,
        dynamicMeshRoadEvents,
        dynamicMeshSelectedFocus,
        dynamicMeshFlow,
        dynamicMeshZOffset,
        dynamicMeshRoadEvents,
        dynamicMeshSelectedFocus,
        sceneRender
      );
      if (runHeavySceneUpdate) {
        try {
          syncCustomObjects(state, curveValue, roadSculpt, renderFlow, renderZOffset, renderRoadEvents, renderSelectedFocus, sceneRender);
        } catch {
          customObjectsEnabled = false;
        }
      }
      syncRoadEventHandles(state, curveValue, roadSculpt, renderFlow, sceneMs, roadCutoffZ);

      const isLoadoutCameraEditorActive =
        state.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        !!state?.loadoutCameraEditMode;
      const lockCameraForEdit =
        state.mode === "challenge" &&
        state.showGuides &&
        (state.devInteractionMode === "move" || roadEventEditState.active);
      const isDevPlayerPreset = freeCameraActive && state.freeCameraPreset === "player";
      orbitControls.enabled =
        freeCameraActive &&
        !isDevPlayerPreset &&
        !dragState.active &&
        !proceduralEditState.active &&
        !roadEventEditState.active &&
        !(lockCameraForEdit && !isFullMapStageMode);
      if (freeCameraActive) {
        if (isDevPlayerPreset) {
          camera.position.x += (stableGameplayTargetX - camera.position.x) * Math.min(1, dt * 4);
          camera.position.y += (gameplayTargetY - camera.position.y) * Math.min(1, dt * 4);
          camera.position.z += (gameplayTargetZ - camera.position.z) * Math.min(1, dt * 3);
          camera.lookAt(stableGameplayLookX, gameplayLookY, gameplayLookZ);
        } else {
          if (state.freeCameraPreset === "classic" || isLoadoutCameraEditorActive) {
            orbitControls.mouseButtons = {
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            };
          } else {
            orbitControls.mouseButtons = {
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            };
          }
          if (animateRefs.lastCameraResetToken !== state.cameraResetToken) {
            animateRefs.lastCameraResetToken = state.cameraResetToken;
            if (isFullMapStageMode) {
              const fullMapFocusZ = THREE.MathUtils.clamp(-56 + Number(state?.devMapCursorZ || 0), -180, 8);
              camera.position.set(0, 56, fullMapFocusZ + 2);
              orbitControls.target.set(0, 0.8, fullMapFocusZ);
            } else if (state.freeCameraPreset === "top") {
              camera.position.set(0, 54, -22);
              orbitControls.target.set(0, 0.9, -24);
            } else if (state.freeCameraPreset === "iso") {
              camera.position.set(34, 26, 18);
              orbitControls.target.set(0, 1.1, -26);
            } else {
              camera.position.set(0, 4.7, followDistance);
              orbitControls.target.set(0, 1.2, -20);
            }
            orbitControls.update();
          }
          orbitControls.update();
        }
      } else {
        if (state.mode === "result") {
          camera.position.x += (resultCameraPos.x - camera.position.x) * Math.min(1, dt * 3.5);
          camera.position.y += (resultCameraPos.y - camera.position.y) * Math.min(1, dt * 3.5);
          camera.position.z += (resultCameraPos.z - camera.position.z) * Math.min(1, dt * 3.5);
          camera.lookAt(resultCameraLook.x, resultCameraLook.y, resultCameraLook.z);
        } else if (runnerStatus === "collision" && collisionType === "pit_gap") {
          const fallEase = collisionProgress * collisionProgress * (3 - 2 * collisionProgress);
          const closeX = THREE.MathUtils.lerp(
            animateRefs.pitFallCameraStartX,
            animateRefs.pitFallFocusX,
            fallEase
          );
          const closeY = THREE.MathUtils.lerp(
            animateRefs.pitFallCameraStartY,
            15.8,
            fallEase
          );
          const closeZ = THREE.MathUtils.lerp(
            animateRefs.pitFallCameraStartZ,
            animateRefs.pitFallFocusZ - 0.5,
            fallEase
          );
          camera.position.x += (closeX - camera.position.x) * Math.min(1, cinematicDt * 3.8);
          camera.position.y += (closeY - camera.position.y) * Math.min(1, cinematicDt * 3.8);
          camera.position.z += (closeZ - camera.position.z) * Math.min(1, cinematicDt * 3.8);
        } else if (runnerStatus === "collision") {
          const collisionEase = collisionProgress * collisionProgress * (3 - 2 * collisionProgress);
          const closeX = stableGameplayTargetX + THREE.MathUtils.lerp(1.35, 0.45, collisionEase);
          const closeY = gameplayGroundY + THREE.MathUtils.lerp(2.3, 1.85, collisionEase);
          const closeZ = THREE.MathUtils.lerp(-0.8, -1.65, collisionEase);
          camera.position.x += (closeX - camera.position.x) * Math.min(1, dt * 5.5);
          camera.position.y += (closeY - camera.position.y) * Math.min(1, dt * 5.5);
          camera.position.z += (closeZ - camera.position.z) * Math.min(1, dt * 5.5);
        } else if (state.mode === "intro") {
          const t = introProgress * introProgress * (3 - 2 * introProgress);
          const settle = clamp01((t - 0.78) / 0.22);
          const cinematicX = Math.sin(t * Math.PI) * 1.15;
          const cinematicY = 15.2 - t * 10.5 + Math.sin(t * Math.PI * 1.4) * 0.35;
          const cinematicZ = 25.5 - t * 16.8;
          camera.position.set(
            THREE.MathUtils.lerp(curveValue * 0.03 + cinematicX, stableGameplayTargetX, settle),
            THREE.MathUtils.lerp(cinematicY, gameplayTargetY, settle),
            THREE.MathUtils.lerp(cinematicZ, gameplayTargetZ, settle)
          );
        } else {
          camera.position.x += (stableGameplayTargetX - camera.position.x) * Math.min(1, dt * 4);
          camera.position.y += (gameplayTargetY - camera.position.y) * Math.min(1, dt * 4);
          camera.position.z += (gameplayTargetZ - camera.position.z) * Math.min(1, dt * 3);
        }
        if (state.mode === "result") {
          camera.lookAt(resultCameraLook.x, resultCameraLook.y, resultCameraLook.z);
        } else if (runnerStatus === "collision" && collisionType === "pit_gap") {
          const fallEase = collisionProgress * collisionProgress * (3 - 2 * collisionProgress);
          const lookX = THREE.MathUtils.lerp(
            animateRefs.pitFallLookStartX,
            animateRefs.pitFallFocusX,
            fallEase
          );
          const lookY = THREE.MathUtils.lerp(
            animateRefs.pitFallLookStartY,
            Math.max(-8.5, playerGroup.position.y - 5.4),
            fallEase
          );
          const lookZ = THREE.MathUtils.lerp(
            animateRefs.pitFallLookStartZ,
            animateRefs.pitFallFocusZ,
            fallEase
          );
          camera.lookAt(lookX, lookY, lookZ);
        } else if (runnerStatus === "collision") {
          const collisionEase = collisionProgress * collisionProgress * (3 - 2 * collisionProgress);
          const lookX = stableGameplayTargetX + THREE.MathUtils.lerp(0.14, 0.06, collisionEase);
          const lookY = gameplayGroundY + THREE.MathUtils.lerp(1.22, 1.34, collisionEase);
          const lookZ = THREE.MathUtils.lerp(-3.05, -3.2, collisionEase);
          camera.lookAt(lookX, lookY, lookZ);
        } else if (state.mode === "intro") {
          const t = introProgress * introProgress * (3 - 2 * introProgress);
          const settle = clamp01((t - 0.78) / 0.22);
          const introLookY = 3.8 - t * 2.6;
          const introLookZ = -46 + t * 30;
          const introLookX =
            curveOffsetAt(introLookZ, curveValue, roadSculpt, renderFlow, renderRoadEvents, renderSelectedFocus) *
            (0.12 + t * 0.32);
          camera.lookAt(
            THREE.MathUtils.lerp(introLookX, stableGameplayLookX, settle),
            THREE.MathUtils.lerp(introLookY, gameplayLookY, settle),
            THREE.MathUtils.lerp(introLookZ, gameplayLookZ, settle)
          );
          if (introProgress >= 1 && !introCompleted) {
            introCompleted = true;
            if (typeof onIntroComplete === "function") onIntroComplete();
          }
        } else {
          camera.lookAt(stableGameplayLookX, gameplayLookY, gameplayLookZ);
        }
      }

      const billboardTarget = freeCameraActive && state.freeCameraPreset !== "player" ? playerViewCameraPos : camera.position;
      vegetationSprites.forEach((sprite) => {
        if (!sprite.visible) return;
        sprite.lookAt(billboardTarget);
      });
      edgeVegetationSprites.forEach((sprite) => {
        if (!sprite.visible) return;
        sprite.lookAt(billboardTarget);
      });
      customObjectMeshes.forEach((mesh) => {
        if (!mesh.visible) return;
        if (String(mesh.userData.mediaType || "") === "model3d") return;
        if (mesh.userData?.isProcedural) return;
        const override = getOverrideFor(state, mesh.userData.objectKey);
        const hasManualRotation =
          !!mesh.userData?.hasManualRotation ||
          hasFiniteNumber(override?.rotation_x) ||
          hasFiniteNumber(override?.rotation_y) ||
          hasFiniteNumber(override?.rotation_z);
        if (hasManualRotation) return;
        mesh.lookAt(billboardTarget);
      });
      const loadoutCameraEditorActive =
        state.mode === "result" &&
        String(state?.resultCameraVariant || "") === "loadout_hero" &&
        !!state?.loadoutCameraEditMode;
      if (loadoutCameraEditorActive) {
        const markerPulse = 1 + Math.sin(sceneMs * 0.01) * 0.06;
        loadoutCameraMarker.visible = true;
        loadoutLookMarker.visible = true;
        loadoutCameraMarker.position.set(loadoutRig.cameraX, resultGroundY + loadoutRig.cameraYOffset, loadoutRig.cameraZ);
        loadoutLookMarker.position.set(loadoutRig.targetX, resultGroundY + loadoutRig.targetYOffset, loadoutRig.targetZ);
        loadoutCameraMarkerHalo.scale.setScalar(markerPulse);
        loadoutLookMarkerHalo.scale.setScalar(1 + Math.sin(sceneMs * 0.012 + 0.5) * 0.06);
      } else {
        loadoutCameraMarker.visible = false;
        loadoutLookMarker.visible = false;
      }
      const selectedKey = String(state.selectedObjectKey || "");
      const selectedObj = findObjectByDevKey(selectedKey);
      const hasSelectedMarkerPosition =
        !!state.showGuides &&
        resolveSelectedWorldPosition(
          state,
          selectedKey,
          selectedObj,
          curveValue,
          roadSculpt,
          renderFlow,
          renderZOffset,
          renderRoadEvents,
          renderSelectedFocus,
          pickWorldPosition
        );
      if (hasSelectedMarkerPosition) {
        const pulse = 1 + Math.sin(sceneMs * 0.012) * 0.08;
        selectedMarkerRing.scale.setScalar(pulse);
        selectedMarkerHalo.scale.setScalar(1 + Math.sin(sceneMs * 0.01 + 0.6) * 0.12);
        selectedMarkerBeam.scale.y = 0.92 + Math.sin(sceneMs * 0.013 + 0.4) * 0.08;
        selectedMarkerGroup.visible = true;
        selectedMarkerGroup.position.set(pickWorldPosition.x, pickWorldPosition.y + 0.06, pickWorldPosition.z);
        selectedMarkerTick.lookAt(camera.position);
        if (typeof onDevSelectedScreenPositionRef.current === "function" && state.devInteractionMode === "move") {
          const projected = pickWorldPosition.clone().project(camera);
          if (
            Number.isFinite(projected.x) &&
            Number.isFinite(projected.y) &&
            Number.isFinite(projected.z)
          ) {
            const rect = renderer.domElement.getBoundingClientRect();
            onDevSelectedScreenPositionRef.current({
              x: Math.max(28, Math.min(rect.width - 28, ((projected.x + 1) * 0.5) * rect.width)),
              y: Math.max(28, Math.min(rect.height - 28, ((-projected.y + 1) * 0.5) * rect.height)),
            });
          } else {
            onDevSelectedScreenPositionRef.current(null);
          }
        }
      } else {
        selectedMarkerGroup.visible = false;
        if (typeof onDevSelectedScreenPositionRef.current === "function") {
          onDevSelectedScreenPositionRef.current(null);
        }
      }

      renderer.render(scene, camera);
      animateRefs.rafId = requestAnimationFrame(animate);
    };

    animateRefs.rafId = requestAnimationFrame(animate);

    return () => {
      orbitControlsDisposed = true;
      optionalSceneUpgradeCancelled = true;
      if (animateRefs.rafId) cancelAnimationFrame(animateRefs.rafId);
      window.clearTimeout(readyFallbackTimer);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown, { capture: true });
      renderer.domElement.removeEventListener("pointermove", onCanvasPointerMove);
      renderer.domElement.removeEventListener("pointerup", onCanvasPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onCanvasPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onCanvasContextMenu);
      orbitControlsActiveInstance?.removeEventListener("start", onControlsStart);
      clearDragState();
      clearProceduralEditState();
      clearRoadEventEditState();
      if (dustTexture) dustTexture.dispose();
      if (roadWearTexture) roadWearTexture.dispose();
      if (shadowOverlayTexture) shadowOverlayTexture.dispose();
      orbitControlsActiveInstance?.dispose();
      dracoLoader.dispose();
      ktx2Loader.dispose();
      renderer.dispose();

      sandTexture.dispose();
      roadBaseNormalHandle?.dispose();
      roadBaseRoughnessHandle?.dispose();
      roadBaseAoHandle?.dispose();
      roadShoulderNormalHandle?.dispose();
      roadShoulderRoughnessHandle?.dispose();
      roadShoulderAoHandle?.dispose();
      if (treeTexture) treeTexture.dispose();
      if (obstacleTexture) obstacleTexture.dispose();
      vegetationDefs.forEach((def) => {
        if (def.texture !== treeTexture) def.texture.dispose();
      });
      if (roadShoulderTexture) roadShoulderTexture.dispose();
      if (roadSlopeTexture) roadSlopeTexture.dispose();
      if (grassTopTexture) grassTopTexture.dispose();
      if (horizonTexture) horizonTexture.dispose();
      if (proceduralTextureState.grassTexture) proceduralTextureState.grassTexture.dispose();
      vegetationBillboardGeometryLeft.dispose();
      vegetationBillboardGeometryRight.dispose();

      roadGeo.dispose();
      roadMat.dispose();
      roadWearGeo.dispose();
      roadWearMat.dispose();
      treeShadowGeometry.dispose();
      treeShadowMaterial.dispose();
      shoulderGeometries.forEach((geo) => geo.dispose());
      grassGeometries.forEach((geo) => geo.dispose());
      sideFillGeometries.forEach((geo) => geo.dispose());
      proceduralGrassBlockGeometries.forEach((geo) => geo.dispose());
      shoulderMaterial.dispose();
      grassMaterial.dispose();
      proceduralGrassMaterial.dispose();
      horizonMesh.geometry.dispose();
      horizonMesh.material.dispose();
      selectedMarkerRing.geometry.dispose();
      selectedMarkerRing.material.dispose();
      selectedMarkerHalo.geometry.dispose();
      selectedMarkerHalo.material.dispose();
      selectedMarkerBeam.geometry.dispose();
      selectedMarkerBeam.material.dispose();
      selectedMarkerTick.geometry.dispose();
      selectedMarkerTick.material.dispose();
      loadoutCameraMarkerBase.geometry.dispose();
      loadoutCameraMarkerBase.material.dispose();
      loadoutCameraMarkerHalo.geometry.dispose();
      loadoutCameraMarkerHalo.material.dispose();
      loadoutCameraMarkerBeam.geometry.dispose();
      loadoutCameraMarkerBeam.material.dispose();
      loadoutLookMarkerBase.geometry.dispose();
      loadoutLookMarkerBase.material.dispose();
      loadoutLookMarkerHalo.geometry.dispose();
      loadoutLookMarkerHalo.material.dispose();
      loadoutLookMarkerBeam.geometry.dispose();
      loadoutLookMarkerBeam.material.dispose();
      roadEventHandleMeshes.forEach((handle) => {
        if (handle?.userData?.band?.material) handle.userData.band.material.dispose();
        if (handle?.userData?.tip?.material) handle.userData.tip.material.dispose();
      });
      roadEventHandleGeometry.dispose();
      roadEventHandleTipGeometry.dispose();
      devGrid.geometry.dispose();
      devGrid.material.dispose();
      devBlockGuides.children.forEach((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      Object.values(sceneCutoffGuides).forEach((guide) => {
        if (guide.userData.floor?.geometry) guide.userData.floor.geometry.dispose();
        if (guide.userData.floor?.material) guide.userData.floor.material.dispose();
        if (guide.userData.wall?.geometry) guide.userData.wall.geometry.dispose();
        if (guide.userData.wall?.material) guide.userData.wall.material.dispose();
        if (guide.userData.labelSprite?.material?.map) guide.userData.labelSprite.material.map.dispose();
        if (guide.userData.labelSprite?.material) guide.userData.labelSprite.material.dispose();
      });
      hazeNearRoadMesh.geometry.dispose();
      hazeNearRoadMesh.material.dispose();
      hazeMidRoadMesh.geometry.dispose();
      hazeMidRoadMesh.material.dispose();
      laneGeos.forEach((geo) => geo.dispose());
      laneMat.dispose();
      blockGeometry.dispose();
      obstacleGeometry.dispose();
      elevatedRampGeometry.dispose();
      elevatedFlatGeometry.dispose();
      powerCrateSparkGeometry.dispose();
      if (powerCrateAuraTexture) powerCrateAuraTexture.dispose();
      impactGeometry.dispose();
      wheelGeometry.dispose();
      wheelMaterial.dispose();
      if (obstacleSpriteMaterial) obstacleSpriteMaterial.dispose();
      vegetationMaterials.forEach((mat) => mat.dispose());
      edgeVegetationMaterials.forEach((mat) => mat.dispose());
      edgeVegetationDefs.forEach((def) => def.texture.dispose());
      roadModelVisualState.parts.forEach((part) => {
        if (!part?.mesh) return;
        part.mesh.geometry?.dispose?.();
        if (Array.isArray(part.mesh.material)) {
          part.mesh.material.forEach((mat) => mat?.dispose?.());
        } else {
          part.mesh.material?.dispose?.();
        }
      });
      customObjectInstancedBatches.forEach((batch) => disposeInstancedBatch(batch));
      customObjectInstancedBatches.clear();
      customObjectMaterialCache.forEach((mat) => mat.dispose());
      customObjectTextureCache.forEach((tex) => tex.dispose());
      proceduralTextureBaseCache.forEach((tex) => tex.dispose());
      importedModelMaterialCache.forEach((mat) => mat.dispose());
      importedModelTextureVariantCache.forEach((tex) => tex.dispose());
      importedModelTextureBaseCache.forEach((tex) => tex.dispose());
      proceduralFallbackMaterial.dispose();
      customObjectVideoCache.forEach((entry) => {
        try {
          entry?.video?.pause?.();
          if (entry?.video) entry.video.src = "";
        } catch {
          // no-op
        }
        entry?.texture?.dispose?.();
      });
      overrideBillboardMaterialCache.forEach((mat) => mat.dispose());
      overrideTextureCache.forEach((tex) => tex.dispose());
      overrideVideoCache.forEach((entry) => {
        try {
          entry?.video?.pause?.();
          if (entry?.video) entry.video.src = "";
        } catch {
          // no-op
        }
        entry?.texture?.dispose?.();
      });
      playerAnimationState.mixer?.stopAllAction?.();
      if (playerAnimationState.root) {
        playerAnimationState.root.traverse((node) => {
          if (!node.isMesh) return;
          node.geometry?.dispose?.();
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => mat?.dispose?.());
          } else {
            node.material?.dispose?.();
          }
        });
      }
      playerBody.geometry.dispose();
      playerBody.material.dispose();
      bossBody.geometry.dispose();
      bossBody.material.dispose();
      bossTop.geometry.dispose();
      bossTop.material.dispose();
      blockMap.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      powerBoxMap.forEach((mesh) => {
        mesh.userData?.disposeSelf?.();
      });
      powerBreakMap.forEach((mesh) => {
        mesh.userData?.disposeSelf?.();
      });
      obstacleMap.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      impactMap.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      elevatedSegmentMap.forEach((entry) => {
        entry?.group?.traverse((node) => {
          if (!node?.isMesh) return;
          node.geometry?.dispose?.();
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => mat?.dispose?.());
          } else {
            node.material?.dispose?.();
          }
        });
      });

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [
    sandTextureUrl,
    treeTextureUrl,
    vegetationTextureUrls,
    edgeVegetationTextureUrls,
    obstacleTextureUrl,
    horizonTextureUrl,
    shadowOverlayTextureUrl,
    roadShoulderTextureUrl,
    roadShoulderNormalUrl,
    roadShoulderRoughnessUrl,
    roadShoulderAoUrl,
    roadSlopeTextureUrl,
    grassTopTextureUrl,
    roadBaseNormalUrl,
    roadBaseRoughnessUrl,
    roadBaseAoUrl,
    onSceneReady,
    onIntroComplete,
  ]);

  return <div ref={mountRef} className={className} />;
}
