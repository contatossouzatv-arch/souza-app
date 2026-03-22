import { resolveAssetUrl } from "@/api/base44Client";
import { warmVideoAsset } from "@/lib/dailyEventMediaWarmup";
import { loadIslandSceneConfig } from "@/lib/islandSceneConfigService";

import folhasTransicaoVideo from "../../assets-para-app/jogos/folhas transiçao.webm";
import loadoutMenuAnimationVideo from "../../assets-para-app/animaçao load menu.webm";
import horizonteImage from "../../assets-para-app/jogos/horizonte.webp";
import ilhaCentralFundoImage from "../../assets-para-app/jogos/ilha-central-fundo.png";
import sombraDeNunvensImage from "../../assets-para-app/jogos/sombra-de-nunvens.png";
import nuvemCantoSuperiorEsquerdoImage from "../../assets-para-app/jogos/nuvem-canto-superior-esquerdo.png";
import nuvemCantoSuperiorDireitoImage from "../../assets-para-app/jogos/nuvem-canto-superior-direito.png";
import nuvemCantoInferiorEsquerdoImage from "../../assets-para-app/jogos/nuvem-canto-inferior--esquerdo.png";
import nuvemCantoInferiorDireitoImage from "../../assets-para-app/jogos/nuvem-canto-inferior--direito.png";
import ilhaLevel2Image from "../../assets-para-app/ilha-level-2.png";
import ilhaLevel2OkImage from "../../assets-para-app/jogos/ilha-level-2-ok.png";
import ilhaLevel3Image from "../../assets-para-app/jogos/ilha-level-3.png";
import ilhaLevel4Image from "../../assets-para-app/ilha-level-4.png";
import arvoreGameImage from "../../assets-para-app/jogos/arvore-game.png";
import sandTileImage from "../../assets-para-app/jogos/sand_tile.webp";
import gramaJogoCertoImage from "../../assets-para-app/jogos/grama-jogo-certo.png";
import horizonteJogo3DImage from "../../assets-para-app/jogos/horizonte-jogo-3d.png";
import roadBaseColorImage from "../../assets-para-app/jogos/estrada-textura.png";
import roadBaseNormalImage from "../../assets-para-app/jogos/normal.png";
import roadBaseRoughnessImage from "../../assets-para-app/jogos/Roughness.png";
import roadBaseAoImage from "../../assets-para-app/jogos/ao.png";
import roadShoulderBaseColorImage from "../../assets-para-app/jogos/road_shoulder-base-color.png";
import roadShoulderNormalImage from "../../assets-para-app/jogos/road_shoulder-normal.png";
import roadShoulderRoughnessImage from "../../assets-para-app/jogos/road_shoulder-roughness.png";
import roadShoulderAoImage from "../../assets-para-app/jogos/road_shoulder-AO.png";
import sombraArvoreOkImage from "../../assets-para-app/jogos/sombra-arvore-ok.png";
import defaultRoadChunkModelUrl from "../../assets-para-app/jogos/chunk_road_01.glb?url";
import playerIdleFbxUrl from "../../assets-para-app/jogos/personagem principal/PERSONAGEM IDLE.fbx?url";
import botaoLojaImage from "../../assets-para-app/jogos/botoes menus/botao-loja.png";
import botaoIlhasImage from "../../assets-para-app/jogos/botoes menus/botao-ilhas.png";
import botaoColecaoImage from "../../assets-para-app/jogos/botoes menus/botao-colecao.png";
import botaoCacadoresImage from "../../assets-para-app/jogos/botoes menus/botao-caçadores.png";
import notificacaoIconeImage from "../../assets-para-app/jogos/botoes menus/notificação-icone.png";

const imagePromiseCache = new Map();
const fetchPromiseCache = new Map();
const modulePromiseCache = new Map();
const islandConfigPromiseCache = new Map();

const DAILY_EVENT_STATIC_IMAGES = [
  horizonteImage,
  ilhaCentralFundoImage,
  sombraDeNunvensImage,
  nuvemCantoSuperiorEsquerdoImage,
  nuvemCantoSuperiorDireitoImage,
  nuvemCantoInferiorEsquerdoImage,
  nuvemCantoInferiorDireitoImage,
  ilhaLevel2Image,
  ilhaLevel2OkImage,
  ilhaLevel3Image,
  ilhaLevel4Image,
  botaoLojaImage,
  botaoIlhasImage,
  botaoColecaoImage,
  botaoCacadoresImage,
  notificacaoIconeImage,
  arvoreGameImage,
  sandTileImage,
  gramaJogoCertoImage,
  horizonteJogo3DImage,
  roadBaseColorImage,
  roadBaseNormalImage,
  roadBaseRoughnessImage,
  roadBaseAoImage,
  roadShoulderBaseColorImage,
  roadShoulderNormalImage,
  roadShoulderRoughnessImage,
  roadShoulderAoImage,
  sombraArvoreOkImage,
];

