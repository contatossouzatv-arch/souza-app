import React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries, mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { resolveAssetUrl } from "@/api/base44Client";
import ImportedTextureEditorDialog from "@/components/game/ImportedTextureEditorDialog";
import FinalCharacterPreviewDialog from "@/components/game/FinalCharacterPreviewDialog";
import AnimationStudioDialog from "@/components/game/AnimationStudioDialog";

const IMPORTED_SUBDIV_MAX_VERTICES = 220000;
const EDGE_OVERLAY_MAX_VERTICES = 90000;
const MODEL_TOOLS = ["select", "move", "vertex"];
const SCULPT_BRUSH_TOOLS = [
  "sculpt",
  "draw_sharp",
  "clay",
  "clay_strips",
  "flatten",
  "fill",
  "scrape",
  "smooth",
  "inflate",
  "blob",
  "pinch",
  "crease",
  "relax",
  "paint",
];
const BRUSH_LABELS = {
  sculpt: "Draw",
  draw_sharp: "Draw Sharp",
  clay: "Clay",
  clay_strips: "Clay Strips",
  flatten: "Flatten",
  fill: "Fill",
  scrape: "Scrape",
  smooth: "Smooth",
  inflate: "Inflate",
  blob: "Blob",
  pinch: "Pinch",
  crease: "Crease",
  relax: "Relax",
  paint: "Paint",
};
const PAINT_POINTER_TYPES = [
  { key: "standard", label: "Padrao" },
  { key: "precision", label: "Precisao" },
  { key: "spray", label: "Spray" },
];

