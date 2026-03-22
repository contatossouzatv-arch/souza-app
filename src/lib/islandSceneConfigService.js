import { base44 } from "@/api/base44Client";

const ENTITY_NAME = "IslandSceneConfig";
const SCENE_VERSION = 1;

function normalizeDay(day) {
  const parsed = Number(day);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function normalizeAssetReference(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  const slash = raw.replace(/\\/g, "/");
  if (slash.startsWith("/uploads/") || slash.startsWith("/api/uploads/")) return slash;
  if (slash.startsWith("uploads/") || slash.startsWith("api/uploads/")) return `/${slash}`;
  if (slash.startsWith("http://") || slash.startsWith("https://")) {
    try {
      const parsed = new URL(slash);
      if (parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/uploads/")) {
        return parsed.pathname;
      }
    } catch {
      // keep original below
    }
  }
  return slash;
}

function getSceneAssetFileName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const slash = raw.replace(/\\/g, "/");
  const noQuery = slash.split("?")[0].split("#")[0];
  return noQuery.split("/").pop() || noQuery;
}

function getCanonicalSceneAssetName(value) {
  const fileName = getSceneAssetFileName(value);
  if (!fileName) return "";
  const dotIndex = fileName.lastIndexOf(".");
  const hasExt = dotIndex > 0;
  const ext = hasExt ? fileName.slice(dotIndex).toLowerCase() : "";
  let base = hasExt ? fileName.slice(0, dotIndex) : fileName;
  base = base.replace(/^\d{10,}-/, "");
  base = base.replace(/-\d{10,}(?:-[a-z0-9]{4,})?$/i, "");
  base = base.replace(/-\d{10,}(?:-[a-z0-9]{4,})?$/i, "");
  return `${base}${ext}`;
}

function collapseDuplicateSceneAssetReferences(config) {
  const source = config && typeof config === "object" ? config : {};
  const canonicalAssetUrlMap = new Map();
  const canonicalize = (value) => {
    const normalized = normalizeAssetReference(value);
    if (!normalized) return "";
    const canonicalName = getCanonicalSceneAssetName(normalized);
    if (!canonicalName) return normalized;
    if (!canonicalAssetUrlMap.has(canonicalName)) {
      canonicalAssetUrlMap.set(canonicalName, normalized);
    }
    return canonicalAssetUrlMap.get(canonicalName) || normalized;
  };

  const objectOverrides = source.object_overrides && typeof source.object_overrides === "object" ? source.object_overrides : {};
  const customObjects = Array.isArray(source.custom_objects) ? source.custom_objects : [];
  const nextOverrides = {};
  Object.entries(objectOverrides).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    nextOverrides[key] = {
      ...value,
      texture_url: canonicalize(value.texture_url),
      model_url: canonicalize(value.model_url),
    };
  });
  const nextCustomObjects = customObjects.map((item) => ({
    ...item,
    texture_url: canonicalize(item?.texture_url),
    model_url: canonicalize(item?.model_url),
  }));

  return {
    ...source,
    horizon_texture_url: canonicalize(source.horizon_texture_url),
    road_texture_url: canonicalize(source.road_texture_url),
    map_islands: Array.isArray(source.map_islands) ? source.map_islands : [],
    object_overrides: nextOverrides,
    custom_objects: nextCustomObjects,
  };
}

function normalizeSceneConfigAssets(config) {
  const source = config && typeof config === "object" ? config : {};
  const objectOverrides = source.object_overrides && typeof source.object_overrides === "object" ? source.object_overrides : {};
  const customObjects = Array.isArray(source.custom_objects) ? source.custom_objects : [];

  const nextOverrides = {};
  Object.entries(objectOverrides).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    nextOverrides[key] = {
      ...value,
      texture_url: normalizeAssetReference(value.texture_url),
      model_url: normalizeAssetReference(value.model_url),
    };
  });

  const nextCustomObjects = customObjects.map((item) => ({
    ...item,
    texture_url: normalizeAssetReference(item?.texture_url),
    model_url: normalizeAssetReference(item?.model_url),
  }));

  return collapseDuplicateSceneAssetReferences({
    ...source,
    horizon_texture_url: normalizeAssetReference(source.horizon_texture_url),
    road_texture_url: normalizeAssetReference(source.road_texture_url),
    map_islands: Array.isArray(source.map_islands) ? source.map_islands : [],
    scene_lighting: source.scene_lighting && typeof source.scene_lighting === "object" ? source.scene_lighting : {},
    object_overrides: nextOverrides,
    custom_objects: nextCustomObjects,
  });
}

