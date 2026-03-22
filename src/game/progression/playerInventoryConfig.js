import { PERK_DEFINITIONS } from "@/game/runner/core/RunnerEntityDefinitions";
import { RUNNER_PERK_LOADOUT_LIMIT } from "@/game/runner/core/RunnerConstants";

export const PLAYER_INVENTORY_STORAGE_PREFIX = "souza_runner_inventory_v1:";

export const PLAYER_CHARACTER_DEFINITIONS = {
  sam: {
    id: "sam",
    kind: "character",
    name: "Sam",
    description: "Caçador equilibrado para qualquer ilha.",
    shortDescription: "Comeca a temporada pronto para correr.",
    passiveBonus: "+8% moedas finais",
    passiveEffect: {
      rewardCoinMultiplier: 1.08,
    },
    unlockLevel: 1,
    unlockedByDefault: true,
    rarity: "Base",
    placeholder: false,
    accent: "from-cyan-300 via-sky-400 to-blue-500",
    chip: "Inicial",
    role: "Equilibrado",
    previewFilter: "none",
    skinIds: ["classic", "sunset"],
  },
  mila: {
    id: "mila",
    kind: "character",
    name: "Mila",
    description: "Especialista em coleta e constancia.",
    shortDescription: "Libera cedo para apoiar runs de economia.",
    passiveBonus: "+diamantes com thresholds mais faceis",
    passiveEffect: {
      rewardDiamondScoreBonus: 26,
      rewardDiamondChestChanceBonus: 10,
    },
    unlockLevel: 2,
    unlockedByDefault: false,
    rarity: "Rara",
    placeholder: false,
    accent: "from-amber-300 via-orange-400 to-rose-500",
    chip: "Nivel 2",
    role: "Economia",
    previewFilter: "sepia(0.08) saturate(1.08)",
    skinIds: ["classic", "sunset"],
  },
  gaby: {
    id: "gaby",
    kind: "character",
    name: "Gaby",
    description: "Exploradora de drops e linhas raras.",
    shortDescription: "Aumenta o foco em premios e diamantes.",
    passiveBonus: "+1 chave por run",
    passiveEffect: {
      rewardKeyFlatBonus: 1,
    },
    unlockLevel: 4,
    unlockedByDefault: false,
    rarity: "Rara",
    placeholder: false,
    accent: "from-fuchsia-300 via-pink-500 to-rose-500",
    chip: "Nivel 4",
    role: "Drops",
    previewFilter: "saturate(1.1)",
    skinIds: ["classic", "midnight"],
  },
  dan: {
    id: "dan",
    kind: "character",
    name: "Dan",
    description: "Corredor tecnico com foco em defesa.",
    shortDescription: "Pensado para runs mais longas e seguras.",
    passiveBonus: "+1 escudo inicial por run",
    passiveEffect: {
      startingShieldCharges: 1,
    },
    unlockLevel: 6,
    unlockedByDefault: false,
    rarity: "Epica",
    placeholder: false,
    accent: "from-emerald-300 via-teal-400 to-cyan-500",
    chip: "Nivel 6",
    role: "Defesa",
    previewFilter: "contrast(1.04)",
    skinIds: ["classic", "midnight"],
  },
  richard: {
    id: "richard",
    kind: "character",
    name: "Richard",
    description: "Caçador premium para runs de score alto.",
    shortDescription: "Ultimo desbloqueio da base local atual.",
    passiveBonus: "+10% score da run",
    passiveEffect: {
      scoreMultiplier: 1.1,
    },
    unlockLevel: 8,
    unlockedByDefault: false,
    rarity: "Lendario",
    placeholder: true,
    accent: "from-slate-500 via-violet-600 to-slate-950",
    chip: "Nivel 8",
    role: "Pontuacao",
    previewFilter: "grayscale(0.25) contrast(1.18)",
    skinIds: ["classic", "coral_wave"],
  },
};

export const PLAYER_SKIN_DEFINITIONS = {
  classic: {
    id: "classic",
    kind: "skin",
    name: "Classica",
    description: "Visual original do personagem.",
    rarity: "Base",
    placeholder: false,
  },
  sunset: {
    id: "sunset",
    kind: "skin",
    name: "Sunset Rider",
    description: "Paleta quente inspirada no fim de tarde das ilhas.",
    rarity: "Rara",
    placeholder: false,
  },
  midnight: {
    id: "midnight",
    kind: "skin",
    name: "Noite Neon",
    description: "Skin premium de tom noturno para futuras temporadas.",
    rarity: "Epica",
    placeholder: false,
  },
  coral_wave: {
    id: "coral_wave",
    kind: "skin",
    name: "Coral Wave",
    description: "Placeholder de skin sazonal ligada a recompensas futuras.",
    rarity: "Lendaria",
    placeholder: true,
  },
};