function HoverMenu({ label, accent = "cyan", summary = "", className = "", children }) {
  const accentClasses =
    accent === "amber"
      ? "border-amber-500/45 bg-amber-950/70 text-amber-100"
      : accent === "emerald"
        ? "border-emerald-500/45 bg-emerald-950/70 text-emerald-100"
        : accent === "fuchsia"
          ? "border-fuchsia-500/45 bg-fuchsia-950/70 text-fuchsia-100"
          : "border-cyan-500/45 bg-slate-950/88 text-cyan-100";
  return (
    <div className={`group pointer-events-auto relative ${className}`}>
      <button
        type="button"
        className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold shadow-[0_8px_20px_rgba(2,6,23,0.28)] transition ${accentClasses}`}
      >
        <span>{label}</span>
        {summary ? <span className="max-w-[160px] truncate text-[10px] font-normal opacity-80">{summary}</span> : null}
      </button>
      <div className="pointer-events-none absolute left-0 top-full z-40 w-[min(92vw,320px)] pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-[0_18px_50px_rgba(2,6,23,0.7)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function toNum(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function toSeg(value, fallback, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
  return raw;
}

function detectModelExt(url) {
  const safe = String(url || "").toLowerCase().split("?")[0].split("#")[0];
  if (safe.endsWith(".fbx")) return "fbx";
  if (safe.endsWith(".obj")) return "obj";
  if (safe.endsWith(".stl")) return "stl";
  return "gltf";
}

function normalizeImportedTextureSlot(value) {
  const slot = String(value || "").trim().toLowerCase();
  if (slot === "side" || slot === "back") return slot;
  return "front";
}

function cloneTextureImageToCanvas(image) {
  if (!image) return null;
  const width = Math.max(1, Math.floor(Number(image.width || image.videoWidth || image.naturalWidth || 0)));
  const height = Math.max(1, Math.floor(Number(image.height || image.videoHeight || image.naturalHeight || 0)));
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function normalizeGeometryToViewport(geometry, options = {}) {
  if (!geometry?.attributes?.position) return geometry;
  const preserveUv = options?.preserveUv === true;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  const scale = 2 / maxDim;
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = (pos.getX(i) - center.x) * scale;
    const y = (pos.getY(i) - center.y) * scale;
    const z = (pos.getZ(i) - center.z) * scale;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingBox();
  const normalizedBox = geometry.boundingBox;
  if (normalizedBox) {
    const lift = -normalizedBox.min.y;
    for (let i = 0; i < pos.count; i += 1) pos.setY(i, pos.getY(i) + lift);
    pos.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  const hasValidUv =
    !!geometry.attributes?.uv &&
    geometry.attributes.uv.count === geometry.attributes.position.count;
  if (!(preserveUv && hasValidUv)) {
    remapUvByBoxProjection(geometry);
  }
  return geometry;
}

function sanitizeGeometryForMerge(inputGeometry) {
  if (!inputGeometry?.attributes?.position) return null;
  const source = inputGeometry.clone();
  const pos = source.attributes.position;
  if (!pos) return null;
  if (!source.attributes.normal) source.computeVertexNormals();
  const uvSource = source.attributes.uv;
  const colorSource = source.attributes.color;
  if (!uvSource || uvSource.count !== pos.count) {
    source.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  }
  if (colorSource && colorSource.count !== pos.count) {
    source.deleteAttribute("color");
  }
  if (!Array.isArray(source.groups) || !source.groups.length) {
    source.clearGroups();
    const count = source.index ? source.index.count : pos.count;
    source.addGroup(0, count, 0);
  }
  return source;
}

function bakeMeshGeometryToWorld(node) {
  if (!node?.isMesh || !node?.geometry?.attributes?.position) return null;
  const geometry = node.geometry.clone();
  const pos = geometry.attributes?.position;
  if (!pos) {
    geometry.dispose?.();
    return null;
  }
  const applySkin =
    node.isSkinnedMesh && (typeof node.applyBoneTransform === "function" || typeof node.boneTransform === "function");
  if (applySkin) {
    const skinned = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      skinned.fromBufferAttribute(pos, i);
      if (typeof node.applyBoneTransform === "function") node.applyBoneTransform(i, skinned);
      else node.boneTransform(i, skinned);
      pos.setXYZ(i, skinned.x, skinned.y, skinned.z);
    }
    pos.needsUpdate = true;
  }
  geometry.applyMatrix4(node.matrixWorld);
  geometry.computeVertexNormals();
  return geometry;
}

function getAutoWeldEpsilon(geometry) {
  const attr = geometry?.attributes?.position;
  if (!attr) return 1e-4;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return 1e-4;
  const size = new THREE.Vector3();
  box.getSize(size);
  const diagonal = Math.max(0.0001, size.length());
  return Math.max(5e-5, Math.min(8e-3, diagonal * 0.0006));
}

function getConnectivityWeldEpsilon(geometry, referenceEpsilon = null) {
  const baseAuto = getAutoWeldEpsilon(geometry);
  const baseRef = Number.isFinite(Number(referenceEpsilon)) ? Math.max(1e-7, Number(referenceEpsilon)) : baseAuto;
  return Math.max(2e-5, Math.min(0.008, baseRef * 0.8));
}

function getSculptWeldEpsilon(geometry, referenceEpsilon = null) {
  const baseAuto = getAutoWeldEpsilon(geometry);
  const baseRef = Number.isFinite(Number(referenceEpsilon)) ? Math.max(1e-7, Number(referenceEpsilon)) : baseAuto;
  return Math.max(baseRef, Math.min(0.05, baseAuto * 4.5));
}

function getAutoRemeshVoxelSize(geometry) {
  const attr = geometry?.attributes?.position;
  if (!attr) return 0.003;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return 0.003;
  const size = new THREE.Vector3();
  box.getSize(size);
  const diagonal = Math.max(0.0001, size.length());
  return Math.max(0.0005, Math.min(0.04, diagonal * 0.0045));
}

function normalizeOffsets(rawOffsets) {
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
}

function normalizeVertexColors(rawColors) {
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
}

function pickNearestVertexFromHit(geometry, hit) {
  const face = hit?.face;
  if (!geometry?.attributes?.position || !face) return -1;
  const localPoint = hit.object?.worldToLocal ? hit.object.worldToLocal(hit.point.clone()) : hit.point.clone();
  const pos = geometry.attributes.position;
  const candidates = [Number(face.a), Number(face.b), Number(face.c)].filter((idx) => Number.isFinite(idx) && idx >= 0);
  if (!candidates.length) return -1;
  let best = candidates[0];
  let bestD2 = Number.POSITIVE_INFINITY;
  candidates.forEach((idx) => {
    const dx = pos.getX(idx) - localPoint.x;
    const dy = pos.getY(idx) - localPoint.y;
    const dz = pos.getZ(idx) - localPoint.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = idx;
    }
  });
  return best;
}

function splitIndexedFaceAtHit(geometry, hit) {
  if (!geometry?.attributes?.position || !hit?.face || !geometry.index) return null;
  const source = geometry.clone();
  const indexAttr = source.index;
  const posAttr = source.attributes.position;
  const triStart = Math.max(0, Math.floor(Number(hit.faceIndex) || 0) * 3);
  if (triStart + 2 >= indexAttr.count) return null;

  const localPoint = hit.object?.worldToLocal ? hit.object.worldToLocal(hit.point.clone()) : hit.point.clone();
  const ia = indexAttr.getX(triStart);
  const ib = indexAttr.getX(triStart + 1);
  const ic = indexAttr.getX(triStart + 2);
  const newVertexIndex = posAttr.count;

  const appendAttribute = (attr, values) => {
    if (!attr) return null;
    const next = new attr.array.constructor(attr.array.length + values.length);
    next.set(attr.array, 0);
    next.set(values, attr.array.length);
    return new THREE.BufferAttribute(next, attr.itemSize, attr.normalized);
  };

  source.setAttribute("position", appendAttribute(posAttr, [localPoint.x, localPoint.y, localPoint.z]));

  const uvAttr = source.attributes.uv;
  if (uvAttr) {
    const uv = hit.uv || new THREE.Vector2(
      (uvAttr.getX(ia) + uvAttr.getX(ib) + uvAttr.getX(ic)) / 3,
      (uvAttr.getY(ia) + uvAttr.getY(ib) + uvAttr.getY(ic)) / 3
    );
    source.setAttribute("uv", appendAttribute(uvAttr, [uv.x, uv.y]));
  }

  const colorAttr = source.attributes.color;
  if (colorAttr) {
    const r = (colorAttr.getX(ia) + colorAttr.getX(ib) + colorAttr.getX(ic)) / 3;
    const g = (colorAttr.getY(ia) + colorAttr.getY(ib) + colorAttr.getY(ic)) / 3;
    const b = (colorAttr.getZ(ia) + colorAttr.getZ(ib) + colorAttr.getZ(ic)) / 3;
    source.setAttribute("color", appendAttribute(colorAttr, [r, g, b]));
  }

  const normalAttr = source.attributes.normal;
  if (normalAttr) {
    const nx = (normalAttr.getX(ia) + normalAttr.getX(ib) + normalAttr.getX(ic)) / 3;
    const ny = (normalAttr.getY(ia) + normalAttr.getY(ib) + normalAttr.getY(ic)) / 3;
    const nz = (normalAttr.getZ(ia) + normalAttr.getZ(ib) + normalAttr.getZ(ic)) / 3;
    source.setAttribute("normal", appendAttribute(normalAttr, [nx, ny, nz]));
  }

  const oldIndex = indexAttr.array;
  const nextIndex = new oldIndex.constructor(oldIndex.length + 6);
  nextIndex.set(oldIndex.slice(0, triStart), 0);
  nextIndex.set([ia, ib, newVertexIndex, ib, ic, newVertexIndex, ic, ia, newVertexIndex], triStart);
  nextIndex.set(oldIndex.slice(triStart + 3), triStart + 9);
  source.setIndex(new THREE.BufferAttribute(nextIndex, 1));

  if (Array.isArray(source.groups) && source.groups.length) {
    source.groups = source.groups.map((group) => {
      const nextGroup = { ...group };
      if (triStart >= group.start + group.count) {
        nextGroup.start += 6;
      } else if (triStart >= group.start && triStart < group.start + group.count) {
        nextGroup.count += 6;
      }
      return nextGroup;
    });
  }

  source.computeVertexNormals();
  source.computeBoundingBox();
  source.computeBoundingSphere();
  source.userData = { ...(geometry.userData || {}) };
  return source;
}

function applyVertexColorsToGeometry(geometry, colorMap) {
  const attr = geometry?.attributes?.position;
  if (!attr) return;
  const count = Math.floor(attr.array.length / 3);
  const colors = new Float32Array(count * 3);
  colors.fill(1);
  const normalized = normalizeVertexColors(colorMap);
  Object.entries(normalized).forEach(([idxRaw, colorRaw]) => {
    const idx = Number(idxRaw);
    const ci = idx * 3;
    if (ci < 0 || ci + 2 >= colors.length) return;
    const c = new THREE.Color(Number(colorRaw) || 0xffffff);
    colors[ci] = c.r;
    colors[ci + 1] = c.g;
    colors[ci + 2] = c.b;
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.attributes.color.needsUpdate = true;
  geometry.userData = geometry.userData || {};
  geometry.userData.vertexColors = normalized;
}

function normalizeTextureSettings(rawSettings) {
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const wrap = String(raw.wrap || "repeat").toLowerCase();
  return {
    repeat_x: toNum(raw.repeat_x, 1, 0.05, 64),
    repeat_y: toNum(raw.repeat_y, 1, 0.05, 64),
    offset_x: toNum(raw.offset_x, 0, -4, 4),
    offset_y: toNum(raw.offset_y, 0, -4, 4),
    rotation_deg: toNum(raw.rotation_deg, 0, -360, 360),
    wrap: wrap === "clamp" || wrap === "mirror" ? wrap : "repeat",
  };
}

function applyTextureSettings(texture, rawSettings) {
  if (!texture) return;
  const settings = normalizeTextureSettings(rawSettings);
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
}

function applyImportedShadingNormals(geometry, options = {}) {
  if (!geometry?.attributes?.position) return;
  const isImported = !!geometry?.userData?.preserveImportedUv;
  const smoothShading = options?.smoothShading !== false;
  const autoSmooth = options?.autoSmooth !== false;
  const autoSmoothAngle = toNum(options?.autoSmoothAngle, 180, 1, 180);
  geometry.computeVertexNormals();
  if (!isImported || !smoothShading || !autoSmooth) return;
  try {
    const creased = toCreasedNormals(geometry, THREE.MathUtils.degToRad(autoSmoothAngle));
    const src = creased?.attributes?.normal;
    const pos = geometry?.attributes?.position;
    if (src && pos && src.count === pos.count) {
      geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(src.array), 3));
      geometry.attributes.normal.needsUpdate = true;
    }
    creased?.dispose?.();
  } catch {
    // keep default vertex normals
  }
}

function disposeMaterialWithMaps(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((item) => disposeMaterialWithMaps(item));
    return;
  }
  if (material?.userData?.__sharedFallback) return;
  if (material.map) material.map.dispose?.();
  material.dispose?.();
}

function cloneImportedMaterialTemplate(material) {
  const source =
    material?.isMaterial
      ? material
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.05 });
  const cloned = source.clone();
  if (source?.map?.isTexture) {
    cloned.map = source.map.clone();
    if (cloned.map.image) cloned.map.needsUpdate = true;
    cloned.map.colorSpace = THREE.SRGBColorSpace;
  } else {
    cloned.map = null;
  }
  cloned.vertexColors = true;
  return cloned;
}

function buildImportedMaterialFromTemplates(templates) {
  if (!Array.isArray(templates) || !templates.length) return null;
  if (templates.length === 1) return cloneImportedMaterialTemplate(templates[0]);
  return templates.map((item) => cloneImportedMaterialTemplate(item));
}

function midpoint3(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}

function midpoint2(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
}

function midpointColor(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}

function subdivideGeometryPreserveUv(geometry, options = {}) {
  if (!geometry?.attributes?.position) return null;
  const maxGrowth = toNum(options?.maxGrowth, 1.6, 1.05, 3.5);
  const maxVertices = Math.max(1000, Math.floor(toNum(options?.maxVertices, IMPORTED_SUBDIV_MAX_VERTICES, 1000, 5000000)));
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = source.attributes.position;
  if (!pos || pos.count < 3) {
    source.dispose?.();
    return null;
  }
  if (pos.count > maxVertices) {
    source.dispose?.();
    return null;
  }
  const targetVertices = Math.min(maxVertices, Math.floor(pos.count * maxGrowth));
  const maxSplitByBudget = Math.floor((targetVertices - pos.count) / 9);
  if (maxSplitByBudget <= 0) {
    source.dispose?.();
    return null;
  }
  const totalTriangles = Math.floor(pos.count / 3);
  const splitBudget = Math.max(1, Math.min(totalTriangles, maxSplitByBudget));
  const uv = source.attributes.uv;
  const color = source.attributes.color;
  const hasUv = !!uv && uv.count === pos.count;
  const hasColor = !!color && color.count === pos.count;
  const groups =
    Array.isArray(source.groups) && source.groups.length
      ? source.groups
      : [{ start: 0, count: pos.count, materialIndex: 0 }];

  const outPos = [];
  const outUv = [];
  const outColor = [];
  const outGroups = [];
  let splitCarry = 0;

  const readPos = (idx) => [pos.getX(idx), pos.getY(idx), pos.getZ(idx)];
  const readUv = (idx) => (hasUv ? [uv.getX(idx), uv.getY(idx)] : null);
  const readColor = (idx) => (hasColor ? [color.getX(idx), color.getY(idx), color.getZ(idx)] : null);
  const pushVertex = (p, t, c) => {
    outPos.push(p[0], p[1], p[2]);
    if (hasUv && t) outUv.push(t[0], t[1]);
    if (hasColor && c) outColor.push(c[0], c[1], c[2]);
  };
  const pushTri = (a, b, c) => {
    pushVertex(a.p, a.t, a.c);
    pushVertex(b.p, b.t, b.c);
    pushVertex(c.p, c.t, c.c);
  };

  groups.forEach((group) => {
    const start = Math.max(0, Math.floor(Number(group.start) || 0));
    const count = Math.max(0, Math.floor(Number(group.count) || 0));
    const end = Math.min(pos.count, start + count);
    const groupStart = outPos.length / 3;
    for (let i = start; i + 2 < end; i += 3) {
      const a = { p: readPos(i), t: readUv(i), c: readColor(i) };
      const b = { p: readPos(i + 1), t: readUv(i + 1), c: readColor(i + 1) };
      const c = { p: readPos(i + 2), t: readUv(i + 2), c: readColor(i + 2) };
      splitCarry += splitBudget;
      const splitThis = splitCarry >= totalTriangles;
      if (splitThis) splitCarry -= totalTriangles;
      if (!splitThis) {
        pushTri(a, b, c);
        continue;
      }
      const ab = { p: midpoint3(a.p, b.p), t: hasUv ? midpoint2(a.t, b.t) : null, c: hasColor ? midpointColor(a.c, b.c) : null };
      const bc = { p: midpoint3(b.p, c.p), t: hasUv ? midpoint2(b.t, c.t) : null, c: hasColor ? midpointColor(b.c, c.c) : null };
      const ca = { p: midpoint3(c.p, a.p), t: hasUv ? midpoint2(c.t, a.t) : null, c: hasColor ? midpointColor(c.c, a.c) : null };
      pushTri(a, ab, ca);
      pushTri(ab, b, bc);
      pushTri(ca, bc, c);
      pushTri(ab, bc, ca);
    }
    const groupCount = outPos.length / 3 - groupStart;
    if (groupCount > 0) {
      outGroups.push({
        start: groupStart,
        count: groupCount,
        materialIndex: Math.max(0, Math.floor(Number(group.materialIndex) || 0)),
      });
    }
  });

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  if (hasUv && outUv.length === (outPos.length / 3) * 2) {
    out.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUv), 2));
  }
  if (hasColor && outColor.length === outPos.length) {
    out.setAttribute("color", new THREE.BufferAttribute(new Float32Array(outColor), 3));
  }
  outGroups.forEach((group) => {
    out.addGroup(group.start, group.count, group.materialIndex);
  });
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { ...(source.userData || {}), preserveImportedUv: true };
  source.dispose?.();
  return out;
}

function cutGeometryByAxisPreserveUv(geometry, axis = "x", keepPositive = true) {
  if (!geometry?.attributes?.position) return null;
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = source.attributes.position;
  if (!pos || pos.count < 3) {
    source.dispose?.();
    return null;
  }
  source.computeBoundingBox();
  const box = source.boundingBox;
  if (!box) {
    source.dispose?.();
    return null;
  }
  const axisKey = axis === "y" || axis === "z" ? axis : "x";
  const plane = axisKey === "x" ? (box.min.x + box.max.x) * 0.5 : axisKey === "y" ? (box.min.y + box.max.y) * 0.5 : (box.min.z + box.max.z) * 0.5;
  const uv = source.attributes.uv;
  const color = source.attributes.color;
  const hasUv = !!uv && uv.count === pos.count;
  const hasColor = !!color && color.count === pos.count;
  const groups =
    Array.isArray(source.groups) && source.groups.length
      ? source.groups
      : [{ start: 0, count: pos.count, materialIndex: 0 }];
  const outPos = [];
  const outUv = [];
  const outColor = [];
  const outGroups = [];

  const readPos = (idx) => [pos.getX(idx), pos.getY(idx), pos.getZ(idx)];
  const readUv = (idx) => (hasUv ? [uv.getX(idx), uv.getY(idx)] : null);
  const readColor = (idx) => (hasColor ? [color.getX(idx), color.getY(idx), color.getZ(idx)] : null);
  const pushVertex = (p, t, c) => {
    outPos.push(p[0], p[1], p[2]);
    if (hasUv && t) outUv.push(t[0], t[1]);
    if (hasColor && c) outColor.push(c[0], c[1], c[2]);
  };

  groups.forEach((group) => {
    const start = Math.max(0, Math.floor(Number(group.start) || 0));
    const count = Math.max(0, Math.floor(Number(group.count) || 0));
    const end = Math.min(pos.count, start + count);
    const groupStart = outPos.length / 3;
    for (let i = start; i + 2 < end; i += 3) {
      const a = readPos(i);
      const b = readPos(i + 1);
      const c = readPos(i + 2);
      const centroid =
        axisKey === "x"
          ? (a[0] + b[0] + c[0]) / 3
          : axisKey === "y"
          ? (a[1] + b[1] + c[1]) / 3
          : (a[2] + b[2] + c[2]) / 3;
      const keep = keepPositive ? centroid >= plane : centroid <= plane;
      if (!keep) continue;
      pushVertex(a, readUv(i), readColor(i));
      pushVertex(b, readUv(i + 1), readColor(i + 1));
      pushVertex(c, readUv(i + 2), readColor(i + 2));
    }
    const groupCount = outPos.length / 3 - groupStart;
    if (groupCount > 0) {
      outGroups.push({
        start: groupStart,
        count: groupCount,
        materialIndex: Math.max(0, Math.floor(Number(group.materialIndex) || 0)),
      });
    }
  });

  if (!outPos.length) {
    source.dispose?.();
    return null;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  if (hasUv && outUv.length === (outPos.length / 3) * 2) {
    out.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUv), 2));
  }
  if (hasColor && outColor.length === outPos.length) {
    out.setAttribute("color", new THREE.BufferAttribute(new Float32Array(outColor), 3));
  }
  outGroups.forEach((group) => out.addGroup(group.start, group.count, group.materialIndex));
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { ...(source.userData || {}), preserveImportedUv: true };
  source.dispose?.();
  return out;
}

function weldImportedGeometryByDistance(geometry, epsilon = null, options = {}) {
  if (!geometry?.attributes?.position) return null;
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = source.attributes.position;
  if (!pos || pos.count < 3) {
    source.dispose?.();
    return null;
  }
  const resolvedEpsilon = Number.isFinite(Number(epsilon)) ? Math.max(1e-7, Number(epsilon)) : getAutoWeldEpsilon(source);
  const connectedOnly = options?.connectedOnly !== false;
  const sourceUv = source.attributes.uv;
  const sourceColor = source.attributes.color;
  const hasUv = !!sourceUv && sourceUv.count === pos.count;
  const hasColor = !!sourceColor && sourceColor.count === pos.count;

  // Merge by position only (Blender-like Merge by Distance behavior for sculpt).
  let out = null;
  if (!connectedOnly) {
    const mergeBase = source.clone();
    Object.keys(mergeBase.attributes || {}).forEach((name) => {
      if (name !== "position") mergeBase.deleteAttribute(name);
    });
    const merged = mergeVertices(mergeBase, resolvedEpsilon);
    mergeBase.dispose?.();
    if (!merged) {
      source.dispose?.();
      return null;
    }
    out = merged.clone();
    merged.dispose?.();
  } else {
    const connectivityEpsilon = getConnectivityWeldEpsilon(source, resolvedEpsilon);
    const connectivityLookup = getWeldLookup(source, connectivityEpsilon);
    const topology = buildTopologyComponents(source, connectivityLookup);
    const outPos = [];
    const buckets = new Map();
    const componentByIndex = topology?.componentByIndex;
    if (componentByIndex) {
      for (let i = 0; i < pos.count; i += 1) {
        const comp = Number(componentByIndex[i]);
        const list = buckets.get(comp);
        if (list) list.push(i);
        else buckets.set(comp, [i]);
      }
    } else {
      const all = [];
      for (let i = 0; i < pos.count; i += 1) all.push(i);
      buckets.set(0, all);
    }
    buckets.forEach((indices) => {
      if (!Array.isArray(indices) || !indices.length) return;
      const localPos = new Float32Array(indices.length * 3);
      indices.forEach((srcIdx, k) => {
        const si = srcIdx * 3;
        const di = k * 3;
        localPos[di] = pos.array[si];
        localPos[di + 1] = pos.array[si + 1];
        localPos[di + 2] = pos.array[si + 2];
      });
      const localGeo = new THREE.BufferGeometry();
      localGeo.setAttribute("position", new THREE.BufferAttribute(localPos, 3));
      const localMerged = mergeVertices(localGeo, resolvedEpsilon);
      localGeo.dispose?.();
      if (!localMerged) return;
      const localOut = localMerged.index ? localMerged.toNonIndexed() : localMerged.clone();
      localMerged.dispose?.();
      const localOutPos = localOut?.attributes?.position;
      if (localOutPos?.count) {
        for (let i = 0; i < localOutPos.count; i += 1) {
          outPos.push(localOutPos.getX(i), localOutPos.getY(i), localOutPos.getZ(i));
        }
      }
      localOut.dispose?.();
    });
    if (!outPos.length) {
      source.dispose?.();
      return null;
    }
    out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  }
  const outPos = out.attributes?.position;
  if (!outPos || outPos.count < 3) {
    out.dispose?.();
    source.dispose?.();
    return null;
  }

  // Reproject UV/color from nearest source vertex to preserve imported look as much as possible.
  if (hasUv) {
    const uvOut = new Float32Array(outPos.count * 2);
    for (let i = 0; i < outPos.count; i += 1) {
      const x = outPos.getX(i);
      const y = outPos.getY(i);
      const z = outPos.getZ(i);
      let best = -1;
      let bestD2 = Number.POSITIVE_INFINITY;
      for (let j = 0; j < pos.count; j += 1) {
        const dx = pos.getX(j) - x;
        const dy = pos.getY(j) - y;
        const dz = pos.getZ(j) - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = j;
        }
      }
      const ui = i * 2;
      if (best >= 0) {
        uvOut[ui] = sourceUv.getX(best);
        uvOut[ui + 1] = sourceUv.getY(best);
      }
    }
    out.setAttribute("uv", new THREE.BufferAttribute(uvOut, 2));
  }
  if (hasColor) {
    const colOut = new Float32Array(outPos.count * 3);
    for (let i = 0; i < outPos.count; i += 1) {
      const x = outPos.getX(i);
      const y = outPos.getY(i);
      const z = outPos.getZ(i);
      let best = -1;
      let bestD2 = Number.POSITIVE_INFINITY;
      for (let j = 0; j < pos.count; j += 1) {
        const dx = pos.getX(j) - x;
        const dy = pos.getY(j) - y;
        const dz = pos.getZ(j) - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = j;
        }
      }
      const ci = i * 3;
      if (best >= 0) {
        colOut[ci] = sourceColor.getX(best);
        colOut[ci + 1] = sourceColor.getY(best);
        colOut[ci + 2] = sourceColor.getZ(best);
      }
    }
    out.setAttribute("color", new THREE.BufferAttribute(colOut, 3));
  }
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { ...(source.userData || {}), preserveImportedUv: true };
  source.dispose?.();
  return out;
}

function remeshImportedGeometryVoxelSnap(geometry, voxelSize = null) {
  if (!geometry?.attributes?.position) return null;
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = source.attributes.position;
  if (!pos || pos.count < 3) {
    source.dispose?.();
    return null;
  }
  if (pos.count > 900000) {
    source.dispose?.();
    return null;
  }
  const resolvedVoxel = Number.isFinite(Number(voxelSize))
    ? Math.max(1e-5, Number(voxelSize))
    : getAutoRemeshVoxelSize(source);
  const invVoxel = 1 / resolvedVoxel;
  const keyFor = (x, y, z) => {
    const qx = Math.round(x * invVoxel);
    const qy = Math.round(y * invVoxel);
    const qz = Math.round(z * invVoxel);
    return `${qx}|${qy}|${qz}`;
  };
  const quantToPos = (key) => {
    const [qx, qy, qz] = String(key).split("|").map((v) => Number(v) || 0);
    return [qx * resolvedVoxel, qy * resolvedVoxel, qz * resolvedVoxel];
  };
  const sourceUv = source.attributes.uv;
  const sourceColor = source.attributes.color;
  const hasUv = !!sourceUv && sourceUv.count === pos.count;
  const hasColor = !!sourceColor && sourceColor.count === pos.count;
  const uvAcc = hasUv ? new Map() : null;
  const colorAcc = hasColor ? new Map() : null;

  for (let i = 0; i < pos.count; i += 1) {
    const k = keyFor(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (hasUv) {
      const prev = uvAcc.get(k) || [0, 0, 0];
      prev[0] += sourceUv.getX(i);
      prev[1] += sourceUv.getY(i);
      prev[2] += 1;
      uvAcc.set(k, prev);
    }
    if (hasColor) {
      const prev = colorAcc.get(k) || [0, 0, 0, 0];
      prev[0] += sourceColor.getX(i);
      prev[1] += sourceColor.getY(i);
      prev[2] += sourceColor.getZ(i);
      prev[3] += 1;
      colorAcc.set(k, prev);
    }
  }

  const readUv = (key) => {
    if (!hasUv) return [0, 0];
    const acc = uvAcc.get(key);
    if (!acc || acc[2] <= 0) return [0, 0];
    return [acc[0] / acc[2], acc[1] / acc[2]];
  };
  const readColor = (key) => {
    if (!hasColor) return [1, 1, 1];
    const acc = colorAcc.get(key);
    if (!acc || acc[3] <= 0) return [1, 1, 1];
    return [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]];
  };

  const groups =
    Array.isArray(source.groups) && source.groups.length
      ? source.groups
      : [{ start: 0, count: pos.count, materialIndex: 0 }];
  const outPos = [];
  const outUv = [];
  const outColor = [];
  const outGroups = [];
  groups.forEach((group) => {
    const start = Math.max(0, Math.floor(Number(group?.start) || 0));
    const end = Math.min(pos.count, start + Math.max(0, Math.floor(Number(group?.count) || 0)));
    const groupStart = outPos.length / 3;
    for (let i = start; i + 2 < end; i += 3) {
      const k0 = keyFor(pos.getX(i), pos.getY(i), pos.getZ(i));
      const k1 = keyFor(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const k2 = keyFor(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      if (k0 === k1 || k1 === k2 || k2 === k0) continue;
      const p0 = quantToPos(k0);
      const p1 = quantToPos(k1);
      const p2 = quantToPos(k2);
      outPos.push(...p0, ...p1, ...p2);
      if (hasUv) {
        outUv.push(...readUv(k0), ...readUv(k1), ...readUv(k2));
      }
      if (hasColor) {
        outColor.push(...readColor(k0), ...readColor(k1), ...readColor(k2));
      }
    }
    const groupCount = outPos.length / 3 - groupStart;
    if (groupCount > 0) {
      outGroups.push({
        start: groupStart,
        count: groupCount,
        materialIndex: Math.max(0, Math.floor(Number(group.materialIndex) || 0)),
      });
    }
  });
  if (!outPos.length) {
    source.dispose?.();
    return null;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  if (hasUv && outUv.length === (outPos.length / 3) * 2) {
    out.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUv), 2));
  }
  if (hasColor && outColor.length === outPos.length) {
    out.setAttribute("color", new THREE.BufferAttribute(new Float32Array(outColor), 3));
  }
  outGroups.forEach((group) => out.addGroup(group.start, group.count, group.materialIndex));
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { ...(source.userData || {}), preserveImportedUv: true };
  source.dispose?.();
  return out;
}

function optimizeImportedGeometryForGame(geometry, options = {}) {
  if (!geometry?.attributes?.position) return null;
  const base = geometry.clone();
  const weldEpsilon = Number.isFinite(Number(options?.weldEpsilon))
    ? Math.max(1e-7, Number(options.weldEpsilon))
    : Math.max(1e-5, getAutoWeldEpsilon(base) * 0.65);
  const welded = weldImportedGeometryByDistance(base, weldEpsilon, { connectedOnly: false });
  base.dispose?.();
  if (!welded?.attributes?.position) return null;
  welded.computeVertexNormals();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  welded.userData = { ...(welded.userData || {}), preserveImportedUv: true };
  return welded;
}

function getWeldLookup(geometry, epsilon = null) {
  const attr = geometry?.attributes?.position;
  if (!attr) return null;
  const resolvedEpsilon = Number.isFinite(Number(epsilon)) ? Number(epsilon) : getAutoWeldEpsilon(geometry);
  const cached = geometry?.userData?.weldLookup;
  if (
    cached &&
    cached.count === attr.count &&
    cached.epsilon === resolvedEpsilon &&
    cached.arrayRef === attr.array
  ) {
    return cached;
  }
  const weldEps = Math.max(1e-7, resolvedEpsilon);
  const epsilonSq = weldEps * weldEps;
  const invCell = 1 / weldEps;
  const cellKey = (cx, cy, cz) => `${cx}|${cy}|${cz}`;
  const buckets = new Map();
  const count = attr.count;
  const parent = new Int32Array(count);
  const rank = new Int8Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (x) => {
    let p = x;
    while (parent[p] !== p) {
      parent[p] = parent[parent[p]];
      p = parent[p];
    }
    return p;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra] += 1;
    }
  };
  for (let i = 0; i < count; i += 1) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const z = attr.getZ(i);
    const cx = Math.floor(x * invCell);
    const cy = Math.floor(y * invCell);
    const cz = Math.floor(z * invCell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const list = buckets.get(cellKey(cx + dx, cy + dy, cz + dz));
          if (!list || !list.length) continue;
          for (let k = 0; k < list.length; k += 1) {
            const j = list[k];
            const ddx = attr.getX(j) - x;
            const ddy = attr.getY(j) - y;
            const ddz = attr.getZ(j) - z;
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 <= epsilonSq) unite(i, j);
          }
        }
      }
    }
    const ownKey = cellKey(cx, cy, cz);
    const ownList = buckets.get(ownKey);
    if (ownList) ownList.push(i);
    else buckets.set(ownKey, [i]);
  }
  const groupsByRoot = new Map();
  for (let i = 0; i < count; i += 1) {
    const root = find(i);
    const list = groupsByRoot.get(root);
    if (list) list.push(i);
    else groupsByRoot.set(root, [i]);
  }
  const membersByIndex = new Array(attr.count);
  groupsByRoot.forEach((list) => {
    const members = list.length > 1 ? list : null;
    list.forEach((idx) => {
      membersByIndex[idx] = members;
    });
  });
  const lookup = { count: attr.count, epsilon: resolvedEpsilon, arrayRef: attr.array, membersByIndex };
  geometry.userData = geometry.userData || {};
  geometry.userData.weldLookup = lookup;
  return lookup;
}

function buildTopologyComponents(geometry, weldLookup = null) {
  const attr = geometry?.attributes?.position;
  if (!attr) return null;
  const count = attr.count;
  if (!Number.isFinite(count) || count <= 0) return null;
  const epsilonKey = Number(weldLookup?.epsilon || 0);
  const cached = geometry?.userData?.topologyComponents;
  if (
    cached &&
    cached.count === count &&
    cached.arrayRef === attr.array &&
    cached.epsilonKey === epsilonKey
  ) {
    return cached;
  }
  const parent = new Int32Array(count);
  const rank = new Int8Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (x) => {
    let p = x;
    while (parent[p] !== p) {
      parent[p] = parent[parent[p]];
      p = parent[p];
    }
    return p;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra] += 1;
    }
  };
  const idx = geometry?.index;
  if (idx?.array?.length >= 3) {
    const arr = idx.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const a = Number(arr[i]);
      const b = Number(arr[i + 1]);
      const c = Number(arr[i + 2]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) continue;
      if (a < 0 || b < 0 || c < 0 || a >= count || b >= count || c >= count) continue;
      unite(a, b);
      unite(b, c);
      unite(c, a);
    }
  } else {
    for (let i = 0; i + 2 < count; i += 3) {
      unite(i, i + 1);
      unite(i + 1, i + 2);
      unite(i + 2, i);
    }
  }
  const members = weldLookup?.membersByIndex || [];
  for (let i = 0; i < members.length; i += 1) {
    const group = members[i];
    if (!group || group.length < 2) continue;
    const seed = Number(group[0]);
    if (!Number.isFinite(seed)) continue;
    for (let j = 1; j < group.length; j += 1) {
      const idx = Number(group[j]);
      if (!Number.isFinite(idx)) continue;
      unite(seed, idx);
    }
  }
  const componentByIndex = new Int32Array(count);
  for (let i = 0; i < count; i += 1) componentByIndex[i] = find(i);
  const out = { count, arrayRef: attr.array, epsilonKey, componentByIndex };
  geometry.userData = geometry.userData || {};
  geometry.userData.topologyComponents = out;
  return out;
}

function buildImportedMeshStats(geometry) {
  const attr = geometry?.attributes?.position;
  if (!attr) return null;
  const vertices = Math.floor(attr.count || 0);
  const triangles = geometry?.index?.count ? Math.floor(geometry.index.count / 3) : Math.floor(vertices / 3);
  const weldLookup = getWeldLookup(geometry, null);
  let weldGroups = 0;
  let weldableVertices = 0;
  const seen = new Set();
  const members = weldLookup?.membersByIndex || [];
  for (let i = 0; i < members.length; i += 1) {
    const group = members[i];
    if (!group || group.length < 2) continue;
    const first = Number(group[0]);
    if (!Number.isFinite(first) || seen.has(first)) continue;
    seen.add(first);
    weldGroups += 1;
    weldableVertices += group.length;
  }
  const duplicateVertices = Math.max(0, weldableVertices - weldGroups);
  return {
    vertices,
    triangles,
    weldGroups,
    weldableVertices,
    duplicateVertices,
  };
}

function stitchGeometryVerticesByDistance(geometry, epsilon = null) {
  const attr = geometry?.attributes?.position;
  if (!attr) return 0;
  const resolvedEpsilon = Number.isFinite(Number(epsilon)) ? Math.max(1e-7, Number(epsilon)) : getAutoWeldEpsilon(geometry);
  const weldLookup = getWeldLookup(geometry, resolvedEpsilon);
  const groups = weldLookup?.membersByIndex || [];
  const visited = new Set();
  let changed = 0;
  for (let i = 0; i < groups.length; i += 1) {
    const members = groups[i];
    if (!members || members.length < 2) continue;
    const seed = Number(members[0]);
    if (!Number.isFinite(seed) || visited.has(seed)) continue;
    visited.add(seed);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    members.forEach((idx) => {
      sx += attr.getX(idx);
      sy += attr.getY(idx);
      sz += attr.getZ(idx);
    });
    const inv = 1 / members.length;
    const ax = sx * inv;
    const ay = sy * inv;
    const az = sz * inv;
    members.forEach((idx) => {
      const dx = Math.abs(attr.getX(idx) - ax);
      const dy = Math.abs(attr.getY(idx) - ay);
      const dz = Math.abs(attr.getZ(idx) - az);
      if (dx > 1e-9 || dy > 1e-9 || dz > 1e-9) changed += 1;
      attr.setXYZ(idx, ax, ay, az);
    });
  }
  if (changed > 0) attr.needsUpdate = true;
  return changed;
}

function rebaseGeometryFromCurrentPositions(geometry) {
  const attr = geometry?.attributes?.position;
  if (!attr) return;
  geometry.computeVertexNormals();
  const normalAttr = geometry?.attributes?.normal;
  if (!normalAttr) return;
  geometry.userData = geometry.userData || {};
  geometry.userData.basePositions = new Float32Array(attr.array);
  geometry.userData.baseNormals = new Float32Array(normalAttr.array);
}

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
  const mode = String(view || "front");
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

function applyOffsetsToGeometry(geometry, offsets, shadingOptions = null) {
  const attr = geometry?.attributes?.position;
  if (!attr) return;
  geometry.computeVertexNormals();
  const normalAttr = geometry?.attributes?.normal;
  if (!normalAttr) return;
  const hasBase =
    geometry?.userData?.basePositions &&
    geometry?.userData?.baseNormals &&
    geometry.userData.basePositions.length === attr.array.length &&
    geometry.userData.baseNormals.length === normalAttr.array.length;
  const base = hasBase ? geometry.userData.basePositions : new Float32Array(attr.array.length);
  const baseNormals = hasBase ? geometry.userData.baseNormals : new Float32Array(normalAttr.array.length);
  if (!hasBase) {
    base.set(attr.array);
    baseNormals.set(normalAttr.array);
  }
  attr.array.set(base);
  const normalized = normalizeOffsets(offsets);
  const isImportedSeamPreserved = !!geometry?.userData?.preserveImportedUv;
  const weldLookup = isImportedSeamPreserved ? getWeldLookup(geometry, getConnectivityWeldEpsilon(geometry, null)) : null;
  const sharedNormalCache = new Map();
  const getSharedNormal = (idx) => {
    const members = weldLookup?.membersByIndex?.[idx];
    if (!members || members.length < 2) return null;
    const seed = Number(members[0]);
    if (sharedNormalCache.has(seed)) return sharedNormalCache.get(seed);
    let nx = 0;
    let ny = 0;
    let nz = 0;
    members.forEach((memberIdx) => {
      const ni = memberIdx * 3;
      nx += baseNormals[ni];
      ny += baseNormals[ni + 1];
      nz += baseNormals[ni + 2];
    });
    const inv = 1 / Math.max(0.000001, Math.hypot(nx, ny, nz));
    const normal = [nx * inv, ny * inv, nz * inv];
    sharedNormalCache.set(seed, normal);
    return normal;
  };
  Object.entries(normalized).forEach(([idxRaw, deltaY]) => {
    const idx = Number(idxRaw);
    const ai = idx * 3;
    if (ai < 0 || ai + 2 >= attr.array.length) return;
    const amount = Number(deltaY);
    const sharedNormal = getSharedNormal(idx);
    const nx = sharedNormal ? sharedNormal[0] : baseNormals[ai];
    const ny = sharedNormal ? sharedNormal[1] : baseNormals[ai + 1];
    const nz = sharedNormal ? sharedNormal[2] : baseNormals[ai + 2];
    attr.array[ai] = base[ai] + nx * amount;
    attr.array[ai + 1] = base[ai + 1] + ny * amount;
    attr.array[ai + 2] = base[ai + 2] + nz * amount;
  });
  attr.needsUpdate = true;
  applyImportedShadingNormals(geometry, shadingOptions || {});
  if (!geometry?.userData?.preserveImportedUv) {
    remapUvByBoxProjection(geometry);
  }
  geometry.userData = geometry.userData || {};
  geometry.userData.basePositions = base;
  geometry.userData.baseNormals = baseNormals;
}

function remapOffsetsByNearestSurface(sourceGeometry, targetBaseGeometry, options = {}) {
  const out = {};
  const sourcePos = sourceGeometry?.attributes?.position;
  const targetPos = targetBaseGeometry?.attributes?.position;
  if (!sourcePos || !targetPos || sourcePos.count < 1 || targetPos.count < 1) return out;
  targetBaseGeometry.computeVertexNormals();
  const targetNormal = targetBaseGeometry.attributes?.normal;
  if (!targetNormal || targetNormal.count !== targetPos.count) return out;

  const maxAbsOffset = toNum(options?.maxAbsOffset, 40, 0.1, 200);
  const sourceCount = sourcePos.count;
  const targetCount = targetPos.count;
  const complexity = sourceCount * targetCount;
  if (complexity > 24000000) {
    return out;
  }

  sourceGeometry.computeBoundingBox();
  const box = sourceGeometry.boundingBox;
  const size = new THREE.Vector3();
  box?.getSize(size);
  const longest = Math.max(0.0001, size.x, size.y, size.z);
  const cellSize = Math.max(0.0005, longest / 26);
  const invCell = 1 / cellSize;
  const min = box?.min || new THREE.Vector3();

  const cellKey = (x, y, z) => `${x}|${y}|${z}`;
  const buckets = new Map();
  for (let i = 0; i < sourceCount; i += 1) {
    const sx = sourcePos.getX(i);
    const sy = sourcePos.getY(i);
    const sz = sourcePos.getZ(i);
    const cx = Math.floor((sx - min.x) * invCell);
    const cy = Math.floor((sy - min.y) * invCell);
    const cz = Math.floor((sz - min.z) * invCell);
    const key = cellKey(cx, cy, cz);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  const nearestInBuckets = (x, y, z, cx, cy, cz) => {
    let bestIdx = -1;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let ring = 0; ring <= 2 && bestIdx < 0; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          for (let dz = -ring; dz <= ring; dz += 1) {
            const key = cellKey(cx + dx, cy + dy, cz + dz);
            const list = buckets.get(key);
            if (!list || !list.length) continue;
            for (let k = 0; k < list.length; k += 1) {
              const idx = list[k];
              const px = sourcePos.getX(idx);
              const py = sourcePos.getY(idx);
              const pz = sourcePos.getZ(idx);
              const d2 = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
              if (d2 < bestD2) {
                bestD2 = d2;
                bestIdx = idx;
              }
            }
          }
        }
      }
    }
    if (bestIdx >= 0) return bestIdx;
    // Fallback linear scan for sparse edge cases.
    for (let i = 0; i < sourceCount; i += 1) {
      const px = sourcePos.getX(i);
      const py = sourcePos.getY(i);
      const pz = sourcePos.getZ(i);
      const d2 = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  for (let i = 0; i < targetCount; i += 1) {
    const bx = targetPos.getX(i);
    const by = targetPos.getY(i);
    const bz = targetPos.getZ(i);
    const nx = targetNormal.getX(i);
    const ny = targetNormal.getY(i);
    const nz = targetNormal.getZ(i);
    const cx = Math.floor((bx - min.x) * invCell);
    const cy = Math.floor((by - min.y) * invCell);
    const cz = Math.floor((bz - min.z) * invCell);
    const nearest = nearestInBuckets(bx, by, bz, cx, cy, cz);
    if (nearest < 0) continue;
    const sx = sourcePos.getX(nearest);
    const sy = sourcePos.getY(nearest);
    const sz = sourcePos.getZ(nearest);
    const delta = (sx - bx) * nx + (sy - by) * ny + (sz - bz) * nz;
    const clamped = THREE.MathUtils.clamp(delta, -maxAbsOffset, maxAbsOffset);
    if (Math.abs(clamped) > 0.00001) out[String(i)] = clamped;
  }
  return out;
}

function buildGeometry(config) {
  const primitive = String(config?.primitive || "box");
  const weldVertices = !!config?.weldVertices;
  const width = toNum(config?.width, 1.8, 0.05, 120);
  const height = toNum(config?.height, 1.2, 0.05, 120);
  const depth = toNum(config?.depth, 1.4, 0.05, 120);
  const radiusTop = toNum(config?.radiusTop, 0.7, 0.02, 120);
  const radiusBottom = toNum(config?.radiusBottom, 0.9, 0.02, 120);
  const widthSegments = toSeg(config?.widthSegments, 1, 1, 64);
  const heightSegments = toSeg(config?.heightSegments, 1, 1, 64);
  const depthSegments = toSeg(config?.depthSegments, 1, 1, 64);
  const radialSegments = toSeg(config?.radialSegments, 8, 3, 64);

  const weldByPosition = (geometry) => {
    if (!weldVertices) return geometry;
    // Merge by position, not by UV/normal, avoiding seam tears on inflate.
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    return mergeVertices(geometry, 1e-4);
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
}

export default function ProceduralModelEditor({
  config,
  importModelUrl = "",
  importModelName = "",
  tool = "move",
  brushRadius = 0.9,
  brushStrength = 0.025,
  paintColor = "#9ca3af",
  paintData = {},
  toolStrengths = null,
  offsets = {},
  polygonEstimate = 0,
  segmentInfo = null,
  onOffsetsChange,
  onOffsetsCommit,
  onPaintChange,
  onPaintCommit,
  onPointerModeChange,
  onToolChange,
  onAdjustTopology,
  onBrushRadiusChange,
  onBrushStrengthChange,
  onToolStrengthChange,
  onSavePreset,
  saveRequestToken = 0,
  onSaveRequestDone,
  showViewportTexture = true,
  hasImportedTextureOverride = false,
  onRestoreImportedOriginalSkin,
  importedTextureEditSlot = "front",
  importedWeldVertices = false,
  importedWeldConnectedOnly = true,
  importedAutoMaskTopology = true,
  importedWeldEpsilon = null,
  importedSmoothShading = true,
  importedAutoSmooth = true,
  importedAutoSmoothAngle = 180,
  initialAnimationStudioData = null,
  onAnimationStudioChange,
  onUndo,
  onRedo,
  onImportedGeometryReady,
  onImportedGeometryError,
  onImportedStats,
  onImportedWeldConnectedOnlyChange,
  onCommitImportedTextureEdit,
}) {
  const mountRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  const meshRef = React.useRef(null);
  const pointsRef = React.useRef(null);
  const affectedPointsRef = React.useRef(null);
  const selectedVertexMarkerRef = React.useRef(null);
  const edgesRef = React.useRef(null);
  const brushPreviewRef = React.useRef(null);
  const controlsRef = React.useRef(null);
  const pointerStateRef = React.useRef({
    active: false,
    pointerId: null,
    cameraDrag: false,
    invert: false,
    vertexDragStartY: 0,
    vertexStartOffset: 0,
  });
  const strokeStartOffsetsRef = React.useRef(null);
  const strokeStartPaintRef = React.useRef(null);
  const selectedVertexIndexRef = React.useRef(-1);
  const offsetsRef = React.useRef(normalizeOffsets(offsets));
  const paintRef = React.useRef(normalizeVertexColors(paintData));
  const textureLoaderRef = React.useRef(new THREE.TextureLoader());
  const textureCacheRef = React.useRef(new Map());
  const textureVariantCacheRef = React.useRef(new Map());
  const lastHighlightUpdateRef = React.useRef(0);
  const importedTexturePreviewCanvasRef = React.useRef(null);
  const [importedGeometry, setImportedGeometry] = React.useState(null);
  const [importedMaterialTemplates, setImportedMaterialTemplates] = React.useState(null);
  const dataRef = React.useRef({
    config,
    tool,
    brushRadius,
    brushStrength,
    paintColor,
    toolStrengths,
    importedWeldVertices,
    importedWeldConnectedOnly,
    importedAutoMaskTopology,
    importedWeldEpsilon,
    importedSmoothShading,
    importedAutoSmooth,
    importedAutoSmoothAngle,
    paintPointerType: "standard",
    vertexElasticMode: false,
    vertexNoTearMode: true,
  });
  const callbacksRef = React.useRef({
    onOffsetsChange,
    onOffsetsCommit,
    onPaintChange,
    onPaintCommit,
    onPointerModeChange,
  });
  const importedCallbacksRef = React.useRef({
    onImportedGeometryReady,
    onImportedGeometryError,
    onImportedStats,
  });
  const [edgeOverlayEnabled, setEdgeOverlayEnabled] = React.useState(true);
  const [pointerUi, setPointerUi] = React.useState({ x: 0, y: 0, visible: false, mode: "" });
  const [paintPointerType, setPaintPointerType] = React.useState("standard");
  const [vertexElasticMode, setVertexElasticMode] = React.useState(false);
  const [vertexNoTearMode, setVertexNoTearMode] = React.useState(true);
  const [vertexInteractionMode, setVertexInteractionMode] = React.useState("move");
  const [importedTextureEditorOpen, setImportedTextureEditorOpen] = React.useState(false);
  const [finalCharacterPreviewOpen, setFinalCharacterPreviewOpen] = React.useState(false);
  const [animationStudioOpen, setAnimationStudioOpen] = React.useState(false);
  const [animationStudioData, setAnimationStudioData] = React.useState(null);
  const [importedTextureEditorSourceImage, setImportedTextureEditorSourceImage] = React.useState(null);
  const [importedTextureEditorSourceUrl, setImportedTextureEditorSourceUrl] = React.useState("");
  const [importedTexturePreviewVersion, setImportedTexturePreviewVersion] = React.useState(0);
  const [modelSelected, setModelSelected] = React.useState(false);
  const [quickPanelPos, setQuickPanelPos] = React.useState({ x: 84, y: null });
  const [toolPanelMode, setToolPanelMode] = React.useState(
    SCULPT_BRUSH_TOOLS.includes(String(tool || "move")) ? "sculpt" : "model"
  );
  const [transformDraft, setTransformDraft] = React.useState({
    posX: "0.00",
    posY: "0.00",
    posZ: "0.00",
    rotY: "0.00",
    rotX: "0.00",
    rotZ: "0.00",
    scaleX: "1.00",
    scaleY: "1.00",
    scaleZ: "1.00",
  });
  const transformDraftRef = React.useRef({
    posX: "0.00",
    posY: "0.00",
    posZ: "0.00",
    rotY: "0.00",
    rotX: "0.00",
    rotZ: "0.00",
    scaleX: "1.00",
    scaleY: "1.00",
    scaleZ: "1.00",
  });
  const importedAutoFacingSignatureRef = React.useRef("");
  const quickPanelDragRef = React.useRef(null);
  const edgeOverlayFrameRef = React.useRef(null);
  const lastAnimationStudioPropRef = React.useRef("");

  React.useEffect(() => {
    offsetsRef.current = normalizeOffsets(offsets);
  }, [offsets]);
  React.useEffect(() => {
    paintRef.current = normalizeVertexColors(paintData);
  }, [paintData]);
  React.useEffect(() => {
    const nextMode = SCULPT_BRUSH_TOOLS.includes(String(tool || "move")) ? "sculpt" : "model";
    setToolPanelMode(nextMode);
  }, [tool]);

  React.useEffect(() => {
    const serialized = JSON.stringify(initialAnimationStudioData || null);
    if (lastAnimationStudioPropRef.current === serialized) return;
    lastAnimationStudioPropRef.current = serialized;
    setAnimationStudioData(initialAnimationStudioData || null);
  }, [initialAnimationStudioData]);

  React.useEffect(() => {
    dataRef.current = {
      config,
      tool,
      brushRadius,
      brushStrength,
      paintColor,
      toolStrengths,
      importedWeldVertices,
      importedWeldConnectedOnly,
      importedAutoMaskTopology,
      importedWeldEpsilon,
      importedSmoothShading,
      importedAutoSmooth,
      importedAutoSmoothAngle,
      paintPointerType,
      vertexElasticMode,
      vertexNoTearMode,
      vertexInteractionMode,
    };
  }, [config, tool, brushRadius, brushStrength, paintColor, toolStrengths, importedWeldVertices, importedWeldConnectedOnly, importedAutoMaskTopology, importedWeldEpsilon, importedSmoothShading, importedAutoSmooth, importedAutoSmoothAngle, paintPointerType, vertexElasticMode, vertexNoTearMode, vertexInteractionMode]);

  React.useEffect(() => {
    callbacksRef.current = {
      onOffsetsChange,
      onOffsetsCommit,
      onPaintChange,
      onPaintCommit,
      onPointerModeChange,
    };
  }, [onOffsetsChange, onOffsetsCommit, onPaintChange, onPaintCommit, onPointerModeChange]);

  React.useEffect(() => {
    importedCallbacksRef.current = {
      onImportedGeometryReady,
      onImportedGeometryError,
      onImportedStats,
    };
  }, [onImportedGeometryReady, onImportedGeometryError, onImportedStats]);

  React.useEffect(() => {
    const handleMove = (event) => {
      const drag = quickPanelDragRef.current;
      const host = wrapperRef.current;
      if (!drag || !host) return;
      const rect = host.getBoundingClientRect();
      const nextX = Math.max(8, Math.min(rect.width - 232, event.clientX - rect.left - drag.offsetX));
      const nextY = Math.max(56, Math.min(rect.height - 180, event.clientY - rect.top - drag.offsetY));
      setQuickPanelPos({ x: nextX, y: nextY });
    };
    const handleUp = () => {
      quickPanelDragRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      if (edgeOverlayFrameRef.current) {
        cancelAnimationFrame(edgeOverlayFrameRef.current);
        edgeOverlayFrameRef.current = null;
      }
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const scheduleEdgeOverlayRefresh = React.useCallback((geometry, options = {}) => {
    const edgeLines = edgesRef.current;
    if (!edgeLines) return;
    const shouldShow =
      options.visible !== false &&
      edgeOverlayEnabled &&
      geometry?.attributes?.position?.count <= EDGE_OVERLAY_MAX_VERTICES;
    if (edgeOverlayFrameRef.current) {
      cancelAnimationFrame(edgeOverlayFrameRef.current);
      edgeOverlayFrameRef.current = null;
    }
    edgeLines.visible = shouldShow;
    if (!shouldShow) {
      if (!(edgeLines.geometry instanceof THREE.BufferGeometry) || edgeLines.geometry.attributes?.position?.count) {
        edgeLines.geometry?.dispose?.();
        edgeLines.geometry = new THREE.BufferGeometry();
      }
      return;
    }
    edgeOverlayFrameRef.current = requestAnimationFrame(() => {
      edgeOverlayFrameRef.current = null;
      const currentLines = edgesRef.current;
      if (!currentLines) return;
      const nextEdges = new THREE.EdgesGeometry(geometry, 20);
      const previousEdges = currentLines.geometry;
      currentLines.geometry = nextEdges;
      previousEdges?.dispose?.();
      currentLines.visible = edgeOverlayEnabled && geometry?.attributes?.position?.count <= EDGE_OVERLAY_MAX_VERTICES;
    });
  }, [edgeOverlayEnabled]);

  React.useEffect(() => {
    const url = resolveSceneUploadUrl(importModelUrl);
    if (!url) {
      setImportedGeometry(null);
      setImportedMaterialTemplates(null);
      importedCallbacksRef.current?.onImportedStats?.(null);
      return undefined;
    }
    let cancelled = false;
    let mergedGeometry = null;
    let mergedMaterialTemplates = null;
    const manager = new THREE.LoadingManager();
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const fbxLoader = new FBXLoader(manager);
    const objLoader = new OBJLoader(manager);
    const stlLoader = new STLLoader(manager);
    const ext = detectModelExt(url);

    const done = (geometry, materialTemplates = null) => {
      if (cancelled) {
        geometry?.dispose?.();
        disposeMaterialWithMaps(materialTemplates);
        return;
      }
      let preparedGeometry = geometry || null;
      if (preparedGeometry?.attributes?.position && dataRef.current?.importedWeldVertices !== false) {
        const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
        const weldEpsilon = Number.isFinite(weldEpsilonRaw) ? Math.max(1e-7, weldEpsilonRaw) : null;
        const sculptEpsilon = getSculptWeldEpsilon(preparedGeometry, weldEpsilon);
        const welded = weldImportedGeometryByDistance(preparedGeometry, sculptEpsilon, { connectedOnly: false });
        if (welded) {
          if (welded !== preparedGeometry) preparedGeometry.dispose?.();
          preparedGeometry = welded;
        }
        applyImportedShadingNormals(preparedGeometry, {
          smoothShading: dataRef.current?.importedSmoothShading,
          autoSmooth: dataRef.current?.importedAutoSmooth,
          autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
        });
      }
      setImportedGeometry(preparedGeometry || null);
      setImportedMaterialTemplates(materialTemplates || null);
      mergedMaterialTemplates = null;
      if (preparedGeometry && typeof importedCallbacksRef.current?.onImportedStats === "function") {
        importedCallbacksRef.current.onImportedStats(buildImportedMeshStats(preparedGeometry));
      }
      if (preparedGeometry && typeof importedCallbacksRef.current?.onImportedGeometryReady === "function") {
        importedCallbacksRef.current.onImportedGeometryReady();
      }
    };
    const fail = (error) => {
      if (cancelled) return;
      setImportedGeometry(null);
      setImportedMaterialTemplates(null);
      importedCallbacksRef.current?.onImportedStats?.(null);
      if (mergedMaterialTemplates) {
        disposeMaterialWithMaps(mergedMaterialTemplates);
        mergedMaterialTemplates = null;
      }
      if (typeof importedCallbacksRef.current?.onImportedGeometryError === "function") {
        importedCallbacksRef.current.onImportedGeometryError(error);
      }
    };
    const fromObject3d = (object3d) => {
      try {
        const temp = object3d?.clone?.(true) || object3d;
        if (!temp) {
          fail(new Error("modelo sem malha"));
          return;
        }
        temp.updateMatrixWorld(true);
        const parts = [];
        const materialTemplates = [];
        let materialOffset = 0;
        temp.traverse((node) => {
          if (!node?.isMesh || !node.geometry?.attributes?.position) return;
          const baked = bakeMeshGeometryToWorld(node);
          if (!baked) return;
          const sanitized = sanitizeGeometryForMerge(baked);
          baked.dispose?.();
          if (sanitized) {
            if (Array.isArray(sanitized.groups) && sanitized.groups.length) {
              sanitized.groups.forEach((group) => {
                group.materialIndex = Math.max(0, Math.floor(Number(group.materialIndex) || 0)) + materialOffset;
              });
            } else {
              sanitized.clearGroups();
              sanitized.addGroup(0, sanitized.attributes.position.count, materialOffset);
            }
            parts.push(sanitized);
            const sourceList = Array.isArray(node.material) ? node.material : [node.material];
            const safeList = sourceList.length ? sourceList : [null];
            safeList.forEach((sourceMaterial) => {
              materialTemplates.push(cloneImportedMaterialTemplate(sourceMaterial));
            });
            materialOffset += safeList.length;
          }
        });
        if (!parts.length) {
          fail(new Error("nenhuma malha editavel encontrada"));
          return;
        }
        mergedGeometry = parts.length > 1 ? mergeGeometries(parts, true) : parts[0];
        mergedMaterialTemplates = materialTemplates.length ? materialTemplates : null;
        parts.forEach((g) => {
          if (g !== mergedGeometry) g.dispose?.();
        });
        if (!mergedGeometry) {
          fail(new Error("falha ao combinar malhas"));
          return;
        }
        normalizeGeometryToViewport(mergedGeometry, { preserveUv: true });
        mergedGeometry.userData = { ...(mergedGeometry.userData || {}), preserveImportedUv: true };
        done(mergedGeometry, mergedMaterialTemplates);
      } catch (error) {
        fail(error);
      }
    };

    try {
      if (ext === "fbx") {
        fbxLoader.load(url, (fbx) => fromObject3d(fbx || null), undefined, fail);
      } else if (ext === "obj") {
        objLoader.load(url, (obj) => fromObject3d(obj || null), undefined, fail);
      } else if (ext === "stl") {
        stlLoader.load(
          url,
          (geo) => {
            const g = sanitizeGeometryForMerge(geo);
            if (!g) {
              fail(new Error("stl invalido"));
              return;
            }
            normalizeGeometryToViewport(g);
            g.userData = { ...(g.userData || {}), preserveImportedUv: true };
            done(g, null);
          },
          undefined,
          fail
        );
      } else {
        gltfLoader.load(url, (gltf) => fromObject3d(gltf?.scene || null), undefined, fail);
      }
    } catch (error) {
      fail(error);
    }

    return () => {
      cancelled = true;
      dracoLoader.dispose();
      if (mergedGeometry) mergedGeometry.dispose?.();
      if (mergedMaterialTemplates) disposeMaterialWithMaps(mergedMaterialTemplates);
    };
  }, [importModelUrl]);

  React.useEffect(() => {
    return () => {
      disposeMaterialWithMaps(importedMaterialTemplates);
    };
  }, [importedMaterialTemplates]);

  const clearImportedTexturePreview = React.useCallback(() => {
    importedTexturePreviewCanvasRef.current = null;
    setImportedTexturePreviewVersion((prev) => prev + 1);
  }, []);

  const handleImportedTextureEditorOpen = React.useCallback(() => {
    if (!resolveSceneUploadUrl(importModelUrl)) return;
    const activeSlot = normalizeImportedTextureSlot(importedTextureEditSlot || config?.importedTextureProjection || "front");
    const sideTextures = config?.sideTextures || {};
    const slotUrl =
      activeSlot === "side"
        ? String(sideTextures?.side || "")
        : activeSlot === "back"
          ? String(sideTextures?.back || "")
          : String(sideTextures?.front || config?.textureUrl || "");
    const meshMaterial = meshRef.current?.material;
    let imageCanvas = null;
    const materialList = Array.isArray(meshMaterial) ? meshMaterial : meshMaterial ? [meshMaterial] : [];
    const activeMaterial = materialList.find((item) => item?.map?.image) || materialList[0] || null;
    if (activeMaterial?.map?.image) imageCanvas = cloneTextureImageToCanvas(activeMaterial.map.image);
    if (!imageCanvas) {
      const templateList = Array.isArray(importedMaterialTemplates) ? importedMaterialTemplates : importedMaterialTemplates ? [importedMaterialTemplates] : [];
      const templateMaterial = templateList.find((item) => item?.map?.image) || templateList[0] || null;
      if (templateMaterial?.map?.image) imageCanvas = cloneTextureImageToCanvas(templateMaterial.map.image);
    }
    setImportedTextureEditorSourceImage(imageCanvas);
    setImportedTextureEditorSourceUrl(slotUrl);
    setImportedTextureEditorOpen(true);
  }, [config?.importedTextureProjection, config?.sideTextures, config?.textureUrl, importModelUrl, importedMaterialTemplates, importedTextureEditSlot]);

  const handleImportedTexturePreviewChange = React.useCallback((canvas) => {
    importedTexturePreviewCanvasRef.current = canvas || null;
    setImportedTexturePreviewVersion((prev) => prev + 1);
  }, []);

  const handleImportedTextureEditorClose = React.useCallback(() => {
    setImportedTextureEditorOpen(false);
    setImportedTextureEditorSourceImage(null);
    setImportedTextureEditorSourceUrl("");
    clearImportedTexturePreview();
  }, [clearImportedTexturePreview]);

  const handleImportedTextureEditorApply = React.useCallback(async ({ file, slot, width, height }) => {
    if (typeof onCommitImportedTextureEdit === "function") {
      await onCommitImportedTextureEdit({ file, slot, width, height });
    }
    handleImportedTextureEditorClose();
  }, [handleImportedTextureEditorClose, onCommitImportedTextureEdit]);

  React.useEffect(() => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode || !importedGeometry?.attributes?.position) return;
    const signature = String(importModelUrl || "").trim();
    if (signature === importedAutoFacingSignatureRef.current) return;
    importedAutoFacingSignatureRef.current = signature;
    importedGeometry.computeBoundingBox();
    const size = importedGeometry.boundingBox?.getSize(new THREE.Vector3());
    const sx = Number(size?.x || 0);
    const sz = Number(size?.z || 0);
    // If depth axis is wider than the current front axis, rotate 90deg to face editor front.
    const autoRotY = sz > sx * 1.08 ? 90 : 0;
    setTransformDraft((prev) => ({
      ...(prev || {}),
      rotX: "0.00",
      rotY: autoRotY.toFixed(2),
      rotZ: "0.00",
    }));
    const controls = controlsRef.current;
    if (controls?.object) {
      controls.target.set(0, 0.4, 0);
      controls.object.position.set(0, 0.1, 7.4);
      controls.update();
    }
  }, [importModelUrl]);

  React.useEffect(() => {
    transformDraftRef.current = transformDraft;
    const px = toNum(transformDraft.posX, 0, -300, 300);
    const py = toNum(transformDraft.posY, 0, -300, 300);
    const pz = toNum(transformDraft.posZ, 0, -300, 300);
    const rx = THREE.MathUtils.degToRad(toNum(transformDraft.rotX, 0, -360, 360));
    const ry = THREE.MathUtils.degToRad(toNum(transformDraft.rotY, 0, -360, 360));
    const rz = THREE.MathUtils.degToRad(toNum(transformDraft.rotZ, 0, -360, 360));
    const sx = toNum(transformDraft.scaleX, 1, 0.05, 50);
    const sy = toNum(transformDraft.scaleY, 1, 0.05, 50);
    const sz = toNum(transformDraft.scaleZ, 1, 0.05, 50);
    [meshRef.current, pointsRef.current, edgesRef.current, affectedPointsRef.current, selectedVertexMarkerRef.current].forEach((node) => {
      if (!node) return;
      node.position.set(px, py, pz);
      node.rotation.set(rx, ry, rz);
      node.scale.set(sx, sy, sz);
    });
  }, [transformDraft]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1020");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1500);
    camera.position.set(4.4, 3.6, 5.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.minDistance = 0.45;
    controls.maxDistance = 40;
    controls.target.set(0, 0.4, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(4, 6, 3);
    scene.add(light);
    scene.add(new THREE.GridHelper(20, 20, 0x2dd4bf, 0x134e4a));

    const group = new THREE.Group();
    scene.add(group);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const raycastMeshAtPointer = (clientX, clientY, options = {}) => {
      const mesh = meshRef.current;
      if (!mesh) return [];
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const project = (x, y) => {
        ndc.x = ((x - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((y - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        return raycaster.intersectObject(mesh, true);
      };
      const directHits = project(clientX, clientY);
      if (directHits.length) return directHits;
      const fallbackPx = Math.max(4, Math.min(18, Number(options.fallbackPx) || 10));
      const samples = [
        [0, -fallbackPx],
        [fallbackPx, 0],
        [0, fallbackPx],
        [-fallbackPx, 0],
        [fallbackPx * 0.7, -fallbackPx * 0.7],
        [fallbackPx * 0.7, fallbackPx * 0.7],
        [-fallbackPx * 0.7, fallbackPx * 0.7],
        [-fallbackPx * 0.7, -fallbackPx * 0.7],
      ];
      let bestHits = [];
      let bestDistSq = Number.POSITIVE_INFINITY;
      samples.forEach(([dx, dy]) => {
        const hits = project(clientX + dx, clientY + dy);
        if (!hits.length) return;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestHits = hits;
        }
      });
      return bestHits;
    };

    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.92 });
    const pointMaterial = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.026,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const affectedPointMaterial = new THREE.PointsMaterial({
      color: 0xfacc15,
      size: 0.034,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const brushPreview = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        wireframe: true,
        depthWrite: false,
      })
    );
    brushPreview.visible = false;
    brushPreview.renderOrder = 4;
    scene.add(brushPreview);
    brushPreviewRef.current = brushPreview;

    const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.86, metalness: 0.05 });
    fallbackMat.userData.__sharedFallback = true;

    const getTexMat = (url, textureSettings, options = {}) => {
      const safe = String(url || "").trim();
      if (!safe) return fallbackMat;
      const key = resolveSceneUploadUrl(safe);
      if (!key) return fallbackMat;
      if (!textureCacheRef.current.has(key)) {
        try {
          const tex = textureLoaderRef.current.load(key);
          tex.colorSpace = THREE.SRGBColorSpace;
          textureCacheRef.current.set(key, tex);
        } catch {
          return fallbackMat;
        }
      }
      const settings = normalizeTextureSettings(textureSettings);
      const variantKey = `${key}::${JSON.stringify(settings)}`;
      if (!textureVariantCacheRef.current.has(variantKey)) {
        const baseTexture = textureCacheRef.current.get(key);
        const nextTexture = baseTexture?.clone?.() || baseTexture;
        if (nextTexture && options?.gltfLike) {
          nextTexture.flipY = false;
          nextTexture.needsUpdate = true;
        }
        applyTextureSettings(nextTexture, settings);
        textureVariantCacheRef.current.set(variantKey, nextTexture);
      }
      return new THREE.MeshStandardMaterial({
        map: textureVariantCacheRef.current.get(variantKey),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.05,
      });
    };

    const buildMaterial = () => {
      const primitive = String(dataRef.current?.config?.primitive || "box");
      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      const importedSmooth = dataRef.current?.importedSmoothShading !== false;
      const weldVertices = !!dataRef.current?.config?.weldVertices;
      const sideTextures = dataRef.current?.config?.sideTextures || {};
      const sideTextureSettings = dataRef.current?.config?.sideTextureSettings || {};
      const textureSettings = dataRef.current?.config?.textureSettings || {};
      const textureUrl = String(dataRef.current?.config?.textureUrl || "");
      const applyShadingMode = (material) => {
        const applyOne = (mat) => {
          if (!mat || !mat.isMaterial) return mat;
          mat.flatShading = !importedSmooth;
          mat.needsUpdate = true;
          return mat;
        };
        if (Array.isArray(material)) {
          material.forEach((m) => applyOne(m));
          return material;
        }
        return applyOne(material);
      };
      if (importedMode) {
        if (!showViewportTexture) return applyShadingMode(fallbackMat);
        const overrideTexture =
          textureUrl ||
          sideTextures?.surface ||
          sideTextures?.side ||
          sideTextures?.front ||
          sideTextures?.px;
        if (overrideTexture) return applyShadingMode(getTexMat(overrideTexture, textureSettings, { gltfLike: true }));
        const importedMaterial = buildImportedMaterialFromTemplates(importedMaterialTemplates);
        return applyShadingMode(importedMaterial || fallbackMat);
      }
      if (weldVertices) {
        return getTexMat(
          textureUrl ||
            sideTextures?.surface ||
            sideTextures?.side ||
            sideTextures?.front ||
            sideTextures?.px,
          textureSettings
        );
      }
      if (primitive === "cylinder") {
        return [
          getTexMat(sideTextures?.side || textureUrl, sideTextureSettings?.side || textureSettings),
          getTexMat(sideTextures?.top || textureUrl, sideTextureSettings?.top || textureSettings),
          getTexMat(sideTextures?.bottom || textureUrl, sideTextureSettings?.bottom || textureSettings),
        ];
      }
      if (primitive === "plane") {
        return getTexMat(
          sideTextures?.front || sideTextures?.back || textureUrl,
          sideTextureSettings?.front || sideTextureSettings?.back || textureSettings
        );
      }
      if (primitive === "sphere") {
        return getTexMat(sideTextures?.surface || textureUrl, sideTextureSettings?.surface || textureSettings);
      }
      return [
        getTexMat(sideTextures?.px || textureUrl, sideTextureSettings?.px || textureSettings),
        getTexMat(sideTextures?.nx || textureUrl, sideTextureSettings?.nx || textureSettings),
        getTexMat(sideTextures?.py || textureUrl, sideTextureSettings?.py || textureSettings),
        getTexMat(sideTextures?.ny || textureUrl, sideTextureSettings?.ny || textureSettings),
        getTexMat(sideTextures?.pz || textureUrl, sideTextureSettings?.pz || textureSettings),
        getTexMat(sideTextures?.nz || textureUrl, sideTextureSettings?.nz || textureSettings),
      ];
    };

    const rebuildMesh = () => {
      while (group.children.length) {
        const old = group.children.pop();
        if (old?.geometry) old.geometry.dispose();
      }

      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      const geo = importedMode && importedGeometry ? importedGeometry.clone() : buildGeometry(dataRef.current?.config || {});
      applyOffsetsToGeometry(geo, offsetsRef.current, {
        smoothShading: dataRef.current?.importedSmoothShading,
        autoSmooth: dataRef.current?.importedAutoSmooth,
        autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
      });
      applyVertexColorsToGeometry(geo, paintRef.current);
      const mesh = new THREE.Mesh(geo, buildMaterial());
      meshRef.current = mesh;
      group.add(mesh);

      const points = new THREE.Points(geo, pointMaterial);
      points.visible = false;
      points.renderOrder = 5;
      pointsRef.current = points;
      group.add(points);

      const affectedPoints = new THREE.Points(new THREE.BufferGeometry(), affectedPointMaterial);
      affectedPoints.visible = false;
      affectedPoints.renderOrder = 6;
      affectedPointsRef.current = affectedPoints;
      group.add(affectedPoints);

      const vertexMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95, depthWrite: false })
      );
      vertexMarker.visible = false;
      vertexMarker.renderOrder = 6;
      selectedVertexMarkerRef.current = vertexMarker;
      group.add(vertexMarker);

      const edgeGeo =
        geo?.attributes?.position?.count > EDGE_OVERLAY_MAX_VERTICES
          ? new THREE.BufferGeometry()
          : new THREE.EdgesGeometry(geo, 20);
      const edgeLines = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edgeLines.visible = edgeOverlayEnabled && geo?.attributes?.position?.count <= EDGE_OVERLAY_MAX_VERTICES;
      edgeLines.renderOrder = 3;
      edgesRef.current = edgeLines;
      group.add(edgeLines);

      const draft = transformDraftRef.current || {};
      const px = toNum(draft.posX, 0, -300, 300);
      const py = toNum(draft.posY, 0, -300, 300);
      const pz = toNum(draft.posZ, 0, -300, 300);
      const rx = THREE.MathUtils.degToRad(toNum(draft.rotX, 0, -360, 360));
      const ry = THREE.MathUtils.degToRad(toNum(draft.rotY, 0, -360, 360));
      const rz = THREE.MathUtils.degToRad(toNum(draft.rotZ, 0, -360, 360));
      const sx = toNum(draft.scaleX, 1, 0.05, 50);
      const sy = toNum(draft.scaleY, 1, 0.05, 50);
      const sz = toNum(draft.scaleZ, 1, 0.05, 50);
      [mesh, points, edgeLines, affectedPoints, vertexMarker].forEach((node) => {
        node.position.set(px, py, pz);
        node.rotation.set(rx, ry, rz);
        node.scale.set(sx, sy, sz);
      });
    };

    rebuildMesh();

    const onResize = () => {
      const w = Math.max(1, mount.clientWidth || 1);
      const h = Math.max(1, mount.clientHeight || 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    let rafId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    const updateAffectedVerticesFromHit = (hit, nowTs) => {
      const overlay = affectedPointsRef.current;
      const mesh = meshRef.current;
      if (!overlay || !mesh) return;
      const activeTool = String(dataRef.current?.tool || "move");
      const isSurfaceTool = SCULPT_BRUSH_TOOLS.includes(activeTool);
      if (!isSurfaceTool || !hit?.point) {
        overlay.visible = false;
        return;
      }
      const elapsed = nowTs - Number(lastHighlightUpdateRef.current || 0);
      if (elapsed < 10) return;
      lastHighlightUpdateRef.current = nowTs;
      const geometry = mesh.geometry;
      const attr = geometry?.attributes?.position;
      const normalAttr = geometry?.attributes?.normal;
      if (!attr) {
        overlay.visible = false;
        return;
      }
      const local = mesh.worldToLocal(hit.point.clone());
      const radius = toNum(dataRef.current?.brushRadius, 0.9, 0.05, 6);
      const paintType = String(dataRef.current?.paintPointerType || "standard");
      const isPaintTool = activeTool === "paint";
      const isPaintPrecision = isPaintTool && paintType === "precision";
      const isPaintSpray = isPaintTool && paintType === "spray";
      const paintRadius = isPaintTool ? radius * (isPaintPrecision ? 0.72 : isPaintSpray ? 1.08 : 1) : radius;
      const radiusSq = paintRadius * paintRadius;
      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      const autoSmoothEnabled = importedMode && dataRef.current?.importedAutoSmooth !== false;
      const autoSmoothAngle = toNum(dataRef.current?.importedAutoSmoothAngle, 180, 1, 180);
      const autoSmoothCos = Math.cos(THREE.MathUtils.degToRad(autoSmoothAngle));
      const hitNormal = hit?.face?.normal ? hit.face.normal.clone().normalize() : null;
      const paintNormalCos = Math.cos(THREE.MathUtils.degToRad(isPaintPrecision ? 84 : isPaintSpray ? 58 : 72));
      const paintDepthLimit = Math.max(0.001, paintRadius * (isPaintPrecision ? 0.08 : isPaintSpray ? 0.28 : 0.16));
      const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
      const weldEpsilon = Number.isFinite(weldEpsilonRaw) ? Math.max(1e-6, weldEpsilonRaw) : null;
      const connectedOnly = importedMode && dataRef.current?.importedWeldConnectedOnly !== false;
      const sculptEpsilon = importedMode ? getSculptWeldEpsilon(geometry, weldEpsilon) : weldEpsilon;
      const paintEpsilon = importedMode ? getConnectivityWeldEpsilon(geometry, sculptEpsilon) : weldEpsilon;
      const weldLookup = importedMode
        ? getWeldLookup(
            geometry,
            connectedOnly || isPaintTool ? paintEpsilon : sculptEpsilon
          )
        : null;
      const stableImportedSculpt = importedMode;
      const autoMaskTopology =
        importedMode && (dataRef.current?.importedAutoMaskTopology !== false || isPaintPrecision);
      const topology = autoMaskTopology ? buildTopologyComponents(geometry, weldLookup) : null;
      let seedComponent = -1;
      if (autoMaskTopology) {
        let seedIndex = pickNearestVertexFromHit(geometry, hit);
        if (!Number.isFinite(seedIndex) || seedIndex < 0) {
          let seedD2 = Number.POSITIVE_INFINITY;
          seedIndex = -1;
          for (let i = 0; i < attr.count; i += 1) {
            const dx = attr.getX(i) - local.x;
            const dy = attr.getY(i) - local.y;
            const dz = attr.getZ(i) - local.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < seedD2) {
              seedD2 = d2;
              seedIndex = i;
            }
          }
        }
        if (seedIndex >= 0) {
          seedComponent = Number(topology?.componentByIndex?.[seedIndex] ?? -1);
        }
      }
      const maxHighlighted = 12000;
      const positions = [];
      for (let i = 0; i < attr.count; i += 1) {
        const dx = attr.getX(i) - local.x;
        const dy = attr.getY(i) - local.y;
        const dz = attr.getZ(i) - local.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > radiusSq) continue;
        if (isPaintTool && hitNormal) {
          const depth = Math.abs(dx * hitNormal.x + dy * hitNormal.y + dz * hitNormal.z);
          if (depth > paintDepthLimit) continue;
          if (normalAttr && normalAttr.count === attr.count) {
            const nx = normalAttr.getX(i);
            const ny = normalAttr.getY(i);
            const nz = normalAttr.getZ(i);
            const ndot = nx * hitNormal.x + ny * hitNormal.y + nz * hitNormal.z;
            if (ndot < paintNormalCos) continue;
          }
        }
        if ((isPaintTool || !stableImportedSculpt) && autoSmoothEnabled && hitNormal && normalAttr && normalAttr.count === attr.count) {
          const nx = normalAttr.getX(i);
          const ny = normalAttr.getY(i);
          const nz = normalAttr.getZ(i);
          const dot = nx * hitNormal.x + ny * hitNormal.y + nz * hitNormal.z;
          if (dot < autoSmoothCos) continue;
        }
        if (seedComponent >= 0) {
          const comp = Number(topology?.componentByIndex?.[i] ?? -1);
          if (comp !== seedComponent) continue;
        }
        positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
        if (positions.length / 3 >= maxHighlighted) break;
      }
      if (!positions.length) {
        const fallbackSet = new Set();
        const faceIndices = [hit?.face?.a, hit?.face?.b, hit?.face?.c]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 0 && value < attr.count);
        faceIndices.forEach((idx) => {
          const members = weldLookup?.membersByIndex?.[idx];
          if (members?.length) {
            members.forEach((memberIdx) => fallbackSet.add(memberIdx));
          } else {
            fallbackSet.add(idx);
          }
        });
        if (!fallbackSet.size) {
          overlay.visible = false;
          return;
        }
        fallbackSet.forEach((idx) => {
          positions.push(attr.getX(idx), attr.getY(idx), attr.getZ(idx));
        });
      }
      const nextGeo = new THREE.BufferGeometry();
      nextGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      if (overlay.geometry) overlay.geometry.dispose();
      overlay.geometry = nextGeo;
      overlay.visible = true;
    };

    const updateBrushPreviewAtEvent = (event) => {
      if (!brushPreviewRef.current || !meshRef.current) return;
      const activeTool = String(dataRef.current?.tool || "move");
      const isSurfaceTool = SCULPT_BRUSH_TOOLS.includes(activeTool);
      if (!isSurfaceTool) {
        if (activeTool !== "vertex" && selectedVertexMarkerRef.current) {
          selectedVertexMarkerRef.current.visible = false;
          selectedVertexIndexRef.current = -1;
        }
        if (affectedPointsRef.current) affectedPointsRef.current.visible = false;
        brushPreviewRef.current.visible = false;
        return;
      }
      const hits = raycastMeshAtPointer(event.clientX, event.clientY, { fallbackPx: 12 });
      if (!hits.length) {
        if (affectedPointsRef.current) affectedPointsRef.current.visible = false;
        brushPreviewRef.current.visible = false;
        return;
      }
      const hit = hits[0];
      const radius = toNum(dataRef.current?.brushRadius, 0.9, 0.05, 6);
      brushPreviewRef.current.visible = true;
      brushPreviewRef.current.position.copy(hit.point);
      brushPreviewRef.current.scale.setScalar(Math.max(0.1, radius * 2));
      updateAffectedVerticesFromHit(hit, performance.now());
    };

    const sculptAtEvent = (event, isFinal = false) => {
      if (!meshRef.current) return;
      const activeTool = String(dataRef.current?.tool || "move");
      const isSurfaceTool = SCULPT_BRUSH_TOOLS.includes(activeTool);
      const isVertexTool = activeTool === "vertex";
      if (!isSurfaceTool && !isVertexTool) return;

      const hits = raycastMeshAtPointer(event.clientX, event.clientY, { fallbackPx: 12 });
      if (!hits.length) return;

      const hit = hits[0];
      if (isSurfaceTool && brushPreviewRef.current) {
        const radius = toNum(dataRef.current?.brushRadius, 0.9, 0.05, 6);
        brushPreviewRef.current.visible = true;
        brushPreviewRef.current.position.copy(hit.point);
        brushPreviewRef.current.scale.setScalar(Math.max(0.1, radius * 2));
      }

      const local = meshRef.current.worldToLocal(hit.point.clone());
      const geometry = meshRef.current.geometry;
      const attr = geometry?.attributes?.position;
      const base = geometry?.userData?.basePositions;
      const baseNormals = geometry?.userData?.baseNormals;
      if (!attr || !base || !baseNormals) return;

      const radius = toNum(dataRef.current?.brushRadius, 0.9, 0.05, 6);
      const baseStrength = toNum(dataRef.current?.brushStrength, 0.025, 0.0005, 1.2);
      const toolScale = toNum(dataRef.current?.toolStrengths?.[activeTool], 0.35, 0.05, 4);
      const paintType = String(dataRef.current?.paintPointerType || "standard");
      const isPaintPrecision = activeTool === "paint" && paintType === "precision";
      const isPaintSpray = activeTool === "paint" && paintType === "spray";
      const paintRadius = activeTool === "paint" ? radius * (isPaintPrecision ? 0.72 : isPaintSpray ? 1.08 : 1) : radius;
      const isImportedGeometry = !!geometry?.userData?.preserveImportedUv;
      const importedStrengthBoost = isImportedGeometry ? 0.85 : 1;
      const strength = baseStrength * toolScale * importedStrengthBoost;
      geometry.computeBoundingBox();
      const bbox = geometry?.boundingBox;
      const modelSpan = bbox ? Math.max(0.1, bbox.getSize(new THREE.Vector3()).length()) : 1;
      const strokeBase = strokeStartOffsetsRef.current || normalizeOffsets(offsetsRef.current);
      const maxPerEventDelta = isImportedGeometry
        ? Math.max(0.0035, modelSpan * 0.0012 + radius * 0.003)
        : Math.max(0.003, modelSpan * 0.001 + radius * 0.0025);
      const maxStrokeSpan = isImportedGeometry
        ? Math.max(0.025, modelSpan * 0.05)
        : Math.max(0.03, modelSpan * 0.06);
      const maxTotalOffset = isImportedGeometry
        ? Math.max(0.15, modelSpan * 0.25)
        : Math.max(0.2, modelSpan * 0.32);
      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      const autoSmoothEnabled = importedMode && dataRef.current?.importedAutoSmooth !== false;
      const autoSmoothAngle = toNum(dataRef.current?.importedAutoSmoothAngle, 180, 1, 180);
      const autoSmoothCos = Math.cos(THREE.MathUtils.degToRad(autoSmoothAngle));
      const hitNormal = hit?.face?.normal ? hit.face.normal.clone().normalize() : null;
      const paintNormalCos = Math.cos(THREE.MathUtils.degToRad(isPaintPrecision ? 84 : isPaintSpray ? 58 : 72));
      const paintDepthLimit = Math.max(0.001, paintRadius * (isPaintPrecision ? 0.08 : isPaintSpray ? 0.28 : 0.16));
      const weldVertices = importedMode ? true : !!dataRef.current?.config?.weldVertices;
      const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
      const weldEpsilon = importedMode && Number.isFinite(weldEpsilonRaw) ? Math.max(1e-6, weldEpsilonRaw) : null;
      const connectedOnly = importedMode && dataRef.current?.importedWeldConnectedOnly !== false;
      const sculptEpsilon = importedMode ? getSculptWeldEpsilon(geometry, weldEpsilon) : weldEpsilon;
      const paintEpsilon = importedMode ? getConnectivityWeldEpsilon(geometry, sculptEpsilon) : weldEpsilon;
      const stableImportedSculpt = importedMode && weldVertices;
      const weldLookup = weldVertices
        ? getWeldLookup(geometry, activeTool === "paint" ? paintEpsilon : sculptEpsilon)
        : null;
      const weldLookupForApply =
        weldVertices && importedMode && connectedOnly && !stableImportedSculpt
          ? getWeldLookup(geometry, getConnectivityWeldEpsilon(geometry, sculptEpsilon))
          : weldLookup;
      const autoMaskTopology =
        importedMode &&
        (dataRef.current?.importedAutoMaskTopology !== false || isPaintPrecision) &&
        (!stableImportedSculpt || activeTool === "paint");
      const topology = autoMaskTopology ? buildTopologyComponents(geometry, weldLookupForApply) : null;
      const weldNormalCache = new Map();
      const getWeldNormal = (idx, members) => {
        if (!members || members.length < 2) return [baseNormals[idx * 3], baseNormals[idx * 3 + 1], baseNormals[idx * 3 + 2]];
        const seed = Number(members[0]);
        if (weldNormalCache.has(seed)) return weldNormalCache.get(seed);
        let nx = 0;
        let ny = 0;
        let nz = 0;
        members.forEach((memberIdx) => {
          const ni = memberIdx * 3;
          nx += baseNormals[ni];
          ny += baseNormals[ni + 1];
          nz += baseNormals[ni + 2];
        });
        const inv = 1 / Math.max(0.000001, Math.hypot(nx, ny, nz));
        const normal = [nx * inv, ny * inv, nz * inv];
        weldNormalCache.set(seed, normal);
        return normal;
      };
      const invertSign = pointerStateRef.current.invert ? -1 : 1;
      const vertexCount = Math.floor(attr.array.length / 3);
      const next = { ...normalizeOffsets(offsetsRef.current) };
      const nextPaint = { ...normalizeVertexColors(paintRef.current) };
      let seedComponent = -1;
      if (topology) {
        let seedIndex = pickNearestVertexFromHit(geometry, hit);
        if (!Number.isFinite(seedIndex) || seedIndex < 0) {
          let seedD2 = Number.POSITIVE_INFINITY;
          seedIndex = -1;
          for (let i = 0; i < vertexCount; i += 1) {
            const ai = i * 3;
            const bx = base[ai];
            const by = base[ai + 1];
            const bz = base[ai + 2];
            const d2 = (bx - local.x) * (bx - local.x) + (by - local.y) * (by - local.y) + (bz - local.z) * (bz - local.z);
            if (d2 < seedD2) {
              seedD2 = d2;
              seedIndex = i;
            }
          }
        }
        if (seedIndex >= 0) seedComponent = Number(topology.componentByIndex?.[seedIndex] ?? -1);
      }
      const paintColorValue = (() => {
        const raw = String(dataRef.current?.paintColor || "#9ca3af").replace(/^#/, "");
        return /^[0-9a-fA-F]{6}$/.test(raw) ? Number.parseInt(raw, 16) : 0x9ca3af;
      })();
      let neighborhoodTarget = 0;
      let neighborhoodWeight = 0;
      if (
        activeTool === "smooth" ||
        activeTool === "relax" ||
        activeTool === "fill" ||
        activeTool === "scrape" ||
        activeTool === "clay"
      ) {
        for (let i = 0; i < vertexCount; i += 1) {
          const ai = i * 3;
          const bx = base[ai];
          const by = base[ai + 1];
          const bz = base[ai + 2];
          const d = Math.hypot(bx - local.x, by - local.y, bz - local.z);
          if (d > (activeTool === "paint" ? paintRadius : radius)) continue;
          const w = 1 - d / radius;
          const eased = w * w * (3 - 2 * w);
          neighborhoodTarget += Number(next[String(i)] || 0) * eased;
          neighborhoodWeight += eased;
        }
        neighborhoodTarget = neighborhoodWeight > 0.000001 ? neighborhoodTarget / neighborhoodWeight : 0;
      }
      let changed = false;

      for (let i = 0; i < vertexCount; i += 1) {
        const ai = i * 3;
        const bx = base[ai];
        const by = base[ai + 1];
        const bz = base[ai + 2];
        const d = Math.hypot(bx - local.x, by - local.y, bz - local.z);
        const activeRadius = activeTool === "paint" ? paintRadius : radius;
        if (d > activeRadius) continue;
        if (activeTool === "paint" && hitNormal) {
          const dx = bx - local.x;
          const dy = by - local.y;
          const dz = bz - local.z;
          const depth = Math.abs(dx * hitNormal.x + dy * hitNormal.y + dz * hitNormal.z);
          if (depth > paintDepthLimit) continue;
          const nnx = baseNormals[ai];
          const nny = baseNormals[ai + 1];
          const nnz = baseNormals[ai + 2];
          const ndot = nnx * hitNormal.x + nny * hitNormal.y + nnz * hitNormal.z;
          if (ndot < paintNormalCos) continue;
        }
        if ((activeTool === "paint" || !stableImportedSculpt) && autoSmoothEnabled && hitNormal) {
          const nnx = baseNormals[ai];
          const nny = baseNormals[ai + 1];
          const nnz = baseNormals[ai + 2];
          const dot = nnx * hitNormal.x + nny * hitNormal.y + nnz * hitNormal.z;
          if (dot < autoSmoothCos) continue;
        }
        if (seedComponent >= 0) {
          const comp = Number(topology?.componentByIndex?.[i] ?? -1);
          if (comp !== seedComponent) continue;
        }

        const f = 1 - d / activeRadius;
        const eased = f * f * (3 - 2 * f);
        const current = Number(next[String(i)] || 0);
        let value = current;
        if (activeTool === "paint") {
          if (isPaintSpray) {
            const noiseRaw = Math.sin((i + 1) * 12.9898 + local.x * 78.233 + local.y * 37.719 + local.z * 17.123) * 43758.5453;
            const noise = noiseRaw - Math.floor(noiseRaw);
            const probability = Math.max(0.15, Math.min(1, 0.35 + eased * 0.75));
            if (noise > probability) continue;
          }
          const members = weldLookupForApply?.membersByIndex?.[i];
          if (!isPaintPrecision && members && members.length) {
            members.forEach((idx) => {
              if (invertSign > 0) nextPaint[String(idx)] = paintColorValue;
              else delete nextPaint[String(idx)];
            });
          } else {
            if (invertSign > 0) nextPaint[String(i)] = paintColorValue;
            else delete nextPaint[String(i)];
          }
          changed = true;
          continue;
        }

        if (activeTool === "sculpt") value = current + strength * eased * invertSign;
        if (activeTool === "draw_sharp") value = current + strength * (0.5 + eased * 0.95) * eased * invertSign;
        if (activeTool === "clay") value = current + (strength * 0.55 * eased * invertSign) + (neighborhoodTarget - current) * 0.12 * eased;
        if (activeTool === "clay_strips") value = current + strength * (0.72 + f * 0.55) * Math.pow(f, 0.65) * invertSign;
        if (activeTool === "flatten") {
          if (invertSign > 0) value = THREE.MathUtils.lerp(current, 0, Math.min(1, 0.14 + eased * 0.42));
          else value = current + strength * 0.75 * eased;
        }
        if (activeTool === "fill") {
          const toward = Math.max(current, neighborhoodTarget);
          value = THREE.MathUtils.lerp(current, toward, Math.min(1, 0.22 + eased * 0.58)) + strength * 0.12 * eased * invertSign;
        }
        if (activeTool === "scrape") {
          const scrapeTarget = neighborhoodTarget;
          if (invertSign > 0) value = THREE.MathUtils.lerp(current, scrapeTarget, Math.min(1, 0.26 + eased * 0.62));
          else value = current + (current - scrapeTarget) * Math.min(0.5, 0.14 + eased * 0.32);
        }
        if (activeTool === "inflate") value = current + strength * (isImportedGeometry ? 0.55 : 1.15) * eased * invertSign;
        if (activeTool === "blob") value = current + strength * (isImportedGeometry ? 0.75 : 1.45) * (0.65 + eased * 0.65) * eased * invertSign;
        if (activeTool === "pinch") value = current - strength * (isImportedGeometry ? 0.5 : 0.95) * eased * invertSign;
        if (activeTool === "crease") value = current - strength * (isImportedGeometry ? 0.72 : 1.15) * (0.55 + eased * 0.85) * eased * invertSign;
        if (activeTool === "smooth") {
          if (invertSign > 0) value = THREE.MathUtils.lerp(current, neighborhoodTarget, Math.min(1, 0.28 + eased * 0.62));
          else value = current + (current - neighborhoodTarget) * Math.min(0.52, 0.16 + eased * 0.34);
        }
        if (activeTool === "relax") {
          if (invertSign > 0) value = THREE.MathUtils.lerp(current, neighborhoodTarget, Math.min(1, 0.42 + eased * 0.78));
          else value = current + (current - neighborhoodTarget) * Math.min(0.38, 0.14 + eased * 0.26);
        }

        // Anti-spike guard for both procedural and imported meshes.
        value = THREE.MathUtils.clamp(value, current - maxPerEventDelta, current + maxPerEventDelta);
        const strokeStart = Number(strokeBase[String(i)] || 0);
        value = THREE.MathUtils.clamp(value, strokeStart - maxStrokeSpan, strokeStart + maxStrokeSpan);
        value = THREE.MathUtils.clamp(value, -maxTotalOffset, maxTotalOffset);

        if (Math.abs(value) < 0.00001) {
          const members = weldLookupForApply?.membersByIndex?.[i];
          if (members && members.length) {
            members.forEach((idx) => {
              if (String(idx) in next) {
                delete next[String(idx)];
                changed = true;
              }
              const mj = idx * 3;
              attr.array[mj] = base[mj];
              attr.array[mj + 1] = base[mj + 1];
              attr.array[mj + 2] = base[mj + 2];
            });
          } else {
            if (String(i) in next) {
              delete next[String(i)];
              changed = true;
            }
            attr.array[ai] = bx;
            attr.array[ai + 1] = by;
            attr.array[ai + 2] = bz;
          }
          continue;
        }

        if (Math.abs(value - current) > 0.000001) changed = true;
        const members = weldLookupForApply?.membersByIndex?.[i];
        if (members && members.length) {
          const weldNormal = getWeldNormal(i, members);
          members.forEach((idx) => {
            next[String(idx)] = value;
            const mj = idx * 3;
            attr.array[mj] = base[mj] + weldNormal[0] * value;
            attr.array[mj + 1] = base[mj + 1] + weldNormal[1] * value;
            attr.array[mj + 2] = base[mj + 2] + weldNormal[2] * value;
          });
        } else {
          next[String(i)] = value;
          attr.array[ai] = bx + baseNormals[ai] * value;
          attr.array[ai + 1] = by + baseNormals[ai + 1] * value;
          attr.array[ai + 2] = bz + baseNormals[ai + 2] * value;
        }
      }

      if (!changed) return;
      let nextOffsets = normalizeOffsets(next);
      attr.needsUpdate = true;
      if (importedMode && weldVertices && activeTool !== "paint") {
        const stitchEpsilon = getSculptWeldEpsilon(geometry, weldEpsilon) * 1.1;
        const canStitchLive = vertexCount <= 260000;
        const shouldStitchNow = isFinal || canStitchLive;
        const stitched = shouldStitchNow ? stitchGeometryVerticesByDistance(geometry, stitchEpsilon) : 0;
        if (stitched > 0) {
          rebaseGeometryFromCurrentPositions(geometry);
          nextOffsets = {};
        }
      }
      applyImportedShadingNormals(geometry, {
        smoothShading: dataRef.current?.importedSmoothShading,
        autoSmooth: dataRef.current?.importedAutoSmooth,
        autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
      });
      const importedProjectionActive =
        importedMode &&
        dataRef.current?.config?.importedTextureUseOriginalUv === false &&
        String(
          dataRef.current?.config?.textureUrl ||
            dataRef.current?.config?.sideTextures?.surface ||
            dataRef.current?.config?.sideTextures?.side ||
            dataRef.current?.config?.sideTextures?.front ||
            dataRef.current?.config?.sideTextures?.px ||
            ""
        ).trim().length > 0;
      if (importedProjectionActive) {
        remapUvByViewProjection(geometry, String(dataRef.current?.config?.importedTextureProjection || "front"));
      } else if (!geometry?.userData?.preserveImportedUv) {
        remapUvByBoxProjection(geometry);
      }
      offsetsRef.current = nextOffsets;
      paintRef.current = normalizeVertexColors(nextPaint);
      applyVertexColorsToGeometry(geometry, paintRef.current);
      if (typeof callbacksRef.current?.onOffsetsChange === "function") callbacksRef.current.onOffsetsChange(offsetsRef.current);
      if (typeof callbacksRef.current?.onPaintChange === "function") callbacksRef.current.onPaintChange(paintRef.current);
      if (isFinal && typeof callbacksRef.current?.onOffsetsCommit === "function") {
        callbacksRef.current.onOffsetsCommit(offsetsRef.current, strokeStartOffsetsRef.current || normalizeOffsets(offsetsRef.current));
      }
      if (isFinal && typeof callbacksRef.current?.onPaintCommit === "function") {
        callbacksRef.current.onPaintCommit(paintRef.current, strokeStartPaintRef.current || normalizeVertexColors(paintRef.current));
      }
    };

    const updateSelectedVertexMarker = () => {
      if (!selectedVertexMarkerRef.current || !meshRef.current) return;
      const vi = Number(selectedVertexIndexRef.current);
      if (!Number.isFinite(vi) || vi < 0) {
        selectedVertexMarkerRef.current.visible = false;
        return;
      }
      const geometry = meshRef.current.geometry;
      const attr = geometry?.attributes?.position;
      if (!attr) {
        selectedVertexMarkerRef.current.visible = false;
        return;
      }
      const ai = vi * 3;
      if (ai < 0 || ai + 2 >= attr.array.length) {
        selectedVertexMarkerRef.current.visible = false;
        return;
      }
      selectedVertexMarkerRef.current.visible = true;
      selectedVertexMarkerRef.current.position.set(attr.array[ai], attr.array[ai + 1], attr.array[ai + 2]);
    };

    const emitPointerMode = (mode) => {
      if (typeof callbacksRef.current?.onPointerModeChange === "function") callbacksRef.current.onPointerModeChange(String(mode || ""));
    };

    const applyCanvasCursor = () => {
      const activeTool = String(dataRef.current?.tool || "move");
      const isEditDrag = pointerStateRef.current.active;
      const isCameraDrag = pointerStateRef.current.cameraDrag;
      let cursor = "default";
      let mode = "camera-orbit";

      if (isCameraDrag) {
        cursor = "grabbing";
        mode = "camera";
      } else if (activeTool === "select") {
        cursor = "pointer";
        mode = "select";
      } else if (activeTool === "move") {
        cursor = isEditDrag ? "grabbing" : "grab";
        mode = "move";
      } else if (SCULPT_BRUSH_TOOLS.includes(activeTool)) {
        cursor = isEditDrag ? "cell" : "crosshair";
        mode = activeTool;
      } else if (activeTool === "vertex") {
        const vertexMode = String(dataRef.current?.vertexInteractionMode || "move");
        cursor = vertexMode === "add" ? "copy" : (isEditDrag ? "ns-resize" : "pointer");
        mode = vertexMode === "add" ? "vertex_add" : "vertex";
      }

      renderer.domElement.style.cursor = cursor;
      if (pointsRef.current) pointsRef.current.visible = activeTool === "vertex";
      if (!SCULPT_BRUSH_TOOLS.includes(activeTool) && affectedPointsRef.current) {
        affectedPointsRef.current.visible = false;
      }
      if (edgesRef.current?.material?.color) {
        if (SCULPT_BRUSH_TOOLS.includes(activeTool)) {
          edgesRef.current.material.color.set(0xf59e0b);
        }
        else edgesRef.current.material.color.set(0x67e8f9);
      }
      emitPointerMode(mode);
      setPointerUi((prev) => ({ ...prev, mode }));
    };

    const updatePointerPosition = (event) => {
      const host = wrapperRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      setPointerUi((prev) => ({ ...prev, x, y, visible: true }));
    };

    const onPointerDown = (event) => {
      if (event.button === 1) {
        pointerStateRef.current.cameraDrag = true;
        pointerStateRef.current.invert = false;
        updatePointerPosition(event);
        updateBrushPreviewAtEvent(event);
        applyCanvasCursor();
        return;
      }

      const activeTool = String(dataRef.current?.tool || "move");
      const isSelectTool = activeTool === "select";
      const isSurfaceTool = SCULPT_BRUSH_TOOLS.includes(activeTool);
      const isVertexTool = activeTool === "vertex";
      if (isSelectTool) {
        if (event.button === 2) {
          pointerStateRef.current.cameraDrag = true;
          pointerStateRef.current.invert = false;
          updatePointerPosition(event);
          applyCanvasCursor();
          return;
        }
        if (event.button !== 0) return;
        const hits = raycastMeshAtPointer(event.clientX, event.clientY, { fallbackPx: 14 });
        setModelSelected(hits.length > 0);
        applyCanvasCursor();
        return;
      }
      if (isVertexTool && event.button !== 0 && event.button !== 2) return;
      if (!isSurfaceTool) {
        if (isVertexTool && event.button === 0) {
          const meshHits = raycastMeshAtPointer(event.clientX, event.clientY, { fallbackPx: 16 });
          const primaryHit = meshHits[0] || null;
          const vertexMode = String(dataRef.current?.vertexInteractionMode || "move");
          const wantsInsert = vertexMode === "add" || event.shiftKey;
          if (wantsInsert && primaryHit) {
            const inserted = handleInsertImportedPointAtHit(primaryHit);
            if (inserted) {
              updateSelectedVertexMarker();
              pointerStateRef.current.active = false;
              pointerStateRef.current.pointerId = null;
              controls.enabled = true;
              applyCanvasCursor();
              return;
            }
          }
          if (vertexMode === "add") {
            applyCanvasCursor();
            return;
          }
          if (!primaryHit) {
            selectedVertexIndexRef.current = -1;
            if (selectedVertexMarkerRef.current) selectedVertexMarkerRef.current.visible = false;
            return;
          }
          selectedVertexIndexRef.current = pickNearestVertexFromHit(meshRef.current?.geometry, primaryHit);
          if (selectedVertexIndexRef.current < 0) return;
          updateSelectedVertexMarker();
          pointerStateRef.current.active = true;
          pointerStateRef.current.pointerId = event.pointerId;
          pointerStateRef.current.vertexDragStartY = event.clientY;
          const current = normalizeOffsets(offsetsRef.current);
          pointerStateRef.current.vertexStartOffset = Number(current[String(selectedVertexIndexRef.current)] || 0);
          strokeStartOffsetsRef.current = current;
          renderer.domElement.setPointerCapture?.(event.pointerId);
          controls.enabled = false;
          applyCanvasCursor();
          return;
        }
        if (event.button === 2) {
          pointerStateRef.current.cameraDrag = true;
          pointerStateRef.current.invert = false;
          updatePointerPosition(event);
          updateBrushPreviewAtEvent(event);
          applyCanvasCursor();
        }
        return;
      }

      if (event.button === 2) {
        const hits = raycastMeshAtPointer(event.clientX, event.clientY, { fallbackPx: 14 });
        if (!hits.length) {
          pointerStateRef.current.cameraDrag = true;
          pointerStateRef.current.invert = false;
          updatePointerPosition(event);
          updateBrushPreviewAtEvent(event);
          applyCanvasCursor();
          return;
        }
      }

      pointerStateRef.current.active = true;
      pointerStateRef.current.pointerId = event.pointerId;
      pointerStateRef.current.invert = event.button === 2;
      strokeStartOffsetsRef.current = normalizeOffsets(offsetsRef.current);
      strokeStartPaintRef.current = normalizeVertexColors(paintRef.current);
      renderer.domElement.setPointerCapture?.(event.pointerId);
      controls.enabled = false;
      updatePointerPosition(event);
      updateBrushPreviewAtEvent(event);
      applyCanvasCursor();
      sculptAtEvent(event, false);
    };

    const onPointerMove = (event) => {
      updatePointerPosition(event);
      updateBrushPreviewAtEvent(event);
      if (pointerStateRef.current.cameraDrag && (event.buttons & 4 || event.buttons & 2)) {
        applyCanvasCursor();
        return;
      }
      if (!pointerStateRef.current.active || pointerStateRef.current.pointerId !== event.pointerId) return;
      if (String(dataRef.current?.tool || "") === "vertex") {
        const vi = Number(selectedVertexIndexRef.current);
        if (!Number.isFinite(vi) || vi < 0 || !meshRef.current) return;
        const geometry = meshRef.current.geometry;
        const attr = geometry?.attributes?.position;
        const base = geometry?.userData?.basePositions;
        const baseNormals = geometry?.userData?.baseNormals;
        if (!attr || !base || !baseNormals) return;
        const dy = pointerStateRef.current.vertexDragStartY - event.clientY;
        const amount = pointerStateRef.current.vertexStartOffset + dy * toNum(dataRef.current?.brushStrength, 0.025, 0.0005, 1.2) * 0.05;
        const next = { ...normalizeOffsets(offsetsRef.current) };
        const appliedAmount = Math.max(-40, Math.min(40, amount));
        const strokeBase = normalizeOffsets(strokeStartOffsetsRef.current || offsetsRef.current);
        const importedMode = !!resolveSceneUploadUrl(importModelUrl);
        const elasticMode = dataRef.current?.vertexElasticMode === true;
        const noTearMode = dataRef.current?.vertexNoTearMode !== false;
        const centerX = base[vi * 3];
        const centerY = base[vi * 3 + 1];
        const centerZ = base[vi * 3 + 2];
        const centerStartOffset = Number(strokeBase[String(vi)] || 0);
        const deltaAmount = appliedAmount - centerStartOffset;
        const elasticRadius = Math.max(0.05, toNum(dataRef.current?.brushRadius, 0.9, 0.05, 12) * 0.9);
        const elasticRadiusSq = elasticRadius * elasticRadius;
        const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
        const weldEpsilon = importedMode && Number.isFinite(weldEpsilonRaw) ? Math.max(1e-6, weldEpsilonRaw) : null;
        const weldLookup =
          importedMode && noTearMode
            ? getWeldLookup(geometry, getConnectivityWeldEpsilon(geometry, weldEpsilon))
            : null;
        const weldNormalCache = new Map();
        const getSharedNormal = (idx, members) => {
          if (!members || members.length < 2) return [baseNormals[idx * 3], baseNormals[idx * 3 + 1], baseNormals[idx * 3 + 2]];
          const seed = Number(members[0]);
          if (weldNormalCache.has(seed)) return weldNormalCache.get(seed);
          let nx = 0;
          let ny = 0;
          let nz = 0;
          members.forEach((memberIdx) => {
            const ni = memberIdx * 3;
            nx += baseNormals[ni];
            ny += baseNormals[ni + 1];
            nz += baseNormals[ni + 2];
          });
          const inv = 1 / Math.max(0.000001, Math.hypot(nx, ny, nz));
          const normal = [nx * inv, ny * inv, nz * inv];
          weldNormalCache.set(seed, normal);
          return normal;
        };

        for (let idx = 0; idx < attr.count; idx += 1) {
          const ai = idx * 3;
          const startOffset = Number(strokeBase[String(idx)] || 0);
          let nextValue = startOffset;
          if (idx === vi) {
            nextValue = appliedAmount;
          } else if (elasticMode) {
            const dx = base[ai] - centerX;
            const dy2 = base[ai + 1] - centerY;
            const dz = base[ai + 2] - centerZ;
            const d2 = dx * dx + dy2 * dy2 + dz * dz;
            if (d2 <= elasticRadiusSq) {
              const dist = Math.sqrt(d2);
              const t = 1 - dist / elasticRadius;
              const falloff = t * t * (3 - 2 * t);
              nextValue = startOffset + deltaAmount * falloff * 0.72;
            }
          }
          if (Math.abs(nextValue) < 0.00001) delete next[String(idx)];
          else next[String(idx)] = Math.max(-40, Math.min(40, nextValue));
          const applied = Number(next[String(idx)] || 0);
          const members = weldLookup?.membersByIndex?.[idx];
          if (members && members.length) {
            const sharedNormal = getSharedNormal(idx, members);
            members.forEach((memberIdx) => {
              if (Math.abs(nextValue) < 0.00001) delete next[String(memberIdx)];
              else next[String(memberIdx)] = Math.max(-40, Math.min(40, nextValue));
              const mi = memberIdx * 3;
              attr.array[mi] = base[mi] + sharedNormal[0] * applied;
              attr.array[mi + 1] = base[mi + 1] + sharedNormal[1] * applied;
              attr.array[mi + 2] = base[mi + 2] + sharedNormal[2] * applied;
            });
          } else {
            attr.array[ai] = base[ai] + baseNormals[ai] * applied;
            attr.array[ai + 1] = base[ai + 1] + baseNormals[ai + 1] * applied;
            attr.array[ai + 2] = base[ai + 2] + baseNormals[ai + 2] * applied;
          }
        }
        attr.needsUpdate = true;
        applyImportedShadingNormals(geometry, {
          smoothShading: dataRef.current?.importedSmoothShading,
          autoSmooth: dataRef.current?.importedAutoSmooth,
          autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
        });
        const importedProjectionActive =
          importedMode &&
          dataRef.current?.config?.importedTextureUseOriginalUv === false &&
          String(
            dataRef.current?.config?.textureUrl ||
              dataRef.current?.config?.sideTextures?.surface ||
              dataRef.current?.config?.sideTextures?.side ||
              dataRef.current?.config?.sideTextures?.front ||
              dataRef.current?.config?.sideTextures?.px ||
              ""
          ).trim().length > 0;
        if (importedProjectionActive) {
          remapUvByViewProjection(geometry, String(dataRef.current?.config?.importedTextureProjection || "front"));
        } else if (!geometry?.userData?.preserveImportedUv) {
          remapUvByBoxProjection(geometry);
        }
        offsetsRef.current = normalizeOffsets(next);
        if (typeof callbacksRef.current?.onOffsetsChange === "function") callbacksRef.current.onOffsetsChange(offsetsRef.current);
        updateSelectedVertexMarker();
        return;
      }
      sculptAtEvent(event, false);
    };

    const onPointerUp = (event) => {
      pointerStateRef.current.cameraDrag = false;
      updatePointerPosition(event);
      updateBrushPreviewAtEvent(event);
      if (!pointerStateRef.current.active || pointerStateRef.current.pointerId !== event.pointerId) return;
      if (String(dataRef.current?.tool || "") === "vertex") {
        if (typeof callbacksRef.current?.onOffsetsCommit === "function") {
          callbacksRef.current.onOffsetsCommit(offsetsRef.current, strokeStartOffsetsRef.current || normalizeOffsets(offsetsRef.current));
        }
      } else {
        sculptAtEvent(event, true);
      }
      pointerStateRef.current.active = false;
      pointerStateRef.current.pointerId = null;
      pointerStateRef.current.invert = false;
      strokeStartOffsetsRef.current = null;
      strokeStartPaintRef.current = null;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      controls.enabled = true;
      applyCanvasCursor();
    };

    const onPointerEnter = () => applyCanvasCursor();

    const onPointerLeave = () => {
      renderer.domElement.style.cursor = "default";
      emitPointerMode("");
      if (brushPreviewRef.current) brushPreviewRef.current.visible = false;
      if (affectedPointsRef.current) affectedPointsRef.current.visible = false;
      setPointerUi((prev) => ({ ...prev, visible: false, mode: "" }));
    };

    const onContextMenu = (event) => event.preventDefault();
    const onWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const current = toNum(dataRef.current?.brushRadius, 0.9, 0.05, 12);
      const step = Math.max(0.02, Math.min(0.45, current * 0.08));
      const dir = Number(event.deltaY) > 0 ? -1 : 1;
      const next = Math.max(0.05, Math.min(12, current + step * dir));
      if (typeof callbacksRef.current?.onBrushRadiusChange === "function") {
        callbacksRef.current.onBrushRadiusChange(String(next.toFixed(2)));
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("pointerenter", onPointerEnter);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    applyCanvasCursor();

    const onKey = (event) => {
      if (!controlsRef.current) return;
      if (event.key === "1") {
        camera.position.set(4.4, 3.6, 5.6);
      } else if (event.key === "2") {
        camera.position.set(0, 0.1, 7.4);
      } else if (event.key === "3") {
        camera.position.set(7.4, 0.1, 0);
      } else if (event.key === "4") {
        camera.position.set(0, 8.2, 0.001);
      } else {
        return;
      }
      controlsRef.current.target.set(0, 0.4, 0);
      controlsRef.current.update();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("pointerenter", onPointerEnter);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("wheel", onWheel);
      controls.dispose();
      emitPointerMode("");
      setPointerUi({ x: 0, y: 0, visible: false, mode: "" });
      scene.traverse((node) => {
        if (node?.geometry) node.geometry.dispose?.();
        if (node?.material) disposeMaterialWithMaps(node.material);
      });
      textureCacheRef.current.forEach((tex) => tex.dispose?.());
      textureVariantCacheRef.current.forEach((tex) => tex.dispose?.());
      edgeMaterial.dispose();
      pointMaterial.dispose();
      affectedPointMaterial.dispose();
      fallbackMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (importedMode && !importedGeometry) return;
    const nextGeometry = importedMode && importedGeometry ? importedGeometry.clone() : buildGeometry(dataRef.current?.config || {});
    applyOffsetsToGeometry(nextGeometry, offsetsRef.current, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    applyVertexColorsToGeometry(nextGeometry, paintRef.current);
    mesh.geometry.dispose();
    mesh.geometry = nextGeometry;
    if (pointsRef.current) pointsRef.current.geometry = nextGeometry;
    if (affectedPointsRef.current) affectedPointsRef.current.visible = false;
    scheduleEdgeOverlayRefresh(nextGeometry);
    const selectedIndex = Number(selectedVertexIndexRef.current);
    const selectedMarker = selectedVertexMarkerRef.current;
    const posAttr = nextGeometry?.attributes?.position;
    if (selectedMarker && posAttr && selectedIndex >= 0 && selectedIndex < posAttr.count) {
      selectedMarker.visible = true;
      selectedMarker.position.set(
        posAttr.getX(selectedIndex),
        posAttr.getY(selectedIndex),
        posAttr.getZ(selectedIndex)
      );
    } else if (selectedMarker) {
      selectedMarker.visible = false;
    }
    if (pointsRef.current) pointsRef.current.visible = String(dataRef.current?.tool || "move") === "vertex";
  }, [
    config?.primitive,
    config?.weldVertices,
    config?.width,
    config?.height,
    config?.depth,
    config?.radiusTop,
    config?.radiusBottom,
    config?.widthSegments,
    config?.heightSegments,
    config?.depthSegments,
    config?.radialSegments,
    edgeOverlayEnabled,
    importModelUrl,
    importedGeometry,
    importedSmoothShading,
    importedAutoSmooth,
    importedAutoSmoothAngle,
    scheduleEdgeOverlayRefresh,
  ]);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    const importedSmooth = importedSmoothShading !== false;
    const primitive = String(config?.primitive || "box");
    const weldVertices = !!config?.weldVertices;
    const sideTextures = config?.sideTextures || {};
    const textureUrl = String(config?.textureUrl || "");
    const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.86, metalness: 0.05 });
    fallbackMat.userData.__sharedFallback = true;
    const getTexMat = (url, textureSettings, options = {}) => {
      const safe = String(url || "").trim();
      if (!safe) return fallbackMat;
      const key = resolveSceneUploadUrl(safe);
      if (!key) return fallbackMat;
      if (!textureCacheRef.current.has(key)) {
        try {
          const tex = textureLoaderRef.current.load(key);
          tex.colorSpace = THREE.SRGBColorSpace;
          textureCacheRef.current.set(key, tex);
        } catch {
          return fallbackMat;
        }
      }
      const settings = normalizeTextureSettings(textureSettings);
      const variantKey = `${key}::${JSON.stringify(settings)}`;
      if (!textureVariantCacheRef.current.has(variantKey)) {
        const baseTexture = textureCacheRef.current.get(key);
        const nextTexture = baseTexture?.clone?.() || baseTexture;
        if (nextTexture && options?.gltfLike) {
          nextTexture.flipY = false;
          nextTexture.needsUpdate = true;
        }
        applyTextureSettings(nextTexture, settings);
        textureVariantCacheRef.current.set(variantKey, nextTexture);
      }
      return new THREE.MeshStandardMaterial({
        map: textureVariantCacheRef.current.get(variantKey),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.05,
      });
    };
    const getCanvasMat = (canvas, textureSettings, options = {}) => {
      if (!canvas) return fallbackMat;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (options?.gltfLike) {
        tex.flipY = false;
        tex.needsUpdate = true;
      }
      applyTextureSettings(tex, textureSettings);
      return new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.05,
      });
    };
    const applyShadingMode = (material) => {
      const applyOne = (mat) => {
        if (!mat || !mat.isMaterial) return mat;
        if (importedMode) {
          mat.flatShading = !importedSmooth;
          mat.needsUpdate = true;
        }
        return mat;
      };
      if (Array.isArray(material)) {
        material.forEach((m) => applyOne(m));
        return material;
      }
      return applyOne(material);
    };
    let nextMaterial;
    const sideTextureSettings = config?.sideTextureSettings || {};
    const textureSettings = config?.textureSettings || {};
    const importedProjectionMode = String(config?.importedTextureProjection || "front");
    const preserveOriginalImportedUv = importedMode && config?.importedTextureUseOriginalUv !== false;
    const importedOverrideTexture = String(textureUrl || sideTextures?.surface || sideTextures?.side || sideTextures?.front || sideTextures?.px || "").trim();
    const previewCanvas = importedTexturePreviewCanvasRef.current;
    const hasPreviewCanvas = importedMode && !!previewCanvas;
    if (importedMode) {
      ensureImportedOriginalUvBackup(mesh.geometry);
      if ((importedOverrideTexture || hasPreviewCanvas) && !preserveOriginalImportedUv) remapUvByViewProjection(mesh.geometry, importedProjectionMode);
      else restoreImportedOriginalUv(mesh.geometry);
    }
    if (importedMode || weldVertices) {
      if (importedMode && !showViewportTexture) {
        nextMaterial = applyShadingMode(fallbackMat);
      } else {
        const overrideTexture = importedOverrideTexture;
        if (importedMode && hasPreviewCanvas) {
          nextMaterial = applyShadingMode(getCanvasMat(previewCanvas, textureSettings, { gltfLike: true }));
        } else if (importedMode && !overrideTexture) {
          nextMaterial = applyShadingMode(buildImportedMaterialFromTemplates(importedMaterialTemplates) || fallbackMat);
        } else {
          nextMaterial = applyShadingMode(getTexMat(overrideTexture, textureSettings, { gltfLike: true }));
        }
      }
    } else if (primitive === "cylinder") {
      nextMaterial = [
        getTexMat(sideTextures?.side || textureUrl, sideTextureSettings?.side || textureSettings),
        getTexMat(sideTextures?.top || textureUrl, sideTextureSettings?.top || textureSettings),
        getTexMat(sideTextures?.bottom || textureUrl, sideTextureSettings?.bottom || textureSettings),
      ];
    } else if (primitive === "plane") {
      nextMaterial = getTexMat(
        sideTextures?.front || sideTextures?.back || textureUrl,
        sideTextureSettings?.front || sideTextureSettings?.back || textureSettings
      );
    } else if (primitive === "sphere") {
      nextMaterial = getTexMat(sideTextures?.surface || textureUrl, sideTextureSettings?.surface || textureSettings);
    } else {
      nextMaterial = [
        getTexMat(sideTextures?.px || textureUrl, sideTextureSettings?.px || textureSettings),
        getTexMat(sideTextures?.nx || textureUrl, sideTextureSettings?.nx || textureSettings),
        getTexMat(sideTextures?.py || textureUrl, sideTextureSettings?.py || textureSettings),
        getTexMat(sideTextures?.ny || textureUrl, sideTextureSettings?.ny || textureSettings),
        getTexMat(sideTextures?.pz || textureUrl, sideTextureSettings?.pz || textureSettings),
        getTexMat(sideTextures?.nz || textureUrl, sideTextureSettings?.nz || textureSettings),
      ];
    }
    const prev = mesh.material;
    mesh.material = applyShadingMode(nextMaterial);
    disposeMaterialWithMaps(prev);
  }, [
    config?.primitive,
    config?.weldVertices,
    config?.sideTextures,
    config?.sideTextureSettings,
    config?.textureSettings,
    config?.textureUrl,
    importModelUrl,
    importedMaterialTemplates,
    importedTexturePreviewVersion,
    importedSmoothShading,
    showViewportTexture,
  ]);

  React.useEffect(() => {
    if (!edgesRef.current) return;
    scheduleEdgeOverlayRefresh(meshRef.current?.geometry || null);
  }, [edgeOverlayEnabled, scheduleEdgeOverlayRefresh]);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh?.geometry) return;
    applyOffsetsToGeometry(mesh.geometry, offsetsRef.current, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    applyVertexColorsToGeometry(mesh.geometry, paintRef.current);
    if (offsets !== undefined) scheduleEdgeOverlayRefresh(mesh.geometry);
  }, [offsets, paintData, scheduleEdgeOverlayRefresh]);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh?.geometry) return;
    applyOffsetsToGeometry(mesh.geometry, offsetsRef.current, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    scheduleEdgeOverlayRefresh(mesh.geometry);
  }, [importedSmoothShading, importedAutoSmooth, importedAutoSmoothAngle, scheduleEdgeOverlayRefresh]);

  const pointerIcon = (() => {
    if (pointerUi.mode === "sculpt") return "+";
    if (pointerUi.mode === "draw_sharp") return "D";
    if (pointerUi.mode === "clay") return "C";
    if (pointerUi.mode === "clay_strips") return "CS";
    if (pointerUi.mode === "flatten") return "|";
    if (pointerUi.mode === "fill") return "F";
    if (pointerUi.mode === "scrape") return "S";
    if (pointerUi.mode === "smooth") return "~";
    if (pointerUi.mode === "relax") return "R";
    if (pointerUi.mode === "inflate") return "^";
    if (pointerUi.mode === "blob") return "B";
    if (pointerUi.mode === "pinch") return "v";
    if (pointerUi.mode === "crease") return "Cr";
    if (pointerUi.mode === "paint") {
      if (paintPointerType === "precision") return "Px";
      if (paintPointerType === "spray") return "Sp";
      return "P";
    }
    if (pointerUi.mode === "vertex") return "V";
    if (pointerUi.mode === "vertex_add") return "+V";
    if (pointerUi.mode === "select") return "S";
    if (pointerUi.mode === "move") return "M";
    if (pointerUi.mode === "camera") return "O";
    return ".";
  })();

  const currentTool = String(tool || "move");
  const activeBrushToolKey = SCULPT_BRUSH_TOOLS.includes(currentTool)
    ? currentTool
    : "sculpt";
  const activeBrushToolLabel = BRUSH_LABELS[activeBrushToolKey] || "Draw";
  const activeBrushToolStrength = (() => {
    const raw = Number(toolStrengths?.[activeBrushToolKey]);
    if (!Number.isFinite(raw)) return 0.3;
    return Math.max(0.05, Math.min(2, raw));
  })();
  const isBrushToolActive = SCULPT_BRUSH_TOOLS.includes(currentTool);
  const currentToolEntries =
    toolPanelMode === "model"
      ? [
          { key: "select", label: "Selecao" },
          { key: "move", label: "Mover" },
          { key: "vertex", label: "Vertice" },
        ]
      : SCULPT_BRUSH_TOOLS.map((key) => ({ key, label: BRUSH_LABELS[key] || key }));
  const handleAdjustBrushRadius = React.useCallback(
    (delta) => {
      const current = toNum(brushRadius, 0.9, 0.05, 12);
      const next = Math.max(0.05, Math.min(12, current + Number(delta || 0)));
      onBrushRadiusChange?.(String(next.toFixed(2)));
    },
    [brushRadius, onBrushRadiusChange]
  );
  const segmentsLabel = segmentInfo
    ? `W:${segmentInfo.widthSegments || "-"} H:${segmentInfo.heightSegments || "-"} D:${segmentInfo.depthSegments || "-"} R:${
        segmentInfo.radialSegments || "-"
      }`
    : "";
  const handleTransformInput = React.useCallback((field, value) => {
    setTransformDraft((prev) => ({ ...prev, [field]: String(value) }));
  }, []);
  const handleTransformNudge = React.useCallback((field, delta, min = -360, max = 360) => {
    setTransformDraft((prev) => {
      const current = toNum(prev?.[field], field.startsWith("scale") ? 1 : 0, -9999, 9999);
      const next = Math.max(min, Math.min(max, current + Number(delta || 0)));
      return { ...prev, [field]: next.toFixed(field.startsWith("scale") ? 2 : 2) };
    });
  }, []);
  const handleResetTransform = React.useCallback(() => {
    setTransformDraft({
      posX: "0.00",
      posY: "0.00",
      posZ: "0.00",
      rotY: "0.00",
      rotX: "0.00",
      rotZ: "0.00",
      scaleX: "1.00",
      scaleY: "1.00",
      scaleZ: "1.00",
    });
  }, []);
  const handleQuickPanelPointerDown = React.useCallback((event) => {
    const host = wrapperRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const currentY = Number.isFinite(Number(quickPanelPos.y)) ? Number(quickPanelPos.y) : rect.height * 0.58 - 60;
    quickPanelDragRef.current = {
      offsetX: event.clientX - rect.left - Number(quickPanelPos.x || 84),
      offsetY: event.clientY - rect.top - currentY,
    };
  }, [quickPanelPos.x, quickPanelPos.y]);

  const handleSaveAction = React.useCallback(async () => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode) {
      const result = await onSavePreset?.();
      return result !== false;
    }
    const mesh = meshRef.current;
    if (!mesh?.geometry) {
      const result = await onSavePreset?.({ mode: "imported", error: new Error("malha indisponivel") });
      return result !== false;
    }
    const exporter = new GLTFExporter();
    const exportRoot = new THREE.Group();
    const exportMesh = mesh.clone(false);
    exportMesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      exportMesh.material = mesh.material.map((mat) => {
        const cloned = mat?.clone?.() || mat;
        if (cloned?.map?.isTexture) {
          cloned.map = cloned.map.clone();
          cloned.map.needsUpdate = true;
        }
        return cloned;
      });
    } else {
      const cloned = mesh.material?.clone?.() || mesh.material;
      if (cloned?.map?.isTexture) {
        cloned.map = cloned.map.clone();
        cloned.map.needsUpdate = true;
      }
      exportMesh.material = cloned;
    }
    exportMesh.position.copy(mesh.position);
    exportMesh.rotation.copy(mesh.rotation);
    exportMesh.scale.copy(mesh.scale);
    exportRoot.add(exportMesh);
    try {
      const glbBuffer = await new Promise((resolve, reject) => {
        exporter.parse(
          exportRoot,
          (result) => {
            if (result instanceof ArrayBuffer) {
              resolve(result);
              return;
            }
            if (result?.buffer instanceof ArrayBuffer) {
              resolve(result.buffer);
              return;
            }
            reject(new Error("exportacao GLB retornou formato invalido"));
          },
          (error) => reject(error),
          { binary: true, onlyVisible: true, maxTextureSize: 4096 }
        );
      });
      const safeBase = String(importModelName || "modelo_importado")
        .trim()
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "modelo_importado";
      const fileName = `${safeBase}_editado.glb`;
      const file = new File([glbBuffer], fileName, { type: "model/gltf-binary" });
      exportRoot.userData.animationStudio = animationStudioData || null;
      const result = await onSavePreset?.({ mode: "imported", file, fileName, animationStudioData });
      return result !== false;
    } catch (error) {
      const result = await onSavePreset?.({ mode: "imported", error });
      return result !== false;
    } finally {
      exportMesh.geometry?.dispose?.();
      disposeMaterialWithMaps(exportMesh.material);
    }
  }, [animationStudioData, importModelName, importModelUrl, onSavePreset]);

  const handleInsertImportedPointAtHit = React.useCallback((hit) => {
    const mesh = meshRef.current;
    const geometry = mesh?.geometry;
    if (!geometry?.attributes?.position || !resolveSceneUploadUrl(importModelUrl)) return false;
    const next = splitIndexedFaceAtHit(geometry, hit);
    if (!next) return false;
    applyImportedShadingNormals(next, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    selectedVertexIndexRef.current = next.attributes.position.count - 1;
    const prevOffsets = normalizeOffsets(offsetsRef.current);
    offsetsRef.current = {};
    callbacksRef.current?.onOffsetsChange?.({});
    callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
    setImportedGeometry((prev) => {
      prev?.dispose?.();
      return next;
    });
    importedCallbacksRef.current?.onImportedStats?.(buildImportedMeshStats(next));
    return true;
  }, [importModelUrl]);

  const lastSaveRequestRef = React.useRef(Number(saveRequestToken) || 0);
  React.useEffect(() => {
    const token = Number(saveRequestToken) || 0;
    if (token === lastSaveRequestRef.current) return;
    lastSaveRequestRef.current = token;
    let cancelled = false;
    (async () => {
      const success = await handleSaveAction();
      if (!cancelled) onSaveRequestDone?.({ success: success !== false });
    })();
    return () => {
      cancelled = true;
    };
  }, [handleSaveAction, onSaveRequestDone, saveRequestToken]);

  const handleAdjustTopologyClick = React.useCallback(
    (direction) => {
      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      if (!importedMode) {
        const currentConfig = dataRef.current?.config || {};
        const primitive = String(currentConfig?.primitive || "box");
        const bump = String(direction || "") === "down" ? -1 : 1;
        const nextSeg = (value, fallback, min, max) => {
          const n = Math.floor(Number(value));
          const safe = Number.isFinite(n) ? n : fallback;
          return Math.max(min, Math.min(max, safe + bump));
        };
        const nextConfig = {
          ...currentConfig,
          widthSegments: nextSeg(currentConfig?.widthSegments, 1, 1, 64),
          heightSegments: nextSeg(currentConfig?.heightSegments, 1, 1, 64),
          depthSegments:
            primitive === "box"
              ? nextSeg(currentConfig?.depthSegments, 1, 1, 64)
              : currentConfig?.depthSegments,
          radialSegments:
            primitive === "cylinder"
              ? nextSeg(currentConfig?.radialSegments, 8, 3, 64)
              : currentConfig?.radialSegments,
        };
        const sourceGeometry = meshRef.current?.geometry?.clone?.();
        const targetBaseGeometry = buildGeometry(nextConfig);
        if (sourceGeometry?.attributes?.position && targetBaseGeometry?.attributes?.position) {
          const prevOffsets = offsetsRef.current;
          const nextOffsets = normalizeOffsets(
            remapOffsetsByNearestSurface(sourceGeometry, targetBaseGeometry, { maxAbsOffset: 40 })
          );
          offsetsRef.current = nextOffsets;
          callbacksRef.current?.onOffsetsChange?.(nextOffsets);
          callbacksRef.current?.onOffsetsCommit?.(nextOffsets, prevOffsets);
        }
        sourceGeometry?.dispose?.();
        targetBaseGeometry?.dispose?.();
        onAdjustTopology?.(direction);
        return;
      }
      if (String(direction || "") !== "up") {
        return;
      }
      const base = meshRef.current?.geometry || importedGeometry;
      if (!base?.attributes?.position) return;
      if (base.attributes.position.count >= IMPORTED_SUBDIV_MAX_VERTICES) {
        importedCallbacksRef.current?.onImportedGeometryError?.(
          new Error("Limite de poligonos atingido para +Poli (seguranca de desempenho).")
        );
        return;
      }
      const next = subdivideGeometryPreserveUv(base, {
        maxGrowth: 1.55,
        maxVertices: IMPORTED_SUBDIV_MAX_VERTICES,
      });
      if (!next) return;
      setImportedGeometry((prev) => {
        prev?.dispose?.();
        return next;
      });
      importedCallbacksRef.current?.onImportedStats?.(buildImportedMeshStats(next));
      const prevOffsets = offsetsRef.current;
      const prevPaint = paintRef.current;
      offsetsRef.current = {};
      paintRef.current = {};
      callbacksRef.current?.onOffsetsChange?.({});
      callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
      callbacksRef.current?.onPaintChange?.({});
      callbacksRef.current?.onPaintCommit?.({}, prevPaint);
    },
    [importModelUrl, importedGeometry, onAdjustTopology]
  );

  const handleCutImportedByAxis = React.useCallback(
    (axis, keepPositive) => {
      const importedMode = !!resolveSceneUploadUrl(importModelUrl);
      if (!importedMode) return;
      const base = meshRef.current?.geometry || importedGeometry;
      if (!base?.attributes?.position) return;
      const next = cutGeometryByAxisPreserveUv(base, axis, keepPositive);
      if (!next) {
        importedCallbacksRef.current?.onImportedGeometryError?.(
          new Error("Corte vazio. Tente outro eixo/lado.")
        );
        return;
      }
      setImportedGeometry((prev) => {
        prev?.dispose?.();
        return next;
      });
      importedCallbacksRef.current?.onImportedStats?.(buildImportedMeshStats(next));
      const prevOffsets = offsetsRef.current;
      const prevPaint = paintRef.current;
      offsetsRef.current = {};
      paintRef.current = {};
      callbacksRef.current?.onOffsetsChange?.({});
      callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
      callbacksRef.current?.onPaintChange?.({});
      callbacksRef.current?.onPaintCommit?.({}, prevPaint);
    },
    [importModelUrl, importedGeometry]
  );

  const handleWeldImportedByDistance = React.useCallback(() => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode) return;
    const base = meshRef.current?.geometry || importedGeometry;
    if (!base?.attributes?.position) return;
    const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
    const weldEpsilon = Number.isFinite(weldEpsilonRaw) ? Math.max(1e-7, weldEpsilonRaw) : null;
    const beforeStats = buildImportedMeshStats(base);
    const connectedOnly = dataRef.current?.importedWeldConnectedOnly !== false;
    let next = weldImportedGeometryByDistance(base, weldEpsilon, { connectedOnly });
    const afterConnectedStats = next ? buildImportedMeshStats(next) : null;
    if (
      connectedOnly &&
      next &&
      beforeStats &&
      afterConnectedStats &&
      afterConnectedStats.duplicateVertices >= beforeStats.duplicateVertices &&
      afterConnectedStats.weldGroups >= beforeStats.weldGroups
    ) {
      next.dispose?.();
      next = weldImportedGeometryByDistance(base, weldEpsilon, { connectedOnly: false });
    }
    if (!next) {
      importedCallbacksRef.current?.onImportedGeometryError?.(new Error("Nao foi possivel soldar vertices no importado."));
      return;
    }
    const afterStats = buildImportedMeshStats(next);
    setImportedGeometry((prev) => {
      prev?.dispose?.();
      return next;
    });
    importedCallbacksRef.current?.onImportedStats?.(afterStats || buildImportedMeshStats(next));
    const prevOffsets = offsetsRef.current;
    const prevPaint = paintRef.current;
    offsetsRef.current = {};
    paintRef.current = {};
    callbacksRef.current?.onOffsetsChange?.({});
    callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
    callbacksRef.current?.onPaintChange?.({});
    callbacksRef.current?.onPaintCommit?.({}, prevPaint);
  }, [importModelUrl, importedGeometry]);

  const handleRecomputeImportedNormals = React.useCallback(() => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode) return;
    const mesh = meshRef.current;
    const geometry = mesh?.geometry;
    if (!geometry?.attributes?.position) return;
    applyImportedShadingNormals(geometry, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    geometry.attributes.normal && (geometry.attributes.normal.needsUpdate = true);
    if (edgesRef.current) {
      if (edgesRef.current.geometry) edgesRef.current.geometry.dispose();
      edgesRef.current.geometry =
        geometry?.attributes?.position?.count > EDGE_OVERLAY_MAX_VERTICES
          ? new THREE.BufferGeometry()
          : new THREE.EdgesGeometry(geometry, 20);
      edgesRef.current.visible = edgeOverlayEnabled && geometry?.attributes?.position?.count <= EDGE_OVERLAY_MAX_VERTICES;
    }
  }, [edgeOverlayEnabled, importModelUrl]);

  const handleRemeshImportedVoxel = React.useCallback((preset = "medium") => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode) return;
    const base = meshRef.current?.geometry || importedGeometry;
    if (!base?.attributes?.position) return;
    const userEpsRaw = Number(dataRef.current?.importedWeldEpsilon);
    const autoEps = getAutoWeldEpsilon(base);
    const baseEps = Number.isFinite(userEpsRaw) ? Math.max(1e-7, userEpsRaw) : autoEps;
    const presetScale = preset === "fine" ? 0.75 : preset === "coarse" ? 1.9 : 1.25;
    const weldEps = Math.max(1e-6, Math.min(0.05, baseEps * presetScale));
    // Safe remesh path: robust merge-by-distance instead of voxel snap.
    // This preserves the stable sculpt behavior that is already working.
    const next = weldImportedGeometryByDistance(base, weldEps, { connectedOnly: false });
    if (!next) {
      importedCallbacksRef.current?.onImportedGeometryError?.(
        new Error("Remesh seguro nao conseguiu processar a malha.")
      );
      return;
    }
    applyImportedShadingNormals(next, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    setImportedGeometry((prev) => {
      prev?.dispose?.();
      return next;
    });
    importedCallbacksRef.current?.onImportedStats?.(buildImportedMeshStats(next));
    const prevOffsets = offsetsRef.current;
    const prevPaint = paintRef.current;
    offsetsRef.current = {};
    paintRef.current = {};
    callbacksRef.current?.onOffsetsChange?.({});
    callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
    callbacksRef.current?.onPaintChange?.({});
    callbacksRef.current?.onPaintCommit?.({}, prevPaint);
  }, [importModelUrl, importedGeometry]);

  const handleOptimizeImportedForGame = React.useCallback(() => {
    const importedMode = !!resolveSceneUploadUrl(importModelUrl);
    if (!importedMode) return;
    const base = meshRef.current?.geometry || importedGeometry;
    if (!base?.attributes?.position) return;
    const weldEpsilonRaw = Number(dataRef.current?.importedWeldEpsilon);
    const weldEpsilon = Number.isFinite(weldEpsilonRaw) ? Math.max(1e-7, weldEpsilonRaw) : null;
    const next = optimizeImportedGeometryForGame(base, { weldEpsilon });
    if (!next) {
      importedCallbacksRef.current?.onImportedGeometryError?.(
        new Error("Nao foi possivel converter o modelo para jogo.")
      );
      return;
    }
    applyImportedShadingNormals(next, {
      smoothShading: dataRef.current?.importedSmoothShading,
      autoSmooth: dataRef.current?.importedAutoSmooth,
      autoSmoothAngle: dataRef.current?.importedAutoSmoothAngle,
    });
    setImportedGeometry((prev) => {
      prev?.dispose?.();
      return next;
    });
    importedCallbacksRef.current?.onImportedStats?.(buildImportedMeshStats(next));
    const prevOffsets = offsetsRef.current;
    const prevPaint = paintRef.current;
    offsetsRef.current = {};
    paintRef.current = {};
    callbacksRef.current?.onOffsetsChange?.({});
    callbacksRef.current?.onOffsetsCommit?.({}, prevOffsets);
    callbacksRef.current?.onPaintChange?.({});
    callbacksRef.current?.onPaintCommit?.({}, prevPaint);
  }, [importModelUrl, importedGeometry]);

  const isImportedMode = !!resolveSceneUploadUrl(importModelUrl);

  return (
    <div ref={wrapperRef} className="relative h-full w-full rounded border border-cyan-500/35 bg-slate-950">
      <div ref={mountRef} className="h-full w-full" />
      <div className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded border border-cyan-500/45 bg-slate-950/90 p-1.5">
        <p className="mb-1 text-center text-[9px] text-cyan-200">Ponteiro</p>
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() => handleAdjustBrushRadius(0.12)}
            className="h-7 w-8 rounded border border-cyan-500/70 bg-cyan-900/35 text-[14px] font-semibold text-cyan-100"
            title="Aumentar tamanho"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleAdjustBrushRadius(-0.12)}
            className="h-7 w-8 rounded border border-slate-600 bg-slate-900 text-[14px] font-semibold text-slate-100"
            title="Diminuir tamanho"
          >
            -
          </button>
        </div>
      </div>
      {currentTool === "select" ? (
        <div className="absolute right-14 top-2 z-30 w-56 rounded border border-cyan-500/50 bg-slate-950/92 p-2 text-[10px] text-cyan-100">
          <p className="font-semibold text-cyan-200">Selecao do objeto</p>
          {modelSelected ? (
            <>
              <p className="mt-1 text-[9px] text-cyan-300/85">Posicao</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <input type="number" step="0.1" value={transformDraft.posX} onChange={(e) => handleTransformInput("posX", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="X" />
                <input type="number" step="0.1" value={transformDraft.posY} onChange={(e) => handleTransformInput("posY", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Y" />
                <input type="number" step="0.1" value={transformDraft.posZ} onChange={(e) => handleTransformInput("posZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Z" />
              </div>
              <p className="mt-2 text-[9px] text-cyan-300/85">Rotacao / inclinacao</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <input type="number" step="1" value={transformDraft.rotX} onChange={(e) => handleTransformInput("rotX", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Rot X" />
                <input type="number" step="1" value={transformDraft.rotY} onChange={(e) => handleTransformInput("rotY", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Rot Y" />
                <input type="number" step="1" value={transformDraft.rotZ} onChange={(e) => handleTransformInput("rotZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Rot Z" />
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => handleTransformNudge("rotX", -5)} className="h-7 rounded border border-violet-500/70 bg-violet-900/30 text-[10px]">Inclinar X -</button>
                <button type="button" onClick={() => handleTransformNudge("rotX", 5)} className="h-7 rounded border border-violet-500/70 bg-violet-900/30 text-[10px]">Inclinar X +</button>
                <button type="button" onClick={() => handleTransformNudge("rotZ", -5)} className="h-7 rounded border border-indigo-500/70 bg-indigo-900/30 text-[10px]">Inclinar Z -</button>
                <button type="button" onClick={() => handleTransformNudge("rotZ", 5)} className="h-7 rounded border border-indigo-500/70 bg-indigo-900/30 text-[10px]">Inclinar Z +</button>
              </div>
              <p className="mt-2 text-[9px] text-cyan-300/85">Escala</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <input type="number" step="0.1" min="0.05" value={transformDraft.scaleX} onChange={(e) => handleTransformInput("scaleX", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Esc X" />
                <input type="number" step="0.1" min="0.05" value={transformDraft.scaleY} onChange={(e) => handleTransformInput("scaleY", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Esc Y" />
                <input type="number" step="0.1" min="0.05" value={transformDraft.scaleZ} onChange={(e) => handleTransformInput("scaleZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100" placeholder="Esc Z" />
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => { handleTransformNudge("scaleX", -0.1, 0.05, 50); handleTransformNudge("scaleY", -0.1, 0.05, 50); handleTransformNudge("scaleZ", -0.1, 0.05, 50); }} className="h-7 rounded border border-emerald-500/70 bg-emerald-900/30 text-[10px]">Tamanho -</button>
                <button type="button" onClick={() => { handleTransformNudge("scaleX", 0.1, 0.05, 50); handleTransformNudge("scaleY", 0.1, 0.05, 50); handleTransformNudge("scaleZ", 0.1, 0.05, 50); }} className="h-7 rounded border border-emerald-500/70 bg-emerald-900/30 text-[10px]">Tamanho +</button>
              </div>
              <button type="button" onClick={handleResetTransform} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 text-[10px] text-slate-100">Reset transform</button>
            </>
          ) : (
            <p className="mt-2 text-[10px] text-cyan-300/85">Clique no objeto para selecionar e editar.</p>
          )}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-16 top-2 z-30 flex w-[148px] flex-col items-end gap-2">
        <HoverMenu
          label="Ferramentas"
          accent={toolPanelMode === "sculpt" ? "amber" : "cyan"}
          summary={`${toolPanelMode === "sculpt" ? "Esculpir" : "Modelar"} • ${currentTool === "paint" ? "Paint" : activeBrushToolLabel}`}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modo</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setToolPanelMode("model")} className={`h-8 rounded-lg border text-[11px] ${toolPanelMode === "model" ? "border-cyan-300 bg-cyan-900/50 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}>Modelar</button>
                <button type="button" onClick={() => setToolPanelMode("sculpt")} className={`h-8 rounded-lg border text-[11px] ${toolPanelMode === "sculpt" ? "border-amber-300 bg-amber-900/45 text-amber-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}>Esculpir</button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ferramenta ativa</p>
              <div className="grid grid-cols-2 gap-2">
                {currentToolEntries.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToolChange?.(item.key)}
                    className={`h-8 rounded-lg border px-2 text-[11px] ${currentTool === item.key ? "border-cyan-300 bg-cyan-900/50 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </HoverMenu>

        <HoverMenu
          label="Brush"
          accent={isBrushToolActive ? "amber" : "cyan"}
          summary={isBrushToolActive ? `${activeBrushToolLabel} • raio ${Number(brushRadius || 0.9).toFixed(2)}` : "Ajustes"}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-cyan-100">
                <span className="font-semibold">{isBrushToolActive ? activeBrushToolLabel : "Ferramenta atual"}</span>
                <span className="text-slate-400">{currentTool}</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Raio</span><span>{Number(brushRadius || 0.9).toFixed(2)}</span></div>
                  <input type="range" min="0.05" max="12" step="0.05" value={String(brushRadius ?? 0.9)} onChange={(event) => onBrushRadiusChange?.(event.target.value)} className="w-full" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Forca base</span><span>{Number(brushStrength || 0.025).toFixed(3)}</span></div>
                  <input type="range" min="0.0005" max="0.2" step="0.0025" value={String(brushStrength ?? 0.025)} onChange={(event) => onBrushStrengthChange?.(event.target.value)} className="w-full" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Intensidade do pincel</span><span>{activeBrushToolStrength.toFixed(2)}</span></div>
                  <input type="range" min="0.05" max="2" step="0.05" value={String(activeBrushToolStrength)} onChange={(event) => onToolStrengthChange?.(activeBrushToolKey, event.target.value)} className="w-full" />
                </div>
              </div>
            </div>
            {currentTool === "paint" ? (
              <div className="rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/20 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">Ponteiro de pintura</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAINT_POINTER_TYPES.map((item) => (
                    <button key={item.key} type="button" onClick={() => setPaintPointerType(item.key)} className={`h-8 rounded-lg border text-[10px] ${paintPointerType === item.key ? "border-fuchsia-300 bg-fuchsia-800/60 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </HoverMenu>

        <HoverMenu label="Viewport" accent="cyan" summary={`Poligonos ${Number(polygonEstimate) || 0}`}>
          <div className="space-y-3">
            <button type="button" onClick={() => setEdgeOverlayEnabled((prev) => !prev)} className="h-8 w-full rounded-lg border border-amber-500/70 bg-amber-900/30 text-[11px] text-amber-100">
              {edgeOverlayEnabled ? "Ocultar linhas" : "Mostrar linhas"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handleAdjustTopologyClick("down")} className="h-8 rounded-lg border border-slate-700 bg-slate-900 text-[11px] text-slate-200">- Poli</button>
              <button type="button" onClick={() => handleAdjustTopologyClick("up")} className="h-8 rounded-lg border border-cyan-500/70 bg-cyan-900/35 text-[11px] text-cyan-100">+ Poli</button>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-[10px] text-cyan-100">
              <div>Poligonos: {Number(polygonEstimate) || 0}</div>
              {segmentsLabel ? <div className="mt-1 text-cyan-200/85">{segmentsLabel}</div> : null}
            </div>
          </div>
        </HoverMenu>

        {isImportedMode ? (
          <>
            <HoverMenu label="Importado" accent="amber" summary={`Slot ${normalizeImportedTextureSlot(importedTextureEditSlot || config?.importedTextureProjection || "front")}`}>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ferramentas do viewport</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => handleCutImportedByAxis("x", false)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">X-</button>
                    <button type="button" onClick={() => handleCutImportedByAxis("y", false)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">Y-</button>
                    <button type="button" onClick={() => handleCutImportedByAxis("z", false)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">Z-</button>
                    <button type="button" onClick={() => handleCutImportedByAxis("x", true)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">X+</button>
                    <button type="button" onClick={() => handleCutImportedByAxis("y", true)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">Y+</button>
                    <button type="button" onClick={() => handleCutImportedByAxis("z", true)} className="h-8 rounded-lg border border-amber-500/70 bg-amber-900/30 text-[10px] text-amber-100">Z+</button>
                  </div>
                </div>
                <button type="button" onClick={handleWeldImportedByDistance} className="h-8 w-full rounded-lg border border-emerald-500/70 bg-emerald-900/35 text-[11px] text-emerald-100">Soldar vertices</button>
                <button type="button" onClick={() => onImportedWeldConnectedOnlyChange?.(!importedWeldConnectedOnly)} className={`h-8 w-full rounded-lg border text-[11px] ${importedWeldConnectedOnly ? "border-cyan-400/70 bg-cyan-900/35 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-200"}`}>{importedWeldConnectedOnly ? "Connected only: ON" : "Connected only: OFF"}</button>
                <button type="button" onClick={handleRecomputeImportedNormals} className="h-8 w-full rounded-lg border border-cyan-500/70 bg-cyan-900/35 text-[11px] text-cyan-100">Recalcular normais</button>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => handleRemeshImportedVoxel("fine")} className="h-8 rounded-lg border border-violet-500/60 bg-violet-900/25 text-[10px] text-violet-100">Voxel fino</button>
                  <button type="button" onClick={() => handleRemeshImportedVoxel("medium")} className="h-8 rounded-lg border border-violet-500/60 bg-violet-900/25 text-[10px] text-violet-100">Voxel medio</button>
                  <button type="button" onClick={() => handleRemeshImportedVoxel("coarse")} className="h-8 rounded-lg border border-violet-500/60 bg-violet-900/25 text-[10px] text-violet-100">Voxel grosso</button>
                </div>
                <button type="button" onClick={handleOptimizeImportedForGame} className="h-8 w-full rounded-lg border border-emerald-500/70 bg-emerald-900/35 text-[11px] text-emerald-100">Converter para jogo</button>
              </div>
            </HoverMenu>

            <HoverMenu label="Textura" accent="fuchsia" summary={`Slot ${normalizeImportedTextureSlot(importedTextureEditSlot || config?.importedTextureProjection || "front")}`}>
              <div className="space-y-3">
                <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 text-[10px] text-fuchsia-100">
                  <div>Slot de textura (importado)</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase">{normalizeImportedTextureSlot(importedTextureEditSlot || config?.importedTextureProjection || "front")}</div>
                </div>
                <button type="button" onClick={handleImportedTextureEditorOpen} className="h-8 w-full rounded-lg border border-fuchsia-500/70 bg-fuchsia-900/30 text-[11px] text-fuchsia-100">Editar textura aplicada</button>
                <button type="button" onClick={() => onRestoreImportedOriginalSkin?.()} disabled={!hasImportedTextureOverride} className={`h-8 w-full rounded-lg border text-[11px] ${hasImportedTextureOverride ? "border-sky-400/70 bg-sky-900/35 text-sky-100" : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-400"}`}>Usar skin original</button>
              </div>
            </HoverMenu>
          </>
        ) : null}

        <HoverMenu label="Arquivo" accent="emerald" summary="Undo, preview e save">
          <div className="space-y-2">
            <button type="button" onClick={() => onUndo?.()} className="h-8 w-full rounded-lg border border-amber-500/70 bg-amber-900/35 text-[11px] text-amber-100">Desfazer</button>
            <button type="button" onClick={() => onRedo?.()} className="h-8 w-full rounded-lg border border-sky-500/70 bg-sky-900/35 text-[11px] text-sky-100">Refazer</button>
            <button type="button" onClick={() => setAnimationStudioOpen(true)} className="h-8 w-full rounded-lg border border-fuchsia-500/70 bg-fuchsia-900/35 text-[11px] text-fuchsia-100">Studio de animacao</button>
            <button type="button" onClick={() => setFinalCharacterPreviewOpen(true)} className="h-8 w-full rounded-lg border border-emerald-400/70 bg-emerald-950/90 text-[11px] font-semibold text-emerald-100">Visualizar render final</button>
            <button type="button" onClick={handleSaveAction} className="h-8 w-full rounded-lg border border-emerald-500/70 bg-emerald-900/35 text-[11px] text-emerald-100">Salvar arquivo 3D</button>
          </div>
        </HoverMenu>
      </div>

      <div className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-2xl border border-cyan-500/35 bg-slate-950/92 p-2 shadow-[0_14px_30px_rgba(2,6,23,0.45)] backdrop-blur-sm">
        <div className="grid grid-cols-1 gap-2">
          {[
            { key: "select", label: "Selecao" },
            { key: "move", label: "Mover" },
            { key: "vertex", label: "Vertice" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onToolChange?.(item.key)}
              className={`min-w-[76px] rounded-xl border px-3 py-2 text-[10px] font-semibold ${
                currentTool === item.key
                  ? "border-cyan-300 bg-cyan-900/55 text-cyan-100"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="absolute z-[35] w-56 rounded-2xl border border-cyan-500/35 bg-slate-950/90 p-3 text-[10px] text-cyan-100 shadow-[0_14px_30px_rgba(2,6,23,0.4)] backdrop-blur-sm"
        style={{
          left: `${Number(quickPanelPos.x || 84)}px`,
          top: Number.isFinite(Number(quickPanelPos.y)) ? `${Number(quickPanelPos.y)}px` : "58%",
          transform: Number.isFinite(Number(quickPanelPos.y)) ? "none" : "translateY(-50%)",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onPointerDown={handleQuickPanelPointerDown}
            className="cursor-grab rounded-md border border-cyan-500/25 bg-cyan-950/30 px-2 py-1 font-semibold text-cyan-200 active:cursor-grabbing"
          >
            Painel rapido
          </button>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-950/30 px-2 py-0.5 text-[9px] uppercase text-cyan-200/85">
            {currentTool === "paint" ? "Pintura" : activeBrushToolLabel}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Raio</span><span>{Number(brushRadius || 0.9).toFixed(2)}</span></div>
            <input type="range" min="0.05" max="12" step="0.05" value={String(brushRadius ?? 0.9)} onChange={(event) => onBrushRadiusChange?.(event.target.value)} className="w-full" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Forca base</span><span>{Number(brushStrength || 0.025).toFixed(3)}</span></div>
            <input type="range" min="0.0005" max="0.2" step="0.0025" value={String(brushStrength ?? 0.025)} onChange={(event) => onBrushStrengthChange?.(event.target.value)} className="w-full" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-300"><span>Intensidade</span><span>{activeBrushToolStrength.toFixed(2)}</span></div>
            <input type="range" min="0.05" max="2" step="0.05" value={String(activeBrushToolStrength)} onChange={(event) => onToolStrengthChange?.(activeBrushToolKey, event.target.value)} className="w-full" />
          </div>
          {currentTool === "paint" ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold text-fuchsia-200">Ponteiro de pintura</p>
              <div className="grid grid-cols-3 gap-2">
                {PAINT_POINTER_TYPES.map((item) => (
                  <button key={item.key} type="button" onClick={() => setPaintPointerType(item.key)} className={`h-8 rounded-lg border text-[9px] ${paintPointerType === item.key ? "border-fuchsia-300 bg-fuchsia-800/60 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {currentTool === "vertex" ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold text-cyan-200">Modo vertice</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "move", label: "Mover" },
                  { key: "add", label: "Adicionar" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setVertexInteractionMode(item.key)}
                    className={`h-8 rounded-lg border text-[10px] ${
                      vertexInteractionMode === item.key
                        ? "border-cyan-300 bg-cyan-900/55 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[9px] text-cyan-200/75">
                Em Adicionar, clique na malha para criar um novo ponto.
              </p>
              <button
                type="button"
                onClick={() => setVertexElasticMode((prev) => !prev)}
                className={`h-8 w-full rounded-lg border text-[10px] ${
                  vertexElasticMode
                    ? "border-cyan-300 bg-cyan-900/55 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-200"
                }`}
              >
                {vertexElasticMode ? "Elasticidade: ON" : "Elasticidade: OFF"}
              </button>
              <p className="mt-1 text-[9px] text-cyan-200/75">
                Puxa as vertices ao redor com falloff.
              </p>
              <button
                type="button"
                onClick={() => setVertexNoTearMode((prev) => !prev)}
                className={`mt-2 h-8 w-full rounded-lg border text-[10px] ${
                  vertexNoTearMode
                    ? "border-emerald-300 bg-emerald-900/45 text-emerald-100"
                    : "border-slate-700 bg-slate-900 text-slate-200"
                }`}
              >
                {vertexNoTearMode ? "Nao rasgar: ON" : "Nao rasgar: OFF"}
              </button>
              <p className="mt-1 text-[9px] text-cyan-200/75">
                Move vertices coincidentes juntos nas costuras.
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-2 text-[10px] text-cyan-100">
            <div>Poligonos: {Number(polygonEstimate) || 0}</div>
            {segmentsLabel ? <div className="mt-1 text-cyan-200/85">{segmentsLabel}</div> : null}
          </div>
        </div>
      </div>

      {pointerUi.visible ? (
        <div
          className="pointer-events-none absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/85 bg-cyan-950/75 text-center text-[12px] leading-6 text-cyan-100"
          style={{ left: `${pointerUi.x}px`, top: `${pointerUi.y}px` }}
        >
          {pointerIcon}
        </div>
      ) : null}
      <ImportedTextureEditorDialog
        open={importedTextureEditorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleImportedTextureEditorClose();
        }}
        sourceImage={importedTextureEditorSourceImage}
        sourceUrl={importedTextureEditorSourceUrl}
        modelLabel={importModelName || "modelo_importado"}
        slot={normalizeImportedTextureSlot(importedTextureEditSlot || config?.importedTextureProjection || "front")}
        previewGeometry={importedGeometry}
        previewMaterialTemplates={importedMaterialTemplates}
        onPreviewChange={handleImportedTexturePreviewChange}
        onApply={handleImportedTextureEditorApply}
      />
      <FinalCharacterPreviewDialog
        open={finalCharacterPreviewOpen}
        onOpenChange={setFinalCharacterPreviewOpen}
        modelUrl={importModelUrl}
        fallbackGeometry={meshRef.current?.geometry || importedGeometry}
        fallbackMaterial={meshRef.current?.material || null}
        modelLabel={importModelName || "personagem"}
      />
      <AnimationStudioDialog
        open={animationStudioOpen}
        onOpenChange={setAnimationStudioOpen}
        modelUrl={importModelUrl}
        modelLabel={importModelName || "personagem"}
        studioData={animationStudioData}
        onStudioDataChange={(nextData) => {
          setAnimationStudioData(nextData || null);
          onAnimationStudioChange?.(nextData || null);
        }}
      />
    </div>
  );
}