export function createDefaultSceneConfig(islandDay) {
  return {
    version: SCENE_VERSION,
    island_day: normalizeDay(islandDay),
    horizon_texture_url: "",
    road_texture_url: "",
    map_islands: [],
    scene_lighting: {},
    object_overrides: {},
    custom_objects: [],
  };
}

export async function loadIslandSceneConfig(islandDay) {
  const day = normalizeDay(islandDay);
  const rows = await base44.entities[ENTITY_NAME].filter({ island_day: day }, "-updated_date", 1);
  const item = Array.isArray(rows) ? rows[0] : null;
  if (!item) {
    return {
      id: null,
      config: createDefaultSceneConfig(day),
    };
  }

  return {
    id: item.id || null,
    config: normalizeSceneConfigAssets({
      ...createDefaultSceneConfig(day),
      ...(item || {}),
      island_day: day,
      object_overrides:
        item && item.object_overrides && typeof item.object_overrides === "object"
          ? item.object_overrides
          : {},
      custom_objects: Array.isArray(item?.custom_objects) ? item.custom_objects : [],
    }),
  };
}

export async function saveIslandSceneConfig({ id, islandDay, patch }) {
  const day = normalizeDay(islandDay);
  const current = await loadIslandSceneConfig(day);
  const merged = normalizeSceneConfigAssets({
    ...current.config,
    ...(patch || {}),
    island_day: day,
    version: SCENE_VERSION,
    object_overrides: {
      ...(current.config.object_overrides || {}),
      ...((patch && patch.object_overrides) || {}),
    },
    custom_objects: Array.isArray(patch?.custom_objects)
      ? patch.custom_objects
      : Array.isArray(current.config.custom_objects)
        ? current.config.custom_objects
        : [],
  });

  if (id || current.id) {
    const updated = await base44.entities[ENTITY_NAME].update(id || current.id, merged);
    return { id: updated?.id || id || current.id, config: merged };
  }

  const created = await base44.entities[ENTITY_NAME].create(merged);
  return { id: created?.id || null, config: merged };
}

export async function copyIslandSceneConfig({ fromIslandDay, toIslandDay }) {
  const source = await loadIslandSceneConfig(fromIslandDay);
  const targetDay = normalizeDay(toIslandDay);
  const payload = normalizeSceneConfigAssets({
    ...createDefaultSceneConfig(targetDay),
    ...(source.config || {}),
    island_day: targetDay,
    version: SCENE_VERSION,
  });
  delete payload.id;
  delete payload.created_date;
  delete payload.updated_date;

  const target = await loadIslandSceneConfig(targetDay);
  if (target.id) {
    const updated = await base44.entities[ENTITY_NAME].update(target.id, payload);
    return { id: updated?.id || target.id, config: payload };
  }

  const created = await base44.entities[ENTITY_NAME].create(payload);
  return { id: created?.id || null, config: payload };
}

export async function uploadSceneAsset(file, options = {}) {
  const rawFilename = String(options?.filename || "").trim() || String(file?.name || "").trim();
  let filename = rawFilename;
  if (filename) {
    const dotIndex = filename.lastIndexOf(".");
    const hasExt = dotIndex > 0 && dotIndex < filename.length - 1;
    const baseName = hasExt ? filename.slice(0, dotIndex) : filename;
    const ext = hasExt ? filename.slice(dotIndex) : "";
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    filename = `${baseName}-${stamp}${ext}`;
  }
  const uploaded = await base44.integrations.Core.UploadFile({
    file,
    folder: options?.folder || "",
    filename,
  });
  return uploaded?.file_url || "";
}