export const PLAYER_CONSUMABLE_DEFINITIONS = {
  money_multiplier_charge: {
    id: "money_multiplier_charge",
    kind: "consumable",
    name: "Carga x3",
    description: "Reserva local de power-up de moedas para uso futuro.",
    category: "power_up",
    badge: "Economia",
    linkedPowerUpId: "money_multiplier",
  },
  shield_charge: {
    id: "shield_charge",
    kind: "consumable",
    name: "Carga de escudo",
    description: "Consumivel de defesa preparado para runs futuras.",
    category: "power_up",
    badge: "Defesa",
    linkedPowerUpId: "shield",
  },
  slow_motion_charge: {
    id: "slow_motion_charge",
    kind: "consumable",
    name: "Carga slow motion",
    description: "Consumivel tatico para reduzir o ritmo de uma run futura.",
    category: "power_up",
    badge: "Controle",
    linkedPowerUpId: "slow_motion",
  },
};

export const PLAYER_INVENTORY_DEFAULTS = Object.freeze({
  wallet: { coins: 1200, diamonds: 12, keys: 0 },
  xpTotal: 0,
  ownedPerkIds: ["coins_plus_10"],
  equippedPerkIds: ["coins_plus_10"],
  selectedCharacterId: "sam",
  selectedConsumableId: "",
  ownedWardrobeItemIds: ["classic"],
  equippedWardrobeByCharacterId: {
    sam: { presetItemId: "classic", slots: {} },
    mila: { presetItemId: "classic", slots: {} },
    gaby: { presetItemId: "classic", slots: {} },
    dan: { presetItemId: "classic", slots: {} },
    richard: { presetItemId: "classic", slots: {} },
  },
  consumables: {
    money_multiplier_charge: 0,
    shield_charge: 0,
    slow_motion_charge: 0,
  },
  ownedSkinIds: ["classic"],
  unlockedCharacterIds: ["sam"],
});

export const PLAYER_COLLECTION_CATEGORIES = Object.freeze([
  { id: "perks", label: "Perks" },
  { id: "consumables", label: "Consumiveis" },
  { id: "skins", label: "Skins" },
  { id: "characters", label: "Personagens" },
  { id: "rewards", label: "Baus" },
]);

export function getPlayerInventoryStorageKey(userId) {
  return `${PLAYER_INVENTORY_STORAGE_PREFIX}${userId || "guest"}`;
}

export function getAllPerkDefinitions() {
  return Object.values(PERK_DEFINITIONS);
}

export function getAllSkinDefinitions() {
  return Object.values(PLAYER_SKIN_DEFINITIONS);
}

export function getAllCharacterDefinitions() {
  return Object.values(PLAYER_CHARACTER_DEFINITIONS);
}

export function getAllConsumableDefinitions() {
  return Object.values(PLAYER_CONSUMABLE_DEFINITIONS);
}

export function getDefaultOwnedPerkIds() {
  return [...PLAYER_INVENTORY_DEFAULTS.ownedPerkIds];
}

export function getDefaultEquippedInventoryPerkIds() {
  return [...PLAYER_INVENTORY_DEFAULTS.equippedPerkIds].slice(0, RUNNER_PERK_LOADOUT_LIMIT);
}

export function getDefaultSelectedCharacterId() {
  return PLAYER_INVENTORY_DEFAULTS.selectedCharacterId;
}

export function getCharacterUnlockLevel(characterId) {
  return Math.max(1, Number(PLAYER_CHARACTER_DEFINITIONS?.[characterId]?.unlockLevel) || 1);
}

export function resolveUnlockedCharacterIdsByLevel(playerLevel = 1) {
  const level = Math.max(1, Number(playerLevel) || 1);
  return Object.values(PLAYER_CHARACTER_DEFINITIONS)
    .filter((character) => character.unlockedByDefault || level >= Math.max(1, Number(character.unlockLevel) || 1))
    .map((character) => character.id);
}