const DAILY_EVENT_STATIC_FETCHES = [defaultRoadChunkModelUrl, playerIdleFbxUrl];

function resolveWarmupUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^(blob:|data:|https?:\/\/|\/assets\/|assets\/|\/@fs\/)/i.test(value)) return value;
  if (
    value.startsWith("/uploads/") ||
    value.startsWith("uploads/") ||
    value.startsWith("/api/uploads/") ||
    value.startsWith("api/uploads/")
  ) {
    return resolveAssetUrl(value.startsWith("/") ? value : `/${value}`);
  }
  return value;
}

export function warmImageAsset(rawUrl) {
  if (typeof Image === "undefined") return Promise.resolve(false);
  const url = resolveWarmupUrl(rawUrl);
  if (!url) return Promise.resolve(false);
  if (imagePromiseCache.has(url)) return imagePromiseCache.get(url);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).finally(() => resolve(true));
        return;
      }
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
  imagePromiseCache.set(url, promise);
  return promise;
}

export function warmFetchAsset(rawUrl) {
  if (typeof fetch === "undefined") return Promise.resolve(false);
  const url = resolveWarmupUrl(rawUrl);
  if (!url) return Promise.resolve(false);
  if (fetchPromiseCache.has(url)) return fetchPromiseCache.get(url);
  const promise = fetch(url, { credentials: "same-origin" })
    .then((response) => response.ok)
    .catch(() => false);
  fetchPromiseCache.set(url, promise);
  return promise;
}

export function warmModuleImport(cacheKey, importer) {
  const key = String(cacheKey || "").trim();
  if (!key || typeof importer !== "function") return Promise.resolve(null);
  if (modulePromiseCache.has(key)) return modulePromiseCache.get(key);
  const promise = Promise.resolve()
    .then(() => importer())
    .catch(() => null);
  modulePromiseCache.set(key, promise);
  return promise;
}

export function warmIslandSceneConfig(day) {
  const key = Number(day) || 1;
  if (islandConfigPromiseCache.has(key)) return islandConfigPromiseCache.get(key);
  const promise = loadIslandSceneConfig(key).catch(() => null);
  islandConfigPromiseCache.set(key, promise);
  return promise;
}

function collectSceneUrls(sceneConfig) {
  const urls = { images: [], videos: [], fetches: [] };
  if (!sceneConfig || typeof sceneConfig !== "object") return urls;

  const addImage = (value) => {
    const resolved = resolveWarmupUrl(value);
    if (resolved) urls.images.push(resolved);
  };
  const addVideo = (value) => {
    const resolved = resolveWarmupUrl(value);
    if (resolved) urls.videos.push(resolved);
  };
  const addFetch = (value) => {
    const resolved = resolveWarmupUrl(value);
    if (resolved) urls.fetches.push(resolved);
  };

  addImage(sceneConfig.horizon_texture_url);
  addImage(sceneConfig.road_texture_url);
  addFetch(sceneConfig.loadout_base_model_url);

  const roadBase = sceneConfig.object_overrides?.road_base;
  addFetch(roadBase?.model_url);
  addImage(roadBase?.texture_url);

  const customObjects = Array.isArray(sceneConfig.custom_objects) ? sceneConfig.custom_objects : [];
  customObjects.forEach((item) => {
    const mediaType = String(item?.media_type || "").trim().toLowerCase();
    addImage(item?.texture_url);
    addFetch(item?.model_url);
    const sideTextures = item?.side_textures && typeof item.side_textures === "object" ? item.side_textures : {};
    Object.values(sideTextures).forEach(addImage);
    if (mediaType === "video") addVideo(item?.texture_url);
  });

  return {
    images: Array.from(new Set(urls.images)),
    videos: Array.from(new Set(urls.videos)),
    fetches: Array.from(new Set(urls.fetches)),
  };
}

export function warmDailyEventAppShell() {
  const tasks = [
    warmModuleImport("daily-event-route", () => import("../pages/DailyEvent")),
    warmIslandSceneConfig(1),
    ...DAILY_EVENT_STATIC_IMAGES.map((url) => warmImageAsset(url)),
    ...DAILY_EVENT_STATIC_FETCHES.map((url) => warmFetchAsset(url)),
  ];
  warmVideoAsset(folhasTransicaoVideo);
  warmVideoAsset(loadoutMenuAnimationVideo);
  return Promise.allSettled(tasks);
}

export function warmDailyEventSceneAssets(sceneConfig) {
  const sceneUrls = collectSceneUrls(sceneConfig);
  sceneUrls.videos.forEach((url) => warmVideoAsset(url));
  return Promise.allSettled([
    ...sceneUrls.images.map((url) => warmImageAsset(url)),
    ...sceneUrls.fetches.map((url) => warmFetchAsset(url)),
  ]);
}

export const DAILY_EVENT_BOOT_VIDEO_URLS = [folhasTransicaoVideo, loadoutMenuAnimationVideo];
