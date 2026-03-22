import React from "react";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import CollectionOverviewPanel from "@/components/game/CollectionOverviewPanel";
import KeyRankingOverlay from "@/components/game/KeyRankingOverlay";
import MapStorePanel from "@/components/game/MapStorePanel";
import RunnerStatusCompact from "@/components/game/RunnerStatusCompact";
import { resolveRunnerResultRewards } from "@/game/runner/rewards/runnerRewardResolver";
import { buildKeyRankingSnapshot } from "@/game/progression/keyRankingService";
import {
  consumeInventorySelectedConsumable,
  applyInventoryWalletDelta,
  applyInventoryXpGain,
  buildCollectionSnapshot,
  buildProgressionSnapshot,
  buildStoreCatalogSnapshot,
  loadPlayerInventory,
  purchaseStoreItem,
  savePlayerInventory,
  syncInventoryEquippedPerks,
  syncInventoryEquippedWardrobeItem,
  syncInventorySelectedCharacter,
  syncInventorySelectedConsumable,
} from "@/game/progression/playerInventoryService";
import {
  getAllCharacterDefinitions,
  getAllConsumableDefinitions,
  getDefaultSelectedCharacterId,
  resolveUnlockedCharacterIdsByLevel,
} from "@/game/progression/playerInventoryConfig";
import { resolveRunXpReward } from "@/game/progression/levelProgressionService";
import { DEFAULT_WARDROBE_ITEMS } from "@/game/progression/wardrobeCatalogConfig";
import {
  buildWardrobeCatalogSnapshot,
  buildWardrobeStoreSection,
  normalizeWardrobeCatalogEntries,
  resolveEffectiveWardrobe,
  resolveWardrobeItemById,
} from "@/game/progression/wardrobeCatalogService";
import {
  createDefaultRunnerRuntimeState,
  createDefaultRunnerState,
  createRunnerSimulation,
} from "@/game/runner/core/RunnerSimulation";
import {
  buildRunnerMapSpecialSegments,
  updateRunnerElevatedSegments,
} from "@/game/runner/core/RunnerElevatedSystem";
import { PERK_DEFINITIONS, getDefaultEquippedPerkIds } from "@/game/runner/core/RunnerEntityDefinitions";
import { RUNNER_PERK_LOADOUT_LIMIT } from "@/game/runner/core/RunnerConstants";
import {
  copyIslandSceneConfig,
  createDefaultSceneConfig,
  loadIslandSceneConfig,
  saveIslandSceneConfig,
  uploadSceneAsset,
} from "@/lib/islandSceneConfigService";
import { warmDailyEventAppShell, warmDailyEventSceneAssets } from "@/lib/dailyEventBoot";
import {
  getSoundPrefs,
  isInteractionSoundEnabled,
  isMenuSoundEnabled,
  setGameMusicEnabled,
  setGameMusicVolume,
  setInteractionSoundEnabled,
  setMenuSoundEnabled,
} from "@/lib/soundPrefs";
import { ArrowLeft, Coins, Compass, Crown, Gem, Gift, KeyRound, Plus, Settings, Shield, Shirt, Sparkles, Star, Stars, User2, WandSparkles } from "lucide-react";
import island001Video from "../../assets-para-app/jogos/ilha 001.webm";
import horizonteImage from "../../assets-para-app/jogos/horizonte.webp";
import defaultRoadChunkModelUrl from "../../assets-para-app/jogos/chunk_road_01.glb?url";
import marAnimadoVideo from "../../assets-para-app/jogos/mar animado 02.webm";
import loadoutMenuAnimationVideo from "../../assets-para-app/animaçao load menu.webm";
import playerIdleFbxUrl from "../../assets-para-app/jogos/personagem principal/PERSONAGEM IDLE.fbx?url";
import folhasTransicaoVideo from "../../assets-para-app/jogos/folhas transiçao.webm";
import ilhaCentralFundoImage from "../../assets-para-app/jogos/ilha-central-fundo.png";
import sombraDeNunvensImage from "../../assets-para-app/jogos/sombra-de-nunvens.png";
import nuvemCantoSuperiorEsquerdoImage from "../../assets-para-app/jogos/nuvem-canto-superior-esquerdo.png";
import nuvemCantoSuperiorDireitoImage from "../../assets-para-app/jogos/nuvem-canto-superior-direito.png";
import nuvemCantoInferiorEsquerdoImage from "../../assets-para-app/jogos/nuvem-canto-inferior--esquerdo.png";
import nuvemCantoInferiorDireitoImage from "../../assets-para-app/jogos/nuvem-canto-inferior--direito.png";
import mapAmbientMusic from "../../assets-para-app/music ambiete seleção de mapas.mp3";
import dailyEventMenuClickSound from "../../assets-para-app/Songs/Song click menu principal.mp3";
import appOpenLogoSound from "../../assets-para-app/Songs/Song logo ao abrir o jogo.mp3";
import mapLensReturnClickSound from "../../assets-para-app/Songs/Song click menu principal retorno da lente na ilha.mp3";
import gameplayMusicSound from "../../assets-para-app/Songs/Musica Durante o Jogo Gameplay.mp3";
import islandPlayButtonSound from "../../assets-para-app/Songs/Song ao apertar em jogar nas ilhas.mp3";
import resultChestOpenSound from "../../assets-para-app/Songs/Song Bau final da partida se abrindo.mp3";
import commonRewardCollectSound from "../../assets-para-app/Songs/Song Coleta coisa comum no final da partida ou de baus no lobby.mp3";
import premiumRewardCollectSound from "../../assets-para-app/Songs/Song Coleta de Bau que da mais dinheiro.mp3";
import resultCoinsBarSound from "../../assets-para-app/Songs/Song moedas indo pra barrinha no final da partida.mp3";
import resultChestTurnSound from "../../assets-para-app/Songs/Song girar bau para abrir.mp3";
import unlockIslandLevelSound from "../../assets-para-app/Songs/Song nova ilha desbloqeuada ou novo nivel da pessoa.mp3";
import moneyRainPickupSound from "../../assets-para-app/Songs/Song pegando o dinheiro jogado pelo carro.mp3";
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
import backgroundLobbyImage from "../../assets-para-app/jogos/background lobby.png";
import vegetacaoArvoreBaseImage from "../../assets-para-app/jogos/arquivo matos e rochas/arvore-game.png";
import vegetacaoArvoreRuaImage from "../../assets-para-app/jogos/arquivo matos e rochas/arvores-rua-2.png";
import vegetacaoArvoreRua3Image from "../../assets-para-app/jogos/arquivo matos e rochas/arvores-rua-3.png";
import vegetacaoArbusto001Image from "../../assets-para-app/jogos/arquivo matos e rochas/arbusto-001.png";
import vegetacaoArbusto002Image from "../../assets-para-app/jogos/arquivo matos e rochas/arbusto-002.png";
import vegetacaoArbusto003Image from "../../assets-para-app/jogos/arquivo matos e rochas/arbusto-003.png";
import vegetacaoRochaImage from "../../assets-para-app/jogos/arquivo matos e rochas/rocha-beira-da-estrada.png";
import bordaMatinho001Image from "../../assets-para-app/jogos/matinhos beira estrada/matinho-beira-estrada-001.png";
import bordaMatinho002Image from "../../assets-para-app/jogos/matinhos beira estrada/matinho-beira-estrada-002.png";
import bordaMatinhoPedra003Image from "../../assets-para-app/jogos/matinhos beira estrada/matinho-beira-estrada-com-pedra-003.png";
import bordaMatinhoPedra004Image from "../../assets-para-app/jogos/matinhos beira estrada/matinho-beira-estrada-com-pedra-004.png";
import bordaPedrinhasImage from "../../assets-para-app/jogos/matinhos beira estrada/pedrinhas-na-grama.png";
import sombraArvoreOkImage from "../../assets-para-app/jogos/sombra-arvore-ok.png";
import botaoLojaImage from "../../assets-para-app/jogos/botoes menus/botao-loja.png";
import botaoIlhasImage from "../../assets-para-app/jogos/botoes menus/botao-ilhas.png";
import botaoColecaoImage from "../../assets-para-app/jogos/botoes menus/botao-colecao.png";
import botaoCacadoresImage from "../../assets-para-app/jogos/botoes menus/botao-caçadores.png";
import notificacaoIconeImage from "../../assets-para-app/jogos/botoes menus/notificação-icone.png";
import rodapeMenuBackgroundFundoPrincipalImage from "../../assets-para-app/jogos/botoes menus/rodape-menu-background-fundo-principal.png";
import binocularLensOverlayImage from "../../assets-para-app/binoculos-de-uma-lente.png";

const loadRunner3DSceneModule = () => import("@/components/game/Runner3DScene");
const Runner3DScene = React.lazy(loadRunner3DSceneModule);
const ProceduralModelEditor = React.lazy(() => import("@/components/game/ProceduralModelEditor"));

const DEFAULT_MAP_ISLANDS = [
  { id: 0, day: 1, name: "Coral", x: 0.08, y: 0.62, locked: false, artKey: "island001", imageUrl: "" },
  { id: 1, day: 2, name: "Brisa", x: 0.24, y: 0.56, locked: true, artKey: "island002", imageUrl: "" },
  { id: 2, day: 3, name: "Rubi", x: 0.4, y: 0.61, locked: true, artKey: "island003", imageUrl: "" },
  { id: 3, day: 4, name: "Neblina", x: 0.56, y: 0.54, locked: true, artKey: "island004", imageUrl: "" },
  { id: 4, day: 5, name: "Lunar", x: 0.72, y: 0.59, locked: true, artKey: "", imageUrl: "" },
  { id: 5, day: 6, name: "Prisma", x: 0.86, y: 0.53, locked: true, artKey: "", imageUrl: "" },
  { id: 6, day: 7, name: "Coroa", x: 0.96, y: 0.6, locked: true, artKey: "", imageUrl: "" },
];

const DAILY_UNLOCK_START = new Date("2026-03-01T00:00:00");
const ENABLE_SEA_VIDEO = false;
const DEFAULT_RUNNER_CONFIG = {
  speed_start: 0.82,
  speed_cap: 2.3,
  speed_ramp_ms: 65000,
  block_spawn_min_ms: 130,
  block_spawn_max_ms: 600,
  obstacle_spawn_min_ms: 760,
  obstacle_spawn_max_ms: 1600,
  chest_base: 5,
  chest_gain_daily: 1.9,
  chest_gain_regular: 1.4,
};
const RUNNER_VIEW_Z_SCALE = 17;
const RUNNER_WORLD_FLOW_SCALE = 17;
const ROAD_EVENT_START_Z_MIN = -5000;
const ROAD_EVENT_START_Z_MAX = 200;
const RUNNER_MONEY_PICKUP_AUDIO_SLICE_SEC = 0.12;
const RUNNER_MONEY_PICKUP_MAX_SIMULTANEOUS = 6;
const RESULT_CHEST_TAPS_TO_OPEN = 7;
const REWARD_GALLERY_STORAGE_PREFIX = "daily-event-reward-gallery";
const RUNNER_GRAPHICS_SETTINGS_STORAGE_PREFIX = "daily-event-runner-graphics";
const MAP_ISLANDS_STORAGE_PREFIX = "daily-event-map-islands";
const STABLE_EMPTY_ARRAY = Object.freeze([]);
const MAP_BOTTOM_MENU_ITEMS = [
  { id: "store", label: "Loja", icon: botaoLojaImage, accent: "from-amber-300 via-orange-400 to-rose-500" },
  { id: "collection", label: "Colecao", icon: botaoColecaoImage, accent: "from-cyan-300 via-sky-400 to-blue-500" },
  { id: "islands", label: "Ilhas", icon: botaoIlhasImage, accent: "from-emerald-300 via-cyan-400 to-sky-500", center: true },
  { id: "hunters", label: "Cacadores", icon: botaoCacadoresImage, accent: "from-fuchsia-300 via-violet-400 to-indigo-500" },
];
const MAP_FULL_SCREEN_MENU_ITEMS = [
  ...MAP_BOTTOM_MENU_ITEMS.filter((item) => item.id !== "islands"),
  {
    id: "alerts",
    label: "Alertas",
    icon: notificacaoIconeImage,
    accent: "from-rose-300 via-orange-300 to-amber-400",
  },
];
const MAP_FULL_SCREEN_MENU_ORDER = ["islands", ...MAP_FULL_SCREEN_MENU_ITEMS.map((item) => item.id)];
const MAP_MENU_ATMOSPHERE_PARTICLES = [
  { id: "p1", x: "12%", y: "16%", size: 4, duration: 4.6, delay: 0.2, color: "rgba(250,255,176,0.9)" },
  { id: "p2", x: "24%", y: "22%", size: 3, duration: 5.2, delay: 1.1, color: "rgba(214,255,164,0.9)" },
  { id: "p3", x: "79%", y: "18%", size: 4, duration: 4.9, delay: 0.6, color: "rgba(255,244,168,0.92)" },
  { id: "p4", x: "88%", y: "24%", size: 3, duration: 5.8, delay: 1.7, color: "rgba(209,255,182,0.88)" },
  { id: "p5", x: "18%", y: "78%", size: 4, duration: 5.1, delay: 1.4, color: "rgba(250,240,152,0.88)" },
  { id: "p6", x: "31%", y: "84%", size: 3, duration: 5.6, delay: 0.9, color: "rgba(216,255,174,0.86)" },
  { id: "p7", x: "67%", y: "80%", size: 4, duration: 4.7, delay: 0.4, color: "rgba(255,246,162,0.9)" },
  { id: "p8", x: "84%", y: "86%", size: 3, duration: 5.4, delay: 2.2, color: "rgba(220,255,190,0.86)" },
];
const MAP_MENU_POPUP_COPY = {
  store: {
    eyebrow: "Loja da expedição",
    title: "Pacotes para acelerar sua corrida",
    description: "Ofertas com visual de mobile game para equipar melhor cada incursao nas ilhas.",
    chips: ["Passe premium", "Boosters", "Visuais raros"],
    cards: [
      { title: "Kit de largada", meta: "750 moedas", body: "Caixa surpresa, dobro de chuva de moedas e skin brilhante por tempo limitado." },
      { title: "Loja do dia", meta: "Oferta relampago", body: "Pacote rotativo com desconto forte para empurrar o jogador para mais uma corrida." },
    ],
    action: "Ver ofertas",
  },
  collection: {
    eyebrow: "Colecao",
    title: "Album de recompensas e relicas",
    description: "Espaco para mostrar drops, skins e trofeus com clima de colecao premium.",
    chips: ["Skins", "Relicarios", "Baus"],
    cards: [
      { title: "Galeria de itens", meta: "82% completa", body: "Mostra tudo que o jogador ja desbloqueou e o que ainda falta nas ilhas futuras." },
      { title: "Estante rara", meta: "4 lendarios", body: "Sessao especial para recompensas com acabamento mais chamativo e showcase bonito." },
    ],
    action: "Abrir colecao",
  },
  hunters: {
    eyebrow: "Cacadores",
    title: "Liga dos cacadores da temporada",
    description: "Ranking, duelos e metas cooperativas para a camada social do mapa das ilhas.",
    chips: ["Ranking", "Clans", "Bounties"],
    cards: [
      { title: "Top da semana", meta: "#12 global", body: "Quadro de lideres com recompensa progressiva por colocacao." },
      { title: "Caca especial", meta: "Boss de coral", body: "Evento para enfrentar uma trilha exclusiva e buscar um drop tematico." },
    ],
    action: "Ver temporada",
  },
  alerts: {
    eyebrow: "Central",
    title: "Alertas, presentes e recados",
    description: "Caixa de mensagens de jogo com notificacoes de evento, energia e premios prontos para resgate.",
    chips: ["Eventos", "Inbox", "Presentes"],
    cards: [
      { title: "Presente diario", meta: "Disponivel agora", body: "Notifica o jogador sobre recompensa gratis para puxar o retorno diario." },
      { title: "Evento da ilha", meta: "Termina em 3h", body: "Banner curto com urgencia e CTA para voltar a correr antes do fim." },
    ],
    action: "Abrir caixa",
  },
};
const REWARD_RARITY_META = {
  common: {
    label: "Comum",
    accent: "from-slate-400 via-slate-300 to-slate-500",
    chip: "border-white/15 bg-white/8 text-slate-100",
    icon: "Caixa",
    emoji: "📦",
  },
  rare: {
    label: "Raro",
    accent: "from-cyan-300 via-sky-400 to-blue-500",
    chip: "border-cyan-200/30 bg-cyan-300/12 text-cyan-100",
    icon: "Cristal",
    emoji: "💎",
  },
  epic: {
    label: "Epico",
    accent: "from-fuchsia-300 via-pink-400 to-rose-500",
    chip: "border-fuchsia-200/30 bg-fuchsia-300/12 text-fuchsia-100",
    icon: "Relicario",
    emoji: "🪄",
  },
  legendary: {
    label: "Lendario",
    accent: "from-amber-200 via-yellow-400 to-orange-500",
    chip: "border-amber-200/30 bg-amber-300/12 text-amber-100",
    icon: "Tesouro",
    emoji: "👑",
  },
};
const DEFAULT_SCENE_LIGHTING = {
  exposure: 1.08,
  ambientIntensity: 0.72,
  hemisphereIntensity: 0.68,
  keyIntensity: 0.95,
  fillIntensity: 0.52,
  rimIntensity: 0.42,
  saturation: 1.08,
  contrast: 1.02,
  brightness: 1,
};
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
const GRAPHICS_PRESET_LIBRARY = {
  battery: {
    id: "battery",
    label: "Economico",
    description: "Para celular muito fraco ou aquecendo.",
    fpsCap: 40,
    imageQuality: 0.8,
    antiAlias: "off",
    detailLevel: "low",
  },
  balanced: {
    id: "balanced",
    label: "Balanceado",
    description: "Padrao seguro para a maioria dos celulares.",
    fpsCap: 45,
    imageQuality: 1,
    antiAlias: "auto",
    detailLevel: "medium",
  },
  high: {
    id: "high",
    label: "Alto",
    description: "Mais bonito sem ir para o extremo.",
    fpsCap: 60,
    imageQuality: 1.12,
    antiAlias: "on",
    detailLevel: "high",
  },
  max: {
    id: "max",
    label: "Maximo",
    description: "Prioriza visual e fps alto para aparelho forte.",
    fpsCap: 90,
    imageQuality: 1.25,
    antiAlias: "on",
    detailLevel: "maximum",
  },
};
const DEFAULT_GRAPHICS_SETTINGS = { ...GRAPHICS_PRESET_LIBRARY.balanced };
const LOADOUT_CHARACTERS = getAllCharacterDefinitions();
const LOADOUT_SKINS = DEFAULT_WARDROBE_ITEMS.map((item) => ({
  id: item.id,
  name: item.label,
  description: item.description,
  accent: item.accent,
  rarity: item.rarity,
}));
const LOADOUT_ITEMS = [
  {
    id: "magnet",
    name: "Imã de moedas",
    description: "Atrai moedas próximas por alguns segundos.",
    badge: "Util",
    level: 2,
  },
  {
    id: "dash_board",
    name: "Prancha turbo",
    description: "Segura um erro e mantém a corrida viva.",
    badge: "Defesa",
    level: 1,
  },
  {
    id: "lucky_charm",
    name: "Amuleto do bau",
    description: "Aumenta levemente a chance de bau raro.",
    badge: "Drop",
    level: 3,
  },
];
const sanitizeFixedSceneOverride = (key, value) => {
  if (!value || typeof value !== "object") return {};
  const next = {
    ...value,
    texture_url: isSceneAssetUrlCandidate(value?.texture_url) ? String(value.texture_url).trim() : "",
    model_url: isSceneAssetUrlCandidate(value?.model_url) ? String(value.model_url).trim() : "",
  };
  if (String(key || "") === "player") {
    delete next.x;
    delete next.y;
    delete next.z;
    delete next.rotation_x;
    delete next.rotation_y;
    delete next.rotation_z;
    delete next.scale;
    delete next.scale_x;
    delete next.scale_y;
    delete next.scale_z;
    next.hidden = false;
  }
  return next;
};
const DEFAULT_LOADOUT_CAMERA_RIG = Object.freeze({
  cameraX: 0,
  cameraYOffset: 0.74,
  cameraZ: -6.95,
  targetX: 0,
  targetYOffset: 2.54,
  targetZ: -9.28,
});
const normalizeLoadoutCameraRig = (value) => {
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
};
const normalizeLoadoutHorizonDraft = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const clamp = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    z: clamp(source.z, 0, -80, 40),
    y: clamp(source.y, 0, -20, 20),
    scale: clamp(source.scale, 1, 0.45, 2.2),
    horizon_curve_side: clamp(source.horizon_curve_side ?? source.curve_side, 12, -42, 42),
    horizon_curve_down: clamp(source.horizon_curve_down ?? source.curve_down, 3.2, -18, 22),
  };
};
const WARDROBE_SLOT_DEFS = Object.freeze([
  { key: "head", label: "Cabeca" },
  { key: "top", label: "Tronco" },
  { key: "bottom", label: "Pernas" },
  { key: "shoes", label: "Pes" },
  { key: "hands", label: "Maos" },
  { key: "back", label: "Costas" },
  { key: "accessory", label: "Acessorio" },
]);
const WARDROBE_AUTO_RIG_SLOT_KEYS = new Set(["top", "bottom", "shoes", "hands"]);
const supportsWardrobeAutoRig = (slotKey) => WARDROBE_AUTO_RIG_SLOT_KEYS.has(String(slotKey || "").trim().toLowerCase());
const createEmptyLoadoutWardrobe = () => ({
  library: [],
  equipped: {},
  presets: [],
});
const normalizeWardrobeTransform = (value) => {
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
};
const normalizeLoadoutWardrobe = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const library = (Array.isArray(source.library) ? source.library : [])
    .map((item, index) => {
      const slot = String(item?.slot || "").trim().toLowerCase();
      if (!WARDROBE_SLOT_DEFS.some((entry) => entry.key === slot)) return null;
      const modelUrl = String(item?.model_url || item?.modelUrl || "").trim();
      return {
        id: String(item?.id || `wardrobe_${slot}_${index}`),
        name: String(item?.name || `Peca ${index + 1}`),
        slot,
        model_url: modelUrl,
        transform: normalizeWardrobeTransform(item?.transform),
        auto_rig: supportsWardrobeAutoRig(slot) && !!item?.auto_rig,
        diagnostics: item?.diagnostics && typeof item.diagnostics === "object"
          ? {
              format: String(item.diagnostics.format || ""),
              meshCount: Math.max(0, Math.floor(Number(item.diagnostics.meshCount) || 0)),
              skinnedMeshCount: Math.max(0, Math.floor(Number(item.diagnostics.skinnedMeshCount) || 0)),
              boneCount: Math.max(0, Math.floor(Number(item.diagnostics.boneCount) || 0)),
              animationCount: Math.max(0, Math.floor(Number(item.diagnostics.animationCount) || 0)),
              isSkinned: !!item.diagnostics.isSkinned,
              status: String(item.diagnostics.status || ""),
              reason: String(item.diagnostics.reason || ""),
              sampleBones: Array.isArray(item.diagnostics.sampleBones)
                ? item.diagnostics.sampleBones.map((bone) => String(bone || "")).filter(Boolean).slice(0, 12)
                : [],
            }
          : null,
      };
    })
    .filter(Boolean);
  const equippedSource = source.equipped && typeof source.equipped === "object" ? source.equipped : {};
  const equipped = {};
  WARDROBE_SLOT_DEFS.forEach(({ key }) => {
    const raw = equippedSource[key];
    if (!raw || typeof raw !== "object") return;
    const itemId = String(raw.itemId || "").trim();
    equipped[key] = {
      itemId,
      transform: normalizeWardrobeTransform(raw.transform),
    };
  });
  const presets = (Array.isArray(source.presets) ? source.presets : [])
    .map((item, index) => ({
      id: String(item?.id || `preset_${index}`),
      name: String(item?.name || `Preset ${index + 1}`),
      equipped: normalizeLoadoutWardrobe({ equipped: item?.equipped }).equipped,
    }))
    .filter((item) => item.name);
  return { library, equipped, presets };
};
const DEFAULT_THEME = {
  sky_top: "#0f172a",
  sky_glow: "rgba(56,189,248,0.22)",
  road_from: "rgba(71,85,105,0.7)",
  road_to: "rgba(15,23,42,0.9)",
  player: "rgba(103,232,249,0.92)",
  block: "rgba(52,211,153,0.88)",
  obstacle: "rgba(244,63,94,0.78)",
};
const RUNNER_VEGETATION_TEXTURES = [
  vegetacaoArvoreBaseImage,
  vegetacaoArvoreRuaImage,
  vegetacaoArvoreRua3Image,
  vegetacaoArbusto001Image,
  vegetacaoArbusto002Image,
  vegetacaoArbusto003Image,
  vegetacaoRochaImage,
];
const RUNNER_EDGE_VEGETATION_TEXTURES = [
  bordaMatinho001Image,
  bordaMatinho002Image,
  bordaMatinhoPedra003Image,
  bordaMatinhoPedra004Image,
  bordaPedrinhasImage,
];

const LoadoutSelectionPanel = React.memo(function LoadoutSelectionPanel({
  loadoutTab,
  setLoadoutTab,
  centerLoadoutCarouselItem,
  handleDragScrollablePointerDown,
  handleDragScrollableClickCapture,
  loadoutBackpackItems,
  loadoutCharacters,
  alternateLoadoutCharacter,
  selectedCharacterId,
  playerGameLevel,
  handleSelectLoadoutCharacter,
  selectedWardrobeSlot,
  setSelectedWardrobeSlot,
  loadoutSkins,
  selectedSkinId,
  handleSelectLoadoutSkin,
  selectedBackpackItem,
  handleSelectLoadoutBackpack,
  loadoutConsumables,
  selectedConsumableId,
  selectedConsumable,
  handleSelectConsumable,
  availablePerks,
  equippedPerkIds,
  selectedPerkId,
  setSelectedPerkId,
  selectedPerk,
  toggleEquippedPerk,
  perkLoadoutLimit,
  selectedSkin,
  startChallengeIntro,
}) {
  const equippedPerkCount = Array.isArray(equippedPerkIds) ? equippedPerkIds.length : 0;
  const skinCategoryOptions = React.useMemo(
    () => [
      { key: "preset", label: "Conjunto" },
      { key: "head", label: "Chapeu" },
      { key: "top", label: "Camisa" },
      { key: "bottom", label: "Calca" },
      { key: "shoes", label: "Sapato" },
      { key: "hands", label: "Luvas" },
      { key: "back", label: "Mochila" },
      { key: "accessory", label: "Acessorio" },
    ],
    []
  );
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-transparent px-3 pb-3 pt-2">
      <div
        data-loadout-scroller="true"
        className="mb-3 flex cursor-grab items-center gap-2 overflow-x-auto pb-1 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-y pinch-zoom" }}
        onPointerDown={(event) => handleDragScrollablePointerDown(event, "x")}
        onClickCapture={handleDragScrollableClickCapture}
      >
        {[
          { key: "character", label: "Personagem", icon: User2 },
          { key: "skins", label: "Skins", icon: Shirt },
          { key: "items", label: "Itens", icon: Shield },
          { key: "powers", label: "Perks", icon: WandSparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = loadoutTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={(event) => {
                setLoadoutTab(tab.key);
                centerLoadoutCarouselItem(event.currentTarget);
              }}
              className={`flex min-w-[5.7rem] items-center justify-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transform-gpu transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] ${
                active
                  ? "border-cyan-300 bg-cyan-400/14 text-white shadow-[0_10px_24px_rgba(34,211,238,0.12)]"
                  : "border-white/10 bg-black/16 text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        data-loadout-scroller="true"
        className="mb-4 cursor-grab overflow-x-auto pb-1 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-y pinch-zoom" }}
        onPointerDown={(event) => handleDragScrollablePointerDown(event, "x")}
        onClickCapture={handleDragScrollableClickCapture}
      >
        {loadoutTab === "skins" ? (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                Galeria de roupas
              </span>
              <button
                type="button"
                onClick={(event) => {
                  if (!alternateLoadoutCharacter?.unlocked) return;
                  handleSelectLoadoutCharacter(alternateLoadoutCharacter.id);
                  centerLoadoutCarouselItem(event.currentTarget);
                }}
                disabled={!alternateLoadoutCharacter?.unlocked}
                className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] ${
                  alternateLoadoutCharacter?.id === selectedCharacterId
                    ? "border-cyan-300 bg-cyan-400/16 text-white shadow-[0_10px_24px_rgba(34,211,238,0.12)]"
                    : alternateLoadoutCharacter?.unlocked
                      ? "border-white/10 bg-black/18 text-cyan-100"
                      : "border-white/10 bg-black/18 text-slate-500"
                }`}
              >
                {alternateLoadoutCharacter?.unlocked ? `Ver ${alternateLoadoutCharacter.name}` : `Nivel ${alternateLoadoutCharacter?.unlockLevel || playerGameLevel}`}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {skinCategoryOptions.map((slot) => {
                const active = selectedWardrobeSlot === slot.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setSelectedWardrobeSlot(slot.key)}
                    className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                      active
                        ? "border-cyan-300 bg-cyan-400/14 text-white"
                        : "border-white/10 bg-black/16 text-slate-300"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
            {selectedWardrobeSlot === "back" && loadoutBackpackItems.length === 0 ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-black/18 px-4 py-3 text-[11px] text-slate-300">
                Nenhuma mochila publicada ainda para esse personagem.
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-3">
          {loadoutTab === "character"
            ? loadoutCharacters.map((character) => {
                const active = selectedCharacterId === character.id;
                const locked = !character.unlocked;
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={(event) => {
                      if (locked) return;
                      handleSelectLoadoutCharacter(character.id);
                      centerLoadoutCarouselItem(event.currentTarget);
                    }}
                    className={`w-[14.5rem] shrink-0 rounded-[1.6rem] bg-gradient-to-br ${character.accent} p-[1px] text-left transform-gpu transition-transform duration-200 ease-out active:scale-[0.985] ${locked ? "opacity-75" : ""}`}
                  >
                    <div className="rounded-[1.55rem] bg-black/30 p-4 transition-colors duration-200">
                      <p className="text-lg font-black text-white">{character.name}</p>
                      <p className="mt-1 text-[12px] leading-4 text-slate-300">{character.shortDescription || character.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                          {character.chip}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                          {locked ? `Nivel ${character.unlockLevel}` : active ? "Selecionado" : "Escolher"}
                        </span>
                      </div>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/85">
                        {character.passiveBonus}
                      </p>
                      {locked ? (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Desbloqueia no nivel {character.unlockLevel}. Atual: nivel {playerGameLevel}.
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })
            : null}

          {loadoutTab === "skins"
            ? loadoutSkins.map((skin) => {
                const active = selectedSkinId === skin.id;
                const locked = !skin.owned;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={(event) => {
                      if (locked) return;
                      handleSelectLoadoutSkin(skin.id);
                      centerLoadoutCarouselItem(event.currentTarget);
                    }}
                    className={`w-[14.5rem] shrink-0 rounded-[1.6rem] bg-gradient-to-br ${skin.accent} p-[1px] text-left transform-gpu transition-transform duration-200 ease-out active:scale-[0.985] ${locked ? "opacity-75" : ""}`}
                  >
                    <div className="rounded-[1.55rem] bg-black/30 p-4 transition-colors duration-200">
                      <p className="text-lg font-black text-white">{skin.name || skin.label}</p>
                      <p className="mt-1 text-[12px] leading-4 text-slate-300">{skin.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                          {skin.rarity}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                          {locked ? "Bloqueada" : active ? "Ativa" : "Usar"}
                        </span>
                      </div>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/85">
                        {skin.source === "dev_wardrobe" ? "Wardrobe Studio" : skin.source === "store" ? "Loja" : "Base"}
                      </p>
                      {locked ? (
                        <p className="mt-1 text-[10px] text-slate-400">
                          {skin.unlockLevel > playerGameLevel ? `Nivel ${skin.unlockLevel} necessario.` : "Item ainda nao possuido."}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })
            : null}

          {loadoutTab === "items"
            ? [
                {
                  id: "",
                  name: "Sem consumivel",
                  description: "Entrar na run sem item ativo de pre-run.",
                  badge: "Livre",
                  amount: 0,
                  available: true,
                },
                ...loadoutConsumables,
              ].map((item) => {
                const active = selectedConsumableId === item.id;
                const available = item.id === "" || item.available;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      handleSelectConsumable(item.id);
                      centerLoadoutCarouselItem(event.currentTarget);
                    }}
                    disabled={!available}
                    className={`w-[14.5rem] shrink-0 rounded-[1.6rem] border p-4 text-left transform-gpu transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out active:scale-[0.985] ${
                      active
                        ? "border-emerald-300/60 bg-emerald-500/10 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                        : available
                          ? "border-white/10 bg-black/16"
                          : "border-white/10 bg-black/10 opacity-55"
                    }`}
                  >
                    <p className="text-lg font-black text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] leading-4 text-slate-300">{item.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                        {item.badge}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                        {item.id === "" ? "Opcional" : `Estoque ${item.amount}`}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                      {active ? "Equipado" : available ? "Toque para equipar" : "Sem estoque"}
                    </p>
                  </button>
                );
              })
            : null}

          {loadoutTab === "powers"
            ? availablePerks.map((perk) => {
                const selected = selectedPerkId === perk.id;
                const equipped = equippedPerkIds.includes(perk.id);
                return (
                  <button
                    key={perk.id}
                    type="button"
                    onClick={(event) => {
                      setSelectedPerkId(perk.id);
                      toggleEquippedPerk(perk.id);
                      centerLoadoutCarouselItem(event.currentTarget);
                    }}
                    className={`w-[14.5rem] shrink-0 rounded-[1.6rem] bg-gradient-to-br ${perk.tone} p-[1px] text-left transform-gpu transition-transform duration-200 ease-out active:scale-[0.985]`}
                  >
                    <div className={`rounded-[1.55rem] p-4 transition-colors duration-200 ${selected ? "bg-black/26" : "bg-black/30"}`}>
                      <p className="text-lg font-black text-white">{perk.name}</p>
                      <p className="mt-1 text-[12px] leading-4 text-slate-300">{perk.description}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                          {perk.badge}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                          {equipped
                            ? equippedPerkCount === 1
                              ? "Minimo 1"
                              : "Equipado"
                            : equippedPerkCount >= perkLoadoutLimit
                              ? "Slot cheio"
                              : "Disponivel"}
                        </span>
                      </div>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        {equipped
                          ? equippedPerkCount === 1
                            ? "Um perk sempre ativo"
                            : "Toque para remover"
                          : "Toque para equipar"}
                      </p>
                    </div>
                  </button>
                );
              })
            : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 rounded-[1.4rem] border border-white/10 bg-black/18 px-3 py-3">
          <p className="truncate text-sm font-black text-white">{selectedPerk.name}</p>
          <p className="truncate text-[11px] text-slate-300">
            {equippedPerkCount}/{perkLoadoutLimit} perks • {selectedConsumable.name} • {selectedSkin.name || selectedSkin.label}
          </p>
        </div>
        <Button className="h-14 shrink-0 rounded-[1.4rem] bg-cyan-400 px-5 text-base font-black text-slate-950 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-cyan-300 active:scale-[0.97] active:shadow-[0_10px_24px_rgba(34,211,238,0.22)]" onClick={startChallengeIntro}>
          Jogar
        </Button>
      </div>
    </div>
  );
});
const DEV_ELEMENT_LIBRARY = [
  vegetacaoArvoreBaseImage,
  vegetacaoArvoreRuaImage,
  vegetacaoArvoreRua3Image,
  vegetacaoArbusto001Image,
  vegetacaoArbusto002Image,
  vegetacaoArbusto003Image,
  bordaMatinho001Image,
  bordaMatinho002Image,
  bordaMatinhoPedra003Image,
  bordaMatinhoPedra004Image,
  bordaPedrinhasImage,
];
const DEV_ELIMINATORY_LIBRARY = [vegetacaoRochaImage];
const MODELER_MODEL_TOOLS = [
  { key: "move", label: "Mover" },
  { key: "vertex", label: "Vertice" },
];
const MODELER_SCULPT_BRUSHES = [
  { key: "sculpt", label: "Draw" },
  { key: "draw_sharp", label: "Draw Sharp" },
  { key: "clay", label: "Clay" },
  { key: "clay_strips", label: "Clay Strips" },
  { key: "flatten", label: "Flatten" },
  { key: "fill", label: "Fill" },
  { key: "scrape", label: "Scrape" },
  { key: "smooth", label: "Smooth" },
  { key: "inflate", label: "Inflate" },
  { key: "blob", label: "Blob" },
  { key: "pinch", label: "Pinch" },
  { key: "crease", label: "Crease" },
  { key: "relax", label: "Relax" },
  { key: "paint", label: "Paint" },
];
const MODELER_BRUSH_LABELS = MODELER_SCULPT_BRUSHES.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

function getDailyProgress(totalIslands) {
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, Math.floor((today.getTime() - DAILY_UNLOCK_START.getTime()) / dayMs));
  const unlockedCount = Math.max(1, Math.min(totalIslands, elapsed + 1));
  const featuredId = unlockedCount < totalIslands ? unlockedCount - 1 : elapsed % totalIslands;
  return { unlockedCount, featuredId };
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const min = String(Math.floor(safe / 60)).padStart(2, "0");
  const sec = String(safe % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

const RUNNER_BEST_TIME_STORAGE_PREFIX = "souza_runner_best_time_v1:";

function getRunnerBestTimeStorageKey(islandId) {
  return `${RUNNER_BEST_TIME_STORAGE_PREFIX}${String(islandId || "default")}`;
}

function readRunnerBestTimeMs(islandId) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = Number(window.localStorage.getItem(getRunnerBestTimeStorageKey(islandId)));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function writeRunnerBestTimeMs(islandId, elapsedMs) {
  if (typeof window === "undefined") return;
  try {
    const safe = Math.max(0, Math.round(Number(elapsedMs) || 0));
    window.localStorage.setItem(getRunnerBestTimeStorageKey(islandId), String(safe));
  } catch {
    // noop
  }
}

function getMidpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function getDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function getRewardGalleryStorageKey(userId) {
  return `${REWARD_GALLERY_STORAGE_PREFIX}:${String(userId || "guest")}`;
}

function getRunnerGraphicsSettingsStorageKey(userId) {
  return `${RUNNER_GRAPHICS_SETTINGS_STORAGE_PREFIX}:${String(userId || "guest")}`;
}

function getMapIslandsStorageKey(userId) {
  return `${MAP_ISLANDS_STORAGE_PREFIX}:${String(userId || "guest")}`;
}

function normalizeMapIsland(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const clamp = (value, fallback, min, max) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    id: index,
    day: index + 1,
    name: String(src.name || `Ilha ${index + 1}`).trim() || `Ilha ${index + 1}`,
    x: clamp(src.x, DEFAULT_MAP_ISLANDS[index]?.x ?? 0.12 + index * 0.12, 0.02, 0.98),
    y: clamp(src.y, DEFAULT_MAP_ISLANDS[index]?.y ?? 0.58, 0.18, 0.82),
    locked: index === 0 ? false : !!src.locked,
    artKey: String(src.artKey || DEFAULT_MAP_ISLANDS[index]?.artKey || "").trim(),
    imageUrl: String(src.imageUrl || "").trim(),
  };
}

function normalizeMapIslands(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_MAP_ISLANDS;
  return source.map((item, index) => normalizeMapIsland(item, index));
}

function loadMapIslands(userId) {
  if (typeof window === "undefined") return normalizeMapIslands(DEFAULT_MAP_ISLANDS);
  try {
    const raw = window.localStorage.getItem(getMapIslandsStorageKey(userId));
    if (!raw) return normalizeMapIslands(DEFAULT_MAP_ISLANDS);
    const parsed = JSON.parse(raw);
    return normalizeMapIslands(parsed);
  } catch {
    return normalizeMapIslands(DEFAULT_MAP_ISLANDS);
  }
}

function getMapIslandMediaCacheKey(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  return resolveAssetUrl(raw);
}

function normalizeSceneLightingDraft(value) {
  const src = value && typeof value === "object" ? value : {};
  const clampNum = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    exposure: clampNum(src.exposure, DEFAULT_SCENE_LIGHTING.exposure, 0.4, 2.2),
    ambientIntensity: clampNum(src.ambientIntensity, DEFAULT_SCENE_LIGHTING.ambientIntensity, 0, 3),
    hemisphereIntensity: clampNum(src.hemisphereIntensity, DEFAULT_SCENE_LIGHTING.hemisphereIntensity, 0, 3),
    keyIntensity: clampNum(src.keyIntensity, DEFAULT_SCENE_LIGHTING.keyIntensity, 0, 3),
    fillIntensity: clampNum(src.fillIntensity, DEFAULT_SCENE_LIGHTING.fillIntensity, 0, 3),
    rimIntensity: clampNum(src.rimIntensity, DEFAULT_SCENE_LIGHTING.rimIntensity, 0, 3),
    saturation: clampNum(src.saturation, DEFAULT_SCENE_LIGHTING.saturation, 0.2, 2.2),
    contrast: clampNum(src.contrast, DEFAULT_SCENE_LIGHTING.contrast, 0.4, 2),
    brightness: clampNum(src.brightness, DEFAULT_SCENE_LIGHTING.brightness, 0.4, 1.8),
  };
}

function normalizeSceneRenderDraft(value) {
  const src = value && typeof value === "object" ? value : {};
  const clampDistance = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  const clampPosition = (raw, fallback, min, max) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };
  return {
    masterDistance: clampDistance(src.masterDistance, DEFAULT_SCENE_RENDER.masterDistance, 10, 260),
    vegetationDistance: clampDistance(src.vegetationDistance, DEFAULT_SCENE_RENDER.vegetationDistance, 10, 260),
    roadDistance: clampDistance(src.roadDistance, DEFAULT_SCENE_RENDER.roadDistance, 10, 260),
    objectDistance: clampDistance(src.objectDistance, DEFAULT_SCENE_RENDER.objectDistance, 10, 260),
    shadowsEnabled: src.shadowsEnabled === false ? false : Boolean(src.shadowsEnabled ?? DEFAULT_SCENE_RENDER.shadowsEnabled),
    lightX: clampPosition(src.lightX, DEFAULT_SCENE_RENDER.lightX, -18, 18),
    lightY: clampPosition(src.lightY, DEFAULT_SCENE_RENDER.lightY, 2, 32),
    lightZ: clampPosition(src.lightZ, DEFAULT_SCENE_RENDER.lightZ, -28, 28),
  };
}

function normalizeRunnerGraphicsSettings(value) {
  const src = value && typeof value === "object" ? value : {};
  const requestedPresetId = String(src.presetId || src.id || DEFAULT_GRAPHICS_SETTINGS.id);
  const basePreset =
    requestedPresetId === "custom"
      ? DEFAULT_GRAPHICS_SETTINGS
      : GRAPHICS_PRESET_LIBRARY[requestedPresetId] || DEFAULT_GRAPHICS_SETTINGS;
  const antiAliasRaw = String(src.antiAlias || basePreset.antiAlias || "auto").toLowerCase();
  const detailRaw = String(src.detailLevel || basePreset.detailLevel || "medium").toLowerCase();
  const fpsRaw = Number(src.fpsCap);
  const imageQualityRaw = Number(src.imageQuality);
  return {
    presetId: requestedPresetId === "custom" ? "custom" : basePreset.id,
    label: requestedPresetId === "custom" ? "Personalizado" : basePreset.label,
    description:
      requestedPresetId === "custom"
        ? "Ajuste manual para combinar com o celular do jogador."
        : basePreset.description,
    fpsCap: Number.isFinite(fpsRaw) ? Math.max(24, Math.min(120, fpsRaw)) : basePreset.fpsCap,
    imageQuality: Number.isFinite(imageQualityRaw) ? Math.max(0.7, Math.min(1.35, imageQualityRaw)) : basePreset.imageQuality,
    antiAlias: antiAliasRaw === "off" || antiAliasRaw === "on" ? antiAliasRaw : "auto",
    detailLevel: ["low", "medium", "high", "maximum"].includes(detailRaw) ? detailRaw : basePreset.detailLevel,
  };
}

function detectInitialRunnerGraphicsPreset() {
  if (typeof window === "undefined") return DEFAULT_GRAPHICS_SETTINGS.id;
  const width = Number(window.innerWidth || 0);
  const dpr = Number(window.devicePixelRatio || 1);
  const hwThreads = Number(window.navigator?.hardwareConcurrency || 0);
  const deviceMemory = Number(window.navigator?.deviceMemory || 0);
  const isSmallViewport = width > 0 && width <= 900;
  const isStrongDevice =
    (!isSmallViewport && hwThreads >= 8) ||
    (hwThreads >= 8 && deviceMemory >= 8) ||
    (hwThreads >= 10) ||
    (deviceMemory >= 12) ||
    (dpr >= 3 && hwThreads >= 8);
  const isVeryStrongDevice =
    (hwThreads >= 10 && deviceMemory >= 8) ||
    (hwThreads >= 8 && deviceMemory >= 12 && dpr >= 3);
  if (isVeryStrongDevice) return "max";
  if (isStrongDevice) return "high";
  return "balanced";
}

function loadRunnerGraphicsSettings(userId) {
  if (typeof window === "undefined") return normalizeRunnerGraphicsSettings(DEFAULT_GRAPHICS_SETTINGS);
  try {
    const raw = window.localStorage.getItem(getRunnerGraphicsSettingsStorageKey(userId));
    if (!raw) {
      const presetId = detectInitialRunnerGraphicsPreset();
      return normalizeRunnerGraphicsSettings(GRAPHICS_PRESET_LIBRARY[presetId] || DEFAULT_GRAPHICS_SETTINGS);
    }
    return normalizeRunnerGraphicsSettings(JSON.parse(raw));
  } catch {
    return normalizeRunnerGraphicsSettings(DEFAULT_GRAPHICS_SETTINGS);
  }
}

function saveRunnerGraphicsSettings(userId, settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getRunnerGraphicsSettingsStorageKey(userId),
      JSON.stringify(normalizeRunnerGraphicsSettings(settings))
    );
  } catch {
    // Ignore quota/storage errors in local preview mode.
  }
}

function loadRewardGallery(userId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getRewardGalleryStorageKey(userId));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRewardGallery(userId, rewards) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getRewardGalleryStorageKey(userId), JSON.stringify(rewards));
  } catch {
    // Ignore quota/storage errors in local preview mode.
  }
}

function getRunnerWalletStorageKey(userId) {
  return `souza_runner_wallet_v1:${userId || "guest"}`;
}

function loadRunnerWallet(userId, fallback = {}) {
  const safeFallback = {
    coins: Math.max(1200, Number(fallback?.coins) || 0),
    diamonds: Math.max(12, Number(fallback?.diamonds) || 0),
    keys: Math.max(0, Number(fallback?.keys) || 0),
  };
  if (typeof window === "undefined") return safeFallback;
  try {
    const raw = window.localStorage.getItem(getRunnerWalletStorageKey(userId));
    if (!raw) return safeFallback;
    const parsed = JSON.parse(raw);
    return {
      coins: Math.max(0, Number(parsed?.coins) || safeFallback.coins),
      diamonds: Math.max(0, Number(parsed?.diamonds) || safeFallback.diamonds),
      keys: Math.max(0, Number(parsed?.keys) || safeFallback.keys),
    };
  } catch {
    return safeFallback;
  }
}

function saveRunnerWallet(userId, wallet) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getRunnerWalletStorageKey(userId),
      JSON.stringify({
        coins: Math.max(0, Number(wallet?.coins) || 0),
        diamonds: Math.max(0, Number(wallet?.diamonds) || 0),
        keys: Math.max(0, Number(wallet?.keys) || 0),
      })
    );
  } catch {
    // Ignore quota/storage errors in local preview mode.
  }
}

const RUNNER_PERK_LOADOUT_STORAGE_PREFIX = "souza_runner_perk_loadout_v1:";

function getRunnerPerkLoadoutStorageKey(userId) {
  return `${RUNNER_PERK_LOADOUT_STORAGE_PREFIX}${userId || "guest"}`;
}

function normalizeRunnerPerkLoadout(rawPerkIds) {
  const validIds = new Set(Object.keys(PERK_DEFINITIONS));
  const source = Array.isArray(rawPerkIds) ? rawPerkIds : [];
  const next = [];
  source.forEach((perkId) => {
    const id = String(perkId || "").trim();
    if (!id || !validIds.has(id) || next.includes(id)) return;
    if (next.length >= RUNNER_PERK_LOADOUT_LIMIT) return;
    next.push(id);
  });
  if (next.length) return next;
  return getDefaultEquippedPerkIds().slice(0, RUNNER_PERK_LOADOUT_LIMIT);
}

function loadRunnerPerkLoadout(userId) {
  const fallback = normalizeRunnerPerkLoadout(getDefaultEquippedPerkIds());
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(getRunnerPerkLoadoutStorageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizeRunnerPerkLoadout(parsed?.perkIds);
  } catch {
    return fallback;
  }
}

function saveRunnerPerkLoadout(userId, perkIds) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getRunnerPerkLoadoutStorageKey(userId),
      JSON.stringify({ perkIds: normalizeRunnerPerkLoadout(perkIds) })
    );
  } catch {
    // Ignore quota/storage errors in local preview mode.
  }
}

function getRewardRarity(score, isDaily) {
  if (score >= 160) return "legendary";
  if (score >= 110) return "epic";
  if (score >= 65 || isDaily) return "rare";
  return "common";
}

function createCollectedReward({ island, score, elapsedMs, isDaily, chestReward }) {
  const rarity = String(chestReward?.rarity || "common").toLowerCase() || getRewardRarity(score, isDaily);
  const rarityMeta = REWARD_RARITY_META[rarity] || REWARD_RARITY_META.common;
  const stars = rarity === "legendary" ? 5 : rarity === "epic" ? 4 : rarity === "rare" ? 3 : 2;
  return {
    id: `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${chestReward?.title || rarityMeta.icon} da Ilha ${island?.day || 1}`,
    subtitle: chestReward?.subtitle || (isDaily ? "Drop especial da ilha diaria" : "Recompensa do bau do runner"),
    rarity,
    stars,
    score: Number(score || 0),
    elapsedMs: Number(elapsedMs || 0),
    coins: Math.max(0, Number(chestReward?.coins) || 0),
    diamonds: Math.max(0, Number(chestReward?.diamonds) || 0),
    keys: Math.max(0, Number(chestReward?.keys) || 0),
    islandId: island?.id ?? 0,
    islandDay: island?.day ?? 1,
    islandName: island?.name || "Ilha",
    collectedAt: new Date().toISOString(),
    accent: rarityMeta.accent,
    emoji: rarityMeta.emoji,
  };
}

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function getSceneBlockId(x, z, blockSize = 8) {
  const bx = Math.floor((Number(x) || 0) / blockSize);
  const bz = Math.floor((Number(z) || 0) / blockSize);
  return `${bx}:${bz}`;
}

function getVisibleSpawnPoint() {
  return { x: 0, y: 0, z: -10 };
}

function getCurveOffsetAtZ(z, curveValue) {
  const depth = clamp01((-Number(z || 0)) / 102);
  const base = Number(curveValue || 0) * 0.054 * (0.22 + depth * depth * 1.72);
  const sWave = Math.sin(depth * Math.PI * 1.7) * Number(curveValue || 0) * 0.028;
  return base + sWave;
}
function getGroundDropAtZ(z) {
  const depth = clamp01((-Number(z || 0)) / 105);
  return -Math.pow(depth, 1.62) * 3.6;
}
function normalizeRoadSculptDraft(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
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
}
function normalizeRoadVisualDraft(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const toNum = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  return {
    modelUrl: isSceneAssetUrlCandidate(src?.modelUrl ?? src?.model_url)
      ? normalizeDefaultRoadChunkUrl(src.modelUrl ?? src.model_url)
      : DEFAULT_ROAD_CHUNK_MODEL_URL,
    roadSurfaceY: toNum(src.roadSurfaceY ?? src.road_surface_y, 0, -20, 20),
    roadModelX: toNum(src.roadModelX ?? src.road_model_x, 0, -40, 40),
    roadModelY: toNum(src.roadModelY ?? src.road_model_y, 0, -20, 20),
    roadModelZ: toNum(src.roadModelZ ?? src.road_model_z, 0, -40, 40),
    roadModelRotX: toNum(src.roadModelRotX ?? src.road_model_rot_x, 0, -180, 180),
    roadModelRotY: toNum(src.roadModelRotY ?? src.road_model_rot_y, 0, -180, 180),
    roadModelRotZ: toNum(src.roadModelRotZ ?? src.road_model_rot_z, 0, -180, 180),
    roadModelScale: toNum(src.roadModelScale ?? src.road_model_scale, 1, 0.1, 12),
    roadModelScaleX: toNum(src.roadModelScaleX ?? src.road_model_scale_x, 1, 0.1, 12),
    roadModelScaleY: toNum(src.roadModelScaleY ?? src.road_model_scale_y, 1, 0.1, 12),
    roadModelScaleZ: toNum(src.roadModelScaleZ ?? src.road_model_scale_z, 1, 0.1, 12),
    roadChunkLength: toNum(src.roadChunkLength ?? src.road_chunk_length, 0, 0, 240),
    roadRepeatEnabled:
      getCanonicalSceneAssetName(src?.modelUrl ?? src?.model_url).toLowerCase() === "chunk_road_01.glb"
        ? true
        : src.roadRepeatEnabled ?? src.road_repeat_enabled ?? true,
    outerGrassY: toNum(src.outerGrassY ?? src.outer_grass_y, 0, -20, 20),
    outerGrassWidth: toNum(src.outerGrassWidth ?? src.outer_grass_width, 24, 2, 80),
    outerGrassOffset: toNum(src.outerGrassOffset ?? src.outer_grass_offset, 22.6, 6, 90),
    proceduralEdgeEnabled: src.proceduralEdgeEnabled ?? src.procedural_edge_enabled ?? false,
    proceduralWallHeight: toNum(src.proceduralWallHeight ?? src.procedural_wall_height, 0.75, 0, 6),
    proceduralWallWidth: toNum(src.proceduralWallWidth ?? src.procedural_wall_width, 0.28, 0.05, 4),
    proceduralWallY: toNum(src.proceduralWallY ?? src.procedural_wall_y, 0, -8, 8),
    proceduralWallOffset: toNum(src.proceduralWallOffset ?? src.procedural_wall_offset, 5.09, 4.2, 20),
    proceduralWallTextureUrl: isSceneAssetUrlCandidate(src?.proceduralWallTextureUrl ?? src?.procedural_wall_texture_url)
      ? String(src.proceduralWallTextureUrl ?? src.procedural_wall_texture_url).trim()
      : "",
    proceduralGrassLift: toNum(src.proceduralGrassLift ?? src.procedural_grass_lift, 0.9, 0, 8),
    proceduralGrassWidth: toNum(src.proceduralGrassWidth ?? src.procedural_grass_width, 5.4, 0.5, 30),
    proceduralGrassOffset: toNum(src.proceduralGrassOffset ?? src.procedural_grass_offset, 8.3, 4.5, 40),
    proceduralGrassY: toNum(src.proceduralGrassY ?? src.procedural_grass_y, 0, -8, 8),
    proceduralGrassTextureUrl: isSceneAssetUrlCandidate(src?.proceduralGrassTextureUrl ?? src?.procedural_grass_texture_url)
      ? String(src.proceduralGrassTextureUrl ?? src.procedural_grass_texture_url).trim()
      : "",
  };
}
function normalizeRoadEventBlocks(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const toNum = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  return list
    .map((entry, index) => {
      const typeRaw = String(entry?.type || "curve").toLowerCase();
      const type = typeRaw === "grade" || typeRaw === "drop" || typeRaw === "curve" ? typeRaw : "curve";
      return {
        id: String(entry?.id || `evt_${index}_${Date.now()}`),
        name: String(entry?.name || (type === "curve" ? "Curva" : "Subida/Descida")),
        type,
        strength: toNum(entry?.strength, type === "curve" ? 18 : 6, -180, 180),
        startZ: toNum(entry?.startZ, -34, ROAD_EVENT_START_Z_MIN, ROAD_EVENT_START_Z_MAX),
        length: toNum(entry?.length, 24, 4, 160),
        loopEnabled: entry?.loopEnabled === true || entry?.loop_enabled === true,
        loopEverySeconds: toNum(entry?.loopEverySeconds ?? entry?.loop_every_seconds, 9, 1.5, 120),
        enabled: entry?.enabled !== false,
      };
    })
    .slice(0, 120);
}
function normalizeNewRoadEventDraft(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const typeRaw = String(src.type || "curve").toLowerCase();
  const type = typeRaw === "grade" || typeRaw === "drop" || typeRaw === "curve" ? typeRaw : "curve";
  const toNum = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  return {
    type,
    name: String(src.name || ""),
    strength: toNum(src.strength, type === "curve" ? 22 : 7, -180, 180),
    length: toNum(src.length, 26, 4, 160),
    loopEnabled: src.loopEnabled === true,
    loopEverySeconds: toNum(src.loopEverySeconds, 9, 1.5, 120),
  };
}
function normalizeOffsetsForUndo(rawOffsets) {
  const source = rawOffsets && typeof rawOffsets === "object" ? rawOffsets : {};
  const out = {};
  Object.entries(source).forEach(([idxRaw, offsetRaw]) => {
    const idx = Math.floor(Number(idxRaw));
    const offset = Number(offsetRaw);
    if (!Number.isFinite(idx) || idx < 0) return;
    if (!Number.isFinite(offset)) return;
    if (Math.abs(offset) < 0.00001) return;
    out[String(idx)] = Math.max(-40, Math.min(40, offset));
  });
  return out;
}
function normalizeVertexColorsForUndo(rawColors) {
  const source = rawColors && typeof rawColors === "object" ? rawColors : {};
  const out = {};
  Object.entries(source).forEach(([idxRaw, colorRaw]) => {
    const idx = Math.floor(Number(idxRaw));
    if (!Number.isFinite(idx) || idx < 0) return;
    let value = colorRaw;
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
function estimateProceduralPolyCountFromConfig(entry) {
  if (!entry || typeof entry !== "object") return 0;
  const primitive = String(entry.procedural_type || "box").toLowerCase();
  const toSeg = (value, fallback = 1, min = 1, max = 32) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  if (primitive === "cylinder") {
    const radial = toSeg(entry.radial_segments, 8, 3, 64);
    const heightSeg = toSeg(entry.height_segments, 1, 1, 32);
    return radial * heightSeg * 2 + radial * 2;
  }
  if (primitive === "plane") {
    const w = toSeg(entry.width_segments, 1, 1, 64);
    const h = toSeg(entry.height_segments, 1, 1, 64);
    return w * h * 2;
  }
  if (primitive === "sphere") {
    const w = toSeg(entry.width_segments, 16, 3, 64);
    const h = toSeg(entry.height_segments, 12, 2, 64);
    return w * h * 2;
  }
  const ws = toSeg(entry.width_segments, 1, 1, 64);
  const hs = toSeg(entry.height_segments, 1, 1, 64);
  const ds = toSeg(entry.depth_segments, 1, 1, 64);
  return 4 * (ws * hs + ws * ds + hs * ds);
}

function normalizeTextureSettings(rawSettings) {
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const toNum = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
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

function normalizeSideTextureSettings(rawBySide) {
  const source = rawBySide && typeof rawBySide === "object" ? rawBySide : {};
  const out = {};
  Object.entries(source).forEach(([side, settings]) => {
    const key = String(side || "").trim();
    if (!key) return;
    out[key] = normalizeTextureSettings(settings);
  });
  return out;
}

const DEV_UPLOAD_ACCEPT =
  ".png,.webp,.jpg,.jpeg,.gif,.mp4,.webm,.glb,.gltf,.fbx,.obj,.stl,image/*,video/*,model/gltf-binary,model/gltf+json,model/stl";
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

function detectAssetTypeFromName(name) {
  const safeName = String(name || "").toLowerCase();
  if (!safeName) return "image";
  if (safeName.endsWith(".webm") || safeName.endsWith(".mp4")) return "video";
  if (
    safeName.endsWith(".glb") ||
    safeName.endsWith(".gltf") ||
    safeName.endsWith(".fbx") ||
    safeName.endsWith(".obj") ||
    safeName.endsWith(".stl")
  ) {
    return "model3d";
  }
  return "image";
}

async function inspectWardrobeModelFile(file) {
  const filename = String(file?.name || "").toLowerCase();
  const objectUrl = URL.createObjectURL(file);
  const summarize = (root, animations = [], format = "") => {
    let meshCount = 0;
    let skinnedMeshCount = 0;
    const boneNames = new Set();
    root?.traverse?.((node) => {
      if (node?.isMesh) meshCount += 1;
      if (!node?.isSkinnedMesh || !node.skeleton) return;
      skinnedMeshCount += 1;
      (Array.isArray(node.skeleton.bones) ? node.skeleton.bones : []).forEach((bone) => {
        const name = String(bone?.name || "").trim();
        if (name) boneNames.add(name);
      });
    });
    const animationCount = Array.isArray(animations) ? animations.length : 0;
    const isSkinned = skinnedMeshCount > 0 && boneNames.size > 0;
    return {
      format,
      meshCount,
      skinnedMeshCount,
      boneCount: boneNames.size,
      animationCount,
      isSkinned,
      status: isSkinned ? "skinned" : "static",
      reason: isSkinned
        ? "A peca veio com skinning e bones."
        : "A peca veio como malha estatica, sem skinning utilizavel.",
      sampleBones: Array.from(boneNames).slice(0, 12),
    };
  };
  try {
    if (filename.endsWith(".fbx")) {
      const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
      const loader = new FBXLoader();
      const root = await new Promise((resolve, reject) => loader.load(objectUrl, resolve, undefined, reject));
      return summarize(root, root?.animations || [], "fbx");
    }
    if (filename.endsWith(".glb") || filename.endsWith(".gltf")) {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => loader.load(objectUrl, resolve, undefined, reject));
      return summarize(gltf?.scene || null, gltf?.animations || [], filename.endsWith(".glb") ? "glb" : "gltf");
    }
    if (filename.endsWith(".obj")) {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      const loader = new OBJLoader();
      const root = await new Promise((resolve, reject) => loader.load(objectUrl, resolve, undefined, reject));
      return summarize(root, [], "obj");
    }
    if (filename.endsWith(".stl")) {
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      const loader = new STLLoader();
      const geometry = await new Promise((resolve, reject) => loader.load(objectUrl, resolve, undefined, reject));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      return summarize(mesh, [], "stl");
    }
    return {
      format: "",
      meshCount: 0,
      skinnedMeshCount: 0,
      boneCount: 0,
      animationCount: 0,
      isSkinned: false,
      status: "unknown",
      reason: "Formato nao suportado para diagnostico.",
      sampleBones: [],
    };
  } catch {
    return {
      format: "",
      meshCount: 0,
      skinnedMeshCount: 0,
      boneCount: 0,
      animationCount: 0,
      isSkinned: false,
      status: "error",
      reason: "Nao foi possivel ler o arquivo para diagnostico.",
      sampleBones: [],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getAssetFileName(rawPath) {
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
  const base = normalized.split("/").pop() || normalized;
  return base.replace(/^\d{10,}-/, "") || base || "arquivo";
}

function getCanonicalSceneAssetName(rawPath) {
  const fileName = getAssetFileName(rawPath);
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

function isSceneAssetUrlCandidate(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return false;
  if (/[\r\n\t]/.test(value)) return false;
  if (value.length > 600) return false;
  if (/Mover|Trocar textura|Altura \+|Altura -|Auto-save|Arraste no objeto/i.test(value)) return false;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return true;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return true;
  if (normalized.startsWith("/uploads/") || normalized.startsWith("/api/uploads/")) return true;
  if (normalized.startsWith("uploads/") || normalized.startsWith("api/uploads/")) return true;
  if (normalized.startsWith("/assets/") || normalized.startsWith("assets/")) return true;
  if (normalized.startsWith("/src/") || normalized.startsWith("src/")) return true;
  if (normalized.startsWith("/@fs/")) return true;
  if (/\.(png|webp|jpg|jpeg|gif|mp4|webm|glb|gltf|fbx|obj|stl)(\?.*)?$/i.test(normalized)) return true;
  return false;
}

function resolveGalleryAssetUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (!isSceneAssetUrlCandidate(value)) return "";
  if (value.startsWith("/uploads/") || value.startsWith("/api/uploads/")) return resolveAssetUrl(value);
  if (value.startsWith("uploads/") || value.startsWith("api/uploads/")) return resolveAssetUrl(`/${value}`);
  if (value.startsWith("\\uploads\\") || value.startsWith("uploads\\")) {
    return resolveAssetUrl(value.replace(/\\/g, "/").replace(/^\/?/, "/"));
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/uploads/")) {
        return resolveAssetUrl(parsed.pathname);
      }
      // Keep non-upload absolute URLs on original host (frontend static assets).
      return parsed.toString();
    } catch {
      return value;
    }
  }
  return value;
}

function isLegacyProjectAssetPath(rawUrl) {
  const value = String(rawUrl || "").trim().replace(/\\/g, "/");
  if (!value) return false;
  // Consider legacy only when it points directly to this old absolute root.
  // Keep local imported assets like "/src/assets-para-app/..." valid.
  return value.startsWith("/assets-para-app/");
}

function isUploadAssetUrl(rawUrl) {
  const value = String(rawUrl || "").trim().replace(/\\/g, "/").toLowerCase();
  if (!value) return false;
  if (value.startsWith("/uploads/") || value.startsWith("/api/uploads/")) return true;
  if (value.startsWith("uploads/") || value.startsWith("api/uploads/")) return true;
  if (value.includes("/uploads/") || value.includes("/api/uploads/")) return true;
  return false;
}

export default function DailyEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canvasRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const mapIslandUploadInputRef = React.useRef(null);
  const islandImageCacheRef = React.useRef(new Map());
  const mapIslandsPersistTimerRef = React.useRef(0);
  const mapIslandsPersistVersionRef = React.useRef(0);
  const importedExportSaveResolverRef = React.useRef(null);
  const dragScrollStateRef = React.useRef({
    active: false,
    pointerId: null,
    pointerType: "",
    element: null,
    axis: "x",
    startClientX: 0,
    startClientY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    moved: false,
    suppressClick: false,
    lastClientX: 0,
    lastClientY: 0,
    lastMoveTs: 0,
    velocity: 0,
    momentumFrame: 0,
  });
  const [mapIslands, setMapIslands] = React.useState(() => loadMapIslands(user?.id));
  const [mapIslandsRecordId, setMapIslandsRecordId] = React.useState(null);
  const [isMapIslandsHydrated, setIsMapIslandsHydrated] = React.useState(false);
  const NODES = mapIslands;
  const LINKS = React.useMemo(
    () => Array.from({ length: Math.max(0, NODES.length - 1) }, (_, index) => [index, index + 1]),
    [NODES]
  );
  const dailyIslandId = 0;
  const dailyIslandDay = NODES[dailyIslandId]?.day ?? 1;
  const { data: runnerConfigs = [] } = useQuery({
    queryKey: ["island-game-runner-config"],
    queryFn: () => base44.entities.IslandGameConfig.list(),
  });
  const { data: islandThemes = [] } = useQuery({
    queryKey: ["island-game-themes"],
    queryFn: () => base44.entities.IslandGameTheme.list(),
  });

  const [phase, setPhase] = React.useState("transition");
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [isEntryShellWarmReady, setIsEntryShellWarmReady] = React.useState(false);
  const [isSceneBootWarmReady, setIsSceneBootWarmReady] = React.useState(false);
  const [hasLoadingMinDurationElapsed, setHasLoadingMinDurationElapsed] = React.useState(false);
  const [isMapCanvasPrimed, setIsMapCanvasPrimed] = React.useState(false);
  const [isMapLoadRevealActive, setIsMapLoadRevealActive] = React.useState(false);
  const [isMapLensIntroActive, setIsMapLensIntroActive] = React.useState(true);
  const [screen, setScreen] = React.useState("map");
  const [activeMapBottomMenu, setActiveMapBottomMenu] = React.useState("islands");
  const [mapMenuTransitionDirection, setMapMenuTransitionDirection] = React.useState(1);
  const [isDesktopViewport, setIsDesktopViewport] = React.useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  const unlockedMaxDay = React.useMemo(() => {
    const unlocked = NODES.filter((node) => !node?.locked);
    return unlocked.length ? Math.max(...unlocked.map((node) => Number(node?.day) || 1)) : 1;
  }, [NODES]);
  const hasApprovedProfilePhoto = Boolean(user?.profile_image_status === "approved" && user?.profile_image_url);
  const playerProfileImageSrc = hasApprovedProfilePhoto ? resolveAssetUrl(user.profile_image_url) : "";
  const playerHudName = user?.nick || user?.full_name || "Jogador";
  const playerHudInitial = String(playerHudName || "J").trim().charAt(0).toUpperCase() || "J";

  const [size, setSize] = React.useState({ width: 320, height: 440 });
  const [isStageMeasured, setIsStageMeasured] = React.useState(false);
  const isLowPerfMapDevice = React.useMemo(() => {
    if (typeof window === "undefined" || isDesktopViewport) return false;
    const width = Number(size.width || window.innerWidth || 0);
    const hwThreads = Number(window.navigator?.hardwareConcurrency || 0);
    const deviceMemory = Number(window.navigator?.deviceMemory || 0);
    return (
      width <= 430 ||
      (hwThreads > 0 && hwThreads <= 6) ||
      (deviceMemory > 0 && deviceMemory <= 4)
    );
  }, [isDesktopViewport, size.width]);
  const [zoom, setZoom] = React.useState(1);
  const [camera, setCamera] = React.useState({ x: 0, y: 0 });
  const [isMapIntroPlaying, setIsMapIntroPlaying] = React.useState(false);
  const [isMapDragging, setIsMapDragging] = React.useState(false);

  const [currentNode, setCurrentNode] = React.useState(0);
  const [selectedIslandId, setSelectedIslandId] = React.useState(0);
  const [travelTargetId, setTravelTargetId] = React.useState(0);
  const [visitedNodes, setVisitedNodes] = React.useState(
    new Set([0])
  );
  const [travelProgress, setTravelProgress] = React.useState(0);
  const [mapDevSelectedIslandId, setMapDevSelectedIslandId] = React.useState(0);
  const [isMapIslandUploading, setIsMapIslandUploading] = React.useState(false);
  const [mapIslandImageVersion, setMapIslandImageVersion] = React.useState(0);

  const [challengeError, setChallengeError] = React.useState("");
  const [runnerState, setRunnerState] = React.useState(() => createDefaultRunnerState());
  const [isDevMode, setIsDevMode] = React.useState(false);
  const [isRunnerPaused, setIsRunnerPaused] = React.useState(false);
  const [runnerTimeScale, setRunnerTimeScale] = React.useState(1);
  const [isDevNoCollision, setIsDevNoCollision] = React.useState(false);
  const [isDevFreeCamera, setIsDevFreeCamera] = React.useState(true);
  const [devCameraPreset, setDevCameraPreset] = React.useState("player");
  const [devCameraResetToken, setDevCameraResetToken] = React.useState(0);
  const [isRunnerSceneReady, setIsRunnerSceneReady] = React.useState(false);
  const [isLoadoutTransitionActive, setIsLoadoutTransitionActive] = React.useState(false);
  const [loadoutTransitionProgress, setLoadoutTransitionProgress] = React.useState(0);
  const loadoutTransitionVideoRef = React.useRef(null);
  const pageEntryLeavesVideoRef = React.useRef(null);
  const [isIslandLoadoutLeavesActive, setIsIslandLoadoutLeavesActive] = React.useState(false);
  const islandLoadoutLeavesStartedRef = React.useRef(false);
  const islandLoadoutOpenTimerRef = React.useRef(0);
  const didPrimeMapCanvasRef = React.useRef(false);
  const didPlayMapLensIntroRef = React.useRef(false);
  const mapLensIntroTimerRef = React.useRef(0);
  const [isLoadoutCameraEditMode, setIsLoadoutCameraEditMode] = React.useState(false);
  const [loadoutCameraRigDraft, setLoadoutCameraRigDraft] = React.useState(() => normalizeLoadoutCameraRig());
  const [resultChestPhase, setResultChestPhase] = React.useState("arrival");
  const [resultChestTapCount, setResultChestTapCount] = React.useState(0);
  const [resultChestPulseToken, setResultChestPulseToken] = React.useState(0);
  const [resultSceneMountKey, setResultSceneMountKey] = React.useState(0);
  const [isResultRunnerSceneReady, setIsResultRunnerSceneReady] = React.useState(false);
  const [resultSummaryPhase, setResultSummaryPhase] = React.useState("idle");
  const [resultAnimatedScore, setResultAnimatedScore] = React.useState(0);
  const [resultAnimatedElapsedMs, setResultAnimatedElapsedMs] = React.useState(0);
  const [resultAnimatedCoins, setResultAnimatedCoins] = React.useState(0);
  const [resultAnimatedDiamonds, setResultAnimatedDiamonds] = React.useState(0);
  const [resultAnimatedKeys, setResultAnimatedKeys] = React.useState(0);
  const [resultBestElapsedMs, setResultBestElapsedMs] = React.useState(0);
  const [resultIsNewBest, setResultIsNewBest] = React.useState(false);
  const [resultRewards, setResultRewards] = React.useState(() => ({
    run: { coins: 0, diamonds: 0, keys: 0 },
    chest: { type: "common", title: "Baú comum", subtitle: "", coins: 0, diamonds: 0, keys: 0, rarity: "common" },
    total: { coins: 0, diamonds: 0, keys: 0 },
  }));
  const [resultSummaryCollected, setResultSummaryCollected] = React.useState(false);
  const [rewardGallery, setRewardGallery] = React.useState([]);
  const [latestCollectedRewardId, setLatestCollectedRewardId] = React.useState("");
  const [resultRewardCollected, setResultRewardCollected] = React.useState(false);
  const [displayedRunnerScore, setDisplayedRunnerScore] = React.useState(0);
  const [runnerCollectBursts, setRunnerCollectBursts] = React.useState([]);
  const previousRunnerScoreRef = React.useRef(0);
  const [playerInventory, setPlayerInventory] = React.useState(() =>
    loadPlayerInventory(user?.id, {
      equippedPerkFallback: loadRunnerPerkLoadout(user?.id),
      selectedCharacterFallback: getDefaultSelectedCharacterId(),
    })
  );
  const [storeFeedbackMessage, setStoreFeedbackMessage] = React.useState("");
  const playerWallet = playerInventory?.wallet || { coins: 1200, diamonds: 12, keys: 0 };
  const playerProgressionSnapshot = React.useMemo(
    () => buildProgressionSnapshot({ inventory: playerInventory }),
    [playerInventory]
  );
  const playerGameLevel = Math.max(1, Number(playerProgressionSnapshot?.progression?.currentLevel) || 1);
  const playerXpIntoLevel = Math.max(0, Number(playerProgressionSnapshot?.progression?.xpIntoLevel) || 0);
  const playerXpForNextLevel = Math.max(0, Number(playerProgressionSnapshot?.progression?.xpForNextLevel) || 0);
  const playerXpRemainingToNextLevel = Math.max(0, Number(playerProgressionSnapshot?.progression?.xpRemainingToNextLevel) || 0);
  const playerXpProgressRatio = Math.max(0, Math.min(1, Number(playerProgressionSnapshot?.progression?.progressRatio) || 0));
  const nextCharacterUnlock = playerProgressionSnapshot?.nextCharacterUnlock || null;
  const [isKeyRankingOpen, setIsKeyRankingOpen] = React.useState(false);
  const playerGameCoins = Math.max(0, Number(playerWallet?.coins) || 0);
  const playerGameDiamonds = Math.max(0, Number(playerWallet?.diamonds) || 0);
  const playerChestKeys = Math.max(0, Number(playerWallet?.keys) || 0);
  const keyRankingSnapshot = React.useMemo(
    () =>
      buildKeyRankingSnapshot({
        playerId: user?.id,
        playerName: user?.full_name || user?.nick || "Jogador Souza",
        totalKeys: playerChestKeys,
      }),
    [playerChestKeys, user?.full_name, user?.id, user?.nick]
  );
  const isResultSceneVisible = screen === "result" && isResultRunnerSceneReady;
  React.useEffect(() => {
    if (screen === "map") return;
    setIsKeyRankingOpen(false);
  }, [screen]);
  React.useEffect(() => {
    if (!storeFeedbackMessage) return undefined;
    const timeoutId = window.setTimeout(() => setStoreFeedbackMessage(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [storeFeedbackMessage]);

  const [isGraphicsSettingsOpen, setIsGraphicsSettingsOpen] = React.useState(false);
  const [runnerGraphicsSettings, setRunnerGraphicsSettings] = React.useState(() =>
    loadRunnerGraphicsSettings(user?.id)
  );
  const [loadoutTab, setLoadoutTab] = React.useState("character");
  const [selectedCharacterId, setSelectedCharacterId] = React.useState(
    () => playerInventory?.selectedCharacterId || getDefaultSelectedCharacterId()
  );
  const [selectedWardrobeSlot, setSelectedWardrobeSlot] = React.useState("preset");
  const [selectedSkinId, setSelectedSkinId] = React.useState("classic");
  const [loadoutPreviewSlideDirection, setLoadoutPreviewSlideDirection] = React.useState(1);
  const [loadoutCharacterSwapToken, setLoadoutCharacterSwapToken] = React.useState(0);
  const [isPendingLoadoutOpen, startLoadoutOpenTransition] = React.useTransition();
  const [selectedConsumableId, setSelectedConsumableId] = React.useState(
    () => String(playerInventory?.selectedConsumableId || "").trim()
  );
  const [equippedPerkIds, setEquippedPerkIds] = React.useState(() => playerInventory?.equippedPerkIds || loadRunnerPerkLoadout(user?.id));
  const [selectedPerkId, setSelectedPerkId] = React.useState(() => (playerInventory?.equippedPerkIds || loadRunnerPerkLoadout(user?.id))[0] || getDefaultEquippedPerkIds()[0]);
  const skipNextPerkLoadoutSaveRef = React.useRef(true);
  const [loadoutWardrobeDraft, setLoadoutWardrobeDraft] = React.useState(() => createEmptyLoadoutWardrobe());
  const [loadoutWardrobeUploadSlot, setLoadoutWardrobeUploadSlot] = React.useState("top");
  const [loadoutWardrobePresetName, setLoadoutWardrobePresetName] = React.useState("");
  const [loadoutDevStudioTab, setLoadoutDevStudioTab] = React.useState("wardrobe");
  const [loadoutWardrobeSectionsOpen, setLoadoutWardrobeSectionsOpen] = React.useState({
    library: true,
    slots: true,
    presets: false,
  });
  const [isLoadoutWardrobeSaving, setIsLoadoutWardrobeSaving] = React.useState(false);
  const [isLoadoutBaseModelSaving, setIsLoadoutBaseModelSaving] = React.useState(false);
  const [devPanelPos, setDevPanelPos] = React.useState({ x: null, y: null });
  const [devPanelCollapsed, setDevPanelCollapsed] = React.useState(true);
  const [devPanelTab, setDevPanelTab] = React.useState("controls");
  const [devConveyorPos, setDevConveyorPos] = React.useState({ x: 12, y: 220 });
  const [devConveyorCollapsed, setDevConveyorCollapsed] = React.useState(true);
  const [devConveyorOffset, setDevConveyorOffset] = React.useState(0);
  const [devStageEditMode, setDevStageEditMode] = React.useState("map");
  const [devMapCursorZ, setDevMapCursorZ] = React.useState(0);
  const [devRoadPanelPos, setDevRoadPanelPos] = React.useState({ x: 12, y: 108 });
  const [devRoadPanelCollapsed, setDevRoadPanelCollapsed] = React.useState(true);
  const [devCameraPanelPos, setDevCameraPanelPos] = React.useState({ x: 12, y: 500 });
  const [devCameraPanelCollapsed, setDevCameraPanelCollapsed] = React.useState(true);
  const [devFloatingUiCollapsed, setDevFloatingUiCollapsed] = React.useState(false);
  const [elevatedBridgeDebugTransform, setElevatedBridgeDebugTransform] = React.useState(() => {
    if (typeof window === "undefined") return { ...DEFAULT_ELEVATED_BRIDGE_DEBUG_TRANSFORM };
    try {
      const raw = window.localStorage.getItem("runner_dev_elevated_bridge_transform");
      return normalizeElevatedBridgeDebugTransform(raw ? JSON.parse(raw) : null);
    } catch {
      return { ...DEFAULT_ELEVATED_BRIDGE_DEBUG_TRANSFORM };
    }
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "runner_dev_elevated_bridge_transform",
        JSON.stringify(normalizeElevatedBridgeDebugTransform(elevatedBridgeDebugTransform))
      );
    } catch {
      // no-op
    }
  }, [elevatedBridgeDebugTransform]);
  const openChallengeDevPanel = React.useCallback((panelKey) => {
    setDevFloatingUiCollapsed(false);
    setDevPanelCollapsed(panelKey !== "dev");
    setDevConveyorCollapsed(panelKey !== "map");
    setDevRoadPanelCollapsed(panelKey !== "road");
    setDevCameraPanelCollapsed(panelKey !== "camera");
  }, []);
  const [devCameraFollowDistance, setDevCameraFollowDistance] = React.useState(9.4);
  const [devSceneLightingDraft, setDevSceneLightingDraft] = React.useState(() => normalizeSceneLightingDraft({}));
  const [devSceneRenderDraft, setDevSceneRenderDraft] = React.useState(() => normalizeSceneRenderDraft({}));
  const [loadoutImportIslandDay, setLoadoutImportIslandDay] = React.useState(1);
  const [isLoadoutImporting, setIsLoadoutImporting] = React.useState(false);
  const [devRoadSculptDraft, setDevRoadSculptDraft] = React.useState(() => normalizeRoadSculptDraft({}));
  const [devRoadVisualDraft, setDevRoadVisualDraft] = React.useState(() => normalizeRoadVisualDraft({}));
  const [devRoadEventsOpen, setDevRoadEventsOpen] = React.useState(false);
  const [devMapCycleLength, setDevMapCycleLength] = React.useState("600");
  const [devRoadSectionsOpen, setDevRoadSectionsOpen] = React.useState({
    curve: false,
    grade: false,
    depth: false,
    visual: false,
    blocks: false,
  });
  const [devRoadEventBlocks, setDevRoadEventBlocks] = React.useState([]);
  const [devSelectedRoadEventId, setDevSelectedRoadEventId] = React.useState("");
  const [devNewRoadEventDraft, setDevNewRoadEventDraft] = React.useState(() =>
    normalizeNewRoadEventDraft({})
  );
  const [sceneConfigRecordId, setSceneConfigRecordId] = React.useState(null);
  const [sceneConfig, setSceneConfig] = React.useState(() => createDefaultSceneConfig(1));
  const [isSceneConfigLoading, setIsSceneConfigLoading] = React.useState(false);
  const [isSceneConfigSaving, setIsSceneConfigSaving] = React.useState(false);
  const [isRoadVisualSaving, setIsRoadVisualSaving] = React.useState(false);
  const [sceneConfigMessage, setSceneConfigMessage] = React.useState("");
  const [devSelectedObject, setDevSelectedObject] = React.useState(null);
  const [devPositionDraft, setDevPositionDraft] = React.useState({ x: "0", y: "0", z: "0" });
  const [copyFromIslandDay, setCopyFromIslandDay] = React.useState(1);
  const [devAddTextureUrl, setDevAddTextureUrl] = React.useState(DEV_ELEMENT_LIBRARY[0] || "");
  const devAddKind = "tree";
  const [devLastUploadedAsset, setDevLastUploadedAsset] = React.useState(null);
  const [devUploadedAssets, setDevUploadedAssets] = React.useState([]);
  const [isElementGalleryOpen, setIsElementGalleryOpen] = React.useState(false);
  const [isModelerOpen, setIsModelerOpen] = React.useState(false);
  const [isModelerExpanded, setIsModelerExpanded] = React.useState(false);
  const [devGalleryTab, setDevGalleryTab] = React.useState("elements");
  const [devUploadFileName, setDevUploadFileName] = React.useState("");
  const [isImportedExportSaveDialogOpen, setIsImportedExportSaveDialogOpen] = React.useState(false);
  const [importedExportSaveName, setImportedExportSaveName] = React.useState("");
  const [importedExportSaveFolder, setImportedExportSaveFolder] = React.useState("");
  const [devModelPrimitive, setDevModelPrimitive] = React.useState("box");
  const [devModelTool, setDevModelTool] = React.useState("move");
  const [devModelWidth, setDevModelWidth] = React.useState("1.8");
  const [devModelHeight, setDevModelHeight] = React.useState("1.2");
  const [devModelDepth, setDevModelDepth] = React.useState("1.4");
  const [devModelRadiusTop, setDevModelRadiusTop] = React.useState("0.7");
  const [devModelRadiusBottom, setDevModelRadiusBottom] = React.useState("0.9");
  const [devModelRadialSegments, setDevModelRadialSegments] = React.useState("8");
  const [devModelHeightSegments, setDevModelHeightSegments] = React.useState("1");
  const [devModelWidthSegments, setDevModelWidthSegments] = React.useState("1");
  const [devModelDepthSegments, setDevModelDepthSegments] = React.useState("1");
  const [devModelSelectedSide, setDevModelSelectedSide] = React.useState("px");
  const [devModelSelectedTexture, setDevModelSelectedTexture] = React.useState("");
  const [devImportedTextureOverride, setDevImportedTextureOverride] = React.useState("");
  const [devModelSideTextures, setDevModelSideTextures] = React.useState({});
  const [devModelSideTextureSettings, setDevModelSideTextureSettings] = React.useState({});
  const [devModelTextureDraft, setDevModelTextureDraft] = React.useState(() => normalizeTextureSettings({}));
  const [devModelDraftOffsets, setDevModelDraftOffsets] = React.useState({});
  const [devModelDraftVertexColors, setDevModelDraftVertexColors] = React.useState({});
  const [devImportedDraftOffsets, setDevImportedDraftOffsets] = React.useState({});
  const [devImportedDraftVertexColors, setDevImportedDraftVertexColors] = React.useState({});
  const [devModelPaintColor, setDevModelPaintColor] = React.useState("#9ca3af");
  const [devModelBrushRadius, setDevModelBrushRadius] = React.useState("0.9");
  const [devModelBrushStrength, setDevModelBrushStrength] = React.useState("0.025");
  const [devModelWeldVertices, setDevModelWeldVertices] = React.useState(false);
  const [devModelParts, setDevModelParts] = React.useState([]);
  const [devModelActivePartId, setDevModelActivePartId] = React.useState("");
  const [devModelPartOffsetX, setDevModelPartOffsetX] = React.useState("0");
  const [devModelPartOffsetY, setDevModelPartOffsetY] = React.useState("0");
  const [devModelPartOffsetZ, setDevModelPartOffsetZ] = React.useState("0");
  const [devModelPartRotationX, setDevModelPartRotationX] = React.useState("0");
  const [devModelPartRotationY, setDevModelPartRotationY] = React.useState("0");
  const [devModelPartRotationZ, setDevModelPartRotationZ] = React.useState("0");
  const [devModelPartScale, setDevModelPartScale] = React.useState("1");
  const [devModelImported3dUrl, setDevModelImported3dUrl] = React.useState("");
  const [devModelImported3dName, setDevModelImported3dName] = React.useState("");
  const [devModelViewportMode, setDevModelViewportMode] = React.useState("procedural");
  const [devModelImportedPreviewError, setDevModelImportedPreviewError] = React.useState("");
  const [devImportedMeshStats, setDevImportedMeshStats] = React.useState(null);
  const [devImportedWeldVertices, setDevImportedWeldVertices] = React.useState(false);
  const [devImportedWeldConnectedOnly, setDevImportedWeldConnectedOnly] = React.useState(true);
  const [devImportedAutoMaskTopology, setDevImportedAutoMaskTopology] = React.useState(true);
  const [devImportedWeldEpsilon, setDevImportedWeldEpsilon] = React.useState("auto");
  const [devImportedSmoothShading, setDevImportedSmoothShading] = React.useState(true);
  const [devImportedAutoSmooth, setDevImportedAutoSmooth] = React.useState(true);
  const [devImportedAutoSmoothAngle, setDevImportedAutoSmoothAngle] = React.useState("180");
  const [devShowImportedTexture, setDevShowImportedTexture] = React.useState(false);
  const [devImportedTextureSlot, setDevImportedTextureSlot] = React.useState("front");
  const [devImportedAppliedTextureSlot, setDevImportedAppliedTextureSlot] = React.useState("front");
  const [devImportedTextureUseOriginalUv, setDevImportedTextureUseOriginalUv] = React.useState(false);
  const [devImportedFrontTexture, setDevImportedFrontTexture] = React.useState("");
  const [devImportedSideTexture, setDevImportedSideTexture] = React.useState("");
  const [devImportedBackTexture, setDevImportedBackTexture] = React.useState("");
  const [devImportedFrontTextureSettings, setDevImportedFrontTextureSettings] = React.useState(() => normalizeTextureSettings({}));
  const [devImportedSideTextureSettings, setDevImportedSideTextureSettings] = React.useState(() => normalizeTextureSettings({}));
  const [devImportedBackTextureSettings, setDevImportedBackTextureSettings] = React.useState(() => normalizeTextureSettings({}));
  const [modelerSaveRequestToken, setModelerSaveRequestToken] = React.useState(0);
  const [pendingCloseImportedAfterSave, setPendingCloseImportedAfterSave] = React.useState(false);
  const DEV_SPECIAL_SEGMENT_LIBRARY = React.useMemo(
    () => [
      {
        id: "wood_bridge",
        label: "Ponte elevada",
        type: "elevated_path",
        profile: "wood_bridge",
        width: 8.1,
        height: 0.32,
        depth: 66,
        segment_height: 1.18,
        segment_entry_length: 16,
        segment_flat_length: 34,
        segment_exit_length: 16,
        offsetY: 0.12,
      },
      {
        id: "pit_gap",
        label: "Abismo",
        type: "pit_gap",
        profile: "pit_basic",
        width: 8.1,
        height: 0.18,
        depth: 10,
        segment_gap_length: 7.5,
        segment_drop_depth: 2.4,
        offsetY: -0.24,
      },
    ],
    []
  );
  const DEV_LOGIC_SEGMENT_PRESETS = React.useMemo(
    () => [
      {
        id: "bridge_tiny",
        label: "Ponte pequena",
        segmentId: "wood_bridge",
        segment_height: 0.35,
        segment_entry_length: 1.2,
        segment_flat_length: 2.2,
        segment_exit_length: 1.2,
        segment_logic_width: 1.4,
      },
      {
        id: "bridge_small",
        label: "Ponte media",
        segmentId: "wood_bridge",
        segment_height: 0.7,
        segment_entry_length: 2.8,
        segment_flat_length: 5.4,
        segment_exit_length: 2.8,
        segment_logic_width: 2.4,
      },
      {
        id: "bridge_long",
        label: "Ponte longa",
        segmentId: "wood_bridge",
        segment_height: 1.18,
        segment_entry_length: 6,
        segment_flat_length: 12,
        segment_exit_length: 6,
        segment_logic_width: 3.4,
      },
      {
        id: "pit_small",
        label: "Abismo pequeno",
        segmentId: "pit_gap",
        segment_gap_length: 2.2,
        segment_drop_depth: 2.4,
      },
    ],
    []
  );
  const [devToolStrengths, setDevToolStrengths] = React.useState({
    sculpt: "0.26",
    draw_sharp: "0.22",
    clay: "0.24",
    clay_strips: "0.24",
    flatten: "0.2",
    fill: "0.2",
    scrape: "0.2",
    smooth: "0.22",
    inflate: "0.18",
    blob: "0.2",
    pinch: "0.16",
    crease: "0.2",
    relax: "0.2",
    paint: "0.3",
  });
  const [devModelToolMenuMode, setDevModelToolMenuMode] = React.useState("sculpt");
  const activeBrushToolKey = React.useMemo(() => {
    const key = String(devModelTool || "").trim();
    if (MODELER_BRUSH_LABELS[key]) return key;
    return "sculpt";
  }, [devModelTool]);
  const activeBrushToolLabel = React.useMemo(() => {
    return MODELER_BRUSH_LABELS[activeBrushToolKey] || "Draw";
  }, [activeBrushToolKey]);
  const activeBrushToolIntensity = React.useMemo(() => {
    const raw = Number(devToolStrengths?.[activeBrushToolKey]);
    if (!Number.isFinite(raw)) return 0.3;
    return Math.max(0.05, Math.min(2, raw));
  }, [activeBrushToolKey, devToolStrengths]);
  React.useEffect(() => {
    const key = String(devModelTool || "").trim();
    setDevModelToolMenuMode(MODELER_BRUSH_LABELS[key] ? "sculpt" : "model");
  }, [devModelTool]);
  const [devModelPointerMode, setDevModelPointerMode] = React.useState("");
  const [devModelAutosaveSeconds, setDevModelAutosaveSeconds] = React.useState("60");
  const [modelerHistoryView, setModelerHistoryView] = React.useState([]);
  const [modelerHistoryCursor, setModelerHistoryCursor] = React.useState(-1);
  const [devEditingPresetKey, setDevEditingPresetKey] = React.useState("");
  const [devEditingPresetName, setDevEditingPresetName] = React.useState("");
  const [devEditingPresetFolder, setDevEditingPresetFolder] = React.useState("");
  const [isProjectBrowserOpen, setIsProjectBrowserOpen] = React.useState(false);
  const [projectBrowserFolderFilter, setProjectBrowserFolderFilter] = React.useState("all");
  const [devInteractionMode, setDevInteractionMode] = React.useState("select");
  const [devEditNonce, setDevEditNonce] = React.useState(0);
  const [devContextMenuPos, setDevContextMenuPos] = React.useState({ x: 120, y: 120 });
  const [devMoveGizmoPos, setDevMoveGizmoPos] = React.useState(null);
  const [devDraftOverrides, setDevDraftOverrides] = React.useState({});
  const [loadoutBaseModelUrlDraft, setLoadoutBaseModelUrlDraft] = React.useState("");
  const [devScaleDraft, setDevScaleDraft] = React.useState({ scale: "1.00", scaleX: "1.00", scaleY: "1.00", scaleZ: "1.00" });
  const [devPersistDebug, setDevPersistDebug] = React.useState(null);
  const sceneConfigRef = React.useRef(null);
  const devSelectedObjectKeyRef = React.useRef("");
  const devDraftOverridesRef = React.useRef({});
  const devEditSessionRef = React.useRef(0);
  const devSelectionSnapshotRef = React.useRef(null);
  const horizonPersistTimerRef = React.useRef(0);
  const devContextMenuRef = React.useRef(null);
  const devRoadPanelRef = React.useRef(null);
  const devRoadDragRef = React.useRef({ active: false, pointerId: null, offsetX: 0, offsetY: 0 });
  const devCameraPanelRef = React.useRef(null);
  const devCameraDragRef = React.useRef({ active: false, pointerId: null, offsetX: 0, offsetY: 0 });
  const devRoadAdjustHoldRef = React.useRef({ pointerId: null, timer: 0 });
  const devSelectedNudgeHoldRef = React.useRef({ pointerId: null, holdTimer: 0, repeatTimer: 0, repeats: 0 });
  const devSelectedRotateHoldRef = React.useRef({ pointerId: null, holdTimer: 0, repeatTimer: 0, repeats: 0 });
  const handleNudgeSelectedPositionRef = React.useRef(null);
  const proceduralUndoStackRef = React.useRef({});
  const proceduralRedoStackRef = React.useRef({});
  const modelerHistoryRef = React.useRef({
    key: "",
    entries: [],
    cursor: -1,
    suspend: false,
  });
  const modelerAutosaveBusyRef = React.useRef(false);
  const importedAutoWeldSignatureRef = React.useRef("");
  const introCompletedRef = React.useRef(false);
  const selectedIslandDay = NODES[selectedIslandId]?.day ?? 1;
  const selectedIsland = NODES[selectedIslandId] || NODES[0] || null;
  const isBaseOnlyMap = Boolean(sceneConfig?.base_only_mode);
  const runnerConfig = React.useMemo(() => {
    const configMap = new Map();
    runnerConfigs.forEach((item) => {
      if (!item?.key) return;
      configMap.set(String(item.key), item.value);
    });
    const readNumber = (key, fallback) => {
      const raw = Number(configMap.get(key));
      return Number.isFinite(raw) ? raw : fallback;
    };
    return {
      speed_start: readNumber("speed_start", DEFAULT_RUNNER_CONFIG.speed_start),
      speed_cap: readNumber("speed_cap", DEFAULT_RUNNER_CONFIG.speed_cap),
      speed_ramp_ms: readNumber("speed_ramp_ms", DEFAULT_RUNNER_CONFIG.speed_ramp_ms),
      block_spawn_min_ms: readNumber("block_spawn_min_ms", DEFAULT_RUNNER_CONFIG.block_spawn_min_ms),
      block_spawn_max_ms: readNumber("block_spawn_max_ms", DEFAULT_RUNNER_CONFIG.block_spawn_max_ms),
      obstacle_spawn_min_ms: readNumber("obstacle_spawn_min_ms", DEFAULT_RUNNER_CONFIG.obstacle_spawn_min_ms),
      obstacle_spawn_max_ms: readNumber("obstacle_spawn_max_ms", DEFAULT_RUNNER_CONFIG.obstacle_spawn_max_ms),
      chest_base: readNumber("chest_base", DEFAULT_RUNNER_CONFIG.chest_base),
      chest_gain_daily: readNumber("chest_gain_daily", DEFAULT_RUNNER_CONFIG.chest_gain_daily),
      chest_gain_regular: readNumber("chest_gain_regular", DEFAULT_RUNNER_CONFIG.chest_gain_regular),
    };
  }, [runnerConfigs]);

  const islandTheme = React.useMemo(() => {
    const currentDay = NODES[selectedIslandId]?.day ?? 1;
    const theme =
      islandThemes.find((item) => Number(item?.island_day) === currentDay) ||
      islandThemes.find((item) => Number(item?.island_id) === selectedIslandId) ||
      null;
    return {
      sky_top: String(theme?.sky_top || DEFAULT_THEME.sky_top),
      sky_glow: String(theme?.sky_glow || DEFAULT_THEME.sky_glow),
      road_from: String(theme?.road_from || DEFAULT_THEME.road_from),
      road_to: String(theme?.road_to || DEFAULT_THEME.road_to),
      player: String(theme?.player || DEFAULT_THEME.player),
      block: String(theme?.block || DEFAULT_THEME.block),
      obstacle: String(theme?.obstacle || DEFAULT_THEME.obstacle),
    };
  }, [islandThemes, selectedIslandId]);

  const devAssetLibraryOptions = React.useMemo(() => {
    const activeSceneKind = devGalleryTab === "eliminatory" ? "eliminatory" : "elements";
    const byAssetKey = new Map();
    const addOption = (url, sourceLabel, mediaType = null, displayName = "") => {
      const value = String(url || "").trim();
      if (!value) return;
      const resolvedValue = resolveGalleryAssetUrl(value) || value;
      if (!isSceneAssetUrlCandidate(resolvedValue)) return;
      const fileName = String(displayName || getAssetFileName(resolvedValue)).trim() || getAssetFileName(resolvedValue);
      const effectiveMediaType = mediaType || detectAssetTypeFromName(fileName);
      const dedupeKey = `${effectiveMediaType}:${getCanonicalSceneAssetName(displayName || resolvedValue)}`;
      if (byAssetKey.has(dedupeKey)) return;
      byAssetKey.set(dedupeKey, {
        value: resolvedValue,
        label: `${fileName} (${sourceLabel})`,
        mediaType: effectiveMediaType,
        fileName,
        canonicalName: getCanonicalSceneAssetName(displayName || resolvedValue),
      });
    };

    const libraryUrls = activeSceneKind === "eliminatory" ? DEV_ELIMINATORY_LIBRARY : DEV_ELEMENT_LIBRARY;
    libraryUrls.forEach((url) => addOption(url, "Biblioteca"));

    const customObjects = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    customObjects.forEach((item) => {
      const entryCategory = String(item?.editor_category || "elements").trim().toLowerCase();
      if (entryCategory !== activeSceneKind) return;
      addOption(item?.texture_url, "Upload", item?.media_type);
      addOption(item?.model_url, "Upload", item?.media_type);
    });

    devUploadedAssets.forEach((asset) => {
      const assetKind = String(asset?.sceneKind || "").trim().toLowerCase();
      if (assetKind && assetKind !== activeSceneKind) return;
      addOption(asset?.url, "Upload", asset?.type, asset?.name);
    });
    if (String(devLastUploadedAsset?.sceneKind || "").trim().toLowerCase() === activeSceneKind) {
      addOption(devLastUploadedAsset?.url, "Upload recente", devLastUploadedAsset?.type);
    }
    addOption(devAddTextureUrl, "Selecionado");
    const presetOptions = (Array.isArray(sceneConfig?.procedural_presets) ? sceneConfig.procedural_presets : [])
      .map((preset) => {
        const key = String(preset?.key || "").trim();
        if (!key) return null;
        const label = String(preset?.name || `Preset ${key.slice(-4)}`);
        const folder = String(preset?.folder || "").trim();
        return {
          value: `preset:${key}`,
          label: `${folder ? `${folder}/` : ""}${label} (3D salvo)`,
          mediaType: "procedural_preset",
          fileName: `${folder ? `${folder}/` : ""}${label}.3dpreset`,
          folder,
          isProceduralPreset: true,
          proceduralPreset: preset,
        };
      })
      .filter(Boolean);
    return activeSceneKind === "elements" ? [...presetOptions, ...Array.from(byAssetKey.values())] : Array.from(byAssetKey.values());
  }, [
    devAddTextureUrl,
    devGalleryTab,
    devLastUploadedAsset?.type,
    devLastUploadedAsset?.sceneKind,
    devLastUploadedAsset?.url,
    devUploadedAssets,
    sceneConfig?.custom_objects,
    sceneConfig?.procedural_presets,
  ]);

  const devSceneImageGalleryOptions = React.useMemo(() => {
    const activeSceneKind = devGalleryTab === "road" ? "road" : "horizon";
    const byUrl = new Map();
    const addImage = (url, sourceLabel) => {
      const value = String(url || "").trim();
      if (!value) return;
      const resolvedValue = resolveGalleryAssetUrl(value) || value;
      if (!isSceneAssetUrlCandidate(resolvedValue)) return;
      if (byUrl.has(resolvedValue)) return;
      const fileName = getAssetFileName(resolvedValue);
      const mediaType = detectAssetTypeFromName(fileName);
      if (mediaType !== "image") return;
      byUrl.set(resolvedValue, { value: resolvedValue, fileName, label: `${fileName} (${sourceLabel})` });
    };

    if (activeSceneKind === "horizon") {
      addImage(sceneConfig?.horizon_texture_url, "Atual");
    } else {
      addImage(sceneConfig?.road_texture_url, "Atual");
    }
    devUploadedAssets.forEach((asset) => {
      const assetKind = String(asset?.sceneKind || "").trim().toLowerCase();
      if (assetKind && assetKind !== activeSceneKind) return;
      addImage(asset?.url, "Upload");
    });
    return Array.from(byUrl.values());
  }, [devGalleryTab, devUploadedAssets, sceneConfig?.horizon_texture_url, sceneConfig?.road_texture_url]);
  const proceduralProjectFolders = React.useMemo(() => {
    const list = Array.isArray(sceneConfig?.procedural_presets) ? sceneConfig.procedural_presets : [];
    const unique = new Set();
    list.forEach((item) => {
      const folder = String(item?.folder || "").trim();
      if (folder) unique.add(folder);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sceneConfig?.procedural_presets]);
  const proceduralProjectFiles = React.useMemo(() => {
    const list = Array.isArray(sceneConfig?.procedural_presets) ? sceneConfig.procedural_presets : [];
    const items = list
      .map((preset) => {
        const key = String(preset?.key || "").trim();
        if (!key) return null;
        const folder = String(preset?.folder || "").trim();
        const name = String(preset?.name || `Preset ${key.slice(-4)}`);
        return {
          key,
          folder,
          name,
          fileName: `${folder ? `${folder}/` : ""}${name}.3dpreset`,
          proceduralPreset: preset,
        };
      })
      .filter(Boolean);
    const filtered = projectBrowserFolderFilter === "all"
      ? items
      : items.filter((item) => String(item.folder || "") === String(projectBrowserFolderFilter || ""));
    return filtered.sort((a, b) => {
      const af = String(a.folder || "");
      const bf = String(b.folder || "");
      if (af !== bf) return af.localeCompare(bf, "pt-BR");
      return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
  }, [projectBrowserFolderFilter, sceneConfig?.procedural_presets]);

  const devModelTextureOptions = React.useMemo(() => {
    const byUrl = new Map();
    const addImage = (url, sourceLabel = "Upload") => {
      const value = String(url || "").trim();
      if (!value) return;
      const resolvedValue = resolveGalleryAssetUrl(value) || value;
      if (!isSceneAssetUrlCandidate(resolvedValue)) return;
      if (byUrl.has(resolvedValue)) return;
      const fileName = getAssetFileName(resolvedValue);
      if (detectAssetTypeFromName(fileName) !== "image") return;
      byUrl.set(resolvedValue, {
        value: resolvedValue,
        fileName,
        label: `${fileName} (${sourceLabel})`,
      });
    };
    devAssetLibraryOptions.forEach((item) => addImage(item?.value, "Biblioteca"));
    devSceneImageGalleryOptions.forEach((item) => addImage(item?.value, "Cenario"));
    return Array.from(byUrl.values());
  }, [devAssetLibraryOptions, devSceneImageGalleryOptions]);

  const modelSideOptions = React.useMemo(() => {
    if (devModelPrimitive === "cylinder") {
      return [
        { key: "side", label: "Lateral" },
        { key: "top", label: "Topo" },
        { key: "bottom", label: "Base" },
      ];
    }
    if (devModelPrimitive === "plane") {
      return [
        { key: "front", label: "Frente" },
        { key: "back", label: "Verso" },
      ];
    }
    if (devModelPrimitive === "sphere") {
      return [{ key: "surface", label: "Superficie" }];
    }
    return [
      { key: "px", label: "Direita (+X)" },
      { key: "nx", label: "Esquerda (-X)" },
      { key: "py", label: "Topo (+Y)" },
      { key: "ny", label: "Base (-Y)" },
      { key: "pz", label: "Frente (+Z)" },
      { key: "nz", label: "Tras (-Z)" },
    ];
  }, [devModelPrimitive]);
  const selectedModelSideTextureUrl = React.useMemo(() => {
    const side = String(devModelSelectedSide || "").trim();
    if (!side) return "";
    const sideTexture = String(devModelSideTextures?.[side] || "").trim();
    if (sideTexture) return sideTexture;
    return String(devModelSelectedTexture || "").trim();
  }, [devModelSelectedSide, devModelSelectedTexture, devModelSideTextures]);

  const devModelPolygonEstimate = React.useMemo(() => {
    const toSeg = (value, fallback = 1, min = 1, max = 64) => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    if (devModelPrimitive === "cylinder") {
      const radial = toSeg(devModelRadialSegments, 8, 3, 64);
      const heightSeg = toSeg(devModelHeightSegments, 1, 1, 64);
      return radial * heightSeg * 2 + radial * 2;
    }
    if (devModelPrimitive === "plane") {
      const w = toSeg(devModelWidthSegments, 1, 1, 64);
      const h = toSeg(devModelHeightSegments, 1, 1, 64);
      return w * h * 2;
    }
    if (devModelPrimitive === "sphere") {
      const w = toSeg(devModelWidthSegments, 16, 3, 64);
      const h = toSeg(devModelHeightSegments, 12, 2, 64);
      return w * h * 2;
    }
    const ws = toSeg(devModelWidthSegments, 1, 1, 64);
    const hs = toSeg(devModelHeightSegments, 1, 1, 64);
    const ds = toSeg(devModelDepthSegments, 1, 1, 64);
    return 4 * (ws * hs + ws * ds + hs * ds);
  }, [devModelDepthSegments, devModelHeightSegments, devModelPrimitive, devModelRadialSegments, devModelWidthSegments]);
  const devModelPolyBudgetStatus = React.useMemo(() => {
    const tris = Number(devModelPolygonEstimate) || 0;
    if (tris <= 1500) return { label: "OK mobile", tone: "ok" };
    if (tris <= 3000) return { label: "Atencao", tone: "warn" };
    return { label: "Estourou", tone: "bad" };
  }, [devModelPolygonEstimate]);
  React.useEffect(() => {
    if (!modelSideOptions.length) return;
    const exists = modelSideOptions.some((item) => item.key === devModelSelectedSide);
    if (!exists) setDevModelSelectedSide(modelSideOptions[0].key);
  }, [devModelSelectedSide, modelSideOptions]);
  React.useEffect(() => {
    if (!isModelerOpen) return;
    if (String(devEditingPresetKey || "").trim()) return;
    if (String(devEditingPresetName || "").trim()) return;
    const key = String(devSelectedObject?.key || "");
    if (!key.startsWith("custom_")) return;
    const list = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    const entry = list.find((item) => String(item?.key || "") === key);
    if (!entry) return;
    const isProcedural =
      String(entry?.media_type || "") === "procedural" || String(entry?.procedural_type || "").trim();
    if (!isProcedural) return;
    const primitive = String(entry?.procedural_type || "box");
    setDevModelPrimitive((prev) => (prev === primitive ? prev : primitive));
    const sideTextures = entry?.side_textures && typeof entry.side_textures === "object" ? entry.side_textures : {};
    const sideTextureSettings = normalizeSideTextureSettings(entry?.side_texture_settings);
    setDevModelSideTextures(sideTextures);
    setDevModelSideTextureSettings(sideTextureSettings);
    if (!devModelSelectedTexture) {
      const firstTexture = String(entry?.texture_url || sideTextures?.surface || sideTextures?.px || sideTextures?.side || sideTextures?.front || "");
      if (firstTexture) setDevModelSelectedTexture(firstTexture);
    }
    setDevModelTextureDraft(
      normalizeTextureSettings(
        sideTextureSettings?.[String(devModelSelectedSide || "").trim()] ||
          entry?.texture_settings ||
          {}
      )
    );
    if (entry?.procedural_vertex_offsets && typeof entry.procedural_vertex_offsets === "object") {
      setDevModelDraftOffsets(entry.procedural_vertex_offsets);
    }
    if (entry?.procedural_vertex_colors && typeof entry.procedural_vertex_colors === "object") {
      setDevModelDraftVertexColors(normalizeVertexColorsForUndo(entry.procedural_vertex_colors));
    } else {
      setDevModelDraftVertexColors({});
    }
  }, [
    devEditingPresetKey,
    devEditingPresetName,
    devModelSelectedSide,
    devModelSelectedTexture,
    devSelectedObject?.key,
    isModelerOpen,
    sceneConfig?.custom_objects,
  ]);

  React.useEffect(() => {
    const side = String(devModelSelectedSide || "").trim();
    if (!side) return;
    setDevModelTextureDraft((prev) => {
      const next = normalizeTextureSettings(devModelSideTextureSettings?.[side] || {});
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
  }, [devModelSelectedSide, devModelSideTextureSettings]);

  const resolvedSceneRoadTextureUrl = React.useMemo(() => {
    const raw = String(sceneConfig?.road_texture_url || "").trim();
    if (!raw || isLegacyProjectAssetPath(raw)) return "";
    return raw;
  }, [sceneConfig?.road_texture_url]);

  const resolvedSceneHorizonTextureUrl = React.useMemo(() => {
    const raw = String(sceneConfig?.horizon_texture_url || "").trim();
    if (!raw || isLegacyProjectAssetPath(raw)) return "";
    return raw;
  }, [sceneConfig?.horizon_texture_url]);

  const pointerRef = React.useRef({
    pointers: new Map(),
    mode: "idle",
    moved: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartCameraX: 0,
    dragStartCameraY: 0,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    pinchAnchorWorldX: 0,
    pinchAnchorWorldY: 0,
    lastX: 0,
    lastY: 0,
    lastMoveTs: 0,
    velocityX: 0,
    velocityY: 0,
    inertiaRaf: 0,
    suppressTapUntilNextDown: false,
  });
  const mapViewStateSyncRef = React.useRef({ rafId: 0, lastTs: 0 });

  const cameraRef = React.useRef(camera);
  const zoomRef = React.useRef(zoom);
  const runnerRef = React.useRef(createDefaultRunnerRuntimeState());
  // Keep the live simulation state out of React so the scene can read it without a component render every frame.
  const runnerRuntimeStateRef = React.useRef(createDefaultRunnerState());
  const isRunnerPausedRef = React.useRef(isRunnerPaused);
  const isDevNoCollisionRef = React.useRef(isDevNoCollision);
  const runnerTimeScaleRef = React.useRef(runnerTimeScale);
  const playerInventoryRef = React.useRef(playerInventory);
  const selectedIslandIdRef = React.useRef(selectedIslandId);
  const dailyIslandIdRef = React.useRef(dailyIslandId);
  const selectedCharacterIdRef = React.useRef(selectedCharacterId);
  const equippedPerkIdsRef = React.useRef(equippedPerkIds);
  const runnerConfigRef = React.useRef(runnerConfig);
  const selectedConsumableIdRef = React.useRef(selectedConsumableId);
  const challengeTouchRef = React.useRef({ startX: 0, startY: 0, active: false, swipeConsumed: false });
  const activeSessionIdRef = React.useRef(null);
  const didPersistResultRef = React.useRef(false);
  const currentNodeRef = React.useRef(currentNode);
  const collisionCinematicTimeoutRef = React.useRef(0);
  const resultChestTimeoutRef = React.useRef(0);
  const visitedNodesRef = React.useRef(visitedNodes);
  const island001VideoRef = React.useRef(null);
  const bossRecoveryRef = React.useRef("");
  const horizonRecoveryRef = React.useRef("");
  const [isIsland001Ready, setIsIsland001Ready] = React.useState(false);
  const marAnimadoVideoRef = React.useRef(null);
  const [isMarAnimadoReady, setIsMarAnimadoReady] = React.useState(false);
  const horizonImageRef = React.useRef(null);
  const [isHorizonReady, setIsHorizonReady] = React.useState(false);
  const ilhaCentralFundoRef = React.useRef(null);
  const [isIlhaCentralFundoReady, setIsIlhaCentralFundoReady] = React.useState(false);
  const sombraNunvensRef = React.useRef(null);
  const [isSombraNunvensReady, setIsSombraNunvensReady] = React.useState(false);
  const ilhaLevel2OkRef = React.useRef(null);
  const [isIlhaLevel2OkReady, setIsIlhaLevel2OkReady] = React.useState(false);
  const ilhaLevel2Ref = React.useRef(null);
  const [isIlhaLevel2Ready, setIsIlhaLevel2Ready] = React.useState(false);
  const ilhaLevel3Ref = React.useRef(null);
  const [isIlhaLevel3Ready, setIsIlhaLevel3Ready] = React.useState(false);
  const ilhaLevel4Ref = React.useRef(null);
  const [isIlhaLevel4Ready, setIsIlhaLevel4Ready] = React.useState(false);
  const nuvemCantoSuperiorEsquerdoRef = React.useRef(null);
  const [isNuvemCantoSuperiorEsquerdoReady, setIsNuvemCantoSuperiorEsquerdoReady] = React.useState(false);
  const nuvemCantoSuperiorDireitoRef = React.useRef(null);
  const [isNuvemCantoSuperiorDireitoReady, setIsNuvemCantoSuperiorDireitoReady] = React.useState(false);
  const nuvemCantoInferiorEsquerdoRef = React.useRef(null);
  const [isNuvemCantoInferiorEsquerdoReady, setIsNuvemCantoInferiorEsquerdoReady] = React.useState(false);
  const nuvemCantoInferiorDireitoRef = React.useRef(null);
  const [isNuvemCantoInferiorDireitoReady, setIsNuvemCantoInferiorDireitoReady] = React.useState(false);
  const areCriticalMapAssetsReady = React.useMemo(() => {
    const baseReady =
      isHorizonReady &&
      isIlhaCentralFundoReady &&
      isSombraNunvensReady &&
      isIlhaLevel2OkReady &&
      isIlhaLevel2Ready &&
      isIlhaLevel3Ready &&
      isIlhaLevel4Ready &&
      isNuvemCantoSuperiorEsquerdoReady &&
      isNuvemCantoSuperiorDireitoReady &&
      isNuvemCantoInferiorEsquerdoReady &&
      isNuvemCantoInferiorDireitoReady;
    if (!baseReady) return false;
    if (ENABLE_SEA_VIDEO && !isIsland001Ready) return false;
    if (!isMarAnimadoReady) return false;
    return true;
  }, [
    isHorizonReady,
    isIlhaCentralFundoReady,
    isIlhaLevel2OkReady,
    isIlhaLevel2Ready,
    isIlhaLevel3Ready,
    isIlhaLevel4Ready,
    isIsland001Ready,
    isMarAnimadoReady,
    isNuvemCantoInferiorDireitoReady,
    isNuvemCantoInferiorEsquerdoReady,
    isNuvemCantoSuperiorDireitoReady,
    isNuvemCantoSuperiorEsquerdoReady,
    isSombraNunvensReady,
  ]);
  const didInitMapCameraRef = React.useRef(false);
  const mapIntroRafRef = React.useRef(0);
  const isPageVisibleRef = React.useRef(typeof document === "undefined" ? true : !document.hidden);
  const mapAmbientAudioRef = React.useRef(null);
  const gameplayMusicAudioRef = React.useRef(null);
  const dailyEventMenuClickAudioRef = React.useRef(null);
  const islandPlayButtonAudioRef = React.useRef(null);
  const mapLensIntroLogoAudioRef = React.useRef(null);
  const mapLensReturnClickAudioRef = React.useRef(null);
  const resultChestOpenAudioRef = React.useRef(null);
  const resultChestTurnAudioRef = React.useRef(null);
  const commonRewardCollectAudioRef = React.useRef(null);
  const premiumRewardCollectAudioRef = React.useRef(null);
  const resultCoinsBarAudioRef = React.useRef(null);
  const unlockIslandLevelAudioRef = React.useRef(null);
  const moneyRainPickupAudioRef = React.useRef(null);
  const moneyRainPickupAudioPoolRef = React.useRef([]);
  const moneyRainPickupAudioVoiceStateRef = React.useRef([]);
  const hasPrimedGameplayMusicRef = React.useRef(false);
  const lastUnlockedMaxDaySoundRef = React.useRef(0);
  const hasPlayedMapLensIntroLogoRef = React.useRef(false);
  const [soundPrefs, setSoundPrefs] = React.useState(() => getSoundPrefs());
  const challengeContainerRef = React.useRef(null);
  const devPanelRef = React.useRef(null);
  const devAutoSaveTimerRef = React.useRef(0);
  const devConveyorRef = React.useRef(null);
  const selectedTextureUploadInputRef = React.useRef(null);
  const galleryUploadInputRef = React.useRef(null);
  const modelerTextureUploadInputRef = React.useRef(null);
  const modelerImport3dInputRef = React.useRef(null);
  const wardrobeUploadInputRef = React.useRef(null);
  const loadoutBaseModelInputRef = React.useRef(null);
  const devPanelDragRef = React.useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const devContextMenuDragRef = React.useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const devConveyorDragRef = React.useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const devConveyorPressRef = React.useRef({
    pointerId: null,
    holdTimer: 0,
    repeatTimer: 0,
  });
  const patchSceneConfigQueueRef = React.useRef(Promise.resolve());
  const handleApplySelectedObjectEditsRef = React.useRef(null);

  const playAudioRef = React.useCallback((audioRef, { volume = 1, enabled = true, reset = true } = {}) => {
    if (!enabled) return;
    const audio = audioRef?.current;
    if (!audio) return;
    try {
      audio.volume = Math.max(0, Math.min(1, volume));
      if (reset) audio.currentTime = 0;
      audio.play?.().catch(() => {});
    } catch {
      // Ignore playback failures caused by mobile/browser restrictions.
    }
  }, []);

  const playAudioElementRef = React.useCallback((audio, { volume = 1, enabled = true, reset = true } = {}) => {
    if (!enabled || !audio) return;
    try {
      audio.volume = Math.max(0, Math.min(1, volume));
      if (reset) {
        audio.pause?.();
        audio.currentTime = 0;
      }
      audio.play?.().catch(() => {});
    } catch {
      // Ignore playback failures caused by mobile/browser restrictions.
    }
  }, []);

  const playPooledMoneyRainPickupRef = React.useCallback(
    ({ volume = 0.96, enabled = true } = {}) => {
      if (!enabled) return;
      const pool = moneyRainPickupAudioPoolRef.current;
      const fallback = moneyRainPickupAudioRef.current;
      if (!pool.length) {
        playAudioElementRef(fallback, { volume, enabled, reset: true });
        return;
      }
      const voiceState = moneyRainPickupAudioVoiceStateRef.current;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      let selectedIndex = pool.findIndex((audio) => audio?.paused || audio?.ended);
      if (selectedIndex < 0) {
        let oldestStartedAt = Number.POSITIVE_INFINITY;
        selectedIndex = 0;
        for (let index = 0; index < pool.length; index += 1) {
          const startedAt = voiceState[index] || 0;
          if (startedAt < oldestStartedAt) {
            oldestStartedAt = startedAt;
            selectedIndex = index;
          }
        }
      }
      const selectedAudio = pool[selectedIndex] || fallback;
      if (!selectedAudio) return;
      voiceState[selectedIndex] = now;
      try {
        selectedAudio.pause?.();
        selectedAudio.currentTime = 0;
        selectedAudio.playbackRate = 1.8;
        if ("preservesPitch" in selectedAudio) selectedAudio.preservesPitch = false;
        if ("mozPreservesPitch" in selectedAudio) selectedAudio.mozPreservesPitch = false;
        if ("webkitPreservesPitch" in selectedAudio) selectedAudio.webkitPreservesPitch = false;
      } catch {
        // noop
      }
      playAudioElementRef(selectedAudio, { volume, enabled, reset: false });
    },
    [playAudioElementRef]
  );

  const playGameplayMusicRef = React.useCallback(() => {
    const audio = gameplayMusicAudioRef.current;
    if (!audio) return;
    audio.muted = !soundPrefs.gameMusicEnabled;
    audio.volume = Math.max(0, Math.min(1, (soundPrefs.gameMusicVolume || 0) * 0.26));
    if (!soundPrefs.gameMusicEnabled || document.hidden) {
      audio.pause();
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    const playAttempt = audio.play?.();
    if (playAttempt?.catch) playAttempt.catch(() => {});
  }, [soundPrefs.gameMusicEnabled, soundPrefs.gameMusicVolume]);

  const stopGameplayMusicRef = React.useCallback(() => {
    const audio = gameplayMusicAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const primeGameplayMusicRef = React.useCallback(() => {
    if (hasPrimedGameplayMusicRef.current) return;
    const audio = gameplayMusicAudioRef.current;
    if (!audio) return;
    hasPrimedGameplayMusicRef.current = true;
    try {
      const previousMuted = audio.muted;
      const previousVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
      const playAttempt = audio.play?.();
      if (playAttempt?.then) {
        playAttempt
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = previousMuted;
            audio.volume = previousVolume;
          })
          .catch(() => {
            hasPrimedGameplayMusicRef.current = false;
            audio.muted = previousMuted;
            audio.volume = previousVolume;
          });
        return;
      }
      audio.pause();
      audio.currentTime = 0;
      audio.muted = previousMuted;
      audio.volume = previousVolume;
    } catch {
      hasPrimedGameplayMusicRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (!lastUnlockedMaxDaySoundRef.current) {
      lastUnlockedMaxDaySoundRef.current = unlockedMaxDay;
      return;
    }
    if (unlockedMaxDay > lastUnlockedMaxDaySoundRef.current) {
      playAudioRef(unlockIslandLevelAudioRef, {
        enabled: isInteractionSoundEnabled(),
        volume: 0.88,
      });
    }
    lastUnlockedMaxDaySoundRef.current = unlockedMaxDay;
  }, [playAudioRef, unlockedMaxDay]);

  React.useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  React.useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const flushMapViewportState = React.useCallback(() => {
    const sync = mapViewStateSyncRef.current;
    sync.rafId = 0;
    sync.lastTs = performance.now();
    const nextCamera = cameraRef.current;
    const nextZoom = zoomRef.current;
    setCamera((prev) =>
      Math.abs(prev.x - nextCamera.x) < 0.01 && Math.abs(prev.y - nextCamera.y) < 0.01 ? prev : nextCamera
    );
    setZoom((prev) => (Math.abs(prev - nextZoom) < 0.0001 ? prev : nextZoom));
  }, []);

  const syncMapViewportState = React.useCallback(
    (force = false) => {
      const sync = mapViewStateSyncRef.current;
      if (sync.rafId && force) {
        cancelAnimationFrame(sync.rafId);
        sync.rafId = 0;
      }
      if (force || !isLowPerfMapDevice || pointerRef.current.mode !== "drag") {
        flushMapViewportState();
        return;
      }
      const now = performance.now();
      if (sync.rafId || now - sync.lastTs < 42) return;
      sync.rafId = requestAnimationFrame(() => {
        flushMapViewportState();
      });
    },
    [flushMapViewportState, isLowPerfMapDevice]
  );

  React.useEffect(
    () => () => {
      const sync = mapViewStateSyncRef.current;
      if (sync.rafId) {
        cancelAnimationFrame(sync.rafId);
        sync.rafId = 0;
      }
    },
    []
  );

  React.useEffect(() => {
    currentNodeRef.current = currentNode;
  }, [currentNode]);

  React.useEffect(() => {
    isRunnerPausedRef.current = isRunnerPaused;
  }, [isRunnerPaused]);

  React.useEffect(() => {
    isDevNoCollisionRef.current = isDevNoCollision;
  }, [isDevNoCollision]);

  React.useEffect(() => {
    runnerTimeScaleRef.current = runnerTimeScale;
  }, [runnerTimeScale]);
  React.useEffect(() => {
    playerInventoryRef.current = playerInventory;
  }, [playerInventory]);
  React.useEffect(() => {
    selectedIslandIdRef.current = selectedIslandId;
  }, [selectedIslandId]);
  React.useEffect(() => {
    dailyIslandIdRef.current = dailyIslandId;
  }, [dailyIslandId]);
  React.useEffect(() => {
    selectedCharacterIdRef.current = selectedCharacterId;
  }, [selectedCharacterId]);
  React.useEffect(() => {
    equippedPerkIdsRef.current = equippedPerkIds;
  }, [equippedPerkIds]);
  React.useEffect(() => {
    runnerConfigRef.current = runnerConfig;
  }, [runnerConfig]);
  React.useEffect(() => {
    sceneConfigRef.current = sceneConfig;
  }, [sceneConfig]);
  React.useEffect(() => {
    selectedConsumableIdRef.current = selectedConsumableId;
  }, [selectedConsumableId]);

  React.useEffect(() => {
    devSelectedObjectKeyRef.current = String(devSelectedObject?.key || "");
  }, [devSelectedObject?.key]);

  React.useEffect(() => {
    visitedNodesRef.current = visitedNodes;
  }, [visitedNodes]);

  React.useEffect(() => {
    let cancelled = false;
    setIsSceneConfigLoading(true);
    setDevSelectedObject(null);
    setDevDraftOverrides({});
    setDevPositionDraft({ x: "0", y: "0", z: "0" });
    setDevScaleDraft({ scale: "1.00", scaleX: "1.00", scaleY: "1.00", scaleZ: "1.00" });
    loadIslandSceneConfig(selectedIslandDay)
      .then((result) => {
        if (cancelled) return;
        const rawConfig = {
          ...createDefaultSceneConfig(selectedIslandDay),
          ...(result?.config || {}),
          island_day: selectedIslandDay,
        };
        const rawCustomObjects = Array.isArray(rawConfig?.custom_objects) ? rawConfig.custom_objects : [];
        const normalizedCustomObjects = rawCustomObjects
          .map((item) => {
            const sideTextures =
              item?.side_textures && typeof item.side_textures === "object" ? item.side_textures : {};
            const normalizedSideTextures = {};
            Object.entries(sideTextures).forEach(([sideKey, sideUrl]) => {
              if (!isSceneAssetUrlCandidate(sideUrl)) return;
              normalizedSideTextures[String(sideKey)] = String(sideUrl).trim();
            });
            return {
              ...item,
              texture_url: isSceneAssetUrlCandidate(item?.texture_url) ? String(item?.texture_url).trim() : "",
              model_url: isSceneAssetUrlCandidate(item?.model_url) ? String(item?.model_url).trim() : "",
              model_name: String(item?.model_name || item?.modelName || "").trim(),
              media_type: String(item?.media_type || ""),
              procedural_type: String(item?.procedural_type || ""),
              side_textures: normalizedSideTextures,
              side_texture_settings: normalizeSideTextureSettings(item?.side_texture_settings),
              texture_settings: normalizeTextureSettings(item?.texture_settings),
            };
          })
          .filter((item) => {
            const hasAsset = String(item?.texture_url || "").trim() || String(item?.model_url || "").trim();
            const isProcedural = String(item?.media_type || "") === "procedural" || String(item?.procedural_type || "").trim();
            const hasProceduralSideTextures =
              item?.side_textures &&
              typeof item.side_textures === "object" &&
              Object.keys(item.side_textures).length > 0;
            return hasAsset || isProcedural || hasProceduralSideTextures;
          });
        const rawOverrides =
          rawConfig?.object_overrides && typeof rawConfig.object_overrides === "object"
            ? rawConfig.object_overrides
            : {};
        const normalizedOverrides = {};
        Object.entries(rawOverrides).forEach(([key, value]) => {
          if (!value || typeof value !== "object") return;
          normalizedOverrides[key] = sanitizeFixedSceneOverride(key, value);
        });
        const normalizedConfig = {
          ...rawConfig,
          road_texture_url: isLegacyProjectAssetPath(rawConfig?.road_texture_url) ? "" : String(rawConfig?.road_texture_url || ""),
          horizon_texture_url: isLegacyProjectAssetPath(rawConfig?.horizon_texture_url) ? "" : String(rawConfig?.horizon_texture_url || ""),
          base_only_mode: Boolean(rawConfig?.base_only_mode),
          custom_objects: normalizedCustomObjects,
          object_overrides: normalizedOverrides,
        };
        setSceneConfigRecordId(result?.id || null);
        setSceneConfig(normalizedConfig);
        const shouldHealLegacy =
          normalizedConfig.road_texture_url !== String(rawConfig?.road_texture_url || "") ||
          normalizedConfig.horizon_texture_url !== String(rawConfig?.horizon_texture_url || "") ||
          normalizedConfig.base_only_mode !== Boolean(rawConfig?.base_only_mode) ||
          JSON.stringify(normalizedCustomObjects) !== JSON.stringify(rawCustomObjects) ||
          JSON.stringify(normalizedOverrides) !== JSON.stringify(rawOverrides);
        if (shouldHealLegacy) {
          void saveIslandSceneConfig({
            id: result?.id || null,
            islandDay: selectedIslandDay,
            patch: {
              road_texture_url: normalizedConfig.road_texture_url,
              horizon_texture_url: normalizedConfig.horizon_texture_url,
              base_only_mode: normalizedConfig.base_only_mode,
              custom_objects: normalizedCustomObjects,
              object_overrides: normalizedOverrides,
            },
          }).catch(() => null);
        }
        setCopyFromIslandDay((prev) => {
          if (Number.isFinite(prev) && prev >= 1) return prev;
          return Math.max(1, selectedIslandDay - 1);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSceneConfigRecordId(null);
        setSceneConfig(createDefaultSceneConfig(selectedIslandDay));
        setSceneConfigMessage("Falha ao carregar configuracao da ilha.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsSceneConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIslandDay]);

  React.useEffect(() => {
    if (!ENABLE_SEA_VIDEO) return undefined;
    const video = document.createElement("video");
    video.src = island001Video;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";
    const onReady = () => {
      island001VideoRef.current = video;
      setIsIsland001Ready(true);
    };
    video.addEventListener("loadeddata", onReady);
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
    return () => {
      video.pause();
      video.removeEventListener("loadeddata", onReady);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = horizonteImage;
    image.onload = () => {
      horizonImageRef.current = image;
      setIsHorizonReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = ilhaCentralFundoImage;
    image.onload = () => {
      ilhaCentralFundoRef.current = image;
      setIsIlhaCentralFundoReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = sombraDeNunvensImage;
    image.onload = () => {
      sombraNunvensRef.current = image;
      setIsSombraNunvensReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = ilhaLevel2OkImage;
    image.onload = () => {
      ilhaLevel2OkRef.current = image;
      setIsIlhaLevel2OkReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = ilhaLevel2Image;
    image.onload = () => {
      ilhaLevel2Ref.current = image;
      setIsIlhaLevel2Ready(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = ilhaLevel3Image;
    image.onload = () => {
      ilhaLevel3Ref.current = image;
      setIsIlhaLevel3Ready(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = ilhaLevel4Image;
    image.onload = () => {
      ilhaLevel4Ref.current = image;
      setIsIlhaLevel4Ready(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = nuvemCantoSuperiorEsquerdoImage;
    image.onload = () => {
      nuvemCantoSuperiorEsquerdoRef.current = image;
      setIsNuvemCantoSuperiorEsquerdoReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = nuvemCantoSuperiorDireitoImage;
    image.onload = () => {
      nuvemCantoSuperiorDireitoRef.current = image;
      setIsNuvemCantoSuperiorDireitoReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = nuvemCantoInferiorEsquerdoImage;
    image.onload = () => {
      nuvemCantoInferiorEsquerdoRef.current = image;
      setIsNuvemCantoInferiorEsquerdoReady(true);
    };
  }, []);

  React.useEffect(() => {
    const image = new Image();
    image.src = nuvemCantoInferiorDireitoImage;
    image.onload = () => {
      nuvemCantoInferiorDireitoRef.current = image;
      setIsNuvemCantoInferiorDireitoReady(true);
    };
  }, []);

  React.useEffect(() => {
    const video = document.createElement("video");
    video.src = marAnimadoVideo;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.preload = "auto";
    marAnimadoVideoRef.current = video;
    const markReady = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      setIsMarAnimadoReady(true);
    };
    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.load();
    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, []);

  React.useEffect(() => {
    const handlePrefsChanged = (event) => {
      setSoundPrefs(event?.detail || getSoundPrefs());
    };
    window.addEventListener("souza:sound-prefs-changed", handlePrefsChanged);
    return () => {
      window.removeEventListener("souza:sound-prefs-changed", handlePrefsChanged);
    };
  }, []);

  React.useEffect(() => {
    const audio = new Audio(mapAmbientMusic);
    audio.loop = true;
    audio.preload = "auto";
    audio.muted = !soundPrefs.gameMusicEnabled;
    audio.volume = soundPrefs.gameMusicVolume;
    mapAmbientAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  React.useEffect(() => {
    const gameplayAudio = new Audio(gameplayMusicSound);
    gameplayAudio.loop = true;
    gameplayAudio.preload = "auto";
    gameplayAudio.muted = !soundPrefs.gameMusicEnabled;
    gameplayAudio.volume = Math.max(0, Math.min(1, (soundPrefs.gameMusicVolume || 0) * 0.26));
    gameplayAudio.load();
    gameplayMusicAudioRef.current = gameplayAudio;

    const menuClickAudio = new Audio(dailyEventMenuClickSound);
    menuClickAudio.preload = "auto";
    dailyEventMenuClickAudioRef.current = menuClickAudio;

    const islandPlayAudio = new Audio(islandPlayButtonSound);
    islandPlayAudio.preload = "auto";
    islandPlayAudio.load();
    islandPlayButtonAudioRef.current = islandPlayAudio;

    const mapLensIntroLogoAudio = new Audio(appOpenLogoSound);
    mapLensIntroLogoAudio.preload = "auto";
    mapLensIntroLogoAudioRef.current = mapLensIntroLogoAudio;

    const mapReturnAudio = new Audio(mapLensReturnClickSound);
    mapReturnAudio.preload = "auto";
    mapLensReturnClickAudioRef.current = mapReturnAudio;

    const chestOpenAudio = new Audio(resultChestOpenSound);
    chestOpenAudio.preload = "auto";
    resultChestOpenAudioRef.current = chestOpenAudio;

    const chestTurnAudio = new Audio(resultChestTurnSound);
    chestTurnAudio.preload = "auto";
    resultChestTurnAudioRef.current = chestTurnAudio;

    const commonCollectAudio = new Audio(commonRewardCollectSound);
    commonCollectAudio.preload = "auto";
    commonRewardCollectAudioRef.current = commonCollectAudio;

    const premiumCollectAudio = new Audio(premiumRewardCollectSound);
    premiumCollectAudio.preload = "auto";
    premiumCollectAudio.load();
    premiumRewardCollectAudioRef.current = premiumCollectAudio;

    const coinsBarAudio = new Audio(resultCoinsBarSound);
    coinsBarAudio.preload = "auto";
    resultCoinsBarAudioRef.current = coinsBarAudio;

    const unlockAudio = new Audio(unlockIslandLevelSound);
    unlockAudio.preload = "auto";
    unlockIslandLevelAudioRef.current = unlockAudio;

    const moneyRainAudio = new Audio(moneyRainPickupSound);
    moneyRainAudio.preload = "auto";
    moneyRainAudio.load();
    moneyRainPickupAudioRef.current = moneyRainAudio;
    moneyRainPickupAudioPoolRef.current = Array.from({ length: 16 }, () => {
      const pooledAudio = new Audio(moneyRainPickupSound);
      pooledAudio.preload = "auto";
      pooledAudio.playbackRate = 1.8;
      pooledAudio.load();
      return pooledAudio;
    });
    moneyRainPickupAudioVoiceStateRef.current = Array.from({ length: 16 }, () => 0);

    return () => {
      gameplayAudio.pause();
      gameplayAudio.currentTime = 0;
      gameplayMusicAudioRef.current = null;
      dailyEventMenuClickAudioRef.current = null;
      islandPlayButtonAudioRef.current = null;
      mapLensIntroLogoAudioRef.current = null;
      mapLensReturnClickAudioRef.current = null;
      resultChestOpenAudioRef.current = null;
      resultChestTurnAudioRef.current = null;
      commonRewardCollectAudioRef.current = null;
      premiumRewardCollectAudioRef.current = null;
      resultCoinsBarAudioRef.current = null;
      unlockIslandLevelAudioRef.current = null;
      moneyRainPickupAudioRef.current = null;
      moneyRainPickupAudioPoolRef.current = [];
      moneyRainPickupAudioVoiceStateRef.current = [];
    };
  }, []);

  React.useEffect(() => {
    const audio = mapAmbientAudioRef.current;
    if (!audio) return;
    audio.muted = !soundPrefs.gameMusicEnabled;
    audio.volume = soundPrefs.gameMusicVolume;
    if (!soundPrefs.gameMusicEnabled) {
      audio.pause();
    } else if (phase === "game" && screen === "map" && !document.hidden) {
      const playAmbient = audio.play?.();
      if (playAmbient?.catch) playAmbient.catch(() => {});
    }
  }, [phase, screen, soundPrefs.gameMusicEnabled, soundPrefs.gameMusicVolume]);

  React.useEffect(() => {
    const audio = gameplayMusicAudioRef.current;
    if (!audio) return;
    audio.muted = !soundPrefs.gameMusicEnabled;
    audio.volume = Math.max(0, Math.min(1, (soundPrefs.gameMusicVolume || 0) * 0.26));
    const shouldPlayGameplayMusic =
      soundPrefs.gameMusicEnabled &&
      phase === "game" &&
      screen === "challenge" &&
      !document.hidden;
    if (shouldPlayGameplayMusic) {
      playGameplayMusicRef();
      return;
    }
    stopGameplayMusicRef();
  }, [phase, playGameplayMusicRef, screen, soundPrefs.gameMusicEnabled, soundPrefs.gameMusicVolume, stopGameplayMusicRef]);

  const world = React.useMemo(() => {
    return {
      width: Math.max(1180, Math.floor(size.width * 2.8)),
      height: Math.max(1500, Math.floor(size.height * 2.2)),
    };
  }, [size.width, size.height]);

  const clampZoom = React.useCallback((value) => {
    return Math.max(0.8, Math.min(1.9, value));
  }, []);

  const clampCamera = React.useCallback(
    (rawX, rawY, nextZoom = zoomRef.current) => {
      const viewportWidth = size.width / nextZoom;
      const viewportHeight = size.height / nextZoom;
      const sidePadding = Math.max(viewportWidth * 0.42, 220);
      const minX = -sidePadding;
      const maxX = Math.max(minX, world.width - viewportWidth + sidePadding);
      const maxY = Math.max(0, world.height - viewportHeight);
      return {
        x: Math.max(minX, Math.min(maxX, rawX)),
        y: Math.max(0, Math.min(maxY, rawY)),
      };
    },
    [world.width, world.height, size.width, size.height]
  );

  const getMapLensFocusPoint = React.useCallback(
    () => ({
      x: size.width * 0.5,
      y: size.height * 0.47,
    }),
    [size.width, size.height]
  );

  const getMapNodeBaseScreenY = React.useCallback(
    (node) => {
      const worldX = node.x * world.width;
      const horizon = size.height * 0.58;
      const cinematicArc = Math.sin((worldX / Math.max(1, world.width)) * Math.PI * 1.35) * (size.height * 0.07);
      const depthOffset = (node.y - 0.56) * size.height * 0.26;
      return horizon + cinematicArc + depthOffset;
    },
    [size.height, world.width]
  );

  const getMapCameraForLensFocus = React.useCallback(
    (node, nextZoom = zoomRef.current, fallbackY = cameraRef.current.y) => {
      const lensFocus = getMapLensFocusPoint();
      const worldX = node.x * world.width;
      const baseScreenY = getMapNodeBaseScreenY(node);
      const targetX = worldX - lensFocus.x / nextZoom;
      const targetY = (baseScreenY - lensFocus.y) / 0.12;
      return clampCamera(targetX, Number.isFinite(targetY) ? targetY : fallbackY, nextZoom);
    },
    [clampCamera, getMapLensFocusPoint, getMapNodeBaseScreenY, world.width]
  );

  const focusMapIsland = React.useCallback((islandId, duration = 620) => {
    const targetNode = NODES[islandId] || NODES[0];
    if (!targetNode) return;
    if (mapIntroRafRef.current) {
      cancelAnimationFrame(mapIntroRafRef.current);
      mapIntroRafRef.current = 0;
    }
    const currentZoom = zoomRef.current;
    const currentCamera = cameraRef.current;
    const targetCamera = getMapCameraForLensFocus(targetNode, currentZoom, currentCamera.y);
    const startTs = performance.now();
    const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    setIsMapIntroPlaying(true);

    const animate = (ts) => {
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = easeInOutSine(t);
      const nextX = currentCamera.x + (targetCamera.x - currentCamera.x) * eased;
      const nextY = currentCamera.y + (targetCamera.y - currentCamera.y) * eased;
      setCamera(clampCamera(nextX, nextY, currentZoom));
      if (t < 1) {
        mapIntroRafRef.current = requestAnimationFrame(animate);
      } else {
        mapIntroRafRef.current = 0;
        setIsMapIntroPlaying(false);
      }
    };

    mapIntroRafRef.current = requestAnimationFrame(animate);
  }, [NODES, clampCamera, getMapCameraForLensFocus]);

  const projectNodeToScreen = React.useCallback(
    (node, cam = cameraRef.current, zm = zoomRef.current) => {
      const worldX = node.x * world.width;
      const horizon = size.height * 0.58;
      const cinematicArc = Math.sin((worldX / Math.max(1, world.width)) * Math.PI * 1.35) * (size.height * 0.07);
      const depthOffset = (node.y - 0.56) * size.height * 0.26;
      const x = (worldX - cam.x) * zm;
      const y = horizon + cinematicArc + depthOffset - cam.y * 0.12;
      return { x, y };
    },
    [world.width, size.height]
  );

  const visibleMapIslandOverlays = React.useMemo(() => {
    if (screen !== "map") return [];
    return NODES.map((node) => {
      const point = projectNodeToScreen(node);
      if (!point) return null;
      const x = point.x;
      const y = point.y;
      if (x < -140 || y < -180 || x > size.width + 140 || y > size.height + 180) return null;
      return {
        id: node.id,
        day: node.day,
        name: node.name,
        locked: !!node.locked,
        x,
        y,
        isSelected: node.id === selectedIslandId,
      };
    }).filter(Boolean);
  }, [NODES, projectNodeToScreen, screen, selectedIslandId, size.height, size.width]);

  React.useEffect(() => {
    const shouldPlayTransition = Boolean(location.state?.playEntryTransition);
    if (!shouldPlayTransition) {
      setPhase("loading");
      return;
    }
    const offsetMs = Math.max(0, Math.min(900, Number(location.state?.playEntryTransitionOffsetMs) || 0));
    const timeoutId = window.setTimeout(() => setPhase("loading"), Math.max(120, 1000 - offsetMs));
    return () => window.clearTimeout(timeoutId);
  }, [location.state]);

  React.useEffect(() => {
    if (phase !== "transition") return undefined;
    const offsetMs = Math.max(0, Math.min(900, Number(location.state?.playEntryTransitionOffsetMs) || 0));
    const video = pageEntryLeavesVideoRef.current;
    if (!video) return undefined;
    video.currentTime = offsetMs / 1000;
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
    return undefined;
  }, [location.state, phase]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map") {
      setIsStageMeasured(false);
      setIsMapCanvasPrimed(false);
      didPrimeMapCanvasRef.current = false;
      didInitMapCameraRef.current = false;
      setIsMapIntroPlaying(false);
      setIsMapLoadRevealActive(false);
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
    }
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "loading") {
      setLoadingProgress(0);
      setIsEntryShellWarmReady(false);
      setIsSceneBootWarmReady(false);
      setHasLoadingMinDurationElapsed(false);
      return undefined;
    }
    let cancelled = false;
    warmDailyEventAppShell().finally(() => {
      if (!cancelled) setIsEntryShellWarmReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "loading") return undefined;
    setHasLoadingMinDurationElapsed(false);
    const timerId = window.setTimeout(() => {
      setHasLoadingMinDurationElapsed(true);
    }, 1100);
    return () => window.clearTimeout(timerId);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "loading") return undefined;
    if (isSceneConfigLoading) {
      setIsSceneBootWarmReady(false);
      return undefined;
    }
    let cancelled = false;
    setIsSceneBootWarmReady(false);
    warmDailyEventSceneAssets(sceneConfig).finally(() => {
      if (!cancelled) setIsSceneBootWarmReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isSceneConfigLoading, phase, sceneConfig]);

  const loadingProgressTarget = React.useMemo(() => {
    if (phase !== "loading") return 0;
    let target = 10;
    if (isEntryShellWarmReady) target = 28;
    if (!isSceneConfigLoading) target = 52;
    if (areCriticalMapAssetsReady) target = 74;
    if (isSceneBootWarmReady) target = 90;
    if (
      isEntryShellWarmReady &&
      !isSceneConfigLoading &&
      areCriticalMapAssetsReady &&
      isSceneBootWarmReady
    ) {
      target = hasLoadingMinDurationElapsed ? 100 : 96;
    }
    return target;
  }, [
    areCriticalMapAssetsReady,
    hasLoadingMinDurationElapsed,
    isEntryShellWarmReady,
    isSceneBootWarmReady,
    isSceneConfigLoading,
    phase,
  ]);

  const loadingStatusText = React.useMemo(() => {
    if (!isEntryShellWarmReady) return "Abrindo pacote do jogo";
    if (isSceneConfigLoading) return "Carregando configuracao da ilha";
    if (!areCriticalMapAssetsReady) return "Preparando mapa e interface";
    if (!isSceneBootWarmReady) return "Montando cenario, texturas e modelos";
    if (!hasLoadingMinDurationElapsed) return "Finalizando render inicial";
    return "Tudo pronto";
  }, [
    areCriticalMapAssetsReady,
    hasLoadingMinDurationElapsed,
    isEntryShellWarmReady,
    isSceneBootWarmReady,
    isSceneConfigLoading,
  ]);

  React.useEffect(() => {
    if (phase !== "loading") return undefined;
    const intervalId = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= loadingProgressTarget) return prev;
        const distance = loadingProgressTarget - prev;
        const step = loadingProgressTarget >= 100 ? Math.max(2, Math.ceil(distance * 0.35)) : Math.max(1, Math.ceil(distance * 0.22));
        return Math.min(loadingProgressTarget, prev + step);
      });
    }, 48);
    return () => window.clearInterval(intervalId);
  }, [loadingProgressTarget, phase]);

  React.useEffect(() => {
    if (phase !== "loading") return undefined;
    if (
      !hasLoadingMinDurationElapsed ||
      !isEntryShellWarmReady ||
      isSceneConfigLoading ||
      !areCriticalMapAssetsReady ||
      !isSceneBootWarmReady
    ) {
      return undefined;
    }
    const timerId = window.setTimeout(() => setPhase("game"), 180);
    return () => window.clearTimeout(timerId);
  }, [
    areCriticalMapAssetsReady,
    hasLoadingMinDurationElapsed,
    isEntryShellWarmReady,
    isSceneBootWarmReady,
    isSceneConfigLoading,
    phase,
  ]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map" || !isMapCanvasPrimed) return undefined;
    setIsMapLoadRevealActive(true);
    const timerId = window.setTimeout(() => {
      setIsMapLoadRevealActive(false);
    }, 560);
    return () => window.clearTimeout(timerId);
  }, [isMapCanvasPrimed, phase, screen]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map" || !isMapCanvasPrimed) return undefined;
    const idleScheduler = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 240));
    const idleHandle = idleScheduler(() => {
      loadRunner3DSceneModule().catch(() => {});
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
        return;
      }
      window.clearTimeout(idleHandle);
    };
  }, [isMapCanvasPrimed, phase, screen]);

  React.useEffect(() => {
    if (screen !== "map") {
      setActiveMapBottomMenu("islands");
    }
  }, [screen]);

  const navigateMapMenu = React.useCallback((nextMenuId) => {
    if (nextMenuId === "islands") {
      playAudioRef(mapLensReturnClickAudioRef, {
        enabled: isMenuSoundEnabled(),
        volume: 0.92,
      });
    } else {
      playAudioRef(dailyEventMenuClickAudioRef, {
        enabled: isMenuSoundEnabled(),
        volume: 0.88,
      });
    }
    setActiveMapBottomMenu((currentMenuId) => {
      if (currentMenuId === nextMenuId) return currentMenuId;
      const currentIndex = Math.max(0, MAP_FULL_SCREEN_MENU_ORDER.indexOf(currentMenuId));
      const nextIndex = Math.max(0, MAP_FULL_SCREEN_MENU_ORDER.indexOf(nextMenuId));
      setMapMenuTransitionDirection(nextIndex >= currentIndex ? 1 : -1);
      return nextMenuId;
    });
  }, [playAudioRef]);

  const returnToMap = React.useCallback(() => {
    playAudioRef(mapLensReturnClickAudioRef, {
      enabled: isMenuSoundEnabled(),
      volume: 0.92,
    });
    setScreen("map");
  }, [playAudioRef]);

  React.useEffect(() => {
    const urls = [...MAP_BOTTOM_MENU_ITEMS.map((item) => item.icon), notificacaoIconeImage].filter(Boolean);
    urls.forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
  }, []);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map") return undefined;
    const measureStage = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSize({ width: Math.max(260, rect.width), height: Math.max(320, rect.height) });
      setIsStageMeasured(true);
    };
    measureStage();
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.max(260, rect.width), height: Math.max(320, rect.height) });
      setIsStageMeasured(true);
    });
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [phase, screen]);

  React.useEffect(() => {
    const updateViewport = () => setIsDesktopViewport(window.innerWidth >= 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map") return;
    if (!isStageMeasured) return;
    if (didInitMapCameraRef.current) return;
    const focusNode = NODES[currentNodeRef.current] || NODES[0];
    const targetZoom = 1.35;
    const targetCamera = getMapCameraForLensFocus(focusNode, targetZoom, cameraRef.current.y);
    setIsMapIntroPlaying(true);

    const introZoom = 0.82;
    const introX = targetCamera.x;
    const introY = Math.max(0, targetCamera.y - size.height * 1.05);
    const introCamera = clampCamera(introX, introY, introZoom);

    setZoom(introZoom);
    setCamera(introCamera);

    const startTs = performance.now();
    const duration = 1300;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (ts) => {
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = easeOutCubic(t);
      const nextZoom = introZoom + (targetZoom - introZoom) * eased;
      const nextX = introCamera.x + (targetCamera.x - introCamera.x) * eased;
      const nextY = introCamera.y + (targetCamera.y - introCamera.y) * eased;
      setZoom(nextZoom);
      setCamera(clampCamera(nextX, nextY, nextZoom));

      if (t < 1) {
        mapIntroRafRef.current = requestAnimationFrame(animate);
      } else {
        mapIntroRafRef.current = 0;
        setIsMapIntroPlaying(false);
        didInitMapCameraRef.current = true;
      }
    };

    mapIntroRafRef.current = requestAnimationFrame(animate);

    return () => {
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
      setIsMapIntroPlaying(false);
    };
  }, [phase, screen, isStageMeasured, NODES, getMapCameraForLensFocus]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map" || !isMapCanvasPrimed) return undefined;
    if (didPlayMapLensIntroRef.current) return undefined;
    didPlayMapLensIntroRef.current = true;
    hasPlayedMapLensIntroLogoRef.current = false;
    setIsMapLensIntroActive(true);
    mapLensIntroTimerRef.current = window.setTimeout(() => {
      setIsMapLensIntroActive(false);
      mapLensIntroTimerRef.current = 0;
    }, isLowPerfMapDevice ? 1150 : 1450);
    return () => {
      if (mapLensIntroTimerRef.current) {
        window.clearTimeout(mapLensIntroTimerRef.current);
        mapLensIntroTimerRef.current = 0;
      }
    };
  }, [phase, screen, isMapCanvasPrimed, isLowPerfMapDevice]);

  React.useEffect(() => {
    if (phase !== "game" || screen === "map") return undefined;
    didPlayMapLensIntroRef.current = false;
    hasPlayedMapLensIntroLogoRef.current = false;
    setIsMapLensIntroActive(true);
    if (mapLensIntroTimerRef.current) {
      window.clearTimeout(mapLensIntroTimerRef.current);
      mapLensIntroTimerRef.current = 0;
    }
    return undefined;
  }, [phase, screen]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map" || !isMapLensIntroActive) return;
    if (hasPlayedMapLensIntroLogoRef.current) return;
    hasPlayedMapLensIntroLogoRef.current = true;
    playAudioRef(mapLensIntroLogoAudioRef, {
      enabled: isMenuSoundEnabled(),
      volume: 0.92,
    });
  }, [isMapLensIntroActive, phase, playAudioRef, screen]);

  React.useEffect(() => {
    if (phase !== "game" || screen !== "map") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentGraphicsSettings = normalizeRunnerGraphicsSettings(runnerGraphicsSettings);
    const reducedMotionMap = isLowPerfMapDevice && !isDesktopViewport;
    const shouldForceMapBirds =
      currentGraphicsSettings.detailLevel === "high" ||
      currentGraphicsSettings.detailLevel === "maximum" ||
      Number(currentGraphicsSettings.imageQuality || 0) > 1.05;
    const dpr = isDesktopViewport
      ? Math.min(window.devicePixelRatio || 1, 2)
      : reducedMotionMap
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isDesktopViewport ? "high" : "medium";

    let rafId = 0;
    let lastDrawTs = 0;
    const targetFrameMs = reducedMotionMap ? 1000 / 24 : 1000 / 60;
    const scheduleNextFrame = () => {
      if (!document.hidden) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };
    const drawFrame = (ts = performance.now()) => {
      if (document.hidden) {
        rafId = 0;
        return;
      }
      if (lastDrawTs && ts - lastDrawTs < targetFrameMs) {
        scheduleNextFrame();
        return;
      }
      lastDrawTs = ts;
      const camera = cameraRef.current;
      const zoom = zoomRef.current;
      const isLiteDragFrame =
        isLowPerfMapDevice && pointerRef.current.mode === "drag" && pointerRef.current.moved;
      const shouldRenderAmbientMapFx = !reducedMotionMap && !isLiteDragFrame;
      const shouldRenderMapBirds = (!isLiteDragFrame && shouldForceMapBirds) || shouldRenderAmbientMapFx;
      const currentNode = currentNodeRef.current;
      const visitedNodes = visitedNodesRef.current;

      ctx.clearRect(0, 0, size.width, size.height);

      ctx.fillStyle = "#2cdee2";
      ctx.fillRect(0, 0, size.width, size.height);

      const seaVideo = ENABLE_SEA_VIDEO ? marAnimadoVideoRef.current : null;
      const seaTime = ts * 0.00035;
      const depthStrength = isDesktopViewport ? 0.56 : 1;
      if (ENABLE_SEA_VIDEO && seaVideo?.videoWidth && seaVideo?.videoHeight && seaVideo.readyState >= 1) {
        const seaAspect = seaVideo.videoWidth / seaVideo.videoHeight;
        const seaWorldWidth = world.width * 1.35;
        const minSeaHeight = world.height * 1.9;
        const seaWorldHeight = Math.max(minSeaHeight, seaWorldWidth / seaAspect);
        const seaWorldX = (world.width - seaWorldWidth) / 2;
        const seaWorldY = -world.height * 0.22;
        const drawWidth = seaWorldWidth * zoom;
        const drawHeight = seaWorldHeight * zoom;
        const drawX = (seaWorldX - camera.x) * zoom;
        const drawY = (seaWorldY - camera.y) * zoom;
        try {
          ctx.drawImage(seaVideo, drawX, drawY, drawWidth, drawHeight);
        } catch {
          // Mantem o frame anterior sem piscar quando o decoder oscilar.
        }
        // Equaliza tom entre desktop/mobile quando cada navegador decodifica o frame de forma diferente.
        ctx.fillStyle = isDesktopViewport ? "rgba(130,245,255,0.14)" : "rgba(44,222,226,0.12)";
        ctx.fillRect(0, 0, size.width, size.height);
      }

      const seaHighlight = ctx.createLinearGradient(0, 0, size.width, size.height * 0.78);
      seaHighlight.addColorStop(0, `rgba(220,255,255,${0.035 + (Math.sin(seaTime * 1.7) + 1) * 0.008})`);
      seaHighlight.addColorStop(0.38, `rgba(170,245,255,${0.02 + (Math.cos(seaTime * 1.2) + 1) * 0.006})`);
      seaHighlight.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = seaHighlight;
      ctx.fillRect(0, 0, size.width, size.height);

      if (shouldRenderAmbientMapFx) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 4; i += 1) {
          const bandY = size.height * (0.2 + i * 0.16) + Math.sin(seaTime * (1.8 + i * 0.22) + i * 1.7) * 18;
          const bandX = Math.cos(seaTime * (1.35 + i * 0.18) + i) * 26;
          const bandWidth = size.width * (0.7 + i * 0.08);
          const bandHeight = 44 + i * 10;
          const shimmer = ctx.createLinearGradient(
            size.width * 0.5 - bandWidth * 0.5 + bandX,
            bandY,
            size.width * 0.5 + bandWidth * 0.5 + bandX,
            bandY + bandHeight
          );
          shimmer.addColorStop(0, "rgba(255,255,255,0)");
          shimmer.addColorStop(0.5, `rgba(210,255,255,${isDesktopViewport ? 0.05 : 0.04})`);
          shimmer.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = shimmer;
          ctx.fillRect(size.width * 0.5 - bandWidth * 0.5 + bandX, bandY - bandHeight * 0.5, bandWidth, bandHeight);
        }
        ctx.restore();
      }

      const depthTopLeft = ctx.createRadialGradient(
        size.width * 0.16,
        size.height * 0.14,
        10,
        size.width * 0.16,
        size.height * 0.14,
        size.width * 0.9
      );
      depthTopLeft.addColorStop(0, `rgba(255,255,255,${0.12 * depthStrength})`);
      depthTopLeft.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = depthTopLeft;
      ctx.fillRect(0, 0, size.width, size.height);

      const depthBottom = ctx.createRadialGradient(
        size.width * 0.72,
        size.height * 0.9,
        20,
        size.width * 0.72,
        size.height * 0.9,
        size.width * 1.1
      );
      depthBottom.addColorStop(0, `rgba(5,65,84,${0.34 * depthStrength})`);
      depthBottom.addColorStop(1, "rgba(5,65,84,0)");
      ctx.fillStyle = depthBottom;
      ctx.fillRect(0, 0, size.width, size.height);

      const depthVignette = ctx.createLinearGradient(0, 0, 0, size.height);
      depthVignette.addColorStop(0, `rgba(7,71,90,${0.06 * depthStrength})`);
      depthVignette.addColorStop(0.58, `rgba(7,71,90,${0.12 * depthStrength})`);
      depthVignette.addColorStop(1, `rgba(7,71,90,${0.22 * depthStrength})`);
      ctx.fillStyle = depthVignette;
      ctx.fillRect(0, 0, size.width, size.height);

        const horizonY = Math.floor(size.height * 0.2);
      const skyFade = ctx.createLinearGradient(0, 0, 0, horizonY + 44);
      skyFade.addColorStop(0, "rgba(227,255,255,0.32)");
      skyFade.addColorStop(0.45, "rgba(227,255,255,0.14)");
      skyFade.addColorStop(1, "rgba(227,255,255,0)");
      ctx.fillStyle = skyFade;
      ctx.fillRect(0, 0, size.width, horizonY + 44);

      // Camada de sombra de nuvens entre o mar e o horizonte.
      const normalizedX = camera.x / Math.max(1, world.width);
      const cloudParallax = (normalizedX - 0.5) * 22;
      const horizonDrawWidthForCloud = Math.min(1100, Math.max(size.width * 1.16, 760));
      const horizonDrawHeightForCloud =
        isHorizonReady && horizonImageRef.current?.width && horizonImageRef.current?.height
          ? (horizonDrawWidthForCloud * horizonImageRef.current.height) / horizonImageRef.current.width
          : size.height * 0.25;
      const cloudBandY = Math.floor(horizonDrawHeightForCloud - size.height * 0.02);
      const cloudBand = ctx.createLinearGradient(0, cloudBandY - 36, 0, cloudBandY + 96);
      cloudBand.addColorStop(0, "rgba(8,61,73,0)");
      cloudBand.addColorStop(0.42, "rgba(8,61,73,0.13)");
      cloudBand.addColorStop(0.66, "rgba(8,61,73,0.2)");
      cloudBand.addColorStop(1, "rgba(8,61,73,0)");
      ctx.fillStyle = cloudBand;
      ctx.fillRect(0, cloudBandY - 36, size.width, 132);

      if (shouldRenderAmbientMapFx) {
        const cloudShadows = [
          { x: 0.18, y: cloudBandY + 8, rx: 132, ry: 28, a: 0.2 },
          { x: 0.48, y: cloudBandY + 2, rx: 168, ry: 34, a: 0.22 },
          { x: 0.78, y: cloudBandY + 10, rx: 142, ry: 30, a: 0.18 },
        ];
        ctx.save();
        ctx.filter = "blur(10px)";
        cloudShadows.forEach((cloud) => {
          const cx = cloud.x * size.width + cloudParallax;
          const cy = cloud.y;
          const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cloud.rx);
          grad.addColorStop(0, `rgba(6,58,70,${cloud.a})`);
          grad.addColorStop(1, "rgba(6,58,70,0)");
          ctx.fillStyle = grad;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, cloud.ry / cloud.rx);
          ctx.beginPath();
          ctx.arc(0, 0, cloud.rx, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      }

      if (isHorizonReady && horizonImageRef.current?.width && horizonImageRef.current?.height) {
        const horizonAsset = horizonImageRef.current;
        const horizonZoomScale = 0.94 + (zoom - 0.8) * 0.34;
        const drawWidth = Math.min(1400, Math.max(size.width * 1.16, 760) * horizonZoomScale);
        const drawHeight = (drawWidth * horizonAsset.height) / horizonAsset.width;
        const parallax = (normalizedX - 0.5) * 36;
        const drawX = (size.width - drawWidth) / 2 + parallax;
        const drawY = -1 - camera.y * 0.03 - (zoom - 1) * 24;
        ctx.drawImage(horizonAsset, drawX, drawY, drawWidth, drawHeight + 2);
      }

      if (isIlhaCentralFundoReady && ilhaCentralFundoRef.current?.width && ilhaCentralFundoRef.current?.height) {
        const islandBg = ilhaCentralFundoRef.current;
        const desktop = isDesktopViewport;
        const baseWidth = Math.max(size.width * (desktop ? 0.56 : 0.72), desktop ? 260 : 320);
        const drawWidth = baseWidth * (1 + (zoom - 1) * 0.1);
        const drawHeight = (drawWidth * islandBg.height) / islandBg.width;
        const islandWorldX = world.width * 0.16;
        const drawX = (islandWorldX - camera.x) * zoom - drawWidth * 0.5;
        const islandVerticalBase = desktop ? 0.36 : 0.34;
        const drawY = size.height * islandVerticalBase - drawHeight * 0.58 - camera.y * 0.02;
        ctx.drawImage(islandBg, drawX, drawY, drawWidth, drawHeight);
      }

      const birdTime = ts * 0.001;
      const isDraggingMapBirdsOff = pointerRef.current.mode === "drag" && pointerRef.current.moved;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (shouldRenderMapBirds && !isDraggingMapBirdsOff) {
        const focusedBirdNode = NODES[selectedIslandId] || NODES[currentNodeRef.current] || NODES[0];
        if (focusedBirdNode) {
          const point = projectNodeToScreen(focusedBirdNode, camera, zoom);
          if (point.x > -140 && point.x < size.width + 140 && point.y > -180 && point.y < size.height + 140) {
            const flockCount = isDesktopViewport ? 6 : 4;
            const orbitBaseY = point.y - 42 * Math.max(0.84, zoom);
            for (let i = 0; i < flockCount; i += 1) {
              const wingPhase = birdTime * 8 + i * 0.78;
              const flap = Math.sin(wingPhase) * 0.88;
              const orbit = birdTime * (0.62 + i * 0.04) + i * 0.95;
              const x =
                point.x +
                Math.cos(orbit) * (20 + i * 2.2) * Math.max(0.84, zoom) +
                (i - (flockCount - 1) * 0.5) * 7;
              const y = orbitBaseY + Math.sin(orbit * 1.28) * (8 + i) - i * 1.6;
              const birdScale = (isDesktopViewport ? 0.6 : 0.52) * Math.max(0.78, zoom);
              const wingSpan = 8.6 * birdScale;
              const wingLift = 3.9 * birdScale + flap * 2.2 * birdScale;
              ctx.strokeStyle = "rgba(9, 49, 62, 0.28)";
              ctx.lineWidth = Math.max(0.9, 1.15 * birdScale);
              ctx.beginPath();
              ctx.moveTo(x - wingSpan, y + wingLift * 0.24);
              ctx.quadraticCurveTo(x - wingSpan * 0.45, y - wingLift, x, y);
              ctx.quadraticCurveTo(x + wingSpan * 0.45, y - wingLift, x + wingSpan, y + wingLift * 0.24);
              ctx.stroke();
            }
          }
        }
      }
      ctx.restore();

      LINKS.forEach(([a, b]) => {
      const from = NODES[a];
      const to = NODES[b];
      const fromPos = projectNodeToScreen(from, camera, zoom);
      const toPos = projectNodeToScreen(to, camera, zoom);
      const fromX = fromPos.x;
      const fromY = fromPos.y;
      const toX = toPos.x;
      const toY = toPos.y;
      ctx.lineWidth = Math.max(2, 5 * zoom);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 2 * zoom);
      ctx.strokeStyle = "rgba(125,211,252,0.5)";
      ctx.stroke();
    });

      NODES.forEach((node) => {
      const unlocked = !node.locked;
      const isSelectedIsland = node.id === selectedIslandId;
      const projected = projectNodeToScreen(node, camera, zoom);
      const x = projected.x;
      const y = projected.y;
      if (x < -50 || y < -50 || x > size.width + 50 || y > size.height + 50) return;

      const baseRadius = unlocked ? 18 : 14;
      const radius = Math.max(9, baseRadius * zoom);
      const tagWidth = Math.max(68, 74 * zoom);
      const tagHeight = Math.max(20, 23 * zoom);
      const tagX = x - tagWidth / 2;
      const tagY = y - radius - tagHeight - 32 * zoom;

      ctx.save();
      if (!unlocked) {
        ctx.filter = "grayscale(1) brightness(0.82) contrast(0.92)";
        ctx.globalAlpha = 0.88;
      }

      const uploadedIslandImage = String(node.imageUrl || "").trim()
        ? islandImageCacheRef.current.get(getMapIslandMediaCacheKey(node.imageUrl))
        : null;
      if (
        uploadedIslandImage &&
        (
          (uploadedIslandImage.width && uploadedIslandImage.height) ||
          (uploadedIslandImage.videoWidth && uploadedIslandImage.videoHeight)
        )
      ) {
        const islandWidth = Math.max(118, 154 * zoom);
        const sourceWidth = uploadedIslandImage.videoWidth || uploadedIslandImage.width;
        const sourceHeight = uploadedIslandImage.videoHeight || uploadedIslandImage.height;
        const islandHeight = (islandWidth * sourceHeight) / sourceWidth;
        ctx.drawImage(uploadedIslandImage, x - islandWidth / 2, y - islandHeight / 2, islandWidth, islandHeight);
      } else if (node.artKey === "island001" && isIlhaLevel2OkReady && ilhaLevel2OkRef.current?.width && ilhaLevel2OkRef.current?.height) {
        const islandWidth = Math.max(124, 162 * zoom);
        const islandHeight = (islandWidth * ilhaLevel2OkRef.current.height) / ilhaLevel2OkRef.current.width;
        ctx.drawImage(ilhaLevel2OkRef.current, x - islandWidth / 2, y - islandHeight / 2, islandWidth, islandHeight);
      } else if (node.artKey === "island002" && isIlhaLevel2Ready && ilhaLevel2Ref.current?.width && ilhaLevel2Ref.current?.height) {
        const islandWidth = Math.max(124, 162 * zoom);
        const islandHeight = (islandWidth * ilhaLevel2Ref.current.height) / ilhaLevel2Ref.current.width;
        ctx.drawImage(ilhaLevel2Ref.current, x - islandWidth / 2, y - islandHeight / 2, islandWidth, islandHeight);
      } else if (node.artKey === "island003" && isIlhaLevel3Ready && ilhaLevel3Ref.current?.width && ilhaLevel3Ref.current?.height) {
        const islandWidth = Math.max(124, 162 * zoom);
        const islandHeight = (islandWidth * ilhaLevel3Ref.current.height) / ilhaLevel3Ref.current.width;
        ctx.drawImage(ilhaLevel3Ref.current, x - islandWidth / 2, y - islandHeight / 2, islandWidth, islandHeight);
      } else if (node.artKey === "island004" && isIlhaLevel4Ready && ilhaLevel4Ref.current?.width && ilhaLevel4Ref.current?.height) {
        const islandWidth = Math.max(126, 166 * zoom);
        const islandHeight = (islandWidth * ilhaLevel4Ref.current.height) / ilhaLevel4Ref.current.width;
        ctx.drawImage(ilhaLevel4Ref.current, x - islandWidth / 2, y - islandHeight / 2, islandWidth, islandHeight);
      } else {
        ctx.fillStyle = unlocked ? "rgba(22,163,74,0.85)" : "rgba(71,85,105,0.7)";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      const tagGradient = ctx.createLinearGradient(tagX, tagY, tagX, tagY + tagHeight);
      if (unlocked) {
        tagGradient.addColorStop(0, "rgba(248,253,255,0.98)");
        tagGradient.addColorStop(0.42, "rgba(215,245,255,0.96)");
        tagGradient.addColorStop(1, "rgba(125,211,252,0.96)");
      } else {
        tagGradient.addColorStop(0, "rgba(71,85,105,0.94)");
        tagGradient.addColorStop(1, "rgba(30,41,59,0.98)");
      }
      ctx.fillStyle = tagGradient;
      ctx.strokeStyle = unlocked ? "rgba(224,242,254,0.92)" : "rgba(148,163,184,0.72)";
      ctx.lineWidth = Math.max(1.4, 1.6 * zoom);
      ctx.shadowColor = "rgba(15,23,42,0.24)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagWidth, tagHeight, Math.max(10, 11 * zoom));
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = unlocked ? "rgba(7,89,133,0.84)" : "rgba(226,232,240,0.92)";
      ctx.font = `700 ${Math.max(7.6, 8.4 * zoom)}px "CARAMEL MOCACHINO", sans-serif`;
      ctx.fillText(`Level ${node.day}`, x, tagY + tagHeight * 0.54);
      ctx.restore();

      if (!unlocked) {
        ctx.save();
        const lockX = x;
        const lockY = y - radius * 0.04;
        ctx.fillStyle = "rgba(15,23,42,0.78)";
        ctx.beginPath();
        ctx.roundRect(lockX - 10 * zoom, lockY - 1 * zoom, 20 * zoom, 14 * zoom, 5 * zoom);
        ctx.fill();
        ctx.strokeStyle = "rgba(241,245,249,0.88)";
        ctx.lineWidth = Math.max(1.2, 1.6 * zoom);
        ctx.beginPath();
        ctx.arc(lockX, lockY - 1 * zoom, 6.2 * zoom, Math.PI, 0);
        ctx.stroke();
        ctx.strokeRect(lockX - 5 * zoom, lockY + 2 * zoom, 10 * zoom, 5.5 * zoom);
        ctx.restore();
      }
    });

      // Sombras gigantes por cima de tudo no mapa.
      if (shouldRenderAmbientMapFx && isSombraNunvensReady && sombraNunvensRef.current?.width && sombraNunvensRef.current?.height) {
        const shade = sombraNunvensRef.current;
        const anchors = [
          { x: 0.27, y: 0.58, scale: 1.62, alpha: 0.26 },
          { x: 0.69, y: 0.57, scale: 1.42, alpha: 0.22 },
        ];
        const t = performance.now() * 0.0001;

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        anchors.forEach((anchor, index) => {
          const point = projectNodeToScreen(anchor, camera, zoom);
          const width = Math.max(240, size.width * 0.88) * anchor.scale * zoom;
          const height = (width * shade.height) / shade.width;
          const driftX = Math.sin(t + index * 1.7) * 8;
          const driftY = Math.cos(t * 0.85 + index * 1.2) * 3;
          ctx.globalAlpha = anchor.alpha;
          ctx.drawImage(shade, point.x - width / 2 + driftX, point.y - height * 0.55 + driftY, width, height);
        });
        ctx.restore();
      }

      // Nuvens gigantes de profundidade por cima de todo o mapa.
      const drawCloudOverlay = (imageRef, isReady, x, y, width, alpha = 1) => {
        const image = imageRef.current;
        if (!isReady || !image?.width || !image?.height) return;
        const height = (width * image.height) / image.width;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(image, x, y, width, height);
        ctx.restore();
      };

      const t = ts * 0.00008;
      const driftX = Math.sin(t) * 6;
      const driftY = Math.cos(t * 0.9) * 4;
      const topLeftDriftX = Math.sin(t * 0.72 + 0.4) * 7;
      const topLeftDriftY = Math.cos(t * 0.58 + 1.2) * 3;
      const topRightDriftX = -Math.cos(t * 0.66 + 0.9) * 7;
      const topRightDriftY = Math.sin(t * 0.54 + 0.2) * 3;
      const cloudZoomScale = Math.max(0.78, Math.min(1.24, 0.92 + (zoom - 1) * 0.46));
      const topWidth = size.width * 1.02 * cloudZoomScale;
      const topCloudParallaxX = (normalizedX - 0.5) * (size.width * 0.18);
      const closeCloudParallaxX = (normalizedX - 0.5) * (size.width * 0.28);
      const lowerCloudYBase = isDesktopViewport ? 0.5 : 0.62;
      const lowerCloudYBaseRight = isDesktopViewport ? 0.48 : 0.6;
      const lowerCloudScaleLeft = (isDesktopViewport ? 1.55 : 1.78) * cloudZoomScale;
      const lowerCloudScaleRight = (isDesktopViewport ? 1.6 : 1.84) * cloudZoomScale;

      drawCloudOverlay(
        nuvemCantoSuperiorEsquerdoRef,
        isNuvemCantoSuperiorEsquerdoReady,
        -size.width * 0.24 + topLeftDriftX + topCloudParallaxX,
        -size.height * 0.12 + topLeftDriftY,
        topWidth,
        0.72
      );
      drawCloudOverlay(
        nuvemCantoSuperiorDireitoRef,
        isNuvemCantoSuperiorDireitoReady,
        size.width * 0.22 + topRightDriftX + topCloudParallaxX,
        -size.height * 0.11 + topRightDriftY,
        topWidth,
        0.72
      );
      if (shouldRenderAmbientMapFx) {
        drawCloudOverlay(
          nuvemCantoInferiorEsquerdoRef,
          isNuvemCantoInferiorEsquerdoReady,
          -size.width * 0.98 + closeCloudParallaxX + driftX * 0.5,
          size.height * lowerCloudYBase + driftY * 0.8,
          size.width * lowerCloudScaleLeft,
          0.66
        );
        drawCloudOverlay(
          nuvemCantoInferiorDireitoRef,
          isNuvemCantoInferiorDireitoReady,
          size.width * 0.44 + closeCloudParallaxX - driftX * 0.5,
          size.height * lowerCloudYBaseRight + driftY * 0.7,
          size.width * lowerCloudScaleRight,
          0.68
        );
      }

      if (!didPrimeMapCanvasRef.current) {
        didPrimeMapCanvasRef.current = true;
        setIsMapCanvasPrimed(true);
      }

      scheduleNextFrame();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        return;
      }
      if (!rafId) scheduleNextFrame();
    };

    scheduleNextFrame();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    phase,
    screen,
    size,
    world.width,
    world.height,
    isIsland001Ready,
    isSombraNunvensReady,
    isIlhaLevel2OkReady,
    isIlhaLevel2Ready,
    isIlhaLevel3Ready,
    isIlhaLevel4Ready,
    isNuvemCantoSuperiorEsquerdoReady,
    isNuvemCantoSuperiorDireitoReady,
    isNuvemCantoInferiorEsquerdoReady,
    isNuvemCantoInferiorDireitoReady,
    isMarAnimadoReady,
    isHorizonReady,
    mapIslandImageVersion,
    NODES,
    unlockedMaxDay,
    projectNodeToScreen,
    isDesktopViewport,
  ]);

  React.useEffect(() => {
    setRewardGallery(loadRewardGallery(user?.id));
  }, [user?.id]);

  React.useEffect(() => {
    saveRewardGallery(user?.id, rewardGallery);
  }, [rewardGallery, user?.id]);

  React.useEffect(() => {
    const fallbackCoins = Math.max(1200, rewardGallery.length * 180 + unlockedMaxDay * 260);
    const fallbackDiamonds = Math.max(
      12,
      rewardGallery.filter((reward) => ["epic", "legendary"].includes(String(reward?.rarity || ""))).length * 3 + unlockedMaxDay
    );
    const fallbackKeys = Math.max(0, unlockedMaxDay - 1);
    const nextInventory = loadPlayerInventory(user?.id, {
      walletFallback: {
        coins: fallbackCoins,
        diamonds: fallbackDiamonds,
        keys: fallbackKeys,
      },
      equippedPerkFallback: loadRunnerPerkLoadout(user?.id),
      selectedSkinFallback: LOADOUT_SKINS[0]?.id,
      selectedCharacterFallback: getDefaultSelectedCharacterId(),
    });
    skipNextPerkLoadoutSaveRef.current = true;
    setPlayerInventory(nextInventory);
    setSelectedCharacterId(nextInventory.selectedCharacterId || getDefaultSelectedCharacterId());
    setSelectedWardrobeSlot("preset");
    setSelectedSkinId(String(nextInventory.equippedWardrobeByCharacterId?.[nextInventory.selectedCharacterId || getDefaultSelectedCharacterId()]?.presetItemId || "classic"));
    setSelectedConsumableId(String(nextInventory.selectedConsumableId || "").trim());
    setEquippedPerkIds(nextInventory.equippedPerkIds);
    setSelectedPerkId((current) => {
      if (nextInventory.equippedPerkIds.includes(current)) return current;
      return nextInventory.equippedPerkIds[0] || nextInventory.ownedPerkIds[0] || Object.keys(PERK_DEFINITIONS)[0] || "";
    });
  }, [unlockedMaxDay, user?.id]);

  React.useEffect(() => {
    saveRunnerWallet(user?.id, playerWallet);
    const syncedInventory = syncInventoryEquippedPerks(playerInventory, equippedPerkIds);
    savePlayerInventory(user?.id, syncedInventory);
  }, [equippedPerkIds, playerInventory, playerWallet, user?.id]);

  React.useEffect(() => {
    setRunnerGraphicsSettings(loadRunnerGraphicsSettings(user?.id));
  }, [user?.id]);

  React.useEffect(() => {
    saveRunnerGraphicsSettings(user?.id, runnerGraphicsSettings);
  }, [runnerGraphicsSettings, user?.id]);

  React.useEffect(() => {
    if (screen !== "travel") return undefined;
    setTravelProgress(0);

    const start = performance.now();
    const duration = 1600;

    const raf = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);
      setTravelProgress(t);
      if (t >= 1) {
        setCurrentNode(travelTargetId);
        setSelectedIslandId(travelTargetId);
        setVisitedNodes((prev) => new Set([...prev, travelTargetId]));
        setScreen("island");
        return;
      }
      requestAnimationFrame(raf);
    };

    const id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [screen, travelTargetId]);

  const createRunnerSession = React.useCallback(async () => {
    if (!user?.id) return;
    const island = NODES[selectedIslandId] || NODES[0];
    try {
      const created = await base44.entities.IslandGameSession.create({
        user_id: user.id,
        user_name: user.full_name || user.nick || "Sem nome",
        user_nick: user.nick || "",
        island_id: island.id,
        island_day: island.day,
        island_name: island.name,
        is_daily: island.id === dailyIslandId,
        mode: "endless",
        status: "running",
        started_at: new Date().toISOString(),
        speed_start: runnerConfig.speed_start,
      });
      activeSessionIdRef.current = created?.id || null;
      didPersistResultRef.current = false;
    } catch (error) {
      console.error("Falha ao criar sessao de ilha", error);
    }
  }, [dailyIslandId, runnerConfig.speed_start, selectedIslandId, user]);

  const persistRunnerResult = React.useCallback(
    async (status = "ended") => {
      if (!activeSessionIdRef.current || didPersistResultRef.current) return;
      const runner = runnerRef.current;
      try {
        await base44.entities.IslandGameSession.update(activeSessionIdRef.current, {
          status,
          ended_at: new Date().toISOString(),
          elapsed_ms: Math.round(runner.elapsedMs),
          score: runner.score,
          chest_chance: Number(runner.chestChance.toFixed(2)),
          speed_peak: Number(runner.speed.toFixed(2)),
          collected_blocks: runner.score,
          collisions: status === "collision" ? 1 : 0,
          island_daily_day: dailyIslandDay,
        });
        didPersistResultRef.current = true;
        activeSessionIdRef.current = null;
      } catch (error) {
        console.error("Falha ao persistir sessao de ilha", error);
      }
    },
    [dailyIslandDay]
  );

  const stopRunner = React.useCallback(() => {
    const runner = runnerRef.current;
    runner.running = false;
    if (runner.rafId) {
      cancelAnimationFrame(runner.rafId);
      runner.rafId = 0;
    }
  }, []);

  const finalizeRunner = React.useCallback((status = "ended") => {
    const runner = runnerRef.current;
    stopRunner();
    stopGameplayMusicRef();
    persistRunnerResult(status);
    setChallengeError("");
    setRunnerState((prev) => ({ ...prev, status }));
    setIsResultRunnerSceneReady(false);
    setResultSceneMountKey((prev) => prev + 1);
    setScreen("result");
  }, [persistRunnerResult, stopGameplayMusicRef, stopRunner]);

  const startCollisionCinematic = React.useCallback((collisionPayload = null) => {
    const runner = runnerRef.current;
    const collisionType =
      String(collisionPayload?.type || collisionPayload?.kind || "").trim().toLowerCase() === "pit_gap"
        ? "pit_gap"
        : "obstacle";
    stopRunner();
    stopGameplayMusicRef();
    persistRunnerResult("collision");
    setChallengeError("");
    setRunnerState((prev) => ({
      ...prev,
      status: "collision",
      collisionType,
      jump: 0,
      slide: 0,
      collisionProgress: 0,
    }));
      if (collisionCinematicTimeoutRef.current) {
        window.clearTimeout(collisionCinematicTimeoutRef.current);
      }
      const cinematicDurationMs = collisionType === "pit_gap" ? 1900 : 2350;
      collisionCinematicTimeoutRef.current = window.setTimeout(() => {
        collisionCinematicTimeoutRef.current = 0;
        setIsResultRunnerSceneReady(false);
        setResultSceneMountKey((prev) => prev + 1);
        setScreen("result");
      }, cinematicDurationMs);
    }, [persistRunnerResult, stopGameplayMusicRef, stopRunner]);

  const handleRunnerUiSnapshot = React.useCallback((snapshot) => {
    setRunnerState(snapshot);
  }, []);

  const runnerSimulation = React.useMemo(
    () =>
      createRunnerSimulation({
        runner: runnerRef.current,
        runnerStateRef: runnerRuntimeStateRef,
        onUiSnapshot: handleRunnerUiSnapshot,
        onCollision: startCollisionCinematic,
        onMoneyPickup: ({ isMoneyRainPickup }) => {
          playPooledMoneyRainPickupRef({
            enabled: isInteractionSoundEnabled(),
            volume: isMoneyRainPickup ? 1 : 0.94,
          });
        },
        onPowerBoxPickup: () => {
          playAudioRef(premiumRewardCollectAudioRef, {
            enabled: isInteractionSoundEnabled(),
            volume: 0.96,
          });
        },
      }),
    [handleRunnerUiSnapshot, playAudioRef, playPooledMoneyRainPickupRef, startCollisionCinematic]
  );

  const runtimeMapCycleLength = React.useMemo(() => {
    const raw = Number(sceneConfig?.object_overrides?.road_base?.map_cycle_length);
    if (!Number.isFinite(raw)) return 600;
    return Math.max(80, Math.min(5000, raw));
  }, [sceneConfig?.object_overrides?.road_base?.map_cycle_length]);

  const runnerCycleStartBase = React.useMemo(() => {
    const manualOffset =
      devStageEditMode === "map" ? Number(devMapCursorZ || 0) : Number(devConveyorOffset || 0);
    if (!(runtimeMapCycleLength > 0)) return Math.max(0, -manualOffset);
    const wrapped = ((-manualOffset % runtimeMapCycleLength) + runtimeMapCycleLength) % runtimeMapCycleLength;
    return wrapped;
  }, [devConveyorOffset, devMapCursorZ, devStageEditMode, runtimeMapCycleLength]);

  const startRunner = React.useCallback((options = {}) => {
    const startPaused = !!options?.startPaused;
    const consumableUsage = consumeInventorySelectedConsumable(
      playerInventoryRef.current,
      selectedConsumableIdRef.current
    );
    stopRunner();
    createRunnerSession();
    setIsRunnerPaused(startPaused);
    setPlayerInventory(consumableUsage.inventory);
    setSelectedConsumableId(String(consumableUsage.inventory?.selectedConsumableId || "").trim());
    runnerRuntimeStateRef.current = createDefaultRunnerState();
    runnerSimulation.start({
      startPaused,
      cycleFlowBase: runnerCycleStartBase,
      runnerConfig: runnerConfigRef.current,
      selectedIslandId: selectedIslandIdRef.current,
      dailyIslandId: dailyIslandIdRef.current,
      selectedCharacterId: selectedCharacterIdRef.current,
      equippedPerkIds: equippedPerkIdsRef.current,
      selectedConsumableId: consumableUsage.consumed ? consumableUsage.consumableId : "",
      sceneConfig: sceneConfigRef.current,
      isPausedRef: isRunnerPausedRef,
      timeScaleRef: runnerTimeScaleRef,
      isNoCollisionRef: isDevNoCollisionRef,
    });
  }, [
    createRunnerSession,
    runnerCycleStartBase,
    runnerSimulation,
    stopRunner,
  ]);

  const resumeRunnerFromEditorPosition = React.useCallback(() => {
    const runner = runnerRef.current;
    const nextBase = runnerCycleStartBase;
    runner.lastTs = 0;
    runner.elapsedMs = 0;
    runner.worldFlow = 0;
    runner.cycleFlowBase = nextBase;
    runner.blocks = [];
    runner.obstacles = [];
    runner.impacts = [];
    setRunnerState((prev) => ({
      ...prev,
      elapsedMs: 0,
      worldFlow: 0,
      blocks: [],
      obstacles: [],
      impacts: [],
    }));
    runnerSimulation.syncVisualState({ status: "running" });
    runnerSimulation.pushUiSnapshot({ force: true });
    setIsRunnerPaused(false);
    isRunnerPausedRef.current = false;
  }, [runnerCycleStartBase, runnerSimulation]);

  React.useEffect(() => {
    if (screen === "challenge-intro") return undefined;
    if (screen === "challenge") return undefined;
    setIsRunnerSceneReady(false);
    if (screen !== "result") {
      setIsResultRunnerSceneReady(false);
    }
    return undefined;
  }, [screen]);

  React.useEffect(() => {
    if (screen !== "loadout") {
      setIsLoadoutTransitionActive(false);
      setLoadoutTransitionProgress(0);
      return undefined;
    }

    setIsLoadoutTransitionActive(false);
    setLoadoutTransitionProgress(100);
    return undefined;

  }, [isRunnerSceneReady, screen]);

  React.useEffect(() => {
    const video = document.createElement("video");
    video.src = loadoutMenuAnimationVideo;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const warmup = video.play();
    if (warmup && typeof warmup.then === "function") {
      warmup.then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {});
    }

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  React.useEffect(() => {
    if (!isLoadoutTransitionActive) return undefined;
    const video = loadoutTransitionVideoRef.current;
    if (!video) return undefined;
    video.currentTime = 0;
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
    return undefined;
  }, [isLoadoutTransitionActive]);

  React.useEffect(() => {
    return () => {
      if (islandLoadoutOpenTimerRef.current) {
        window.clearTimeout(islandLoadoutOpenTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setIsMapIslandsHydrated(false);
    loadIslandSceneConfig(1)
      .then((result) => {
        if (cancelled) return;
        setMapIslandsRecordId(result?.id || null);
        const serverMapIslands = Array.isArray(result?.config?.map_islands) && result.config.map_islands.length
          ? normalizeMapIslands(result.config.map_islands)
          : loadMapIslands(user?.id);
        setMapIslands(serverMapIslands);
      })
      .catch(() => {
        if (cancelled) return;
        setMapIslandsRecordId(null);
        setMapIslands(loadMapIslands(user?.id));
      })
      .finally(() => {
        if (!cancelled) setIsMapIslandsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getMapIslandsStorageKey(user?.id), JSON.stringify(mapIslands));
    }
    if (!isMapIslandsHydrated) return;
    mapIslandsPersistVersionRef.current += 1;
    const persistVersion = mapIslandsPersistVersionRef.current;
    if (mapIslandsPersistTimerRef.current) {
      window.clearTimeout(mapIslandsPersistTimerRef.current);
    }
    mapIslandsPersistTimerRef.current = window.setTimeout(async () => {
      try {
        const saved = await saveIslandSceneConfig({
          id: mapIslandsRecordId,
          islandDay: 1,
          patch: { map_islands: mapIslands },
        });
        if (mapIslandsPersistVersionRef.current === persistVersion) {
          setMapIslandsRecordId(saved?.id || null);
        }
      } catch (error) {
        console.error("Falha ao salvar mapa global de ilhas", error);
      }
    }, 220);
    return () => {
      if (mapIslandsPersistTimerRef.current) {
        window.clearTimeout(mapIslandsPersistTimerRef.current);
        mapIslandsPersistTimerRef.current = 0;
      }
    };
  }, [isMapIslandsHydrated, mapIslands, mapIslandsRecordId, user?.id]);

  React.useEffect(() => {
    if (!NODES.length) return;
    if (!NODES[selectedIslandId]) {
      setSelectedIslandId(0);
    }
    if (!NODES[currentNode]) {
      setCurrentNode(0);
    }
    if (!NODES[travelTargetId]) {
      setTravelTargetId(0);
    }
    if (!NODES[mapDevSelectedIslandId]) {
      setMapDevSelectedIslandId(0);
    }
  }, [NODES, currentNode, mapDevSelectedIslandId, selectedIslandId, travelTargetId]);

  React.useEffect(() => {
    NODES.forEach((node) => {
      const url = String(node?.imageUrl || "").trim();
      const cacheKey = getMapIslandMediaCacheKey(url);
      if (!cacheKey || islandImageCacheRef.current.has(cacheKey)) return;
      const resolvedUrl = cacheKey;
      const assetType = detectAssetTypeFromName(resolvedUrl);
      if (assetType === "video") {
        const video = document.createElement("video");
        video.src = resolvedUrl;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = "auto";
        const markReady = () => {
          islandImageCacheRef.current.set(cacheKey, video);
          setMapIslandImageVersion((prev) => prev + 1);
        };
        video.onerror = () => {
          console.error("Falha ao carregar video da ilha", resolvedUrl);
        };
        video.addEventListener("loadeddata", markReady, { once: true });
        video.addEventListener("canplay", markReady, { once: true });
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
        return;
      }
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        islandImageCacheRef.current.set(cacheKey, image);
        setMapIslandImageVersion((prev) => prev + 1);
      };
      image.onerror = () => {
        console.error("Falha ao carregar imagem da ilha", resolvedUrl);
      };
      image.src = resolvedUrl;
    });
  }, [NODES]);

  React.useEffect(() => {
    if (screen !== "result") {
      if (resultChestTimeoutRef.current) {
        window.clearTimeout(resultChestTimeoutRef.current);
        resultChestTimeoutRef.current = 0;
      }
      return undefined;
    }
    const currentElapsedMs = Math.max(0, Math.round(Number(runnerState.elapsedMs) || 0));
    const previousBest = readRunnerBestTimeMs(selectedIslandId);
    const nextBest = previousBest > 0 ? Math.min(previousBest, currentElapsedMs || previousBest) : currentElapsedMs;
    const isNewBest = currentElapsedMs > 0 && (previousBest <= 0 || currentElapsedMs < previousBest);
    if (isNewBest) {
      writeRunnerBestTimeMs(selectedIslandId, currentElapsedMs);
    }
    setResultBestElapsedMs(nextBest);
    setResultIsNewBest(isNewBest);
    setResultChestPhase("arrival");
    setResultChestTapCount(0);
    setResultChestPulseToken(0);
    setResultRewardCollected(false);
    setResultSummaryCollected(false);
    setResultSummaryPhase("coins");
    setResultAnimatedScore(0);
    setResultAnimatedElapsedMs(0);
    setResultAnimatedCoins(0);
    setResultAnimatedDiamonds(0);
    setResultAnimatedKeys(0);
    const resolvedRewards = resolveRunnerResultRewards({
      score: runnerState.score,
      chestChance: runnerState.chestChance,
      isNewBest,
      selectedCharacterId,
    });
    setResultRewards(resolvedRewards);
    if (resultChestTimeoutRef.current) {
      window.clearTimeout(resultChestTimeoutRef.current);
    }
    let cancelled = false;
    const timeoutIds = [];
    const rafIds = [];
    const getCountSoundDurationMs = () => {
      const audio = resultCoinsBarAudioRef.current;
      const durationSeconds = Number(audio?.duration);
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return Math.max(720, Math.round(durationSeconds * 1000));
      }
      audio?.load?.();
      return 820;
    };
    const animateValue = (from, to, duration, onUpdate, onComplete) => {
      const startAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - startAt;
        const progress = Math.max(0, Math.min(1, elapsed / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        onUpdate(Math.round(from + (to - from) * eased));
        if (progress < 1) {
          const rafId = requestAnimationFrame(tick);
          rafIds.push(rafId);
          return;
        }
        onComplete?.();
      };
      const rafId = requestAnimationFrame(tick);
      rafIds.push(rafId);
    };
    const playCountingPulse = (volume = 0.74) => {
      playAudioElementRef(resultCoinsBarAudioRef.current, {
        enabled: isInteractionSoundEnabled(),
        volume,
        reset: true,
      });
    };
    const coinsTimeout = window.setTimeout(() => {
      const countSoundDurationMs = getCountSoundDurationMs();
      playCountingPulse(0.82);
      animateValue(0, runnerState.score || 0, countSoundDurationMs, setResultAnimatedScore, () => {
        setResultSummaryPhase("time");
        const timeTimeout = window.setTimeout(() => {
          const timeSoundDurationMs = getCountSoundDurationMs();
          playCountingPulse(0.76);
          animateValue(0, currentElapsedMs, timeSoundDurationMs, setResultAnimatedElapsedMs, () => {
            setResultSummaryPhase("rewards");
            const keysTimeout = window.setTimeout(() => {
              let completedAnimations = 0;
              const finishRewardsStep = () => {
                completedAnimations += 1;
                if (completedAnimations >= 3) {
                  setResultSummaryPhase("done");
                }
              };
              animateValue(0, resolvedRewards.run.coins, 520, setResultAnimatedCoins, finishRewardsStep);
              animateValue(0, resolvedRewards.run.keys, 420, setResultAnimatedKeys, finishRewardsStep);
              animateValue(0, resolvedRewards.run.diamonds, 420, setResultAnimatedDiamonds, finishRewardsStep);
            }, 220);
            timeoutIds.push(keysTimeout);
          });
        }, 320);
        timeoutIds.push(timeTimeout);
      });
    }, 240);
    timeoutIds.push(coinsTimeout);
    return () => {
      cancelled = true;
      rafIds.forEach((id) => cancelAnimationFrame(id));
      timeoutIds.forEach((id) => window.clearTimeout(id));
      if (resultChestTimeoutRef.current) {
        window.clearTimeout(resultChestTimeoutRef.current);
        resultChestTimeoutRef.current = 0;
      }
    };
  }, [playAudioElementRef, runnerState.chestChance, runnerState.elapsedMs, runnerState.score, screen, selectedCharacterId, selectedIslandId]);

  React.useEffect(() => {
    if (!(screen === "challenge" && isDevMode)) return;
    setDevFloatingUiCollapsed(false);
    setDevPanelCollapsed(true);
    setDevConveyorCollapsed(true);
    setDevRoadPanelCollapsed(true);
    setDevCameraPanelCollapsed(true);
    setDevRoadEventsOpen(false);
    setDevRoadSectionsOpen({
      curve: false,
      grade: false,
      depth: false,
      blocks: false,
    });
  }, [screen, isDevMode]);

  React.useEffect(() => {
    if (screen !== "challenge") {
      previousRunnerScoreRef.current = 0;
      setDisplayedRunnerScore(0);
      setRunnerCollectBursts([]);
      return;
    }
    const targetScore = Math.max(0, Number(runnerState.score) || 0);
    setDisplayedRunnerScore((prev) => {
      if (targetScore <= prev) return targetScore;
      const diff = targetScore - prev;
      return prev + Math.max(1, Math.ceil(diff * 0.28));
    });
    previousRunnerScoreRef.current = targetScore;
    return undefined;
  }, [runnerState.score, screen]);

  React.useEffect(() => {
    previousRunnerScoreRef.current = Math.max(0, Number(runnerState.score) || 0);
  }, [runnerState.score]);

  React.useEffect(() => {
    if (screen !== "challenge") return undefined;
    const targetScore = Math.max(0, Number(runnerState.score) || 0);
    if (displayedRunnerScore >= targetScore) return undefined;
    const timeoutId = window.setTimeout(() => {
      setDisplayedRunnerScore((prev) => {
        const remaining = targetScore - prev;
        if (remaining <= 0) return prev;
        return prev + Math.max(1, Math.ceil(remaining * 0.34));
      });
    }, 42);
    return () => window.clearTimeout(timeoutId);
  }, [displayedRunnerScore, runnerState.score, screen]);

  React.useEffect(() => {
    if (screen !== "challenge") return undefined;
    stopGameplayMusicRef();
    playGameplayMusicRef();
    startRunner({ startPaused: false });
    return () => {
      const wasRunning = runnerRef.current.running;
      stopRunner();
      stopGameplayMusicRef();
      if (wasRunning) {
        persistRunnerResult("abandoned");
      }
    };
  }, [persistRunnerResult, playGameplayMusicRef, screen, startRunner, stopGameplayMusicRef, stopRunner]);

  React.useEffect(() => {
    if (screen !== "challenge") return;
    const runner = runnerRuntimeStateRef.current;
    if (!runner?.running) return;
    const mapSpecialSegments = buildRunnerMapSpecialSegments(sceneConfig);
    runner.mapSpecialSegments = mapSpecialSegments;
    runner.useMapSpecialSegments = !!mapSpecialSegments?.hasSegments;
    updateRunnerElevatedSegments(runner, 0.016);
  }, [sceneConfig, screen]);

  React.useEffect(() => {
    return () => {
      if (collisionCinematicTimeoutRef.current) {
        window.clearTimeout(collisionCinematicTimeoutRef.current);
        collisionCinematicTimeoutRef.current = 0;
      }
    };
  }, []);

  const handleUpdateMapIsland = React.useCallback((islandId, patch) => {
    setMapIslands((prev) =>
      normalizeMapIslands(
        prev.map((node) =>
          node.id === islandId
            ? {
                ...node,
                ...patch,
              }
            : node
        )
      )
    );
  }, []);

  const handleAddMapIsland = React.useCallback(() => {
    setMapIslands((prev) => {
      const nextIndex = prev.length;
      const last = prev[prev.length - 1] || DEFAULT_MAP_ISLANDS[0];
      const next = normalizeMapIslands([
        ...prev,
        {
          name: `Ilha ${nextIndex + 1}`,
          x: Math.min(0.96, (Number(last?.x) || 0.12) + 0.12),
          y: Math.max(0.26, Math.min(0.72, (Number(last?.y) || 0.58) + (nextIndex % 2 === 0 ? -0.05 : 0.05))),
          locked: true,
          artKey: "",
          imageUrl: "",
        },
      ]);
      setMapDevSelectedIslandId(nextIndex);
      return next;
    });
  }, []);

  const handleRemoveMapIsland = React.useCallback((islandId) => {
    setMapIslands((prev) => {
      if (prev.length <= 1) return prev;
      const next = normalizeMapIslands(prev.filter((node) => node.id !== islandId));
      return next;
    });
  }, []);

  const handleMapIslandImageUpload = React.useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !NODES[mapDevSelectedIslandId]) return;
      setIsMapIslandUploading(true);
      try {
        const uploaded = await uploadSceneAsset({
          file,
          folder: `islands/day-${NODES[mapDevSelectedIslandId]?.day || 1}/map`,
        });
        const nextUrl = String(
          typeof uploaded === "string"
            ? uploaded
            : uploaded?.url || uploaded?.path || uploaded?.file_url || ""
        ).trim();
        if (nextUrl) {
          const cacheKey = getMapIslandMediaCacheKey(nextUrl);
          islandImageCacheRef.current.delete(cacheKey);
          handleUpdateMapIsland(mapDevSelectedIslandId, { imageUrl: nextUrl, artKey: "" });
        }
      } catch (error) {
        console.error("Falha ao enviar imagem da ilha", error);
      } finally {
        setIsMapIslandUploading(false);
        if (event.target) event.target.value = "";
      }
    },
    [NODES, handleUpdateMapIsland, mapDevSelectedIslandId]
  );

  const openMapIslandLoadout = React.useCallback((clicked, options = {}) => {
    if (!clicked || clicked.locked) return;
    const skipFocusZoom = !!options.skipFocusZoom;
    const soundRef = options.soundRef || dailyEventMenuClickAudioRef;
    const soundVolume = Number(options.soundVolume);
    playAudioRef(soundRef, {
      enabled: isMenuSoundEnabled(),
      volume: Number.isFinite(soundVolume) ? soundVolume : 0.9,
    });
    const animateCameraTo = (targetZoom, targetCamera, duration, onDone) => {
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
      const currentCam = cameraRef.current;
      const currentZoom = zoomRef.current;
      const startTs = performance.now();
      const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      setIsMapIntroPlaying(true);
      const animateFocus = (ts) => {
        const t = Math.min(1, (ts - startTs) / duration);
        const eased = easeInOutCubic(t);
        const nextZoom = currentZoom + (targetZoom - currentZoom) * eased;
        const nextX = currentCam.x + (targetCamera.x - currentCam.x) * eased;
        const nextY = currentCam.y + (targetCamera.y - currentCam.y) * eased;
        setZoom(nextZoom);
        setCamera(clampCamera(nextX, nextY, nextZoom));

        if (t < 1) {
          mapIntroRafRef.current = requestAnimationFrame(animateFocus);
        } else {
          mapIntroRafRef.current = 0;
          setIsMapIntroPlaying(false);
          onDone?.();
        }
      };

      mapIntroRafRef.current = requestAnimationFrame(animateFocus);
    };

    const proceedToLoadout = () => {
      if (islandLoadoutLeavesStartedRef.current) return;
      islandLoadoutLeavesStartedRef.current = true;
      setCurrentNode(clicked.id);
      setSelectedIslandId(clicked.id);
      setVisitedNodes((prev) => new Set([...prev, clicked.id]));
      setTravelTargetId(clicked.id);
      setLoadoutTab("character");
      setIsIslandLoadoutLeavesActive(true);
      islandLoadoutOpenTimerRef.current = window.setTimeout(() => {
        setIsLoadoutTransitionActive(true);
        setLoadoutTransitionProgress(0);
        setIsLoadoutTransitionActive(true);
        startLoadoutOpenTransition(() => {
          setScreen("loadout");
        });
      }, 500);
    };

    if (skipFocusZoom) {
      proceedToLoadout();
      return;
    }

    const targetZoom = clicked.id === dailyIslandId ? 1.78 : 1.62;
    const targetCamera = getMapCameraForLensFocus(clicked, targetZoom, cameraRef.current.y);
    animateCameraTo(targetZoom, targetCamera, 780, proceedToLoadout);
  }, [dailyIslandId, getMapCameraForLensFocus, playAudioRef, startLoadoutOpenTransition]);

  const handleMapTap = (screenX, screenY) => {
    if (screen !== "map") return;
    const radius = Math.max(34, size.width * 0.085);
    const cameraNow = cameraRef.current;
    const zoomNow = zoomRef.current;
    const clicked = NODES.find((node) => {
      const pos = projectNodeToScreen(node, cameraNow, zoomNow);
      const dx = pos.x - screenX;
      const dy = pos.y - screenY;
      return dx * dx + dy * dy <= radius * radius;
    });
    if (!clicked) {
      const normalZoom = 1.35;
      const focusNode = NODES[currentNodeRef.current] || NODES[0];
      const normalCamera = getMapCameraForLensFocus(focusNode, normalZoom, cameraRef.current.y);
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
      setZoom(normalZoom);
      setCamera(normalCamera);
      return;
    }
    if (isDevMode) {
      setMapDevSelectedIslandId(clicked.id);
      setSelectedIslandId(clicked.id);
      return;
    }
    setCurrentNode(clicked.id);
    setSelectedIslandId(clicked.id);
    setVisitedNodes((prev) => new Set([...prev, clicked.id]));
  };

  const stopInertia = React.useCallback(() => {
    const pointer = pointerRef.current;
    if (pointer.inertiaRaf) {
      cancelAnimationFrame(pointer.inertiaRaf);
      pointer.inertiaRaf = 0;
    }
  }, []);

  const startInertia = React.useCallback(() => {
    const pointer = pointerRef.current;
    stopInertia();

    let vx = pointer.velocityX;
    let vy = 0;
    if (Math.abs(vx) < 0.01) return;

    let lastTs = performance.now();
    const tick = (ts) => {
      const dt = Math.max(8, Math.min(34, ts - lastTs));
      lastTs = ts;

      const decay = Math.pow(0.92, dt / 16.67);
      vx *= decay;
      vy *= decay;

      if (Math.abs(vx) < 0.003) {
        pointer.inertiaRaf = 0;
        return;
      }

      const currentCamera = cameraRef.current;
      const next = clampCamera(currentCamera.x + vx * dt, currentCamera.y, zoomRef.current);
      setCamera({ x: next.x, y: currentCamera.y });

      const hitXEdge = Math.abs(next.x - (currentCamera.x + vx * dt)) > 0.01;
      if (hitXEdge) vx *= 0.45;

      pointer.inertiaRaf = requestAnimationFrame(tick);
    };

    pointer.inertiaRaf = requestAnimationFrame(tick);
  }, [clampCamera, stopInertia]);

  React.useEffect(() => () => stopInertia(), [stopInertia]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      isPageVisibleRef.current = isVisible;
      const islandVideo = island001VideoRef.current;
      const seaVideo = marAnimadoVideoRef.current;
      const mapAmbientAudio = mapAmbientAudioRef.current;
      const gameplayAudio = gameplayMusicAudioRef.current;

      if (!isVisible) {
        islandVideo?.pause();
        seaVideo?.pause();
        mapAmbientAudio?.pause();
        gameplayAudio?.pause();
        stopInertia();
        if (mapIntroRafRef.current) {
          cancelAnimationFrame(mapIntroRafRef.current);
          mapIntroRafRef.current = 0;
        }
        setIsMapIntroPlaying(false);
        return;
      }

      const playIsland = islandVideo?.play?.();
      if (playIsland?.catch) playIsland.catch(() => {});
      if (ENABLE_SEA_VIDEO && phase === "game" && screen === "map") {
        const playSea = seaVideo?.play?.();
        if (playSea?.catch) playSea.catch(() => {});
      } else {
        seaVideo?.pause();
      }

      if (phase === "game" && screen === "map") {
        const playAmbient = mapAmbientAudio?.play?.();
        if (playAmbient?.catch) playAmbient.catch(() => {});
      } else {
        mapAmbientAudio?.pause();
      }
      if (phase === "game" && screen === "challenge") {
        const playGameplay = gameplayAudio?.play?.();
        if (playGameplay?.catch) playGameplay.catch(() => {});
      } else {
        gameplayAudio?.pause();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase, screen, stopInertia]);

  React.useEffect(() => {
    if (!ENABLE_SEA_VIDEO) return;
    const seaVideo = marAnimadoVideoRef.current;
    if (!seaVideo) return;
    if (phase === "game" && screen === "map" && !document.hidden) {
      const playSea = seaVideo.play?.();
      if (playSea?.catch) playSea.catch(() => {});
      return;
    }
    seaVideo.pause();
  }, [phase, screen, isMarAnimadoReady]);

  React.useEffect(() => {
    const audio = mapAmbientAudioRef.current;
    if (!audio) return;
    if (soundPrefs.gameMusicEnabled && phase === "game" && screen === "map" && !document.hidden) {
      const playAmbient = audio.play?.();
      if (playAmbient?.catch) playAmbient.catch(() => {});
      return;
    }
    audio.pause();
  }, [phase, screen, soundPrefs.gameMusicEnabled]);

  const handlePointerDown = (event) => {
    if (screen !== "map") return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mapAmbientAudio = mapAmbientAudioRef.current;
    if (phase === "game" && screen === "map") {
      const playAmbient = mapAmbientAudio?.play?.();
      if (playAmbient?.catch) playAmbient.catch(() => {});
    }
    if (isMapIntroPlaying) {
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
      setIsMapIntroPlaying(false);
      didInitMapCameraRef.current = true;
    }

    const pointer = pointerRef.current;
    stopInertia();
    if (pointer.pointers.size === 0) {
      pointer.suppressTapUntilNextDown = false;
    }
    pointer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pointer.moved = false;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastMoveTs = performance.now();
    pointer.velocityX = 0;
    pointer.velocityY = 0;

    if (pointer.pointers.size === 1) {
      pointer.mode = "drag";
      pointer.dragStartX = event.clientX;
      pointer.dragStartY = event.clientY;
      pointer.dragStartCameraX = cameraRef.current.x;
      pointer.dragStartCameraY = cameraRef.current.y;
    } else {
      pointer.mode = "pinch";
      setIsMapDragging(true);
      pointer.suppressTapUntilNextDown = true;
      const items = Array.from(pointer.pointers.values());
      pointer.pinchStartDist = Math.max(1, getDistance(items[0], items[1]));
      pointer.pinchStartZoom = zoomRef.current;
      const rect = canvas.getBoundingClientRect();
      const midpoint = getMidpoint(items[0], items[1]);
      const localX = midpoint.x - rect.left;
      const localY = midpoint.y - rect.top;
      pointer.pinchAnchorWorldX = localX / zoomRef.current + cameraRef.current.x;
      pointer.pinchAnchorWorldY = localY / zoomRef.current + cameraRef.current.y;
      pointer.moved = true;
    }

    canvas.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (screen !== "map") return;
    event.preventDefault();
    const pointer = pointerRef.current;
    if (!pointer.pointers.has(event.pointerId)) return;
    pointer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointer.mode === "pinch" && pointer.pointers.size >= 2) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const items = Array.from(pointer.pointers.values());
      const midpoint = getMidpoint(items[0], items[1]);
      const dist = Math.max(1, getDistance(items[0], items[1]));
      const nextZoom = clampZoom(pointer.pinchStartZoom * (dist / pointer.pinchStartDist));
      const rect = canvas.getBoundingClientRect();
      const localX = midpoint.x - rect.left;
      const localY = midpoint.y - rect.top;
      const desiredX = pointer.pinchAnchorWorldX - localX / nextZoom;
      const desiredY = pointer.pinchAnchorWorldY - localY / nextZoom;
      const nextCamera = clampCamera(desiredX, desiredY, nextZoom);
      setZoom(nextZoom);
      setCamera(nextCamera);
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastMoveTs = performance.now();
      pointer.velocityX = 0;
      pointer.velocityY = 0;
      return;
    }

    if (pointer.mode !== "drag" || pointer.pointers.size !== 1) return;

    const dxFromStart = event.clientX - pointer.dragStartX;
    const dyFromStart = event.clientY - pointer.dragStartY;
    if (!pointer.moved && Math.hypot(dxFromStart, dyFromStart) > 5) pointer.moved = true;
    if (pointer.moved && !isMapDragging) setIsMapDragging(true);
    if (!pointer.moved) return;

    const currentZoom = zoomRef.current;
    const currentCamera = cameraRef.current;
    const dxSinceLast = event.clientX - pointer.lastX;
    const dragSensitivity = 1.55;
    const next = clampCamera(currentCamera.x - (dxSinceLast * dragSensitivity) / currentZoom, currentCamera.y, currentZoom);
    const now = performance.now();
    const dt = Math.max(1, now - pointer.lastMoveTs);
    pointer.velocityX = -((dxSinceLast * dragSensitivity) / currentZoom) / dt;
    pointer.velocityY = 0;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastMoveTs = now;
    cameraRef.current = { x: next.x, y: currentCamera.y };
    syncMapViewportState();
  };

  const finalizePointer = (event) => {
    if (screen !== "map") return;
    const pointer = pointerRef.current;
    if (!pointer.pointers.has(event.pointerId)) return;
    pointer.pointers.delete(event.pointerId);

    if (pointer.mode === "pinch") {
      if (pointer.pointers.size === 1) {
        const remaining = Array.from(pointer.pointers.values())[0];
        pointer.mode = "drag";
        pointer.dragStartX = remaining.x;
        pointer.dragStartY = remaining.y;
        pointer.dragStartCameraX = cameraRef.current.x;
        pointer.dragStartCameraY = cameraRef.current.y;
        pointer.lastX = remaining.x;
        pointer.lastY = remaining.y;
        pointer.lastMoveTs = performance.now();
        pointer.moved = true;
      } else {
        pointer.mode = "idle";
        setIsMapDragging(false);
      }
      return;
    }

    if (pointer.mode === "drag" && pointer.pointers.size === 0) {
      syncMapViewportState(true);
      setIsMapDragging(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      const dragDistance = Math.hypot(event.clientX - pointer.dragStartX, event.clientY - pointer.dragStartY);
      if (!pointer.suppressTapUntilNextDown && dragDistance <= 16) {
        handleMapTap(localX, localY);
      } else {
        const viewportCenterX = size.width * 0.5;
        const predictedCameraX = cameraRef.current.x + pointer.velocityX * 96;
        const nearestNode = NODES.reduce((best, node) => {
          if (!node) return best;
          const point = projectNodeToScreen(
            node,
            { ...cameraRef.current, x: predictedCameraX },
            zoomRef.current
          );
          const distance = Math.abs(point.x - viewportCenterX);
          if (!best || distance < best.distance) {
            return { node, distance };
          }
          return best;
        }, null);
        if (nearestNode?.node) {
          setSelectedIslandId(nearestNode.node.id);
          focusMapIsland(nearestNode.node.id, 620);
        } else {
          startInertia();
        }
      }

      pointer.suppressTapUntilNextDown = false;
      pointer.mode = "idle";
    }
  };

  const handleWheel = (event) => {
    if (screen !== "map" || !isDesktopViewport) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isMapIntroPlaying) {
      if (mapIntroRafRef.current) {
        cancelAnimationFrame(mapIntroRafRef.current);
        mapIntroRafRef.current = 0;
      }
      setIsMapIntroPlaying(false);
      didInitMapCameraRef.current = true;
    }

    stopInertia();

    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const currentZoom = zoomRef.current;
    const currentCamera = cameraRef.current;
    const anchorWorldX = localX / currentZoom + currentCamera.x;
    const anchorWorldY = localY / currentZoom + currentCamera.y;

    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = clampZoom(currentZoom * zoomFactor);
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    const desiredX = anchorWorldX - localX / nextZoom;
    const desiredY = anchorWorldY - localY / nextZoom;
    const nextCamera = clampCamera(desiredX, desiredY, nextZoom);

    setZoom(nextZoom);
    setCamera(nextCamera);
  };

  const moveLane = React.useCallback((direction) => {
    if (isRunnerPausedRef.current) return;
    runnerSimulation.moveLane(direction);
  }, [runnerSimulation]);

  const triggerRunnerJump = React.useCallback(() => {
    if (isRunnerPausedRef.current) return;
    runnerSimulation.jump();
  }, [runnerSimulation]);

  const triggerRunnerSlide = React.useCallback(() => {
    if (isRunnerPausedRef.current) return;
    runnerSimulation.slide();
  }, [runnerSimulation]);

  const handleChallengeTouchStart = React.useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    challengeTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: true,
      swipeConsumed: false,
    };
  }, []);

  const handleChallengeTouchMove = React.useCallback(
    (event) => {
      const touch = event.touches?.[0];
      if (!touch || !challengeTouchRef.current.active) return;
      const deltaY = touch.clientY - challengeTouchRef.current.startY;
      if (!challengeTouchRef.current.swipeConsumed && Math.abs(deltaY) >= 28) {
        challengeTouchRef.current.swipeConsumed = true;
        if (deltaY < 0) triggerRunnerJump();
        else triggerRunnerSlide();
        challengeTouchRef.current.startX = touch.clientX;
        challengeTouchRef.current.startY = touch.clientY;
        return;
      }
      if (challengeTouchRef.current.swipeConsumed) return;
      const deltaX = touch.clientX - challengeTouchRef.current.startX;
      if (Math.abs(deltaX) < 28) return;
      moveLane(deltaX > 0 ? 1 : -1);
      challengeTouchRef.current.startX = touch.clientX;
      challengeTouchRef.current.startY = touch.clientY;
    },
    [moveLane, triggerRunnerJump, triggerRunnerSlide]
  );

  const handleChallengeTouchEnd = React.useCallback(() => {
    challengeTouchRef.current.active = false;
    challengeTouchRef.current.swipeConsumed = false;
  }, []);

  React.useEffect(() => {
    if (screen !== "challenge" && screen !== "challenge-intro") return undefined;
    const onKeyDown = (event) => {
      if (isDevMode && (event.key.toLowerCase() === "p" || event.key === " ")) {
        event.preventDefault();
        if (isRunnerPausedRef.current) {
          resumeRunnerFromEditorPosition();
        } else {
          setIsRunnerPaused(true);
          isRunnerPausedRef.current = true;
        }
        return;
      }
      if (screen !== "challenge") return;
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        moveLane(-1);
      } else if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        moveLane(1);
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        triggerRunnerJump();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        triggerRunnerSlide();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDevMode, moveLane, resumeRunnerFromEditorPosition, screen, triggerRunnerJump, triggerRunnerSlide]);

  const roadCurve = React.useMemo(() => {
    return 0;
  }, []);
  const bossDrift = React.useMemo(() => {
    const t = runnerState.elapsedMs;
    return Math.sin(t * 0.0011) * 3 + Math.sin(t * 0.00037 + 1.2) * 1.5;
  }, [runnerState.elapsedMs]);
  const bossLane = React.useMemo(() => {
    const t = Number(runnerState.elapsedMs || 0);
    const laneSequence = [1, 0, -1, 0];
    const segmentMs = 2200;
    const laneIndex = Math.floor(t / segmentMs) % laneSequence.length;
    return laneSequence[laneIndex] ?? 0;
  }, [runnerState.elapsedMs]);
  const bossBump = React.useMemo(() => {
    const t = runnerState.elapsedMs;
    const potholeMain = Math.abs(Math.sin(t * 0.0125)) * 6;
    const potholeSecondary = Math.abs(Math.sin(t * 0.021 + 0.7)) * 2.4;
    return potholeMain + potholeSecondary;
  }, [runnerState.elapsedMs]);
  const bossTilt = React.useMemo(() => {
    const t = runnerState.elapsedMs;
    return Math.sin(t * 0.01) * 2.8 + Math.sin(t * 0.004 + 0.5) * 1.5;
  }, [runnerState.elapsedMs]);
  const isChallengeScreen = screen === "challenge" || screen === "challenge-intro";
  const isDevChallengeActive = screen === "challenge" && isDevMode;
  const isDevModelerFullscreen =
    isChallengeScreen && screen === "challenge" && isDevMode && isModelerOpen && isModelerExpanded;
  const isChallengeFullscreen = isChallengeScreen && !isDesktopViewport;
  const shouldUseFullscreenFrame = isChallengeFullscreen || isDevModelerFullscreen;

  const startChallengeIntro = React.useCallback(() => {
    primeGameplayMusicRef();
    playAudioRef(dailyEventMenuClickAudioRef, {
      enabled: isMenuSoundEnabled(),
      volume: 0.88,
    });
    introCompletedRef.current = false;
    setIsRunnerSceneReady(false);
    runnerRuntimeStateRef.current = createDefaultRunnerState();
    setRunnerState(createDefaultRunnerState());
    setScreen("challenge-intro");
  }, [playAudioRef, primeGameplayMusicRef]);

  const handleRunnerSceneReady = React.useCallback(() => {
    setIsRunnerSceneReady(true);
  }, []);
  const handleResultRunnerSceneReady = React.useCallback(() => {
    setIsResultRunnerSceneReady(true);
  }, []);

  const handleRunnerIntroComplete = React.useCallback(() => {
    if (introCompletedRef.current) return;
    introCompletedRef.current = true;
    setScreen("challenge");
  }, []);

  const applyRunnerGraphicsPreset = React.useCallback((presetId) => {
    const preset = GRAPHICS_PRESET_LIBRARY[String(presetId || "")] || DEFAULT_GRAPHICS_SETTINGS;
    setRunnerGraphicsSettings(normalizeRunnerGraphicsSettings(preset));
  }, []);

  const handleRunnerGraphicsSettingChange = React.useCallback((field, value) => {
    setRunnerGraphicsSettings((prev) => {
      const next = normalizeRunnerGraphicsSettings({ ...(prev || {}), [field]: value });
      return {
        ...next,
        presetId: "custom",
        label: "Personalizado",
        description: "Ajuste manual para combinar com o celular do jogador.",
      };
    });
  }, []);

  const resultRunnerSceneState = React.useMemo(() => {
    const normalizedPhase =
      resultChestPhase === "arrival" ? "arrival" : resultChestPhase === "burst" ? "burst" : resultChestPhase === "opened" ? "opened" : "chest";
    return {
      ...runnerState,
      status:
        normalizedPhase === "arrival"
          ? "result_scared"
          : normalizedPhase === "opened"
            ? "result_celebrate"
            : "result_bg_run",
      lane: 0,
      laneVisual: 0,
      laneLean: 0,
      jump: 0,
      slide: 0,
      collectPulse: 0,
      collisionProgress: 0,
      worldFlow: 0,
      speed: normalizedPhase === "arrival" ? 0 : 1.18,
      blocks: [],
      powerBoxes: [],
      powerBreaks: [],
      obstacles: [],
      impacts: [],
      moneyRainMs: 0,
      moneyRainActive: false,
      moneyRainMultiplier: 1,
      resultPhase: normalizedPhase,
      resultChestTapCount,
      resultShowChestOnly: resultSummaryCollected,
    };
  }, [resultChestPhase, resultChestTapCount, resultSummaryCollected, runnerState]);

  const pendingCollectedReward = React.useMemo(() => {
    const island = NODES[selectedIslandId] || NODES[0];
    return createCollectedReward({
      island,
      score: runnerState.score,
      elapsedMs: runnerState.elapsedMs,
      isDaily: selectedIslandId === dailyIslandId,
      chestReward: resultRewards.chest,
    });
  }, [dailyIslandId, resultRewards.chest, runnerState.elapsedMs, runnerState.score, selectedIslandId]);
  const runXpReward = React.useMemo(
    () =>
      resolveRunXpReward({
        score: runnerState.score,
        completed: true,
        isNewBest: resultIsNewBest,
      }),
    [resultIsNewBest, runnerState.score]
  );
  const availableCharacters = React.useMemo(() => {
    const unlockedIds = new Set([
      ...resolveUnlockedCharacterIdsByLevel(playerGameLevel),
      ...(Array.isArray(playerInventory?.unlockedCharacterIds) ? playerInventory.unlockedCharacterIds : []),
    ]);
    return LOADOUT_CHARACTERS.map((item) => ({
      ...item,
      unlocked: unlockedIds.has(item.id),
    }));
  }, [playerGameLevel, playerInventory?.unlockedCharacterIds]);
  const selectedCharacter = React.useMemo(
    () => availableCharacters.find((item) => item.id === selectedCharacterId) || availableCharacters[0] || LOADOUT_CHARACTERS[0],
    [availableCharacters, selectedCharacterId]
  );
  const wardrobeCatalogEntries = React.useMemo(
    () => normalizeWardrobeCatalogEntries(sceneConfig?.loadout_wardrobe_catalog, { loadoutWardrobe: loadoutWardrobeDraft }),
    [loadoutWardrobeDraft, sceneConfig?.loadout_wardrobe_catalog]
  );
  const wardrobeCatalogSnapshot = React.useMemo(
    () =>
      buildWardrobeCatalogSnapshot({
        loadoutWardrobe: loadoutWardrobeDraft,
        catalogEntries: wardrobeCatalogEntries,
        selectedCharacterId,
        ownedWardrobeItemIds: playerInventory?.ownedWardrobeItemIds,
        playerLevel: playerGameLevel,
      }),
    [loadoutWardrobeDraft, playerGameLevel, playerInventory?.ownedWardrobeItemIds, selectedCharacterId, wardrobeCatalogEntries]
  );
  const equippedWardrobeForSelectedCharacter = React.useMemo(
    () => playerInventory?.equippedWardrobeByCharacterId?.[selectedCharacterId] || { presetItemId: "classic", slots: {} },
    [playerInventory?.equippedWardrobeByCharacterId, selectedCharacterId]
  );
  const loadoutSkins = React.useMemo(
    () => {
      const filtered = wardrobeCatalogSnapshot.compatibleItems
        .filter((item) => String(item.slot || "preset") === selectedWardrobeSlot)
        .map((item) => ({ ...item, name: item.label }));
      if (selectedWardrobeSlot === "preset") return filtered;
      const emptyBySlot = {
        head: "Sem chapeu",
        top: "Sem camisa",
        bottom: "Sem calca",
        shoes: "Sem sapato",
        hands: "Sem luvas",
        back: "Sem mochila",
        accessory: "Sem acessorio",
      };
      return [
        {
          id: "",
          name: emptyBySlot[selectedWardrobeSlot] || "Sem item",
          label: emptyBySlot[selectedWardrobeSlot] || "Sem item",
          description: "Remove a peca desse slot para esse personagem.",
          rarity: "Livre",
          accent: "from-slate-500 via-slate-600 to-slate-800",
          owned: true,
          source: "default",
          slot: selectedWardrobeSlot,
        },
        ...filtered,
      ];
    },
    [selectedWardrobeSlot, wardrobeCatalogSnapshot.compatibleItems]
  );
  const collectionSnapshot = React.useMemo(
    () => buildCollectionSnapshot({ inventory: playerInventory, rewardGallery, equippedPerkIds, wardrobeItems: wardrobeCatalogSnapshot.items }),
    [equippedPerkIds, playerInventory, rewardGallery, wardrobeCatalogSnapshot.items]
  );
  const wardrobeStoreSection = React.useMemo(
    () => buildWardrobeStoreSection({ wardrobeItems: wardrobeCatalogSnapshot.items, playerLevel: playerGameLevel }),
    [playerGameLevel, wardrobeCatalogSnapshot.items]
  );
  const storeCatalogSnapshot = React.useMemo(
    () => buildStoreCatalogSnapshot({ inventory: playerInventory, extraSections: wardrobeStoreSection ? [wardrobeStoreSection] : [] }),
    [playerInventory, wardrobeStoreSection]
  );
  const equippedWardrobeItemIdForSelectedCharacter = React.useMemo(() => {
    const requestedId =
      selectedWardrobeSlot === "preset"
        ? String(equippedWardrobeForSelectedCharacter?.presetItemId || "").trim()
        : String(equippedWardrobeForSelectedCharacter?.slots?.[selectedWardrobeSlot] || "").trim();
    if (requestedId) return requestedId;
    if (selectedWardrobeSlot === "preset") {
      return loadoutSkins.find((item) => item.owned)?.id || "classic";
    }
    return "";
  }, [equippedWardrobeForSelectedCharacter, loadoutSkins, selectedWardrobeSlot]);
  const selectedCharacterRenderVariant = "hero";
  const selectedSkin = React.useMemo(
    () => resolveWardrobeItemById(wardrobeCatalogSnapshot.items, selectedSkinId) || resolveWardrobeItemById(wardrobeCatalogSnapshot.items, equippedWardrobeItemIdForSelectedCharacter) || wardrobeCatalogSnapshot.items[0] || LOADOUT_SKINS[0],
    [equippedWardrobeItemIdForSelectedCharacter, selectedSkinId, wardrobeCatalogSnapshot.items]
  );
  const equippedWardrobeSlotItems = React.useMemo(
    () =>
      Object.entries(equippedWardrobeForSelectedCharacter?.slots || {}).reduce((acc, [slotKey, itemId]) => {
        const item = resolveWardrobeItemById(wardrobeCatalogSnapshot.items, itemId);
        if (item) acc[slotKey] = item;
        return acc;
      }, {}),
    [equippedWardrobeForSelectedCharacter?.slots, wardrobeCatalogSnapshot.items]
  );
  const activeGameLoadoutWardrobe = React.useMemo(
    () =>
      resolveEffectiveWardrobe(loadoutWardrobeDraft, {
        presetItem: resolveWardrobeItemById(wardrobeCatalogSnapshot.items, equippedWardrobeForSelectedCharacter?.presetItemId),
        slotItemsBySlot: equippedWardrobeSlotItems,
      }),
    [equippedWardrobeForSelectedCharacter?.presetItemId, equippedWardrobeSlotItems, loadoutWardrobeDraft, wardrobeCatalogSnapshot.items]
  );
  const loadoutConsumables = React.useMemo(
    () =>
      getAllConsumableDefinitions().map((item) => {
        const amount = Math.max(0, Number(playerInventory?.consumables?.[item.id]) || 0);
        return {
          ...item,
          amount,
          available: amount > 0,
        };
      }),
    [playerInventory?.consumables]
  );
  const selectedConsumable = React.useMemo(
    () =>
      loadoutConsumables.find((item) => item.id === selectedConsumableId) || {
        id: "",
        name: "Sem consumivel",
        description: "Entrar na run sem item ativo de pre-run.",
        amount: 0,
        available: true,
      },
    [loadoutConsumables, selectedConsumableId]
  );
  const availablePerks = React.useMemo(() => {
    const ownedPerks = Array.isArray(playerInventory?.ownedPerkIds) ? playerInventory.ownedPerkIds : [];
    const next = ownedPerks.map((id) => PERK_DEFINITIONS[id]).filter(Boolean);
    return next.length ? next : [PERK_DEFINITIONS[getDefaultEquippedPerkIds()[0]]].filter(Boolean);
  }, [playerInventory?.ownedPerkIds]);
  const selectedPerk = React.useMemo(
    () => availablePerks.find((item) => item.id === selectedPerkId) || availablePerks[0],
    [availablePerks, selectedPerkId]
  );
  const hasImportedLoadoutBaseModel = Boolean(String(loadoutBaseModelUrlDraft || "").trim());
  const activeLoadoutPreviewBaseModelUrl = React.useMemo(() => {
    if (!hasImportedLoadoutBaseModel) return "";
    return String(loadoutBaseModelUrlDraft || "").trim();
  }, [hasImportedLoadoutBaseModel, loadoutBaseModelUrlDraft]);
  const activeLoadoutPreviewFilter = React.useMemo(() => {
    if (selectedCharacterId === "richard" && hasImportedLoadoutBaseModel) return "none";
    return selectedCharacter.previewFilter;
  }, [hasImportedLoadoutBaseModel, selectedCharacter.previewFilter, selectedCharacterId]);
  const loadoutAssetWarmCacheRef = React.useRef(new Set());
  React.useEffect(() => {
    const urls = [playerIdleFbxUrl, loadoutBaseModelUrlDraft].map((value) => String(value || "").trim()).filter(Boolean);
    urls.forEach((url) => {
      const cacheKey = /^https?:\/\//i.test(url) ? url : resolveAssetUrl(url);
      if (!cacheKey || loadoutAssetWarmCacheRef.current.has(cacheKey)) return;
      loadoutAssetWarmCacheRef.current.add(cacheKey);
      loadRunner3DSceneModule()
        .then((module) => module.warmRunnerCharacterAsset?.(url))
        .catch(() => {});
    });
  }, [loadoutBaseModelUrlDraft]);
  React.useEffect(() => {
    const fallbackId =
      equippedWardrobeItemIdForSelectedCharacter ||
      loadoutSkins.find((item) => item.owned)?.id ||
      loadoutSkins[0]?.id ||
      "";
    if (selectedSkinId === fallbackId) return;
    setSelectedSkinId(fallbackId);
  }, [equippedWardrobeItemIdForSelectedCharacter, loadoutSkins, selectedSkinId]);
  const alternateLoadoutCharacter = React.useMemo(
    () => availableCharacters.find((item) => item.id !== selectedCharacterId && item.unlocked) || availableCharacters.find((item) => item.id !== selectedCharacterId) || availableCharacters[0],
    [availableCharacters, selectedCharacterId]
  );
  React.useEffect(() => {
    if (skipNextPerkLoadoutSaveRef.current) {
      skipNextPerkLoadoutSaveRef.current = false;
      return;
    }
    saveRunnerPerkLoadout(user?.id, equippedPerkIds);
  }, [equippedPerkIds, user?.id]);
  React.useEffect(() => {
    setPlayerInventory((current) => syncInventoryEquippedPerks(current, equippedPerkIds));
  }, [equippedPerkIds]);
  const toggleEquippedPerk = React.useCallback((perkId) => {
    const id = String(perkId || "").trim();
    const ownedPerkIds = Array.isArray(playerInventory?.ownedPerkIds) ? playerInventory.ownedPerkIds : [];
    if (!id || !PERK_DEFINITIONS[id] || !ownedPerkIds.includes(id)) return;
    setEquippedPerkIds((current) => {
      const list = Array.isArray(current) ? current : [];
      if (list.includes(id)) {
        const next = list.filter((entry) => entry !== id);
        return next.length ? next : list;
      }
      if (list.length >= RUNNER_PERK_LOADOUT_LIMIT) {
        return [...list.slice(1), id];
      }
      return [...list, id];
    });
    setSelectedPerkId(id);
  }, [playerInventory?.ownedPerkIds]);
  const handlePurchaseStoreItem = React.useCallback((itemId) => {
    const result = purchaseStoreItem({
      inventory: playerInventory,
      itemId,
      extraSections: wardrobeStoreSection ? [wardrobeStoreSection] : [],
    });
    if (!result?.ok || !result.inventory) {
      setStoreFeedbackMessage(result?.message || "Nao foi possivel concluir a compra.");
      return;
    }
    setPlayerInventory(result.inventory);
    setStoreFeedbackMessage(result.message || "Compra concluida.");
    if (result.item?.itemType === "perk_unlock" && !equippedPerkIds.includes(result.item.itemRefId)) {
      setSelectedPerkId(result.item.itemRefId);
    }
  }, [equippedPerkIds, playerInventory, wardrobeStoreSection]);
  const handleSelectLoadoutCharacter = React.useCallback((nextId) => {
    const currentIndex = availableCharacters.findIndex((item) => item.id === selectedCharacterId);
    const nextCharacter = availableCharacters.find((item) => item.id === nextId);
    const nextIndex = availableCharacters.findIndex((item) => item.id === nextId);
    if (!nextCharacter?.unlocked) return;
    if (nextIndex < 0 || nextId === selectedCharacterId) return;
    setLoadoutPreviewSlideDirection(nextIndex >= currentIndex ? 1 : -1);
    setSelectedCharacterId(nextId);
    setSelectedWardrobeSlot("preset");
    setPlayerInventory((current) => syncInventorySelectedCharacter(current, nextId, {}));
    setSelectedSkinId(String(playerInventory?.equippedWardrobeByCharacterId?.[nextId]?.presetItemId || "classic"));
    setLoadoutCharacterSwapToken((value) => value + 1);
  }, [availableCharacters, playerInventory?.equippedWardrobeByCharacterId, selectedCharacterId]);
  const handleSelectConsumable = React.useCallback((nextId) => {
    const nextInventory = syncInventorySelectedConsumable(playerInventory, nextId);
    setPlayerInventory(nextInventory);
    setSelectedConsumableId(String(nextInventory.selectedConsumableId || "").trim());
  }, [playerInventory]);
  const handleSelectLoadoutSkin = React.useCallback((nextId) => {
    const currentIndex = loadoutSkins.findIndex((item) => item.id === selectedSkinId);
    const nextSkin = loadoutSkins.find((item) => item.id === nextId);
    const nextIndex = loadoutSkins.findIndex((item) => item.id === nextId);
    if (nextId !== "" && !nextSkin?.owned) return;
    if (nextIndex < 0 || nextId === selectedSkinId) return;
    setLoadoutPreviewSlideDirection(nextIndex >= currentIndex ? 1 : -1);
    setSelectedSkinId(nextId);
    setPlayerInventory((current) => syncInventoryEquippedWardrobeItem(current, selectedCharacterId, nextId, selectedWardrobeSlot));
    setLoadoutCharacterSwapToken((value) => value + 1);
  }, [loadoutSkins, selectedCharacterId, selectedSkinId, selectedWardrobeSlot]);
  const wardrobeLibraryBySlot = React.useMemo(() => {
    const groups = {};
    WARDROBE_SLOT_DEFS.forEach(({ key }) => {
      groups[key] = [];
    });
    (Array.isArray(loadoutWardrobeDraft?.library) ? loadoutWardrobeDraft.library : []).forEach((item) => {
      const slot = String(item?.slot || "");
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(item);
    });
    return groups;
  }, [loadoutWardrobeDraft?.library]);
  const loadoutBackpackItems = React.useMemo(
    () => wardrobeCatalogSnapshot.compatibleItems.filter((item) => item.slot === "back").map((item) => ({ ...item, name: item.label })),
    [wardrobeCatalogSnapshot.compatibleItems]
  );
  const selectedBackpackItem = React.useMemo(() => {
    const equippedId = String(equippedWardrobeForSelectedCharacter?.slots?.back || "");
    if (!equippedId) return null;
    return loadoutBackpackItems.find((item) => String(item.id) === equippedId) || null;
  }, [equippedWardrobeForSelectedCharacter?.slots?.back, loadoutBackpackItems]);
  const previewRunnerState = React.useMemo(
    () => ({
      ...createDefaultRunnerState(),
      status: "idle",
      speed: 0,
      blocks: [],
      obstacles: [],
      impacts: [],
      resultPhase: "opened",
    }),
    []
  );

  const handleResultChestTap = React.useCallback(() => {
    if (screen !== "result") return;
    if (resultChestPhase !== "chest") return;
    playAudioRef(resultChestTurnAudioRef, {
      enabled: isInteractionSoundEnabled(),
      volume: 0.82,
    });
    setResultChestPulseToken((prev) => prev + 1);
    setResultChestTapCount((prev) => {
      const next = prev + 1;
      if (next >= RESULT_CHEST_TAPS_TO_OPEN) {
        playAudioRef(resultChestOpenAudioRef, {
          enabled: isInteractionSoundEnabled(),
          volume: 0.94,
        });
        setResultChestPhase("burst");
        if (resultChestTimeoutRef.current) {
          window.clearTimeout(resultChestTimeoutRef.current);
        }
        resultChestTimeoutRef.current = window.setTimeout(() => {
          resultChestTimeoutRef.current = 0;
          setResultChestPhase("opened");
        }, 720);
      }
      return next;
    });
  }, [playAudioRef, resultChestPhase, screen]);

  const handleConfirmResultSummary = React.useCallback(() => {
    if (screen !== "result") return;
    if (resultSummaryPhase !== "done" || resultSummaryCollected) return;
    const coinsEarned = Math.max(0, Number(resultRewards?.run?.coins) || 0);
    const diamondsEarned = Math.max(0, Number(resultRewards?.run?.diamonds) || 0);
    const keysEarned = Math.max(0, Number(resultRewards?.run?.keys) || 0);
    const xpEarned = Math.max(0, Number(runXpReward?.totalXp) || 0);
    playAudioRef(commonRewardCollectAudioRef, {
      enabled: isInteractionSoundEnabled(),
      volume: 0.84,
    });
    setPlayerInventory((prev) =>
      applyInventoryXpGain(
        applyInventoryWalletDelta(prev, {
          coins: coinsEarned,
          diamonds: diamondsEarned,
          keys: keysEarned,
        }),
        xpEarned
      )
    );
    setResultSummaryCollected(true);
    setResultChestPhase("arrival");
    if (resultChestTimeoutRef.current) {
      window.clearTimeout(resultChestTimeoutRef.current);
    }
    resultChestTimeoutRef.current = window.setTimeout(() => {
      resultChestTimeoutRef.current = 0;
      setResultChestPhase("chest");
    }, 900);
  }, [playAudioRef, resultRewards, resultSummaryCollected, resultSummaryPhase, runXpReward?.totalXp, screen]);

  const handleCollectResultReward = React.useCallback(() => {
    if (screen !== "result") return;
    if (resultChestPhase !== "opened") return;
    if (resultRewardCollected) {
      setScreen("rewards");
      return;
    }

    const reward = pendingCollectedReward;
    const chestReward = resultRewards?.chest || { coins: 0, diamonds: 0, keys: 0 };
    const isPremiumReward = ["epic", "legendary"].includes(String(reward?.rarity || "").toLowerCase());
    playAudioRef(isPremiumReward ? premiumRewardCollectAudioRef : commonRewardCollectAudioRef, {
      enabled: isInteractionSoundEnabled(),
      volume: isPremiumReward ? 0.92 : 0.84,
    });
    window.setTimeout(() => {
      playAudioRef(resultCoinsBarAudioRef, {
        enabled: isInteractionSoundEnabled(),
        volume: 0.82,
      });
    }, 140);
    setPlayerInventory((prev) =>
      applyInventoryWalletDelta(prev, {
        coins: Math.max(0, Number(chestReward?.coins) || 0),
        diamonds: Math.max(0, Number(chestReward?.diamonds) || 0),
        keys: Math.max(0, Number(chestReward?.keys) || 0),
      })
    );
    setRewardGallery((prev) => [reward, ...prev].slice(0, 48));
    setLatestCollectedRewardId(reward.id);
    setResultRewardCollected(true);
    setScreen("rewards");
  }, [pendingCollectedReward, playAudioRef, resultChestPhase, resultRewardCollected, resultRewards, screen]);

  const rewardGallerySlots = React.useMemo(() => {
    const filled = rewardGallery.slice(0, 12);
    const placeholders = Array.from({ length: Math.max(0, 12 - filled.length) }, (_, index) => ({
      id: `locked-${index}`,
      locked: true,
    }));
    return [...filled, ...placeholders];
  }, [rewardGallery]);

  const latestCollectedReward = React.useMemo(() => {
    if (!rewardGallery.length) return null;
    return rewardGallery.find((item) => item.id === latestCollectedRewardId) || rewardGallery[0];
  }, [latestCollectedRewardId, rewardGallery]);

  const clampDevPanelPos = React.useCallback((x, y) => {
    const container = challengeContainerRef.current;
    const panel = devPanelRef.current;
    if (!container || !panel) return { x, y };
    const outsideAllowance = typeof window !== "undefined" && window.innerWidth >= 1024
      ? Math.min(420, Math.floor(window.innerWidth * 0.24))
      : 8;
    const minX = 8 - outsideAllowance;
    const maxX = Math.max(minX, container.clientWidth - panel.offsetWidth + outsideAllowance);
    const maxY = Math.max(8, container.clientHeight - panel.offsetHeight - 8);
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);

  const clampDevContextMenuPos = React.useCallback((x, y) => {
    const container = challengeContainerRef.current;
    if (!container) return { x, y };
    const menu = devContextMenuRef.current;
    const menuWidth = Math.max(180, menu?.offsetWidth || 208);
    const menuHeight = Math.max(120, menu?.offsetHeight || 180);
    const maxX = Math.max(8, container.clientWidth - menuWidth - 8);
    const maxY = Math.max(8, container.clientHeight - menuHeight - 8);
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);

  const getSmartContextMenuPos = React.useCallback((anchorX, anchorY) => {
    const container = challengeContainerRef.current;
    if (!container) return clampDevContextMenuPos(anchorX + 16, anchorY - 8);
    const menu = devContextMenuRef.current;
    const menuWidth = Math.max(180, menu?.offsetWidth || 208);
    const menuHeight = Math.max(120, menu?.offsetHeight || 180);
    const safeGap = 28;
    const avoidRadius = 96;

    const candidates = [
      { x: anchorX + safeGap, y: anchorY - menuHeight * 0.36 },
      { x: anchorX - menuWidth - safeGap, y: anchorY - menuHeight * 0.36 },
      { x: anchorX - menuWidth * 0.5, y: anchorY + safeGap },
      { x: anchorX - menuWidth * 0.5, y: anchorY - menuHeight - safeGap },
    ];

    let best = null;
    candidates.forEach((candidate, idx) => {
      const clamped = clampDevContextMenuPos(candidate.x, candidate.y);
      const centerX = clamped.x + menuWidth * 0.5;
      const centerY = clamped.y + menuHeight * 0.5;
      const dist = Math.hypot(centerX - anchorX, centerY - anchorY);
      const penalty = dist < avoidRadius ? (avoidRadius - dist) * 1000 : 0;
      const score = penalty + idx * 0.01;
      if (!best || score < best.score) {
        best = { ...clamped, score, dist };
      }
    });

    if (!best) return clampDevContextMenuPos(anchorX + safeGap, anchorY - 8);
    if (best.dist >= avoidRadius) return { x: best.x, y: best.y };

    let farthest = best;
    candidates.forEach((candidate) => {
      const clamped = clampDevContextMenuPos(candidate.x, candidate.y);
      const centerX = clamped.x + menuWidth * 0.5;
      const centerY = clamped.y + menuHeight * 0.5;
      const dist = Math.hypot(centerX - anchorX, centerY - anchorY);
      if (dist > farthest.dist) farthest = { ...clamped, dist };
    });
    return { x: farthest.x, y: farthest.y };
  }, [clampDevContextMenuPos]);

  const clampDevConveyorPos = React.useCallback((x, y) => {
    const container = challengeContainerRef.current;
    if (!container) return { x, y };
    const panel = devConveyorRef.current;
    const panelWidth = Math.max(140, panel?.offsetWidth || 148);
    const panelHeight = Math.max(76, panel?.offsetHeight || 90);
    const outsideAllowance = typeof window !== "undefined" && window.innerWidth >= 1024
      ? Math.min(420, Math.floor(window.innerWidth * 0.24))
      : 8;
    const minX = 8 - outsideAllowance;
    const maxX = Math.max(minX, container.clientWidth - panelWidth + outsideAllowance);
    const maxY = Math.max(8, container.clientHeight - panelHeight - 8);
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);
  const clampDevRoadPos = React.useCallback((x, y) => {
    const container = challengeContainerRef.current;
    if (!container) return { x, y };
    const panel = devRoadPanelRef.current;
    const panelWidth = Math.max(220, panel?.offsetWidth || 248);
    const panelHeight = Math.max(180, panel?.offsetHeight || 220);
    const outsideAllowance = typeof window !== "undefined" && window.innerWidth >= 1024
      ? Math.min(420, Math.floor(window.innerWidth * 0.24))
      : 8;
    const minX = 8 - outsideAllowance;
    const maxX = Math.max(minX, container.clientWidth - panelWidth + outsideAllowance);
    const maxY = Math.max(8, container.clientHeight - panelHeight - 8);
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);
  const clampDevCameraPos = React.useCallback((x, y) => {
    const container = challengeContainerRef.current;
    if (!container) return { x, y };
    const panel = devCameraPanelRef.current;
    const panelWidth = Math.max(180, panel?.offsetWidth || 212);
    const panelHeight = Math.max(92, panel?.offsetHeight || 120);
    const outsideAllowance = typeof window !== "undefined" && window.innerWidth >= 1024
      ? Math.min(420, Math.floor(window.innerWidth * 0.24))
      : 8;
    const minX = 8 - outsideAllowance;
    const maxX = Math.max(minX, container.clientWidth - panelWidth + outsideAllowance);
    const maxY = Math.max(8, container.clientHeight - panelHeight - 8);
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);


  const handleDevPanelPointerDown = React.useCallback((event) => {
    const container = challengeContainerRef.current;
    const panel = devPanelRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    devPanelDragRef.current.active = true;
    devPanelDragRef.current.pointerId = event.pointerId;
    devPanelDragRef.current.offsetX = event.clientX - panelRect.left;
    devPanelDragRef.current.offsetY = event.clientY - panelRect.top;
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const initial = clampDevPanelPos(panelRect.left - containerRect.left, panelRect.top - containerRect.top);
    setDevPanelPos(initial);
  }, [clampDevPanelPos]);

  const handleDevContextMenuPointerDown = React.useCallback((event) => {
    const container = challengeContainerRef.current;
    const menu = devContextMenuRef.current;
    if (!container || !menu) return;

    const containerRect = container.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    devContextMenuDragRef.current.active = true;
    devContextMenuDragRef.current.pointerId = event.pointerId;
    devContextMenuDragRef.current.offsetX = event.clientX - menuRect.left;
    devContextMenuDragRef.current.offsetY = event.clientY - menuRect.top;
    menu.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const initial = clampDevContextMenuPos(menuRect.left - containerRect.left, menuRect.top - containerRect.top);
    setDevContextMenuPos(initial);
  }, [clampDevContextMenuPos]);

  const handleDevConveyorPointerDown = React.useCallback((event) => {
    const container = challengeContainerRef.current;
    const panel = devConveyorRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    devConveyorDragRef.current.active = true;
    devConveyorDragRef.current.pointerId = event.pointerId;
    devConveyorDragRef.current.offsetX = event.clientX - panelRect.left;
    devConveyorDragRef.current.offsetY = event.clientY - panelRect.top;
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const initial = clampDevConveyorPos(panelRect.left - containerRect.left, panelRect.top - containerRect.top);
    setDevConveyorPos(initial);
  }, [clampDevConveyorPos]);
  const handleDevRoadPanelPointerDown = React.useCallback((event) => {
    const container = challengeContainerRef.current;
    const panel = devRoadPanelRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    devRoadDragRef.current.active = true;
    devRoadDragRef.current.pointerId = event.pointerId;
    devRoadDragRef.current.offsetX = event.clientX - panelRect.left;
    devRoadDragRef.current.offsetY = event.clientY - panelRect.top;
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const initial = clampDevRoadPos(panelRect.left - containerRect.left, panelRect.top - containerRect.top);
    setDevRoadPanelPos(initial);
  }, [clampDevRoadPos]);
  const handleDevCameraPanelPointerDown = React.useCallback((event) => {
    const container = challengeContainerRef.current;
    const panel = devCameraPanelRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    devCameraDragRef.current.active = true;
    devCameraDragRef.current.pointerId = event.pointerId;
    devCameraDragRef.current.offsetX = event.clientX - panelRect.left;
    devCameraDragRef.current.offsetY = event.clientY - panelRect.top;
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const initial = clampDevCameraPos(panelRect.left - containerRect.left, panelRect.top - containerRect.top);
    setDevCameraPanelPos(initial);
  }, [clampDevCameraPos]);

  const handleDragScrollablePointerDown = React.useCallback((event, axis = "x") => {
    if (event.button !== 0) return;
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    const target = event.target;
    if (
      axis === "y" &&
      target instanceof Element &&
      target.closest("button, input, select, textarea, a")
    ) {
      return;
    }
    const state = dragScrollStateRef.current;
    state.active = true;
    state.pointerId = event.pointerId;
    state.pointerType = String(event.pointerType || "");
    state.element = element;
    state.axis = axis === "y" ? "y" : "x";
    state.startClientX = event.clientX;
    state.startClientY = event.clientY;
    state.startScrollLeft = element.scrollLeft;
    state.startScrollTop = element.scrollTop;
    state.moved = false;
    state.suppressClick = false;
    state.lastClientX = event.clientX;
    state.lastClientY = event.clientY;
    state.lastMoveTs = performance.now();
    state.velocity = 0;
    if (state.momentumFrame) {
      window.cancelAnimationFrame(state.momentumFrame);
      state.momentumFrame = 0;
    }
    if (axis === "y" || state.pointerType === "touch") {
      element.setPointerCapture?.(event.pointerId);
    }
  }, []);
  const handleDragScrollableClickCapture = React.useCallback((event) => {
    const state = dragScrollStateRef.current;
    if (!state.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    state.suppressClick = false;
  }, []);
  const centerLoadoutCarouselItem = React.useCallback((element) => {
    if (!(element instanceof HTMLElement)) return;
    const scroller = element.parentElement?.closest?.("[data-loadout-scroller='true']");
    if (!(scroller instanceof HTMLElement)) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const currentScroll = scroller.scrollLeft;
    const targetScroll =
      currentScroll + (elementRect.left - scrollerRect.left) - (scrollerRect.width * 0.5 - elementRect.width * 0.5);
    scroller.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  }, []);


  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = devPanelDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - drag.offsetX;
      const nextY = event.clientY - rect.top - drag.offsetY;
      setDevPanelPos(clampDevPanelPos(nextX, nextY));
    };

    const onPointerUp = (event) => {
      const drag = devPanelDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clampDevPanelPos]);

  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = devContextMenuDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - drag.offsetX;
      const nextY = event.clientY - rect.top - drag.offsetY;
      setDevContextMenuPos(clampDevContextMenuPos(nextX, nextY));
    };

    const onPointerUp = (event) => {
      const drag = devContextMenuDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clampDevContextMenuPos]);

  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = devConveyorDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - drag.offsetX;
      const nextY = event.clientY - rect.top - drag.offsetY;
      setDevConveyorPos(clampDevConveyorPos(nextX, nextY));
    };

    const onPointerUp = (event) => {
      const drag = devConveyorDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clampDevConveyorPos]);
  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = devRoadDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - drag.offsetX;
      const nextY = event.clientY - rect.top - drag.offsetY;
      setDevRoadPanelPos(clampDevRoadPos(nextX, nextY));
    };

    const onPointerUp = (event) => {
      const drag = devRoadDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clampDevRoadPos]);
  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = devCameraDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - drag.offsetX;
      const nextY = event.clientY - rect.top - drag.offsetY;
      setDevCameraPanelPos(clampDevCameraPos(nextX, nextY));
    };

    const onPointerUp = (event) => {
      const drag = devCameraDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clampDevCameraPos]);
  React.useEffect(() => {
    const startMomentum = (state) => {
      if (!state?.element || Math.abs(state.velocity) < 0.01) return;
      const step = () => {
        const current = dragScrollStateRef.current;
        if (current.active || current.element !== state.element) {
          current.momentumFrame = 0;
          return;
        }
        current.velocity *= 0.93;
        if (Math.abs(current.velocity) < 0.01 || !current.element) {
          current.momentumFrame = 0;
          return;
        }
        if (current.axis === "x") {
          current.element.scrollLeft -= current.velocity * 22;
        } else {
          current.element.scrollTop -= current.velocity * 22;
        }
        current.momentumFrame = window.requestAnimationFrame(step);
      };
      state.momentumFrame = window.requestAnimationFrame(step);
    };

    const onPointerMove = (event) => {
      const state = dragScrollStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId || !state.element) return;
      const dx = event.clientX - state.startClientX;
      const dy = event.clientY - state.startClientY;
      const isTouch = state.pointerType === "touch";
      const activationThreshold = isTouch ? (state.axis === "x" ? 3 : 4) : 6;
      const axisDistance = state.axis === "x" ? Math.abs(dx) : Math.abs(dy);
      const crossAxisDistance = state.axis === "x" ? Math.abs(dy) : Math.abs(dx);
      if (!state.moved) {
        const axisIntent =
          axisDistance >= activationThreshold &&
          (isTouch ? axisDistance >= crossAxisDistance * 0.85 : axisDistance >= crossAxisDistance * 0.55);
        if (!axisIntent) return;
      }
      if (state.axis === "x") {
        state.element.scrollLeft = state.startScrollLeft - dx;
      } else {
        state.element.scrollTop = state.startScrollTop - dy;
      }
      const now = performance.now();
      const axisDelta =
        state.axis === "x"
          ? event.clientX - state.lastClientX
          : event.clientY - state.lastClientY;
      const dt = Math.max(8, now - state.lastMoveTs);
      const instantVelocity = axisDelta / dt;
      state.velocity = state.velocity * 0.35 + instantVelocity * 0.65;
      state.lastClientX = event.clientX;
      state.lastClientY = event.clientY;
      state.lastMoveTs = now;
      if (axisDistance >= activationThreshold) {
        state.moved = true;
        state.suppressClick = true;
        event.preventDefault();
      }
    };

    const onPointerUp = (event) => {
      const state = dragScrollStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) return;
      state.element?.releasePointerCapture?.(event.pointerId);
      const shouldMomentum = state.moved && state.axis === "x" && Math.abs(state.velocity) > 0.015;
      const releasedElement = state.element;
      state.active = false;
      state.pointerId = null;
      state.pointerType = "";
      state.element = releasedElement;
      if (shouldMomentum) {
        startMomentum(state);
      }
      window.setTimeout(() => {
        dragScrollStateRef.current.suppressClick = false;
      }, 0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      const state = dragScrollStateRef.current;
      if (state.momentumFrame) {
        window.cancelAnimationFrame(state.momentumFrame);
        state.momentumFrame = 0;
      }
    };
  }, []);


  React.useEffect(() => {
    if (!(isChallengeScreen && screen === "challenge" && isDevMode)) return;
    const container = challengeContainerRef.current;
    const panel = devPanelRef.current;
    if (!container || !panel) return;

    setDevPanelPos((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampDevPanelPos(prev.x, prev.y);
      }
      const defaultX =
        typeof window !== "undefined" && window.innerWidth >= 1024
          ? container.clientWidth + 18
          : container.clientWidth - panel.offsetWidth - 12;
      const defaultY = 96;
      return clampDevPanelPos(defaultX, defaultY);
    });
  }, [clampDevPanelPos, isChallengeScreen, isDevMode, screen]);

  React.useEffect(() => {
    if (!(isChallengeScreen && screen === "challenge" && isDevMode)) return;
    const container = challengeContainerRef.current;
    const panel = devConveyorRef.current;
    if (!container || !panel) return;
    setDevConveyorPos((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampDevConveyorPos(prev.x, prev.y);
      }
      const defaultX =
        typeof window !== "undefined" && window.innerWidth >= 1024
          ? -panel.offsetWidth - 18
          : 12;
      return clampDevConveyorPos(defaultX, 220);
    });
  }, [clampDevConveyorPos, isChallengeScreen, isDevMode, screen]);
  React.useEffect(() => {
    if (!(isChallengeScreen && screen === "challenge" && isDevMode)) return;
    const container = challengeContainerRef.current;
    const panel = devRoadPanelRef.current;
    if (!container || !panel) return;
    setDevRoadPanelPos((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampDevRoadPos(prev.x, prev.y);
      }
      const defaultX =
        typeof window !== "undefined" && window.innerWidth >= 1024
          ? -panel.offsetWidth - 18
          : 12;
      return clampDevRoadPos(defaultX, 108);
    });
  }, [clampDevRoadPos, isChallengeScreen, isDevMode, screen]);
  React.useEffect(() => {
    if (!(isChallengeScreen && screen === "challenge" && isDevMode)) return;
    const container = challengeContainerRef.current;
    const panel = devCameraPanelRef.current;
    if (!container || !panel) return;
    setDevCameraPanelPos((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampDevCameraPos(prev.x, prev.y);
      }
      const defaultX =
        typeof window !== "undefined" && window.innerWidth >= 1024
          ? container.clientWidth + 18
          : 12;
      return clampDevCameraPos(defaultX, 500);
    });
  }, [clampDevCameraPos, isChallengeScreen, isDevMode, screen]);

  React.useEffect(() => {
    if (!(isChallengeScreen && screen === "challenge" && isDevMode && devSelectedObject?.key)) return;
    setDevContextMenuPos((prev) => clampDevContextMenuPos(prev.x, prev.y));
  }, [clampDevContextMenuPos, devSelectedObject?.key, isChallengeScreen, isDevMode, screen]);

  React.useEffect(() => {
    if (devSelectedObject?.key) return;
    setDevInteractionMode("select");
  }, [devSelectedObject?.key]);
  React.useEffect(() => {
    setDevPersistDebug(null);
  }, [devSelectedObject?.key]);
  React.useEffect(() => {
    devDraftOverridesRef.current = devDraftOverrides || {};
  }, [devDraftOverrides]);

  const patchSceneConfig = React.useCallback(
    async (patch) => {
      return new Promise((resolve) => {
        patchSceneConfigQueueRef.current = patchSceneConfigQueueRef.current
          .catch(() => null)
          .then(async () => {
            setIsSceneConfigSaving(true);
            setSceneConfigMessage("");
            try {
              const result = await saveIslandSceneConfig({
                id: sceneConfigRecordId,
                islandDay: selectedIslandDay,
                patch,
              });
              const nextConfig = {
                ...createDefaultSceneConfig(selectedIslandDay),
                ...(result?.config || {}),
                island_day: selectedIslandDay,
              };
              setSceneConfigRecordId(result?.id || null);
              setSceneConfig(nextConfig);
              resolve(nextConfig);
            } catch (error) {
              const status = Number(error?.status);
              if (status === 401) {
                setSceneConfigMessage("Sessao expirada (401). Faca login novamente para salvar alteracoes.");
              } else {
                setSceneConfigMessage("Nao foi possivel salvar alteracao da ilha.");
              }
              resolve(null);
            } finally {
              setIsSceneConfigSaving(false);
            }
          });
      });
    },
    [sceneConfigRecordId, selectedIslandDay]
  );

  const handleStartEmptyMap = React.useCallback(async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja começar o mapa sem elementos? Isso vai remover todos os elementos adicionados no mapa atual."
    );
    if (!confirmed) return;
    setDevSelectedObject(null);
    setDevDraftOverrides({});
    setDevPositionDraft({ x: "0", y: "0", z: "0" });
    setDevScaleDraft({ scale: "1.00", scaleX: "1.00", scaleY: "1.00", scaleZ: "1.00" });
    runnerRuntimeStateRef.current = createDefaultRunnerState();
    setRunnerState(createDefaultRunnerState());
    setIsRunnerPaused(false);
    setDevCameraPreset("player");
    setDevCameraResetToken((value) => value + 1);
    const nextOverrides =
      sceneConfigRef.current?.object_overrides && typeof sceneConfigRef.current.object_overrides === "object"
        ? { ...sceneConfigRef.current.object_overrides }
        : {};
    nextOverrides.player = sanitizeFixedSceneOverride("player", nextOverrides.player || {});
    const saved = await patchSceneConfig({ custom_objects: [], base_only_mode: true, object_overrides: nextOverrides });
    if (saved) {
      setSceneConfigMessage("Mapa limpo: ficaram apenas grama, horizonte, estrada, carro e personagem.");
    }
  }, [patchSceneConfig]);
  const applyRoadSculptDraftPatch = React.useCallback(
    async (nextDraft) => {
      const draft = normalizeRoadSculptDraft(nextDraft);
      const persistedHorizon = sceneConfigRef.current?.object_overrides?.horizon || {};
      const draftHorizon = devDraftOverridesRef.current?.horizon || {};
      const nextHorizonY = Math.max(-20, Math.min(20, Number(draftHorizon?.y ?? persistedHorizon?.y ?? 0) || 0));
      const nextHorizonZ = Math.max(-260, Math.min(120, Number(draftHorizon?.z ?? persistedHorizon?.z ?? 0) || 0));
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            road_depth_scale: draft.depthScale,
            road_curve_extra: draft.curveExtra,
            road_curve_global: draft.curveGlobal,
            road_curve_start_z: draft.curveStartZ,
            road_curve_fade_z: draft.curveFadeZ,
            road_drop_extra: draft.dropExtra,
            road_grade_global: draft.gradeGlobal,
            road_grade_horizon_boost: draft.gradeHorizonBoost,
            road_drop_start_z: draft.dropStartZ,
            road_drop_fade_z: draft.dropFadeZ,
            road_events: normalizeRoadEventBlocks(devRoadEventBlocks),
          },
          horizon: {
            ...persistedHorizon,
            y: nextHorizonY,
            z: nextHorizonZ,
          },
        },
      });
      setDevDraftOverrides((prev) => ({
        ...(prev || {}),
        horizon: {
          ...((prev && prev.horizon) || {}),
          y: nextHorizonY,
          z: nextHorizonZ,
        },
      }));
    },
    [devRoadEventBlocks, patchSceneConfig]
  );
  const handleRoadSculptDraftChange = React.useCallback((field, value) => {
    setDevRoadSculptDraft((prev) => normalizeRoadSculptDraft({ ...(prev || {}), [field]: value }));
  }, []);
  const handleRoadSculptNudge = React.useCallback((field, delta) => {
    setDevRoadSculptDraft((prev) => {
      const current = normalizeRoadSculptDraft(prev || {});
      const nextValue = Number(current?.[field] || 0) + Number(delta || 0);
      return normalizeRoadSculptDraft({ ...current, [field]: nextValue });
    });
  }, []);
  const isMapStageEditMode = devStageEditMode === "map" || devStageEditMode === "full_map";
  const isFullMapStageEditMode = devStageEditMode === "full_map";
  const stopRoadSculptHold = React.useCallback((pointerId = null) => {
    const hold = devRoadAdjustHoldRef.current;
    if (pointerId !== null && hold.pointerId !== pointerId) return;
    if (hold.timer) {
      window.clearInterval(hold.timer);
      hold.timer = 0;
    }
    hold.pointerId = null;
  }, []);
  const startRoadSculptHold = React.useCallback((field, delta, event) => {
    if (!event) return;
    stopRoadSculptHold();
    handleRoadSculptNudge(field, delta);
    const hold = devRoadAdjustHoldRef.current;
    hold.pointerId = event.pointerId;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    hold.timer = window.setInterval(() => {
      handleRoadSculptNudge(field, delta);
    }, 70);
  }, [handleRoadSculptNudge, stopRoadSculptHold]);
  const stopSelectedNudgeHold = React.useCallback((pointerId = null) => {
    const hold = devSelectedNudgeHoldRef.current;
    if (pointerId !== null && hold.pointerId !== pointerId) return;
    if (hold.holdTimer) {
      window.clearTimeout(hold.holdTimer);
      hold.holdTimer = 0;
    }
    if (hold.repeatTimer) {
      window.clearInterval(hold.repeatTimer);
      hold.repeatTimer = 0;
    }
    hold.pointerId = null;
    hold.repeats = 0;
  }, []);
  const startSelectedNudgeHold = React.useCallback((axis, delta, event) => {
    if (!event) return;
    stopSelectedNudgeHold();
    if (typeof handleNudgeSelectedPositionRef.current === "function") {
      handleNudgeSelectedPositionRef.current(axis, delta);
    }
    const hold = devSelectedNudgeHoldRef.current;
    hold.pointerId = event.pointerId;
    hold.repeats = 0;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    hold.holdTimer = window.setTimeout(() => {
      hold.repeatTimer = window.setInterval(() => {
        hold.repeats += 1;
        const accel = hold.repeats > 34 ? 4.8 : hold.repeats > 16 ? 3.2 : 2.1;
        if (typeof handleNudgeSelectedPositionRef.current === "function") {
          handleNudgeSelectedPositionRef.current(axis, delta * accel);
        }
      }, 28);
    }, 140);
  }, [stopSelectedNudgeHold]);
  const stopSelectedRotateHold = React.useCallback((pointerId = null) => {
    const hold = devSelectedRotateHoldRef.current;
    if (pointerId !== null && hold.pointerId !== pointerId) return;
    if (hold.holdTimer) {
      window.clearTimeout(hold.holdTimer);
      hold.holdTimer = 0;
    }
    if (hold.repeatTimer) {
      window.clearInterval(hold.repeatTimer);
      hold.repeatTimer = 0;
    }
    hold.pointerId = null;
    hold.repeats = 0;
  }, []);
  const handleResetRoadSculptDraft = React.useCallback(() => {
    setDevRoadSculptDraft(normalizeRoadSculptDraft({}));
  }, []);
  const mapCycleLengthValue = React.useMemo(
    () => Math.max(80, Math.min(5000, Number(devMapCycleLength) || 600)),
    [devMapCycleLength]
  );
  const editorPreviewFlowOffset = React.useMemo(() => {
    if (!isMapStageEditMode) return 0;
    const cursor = Number(devMapCursorZ || 0);
    const cycleFlow = Number(runnerState.worldFlow || 0);
    const previewFlow = cursor + cycleFlow;
    return ((previewFlow % mapCycleLengthValue) + mapCycleLengthValue) % mapCycleLengthValue;
  }, [devMapCursorZ, isMapStageEditMode, mapCycleLengthValue, runnerState.worldFlow]);
  const toStoredEditorZ = React.useCallback(
    (previewZ) => {
      const raw = Number(previewZ);
      if (!Number.isFinite(raw)) return raw;
      if (!isMapStageEditMode) return raw;
      const stored = raw - editorPreviewFlowOffset;
      const wrapped = ((-stored % mapCycleLengthValue) + mapCycleLengthValue) % mapCycleLengthValue;
      return -wrapped;
    },
    [editorPreviewFlowOffset, isMapStageEditMode, mapCycleLengthValue]
  );
  const normalizeStoredCycleZ = React.useCallback(
    (storedZ) => {
      const raw = Number(storedZ);
      if (!Number.isFinite(raw)) return raw;
      if (!isMapStageEditMode) return raw;
      const wrapped = ((-raw % mapCycleLengthValue) + mapCycleLengthValue) % mapCycleLengthValue;
      return -wrapped;
    },
    [isMapStageEditMode, mapCycleLengthValue]
  );
  const toPreviewEditorZ = React.useCallback(
    (storedZ) => {
      const raw = Number(storedZ);
      if (!Number.isFinite(raw)) return raw;
      if (!isMapStageEditMode) return raw;
      const cycle = Math.max(80, Number(mapCycleLengthValue) || 0);
      if (!Number.isFinite(cycle) || cycle <= 0) return raw + editorPreviewFlowOffset;
      let preview = raw + editorPreviewFlowOffset;
      while (preview > 0) preview -= cycle;
      while (preview <= -cycle) preview += cycle;
      return preview;
    },
    [editorPreviewFlowOffset, isMapStageEditMode, mapCycleLengthValue]
  );
  const handleAddRoadEventBlock = React.useCallback(async () => {
    const draft = normalizeNewRoadEventDraft(devNewRoadEventDraft);
    const safeType = draft.type === "grade" ? "grade" : "curve";
    const eventStartZ = isMapStageEditMode ? toStoredEditorZ(-34) : -34;
    let nextBlocks = [];
    setDevRoadEventBlocks((prev) => {
      const list = normalizeRoadEventBlocks(prev);
      const nextId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setDevSelectedRoadEventId(nextId);
      nextBlocks = [
        ...list,
        {
          id: nextId,
          name: String(draft.name || (safeType === "curve" ? `Curva ${list.length + 1}` : `Subida/Descida ${list.length + 1}`)),
          type: safeType,
          strength: draft.strength,
          startZ: eventStartZ,
          length: draft.length,
          loopEnabled: isMapStageEditMode ? false : draft.loopEnabled,
          loopEverySeconds: draft.loopEverySeconds,
          enabled: true,
        },
      ];
      return nextBlocks;
    });
    setDevRoadEventsOpen(true);
    setDevNewRoadEventDraft((prev) =>
      normalizeNewRoadEventDraft({
        ...prev,
        name: "",
      })
    );
    if (nextBlocks.length) {
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            road_events: nextBlocks,
          },
        },
      });
      setSceneConfigMessage("Bloco da estrada adicionado e salvo.");
    }
  }, [devNewRoadEventDraft, isMapStageEditMode, patchSceneConfig, toStoredEditorZ]);
  const focusRoadEventInEditor = React.useCallback((eventId) => {
    const targetId = String(eventId || "");
    if (!isMapStageEditMode || !targetId) return;
    const blocks = normalizeRoadEventBlocks(devRoadEventBlocks);
    const target = blocks.find((item) => String(item?.id || "") === targetId);
    if (!target) return;
    const targetCursor = Number((-34 - Number(target.startZ || -34)).toFixed(3));
    setDevMapCursorZ(targetCursor);
  }, [devRoadEventBlocks, isMapStageEditMode]);
  const handleNewRoadEventDraftChange = React.useCallback((field, value) => {
    setDevNewRoadEventDraft((prev) => normalizeNewRoadEventDraft({ ...(prev || {}), [field]: value }));
  }, []);
  const handleRoadEventBlockChange = React.useCallback((id, patch) => {
    setDevRoadEventBlocks((prev) =>
      normalizeRoadEventBlocks(
        (Array.isArray(prev) ? prev : []).map((item) =>
          String(item?.id || "") === String(id) ? { ...item, ...(patch || {}) } : item
        )
      )
    );
  }, []);
  const handleRemoveRoadEventBlock = React.useCallback(async (id) => {
    const targetId = String(id || "");
    const nextBlocks = normalizeRoadEventBlocks(
      (Array.isArray(devRoadEventBlocks) ? devRoadEventBlocks : []).filter((item) => String(item?.id || "") !== targetId)
    );
    setDevRoadEventBlocks(nextBlocks);
    setDevSelectedRoadEventId((prev) => (String(prev || "") === targetId ? "" : prev));
    await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          road_events: nextBlocks,
        },
      },
    });
    setSceneConfigMessage("Bloco da estrada removido.");
  }, [devRoadEventBlocks, patchSceneConfig]);
  const handleDevRoadEventAdjust = React.useCallback(async (payload) => {
    const id = String(payload?.id || "");
    if (!id) return;
    if (payload?.select) {
      setDevSelectedRoadEventId(id);
    }
    let nextBlocks = null;
    if (payload?.patch && typeof payload.patch === "object") {
      setDevRoadEventBlocks((prev) => {
        nextBlocks = normalizeRoadEventBlocks(
          (Array.isArray(prev) ? prev : []).map((item) =>
            String(item?.id || "") === id ? { ...item, ...payload.patch } : item
          )
        );
        return nextBlocks;
      });
    }
    if (payload?.isFinal) {
      const blocksToSave = normalizeRoadEventBlocks(nextBlocks || devRoadEventBlocks).map((event) =>
        isMapStageEditMode ? { ...event, loopEnabled: false } : event
      );
      setDevRoadEventBlocks(blocksToSave);
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            road_events: blocksToSave,
          },
        },
      });
      setSceneConfigMessage("Bloco da estrada atualizado e salvo.");
    }
  }, [devRoadEventBlocks, isMapStageEditMode, patchSceneConfig]);
  const handleApplyRoadEventsPatch = React.useCallback(async () => {
    const nextRoadEvents = normalizeRoadEventBlocks(devRoadEventBlocks).map((event) =>
      isMapStageEditMode ? { ...event, loopEnabled: false } : event
    );
    setDevRoadEventBlocks(nextRoadEvents);
    const result = await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          road_events: nextRoadEvents,
        },
      },
    });
    if (result) {
      setSceneConfigMessage("Blocos da estrada salvos.");
    }
  }, [devRoadEventBlocks, isMapStageEditMode, patchSceneConfig]);
  const handleSnapAllObjectsToTerrain = React.useCallback(async () => {
    const currentConfig = sceneConfigRef.current || {};
    const currentOverrides =
      currentConfig.object_overrides && typeof currentConfig.object_overrides === "object"
        ? currentConfig.object_overrides
        : {};
    const currentCustomObjects = Array.isArray(currentConfig.custom_objects) ? currentConfig.custom_objects : [];
    const nextOverrides = { ...currentOverrides };

    const convertStoredX = (rawX, z, xModeRaw) => {
      const x = Number(rawX);
      const zNum = Number(z);
      if (!Number.isFinite(x) || !Number.isFinite(zNum)) return Number.isFinite(x) ? x : 0;
      const xMode = String(xModeRaw || "");
      if (xMode === "relative_curve") return x;
      return x - getCurveOffsetAtZ(zNum, roadCurve);
    };
    const convertStoredY = (rawY, z, yModeRaw) => {
      const y = Number(rawY);
      const zNum = Number(z);
      if (!Number.isFinite(y) || !Number.isFinite(zNum)) return Number.isFinite(y) ? y : 0;
      const yMode = String(yModeRaw || "");
      if (yMode === "relative_ground") return y;
      return y - getGroundDropAtZ(zNum);
    };

    const nextCustomObjects = currentCustomObjects.map((entry) => {
      const key = String(entry?.key || "");
      if (!key) return entry;
      const override = nextOverrides[key] && typeof nextOverrides[key] === "object" ? nextOverrides[key] : {};
      const z = Number.isFinite(Number(override?.z)) ? Number(override.z) : Number(entry?.z || 0);
      const xRaw = Number.isFinite(Number(override?.x)) ? Number(override.x) : Number(entry?.x || 0);
      const yRaw = Number.isFinite(Number(override?.y)) ? Number(override.y) : Number(entry?.y || 0);
      const xModeRaw = String(override?.x_mode || entry?.x_mode || "world");
      const yModeRaw = String(override?.y_mode || entry?.y_mode || "world");
      const nextX = convertStoredX(xRaw, z, xModeRaw);
      const nextY = convertStoredY(yRaw, z, yModeRaw);

      nextOverrides[key] = {
        ...override,
        x: nextX,
        y: nextY,
        z,
        x_mode: "relative_curve",
        y_mode: "relative_ground",
      };

      return {
        ...entry,
        x: nextX,
        y: nextY,
        z,
        x_mode: "relative_curve",
        y_mode: "relative_ground",
        movement_mode: String(entry?.movement_mode || "flow"),
        block_id: getSceneBlockId(nextX + getCurveOffsetAtZ(z, roadCurve), z),
      };
    });

    Object.entries(currentOverrides).forEach(([key, value]) => {
      const safeKey = String(key || "");
      if (!safeKey.startsWith("vegetation_") && !safeKey.startsWith("edge_vegetation_")) return;
      const override = value && typeof value === "object" ? value : {};
      const z = Number.isFinite(Number(override?.z)) ? Number(override.z) : 0;
      const xRaw = Number.isFinite(Number(override?.x)) ? Number(override.x) : 0;
      const yRaw = Number.isFinite(Number(override?.y)) ? Number(override.y) : 0;
      const nextX = convertStoredX(xRaw, z, override?.x_mode);
      const nextY = convertStoredY(yRaw, z, override?.y_mode);
      nextOverrides[safeKey] = {
        ...override,
        x: nextX,
        y: nextY,
        z,
        x_mode: "relative_curve",
        y_mode: "relative_ground",
      };
    });

    await patchSceneConfig({
      custom_objects: nextCustomObjects,
      object_overrides: nextOverrides,
    });
    setDevDraftOverrides({});
    setSceneConfigMessage("Objetos reajustados: todos colados no terreno e seguindo curvatura.");
  }, [patchSceneConfig, roadCurve]);
  const handleApplyCameraFollowDistance = React.useCallback(async () => {
    const nextDistance = Math.max(4, Math.min(24, Number(devCameraFollowDistance) || 9.4));
    setDevCameraFollowDistance(nextDistance);
    await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          camera_follow_distance: nextDistance,
        },
      },
    });
  }, [devCameraFollowDistance, patchSceneConfig]);
  const handleRoadVisualDraftChange = React.useCallback((field, value) => {
    const nextDraft = normalizeRoadVisualDraft({ ...(devRoadVisualDraft || {}), [field]: value });
    setDevRoadVisualDraft(nextDraft);
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      road_base: {
        ...((prev && prev.road_base) || {}),
        model_url: nextDraft.modelUrl,
        road_surface_y: nextDraft.roadSurfaceY,
        road_model_x: nextDraft.roadModelX,
        road_model_y: nextDraft.roadModelY,
        road_model_z: nextDraft.roadModelZ,
        road_model_rot_x: nextDraft.roadModelRotX,
        road_model_rot_y: nextDraft.roadModelRotY,
        road_model_rot_z: nextDraft.roadModelRotZ,
        road_model_scale: nextDraft.roadModelScale,
        road_model_scale_x: nextDraft.roadModelScaleX,
        road_model_scale_y: nextDraft.roadModelScaleY,
        road_model_scale_z: nextDraft.roadModelScaleZ,
        road_chunk_length: nextDraft.roadChunkLength,
        road_repeat_enabled: nextDraft.roadRepeatEnabled,
        outer_grass_y: nextDraft.outerGrassY,
        outer_grass_width: nextDraft.outerGrassWidth,
        outer_grass_offset: nextDraft.outerGrassOffset,
        procedural_edge_enabled: nextDraft.proceduralEdgeEnabled,
        procedural_wall_height: nextDraft.proceduralWallHeight,
        procedural_wall_width: nextDraft.proceduralWallWidth,
        procedural_wall_y: nextDraft.proceduralWallY,
        procedural_wall_offset: nextDraft.proceduralWallOffset,
        procedural_wall_texture_url: nextDraft.proceduralWallTextureUrl,
        procedural_grass_lift: nextDraft.proceduralGrassLift,
        procedural_grass_width: nextDraft.proceduralGrassWidth,
        procedural_grass_offset: nextDraft.proceduralGrassOffset,
        procedural_grass_y: nextDraft.proceduralGrassY,
        procedural_grass_texture_url: nextDraft.proceduralGrassTextureUrl,
      },
    }));
    setDevEditNonce((prev) => prev + 1);
  }, [devRoadVisualDraft]);
  const handleSaveRoadVisualDraft = React.useCallback(async (message = "Visual da estrada salvo.") => {
    const nextVisual = normalizeRoadVisualDraft(devRoadVisualDraft);
    setDevRoadVisualDraft(nextVisual);
    setIsRoadVisualSaving(true);
    try {
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            model_url: nextVisual.modelUrl,
            road_surface_y: nextVisual.roadSurfaceY,
            road_model_x: nextVisual.roadModelX,
            road_model_y: nextVisual.roadModelY,
            road_model_z: nextVisual.roadModelZ,
            road_model_rot_x: nextVisual.roadModelRotX,
            road_model_rot_y: nextVisual.roadModelRotY,
            road_model_rot_z: nextVisual.roadModelRotZ,
            road_model_scale: nextVisual.roadModelScale,
            road_model_scale_x: nextVisual.roadModelScaleX,
            road_model_scale_y: nextVisual.roadModelScaleY,
            road_model_scale_z: nextVisual.roadModelScaleZ,
            road_chunk_length: nextVisual.roadChunkLength,
          road_repeat_enabled: nextVisual.roadRepeatEnabled,
          outer_grass_y: nextVisual.outerGrassY,
          outer_grass_width: nextVisual.outerGrassWidth,
          outer_grass_offset: nextVisual.outerGrassOffset,
          procedural_edge_enabled: nextVisual.proceduralEdgeEnabled,
          procedural_wall_height: nextVisual.proceduralWallHeight,
          procedural_wall_width: nextVisual.proceduralWallWidth,
          procedural_wall_y: nextVisual.proceduralWallY,
          procedural_wall_offset: nextVisual.proceduralWallOffset,
          procedural_wall_texture_url: nextVisual.proceduralWallTextureUrl,
          procedural_grass_lift: nextVisual.proceduralGrassLift,
          procedural_grass_width: nextVisual.proceduralGrassWidth,
          procedural_grass_offset: nextVisual.proceduralGrassOffset,
          procedural_grass_y: nextVisual.proceduralGrassY,
          procedural_grass_texture_url: nextVisual.proceduralGrassTextureUrl,
        },
      },
      });
      setSceneConfigMessage(message);
    } finally {
      setIsRoadVisualSaving(false);
    }
  }, [devRoadVisualDraft, patchSceneConfig]);
  const handleResetProceduralGrassEdgeDeform = React.useCallback(async () => {
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      road_base: {
        ...((prev && prev.road_base) || {}),
        procedural_grass_vertex_offsets_left: {},
        procedural_grass_vertex_offsets_right: {},
      },
    }));
    await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          procedural_grass_vertex_offsets_left: {},
          procedural_grass_vertex_offsets_right: {},
        },
      },
    });
    setSceneConfigMessage("Deformacoes da borda da grama removidas.");
  }, [patchSceneConfig]);
  const handleRoadChunkModelUpload = React.useCallback(async (event) => {
    const file = event.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (detectAssetTypeFromName(file.name) !== "model3d") {
      setSceneConfigMessage("Envie um arquivo 3D para a estrada.");
      return;
    }
    setIsRoadVisualSaving(true);
    try {
      const url = await uploadSceneAsset(file, {
        folder: `islands/day-${selectedIslandDay}`,
        filename: file.name,
      });
      const nextVisual = normalizeRoadVisualDraft({
        ...(devRoadVisualDraft || {}),
        modelUrl: url,
        roadModelX: 0,
        roadModelY: 0,
        roadModelZ: 0,
        roadModelRotX: 0,
        roadModelRotY: 0,
        roadModelRotZ: 0,
        roadModelScale: 1,
        roadModelScaleX: 1,
        roadModelScaleY: 1,
        roadModelScaleZ: 1,
        roadChunkLength: 0,
        roadRepeatEnabled: false,
      });
      setDevRoadVisualDraft(nextVisual);
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            model_url: url,
            hidden: false,
            road_surface_y: nextVisual.roadSurfaceY,
            road_model_x: nextVisual.roadModelX,
            road_model_y: nextVisual.roadModelY,
            road_model_z: nextVisual.roadModelZ,
            road_model_rot_x: nextVisual.roadModelRotX,
            road_model_rot_y: nextVisual.roadModelRotY,
            road_model_rot_z: nextVisual.roadModelRotZ,
            road_model_scale: nextVisual.roadModelScale,
            road_model_scale_x: nextVisual.roadModelScaleX,
            road_model_scale_y: nextVisual.roadModelScaleY,
            road_model_scale_z: nextVisual.roadModelScaleZ,
            road_chunk_length: nextVisual.roadChunkLength,
            road_repeat_enabled: nextVisual.roadRepeatEnabled,
            outer_grass_y: nextVisual.outerGrassY,
            outer_grass_width: nextVisual.outerGrassWidth,
            outer_grass_offset: nextVisual.outerGrassOffset,
          },
        },
      });
      setSceneConfigMessage(`Estrada 3D atualizada: ${file.name}`);
    } catch {
      setSceneConfigMessage("Nao foi possivel enviar o modelo da estrada.");
    } finally {
      setIsRoadVisualSaving(false);
    }
  }, [devRoadVisualDraft, patchSceneConfig, selectedIslandDay]);
  const handleRoadProceduralTextureUpload = React.useCallback(async (target, event) => {
    const file = event.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (detectAssetTypeFromName(file.name) !== "image") {
      setSceneConfigMessage("Envie uma imagem para a textura procedural.");
      return;
    }
    setIsRoadVisualSaving(true);
    try {
      const url = await uploadSceneAsset(file, {
        folder: `islands/day-${selectedIslandDay}`,
        filename: file.name,
      });
      const field = target === "wall" ? "proceduralWallTextureUrl" : "proceduralGrassTextureUrl";
      const nextVisual = normalizeRoadVisualDraft({ ...(devRoadVisualDraft || {}), [field]: url });
      setDevRoadVisualDraft(nextVisual);
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            procedural_wall_texture_url: nextVisual.proceduralWallTextureUrl,
            procedural_grass_texture_url: nextVisual.proceduralGrassTextureUrl,
          },
        },
      });
      setSceneConfigMessage(target === "wall" ? "Textura do muro atualizada." : "Textura da grama elevada atualizada.");
    } catch {
      setSceneConfigMessage("Nao foi possivel enviar a textura procedural.");
    } finally {
      setIsRoadVisualSaving(false);
    }
  }, [devRoadVisualDraft, patchSceneConfig, selectedIslandDay]);
  const handleResetRoadModelTransform = React.useCallback(() => {
    setDevRoadVisualDraft((prev) =>
      normalizeRoadVisualDraft({
        ...(prev || {}),
        roadModelX: 0,
        roadModelY: 0,
        roadModelZ: 0,
        roadModelRotX: 0,
        roadModelRotY: 0,
        roadModelRotZ: 0,
        roadModelScale: 1,
        roadModelScaleX: 1,
        roadModelScaleY: 1,
        roadModelScaleZ: 1,
        roadChunkLength: 0,
        roadRepeatEnabled: false,
      })
    );
    setSceneConfigMessage("Ajustes do 3D restaurados para o tamanho real do arquivo. Salve para aplicar no mapa.");
  }, []);
  const handleResetRoadChunkModel = React.useCallback(async () => {
    const nextVisual = normalizeRoadVisualDraft({ ...(devRoadVisualDraft || {}), modelUrl: DEFAULT_ROAD_CHUNK_MODEL_URL });
    setDevRoadVisualDraft(nextVisual);
    setIsRoadVisualSaving(true);
    try {
      await patchSceneConfig({
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            model_url: DEFAULT_ROAD_CHUNK_MODEL_URL,
            road_surface_y: nextVisual.roadSurfaceY,
            road_model_x: nextVisual.roadModelX,
            road_model_y: nextVisual.roadModelY,
            road_model_z: nextVisual.roadModelZ,
            road_model_rot_x: nextVisual.roadModelRotX,
            road_model_rot_y: nextVisual.roadModelRotY,
            road_model_rot_z: nextVisual.roadModelRotZ,
            road_model_scale: nextVisual.roadModelScale,
            road_model_scale_x: nextVisual.roadModelScaleX,
            road_model_scale_y: nextVisual.roadModelScaleY,
            road_model_scale_z: nextVisual.roadModelScaleZ,
            road_chunk_length: nextVisual.roadChunkLength,
            road_repeat_enabled: nextVisual.roadRepeatEnabled,
            outer_grass_y: nextVisual.outerGrassY,
            outer_grass_width: nextVisual.outerGrassWidth,
            outer_grass_offset: nextVisual.outerGrassOffset,
          },
        },
      });
      setSceneConfigMessage("Estrada 3D voltou para o chunk base embutido do jogo.");
    } finally {
      setIsRoadVisualSaving(false);
    }
  }, [devRoadVisualDraft, patchSceneConfig]);
  const handleSceneLightingDraftChange = React.useCallback((field, value) => {
    setDevSceneLightingDraft((prev) => {
      const nextLighting = normalizeSceneLightingDraft({ ...(prev || {}), [field]: value });
      setDevDraftOverrides((current) => ({
        ...(current || {}),
        scene_lighting: nextLighting,
      }));
      return nextLighting;
    });
  }, []);
  const handleSaveSceneLighting = React.useCallback(async () => {
    const nextLighting = normalizeSceneLightingDraft(devSceneLightingDraft);
    setDevSceneLightingDraft(nextLighting);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_lighting: nextLighting,
    }));
    await patchSceneConfig({
      scene_lighting: nextLighting,
    });
  }, [devSceneLightingDraft, patchSceneConfig]);
  const handleResetSceneLighting = React.useCallback(async () => {
    const nextLighting = normalizeSceneLightingDraft(DEFAULT_SCENE_LIGHTING);
    setDevSceneLightingDraft(nextLighting);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_lighting: nextLighting,
    }));
    await patchSceneConfig({
      scene_lighting: nextLighting,
    });
  }, [patchSceneConfig]);
  const handleSceneRenderDraftChange = React.useCallback((field, value) => {
    setDevSceneRenderDraft((prev) => {
      const nextRender = normalizeSceneRenderDraft({ ...(prev || {}), [field]: value });
      setDevDraftOverrides((current) => ({
        ...(current || {}),
        scene_render: nextRender,
      }));
      return nextRender;
    });
  }, []);
  const handleSaveSceneRender = React.useCallback(async () => {
    const nextRender = normalizeSceneRenderDraft(devSceneRenderDraft);
    setDevSceneRenderDraft(nextRender);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_render: nextRender,
    }));
    await patchSceneConfig({
      scene_render: nextRender,
    });
  }, [devSceneRenderDraft, patchSceneConfig]);
  const handleResetSceneRender = React.useCallback(async () => {
    const nextRender = normalizeSceneRenderDraft(DEFAULT_SCENE_RENDER);
    setDevSceneRenderDraft(nextRender);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_render: nextRender,
    }));
    await patchSceneConfig({
      scene_render: nextRender,
    });
  }, [patchSceneConfig]);
  const handleToggleRoadSection = React.useCallback((section) => {
    const key = String(section || "");
    if (!key) return;
    setDevRoadSectionsOpen((prev) => ({
      ...(prev || {}),
      [key]: !prev?.[key],
    }));
  }, []);
  const handleToggleRoadEventsOpen = React.useCallback(() => {
    setDevRoadEventsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setDevSelectedRoadEventId("");
      }
      setDevRoadSectionsOpen((sections) => ({ ...(sections || {}), blocks: next }));
      return next;
    });
  }, []);
  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge")) return;
    return () => {
      stopRoadSculptHold();
      stopSelectedNudgeHold();
    };
  }, [isDevMode, screen, stopRoadSculptHold, stopSelectedNudgeHold]);
  React.useEffect(() => {
    const baseOverride = sceneConfig?.object_overrides?.road_base || {};
    setDevRoadSculptDraft(normalizeRoadSculptDraft(baseOverride));
    setDevRoadVisualDraft(normalizeRoadVisualDraft(baseOverride));
    setDevMapCycleLength(() => {
      const raw = Number(baseOverride?.map_cycle_length);
      if (!Number.isFinite(raw)) return "600";
      return String(Math.max(80, Math.min(5000, raw)));
    });
    setDevRoadEventBlocks(normalizeRoadEventBlocks(baseOverride?.road_events));
    setLoadoutCameraRigDraft(normalizeLoadoutCameraRig(baseOverride?.loadout_camera_rig));
    setIsLoadoutCameraEditMode(false);
    setDevCameraFollowDistance(() => {
      const raw = Number(baseOverride?.camera_follow_distance);
      if (!Number.isFinite(raw)) return 9.4;
      return Math.max(4, Math.min(24, raw));
    });
    const nextSceneLighting = normalizeSceneLightingDraft(sceneConfig?.scene_lighting || {});
    setDevSceneLightingDraft(nextSceneLighting);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_lighting: nextSceneLighting,
    }));
    const nextSceneRender = normalizeSceneRenderDraft(sceneConfig?.scene_render || {});
    setDevSceneRenderDraft(nextSceneRender);
    setDevDraftOverrides((current) => ({
      ...(current || {}),
      scene_render: nextSceneRender,
    }));
    setLoadoutBaseModelUrlDraft(String(sceneConfig?.loadout_base_model_url || "").trim());
    setLoadoutWardrobeDraft(normalizeLoadoutWardrobe(sceneConfig?.loadout_wardrobe));
    setDevSelectedRoadEventId("");
  }, [
    sceneConfig?.loadout_base_model_url,
    sceneConfig?.loadout_wardrobe,
    sceneConfig?.object_overrides?.road_base,
    sceneConfig?.scene_lighting,
    sceneConfig?.scene_render,
  ]);
  const handleSaveMapCycleLength = React.useCallback(async () => {
    const nextLength = Math.max(80, Math.min(5000, Number(devMapCycleLength) || 600));
    setDevMapCycleLength(String(nextLength));
    await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          map_cycle_length: nextLength,
        },
      },
    });
    setSceneConfigMessage(`Comprimento do ciclo salvo: ${nextLength}`);
  }, [devMapCycleLength, patchSceneConfig]);
  const showLegacyChallengeDevRail = React.useMemo(() => false, []);
  const liveCycleStatus = React.useMemo(() => {
    const cursor =
      devStageEditMode === "map"
        ? Number(devMapCursorZ || 0)
        : Number(devConveyorOffset || 0);
    const runnerFlow = Number(runnerState.worldFlow || 0);
    const baseFlow = String(runnerState.status || "") === "running" ? runnerFlow + cursor : cursor;
    const wrapped = ((baseFlow % mapCycleLengthValue) + mapCycleLengthValue) % mapCycleLengthValue;
    const percent = mapCycleLengthValue > 0 ? (wrapped / mapCycleLengthValue) * 100 : 0;
    const remaining = Math.max(0, mapCycleLengthValue - wrapped);
    return {
      wrapped,
      percent,
      remaining,
      worldZ: -wrapped,
      isRunning: String(runnerState.status || "") === "running",
    };
  }, [devConveyorOffset, devMapCursorZ, devStageEditMode, mapCycleLengthValue, runnerState.status, runnerState.worldFlow]);
  React.useEffect(() => {
    setLoadoutImportIslandDay((prev) => {
      const current = Number(selectedIslandDay);
      const fallback = current > 1 ? current - 1 : 1;
      const next = Number(prev);
      if (!Number.isFinite(next) || next < 1 || next === current) return fallback;
      return next;
    });
  }, [selectedIslandDay]);
  React.useEffect(() => {
    if (isDevMode) return;
    setIsLoadoutCameraEditMode(false);
  }, [isDevMode]);
  React.useEffect(() => {
    const list = normalizeRoadEventBlocks(devRoadEventBlocks);
    if (!list.length) {
      setDevSelectedRoadEventId("");
      return;
    }
    setDevSelectedRoadEventId((prev) => {
      const hasCurrent = list.some((item) => String(item?.id || "") === String(prev || ""));
      return hasCurrent ? prev : String(list[0]?.id || "");
    });
  }, [devRoadEventBlocks]);

  const getMergedOverride = React.useCallback((key) => {
    if (!key) return {};
    const persisted = sceneConfigRef.current?.object_overrides?.[key] || {};
    const draft = devDraftOverrides?.[key] || {};
    return { ...persisted, ...draft };
  }, [devDraftOverrides]);

  const persistObjectOverride = React.useCallback((key, patch) => {
    const safeKey = String(key || "");
    if (!safeKey) return;
    const nextPatch = patch && typeof patch === "object" ? patch : {};
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [safeKey]: {
        ...((prev && prev[safeKey]) || {}),
        ...nextPatch,
      },
    }));
    setSceneConfig((prev) => {
      const base = prev || createDefaultSceneConfig(selectedIslandDay);
      const next = {
        ...base,
        object_overrides: {
          ...(base.object_overrides || {}),
          [safeKey]: {
            ...((base.object_overrides && base.object_overrides[safeKey]) || {}),
            ...nextPatch,
          },
        },
      };
      sceneConfigRef.current = next;
      return next;
    });
  }, [createDefaultSceneConfig, selectedIslandDay]);
  const markDevEdited = React.useCallback(() => {
    setDevEditNonce((prev) => prev + 1);
  }, []);
  const scheduleHorizonPersist = React.useCallback((patch) => {
    const nextPatch = patch && typeof patch === "object" ? patch : {};
    if (horizonPersistTimerRef.current) {
      window.clearTimeout(horizonPersistTimerRef.current);
      horizonPersistTimerRef.current = 0;
    }
    horizonPersistTimerRef.current = window.setTimeout(() => {
      horizonPersistTimerRef.current = 0;
      void patchSceneConfig({
        object_overrides: {
          horizon: {
            ...(sceneConfigRef.current?.object_overrides?.horizon || {}),
            ...nextPatch,
          },
        },
      });
    }, 140);
  }, [patchSceneConfig]);
  const roadHorizonDistance = React.useMemo(() => {
    const persisted = sceneConfig?.object_overrides?.horizon || {};
    const draft = devDraftOverrides?.horizon || {};
    const raw = Number(draft?.z ?? persisted?.z ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(-260, Math.min(120, raw));
  }, [devDraftOverrides?.horizon, sceneConfig?.object_overrides?.horizon]);
  const roadHorizonHeight = React.useMemo(() => {
    const persisted = sceneConfig?.object_overrides?.horizon || {};
    const draft = devDraftOverrides?.horizon || {};
    const raw = Number(draft?.y ?? persisted?.y ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(-20, Math.min(20, raw));
  }, [devDraftOverrides?.horizon, sceneConfig?.object_overrides?.horizon]);
  const handleRoadHorizonDistanceChange = React.useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextValue = Math.max(-260, Math.min(120, numeric));
    const nextHeight = Math.max(-20, Math.min(20, Number(roadHorizonHeight) || 0));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      horizon: {
        ...((prev && prev.horizon) || {}),
        y: nextHeight,
        z: nextValue,
      },
    }));
    setDevSelectedObject((prev) =>
      String(prev?.key || "") === "horizon"
        ? {
            ...prev,
            scenePosition: {
              x: Number(prev?.scenePosition?.x || 0),
              y: nextHeight,
              z: nextValue,
            },
            worldPosition: {
              x: Number(prev?.worldPosition?.x || 0),
              y: nextHeight,
              z: nextValue,
            },
          }
        : prev
    );
    setDevPositionDraft((prev) =>
      String(devSelectedObject?.key || "") === "horizon"
        ? {
            x: String(prev?.x ?? "0"),
            y: nextHeight.toFixed(3),
            z: nextValue.toFixed(3),
          }
        : prev
    );
    persistObjectOverride("horizon", { y: nextHeight, z: nextValue });
    scheduleHorizonPersist({ y: nextHeight, z: nextValue });
    markDevEdited();
  }, [devSelectedObject?.key, markDevEdited, persistObjectOverride, roadHorizonHeight, scheduleHorizonPersist]);
  const handleRoadHorizonDistanceNudge = React.useCallback((delta) => {
    handleRoadHorizonDistanceChange(roadHorizonDistance + Number(delta || 0));
  }, [handleRoadHorizonDistanceChange, roadHorizonDistance]);
  const handleRoadHorizonHeightChange = React.useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextValue = Math.max(-20, Math.min(20, numeric));
    const nextDistance = Math.max(-260, Math.min(120, Number(roadHorizonDistance) || 0));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      horizon: {
        ...((prev && prev.horizon) || {}),
        z: nextDistance,
        y: nextValue,
      },
    }));
    setDevSelectedObject((prev) =>
      String(prev?.key || "") === "horizon"
        ? {
            ...prev,
            scenePosition: {
              x: Number(prev?.scenePosition?.x || 0),
              y: nextValue,
              z: nextDistance,
            },
            worldPosition: {
              x: Number(prev?.worldPosition?.x || 0),
              y: nextValue,
              z: nextDistance,
            },
          }
        : prev
    );
    setDevPositionDraft((prev) =>
      String(devSelectedObject?.key || "") === "horizon"
        ? {
            x: String(prev?.x ?? "0"),
            y: nextValue.toFixed(3),
            z: nextDistance.toFixed(3),
          }
        : prev
    );
    persistObjectOverride("horizon", { y: nextValue, z: nextDistance });
    scheduleHorizonPersist({ y: nextValue, z: nextDistance });
    markDevEdited();
  }, [devSelectedObject?.key, markDevEdited, persistObjectOverride, roadHorizonDistance, scheduleHorizonPersist]);
  const handleRoadHorizonHeightNudge = React.useCallback((delta) => {
    handleRoadHorizonHeightChange(roadHorizonHeight + Number(delta || 0));
  }, [handleRoadHorizonHeightChange, roadHorizonHeight]);
  const flushSelectedObjectEditsSoon = React.useCallback((key) => {
    const safeKey = String(key || "");
    if (!safeKey) return;
    const sessionId = devEditSessionRef.current;
    window.setTimeout(() => {
      if (devEditSessionRef.current !== sessionId) return;
      if (String(devSelectedObjectKeyRef.current || "") !== safeKey) return;
      if (typeof handleApplySelectedObjectEditsRef.current === "function") {
        void handleApplySelectedObjectEditsRef.current();
      }
    }, 0);
  }, []);

  const clearPendingDevAutoSave = React.useCallback(() => {
    if (devAutoSaveTimerRef.current) {
      window.clearTimeout(devAutoSaveTimerRef.current);
      devAutoSaveTimerRef.current = 0;
    }
  }, []);

  const cancelDevEditing = React.useCallback(async (options = {}) => {
    const shouldRestore = options?.restore !== false;
    clearPendingDevAutoSave();
    const snapshot = devSelectionSnapshotRef.current;
    if (shouldRestore && snapshot?.key && snapshot.key === String(devSelectedObjectKeyRef.current || "")) {
      if (String(snapshot.key).startsWith("custom_")) {
        const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
        const nextList = snapshot.customObject
          ? currentList.map((item) => (String(item?.key || "") === String(snapshot.key) ? snapshot.customObject : item))
          : currentList.filter((item) => String(item?.key || "") !== String(snapshot.key));
        await patchSceneConfig({
          custom_objects: nextList,
          object_overrides: {
            [snapshot.key]: snapshot.override || {},
          },
        });
      } else {
        await patchSceneConfig({
          object_overrides: {
            [snapshot.key]: snapshot.override || {},
          },
        });
      }
    }
    devEditSessionRef.current += 1;
    devSelectionSnapshotRef.current = null;
    setDevEditNonce(0);
    setDevDraftOverrides({});
    setDevSelectedObject(null);
    setDevInteractionMode("select");
  }, [clearPendingDevAutoSave, patchSceneConfig]);

  const handleDevConveyorNudge = React.useCallback((direction) => {
    const step = 2.6;
    if (isMapStageEditMode) {
      setDevMapCursorZ((prev) => Number((prev + step * direction).toFixed(3)));
      return;
    }
    setDevConveyorOffset((prev) => prev + step * direction);
  }, [isMapStageEditMode]);

  const stopDevConveyorHold = React.useCallback((pointerId = null) => {
    const press = devConveyorPressRef.current;
    if (pointerId !== null && press.pointerId !== pointerId) return;
    if (press.holdTimer) {
      window.clearTimeout(press.holdTimer);
      press.holdTimer = 0;
    }
    if (press.repeatTimer) {
      window.clearInterval(press.repeatTimer);
      press.repeatTimer = 0;
    }
    press.pointerId = null;
  }, []);

  const startDevConveyorHold = React.useCallback(
    (direction, event) => {
      if (!direction || !event) return;
      stopDevConveyorHold();
      handleDevConveyorNudge(direction);
      const press = devConveyorPressRef.current;
      press.pointerId = event.pointerId;
      event.currentTarget?.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      press.holdTimer = window.setTimeout(() => {
        press.repeatTimer = window.setInterval(() => {
          if (isMapStageEditMode) {
            setDevMapCursorZ((prev) => Number((prev + 1.9 * direction).toFixed(3)));
            return;
          }
          setDevConveyorOffset((prev) => prev + 1.9 * direction);
        }, 32);
      }, 160);
    },
    [handleDevConveyorNudge, isMapStageEditMode, stopDevConveyorHold]
  );

  React.useEffect(() => {
    return () => {
      stopDevConveyorHold();
      if (horizonPersistTimerRef.current) {
        window.clearTimeout(horizonPersistTimerRef.current);
        horizonPersistTimerRef.current = 0;
      }
    };
  }, [stopDevConveyorHold]);

  const handleDevObjectPick = React.useCallback(
    (payload) => {
      if (!payload?.key) return;
      if (String(payload?.type || "") === "player") return;
      clearPendingDevAutoSave();
      if (devSelectedObjectKeyRef.current && String(devSelectedObjectKeyRef.current) !== String(payload.key)) {
        if (!isMapStageEditMode && devEditNonce > 0 && typeof handleApplySelectedObjectEditsRef.current === "function") {
          void handleApplySelectedObjectEditsRef.current();
        }
        devEditSessionRef.current += 1;
      }
      if (devSelectedObject?.key && String(devSelectedObject.key) !== String(payload.key)) {
        setDevDraftOverrides({});
      }
      const key = String(payload.key || "");
      const persistedOverride = sceneConfigRef.current?.object_overrides?.[key];
      const persistedCustom = key.startsWith("custom_")
        ? (Array.isArray(sceneConfigRef.current?.custom_objects)
            ? sceneConfigRef.current.custom_objects.find((item) => String(item?.key || "") === key) || null
            : null)
        : null;
      devSelectionSnapshotRef.current = {
        key,
        override: persistedOverride ? JSON.parse(JSON.stringify(persistedOverride)) : null,
        customObject: persistedCustom ? JSON.parse(JSON.stringify(persistedCustom)) : null,
      };
      const existing = getMergedOverride(payload.key);
      const source =
        payload.scenePosition ||
        payload.worldPosition ||
        existing ||
        {};
      const sourceZ = Number.isFinite(Number(source?.z))
        ? Number(source.z)
        : Number(payload?.scenePosition?.z || payload?.worldPosition?.z || 0);
      const isFlowCapableType =
        payload?.type === "vegetation" || payload?.type === "edge_vegetation" || payload?.type === "custom";
      const movementMode = String(existing?.movement_mode || "");
      const isFlow = !isMapStageEditMode && isFlowCapableType && movementMode !== "anchored";
      const isGroundRelativeType =
        payload?.type === "custom" ||
        payload?.type === "vegetation" ||
        payload?.type === "edge_vegetation" ||
        payload?.type === "boss";
      const xMode = String(
        existing?.x_mode ||
          (payload?.type === "boss" ? "relative_curve" : isFlowCapableType ? "relative_curve" : "world")
      );
      const yMode = String(
        existing?.y_mode ||
          (isGroundRelativeType ? "relative_ground" : "world")
      );
      const storedX = Number.isFinite(Number(existing?.x)) ? Number(existing.x) : Number(source?.x || 0);
      const storedY = Number.isFinite(Number(existing?.y)) ? Number(existing.y) : Number(source?.y || 0);
      const sourceX =
        xMode === "relative_curve"
          ? getCurveOffsetAtZ(sourceZ, roadCurve) + storedX
          : (Number.isFinite(Number(source?.x)) ? Number(source.x) : 0);
      const sourceY =
        yMode === "relative_ground"
          ? getGroundDropAtZ(sourceZ) + storedY
          : (Number.isFinite(Number(source?.y)) ? Number(source.y) : Number(payload?.scenePosition?.y || payload?.worldPosition?.y || 0));
      const blockId = getSceneBlockId(sourceX, sourceZ);
      setDevSelectedObject({
        ...payload,
        scenePosition: { x: sourceX, y: sourceY, z: sourceZ },
        worldPosition: { x: sourceX, y: sourceY, z: sourceZ },
        blockId,
      });
      if (Number.isFinite(payload?.pointer?.x) && Number.isFinite(payload?.pointer?.y)) {
        const container = challengeContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const localX = payload.pointer.x - rect.left;
          const localY = payload.pointer.y - rect.top;
          setDevContextMenuPos(getSmartContextMenuPos(localX, localY));
        }
      }
      setDevPositionDraft({
        x: Number.isFinite(sourceX) ? String(Number(sourceX).toFixed(3)) : "0",
        y: Number.isFinite(sourceY) ? String(Number(sourceY).toFixed(3)) : "0",
        z: Number.isFinite(sourceZ) ? String(Number(sourceZ).toFixed(3)) : "0",
      });
      setDevScaleDraft({
        scale: String(Number(Number(existing?.scale ?? 1).toFixed(2))),
        scaleX: String(Number(Number(existing?.scale_x ?? 1).toFixed(2))),
        scaleY: String(Number(Number(existing?.scale_y ?? 1).toFixed(2))),
        scaleZ: String(Number(Number(existing?.scale_z ?? 1).toFixed(2))),
      });
    },
    [clearPendingDevAutoSave, devEditNonce, devSelectedObject?.key, getMergedOverride, getSmartContextMenuPos, isMapStageEditMode, roadCurve, toStoredEditorZ]
  );

  const handleDevObjectTransform = React.useCallback(
    ({ key, scenePosition, storedPosition, x_mode: xModeFromScene, y_mode: yModeFromScene, isFinal }) => {
      if (!key || !scenePosition) return;
      if (String(key) === "player") return;
      const x = Number(scenePosition.x);
      const y = Number(scenePosition.y);
      const z = Number(scenePosition.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
      const selectedType =
        String(devSelectedObject?.key) === String(key)
          ? String(devSelectedObject?.type || "")
          : String(devSelectedObject?.type || "");
      const isFlowCapable = selectedType === "vegetation" || selectedType === "edge_vegetation" || selectedType === "custom";
      const keyFlowCapable =
        String(key).startsWith("vegetation_") ||
        String(key).startsWith("edge_vegetation_") ||
        String(key).startsWith("custom_");
      const merged = getMergedOverride(key);
      const isFlow = !isMapStageEditMode && (isFlowCapable || keyFlowCapable) && String(merged?.movement_mode || "") !== "anchored";
      const isGroundRelativeType =
        selectedType === "custom" ||
        selectedType === "vegetation" ||
        selectedType === "edge_vegetation" ||
        selectedType === "boss" ||
        keyFlowCapable;
      const xMode = String(xModeFromScene || (selectedType === "boss" ? "relative_curve" : isFlow ? "relative_curve" : "world"));
      const yMode = String(yModeFromScene || (isGroundRelativeType ? "relative_ground" : "world"));
      const storedZ = toStoredEditorZ(z);
      const storedX =
        Number.isFinite(Number(storedPosition?.x))
          ? Number(storedPosition.x)
          : xMode === "relative_curve"
            ? x - getCurveOffsetAtZ(z, roadCurve)
            : x;
      const storedY =
        Number.isFinite(Number(storedPosition?.y))
          ? Number(storedPosition.y)
          : isGroundRelativeType
            ? y - getGroundDropAtZ(z)
            : y;

      setDevSelectedObject((prev) =>
        prev?.key === key
          ? {
              ...prev,
              scenePosition: { x, y, z },
              blockId: getSceneBlockId(x, z),
            }
          : prev
      );
      setDevPositionDraft({
        x: x.toFixed(3),
        y: y.toFixed(3),
        z: z.toFixed(3),
      });
      setDevDraftOverrides((prev) => ({
        ...prev,
        [key]: {
          ...(prev?.[key] || {}),
          x: storedX,
          y: storedY,
          z: storedZ,
          x_mode: xMode,
          y_mode: yMode,
        },
      }));
      if (isFinal) {
        persistObjectOverride(key, {
          x: storedX,
          y: storedY,
          z: storedZ,
          x_mode: xMode,
          y_mode: yMode,
        });
        markDevEdited();
        flushSelectedObjectEditsSoon(key);
      }
    },
    [devSelectedObject?.key, devSelectedObject?.type, flushSelectedObjectEditsSoon, getMergedOverride, isMapStageEditMode, markDevEdited, persistObjectOverride, roadCurve, toStoredEditorZ]
  );
  const handleDevProceduralEdit = React.useCallback(
    async ({ key, patch, isFinal, skipUndo = false }) => {
      const safeKey = String(key || "");
      if (!safeKey) return;
      const nextPatch = patch && typeof patch === "object" ? patch : {};
      const normalizedPatch = {};
      if (Number.isFinite(Number(nextPatch.height))) {
        normalizedPatch.height = Math.max(0.05, Math.min(40, Number(nextPatch.height)));
      }
      if (nextPatch.procedural_vertex_offsets && typeof nextPatch.procedural_vertex_offsets === "object") {
        const normalizedOffsets = normalizeOffsetsForUndo(nextPatch.procedural_vertex_offsets);
        normalizedPatch.procedural_vertex_offsets = normalizedOffsets;
      }
      if (nextPatch.procedural_vertex_colors && typeof nextPatch.procedural_vertex_colors === "object") {
        normalizedPatch.procedural_vertex_colors = normalizeVertexColorsForUndo(nextPatch.procedural_vertex_colors);
      }
      if (
        nextPatch.procedural_grass_vertex_offsets_left &&
        typeof nextPatch.procedural_grass_vertex_offsets_left === "object"
      ) {
        normalizedPatch.procedural_grass_vertex_offsets_left = normalizeOffsetsForUndo(
          nextPatch.procedural_grass_vertex_offsets_left
        );
      }
      if (
        nextPatch.procedural_grass_vertex_offsets_right &&
        typeof nextPatch.procedural_grass_vertex_offsets_right === "object"
      ) {
        normalizedPatch.procedural_grass_vertex_offsets_right = normalizeOffsetsForUndo(
          nextPatch.procedural_grass_vertex_offsets_right
        );
      }
      if (!Object.keys(normalizedPatch).length) return;
      setDevDraftOverrides((prev) => ({
        ...(prev || {}),
        [safeKey]: {
          ...((prev && prev[safeKey]) || {}),
          ...normalizedPatch,
        },
      }));
      if (isFinal) {
        if (safeKey === "road_base") {
          await patchSceneConfig({
            object_overrides: {
              road_base: {
                ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
                ...normalizedPatch,
              },
            },
          });
          markDevEdited();
          return;
        }
        const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
        const target = list.find((item) => String(item?.key || "") === safeKey);
        if (
          !skipUndo &&
          normalizedPatch.procedural_vertex_offsets &&
          target &&
          typeof target === "object"
        ) {
          const previous = normalizeOffsetsForUndo(target?.procedural_vertex_offsets);
          const nextValue = normalizeOffsetsForUndo(normalizedPatch.procedural_vertex_offsets);
          const prevSerialized = JSON.stringify(previous);
          const nextSerialized = JSON.stringify(nextValue);
          if (prevSerialized !== nextSerialized) {
            const stack = Array.isArray(proceduralUndoStackRef.current?.[safeKey])
              ? proceduralUndoStackRef.current[safeKey]
              : [];
            proceduralUndoStackRef.current = {
              ...(proceduralUndoStackRef.current || {}),
              [safeKey]: [...stack, previous].slice(-60),
            };
            proceduralRedoStackRef.current = {
              ...(proceduralRedoStackRef.current || {}),
              [safeKey]: [],
            };
          }
        }
        const nextList = list.map((item) =>
          String(item?.key || "") === safeKey
            ? {
                ...item,
                ...normalizedPatch,
              }
            : item
        );
        await patchSceneConfig({ custom_objects: nextList });
        markDevEdited();
      }
    },
    [markDevEdited, patchSceneConfig]
  );

  const handlePositionDraftChange = React.useCallback((axis, value) => {
    setDevPositionDraft((prev) => ({ ...prev, [axis]: value }));
  }, []);

  const handleNudgeSelectedPosition = React.useCallback((axis, delta) => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const selectedType = String(devSelectedObject?.type || "");
    const isFlowCapable = selectedType === "vegetation" || selectedType === "edge_vegetation" || selectedType === "custom";
    const isGroundRelativeType = isFlowCapable || selectedType === "boss" || key.startsWith("custom_");
    const merged = getMergedOverride(key);
    const isFlow = !isMapStageEditMode && isFlowCapable && String(merged?.movement_mode || "") !== "anchored";
    const d = Number(delta) || 0;
    setDevPositionDraft((prev) => {
      const currentX = Number.isFinite(Number(prev?.x)) ? Number(prev.x) : 0;
      const currentY = Number.isFinite(Number(prev?.y)) ? Number(prev.y) : 0;
      const currentZ = Number.isFinite(Number(prev?.z)) ? Number(prev.z) : 0;
      const nextX = axis === "x" ? Number((currentX + d).toFixed(3)) : currentX;
      const mergedStoredZ = Number.isFinite(Number(merged?.z))
        ? Number(merged.z)
        : toStoredEditorZ(currentZ);
      const storedZ =
        axis === "z"
          ? normalizeStoredCycleZ(Number((mergedStoredZ + d).toFixed(3)))
          : mergedStoredZ;
      const nextZ = Number(toPreviewEditorZ(storedZ).toFixed(3));
      const xMode = String(merged?.x_mode || (selectedType === "boss" ? "relative_curve" : isFlow ? "relative_curve" : "world"));
      const yMode = String(merged?.y_mode || (isGroundRelativeType ? "relative_ground" : "world"));
      const currentStoredY =
        Number.isFinite(Number(merged?.y))
          ? Number(merged.y)
          : yMode === "relative_ground"
            ? currentY - getGroundDropAtZ(currentZ)
            : currentY;
      const storedY =
        yMode === "relative_ground"
          ? (axis === "y" ? Number((currentStoredY + d).toFixed(3)) : currentStoredY)
          : (axis === "y" ? Number((currentY + d).toFixed(3)) : currentY);
      const nextY =
        yMode === "relative_ground"
          ? Number((getGroundDropAtZ(nextZ) + storedY).toFixed(3))
          : (axis === "y" ? Number((currentY + d).toFixed(3)) : currentY);
      const storedX = xMode === "relative_curve" ? nextX - getCurveOffsetAtZ(nextZ, roadCurve) : nextX;
      setDevDraftOverrides((currentDrafts) => ({
        ...currentDrafts,
        [key]: {
          ...(currentDrafts?.[key] || {}),
          x: storedX,
          y: storedY,
          z: storedZ,
          x_mode: xMode,
          y_mode: yMode,
        },
      }));
      setDevSelectedObject((currentSelected) =>
        currentSelected?.key === key
          ? {
              ...currentSelected,
              scenePosition: {
                ...(currentSelected.scenePosition || {}),
                x: nextX,
                y: nextY,
                z: nextZ,
              },
            }
          : currentSelected
      );
      persistObjectOverride(key, {
        x: storedX,
        y: storedY,
        z: storedZ,
        x_mode: xMode,
        y_mode: yMode,
      });
      markDevEdited();
      return {
        ...prev,
        x: nextX.toFixed(3),
        y: nextY.toFixed(3),
        z: nextZ.toFixed(3),
      };
    });
  }, [devSelectedObject?.key, devSelectedObject?.type, getMergedOverride, isMapStageEditMode, markDevEdited, normalizeStoredCycleZ, persistObjectOverride, roadCurve, toPreviewEditorZ, toStoredEditorZ]);
  React.useEffect(() => {
    handleNudgeSelectedPositionRef.current = handleNudgeSelectedPosition;
  }, [handleNudgeSelectedPosition]);

  const handleSaveSelectedObjectPosition = React.useCallback(async () => {
    const key = devSelectedObject?.key;
    if (!key) return;
    const x = Number(devPositionDraft.x);
    const y = Number(devPositionDraft.y);
    const z = Number(devPositionDraft.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      setSceneConfigMessage("Posicao invalida. Use somente numeros.");
      return;
    }
    const storedZ = toStoredEditorZ(z);
    const selectedType = String(devSelectedObject?.type || "");
    const isGroundRelativeType =
      selectedType === "custom" ||
      selectedType === "vegetation" ||
      selectedType === "edge_vegetation" ||
      selectedType === "boss" ||
      String(key).startsWith("custom_");
    const currentOverride = sceneConfig?.object_overrides?.[key] || {};
    const xModeResolved = String(
      currentOverride?.x_mode ||
        (selectedType === "boss" ? "relative_curve" : String(key).startsWith("custom_") ? "relative_curve" : "world")
    );
    const yModeResolved = String(currentOverride?.y_mode || (isGroundRelativeType ? "relative_ground" : "world"));
    const storedX = xModeResolved === "relative_curve" ? x - getCurveOffsetAtZ(z, roadCurve) : x;
    const storedY = yModeResolved === "relative_ground" ? y - getGroundDropAtZ(z) : y;
    if (String(key).startsWith("custom_")) {
      const currentList = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
      const nextList = currentList.map((item) =>
        String(item?.key || "") === String(key)
          ? {
              ...item,
              x: storedX,
              y: storedY,
              z: storedZ,
              x_mode: xModeResolved,
              y_mode: yModeResolved,
              block_id: getSceneBlockId(x, storedZ),
            }
          : item
      );
      await patchSceneConfig({ custom_objects: nextList });
      return;
    }
    await patchSceneConfig({
      object_overrides: {
        [key]: {
          ...currentOverride,
          x: storedX,
          y: storedY,
          z: storedZ,
          x_mode: xModeResolved,
          y_mode: yModeResolved,
        },
      },
    });
  }, [devPositionDraft.x, devPositionDraft.y, devPositionDraft.z, devSelectedObject, patchSceneConfig, roadCurve, sceneConfig, toStoredEditorZ]);

  const handleFixSelectedObjectToCurrentTrecho = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const selectedType = String(devSelectedObject?.type || "");
    const isFlowCapableType =
      selectedType === "custom" || selectedType === "vegetation" || selectedType === "edge_vegetation";
    const isGroundRelativeType = isFlowCapableType || selectedType === "boss" || key.startsWith("custom_");
    const scenePos = devSelectedObject?.scenePosition || devSelectedObject?.worldPosition;
    const previewX = Number.isFinite(Number(scenePos?.x)) ? Number(scenePos.x) : Number(devPositionDraft.x || 0);
    const previewY = Number.isFinite(Number(scenePos?.y)) ? Number(scenePos.y) : Number(devPositionDraft.y || 0);
    const previewZ = Number.isFinite(Number(scenePos?.z)) ? Number(scenePos.z) : Number(devPositionDraft.z || 0);
    if (!Number.isFinite(previewX) || !Number.isFinite(previewY) || !Number.isFinite(previewZ)) return;
    const merged = getMergedOverride(key);
    const xModeResolved = String(
      merged?.x_mode ||
        (selectedType === "boss" ? "relative_curve" : isFlowCapableType ? "relative_curve" : "world")
    );
    const yModeResolved = String(merged?.y_mode || (isGroundRelativeType ? "relative_ground" : "world"));
    const storedZ = Number(toStoredEditorZ(previewZ).toFixed(3));
    const storedX = Number(
      (
        xModeResolved === "relative_curve"
          ? previewX - getCurveOffsetAtZ(previewZ, roadCurve)
          : previewX
      ).toFixed(3)
    );
    const storedY = Number(
      (
        yModeResolved === "relative_ground"
          ? previewY - getGroundDropAtZ(previewZ)
          : previewY
      ).toFixed(3)
    );
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        x: storedX,
        y: storedY,
        z: storedZ,
        x_mode: xModeResolved,
        y_mode: yModeResolved,
        movement_mode: "anchored",
      },
    }));
    setDevPositionDraft({
      x: previewX.toFixed(3),
      y: previewY.toFixed(3),
      z: previewZ.toFixed(3),
    });
    const expectedOverride = {
      x: storedX,
      y: storedY,
      z: storedZ,
      x_mode: xModeResolved,
      y_mode: yModeResolved,
      movement_mode: "anchored",
    };
    persistObjectOverride(key, expectedOverride);
    markDevEdited();
    if (String(key).startsWith("custom_")) {
      const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
      const nextList = currentList.map((item) =>
        String(item?.key || "") === key
          ? {
              ...item,
              x: storedX,
              y: storedY,
              z: storedZ,
              x_mode: xModeResolved,
              y_mode: yModeResolved,
              movement_mode: "anchored",
              block_id: getSceneBlockId(previewX, storedZ),
            }
          : item
      );
      await patchSceneConfig({
        custom_objects: nextList,
        object_overrides: {
          [key]: {
            ...(sceneConfigRef.current?.object_overrides?.[key] || {}),
            ...expectedOverride,
          },
        },
      });
    } else {
      await patchSceneConfig({
        object_overrides: {
          [key]: {
            ...(sceneConfigRef.current?.object_overrides?.[key] || {}),
            ...expectedOverride,
          },
        },
      });
    }
    setSceneConfigMessage("Elemento fixado no trecho atual do mapa.");
  }, [
    devPositionDraft.x,
    devPositionDraft.y,
    devPositionDraft.z,
    devSelectedObject?.key,
    devSelectedObject?.scenePosition,
    devSelectedObject?.type,
    devSelectedObject?.worldPosition,
    getMergedOverride,
    markDevEdited,
    patchSceneConfig,
    persistObjectOverride,
    roadCurve,
    sceneConfigRef,
    toStoredEditorZ,
  ]);

  const handleResetSelectedObjectPosition = React.useCallback(async () => {
    const key = devSelectedObject?.key;
    if (!key) return;
    const currentOverride = sceneConfig?.object_overrides?.[key] || {};
    await patchSceneConfig({
      object_overrides: {
        [key]: {
          ...currentOverride,
          x: null,
          y: null,
          z: null,
        },
      },
    });
    setDevPositionDraft({ x: "0", y: "0", z: "0" });
  }, [devSelectedObject, patchSceneConfig, sceneConfig]);

  const handleToggleSelectedObjectVisibility = React.useCallback(async () => {
    const key = devSelectedObject?.key;
    if (!key) return;
    const currentOverride = sceneConfig?.object_overrides?.[key] || {};
    const nextHidden = !currentOverride?.hidden;
    await patchSceneConfig({
      object_overrides: {
        [key]: {
          ...currentOverride,
          hidden: nextHidden,
        },
      },
    });
  }, [devSelectedObject, patchSceneConfig, sceneConfig]);

  const handleRotateSelectedObject = React.useCallback(
    (deltaDeg, axis = "y") => {
      const key = devSelectedObject?.key;
      if (!key) return;
      const currentOverride = getMergedOverride(key);
      const axisKey = axis === "x" ? "rotation_x" : axis === "z" ? "rotation_z" : "rotation_y";
      const currentRot = Number(currentOverride?.[axisKey] || 0);
      const nextRot = currentRot + Number(deltaDeg || 0);
      setDevDraftOverrides((prev) => ({
        ...prev,
        [key]: {
          ...(prev?.[key] || {}),
          [axisKey]: nextRot,
        },
      }));
      persistObjectOverride(key, { [axisKey]: nextRot });
      markDevEdited();
      flushSelectedObjectEditsSoon(key);
    },
    [devSelectedObject, flushSelectedObjectEditsSoon, getMergedOverride, markDevEdited, persistObjectOverride]
  );
  const handleRotateSelectedObjectRef = React.useRef(handleRotateSelectedObject);
  React.useEffect(() => {
    handleRotateSelectedObjectRef.current = handleRotateSelectedObject;
  }, [handleRotateSelectedObject]);
  const startSelectedRotateHold = React.useCallback((deltaDeg, axis = "y", event) => {
    if (!event) return;
    stopSelectedRotateHold();
    if (typeof handleRotateSelectedObjectRef.current === "function") {
      handleRotateSelectedObjectRef.current(deltaDeg, axis);
    }
    const hold = devSelectedRotateHoldRef.current;
    hold.pointerId = event.pointerId;
    hold.repeats = 0;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    hold.holdTimer = window.setTimeout(() => {
      hold.repeatTimer = window.setInterval(() => {
        hold.repeats += 1;
        const accel = hold.repeats > 30 ? 3 : hold.repeats > 14 ? 2 : 1.4;
        if (typeof handleRotateSelectedObjectRef.current === "function") {
          handleRotateSelectedObjectRef.current(deltaDeg * accel, axis);
        }
      }, 40);
    }, 150);
  }, [stopSelectedRotateHold]);
  const handleToggleSelectedModelFollowRoadCurve = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const currentOverride = getMergedOverride(key);
    const next = !currentOverride?.follow_road_curve;
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        follow_road_curve: next,
      },
    }));
    persistObjectOverride(key, { follow_road_curve: next });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
    setSceneConfigMessage(next ? "Curvatura da estrada: ON (item 3D)." : "Curvatura da estrada: OFF (item 3D).");
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, getMergedOverride, markDevEdited, persistObjectOverride, setSceneConfigMessage]);
  const handlePinSelectedObjectAsRoad = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key || !key.startsWith("custom_")) return;
    const merged = getMergedOverride(key);
    const z = Number(devPositionDraft.z);
    const worldZPreview = Number.isFinite(z) ? z : Number(devSelectedObject?.scenePosition?.z || 0);
    const worldZ = toStoredEditorZ(worldZPreview);
    const worldX = Number.isFinite(Number(devPositionDraft.x)) ? Number(devPositionDraft.x) : Number(devSelectedObject?.scenePosition?.x || 0);
    const worldY = Number.isFinite(Number(devPositionDraft.y)) ? Number(devPositionDraft.y) : Number(devSelectedObject?.scenePosition?.y || 0);
    const groundY = getGroundDropAtZ(worldZPreview);
    const patch = {
      kind: "road",
      x: worldX - getCurveOffsetAtZ(worldZPreview, roadCurve),
      y: worldY - groundY,
      z: worldZ,
      x_mode: "relative_curve",
      y_mode: "relative_ground",
      movement_mode: "anchored",
      follow_road_curve: false,
    };
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        ...patch,
      },
    }));
    setDevSelectedObject((prev) => (prev?.key === key ? { ...prev, kind: "road" } : prev));
    const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    const nextList = currentList.map((item) =>
      String(item?.key || "") === key
        ? {
            ...item,
            kind: "road",
            x: patch.x,
            y: patch.y,
            z: patch.z,
            x_mode: patch.x_mode,
            y_mode: patch.y_mode,
            movement_mode: patch.movement_mode,
            block_id: getSceneBlockId(worldX, worldZ),
          }
        : item
    );
    await patchSceneConfig({
      custom_objects: nextList,
      object_overrides: {
        [key]: {
          ...(sceneConfigRef.current?.object_overrides?.[key] || {}),
          rotation_x: Number.isFinite(Number(merged?.rotation_x)) ? Number(merged.rotation_x) : 0,
          rotation_y: Number.isFinite(Number(merged?.rotation_y)) ? Number(merged.rotation_y) : 0,
          rotation_z: Number.isFinite(Number(merged?.rotation_z)) ? Number(merged.rotation_z) : 0,
          follow_road_curve: false,
        },
      },
    });
    setSceneConfigMessage("Objeto fixado no chao como estrada. A curvatura fica no botao separado.");
  }, [devPositionDraft.x, devPositionDraft.y, devPositionDraft.z, devSelectedObject?.key, devSelectedObject?.scenePosition, getMergedOverride, patchSceneConfig, roadCurve, toStoredEditorZ]);
  const handleOpenModelerToolFromSelection = React.useCallback((tool = "move") => {
    const safeTool = String(tool || "move");
    setDevEditingPresetKey("");
    setDevEditingPresetName("");
    setDevEditingPresetFolder("");
    setDevModelTool(safeTool);
    setIsModelerOpen(true);
    setIsModelerExpanded(true);
    setSceneConfigMessage(`Editor 3D aberto na ferramenta: ${safeTool}.`);
  }, []);
  const handleSelectedHorizonStyleChange = React.useCallback((field, value) => {
    const key = String(devSelectedObject?.key || "");
    if (key !== "horizon") return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const min = field === "horizon_curve_side" ? -42 : -18;
    const max = field === "horizon_curve_side" ? 42 : 22;
    const nextValue = Math.max(min, Math.min(max, numeric));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        [field]: nextValue,
      },
    }));
    persistObjectOverride(key, { [field]: nextValue });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);
  const handleResetSelectedHorizonStyle = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (key !== "horizon") return;
    const patch = {
      horizon_curve_side: 12,
      horizon_curve_down: 3.2,
      x: 0,
      y: 0,
      z: 0,
      rotation_y: 0,
    };
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        ...patch,
      },
    }));
    persistObjectOverride(key, patch);
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);
  const handleSelectedModelCurveChange = React.useCallback((field, value) => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const limits = {
      model_curve_side: [-40, 40],
      model_curve_down: [-30, 30],
      model_curve_side_radius: [0.15, 6],
      model_curve_down_radius: [0.15, 6],
    };
    const range = limits[field];
    if (!range) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextValue = Math.max(range[0], Math.min(range[1], numeric));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        [field]: nextValue,
      },
    }));
    persistObjectOverride(key, { [field]: nextValue });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);
  const handleSelectedRepeatStepChange = React.useCallback((value) => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextValue = numeric <= 0 ? 0 : Math.max(0.2, Math.min(500, numeric));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        repeat_step_z: nextValue,
      },
    }));
    persistObjectOverride(key, { repeat_step_z: nextValue });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);
  const handleToggleSelectedRoadShadow = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const currentOverride = getMergedOverride(key);
    const next = !(currentOverride?.casts_road_shadow === true);
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        casts_road_shadow: next,
      },
    }));
    persistObjectOverride(key, { casts_road_shadow: next });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
    setSceneConfigMessage(next ? "Sombra na estrada: ON." : "Sombra na estrada: OFF.");
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, getMergedOverride, markDevEdited, persistObjectOverride]);
  const handleResetSelectedModelCurve = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const patch = {
      model_curve_side: 0,
      model_curve_down: 0,
      model_curve_side_radius: 1,
      model_curve_down_radius: 1,
    };
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        ...patch,
      },
    }));
    persistObjectOverride(key, patch);
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);

  const handleAdjustSelectedScale = React.useCallback((target, delta) => {
    const d = Number(delta) || 0;
    setDevScaleDraft((prev) => {
      const next = { ...prev };
      const adjust = (key) => {
        const current = Number(next[key]);
        const safeCurrent = Number.isFinite(current) ? current : 1;
        next[key] = Math.max(0.2, safeCurrent + d).toFixed(2);
      };
      if (target === "uniform") {
        adjust("scale");
      } else if (target === "x") {
        adjust("scaleX");
      } else if (target === "y") {
        adjust("scaleY");
      } else if (target === "z") {
        adjust("scaleZ");
      }
      const key = String(devSelectedObject?.key || "");
      if (key) {
        setDevDraftOverrides((current) => ({
          ...current,
          [key]: {
            ...(current?.[key] || {}),
            scale: Math.max(0.2, Number(next.scale) || 1),
            scale_x: Math.max(0.2, Number(next.scaleX) || 1),
            scale_y: Math.max(0.2, Number(next.scaleY) || 1),
            scale_z: Math.max(0.2, Number(next.scaleZ) || 1),
          },
        }));
        persistObjectOverride(key, {
          scale: Math.max(0.2, Number(next.scale) || 1),
          scale_x: Math.max(0.2, Number(next.scaleX) || 1),
          scale_y: Math.max(0.2, Number(next.scaleY) || 1),
          scale_z: Math.max(0.2, Number(next.scaleZ) || 1),
        });
        markDevEdited();
        flushSelectedObjectEditsSoon(key);
      }
      return next;
    });
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]);

  const handleApplySelectedObjectEdits = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const draft = devDraftOverrides?.[key] || {};
    const px = Number(devPositionDraft.x);
    const py = Number(devPositionDraft.y);
    const pz = Number(devPositionDraft.z);
    const selectedType = String(devSelectedObject?.type || "");
    const isFlowCapable = selectedType === "vegetation" || selectedType === "edge_vegetation" || selectedType === "custom";
    const isGroundRelativeType = isFlowCapable || selectedType === "boss" || key.startsWith("custom_");
    const merged = getMergedOverride(key);
    const isFlow = !isMapStageEditMode && isFlowCapable && String(merged?.movement_mode || "") !== "anchored";
    const zForCurve = Number.isFinite(pz) ? pz : Number(merged?.z || 0);
    const xModeResolved = String(draft?.x_mode || (selectedType === "boss" ? "relative_curve" : isFlow ? "relative_curve" : "world"));
    const yModeResolved = String(draft?.y_mode || (isGroundRelativeType ? "relative_ground" : "world"));
    const storedX = Number.isFinite(Number(draft?.x))
      ? Number(draft.x)
      : Number.isFinite(px)
        ? (xModeResolved === "relative_curve" ? px - getCurveOffsetAtZ(zForCurve, roadCurve) : px)
        : px;
    const storedY = Number.isFinite(Number(draft?.y))
      ? Number(draft.y)
      : Number.isFinite(py)
        ? (yModeResolved === "relative_ground" ? py - getGroundDropAtZ(zForCurve) : py)
        : py;
    const storedZ = Number.isFinite(Number(draft?.z))
      ? Number(draft.z)
      : Number.isFinite(pz)
        ? toStoredEditorZ(pz)
        : Number(merged?.z || 0);
    const scale = Math.max(0.2, Number(devScaleDraft.scale) || 1);
    const scaleX = Math.max(0.2, Number(devScaleDraft.scaleX) || 1);
    const scaleY = Math.max(0.2, Number(devScaleDraft.scaleY) || 1);
    const scaleZ = Math.max(0.2, Number(devScaleDraft.scaleZ) || 1);

    if (key.startsWith("custom_")) {
      const currentOverride = sceneConfigRef.current?.object_overrides?.[key] || {};
      const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
      const nextList = currentList.map((item) =>
        String(item?.key || "") === key
          ? {
              ...item,
              x: Number.isFinite(storedX) ? storedX : Number(draft?.x ?? item?.x ?? 0),
              y: Number.isFinite(storedY) ? storedY : Number(draft?.y ?? item?.y ?? 0),
              z: Number.isFinite(storedZ) ? storedZ : Number(draft?.z ?? item?.z ?? -10),
              x_mode: xModeResolved,
              y_mode: yModeResolved,
              movement_mode: String(draft?.movement_mode || currentOverride?.movement_mode || item?.movement_mode || ""),
              kind: String(draft?.kind || item?.kind || ""),
              scale,
              rotation_x: Number.isFinite(Number(draft?.rotation_x))
                ? Number(draft.rotation_x)
                : Number(item?.rotation_x ?? 0),
              rotation_y: Number.isFinite(Number(draft?.rotation_y))
                ? Number(draft.rotation_y)
                : Number(item?.rotation_y ?? 0),
              rotation_z: Number.isFinite(Number(draft?.rotation_z))
                ? Number(draft.rotation_z)
                : Number(item?.rotation_z ?? 0),
              texture_url: String(draft?.texture_url || item?.texture_url || ""),
              model_url: String(draft?.model_url || item?.model_url || ""),
              media_type: String(draft?.media_type || item?.media_type || detectAssetTypeFromName(draft?.model_url || draft?.texture_url || item?.model_url || item?.texture_url || "")),
              block_id: getSceneBlockId(
                Number.isFinite(px)
                  ? px
                  : Number.isFinite(storedX)
                    ? (xModeResolved === "relative_curve" ? storedX + getCurveOffsetAtZ(storedZ, roadCurve) : storedX)
                    : Number(draft?.x ?? item?.x ?? 0),
                Number.isFinite(storedZ) ? storedZ : Number(draft?.z ?? item?.z ?? -10)
              ),
            }
          : item
      );
      const expectedEntry = nextList.find((item) => String(item?.key || "") === key) || null;
      const expectedOverride = {
        ...currentOverride,
        ...draft,
        x: Number.isFinite(storedX) ? storedX : currentOverride?.x,
        y: Number.isFinite(storedY) ? storedY : currentOverride?.y,
        z: Number.isFinite(storedZ) ? storedZ : currentOverride?.z,
        x_mode: xModeResolved,
        y_mode: yModeResolved,
        scale,
        scale_x: scaleX,
        scale_y: scaleY,
        scale_z: scaleZ,
        rotation_x: Number.isFinite(Number(draft?.rotation_x))
          ? Number(draft.rotation_x)
          : Number(currentOverride?.rotation_x ?? 0),
        rotation_y: Number.isFinite(Number(draft?.rotation_y))
          ? Number(draft.rotation_y)
          : Number(currentOverride?.rotation_y ?? 0),
        rotation_z: Number.isFinite(Number(draft?.rotation_z))
          ? Number(draft.rotation_z)
          : Number(currentOverride?.rotation_z ?? 0),
      };
      const saved = await patchSceneConfig({
        custom_objects: nextList,
        object_overrides: {
          [key]: expectedOverride,
        },
      });
      if (!saved) return;
      const persistedEntry =
        (Array.isArray(saved?.custom_objects) ? saved.custom_objects : []).find((item) => String(item?.key || "") === key) || null;
      const persistedOverride = saved?.object_overrides?.[key] || null;
      setDevPersistDebug({
        key,
        mode: "custom",
        at: new Date().toISOString(),
        expected: expectedEntry
          ? {
              x: expectedEntry?.x ?? null,
              y: expectedEntry?.y ?? null,
              z: expectedEntry?.z ?? null,
              rotation_x: expectedEntry?.rotation_x ?? expectedOverride?.rotation_x ?? null,
              rotation_y: expectedEntry?.rotation_y ?? expectedOverride?.rotation_y ?? null,
              rotation_z: expectedEntry?.rotation_z ?? expectedOverride?.rotation_z ?? null,
            }
          : null,
        persisted: persistedEntry
          ? {
              x: persistedEntry?.x ?? null,
              y: persistedEntry?.y ?? null,
              z: persistedEntry?.z ?? null,
              rotation_x: persistedEntry?.rotation_x ?? persistedOverride?.rotation_x ?? null,
              rotation_y: persistedEntry?.rotation_y ?? persistedOverride?.rotation_y ?? null,
              rotation_z: persistedEntry?.rotation_z ?? persistedOverride?.rotation_z ?? null,
            }
          : null,
      });
      setDevSelectedObject((prev) =>
        prev?.key === key
          ? {
              ...prev,
              scenePosition: {
                x: Number.isFinite(px) ? px : Number(prev?.scenePosition?.x || 0),
                y: Number.isFinite(py) ? py : Number(prev?.scenePosition?.y || 0),
                z: Number.isFinite(pz) ? pz : Number(prev?.scenePosition?.z || 0),
              },
              worldPosition: {
                x: Number.isFinite(px) ? px : Number(prev?.worldPosition?.x || 0),
                y: Number.isFinite(py) ? py : Number(prev?.worldPosition?.y || 0),
                z: Number.isFinite(pz) ? pz : Number(prev?.worldPosition?.z || 0),
              },
              blockId: getSceneBlockId(
                Number.isFinite(px) ? px : Number(prev?.scenePosition?.x || 0),
                Number.isFinite(pz) ? toStoredEditorZ(pz) : Number(prev?.scenePosition?.z || 0)
              ),
            }
          : prev
      );
      setSceneConfigMessage("Edicao salva.");
      return;
    }

    const currentOverride = sceneConfigRef.current?.object_overrides?.[key] || {};
    const expectedOverride = {
      ...currentOverride,
      ...draft,
      x: Number.isFinite(storedX) ? storedX : currentOverride?.x,
      y: Number.isFinite(storedY) ? storedY : currentOverride?.y,
      z: Number.isFinite(storedZ) ? storedZ : currentOverride?.z,
      x_mode: xModeResolved,
      y_mode: yModeResolved,
      scale,
      scale_x: scaleX,
      scale_y: scaleY,
      scale_z: scaleZ,
    };
    const saved = await patchSceneConfig({
      object_overrides: {
        [key]: expectedOverride,
      },
    });
    if (!saved) return;
    const persistedOverride = saved?.object_overrides?.[key] || null;
    setDevPersistDebug({
      key,
      mode: "override",
      at: new Date().toISOString(),
      expected: {
        x: expectedOverride?.x ?? null,
        y: expectedOverride?.y ?? null,
        z: expectedOverride?.z ?? null,
        rotation_x: expectedOverride?.rotation_x ?? null,
        rotation_y: expectedOverride?.rotation_y ?? null,
        rotation_z: expectedOverride?.rotation_z ?? null,
      },
      persisted: persistedOverride
        ? {
            x: persistedOverride?.x ?? null,
            y: persistedOverride?.y ?? null,
            z: persistedOverride?.z ?? null,
            rotation_x: persistedOverride?.rotation_x ?? null,
            rotation_y: persistedOverride?.rotation_y ?? null,
            rotation_z: persistedOverride?.rotation_z ?? null,
          }
        : null,
    });
    setSceneConfigMessage("Edicao salva.");
  }, [devDraftOverrides, devPositionDraft.x, devPositionDraft.y, devPositionDraft.z, devScaleDraft.scale, devScaleDraft.scaleX, devScaleDraft.scaleY, devScaleDraft.scaleZ, devSelectedObject, getMergedOverride, isMapStageEditMode, patchSceneConfig, roadCurve, toStoredEditorZ]);

  React.useEffect(() => {
    handleApplySelectedObjectEditsRef.current = handleApplySelectedObjectEdits;
  }, [handleApplySelectedObjectEdits]);

  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge")) return;
    const bossOverride = sceneConfig?.object_overrides?.boss || {};
    const bx = Number(bossOverride?.x);
    const by = Number(bossOverride?.y);
    const bz = Number(bossOverride?.z);
    const bScale = Number(bossOverride?.scale);
    const needsRecovery =
      bossOverride?.hidden === true ||
      !Number.isFinite(bx) ||
      !Number.isFinite(by) ||
      !Number.isFinite(bz) ||
      Math.abs(bx) > 40 ||
      by < -20 ||
      by > 20 ||
      bz < -240 ||
      bz > 120 ||
      !Number.isFinite(bScale) ||
      bScale <= 0;
    if (!needsRecovery) return;
    const recoveryKey = `${selectedIslandDay}:${bx}:${by}:${bz}:${bossOverride?.hidden ? 1 : 0}:${bScale}`;
    if (bossRecoveryRef.current === recoveryKey) return;
    bossRecoveryRef.current = recoveryKey;
    void patchSceneConfig({
      object_overrides: {
        boss: {
          ...bossOverride,
          x: 0,
          y: 0,
          z: 0,
          x_mode: "relative_curve",
          y_mode: "relative_ground",
          hidden: false,
          scale: 1,
          scale_x: 1,
          scale_y: 1,
          scale_z: 1,
          rotation_x: 0,
          rotation_y: 0,
          rotation_z: 0,
        },
      },
    });
    setSceneConfigMessage("Carro reposicionado para a frente da pista no modo dev.");
  }, [isDevMode, patchSceneConfig, sceneConfig?.object_overrides?.boss, screen, selectedIslandDay]);

  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge")) return;
    const horizonOverride = sceneConfig?.object_overrides?.horizon || {};
    const hxRaw = Number(horizonOverride?.x);
    const hyRaw = Number(horizonOverride?.y);
    const hzRaw = Number(horizonOverride?.z);
    const hScaleRaw = Number(horizonOverride?.scale);
    const hx = Number.isFinite(hxRaw) ? hxRaw : 0;
    const hy = Number.isFinite(hyRaw) ? hyRaw : 0;
    const hz = Number.isFinite(hzRaw) ? hzRaw : 0;
    const hScale = Number.isFinite(hScaleRaw) ? hScaleRaw : 1;
    const needsRecovery =
      horizonOverride?.hidden === true ||
      Math.abs(hx) > 120 ||
      hy < -60 ||
      hy > 60 ||
      hz < -260 ||
      hz > 120 ||
      hScale <= 0;
    if (!needsRecovery) return;
    const recoveryKey = `${selectedIslandDay}:${hx}:${hy}:${hz}:${horizonOverride?.hidden ? 1 : 0}:${hScale}`;
    if (horizonRecoveryRef.current === recoveryKey) return;
    horizonRecoveryRef.current = recoveryKey;
    void patchSceneConfig({
      object_overrides: {
        horizon: {
          ...horizonOverride,
          x: 0,
          y: 0,
          z: 0,
          hidden: false,
          scale: 1,
          scale_x: 1,
          scale_y: 1,
          rotation_y: 0,
        },
      },
    });
    setSceneConfigMessage("Horizonte reposicionado no fundo do mapa.");
  }, [isDevMode, patchSceneConfig, sceneConfig?.object_overrides?.horizon, screen, selectedIslandDay]);

  const handleCloseDevEditingMenu = React.useCallback(async () => {
    await handleApplySelectedObjectEdits();
    await cancelDevEditing({ restore: false });
  }, [cancelDevEditing, handleApplySelectedObjectEdits]);

  React.useEffect(() => {
    if (!isDevMode) return;
    if (!devSelectedObject?.key) return;
    if (devEditNonce <= 0) return;
    if (isMapStageEditMode) return;
    const sessionId = devEditSessionRef.current;
    const selectedKey = String(devSelectedObject?.key || "");
    clearPendingDevAutoSave();
    devAutoSaveTimerRef.current = window.setTimeout(() => {
      if (devEditSessionRef.current !== sessionId) return;
      if (String(devSelectedObjectKeyRef.current || "") !== selectedKey) return;
      handleApplySelectedObjectEdits();
    }, 180);
    return () => {
      clearPendingDevAutoSave();
    };
  }, [clearPendingDevAutoSave, devEditNonce, devSelectedObject?.key, handleApplySelectedObjectEdits, isDevMode, isMapStageEditMode]);

  const handleDeleteSelectedObject = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    if (key === "road_base" || key === "boss") {
      setSceneConfigMessage(key === "boss" ? "O carro do dinheiro e fixo do jogo e nao pode ser excluido." : "A rua principal e protegida e nao pode ser excluida.");
      return;
    }
    if (key.startsWith("custom_")) {
      const currentList = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
      const nextList = currentList.filter((item) => String(item?.key || "") !== key);
      await patchSceneConfig({ custom_objects: nextList });
      cancelDevEditing({ restore: false });
      return;
    }
    const currentOverride = sceneConfig?.object_overrides?.[key] || {};
    await patchSceneConfig({
      object_overrides: {
        [key]: {
          ...currentOverride,
          hidden: true,
        },
      },
    });
    cancelDevEditing({ restore: false });
  }, [cancelDevEditing, devSelectedObject, patchSceneConfig, sceneConfig]);

  const handleCloneSelectedObject = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const selectedPos = devSelectedObject?.scenePosition || { x: 0, y: 0.1, z: -12 };
    const currentOverride = getMergedOverride(key);
    const px = Number(devPositionDraft.x);
    const py = Number(devPositionDraft.y);
    const pz = Number(devPositionDraft.z);
    const baseX = Number.isFinite(px) ? px : Number(selectedPos.x || 0);
    const baseY = Number.isFinite(py) ? py : Number(selectedPos.y || 0);
    const baseZ = Number.isFinite(pz) ? pz : Number(selectedPos.z || -10);
    const scaleU = Math.max(0.1, Number(devScaleDraft.scale) || Number(currentOverride?.scale) || 1);
    const scaleX = Math.max(0.1, Number(devScaleDraft.scaleX) || Number(currentOverride?.scale_x) || 1);
    const scaleY = Math.max(0.1, Number(devScaleDraft.scaleY) || Number(currentOverride?.scale_y) || 1);
    const scaleZ = Math.max(0.1, Number(devScaleDraft.scaleZ) || Number(currentOverride?.scale_z) || 1);
    const isRoadLikeClone =
      String(currentOverride?.kind || devSelectedObject?.kind || "").toLowerCase() === "road" ||
      String(devSelectedObject?.media_type || "").toLowerCase() === "model3d";
    const lateralGap = isRoadLikeClone ? 0 : Math.max(0.7, scaleU * scaleX * 0.9);
    const baseForwardGap = Math.max(1.2, scaleU * scaleZ * (isRoadLikeClone ? 3.2 : 1.8));
    const overlapGap = isRoadLikeClone ? Math.max(0.12, scaleU * scaleZ * 0.35) : 0;
    const forwardGap = Math.max(0.8, baseForwardGap - overlapGap);
    const cloneX = baseX + lateralGap;
    const cloneY = baseY;
    const cloneZ = baseZ - forwardGap;
    const rotationX = Number(currentOverride?.rotation_x || 0);
    const rotationY = Number(currentOverride?.rotation_y || 0);
    const rotationZ = Number(currentOverride?.rotation_z || 0);
    const inferredType = String(devSelectedObject?.type || "");
    const defaultGroundRelative = inferredType === "custom" || inferredType === "vegetation" || inferredType === "edge_vegetation" || key.startsWith("custom_");
    const xMode = String(currentOverride?.x_mode || (defaultGroundRelative ? "relative_curve" : "world"));
    const yMode = String(currentOverride?.y_mode || (defaultGroundRelative ? "relative_ground" : "world"));
    const currentStoredY = Number(
      currentOverride?.y ??
      devSelectedObject?.y ??
      0
    );
    const cloneStoredZ = toStoredEditorZ(cloneZ);
    const cloneStoredX = xMode === "relative_curve" ? cloneX - getCurveOffsetAtZ(cloneZ, roadCurve) : cloneX;
    const cloneStoredY = yMode === "relative_ground" ? currentStoredY : cloneY;

    const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    const cloneKey = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const focusClone = (label, kindValue, textureUrlValue, modelUrlValue = "", mediaTypeValue = "image") => {
      setDevDraftOverrides({});
      setDevSelectedObject({
        key: cloneKey,
        type: "custom",
        kind: kindValue,
        label,
        texture_url: textureUrlValue || "",
        model_url: modelUrlValue || "",
        media_type: mediaTypeValue || "image",
        scenePosition: { x: cloneX, y: cloneY, z: cloneZ },
        worldPosition: { x: cloneX, y: cloneY, z: cloneZ },
        blockId: getSceneBlockId(cloneX, cloneZ),
      });
      setDevPositionDraft({
        x: cloneX.toFixed(3),
        y: cloneY.toFixed(3),
        z: cloneZ.toFixed(3),
      });
      setDevScaleDraft({
        scale: scaleU.toFixed(2),
        scaleX: scaleX.toFixed(2),
        scaleY: scaleY.toFixed(2),
        scaleZ: scaleZ.toFixed(2),
      });
      if (textureUrlValue) setDevAddTextureUrl(textureUrlValue);
      setSceneConfigMessage("Clone criado e selecionado.");
    };

    if (key.startsWith("custom_")) {
      const source = list.find((item) => String(item?.key || "") === key);
      if (!source) {
        setSceneConfigMessage("Nao foi possivel clonar esse item.");
        return;
      }
      const textureUrl = String(currentOverride?.texture_url || devSelectedObject?.texture_url || source.texture_url || "");
      const modelUrl = String(currentOverride?.model_url || devSelectedObject?.model_url || source.model_url || "");
      const mediaType = String(currentOverride?.media_type || source.media_type || detectAssetTypeFromName(modelUrl || textureUrl));
      const cloneOverride = {
        texture_url: textureUrl,
        model_url: modelUrl,
        media_type: mediaType,
        rotation_x: rotationX,
        rotation_y: rotationY,
        rotation_z: rotationZ,
        x_mode: xMode,
        y_mode: yMode,
        scale: scaleU,
        scale_x: scaleX,
        scale_y: scaleY,
        scale_z: scaleZ,
      };
      if (String(currentOverride?.movement_mode || "")) {
        cloneOverride.movement_mode = String(currentOverride.movement_mode);
      }
      const clone = {
        ...source,
        key: cloneKey,
        label: `${String(source.label || "Elemento")} +`,
        kind: String(source.kind || "custom"),
        texture_url: textureUrl,
        model_url: modelUrl,
        media_type: mediaType,
        x: cloneStoredX,
        y: cloneStoredY,
        z: cloneStoredZ,
        x_mode: xMode,
        y_mode: yMode,
        scale: scaleU,
        rotation_x: rotationX,
        rotation_y: rotationY,
        rotation_z: rotationZ,
        block_id: getSceneBlockId(cloneX, cloneZ),
      };
      await patchSceneConfig({
        custom_objects: [...list, clone],
        object_overrides: {
          [cloneKey]: cloneOverride,
        },
      });
      focusClone(clone.label, clone.kind, textureUrl, modelUrl, mediaType);
      return;
    }

    const type = String(devSelectedObject?.type || "custom");
    if (type === "horizon" || type === "road") {
      setSceneConfigMessage("Esse item nao pode ser clonado.");
      return;
    }

    const textureUrl = String(currentOverride?.texture_url || devSelectedObject?.texture_url || devAddTextureUrl || "");
    const modelUrl = String(currentOverride?.model_url || devSelectedObject?.model_url || "");
    const mediaType = String(currentOverride?.media_type || detectAssetTypeFromName(modelUrl || textureUrl));
    if (!textureUrl && !modelUrl) {
      setSceneConfigMessage("Defina uma textura antes de clonar.");
      return;
    }
    const kind =
      type === "edge_vegetation" ? "edge" :
      type === "player" ? "player" :
      type === "boss" ? "boss" :
      type === "vegetation" ? "tree" :
      "custom";
    const cloneOverride = {
      texture_url: textureUrl,
      model_url: modelUrl,
      media_type: mediaType,
      rotation_x: rotationX,
      rotation_y: rotationY,
      rotation_z: rotationZ,
      x_mode: xMode,
      y_mode: yMode,
      scale: scaleU,
      scale_x: scaleX,
      scale_y: scaleY,
      scale_z: scaleZ,
    };
    if (String(currentOverride?.movement_mode || "")) {
      cloneOverride.movement_mode = String(currentOverride.movement_mode);
    }
    const clone = {
      key: cloneKey,
      label: `Clone ${devSelectedObject?.label || key}`,
      kind,
      texture_url: textureUrl,
      model_url: modelUrl,
      media_type: mediaType,
      x: cloneStoredX,
      y: cloneStoredY,
      z: cloneStoredZ,
      x_mode: xMode,
      y_mode: yMode,
      scale: scaleU,
      rotation_x: rotationX,
      rotation_y: rotationY,
      rotation_z: rotationZ,
      block_id: getSceneBlockId(cloneX, cloneZ),
    };
    await patchSceneConfig({
      custom_objects: [...list, clone],
      object_overrides: {
        [cloneKey]: cloneOverride,
      },
    });
    focusClone(clone.label, clone.kind, textureUrl, modelUrl, mediaType);
  }, [devAddTextureUrl, devPositionDraft.x, devPositionDraft.y, devPositionDraft.z, devScaleDraft.scale, devScaleDraft.scaleX, devScaleDraft.scaleY, devScaleDraft.scaleZ, devSelectedObject, getMergedOverride, patchSceneConfig, roadCurve, toStoredEditorZ]);

  const handleRepeatSelectedObjectAcrossCycle = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key.startsWith("custom_")) {
      setSceneConfigMessage("Selecione um elemento adicionado para preencher o ciclo.");
      return;
    }
    const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    const source = list.find((item) => String(item?.key || "") === key);
    if (!source) {
      setSceneConfigMessage("Nao foi possivel localizar o elemento para repetir.");
      return;
    }
    const currentOverride = getMergedOverride(key);
    const repeatGroupKey = String(
      currentOverride?.repeat_group ||
      source?.repeat_group ||
      key
    );
    const selectedPos = devSelectedObject?.scenePosition || { x: 0, y: 0.1, z: -12 };
    const px = Number(devPositionDraft.x);
    const py = Number(devPositionDraft.y);
    const pz = Number(devPositionDraft.z);
    const baseX = Number.isFinite(px) ? px : Number(selectedPos.x || 0);
    const baseY = Number.isFinite(py) ? py : Number(selectedPos.y || 0);
    const baseZ = Number.isFinite(pz) ? pz : Number(selectedPos.z || -10);
    const scaleU = Math.max(0.1, Number(devScaleDraft.scale) || Number(currentOverride?.scale) || 1);
    const scaleX = Math.max(0.1, Number(devScaleDraft.scaleX) || Number(currentOverride?.scale_x) || 1);
    const scaleZ = Math.max(0.1, Number(devScaleDraft.scaleZ) || Number(currentOverride?.scale_z) || 1);
    const currentStoredX = Number(currentOverride?.x ?? source?.x ?? 0);
    const currentStoredY = Number(currentOverride?.y ?? source?.y ?? 0);
    const inferredType = String(devSelectedObject?.type || "");
    const defaultGroundRelative =
      inferredType === "custom" ||
      inferredType === "vegetation" ||
      inferredType === "edge_vegetation" ||
      key.startsWith("custom_");
    const isRoadLikeClone =
      String(currentOverride?.kind || devSelectedObject?.kind || source?.kind || "").toLowerCase() === "road" ||
      String(currentOverride?.media_type || devSelectedObject?.media_type || source?.media_type || "").toLowerCase() === "model3d";
    const xMode = isRoadLikeClone
      ? "relative_curve"
      : String(currentOverride?.x_mode || source?.x_mode || (defaultGroundRelative ? "relative_curve" : "world"));
    const yMode = isRoadLikeClone
      ? "relative_ground"
      : String(currentOverride?.y_mode || source?.y_mode || (defaultGroundRelative ? "relative_ground" : "world"));
    const lateralGap = isRoadLikeClone ? 0 : Math.max(0.7, scaleU * scaleX * 0.9);
    const configuredRepeatStep = Number(currentOverride?.repeat_step_z);
    const baseForwardGap = Math.max(1.2, scaleU * scaleZ * (isRoadLikeClone ? 3.2 : 1.8));
    const overlapGap = isRoadLikeClone ? Math.max(0.12, scaleU * scaleZ * 0.35) : 0;
    const autoStepZ = Math.max(0.8, baseForwardGap - overlapGap);
    const stepZ =
      Number.isFinite(configuredRepeatStep) && configuredRepeatStep > 0
        ? Math.max(0.2, configuredRepeatStep)
        : autoStepZ;
    const cycleLength = Math.max(80, Math.min(5000, Number(mapCycleLengthValue) || 600));
    const cloneCount = Math.max(0, Math.min(200, Math.floor(cycleLength / stepZ) - 1));
    if (cloneCount <= 0) {
      setSceneConfigMessage("O ciclo esta curto demais para repetir esse bloco.");
      return;
    }

    const seenZ = new Set([
      String(Number(normalizeStoredCycleZ(source?.z)).toFixed(4)),
    ]);
    const nextItems = [];
    const nextOverrides = {};
    for (let index = 1; index <= cloneCount; index += 1) {
      const cloneX = baseX + lateralGap * index;
      const cloneY = baseY;
      const cloneZ = baseZ - stepZ * index;
      const cloneStoredZ = normalizeStoredCycleZ(toStoredEditorZ(cloneZ));
      const dedupeKey = String(Number(cloneStoredZ).toFixed(4));
      if (seenZ.has(dedupeKey)) continue;
      seenZ.add(dedupeKey);
      const cloneStoredX = xMode === "relative_curve" ? currentStoredX : cloneX;
      const cloneStoredY = yMode === "relative_ground" ? currentStoredY : cloneY;
      const cloneKey = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}`;
      nextItems.push({
        ...source,
        key: cloneKey,
        label: String(source.label || "Elemento"),
        repeat_group: repeatGroupKey,
        x: cloneStoredX,
        y: cloneStoredY,
        z: cloneStoredZ,
        x_mode: xMode,
        y_mode: yMode,
        movement_mode: "anchored",
        block_id: getSceneBlockId(cloneX, cloneZ),
      });
      const clonedOverride = {
        ...currentOverride,
        repeat_group: repeatGroupKey,
        x_mode: xMode,
        y_mode: yMode,
        movement_mode: "anchored",
      };
      delete clonedOverride.x;
      delete clonedOverride.y;
      delete clonedOverride.z;
      delete clonedOverride.hidden;
      nextOverrides[cloneKey] = clonedOverride;
    }

    if (!nextItems.length) {
      setSceneConfigMessage("Nao foi necessario repetir; o ciclo ja estava preenchido.");
      return;
    }

    const optimisticConfig = {
      ...(sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay)),
      custom_objects: [
        ...list.map((item) =>
          String(item?.key || "") === key
            ? { ...item, repeat_group: repeatGroupKey }
            : item
        ),
        ...nextItems,
      ],
      object_overrides: {
        ...(sceneConfigRef.current?.object_overrides || {}),
        [key]: {
          ...(sceneConfigRef.current?.object_overrides?.[key] || {}),
          repeat_group: repeatGroupKey,
          repeat_step_z:
            Number.isFinite(configuredRepeatStep) && configuredRepeatStep > 0
              ? Math.max(0.2, configuredRepeatStep)
              : autoStepZ,
        },
        ...nextOverrides,
      },
    };
    sceneConfigRef.current = optimisticConfig;
    setSceneConfig(optimisticConfig);
    const firstClone = nextItems[0];
    if (firstClone) {
      const firstPreviewZ = toPreviewEditorZ(firstClone.z);
      const firstPreviewX =
        xMode === "relative_curve"
          ? Number(firstClone.x || 0) + getCurveOffsetAtZ(firstPreviewZ, roadCurve)
          : Number(firstClone.x || 0);
      const firstPreviewY =
        yMode === "relative_ground"
          ? Number(firstClone.y || 0) + getGroundDropAtZ(firstPreviewZ)
          : Number(firstClone.y || 0);
      setDevSelectedObject({
        key: firstClone.key,
        type: "custom",
        kind: String(firstClone.kind || devSelectedObject?.kind || "custom"),
        label: String(firstClone.label || "Elemento"),
        texture_url: String(firstClone.texture_url || ""),
        model_url: String(firstClone.model_url || ""),
        media_type: String(firstClone.media_type || ""),
        scenePosition: { x: firstPreviewX, y: firstPreviewY, z: firstPreviewZ },
        worldPosition: { x: firstPreviewX, y: firstPreviewY, z: firstPreviewZ },
        blockId: getSceneBlockId(firstPreviewX, firstPreviewZ),
      });
      setDevPositionDraft({
        x: firstPreviewX.toFixed(3),
        y: firstPreviewY.toFixed(3),
        z: firstPreviewZ.toFixed(3),
      });
    }
    setSceneConfigMessage(`${nextItems.length} blocos adicionados ate fechar o ciclo.`);
    await patchSceneConfig({
      custom_objects: optimisticConfig.custom_objects,
      object_overrides: {
        [key]: {
          ...(sceneConfigRef.current?.object_overrides?.[key] || {}),
          repeat_group: repeatGroupKey,
          repeat_step_z:
            Number.isFinite(configuredRepeatStep) && configuredRepeatStep > 0
              ? Math.max(0.2, configuredRepeatStep)
              : autoStepZ,
        },
        ...nextOverrides,
      },
    });
  }, [
    createDefaultSceneConfig,
    devPositionDraft.x,
    devPositionDraft.y,
    devPositionDraft.z,
    devScaleDraft.scale,
    devScaleDraft.scaleX,
    devScaleDraft.scaleZ,
    devSelectedObject,
    getMergedOverride,
    mapCycleLengthValue,
    normalizeStoredCycleZ,
    patchSceneConfig,
    roadCurve,
    selectedIslandDay,
    setSceneConfig,
    toStoredEditorZ,
    toPreviewEditorZ,
  ]);

  const handleTightenSelectedRepeatGroup = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key.startsWith("custom_")) {
      setSceneConfigMessage("Selecione um elemento repetido para aproximar o grupo.");
      return;
    }
    const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    const source = list.find((item) => String(item?.key || "") === key);
    if (!source) {
      setSceneConfigMessage("Nao foi possivel localizar o elemento repetido.");
      return;
    }
    const currentOverride = getMergedOverride(key);
    const repeatGroupKey = String(currentOverride?.repeat_group || source?.repeat_group || "");
    const siblingItems = list.filter((item) => {
      const itemKey = String(item?.key || "");
      const itemOverride = getMergedOverride(itemKey);
      const itemGroup = String(itemOverride?.repeat_group || item?.repeat_group || "");
      return itemGroup && itemGroup === repeatGroupKey;
    });
    if (siblingItems.length < 2) {
      setSceneConfigMessage("Esse grupo ainda nao tem repeticoes para aproximar.");
      return;
    }
    const cycleLength = Math.max(80, Math.min(5000, Number(mapCycleLengthValue) || 600));
    const currentStep = Number(currentOverride?.repeat_step_z);
    const nextStep = Math.max(0.2, (Number.isFinite(currentStep) && currentStep > 0 ? currentStep : 1) - 0.25);
    const normalized = siblingItems
      .map((item) => {
        const seq = ((-Number(item?.z || 0) % cycleLength) + cycleLength) % cycleLength;
        return { item, seq };
      })
      .sort((a, b) => a.seq - b.seq);
    const baseSeq = normalized[0]?.seq || 0;
    const nextList = list.map((item) => {
      const index = normalized.findIndex((entry) => String(entry.item?.key || "") === String(item?.key || ""));
      if (index === -1) return item;
      const nextSeq = (baseSeq + nextStep * index) % cycleLength;
      return {
        ...item,
        repeat_group: repeatGroupKey,
        z: -nextSeq,
      };
    });
    const overridePatch = {};
    normalized.forEach(({ item }) => {
      const itemKey = String(item?.key || "");
      overridePatch[itemKey] = {
        ...(sceneConfigRef.current?.object_overrides?.[itemKey] || {}),
        repeat_group: repeatGroupKey,
        repeat_step_z: nextStep,
      };
    });
    const optimisticConfig = {
      ...(sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay)),
      custom_objects: nextList,
      object_overrides: {
        ...(sceneConfigRef.current?.object_overrides || {}),
        ...overridePatch,
      },
    };
    sceneConfigRef.current = optimisticConfig;
    setSceneConfig(optimisticConfig);
    setSceneConfigMessage(`Grupo aproximado. Novo passo: ${nextStep.toFixed(2)}`);
    await patchSceneConfig({
      custom_objects: nextList,
      object_overrides: overridePatch,
    });
  }, [createDefaultSceneConfig, devSelectedObject?.key, getMergedOverride, mapCycleLengthValue, patchSceneConfig, selectedIslandDay]);

  const handleToggleSelectedObjectMovementMode = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    const type = String(devSelectedObject?.type || "");
    const isFlowCapable = type === "vegetation" || type === "edge_vegetation" || type === "custom";
    if (!isFlowCapable) {
      setSceneConfigMessage("Este item nao usa modo esteira.");
      return;
    }
    const currentOverride = getMergedOverride(key);
    const nextMode = currentOverride?.movement_mode === "anchored" ? "flow" : "anchored";
    setDevDraftOverrides((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        movement_mode: nextMode,
      },
    }));
    persistObjectOverride(key, { movement_mode: nextMode });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
    setSceneConfigMessage(nextMode === "flow" ? "Modo esteira ativo." : "Modo fixo ativo.");
  }, [devSelectedObject, flushSelectedObjectEditsSoon, getMergedOverride, markDevEdited, persistObjectOverride]);

  const handleRemoveSelectedCustomObject = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key.startsWith("custom_")) {
      setSceneConfigMessage("Somente elementos adicionados podem ser removidos.");
      return;
    }
    const currentList = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    const nextList = currentList.filter((item) => String(item?.key || "") !== key);
    await patchSceneConfig({ custom_objects: nextList });
    setDevSelectedObject(null);
  }, [devSelectedObject, patchSceneConfig, sceneConfig]);

  const registerUploadedAsset = React.useCallback((asset) => {
    const url = String(asset?.url || "").trim();
    if (!url) return;
    const type = String(asset?.type || detectAssetTypeFromName(url));
    const name = String(asset?.name || getAssetFileName(url));
    const canonicalName = getCanonicalSceneAssetName(name || url);
    const sceneKind = String(asset?.sceneKind || "").trim().toLowerCase();
    setDevUploadedAssets((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const withoutSame = list.filter((item) => {
        if (String(item?.url || "") === url) return false;
        if (String(item?.type || "") !== type) return true;
        return getCanonicalSceneAssetName(item?.name || item?.url || "") !== canonicalName;
      });
      return [{ url, type, name, canonicalName, sceneKind }, ...withoutSame].slice(0, 80);
    });
    setDevLastUploadedAsset({ url, type, name, canonicalName, sceneKind });
  }, []);
  const resolveDevGalleryAssetMeta = React.useCallback(
    (rawUrl) => {
      const url = String(resolveGalleryAssetUrl(rawUrl) || rawUrl || "").trim();
      if (!url) return { url: "", type: "image", name: "" };
      const uploadedMatch = (Array.isArray(devUploadedAssets) ? devUploadedAssets : []).find(
        (item) => String(resolveGalleryAssetUrl(item?.url) || item?.url || "").trim() === url
      );
      return {
        url,
        type: String(uploadedMatch?.type || detectAssetTypeFromName(url)),
        name: String(uploadedMatch?.name || getAssetFileName(url)),
      };
    },
    [devUploadedAssets]
  );

  const createCustomObjectFromAsset = React.useCallback(
    async ({
      assetUrl,
      assetType,
      assetName = "",
      kindOverride = null,
      editorCategory = "elements",
      labelPrefix = "Elemento",
      spawnPosition = null,
      selectAfterCreate = true,
      modelTexturePayload = null,
    }) => {
      const resolvedUrl = resolveGalleryAssetUrl(assetUrl) || String(assetUrl || "").trim();
      if (!resolvedUrl) {
        setSceneConfigMessage("Arquivo invalido para adicionar.");
        return null;
      }
      if (!isSceneAssetUrlCandidate(resolvedUrl)) {
        setSceneConfigMessage("Asset invalido. Use arquivo da galeria ou upload.");
        return null;
      }
      const resolvedType = assetType || detectAssetTypeFromName(resolvedUrl);
      const source =
        spawnPosition &&
        Number.isFinite(Number(spawnPosition.x)) &&
        Number.isFinite(Number(spawnPosition.y)) &&
        Number.isFinite(Number(spawnPosition.z))
          ? {
              x: Number(spawnPosition.x),
              y: Number(spawnPosition.y),
              z: Number(spawnPosition.z),
            }
          : getVisibleSpawnPoint();
      const key = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const baseX = Number(source.x);
      const previewZ = Number(source.z);
      const sourceY = Number(source.y);
      const baseZ = toStoredEditorZ(previewZ);
      const isModel3d = resolvedType === "model3d";
      const shouldStartAnchored = isModel3d || isMapStageEditMode;
      const baseXMode = isModel3d ? "world" : "relative_curve";
      const baseYMode = isModel3d ? "world" : "relative_ground";
      const groundYAtPreview = getGroundDropAtZ(previewZ);
      const baseY =
        baseYMode === "relative_ground"
          ? Number(
              (
                Number.isFinite(sourceY)
                  ? sourceY - groundYAtPreview
                  : 0.06
              ).toFixed(3)
            )
          : (Number.isFinite(sourceY) ? sourceY : 0);
      const previewWorldX =
        baseXMode === "relative_curve" ? baseX + getCurveOffsetAtZ(previewZ, roadCurve) : baseX;
      const previewWorldY =
        baseYMode === "relative_ground" ? baseY + groundYAtPreview : baseY;
      const normalizedCategory = String(editorCategory || "elements").trim().toLowerCase() === "eliminatory"
        ? "eliminatory"
        : "elements";
      const item = {
        key,
        label: `${labelPrefix} ${key.slice(-4)}`,
        kind: kindOverride || (isModel3d ? "model" : devAddKind),
        editor_category: normalizedCategory,
        texture_url:
          isModel3d
            ? String(modelTexturePayload?.texture_url || "")
            : resolvedUrl,
        model_url: isModel3d ? resolvedUrl : "",
        model_name: isModel3d ? String(assetName || getAssetFileName(resolvedUrl)).trim() : "",
        media_type: resolvedType,
        texture_settings: normalizeTextureSettings(modelTexturePayload?.texture_settings),
        imported_texture_projection:
          String(modelTexturePayload?.imported_texture_projection || "").trim().toLowerCase() === "side"
            ? "side"
            : String(modelTexturePayload?.imported_texture_projection || "").trim().toLowerCase() === "back"
              ? "back"
              : "front",
        side_textures:
          modelTexturePayload?.side_textures && typeof modelTexturePayload.side_textures === "object"
            ? { ...modelTexturePayload.side_textures }
            : {},
        side_texture_settings: normalizeSideTextureSettings(modelTexturePayload?.side_texture_settings),
        x: baseX,
        x_mode: baseXMode,
        y: baseY,
        y_mode: baseYMode,
        z: baseZ,
        movement_mode: shouldStartAnchored ? "anchored" : "flow",
        scale: 1,
        block_id: getSceneBlockId(baseX, baseZ),
      };
      const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
      const nextList = [...currentList, item];
      setSceneConfig((prev) => ({
        ...(prev || createDefaultSceneConfig(selectedIslandDay)),
        custom_objects: nextList,
      }));
      sceneConfigRef.current = {
        ...(sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay)),
        custom_objects: nextList,
      };
      const savedConfig = await patchSceneConfig({ custom_objects: nextList });
      if (selectAfterCreate) {
        setDevDraftOverrides({});
        setDevSelectedObject({
          key,
          type: "custom",
          kind: item.kind,
          label: item.label,
          texture_url: item.texture_url || "",
          model_url: item.model_url || "",
          model_name: item.model_name || "",
          media_type: item.media_type || "image",
          texture_settings: normalizeTextureSettings(item.texture_settings),
          imported_texture_projection: String(item.imported_texture_projection || "front"),
          side_textures: item.side_textures && typeof item.side_textures === "object" ? { ...item.side_textures } : {},
          side_texture_settings: normalizeSideTextureSettings(item.side_texture_settings),
          scenePosition: { x: previewWorldX, y: previewWorldY, z: previewZ },
          worldPosition: { x: previewWorldX, y: previewWorldY, z: previewZ },
          blockId: getSceneBlockId(baseX, baseZ),
        });
        setDevPositionDraft({
          x: previewWorldX.toFixed(3),
          y: previewWorldY.toFixed(3),
          z: previewZ.toFixed(3),
        });
        setDevScaleDraft({
          scale: "1.00",
          scaleX: "1.00",
          scaleY: "1.00",
          scaleZ: "1.00",
        });
      }
      if (!savedConfig) {
        setSceneConfigMessage("Elemento adicionado no preview, mas nao foi possivel salvar no backend agora.");
        return item;
      }
      setSceneConfigMessage("Elemento adicionado com tamanho original. Agora ajuste no mapa.");
      return item;
    },
    [
      devAddKind,
      isMapStageEditMode,
      patchSceneConfig,
      roadCurve,
      selectedIslandDay,
      toStoredEditorZ,
    ]
  );

  const handleAssignModelTextureToSide = React.useCallback(() => {
    const texture = String(devModelSelectedTexture || "").trim();
    const side = String(devModelSelectedSide || "").trim();
    if (!texture || !side) return;
    const sideSettings = normalizeTextureSettings(devModelTextureDraft);
    setDevModelSideTextures((prev) => ({
      ...(prev || {}),
      [side]: texture,
    }));
    setDevModelSideTextureSettings((prev) => ({
      ...(prev || {}),
      [side]: sideSettings,
    }));
    setSceneConfigMessage(`Textura atribuida ao lado ${side}.`);
  }, [devModelSelectedSide, devModelSelectedTexture, devModelTextureDraft]);

  const handleApplyTextureSettingsToSide = React.useCallback(() => {
    const side = String(devModelSelectedSide || "").trim();
    if (!side) return;
    const normalized = normalizeTextureSettings(devModelTextureDraft);
    setDevModelSideTextureSettings((prev) => ({
      ...(prev || {}),
      [side]: normalized,
    }));
    setSceneConfigMessage(`Configuracao de textura aplicada no lado ${side}.`);
  }, [devModelSelectedSide, devModelTextureDraft]);
  const handleToolStrengthChange = React.useCallback((toolKey, value) => {
    const key = String(toolKey || "").trim();
    if (!key) return;
    setDevToolStrengths((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));
  }, []);
  const getModelerHistoryKey = React.useCallback(() => {
    const selectedKey = String(devSelectedObject?.key || "");
    if (selectedKey.startsWith("custom_")) return selectedKey;
    return `draft:${String(devEditingPresetKey || "new")}`;
  }, [devEditingPresetKey, devSelectedObject?.key]);
  const syncModelerHistoryState = React.useCallback(() => {
    const raw = modelerHistoryRef.current;
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    setModelerHistoryView(
      entries.map((item, idx) => ({
        id: String(item?.id || `${idx}`),
        label: String(item?.label || `Etapa ${idx + 1}`),
      }))
    );
    setModelerHistoryCursor(Number(raw?.cursor ?? -1));
  }, []);
  const buildModelerHistorySnapshot = React.useCallback(
    (rawSnapshot) => {
      const raw = rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : {};
      const rawSideTextures = raw.sideTextures && typeof raw.sideTextures === "object" ? raw.sideTextures : {};
      const rawSideTextureSettings =
        raw.sideTextureSettings && typeof raw.sideTextureSettings === "object"
          ? raw.sideTextureSettings
          : {};
      const normalizedSides = {};
      Object.keys(rawSideTextures)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .forEach((key) => {
          const safeKey = String(key || "").trim();
          if (!safeKey) return;
          const value = String(rawSideTextures[key] || "").trim();
          if (!value) return;
          normalizedSides[safeKey] = value;
        });
      const normalizedSideSettings = {};
      Object.keys(rawSideTextureSettings)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .forEach((key) => {
          const safeKey = String(key || "").trim();
          if (!safeKey) return;
          normalizedSideSettings[safeKey] = normalizeTextureSettings(rawSideTextureSettings[key]);
        });
      return {
        offsets: normalizeOffsetsForUndo(raw.offsets),
        vertexColors: normalizeVertexColorsForUndo(raw.vertexColors),
        primitive: String(raw.primitive || "box"),
        weldVertices: !!raw.weldVertices,
        width: String(raw.width ?? "1.8"),
        height: String(raw.height ?? "1.2"),
        depth: String(raw.depth ?? "1.4"),
        radiusTop: String(raw.radiusTop ?? "0.7"),
        radiusBottom: String(raw.radiusBottom ?? "0.9"),
        widthSegments: String(raw.widthSegments ?? "1"),
        heightSegments: String(raw.heightSegments ?? "1"),
        depthSegments: String(raw.depthSegments ?? "1"),
        radialSegments: String(raw.radialSegments ?? "8"),
        textureUrl: String(raw.textureUrl || ""),
        sideTextures: normalizedSides,
        textureSettings: normalizeTextureSettings(raw.textureSettings),
        sideTextureSettings: normalizedSideSettings,
      };
    },
    []
  );
  const pushModelerHistory = React.useCallback(
    (nextSnapshot, label = "Edicao") => {
      if (modelerHistoryRef.current?.suspend) return;
      const key = getModelerHistoryKey();
      const normalized = buildModelerHistorySnapshot(nextSnapshot);
      if (modelerHistoryRef.current.key !== key) {
        modelerHistoryRef.current = {
          key,
          entries: [],
          cursor: -1,
          suspend: false,
        };
      }
      const entries = Array.isArray(modelerHistoryRef.current.entries) ? modelerHistoryRef.current.entries : [];
      const cursor = Number(modelerHistoryRef.current.cursor ?? -1);
      const current = cursor >= 0 && entries[cursor] ? buildModelerHistorySnapshot(entries[cursor].snapshot || entries[cursor]) : null;
      if (current && JSON.stringify(current) === JSON.stringify(normalized)) return;
      const trimmed = entries.slice(0, cursor + 1);
      const nextEntries = [
        ...trimmed,
        {
          id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          label,
          snapshot: normalized,
        },
      ].slice(-10);
      modelerHistoryRef.current.entries = nextEntries;
      modelerHistoryRef.current.cursor = nextEntries.length - 1;
      syncModelerHistoryState();
    },
    [buildModelerHistorySnapshot, getModelerHistoryKey, syncModelerHistoryState]
  );
  const applyModelerHistorySnapshot = React.useCallback(
    async (rawSnapshot) => {
      const key = getModelerHistoryKey();
      const snapshot = buildModelerHistorySnapshot(rawSnapshot);
      setDevModelPrimitive(snapshot.primitive);
      setDevModelWeldVertices(!!snapshot.weldVertices);
      setDevModelWidth(snapshot.width);
      setDevModelHeight(snapshot.height);
      setDevModelDepth(snapshot.depth);
      setDevModelRadiusTop(snapshot.radiusTop);
      setDevModelRadiusBottom(snapshot.radiusBottom);
      setDevModelWidthSegments(snapshot.widthSegments);
      setDevModelHeightSegments(snapshot.heightSegments);
      setDevModelDepthSegments(snapshot.depthSegments);
      setDevModelRadialSegments(snapshot.radialSegments);
      setDevModelSelectedTexture(snapshot.textureUrl);
      setDevModelSideTextures(snapshot.sideTextures || {});
      setDevModelSideTextureSettings(snapshot.sideTextureSettings || {});
      setDevModelTextureDraft(normalizeTextureSettings(snapshot.textureSettings));
      setDevModelDraftVertexColors(normalizeVertexColorsForUndo(snapshot.vertexColors));
      if (key.startsWith("custom_")) {
        const patch = {
          procedural_vertex_offsets: snapshot.offsets,
          procedural_vertex_colors: normalizeVertexColorsForUndo(snapshot.vertexColors),
          procedural_type: snapshot.primitive,
          weld_vertices: !!snapshot.weldVertices,
          width: Number(snapshot.width),
          height: Number(snapshot.height),
          depth: Number(snapshot.depth),
          radius_top: Number(snapshot.radiusTop),
          radius_bottom: Number(snapshot.radiusBottom),
          width_segments: Math.max(1, Math.floor(Number(snapshot.widthSegments) || 1)),
          height_segments: Math.max(1, Math.floor(Number(snapshot.heightSegments) || 1)),
          depth_segments: Math.max(1, Math.floor(Number(snapshot.depthSegments) || 1)),
          radial_segments: Math.max(3, Math.floor(Number(snapshot.radialSegments) || 8)),
          texture_url: snapshot.textureUrl,
          texture_settings: normalizeTextureSettings(snapshot.textureSettings),
          side_textures: snapshot.sideTextures || {},
          side_texture_settings: snapshot.sideTextureSettings || {},
        };
        setDevDraftOverrides((prev) => ({
          ...(prev || {}),
          [key]: {
            ...((prev && prev[key]) || {}),
            ...patch,
          },
        }));
        await handleDevProceduralEdit({
          key,
          patch,
          isFinal: true,
          skipUndo: true,
        });
        return;
      }
      setDevModelDraftOffsets(snapshot.offsets);
      setDevModelDraftVertexColors(normalizeVertexColorsForUndo(snapshot.vertexColors));
    },
    [buildModelerHistorySnapshot, getModelerHistoryKey, handleDevProceduralEdit]
  );
  const handleModelerOffsetsChange = React.useCallback(
    (nextOffsets) => {
      if (devModelViewportMode === "imported") {
        setDevImportedDraftOffsets(normalizeOffsetsForUndo(nextOffsets));
        return;
      }
      const selectedKey = String(devSelectedObject?.key || "");
      if (selectedKey.startsWith("custom_")) {
        setDevDraftOverrides((prev) => ({
          ...(prev || {}),
          [selectedKey]: {
            ...((prev && prev[selectedKey]) || {}),
            procedural_vertex_offsets: nextOffsets || {},
          },
        }));
        return;
      }
      setDevModelDraftOffsets(normalizeOffsetsForUndo(nextOffsets));
    },
    [devModelViewportMode, devSelectedObject?.key]
  );
  const handleModelerOffsetsCommit = React.useCallback(
    async (nextOffsets, previousOffsets) => {
      if (devModelViewportMode === "imported") {
        setDevImportedDraftOffsets(normalizeOffsetsForUndo(nextOffsets));
        return;
      }
      const selectedKey = String(devSelectedObject?.key || "");
      if (!selectedKey.startsWith("custom_")) {
        const next = normalizeOffsetsForUndo(nextOffsets);
        setDevModelDraftOffsets(next || {});
        pushModelerHistory(
          {
            primitive: devModelPrimitive,
            weldVertices: !!devModelWeldVertices,
            width: devModelWidth,
            height: devModelHeight,
            depth: devModelDepth,
            radiusTop: devModelRadiusTop,
            radiusBottom: devModelRadiusBottom,
            widthSegments: devModelWidthSegments,
            heightSegments: devModelHeightSegments,
            depthSegments: devModelDepthSegments,
            radialSegments: devModelRadialSegments,
            textureUrl: devModelSelectedTexture,
            sideTextures: devModelSideTextures,
            textureSettings: devModelTextureDraft,
            sideTextureSettings: devModelSideTextureSettings,
            offsets: next || {},
            vertexColors: devModelDraftVertexColors || {},
          },
          "Edicao"
        );
        return;
      }
      const next = normalizeOffsetsForUndo(nextOffsets);
      pushModelerHistory(
        {
          primitive: devModelPrimitive,
          weldVertices: !!devModelWeldVertices,
          width: devModelWidth,
          height: devModelHeight,
          depth: devModelDepth,
          radiusTop: devModelRadiusTop,
          radiusBottom: devModelRadiusBottom,
          widthSegments: devModelWidthSegments,
          heightSegments: devModelHeightSegments,
          depthSegments: devModelDepthSegments,
          radialSegments: devModelRadialSegments,
          textureUrl: devModelSelectedTexture,
          sideTextures: devModelSideTextures,
          textureSettings: devModelTextureDraft,
          sideTextureSettings: devModelSideTextureSettings,
          offsets: next || {},
          vertexColors: devModelDraftVertexColors || {},
        },
        "Edicao"
      );
      await handleDevProceduralEdit({
        key: selectedKey,
        patch: { procedural_vertex_offsets: next || {} },
        isFinal: true,
        skipUndo: true,
      });
    },
    [
      devModelDepth,
      devModelDepthSegments,
      devModelDraftVertexColors,
      devModelHeight,
      devModelHeightSegments,
      devModelPrimitive,
      devModelRadialSegments,
      devModelRadiusBottom,
      devModelRadiusTop,
      devModelSelectedTexture,
      devModelSideTextures,
      devModelSideTextureSettings,
      devModelTextureDraft,
      devModelWeldVertices,
      devModelWidth,
      devModelWidthSegments,
      devModelViewportMode,
      devSelectedObject?.key,
      handleDevProceduralEdit,
      pushModelerHistory,
    ]
  );
  const handleModelerVertexColorsChange = React.useCallback(
    (nextColors) => {
      const selectedKey = String(devSelectedObject?.key || "");
      const normalized = normalizeVertexColorsForUndo(nextColors);
      if (devModelViewportMode === "imported") {
        setDevImportedDraftVertexColors(normalized);
        return;
      }
      if (selectedKey.startsWith("custom_")) {
        setDevDraftOverrides((prev) => ({
          ...(prev || {}),
          [selectedKey]: {
            ...((prev && prev[selectedKey]) || {}),
            procedural_vertex_colors: normalized,
          },
        }));
        return;
      }
      setDevModelDraftVertexColors(normalized);
    },
    [devModelViewportMode, devSelectedObject?.key]
  );
  const handleModelerVertexColorsCommit = React.useCallback(
    async (nextColors) => {
      const selectedKey = String(devSelectedObject?.key || "");
      const normalized = normalizeVertexColorsForUndo(nextColors);
      if (devModelViewportMode === "imported") {
        setDevImportedDraftVertexColors(normalized);
        return;
      }
      if (!selectedKey.startsWith("custom_")) {
        setDevModelDraftVertexColors(normalized);
        pushModelerHistory(
          {
            primitive: devModelPrimitive,
            weldVertices: !!devModelWeldVertices,
            width: devModelWidth,
            height: devModelHeight,
            depth: devModelDepth,
            radiusTop: devModelRadiusTop,
            radiusBottom: devModelRadiusBottom,
            widthSegments: devModelWidthSegments,
            heightSegments: devModelHeightSegments,
            depthSegments: devModelDepthSegments,
            radialSegments: devModelRadialSegments,
            textureUrl: devModelSelectedTexture,
            sideTextures: devModelSideTextures,
            textureSettings: devModelTextureDraft,
            sideTextureSettings: devModelSideTextureSettings,
            offsets: devModelDraftOffsets || {},
            vertexColors: normalized,
          },
          "Pintura"
        );
        return;
      }
      pushModelerHistory(
        {
          primitive: devModelPrimitive,
          weldVertices: !!devModelWeldVertices,
          width: devModelWidth,
          height: devModelHeight,
          depth: devModelDepth,
          radiusTop: devModelRadiusTop,
          radiusBottom: devModelRadiusBottom,
          widthSegments: devModelWidthSegments,
          heightSegments: devModelHeightSegments,
          depthSegments: devModelDepthSegments,
          radialSegments: devModelRadialSegments,
          textureUrl: devModelSelectedTexture,
          sideTextures: devModelSideTextures,
          textureSettings: devModelTextureDraft,
          sideTextureSettings: devModelSideTextureSettings,
          offsets: devModelDraftOffsets || {},
          vertexColors: normalized,
        },
        "Pintura"
      );
      await handleDevProceduralEdit({
        key: selectedKey,
        patch: { procedural_vertex_colors: normalized },
        isFinal: true,
        skipUndo: true,
      });
    },
    [
      devModelDepth,
      devModelDepthSegments,
      devModelDraftOffsets,
      devModelHeight,
      devModelHeightSegments,
      devModelPrimitive,
      devModelRadialSegments,
      devModelRadiusBottom,
      devModelRadiusTop,
      devModelSelectedTexture,
      devModelSideTextures,
      devModelSideTextureSettings,
      devModelTextureDraft,
      devModelWeldVertices,
      devModelWidth,
      devModelWidthSegments,
      devModelViewportMode,
      devSelectedObject?.key,
      handleDevProceduralEdit,
      pushModelerHistory,
    ]
  );
  const getProceduralProjectFolders = React.useCallback(() => {
    const list = Array.isArray(sceneConfigRef.current?.procedural_presets) ? sceneConfigRef.current.procedural_presets : [];
    const unique = new Set();
    list.forEach((item) => {
      const folder = String(item?.folder || "").trim();
      if (folder) unique.add(folder);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, []);
  const promptProceduralProjectFolder = React.useCallback(
    (initialValue = "") => {
      const suggested = String(initialValue || `Ilha ${selectedIslandDay}`).trim() || `Ilha ${selectedIslandDay}`;
      const folders = getProceduralProjectFolders();
      const foldersText = folders.length
        ? `\nPastas existentes:\n- ${folders.join("\n- ")}\n`
        : "\nPastas existentes: (nenhuma)\n";
      const input = window.prompt(`Nome da pasta do projeto 3D.${foldersText}\nDigite a pasta:`, suggested);
      return String(input || "").trim();
    },
    [getProceduralProjectFolders, selectedIslandDay]
  );
  const closeImportedExportSaveDialog = React.useCallback((result = null) => {
    setIsImportedExportSaveDialogOpen(false);
    const resolver = importedExportSaveResolverRef.current;
    importedExportSaveResolverRef.current = null;
    if (typeof resolver === "function") resolver(result);
  }, []);
  const requestImportedExportTarget = React.useCallback(
    (initialName = "", initialFolder = "") =>
      new Promise((resolve) => {
        importedExportSaveResolverRef.current = resolve;
        setImportedExportSaveName(String(initialName || "").trim());
        setImportedExportSaveFolder(String(initialFolder || `Ilha ${selectedIslandDay}`).trim() || `Ilha ${selectedIslandDay}`);
        setIsImportedExportSaveDialogOpen(true);
      }),
    [selectedIslandDay]
  );
  const handleStartNewProceduralFile = React.useCallback(() => {
    const folder = promptProceduralProjectFolder(devEditingPresetFolder || `Ilha ${selectedIslandDay}`);
    if (!folder) {
      setSceneConfigMessage("Criacao cancelada. Informe uma pasta para o projeto.");
      return;
    }
    const suggested = `Projeto 3D ${new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`.replace(",", "");
    const nameInput = window.prompt("Nome do novo arquivo 3D:", suggested);
    const name = String(nameInput || "").trim();
    if (!name) {
      setSceneConfigMessage("Criacao cancelada. Informe um nome para o projeto.");
      return;
    }
    setDevEditingPresetKey("");
    setDevEditingPresetName(name);
    setDevEditingPresetFolder(folder);
    setDevSelectedObject(null);
    setDevModelPrimitive("box");
    setDevModelTool("move");
    setDevModelWidth("1.8");
    setDevModelHeight("1.2");
    setDevModelDepth("1.4");
    setDevModelRadiusTop("0.7");
    setDevModelRadiusBottom("0.9");
    setDevModelWidthSegments("1");
    setDevModelHeightSegments("1");
    setDevModelDepthSegments("1");
    setDevModelRadialSegments("8");
    setDevModelSelectedSide("px");
    setDevModelSelectedTexture("");
    setDevModelSideTextures({});
    setDevModelSideTextureSettings({});
    setDevModelTextureDraft(normalizeTextureSettings({}));
    setDevModelDraftOffsets({});
    setDevModelDraftVertexColors({});
    setDevModelWeldVertices(true);
    setDevModelParts([]);
    setDevModelActivePartId("");
    setDevModelPartOffsetX("0");
    setDevModelPartOffsetY("0");
    setDevModelPartOffsetZ("0");
    setDevModelPartRotationX("0");
    setDevModelPartRotationY("0");
    setDevModelPartRotationZ("0");
    setDevModelPartScale("1");
    modelerHistoryRef.current = { key: "", entries: [], cursor: -1, suspend: false };
    setSceneConfigMessage(`Novo arquivo 3D iniciado: ${folder}/${name}`);
  }, [devEditingPresetFolder, promptProceduralProjectFolder, selectedIslandDay]);
  const handleModelerAdjustTopology = React.useCallback((direction) => {
    const bump = String(direction || "") === "down" ? -1 : 1;
    const nextSeg = (value, fallback, min, max) => {
      const n = Math.floor(Number(value));
      const safe = Number.isFinite(n) ? n : fallback;
      return Math.max(min, Math.min(max, safe + bump));
    };
    setDevModelWidthSegments((prev) => String(nextSeg(prev, 1, 1, 64)));
    setDevModelHeightSegments((prev) => String(nextSeg(prev, 1, 1, 64)));
    if (String(devModelPrimitive || "box") === "box") {
      setDevModelDepthSegments((prev) => String(nextSeg(prev, 1, 1, 64)));
    }
    if (String(devModelPrimitive || "box") === "cylinder") {
      setDevModelRadialSegments((prev) => String(nextSeg(prev, 8, 3, 64)));
    }
  }, [devModelPrimitive]);
  const handleUndoModelerAction = React.useCallback(async () => {
    const history = modelerHistoryRef.current;
    if (!history || !Array.isArray(history.entries) || history.entries.length < 2 || history.cursor <= 0) {
      setSceneConfigMessage("Nada para desfazer.");
      return;
    }
    history.cursor -= 1;
    const target = history.entries[history.cursor] || null;
    history.suspend = true;
    await applyModelerHistorySnapshot(target?.snapshot || target || {});
    history.suspend = false;
    syncModelerHistoryState();
    setSceneConfigMessage("Desfeito (modelador).");
  }, [applyModelerHistorySnapshot, syncModelerHistoryState]);
  const handleRedoModelerAction = React.useCallback(async () => {
    const history = modelerHistoryRef.current;
    if (!history || !Array.isArray(history.entries) || history.entries.length < 2 || history.cursor >= history.entries.length - 1) {
      setSceneConfigMessage("Nada para refazer.");
      return;
    }
    history.cursor += 1;
    const target = history.entries[history.cursor] || null;
    history.suspend = true;
    await applyModelerHistorySnapshot(target?.snapshot || target || {});
    history.suspend = false;
    syncModelerHistoryState();
    setSceneConfigMessage("Refeito (modelador).");
  }, [applyModelerHistorySnapshot, syncModelerHistoryState]);
  const handleJumpModelerHistory = React.useCallback(
    async (index) => {
      const history = modelerHistoryRef.current;
      if (!history || !Array.isArray(history.entries)) return;
      const safeIndex = Math.max(0, Math.min(history.entries.length - 1, Number(index)));
      if (!Number.isFinite(safeIndex) || safeIndex === history.cursor) return;
      history.cursor = safeIndex;
      history.suspend = true;
      await applyModelerHistorySnapshot(history.entries[safeIndex]?.snapshot || history.entries[safeIndex] || {});
      history.suspend = false;
      syncModelerHistoryState();
      setSceneConfigMessage(`Historico aplicado (${safeIndex + 1}/${history.entries.length}).`);
    },
    [applyModelerHistorySnapshot, syncModelerHistoryState]
  );

  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge" && isModelerOpen)) return undefined;
    const onKeyDown = (event) => {
      if (event.repeat) return;
      const isUndo = (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "z";
      const isRedoY = (event.ctrlKey || event.metaKey) && !event.shiftKey && String(event.key || "").toLowerCase() === "y";
      const isRedoShiftZ = (event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || "").toLowerCase() === "z";
      if (!isUndo && !isRedoY && !isRedoShiftZ) return;
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      event.preventDefault();
      if (isUndo) {
        handleUndoModelerAction();
        return;
      }
      handleRedoModelerAction();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRedoModelerAction, handleUndoModelerAction, isDevMode, isModelerOpen, screen]);
  const buildCurrentModelPartSnapshot = React.useCallback((overrides = {}) => {
    const toNum = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const toSeg = (value, fallback, min, max) => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const partName = String(overrides?.name || "").trim();
    const partId = String(overrides?.id || `part_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
    const sideTextureSettings = normalizeSideTextureSettings(devModelSideTextureSettings);
    const textureSettings = normalizeTextureSettings(
      sideTextureSettings?.[String(devModelSelectedSide || "").trim()] || devModelTextureDraft || {}
    );
    return {
      id: partId,
      name: partName || `Parte ${partId.slice(-4)}`,
      procedural_type: String(devModelPrimitive || "box"),
      weld_vertices: !!devModelWeldVertices,
      texture_url: String(devModelSelectedTexture || "").trim(),
      texture_settings: textureSettings,
      side_textures: { ...(devModelSideTextures || {}) },
      side_texture_settings: sideTextureSettings,
      width: toNum(devModelWidth, 1.8, 0.2, 20),
      height: toNum(devModelHeight, 1.2, 0.2, 20),
      depth: toNum(devModelDepth, 1.4, 0.2, 20),
      radius_top: toNum(devModelRadiusTop, 0.7, 0.05, 20),
      radius_bottom: toNum(devModelRadiusBottom, 0.9, 0.05, 20),
      width_segments: toSeg(devModelWidthSegments, 1, 1, 64),
      height_segments: toSeg(devModelHeightSegments, 1, 1, 64),
      depth_segments: toSeg(devModelDepthSegments, 1, 1, 64),
      radial_segments: toSeg(devModelRadialSegments, 8, 3, 64),
      procedural_vertex_offsets: normalizeOffsetsForUndo(devModelDraftOffsets),
      procedural_vertex_colors: normalizeVertexColorsForUndo(devModelDraftVertexColors),
      poly_count_estimate: Number(devModelPolygonEstimate || 0),
      offset_x: toNum(devModelPartOffsetX, 0, -100, 100),
      offset_y: toNum(devModelPartOffsetY, 0, -100, 100),
      offset_z: toNum(devModelPartOffsetZ, 0, -100, 100),
      rotation_x: toNum(devModelPartRotationX, 0, -360, 360),
      rotation_y: toNum(devModelPartRotationY, 0, -360, 360),
      rotation_z: toNum(devModelPartRotationZ, 0, -360, 360),
      scale: toNum(devModelPartScale, 1, 0.05, 30),
    };
  }, [
    devModelDepth,
    devModelDepthSegments,
    devModelDraftOffsets,
    devModelDraftVertexColors,
    devModelHeight,
    devModelHeightSegments,
    devModelPartOffsetX,
    devModelPartOffsetY,
    devModelPartOffsetZ,
    devModelPartRotationX,
    devModelPartRotationY,
    devModelPartRotationZ,
    devModelPartScale,
    devModelPolygonEstimate,
    devModelPrimitive,
    devModelRadialSegments,
    devModelRadiusBottom,
    devModelRadiusTop,
    devModelSelectedTexture,
    devModelSelectedSide,
    devModelSideTextureSettings,
    devModelTextureDraft,
    devModelSideTextures,
    devModelWeldVertices,
    devModelWidth,
    devModelWidthSegments,
  ]);
  const applyModelPartSnapshot = React.useCallback((part) => {
    if (!part || typeof part !== "object") return;
    setDevModelPrimitive(String(part?.procedural_type || "box"));
    setDevModelSelectedTexture(String(part?.texture_url || ""));
    setDevModelSideTextures(part?.side_textures && typeof part.side_textures === "object" ? { ...part.side_textures } : {});
    setDevModelSideTextureSettings(normalizeSideTextureSettings(part?.side_texture_settings));
    setDevModelTextureDraft(normalizeTextureSettings(part?.texture_settings));
    setDevModelWidth(String(Number(part?.width ?? 1.8)));
    setDevModelHeight(String(Number(part?.height ?? 1.2)));
    setDevModelDepth(String(Number(part?.depth ?? 1.4)));
    setDevModelRadiusTop(String(Number(part?.radius_top ?? 0.7)));
    setDevModelRadiusBottom(String(Number(part?.radius_bottom ?? 0.9)));
    setDevModelWidthSegments(String(Math.max(1, Math.floor(Number(part?.width_segments ?? 1)))));
    setDevModelHeightSegments(String(Math.max(1, Math.floor(Number(part?.height_segments ?? 1)))));
    setDevModelDepthSegments(String(Math.max(1, Math.floor(Number(part?.depth_segments ?? 1)))));
    setDevModelRadialSegments(String(Math.max(3, Math.floor(Number(part?.radial_segments ?? 8)))));
    setDevModelWeldVertices(!!part?.weld_vertices);
    setDevModelDraftOffsets(normalizeOffsetsForUndo(part?.procedural_vertex_offsets));
    setDevModelDraftVertexColors(normalizeVertexColorsForUndo(part?.procedural_vertex_colors));
    setDevModelPartOffsetX(String(Number(part?.offset_x ?? 0)));
    setDevModelPartOffsetY(String(Number(part?.offset_y ?? 0)));
    setDevModelPartOffsetZ(String(Number(part?.offset_z ?? 0)));
    setDevModelPartRotationX(String(Number(part?.rotation_x ?? 0)));
    setDevModelPartRotationY(String(Number(part?.rotation_y ?? 0)));
    setDevModelPartRotationZ(String(Number(part?.rotation_z ?? 0)));
    setDevModelPartScale(String(Number(part?.scale ?? 1)));
  }, []);
  const buildResolvedModelParts = React.useCallback(() => {
    const currentId = String(devModelActivePartId || "").trim();
    const currentName = (() => {
      if (!currentId) return "";
      const found = (Array.isArray(devModelParts) ? devModelParts : []).find((item) => String(item?.id || "") === currentId);
      return String(found?.name || "").trim();
    })();
    const currentPart = buildCurrentModelPartSnapshot({
      id: currentId || "part_current",
      name: currentName || "",
    });
    const list = Array.isArray(devModelParts) ? devModelParts : [];
    if (!currentId) return [currentPart];
    const hasCurrent = list.some((item) => String(item?.id || "") === currentId);
    if (!hasCurrent) return [...list, currentPart];
    return list.map((item) => (String(item?.id || "") === currentId ? { ...item, ...currentPart } : item));
  }, [buildCurrentModelPartSnapshot, devModelActivePartId, devModelParts]);
  const handleAddCurrentPartToFile = React.useCallback(() => {
    const id = `part_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nameInput = window.prompt("Nome da nova parte:", `Parte ${((Array.isArray(devModelParts) ? devModelParts.length : 0) + 1)}`);
    const part = buildCurrentModelPartSnapshot({
      id,
      name: String(nameInput || "").trim() || `Parte ${id.slice(-4)}`,
    });
    setDevModelParts((prev) => [...(Array.isArray(prev) ? prev : []), part]);
    setDevModelActivePartId(id);
    setSceneConfigMessage(`Parte adicionada ao arquivo: ${part.name}`);
  }, [buildCurrentModelPartSnapshot, devModelParts]);
  const handleSelectModelPart = React.useCallback((partId) => {
    const targetId = String(partId || "");
    if (!targetId) return;
    const merged = buildResolvedModelParts();
    const target = merged.find((item) => String(item?.id || "") === targetId);
    if (!target) return;
    setDevModelParts(merged);
    setDevModelActivePartId(targetId);
    applyModelPartSnapshot(target);
    setSceneConfigMessage(`Editando parte: ${String(target?.name || targetId)}`);
  }, [applyModelPartSnapshot, buildResolvedModelParts]);
  const handleRemoveActiveModelPart = React.useCallback(() => {
    const activeId = String(devModelActivePartId || "");
    if (!activeId) return;
    const merged = buildResolvedModelParts();
    const next = merged.filter((item) => String(item?.id || "") !== activeId);
    if (!next.length) {
      setDevModelParts([]);
      setDevModelActivePartId("");
      setSceneConfigMessage("Parte removida. Arquivo sem partes salvas.");
      return;
    }
    const fallback = next[0];
    setDevModelParts(next);
    setDevModelActivePartId(String(fallback?.id || ""));
    applyModelPartSnapshot(fallback);
    setSceneConfigMessage(`Parte removida. Agora editando: ${String(fallback?.name || "")}`);
  }, [applyModelPartSnapshot, buildResolvedModelParts, devModelActivePartId]);
  const handleAddProceduralObject = React.useCallback(async () => {
    const parts = buildResolvedModelParts();
    if (!parts.length) {
      setSceneConfigMessage("Adicione ao menos uma parte antes de inserir no mapa.");
      return;
    }
    const source = getVisibleSpawnPoint();
    const baseX = Number(source.x);
    const baseY = Number(source.y);
    const baseZ = Number(source.z);
    const groupId = `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nextItems = parts.map((part, idx) => {
      const key = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`;
      const x = baseX + Number(part?.offset_x || 0);
      const y = baseY + Number(part?.offset_y || 0);
      const z = baseZ + Number(part?.offset_z || 0);
      return {
        key,
        label: `${String(devEditingPresetName || "3D")} - ${String(part?.name || `Parte ${idx + 1}`)}`,
        group_id: groupId,
        part_id: String(part?.id || `part_${idx + 1}`),
        kind: "procedural",
        media_type: "procedural",
        procedural_type: String(part?.procedural_type || "box"),
        weld_vertices: !!part?.weld_vertices,
        texture_url: String(part?.texture_url || "").trim(),
        texture_settings: normalizeTextureSettings(part?.texture_settings),
        side_textures: part?.side_textures && typeof part.side_textures === "object" ? { ...part.side_textures } : {},
        side_texture_settings: normalizeSideTextureSettings(part?.side_texture_settings),
        width: Number(part?.width || 1.8),
        height: Number(part?.height || 1.2),
        depth: Number(part?.depth || 1.4),
        radius_top: Number(part?.radius_top || 0.7),
        radius_bottom: Number(part?.radius_bottom || 0.9),
        width_segments: Math.max(1, Math.floor(Number(part?.width_segments || 1))),
        height_segments: Math.max(1, Math.floor(Number(part?.height_segments || 1))),
        depth_segments: Math.max(1, Math.floor(Number(part?.depth_segments || 1))),
        radial_segments: Math.max(3, Math.floor(Number(part?.radial_segments || 8))),
        poly_count_estimate: Number(part?.poly_count_estimate || estimateProceduralPolyCountFromConfig(part)),
        procedural_vertex_offsets: normalizeOffsetsForUndo(part?.procedural_vertex_offsets),
        procedural_vertex_colors: normalizeVertexColorsForUndo(part?.procedural_vertex_colors),
        x,
        y,
        y_mode: "relative_ground",
        z,
        scale: Math.max(0.2, Number(part?.scale || 1)),
        rotation_x: Number.isFinite(Number(part?.rotation_x)) ? Number(part.rotation_x) : 0,
        rotation_y: Number.isFinite(Number(part?.rotation_y)) ? Number(part.rotation_y) : 0,
        rotation_z: Number.isFinite(Number(part?.rotation_z)) ? Number(part.rotation_z) : 0,
        block_id: getSceneBlockId(x, z),
      };
    });
    const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    await patchSceneConfig({ custom_objects: [...currentList, ...nextItems] });
    setDevDraftOverrides({});
    const first = nextItems[0];
    const fx = Number(first?.x || baseX);
    const fy = Number(first?.y || baseY);
    const fz = Number(first?.z || baseZ);
    setDevSelectedObject({
      key: String(first?.key || ""),
      type: "custom",
      kind: "procedural",
      label: String(first?.label || "Objeto 3D"),
      media_type: "procedural",
      procedural_type: String(first?.procedural_type || "box"),
      scenePosition: { x: fx, y: fy, z: fz },
      worldPosition: { x: fx, y: fy, z: fz },
      blockId: getSceneBlockId(fx, fz),
    });
    setDevPositionDraft({
      x: fx.toFixed(3),
      y: fy.toFixed(3),
      z: fz.toFixed(3),
    });
    setSceneConfigMessage(
      nextItems.length > 1
        ? `Arquivo 3D com ${nextItems.length} partes adicionado no mapa.`
        : "Objeto 3D low-poly adicionado no mapa."
    );
  }, [
    buildResolvedModelParts,
    devEditingPresetName,
    devEditingPresetKey,
    patchSceneConfig,
  ]);
  const handleSaveProceduralPresetToGallery = React.useCallback(async (options = {}) => {
    if (options?.mode === "imported") {
      const importError = options?.error;
      const importedAnimationStudio = options?.animationStudioData && typeof options.animationStudioData === "object"
        ? options.animationStudioData
        : null;
      if (importError) {
        setSceneConfigMessage(`Falha ao gerar arquivo 3D importado: ${String(importError?.message || importError)}`);
        return false;
      }
      const file = options?.file;
      if (!(file instanceof File)) {
        setSceneConfigMessage("Falha ao gerar arquivo 3D importado.");
        return false;
      }
      try {
        const defaultName = String(options?.fileName || file.name || devUploadFileName || "modelo_editado.glb").trim();
        const defaultFolder = String(devEditingPresetFolder || `Ilha ${selectedIslandDay}`).trim() || `Ilha ${selectedIslandDay}`;
        const pickedTarget = await requestImportedExportTarget(defaultName, defaultFolder);
        if (!pickedTarget) {
          setSceneConfigMessage("Salvamento do arquivo 3D cancelado.");
          return false;
        }
        const pickedFolder = String(pickedTarget?.folder || "").trim();
        const pickedNameRaw = String(pickedTarget?.name || "").trim();
        if (!pickedFolder) {
          setSceneConfigMessage("Informe a pasta do arquivo 3D.");
          return false;
        }
        if (!pickedNameRaw) {
          setSceneConfigMessage("Informe o nome do arquivo 3D.");
          return false;
        }
        const sanitizeFolderSegment = (value) => {
          const cleaned = Array.from(String(value || "").trim())
            .filter((char) => {
              const code = char.charCodeAt(0);
              return code >= 32 && !`<>:"|?*`.includes(char);
            })
            .join("");
          return cleaned
            .replace(/\\/g, "/")
            .replace(/\/+/g, "/")
            .replace(/^\/+|\/+$/g, "");
        };
        const sanitizedFolder = sanitizeFolderSegment(pickedFolder);
        const normalizedName = pickedNameRaw.toLowerCase().endsWith(".glb") ? pickedNameRaw : `${pickedNameRaw}.glb`;
        const islandFolder = sanitizedFolder
          ? `islands/day-${selectedIslandDay}/generated-models/${sanitizedFolder}`
          : `islands/day-${selectedIslandDay}/generated-models`;
        const uploadedUrl = await uploadSceneAsset(file, {
          folder: islandFolder,
          filename: normalizedName,
        });
        if (!uploadedUrl) throw new Error("upload_failed");
        registerUploadedAsset({
          url: uploadedUrl,
          type: "model3d",
          name: normalizedName,
          sceneKind: "elements",
        });
        setDevUploadFileName(normalizedName);
        setDevEditingPresetName(normalizedName.replace(/\.glb$/i, ""));
        setDevEditingPresetFolder(pickedFolder);
        setDevModelImported3dUrl(String(uploadedUrl));
        setDevModelImported3dName(normalizedName);
        const selectedKey = String(devSelectedObject?.key || "");
        if (selectedKey.startsWith("custom_")) {
          const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
          const nextList = list.map((item) =>
            String(item?.key || "") === selectedKey
              ? {
                  ...item,
                  model_url: String(uploadedUrl),
                  media_type: "model3d",
                  kind: "model",
                  texture_url: "",
                  texture_settings: normalizeTextureSettings({}),
                  imported_texture_projection: "front",
                  side_textures: {},
                  side_texture_settings: {},
                  animation_studio: importedAnimationStudio,
                }
              : item
          );
          await patchSceneConfig({ custom_objects: nextList });
          setDevSelectedObject((prev) =>
            prev?.key === selectedKey
              ? {
                  ...prev,
                  model_url: String(uploadedUrl),
                  media_type: "model3d",
                  kind: "model",
                  texture_url: "",
                  texture_settings: normalizeTextureSettings({}),
                  imported_texture_projection: "front",
                  side_textures: {},
                  side_texture_settings: {},
                  animation_studio: importedAnimationStudio,
                }
              : prev
          );
          setDevDraftOverrides((prev) => ({
            ...(prev || {}),
            [selectedKey]: {
              ...((prev && prev[selectedKey]) || {}),
              model_url: String(uploadedUrl),
              media_type: "model3d",
              kind: "model",
              texture_url: "",
              texture_settings: normalizeTextureSettings({}),
              imported_texture_projection: "front",
              side_textures: {},
              side_texture_settings: {},
              animation_studio: importedAnimationStudio,
            },
          }));
        }
        setDevImportedTextureOverride("");
        setDevImportedFrontTexture("");
        setDevImportedSideTexture("");
        setDevImportedBackTexture("");
        setDevImportedFrontTextureSettings(normalizeTextureSettings({}));
        setDevImportedSideTextureSettings(normalizeTextureSettings({}));
        setDevImportedBackTextureSettings(normalizeTextureSettings({}));
        setDevImportedAppliedTextureSlot("front");
        setDevShowImportedTexture(false);
        setSceneConfigMessage(`Arquivo 3D gerado, salvo e enviado para a galeria: ${normalizedName}`);
        return true;
      } catch (error) {
        const status = Number(error?.status);
        if (status === 401) setSceneConfigMessage("Sessao expirada (401). Faca login novamente.");
        else setSceneConfigMessage("Falha ao salvar arquivo 3D importado.");
        return false;
      }
    }
    const silent = !!options?.silent;
    const isAutosave = !!options?.autosave;
    const toNum = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const toSeg = (value, fallback, min, max) => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const currentPresetName = String(devEditingPresetName || "").trim();
    let name = currentPresetName;
    if (!name) {
      if (isAutosave) return;
      const nameInput = window.prompt("Nome do objeto 3D salvo na galeria:", `Objeto 3D ${Date.now().toString().slice(-4)}`);
      name = String(nameInput || "").trim();
      if (!name) return;
    }
    let folder = String(devEditingPresetFolder || "").trim();
    if (!folder) {
      if (isAutosave) folder = `Ilha ${selectedIslandDay}`;
      else {
        const picked = promptProceduralProjectFolder(`Ilha ${selectedIslandDay}`);
        folder = String(picked || "").trim();
        if (!folder) return;
      }
    }
    const primitive = String(devModelPrimitive || "box");
    const presetKey = String(devEditingPresetKey || "").trim() || `preset_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const sideTextureSettings = normalizeSideTextureSettings(devModelSideTextureSettings);
    const textureSettings = normalizeTextureSettings(
      sideTextureSettings?.[String(devModelSelectedSide || "").trim()] || devModelTextureDraft || {}
    );
    const resolvedParts = buildResolvedModelParts();
    const selectedKey = String(devSelectedObject?.key || "");
    const selectedOverride = selectedKey ? getMergedOverride(selectedKey) : {};
    const preset = {
      key: presetKey,
      name,
      folder,
      procedural_type: primitive,
      weld_vertices: !!devModelWeldVertices,
      texture_url: String(devModelSelectedTexture || "").trim(),
      texture_settings: textureSettings,
      side_textures: { ...(devModelSideTextures || {}) },
      side_texture_settings: sideTextureSettings,
      width: toNum(devModelWidth, 1.8, 0.2, 20),
      height: toNum(devModelHeight, 1.2, 0.2, 20),
      depth: toNum(devModelDepth, 1.4, 0.2, 20),
      radius_top: toNum(devModelRadiusTop, 0.7, 0.05, 20),
      radius_bottom: toNum(devModelRadiusBottom, 0.9, 0.05, 20),
      width_segments: toSeg(devModelWidthSegments, 1, 1, 64),
      height_segments: toSeg(devModelHeightSegments, 1, 1, 64),
      depth_segments: toSeg(devModelDepthSegments, 1, 1, 64),
      radial_segments: toSeg(devModelRadialSegments, 8, 3, 64),
      procedural_vertex_offsets: normalizeOffsetsForUndo(devModelDraftOffsets),
      procedural_vertex_colors: normalizeVertexColorsForUndo(devModelDraftVertexColors),
      poly_count_estimate: Number(devModelPolygonEstimate || 0),
      rotation_x:
        Number.isFinite(Number(selectedOverride?.rotation_x))
          ? Number(selectedOverride?.rotation_x)
          : 0,
      rotation_y:
        Number.isFinite(Number(selectedOverride?.rotation_y))
          ? Number(selectedOverride?.rotation_y)
          : 0,
      rotation_z:
        Number.isFinite(Number(selectedOverride?.rotation_z))
          ? Number(selectedOverride?.rotation_z)
          : 0,
      scale:
        Number.isFinite(Number(selectedOverride?.scale))
          ? Math.max(0.2, Number(selectedOverride?.scale))
          : 1,
      scale_x:
        Number.isFinite(Number(selectedOverride?.scale_x))
          ? Math.max(0.2, Number(selectedOverride?.scale_x))
          : 1,
      scale_y:
        Number.isFinite(Number(selectedOverride?.scale_y))
          ? Math.max(0.2, Number(selectedOverride?.scale_y))
          : 1,
      scale_z:
        Number.isFinite(Number(selectedOverride?.scale_z))
          ? Math.max(0.2, Number(selectedOverride?.scale_z))
          : 1,
      parts: resolvedParts.map((part) => ({
        ...part,
        side_textures: part?.side_textures && typeof part.side_textures === "object" ? { ...part.side_textures } : {},
        side_texture_settings: normalizeSideTextureSettings(part?.side_texture_settings),
        texture_settings: normalizeTextureSettings(part?.texture_settings),
        procedural_vertex_offsets: normalizeOffsetsForUndo(part?.procedural_vertex_offsets),
        procedural_vertex_colors: normalizeVertexColorsForUndo(part?.procedural_vertex_colors),
      })),
    };
    const current = Array.isArray(sceneConfigRef.current?.procedural_presets) ? sceneConfigRef.current.procedural_presets : [];
    const exists = current.some((item) => String(item?.key || "") === presetKey);
    const nextPresets = exists
      ? current.map((item) => (String(item?.key || "") === presetKey ? preset : item))
      : [preset, ...current].slice(0, 200);
    await patchSceneConfig({ procedural_presets: nextPresets });
    setDevEditingPresetKey(presetKey);
    setDevEditingPresetName(name);
    setDevEditingPresetFolder(folder);
    if (!silent) {
      setSceneConfigMessage(
        exists ? `Arquivo 3D atualizado: ${folder}/${name}` : `Arquivo 3D salvo na galeria: ${folder}/${name}`
      );
      setIsElementGalleryOpen(true);
      setDevGalleryTab("elements");
    } else {
      setSceneConfigMessage(`Auto-save concluido: ${folder}/${name}`);
    }
  }, [
    devEditingPresetKey,
    devEditingPresetFolder,
    devEditingPresetName,
    devImportedAppliedTextureSlot,
    devImportedBackTexture,
    devImportedBackTextureSettings,
    devImportedFrontTexture,
    devImportedFrontTextureSettings,
    devImportedSideTexture,
    devImportedSideTextureSettings,
    devImportedTextureOverride,
    devUploadFileName,
    devModelDepth,
    devModelDepthSegments,
    devModelDraftOffsets,
    devModelDraftVertexColors,
    devModelHeight,
    devModelHeightSegments,
    devModelPolygonEstimate,
    devModelPrimitive,
    devModelRadialSegments,
    devModelRadiusBottom,
    devModelRadiusTop,
    devModelSelectedTexture,
    devModelSelectedSide,
    devModelSideTextureSettings,
    devModelTextureDraft,
    devModelSideTextures,
    devModelWidth,
    devModelWidthSegments,
    devModelWeldVertices,
    buildResolvedModelParts,
    devSelectedObject?.key,
    getMergedOverride,
    registerUploadedAsset,
    patchSceneConfig,
    promptProceduralProjectFolder,
    requestImportedExportTarget,
    selectedIslandDay,
  ]);
  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge" && isModelerOpen)) return undefined;
    const secondsRaw = Math.floor(Number(devModelAutosaveSeconds));
    const seconds = Number.isFinite(secondsRaw) ? Math.max(10, Math.min(3600, secondsRaw)) : 60;
    const runAutosave = async () => {
      if (modelerAutosaveBusyRef.current) return;
      if (!String(devEditingPresetName || "").trim()) return;
      modelerAutosaveBusyRef.current = true;
      try {
        await handleSaveProceduralPresetToGallery({ silent: true, autosave: true });
      } finally {
        modelerAutosaveBusyRef.current = false;
      }
    };
    const timer = window.setInterval(runAutosave, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [
    devEditingPresetName,
    devModelAutosaveSeconds,
    handleSaveProceduralPresetToGallery,
    isDevMode,
    isModelerOpen,
    screen,
  ]);
  const handleEditProceduralPresetFromGallery = React.useCallback((asset) => {
    const preset = asset?.proceduralPreset;
    if (!preset || typeof preset !== "object") return;
    const rawParts = Array.isArray(preset?.parts) ? preset.parts.filter((part) => part && typeof part === "object") : [];
    const legacyPart =
      !rawParts.length
        ? {
            id: `part_${String(preset?.key || "legacy")}_0`,
            name: String(preset?.name || "Parte 1"),
            procedural_type: String(preset?.procedural_type || "box"),
            weld_vertices: !!preset?.weld_vertices,
            texture_url: String(preset?.texture_url || ""),
            texture_settings: normalizeTextureSettings(preset?.texture_settings),
            side_textures: preset?.side_textures && typeof preset.side_textures === "object" ? { ...preset.side_textures } : {},
            side_texture_settings: normalizeSideTextureSettings(preset?.side_texture_settings),
            width: Number(preset?.width ?? 1.8),
            height: Number(preset?.height ?? 1.2),
            depth: Number(preset?.depth ?? 1.4),
            radius_top: Number(preset?.radius_top ?? 0.7),
            radius_bottom: Number(preset?.radius_bottom ?? 0.9),
            width_segments: Math.max(1, Math.floor(Number(preset?.width_segments ?? 1))),
            height_segments: Math.max(1, Math.floor(Number(preset?.height_segments ?? 1))),
            depth_segments: Math.max(1, Math.floor(Number(preset?.depth_segments ?? 1))),
            radial_segments: Math.max(3, Math.floor(Number(preset?.radial_segments ?? 8))),
            procedural_vertex_offsets: normalizeOffsetsForUndo(preset?.procedural_vertex_offsets),
            procedural_vertex_colors: normalizeVertexColorsForUndo(preset?.procedural_vertex_colors),
            poly_count_estimate: Number(preset?.poly_count_estimate || estimateProceduralPolyCountFromConfig(preset)),
            offset_x: 0,
            offset_y: 0,
            offset_z: 0,
            rotation_x: Number(preset?.rotation_x || 0),
            rotation_y: Number(preset?.rotation_y || 0),
            rotation_z: Number(preset?.rotation_z || 0),
            scale: Number(preset?.scale || 1),
          }
        : null;
    const normalizedParts = (rawParts.length ? rawParts : [legacyPart]).map((part, idx) => ({
      ...part,
      id: String(part?.id || `part_${idx + 1}`),
      name: String(part?.name || `Parte ${idx + 1}`),
      side_textures: part?.side_textures && typeof part.side_textures === "object" ? { ...part.side_textures } : {},
      side_texture_settings: normalizeSideTextureSettings(part?.side_texture_settings),
      texture_settings: normalizeTextureSettings(part?.texture_settings),
      procedural_vertex_offsets: normalizeOffsetsForUndo(part?.procedural_vertex_offsets),
      procedural_vertex_colors: normalizeVertexColorsForUndo(part?.procedural_vertex_colors),
    }));
    const firstPart = normalizedParts[0] || null;
    setDevEditingPresetKey(String(preset?.key || ""));
    setDevEditingPresetName(String(preset?.name || ""));
    setDevEditingPresetFolder(String(preset?.folder || ""));
    setDevModelParts(normalizedParts);
    setDevModelActivePartId(String(firstPart?.id || ""));
    applyModelPartSnapshot(firstPart || {});
    modelerHistoryRef.current = { key: "", entries: [], cursor: -1, suspend: false };
    setIsElementGalleryOpen(false);
    setIsModelerOpen(true);
    setIsModelerExpanded(true);
    const folder = String(preset?.folder || "").trim();
    setSceneConfigMessage(`Editando arquivo 3D: ${folder ? `${folder}/` : ""}${String(preset?.name || "preset")}`);
  }, [applyModelPartSnapshot]);

  const handleApplyTextureToSelectedProceduralSide = React.useCallback(async () => {
    const key = String(devSelectedObject?.key || "");
    if (!key.startsWith("custom_")) return;
    const selectedSide = String(devModelSelectedSide || "").trim();
    const selectedTexture = String(devModelSelectedTexture || "").trim();
    if (!selectedSide || !selectedTexture) {
      setSceneConfigMessage("Selecione lado e textura para aplicar.");
      return;
    }
    const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
    const target = list.find((item) => String(item?.key || "") === key);
    if (!target) return;
    const isProcedural = String(target?.media_type || "") === "procedural" || String(target?.procedural_type || "").trim();
    if (!isProcedural) {
      setSceneConfigMessage("O item selecionado nao e um objeto procedural 3D.");
      return;
    }
    const selectedTextureSettings = normalizeTextureSettings(devModelTextureDraft);
    const nextList = list.map((item) => {
      if (String(item?.key || "") !== key) return item;
      const nextSides = {
        ...((item?.side_textures && typeof item.side_textures === "object") ? item.side_textures : {}),
        [selectedSide]: selectedTexture,
      };
      const nextSideSettings = {
        ...normalizeSideTextureSettings(item?.side_texture_settings),
        [selectedSide]: selectedTextureSettings,
      };
      return {
        ...item,
        texture_url: String(item?.texture_url || selectedTexture),
        texture_settings: normalizeTextureSettings(item?.texture_settings || selectedTextureSettings),
        side_textures: nextSides,
        side_texture_settings: nextSideSettings,
      };
    });
    await patchSceneConfig({ custom_objects: nextList });
    setSceneConfigMessage(`Textura aplicada no lado ${selectedSide}.`);
  }, [devModelSelectedSide, devModelSelectedTexture, devModelTextureDraft, devSelectedObject?.key, patchSceneConfig]);

  const handleAssetUpload = React.useCallback(
    async (kind, event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      setSceneConfigMessage("");
      try {
        const islandFolder = `islands/day-${selectedIslandDay}`;
        const customName = String(devUploadFileName || "").trim();
        const url = await uploadSceneAsset(file, {
          folder: islandFolder,
          filename: customName || file.name,
        });
        if (!url) throw new Error("upload_failed");
        const fileType = detectAssetTypeFromName(file.name);
        if (kind === "horizon") {
          setSceneConfig((prev) => ({
            ...(prev || createDefaultSceneConfig(selectedIslandDay)),
            island_day: selectedIslandDay,
            horizon_texture_url: url,
          }));
          await patchSceneConfig({ horizon_texture_url: url });
        } else if (kind === "road") {
          setSceneConfig((prev) => ({
            ...(prev || createDefaultSceneConfig(selectedIslandDay)),
            island_day: selectedIslandDay,
            road_texture_url: url,
          }));
          await patchSceneConfig({
            road_texture_url: url,
            object_overrides: {
              road_base: {
                ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
                hidden: false,
              },
            },
          });
        } else if (kind === "element") {
          setDevAddTextureUrl(url);
          registerUploadedAsset({
            url,
            type: fileType,
            name: file.name,
            sceneKind: "elements",
          });
          setSceneConfigMessage(`Arquivo ${file.name} enviado. Agora clique em adicionar elemento.`);
        } else if (kind === "gallery_asset") {
          const sceneKind =
            devGalleryTab === "horizon"
              ? "horizon"
              : devGalleryTab === "road"
                ? "road"
                : devGalleryTab === "eliminatory"
                  ? "eliminatory"
                  : "elements";
          registerUploadedAsset({
            url,
            type: fileType,
            name: file.name,
            sceneKind,
          });
          setDevAddTextureUrl(url);
          if (devGalleryTab === "horizon") {
            setSceneConfig((prev) => ({
              ...(prev || createDefaultSceneConfig(selectedIslandDay)),
              island_day: selectedIslandDay,
              horizon_texture_url: url,
            }));
            await patchSceneConfig({ horizon_texture_url: url });
            setSceneConfigMessage(`Horizonte atualizado: ${file.name}`);
          } else if (devGalleryTab === "road") {
            setSceneConfig((prev) => ({
              ...(prev || createDefaultSceneConfig(selectedIslandDay)),
              island_day: selectedIslandDay,
              road_texture_url: url,
            }));
            await patchSceneConfig({
              road_texture_url: url,
              object_overrides: {
                road_base: {
                  ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
                  hidden: false,
                },
              },
            });
            setSceneConfigMessage(`Estrada atualizada: ${file.name}`);
          } else {
            setSceneConfigMessage(`Arquivo ${file.name} adicionado na galeria.`);
          }
        } else if (kind === "selected_texture") {
          const key = String(devSelectedObject?.key || "");
          if (!key) throw new Error("missing_selected_key");
          const nextTextureUrl = fileType === "model3d" ? "" : url;
          const nextModelUrl = fileType === "model3d" ? url : "";
          setDevSelectedObject((prev) =>
            prev?.key === key
              ? {
                  ...prev,
                  texture_url: nextTextureUrl,
                  model_url: nextModelUrl,
                  media_type: fileType,
                }
              : prev
          );
          setDevDraftOverrides((prev) => ({
            ...(prev || {}),
            [key]: {
              ...((prev && prev[key]) || {}),
              texture_url: nextTextureUrl,
              model_url: nextModelUrl,
              media_type: fileType,
            },
          }));
          if (key.startsWith("custom_")) {
            const list = Array.isArray(sceneConfigRef.current?.custom_objects)
              ? sceneConfigRef.current.custom_objects
              : [];
            const nextList = list.map((item) =>
              String(item?.key || "") === key
                ? {
                    ...item,
                    texture_url: nextTextureUrl,
                    model_url: nextModelUrl,
                    media_type: fileType,
                  }
                : item
            );
            await patchSceneConfig({ custom_objects: nextList });
          } else {
            const currentOverride = sceneConfigRef.current?.object_overrides?.[key] || {};
            await patchSceneConfig({
              object_overrides: {
                [key]: {
                  ...currentOverride,
                  texture_url: nextTextureUrl,
                  model_url: nextModelUrl,
                },
              },
            });
          }
          setSceneConfigMessage(`Textura atualizada: ${file.name}`);
        }
      } catch (error) {
        const status = Number(error?.status);
        if (status === 401) {
          setSceneConfigMessage("Sessao expirada (401). Faca login novamente para continuar os uploads.");
        } else {
          setSceneConfigMessage("Upload falhou. Tente novamente.");
        }
      } finally {
        setDevUploadFileName("");
        if (event?.target) event.target.value = "";
      }
    },
    [devGalleryTab, devSelectedObject, devUploadFileName, patchSceneConfig, registerUploadedAsset, selectedIslandDay]
  );

  const handleModelerTextureUpload = React.useCallback(
    async (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      try {
        const islandFolder = `islands/day-${selectedIslandDay}`;
        const customName = String(devUploadFileName || "").trim();
        const url = await uploadSceneAsset(file, {
          folder: islandFolder,
          filename: customName || file.name,
        });
        if (!url) throw new Error("upload_failed");
        registerUploadedAsset({
          url,
          type: "image",
          name: file.name,
          sceneKind: "elements",
        });
        if (devModelViewportMode === "imported") {
          const next = String(url || "");
          if (devImportedTextureSlot === "side") setDevImportedSideTexture(next);
          else if (devImportedTextureSlot === "back") setDevImportedBackTexture(next);
          else setDevImportedFrontTexture(next);
        } else setDevModelSelectedTexture(url);
        setSceneConfigMessage(`Textura enviada para a galeria: ${file.name}`);
      } catch (error) {
        const status = Number(error?.status);
        if (status === 401) setSceneConfigMessage("Sessao expirada (401). Faca login novamente.");
        else setSceneConfigMessage("Falha no upload da textura.");
      } finally {
        setDevUploadFileName("");
        if (event?.target) event.target.value = "";
      }
    },
    [devImportedTextureSlot, devModelViewportMode, devUploadFileName, registerUploadedAsset, selectedIslandDay]
  );
  const handleModelerImport3dUpload = React.useCallback(
    async (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      try {
        setDevImportedMeshStats(null);
        importedAutoWeldSignatureRef.current = "";
        const fileType = detectAssetTypeFromName(file.name);
        if (fileType !== "model3d") {
          setSceneConfigMessage("Formato invalido. Use .glb, .gltf, .fbx, .obj ou .stl.");
          return;
        }
        const islandFolder = `islands/day-${selectedIslandDay}`;
        const customName = String(devUploadFileName || "").trim();
        const url = await uploadSceneAsset(file, {
          folder: islandFolder,
          filename: customName || file.name,
        });
        if (!url) throw new Error("upload_failed");
        registerUploadedAsset({
          url,
          type: "model3d",
          name: file.name,
          sceneKind: "elements",
        });
        setDevModelImported3dUrl(String(url || ""));
        setDevModelImported3dName(String(file.name || getAssetFileName(url)));
        setDevModelViewportMode("imported");
        setDevImportedWeldVertices(false);
        setDevImportedAutoMaskTopology(true);
        setDevImportedWeldEpsilon("auto");
        setDevImportedSmoothShading(true);
        setDevImportedAutoSmooth(true);
        setDevImportedAutoSmoothAngle("180");
        setDevImportedDraftOffsets({});
        setDevImportedDraftVertexColors({});
        setDevShowImportedTexture(false);
        setDevImportedTextureSlot("front");
        setDevImportedAppliedTextureSlot("front");
        setDevImportedFrontTexture("");
        setDevImportedSideTexture("");
        setDevImportedBackTexture("");
        setDevImportedFrontTextureSettings(normalizeTextureSettings({}));
        setDevImportedSideTextureSettings(normalizeTextureSettings({}));
        setDevImportedBackTextureSettings(normalizeTextureSettings({}));
        setDevImportedTextureOverride("");
        setDevModelImportedPreviewError("");
        setSceneConfigMessage("Modelo 3D importado no Modelador. Clique em 'Adicionar modelo importado no mapa' quando quiser.");
      } catch (error) {
        const status = Number(error?.status);
        if (status === 401) setSceneConfigMessage("Sessao expirada (401). Faca login novamente.");
        else setSceneConfigMessage("Falha ao importar modelo 3D.");
      } finally {
        setDevUploadFileName("");
        if (event?.target) event.target.value = "";
      }
    },
    [devUploadFileName, registerUploadedAsset, selectedIslandDay]
  );
  const handleAddImportedModelToMap = React.useCallback(async () => {
    const url = String(devModelImported3dUrl || "").trim();
    if (!url) {
      setSceneConfigMessage("Importe um arquivo 3D primeiro.");
      return;
    }
    const resolvedAppliedTextureSettings =
      devImportedAppliedTextureSlot === "side"
        ? normalizeTextureSettings(devImportedSideTextureSettings)
        : devImportedAppliedTextureSlot === "back"
          ? normalizeTextureSettings(devImportedBackTextureSettings)
          : normalizeTextureSettings(devImportedFrontTextureSettings);
    const createdItem = await createCustomObjectFromAsset({
      assetUrl: url,
      assetType: "model3d",
      assetName: devModelImported3dName,
      kindOverride: "model",
      labelPrefix: "Modelo 3D",
      modelTexturePayload: {
        texture_url: String(devImportedTextureOverride || ""),
        texture_settings: resolvedAppliedTextureSettings,
        imported_texture_projection: devImportedAppliedTextureSlot,
        side_textures: {
          front: String(devImportedFrontTexture || ""),
          side: String(devImportedSideTexture || ""),
          back: String(devImportedBackTexture || ""),
        },
        side_texture_settings: {
          front: normalizeTextureSettings(devImportedFrontTextureSettings),
          side: normalizeTextureSettings(devImportedSideTextureSettings),
          back: normalizeTextureSettings(devImportedBackTextureSettings),
        },
      },
      selectAfterCreate: true,
    });
    if (!createdItem) return;
    setIsModelerOpen(false);
    setIsModelerExpanded(false);
    setDevInteractionMode("move");
    setSceneConfigMessage("Modelo 3D adicionado no mapa e selecionado para edicao.");
  }, [
    createCustomObjectFromAsset,
    devImportedAppliedTextureSlot,
    devImportedBackTexture,
    devImportedBackTextureSettings,
    devImportedFrontTexture,
    devImportedFrontTextureSettings,
    devModelImported3dName,
    devImportedSideTexture,
    devImportedSideTextureSettings,
    devImportedTextureOverride,
    devModelImported3dUrl,
  ]);
  const handleAddDevSpecialSegment = React.useCallback(
    async (segmentId, options = {}) => {
      const definition = DEV_SPECIAL_SEGMENT_LIBRARY.find((item) => item.id === segmentId);
      if (!definition) return;
      const source = getVisibleSpawnPoint();
      const previewZ = Number(source?.z || -12);
      const baseZ = toStoredEditorZ(previewZ);
      const groundYAtPreview = getGroundDropAtZ(previewZ);
      const attachGalleryAsset = options?.attachGalleryAsset !== false;
      const presetPatch = options?.presetPatch && typeof options.presetPatch === "object" ? options.presetPatch : null;
      const assetMeta = attachGalleryAsset ? resolveDevGalleryAssetMeta(devAddTextureUrl) : { type: "", url: "", name: "" };
      const usesModel = attachGalleryAsset && assetMeta.type === "model3d" && !!assetMeta.url;
      const key = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const segmentHeight = Number(
        presetPatch?.segment_height ?? definition.segment_height ?? 0
      );
      const segmentEntryLength = Number(
        presetPatch?.segment_entry_length ?? definition.segment_entry_length ?? 0
      );
      const segmentFlatLength = Number(
        presetPatch?.segment_flat_length ?? definition.segment_flat_length ?? 0
      );
      const segmentExitLength = Number(
        presetPatch?.segment_exit_length ?? definition.segment_exit_length ?? 0
      );
      const segmentGapLength = Number(
        presetPatch?.segment_gap_length ?? definition.segment_gap_length ?? 0
      );
      const segmentDropDepth = Number(
        presetPatch?.segment_drop_depth ?? definition.segment_drop_depth ?? 0
      );
      const logicWidth = Number(
        presetPatch?.segment_logic_width ?? 7.25
      );
      const item = {
        key,
        label: `${String(options?.label || definition.label).trim()} ${key.slice(-4)}`,
        kind: "special_segment",
        editor_category: "elements",
        logic_only: !usesModel,
        texture_url: usesModel ? "" : "",
        model_url: usesModel ? assetMeta.url : "",
        model_name: usesModel ? assetMeta.name : "",
        media_type: usesModel ? "model3d" : "",
        procedural_type: "",
        x: 0,
        x_mode: "relative_curve",
        y: Number((definition.offsetY ?? 0.1).toFixed(3)),
        y_mode: "relative_ground",
        z: baseZ,
        movement_mode: "anchored",
        follow_road_curve: true,
        scale: 1,
        width: Number(definition.width || 8.1),
        height: Number(definition.height || 0.3),
        depth: Number(definition.depth || 12),
        block_id: getSceneBlockId(0, baseZ),
        special_segment_type: definition.type,
        special_profile: definition.profile,
        segment_height: segmentHeight,
        segment_entry_length: segmentEntryLength,
        segment_flat_length: segmentFlatLength,
        segment_exit_length: segmentExitLength,
        segment_gap_length: segmentGapLength,
        segment_drop_depth: segmentDropDepth,
        segment_logic_offset_z: 0,
        segment_logic_height_offset: 0,
        segment_logic_width: logicWidth,
      };
      const currentList = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
      const nextList = [...currentList, item];
      setSceneConfig((prev) => ({
        ...(prev || createDefaultSceneConfig(selectedIslandDay)),
        custom_objects: nextList,
      }));
      sceneConfigRef.current = {
        ...(sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay)),
        custom_objects: nextList,
      };
      const saved = await patchSceneConfig({ custom_objects: nextList });
      setDevDraftOverrides({});
      setDevSelectedObject({
        key,
        type: "custom",
        kind: "special_segment",
        label: item.label,
        texture_url: item.texture_url,
        model_url: item.model_url,
        model_name: item.model_name,
        media_type: item.media_type,
        procedural_type: item.procedural_type,
        scenePosition: { x: 0, y: groundYAtPreview + item.y, z: previewZ },
        worldPosition: { x: 0, y: groundYAtPreview + item.y, z: previewZ },
        blockId: item.block_id,
        special_segment_type: item.special_segment_type,
        special_profile: item.special_profile,
      });
      setDevPositionDraft({
        x: "0.000",
        y: (groundYAtPreview + item.y).toFixed(3),
        z: previewZ.toFixed(3),
      });
      setDevScaleDraft({
        scale: "1.00",
        scaleX: "1.00",
        scaleY: "1.00",
        scaleZ: "1.00",
      });
      setSceneConfigMessage(
        saved
          ? `${String(options?.label || definition.label).trim()} adicionada. Ajuste a logica no item selecionado.`
          : `${String(options?.label || definition.label).trim()} adicionada no preview.`
      );
    },
    [
      DEV_SPECIAL_SEGMENT_LIBRARY,
      createDefaultSceneConfig,
      devAddTextureUrl,
      patchSceneConfig,
      resolveDevGalleryAssetMeta,
      selectedIslandDay,
      toStoredEditorZ,
    ]
  );
  const handleDeleteAllDevBridges = React.useCallback(async () => {
    const currentConfig = sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay);
    const currentList = Array.isArray(currentConfig?.custom_objects) ? currentConfig.custom_objects : [];
    const currentOverrides =
      currentConfig?.object_overrides && typeof currentConfig.object_overrides === "object"
        ? currentConfig.object_overrides
        : {};
    const bridgeKeys = currentList
      .filter((item) => {
        const key = String(item?.key || "");
        const override = currentOverrides?.[key] && typeof currentOverrides[key] === "object" ? currentOverrides[key] : {};
        const specialType = String(override?.special_segment_type || item?.special_segment_type || "").trim().toLowerCase();
        return specialType === "elevated_path";
      })
      .map((item) => String(item?.key || ""))
      .filter(Boolean);
    if (!bridgeKeys.length) {
      setSceneConfigMessage("Nao ha pontes logicas salvas no mapa.");
      return;
    }
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${bridgeKeys.length} ponte(s) logica(s) do mapa?\n\nEssa acao remove as subidas/descidas salvas.`
    );
    if (!confirmed) return;
    const bridgeKeySet = new Set(bridgeKeys);
    const nextList = currentList.filter((item) => !bridgeKeySet.has(String(item?.key || "")));
    const nextOverrides = { ...currentOverrides };
    bridgeKeys.forEach((key) => {
      delete nextOverrides[key];
    });
    const nextConfig = {
      ...currentConfig,
      custom_objects: nextList,
      object_overrides: nextOverrides,
    };
    setSceneConfig(nextConfig);
    sceneConfigRef.current = nextConfig;
    const saved = await patchSceneConfig({
      custom_objects: nextList,
      object_overrides: nextOverrides,
    });
    if (bridgeKeySet.has(String(devSelectedObject?.key || ""))) {
      setDevSelectedObject(null);
    }
    setSceneConfigMessage(
      saved
        ? `${bridgeKeys.length} ponte(s) logica(s) removida(s) do mapa.`
        : `${bridgeKeys.length} ponte(s) removida(s) apenas no preview local.`
    );
  }, [createDefaultSceneConfig, devSelectedObject?.key, patchSceneConfig, selectedIslandDay]);
  const handleAddDevLogicPreset = React.useCallback(
    async (presetId) => {
      const preset = DEV_LOGIC_SEGMENT_PRESETS.find((item) => item.id === presetId);
      if (!preset) return;
      await handleAddDevSpecialSegment(preset.segmentId, {
        attachGalleryAsset: false,
        label: `Logica ${preset.label}`,
        presetPatch: preset,
      });
    },
    [DEV_LOGIC_SEGMENT_PRESETS, handleAddDevSpecialSegment]
  );
  const handleClearImportedModelFromViewport = React.useCallback(() => {
    setDevModelImported3dUrl("");
    setDevModelImported3dName("");
    setDevModelViewportMode("procedural");
    setDevImportedWeldVertices(false);
    setDevImportedAutoMaskTopology(true);
    setDevImportedWeldEpsilon("auto");
    setDevImportedSmoothShading(true);
    setDevImportedAutoSmooth(true);
    setDevImportedAutoSmoothAngle("180");
    setDevImportedDraftOffsets({});
    setDevImportedDraftVertexColors({});
    setDevShowImportedTexture(false);
    setDevImportedTextureSlot("front");
    setDevImportedAppliedTextureSlot("front");
    setDevImportedFrontTexture("");
    setDevImportedSideTexture("");
    setDevImportedBackTexture("");
    setDevImportedFrontTextureSettings(normalizeTextureSettings({}));
    setDevImportedSideTextureSettings(normalizeTextureSettings({}));
    setDevImportedBackTextureSettings(normalizeTextureSettings({}));
    setDevImportedTextureOverride("");
    setDevModelImportedPreviewError("");
    setDevImportedMeshStats(null);
    setPendingCloseImportedAfterSave(false);
    importedAutoWeldSignatureRef.current = "";
    setSceneConfigMessage("Objeto importado removido do viewport de edicao.");
  }, []);
  const handleSelectModelerTexture = React.useCallback(
    (url) => {
      const next = String(url || "");
      if (devModelViewportMode === "imported") {
        if (devImportedTextureSlot === "side") setDevImportedSideTexture(next);
        else if (devImportedTextureSlot === "back") setDevImportedBackTexture(next);
        else setDevImportedFrontTexture(next);
      } else setDevModelSelectedTexture(next);
    },
    [devImportedTextureSlot, devModelViewportMode]
  );
  const handleSelectImportedTextureSlot = React.useCallback((slot) => {
    const nextSlot = slot === "side" || slot === "back" ? slot : "front";
    setDevImportedTextureSlot(nextSlot);
  }, []);
  const activeImportedTextureSettings = React.useMemo(() => {
    if (devImportedTextureSlot === "side") return normalizeTextureSettings(devImportedSideTextureSettings);
    if (devImportedTextureSlot === "back") return normalizeTextureSettings(devImportedBackTextureSettings);
    return normalizeTextureSettings(devImportedFrontTextureSettings);
  }, [devImportedBackTextureSettings, devImportedFrontTextureSettings, devImportedSideTextureSettings, devImportedTextureSlot]);
  const appliedImportedTextureSettings = React.useMemo(() => {
    if (devImportedAppliedTextureSlot === "side") return normalizeTextureSettings(devImportedSideTextureSettings);
    if (devImportedAppliedTextureSlot === "back") return normalizeTextureSettings(devImportedBackTextureSettings);
    return normalizeTextureSettings(devImportedFrontTextureSettings);
  }, [
    devImportedAppliedTextureSlot,
    devImportedBackTextureSettings,
    devImportedFrontTextureSettings,
    devImportedSideTextureSettings,
  ]);
  const updateActiveImportedTextureSetting = React.useCallback((key, value) => {
    const patch = { [key]: value };
    if (devImportedTextureSlot === "side") {
      setDevImportedSideTextureSettings((prev) => ({ ...normalizeTextureSettings(prev), ...patch }));
      return;
    }
    if (devImportedTextureSlot === "back") {
      setDevImportedBackTextureSettings((prev) => ({ ...normalizeTextureSettings(prev), ...patch }));
      return;
    }
    setDevImportedFrontTextureSettings((prev) => ({ ...normalizeTextureSettings(prev), ...patch }));
  }, [devImportedTextureSlot]);
  const resetActiveImportedTextureSettings = React.useCallback(() => {
    const base = normalizeTextureSettings({});
    if (devImportedTextureSlot === "side") {
      setDevImportedSideTextureSettings(base);
      return;
    }
    if (devImportedTextureSlot === "back") {
      setDevImportedBackTextureSettings(base);
      return;
    }
    setDevImportedFrontTextureSettings(base);
  }, [devImportedTextureSlot]);
  const resolveImportedTextureBySlot = React.useCallback((slot) => {
    if (slot === "side") return String(devImportedSideTexture || "");
    if (slot === "back") return String(devImportedBackTexture || "");
    return String(devImportedFrontTexture || "");
  }, [devImportedBackTexture, devImportedFrontTexture, devImportedSideTexture]);
  const handleApplyImportedTextureSlot = React.useCallback(() => {
    const slot = devImportedTextureSlot === "side" || devImportedTextureSlot === "back" ? devImportedTextureSlot : "front";
    const texture = resolveImportedTextureBySlot(slot);
    setDevImportedAppliedTextureSlot(slot);
    setDevImportedTextureOverride(texture);
    setDevImportedTextureUseOriginalUv(false);
    if (texture) setDevShowImportedTexture(true);
  }, [devImportedTextureSlot, resolveImportedTextureBySlot]);
  const handleCommitImportedTextureEdit = React.useCallback(
    async ({ file, slot }) => {
      if (!(file instanceof File)) throw new Error("arquivo_de_textura_invalido");
      const normalizedSlot = slot === "side" || slot === "back" ? slot : "front";
      const islandFolder = `islands/day-${selectedIslandDay}/textures`;
      const uploadedUrl = await uploadSceneAsset(file, {
        folder: islandFolder,
        filename: file.name || `textura_${normalizedSlot}_editada.png`,
      });
      if (!uploadedUrl) throw new Error("upload_failed");
      registerUploadedAsset({
        url: uploadedUrl,
        type: "image",
        name: file.name || getAssetFileName(uploadedUrl),
        sceneKind: "elements",
      });
      if (normalizedSlot === "side") setDevImportedSideTexture(String(uploadedUrl));
      else if (normalizedSlot === "back") setDevImportedBackTexture(String(uploadedUrl));
      else setDevImportedFrontTexture(String(uploadedUrl));
      setDevImportedAppliedTextureSlot(normalizedSlot);
      setDevImportedTextureOverride(String(uploadedUrl));
      setDevImportedTextureUseOriginalUv(true);
      setDevShowImportedTexture(true);
      setSceneConfigMessage(`Textura editada aplicada: ${getAssetFileName(uploadedUrl)}`);
      return uploadedUrl;
    },
    [registerUploadedAsset, selectedIslandDay]
  );
  const handleAnimationStudioDataChange = React.useCallback((nextData) => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    persistObjectOverride(key, { animation_studio: nextData || null });
    markDevEdited();
  }, [devSelectedObject?.key, markDevEdited, persistObjectOverride]);
  const handleCloseImportedWithPrompt = React.useCallback(() => {
    if (!devModelImported3dUrl) return;
    const shouldSave = window.confirm(
      "Deseja salvar as alteracoes do modelo importado antes de fechar?\n\nOK = Salvar e fechar\nCancelar = Fechar sem salvar"
    );
    if (!shouldSave) {
      handleClearImportedModelFromViewport();
      return;
    }
    setPendingCloseImportedAfterSave(true);
    setModelerSaveRequestToken((prev) => prev + 1);
    setSceneConfigMessage("Salvando modelo importado antes de fechar...");
  }, [devModelImported3dUrl, handleClearImportedModelFromViewport]);
  const handleModelerSaveRequestDone = React.useCallback(
    (result) => {
      if (!pendingCloseImportedAfterSave) return;
      const success = result?.success !== false;
      if (success) {
        handleClearImportedModelFromViewport();
        setSceneConfigMessage("Modelo importado salvo e fechado do viewport.");
      } else {
        setPendingCloseImportedAfterSave(false);
        setSceneConfigMessage("Falha ao salvar o modelo importado. O viewport foi mantido aberto.");
      }
    },
    [handleClearImportedModelFromViewport, pendingCloseImportedAfterSave]
  );
  const handleImportedMeshStats = React.useCallback((stats) => {
    if (!stats || typeof stats !== "object") {
      setDevImportedMeshStats(null);
      importedAutoWeldSignatureRef.current = "";
      return;
    }
    const nextStats = {
      vertices: Math.max(0, Math.floor(Number(stats.vertices) || 0)),
      triangles: Math.max(0, Math.floor(Number(stats.triangles) || 0)),
      weldGroups: Math.max(0, Math.floor(Number(stats.weldGroups) || 0)),
      weldableVertices: Math.max(0, Math.floor(Number(stats.weldableVertices) || 0)),
      duplicateVertices: Math.max(0, Math.floor(Number(stats.duplicateVertices) || 0)),
    };
    setDevImportedMeshStats(nextStats);
    const signature = [
      nextStats.vertices,
      nextStats.triangles,
      nextStats.weldGroups,
      nextStats.duplicateVertices,
      String(devModelImported3dUrl || "").trim(),
    ].join("|");
    if (signature && signature !== importedAutoWeldSignatureRef.current) {
      importedAutoWeldSignatureRef.current = signature;
    }
  }, [devImportedWeldVertices, devModelImported3dUrl]);
  const handleReplaceSelectedWithImportedModel = React.useCallback(async () => {
    const url = String(devModelImported3dUrl || "").trim();
    if (!url) {
      setSceneConfigMessage("Importe um arquivo 3D primeiro.");
      return;
    }
    const key = String(devSelectedObject?.key || "");
    const selectedPos = devSelectedObject?.scenePosition || {};
    const px = Number(devPositionDraft?.x);
    const py = Number(devPositionDraft?.y);
    const pz = Number(devPositionDraft?.z);
    const spawnPosition = {
      x: Number.isFinite(px) ? px : Number(selectedPos?.x || 0),
      y: Number.isFinite(py) ? py : Number(selectedPos?.y || 0),
      z: Number.isFinite(pz) ? pz : Number(selectedPos?.z || -10),
    };

    if (key) {
      if (key.startsWith("custom_")) {
        const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
        const nextList = list.filter((item) => String(item?.key || "") !== key);
        await patchSceneConfig({ custom_objects: nextList });
      } else if (key !== "road_base") {
        const currentOverride = sceneConfigRef.current?.object_overrides?.[key] || {};
        await patchSceneConfig({
          object_overrides: {
            [key]: {
              ...currentOverride,
              hidden: true,
            },
          },
        });
      }
    }

    const resolvedAppliedTextureSettings =
      devImportedAppliedTextureSlot === "side"
        ? normalizeTextureSettings(devImportedSideTextureSettings)
        : devImportedAppliedTextureSlot === "back"
          ? normalizeTextureSettings(devImportedBackTextureSettings)
          : normalizeTextureSettings(devImportedFrontTextureSettings);
    await createCustomObjectFromAsset({
      assetUrl: url,
      assetType: "model3d",
      kindOverride: "model",
      labelPrefix: "Modelo 3D",
      modelTexturePayload: {
        texture_url: String(devImportedTextureOverride || ""),
        texture_settings: resolvedAppliedTextureSettings,
        imported_texture_projection: devImportedAppliedTextureSlot,
        side_textures: {
          front: String(devImportedFrontTexture || ""),
          side: String(devImportedSideTexture || ""),
          back: String(devImportedBackTexture || ""),
        },
        side_texture_settings: {
          front: normalizeTextureSettings(devImportedFrontTextureSettings),
          side: normalizeTextureSettings(devImportedSideTextureSettings),
          back: normalizeTextureSettings(devImportedBackTextureSettings),
        },
      },
      spawnPosition,
      selectAfterCreate: true,
    });
    setIsModelerOpen(false);
    setIsModelerExpanded(false);
    setDevInteractionMode("move");
    setSceneConfigMessage("Objeto selecionado substituido pelo modelo importado.");
  }, [
    createCustomObjectFromAsset,
    devImportedAppliedTextureSlot,
    devImportedBackTexture,
    devImportedBackTextureSettings,
    devImportedFrontTexture,
    devImportedFrontTextureSettings,
    devImportedSideTexture,
    devImportedSideTextureSettings,
    devImportedTextureOverride,
    devModelImported3dUrl,
    devPositionDraft?.x,
    devPositionDraft?.y,
    devPositionDraft?.z,
    devSelectedObject?.key,
    devSelectedObject?.scenePosition,
    patchSceneConfig,
  ]);

  const handleAddFromGallery = React.useCallback(
    async (asset) => {
      if (asset?.isProceduralPreset || String(asset?.mediaType || "") === "procedural_preset") {
        const preset = asset?.proceduralPreset;
        if (!preset) return;
        const source = getVisibleSpawnPoint();
        const baseX = Number(source.x);
        const baseY = Number(source.y);
        const baseZ = Number(source.z);
        const rawParts = Array.isArray(preset?.parts) ? preset.parts.filter((part) => part && typeof part === "object") : [];
        const fallbackPart = rawParts.length
          ? null
          : {
              id: "part_1",
              name: String(preset?.name || "Parte 1"),
              procedural_type: String(preset?.procedural_type || "box"),
              weld_vertices: !!preset?.weld_vertices,
              texture_url: String(preset?.texture_url || "").trim(),
              texture_settings: normalizeTextureSettings(preset?.texture_settings),
              side_textures: preset?.side_textures && typeof preset.side_textures === "object" ? { ...preset.side_textures } : {},
              side_texture_settings: normalizeSideTextureSettings(preset?.side_texture_settings),
              width: Number(preset?.width || 1.8),
              height: Number(preset?.height || 1.2),
              depth: Number(preset?.depth || 1.4),
              radius_top: Number(preset?.radius_top || 0.7),
              radius_bottom: Number(preset?.radius_bottom || 0.9),
              width_segments: Math.max(1, Math.floor(Number(preset?.width_segments || 1))),
              height_segments: Math.max(1, Math.floor(Number(preset?.height_segments || 1))),
              depth_segments: Math.max(1, Math.floor(Number(preset?.depth_segments || 1))),
              radial_segments: Math.max(3, Math.floor(Number(preset?.radial_segments || 8))),
              procedural_vertex_offsets: normalizeOffsetsForUndo(preset?.procedural_vertex_offsets),
              procedural_vertex_colors: normalizeVertexColorsForUndo(preset?.procedural_vertex_colors),
              poly_count_estimate: Number(preset?.poly_count_estimate || estimateProceduralPolyCountFromConfig(preset)),
              offset_x: 0,
              offset_y: 0,
              offset_z: 0,
              rotation_x: Number.isFinite(Number(preset?.rotation_x)) ? Number(preset.rotation_x) : 0,
              rotation_y: Number.isFinite(Number(preset?.rotation_y)) ? Number(preset.rotation_y) : 0,
              rotation_z: Number.isFinite(Number(preset?.rotation_z)) ? Number(preset.rotation_z) : 0,
              scale: Math.max(0.2, Number(preset?.scale || 1)),
            };
        const parts = rawParts.length ? rawParts : [fallbackPart];
        const groupId = `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const items = parts.map((part, idx) => {
          const x = baseX + Number(part?.offset_x || 0);
          const y = baseY + Number(part?.offset_y || 0);
          const z = baseZ + Number(part?.offset_z || 0);
          return {
            key: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`,
            label: `${String(preset?.name || `3D ${String(part?.procedural_type || "box")}`)} - ${String(part?.name || `Parte ${idx + 1}`)}`,
            group_id: groupId,
            part_id: String(part?.id || `part_${idx + 1}`),
            kind: "procedural",
            media_type: "procedural",
            procedural_type: String(part?.procedural_type || "box"),
            weld_vertices: !!part?.weld_vertices,
            texture_url: String(part?.texture_url || "").trim(),
            texture_settings: normalizeTextureSettings(part?.texture_settings),
            side_textures: part?.side_textures && typeof part.side_textures === "object" ? { ...part.side_textures } : {},
            side_texture_settings: normalizeSideTextureSettings(part?.side_texture_settings),
            width: Number(part?.width || 1.8),
            height: Number(part?.height || 1.2),
            depth: Number(part?.depth || 1.4),
            radius_top: Number(part?.radius_top || 0.7),
            radius_bottom: Number(part?.radius_bottom || 0.9),
            width_segments: Math.max(1, Math.floor(Number(part?.width_segments || 1))),
            height_segments: Math.max(1, Math.floor(Number(part?.height_segments || 1))),
            depth_segments: Math.max(1, Math.floor(Number(part?.depth_segments || 1))),
            radial_segments: Math.max(3, Math.floor(Number(part?.radial_segments || 8))),
            procedural_vertex_offsets: normalizeOffsetsForUndo(part?.procedural_vertex_offsets),
            procedural_vertex_colors: normalizeVertexColorsForUndo(part?.procedural_vertex_colors),
            poly_count_estimate: Number(part?.poly_count_estimate || estimateProceduralPolyCountFromConfig(part)),
            x,
            y,
            y_mode: "relative_ground",
            z,
            scale: Math.max(0.2, Number(part?.scale || 1)),
            rotation_x: Number.isFinite(Number(part?.rotation_x)) ? Number(part.rotation_x) : 0,
            rotation_y: Number.isFinite(Number(part?.rotation_y)) ? Number(part.rotation_y) : 0,
            rotation_z: Number.isFinite(Number(part?.rotation_z)) ? Number(part.rotation_z) : 0,
            block_id: getSceneBlockId(x, z),
          };
        });
        const list = Array.isArray(sceneConfigRef.current?.custom_objects) ? sceneConfigRef.current.custom_objects : [];
        await patchSceneConfig({ custom_objects: [...list, ...items] });
        setSceneConfigMessage(
          items.length > 1
            ? `Arquivo 3D adicionado com ${items.length} partes.`
            : `Preset 3D adicionado: ${items[0]?.label || String(preset?.name || "3D")}`
        );
        return;
      }
      const url = String(asset?.value || asset?.url || "").trim();
      if (!url) return;
      const createdItem = await createCustomObjectFromAsset({
        assetUrl: url,
        assetType: String(asset?.mediaType || asset?.type || detectAssetTypeFromName(url)),
        assetName: String(asset?.fileName || asset?.name || getAssetFileName(url)),
        editorCategory: devGalleryTab === "eliminatory" ? "eliminatory" : "elements",
        kindOverride: devGalleryTab === "eliminatory" ? "hazard" : null,
        labelPrefix: devGalleryTab === "eliminatory" ? "Eliminatorio" : "Galeria",
        selectAfterCreate: true,
      });
      if (createdItem) {
        setIsElementGalleryOpen(false);
        setDevInteractionMode("move");
      }
    },
    [createCustomObjectFromAsset]
  );

  const handleGalleryDragStart = React.useCallback((event, asset) => {
    const url = String(asset?.value || asset?.url || "").trim();
    if (!url || !event?.dataTransfer) return;
    const payload = {
      url,
      type: String(asset?.mediaType || asset?.type || detectAssetTypeFromName(url)),
      name: String(asset?.fileName || asset?.name || getAssetFileName(url)),
    };
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-dev-asset", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", payload.url);
  }, []);

  const handleApplyHorizonFromGallery = React.useCallback(
    async (asset) => {
      const rawUrl = String(asset?.value || asset?.url || "").trim();
      if (!rawUrl) return;
      const normalizedUrl = resolveGalleryAssetUrl(rawUrl) || rawUrl;
      if (isLegacyProjectAssetPath(normalizedUrl) || !isSceneAssetUrlCandidate(normalizedUrl)) {
        setSceneConfigMessage("Arquivo de horizonte invalido. Selecione outro item da galeria.");
        return;
      }
      const url = normalizedUrl;
      setSceneConfig((prev) => ({
        ...(prev || createDefaultSceneConfig(selectedIslandDay)),
        island_day: selectedIslandDay,
        horizon_texture_url: url,
      }));
      await patchSceneConfig({ horizon_texture_url: url });
      setSceneConfigMessage(`Horizonte aplicado: ${asset?.fileName || getAssetFileName(url)}`);
    },
    [patchSceneConfig, selectedIslandDay]
  );

  const handleApplyRoadFromGallery = React.useCallback(
    async (asset) => {
      const rawUrl = String(asset?.value || asset?.url || "").trim();
      if (!rawUrl) return;
      const normalizedUrl = resolveGalleryAssetUrl(rawUrl) || rawUrl;
      if (isLegacyProjectAssetPath(normalizedUrl) || !isSceneAssetUrlCandidate(normalizedUrl)) {
        setSceneConfigMessage("Arquivo de estrada invalido. Selecione outro item da galeria.");
        return;
      }
      const url = normalizedUrl;
      setSceneConfig((prev) => ({
        ...(prev || createDefaultSceneConfig(selectedIslandDay)),
        island_day: selectedIslandDay,
        road_texture_url: url,
      }));
      await patchSceneConfig({
        road_texture_url: url,
        object_overrides: {
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            hidden: false,
          },
        },
      });
      setSceneConfigMessage(`Estrada aplicada: ${asset?.fileName || getAssetFileName(url)}`);
    },
    [patchSceneConfig, selectedIslandDay]
  );

  const handleDeleteGalleryAsset = React.useCallback(
    async (asset) => {
      const rawUrl = String(asset?.value || asset?.url || "").trim();
      if (!rawUrl) return;
      const confirmed = window.confirm(`Excluir "${asset?.fileName || getAssetFileName(rawUrl)}" da galeria e do backend?`);
      if (!confirmed) return;

      const normalizeUrl = (value) => {
        const raw = String(value || "").trim();
        if (!raw) return "";
        return resolveGalleryAssetUrl(raw).toLowerCase();
      };
      const candidates = new Set([
        String(rawUrl || "").trim().toLowerCase(),
        normalizeUrl(rawUrl),
      ]);
      const matchesDeletedAsset = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return false;
        if (candidates.has(raw)) return true;
        const normalized = normalizeUrl(value);
        return normalized ? candidates.has(normalized) : false;
      };

      const applyLocalCleanup = () => {
        setDevUploadedAssets((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.filter((item) => !matchesDeletedAsset(item?.url));
        });
        setDevDraftOverrides((prev) => {
          const current = prev && typeof prev === "object" ? prev : {};
          const next = {};
          Object.entries(current).forEach(([key, value]) => {
            if (!value || typeof value !== "object") return;
            const item = { ...value };
            if (matchesDeletedAsset(item.texture_url)) delete item.texture_url;
            if (matchesDeletedAsset(item.model_url)) delete item.model_url;
            if (item.side_textures && typeof item.side_textures === "object") {
              const nextSides = {};
              Object.entries(item.side_textures).forEach(([side, sideUrl]) => {
                if (!matchesDeletedAsset(sideUrl)) nextSides[side] = sideUrl;
              });
              item.side_textures = nextSides;
            }
            if (item.side_texture_settings && typeof item.side_texture_settings === "object") {
              const nextSideSettings = {};
              Object.entries(item.side_texture_settings).forEach(([side, sideSettings]) => {
                const mappedUrl = item?.side_textures?.[side];
                if (mappedUrl) nextSideSettings[side] = sideSettings;
              });
              item.side_texture_settings = nextSideSettings;
            }
            if (Object.keys(item).length > 0) next[key] = item;
          });
          return next;
        });
        setDevLastUploadedAsset((prev) => (matchesDeletedAsset(prev?.url) ? null : prev));
        setDevAddTextureUrl((prev) => (matchesDeletedAsset(prev) ? "" : prev));
        setDevSelectedObject((prev) => {
          if (!prev) return prev;
          if (matchesDeletedAsset(prev.texture_url) || matchesDeletedAsset(prev.model_url)) return null;
          return prev;
        });
      };

      const currentConfig = sceneConfigRef.current || createDefaultSceneConfig(selectedIslandDay);
      const currentCustomObjects = Array.isArray(currentConfig?.custom_objects) ? currentConfig.custom_objects : [];
      const nextCustomObjects = currentCustomObjects
        .map((item) => {
          if (!item || typeof item !== "object") return item;
          const nextItem = { ...item };
          if (matchesDeletedAsset(nextItem.texture_url)) nextItem.texture_url = "";
          if (matchesDeletedAsset(nextItem.model_url)) nextItem.model_url = "";
          if (nextItem.side_textures && typeof nextItem.side_textures === "object") {
            const nextSides = {};
            Object.entries(nextItem.side_textures).forEach(([side, sideUrl]) => {
              if (!matchesDeletedAsset(sideUrl)) nextSides[side] = sideUrl;
            });
            nextItem.side_textures = nextSides;
          }
          if (nextItem.side_texture_settings && typeof nextItem.side_texture_settings === "object") {
            const nextSideSettings = {};
            Object.entries(nextItem.side_texture_settings).forEach(([side, sideSettings]) => {
              if (nextItem.side_textures?.[side]) nextSideSettings[side] = sideSettings;
            });
            nextItem.side_texture_settings = nextSideSettings;
          }
          return nextItem;
        })
        .filter((item) => {
          const hasPrimary = String(item?.texture_url || "").trim() || String(item?.model_url || "").trim();
          const hasSides =
            item?.side_textures &&
            typeof item.side_textures === "object" &&
            Object.keys(item.side_textures).length > 0;
          const isProcedural = String(item?.media_type || "") === "procedural" || String(item?.procedural_type || "").trim();
          return hasPrimary || hasSides || isProcedural;
        });
      const currentOverrides = currentConfig?.object_overrides || {};
      const nextOverrides = {};
      Object.entries(currentOverrides).forEach(([key, value]) => {
        if (!value || typeof value !== "object") {
          return;
        }
        const nextValue = { ...value };
        if (matchesDeletedAsset(nextValue.texture_url)) delete nextValue.texture_url;
        if (matchesDeletedAsset(nextValue.model_url)) delete nextValue.model_url;
        if (Object.keys(nextValue).length > 0) {
          nextOverrides[key] = nextValue;
        }
      });
      const patch = {
        custom_objects: nextCustomObjects,
        object_overrides: nextOverrides,
      };
      if (matchesDeletedAsset(currentConfig?.horizon_texture_url)) patch.horizon_texture_url = "";
      if (matchesDeletedAsset(currentConfig?.road_texture_url)) patch.road_texture_url = "";

      try {
        const resolvedFileUrl = resolveGalleryAssetUrl(rawUrl);
        try {
          await base44.integrations.Core.DeleteFile({ fileUrl: resolvedFileUrl });
        } catch (error) {
          const status = Number(error?.status);
          if (status === 400 || status === 404) {
            await base44.integrations.Core.DeleteFile({ fileUrl: rawUrl });
          } else {
            throw error;
          }
        }
      } catch (error) {
        const status = Number(error?.status);
        if (status !== 404) {
          setSceneConfigMessage("Falha ao excluir arquivo no backend.");
          return;
        }
      }

      applyLocalCleanup();
      await patchSceneConfig(patch);
      setSceneConfigMessage("Arquivo excluido da galeria e do backend.");
    },
    [patchSceneConfig, selectedIslandDay]
  );

  const handleChallengeAssetDrop = React.useCallback(
    async (event) => {
      if (!(isDevMode && screen === "challenge")) return;
      const container = challengeContainerRef.current;
      if (!container) return;
      const raw =
        event.dataTransfer?.getData("application/x-dev-asset") ||
        event.dataTransfer?.getData("text/plain");
      if (!raw) return;
      let payload = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { url: raw, type: detectAssetTypeFromName(raw), name: getAssetFileName(raw) };
      }
      const url = String(payload?.url || "").trim();
      if (!url) return;
      if (!isSceneAssetUrlCandidate(url)) {
        setSceneConfigMessage("Drop ignorado: arquivo invalido para galeria.");
        return;
      }
      const rect = container.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
      const spawn = {
        x: (nx - 0.5) * 8.5,
        y: 0.2,
        z: -4 - ny * 20,
      };
      await createCustomObjectFromAsset({
        assetUrl: url,
        assetType: String(payload?.type || detectAssetTypeFromName(url)),
        assetName: String(payload?.name || getAssetFileName(url)),
        labelPrefix: "Galeria",
        spawnPosition: spawn,
        selectAfterCreate: false,
      });
    },
    [createCustomObjectFromAsset, isDevMode, screen]
  );

  const handleCopyFromIsland = React.useCallback(async () => {
    const fromDay = Number(copyFromIslandDay);
    if (!Number.isFinite(fromDay) || fromDay < 1) {
      setSceneConfigMessage("Ilha de origem invalida.");
      return;
    }
    if (fromDay === selectedIslandDay) {
      setSceneConfigMessage("Escolha uma ilha diferente para copiar.");
      return;
    }
    setIsSceneConfigSaving(true);
    setSceneConfigMessage("");
    try {
      const result = await copyIslandSceneConfig({
        fromIslandDay: fromDay,
        toIslandDay: selectedIslandDay,
      });
      setSceneConfigRecordId(result?.id || null);
      setSceneConfig({
        ...createDefaultSceneConfig(selectedIslandDay),
        ...(result?.config || {}),
        island_day: selectedIslandDay,
      });
    } catch {
      setSceneConfigMessage("Nao foi possivel copiar configuracao da outra ilha.");
    } finally {
      setIsSceneConfigSaving(false);
    }
  }, [copyFromIslandDay, selectedIslandDay]);

  const handleDevCameraInteract = React.useCallback(() => {
    // Avoid canceling selection/move state on incidental camera start events.
  }, []);
  const handleLoadoutCameraRigDraftChange = React.useCallback((field, value) => {
    setLoadoutCameraRigDraft((prev) => normalizeLoadoutCameraRig({ ...(prev || {}), [field]: value }));
  }, []);
  const handleLoadoutCameraRigMarkerChange = React.useCallback((payload) => {
    const part = String(payload?.part || "");
    if (!part) return;
    setLoadoutCameraRigDraft((prev) => {
      const next = { ...(prev || {}) };
      if (part === "camera") {
        next.cameraX = payload?.x;
        next.cameraZ = payload?.z;
      } else if (part === "target") {
        next.targetX = payload?.x;
        next.targetZ = payload?.z;
      }
      return normalizeLoadoutCameraRig(next);
    });
  }, []);
  const handleStartLoadoutCameraEdit = React.useCallback(() => {
    setIsDevMode(true);
    setIsLoadoutCameraEditMode(true);
    setDevCameraPreset("top");
    setDevCameraResetToken((prev) => prev + 1);
  }, []);
  const handleCancelLoadoutCameraEdit = React.useCallback(() => {
    const baseOverride = sceneConfigRef.current?.object_overrides?.road_base || {};
    setLoadoutCameraRigDraft(normalizeLoadoutCameraRig(baseOverride?.loadout_camera_rig));
    setIsLoadoutCameraEditMode(false);
    setDevCameraResetToken((prev) => prev + 1);
  }, []);
  const handleResetLoadoutCameraRig = React.useCallback(() => {
    setLoadoutCameraRigDraft(normalizeLoadoutCameraRig(DEFAULT_LOADOUT_CAMERA_RIG));
  }, []);
  const loadoutHorizonDraft = React.useMemo(() => {
    const persisted = sceneConfig?.object_overrides?.horizon || {};
    const draft = devDraftOverrides?.horizon || {};
    return normalizeLoadoutHorizonDraft({ ...persisted, ...draft });
  }, [devDraftOverrides?.horizon, sceneConfig?.object_overrides?.horizon]);
  const handleLoadoutHorizonDraftChange = React.useCallback((field, value) => {
    const limits = {
      z: [-80, 40],
      y: [-20, 20],
      scale: [0.45, 2.2],
      horizon_curve_side: [-42, 42],
      horizon_curve_down: [-18, 22],
    };
    const range = limits[field];
    if (!range) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextValue = Math.max(range[0], Math.min(range[1], numeric));
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      horizon: {
        ...((prev && prev.horizon) || {}),
        [field]: nextValue,
      },
    }));
    persistObjectOverride("horizon", { [field]: nextValue });
    markDevEdited();
  }, [markDevEdited, persistObjectOverride]);
  const handleResetLoadoutHorizonDraft = React.useCallback(() => {
    const patch = {
      y: 0,
      z: 0,
      scale: 1,
      horizon_curve_side: 12,
      horizon_curve_down: 3.2,
    };
    setDevDraftOverrides((prev) => ({
      ...(prev || {}),
      horizon: {
        ...((prev && prev.horizon) || {}),
        ...patch,
      },
    }));
    persistObjectOverride("horizon", patch);
    markDevEdited();
  }, [markDevEdited, persistObjectOverride]);
  const handleSaveLoadoutHorizonDraft = React.useCallback(async () => {
    const next = {
      y: Number(loadoutHorizonDraft.y),
      z: Number(loadoutHorizonDraft.z),
      scale: Number(loadoutHorizonDraft.scale),
      horizon_curve_side: Number(loadoutHorizonDraft.horizon_curve_side),
      horizon_curve_down: Number(loadoutHorizonDraft.horizon_curve_down),
    };
    await patchSceneConfig({
      object_overrides: {
        horizon: {
          ...(sceneConfigRef.current?.object_overrides?.horizon || {}),
          ...next,
        },
      },
    });
    setSceneConfigMessage("Horizonte salvo.");
  }, [loadoutHorizonDraft, patchSceneConfig]);
  const handleImportLoadoutFromIsland = React.useCallback(async (mode = "all") => {
    const sourceDay = Number(loadoutImportIslandDay);
    if (!Number.isFinite(sourceDay) || sourceDay < 1) {
      setSceneConfigMessage("Escolha uma ilha valida para importar.");
      return;
    }
    if (sourceDay === selectedIslandDay) {
      setSceneConfigMessage("Escolha outra ilha para importar.");
      return;
    }
    setIsLoadoutImporting(true);
    setSceneConfigMessage("");
    try {
      const source = await loadIslandSceneConfig(sourceDay);
      const sourceConfig = {
        ...createDefaultSceneConfig(sourceDay),
        ...(source?.config || {}),
        island_day: sourceDay,
      };
      const sourceRoadBase = sourceConfig?.object_overrides?.road_base || {};
      const sourceHorizon = sourceConfig?.object_overrides?.horizon || {};
      const nextLighting = normalizeSceneLightingDraft(sourceConfig?.scene_lighting || {});
      const nextRig = normalizeLoadoutCameraRig(sourceRoadBase?.loadout_camera_rig);
      const nextHorizon = normalizeLoadoutHorizonDraft(sourceHorizon);
      const patch = {};
      const nextDraftOverrides = {};

      if (mode === "all" || mode === "camera") {
        setLoadoutCameraRigDraft(nextRig);
        patch.object_overrides = {
          ...(patch.object_overrides || {}),
          road_base: {
            ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
            loadout_camera_rig: nextRig,
          },
        };
      }
      if (mode === "all" || mode === "horizon") {
        nextDraftOverrides.horizon = {
          ...((devDraftOverrides?.horizon && typeof devDraftOverrides.horizon === "object") ? devDraftOverrides.horizon : {}),
          ...nextHorizon,
        };
        patch.object_overrides = {
          ...(patch.object_overrides || {}),
          horizon: {
            ...(sceneConfigRef.current?.object_overrides?.horizon || {}),
            ...nextHorizon,
          },
        };
      }
      if (mode === "all" || mode === "look") {
        setDevSceneLightingDraft(nextLighting);
        patch.scene_lighting = nextLighting;
      }

      if (Object.keys(nextDraftOverrides).length > 0) {
        setDevDraftOverrides((prev) => ({
          ...(prev || {}),
          ...nextDraftOverrides,
        }));
      }

      await patchSceneConfig(patch);
      setSceneConfigMessage(`Loadout importado da Ilha ${sourceDay}.`);
    } catch {
      setSceneConfigMessage("Nao foi possivel importar o loadout da outra ilha.");
    } finally {
      setIsLoadoutImporting(false);
    }
  }, [devDraftOverrides?.horizon, loadoutImportIslandDay, patchSceneConfig, selectedIslandDay]);
  const toggleLoadoutWardrobeSection = React.useCallback((key) => {
    const safeKey = String(key || "");
    if (!safeKey) return;
    setLoadoutWardrobeSectionsOpen((prev) => ({
      ...(prev || {}),
      [safeKey]: !prev?.[safeKey],
    }));
  }, []);
  const handleLoadoutWardrobeUploadPick = React.useCallback(() => {
    const input = wardrobeUploadInputRef.current || document.getElementById("loadout-wardrobe-upload-input");
    input?.click?.();
  }, []);
  const handleLoadoutBaseModelUploadPick = React.useCallback(() => {
    const input = loadoutBaseModelInputRef.current || document.getElementById("loadout-base-model-upload-input");
    input?.click?.();
  }, []);
  const handleSaveLoadoutWardrobe = React.useCallback(async (nextDraft = null, message = "Wardrobe salvo.") => {
    const normalized = normalizeLoadoutWardrobe(nextDraft || loadoutWardrobeDraft);
    setLoadoutWardrobeDraft(normalized);
    setIsLoadoutWardrobeSaving(true);
    try {
      await patchSceneConfig({
        loadout_wardrobe: normalized,
      });
      setSceneConfigMessage(message);
    } finally {
      setIsLoadoutWardrobeSaving(false);
    }
  }, [loadoutWardrobeDraft, patchSceneConfig]);
  const handlePublishWardrobeLibraryItem = React.useCallback(async (item) => {
    const safeItemId = String(item?.id || "").trim();
    const safeSlot = String(item?.slot || "").trim().toLowerCase();
    if (!safeItemId || !safeSlot) return;
    const currentEntries = normalizeWardrobeCatalogEntries(sceneConfigRef.current?.loadout_wardrobe_catalog, { loadoutWardrobe: loadoutWardrobeDraft });
    const nextId = `wardrobe_${safeSlot}_${safeItemId}`;
    const nextEntries = [
      ...currentEntries.filter((entry) => entry.id !== nextId),
      {
        id: nextId,
        label: String(item?.name || `${safeSlot} wardrobe`).trim() || `${safeSlot} wardrobe`,
        description: String(item?.description || `Peca publicada do slot ${safeSlot}.`).trim() || `Peca publicada do slot ${safeSlot}.`,
        characterId: "all",
        slot: safeSlot,
        rarity: String(item?.rarity || "Wardrobe").trim() || "Wardrobe",
        assetRef: safeItemId,
        presetRef: "",
        ownedByDefault: false,
        priceCoins: 0,
        priceDiamonds: 0,
        unlockLevel: 1,
        source: "dev_wardrobe",
      },
    ];
    await patchSceneConfig({ loadout_wardrobe_catalog: nextEntries });
    setSceneConfigMessage("Item do wardrobe publicado no catalogo do jogo.");
  }, [loadoutWardrobeDraft, patchSceneConfig]);
  const handlePublishWardrobePreset = React.useCallback(async (preset) => {
    const safePresetId = String(preset?.id || "").trim();
    if (!safePresetId) return;
    const currentEntries = normalizeWardrobeCatalogEntries(sceneConfigRef.current?.loadout_wardrobe_catalog, { loadoutWardrobe: loadoutWardrobeDraft });
    const nextId = `wardrobe_preset_${safePresetId}`;
    const nextEntries = [
      ...currentEntries.filter((entry) => entry.id !== nextId),
      {
        id: nextId,
        label: String(preset?.name || "Preset de wardrobe").trim() || "Preset de wardrobe",
        description: "Preset publicado do Wardrobe Studio para uso no jogo.",
        characterId: "all",
        slot: "preset",
        rarity: "Wardrobe",
        assetRef: "",
        presetRef: safePresetId,
        ownedByDefault: false,
        priceCoins: 0,
        priceDiamonds: 0,
        unlockLevel: 1,
        source: "dev_wardrobe",
      },
    ];
    await patchSceneConfig({ loadout_wardrobe_catalog: nextEntries });
    setSceneConfigMessage("Preset do wardrobe publicado no catalogo do jogo.");
  }, [loadoutWardrobeDraft, patchSceneConfig]);
  const handleLoadoutWardrobeEquipChange = React.useCallback((slot, itemId) => {
    const safeSlot = String(slot || "");
    if (!safeSlot) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      if (!itemId) {
        delete next.equipped[safeSlot];
      } else {
        const existingTransform = next.equipped?.[safeSlot]?.transform || {};
        next.equipped[safeSlot] = {
          itemId: String(itemId),
          transform: normalizeWardrobeTransform(existingTransform),
        };
      }
      return next;
    });
  }, []);
  const handleSelectLoadoutBackpack = React.useCallback((itemId) => {
    const safeId = String(itemId || "").trim();
    setPlayerInventory((current) => syncInventoryEquippedWardrobeItem(current, selectedCharacterId, safeId, "back"));
  }, [selectedCharacterId]);
  const handleLoadoutWardrobeTransformChange = React.useCallback((slot, field, value) => {
    const safeSlot = String(slot || "");
    if (!safeSlot || !field) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      const current = next.equipped?.[safeSlot] || { itemId: "", transform: normalizeWardrobeTransform({}) };
      next.equipped[safeSlot] = {
        itemId: current.itemId,
        transform: normalizeWardrobeTransform({
          ...(current.transform || {}),
          [field]: value,
        }),
      };
      return next;
    });
  }, []);
  const handleRemoveLoadoutWardrobeItem = React.useCallback((itemId) => {
    const safeId = String(itemId || "");
    if (!safeId) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      next.library = next.library.filter((item) => String(item.id) !== safeId);
      Object.keys(next.equipped || {}).forEach((slot) => {
        if (String(next.equipped?.[slot]?.itemId || "") === safeId) {
          delete next.equipped[slot];
        }
      });
      return next;
    });
  }, []);
  const handleToggleLoadoutWardrobeAutoRig = React.useCallback((itemId) => {
    const safeId = String(itemId || "");
    if (!safeId) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      next.library = next.library.map((item) =>
        String(item.id) === safeId && supportsWardrobeAutoRig(item.slot)
          ? {
              ...item,
              auto_rig: !item.auto_rig,
            }
          : item
      );
      return next;
    });
  }, []);
  const handleSaveLoadoutWardrobePreset = React.useCallback(() => {
    const name = String(loadoutWardrobePresetName || "").trim();
    if (!name) {
      setSceneConfigMessage("Digite um nome para o preset.");
      return;
    }
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      next.presets = [
        ...next.presets.filter((item) => String(item.name).toLowerCase() !== name.toLowerCase()),
        {
          id: `preset_${Date.now()}`,
          name,
          equipped: JSON.parse(JSON.stringify(next.equipped || {})),
        },
      ];
      return next;
    });
    setLoadoutWardrobePresetName("");
    setSceneConfigMessage("Preset pronto para salvar.");
  }, [loadoutWardrobePresetName]);
  const handleApplyLoadoutWardrobePreset = React.useCallback((presetId) => {
    const safeId = String(presetId || "");
    if (!safeId) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      const preset = next.presets.find((item) => String(item.id) === safeId);
      if (!preset) return next;
      next.equipped = normalizeLoadoutWardrobe({ equipped: preset.equipped }).equipped;
      return next;
    });
  }, []);
  const handleRemoveLoadoutWardrobePreset = React.useCallback((presetId) => {
    const safeId = String(presetId || "");
    if (!safeId) return;
    setLoadoutWardrobeDraft((prev) => {
      const next = normalizeLoadoutWardrobe(prev);
      next.presets = next.presets.filter((item) => String(item.id) !== safeId);
      return next;
    });
  }, []);
  const handleLoadoutWardrobeUploadChange = React.useCallback(async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = "";
    if (!file) return;
    const slot = String(loadoutWardrobeUploadSlot || "").trim().toLowerCase();
    if (!WARDROBE_SLOT_DEFS.some((entry) => entry.key === slot)) {
      setSceneConfigMessage("Escolha um slot valido para a peca.");
      return;
    }
    if (detectAssetTypeFromName(file.name) !== "model3d") {
      setSceneConfigMessage("Envie um arquivo 3D para a peca.");
      return;
    }
    setIsLoadoutWardrobeSaving(true);
    try {
      const diagnostics = await inspectWardrobeModelFile(file);
      const url = await uploadSceneAsset(file, {
        folder: `islands/day-${selectedIslandDay}/wardrobe`,
        filename: file.name,
      });
      const next = normalizeLoadoutWardrobe({
        ...loadoutWardrobeDraft,
        library: [
          ...(Array.isArray(loadoutWardrobeDraft?.library) ? loadoutWardrobeDraft.library : []),
          {
            id: `wardrobe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: getAssetFileName(file.name).replace(/\.[^.]+$/, ""),
            slot,
            model_url: url,
            transform: normalizeWardrobeTransform({}),
            auto_rig: false,
            diagnostics,
          },
        ],
      });
      setLoadoutWardrobeDraft(next);
      await patchSceneConfig({ loadout_wardrobe: next });
      setSceneConfigMessage(
        diagnostics?.isSkinned
          ? "Peca 3D adicionada ao wardrobe com skinning detectado."
          : "Peca 3D adicionada ao wardrobe, mas veio como malha estatica."
      );
    } catch {
      setSceneConfigMessage("Nao foi possivel enviar a peca 3D.");
    } finally {
      setIsLoadoutWardrobeSaving(false);
    }
  }, [loadoutWardrobeDraft, loadoutWardrobeUploadSlot, patchSceneConfig, selectedIslandDay]);
  const handleLoadoutBaseModelUploadChange = React.useCallback(async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (detectAssetTypeFromName(file.name) !== "model3d") {
      setSceneConfigMessage("Envie um arquivo 3D para o corpo base.");
      return;
    }
    setIsLoadoutBaseModelSaving(true);
    try {
      const url = await uploadSceneAsset(file, {
        folder: `islands/day-${selectedIslandDay}/loadout-base`,
        filename: file.name,
      });
      setLoadoutBaseModelUrlDraft(url);
      await patchSceneConfig({
        loadout_base_model_url: url,
      });
      setSceneConfigMessage("Corpo base do personagem atualizado.");
    } catch {
      setSceneConfigMessage("Nao foi possivel enviar o corpo base.");
    } finally {
      setIsLoadoutBaseModelSaving(false);
    }
  }, [patchSceneConfig, selectedIslandDay]);
  const handleResetLoadoutBaseModel = React.useCallback(async () => {
    setIsLoadoutBaseModelSaving(true);
    try {
      setLoadoutBaseModelUrlDraft("");
      await patchSceneConfig({
        loadout_base_model_url: "",
      });
      setSceneConfigMessage("Corpo base voltou para o padrao do jogo.");
    } finally {
      setIsLoadoutBaseModelSaving(false);
    }
  }, [patchSceneConfig]);
  const handleSaveLoadoutCameraRig = React.useCallback(async () => {
    const nextRig = normalizeLoadoutCameraRig(loadoutCameraRigDraft);
    setLoadoutCameraRigDraft(nextRig);
    await patchSceneConfig({
      object_overrides: {
        road_base: {
          ...(sceneConfigRef.current?.object_overrides?.road_base || {}),
          loadout_camera_rig: nextRig,
        },
      },
    });
    setIsLoadoutCameraEditMode(false);
    setDevCameraResetToken((prev) => prev + 1);
    setSceneConfigMessage("Enquadramento do personagem salvo.");
  }, [loadoutCameraRigDraft, patchSceneConfig]);
  const handleDevSelectedScreenPosition = React.useCallback((pos) => {
    if (!pos || !Number.isFinite(Number(pos.x)) || !Number.isFinite(Number(pos.y))) {
      setDevMoveGizmoPos(null);
      return;
    }
    const next = { x: Number(pos.x), y: Number(pos.y) };
    setDevMoveGizmoPos((prev) => {
      if (!prev) return next;
      if (Math.abs(prev.x - next.x) < 1 && Math.abs(prev.y - next.y) < 1) return prev;
      return next;
    });
  }, []);

  const selectedObjectOverride = React.useMemo(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return {};
    return getMergedOverride(key);
  }, [devSelectedObject?.key, getMergedOverride]);
  const selectedObjectIsFlowCapable = React.useMemo(() => {
    const t = String(devSelectedObject?.type || "");
    return t === "vegetation" || t === "edge_vegetation" || t === "custom";
  }, [devSelectedObject?.type]);
  const selectedObjectMovementMode = React.useMemo(() => {
    if (!selectedObjectIsFlowCapable) return "anchored";
    return selectedObjectOverride?.movement_mode === "anchored" ? "anchored" : "flow";
  }, [selectedObjectIsFlowCapable, selectedObjectOverride]);
  const selectedObjectDeleteBlocked = React.useMemo(() => {
    return String(devSelectedObject?.key || "") === "road_base";
  }, [devSelectedObject?.key]);
  const selectedObjectIsHorizon = React.useMemo(() => {
    return String(devSelectedObject?.key || "") === "horizon";
  }, [devSelectedObject?.key]);
  const selectedObjectIsProcedural = React.useMemo(() => {
    const mediaType = String(devSelectedObject?.media_type || "").trim();
    const procType = String(devSelectedObject?.procedural_type || "").trim();
    const kind = String(devSelectedObject?.kind || "").trim();
    return mediaType === "procedural" || !!procType || kind === "procedural";
  }, [devSelectedObject?.kind, devSelectedObject?.media_type, devSelectedObject?.procedural_type]);
  const selectedObjectIsRoadProceduralEdge = React.useMemo(() => {
    return String(devSelectedObject?.key || "") === "road_base" && !!devRoadVisualDraft?.proceduralEdgeEnabled;
  }, [devRoadVisualDraft?.proceduralEdgeEnabled, devSelectedObject?.key]);
  const selectedObjectSupportsBrushSculpt = React.useMemo(() => {
    return selectedObjectIsProcedural || selectedObjectIsRoadProceduralEdge;
  }, [selectedObjectIsProcedural, selectedObjectIsRoadProceduralEdge]);
  const selectedObjectIsModel3d = React.useMemo(() => {
    const mediaType = String(devSelectedObject?.media_type || "").trim().toLowerCase();
    const modelUrl = String(devSelectedObject?.model_url || "").trim();
    const kind = String(devSelectedObject?.kind || "").trim().toLowerCase();
    return mediaType === "model3d" || !!modelUrl || kind === "model";
  }, [devSelectedObject?.kind, devSelectedObject?.media_type, devSelectedObject?.model_url]);
  const selectedModelEntry = React.useMemo(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return null;
    const customObjects = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    return customObjects.find((item) => String(item?.key || "") === key) || null;
  }, [devSelectedObject?.key, sceneConfig?.custom_objects]);
  const selectedObjectIsSpecialSegment = React.useMemo(() => {
    const type = String(
      selectedObjectOverride?.special_segment_type ||
      selectedModelEntry?.special_segment_type ||
      devSelectedObject?.special_segment_type ||
      ""
    ).trim();
    return !!type;
  }, [
    devSelectedObject?.special_segment_type,
    selectedModelEntry?.special_segment_type,
    selectedObjectOverride?.special_segment_type,
  ]);
  const selectedObjectCanBindSpecialSegment = React.useMemo(() => {
    const key = String(devSelectedObject?.key || "");
    const type = String(devSelectedObject?.type || "").trim().toLowerCase();
    if (!key || type !== "custom") return false;
    if (key === "road_base" || key === "horizon") return false;
    return true;
  }, [devSelectedObject?.key, devSelectedObject?.type]);
  const selectedSpecialSegmentType = React.useMemo(
    () =>
      String(
        selectedObjectOverride?.special_segment_type ||
        selectedModelEntry?.special_segment_type ||
        devSelectedObject?.special_segment_type ||
        ""
      ).trim(),
    [
      devSelectedObject?.special_segment_type,
      selectedModelEntry?.special_segment_type,
      selectedObjectOverride?.special_segment_type,
    ]
  );
  const selectedSpecialSegmentDefinition = React.useMemo(() => {
    if (!selectedSpecialSegmentType) return null;
    return (
      DEV_SPECIAL_SEGMENT_LIBRARY.find(
        (item) =>
          String(item.type || "").trim() === String(selectedSpecialSegmentType).trim() ||
          String(item.profile || "").trim() === String(
            selectedObjectOverride?.special_profile ||
              selectedModelEntry?.special_profile ||
              devSelectedObject?.special_profile ||
              ""
          ).trim()
      ) || null
    );
  }, [
    DEV_SPECIAL_SEGMENT_LIBRARY,
    devSelectedObject?.special_profile,
    selectedModelEntry?.special_profile,
    selectedObjectOverride?.special_profile,
    selectedSpecialSegmentType,
  ]);
  const handleBindSelectedObjectToSpecialSegment = React.useCallback(
    (segmentId) => {
      const key = String(devSelectedObject?.key || "");
      if (!key) return;
      const definition = DEV_SPECIAL_SEGMENT_LIBRARY.find((item) => item.id === segmentId);
      if (!definition) return;
      persistObjectOverride(key, {
        kind: "special_segment",
        special_segment_type: definition.type,
        special_profile: definition.profile,
        segment_height: Number(definition.segment_height || 0),
        segment_entry_length: Number(definition.segment_entry_length || 0),
        segment_flat_length: Number(definition.segment_flat_length || 0),
        segment_exit_length: Number(definition.segment_exit_length || 0),
        segment_gap_length: Number(definition.segment_gap_length || 0),
        segment_drop_depth: Number(definition.segment_drop_depth || 0),
        segment_logic_offset_z: 0,
        segment_logic_height_offset: 0,
        segment_logic_width: 7.25,
      });
      markDevEdited();
      flushSelectedObjectEditsSoon(key);
      setSceneConfigMessage(
        definition.type === "pit_gap"
          ? "Dados logicos de abismo acoplados ao objeto."
          : "Dados logicos de ponte/trecho elevado acoplados ao objeto."
      );
    },
    [
      DEV_SPECIAL_SEGMENT_LIBRARY,
      devSelectedObject?.key,
      flushSelectedObjectEditsSoon,
      markDevEdited,
      persistObjectOverride,
      setSceneConfigMessage,
    ]
  );
  const handleClearSelectedSpecialSegmentBinding = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    persistObjectOverride(key, {
      kind: "custom",
      special_segment_type: "",
      special_profile: "",
      segment_height: "",
      segment_entry_length: "",
      segment_flat_length: "",
      segment_exit_length: "",
      segment_gap_length: "",
      segment_drop_depth: "",
      segment_logic_offset_z: "",
      segment_logic_height_offset: "",
      segment_logic_width: "",
    });
    markDevEdited();
    flushSelectedObjectEditsSoon(key);
    setSceneConfigMessage("Dados logicos removidos do objeto.");
  }, [
    devSelectedObject?.key,
    flushSelectedObjectEditsSoon,
    markDevEdited,
    persistObjectOverride,
    setSceneConfigMessage,
  ]);
  const handleSelectedSpecialSegmentFieldChange = React.useCallback(
    (field, value) => {
      const key = String(devSelectedObject?.key || "");
      if (!key) return;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      persistObjectOverride(key, { [field]: numeric });
      markDevEdited();
      flushSelectedObjectEditsSoon(key);
    },
    [devSelectedObject?.key, flushSelectedObjectEditsSoon, markDevEdited, persistObjectOverride]
  );
  const handleApplySelectedSpecialSegmentLogic = React.useCallback(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return;
    flushSelectedObjectEditsSoon(key);
    setDevMoveGizmoPos(null);
    setDevSelectedObject(null);
    setSceneConfigMessage("Logica aplicada e salva.");
  }, [devSelectedObject?.key, flushSelectedObjectEditsSoon, setSceneConfigMessage]);
  const selectedModelDiagnostics = React.useMemo(() => {
    if (!selectedObjectIsModel3d) return null;
    const modelUrl = String(devSelectedObject?.model_url || "").trim();
    if (!modelUrl) return null;
    const canonicalName = getCanonicalSceneAssetName(modelUrl);
    const customObjects = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    let duplicateCount = 0;
    customObjects.forEach((item) => {
      const candidateUrl = String(item?.model_url || "").trim();
      if (!candidateUrl) return;
      if (getCanonicalSceneAssetName(candidateUrl) === canonicalName) duplicateCount += 1;
    });
    const nativeMaxDim = Number(devSelectedObject?.model_native_max_dim);
    const autoScaleFactor = Number(devSelectedObject?.model_auto_scale_factor);
    const instancingEligible = !!devSelectedObject?.model_instancing_eligible;
    const instancingCandidate = !!devSelectedObject?.model_instancing_candidate;
    const movementMode = String(
      selectedObjectOverride?.movement_mode || selectedModelEntry?.movement_mode || ""
    ).trim().toLowerCase();
    const isAnchored = movementMode === "anchored";
    const followsRoadCurve = !!selectedObjectOverride?.follow_road_curve;
    const pieceCurveSide = Number(selectedObjectOverride?.model_curve_side ?? selectedModelEntry?.model_curve_side ?? 0);
    const pieceCurveDown = Number(selectedObjectOverride?.model_curve_down ?? selectedModelEntry?.model_curve_down ?? 0);
    const entryTextureUrl = String(selectedModelEntry?.texture_url || "").trim();
    const overrideTextureUrl = String(selectedObjectOverride?.texture_url || "").trim();
    const sideTextures = {
      ...((selectedModelEntry?.side_textures && typeof selectedModelEntry.side_textures === "object")
        ? selectedModelEntry.side_textures
        : {}),
      ...((selectedObjectOverride?.side_textures && typeof selectedObjectOverride.side_textures === "object")
        ? selectedObjectOverride.side_textures
        : {}),
    };
    const hasTextureOverride =
      !!overrideTextureUrl ||
      !!entryTextureUrl ||
      Object.values(sideTextures).some((value) => String(value || "").trim().length > 0);
    const environmentCandidate = isEnvironmentInstancingCandidateName(modelUrl);
    const blockedReasons = [];
    if (!environmentCandidate) blockedReasons.push("nome do arquivo nao parece asset ambiental repetivel");
    if (!isAnchored) blockedReasons.push("objeto nao esta fixado como anchored");
    if (followsRoadCurve) blockedReasons.push("seguir curvatura esta ligado");
    if (Math.abs(pieceCurveSide) > 0.0001 || Math.abs(pieceCurveDown) > 0.0001) {
      blockedReasons.push("curvatura por peca esta ativa");
    }
    if (hasTextureOverride) blockedReasons.push("tem textura override aplicada");
    const gameplayInstancingReady = blockedReasons.length === 0;
    let runtimeLabel = "Individual";
    let runtimeTone = "rose";
    if (instancingCandidate) {
      runtimeLabel = "Instancing ativo";
      runtimeTone = "emerald";
    } else if (gameplayInstancingReady) {
      runtimeLabel = "Instancing no jogo";
      runtimeTone = "amber";
      blockedReasons.push("no editor selecionado ele fica individual para permitir clique e ajuste");
    }
    return {
      canonicalName,
      duplicateCount,
      nativeMaxDim: Number.isFinite(nativeMaxDim) ? nativeMaxDim : null,
      autoScaleFactor: Number.isFinite(autoScaleFactor) ? autoScaleFactor : null,
      instancingEligible,
      instancingCandidate,
      movementMode: isAnchored ? "anchored" : movementMode || "flow",
      followsRoadCurve,
      hasTextureOverride,
      gameplayInstancingReady,
      runtimeLabel,
      runtimeTone,
      blockedReasons,
    };
  }, [
    devSelectedObject?.model_auto_scale_factor,
    devSelectedObject?.model_instancing_eligible,
    devSelectedObject?.model_instancing_candidate,
    devSelectedObject?.model_native_max_dim,
    devSelectedObject?.model_url,
    sceneConfig?.custom_objects,
    selectedModelEntry,
    selectedObjectOverride,
    selectedObjectIsModel3d,
  ]);
  const selectedObjectSupportsRoadShadow = React.useMemo(() => {
    const type = String(devSelectedObject?.type || "");
    return type === "vegetation" || type === "edge_vegetation";
  }, [devSelectedObject?.type]);
  const selectedAnimationStudioData = React.useMemo(() => {
    const key = String(devSelectedObject?.key || "");
    if (!key) return null;
    const merged = getMergedOverride(key) || {};
    return merged?.animation_studio || devSelectedObject?.animation_studio || null;
  }, [devSelectedObject?.animation_studio, devSelectedObject?.key, getMergedOverride]);
  const selectedProceduralEntry = React.useMemo(() => {
    if (!selectedObjectIsProcedural) return null;
    const key = String(devSelectedObject?.key || "");
    if (!key) return null;
    const list = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    return list.find((item) => String(item?.key || "") === key) || null;
  }, [devSelectedObject?.key, sceneConfig?.custom_objects, selectedObjectIsProcedural]);
  const modelerCurrentOffsets = React.useMemo(() => {
    if (devModelViewportMode === "imported") {
      return normalizeOffsetsForUndo(devImportedDraftOffsets);
    }
    if (selectedProceduralEntry) {
      const key = String(selectedProceduralEntry?.key || "");
      const merged = getMergedOverride(key) || {};
      const draft = merged?.procedural_vertex_offsets;
      return {
        ...((selectedProceduralEntry?.procedural_vertex_offsets && typeof selectedProceduralEntry.procedural_vertex_offsets === "object")
          ? selectedProceduralEntry.procedural_vertex_offsets
          : {}),
        ...((draft && typeof draft === "object") ? draft : {}),
      };
    }
    return devModelDraftOffsets;
  }, [devImportedDraftOffsets, devModelDraftOffsets, devModelViewportMode, getMergedOverride, selectedProceduralEntry]);
  const modelerCurrentVertexColors = React.useMemo(() => {
    if (devModelViewportMode === "imported") {
      return normalizeVertexColorsForUndo(devImportedDraftVertexColors);
    }
    if (selectedProceduralEntry) {
      const key = String(selectedProceduralEntry?.key || "");
      const merged = getMergedOverride(key) || {};
      const draft = merged?.procedural_vertex_colors;
      return {
        ...((selectedProceduralEntry?.procedural_vertex_colors && typeof selectedProceduralEntry.procedural_vertex_colors === "object")
          ? normalizeVertexColorsForUndo(selectedProceduralEntry.procedural_vertex_colors)
          : {}),
        ...((draft && typeof draft === "object") ? normalizeVertexColorsForUndo(draft) : {}),
      };
    }
    return normalizeVertexColorsForUndo(devModelDraftVertexColors);
  }, [devImportedDraftVertexColors, devModelDraftVertexColors, devModelViewportMode, getMergedOverride, selectedProceduralEntry]);
  React.useEffect(() => {
    if (!(isModelerOpen && isDevMode && screen === "challenge")) return;
    const key = getModelerHistoryKey();
    const history = modelerHistoryRef.current;
    if (history.key === key && Array.isArray(history.entries) && history.entries.length > 0) return;
    const initialSnapshot = buildModelerHistorySnapshot({
      primitive: devModelPrimitive,
      weldVertices: !!devModelWeldVertices,
      width: devModelWidth,
      height: devModelHeight,
      depth: devModelDepth,
      radiusTop: devModelRadiusTop,
      radiusBottom: devModelRadiusBottom,
      widthSegments: devModelWidthSegments,
      heightSegments: devModelHeightSegments,
      depthSegments: devModelDepthSegments,
      radialSegments: devModelRadialSegments,
      textureUrl: devModelSelectedTexture,
      sideTextures: devModelSideTextures,
      textureSettings: devModelTextureDraft,
      sideTextureSettings: devModelSideTextureSettings,
      offsets: modelerCurrentOffsets,
      vertexColors: modelerCurrentVertexColors,
    });
    modelerHistoryRef.current = {
      key,
      entries: [
        {
          id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          label: "Inicial",
          snapshot: initialSnapshot,
        },
      ],
      cursor: 0,
      suspend: false,
    };
    syncModelerHistoryState();
  }, [
    buildModelerHistorySnapshot,
    devModelDepth,
    devModelDepthSegments,
    devModelHeight,
    devModelHeightSegments,
    devModelPrimitive,
    devModelRadialSegments,
    devModelRadiusBottom,
    devModelRadiusTop,
    devModelSelectedTexture,
    devModelSideTextures,
    devModelSideTextureSettings,
    devModelTextureDraft,
    devModelWeldVertices,
    devModelWidth,
    devModelWidthSegments,
    getModelerHistoryKey,
    isDevMode,
    isModelerOpen,
    modelerCurrentOffsets,
    modelerCurrentVertexColors,
    screen,
    syncModelerHistoryState,
  ]);
  const modelerConfig = React.useMemo(() => {
    if (devModelViewportMode === "imported") {
      return {
        primitive: devModelPrimitive,
        weldVertices: !!devModelWeldVertices,
        width: devModelWidth,
        height: devModelHeight,
        depth: devModelDepth,
        radiusTop: devModelRadiusTop,
        radiusBottom: devModelRadiusBottom,
        widthSegments: devModelWidthSegments,
        heightSegments: devModelHeightSegments,
        depthSegments: devModelDepthSegments,
        radialSegments: devModelRadialSegments,
        textureUrl: String(devImportedTextureOverride || ""),
        sideTextures: {
          front: String(devImportedFrontTexture || ""),
          side: String(devImportedSideTexture || ""),
          back: String(devImportedBackTexture || ""),
        },
        importedTextureProjection: devImportedAppliedTextureSlot,
        importedTextureUseOriginalUv: devImportedTextureUseOriginalUv,
        textureSettings: appliedImportedTextureSettings,
        sideTextureSettings: {},
      };
    }
    if (selectedProceduralEntry) {
      const key = String(selectedProceduralEntry?.key || "");
      const merged = getMergedOverride(key) || {};
      return {
        primitive: String(merged?.procedural_type || selectedProceduralEntry?.procedural_type || "box"),
        weldVertices: !!(merged?.weld_vertices ?? selectedProceduralEntry?.weld_vertices ?? devModelWeldVertices),
        width: merged?.width ?? selectedProceduralEntry?.width ?? devModelWidth,
        height: merged?.height ?? selectedProceduralEntry?.height ?? devModelHeight,
        depth: merged?.depth ?? selectedProceduralEntry?.depth ?? devModelDepth,
        radiusTop: merged?.radius_top ?? selectedProceduralEntry?.radius_top ?? devModelRadiusTop,
        radiusBottom: merged?.radius_bottom ?? selectedProceduralEntry?.radius_bottom ?? devModelRadiusBottom,
        widthSegments: merged?.width_segments ?? selectedProceduralEntry?.width_segments ?? devModelWidthSegments,
        heightSegments: merged?.height_segments ?? selectedProceduralEntry?.height_segments ?? devModelHeightSegments,
        depthSegments: merged?.depth_segments ?? selectedProceduralEntry?.depth_segments ?? devModelDepthSegments,
        radialSegments: merged?.radial_segments ?? selectedProceduralEntry?.radial_segments ?? devModelRadialSegments,
        textureUrl: String(merged?.texture_url || selectedProceduralEntry?.texture_url || devModelSelectedTexture || ""),
        sideTextures: {
          ...((selectedProceduralEntry?.side_textures && typeof selectedProceduralEntry.side_textures === "object")
            ? selectedProceduralEntry.side_textures
            : {}),
          ...((merged?.side_textures && typeof merged.side_textures === "object") ? merged.side_textures : {}),
        },
        textureSettings: normalizeTextureSettings(
          merged?.texture_settings || selectedProceduralEntry?.texture_settings || devModelTextureDraft
        ),
        sideTextureSettings: {
          ...normalizeSideTextureSettings(selectedProceduralEntry?.side_texture_settings),
          ...normalizeSideTextureSettings(merged?.side_texture_settings),
        },
      };
    }
    return {
      primitive: devModelPrimitive,
      weldVertices: !!devModelWeldVertices,
      width: devModelWidth,
      height: devModelHeight,
      depth: devModelDepth,
      radiusTop: devModelRadiusTop,
      radiusBottom: devModelRadiusBottom,
      widthSegments: devModelWidthSegments,
      heightSegments: devModelHeightSegments,
      depthSegments: devModelDepthSegments,
      radialSegments: devModelRadialSegments,
      textureUrl: devModelSelectedTexture,
      sideTextures: devModelSideTextures,
      textureSettings: normalizeTextureSettings(devModelTextureDraft),
      sideTextureSettings: normalizeSideTextureSettings(devModelSideTextureSettings),
    };
  }, [
    devModelDepth,
    devModelDepthSegments,
    devModelHeight,
    devModelHeightSegments,
    devImportedBackTexture,
    devImportedFrontTexture,
    appliedImportedTextureSettings,
    devImportedAppliedTextureSlot,
    devImportedTextureSlot,
    devImportedSideTexture,
    devImportedTextureOverride,
    devModelPrimitive,
    devModelWeldVertices,
    devModelRadialSegments,
    devModelRadiusBottom,
    devModelRadiusTop,
    devModelSelectedTexture,
    devModelSideTextures,
    devModelSideTextureSettings,
    devModelTextureDraft,
    devModelWidth,
    devModelWidthSegments,
    devModelViewportMode,
    getMergedOverride,
    selectedProceduralEntry,
  ]);
  const selectedProceduralPolyCount = React.useMemo(() => {
    if (!selectedObjectIsProcedural) return 0;
    const key = String(devSelectedObject?.key || "");
    if (!key) return 0;
    const list = Array.isArray(sceneConfig?.custom_objects) ? sceneConfig.custom_objects : [];
    const entry = list.find((item) => String(item?.key || "") === key);
    if (!entry) return 0;
    const cached = Number(entry?.poly_count_estimate);
    if (Number.isFinite(cached) && cached > 0) return cached;
    return estimateProceduralPolyCountFromConfig(entry);
  }, [devSelectedObject?.key, sceneConfig?.custom_objects, selectedObjectIsProcedural]);
  React.useEffect(() => {
    if (!(isDevMode && screen === "challenge" && devInteractionMode === "move" && devSelectedObject?.key)) {
      setDevMoveGizmoPos(null);
    }
  }, [devInteractionMode, devSelectedObject?.key, isDevMode, screen]);

  if (phase === "transition") {
    return (
      <div className="fixed inset-0 z-[70] overflow-hidden bg-slate-950">
        <video
          ref={pageEntryLeavesVideoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={folhasTransicaoVideo}
          preload="auto"
          autoPlay
          muted
          playsInline
        />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-950">
        <video
          className="absolute inset-0 h-full w-full object-cover [filter:saturate(1.22)_contrast(1.08)_brightness(1.06)]"
          src={loadoutMenuAnimationVideo}
          preload="auto"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.02)_24%,rgba(2,6,23,0.18)_74%,rgba(2,6,23,0.46)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[32%] bg-gradient-to-t from-black/70 via-black/26 to-transparent" />

        <div className="absolute left-1/2 top-[12%] w-[88%] max-w-md -translate-x-1/2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Daily Event</p>
          <h1 className="mt-2 text-xl font-black text-white">Loading Island Map</h1>
          <p className="mt-2 text-sm text-slate-100/90">
            {loadingStatusText}
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 w-[90%] max-w-lg -translate-x-1/2 rounded-[1.6rem] border border-white/12 bg-black/20 px-4 py-4 text-center">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-cyan-100">Preparing world</span>
            <span className="font-bold text-cyan-300">{loadingProgress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-900/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-300"
              initial={{ width: 0 }}
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const desktopFrameClass = isChallengeScreen && isDevMode
    ? "md:absolute md:left-1/2 md:top-1/2 md:h-[min(88vh,860px)] md:w-[min(46vw,680px)] md:max-h-[860px] md:max-w-[680px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-slate-700/70 md:shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
    : "md:absolute md:left-1/2 md:top-1/2 md:h-[min(86vh,760px)] md:w-[min(56vw,560px)] md:max-h-[760px] md:max-w-[560px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-slate-700/70 md:shadow-[0_24px_90px_rgba(0,0,0,0.45)]";
  const shouldUseDesktopFrame = !shouldUseFullscreenFrame;
  const shouldUseChallengeDevDock = screen === "challenge" && isDevMode;
  const elevatedBridgeDebugControlGroups = [
    {
      title: "Posicao",
      controls: [
        { key: "positionX", label: "X", min: -8, max: 8, step: 0.01 },
        { key: "positionY", label: "Y", min: -4, max: 4, step: 0.01 },
        { key: "positionZ", label: "Z", min: -8, max: 8, step: 0.01 },
      ],
    },
    {
      title: "Rotacao",
      controls: [
        { key: "rotationX", label: "RX", min: -180, max: 180, step: 1 },
        { key: "rotationY", label: "RY", min: -180, max: 180, step: 1 },
        { key: "rotationZ", label: "RZ", min: -180, max: 180, step: 1 },
      ],
    },
    {
      title: "Escala",
      controls: [
        { key: "scaleX", label: "SX", min: 0.05, max: 6, step: 0.01 },
        { key: "scaleY", label: "SY", min: 0.05, max: 6, step: 0.01 },
        { key: "scaleZ", label: "SZ", min: 0.05, max: 6, step: 0.01 },
      ],
    },
  ];
  const handleElevatedBridgeDebugFieldChange = (key, value) => {
    setElevatedBridgeDebugTransform((prev) =>
      normalizeElevatedBridgeDebugTransform({
        ...prev,
        [key]: value,
      })
    );
  };
  const handleResetElevatedBridgeDebugTransform = () => {
    setElevatedBridgeDebugTransform({ ...DEFAULT_ELEVATED_BRIDGE_DEBUG_TRANSFORM });
  };
  const handleSaveElevatedBridgeDebugPreset = () => {
    const payload = normalizeElevatedBridgeDebugTransform(elevatedBridgeDebugTransform);
    try {
      console.log("[runner-dev] wood_bridge preset", payload);
      if (typeof window !== "undefined" && window.navigator?.clipboard?.writeText) {
        window.navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
      }
    } catch {
      // no-op
    }
  };
  const handleDevSpawnBridgeNow = () => {
    const runner = runnerRuntimeStateRef.current;
    if (!runner || screen !== "challenge") return;
    runner.elevatedSegments = [];
    runner.activeElevatedSegmentId = "";
    runner.activeTrackPhase = "ground";
    runner.trackHeight = 0;
    runner.trackHeightVisual = 0;
    runner.nextElevatedSpawnFlow = Math.max(0, Number(runner.worldFlow || 0) - 1);
    setIsRunnerPaused(false);
  };
  const elevatedBridgeDebugPanel = (
    <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/62 p-3 text-[10px] text-cyan-100 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">DEV Ponte</p>
          <p className="mt-1 text-[10px] text-cyan-100/80">wood_bridge / ponte_01.fbx</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDevSpawnBridgeNow}
            className="rounded-full border border-emerald-400/45 bg-emerald-500/12 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100"
          >
            Trazer ponte
          </button>
          <button
            type="button"
            onClick={handleResetElevatedBridgeDebugTransform}
            className="rounded-full border border-cyan-400/45 bg-cyan-500/12 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100"
          >
            Reset
          </button>
        </div>
      </div>
      <p className="text-[10px] text-cyan-100/75">
        Os ajustes afetam a ponte visivel na run. Use `Trazer ponte` para spawnar uma `wood_bridge` imediatamente.
      </p>
      {elevatedBridgeDebugControlGroups.map((group) => (
        <div key={group.title} className="rounded-xl border border-white/10 bg-white/5 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/90">{group.title}</p>
          <div className="space-y-2">
            {group.controls.map((control) => (
              <label key={control.key} className="grid gap-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span>{control.label}</span>
                  <span className="text-cyan-100">{Number(elevatedBridgeDebugTransform[control.key]).toFixed(control.step < 1 ? 2 : 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={String(control.min)}
                    max={String(control.max)}
                    step={String(control.step)}
                    value={String(elevatedBridgeDebugTransform[control.key])}
                    onChange={(event) => handleElevatedBridgeDebugFieldChange(control.key, event.target.value)}
                    className="h-2 flex-1 accent-cyan-400"
                  />
                  <input
                    type="number"
                    min={String(control.min)}
                    max={String(control.max)}
                    step={String(control.step)}
                    value={String(elevatedBridgeDebugTransform[control.key])}
                    onChange={(event) => handleElevatedBridgeDebugFieldChange(control.key, event.target.value)}
                    className="w-20 rounded border border-white/10 bg-slate-900 px-2 py-1 text-right text-[10px] text-slate-100"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/90">Preset atual</p>
        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-200">
          {JSON.stringify(normalizeElevatedBridgeDebugTransform(elevatedBridgeDebugTransform), null, 2)}
        </pre>
      </div>
      <button
        type="button"
        onClick={handleSaveElevatedBridgeDebugPreset}
        className="w-full rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100"
      >
        Salvar preset
      </button>
    </div>
  );
  const selectedMapDevIsland = NODES[mapDevSelectedIslandId] || NODES[0] || null;
  let selectedMapDevIslandPreviewUrl = "";
  if (selectedMapDevIsland) {
    const customUrl = String(selectedMapDevIsland.imageUrl || "").trim();
    if (customUrl) selectedMapDevIslandPreviewUrl = resolveAssetUrl(customUrl);
    else if (selectedMapDevIsland.artKey === "island001") selectedMapDevIslandPreviewUrl = ilhaLevel2OkImage;
    else if (selectedMapDevIsland.artKey === "island002") selectedMapDevIslandPreviewUrl = ilhaLevel2Image;
    else if (selectedMapDevIsland.artKey === "island003") selectedMapDevIslandPreviewUrl = ilhaLevel3Image;
    else if (selectedMapDevIsland.artKey === "island004") selectedMapDevIslandPreviewUrl = ilhaLevel4Image;
  }
  const selectedMapDevIslandPreviewType = detectAssetTypeFromName(selectedMapDevIslandPreviewUrl);
  const mapDevStudioPortal = screen === "map" && isDevMode && selectedMapDevIsland ? createPortal(
    <div className="pointer-events-none fixed inset-0 z-[140]">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/72 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/72 to-transparent" />

      <div className="pointer-events-auto absolute left-4 right-4 top-4 flex items-center justify-between gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/82 px-4 py-3 shadow-[0_16px_50px_rgba(2,6,23,0.35)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Mapa Dev Studio</p>
          <p className="mt-1 text-sm font-black text-white">Editor externo do mapa de ilhas</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/82 p-2 shadow-[0_16px_50px_rgba(2,6,23,0.35)]">
          <button
            type="button"
            onClick={handleAddMapIsland}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950"
          >
            Nova ilha
          </button>
          <button
            type="button"
            onClick={() => setIsDevMode(false)}
            className="rounded-xl border border-rose-400/50 bg-rose-950/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-100"
          >
            Fechar dev
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 top-24 flex w-[23rem] flex-col gap-3">
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-cyan-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Ilha selecionada</p>
              <p className="mt-1 text-lg font-black text-white">{selectedMapDevIsland.day}. {selectedMapDevIsland.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-300">
                {selectedMapDevIsland.locked ? "Bloqueada no mapa" : "Liberada para gameplay"}
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
              selectedMapDevIsland.locked
                ? "border-amber-400/50 bg-amber-900/30 text-amber-100"
                : "border-emerald-400/50 bg-emerald-900/30 text-emerald-100"
            }`}>
              {selectedMapDevIsland.locked ? "Lock" : "Open"}
            </span>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Preview da ilha</p>
              <button
                type="button"
                onClick={() => mapIslandUploadInputRef.current?.click()}
                className="rounded-lg border border-cyan-400/60 bg-cyan-900/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-100"
              >
                {isMapIslandUploading ? "Enviando..." : "Trocar imagem"}
              </button>
            </div>
            {selectedMapDevIslandPreviewUrl ? (
              selectedMapDevIslandPreviewType === "video" ? (
                <video
                  src={selectedMapDevIslandPreviewUrl}
                  className="h-40 w-full rounded-[1rem] border border-white/10 bg-slate-900 object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedMapDevIslandPreviewUrl}
                  alt={`Preview da ilha ${selectedMapDevIsland.day}`}
                  className="h-40 w-full rounded-[1rem] border border-white/10 bg-slate-900 object-cover"
                />
              )
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-[1rem] border border-dashed border-white/12 bg-slate-900/70 text-center text-[11px] leading-5 text-slate-400">
                Nenhuma imagem customizada enviada para esta ilha.
              </div>
            )}
            <p className="mt-2 truncate text-[10px] text-slate-400">
              {selectedMapDevIsland.imageUrl ? getAssetFileName(selectedMapDevIsland.imageUrl) : "Usando arte padrao da ilha"}
            </p>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <label className="grid gap-1 text-[11px]">
              <span className="text-slate-300">Nome</span>
              <input
                value={selectedMapDevIsland.name}
                onChange={(event) => handleUpdateMapIsland(selectedMapDevIsland.id, { name: event.target.value })}
                className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[11px]">
                <span className="text-slate-300">Posição X</span>
                <input
                  type="range"
                  min="0.02"
                  max="0.98"
                  step="0.01"
                  value={String(selectedMapDevIsland.x)}
                  onChange={(event) => handleUpdateMapIsland(selectedMapDevIsland.id, { x: Number(event.target.value) })}
                />
              </label>
              <label className="grid gap-1 text-[11px]">
                <span className="text-slate-300">Posição Y</span>
                <input
                  type="range"
                  min="0.18"
                  max="0.82"
                  step="0.01"
                  value={String(selectedMapDevIsland.y)}
                  onChange={(event) => handleUpdateMapIsland(selectedMapDevIsland.id, { y: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateMapIsland(selectedMapDevIsland.id, { locked: !selectedMapDevIsland.locked })}
                className={`rounded-xl border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  selectedMapDevIsland.locked
                    ? "border-amber-400/60 bg-amber-800/40 text-amber-100"
                    : "border-cyan-400/60 bg-cyan-800/40 text-cyan-100"
                }`}
              >
                {selectedMapDevIsland.locked ? "Desbloquear" : "Bloquear"}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateMapIsland(selectedMapDevIsland.id, { imageUrl: "", artKey: "" })}
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-100"
              >
                Limpar imagem
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveMapIsland(selectedMapDevIsland.id)}
              className="w-full rounded-xl border border-rose-500/60 bg-rose-900/30 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-100"
            >
              Excluir ilha
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 top-24 flex w-[24rem] flex-col gap-3">
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-emerald-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Lista de ilhas</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">Selecione uma ilha para editar nome, posição, lock e arte.</p>
          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {NODES.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  setMapDevSelectedIslandId(node.id);
                  setSelectedIslandId(node.id);
                }}
                className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-[11px] transition ${
                  node.id === selectedMapDevIsland.id
                    ? "border-cyan-400/60 bg-cyan-900/30 text-cyan-100"
                    : "border-slate-700 bg-slate-900/70 text-slate-200"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{node.day}. {node.name}</span>
                  <span className="block text-[10px] text-slate-400">{node.imageUrl ? getAssetFileName(node.imageUrl) : "Arte padrao"}</span>
                </span>
                <span className={node.locked ? "text-amber-300" : "text-emerald-300"}>
                  {node.locked ? "Lock" : "Open"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={mapIslandUploadInputRef}
        type="file"
        accept="image/*,video/*,.webm,.mp4"
        className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-0"
        onChange={handleMapIslandImageUpload}
      />
    </div>,
    document.body
  ) : null;

  const maxLensCameraX = Math.max(1, world.width - size.width / Math.max(zoom, 0.001));
  const maxLensCameraY = Math.max(1, world.height - size.height / Math.max(zoom, 0.001));
  const lensCameraXProgress = Math.max(0, Math.min(1, camera.x / maxLensCameraX));
  const lensCameraYProgress = Math.max(0, Math.min(1, camera.y / maxLensCameraY));
  const binocularParallaxX = (lensCameraXProgress - 0.5) * (isDesktopViewport ? -26 : -16);
  const binocularParallaxY = (lensCameraYProgress - 0.5) * (isDesktopViewport ? -12 : -8);
  const areMapMenusVisible = !isMapLensIntroActive;

  return (
    <div className={`${shouldUseFullscreenFrame ? "fixed inset-0 z-[80]" : "relative h-[100dvh] w-full"} overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.16),transparent_38%),radial-gradient(circle_at_85%_82%,rgba(56,189,248,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_46%,#052e2b_100%)]`}>
      <div className={`${shouldUseFullscreenFrame ? "absolute inset-0" : shouldUseDesktopFrame ? `relative h-full w-full ${desktopFrameClass}` : "relative h-full w-full"} ${isChallengeScreen && isDevMode ? "overflow-visible" : "overflow-hidden"}`}>
      {screen !== "map" ? (
        <>
          <div className={`absolute right-3 z-50 hidden md:flex flex-col items-end gap-2 ${screen === "challenge" ? "top-3" : "top-3"}`}>
            <button
              type="button"
              onClick={() => setIsDevMode((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isDevMode
                  ? "border-emerald-400/80 bg-emerald-900/92 text-emerald-100"
                  : "border-slate-600/80 bg-slate-900/92 text-slate-100"
              }`}
            >
              {isDevMode ? "Dev ON" : "Modo Dev"}
            </button>
          </div>
        </>
      ) : null}

      {screen === "map" ? (
        <>
          <div
            ref={stageRef}
            className="absolute inset-0 transition-[transform,filter]"
            style={{
              transitionDuration: "1450ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              transform: isMapLensIntroActive ? "scale(1.11)" : "scale(1)",
              filter: isMapLensIntroActive ? "blur(18px) saturate(0.82) brightness(0.88)" : "blur(0px) saturate(1) brightness(1)",
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finalizePointer}
              onPointerCancel={finalizePointer}
              onPointerLeave={finalizePointer}
              onWheel={handleWheel}
              className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
            />
          </div>
          <AnimatePresence>
            {activeMapBottomMenu === "islands" ? (
              <motion.div
                key="map-binocular-lens"
                className="pointer-events-none absolute inset-0 z-[39] overflow-hidden"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    backdropFilter: "blur(10px) saturate(1.08) brightness(0.95)",
                    WebkitBackdropFilter: "blur(10px) saturate(1.08) brightness(0.95)",
                    WebkitMaskImage:
                      "radial-gradient(circle at 50% 47%, transparent 0 16.8%, rgba(0,0,0,0.18) 20.5%, black 28.5%, rgba(0,0,0,0.22) 34.5%, transparent 42%)",
                    maskImage:
                      "radial-gradient(circle at 50% 47%, transparent 0 16.8%, rgba(0,0,0,0.18) 20.5%, black 28.5%, rgba(0,0,0,0.22) 34.5%, transparent 42%)",
                    transform: `translate3d(${binocularParallaxX * 0.55}px, ${binocularParallaxY * 0.55}px, 0)`,
                  }}
                />
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_47%,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_15.5%,rgba(190,230,255,0.08)_21%,rgba(9,14,25,0.18)_31%,rgba(255,255,255,0)_43%)]"
                  animate={{
                    opacity: isMapLensIntroActive ? 1 : 0.84,
                    scale: 1,
                    x: binocularParallaxX * 0.4,
                    y: binocularParallaxY * 0.4,
                  }}
                  transition={{ duration: isMapLensIntroActive ? 1.05 : 0.26, ease: "easeOut" }}
                />
                <div className="absolute inset-0 overflow-hidden">
                  <motion.img
                    src={binocularLensOverlayImage}
                    alt=""
                    className="h-full w-full max-w-none object-cover object-center"
                    initial={{
                      opacity: 0,
                      scale: 1.9,
                      x: 0,
                      y: 0,
                      rotate: 0,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1.045,
                      x: binocularParallaxX * 0.4,
                      y: binocularParallaxY * 0.42,
                      rotate: 0,
                    }}
                    transition={{
                      opacity: { duration: 0.16, delay: 0.2, ease: "easeOut" },
                      scale: { duration: 0.86, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
                      x: { duration: 0.28, ease: "easeOut" },
                      y: { duration: 0.28, ease: "easeOut" },
                      rotate: { duration: 0.2, ease: "easeOut" },
                    }}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-[18%] bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.9)_24%,rgba(2,6,23,0.52)_68%,transparent_100%)] transition-[opacity,transform] duration-500 ${activeMapBottomMenu === "islands" && areMapMenusVisible ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`} style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }} />
          <div className={`pointer-events-none absolute inset-x-0 top-0 z-[42] pt-[env(safe-area-inset-top)] transition-[opacity,transform] duration-500 ${activeMapBottomMenu === "islands" && areMapMenusVisible ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"}`} style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <div className="pointer-events-auto w-full bg-[linear-gradient(180deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.78)_62%,rgba(2,6,23,0.42)_100%)] px-3 pb-2 pt-2 shadow-[0_14px_34px_rgba(2,6,23,0.24)] backdrop-blur-md">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 items-start">
                  <button
                    type="button"
                    onClick={() => navigate(createPageUrl("Profile"))}
                    className="flex min-w-0 items-center gap-2 rounded-[1.15rem] border border-white/10 bg-black/32 px-2 py-1.5"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[0.9rem] border border-white/14 bg-[linear-gradient(180deg,#1e293b,#0f172a)]">
                      {playerProfileImageSrc ? (
                        <img src={playerProfileImageSrc} alt={playerHudName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-black text-white">
                          {playerHudInitial}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/16 to-transparent" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="max-w-[7.2rem] truncate text-[11px] font-black uppercase tracking-[0.06em] text-white" style={{ fontFamily: '"Kivara Trial", sans-serif' }}>{playerHudName}</p>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-cyan-300/24 bg-cyan-300/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100" style={{ fontFamily: '"CARAMEL MOCACHINO", sans-serif' }}>
                        <Star className="h-3 w-3" />
                        Level {playerGameLevel}
                      </div>
                      <div className="mt-2 w-[7.4rem] max-w-full">
                        <div className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-100/80">
                          <span>XP</span>
                          <span>
                            {playerXpForNextLevel > 0
                              ? `${playerXpIntoLevel}/${playerXpForNextLevel}`
                              : "MAX"}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#a78bfa,#f59e0b)] transition-[width] duration-300"
                            style={{ width: `${Math.max(6, Math.round(playerXpProgressRatio * 100))}%` }}
                          />
                        </div>
                        <p className="mt-1 max-w-[7.4rem] truncate text-[8px] text-slate-300">
                          {nextCharacterUnlock
                            ? `Proximo: ${nextCharacterUnlock.name} no nivel ${nextCharacterUnlock.unlockLevel}`
                            : playerXpForNextLevel > 0
                              ? `Faltam ${playerXpRemainingToNextLevel} XP`
                              : "Todos os cacadores base liberados"}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-center gap-1 self-center">
                  <div className="flex min-w-0 items-center gap-1.5 rounded-[1rem] border border-white/10 bg-black/32 px-2.5 py-1.5">
                    <Coins className="h-4 w-4 shrink-0 text-amber-300" />
                    <span className="max-w-[4.4rem] truncate text-[10px] font-black text-white" style={{ fontFamily: '"CARAMEL MOCACHINO", sans-serif' }}>{playerGameCoins.toLocaleString("pt-BR")}</span>
                    <button
                      type="button"
                      onClick={() => navigateMapMenu("store")}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition active:scale-[0.92]"
                      title="Abrir loja"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-[1rem] border border-white/10 bg-black/32 px-2.5 py-1.5">
                    <Gem className="h-4 w-4 shrink-0 text-violet-300" />
                    <span className="max-w-[3.5rem] truncate text-[10px] font-black text-white" style={{ fontFamily: '"CARAMEL MOCACHINO", sans-serif' }}>{playerGameDiamonds.toLocaleString("pt-BR")}</span>
                    <button
                      type="button"
                      onClick={() => navigateMapMenu("store")}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition active:scale-[0.92]"
                      title="Abrir loja"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto mt-1.5 flex items-start justify-between px-3">
              <button
                type="button"
                onClick={() => setIsKeyRankingOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-[1rem] border border-amber-200/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(120,53,15,0.16))] px-2.5 py-1.5 shadow-[0_12px_28px_rgba(2,6,23,0.24)] backdrop-blur-md"
                title="Abrir ranking"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(180deg,#fef3c7,#f59e0b)] text-amber-950">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-100/80" style={{ fontFamily: '"Kivara Trial", sans-serif' }}>Chaves</p>
                  <p className="text-[12px] font-black leading-none text-white" style={{ fontFamily: '"CARAMEL MOCACHINO", sans-serif' }}>{playerChestKeys.toLocaleString("pt-BR")}</p>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateMapMenu("alerts")}
                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-black/32 text-slate-100 backdrop-blur-md"
                  title="Alertas"
                >
                  <img src={notificacaoIconeImage} alt="Alertas" className="h-4 w-4 object-contain" loading="eager" decoding="async" />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.9)]" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsGraphicsSettingsOpen(true)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-black/32 text-slate-100 backdrop-blur-md"
                  title="Configuracoes de desempenho"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          {!isMapCanvasPrimed || isMapLoadRevealActive ? (
            <motion.div
              className="pointer-events-none absolute inset-0 z-40 overflow-hidden bg-slate-950"
              initial={false}
              animate={{ opacity: isMapCanvasPrimed ? 0 : 1 }}
              transition={{ duration: 0.52, ease: "easeOut" }}
            >
              <video
                className="absolute inset-0 h-full w-full object-cover [filter:saturate(1.18)_contrast(1.06)_brightness(1.04)]"
                src={loadoutMenuAnimationVideo}
                preload="auto"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.02)_24%,rgba(2,6,23,0.16)_74%,rgba(2,6,23,0.4)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/58 via-black/18 to-transparent" />
            </motion.div>
          ) : null}

          {!isLowPerfMapDevice || !isMapDragging ? (
            <div className={`pointer-events-none absolute inset-0 z-[41] overflow-hidden transition-opacity duration-400 ${areMapMenusVisible ? "opacity-100" : "opacity-0"}`}>
              {MAP_MENU_ATMOSPHERE_PARTICLES.map((particle) => (
                <motion.span
                  key={particle.id}
                  className="absolute rounded-full"
                  style={{
                    left: particle.x,
                    top: particle.y,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    background: particle.color,
                    boxShadow: "0 0 10px rgba(232,255,168,0.34)",
                    filter: "blur(0.15px)",
                  }}
                  initial={{ opacity: 0, y: 4, scale: 0.82 }}
                  animate={{
                    opacity: [0.14, 0.5, 0.2, 0.44, 0.12],
                    y: [4, -3, -8, -4, -11],
                    x: [0, 5, -4, 6, -2, 0],
                    scale: [0.82, 1, 0.88, 1.04, 0.9],
                  }}
                  transition={{
                    duration: particle.duration,
                    delay: particle.delay,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          ) : null}

          <div className={`pointer-events-none absolute inset-0 z-[38] overflow-hidden transition-opacity duration-400 ${areMapMenusVisible ? "opacity-100" : "opacity-0"}`}>
            {MAP_FULL_SCREEN_MENU_ITEMS.map((item) => {
              const isActive = activeMapBottomMenu === item.id;
              const activeIndex = Math.max(0, MAP_FULL_SCREEN_MENU_ORDER.indexOf(activeMapBottomMenu));
              const pageIndex = Math.max(0, MAP_FULL_SCREEN_MENU_ORDER.indexOf(item.id));
              const relativeIndex = pageIndex - activeIndex;
              const isPageVisible = activeMapBottomMenu !== "islands" || isActive;
              const offsetPercent = relativeIndex * 100;
              return (
                <div
                  key={item.id}
                  className={`absolute inset-0 transition-[transform,opacity] duration-300 ${isPageVisible ? "opacity-100" : "opacity-0"}`}
                  style={{
                    transform: `translate3d(${offsetPercent}%, 0, 0)`,
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    pointerEvents: isActive ? "auto" : "none",
                    visibility: isPageVisible ? "visible" : "hidden",
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(251,191,36,0.14),transparent_24%),linear-gradient(180deg,rgba(3,10,24,0.96)_0%,rgba(5,16,34,0.95)_40%,rgba(4,12,27,0.98)_100%)]" />
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.accent}`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.24),transparent_55%)]" />
                  <div
                    className="relative h-full overflow-y-auto px-5 pb-36 pt-24 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    <div className="mx-auto w-full max-w-5xl">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0">
                          <img
                            src={item.icon}
                            alt={item.label}
                            className="h-16 w-16 object-contain drop-shadow-[0_10px_24px_rgba(8,15,30,0.34)]"
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/78">
                            {MAP_MENU_POPUP_COPY[item.id]?.eyebrow}
                          </p>
                          <h2 className="mt-2 text-[2rem] font-black leading-tight text-white">
                            {MAP_MENU_POPUP_COPY[item.id]?.title}
                          </h2>
                          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-300">
                            {MAP_MENU_POPUP_COPY[item.id]?.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {(MAP_MENU_POPUP_COPY[item.id]?.chips || []).map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-100"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div className="mt-8 grid gap-4 md:grid-cols-2">
                        {(MAP_MENU_POPUP_COPY[item.id]?.cards || []).map((card, index) => (
                          <motion.div
                            key={card.title}
                            initial={false}
                            animate={{
                              y: isActive ? 0 : 18 * mapMenuTransitionDirection,
                              opacity: isActive ? 1 : 0.6,
                            }}
                            transition={{ delay: isActive ? 0.04 + index * 0.04 : 0, duration: 0.24 }}
                            className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(2,6,23,0.28)]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[15px] font-black text-white">{card.title}</p>
                              <span className="rounded-full bg-white/8 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                                {card.meta}
                              </span>
                            </div>
                            <p className="mt-3 text-[12px] leading-6 text-slate-300">{card.body}</p>
                          </motion.div>
                        ))}
                      </div>

                      {item.id === "store" ? (
                        <MapStorePanel
                          storeSnapshot={storeCatalogSnapshot}
                          onPurchase={handlePurchaseStoreItem}
                          feedbackMessage={storeFeedbackMessage}
                        />
                      ) : null}

                      {item.id === "collection" ? (
                        <CollectionOverviewPanel
                          collectionSnapshot={collectionSnapshot}
                          onOpenRewardGallery={() => setScreen("rewards")}
                        />
                      ) : null}

                      <div className="mt-8 rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Ação rápida</p>
                            <p className="mt-2 text-[1rem] font-black text-white">{MAP_MENU_POPUP_COPY[item.id]?.action}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigateMapMenu("islands")}
                            className={`rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-[0_14px_28px_rgba(8,15,30,0.24)] bg-gradient-to-r ${item.accent}`}
                          >
                            Voltar para ilhas
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeMapBottomMenu === "islands" && areMapMenusVisible ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[8.9rem] z-[43] flex justify-center px-4">
              <div className="pointer-events-auto flex w-full max-w-[13rem] justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedIsland || selectedIsland.locked) return;
                    openMapIslandLoadout(selectedIsland, {
                      skipFocusZoom: true,
                      soundRef: islandPlayButtonAudioRef,
                      soundVolume: 0.94,
                    });
                  }}
                  disabled={!selectedIsland || selectedIsland.locked}
                  className={`group relative inline-flex min-h-[3.2rem] w-full items-center justify-center overflow-hidden rounded-[1.35rem] border px-4 py-2.5 text-center shadow-[0_16px_30px_rgba(2,6,23,0.24)] transition duration-200 active:scale-[0.985] ${
                    selectedIsland?.locked
                      ? "border-white/10 bg-black/42 text-white/45"
                      : "border-amber-100/55 bg-[linear-gradient(180deg,#fef3c7_0%,#f59e0b_44%,#d97706_100%)] text-amber-950"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.06)_32%,rgba(255,255,255,0)_58%)]" />
                  <div className="relative flex w-full items-center justify-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] ${selectedIsland?.locked ? "bg-white/8 text-white/45" : "bg-amber-50/72 text-amber-700"}`}>
                      <Compass className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.92rem] font-black uppercase tracking-[0.12em]">
                        {selectedIsland?.locked ? "BLOQUEADA" : "JOGAR"}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          <div className={`absolute inset-x-0 bottom-0 z-[42] flex justify-center transition-[opacity,transform] duration-500 ${areMapMenusVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}`}>
            <div className="relative flex min-h-[8.8rem] w-full items-end justify-center overflow-hidden px-2 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.35rem))] pt-3">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.18)_8%,rgba(2,6,23,0.56)_28%,rgba(2,6,23,0.88)_58%,rgba(2,6,23,0.96)_100%)]" />
              </div>
              <div className="flex w-full max-w-[23.4rem] translate-y-[-0.7rem] items-end justify-center gap-0 px-0">
              {MAP_BOTTOM_MENU_ITEMS.map((item) => {
                const isActive = activeMapBottomMenu === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => navigateMapMenu(item.id)}
                    whileTap={{ scale: 0.92, y: 2 }}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      y: isActive ? -1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
                    className="relative flex w-[5.65rem] flex-col items-center justify-end rounded-[1.6rem] px-0 pb-1 pt-1"
                  >
                    <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center">
                      {isActive ? (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute h-[4.7rem] w-[4.7rem] rounded-full bg-white/12 blur-[14px]"
                          initial={false}
                          animate={{ scale: [0.88, 1.08, 0.96], opacity: [0.18, 0.34, 0.22] }}
                          transition={{ duration: 0.36, ease: "easeOut" }}
                        />
                      ) : null}
                      <motion.img
                        src={item.icon}
                        alt={item.label}
                        animate={{
                          scale: isActive ? 1.06 : 1,
                          rotate: isActive ? [0, -2, 1, 0] : 0,
                        }}
                        transition={{
                          scale: { type: "spring", stiffness: 420, damping: 26, mass: 0.72 },
                          rotate: { duration: 0.34, ease: "easeOut" },
                        }}
                        className={`h-[4.9rem] w-[4.9rem] object-contain ${isActive ? "drop-shadow-[0_0_22px_rgba(255,255,255,0.52)]" : "opacity-88"}`}
                        loading="eager"
                        decoding="async"
                      />
                      {isActive ? (
                        <motion.span
                          aria-hidden="true"
                          initial={false}
                          animate={{ scaleX: [0.72, 1.06, 1], opacity: [0.65, 1, 0.9] }}
                          transition={{ duration: 0.28, ease: "easeOut" }}
                          className={`pointer-events-none absolute bottom-0 h-[4px] w-10 rounded-full bg-gradient-to-r ${item.accent}`}
                        />
                      ) : null}
                    </div>
                  </motion.button>
                );
              })}
              </div>
            </div>
          </div>

        </>
      ) : null}

      {screen === "loadout" ? (
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(251,191,36,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#071120_42%,#0f172a_100%)]">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat"
              style={{
                backgroundImage: `url(${backgroundLobbyImage})`,
              }}
            />
            <div
              className="absolute inset-0 z-10"
              style={{
                filter: activeLoadoutPreviewFilter,
              }}
            >
              <React.Suspense fallback={null}>
                <Runner3DScene
                  className="absolute inset-0"
                  mode="result"
                  resultCameraVariant="loadout_hero"
                  isPaused={false}
                  transparentBackground
                  hideEnvironment
                  enableFreeCamera={screen === "loadout" && isDevMode && isLoadoutCameraEditMode}
                  freeCameraPreset={screen === "loadout" && isLoadoutCameraEditMode ? "top" : devCameraPreset}
                  cameraResetToken={devCameraResetToken}
                  runnerState={previewRunnerState}
                  islandTheme={islandTheme}
                  roadCurve={0}
                  bossLane={0}
                  bossDrift={0}
                  bossBump={0}
                  bossTilt={0}
                  sandTextureUrl={null}
                  roadBaseNormalUrl={null}
                  roadBaseRoughnessUrl={null}
                  roadBaseAoUrl={null}
                  treeTextureUrl={null}
                  vegetationTextureUrls={STABLE_EMPTY_ARRAY}
                  edgeVegetationTextureUrls={STABLE_EMPTY_ARRAY}
                  disableAmbientVegetation
                  obstacleTextureUrl={null}
                  horizonTextureUrl={null}
                  roadShoulderTextureUrl={null}
                  roadShoulderNormalUrl={null}
                  roadShoulderRoughnessUrl={null}
                  roadShoulderAoUrl={null}
                  roadSlopeTextureUrl={null}
                  grassTopTextureUrl={null}
                  shadowOverlayTextureUrl={null}
                  sceneConfig={null}
                  loadoutCharacterVariant={selectedCharacterRenderVariant}
                  loadoutBaseModelUrl={activeLoadoutPreviewBaseModelUrl}
                  loadoutCharacterSwapDirection={loadoutPreviewSlideDirection}
                  loadoutCharacterSwapToken={loadoutCharacterSwapToken}
                  graphicsSettings={runnerGraphicsSettings}
                  sceneRenderDraft={null}
                  onDevCameraInteract={screen === "loadout" && isDevMode ? handleDevCameraInteract : undefined}
                  devDraftOverrides={null}
                  loadoutCameraRig={loadoutCameraRigDraft}
                  loadoutWardrobe={activeGameLoadoutWardrobe}
                  loadoutCameraEditMode={screen === "loadout" && isDevMode && isLoadoutCameraEditMode}
                  onLoadoutCameraRigChange={screen === "loadout" && isDevMode ? handleLoadoutCameraRigMarkerChange : undefined}
                  onSceneReady={handleRunnerSceneReady}
                />
              </React.Suspense>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[18%] bg-gradient-to-b from-slate-950/18 via-slate-950/6 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[14%] bg-gradient-to-t from-black/28 via-black/10 to-transparent" />
            <div className="pointer-events-none absolute bottom-[-6%] left-[-8%] z-20 h-[48%] w-[62%] bg-[radial-gradient(circle_at_0%_100%,rgba(2,6,23,0.88)_0%,rgba(2,6,23,0.64)_24%,rgba(2,6,23,0.3)_46%,rgba(2,6,23,0.12)_64%,transparent_84%)] blur-[2px]" />
            <div className="pointer-events-none absolute bottom-[-6%] right-[-8%] z-20 h-[48%] w-[62%] bg-[radial-gradient(circle_at_100%_100%,rgba(2,6,23,0.88)_0%,rgba(2,6,23,0.64)_24%,rgba(2,6,23,0.3)_46%,rgba(2,6,23,0.12)_64%,transparent_84%)] blur-[2px]" />
            <div className="pointer-events-none absolute inset-x-[18%] bottom-0 z-20 h-[16%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(2,6,23,0.16)_0%,rgba(2,6,23,0.08)_38%,transparent_72%)]" />
          </div>

          <div
            className={`pointer-events-none absolute inset-0 z-20 flex flex-col transition-opacity duration-300 ${
              isLoadoutTransitionActive ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <div className="pointer-events-auto flex items-center justify-between">
              <button
                type="button"
                onClick={returnToMap}
                className="ml-3 mt-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-black/26 text-white transition-transform duration-150 ease-out active:scale-[0.94]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="mt-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Preparacao da corrida
              </div>
              <div className="mr-3 mt-3 rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Ilha</p>
                <p className="text-sm font-black text-white">{NODES[selectedIslandId]?.day}</p>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-3 right-3 top-16 z-30 flex flex-col items-end gap-2">
              {isDevMode && showLegacyChallengeDevRail ? (
                <div
                  className="pointer-events-auto h-full max-h-full w-[17rem] overflow-y-auto rounded-[1.2rem] border border-emerald-400/35 bg-black/38 p-3 pr-2 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]"
                  onPointerDown={(event) => handleDragScrollablePointerDown(event, "y")}
                  onClickCapture={handleDragScrollableClickCapture}
                >
                  <div
                    className="sticky top-0 z-10 mb-3 flex cursor-grab items-center justify-center rounded-xl border border-emerald-400/20 bg-black/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200 active:cursor-grabbing"
                    onPointerDown={(event) => handleDragScrollablePointerDown(event, "y")}
                  >
                    Arraste para rolar
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Camera dev</p>
                    <span className="rounded-full border border-emerald-500/50 bg-emerald-900/35 px-2 py-1 text-[10px] font-semibold text-emerald-100">
                      {isLoadoutCameraEditMode ? "Editando" : "Preview"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLoadoutCameraEditMode) {
                        handleCancelLoadoutCameraEdit();
                      } else {
                        handleStartLoadoutCameraEdit();
                      }
                    }}
                    className={`mt-3 w-full rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      isLoadoutCameraEditMode
                        ? "border-emerald-400 bg-emerald-800/60 text-white"
                        : "border-slate-600 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {isLoadoutCameraEditMode ? "Fechar vista aerea" : "Editar enquadramento"}
                  </button>
                  <p className="mt-3 text-[10px] leading-4 text-slate-300">
                    Entre em vista aerea, arraste o marcador azul da camera e o dourado da mira na cena. A altura de cada um fica nos controles abaixo.
                  </p>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Camera lateral X</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.1"
                        value={String(loadoutCameraRigDraft.cameraX)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("cameraX", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Altura da camera</span>
                      <input
                        type="range"
                        min="-1"
                        max="8"
                        step="0.05"
                        value={String(loadoutCameraRigDraft.cameraYOffset)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("cameraYOffset", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Camera profundidade Z</span>
                      <input
                        type="range"
                        min="-16"
                        max="4"
                        step="0.1"
                        value={String(loadoutCameraRigDraft.cameraZ)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("cameraZ", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Mira lateral X</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.1"
                        value={String(loadoutCameraRigDraft.targetX)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("targetX", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Altura da mira</span>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.05"
                        value={String(loadoutCameraRigDraft.targetYOffset)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("targetYOffset", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] text-slate-200">
                      <span>Mira profundidade Z</span>
                      <input
                        type="range"
                        min="-16"
                        max="4"
                        step="0.1"
                        value={String(loadoutCameraRigDraft.targetZ)}
                        onChange={(event) => handleLoadoutCameraRigDraftChange("targetZ", event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleResetLoadoutCameraRig}
                      className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200"
                    >
                      Padrao
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLoadoutCameraRig}
                      className="rounded-xl border border-emerald-400 bg-emerald-800/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
                    >
                      Salvar
                    </button>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-cyan-400/20 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Horizonte</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-300">
                          Ajuste aproximacao, altura e curvatura da imagem do horizonte para fechar melhor o enquadramento.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetLoadoutHorizonDraft}
                        className="rounded-xl border border-cyan-500/50 bg-cyan-950/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-100"
                      >
                        Resetar
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      <label className="grid gap-1 text-[10px] text-slate-200">
                        <span>Aproximar horizonte</span>
                        <input
                          type="range"
                          min="-80"
                          max="40"
                          step="0.5"
                          value={String(loadoutHorizonDraft.z)}
                          onChange={(event) => handleLoadoutHorizonDraftChange("z", event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] text-slate-200">
                        <span>Altura do horizonte</span>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="0.25"
                          value={String(loadoutHorizonDraft.y)}
                          onChange={(event) => handleLoadoutHorizonDraftChange("y", event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] text-slate-200">
                        <span>Escala do horizonte</span>
                        <input
                          type="range"
                          min="0.45"
                          max="2.2"
                          step="0.01"
                          value={String(loadoutHorizonDraft.scale)}
                          onChange={(event) => handleLoadoutHorizonDraftChange("scale", event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] text-slate-200">
                        <span>Curvatura lateral</span>
                        <input
                          type="range"
                          min="-42"
                          max="42"
                          step="0.2"
                          value={String(loadoutHorizonDraft.horizon_curve_side)}
                          onChange={(event) => handleLoadoutHorizonDraftChange("horizon_curve_side", event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] text-slate-200">
                        <span>Curvatura para baixo</span>
                        <input
                          type="range"
                          min="-18"
                          max="22"
                          step="0.2"
                          value={String(loadoutHorizonDraft.horizon_curve_down)}
                          onChange={(event) => handleLoadoutHorizonDraftChange("horizon_curve_down", event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleResetLoadoutHorizonDraft}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200"
                      >
                        Padrao
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveLoadoutHorizonDraft}
                        className="rounded-xl border border-cyan-400 bg-cyan-800/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-emerald-400/20 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Look do personagem</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-300">
                          Mesmo ajuste de exposicao, luz e contraste usado no jogo para voce acertar o visual do corredor.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {[
                        ["exposure", "Exposicao", 0.4, 2.2, 0.01],
                        ["ambientIntensity", "Ambiente", 0, 3, 0.01],
                        ["hemisphereIntensity", "Ceu/chao", 0, 3, 0.01],
                        ["keyIntensity", "Luz principal", 0, 3, 0.01],
                        ["fillIntensity", "Preenchimento", 0, 3, 0.01],
                        ["rimIntensity", "Recorte", 0, 3, 0.01],
                        ["saturation", "Saturacao", 0.2, 2.2, 0.01],
                        ["contrast", "Contraste", 0.4, 2, 0.01],
                        ["brightness", "Brilho final", 0.4, 1.8, 0.01],
                      ].map(([field, label, min, max, step]) => (
                        <label key={field} className="block">
                          <div className="mb-1 flex items-center justify-between text-[10px]">
                            <span className="text-slate-200">{label}</span>
                            <span className="text-emerald-200">{Number(devSceneLightingDraft[field]).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={String(min)}
                            max={String(max)}
                            step={String(step)}
                            value={String(devSceneLightingDraft[field])}
                            onChange={(e) => handleSceneLightingDraftChange(field, e.target.value)}
                            className="h-6 w-full"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleResetSceneLighting}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200"
                      >
                        Reset look
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSceneLighting}
                        className="rounded-xl border border-emerald-400 bg-emerald-800/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
                      >
                        Salvar look
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-amber-400/20 bg-black/20 p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Importar de outra ilha</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-300">
                        Puxa camera, horizonte e look de uma ilha ja configurada e aplica neste loadout.
                      </p>
                    </div>
                    <label className="mt-3 grid gap-1 text-[10px] text-slate-200">
                      <span>Ilha de origem</span>
                      <select
                        value={String(loadoutImportIslandDay)}
                        onChange={(event) => setLoadoutImportIslandDay(Number(event.target.value))}
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-100 outline-none"
                      >
                        {NODES.filter((node) => Number(node?.day) !== Number(selectedIslandDay)).map((node) => (
                          <option key={node.id} value={node.day}>
                            {`Ilha ${node.day} - ${node.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleImportLoadoutFromIsland("camera")}
                        disabled={isLoadoutImporting}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60"
                      >
                        Importar camera
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportLoadoutFromIsland("horizon")}
                        disabled={isLoadoutImporting}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60"
                      >
                        Importar horizonte
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportLoadoutFromIsland("look")}
                        disabled={isLoadoutImporting}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60"
                      >
                        Importar look
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportLoadoutFromIsland("all")}
                        disabled={isLoadoutImporting}
                        className="rounded-xl border border-amber-400 bg-amber-700/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-60"
                      >
                        {isLoadoutImporting ? "Importando..." : "Importar tudo"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-fuchsia-400/20 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Wardrobe Studio</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-300">
                          Organize pecas por slot, ajuste tamanho e monte presets sem virar uma bagunca no painel.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveLoadoutWardrobe()}
                        disabled={isLoadoutWardrobeSaving}
                        className="rounded-xl border border-fuchsia-400 bg-fuchsia-800/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-60"
                      >
                        {isLoadoutWardrobeSaving ? "Salvando..." : "Salvar wardrobe"}
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleLoadoutWardrobeSection("library")}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-fuchsia-100"
                      >
                        <span>Biblioteca de pecas</span>
                        <span>{loadoutWardrobeSectionsOpen.library ? "−" : "+"}</span>
                      </button>
                      {loadoutWardrobeSectionsOpen.library ? (
                        <div className="rounded-[1rem] border border-white/8 bg-black/14 p-3">
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <select
                              value={loadoutWardrobeUploadSlot}
                              onChange={(event) => setLoadoutWardrobeUploadSlot(event.target.value)}
                              className="rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-[11px] text-slate-100 outline-none"
                            >
                              {WARDROBE_SLOT_DEFS.map((slot) => (
                                <option key={slot.key} value={slot.key}>{slot.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleLoadoutWardrobeUploadPick}
                              className="rounded-xl border border-fuchsia-400/60 bg-fuchsia-900/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-fuchsia-100"
                            >
                              Importar 3D
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {WARDROBE_SLOT_DEFS.map((slot) => {
                              const items = wardrobeLibraryBySlot[slot.key] || [];
                              return (
                                <div key={slot.key} className="rounded-xl border border-white/8 bg-black/16 p-2">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">{slot.label}</p>
                                    <span className="text-[9px] text-slate-400">{items.length} pecas</span>
                                  </div>
                                  {items.length ? (
                                    <div className="space-y-1">
                                      {items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/18 px-2 py-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-[11px] font-semibold text-white">{item.name}</p>
                                            <p className="truncate text-[9px] text-slate-400">{getAssetFileName(item.model_url)}</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handlePublishWardrobeLibraryItem(item)}
                                            className="rounded-lg border border-cyan-500/50 bg-cyan-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-100"
                                          >
                                            Publicar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveLoadoutWardrobeItem(item.id)}
                                            className="rounded-lg border border-rose-500/50 bg-rose-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-100"
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">Nenhuma peca nesse slot ainda.</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => toggleLoadoutWardrobeSection("slots")}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-fuchsia-100"
                      >
                        <span>Slots equipados</span>
                        <span>{loadoutWardrobeSectionsOpen.slots ? "−" : "+"}</span>
                      </button>
                      {loadoutWardrobeSectionsOpen.slots ? (
                        <div className="space-y-2 rounded-[1rem] border border-white/8 bg-black/14 p-3">
                          {WARDROBE_SLOT_DEFS.map((slot) => {
                            const equipped = loadoutWardrobeDraft?.equipped?.[slot.key] || null;
                            const items = wardrobeLibraryBySlot[slot.key] || [];
                            const transform = normalizeWardrobeTransform(equipped?.transform);
                            return (
                              <div key={slot.key} className="rounded-xl border border-white/8 bg-black/16 p-3">
                                <label className="grid gap-1 text-[10px] text-slate-200">
                                  <span className="font-semibold uppercase tracking-[0.1em] text-fuchsia-100">{slot.label}</span>
                                  <select
                                    value={String(equipped?.itemId || "")}
                                    onChange={(event) => handleLoadoutWardrobeEquipChange(slot.key, event.target.value)}
                                    className="rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-[11px] text-slate-100 outline-none"
                                  >
                                    <option value="">Sem peca</option>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                  </select>
                                </label>
                                {equipped?.itemId ? (
                                  <div className="mt-3 grid gap-2">
                                    {[
                                      ["offsetX", "Pos X", -3, 3, 0.01],
                                      ["offsetY", "Pos Y", -3, 3, 0.01],
                                      ["offsetZ", "Pos Z", -3, 3, 0.01],
                                      ["rotationX", "Rot X", -180, 180, 1],
                                      ["rotationY", "Rot Y", -180, 180, 1],
                                      ["rotationZ", "Rot Z", -180, 180, 1],
                                      ["scale", "Escala", 0.2, 4, 0.01],
                                    ].map(([field, label, min, max, step]) => (
                                      <label key={field} className="grid gap-1 text-[10px] text-slate-200">
                                        <div className="flex items-center justify-between gap-2">
                                          <span>{label}</span>
                                          <span className="text-fuchsia-200">{Number(transform[field]).toFixed(field === "scale" ? 2 : 2)}</span>
                                        </div>
                                        <input
                                          type="range"
                                          min={String(min)}
                                          max={String(max)}
                                          step={String(step)}
                                          value={String(transform[field])}
                                          onChange={(event) => handleLoadoutWardrobeTransformChange(slot.key, field, event.target.value)}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => toggleLoadoutWardrobeSection("presets")}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-fuchsia-100"
                      >
                        <span>Presets</span>
                        <span>{loadoutWardrobeSectionsOpen.presets ? "−" : "+"}</span>
                      </button>
                      {loadoutWardrobeSectionsOpen.presets ? (
                        <div className="rounded-[1rem] border border-white/8 bg-black/14 p-3">
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                              type="text"
                              value={loadoutWardrobePresetName}
                              onChange={(event) => setLoadoutWardrobePresetName(event.target.value)}
                              placeholder="Nome do preset"
                              className="rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-[11px] text-slate-100 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleSaveLoadoutWardrobePreset}
                              className="rounded-xl border border-fuchsia-400/60 bg-fuchsia-900/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-fuchsia-100"
                            >
                              Criar
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {Array.isArray(loadoutWardrobeDraft?.presets) && loadoutWardrobeDraft.presets.length ? (
                              loadoutWardrobeDraft.presets.map((preset) => (
                                <div key={preset.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/18 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-semibold text-white">{preset.name}</p>
                                    <p className="text-[9px] text-slate-400">Combinação pronta para equipar</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleApplyLoadoutWardrobePreset(preset.id)}
                                      className="rounded-lg border border-emerald-500/50 bg-emerald-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-100"
                                    >
                                      Aplicar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePublishWardrobePreset(preset)}
                                      className="rounded-lg border border-cyan-500/50 bg-cyan-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-100"
                                    >
                                      Publicar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLoadoutWardrobePreset(preset.id)}
                                      className="rounded-lg border border-rose-500/50 bg-rose-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-100"
                                    >
                                      Apagar
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-slate-400">Nenhum preset salvo ainda.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {isDevMode ? createPortal(
              <div className="pointer-events-none fixed inset-0 z-[140]">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.9)_19%,transparent_34%,transparent_66%,rgba(2,6,23,0.9)_81%,rgba(2,6,23,0.94)_100%)]" />
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/72 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/72 to-transparent" />

                <div className="pointer-events-auto absolute left-4 right-4 top-4 flex items-center justify-between gap-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/82 px-4 py-3 shadow-[0_16px_50px_rgba(2,6,23,0.35)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Loadout Dev Studio</p>
                    <p className="mt-1 text-sm font-black text-white">Jogo no centro, controles ao redor</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/82 p-2 shadow-[0_16px_50px_rgba(2,6,23,0.35)]">
                    {[
                      ["wardrobe", "Wardrobe"],
                      ["camera", "Camera"],
                      ["look", "Look"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLoadoutDevStudioTab(key)}
                        className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                          loadoutDevStudioTab === key ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsDevMode(false)}
                      className="rounded-xl border border-rose-400/50 bg-rose-950/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-100"
                    >
                      Fechar dev
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 top-24 flex w-[23rem] flex-col gap-3">
                  {loadoutDevStudioTab === "camera" ? (
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-emerald-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Camera do personagem</p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-300">Vista aerea, marcadores e sliders no mesmo painel.</p>
                        </div>
                        <span className="rounded-full border border-emerald-500/50 bg-emerald-900/35 px-2 py-1 text-[10px] font-semibold text-emerald-100">
                          {isLoadoutCameraEditMode ? "Editando" : "Preview"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isLoadoutCameraEditMode) handleCancelLoadoutCameraEdit();
                          else handleStartLoadoutCameraEdit();
                        }}
                        className={`mt-3 rounded-xl border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          isLoadoutCameraEditMode ? "border-emerald-400 bg-emerald-800/60 text-white" : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {isLoadoutCameraEditMode ? "Fechar vista aerea" : "Editar enquadramento"}
                      </button>
                      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                        {[
                          ["cameraX", "Camera lateral X", -12, 12, 0.1],
                          ["cameraYOffset", "Altura da camera", -1, 8, 0.05],
                          ["cameraZ", "Camera profundidade Z", -16, 4, 0.1],
                          ["targetX", "Mira lateral X", -12, 12, 0.1],
                          ["targetYOffset", "Altura da mira", 0, 8, 0.05],
                          ["targetZ", "Mira profundidade Z", -16, 4, 0.1],
                        ].map(([field, label, min, max, step]) => (
                          <label key={field} className="grid gap-1 text-[11px] text-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <span className="text-emerald-200">{Number(loadoutCameraRigDraft[field]).toFixed(2)}</span>
                            </div>
                            <input type="range" min={String(min)} max={String(max)} step={String(step)} value={String(loadoutCameraRigDraft[field])} onChange={(event) => handleLoadoutCameraRigDraftChange(field, event.target.value)} />
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={handleResetLoadoutCameraRig} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-200">Padrao</button>
                        <button type="button" onClick={handleSaveLoadoutCameraRig} className="rounded-xl border border-emerald-400 bg-emerald-800/60 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">Salvar</button>
                      </div>
                    </div>
                  ) : null}

                  {loadoutDevStudioTab === "look" ? (
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-cyan-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Horizonte</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-300">Ajuste a imagem de fundo em tempo real.</p>
                      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                        {[
                          ["z", "Aproximar horizonte", -80, 40, 0.5],
                          ["y", "Altura do horizonte", -20, 20, 0.25],
                          ["scale", "Escala do horizonte", 0.45, 2.2, 0.01],
                          ["horizon_curve_side", "Curvatura lateral", -42, 42, 0.2],
                          ["horizon_curve_down", "Curvatura para baixo", -18, 22, 0.2],
                        ].map(([field, label, min, max, step]) => (
                          <label key={field} className="grid gap-1 text-[11px] text-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <span className="text-cyan-200">{Number(loadoutHorizonDraft[field]).toFixed(2)}</span>
                            </div>
                            <input type="range" min={String(min)} max={String(max)} step={String(step)} value={String(loadoutHorizonDraft[field])} onChange={(event) => handleLoadoutHorizonDraftChange(field, event.target.value)} />
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={handleResetLoadoutHorizonDraft} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-200">Padrao</button>
                        <button type="button" onClick={handleSaveLoadoutHorizonDraft} className="rounded-xl border border-cyan-400 bg-cyan-800/60 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">Salvar horizonte</button>
                      </div>
                    </div>
                  ) : null}

                  {loadoutDevStudioTab === "wardrobe" ? (
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-fuchsia-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Wardrobe Studio</p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-300">Biblioteca de pecas por slot.</p>
                        </div>
                        <button type="button" onClick={() => handleSaveLoadoutWardrobe()} disabled={isLoadoutWardrobeSaving} className="rounded-xl border border-fuchsia-400 bg-fuchsia-800/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-60">{isLoadoutWardrobeSaving ? "Salvando..." : "Salvar"}</button>
                      </div>
                      <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-950/18 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Corpo base</p>
                        <p className="mt-1 text-[11px] leading-4 text-slate-300">Importe aqui o boneco sem roupa. As pecas do wardrobe entram por cima dele.</p>
                        <p className="mt-2 truncate text-[10px] text-cyan-100/90">
                          {sceneConfig?.loadout_base_model_url ? getAssetFileName(sceneConfig.loadout_base_model_url) : "Usando corpo padrao do jogo"}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label
                            htmlFor="loadout-base-model-upload-input"
                            className={`flex items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-900/30 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-100 ${
                              isLoadoutBaseModelSaving ? "pointer-events-none opacity-60" : "cursor-pointer"
                            }`}
                          >
                            {isLoadoutBaseModelSaving ? "Enviando..." : "Importar corpo base"}
                          </label>
                          <button type="button" onClick={handleResetLoadoutBaseModel} disabled={isLoadoutBaseModelSaving || !sceneConfig?.loadout_base_model_url} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60">Usar padrao</button>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                        <select value={loadoutWardrobeUploadSlot} onChange={(event) => setLoadoutWardrobeUploadSlot(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-[11px] text-slate-100 outline-none [color-scheme:dark]">
                          {WARDROBE_SLOT_DEFS.map((slot) => (
                            <option key={slot.key} value={slot.key} className="bg-slate-950 text-slate-100">{slot.label}</option>
                          ))}
                        </select>
                        <label htmlFor="loadout-wardrobe-upload-input" className="flex cursor-pointer items-center justify-center rounded-xl border border-fuchsia-400/60 bg-fuchsia-900/30 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fuchsia-100">Importar 3D</label>
                      </div>
                      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {WARDROBE_SLOT_DEFS.map((slot) => {
                          const items = wardrobeLibraryBySlot[slot.key] || [];
                          return (
                            <div key={slot.key} className="rounded-xl border border-white/8 bg-black/18 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fuchsia-100">{slot.label}</p>
                                <span className="text-[10px] text-slate-400">{items.length} pecas</span>
                              </div>
                              {items.length ? (
                                <div className="space-y-2">
                                  {items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/18 px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-[11px] font-semibold text-white">{item.name}</p>
                                        <p className="truncate text-[10px] text-slate-400">{getAssetFileName(item.model_url)}</p>
                                        {item.diagnostics ? (
                                          <div className="mt-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1">
                                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${item.diagnostics.isSkinned ? "bg-emerald-500/18 text-emerald-100" : "bg-amber-500/18 text-amber-100"}`}>
                                                {item.diagnostics.isSkinned ? "Skinned" : "Estatica"}
                                              </span>
                                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-slate-300">{item.diagnostics.meshCount} mesh</span>
                                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-slate-300">{item.diagnostics.skinnedMeshCount} skinned</span>
                                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-slate-300">{item.diagnostics.boneCount} bones</span>
                                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-slate-300">{item.diagnostics.animationCount} anim</span>
                                            </div>
                                            <p className="text-[9px] leading-4 text-slate-400">{item.diagnostics.reason}</p>
                                          </div>
                                        ) : null}
                                        {!item.diagnostics?.isSkinned && supportsWardrobeAutoRig(item.slot) ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleLoadoutWardrobeAutoRig(item.id)}
                                            className={`mt-2 rounded-lg border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                                              item.auto_rig
                                                ? "border-emerald-400/60 bg-emerald-900/30 text-emerald-100"
                                                : "border-amber-400/50 bg-amber-900/20 text-amber-100"
                                            }`}
                                          >
                                            {item.auto_rig ? "Auto-rig ON" : "Ativar auto-rig"}
                                          </button>
                                        ) : null}
                                      </div>
                                      <button type="button" onClick={() => handlePublishWardrobeLibraryItem(item)} className="rounded-lg border border-cyan-500/50 bg-cyan-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-100">Publicar</button>
                                      <button type="button" onClick={() => handleRemoveLoadoutWardrobeItem(item.id)} className="rounded-lg border border-rose-500/50 bg-rose-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-100">Remover</button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400">Nenhuma peca nesse slot ainda.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="absolute bottom-4 right-4 top-24 flex w-[25rem] flex-col gap-3">
                  {loadoutDevStudioTab === "wardrobe" ? (
                    <>
                      <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-fuchsia-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Slots equipados</p>
                        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                          {WARDROBE_SLOT_DEFS.map((slot) => {
                            const equipped = loadoutWardrobeDraft?.equipped?.[slot.key] || null;
                            const items = wardrobeLibraryBySlot[slot.key] || [];
                            const equippedItem = items.find((item) => String(item.id) === String(equipped?.itemId || ""));
                            const transform = normalizeWardrobeTransform(equipped?.transform);
                            return (
                              <div key={slot.key} className="rounded-xl border border-white/8 bg-black/18 p-3">
                                <label className="grid gap-2 text-[11px] text-slate-200">
                                  <span className="font-semibold uppercase tracking-[0.1em] text-fuchsia-100">{slot.label}</span>
                                  <select value={String(equipped?.itemId || "")} onChange={(event) => handleLoadoutWardrobeEquipChange(slot.key, event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[11px] text-slate-100 outline-none [color-scheme:dark]">
                                    <option value="" className="bg-slate-950 text-slate-100">Sem peca</option>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id} className="bg-slate-950 text-slate-100">{item.name}</option>
                                    ))}
                                  </select>
                                </label>
                                {equipped?.itemId ? (
                                  <div className="mt-3 grid gap-2">
                                    {equippedItem?.diagnostics ? (
                                      <div className={`rounded-xl border px-3 py-2 text-[10px] leading-4 ${equippedItem.diagnostics.isSkinned ? "border-emerald-400/30 bg-emerald-950/20 text-emerald-100" : "border-amber-400/30 bg-amber-950/20 text-amber-100"}`}>
                                        <p className="font-semibold uppercase tracking-[0.08em]">
                                          {equippedItem.diagnostics.isSkinned ? "Peca com skinning detectado" : "Peca sem skinning"}
                                        </p>
                                        <p className="mt-1">
                                          {equippedItem.diagnostics.reason}
                                        </p>
                                        {!equippedItem.diagnostics.isSkinned && supportsWardrobeAutoRig(slot.key) ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleLoadoutWardrobeAutoRig(equippedItem.id)}
                                            className={`mt-2 rounded-lg border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                                              equippedItem.auto_rig
                                                ? "border-emerald-400/60 bg-emerald-900/30 text-emerald-100"
                                                : "border-amber-400/50 bg-amber-900/20 text-amber-100"
                                            }`}
                                          >
                                            {equippedItem.auto_rig ? "Auto-rig ON" : "Ativar auto-rig"}
                                          </button>
                                        ) : null}
                                        {equippedItem.diagnostics.sampleBones?.length ? (
                                          <p className="mt-1 text-[9px] text-white/70">
                                            Bones: {equippedItem.diagnostics.sampleBones.join(", ")}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {[
                                      ["offsetX", "Pos X", -3, 3, 0.01],
                                      ["offsetY", "Pos Y", -3, 3, 0.01],
                                      ["offsetZ", "Pos Z", -3, 3, 0.01],
                                      ["rotationX", "Rot X", -180, 180, 1],
                                      ["rotationY", "Rot Y", -180, 180, 1],
                                      ["rotationZ", "Rot Z", -180, 180, 1],
                                      ["scale", "Escala", 0.2, 4, 0.01],
                                    ].map(([field, label, min, max, step]) => (
                                      <label key={field} className="grid gap-1 text-[11px] text-slate-200">
                                        <div className="flex items-center justify-between gap-2">
                                          <span>{label}</span>
                                          <span className="text-fuchsia-200">{Number(transform[field]).toFixed(2)}</span>
                                        </div>
                                        <input type="range" min={String(min)} max={String(max)} step={String(step)} value={String(transform[field])} onChange={(event) => handleLoadoutWardrobeTransformChange(slot.key, field, event.target.value)} />
                                      </label>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => handleSaveLoadoutWardrobe(undefined, `${slot.label} salvo no wardrobe.`)}
                                      disabled={isLoadoutWardrobeSaving}
                                      className="mt-2 rounded-xl border border-fuchsia-400/60 bg-fuchsia-900/30 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fuchsia-100 disabled:opacity-60"
                                    >
                                      {isLoadoutWardrobeSaving ? "Salvando..." : `Salvar ${slot.label.toLowerCase()}`}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pointer-events-auto rounded-[1.5rem] border border-fuchsia-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Presets</p>
                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                          <input type="text" value={loadoutWardrobePresetName} onChange={(event) => setLoadoutWardrobePresetName(event.target.value)} placeholder="Nome do preset" className="rounded-xl border border-white/10 bg-black/22 px-3 py-3 text-[11px] text-slate-100 outline-none" />
                          <button type="button" onClick={handleSaveLoadoutWardrobePreset} className="rounded-xl border border-fuchsia-400/60 bg-fuchsia-900/30 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fuchsia-100">Criar</button>
                        </div>
                        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                          {Array.isArray(loadoutWardrobeDraft?.presets) && loadoutWardrobeDraft.presets.length ? (
                            loadoutWardrobeDraft.presets.map((preset) => (
                              <div key={preset.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/18 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-white">{preset.name}</p>
                                  <p className="text-[9px] text-slate-400">Combinacao pronta para equipar</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => handleApplyLoadoutWardrobePreset(preset.id)} className="rounded-lg border border-emerald-500/50 bg-emerald-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-100">Aplicar</button>
                                  <button type="button" onClick={() => handlePublishWardrobePreset(preset)} className="rounded-lg border border-cyan-500/50 bg-cyan-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-100">Publicar</button>
                                  <button type="button" onClick={() => handleRemoveLoadoutWardrobePreset(preset.id)} className="rounded-lg border border-rose-500/50 bg-rose-900/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-100">Apagar</button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400">Nenhum preset salvo ainda.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {loadoutDevStudioTab === "look" ? (
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-emerald-400/35 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Look do personagem</p>
                      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {[
                          ["exposure", "Exposicao", 0.4, 2.2, 0.01],
                          ["ambientIntensity", "Ambiente", 0, 3, 0.01],
                          ["hemisphereIntensity", "Ceu/chao", 0, 3, 0.01],
                          ["keyIntensity", "Luz principal", 0, 3, 0.01],
                          ["fillIntensity", "Preenchimento", 0, 3, 0.01],
                          ["rimIntensity", "Recorte", 0, 3, 0.01],
                          ["saturation", "Saturacao", 0.2, 2.2, 0.01],
                          ["contrast", "Contraste", 0.4, 2, 0.01],
                          ["brightness", "Brilho final", 0.4, 1.8, 0.01],
                        ].map(([field, label, min, max, step]) => (
                          <label key={field} className="grid gap-1 text-[11px] text-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <span className="text-emerald-200">{Number(devSceneLightingDraft[field]).toFixed(2)}</span>
                            </div>
                            <input type="range" min={String(min)} max={String(max)} step={String(step)} value={String(devSceneLightingDraft[field])} onChange={(e) => handleSceneLightingDraftChange(field, e.target.value)} />
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={handleResetSceneLighting} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-200">Reset look</button>
                        <button type="button" onClick={handleSaveSceneLighting} className="rounded-xl border border-emerald-400 bg-emerald-800/60 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">Salvar look</button>
                      </div>
                      <div className="mt-4 rounded-xl border border-amber-400/20 bg-black/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Importar de outra ilha</p>
                        <label className="mt-3 grid gap-1 text-[10px] text-slate-200">
                          <span>Ilha de origem</span>
                          <select value={String(loadoutImportIslandDay)} onChange={(event) => setLoadoutImportIslandDay(Number(event.target.value))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-100 outline-none">
                            {NODES.filter((node) => Number(node?.day) !== Number(selectedIslandDay)).map((node) => (
                              <option key={node.id} value={node.day}>{`Ilha ${node.day} - ${node.name}`}</option>
                            ))}
                          </select>
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => handleImportLoadoutFromIsland("camera")} disabled={isLoadoutImporting} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60">Importar camera</button>
                          <button type="button" onClick={() => handleImportLoadoutFromIsland("horizon")} disabled={isLoadoutImporting} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60">Importar horizonte</button>
                          <button type="button" onClick={() => handleImportLoadoutFromIsland("look")} disabled={isLoadoutImporting} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 disabled:opacity-60">Importar look</button>
                          <button type="button" onClick={() => handleImportLoadoutFromIsland("all")} disabled={isLoadoutImporting} className="rounded-xl border border-amber-400 bg-amber-700/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-60">{isLoadoutImporting ? "Importando..." : "Importar tudo"}</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {loadoutDevStudioTab === "camera" ? (
                    <div className="pointer-events-auto rounded-[1.5rem] border border-amber-400/30 bg-slate-950/84 p-4 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Guia rápido</p>
                      <div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-300">
                        <p>Ajuste primeiro a mira no peito ou rosto.</p>
                        <p>Depois refine profundidade e altura da camera.</p>
                        <p>Se o enquadramento ficar estranho, entre na vista aerea e mova os marcadores.</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="pointer-events-none absolute left-[24.5rem] right-[26.5rem] top-24 flex items-center justify-center">
                  <div className="rounded-full border border-white/10 bg-black/24 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 shadow-[0_10px_30px_rgba(2,6,23,0.3)]">
                    Preview central do personagem
                  </div>
                </div>
                <input
                  ref={wardrobeUploadInputRef}
                  id="loadout-wardrobe-upload-input"
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj,.stl,model/gltf-binary,model/gltf+json,model/stl"
                  className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-0"
                  onClick={(event) => {
                    event.currentTarget.value = "";
                  }}
                  onChange={handleLoadoutWardrobeUploadChange}
                />
                <input
                  ref={loadoutBaseModelInputRef}
                  id="loadout-base-model-upload-input"
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj,.stl,model/gltf-binary,model/gltf+json,model/stl"
                  className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-0"
                  onClick={(event) => {
                    event.currentTarget.value = "";
                  }}
                  onChange={handleLoadoutBaseModelUploadChange}
                />
              </div>,
              document.body
            ) : null}

            <div className={`relative flex-1 ${isLoadoutCameraEditMode ? "pointer-events-none opacity-0" : ""}`}>
              <div className="pointer-events-none absolute left-3 top-56 w-[9.25rem] p-1 text-left">
                <p className="text-[8px] uppercase tracking-[0.18em] text-cyan-200/80">Selecao de corredor</p>
                <h2 className="mt-1.5 text-[0.98rem] font-black leading-tight text-white drop-shadow-[0_8px_20px_rgba(2,6,23,0.45)]">
                  {selectedCharacter.name}
                </h2>
                <p className="mt-1 text-[10px] leading-4 text-slate-200">{selectedSkin.name || selectedSkin.label}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-100/80">
                  {selectedCharacter.role}
                </p>
              </div>

              <div className="pointer-events-none absolute left-3 right-3 top-20 flex items-start justify-between gap-3">
                <div className="w-[34%] max-w-[9rem] rounded-[1.5rem] border border-white/10 bg-black/22 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Loadout</p>
                  <p className="mt-2 text-sm font-black text-white">{selectedPerk.name}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-300">{selectedConsumable.name}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    {equippedPerkIds.length}/{RUNNER_PERK_LOADOUT_LIMIT} perks • Mochila: {selectedBackpackItem?.name || "Nenhuma"}
                  </p>
                </div>
              </div>

              <LoadoutSelectionPanel
                loadoutTab={loadoutTab}
                setLoadoutTab={setLoadoutTab}
                centerLoadoutCarouselItem={centerLoadoutCarouselItem}
                handleDragScrollablePointerDown={handleDragScrollablePointerDown}
                handleDragScrollableClickCapture={handleDragScrollableClickCapture}
                loadoutBackpackItems={loadoutBackpackItems}
                loadoutCharacters={availableCharacters}
                alternateLoadoutCharacter={alternateLoadoutCharacter}
                selectedCharacterId={selectedCharacterId}
                playerGameLevel={playerGameLevel}
                handleSelectLoadoutCharacter={handleSelectLoadoutCharacter}
                selectedWardrobeSlot={selectedWardrobeSlot}
                setSelectedWardrobeSlot={setSelectedWardrobeSlot}
                loadoutSkins={loadoutSkins}
                selectedSkinId={selectedSkinId}
                handleSelectLoadoutSkin={handleSelectLoadoutSkin}
                selectedBackpackItem={selectedBackpackItem}
                handleSelectLoadoutBackpack={handleSelectLoadoutBackpack}
                loadoutConsumables={loadoutConsumables}
                selectedConsumableId={selectedConsumableId}
                selectedConsumable={selectedConsumable}
                handleSelectConsumable={handleSelectConsumable}
                availablePerks={availablePerks}
                equippedPerkIds={equippedPerkIds}
                selectedPerkId={selectedPerkId}
                setSelectedPerkId={setSelectedPerkId}
                selectedPerk={selectedPerk}
                toggleEquippedPerk={toggleEquippedPerk}
                perkLoadoutLimit={RUNNER_PERK_LOADOUT_LIMIT}
                selectedSkin={selectedSkin}
                startChallengeIntro={startChallengeIntro}
              />
            </div>
          </div>

        </div>
      ) : null}

      {screen === "travel" ? (
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-900 via-emerald-900 to-slate-950">
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.12),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.16),transparent_45%)]"
            animate={{ backgroundPosition: ["0% 0%", "50% 100%", "0% 0%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />

          <motion.div
            className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2"
            animate={{ x: ["-40%", "40%", "-10%"], y: ["-10%", "8%", "0%"], rotate: [-4, 4, -2] }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          >
            <div className="h-full w-full rounded-full border border-white/25 bg-white/10" />
          </motion.div>

          <div className="absolute bottom-20 left-1/2 w-[86%] max-w-sm -translate-x-1/2 rounded-xl border border-cyan-300/30 bg-slate-900/75 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Navegando para a ilha</p>
            <p className="mt-1 text-sm font-bold text-white">Preparando cenário do nível...</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/70">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.round(travelProgress * 100)}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      {screen === "island" ? (
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-950 via-emerald-950/80 to-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(56,189,248,0.2),transparent_35%)]" />
          <div className="absolute bottom-[-18%] left-1/2 h-[60%] w-[130%] -translate-x-1/2 rounded-[50%] border border-emerald-300/30 bg-gradient-to-b from-emerald-700/60 via-emerald-900/70 to-slate-950" />
          <div className="absolute bottom-[26%] left-1/2 h-[10%] w-[65%] -translate-x-1/2 rounded-full bg-black/30 blur-2xl" />

          <div className="absolute left-1/2 top-16 w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-cyan-300/30 bg-slate-900/70 p-4 text-center backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
              Ilha {NODES[selectedIslandId]?.day} • {NODES[selectedIslandId]?.name}
            </p>
            <h2 className="mt-1 text-lg font-black text-white">
              {selectedIslandId === dailyIslandId ? "Desafio diario premiado" : "Desafio da ilha"}
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Runner 2.5D prototipo. Colete blocos e desvie dos obstaculos.
            </p>
            <p className="mt-1 text-xs text-cyan-100/90">Ilha diária destacada hoje: {dailyIslandDay}</p>
            {challengeError ? <p className="mt-2 text-xs font-semibold text-amber-300">{challengeError}</p> : null}
            <Button className="mt-4 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={startChallengeIntro}>
              JOGAR AGORA
            </Button>
          </div>

        </div>
      ) : null}

      {isChallengeScreen ? (
        <div
          ref={challengeContainerRef}
          className="absolute inset-0"
          style={{ backgroundColor: islandTheme.sky_top }}
          onDragOver={(event) => {
            if (!(isDevMode && screen === "challenge")) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (!(isDevMode && screen === "challenge")) return;
            event.preventDefault();
            handleChallengeAssetDrop(event);
          }}
        >
          {screen === "challenge" && isDevMode ? (
            devFloatingUiCollapsed ? (
              <button
                type="button"
                aria-label="Mostrar menus flutuantes"
                onClick={() => setDevFloatingUiCollapsed(false)}
                className="absolute left-3 top-3 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/80 bg-slate-950/95 text-xs font-bold text-cyan-100 shadow-xl md:hidden"
              >
                UI
              </button>
            ) : (
              <button
                type="button"
                aria-label="Ocultar menus flutuantes"
                onClick={() => setDevFloatingUiCollapsed(true)}
                className="absolute left-3 top-3 z-[70] rounded-full border border-cyan-500/70 bg-slate-950/90 px-3 py-1 text-[11px] font-semibold text-cyan-100 shadow-lg md:hidden"
              >
                Ocultar UI
              </button>
            )
          ) : null}

          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed
            ? createPortal(
                <div className="pointer-events-none fixed inset-x-0 top-0 z-[138] hidden md:block">
                  <div className="pointer-events-auto mx-auto flex max-w-[calc(100vw-2rem)] items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3 rounded-[1.7rem] border border-cyan-400/30 bg-slate-950/88 px-4 py-3 shadow-[0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Dev Studio do mapa</p>
                        <p className="mt-1 text-[11px] text-slate-300">Menus fixos nas laterais para editar a corrida sem janelas soltas.</p>
                      </div>
                      <div className="h-10 w-px bg-white/10" />
                      <div className="flex items-center gap-2">
                        {[
                          { key: "dev", label: "Painel" },
                          { key: "map", label: "Mapa" },
                          { key: "full_map", label: "Mapa inteiro" },
                          { key: "road", label: "Rua" },
                          { key: "camera", label: "Camera" },
                        ].map((item) => {
                          const isOpen =
                            (item.key === "dev" && !devPanelCollapsed) ||
                            (item.key === "map" && !devConveyorCollapsed) ||
                            (item.key === "full_map" && !devPanelCollapsed && devStageEditMode === "full_map") ||
                            (item.key === "road" && !devRoadPanelCollapsed) ||
                            (item.key === "camera" && !devCameraPanelCollapsed);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                if (item.key === "full_map") {
                                  setDevStageEditMode("full_map");
                                  setDevPanelCollapsed(false);
                                  setDevConveyorCollapsed(false);
                                } else if (item.key === "map") {
                                  setDevStageEditMode("map");
                                  openChallengeDevPanel(item.key);
                                } else {
                                  openChallengeDevPanel(item.key);
                                }
                              }}
                              className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                                isOpen
                                  ? "border-cyan-300 bg-cyan-500/22 text-cyan-50"
                                  : "border-slate-700 bg-slate-900/70 text-slate-300"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setIsElementGalleryOpen(true)}
                          className="rounded-full border border-emerald-500/60 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100"
                        >
                          Galeria
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-[1.4rem] border border-white/10 bg-slate-950/82 px-3 py-2 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl">
                      {sceneConfigMessage ? <span className="max-w-[26rem] truncate text-[11px] text-amber-200">{sceneConfigMessage}</span> : null}
                      <button
                        type="button"
                        onClick={() => setDevFloatingUiCollapsed(true)}
                        className="rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-slate-100"
                      >
                        Ocultar studio
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}

          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed ? (
            <div className="absolute left-1/2 top-11 z-[69] flex -translate-x-1/2 items-center gap-1 rounded-full border border-cyan-500/55 bg-slate-950/92 px-2 py-1 shadow-lg md:hidden">
              {[
                { key: "dev", label: "DEV", open: !devPanelCollapsed, toggle: () => setDevPanelCollapsed((prev) => !prev) },
                { key: "est", label: "EST", open: !devConveyorCollapsed, toggle: () => setDevConveyorCollapsed((prev) => !prev) },
                { key: "rua", label: "RUA", open: !devRoadPanelCollapsed, toggle: () => setDevRoadPanelCollapsed((prev) => !prev) },
                { key: "cam", label: "CAM", open: !devCameraPanelCollapsed, toggle: () => setDevCameraPanelCollapsed((prev) => !prev) },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.toggle}
                  className={`h-7 rounded-full border px-3 text-[10px] font-semibold ${
                    item.open
                      ? "border-cyan-300 bg-cyan-700/70 text-white"
                      : "border-slate-600 bg-slate-900 text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed && !devPanelCollapsed ? (
            shouldUseChallengeDevDock ? createPortal(
            <div
              ref={devPanelRef}
              className="fixed bottom-4 left-4 top-24 z-[139] hidden w-[min(31rem,32vw)] min-w-[24rem] overflow-y-auto rounded-[1.8rem] border border-emerald-400/30 bg-slate-950/90 p-4 text-xs text-emerald-100 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl md:block"
            >
              <div
                role="button"
                tabIndex={0}
                className="mb-3 flex touch-none select-none items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-900/30 px-2 py-1"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  Painel do mapa
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-200/80">fixo</span>
                  <button
                    type="button"
                    onClick={() => setDevPanelCollapsed(true)}
                    className="h-5 w-5 rounded-full border border-emerald-500/60 bg-slate-900/60 text-[11px] text-emerald-100"
                    title="Ocultar painel"
                  >
                    _
                  </button>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Controles rápidos</span>
                    <span className="text-[9px] text-emerald-200/80">{isRunnerPaused ? "Pausado" : "Jogando"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => setIsRunnerPaused((prev) => !prev)}
                    >
                      {isRunnerPaused ? "Continuar (P)" : "Pausar (P)"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => setIsDevFreeCamera((prev) => !prev)}
                    >
                      {isDevFreeCamera ? "Cam livre ON" : "Cam livre OFF"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-8 ${isDevNoCollision ? "border-cyan-400 bg-cyan-900/40 text-cyan-100" : "border-emerald-500 bg-slate-950 text-emerald-100"}`}
                      onClick={() => setIsDevNoCollision((prev) => !prev)}
                    >
                      {isDevNoCollision ? "Sem colisão ON" : "Sem colisão OFF"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => {
                        setDevCameraPreset("player");
                        setDevCameraResetToken((prev) => prev + 1);
                      }}
                    >
                      Reset camera
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Modo de edição</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDevStageEditMode("map")}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                        devStageEditMode === "map"
                          ? "border-cyan-300 bg-cyan-900/40 text-cyan-50"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevStageEditMode("full_map")}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                        devStageEditMode === "full_map"
                          ? "border-cyan-300 bg-cyan-900/40 text-cyan-50"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Mapa inteiro
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-cyan-200/80">
                    {devStageEditMode === "full_map"
                      ? "Visao orbital do ciclo inteiro, sem horizonte, para revisar instancing e segmentos."
                      : "Edicao normal do trecho do mapa, focada no bloco atual."}
                  </p>
                  {devStageEditMode === "full_map" ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-2">
                      <label className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>Janela do ciclo</span>
                          <span className="text-cyan-100">{Number(devMapCursorZ || 0).toFixed(1)}z</span>
                        </div>
                        <input
                          type="range"
                          min={String(-Math.max(80, mapCycleLengthValue))}
                          max="0"
                          step="1"
                          value={String(devMapCursorZ)}
                          onChange={(event) => setDevMapCursorZ(Number(event.target.value) || 0)}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddDevSpecialSegment("wood_bridge")}
                          className="rounded-xl border border-amber-500/60 bg-amber-900/30 px-2 py-2 text-[10px] font-semibold text-amber-100"
                        >
                          Adicionar ponte elevada
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDevSpecialSegment("pit_gap")}
                          className="rounded-xl border border-rose-500/60 bg-rose-900/30 px-2 py-2 text-[10px] font-semibold text-rose-100"
                        >
                          Adicionar abismo
                        </button>
                      </div>
                      <div className="rounded-xl border border-cyan-500/25 bg-slate-950/55 p-2">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Logica da pista</p>
                        <div className="grid grid-cols-2 gap-2">
                          {DEV_LOGIC_SEGMENT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleAddDevLogicPreset(preset.id)}
                              className="rounded-xl border border-cyan-500/50 bg-cyan-950/30 px-2 py-2 text-[10px] font-semibold text-cyan-100"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-cyan-200/80">
                          Esses presets criam apenas a logica invisivel. O 3D visual fica separado.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAllDevBridges}
                        className="w-full rounded-xl border border-rose-500/70 bg-rose-950/40 px-2 py-2 text-[10px] font-semibold text-rose-100"
                      >
                        Apagar todas as pontes do mapa
                      </button>
                      <p className="text-[10px] text-cyan-200/80">
                        "Adicionar ponte elevada" usa o 3D selecionado. "Logica da pista" cria apenas a estrutura de gameplay.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Presets de câmera</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {[
                      { key: "player", label: "Jogador" },
                      { key: "top", label: "Aérea" },
                      { key: "iso", label: "Isométrica" },
                      { key: "classic", label: "Orbital 1" },
                    ].map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          setDevCameraPreset(preset.key);
                          setDevCameraResetToken((prev) => prev + 1);
                        }}
                        className={`rounded-xl border px-2 py-1 text-[10px] font-semibold ${
                          devCameraPreset === preset.key
                            ? "border-emerald-400 bg-emerald-800/60 text-white"
                            : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-emerald-200/80">Velocidade</p>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {[0.25, 0.5, 1, 2].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRunnerTimeScale(value)}
                        className={`rounded border px-1 py-1 text-[11px] ${
                          runnerTimeScale === value
                            ? "border-emerald-400 bg-emerald-800/60 text-white"
                            : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {value}x
                      </button>
                    ))}
                  </div>
                </div>
                {elevatedBridgeDebugPanel}
                <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/62 p-3 text-[10px] text-emerald-200 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Ilha {selectedIslandDay}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={copyFromIslandDay}
                        onChange={(event) => setCopyFromIslandDay(Number(event.target.value) || 1)}
                        className="h-7 w-16 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleCopyFromIsland}
                        className="h-7 flex-1 rounded border border-emerald-500/60 bg-emerald-900/35 px-2 text-[10px]"
                      >
                        Importar de outra ilha
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-cyan-200/90">Clique em um item para abrir o menu de edição no próprio item.</p>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/30 p-2">
                    <p className="text-[10px] font-semibold text-emerald-200">Adicionar elemento</p>
                    <button
                      type="button"
                      onClick={() => setIsElementGalleryOpen(true)}
                      className="mt-1 h-8 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[11px]"
                    >
                      Abrir galeria de elementos
                    </button>
                    <p className="mt-1 text-[10px] text-emerald-300/80">Galeria com prévias, upload e arraste para o mapa.</p>
                    <button
                      type="button"
                      onClick={handleStartEmptyMap}
                      className="mt-2 h-8 w-full rounded border border-amber-500/70 bg-amber-900/35 text-[11px] text-amber-50"
                    >
                      Começar mapa sem elementos
                    </button>
                    <p className="mt-1 text-[10px] text-amber-200/85">
                      Remove tudo sobre a pista e deixa só grama, horizonte, estrada, carro e personagem no padrão.
                    </p>
                  </div>
                  <div className="rounded border border-cyan-500/40 bg-cyan-950/20 p-2">
                    <p className="text-[10px] font-semibold text-cyan-200">Modelador 3D leve</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelerOpen(true);
                        setIsModelerExpanded(true);
                      }}
                      className="mt-1 h-8 w-full rounded border border-cyan-500/70 bg-cyan-900/35 text-[11px]"
                    >
                      Abrir modelador 3D
                    </button>
                    <p className="mt-1 text-[10px] text-cyan-200/85">Primitivas low-poly com textura por lado e contador de polígonos.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-emerald-300">Estrutura 3D</p>
                    <p>`road_base`: piso central</p>
                    <p>`road_shoulder`: lateral da pista</p>
                    <p>`grass_top`: topo da grama</p>
                    <p className="text-emerald-200/80">Mouse: arrastar órbita, scroll zoom, botão direito pan</p>
                    {isSceneConfigLoading ? <p className="text-[10px] text-cyan-200">Carregando ilha...</p> : null}
                    {isSceneConfigSaving ? <p className="text-[10px] text-cyan-200">Salvando...</p> : null}
                    {sceneConfigMessage ? <p className="text-[10px] text-amber-200">{sceneConfigMessage}</p> : null}
                  </div>
                </div>
              <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/55 p-3 text-[10px] text-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold uppercase tracking-[0.18em] text-emerald-200">Cena</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px]">{devSceneRenderDraft.shadowsEnabled ? "Sombras ON" : "Sombras OFF"}</span>
                      <Switch
                        checked={devSceneRenderDraft.shadowsEnabled}
                        onCheckedChange={(checked) => handleSceneRenderDraftChange("shadowsEnabled", checked)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    <p className="text-[10px] text-emerald-200/80">
                      Corte a cena em tempo real. Diminuir esses metros faz o mapa sumir mais cedo e reduz peso no jogo.
                    </p>
                    {[
                      ["masterDistance", "Corte geral da cena", 10, 240, 1],
                      ["vegetationDistance", "Vegetação aparece até", 10, 240, 1],
                      ["roadDistance", "Estrada aparece até", 10, 240, 1],
                      ["objectDistance", "Objetos aparecem até", 10, 200, 1],
                    ].map(([field, label, min, max, step]) => (
                      <label key={field} className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-emerald-200">{Math.round(Number(devSceneRenderDraft[field]) || 0)}m</span>
                        </div>
                        <input
                          type="range"
                          min={String(min)}
                          max={String(max)}
                          step={String(step)}
                          value={String(devSceneRenderDraft[field])}
                          onChange={(event) => handleSceneRenderDraftChange(field, event.target.value)}
                        />
                      </label>
                    ))}
                    <label className="grid gap-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>Distancia do horizonte</span>
                        <span className="text-emerald-200">{Math.round(Number(roadHorizonDistance) || 0)}z</span>
                      </div>
                      <input
                        type="range"
                        min="-260"
                        max="120"
                        step="1"
                        value={String(roadHorizonDistance)}
                        onChange={(event) => handleRoadHorizonDistanceChange(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>Altura do horizonte</span>
                        <span className="text-emerald-200">{Number(roadHorizonHeight || 0).toFixed(1)}y</span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="0.1"
                        value={String(roadHorizonHeight)}
                        onChange={(event) => handleRoadHorizonHeightChange(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    {[
                      ["lightX", "Luz X", -18, 18, 0.2],
                      ["lightY", "Luz Y", 2, 32, 0.2],
                      ["lightZ", "Luz Z", -28, 28, 0.2],
                    ].map(([field, label, min, max, step]) => (
                      <label key={field} className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-emerald-200">{Number(devSceneRenderDraft[field]).toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min={String(min)}
                          max={String(max)}
                          step={String(step)}
                          value={String(devSceneRenderDraft[field])}
                          onChange={(event) => handleSceneRenderDraftChange(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
                    <button
                      type="button"
                      onClick={handleResetSceneRender}
                      className="rounded-xl border border-slate-600 bg-slate-900/80 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-slate-200"
                    >
                      Reset render
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSceneRender}
                      className="rounded-xl border border-emerald-500 bg-emerald-700/60 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      Salvar render
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
            ) : <div
              ref={devPanelRef}
              className="absolute z-40 w-64 rounded-2xl border border-emerald-400/40 bg-slate-950/92 p-3 text-xs text-emerald-100 shadow-[0_20px_60px_rgba(2,6,23,0.45)]"
              style={{
                left: Number.isFinite(devPanelPos.x) ? `${devPanelPos.x}px` : undefined,
                top: Number.isFinite(devPanelPos.y) ? `${devPanelPos.y}px` : undefined,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={handleDevPanelPointerDown}
                className="mb-3 flex cursor-grab touch-none select-none items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-900/30 px-2 py-1 active:cursor-grabbing"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Modo Dev</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-200/80">Arrastar</span>
                  <button
                    type="button"
                    onClick={() => setDevPanelCollapsed(true)}
                    className="h-5 w-5 rounded-full border border-emerald-500/60 bg-slate-900/60 text-[11px] text-emerald-100"
                    title="Ocultar painel"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Controles rápidos</span>
                    <span className="text-[9px] text-emerald-200/80">{isRunnerPaused ? "Pausado" : "Jogando"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => setIsRunnerPaused((prev) => !prev)}
                    >
                      {isRunnerPaused ? "Continuar (P)" : "Pausar (P)"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => setIsDevFreeCamera((prev) => !prev)}
                    >
                      {isDevFreeCamera ? "Cam livre ON" : "Cam livre OFF"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-8 ${isDevNoCollision ? "border-cyan-400 bg-cyan-900/40 text-cyan-100" : "border-emerald-500 bg-slate-950 text-emerald-100"}`}
                      onClick={() => setIsDevNoCollision((prev) => !prev)}
                    >
                      {isDevNoCollision ? "Sem colisão ON" : "Sem colisão OFF"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-500 bg-slate-950 text-emerald-100"
                      onClick={() => {
                        setDevCameraPreset("player");
                        setDevCameraResetToken((prev) => prev + 1);
                      }}
                    >
                      Reset camera
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Modo de edição</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDevStageEditMode("map")}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                        devStageEditMode === "map"
                          ? "border-cyan-300 bg-cyan-900/40 text-cyan-50"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevStageEditMode("full_map")}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                        devStageEditMode === "full_map"
                          ? "border-cyan-300 bg-cyan-900/40 text-cyan-50"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Mapa inteiro
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-cyan-200/80">
                    {devStageEditMode === "full_map"
                      ? "Visao orbital do ciclo inteiro, sem horizonte, para revisar instancing e segmentos."
                      : "Edicao normal do trecho do mapa, focada no bloco atual."}
                  </p>
                  {devStageEditMode === "full_map" ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-2">
                      <label className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>Janela do ciclo</span>
                          <span className="text-cyan-100">{Number(devMapCursorZ || 0).toFixed(1)}z</span>
                        </div>
                        <input
                          type="range"
                          min={String(-Math.max(80, mapCycleLengthValue))}
                          max="0"
                          step="1"
                          value={String(devMapCursorZ)}
                          onChange={(event) => setDevMapCursorZ(Number(event.target.value) || 0)}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddDevSpecialSegment("wood_bridge")}
                          className="rounded-xl border border-amber-500/60 bg-amber-900/30 px-2 py-2 text-[10px] font-semibold text-amber-100"
                        >
                          Adicionar ponte elevada
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDevSpecialSegment("pit_gap")}
                          className="rounded-xl border border-rose-500/60 bg-rose-900/30 px-2 py-2 text-[10px] font-semibold text-rose-100"
                        >
                          Adicionar abismo
                        </button>
                      </div>
                      <div className="rounded-xl border border-cyan-500/25 bg-slate-950/55 p-2">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Logica da pista</p>
                        <div className="grid grid-cols-2 gap-2">
                          {DEV_LOGIC_SEGMENT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleAddDevLogicPreset(preset.id)}
                              className="rounded-xl border border-cyan-500/50 bg-cyan-950/30 px-2 py-2 text-[10px] font-semibold text-cyan-100"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-cyan-200/80">
                          Esses presets criam apenas a logica invisivel. O 3D visual fica separado.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAllDevBridges}
                        className="w-full rounded-xl border border-rose-500/70 bg-rose-950/40 px-2 py-2 text-[10px] font-semibold text-rose-100"
                      >
                        Apagar todas as pontes do mapa
                      </button>
                      <p className="text-[10px] text-cyan-200/80">
                        "Adicionar ponte elevada" usa o 3D selecionado. "Logica da pista" cria apenas a estrutura de gameplay.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Presets de câmera</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {[
                      { key: "player", label: "Jogador" },
                      { key: "top", label: "Aérea" },
                      { key: "iso", label: "Isométrica" },
                      { key: "classic", label: "Orbital 1" },
                    ].map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          setDevCameraPreset(preset.key);
                          setDevCameraResetToken((prev) => prev + 1);
                        }}
                        className={`rounded-xl border px-2 py-1 text-[10px] font-semibold ${
                          devCameraPreset === preset.key
                            ? "border-emerald-400 bg-emerald-800/60 text-white"
                            : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-emerald-200/80">Velocidade</p>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {[0.25, 0.5, 1, 2].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRunnerTimeScale(value)}
                        className={`rounded border px-1 py-1 text-[11px] ${
                          runnerTimeScale === value
                            ? "border-emerald-400 bg-emerald-800/60 text-white"
                            : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {value}x
                      </button>
                    ))}
                  </div>
                </div>
                {elevatedBridgeDebugPanel}
                <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/62 p-3 text-[10px] text-emerald-200 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Ilha {selectedIslandDay}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={copyFromIslandDay}
                        onChange={(event) => setCopyFromIslandDay(Number(event.target.value) || 1)}
                        className="h-7 w-16 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleCopyFromIsland}
                        className="h-7 flex-1 rounded border border-emerald-500/60 bg-emerald-900/35 px-2 text-[10px]"
                      >
                        Importar de outra ilha
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-cyan-200/90">Clique em um item para abrir o menu de edição no próprio item.</p>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/30 p-2">
                    <p className="text-[10px] font-semibold text-emerald-200">Adicionar elemento</p>
                    <button
                      type="button"
                      onClick={() => setIsElementGalleryOpen(true)}
                      className="mt-1 h-8 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[11px]"
                    >
                      Abrir galeria de elementos
                    </button>
                    <p className="mt-1 text-[10px] text-emerald-300/80">Galeria com prévias, upload e arraste para o mapa.</p>
                    <button
                      type="button"
                      onClick={handleStartEmptyMap}
                      className="mt-2 h-8 w-full rounded border border-amber-500/70 bg-amber-900/35 text-[11px] text-amber-50"
                    >
                      Começar mapa sem elementos
                    </button>
                    <p className="mt-1 text-[10px] text-amber-200/85">
                      Remove tudo sobre a pista e deixa só grama, horizonte, estrada, carro e personagem no padrão.
                    </p>
                  </div>
                  <div className="rounded border border-cyan-500/40 bg-cyan-950/20 p-2">
                    <p className="text-[10px] font-semibold text-cyan-200">Modelador 3D leve</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelerOpen(true);
                        setIsModelerExpanded(true);
                      }}
                      className="mt-1 h-8 w-full rounded border border-cyan-500/70 bg-cyan-900/35 text-[11px]"
                    >
                      Abrir modelador 3D
                    </button>
                    <p className="mt-1 text-[10px] text-cyan-200/85">Primitivas low-poly com textura por lado e contador de polígonos.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-emerald-300">Estrutura 3D</p>
                    <p>`road_base`: piso central</p>
                    <p>`road_shoulder`: lateral da pista</p>
                    <p>`grass_top`: topo da grama</p>
                    <p className="text-emerald-200/80">Mouse: arrastar órbita, scroll zoom, botão direito pan</p>
                    {isSceneConfigLoading ? <p className="text-[10px] text-cyan-200">Carregando ilha...</p> : null}
                    {isSceneConfigSaving ? <p className="text-[10px] text-cyan-200">Salvando...</p> : null}
                    {sceneConfigMessage ? <p className="text-[10px] text-amber-200">{sceneConfigMessage}</p> : null}
                  </div>
                </div>
              <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/55 p-3 text-[10px] text-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold uppercase tracking-[0.18em] text-emerald-200">Cena</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px]">{devSceneRenderDraft.shadowsEnabled ? "Sombras ON" : "Sombras OFF"}</span>
                      <Switch
                        checked={devSceneRenderDraft.shadowsEnabled}
                        onCheckedChange={(checked) => handleSceneRenderDraftChange("shadowsEnabled", checked)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    <p className="text-[10px] text-emerald-200/80">
                      Corte a cena em tempo real. Diminuir esses metros faz o mapa sumir mais cedo e reduz peso no jogo.
                    </p>
                    {[
                      ["masterDistance", "Corte geral da cena", 10, 240, 1],
                      ["vegetationDistance", "Vegetação aparece até", 10, 240, 1],
                      ["roadDistance", "Estrada aparece até", 10, 240, 1],
                      ["objectDistance", "Objetos aparecem até", 10, 200, 1],
                    ].map(([field, label, min, max, step]) => (
                      <label key={field} className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-emerald-200">{Math.round(Number(devSceneRenderDraft[field]) || 0)}m</span>
                        </div>
                        <input
                          type="range"
                          min={String(min)}
                          max={String(max)}
                          step={String(step)}
                          value={String(devSceneRenderDraft[field])}
                          onChange={(event) => handleSceneRenderDraftChange(field, event.target.value)}
                        />
                      </label>
                    ))}
                    <label className="grid gap-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>Distancia do horizonte</span>
                        <span className="text-emerald-200">{Math.round(Number(roadHorizonDistance) || 0)}z</span>
                      </div>
                      <input
                        type="range"
                        min="-260"
                        max="120"
                        step="1"
                        value={String(roadHorizonDistance)}
                        onChange={(event) => handleRoadHorizonDistanceChange(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>Altura do horizonte</span>
                        <span className="text-emerald-200">{Number(roadHorizonHeight || 0).toFixed(1)}y</span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="0.1"
                        value={String(roadHorizonHeight)}
                        onChange={(event) => handleRoadHorizonHeightChange(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    {[
                      ["lightX", "Luz X", -18, 18, 0.2],
                      ["lightY", "Luz Y", 2, 32, 0.2],
                      ["lightZ", "Luz Z", -28, 28, 0.2],
                    ].map(([field, label, min, max, step]) => (
                      <label key={field} className="grid gap-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-emerald-200">{Number(devSceneRenderDraft[field]).toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min={String(min)}
                          max={String(max)}
                          step={String(step)}
                          value={String(devSceneRenderDraft[field])}
                          onChange={(event) => handleSceneRenderDraftChange(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
                    <button
                      type="button"
                      onClick={handleResetSceneRender}
                      className="rounded-xl border border-slate-600 bg-slate-900/80 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-slate-200"
                    >
                      Reset render
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSceneRender}
                      className="rounded-xl border border-emerald-500 bg-emerald-700/60 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      Salvar render
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed && !devConveyorCollapsed ? (
            shouldUseChallengeDevDock ? createPortal(
            <div
              ref={devConveyorRef}
              className="fixed bottom-4 left-4 top-24 z-[139] hidden w-[min(28rem,30vw)] min-w-[23rem] overflow-y-auto rounded-[1.8rem] border border-cyan-400/30 bg-slate-950/90 p-4 text-xs text-cyan-100 backdrop-blur-xl md:block"
            >
              <div
                role="button"
                tabIndex={0}
                className="mb-2 flex touch-none select-none items-center justify-between rounded border border-cyan-500/40 bg-cyan-900/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200"
              >
                <span>Mapa</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300/80">fixo</span>
                  <button
                    type="button"
                    onClick={() => setDevConveyorCollapsed(true)}
                    className="h-5 rounded border border-cyan-500/60 bg-cyan-900/25 px-1 text-[10px] text-cyan-100"
                    title="Ocultar painel"
                  >
                    _
                  </button>
                </div>
              </div>
              <div className="mt-1 rounded border border-cyan-500/35 bg-slate-900/60 px-2 py-1 text-[10px] text-cyan-100">
                {`Janela do mapa em Z: ${Number(devMapCursorZ || 0).toFixed(1)}`}
              </div>
              <div className="mt-1 rounded border border-amber-500/35 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-100">
                {liveCycleStatus.isRunning
                  ? `Play no ciclo: Z ${liveCycleStatus.worldZ.toFixed(1)} • ${liveCycleStatus.percent.toFixed(1)}% • faltam ${liveCycleStatus.remaining.toFixed(1)}`
                  : `Posicao no ciclo: Z ${liveCycleStatus.worldZ.toFixed(1)} • ${liveCycleStatus.percent.toFixed(1)}%`}
              </div>
              <div className="mt-1 rounded border border-emerald-500/35 bg-emerald-950/20 p-2">
                <p className="text-[10px] font-semibold text-emerald-200">Ciclo do mapa</p>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-1">
                  <input
                    type="number"
                    min="80"
                    max="5000"
                    step="10"
                    value={devMapCycleLength}
                    onChange={(event) => setDevMapCycleLength(event.target.value)}
                    className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                    placeholder="Comprimento"
                  />
                  <button
                    type="button"
                    onClick={handleSaveMapCycleLength}
                    className="h-7 rounded border border-emerald-500/70 bg-emerald-900/35 px-2 text-[10px] text-emerald-100"
                  >
                    Salvar
                  </button>
                </div>
                <p className="mt-1 text-[9px] text-emerald-200/85">
                  O ciclo vai de `Z 0` ate `Z -{mapCycleLengthValue.toFixed(0)}`.
                </p>
              </div>
              <p className="mt-1 text-[9px] text-cyan-300/85">
                Modo mapa: os elementos ficam presos no trecho salvo. Use os botoes para navegar e construir por partes.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onPointerDown={(event) => startDevConveyorHold(-1, event)}
                  onPointerUp={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerCancel={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerLeave={(event) => stopDevConveyorHold(event.pointerId)}
                  className="h-8 rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                >
                  {"<< Voltar trecho"}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startDevConveyorHold(1, event)}
                  onPointerUp={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerCancel={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerLeave={(event) => stopDevConveyorHold(event.pointerId)}
                  className="h-8 rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                >
                  {"Trecho >>"}
                </button>
              </div>
            </div>,
            document.body
            ) : <div
              ref={devConveyorRef}
              className="absolute z-40 w-36 rounded-xl border border-cyan-500/50 bg-slate-950/92 p-2 text-xs text-cyan-100"
              style={{
                left: Number.isFinite(devConveyorPos.x) ? `${devConveyorPos.x}px` : undefined,
                top: Number.isFinite(devConveyorPos.y) ? `${devConveyorPos.y}px` : undefined,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={handleDevConveyorPointerDown}
                className="mb-2 flex cursor-grab touch-none select-none items-center justify-between rounded border border-cyan-500/40 bg-cyan-900/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 active:cursor-grabbing"
              >
                <span>Mapa</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300/80">arrastar</span>
                  <button
                    type="button"
                    onClick={() => setDevConveyorCollapsed(true)}
                    className="h-5 rounded border border-cyan-500/60 bg-cyan-900/25 px-1 text-[10px] text-cyan-100"
                    title="Ocultar painel"
                  >
                    _
                  </button>
                </div>
              </div>
              <div className="mt-1 rounded border border-cyan-500/35 bg-slate-900/60 px-2 py-1 text-[10px] text-cyan-100">
                {`Janela do mapa em Z: ${Number(devMapCursorZ || 0).toFixed(1)}`}
              </div>
              <div className="mt-1 rounded border border-amber-500/35 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-100">
                {liveCycleStatus.isRunning
                  ? `Play no ciclo: Z ${liveCycleStatus.worldZ.toFixed(1)} • ${liveCycleStatus.percent.toFixed(1)}% • faltam ${liveCycleStatus.remaining.toFixed(1)}`
                  : `Posicao no ciclo: Z ${liveCycleStatus.worldZ.toFixed(1)} • ${liveCycleStatus.percent.toFixed(1)}%`}
              </div>
              <div className="mt-1 rounded border border-emerald-500/35 bg-emerald-950/20 p-2">
                <p className="text-[10px] font-semibold text-emerald-200">Ciclo do mapa</p>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-1">
                  <input
                    type="number"
                    min="80"
                    max="5000"
                    step="10"
                    value={devMapCycleLength}
                    onChange={(event) => setDevMapCycleLength(event.target.value)}
                    className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                    placeholder="Comprimento"
                  />
                  <button
                    type="button"
                    onClick={handleSaveMapCycleLength}
                    className="h-7 rounded border border-emerald-500/70 bg-emerald-900/35 px-2 text-[10px] text-emerald-100"
                  >
                    Salvar
                  </button>
                </div>
                <p className="mt-1 text-[9px] text-emerald-200/85">
                  O ciclo vai de `Z 0` ate `Z -{mapCycleLengthValue.toFixed(0)}`.
                </p>
              </div>
              <p className="mt-1 text-[9px] text-cyan-300/85">
                Modo mapa: os elementos ficam presos no trecho salvo. Use os botoes para navegar e construir por partes.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onPointerDown={(event) => startDevConveyorHold(-1, event)}
                  onPointerUp={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerCancel={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerLeave={(event) => stopDevConveyorHold(event.pointerId)}
                  className="h-8 rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                >
                  {"<< Voltar trecho"}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startDevConveyorHold(1, event)}
                  onPointerUp={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerCancel={(event) => stopDevConveyorHold(event.pointerId)}
                  onPointerLeave={(event) => stopDevConveyorHold(event.pointerId)}
                  className="h-8 rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                >
                  {"Trecho >>"}
                </button>
              </div>
            </div>
          ) : null}
          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed && !devRoadPanelCollapsed ? (() => {
            const roadPanelNode = (
            <div
              ref={devRoadPanelRef}
              className={`z-40 overflow-y-auto rounded-xl border border-fuchsia-500/50 bg-slate-950/92 p-2 text-xs text-fuchsia-100 ${
                shouldUseChallengeDevDock
                  ? "fixed bottom-4 left-4 top-24 hidden w-[min(33rem,34vw)] min-w-[25rem] rounded-[1.8rem] border-fuchsia-400/30 bg-slate-950/90 p-4 backdrop-blur-xl md:block"
                  : "absolute max-h-[72vh] w-64"
              }`}
              style={{
                left: shouldUseChallengeDevDock ? undefined : (Number.isFinite(devRoadPanelPos.x) ? `${devRoadPanelPos.x}px` : undefined),
                top: shouldUseChallengeDevDock ? undefined : (Number.isFinite(devRoadPanelPos.y) ? `${devRoadPanelPos.y}px` : undefined),
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={shouldUseChallengeDevDock ? undefined : handleDevRoadPanelPointerDown}
                className={`mb-2 flex touch-none select-none items-center justify-between rounded border border-fuchsia-500/40 bg-fuchsia-900/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-fuchsia-200 ${
                  shouldUseChallengeDevDock ? "" : "cursor-grab active:cursor-grabbing"
                }`}
              >
                <span>Modelar estrada</span>
                <div className="flex items-center gap-2">
                  <span className="text-fuchsia-300/80">{shouldUseChallengeDevDock ? "fixo" : "arrastar"}</span>
                  <button
                    type="button"
                    onClick={() => setDevRoadPanelCollapsed(true)}
                    className="h-5 rounded border border-fuchsia-500/60 bg-fuchsia-900/25 px-1 text-[10px] text-fuchsia-100"
                    title="Ocultar painel"
                  >
                    _
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-fuchsia-200/85">
                Curvas fortes, esticar profundidade e subida/descida por trecho.
              </p>
              <div className="mt-2 space-y-1 rounded border border-fuchsia-500/30 bg-slate-900/55 p-2">
                <button type="button" onClick={() => handleToggleRoadSection("curve")} className="flex h-7 w-full items-center justify-between rounded border border-fuchsia-500/50 bg-fuchsia-900/20 px-2 text-[10px] font-semibold text-fuchsia-200">
                  <span>Curvas</span>
                  <span>{devRoadSectionsOpen.curve ? "Ocultar" : "Abrir"}</span>
                </button>
                {devRoadSectionsOpen.curve ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-fuchsia-200">Curva extra</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("curveExtra", -1, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-fuchsia-500/60 bg-fuchsia-900/35 text-[11px]">-</button>
                      <input type="number" step="0.1" value={String(devRoadSculptDraft.curveExtra)} onChange={(e) => handleRoadSculptDraftChange("curveExtra", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("curveExtra", 1, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-fuchsia-500/60 bg-fuchsia-900/35 text-[11px]">+</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <input type="number" step="1" value={String(devRoadSculptDraft.curveStartZ)} onChange={(e) => handleRoadSculptDraftChange("curveStartZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" placeholder="Inicio Z" />
                      <input type="number" step="1" value={String(devRoadSculptDraft.curveFadeZ)} onChange={(e) => handleRoadSculptDraftChange("curveFadeZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" placeholder="Faixa" />
                    </div>
                    <p className="pt-1 text-[10px] font-semibold text-fuchsia-200">Curva global (mapa todo)</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("curveGlobal", -1, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-fuchsia-500/60 bg-fuchsia-900/35 text-[11px]">-</button>
                      <input type="number" step="0.5" value={String(devRoadSculptDraft.curveGlobal)} onChange={(e) => handleRoadSculptDraftChange("curveGlobal", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("curveGlobal", 1, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-fuchsia-500/60 bg-fuchsia-900/35 text-[11px]">+</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 space-y-1 rounded border border-cyan-500/30 bg-slate-900/55 p-2">
                <button type="button" onClick={() => handleToggleRoadSection("grade")} className="flex h-7 w-full items-center justify-between rounded border border-cyan-500/50 bg-cyan-900/20 px-2 text-[10px] font-semibold text-cyan-200">
                  <span>Subidas/Descidas</span>
                  <span>{devRoadSectionsOpen.grade ? "Ocultar" : "Abrir"}</span>
                </button>
                {devRoadSectionsOpen.grade ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-cyan-200">Subida / descida</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("dropExtra", -0.2, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">-</button>
                      <input type="number" step="0.1" value={String(devRoadSculptDraft.dropExtra)} onChange={(e) => handleRoadSculptDraftChange("dropExtra", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("dropExtra", 0.2, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">+</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <input type="number" step="1" value={String(devRoadSculptDraft.dropStartZ)} onChange={(e) => handleRoadSculptDraftChange("dropStartZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" placeholder="Inicio Z" />
                      <input type="number" step="1" value={String(devRoadSculptDraft.dropFadeZ)} onChange={(e) => handleRoadSculptDraftChange("dropFadeZ", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" placeholder="Faixa" />
                    </div>
                    <p className="pt-1 text-[10px] font-semibold text-cyan-200">Subida/descida global</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("gradeGlobal", -0.5, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">-</button>
                      <input type="number" step="0.1" value={String(devRoadSculptDraft.gradeGlobal)} onChange={(e) => handleRoadSculptDraftChange("gradeGlobal", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("gradeGlobal", 0.5, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">+</button>
                    </div>
                    <p className="pt-1 text-[10px] font-semibold text-cyan-200">Inclinação no horizonte</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("gradeHorizonBoost", -0.2, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">-</button>
                      <input type="number" step="0.1" value={String(devRoadSculptDraft.gradeHorizonBoost)} onChange={(e) => handleRoadSculptDraftChange("gradeHorizonBoost", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onPointerDown={(e) => startRoadSculptHold("gradeHorizonBoost", 0.2, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">+</button>
                    </div>
                    <p className="pt-1 text-[10px] font-semibold text-cyan-200">Aproximar horizonte</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onClick={() => handleRoadHorizonDistanceNudge(-2)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">-</button>
                      <input type="number" step="1" value={String(roadHorizonDistance)} onChange={(e) => handleRoadHorizonDistanceChange(e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onClick={() => handleRoadHorizonDistanceNudge(2)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">+</button>
                    </div>
                    <p className="pt-1 text-[10px] font-semibold text-cyan-200">Altura do horizonte</p>
                    <div className="grid grid-cols-[34px_1fr_34px] gap-1">
                      <button type="button" onClick={() => handleRoadHorizonHeightNudge(-0.5)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">-</button>
                      <input type="number" step="0.1" value={String(roadHorizonHeight)} onChange={(e) => handleRoadHorizonHeightChange(e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      <button type="button" onClick={() => handleRoadHorizonHeightNudge(0.5)} className="h-7 rounded border border-cyan-500/60 bg-cyan-900/35 text-[11px]">+</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 rounded border border-emerald-500/30 bg-slate-900/55 p-2">
                <button type="button" onClick={() => handleToggleRoadSection("depth")} className="flex h-7 w-full items-center justify-between rounded border border-emerald-500/50 bg-emerald-900/20 px-2 text-[10px] font-semibold text-emerald-200">
                  <span>Profundidade</span>
                  <span>{devRoadSectionsOpen.depth ? "Ocultar" : "Abrir"}</span>
                </button>
                {devRoadSectionsOpen.depth ? (
                  <div className="mt-1 grid grid-cols-[34px_1fr_34px] gap-1">
                    <button type="button" onPointerDown={(e) => startRoadSculptHold("depthScale", -0.05, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-emerald-500/60 bg-emerald-900/35 text-[11px]">-</button>
                    <input type="number" step="0.05" value={String(devRoadSculptDraft.depthScale)} onChange={(e) => handleRoadSculptDraftChange("depthScale", e.target.value)} className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                    <button type="button" onPointerDown={(e) => startRoadSculptHold("depthScale", 0.05, e)} onPointerUp={(e) => stopRoadSculptHold(e.pointerId)} onPointerCancel={(e) => stopRoadSculptHold(e.pointerId)} onPointerLeave={(e) => stopRoadSculptHold(e.pointerId)} className="h-7 rounded border border-emerald-500/60 bg-emerald-900/35 text-[11px]">+</button>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 rounded border border-amber-500/30 bg-slate-900/55 p-2">
                <button type="button" onClick={() => handleToggleRoadSection("visual")} className="flex h-7 w-full items-center justify-between rounded border border-amber-500/50 bg-amber-900/20 px-2 text-[10px] font-semibold text-amber-200">
                  <span>Visual 3D</span>
                  <span>{devRoadSectionsOpen.visual ? "Ocultar" : "Abrir"}</span>
                </button>
                {devRoadSectionsOpen.visual ? (
                  <div className="mt-2 space-y-2">
                    <div className="rounded border border-amber-500/30 bg-black/20 p-2">
                      <p className="text-[10px] font-semibold text-amber-100">Estrada 3D repetivel</p>
                      <p className="mt-1 text-[10px] text-amber-200/80">
                        Use um GLB/FBX da estrada com barranco e grama interna. O jogo repete o arquivo no percurso.
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-200" title={devRoadVisualDraft.modelUrl || ""}>
                        {devRoadVisualDraft.modelUrl ? getAssetFileName(devRoadVisualDraft.modelUrl) : "Usando visual padrao do jogo"}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <label className="flex h-8 cursor-pointer items-center justify-center rounded border border-amber-400/60 bg-amber-900/30 px-2 text-[10px] font-semibold text-amber-100">
                          Trocar 3D
                          <input type="file" accept=".glb,.gltf,.fbx,.obj,.stl" className="hidden" onChange={handleRoadChunkModelUpload} />
                        </label>
                        <button
                          type="button"
                          onClick={handleResetRoadChunkModel}
                          disabled={isRoadVisualSaving || !devRoadVisualDraft.modelUrl}
                          className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100 disabled:opacity-60"
                        >
                          Usar padrao
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetRoadModelTransform}
                        className="mt-2 h-8 w-full rounded border border-amber-400/40 bg-amber-950/30 px-2 text-[10px] font-semibold text-amber-100"
                      >
                        Usar tamanho real do arquivo
                      </button>
                      <label className="mt-2 flex items-center justify-between rounded border border-amber-500/30 bg-slate-950/40 px-2 py-2 text-[10px] text-amber-100">
                        <span>{devRoadVisualDraft.roadRepeatEnabled ? "Repeticao ligada" : "Mostrar 1 chunk para alinhar"}</span>
                        <input
                          type="checkbox"
                          checked={devRoadVisualDraft.roadRepeatEnabled === true}
                          onChange={(event) => handleRoadVisualDraftChange("roadRepeatEnabled", event.target.checked)}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Altura da estrada</span>
                        <input type="number" step="0.05" value={String(devRoadVisualDraft.roadSurfaceY)} onChange={(e) => handleRoadVisualDraftChange("roadSurfaceY", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Ajuste fino do 3D</span>
                        <input type="number" step="0.05" value={String(devRoadVisualDraft.roadModelY)} onChange={(e) => handleRoadVisualDraftChange("roadModelY", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Escala do 3D</span>
                        <input type="number" step="0.05" min="0.1" value={String(devRoadVisualDraft.roadModelScale)} onChange={(e) => handleRoadVisualDraftChange("roadModelScale", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Escala X</span>
                        <input type="number" step="0.05" min="0.1" value={String(devRoadVisualDraft.roadModelScaleX)} onChange={(e) => handleRoadVisualDraftChange("roadModelScaleX", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Escala Y</span>
                        <input type="number" step="0.05" min="0.1" value={String(devRoadVisualDraft.roadModelScaleY)} onChange={(e) => handleRoadVisualDraftChange("roadModelScaleY", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Escala Z</span>
                        <input type="number" step="0.05" min="0.1" value={String(devRoadVisualDraft.roadModelScaleZ)} onChange={(e) => handleRoadVisualDraftChange("roadModelScaleZ", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                      </label>
                      <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                        <span className="block text-[10px] text-slate-300">Comprimento do chunk</span>
                        <input type="number" step="0.1" min="0" value={String(devRoadVisualDraft.roadChunkLength)} onChange={(e) => handleRoadVisualDraftChange("roadChunkLength", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        <span className="mt-1 block text-[9px] text-slate-400">0 = auto pelo tamanho do arquivo</span>
                      </label>
                    </div>
                    <div className="rounded border border-sky-500/25 bg-sky-950/10 p-2">
                      <p className="text-[10px] font-semibold text-sky-200">Ajuste ao vivo do chunk 3D</p>
                      <p className="mt-1 text-[10px] text-sky-200/80">Move, gira e escala vendo a estrada no jogo em tempo real.</p>
                      <div className="mt-2 grid gap-2">
                        {[
                          ["roadModelX", "Pos X", -8, 8, 0.01],
                          ["roadModelY", "Pos Y", -12, 12, 0.01],
                          ["roadModelZ", "Pos Z", -20, 20, 0.05],
                          ["roadModelRotX", "Rot X", -180, 180, 1],
                          ["roadModelRotY", "Rot Y", -180, 180, 1],
                          ["roadModelRotZ", "Rot Z", -180, 180, 1],
                          ["roadModelScale", "Escala", 0.1, 12, 0.01],
                          ["roadModelScaleX", "Escala X", 0.1, 12, 0.01],
                          ["roadModelScaleY", "Escala Y", 0.1, 12, 0.01],
                          ["roadModelScaleZ", "Escala Z", 0.1, 12, 0.01],
                        ].map(([field, label, min, max, step]) => (
                          <label key={field} className="grid gap-1 text-[10px] text-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <span className="text-sky-200">{Number(devRoadVisualDraft[field]).toFixed(field === "roadModelScale" ? 2 : 2)}</span>
                            </div>
                            <input
                              type="range"
                              min={String(min)}
                              max={String(max)}
                              step={String(step)}
                              value={String(devRoadVisualDraft[field])}
                              onChange={(event) => handleRoadVisualDraftChange(field, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded border border-emerald-500/25 bg-emerald-950/10 p-2">
                      <p className="text-[10px] font-semibold text-emerald-200">Grama externa de continuidade</p>
                      <p className="mt-1 text-[10px] text-emerald-200/80">
                        Essa faixa fica mais para fora do chunk 3D para abrir o mapa e receber blocos/continuacoes depois.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Altura da grama</span>
                          <input type="number" step="0.05" value={String(devRoadVisualDraft.outerGrassY)} onChange={(e) => handleRoadVisualDraftChange("outerGrassY", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                        <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Largura da grama</span>
                          <input type="number" step="0.1" value={String(devRoadVisualDraft.outerGrassWidth)} onChange={(e) => handleRoadVisualDraftChange("outerGrassWidth", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                        <label className="col-span-2 rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Distancia lateral da grama</span>
                          <input type="number" step="0.1" value={String(devRoadVisualDraft.outerGrassOffset)} onChange={(e) => handleRoadVisualDraftChange("outerGrassOffset", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                      </div>
                    </div>
                    <div className="rounded border border-lime-500/25 bg-lime-950/10 p-2">
                      <p className="text-[10px] font-semibold text-lime-200">Bloco procedural rápido</p>
                      <p className="mt-1 text-[10px] text-lime-200/80">
                        Gera borda lateral de grama elevada por codigo para testar sem arquivo 3D.
                      </p>
                      <label className="mt-2 flex items-center justify-between rounded border border-lime-500/30 bg-slate-950/40 px-2 py-2 text-[10px] text-lime-100">
                        <span>{devRoadVisualDraft.proceduralEdgeEnabled ? "Procedural ligado" : "Procedural desligado"}</span>
                        <input
                          type="checkbox"
                          checked={devRoadVisualDraft.proceduralEdgeEnabled === true}
                          onChange={(event) => handleRoadVisualDraftChange("proceduralEdgeEnabled", event.target.checked)}
                        />
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Altura da grama</span>
                          <input type="number" step="0.05" value={String(devRoadVisualDraft.proceduralGrassLift)} onChange={(e) => handleRoadVisualDraftChange("proceduralGrassLift", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                        <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Largura da grama</span>
                          <input type="number" step="0.1" value={String(devRoadVisualDraft.proceduralGrassWidth)} onChange={(e) => handleRoadVisualDraftChange("proceduralGrassWidth", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                        <label className="rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Altura da grama no mapa</span>
                          <input type="number" step="0.05" value={String(devRoadVisualDraft.proceduralGrassY)} onChange={(e) => handleRoadVisualDraftChange("proceduralGrassY", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                        <label className="col-span-2 rounded border border-slate-700 bg-slate-950/70 p-2">
                          <span className="block text-[10px] text-slate-300">Distancia da grama elevada</span>
                          <input type="number" step="0.1" value={String(devRoadVisualDraft.proceduralGrassOffset)} onChange={(e) => handleRoadVisualDraftChange("proceduralGrassOffset", e.target.value)} className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100" />
                        </label>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-1">
                        <label className="flex h-8 cursor-pointer items-center justify-center rounded border border-lime-400/60 bg-lime-900/25 px-2 text-[10px] font-semibold text-lime-100">
                          Textura grama
                          <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleRoadProceduralTextureUpload("grass", e)} />
                        </label>
                      </div>
                      <div className="mt-1 text-[9px] text-slate-300">
                        <p className="truncate" title={devRoadVisualDraft.proceduralGrassTextureUrl || ""}>
                          Grama: {devRoadVisualDraft.proceduralGrassTextureUrl ? getAssetFileName(devRoadVisualDraft.proceduralGrassTextureUrl) : "cor simples"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetProceduralGrassEdgeDeform}
                        className="mt-2 h-8 w-full rounded border border-rose-500/70 bg-rose-900/30 text-[10px] font-semibold text-rose-100"
                        title="Remove todas as deformacoes esculpidas da borda da grama e salva no mapa."
                      >
                        Resetar deformacoes da borda
                      </button>
                      <p className="mt-1 text-[9px] text-rose-100/75">
                        Limpa a escultura da borda esquerda e direita da grama deste mapa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveRoadVisualDraft("Visual 3D da estrada salvo neste mapa.")}
                      disabled={isRoadVisualSaving}
                      className="h-8 w-full rounded border border-amber-500/70 bg-amber-900/35 text-[10px] font-semibold text-amber-50 disabled:opacity-60"
                    >
                      {isRoadVisualSaving ? "Salvando..." : "Salvar visual da estrada"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 rounded border border-indigo-500/30 bg-slate-900/55 p-2">
                <button
                  type="button"
                  onClick={handleToggleRoadEventsOpen}
                  className="flex h-7 w-full items-center justify-between rounded border border-indigo-500/50 bg-indigo-900/20 px-2 text-[10px] font-semibold text-indigo-200"
                >
                  <span>Blocos da estrada</span>
                  <span>{devRoadEventsOpen ? "Ocultar" : "Abrir"}</span>
                </button>
                {devRoadEventsOpen ? (
                  <div className="mt-2 space-y-2">
                    <div className="space-y-1 rounded border border-indigo-500/35 bg-slate-950/55 p-2">
                      <p className="text-[10px] font-semibold text-indigo-200">Novo bloco</p>
                      <div className="grid grid-cols-2 gap-1">
                        <select
                          value={devNewRoadEventDraft.type}
                          onChange={(e) => handleNewRoadEventDraftChange("type", e.target.value)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                        >
                          <option value="curve">Curva</option>
                          <option value="grade">Subida/Descida</option>
                        </select>
                        <input
                          type="text"
                          value={devNewRoadEventDraft.name}
                          onChange={(e) => handleNewRoadEventDraftChange("name", e.target.value)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                          placeholder="Nome"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={String(devNewRoadEventDraft.strength)}
                          onChange={(e) => handleNewRoadEventDraftChange("strength", e.target.value)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                          placeholder="Forca (-180 a 180)"
                        />
                        <input
                          type="number"
                          step="1"
                          value={String(devNewRoadEventDraft.length)}
                          onChange={(e) => handleNewRoadEventDraftChange("length", e.target.value)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                          placeholder="Comprimento"
                        />
                        <button
                          type="button"
                          disabled={isMapStageEditMode}
                          onClick={() => handleNewRoadEventDraftChange("loopEnabled", !devNewRoadEventDraft.loopEnabled)}
                          className={`h-7 rounded border text-[10px] ${
                            isMapStageEditMode
                              ? "cursor-not-allowed border-slate-700 bg-slate-900/60 text-slate-500"
                              : devNewRoadEventDraft.loopEnabled
                                ? "border-amber-400/70 bg-amber-900/35 text-amber-100"
                                : "border-slate-600 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {isMapStageEditMode ? "Loop local OFF" : `Loop ${devNewRoadEventDraft.loopEnabled ? "ON" : "OFF"}`}
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          min="1.5"
                          value={String(devNewRoadEventDraft.loopEverySeconds)}
                          disabled={isMapStageEditMode}
                          onChange={(e) => handleNewRoadEventDraftChange("loopEverySeconds", e.target.value)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                          placeholder="Tempo loop (s)"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRoadEventBlock}
                        className="h-7 w-full rounded border border-indigo-500/70 bg-indigo-900/35 text-[10px] text-indigo-100"
                      >
                        Adicionar na estrada
                      </button>
                    </div>
                    <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
                      {devRoadEventBlocks.length ? (
                        devRoadEventBlocks.map((block, index) => (
                          <div
                            key={block.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              const targetId = String(block.id || "");
                              const shouldFocus = String(devSelectedRoadEventId || "") !== targetId;
                              setDevSelectedRoadEventId(targetId);
                              if (shouldFocus) focusRoadEventInEditor(targetId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                const targetId = String(block.id || "");
                                const shouldFocus = String(devSelectedRoadEventId || "") !== targetId;
                                setDevSelectedRoadEventId(targetId);
                                if (shouldFocus) focusRoadEventInEditor(targetId);
                              }
                            }}
                            className={`rounded border p-2 ${
                              String(devSelectedRoadEventId || "") === String(block.id || "")
                                ? "border-indigo-400 bg-indigo-950/35"
                                : "border-slate-700 bg-slate-950/60"
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-1">
                              <p className="truncate text-[10px] font-semibold text-slate-100" title={block.name}>
                                {index + 1}. {block.name}
                              </p>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleRemoveRoadEventBlock(block.id);
                                }}
                                className="h-6 rounded border border-rose-500/70 bg-rose-900/35 px-2 text-[10px] text-rose-100"
                              >
                                Del
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <select
                                value={block.type}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { type: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                              >
                                <option value="curve">Curva</option>
                                <option value="grade">Subida/Descida</option>
                              </select>
                              <input
                                type="text"
                                value={block.name}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { name: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                                placeholder="Nome"
                              />
                              <input
                                type="number"
                                step="0.1"
                                value={String(block.strength)}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { strength: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                                placeholder="Forca (-180 a 180)"
                              />
                              <input
                                type="number"
                                step="1"
                                value={String(block.startZ)}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { startZ: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                                placeholder="Inicio Z"
                              />
                              <input
                                type="number"
                                step="1"
                                value={String(block.length)}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { length: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                                placeholder="Comprimento"
                              />
                              <button
                                type="button"
                                onClick={() => handleRoadEventBlockChange(block.id, { enabled: !block.enabled })}
                                className={`h-7 rounded border text-[10px] ${
                                  block.enabled
                                    ? "border-emerald-500/70 bg-emerald-900/35 text-emerald-100"
                                    : "border-slate-600 bg-slate-900 text-slate-300"
                                }`}
                              >
                                {block.enabled ? "ON" : "OFF"}
                              </button>
                              <button
                                type="button"
                                disabled={isMapStageEditMode}
                                onClick={() => handleRoadEventBlockChange(block.id, { loopEnabled: !block.loopEnabled })}
                                className={`h-7 rounded border text-[10px] ${
                                  isMapStageEditMode
                                    ? "cursor-not-allowed border-slate-700 bg-slate-900/60 text-slate-500"
                                    : block.loopEnabled
                                      ? "border-amber-400/70 bg-amber-900/35 text-amber-100"
                                      : "border-slate-600 bg-slate-900 text-slate-300"
                                }`}
                              >
                                {isMapStageEditMode ? "Loop local OFF" : `Loop ${block.loopEnabled ? "ON" : "OFF"}`}
                              </button>
                              <input
                                type="number"
                                step="0.5"
                                min="1.5"
                                value={String(block.loopEverySeconds ?? 9)}
                                disabled={isMapStageEditMode}
                                onChange={(e) => handleRoadEventBlockChange(block.id, { loopEverySeconds: e.target.value })}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-1 text-[10px] text-slate-100"
                                placeholder="Tempo loop (s)"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="px-1 py-1 text-[10px] text-slate-400">Sem blocos ainda.</p>
                      )}
                    </div>
                    <p className="px-1 text-[10px] text-indigo-200/85">
                      Selecione o bloco e arraste direto na pista: horizontal = forca, vertical = comprimento,
                      `Ctrl + arraste` = mover inicio.
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button type="button" onClick={handleResetRoadSculptDraft} className="h-7 rounded border border-slate-600 bg-slate-900 text-[10px] text-slate-100">Reset</button>
                <button type="button" onClick={() => applyRoadSculptDraftPatch(devRoadSculptDraft)} className="h-7 rounded border border-fuchsia-500/70 bg-fuchsia-900/35 text-[10px]">Salvar perfil</button>
              </div>
              <button
                type="button"
                onClick={handleSnapAllObjectsToTerrain}
                className="mt-1 h-7 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[10px] text-emerald-100"
              >
                Grudar todos no terreno
              </button>
              {devRoadEventsOpen ? (
                <button
                  type="button"
                  onClick={handleApplyRoadEventsPatch}
                  className="mt-1 h-7 w-full rounded border border-indigo-500/70 bg-indigo-900/35 text-[10px] text-indigo-100"
                >
                  Salvar blocos
                </button>
              ) : null}
            </div>
            );
            return shouldUseChallengeDevDock ? createPortal(roadPanelNode, document.body) : roadPanelNode;
          })() : null}
          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed && !devCameraPanelCollapsed ? (() => {
            const cameraPanelNode = (
            <div
              ref={devCameraPanelRef}
              className={`z-40 rounded-xl border border-sky-500/50 bg-slate-950/92 p-2 text-xs text-sky-100 ${
                shouldUseChallengeDevDock
                  ? "fixed bottom-4 left-4 top-24 hidden w-[min(28rem,30vw)] min-w-[24rem] overflow-y-auto rounded-[1.8rem] border-sky-400/30 bg-slate-950/90 p-4 backdrop-blur-xl md:block"
                  : "absolute w-52"
              }`}
              style={{
                left: shouldUseChallengeDevDock ? undefined : (Number.isFinite(devCameraPanelPos.x) ? `${devCameraPanelPos.x}px` : undefined),
                top: shouldUseChallengeDevDock ? undefined : (Number.isFinite(devCameraPanelPos.y) ? `${devCameraPanelPos.y}px` : undefined),
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={shouldUseChallengeDevDock ? undefined : handleDevCameraPanelPointerDown}
                className={`mb-2 flex touch-none select-none items-center justify-between rounded border border-sky-500/40 bg-sky-900/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-sky-200 ${
                  shouldUseChallengeDevDock ? "" : "cursor-grab active:cursor-grabbing"
                }`}
              >
                <span>Camera jogador</span>
                <div className="flex items-center gap-2">
                  <span className="text-sky-300/80">{shouldUseChallengeDevDock ? "fixo" : "arrastar"}</span>
                  <button
                    type="button"
                    onClick={() => setDevCameraPanelCollapsed(true)}
                    className="h-5 rounded border border-sky-500/60 bg-sky-900/25 px-1 text-[10px] text-sky-100"
                    title="Ocultar painel"
                  >
                    _
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-sky-200/85">Distancia da camera ao personagem.</p>
              <div className="mt-2 grid grid-cols-[1fr_68px] gap-1">
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="0.1"
                  value={String(devCameraFollowDistance)}
                  onChange={(e) => setDevCameraFollowDistance(Math.max(4, Math.min(24, Number(e.target.value) || 9.4)))}
                  className="h-7"
                />
                <input
                  type="number"
                  min="4"
                  max="24"
                  step="0.1"
                  value={String(devCameraFollowDistance)}
                  onChange={(e) => setDevCameraFollowDistance(Math.max(4, Math.min(24, Number(e.target.value) || 9.4)))}
                  className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCameraFollowDistance}
                className="mt-2 h-7 w-full rounded border border-sky-500/70 bg-sky-900/35 text-[10px] text-sky-100"
              >
                Salvar distancia
              </button>
              <div className="mt-3 rounded border border-sky-500/30 bg-slate-900/55 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200">Look do mapa</p>
                <p className="mt-1 text-[10px] text-sky-200/80">Exposicao, luzes e cor. Bom para noite, tunel, tocha e mapas tematicos.</p>
                <div className="mt-2 space-y-1">
                  {[
                    ["exposure", "Exposicao", 0.4, 2.2, 0.01],
                    ["ambientIntensity", "Ambiente", 0, 3, 0.01],
                    ["hemisphereIntensity", "Ceu/chao", 0, 3, 0.01],
                    ["keyIntensity", "Luz principal", 0, 3, 0.01],
                    ["fillIntensity", "Preenchimento", 0, 3, 0.01],
                    ["rimIntensity", "Recorte", 0, 3, 0.01],
                    ["saturation", "Saturacao", 0.2, 2.2, 0.01],
                    ["contrast", "Contraste", 0.4, 2, 0.01],
                    ["brightness", "Brilho final", 0.4, 1.8, 0.01],
                  ].map(([field, label, min, max, step]) => (
                    <label key={field} className="block">
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="text-slate-200">{label}</span>
                        <span className="text-sky-200">{Number(devSceneLightingDraft[field]).toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={String(min)}
                        max={String(max)}
                        step={String(step)}
                        value={String(devSceneLightingDraft[field])}
                        onChange={(e) => handleSceneLightingDraftChange(field, e.target.value)}
                        className="h-6 w-full"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={handleResetSceneLighting}
                    className="h-7 rounded border border-slate-600 bg-slate-900 text-[10px] text-slate-100"
                  >
                    Reset look
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSceneLighting}
                    className="h-7 rounded border border-sky-500/70 bg-sky-900/35 text-[10px] text-sky-100"
                  >
                    Salvar look
                  </button>
                </div>
              </div>
            </div>
            );
            return shouldUseChallengeDevDock ? createPortal(cameraPanelNode, document.body) : cameraPanelNode;
          })() : null}

          {screen === "challenge" && isDevMode && isElementGalleryOpen ? (() => {
            const galleryNode = (
            <div className={`${shouldUseChallengeDevDock ? "fixed bottom-4 right-4 top-24 z-[140] hidden w-[min(34rem,36vw)] min-w-[26rem] md:block" : "absolute inset-0 z-50"} ${shouldUseChallengeDevDock ? "" : "bg-slate-950/65 p-2 sm:p-3"}`}>
              <div className={`flex h-full w-full flex-col rounded-xl border border-emerald-400/40 bg-slate-950/96 p-3 text-emerald-100 ${shouldUseChallengeDevDock ? "overflow-hidden rounded-[1.8rem] border-emerald-400/30 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl" : "mx-auto max-w-5xl"}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-200">Galeria de elementos</p>
                    <p className="text-[11px] text-emerald-300/80">
                      Clique para adicionar ou arraste o card para dentro do mapa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsElementGalleryOpen(false)}
                    className="h-8 rounded border border-slate-600 bg-slate-900 px-3 text-[11px] text-slate-100"
                  >
                    Fechar
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-4 gap-1">
                  {[
                    { key: "elements", label: "Elementos" },
                    { key: "eliminatory", label: "Eliminatorios" },
                    { key: "horizon", label: "Horizonte" },
                    { key: "road", label: "Estrada" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDevGalleryTab(tab.key)}
                      className={`h-8 rounded border text-[11px] ${
                        devGalleryTab === tab.key
                          ? "border-emerald-400 bg-emerald-900/45 text-emerald-100"
                          : "border-slate-600 bg-slate-900 text-slate-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={devUploadFileName}
                    onChange={(event) => setDevUploadFileName(event.target.value)}
                    placeholder="Nome do arquivo no backend (opcional)"
                    className="h-9 rounded border border-slate-600 bg-slate-900 px-2 text-[12px] text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => galleryUploadInputRef.current?.click()}
                    className="h-9 rounded border border-emerald-500/70 bg-emerald-900/35 px-3 text-[12px]"
                  >
                    {devGalleryTab === "horizon"
                      ? "Upload e aplicar horizonte"
                      : devGalleryTab === "road"
                        ? "Upload e aplicar estrada"
                        : devGalleryTab === "eliminatory"
                          ? "Upload para eliminatorios"
                          : "Upload para galeria"}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded border border-emerald-500/30 bg-slate-900/40 p-2">
                  <div className={`grid gap-2 ${shouldUseChallengeDevDock ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}`}>
                    {((devGalleryTab === "elements" || devGalleryTab === "eliminatory")
                      ? devAssetLibraryOptions
                      : devSceneImageGalleryOptions).map((item) => {
                      const type = String(item?.mediaType || detectAssetTypeFromName(item?.value || ""));
                      const isVideo = type === "video";
                      const isModel = type === "model3d";
                      const isProceduralPreset = type === "procedural_preset" || !!item?.isProceduralPreset;
                      const previewUrl = resolveGalleryAssetUrl(item?.value);
                      const rawValue = String(item?.value || "").trim();
                      const isUploadAsset =
                        isUploadAssetUrl(rawValue) ||
                        isUploadAssetUrl(previewUrl) ||
                        String(item?.label || "").includes("(Upload");
                      return (
                        <div
                          key={item.value}
                          className="rounded-lg border border-emerald-500/30 bg-slate-950/70 p-2"
                          draggable={(devGalleryTab === "elements" || devGalleryTab === "eliminatory") && !isProceduralPreset}
                          onDragStart={(event) => {
                            if (devGalleryTab !== "elements" && devGalleryTab !== "eliminatory") return;
                            handleGalleryDragStart(event, item);
                          }}
                        >
                          <div className="relative mb-2 flex h-24 items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-900">
                            {isUploadAsset ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteGalleryAsset(item)}
                                className="absolute right-1 top-1 z-10 h-6 w-6 rounded border border-red-500/80 bg-red-950/85 text-[11px] text-red-100"
                                title="Excluir arquivo da galeria e do backend"
                              >
                                X
                              </button>
                            ) : null}
                            {isProceduralPreset ? (
                              <p className="px-2 text-center text-[11px] text-emerald-200">Objeto 3D salvo</p>
                            ) : isModel ? (
                              <p className="px-2 text-center text-[11px] text-cyan-200">Arquivo 3D</p>
                            ) : isVideo ? (
                              <video src={previewUrl} className="h-full w-full object-cover" muted loop playsInline />
                            ) : (
                              <img
                                src={previewUrl}
                                alt={item.fileName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            )}
                          </div>
                          <p className="truncate text-[10px] text-emerald-200" title={item.fileName}>
                            {item.fileName}
                          </p>
                          {devGalleryTab === "elements" && isProceduralPreset && item?.folder ? (
                            <p className="truncate text-[9px] text-cyan-300/85" title={item.folder}>
                              Pasta: {item.folder}
                            </p>
                          ) : null}
                          {devGalleryTab === "elements" && isProceduralPreset ? (
                            <div className="mt-2 grid grid-cols-1 gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditProceduralPresetFromGallery(item)}
                                className="h-7 w-full rounded border border-cyan-500/60 bg-cyan-900/35 text-[10px]"
                              >
                                Editar modelo
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddFromGallery(item)}
                                className="h-7 w-full rounded border border-emerald-500/60 bg-emerald-900/35 text-[10px]"
                              >
                                Adicionar objeto 3D
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                devGalleryTab === "elements" || devGalleryTab === "eliminatory"
                                  ? handleAddFromGallery(item)
                                  : devGalleryTab === "horizon"
                                  ? handleApplyHorizonFromGallery(item)
                                  : handleApplyRoadFromGallery(item)
                              }
                              className="mt-2 h-7 w-full rounded border border-emerald-500/60 bg-emerald-900/35 text-[10px]"
                            >
                              {devGalleryTab === "elements" || devGalleryTab === "eliminatory"
                                ? "Adicionar no mapa"
                                : devGalleryTab === "horizon"
                                ? "Aplicar no horizonte"
                                : "Aplicar na estrada"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            );
            return shouldUseChallengeDevDock ? createPortal(galleryNode, document.body) : galleryNode;
          })() : null}
          {screen === "challenge" && isDevMode && isModelerOpen ? (
            <div className={`absolute inset-0 z-50 bg-slate-950/65 ${isModelerExpanded ? "p-0" : "p-1 sm:p-2"}`}>
              <div
                className={`mx-auto flex h-full w-full flex-col border border-cyan-400/45 bg-slate-950/96 p-3 text-cyan-100 ${
                  isModelerExpanded ? "max-w-none rounded-none" : "max-w-[96vw] rounded-xl"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-cyan-200">Modelador 3D low-poly</p>
                    <p className="text-[11px] text-cyan-300/80">
                      Crie primitiva leve, aplique textura por lado e adicione no mapa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartNewProceduralFile}
                      className="h-8 rounded border border-violet-500/60 bg-violet-900/35 px-3 text-[11px] text-violet-100"
                    >
                      Novo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectBrowserFolderFilter("all");
                        setIsProjectBrowserOpen(true);
                      }}
                      className="h-8 rounded border border-indigo-500/60 bg-indigo-900/35 px-3 text-[11px] text-indigo-100"
                    >
                      Abrir arquivo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(10, Math.min(3600, Math.floor(Number(devModelAutosaveSeconds) || 60)));
                        const input = window.prompt("Intervalo do auto-save (segundos, minimo 10):", String(current));
                        if (input == null) return;
                        const parsed = Math.floor(Number(input));
                        if (!Number.isFinite(parsed) || parsed < 10) {
                          setSceneConfigMessage("Tempo invalido. Use 10s ou mais.");
                          return;
                        }
                        const next = String(Math.min(3600, parsed));
                        setDevModelAutosaveSeconds(next);
                        setSceneConfigMessage(`Auto-save ajustado para ${next}s.`);
                      }}
                      className="h-8 rounded border border-emerald-500/60 bg-emerald-900/35 px-3 text-[11px] text-emerald-100"
                    >
                      Auto-save: {Math.max(10, Math.min(3600, Math.floor(Number(devModelAutosaveSeconds) || 60)))}s
                    </button>
                    <button
                      type="button"
                      onClick={() => modelerImport3dInputRef.current?.click()}
                      className="h-8 rounded border border-amber-500/60 bg-amber-900/35 px-3 text-[11px] text-amber-100"
                    >
                      Importar 3D
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModelerExpanded((prev) => !prev)}
                      className="h-8 rounded border border-cyan-500/60 bg-cyan-900/35 px-3 text-[11px] text-cyan-100"
                    >
                      {isModelerExpanded ? "Restaurar" : "Expandir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelerOpen(false);
                        setIsModelerExpanded(false);
                      }}
                      className="h-8 rounded border border-slate-600 bg-slate-900 px-3 text-[11px] text-slate-100"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
                <div className="mb-3 rounded border border-cyan-500/35 bg-cyan-950/20 p-2 text-[11px] text-cyan-200">
                  Ferramenta ativa: <span className="font-semibold uppercase">{devModelTool}</span>
                  {devModelPointerMode ? (
                    <span className="ml-2">| Ponteiro: <span className="font-semibold uppercase">{devModelPointerMode}</span></span>
                  ) : null}
                  <span className="ml-2">| Auto-save: <span className="font-semibold">{Math.max(10, Math.min(3600, Math.floor(Number(devModelAutosaveSeconds) || 60)))}s</span></span>
                  {devEditingPresetFolder ? (
                    <span className="ml-2">| Pasta: <span className="font-semibold">{devEditingPresetFolder}</span></span>
                  ) : null}
                  {devEditingPresetName ? (
                    <span className="ml-2">| Editando arquivo: <span className="font-semibold">{devEditingPresetName}</span></span>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded border border-cyan-500/30 bg-slate-900/45 p-2">
                  {isProjectBrowserOpen ? (
                    <div className="mb-2 rounded border border-indigo-400/45 bg-slate-950/90 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-indigo-200">Abrir projeto 3D</p>
                        <button
                          type="button"
                          onClick={() => setIsProjectBrowserOpen(false)}
                          className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[220px_1fr]">
                        <div className="rounded border border-indigo-500/30 bg-slate-900/50 p-2">
                          <p className="mb-1 text-[10px] text-indigo-200">Pastas</p>
                          <div className="max-h-[220px] overflow-y-auto space-y-1">
                            <button
                              type="button"
                              onClick={() => setProjectBrowserFolderFilter("all")}
                              className={`h-7 w-full rounded border px-2 text-left text-[10px] ${
                                projectBrowserFolderFilter === "all"
                                  ? "border-indigo-400 bg-indigo-900/40 text-indigo-100"
                                  : "border-slate-700 bg-slate-900 text-slate-200"
                              }`}
                            >
                              Todas
                            </button>
                            {proceduralProjectFolders.map((folder) => (
                              <button
                                key={folder}
                                type="button"
                                onClick={() => setProjectBrowserFolderFilter(folder)}
                                className={`h-7 w-full rounded border px-2 text-left text-[10px] ${
                                  projectBrowserFolderFilter === folder
                                    ? "border-indigo-400 bg-indigo-900/40 text-indigo-100"
                                    : "border-slate-700 bg-slate-900 text-slate-200"
                                }`}
                                title={folder}
                              >
                                {folder}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded border border-indigo-500/30 bg-slate-900/50 p-2">
                          <p className="mb-1 text-[10px] text-indigo-200">Arquivos</p>
                          <div className="max-h-[220px] overflow-y-auto space-y-1">
                            {proceduralProjectFiles.length ? (
                              proceduralProjectFiles.map((file) => (
                                <button
                                  key={file.key}
                                  type="button"
                                  onClick={() => {
                                    handleEditProceduralPresetFromGallery({
                                      isProceduralPreset: true,
                                      proceduralPreset: file.proceduralPreset,
                                    });
                                    setIsProjectBrowserOpen(false);
                                  }}
                                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left text-[10px] text-slate-100 hover:border-indigo-400 hover:bg-indigo-900/25"
                                  title={file.fileName}
                                >
                                  <p className="truncate">{file.name}</p>
                                  <p className="truncate text-[9px] text-indigo-300/85">
                                    {file.folder ? `${file.folder}/` : ""}
                                    {file.name}.3dpreset
                                  </p>
                                </button>
                              ))
                            ) : (
                              <p className="px-1 py-2 text-[10px] text-slate-400">Nenhum arquivo nesta pasta.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.45fr_0.48fr_0.6fr_0.92fr]">
                    <div className="min-h-[420px] rounded border border-cyan-500/30 bg-slate-950/70 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-cyan-200">Viewport de edicao 3D</p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDevModelViewportMode("procedural")}
                            className={`h-6 rounded border px-2 text-[9px] ${
                              devModelViewportMode === "procedural"
                                ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                                : "border-slate-600 bg-slate-900 text-slate-200"
                            }`}
                          >
                            Padrão
                          </button>
                          <button
                            type="button"
                            onClick={() => setDevModelViewportMode("imported")}
                            disabled={!devModelImported3dUrl}
                            className={`h-6 rounded border px-2 text-[9px] ${
                              devModelViewportMode === "imported"
                                ? "border-amber-400 bg-amber-900/40 text-amber-100"
                                : "border-slate-600 bg-slate-900 text-slate-200"
                            } ${!devModelImported3dUrl ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            Importado
                          </button>
                        </div>
                      </div>
                      <p className="mb-2 text-[10px] text-cyan-300/80">
                        Teclas: `1` perspectiva, `2` frente, `3` lado, `4` topo.
                      </p>
                      <div className={`w-full ${isModelerExpanded ? "h-[72vh]" : "h-[520px]"}`}>
                        <React.Suspense fallback={null}>
                          <ProceduralModelEditor
                            config={modelerConfig}
                            importModelUrl={devModelViewportMode === "imported" ? devModelImported3dUrl : ""}
                            importModelName={devModelImported3dName}
                            tool={devModelTool}
                            brushRadius={Number(devModelBrushRadius) || 0.9}
                            brushStrength={Number(devModelBrushStrength) || 0.025}
                            paintColor={devModelPaintColor}
                            paintData={modelerCurrentVertexColors}
                            toolStrengths={devToolStrengths}
                            offsets={modelerCurrentOffsets}
                            polygonEstimate={devModelPolygonEstimate}
                            segmentInfo={{
                              widthSegments: devModelWidthSegments,
                              heightSegments: devModelHeightSegments,
                              depthSegments: devModelDepthSegments,
                              radialSegments: devModelRadialSegments,
                            }}
                            onOffsetsChange={handleModelerOffsetsChange}
                            onOffsetsCommit={handleModelerOffsetsCommit}
                            onPaintChange={handleModelerVertexColorsChange}
                            onPaintCommit={handleModelerVertexColorsCommit}
                          onPointerModeChange={setDevModelPointerMode}
                          onToolChange={setDevModelTool}
                          onAdjustTopology={handleModelerAdjustTopology}
                          onBrushRadiusChange={setDevModelBrushRadius}
                          onBrushStrengthChange={setDevModelBrushStrength}
                          onToolStrengthChange={handleToolStrengthChange}
                          onSavePreset={handleSaveProceduralPresetToGallery}
                          saveRequestToken={modelerSaveRequestToken}
                          onSaveRequestDone={handleModelerSaveRequestDone}
                          showViewportTexture={devModelViewportMode === "imported" ? devShowImportedTexture : true}
                          hasImportedTextureOverride={!!String(devImportedTextureOverride || "").trim()}
                          onRestoreImportedOriginalSkin={() => {
                            setDevImportedTextureOverride("");
                            setDevImportedTextureUseOriginalUv(false);
                          }}
                          importedTextureEditSlot={devImportedAppliedTextureSlot}
                          importedWeldVertices={devImportedWeldVertices}
                          importedWeldConnectedOnly={devImportedWeldConnectedOnly}
                          importedAutoMaskTopology={devImportedAutoMaskTopology}
                          importedSmoothShading={devImportedSmoothShading}
                          importedAutoSmooth={devImportedAutoSmooth}
                          importedAutoSmoothAngle={
                            Number.isFinite(Number(devImportedAutoSmoothAngle))
                              ? Number(devImportedAutoSmoothAngle)
                              : 60
                          }
                          initialAnimationStudioData={selectedAnimationStudioData}
                          onAnimationStudioChange={handleAnimationStudioDataChange}
                          importedWeldEpsilon={
                            devImportedWeldEpsilon === "auto"
                              ? null
                              : Number.isFinite(Number(devImportedWeldEpsilon))
                                ? Number(devImportedWeldEpsilon)
                                : null
                          }
                          onUndo={handleUndoModelerAction}
                          onRedo={handleRedoModelerAction}
                          onImportedGeometryReady={() => {
                            if (devModelViewportMode === "imported") setDevModelImportedPreviewError("");
                          }}
                          onImportedGeometryError={(error) => {
                            if (devModelViewportMode !== "imported") return;
                            const reasonRaw =
                              String(error?.message || error?.target?.src || error || "").trim() ||
                              "erro desconhecido";
                            const isLoadError = /carregar|load|decode|gltf|glb|fbx|obj|stl|arquivo|malha|modelo|import/i.test(reasonRaw);
                            setDevModelImportedPreviewError(
                              isLoadError
                                ? `Importacao falhou: ${reasonRaw}. Dica: use GLB completo ou envie arquivos auxiliares (.bin/.mtl/texturas).`
                                : `Editor importado: ${reasonRaw}.`
                            );
                            setSceneConfigMessage("Nao foi possivel carregar o modelo importado no editor.");
                          }}
                          onImportedStats={handleImportedMeshStats}
                          onImportedWeldConnectedOnlyChange={setDevImportedWeldConnectedOnly}
                          onCommitImportedTextureEdit={handleCommitImportedTextureEdit}
                        />
                        </React.Suspense>
                      </div>
                      <div className="mt-2 rounded border border-cyan-500/35 bg-cyan-950/25 p-2 text-[10px] text-cyan-200">
                        Ponteiros: `Move` = mao (`grab`), `Modelar` = mira (`crosshair`), `Achatar` = ajuste vertical, `Suavizar/Inflar/Pincar` = brush, `Camera` = `grabbing`. Botao direito faz inverso do efeito. `Ctrl+Z` desfaz e `Ctrl+Y` refaz.
                      </div>
                    </div>
                    <div className="space-y-2">
                      {devModelViewportMode === "imported" ? (
                        <details className="rounded border border-amber-500/30 bg-amber-950/15 p-2" open>
                          <summary className="cursor-pointer list-none text-[10px] font-semibold text-amber-200">
                            Importado
                          </summary>
                          <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setDevShowImportedTexture((prev) => !prev)}
                                className={`h-7 rounded border text-[9px] ${
                                  devShowImportedTexture
                                    ? "border-amber-300 bg-amber-800/55 text-white"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {devShowImportedTexture ? "Textura: ON" : "Textura: OFF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDevImportedTextureOverride("");
                                  setDevShowImportedTexture(false);
                                }}
                                className="h-7 rounded border border-rose-500/70 bg-rose-900/30 text-[9px] text-rose-100"
                              >
                                Limpar skin
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setDevImportedSmoothShading((prev) => !prev)}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedSmoothShading
                                    ? "border-emerald-400/70 bg-emerald-900/35 text-emerald-100"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {devImportedSmoothShading ? "Smooth ON" : "Smooth OFF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDevImportedAutoSmooth((prev) => !prev)}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedAutoSmooth
                                    ? "border-cyan-400/70 bg-cyan-900/35 text-cyan-100"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {devImportedAutoSmooth ? `Auto ${devImportedAutoSmoothAngle || "180"}°` : "Auto Smooth OFF"}
                              </button>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {["30", "60", "120", "180"].map((angle) => (
                                <button
                                  key={angle}
                                  type="button"
                                  onClick={() => setDevImportedAutoSmoothAngle(angle)}
                                  className={`h-7 rounded border text-[9px] ${
                                    String(devImportedAutoSmoothAngle || "180") === angle
                                      ? "border-cyan-300 bg-cyan-900/45 text-cyan-100"
                                      : "border-slate-600 bg-slate-900 text-slate-200"
                                  }`}
                                >
                                  {angle}°
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setDevImportedWeldVertices((prev) => !prev)}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedWeldVertices
                                    ? "border-emerald-400/70 bg-emerald-900/35 text-emerald-100"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {devImportedWeldVertices ? "Solda real ON" : "Solda real OFF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDevImportedAutoMaskTopology((prev) => !prev)}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedAutoMaskTopology
                                    ? "border-cyan-400/70 bg-cyan-900/35 text-cyan-100"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {devImportedAutoMaskTopology ? "Auto-mask ON" : "Auto-mask OFF"}
                              </button>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-1">
                              <input
                                type="number"
                                min="0.000001"
                                max="0.01"
                                step="0.00001"
                                value={devImportedWeldEpsilon === "auto" ? "" : devImportedWeldEpsilon}
                                onChange={(event) => setDevImportedWeldEpsilon(event.target.value || "")}
                                placeholder="Weld epsilon"
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => setDevImportedWeldEpsilon("auto")}
                                className={`h-7 rounded border px-2 text-[9px] ${
                                  devImportedWeldEpsilon === "auto"
                                    ? "border-amber-300 bg-amber-800/55 text-white"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                Auto
                              </button>
                            </div>
                          </div>
                        </details>
                      ) : null}
                      {devModelViewportMode === "imported" ? (
                        <details className="rounded border border-fuchsia-500/30 bg-fuchsia-950/15 p-2">
                          <summary className="cursor-pointer list-none text-[10px] font-semibold text-fuchsia-200">
                            Textura Importada
                          </summary>
                          <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => handleSelectImportedTextureSlot("front")}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedTextureSlot === "front"
                                    ? "border-fuchsia-300 bg-fuchsia-800/55 text-white"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                Frente
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectImportedTextureSlot("side")}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedTextureSlot === "side"
                                    ? "border-fuchsia-300 bg-fuchsia-800/55 text-white"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                Lado
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectImportedTextureSlot("back")}
                                className={`h-7 rounded border text-[9px] ${
                                  devImportedTextureSlot === "back"
                                    ? "border-fuchsia-300 bg-fuchsia-800/55 text-white"
                                    : "border-slate-600 bg-slate-900 text-slate-200"
                                }`}
                              >
                                Costas
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={handleApplyImportedTextureSlot}
                              className="h-7 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[9px] text-emerald-100"
                            >
                              Aplicar slot no viewport
                            </button>
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="number"
                                step="0.05"
                                min="0.05"
                                max="64"
                                value={String(activeImportedTextureSettings.repeat_x ?? 1)}
                                onChange={(event) => updateActiveImportedTextureSetting("repeat_x", event.target.value)}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                                placeholder="Scale X"
                              />
                              <input
                                type="number"
                                step="0.05"
                                min="0.05"
                                max="64"
                                value={String(activeImportedTextureSettings.repeat_y ?? 1)}
                                onChange={(event) => updateActiveImportedTextureSetting("repeat_y", event.target.value)}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                                placeholder="Scale Y"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="-4"
                                max="4"
                                value={String(activeImportedTextureSettings.offset_x ?? 0)}
                                onChange={(event) => updateActiveImportedTextureSetting("offset_x", event.target.value)}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                                placeholder="Offset X"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="-4"
                                max="4"
                                value={String(activeImportedTextureSettings.offset_y ?? 0)}
                                onChange={(event) => updateActiveImportedTextureSetting("offset_y", event.target.value)}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                                placeholder="Offset Y"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-1">
                              <input
                                type="number"
                                step="1"
                                min="-360"
                                max="360"
                                value={String(activeImportedTextureSettings.rotation_deg ?? 0)}
                                onChange={(event) => updateActiveImportedTextureSetting("rotation_deg", event.target.value)}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-100"
                                placeholder="Rotacao"
                              />
                              <button
                                type="button"
                                onClick={resetActiveImportedTextureSettings}
                                className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[9px] text-slate-200"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        </details>
                      ) : null}
                      <div className="rounded border border-cyan-500/30 bg-slate-950/70 p-1.5">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-cyan-200">Historico</p>
                          <span className="text-[9px] text-cyan-300/80">
                            {modelerHistoryCursor + 1}/{Math.max(1, modelerHistoryView.length)}
                          </span>
                        </div>
                        <div className="mb-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleUndoModelerAction}
                            className="h-6 flex-1 rounded border border-amber-500/70 bg-amber-900/35 px-2 text-[9px] text-amber-100"
                          >
                            Desfazer
                          </button>
                          <button
                            type="button"
                            onClick={handleRedoModelerAction}
                            className="h-6 flex-1 rounded border border-sky-500/70 bg-sky-900/35 px-2 text-[9px] text-sky-100"
                          >
                            Refazer
                          </button>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto rounded border border-slate-700 bg-slate-950/60 p-1">
                          {modelerHistoryView.length ? (
                            modelerHistoryView.map((item, index) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleJumpModelerHistory(index)}
                                className={`mb-1 flex h-6 w-full items-center rounded border px-2 text-left text-[9px] ${
                                  modelerHistoryCursor === index
                                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                                    : "border-slate-700 bg-slate-900 text-slate-200"
                                }`}
                              >
                                {index + 1}. {item.label}
                              </button>
                            ))
                          ) : (
                            <p className="px-1 py-2 text-[9px] text-slate-400">Sem histórico ainda.</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded border border-fuchsia-500/35 bg-fuchsia-950/20 p-2">
                        <p className="text-[10px] font-semibold text-fuchsia-200">Pintura do objeto</p>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setDevModelTool("paint")}
                            className={`h-7 rounded border text-[10px] ${
                              devModelTool === "paint"
                                ? "border-fuchsia-300 bg-fuchsia-800/60 text-white"
                                : "border-slate-600 bg-slate-900 text-slate-200"
                            }`}
                          >
                            Pincel pintar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDevModelTool("smooth")}
                            className={`h-7 rounded border text-[10px] ${
                              devModelTool === "smooth"
                                ? "border-fuchsia-300 bg-fuchsia-800/60 text-white"
                                : "border-slate-600 bg-slate-900 text-slate-200"
                            }`}
                          >
                            Suavizar
                          </button>
                        </div>
                        <label className="mt-1 block text-[9px] text-fuchsia-200">Cor do pincel</label>
                        <input
                          type="color"
                          value={devModelPaintColor}
                          onChange={(event) => setDevModelPaintColor(event.target.value)}
                          className="h-8 w-full rounded border border-slate-600 bg-slate-900"
                        />
                        <p className="mt-1 text-[9px] text-fuchsia-200/85">
                          No viewport: botao direito apaga para branco.
                        </p>
                      </div>
                    </div>
                    <div className="rounded border border-cyan-500/30 bg-slate-950/70 p-2">
                      <p className="text-[10px] font-semibold text-cyan-200">Menu de lista</p>
                      <div className="mt-1 space-y-1 rounded border border-violet-500/35 bg-violet-950/20 p-2">
                        <p className="text-[10px] font-semibold text-violet-200">Partes do arquivo 3D</p>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={handleAddCurrentPartToFile}
                            className="h-7 rounded border border-violet-500/65 bg-violet-900/35 text-[10px]"
                          >
                            + Nova parte
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveActiveModelPart}
                            className="h-7 rounded border border-rose-500/65 bg-rose-900/35 text-[10px]"
                          >
                            Remover ativa
                          </button>
                        </div>
                        <select
                          value={devModelActivePartId}
                          onChange={(event) => handleSelectModelPart(event.target.value)}
                          className="h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                        >
                          <option value="">Parte atual (não salva)</option>
                          {buildResolvedModelParts().map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.name}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={devModelPartOffsetX}
                            onChange={(event) => setDevModelPartOffsetX(event.target.value)}
                            placeholder="Off X"
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={devModelPartOffsetY}
                            onChange={(event) => setDevModelPartOffsetY(event.target.value)}
                            placeholder="Off Y"
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={devModelPartOffsetZ}
                            onChange={(event) => setDevModelPartOffsetZ(event.target.value)}
                            placeholder="Off Z"
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                          />
                        </div>
                      </div>
                      {devModelViewportMode === "procedural" ? (
                        <>
                          <select
                            value={devModelPrimitive}
                            onChange={(event) => setDevModelPrimitive(event.target.value)}
                            className="mt-1 h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                          >
                            <option value="box">Box</option>
                            <option value="cylinder">Cilindro</option>
                            <option value="plane">Plane</option>
                            <option value="sphere">Esfera</option>
                          </select>
                          <p className="mt-2 text-[10px] font-semibold text-cyan-200">Dimensoes</p>
                          <div className="mt-1 grid grid-cols-3 gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={devModelWidth}
                              onChange={(event) => setDevModelWidth(event.target.value)}
                              placeholder="Largura"
                              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={devModelHeight}
                              onChange={(event) => setDevModelHeight(event.target.value)}
                              placeholder="Altura"
                              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={devModelDepth}
                              onChange={(event) => setDevModelDepth(event.target.value)}
                              placeholder="Prof."
                              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            />
                          </div>
                          {devModelPrimitive === "cylinder" ? (
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <input
                                type="number"
                                step="0.1"
                                value={devModelRadiusTop}
                                onChange={(event) => setDevModelRadiusTop(event.target.value)}
                                placeholder="Raio topo"
                                className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                              />
                              <input
                                type="number"
                                step="0.1"
                                value={devModelRadiusBottom}
                                onChange={(event) => setDevModelRadiusBottom(event.target.value)}
                                placeholder="Raio base"
                                className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                              />
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-1 rounded border border-amber-500/35 bg-amber-950/20 p-2 text-[9px] text-amber-100/90">
                          Modo importado detectado. Dimensoes/primitivo sao do arquivo original e a edicao acontece direto na malha.
                        </p>
                      )}
                    </div>
                    <div className="rounded border border-cyan-500/30 bg-slate-950/70 p-2">
                      <p className="text-[11px] font-semibold text-cyan-200">Galeria de texturas</p>
                      <div className="mt-1 rounded border border-cyan-500/35 bg-cyan-950/25 p-2 text-[11px]">
                        {devModelViewportMode === "imported" ? (
                          <div className="space-y-1">
                            <p>
                              Tris importado: <span className="font-semibold">{Math.max(0, Number(devImportedMeshStats?.triangles) || 0)}</span>
                            </p>
                            <p>
                              Vertices: <span className="font-semibold">{Math.max(0, Number(devImportedMeshStats?.vertices) || 0)}</span>
                            </p>
                            <p>
                              Grupos grudados: <span className="font-semibold">{Math.max(0, Number(devImportedMeshStats?.weldGroups) || 0)}</span>
                            </p>
                            <p>
                              Vertices duplicados: <span className="font-semibold">{Math.max(0, Number(devImportedMeshStats?.duplicateVertices) || 0)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span>
                              Tris estimados: <span className="font-semibold">{devModelPolygonEstimate}</span>
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                devModelPolyBudgetStatus.tone === "ok"
                                  ? "bg-emerald-900/45 text-emerald-200"
                                  : devModelPolyBudgetStatus.tone === "warn"
                                    ? "bg-amber-900/45 text-amber-200"
                                    : "bg-rose-900/45 text-rose-200"
                              }`}
                            >
                              {devModelPolyBudgetStatus.label}
                            </span>
                          </div>
                        )}
                      </div>
                      {devModelViewportMode === "procedural" ? (
                        <button
                          type="button"
                          onClick={() => setDevModelWeldVertices((prev) => !prev)}
                          className={`mt-1 h-8 rounded border text-[11px] ${
                            devModelWeldVertices
                              ? "border-emerald-400/70 bg-emerald-900/35 text-emerald-100"
                              : "border-slate-600 bg-slate-900 text-slate-300"
                          }`}
                          title="Quando ativo, solda os vertices para inflar sem abrir costuras."
                        >
                          {devModelWeldVertices ? "Vertices grudados: ON" : "Vertices grudados: OFF"}
                        </button>
                      ) : null}
                      {devModelViewportMode === "procedural" ? (
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            min={1}
                            value={devModelWidthSegments}
                            onChange={(event) => setDevModelWidthSegments(event.target.value)}
                            placeholder="Seg. largura"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            min={1}
                            value={devModelHeightSegments}
                            onChange={(event) => setDevModelHeightSegments(event.target.value)}
                            placeholder="Seg. altura"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            min={1}
                            value={devModelDepthSegments}
                            onChange={(event) => setDevModelDepthSegments(event.target.value)}
                            placeholder="Seg. profundidade"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            min={3}
                            value={devModelRadialSegments}
                            onChange={(event) => setDevModelRadialSegments(event.target.value)}
                            placeholder="Seg. radial"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-[9px] text-cyan-300/80">
                          Segmentos do primitivo ficam ocultos no modo importado. Use +Poli e Corte rapido no viewport.
                        </p>
                      )}
                      <div className="mt-2 space-y-1 rounded border border-cyan-500/30 bg-slate-900/50 p-2">
                        <div className="grid grid-cols-2 gap-1">
                          <select
                            value={devModelSelectedSide}
                            onChange={(event) => setDevModelSelectedSide(event.target.value)}
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          >
                            {modelSideOptions.map((side) => (
                              <option key={side.key} value={side.key}>
                                {side.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => modelerTextureUploadInputRef.current?.click()}
                            className="h-8 rounded border border-indigo-500/70 bg-indigo-900/35 text-[11px] text-indigo-100"
                          >
                            Upload
                          </button>
                        </div>
                        <p className="text-[10px] text-cyan-300/80">
                          Lado atual: <span className="font-semibold">{devModelSelectedSide}</span>
                        </p>
                        {selectedModelSideTextureUrl ? (
                          <div className="h-16 overflow-hidden rounded border border-slate-700 bg-slate-950">
                            <img
                              src={selectedModelSideTextureUrl}
                              alt="Textura selecionada"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 items-center justify-center rounded border border-dashed border-slate-700 text-[10px] text-slate-400">
                            Sem textura no lado
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={String(devModelTextureDraft.repeat_x ?? 1)}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, repeat_x: event.target.value }))
                            }
                            placeholder="Repeat X"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={String(devModelTextureDraft.repeat_y ?? 1)}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, repeat_y: event.target.value }))
                            }
                            placeholder="Repeat Y"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(devModelTextureDraft.offset_x ?? 0)}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, offset_x: event.target.value }))
                            }
                            placeholder="Offset X"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(devModelTextureDraft.offset_y ?? 0)}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, offset_y: event.target.value }))
                            }
                            placeholder="Offset Y"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <input
                            type="number"
                            step="1"
                            value={String(devModelTextureDraft.rotation_deg ?? 0)}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, rotation_deg: event.target.value }))
                            }
                            placeholder="Rotacao"
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          />
                          <select
                            value={String(devModelTextureDraft.wrap || "repeat")}
                            onChange={(event) =>
                              setDevModelTextureDraft((prev) => ({ ...prev, wrap: event.target.value }))
                            }
                            className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100"
                          >
                            <option value="repeat">Repeat</option>
                            <option value="clamp">Clamp</option>
                            <option value="mirror">Mirror</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={handleAssignModelTextureToSide}
                            className="h-8 rounded border border-cyan-500/70 bg-cyan-900/35 text-[11px]"
                          >
                            Aplicar no lado
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyTextureSettingsToSide}
                            className="h-8 rounded border border-sky-500/70 bg-sky-900/35 text-[11px] text-sky-100"
                          >
                            Salvar config UV
                          </button>
                        </div>
                        {selectedObjectIsProcedural ? (
                          <button
                            type="button"
                            onClick={handleApplyTextureToSelectedProceduralSide}
                            className="h-8 w-full rounded border border-amber-500/70 bg-amber-900/30 text-[11px]"
                          >
                            Aplicar no item selecionado
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleAddProceduralObject}
                          className="h-9 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[11px]"
                        >
                          Adicionar objeto 3D no mapa
                        </button>
                    <button
                      type="button"
                      onClick={handleAddImportedModelToMap}
                      className="h-8 w-full rounded border border-amber-500/70 bg-amber-900/30 text-[11px] text-amber-100"
                    >
                      Adicionar modelo importado no mapa
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceSelectedWithImportedModel}
                      disabled={!devModelImported3dUrl || !devSelectedObject?.key}
                      className={`h-8 w-full rounded border text-[11px] ${
                        devModelImported3dUrl && devSelectedObject?.key
                          ? "border-orange-500/70 bg-orange-900/30 text-orange-100"
                          : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                      }`}
                    >
                      Substituir selecionado pelo importado
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseImportedWithPrompt}
                      disabled={!devModelImported3dUrl}
                      className={`h-8 w-full rounded border text-[11px] ${
                        devModelImported3dUrl
                          ? "border-rose-500/70 bg-rose-900/30 text-rose-100"
                          : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                      }`}
                    >
                      Fechar importado
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedObject}
                      disabled={!devSelectedObject?.key || selectedObjectDeleteBlocked}
                      className={`h-8 w-full rounded border text-[11px] ${
                        devSelectedObject?.key && !selectedObjectDeleteBlocked
                          ? "border-rose-500/70 bg-rose-900/30 text-rose-100"
                          : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                      }`}
                    >
                      Excluir objeto selecionado do mapa
                    </button>
                    {devModelImported3dUrl ? (
                      <p className="text-[9px] text-amber-200/90">
                        Importado: <span className="font-semibold">{devModelImported3dName || getAssetFileName(devModelImported3dUrl)}</span>
                      </p>
                    ) : null}
                    {devModelImportedPreviewError ? (
                      <p className="text-[9px] text-rose-200/90">{devModelImportedPreviewError}</p>
                    ) : null}
                      </div>
                      <div className="mt-2 max-h-[460px] overflow-y-auto rounded border border-slate-700 bg-slate-950/60 p-1">
                        {devModelTextureOptions.length ? (
                          <div className="grid grid-cols-3 gap-1">
                            {devModelTextureOptions.map((option) => (
                              <div
                                key={option.value}
                                className={`rounded border p-1 ${
                                  String(
                                    devModelViewportMode === "imported"
                                      ? devImportedTextureOverride
                                      : devModelSelectedTexture
                                  ) === String(option.value || "")
                                    ? "border-cyan-400 bg-cyan-900/25"
                                    : "border-slate-700 bg-slate-900/70"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectModelerTexture(option.value)}
                                  className="block aspect-square w-full overflow-hidden rounded border border-slate-700 bg-slate-950"
                                  title={option.fileName}
                                >
                                  <img
                                    src={option.value}
                                    alt={option.fileName}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                                <div className="mt-1 grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectModelerTexture(option.value)}
                                    className="h-6 rounded border border-cyan-500/70 bg-cyan-900/35 text-[9px] text-cyan-100"
                                  >
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGalleryAsset(option)}
                                    className="h-6 rounded border border-rose-500/70 bg-rose-900/30 text-[9px] text-rose-100"
                                  >
                                    Del
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-1 py-2 text-[10px] text-slate-400">Nenhuma textura na galeria.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <input
            ref={selectedTextureUploadInputRef}
            type="file"
            accept={DEV_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => handleAssetUpload("selected_texture", event)}
          />
          <input
            ref={galleryUploadInputRef}
            type="file"
            accept={DEV_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => handleAssetUpload("gallery_asset", event)}
          />
          <input
            ref={modelerTextureUploadInputRef}
            type="file"
            accept=".png,.webp,.jpg,.jpeg,image/*"
            className="hidden"
            onChange={handleModelerTextureUpload}
          />
          <input
            ref={modelerImport3dInputRef}
            type="file"
            accept=".glb,.gltf,.fbx,.obj,.stl,model/gltf-binary,model/gltf+json,model/stl"
            className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-0"
            onChange={handleModelerImport3dUpload}
          />
          {isDevMode && !devFloatingUiCollapsed && devSelectedObject?.key ? (() => {
            const shouldUseChallengeDevSidebar = screen === "challenge" && isDevMode;
            const renderSelectedObjectPanel = (useSidebarLayout) => (
              <div
                ref={devContextMenuRef}
                className={`border border-cyan-500/70 bg-slate-950/95 p-2 text-[11px] text-cyan-100 shadow-xl ${
                  useSidebarLayout
                    ? "flex h-full min-h-0 flex-col overflow-y-auto rounded-[1.5rem] md:w-full md:p-4"
                    : "absolute z-50 w-52 rounded-md"
                }`}
                style={
                  useSidebarLayout
                    ? undefined
                    : { left: `${devContextMenuPos.x}px`, top: `${devContextMenuPos.y}px` }
                }
              >
                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={useSidebarLayout ? undefined : handleDevContextMenuPointerDown}
                  className={`mb-1 flex touch-none select-none items-center justify-between rounded border border-cyan-500/40 bg-cyan-900/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 ${
                    useSidebarLayout
                      ? "cursor-default"
                      : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <span>{useSidebarLayout ? "Item selecionado" : "Menu do item"}</span>
                  {useSidebarLayout ? (
                    <span className="text-cyan-300/80">painel lateral</span>
                  ) : (
                    <span className="text-cyan-300/80">arrastar</span>
                  )}
                </div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-cyan-200">{devSelectedObject.label || devSelectedObject.key}</p>
                <button
                  type="button"
                  onClick={handleCloseDevEditingMenu}
                  className="h-6 w-6 rounded border border-slate-500 bg-slate-900 text-[10px] leading-none text-slate-200"
                >
                  X
                </button>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setDevInteractionMode((prev) => (prev === "move" ? "select" : "move"))}
                  className={`h-7 rounded border text-[10px] ${
                    devInteractionMode === "move"
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900 text-slate-200"
                  }`}
                >
                  {devInteractionMode === "move" ? "Mover ON" : "Mover"}
                </button>
                <button
                  type="button"
                  onClick={() => selectedTextureUploadInputRef.current?.click()}
                  className="h-7 rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px]"
                >
                  Trocar textura
                </button>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("y", -0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 rounded border border-violet-500/60 bg-violet-900/30 text-[10px]"
                >
                  Altura -
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("y", 0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 rounded border border-violet-500/60 bg-violet-900/30 text-[10px]"
                >
                  Altura +
                </button>
              </div>
              <div className="mt-1 rounded border border-cyan-500/35 bg-cyan-950/20 p-2">
                <p className="text-[10px] font-semibold text-cyan-200">Mover no mapa</p>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <div />
                  <button
                    type="button"
                    onPointerDown={(event) => startSelectedNudgeHold("z", -0.1, event)}
                    onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                    className="h-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                    title="Frente"
                  >
                    ↑
                  </button>
                  <div />
                  <button
                    type="button"
                    onPointerDown={(event) => startSelectedNudgeHold("x", -0.1, event)}
                    onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                    className="h-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                    title="Esquerda"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => startSelectedNudgeHold("z", 0.1, event)}
                    onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                    className="h-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                    title="Tras"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => startSelectedNudgeHold("x", 0.1, event)}
                    onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                    onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                    className="h-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                    title="Direita"
                  >
                    →
                  </button>
                  <div />
                  <div className="flex items-center justify-center rounded border border-violet-500/35 bg-violet-950/20 text-[9px] text-violet-200">
                    Use Altura +/- acima
                  </div>
                  <div />
                </div>
              </div>
              {selectedObjectIsProcedural ? (
                <div className="mt-1 space-y-1 rounded border border-cyan-500/35 bg-cyan-950/20 p-2">
                  <p className="text-[10px] font-semibold text-cyan-200">Textura por lado (3D)</p>
                  <select
                    value={devModelSelectedSide}
                    onChange={(event) => setDevModelSelectedSide(event.target.value)}
                    className="h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                  >
                    {modelSideOptions.map((side) => (
                      <option key={side.key} value={side.key}>
                        {side.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={devModelSelectedTexture}
                    onChange={(event) => setDevModelSelectedTexture(event.target.value)}
                    className="h-7 w-full rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                  >
                    <option value="">Selecione textura</option>
                    {devModelTextureOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.fileName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyTextureToSelectedProceduralSide}
                    className="h-7 w-full rounded border border-cyan-500/70 bg-cyan-900/35 text-[10px]"
                  >
                    Aplicar textura no lado
                  </button>
                </div>
              ) : null}
              {selectedObjectSupportsBrushSculpt ? (
                <div className="mt-1 space-y-1 rounded border border-fuchsia-500/35 bg-fuchsia-950/20 p-2">
                  <p className="text-[10px] font-semibold text-fuchsia-200">Modelar no cenario (pincel)</p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setDevModelToolMenuMode("model")}
                      className={`h-7 rounded border text-[9px] ${
                        devModelToolMenuMode === "model"
                          ? "border-cyan-400 bg-cyan-900/35 text-cyan-100"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Modelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevModelToolMenuMode("sculpt")}
                      className={`h-7 rounded border text-[9px] ${
                        devModelToolMenuMode === "sculpt"
                          ? "border-fuchsia-300 bg-fuchsia-800/70 text-white"
                          : "border-slate-600 bg-slate-900 text-slate-200"
                      }`}
                    >
                      Esculpir
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(devModelToolMenuMode === "sculpt" ? MODELER_SCULPT_BRUSHES : MODELER_MODEL_TOOLS).map((tool) => (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => setDevModelTool(tool.key)}
                        className={`h-7 rounded border text-[9px] ${
                          devModelTool === tool.key
                            ? "border-fuchsia-300 bg-fuchsia-800/70 text-white"
                            : "border-slate-600 bg-slate-900 text-slate-200"
                        }`}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1 rounded border border-fuchsia-500/25 bg-slate-900/40 p-1.5">
                    <label className="block text-[9px] text-fuchsia-200">Cor</label>
                    <input
                      type="color"
                      value={devModelPaintColor}
                      onChange={(event) => setDevModelPaintColor(event.target.value)}
                      className="h-8 w-full rounded border border-slate-600 bg-slate-900"
                    />
                    <label className="block text-[9px] text-fuchsia-200">
                      Raio: {Number(devModelBrushRadius || 0.9).toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.05"
                      value={String(devModelBrushRadius || "0.9")}
                      onChange={(event) => setDevModelBrushRadius(event.target.value)}
                      className="w-full"
                    />
                    <label className="block text-[9px] text-fuchsia-200">
                      Forca base: {Number(devModelBrushStrength || 0.025).toFixed(3)}
                    </label>
                    <input
                      type="range"
                      min="0.005"
                      max="0.12"
                      step="0.0025"
                      value={String(devModelBrushStrength || "0.025")}
                      onChange={(event) => setDevModelBrushStrength(event.target.value)}
                      className="w-full"
                    />
                    <label className="block text-[9px] text-fuchsia-200">
                      Intensidade ({activeBrushToolLabel}): {Number(activeBrushToolIntensity || 0.3).toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="2"
                      step="0.05"
                      value={String(activeBrushToolIntensity || 0.3)}
                      onChange={(event) => handleToolStrengthChange(activeBrushToolKey, event.target.value)}
                      className="w-full"
                    />
                  </div>
                  <p className="text-[9px] text-fuchsia-200/90">
                    Clique e arraste no objeto selecionado. Botao direito inverte o efeito.
                  </p>
                </div>
              ) : null}
              <p className="mt-1 text-[10px] text-cyan-300/90">Y: {devPositionDraft.y}</p>
              {selectedObjectCanBindSpecialSegment ? (
                <div className="mt-1 space-y-2 rounded border border-amber-500/35 bg-amber-950/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-amber-200">Dados logicos da pista</p>
                    {selectedObjectIsSpecialSegment ? (
                      <button
                        type="button"
                        onClick={handleClearSelectedSpecialSegmentBinding}
                        className="rounded border border-rose-500/50 bg-rose-500/10 px-2 py-1 text-[9px] font-semibold text-rose-100 hover:bg-rose-500/20"
                      >
                        Remover logica
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => handleBindSelectedObjectToSpecialSegment("wood_bridge")}
                      className={`rounded px-2 py-1 text-[9px] font-semibold ${
                        selectedSpecialSegmentDefinition?.id === "wood_bridge"
                          ? "bg-amber-300 text-slate-950"
                          : "border border-amber-500/40 bg-slate-900/70 text-amber-100 hover:bg-amber-500/10"
                      }`}
                    >
                      Usar como ponte
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBindSelectedObjectToSpecialSegment("pit_gap")}
                      className={`rounded px-2 py-1 text-[9px] font-semibold ${
                        selectedSpecialSegmentType === "pit_gap"
                          ? "bg-amber-300 text-slate-950"
                          : "border border-amber-500/40 bg-slate-900/70 text-amber-100 hover:bg-amber-500/10"
                      }`}
                    >
                      Usar como abismo
                    </button>
                  </div>
                  <p className="text-[9px] text-amber-100/80">
                    Isso acopla altura, subida, plano, descida ou gap ao objeto 3D selecionado.
                  </p>
                </div>
              ) : null}
              {selectedObjectIsSpecialSegment ? (
                <div className="mt-1 space-y-2 rounded border border-fuchsia-500/35 bg-fuchsia-950/20 p-2">
                  <p className="text-[10px] font-semibold text-fuchsia-200">
                    {selectedSpecialSegmentType === "pit_gap" ? "Abismo" : "Segmento elevado"}
                  </p>
                  {selectedSpecialSegmentType === "pit_gap" ? (
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={String(Number(selectedObjectOverride?.segment_gap_length ?? selectedModelEntry?.segment_gap_length ?? 7.5))}
                        onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_gap_length", event.target.value)}
                        className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                        placeholder="Comprimento"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={String(Number(selectedObjectOverride?.segment_drop_depth ?? selectedModelEntry?.segment_drop_depth ?? 2.4))}
                        onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_drop_depth", event.target.value)}
                        className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                        placeholder="Profundidade"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="space-y-1 rounded border border-cyan-500/20 bg-slate-900/40 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-200">Forma da logica</p>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Altura</span>
                            <span>{Number(selectedObjectOverride?.segment_height ?? selectedModelEntry?.segment_height ?? 1.18).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.02"
                            max="4"
                            step="0.02"
                            value={String(Number(selectedObjectOverride?.segment_height ?? selectedModelEntry?.segment_height ?? 1.18))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_height", event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Inicio da subida</span>
                            <span>{Number(selectedObjectOverride?.segment_entry_length ?? selectedModelEntry?.segment_entry_length ?? 16).toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="40"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.segment_entry_length ?? selectedModelEntry?.segment_entry_length ?? 16))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_entry_length", event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Plano</span>
                            <span>{Number(selectedObjectOverride?.segment_flat_length ?? selectedModelEntry?.segment_flat_length ?? 34).toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="80"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.segment_flat_length ?? selectedModelEntry?.segment_flat_length ?? 34))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_flat_length", event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Final da descida</span>
                            <span>{Number(selectedObjectOverride?.segment_exit_length ?? selectedModelEntry?.segment_exit_length ?? 16).toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="40"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.segment_exit_length ?? selectedModelEntry?.segment_exit_length ?? 16))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_exit_length", event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Largura da logica</span>
                            <span>{Number(selectedObjectOverride?.segment_logic_width ?? selectedModelEntry?.segment_logic_width ?? 7.25).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="12"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.segment_logic_width ?? selectedModelEntry?.segment_logic_width ?? 7.25))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_logic_width", event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="space-y-1 rounded border border-cyan-500/20 bg-slate-900/40 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-200">Posicao da logica</p>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Offset na pista</span>
                            <span>{Number(selectedObjectOverride?.segment_logic_offset_z ?? selectedModelEntry?.segment_logic_offset_z ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="-40"
                            max="40"
                            step="0.1"
                            value={String(Number(selectedObjectOverride?.segment_logic_offset_z ?? selectedModelEntry?.segment_logic_offset_z ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_logic_offset_z", event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[9px] text-cyan-100">
                          <div className="flex items-center justify-between">
                            <span>Altura extra da logica</span>
                            <span>{Number(selectedObjectOverride?.segment_logic_height_offset ?? selectedModelEntry?.segment_logic_height_offset ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="-2"
                            max="2"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.segment_logic_height_offset ?? selectedModelEntry?.segment_logic_height_offset ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("segment_logic_height_offset", event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="space-y-1 rounded border border-fuchsia-500/20 bg-slate-900/40 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200">Posicao do visual</p>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_offset_x ?? selectedModelEntry?.bridge_offset_x ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_offset_x", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="X"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_offset_y ?? selectedModelEntry?.bridge_offset_y ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_offset_y", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="Y"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_offset_z ?? selectedModelEntry?.bridge_offset_z ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_offset_z", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="Z"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 rounded border border-fuchsia-500/20 bg-slate-900/40 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200">Rotação do visual</p>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            step="1"
                            value={String(Number(selectedObjectOverride?.bridge_rotation_x ?? selectedModelEntry?.bridge_rotation_x ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_rotation_x", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="RX"
                          />
                          <input
                            type="number"
                            step="1"
                            value={String(Number(selectedObjectOverride?.bridge_rotation_y ?? selectedModelEntry?.bridge_rotation_y ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_rotation_y", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="RY"
                          />
                          <input
                            type="number"
                            step="1"
                            value={String(Number(selectedObjectOverride?.bridge_rotation_z ?? selectedModelEntry?.bridge_rotation_z ?? 0))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_rotation_z", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="RZ"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 rounded border border-fuchsia-500/20 bg-slate-900/40 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200">Escala do visual</p>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_scale_x ?? selectedModelEntry?.bridge_scale_x ?? 1))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_scale_x", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="SX"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_scale_y ?? selectedModelEntry?.bridge_scale_y ?? 1))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_scale_y", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="SY"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={String(Number(selectedObjectOverride?.bridge_scale_z ?? selectedModelEntry?.bridge_scale_z ?? 1))}
                            onChange={(event) => handleSelectedSpecialSegmentFieldChange("bridge_scale_z", event.target.value)}
                            className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                            placeholder="SZ"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-fuchsia-200/80">
                    Altura/entrada/plano/saida definem a gameplay. A posicao da logica alinha a trilha invisivel. Posicao, rotacao e escala ajustam o visual da ponte.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApplySelectedSpecialSegmentLogic}
                      className="rounded border border-emerald-400/45 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Aplicar logica e salvar
                    </button>
                  </div>
                </div>
              ) : null}
              {selectedObjectIsHorizon ? (
                <div className="mt-1 space-y-1 rounded border border-cyan-500/35 bg-cyan-950/20 p-2">
                  <p className="text-[10px] font-semibold text-cyan-200">Curvatura do horizonte</p>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={String(
                        Number.isFinite(Number(selectedObjectOverride?.horizon_curve_side))
                          ? Number(selectedObjectOverride.horizon_curve_side)
                          : 12
                      )}
                      onChange={(event) =>
                        handleSelectedHorizonStyleChange("horizon_curve_side", event.target.value)
                      }
                      className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                      placeholder="Curva frente"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={String(
                        Number.isFinite(Number(selectedObjectOverride?.horizon_curve_down))
                          ? Number(selectedObjectOverride.horizon_curve_down)
                          : 3.2
                      )}
                      onChange={(event) =>
                        handleSelectedHorizonStyleChange("horizon_curve_down", event.target.value)
                      }
                      className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100"
                      placeholder="Queda lateral"
                    />
              </div>
              <button
                type="button"
                    onClick={handleResetSelectedHorizonStyle}
                    className="h-7 w-full rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                  >
                    Resetar horizonte
                  </button>
                </div>
              ) : null}
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("uniform", -0.1)}
                  className="h-7 rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px]"
                >
                  Tamanho -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("uniform", 0.1)}
                  className="h-7 rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px]"
                >
                  Tamanho +
                </button>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("x", -0.1)}
                  className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                >
                  Esticar X -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("x", 0.1)}
                  className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                >
                  Esticar X +
                </button>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("y", -0.1)}
                  className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                >
                  Esticar Y -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedScale("y", 0.1)}
                  className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                >
                  Esticar Y +
                </button>
              </div>
              {(devSelectedObject?.type === "player" || devSelectedObject?.type === "boss" || selectedObjectIsModel3d) ? (
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedScale("z", -0.1)}
                    className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                  >
                    Esticar Z -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedScale("z", 0.1)}
                    className="h-7 rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px]"
                  >
                    Esticar Z +
                  </button>
                </div>
              ) : null}
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedRotateHold(-0.5, "y", event)}
                  onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                  className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                >
                  Girar -0.5
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedRotateHold(0.5, "y", event)}
                  onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                  className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                >
                  Girar +0.5
                </button>
              </div>
              {selectedObjectSupportsRoadShadow ? (
                <div className="mt-1 rounded border border-slate-500/35 bg-slate-950/25 p-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectedRoadShadow}
                    className={`h-8 w-full rounded border text-[10px] ${
                      selectedObjectOverride?.casts_road_shadow === true
                        ? "border-slate-300/70 bg-slate-200/10 text-slate-100"
                        : "border-slate-600 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {selectedObjectOverride?.casts_road_shadow === true
                      ? "Sombra na estrada: ON"
                      : "Sombra na estrada: OFF"}
                  </button>
                </div>
              ) : null}
              {selectedModelDiagnostics ? (
                <div className="mt-1 rounded border border-emerald-500/35 bg-emerald-950/20 p-2">
                  <p className="text-[10px] font-semibold text-emerald-200">Diagnostico do modelo</p>
                  <p className="mt-1 truncate text-[9px] text-emerald-100/90">{selectedModelDiagnostics.canonicalName}</p>
                  <div
                    className={`mt-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      selectedModelDiagnostics.runtimeTone === "emerald"
                        ? "border-emerald-400/55 bg-emerald-500/15 text-emerald-100"
                        : selectedModelDiagnostics.runtimeTone === "amber"
                          ? "border-amber-400/55 bg-amber-500/15 text-amber-100"
                          : "border-rose-400/55 bg-rose-500/15 text-rose-100"
                    }`}
                  >
                    {selectedModelDiagnostics.runtimeLabel}
                  </div>
                  <p className="mt-1 text-[9px] text-emerald-100/80">
                    Copias no mapa: {selectedModelDiagnostics.duplicateCount}
                  </p>
                  <p className="text-[9px] text-emerald-100/80">
                    Movimento: {selectedModelDiagnostics.movementMode}
                  </p>
                  {selectedModelDiagnostics.nativeMaxDim ? (
                    <p className="text-[9px] text-emerald-100/80">
                      Tamanho nativo max: {selectedModelDiagnostics.nativeMaxDim.toFixed(2)}
                    </p>
                  ) : null}
                  {selectedModelDiagnostics.autoScaleFactor ? (
                    <p className="text-[9px] text-emerald-100/80">
                      Auto ajuste atual: {selectedModelDiagnostics.autoScaleFactor.toFixed(2)}x
                    </p>
                  ) : null}
                  <p className="text-[9px] text-emerald-100/80">
                    Runtime leve: {selectedModelDiagnostics.instancingCandidate
                      ? "instancing ativo agora"
                      : selectedModelDiagnostics.gameplayInstancingReady
                        ? "instancing no jogo; individual so na selecao do editor"
                        : "ficara individual"}
                  </p>
                  {selectedModelDiagnostics.blockedReasons?.length ? (
                    <div className="mt-2 rounded border border-slate-500/30 bg-slate-950/25 p-2">
                      <p className="text-[9px] font-semibold text-slate-100">Motivos do estado atual</p>
                      {selectedModelDiagnostics.blockedReasons.map((reason) => (
                        <p key={reason} className="mt-1 text-[9px] text-slate-200/80">
                          - {reason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-[9px] text-emerald-100/75">
                    {selectedModelDiagnostics.gameplayInstancingReady
                      ? "Pode manter as copias no mapa. No jogo elas viram batch/instancing."
                      : "Se quiser leveza maxima, vale corrigir os itens acima antes de duplicar mais esse asset."}
                  </p>
                </div>
              ) : null}
              {selectedObjectIsModel3d ? (
                <div className="mt-1 space-y-1 rounded border border-amber-500/35 bg-amber-950/20 p-2">
                  <p className="text-[10px] font-semibold text-amber-200">Ajuste 3D na cena</p>
                  {String(devSelectedObject?.key || "").startsWith("custom_") ? (
                    <button
                      type="button"
                      onClick={handlePinSelectedObjectAsRoad}
                      className="h-7 w-full rounded border border-emerald-500/70 bg-emerald-900/35 text-[10px] text-emerald-100"
                    >
                      Fixar no chao como estrada
                    </button>
                  ) : null}
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onPointerDown={(event) => startSelectedRotateHold(-0.5, "x", event)}
                      onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                      className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                    >
                      Inclinar X -
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => startSelectedRotateHold(0.5, "x", event)}
                      onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                      className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                    >
                      Inclinar X +
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onPointerDown={(event) => startSelectedRotateHold(-0.5, "z", event)}
                      onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                      className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                    >
                      Inclinar Z -
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => startSelectedRotateHold(0.5, "z", event)}
                      onPointerUp={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerCancel={(event) => stopSelectedRotateHold(event.pointerId)}
                      onPointerLeave={(event) => stopSelectedRotateHold(event.pointerId)}
                      className="h-7 rounded border border-amber-500/60 bg-amber-900/30 text-[10px]"
                    >
                      Inclinar Z +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSelectedModelFollowRoadCurve}
                    className={`h-7 w-full rounded border text-[10px] ${
                      selectedObjectOverride?.follow_road_curve
                        ? "border-emerald-500/70 bg-emerald-900/35 text-emerald-100"
                        : "border-slate-600 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {selectedObjectOverride?.follow_road_curve ? "Seguir curvatura: ON" : "Seguir curvatura: OFF"}
                  </button>
                  <p className="text-[9px] text-amber-100/80">
                    Modelagem fina e variacoes agora devem ser feitas no Blender. O painel do mapa ficou focado em posicionar, rotacionar e encaixar.
                  </p>
                </div>
              ) : null}
              {selectedObjectIsFlowCapable && !selectedObjectIsModel3d ? (
                <button
                  type="button"
                  onClick={handleToggleSelectedObjectMovementMode}
                  className="mt-1 h-7 w-full rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px]"
                >
                  {selectedObjectMovementMode === "flow" ? "Modo esteira (andando)" : "Modo fixo (ancorado)"}
                </button>
              ) : null}
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={handleApplySelectedObjectEdits}
                  className="h-7 rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px] text-emerald-100"
                >
                  Salvar item
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedObject}
                  disabled={selectedObjectDeleteBlocked}
                  className={`h-7 rounded border text-[10px] ${
                    selectedObjectDeleteBlocked
                      ? "cursor-not-allowed border-slate-600 bg-slate-800/60 text-slate-400"
                      : "border-red-500/60 bg-red-900/30"
                  }`}
                >
                  {selectedObjectDeleteBlocked ? "Protegido" : "Excluir"}
                </button>
                <div className="flex h-7 items-center justify-center rounded border border-cyan-500/40 bg-cyan-900/20 text-[10px] text-cyan-100">
                  Auto-save draft
                </div>
              </div>
              <button
                type="button"
                onClick={handleFixSelectedObjectToCurrentTrecho}
                className="mt-1 h-7 w-full rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px] text-emerald-100"
              >
                Fixar no trecho atual
              </button>
              {devPersistDebug?.key === String(devSelectedObject?.key || "") ? (
                <div className="mt-1 rounded border border-amber-500/40 bg-amber-950/20 p-2 text-[9px] text-amber-100">
                  <p className="font-semibold text-amber-200">Debug salvar selecao</p>
                  <p className="mt-0.5 text-amber-300/90">modo: {devPersistDebug.mode} | {new Date(devPersistDebug.at).toLocaleTimeString()}</p>
                  <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded border border-amber-500/25 bg-slate-950/60 p-1">
{JSON.stringify(
  {
    esperado: devPersistDebug.expected,
    persistido: devPersistDebug.persisted,
  },
  null,
  2
)}
                  </pre>
                </div>
              ) : null}
              {!selectedObjectIsModel3d ? (
                <>
                  <button
                    type="button"
                    onClick={handleCloneSelectedObject}
                    className="mt-1 h-7 w-full rounded border border-emerald-500/60 bg-emerald-900/30 text-[10px]"
                  >
                    + Clonar
                  </button>
                  <button
                    type="button"
                    onClick={handleRepeatSelectedObjectAcrossCycle}
                    className="mt-1 h-7 w-full rounded border border-cyan-500/60 bg-cyan-900/30 text-[10px] text-cyan-100"
                  >
                    Preencher ciclo
                  </button>
                  <button
                    type="button"
                    onClick={handleTightenSelectedRepeatGroup}
                    className="mt-1 h-7 w-full rounded border border-indigo-500/60 bg-indigo-900/30 text-[10px] text-indigo-100"
                  >
                    Aproximar repetidos
                  </button>
                </>
              ) : null}
              <p className="mt-1 text-[10px] text-cyan-300/90">Arraste no objeto com `Mover ON`.</p>
              </div>
            );

            if (shouldUseChallengeDevSidebar) {
              return (
                <>
                  {createPortal(
                    <div className="pointer-events-none fixed inset-0 z-[141] hidden md:block">
                      <div className="absolute inset-y-0 right-0 w-[min(35rem,36vw)] bg-gradient-to-l from-slate-950/90 via-slate-950/78 to-transparent" />
                      <div className="pointer-events-auto absolute bottom-4 right-4 top-24 flex w-[min(33rem,calc(50vw-2rem))] min-w-[28rem] max-w-[35rem] flex-col">
                        {renderSelectedObjectPanel(true)}
                      </div>
                    </div>,
                    document.body
                  )}
                  <div className="md:hidden">{renderSelectedObjectPanel(false)}</div>
                </>
              );
            }

            return renderSelectedObjectPanel(false);
          })() : null}

          {screen === "challenge" &&
          isDevMode &&
          !devFloatingUiCollapsed &&
          devInteractionMode === "move" &&
          devSelectedObject?.key &&
          devMoveGizmoPos ? (
            <div
              className="absolute z-50 rounded-md border border-cyan-500/70 bg-slate-950/95 p-1 text-cyan-100 shadow-xl"
              style={{
                left: `${devMoveGizmoPos.x}px`,
                top: `${devMoveGizmoPos.y}px`,
                transform: "translate(-50%, -140%)",
              }}
            >
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("z", -0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                  title="Frente"
                >
                  ↑
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("x", -0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                  title="Esquerda"
                >
                  ←
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("z", 0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                  title="Tras"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("x", 0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-cyan-500/60 bg-cyan-900/30 text-[11px]"
                  title="Direita"
                >
                  →
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("y", 0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-violet-500/60 bg-violet-900/30 text-[10px]"
                  title="Subir"
                >
                  +Y
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={(event) => startSelectedNudgeHold("y", -0.1, event)}
                  onPointerUp={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerCancel={(event) => stopSelectedNudgeHold(event.pointerId)}
                  onPointerLeave={(event) => stopSelectedNudgeHold(event.pointerId)}
                  className="h-7 w-7 rounded border border-violet-500/60 bg-violet-900/30 text-[10px]"
                  title="Descer"
                >
                  -Y
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="absolute inset-0 overflow-hidden"
            onTouchStart={screen === "challenge" && !(isDevMode && isDevFreeCamera) ? handleChallengeTouchStart : undefined}
            onTouchMove={screen === "challenge" && !(isDevMode && isDevFreeCamera) ? handleChallengeTouchMove : undefined}
            onTouchEnd={screen === "challenge" && !(isDevMode && isDevFreeCamera) ? handleChallengeTouchEnd : undefined}
          >
            <React.Suspense fallback={null}>
              <Runner3DScene
                className="absolute inset-0"
                mode={screen === "challenge" ? "challenge" : "intro"}
                isPaused={isRunnerPaused}
                enableFreeCamera={isDevChallengeActive && isDevFreeCamera}
                freeCameraPreset={devCameraPreset}
                cameraResetToken={devCameraResetToken}
                runnerState={runnerState}
                runnerStateRef={runnerRuntimeStateRef}
                islandTheme={islandTheme}
                roadCurve={roadCurve}
                bossLane={bossLane}
                bossDrift={bossDrift}
                bossBump={bossBump}
                bossTilt={bossTilt}
                sandTextureUrl={resolvedSceneRoadTextureUrl || roadBaseColorImage}
                roadBaseNormalUrl={roadBaseNormalImage}
                roadBaseRoughnessUrl={roadBaseRoughnessImage}
                roadBaseAoUrl={roadBaseAoImage}
                treeTextureUrl={arvoreGameImage}
                vegetationTextureUrls={RUNNER_VEGETATION_TEXTURES}
                edgeVegetationTextureUrls={RUNNER_EDGE_VEGETATION_TEXTURES}
                disableAmbientVegetation={isBaseOnlyMap}
                obstacleTextureUrl={vegetacaoRochaImage}
                horizonTextureUrl={resolvedSceneHorizonTextureUrl || horizonteJogo3DImage}
                roadShoulderTextureUrl={roadShoulderBaseColorImage}
                roadShoulderNormalUrl={roadShoulderNormalImage}
                roadShoulderRoughnessUrl={roadShoulderRoughnessImage}
                roadShoulderAoUrl={roadShoulderAoImage}
                roadSlopeTextureUrl={sandTileImage}
                grassTopTextureUrl={gramaJogoCertoImage}
                shadowOverlayTextureUrl={sombraArvoreOkImage}
                showGuides={isDevChallengeActive}
                sceneConfig={sceneConfig}
                loadoutCharacterVariant={selectedCharacterRenderVariant}
                loadoutWardrobe={activeGameLoadoutWardrobe}
                elevatedBridgeDebugTransform={elevatedBridgeDebugTransform}
                graphicsSettings={runnerGraphicsSettings}
                sceneRenderDraft={devSceneRenderDraft}
                devDraftOverrides={isDevChallengeActive ? devDraftOverrides : null}
                selectedObjectKey={isDevChallengeActive ? devSelectedObject?.key || "" : ""}
                devInteractionMode={isDevChallengeActive ? devInteractionMode : "select"}
                devConveyorOffset={isDevChallengeActive ? devConveyorOffset : 0}
                devStageEditMode={isDevChallengeActive ? devStageEditMode : "map"}
                devMapCursorZ={isDevChallengeActive ? devMapCursorZ : 0}
                devBrushRadius={isDevChallengeActive ? Number(devModelBrushRadius) || 0.9 : 0.9}
                devBrushStrength={isDevChallengeActive ? Number(devModelBrushStrength) || 0.025 : 0.025}
                devPaintColor={isDevChallengeActive ? devModelPaintColor : "#9ca3af"}
                devToolStrengths={isDevChallengeActive ? devToolStrengths : null}
                devRoadSculpt={isDevChallengeActive ? devRoadSculptDraft : null}
                devRoadEvents={isDevChallengeActive ? devRoadEventBlocks : null}
                devSelectedRoadEventId={
                  isDevChallengeActive &&
                  !devFloatingUiCollapsed &&
                  !devRoadPanelCollapsed &&
                  devRoadEventsOpen
                    ? devSelectedRoadEventId
                    : ""
                }
                devCameraFollowDistance={isDevChallengeActive ? devCameraFollowDistance : null}
                onDevObjectPick={isDevChallengeActive ? handleDevObjectPick : undefined}
                onDevObjectTransform={isDevChallengeActive ? handleDevObjectTransform : undefined}
                onDevProceduralEdit={isDevChallengeActive ? handleDevProceduralEdit : undefined}
                onDevRoadEventAdjust={isDevChallengeActive ? handleDevRoadEventAdjust : undefined}
                onDevCameraInteract={isDevChallengeActive ? handleDevCameraInteract : undefined}
                onDevSelectedScreenPosition={isDevChallengeActive ? handleDevSelectedScreenPosition : undefined}
                devModelTool={isDevChallengeActive ? devModelTool : "move"}
                onSceneReady={handleRunnerSceneReady}
                onIntroComplete={handleRunnerIntroComplete}
              />
            </React.Suspense>
          </div>
          {screen === "challenge" ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
              <div className="w-full bg-[linear-gradient(180deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.9)_56%,rgba(2,6,23,0.45)_100%)] px-3 pb-3 pt-2 shadow-[0_16px_38px_rgba(2,6,23,0.28)]">
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-black/52 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/82">Partida</p>
                    <p className="mt-1 text-[1.4rem] font-black leading-none text-white">{displayedRunnerScore}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-100/80">dinheiro coletado</p>
                  </div>
                  <div className="h-11 w-px shrink-0 bg-white/10" />
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/82">Tempo</p>
                    <p className="mt-1 text-[1.4rem] font-black leading-none text-white">
                      {formatTime(Math.floor((runnerState.elapsedMs || 0) / 1000))}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">sobrevivencia</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {screen === "challenge" ? <RunnerStatusCompact runnerState={runnerState} /> : null}
          {screen === "challenge" && isDevMode && !devFloatingUiCollapsed ? (
            <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-md border border-cyan-500/55 bg-slate-950/85 px-3 py-1 text-[11px] text-cyan-100">
              <span className="uppercase">Ferramenta: {devModelTool}</span>
              {selectedObjectIsProcedural ? (
                <span className="ml-3 uppercase">
                  Tris: {selectedProceduralPolyCount}
                  {selectedProceduralPolyCount > 3000 ? " (Estourou)" : selectedProceduralPolyCount > 1500 ? " (Atencao)" : " (OK)"}
                </span>
              ) : null}
            </div>
          ) : null}
          {!isRunnerSceneReady ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/88">
              <div className="rounded-xl border border-cyan-300/30 bg-slate-900/80 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Preparando cenario</p>
                <p className="mt-1 text-sm font-semibold text-white">Carregando texturas e vegetação...</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {screen === "result" ? (
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <React.Suspense fallback={null}>
            <Runner3DScene
              key={`result-scene-${resultSceneMountKey}`}
              className="absolute inset-0"
              mode="result"
              isPaused={false}
              runnerState={resultRunnerSceneState}
              loadoutCharacterVariant={selectedCharacterRenderVariant}
              islandTheme={islandTheme}
              roadCurve={roadCurve}
              bossLane={0}
              bossDrift={0}
              bossBump={0}
              bossTilt={0}
              sandTextureUrl={resolvedSceneRoadTextureUrl || roadBaseColorImage}
              roadBaseNormalUrl={roadBaseNormalImage}
              roadBaseRoughnessUrl={roadBaseRoughnessImage}
              roadBaseAoUrl={roadBaseAoImage}
              treeTextureUrl={arvoreGameImage}
              vegetationTextureUrls={RUNNER_VEGETATION_TEXTURES}
              edgeVegetationTextureUrls={RUNNER_EDGE_VEGETATION_TEXTURES}
              disableAmbientVegetation={isBaseOnlyMap}
              obstacleTextureUrl={vegetacaoRochaImage}
              horizonTextureUrl={resolvedSceneHorizonTextureUrl || horizonteJogo3DImage}
              roadShoulderTextureUrl={roadShoulderBaseColorImage}
              roadShoulderNormalUrl={roadShoulderNormalImage}
              roadShoulderRoughnessUrl={roadShoulderRoughnessImage}
              roadShoulderAoUrl={roadShoulderAoImage}
              roadSlopeTextureUrl={sandTileImage}
              grassTopTextureUrl={gramaJogoCertoImage}
              shadowOverlayTextureUrl={sombraArvoreOkImage}
              sceneConfig={sceneConfig}
              loadoutWardrobe={activeGameLoadoutWardrobe}
              graphicsSettings={runnerGraphicsSettings}
              sceneRenderDraft={devSceneRenderDraft}
              onSceneReady={handleResultRunnerSceneReady}
            />
          </React.Suspense>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/4 via-slate-950/10 to-slate-950/32" />
          {!isResultSceneVisible ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/92">
              <div className="rounded-xl border border-amber-300/25 bg-slate-900/80 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Preparando final</p>
                <p className="mt-1 text-sm font-semibold text-white">Montando cena do bau...</p>
              </div>
            </div>
          ) : null}
          {isResultSceneVisible ? <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {!resultSummaryCollected ? (
              <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
                <motion.div
                  className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col items-center overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/38 px-5 py-5 text-center shadow-[0_20px_44px_rgba(2,6,23,0.16)] backdrop-blur-sm"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/4 via-transparent to-black/10" />
                  <div className="relative z-10">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/85">Resumo da partida</p>
                    <p className="mt-2 text-xl font-black text-white">
                      Ilha {NODES[selectedIslandId]?.day} • {NODES[selectedIslandId]?.name}
                    </p>
                  </div>
                  <div className="relative z-10 mt-8 w-full space-y-4">
                    <div
                      className={`rounded-[1.5rem] border px-5 py-4 transition-[opacity,border-color,background-color] duration-200 ${
                        resultSummaryPhase === "coins" ? "border-amber-300/55 bg-amber-400/12" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/85">Score da corrida</p>
                      <p className="mt-2 text-4xl font-black text-white">{resultAnimatedScore}</p>
                    </div>
                    <div
                      className={`rounded-[1.5rem] border px-5 py-4 transition-[opacity,border-color,background-color] duration-200 ${
                        resultSummaryPhase === "time" ? "border-cyan-300/55 bg-cyan-400/12" : "border-white/10 bg-white/5"
                      }`}
                      style={{ opacity: resultSummaryPhase === "coins" ? 0.72 : 1 }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/85">Tempo da partida</p>
                      <p className="mt-2 text-4xl font-black text-white">{formatTime(Math.floor(resultAnimatedElapsedMs / 1000))}</p>
                      <p className="mt-2 text-xs text-cyan-100/85">
                        Recorde: {formatTime(Math.floor((resultBestElapsedMs || 0) / 1000))}
                        {resultIsNewBest ? " • novo recorde" : ""}
                      </p>
                    </div>
                    <div
                      className={`rounded-[1.5rem] border px-5 py-4 transition-[opacity,border-color,background-color] duration-200 ${
                        resultSummaryPhase === "rewards" ? "border-amber-300/55 bg-amber-300/12" : "border-white/10 bg-white/5"
                      }`}
                      style={{ opacity: resultSummaryPhase === "coins" || resultSummaryPhase === "time" ? 0.72 : 1 }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-100/85">Recompensa da run</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-left">
                        <div className="rounded-2xl border border-white/10 bg-black/14 px-3 py-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-100/70">Moedas</p>
                          <p className="mt-2 text-2xl font-black text-white">{resultAnimatedCoins}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/14 px-3 py-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Diamantes</p>
                          <p className="mt-2 text-2xl font-black text-white">{resultAnimatedDiamonds}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/14 px-3 py-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-100/70">Chaves</p>
                          <p className="mt-2 text-2xl font-black text-white">{resultAnimatedKeys}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-cyan-300/18 bg-cyan-300/10 px-3 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/70">XP da run</p>
                            <p className="mt-2 text-2xl font-black text-white">+{runXpReward.totalXp}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Nivel atual</p>
                            <p className="mt-2 text-xl font-black text-white">{playerGameLevel}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-cyan-100/85">
                          {nextCharacterUnlock
                            ? `Proximo cacador: ${nextCharacterUnlock.name} no nivel ${nextCharacterUnlock.unlockLevel}.`
                            : "Todos os cacadores base ja foram liberados."}
                        </p>
                      </div>
                      <p className="mt-3 text-xs text-amber-100/85">
                        Bonus de perks e power-ups ja entram no score e afetam esse ganho.
                      </p>
                    </div>
                    <div
                      className={`rounded-[1.5rem] border px-5 py-4 transition-[opacity,border-color,background-color] duration-200 ${
                        resultSummaryPhase === "done" ? "border-cyan-300/45 bg-cyan-400/10" : "border-white/10 bg-white/5"
                      }`}
                      style={{ opacity: resultSummaryPhase === "coins" || resultSummaryPhase === "time" ? 0.72 : 1 }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/85">{resultRewards.chest.title}</p>
                      <p className="mt-2 text-sm text-slate-200">{resultRewards.chest.subtitle}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-100">
                          +{resultRewards.chest.coins} moedas
                        </span>
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                          +{resultRewards.chest.diamonds} diamantes
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-white/85">
                          +{resultRewards.chest.keys} chaves
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 mt-7">
                    <Button
                      className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                      disabled={resultSummaryPhase !== "done"}
                      onClick={handleConfirmResultSummary}
                    >
                      Coletar
                    </Button>
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="relative min-h-full pb-40 sm:pb-32">
                <div className="absolute inset-x-0 top-0 flex justify-center px-4 pt-4">
                  <motion.div
                    className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/34 px-5 py-4 text-center shadow-[0_20px_44px_rgba(2,6,23,0.14)] backdrop-blur-sm"
                    initial={false}
                    animate={{
                      y: resultChestPhase === "arrival" ? 22 : 0,
                      opacity: resultChestPhase === "arrival" ? 0.86 : 1,
                      scale: 1,
                    }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/85">Bau liberado</p>
                    <p className="mt-2 text-xl font-black text-white">
                      Ilha {NODES[selectedIslandId]?.day} • {NODES[selectedIslandId]?.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      Score: {runnerState.score} • Chance do bau: {Math.round(runnerState.chestChance)}% • Tempo:{" "}
                      {formatTime(Math.floor(runnerState.elapsedMs / 1000))}
                    </p>
                  </motion.div>
                </div>
                {resultChestPhase !== "opened" ? (
                  <motion.button
                    key={`${resultChestPulseToken}-${resultChestPhase}`}
                    type="button"
                    onClick={handleResultChestTap}
                    disabled={resultChestPhase !== "chest"}
                    className="absolute left-1/2 top-[46%] z-20 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0 outline-none"
                    animate={
                      resultChestPhase === "chest"
                        ? {
                            scale: [1, 1.03, 1],
                          }
                        : resultChestPhase === "burst"
                          ? {
                              scale: [1, 1.08, 0.96, 1.14],
                            }
                          : {}
                    }
                    transition={{
                      duration: resultChestPhase === "burst" ? 0.52 : 1.1,
                      repeat: resultChestPhase === "chest" ? Infinity : 0,
                    }}
                  >
                    <span className="sr-only">Abrir bau</span>
                  </motion.button>
                ) : null}
                <div className="absolute bottom-28 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 px-2 text-center sm:bottom-24">
                  {resultChestPhase === "arrival" ? (
                    <p className="text-sm font-semibold text-amber-100">Preparando o bau...</p>
                  ) : resultChestPhase === "chest" ? (
                    <>
                      <p className="text-sm font-semibold text-amber-100">Toque no bau ate ele estourar</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-200/80">
                        {resultChestTapCount}/{RESULT_CHEST_TAPS_TO_OPEN} toques
                      </p>
                    </>
                  ) : resultChestPhase === "burst" ? (
                    <p className="text-sm font-semibold text-amber-100">O bau esta abrindo...</p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">Premio revelado</p>
                      <p className="mt-2 text-[2rem] font-black uppercase leading-tight text-white">
                        {resultRewards.chest.title}
                      </p>
                      <p className="mt-2 text-xs text-cyan-200">{resultRewards.chest.subtitle}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                          +{resultRewards.chest.coins} moedas
                        </span>
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                          +{resultRewards.chest.diamonds} diamantes
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div> : null}
          {resultChestPhase === "opened" ? (
            <div className="absolute inset-x-0 bottom-6 z-40 flex flex-wrap items-center justify-center gap-2 px-4 sm:bottom-8">
              <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={handleCollectResultReward}>
                {resultRewardCollected ? "Ver premios" : "Coletar"}
              </Button>
              <Button variant="outline" className="border-slate-600 bg-slate-900 text-slate-100" onClick={startChallengeIntro}>Jogar de novo</Button>
              <Button variant="outline" className="border-slate-600 bg-slate-900 text-slate-100" onClick={returnToMap}>Voltar ao mapa</Button>
              <Button variant="outline" className="border-slate-600 bg-slate-900 text-slate-100" onClick={() => navigate(createPageUrl("Dashboard"))}>Sair</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {screen === "rewards" ? (
        <div className="absolute inset-0 overflow-y-auto bg-[linear-gradient(180deg,#06111f_0%,#0f172a_48%,#020617_100%)]">
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-8 pt-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={returnToMap}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white backdrop-blur-sm"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Galeria de premios
              </div>
              <div className="flex h-11 min-w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 text-sm font-bold text-amber-100">
                {rewardGallery.length}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_24px_90px_rgba(8,15,30,0.45)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Colecao do jogador</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Seus prêmios</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Cada baú coletado entra aqui. O visual segue clima de jogo mobile, com slots e destaque do drop mais recente.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-amber-200/20 bg-gradient-to-br from-amber-300/18 to-transparent p-3 text-amber-100">
                  <Gift className="h-6 w-6" />
                </div>
              </div>

              {latestCollectedReward ? (
                <div className={`mt-5 rounded-[1.7rem] border border-white/10 bg-gradient-to-br ${latestCollectedReward.accent} p-[1px]`}>
                  <div className="rounded-[1.6rem] bg-slate-950/86 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">Último coletado</p>
                        <h3 className="mt-2 text-lg font-black text-white">{latestCollectedReward.title}</h3>
                        <p className="mt-1 text-sm text-slate-300">{latestCollectedReward.subtitle}</p>
                      </div>
                      <div className="text-3xl leading-none">{latestCollectedReward.emoji}</div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${REWARD_RARITY_META[latestCollectedReward.rarity]?.chip || REWARD_RARITY_META.common.chip}`}>
                        {REWARD_RARITY_META[latestCollectedReward.rarity]?.label || "Comum"}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                        Ilha {latestCollectedReward.islandDay}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Score</p>
                        <p className="mt-1 text-sm font-black text-white">{latestCollectedReward.score}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Tempo</p>
                        <p className="mt-1 text-sm font-black text-white">{formatTime(Math.floor((latestCollectedReward.elapsedMs || 0) / 1000))}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Estrelas</p>
                        <p className="mt-1 flex items-center gap-1 text-amber-300">
                          {Array.from({ length: latestCollectedReward.stars || 1 }, (_, index) => (
                            <Star key={`${latestCollectedReward.id}-star-${index}`} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-8 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-cyan-200/70" />
                  <p className="mt-3 text-sm font-semibold text-white">Sua galeria ainda está vazia</p>
                  <p className="mt-1 text-xs text-slate-400">Abra um baú, colete a recompensa e os cards vão aparecer aqui.</p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Slots da coleção</p>
                <p className="text-xs text-slate-400">{rewardGallery.length} desbloqueados</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {rewardGallerySlots.map((item) => {
                  if (item.locked) {
                    return (
                      <div key={item.id} className="aspect-[0.82] rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-3">
                        <div className="flex h-full flex-col items-center justify-center rounded-[1.2rem] bg-slate-950/55 text-center">
                          <Crown className="h-5 w-5 text-slate-500" />
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bloqueado</p>
                        </div>
                      </div>
                    );
                  }

                  const rarityMeta = REWARD_RARITY_META[item.rarity] || REWARD_RARITY_META.common;
                  const isLatest = item.id === latestCollectedReward?.id;
                  return (
                    <div key={item.id} className={`aspect-[0.82] rounded-[1.5rem] bg-gradient-to-br ${item.accent} p-[1px] shadow-[0_18px_45px_rgba(2,6,23,0.28)]`}>
                      <div className="flex h-full flex-col rounded-[1.45rem] bg-slate-950/88 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-2xl leading-none">{item.emoji}</div>
                          {isLatest ? (
                            <div className="rounded-full border border-amber-200/30 bg-amber-300/12 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-100">
                              Novo
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3">
                          <p className="line-clamp-2 text-sm font-black leading-tight text-white">{item.title}</p>
                          <p className="mt-1 text-[11px] text-slate-400">Ilha {item.islandDay}</p>
                        </div>
                        <div className="mt-auto">
                          <div className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${rarityMeta.chip}`}>
                            {rarityMeta.label}
                          </div>
                          <p className="mt-2 text-[11px] text-slate-300">Score {item.score}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 pb-3">
              <Button className="h-12 rounded-2xl bg-cyan-400 text-base font-black text-slate-950 hover:bg-cyan-300" onClick={startChallengeIntro}>
                Jogar de novo
              </Button>
              <Button variant="outline" className="h-12 rounded-2xl border-slate-600 bg-slate-900/80 text-slate-100" onClick={returnToMap}>
                Voltar ao mapa
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoadoutTransitionActive ? (
        <div className="pointer-events-none absolute inset-0 z-[80] overflow-hidden bg-slate-950">
          <video
            ref={loadoutTransitionVideoRef}
            className="absolute inset-0 h-full w-full object-cover [filter:saturate(1.22)_contrast(1.08)_brightness(1.06)]"
            src={loadoutMenuAnimationVideo}
            preload="auto"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.02)_24%,rgba(2,6,23,0.18)_74%,rgba(2,6,23,0.46)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[32%] bg-gradient-to-t from-black/70 via-black/26 to-transparent" />

          <div className="absolute left-1/2 top-[12%] w-[88%] max-w-md -translate-x-1/2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Navegando para a ilha</p>
            <h2 className="mt-2 text-xl font-black text-white">
              Preparando selecao do personagem
            </h2>
            <p className="mt-2 text-sm text-slate-100/90">
              {isPendingLoadoutOpen ? "Abrindo o menu enquanto o cenario termina de montar." : "Carregando o cenario 3D antes de abrir o menu."}
            </p>
          </div>

          <div className="absolute bottom-8 left-1/2 w-[90%] max-w-lg -translate-x-1/2 rounded-[1.6rem] border border-white/12 bg-black/20 px-4 py-4 text-center">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-cyan-100">Montando o fundo da ilha</span>
              <span className="font-black text-cyan-300">{Math.round(loadoutTransitionProgress)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-300"
                animate={{ width: `${Math.round(loadoutTransitionProgress)}%` }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isIslandLoadoutLeavesActive ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[95] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={folhasTransicaoVideo}
            preload="auto"
            autoPlay
            muted
            playsInline
            onEnded={() => {
              setIsIslandLoadoutLeavesActive(false);
              islandLoadoutLeavesStartedRef.current = false;
            }}
          />
        </motion.div>
      ) : null}

      {screen === "map" ? (
        <div className="pointer-events-none absolute right-3 top-[8.15rem] z-[95] flex items-start">
          <button
            type="button"
            onClick={() => setIsDevMode((prev) => !prev)}
            className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform duration-150 ease-out backdrop-blur-sm active:scale-[0.96] ${
              isDevMode
                ? "border-emerald-400/80 bg-emerald-900/80 text-emerald-100"
                : "border-slate-600/80 bg-slate-900/80 text-slate-100"
            }`}
          >
            {isDevMode ? "Dev ON" : "Modo Dev"}
          </button>
        </div>
      ) : null}

      {mapDevStudioPortal}

      <Dialog open={isGraphicsSettingsOpen} onOpenChange={setIsGraphicsSettingsOpen}>
        <DialogContent
          className="z-[130] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden border border-slate-700 bg-slate-950/96 p-0 text-white shadow-[0_0_45px_rgba(15,23,42,0.55)]"
          overlayClassName="z-[129] bg-slate-950/70 backdrop-blur-sm"
        >
          <DialogHeader className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Settings className="h-4 w-4 text-cyan-300" />
              Configuracoes do jogo
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-3 sm:space-y-5 sm:px-5 sm:py-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Audio</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Musica do mapa</p>
                    <p className="mt-1 text-[11px] text-slate-400">Liga ou silencia a trilha do menu e da tela de ilhas.</p>
                  </div>
                  <Switch
                    checked={soundPrefs.gameMusicEnabled}
                    onCheckedChange={(checked) => {
                      setSoundPrefs((prev) => ({ ...(prev || {}), gameMusicEnabled: checked }));
                      setGameMusicEnabled(checked);
                    }}
                  />
                </div>

                <label className="block space-y-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">Volume da musica</span>
                    <span className="text-sm font-bold text-emerald-200">{Math.round((soundPrefs.gameMusicVolume || 0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round((soundPrefs.gameMusicVolume || 0) * 100)}
                    onChange={(event) => {
                      const nextVolume = Math.max(0, Math.min(1, Number(event.target.value) / 100));
                      setSoundPrefs((prev) => ({ ...(prev || {}), gameMusicVolume: nextVolume }));
                      setGameMusicVolume(nextVolume);
                    }}
                    className="w-full accent-emerald-400"
                  />
                </label>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Sons de menus</p>
                    <p className="mt-1 text-[11px] text-slate-400">Toques de navegação e mudança de aba.</p>
                  </div>
                  <Switch
                    checked={soundPrefs.menu}
                    onCheckedChange={(checked) => {
                      setSoundPrefs((prev) => ({ ...(prev || {}), menu: checked }));
                      setMenuSoundEnabled(checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Sons de interação</p>
                    <p className="mt-1 text-[11px] text-slate-400">Cliques, ações e pequenos efeitos dentro das telas.</p>
                  </div>
                  <Switch
                    checked={soundPrefs.interaction}
                    onCheckedChange={(checked) => {
                      setSoundPrefs((prev) => ({ ...(prev || {}), interaction: checked }));
                      setInteractionSoundEnabled(checked);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Preset atual</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">{runnerGraphicsSettings.label}</p>
                  <p className="mt-1 text-sm text-slate-300">{runnerGraphicsSettings.description}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                  {runnerGraphicsSettings.fpsCap} FPS
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Presets rápidos</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.values(GRAPHICS_PRESET_LIBRARY).map((preset) => {
                  const active = runnerGraphicsSettings.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRunnerGraphicsPreset(preset.id)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-cyan-300 bg-cyan-500/18 text-white"
                          : "border-slate-700 bg-slate-900/80 text-slate-100 hover:border-slate-500"
                      }`}
                    >
                      <p className="text-sm font-black">{preset.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-300">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FPS maximo</span>
                  <span className="text-sm font-bold text-white">{runnerGraphicsSettings.fpsCap}</span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={120}
                  step={1}
                  value={runnerGraphicsSettings.fpsCap}
                  onChange={(event) => handleRunnerGraphicsSettingChange("fpsCap", event.target.value)}
                  className="w-full accent-cyan-400"
                />
                <p className="text-[11px] text-slate-500">Reduza em celular fraco para esquentar menos e travar menos.</p>
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Qualidade da imagem</span>
                  <span className="text-sm font-bold text-white">{Math.round(runnerGraphicsSettings.imageQuality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={135}
                  step={1}
                  value={Math.round(runnerGraphicsSettings.imageQuality * 100)}
                  onChange={(event) => handleRunnerGraphicsSettingChange("imageQuality", Number(event.target.value) / 100)}
                  className="w-full accent-cyan-400"
                />
                <p className="text-[11px] text-slate-500">Controla a nitidez interna do render. Mais alto = mais bonito e mais pesado.</p>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Suavização de borda</span>
                <select
                  value={runnerGraphicsSettings.antiAlias}
                  onChange={(event) => handleRunnerGraphicsSettingChange("antiAlias", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="auto">Auto</option>
                  <option value="on">Ligado</option>
                  <option value="off">Desligado</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Detalhe do cenario</span>
                <select
                  value={runnerGraphicsSettings.detailLevel}
                  onChange={(event) => handleRunnerGraphicsSettingChange("detailLevel", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="low">Baixo</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                  <option value="maximum">Maximo</option>
                </select>
                <p className="text-[11px] text-slate-500">Afeta densidade visual e cortes de performance no runner.</p>
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
                onClick={() => applyRunnerGraphicsPreset(DEFAULT_GRAPHICS_SETTINGS.id)}
              >
                Restaurar padrao
              </Button>
              <Button
                type="button"
                className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 sm:w-auto"
                onClick={() => setIsGraphicsSettingsOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportedExportSaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeImportedExportSaveDialog(null);
        }}
      >
        <DialogContent
          className="z-[130] w-[calc(100vw-1.5rem)] max-w-lg border border-cyan-400/30 bg-slate-950/96 p-0 text-white shadow-[0_0_35px_rgba(34,211,238,0.18)]"
          overlayClassName="z-[129] bg-slate-950/70 backdrop-blur-sm"
        >
          <DialogHeader className="border-b border-slate-800 px-5 py-4">
            <DialogTitle className="text-base font-bold text-cyan-100">Salvar arquivo 3D final</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-slate-300">
              Escolha a pasta e o nome do `.glb`. Depois do save, ele tambem entra automaticamente na galeria.
            </p>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Pasta</span>
              <input
                type="text"
                value={importedExportSaveFolder}
                onChange={(event) => setImportedExportSaveFolder(event.target.value)}
                placeholder={`Ilha ${selectedIslandDay}`}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Nome do arquivo</span>
              <input
                type="text"
                value={importedExportSaveName}
                onChange={(event) => setImportedExportSaveName(event.target.value)}
                placeholder="personagem_final.glb"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                onClick={() => closeImportedExportSaveDialog(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                onClick={() =>
                  closeImportedExportSaveDialog({
                    folder: importedExportSaveFolder,
                    name: importedExportSaveName,
                  })
                }
              >
                Salvar e enviar para galeria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <KeyRankingOverlay
        open={isKeyRankingOpen}
        onClose={() => setIsKeyRankingOpen(false)}
        rankingSnapshot={keyRankingSnapshot}
      />
      </div>
    </div>
  );
}
