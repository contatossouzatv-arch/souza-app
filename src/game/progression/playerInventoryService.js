import { RUNNER_PERK_LOADOUT_LIMIT } from "@/game/runner/core/RunnerConstants";
import { PERK_DEFINITIONS } from "@/game/runner/core/RunnerEntityDefinitions";
import {
  PLAYER_CHARACTER_DEFINITIONS,
  PLAYER_COLLECTION_CATEGORIES,
  PLAYER_CONSUMABLE_DEFINITIONS,
  PLAYER_INVENTORY_DEFAULTS,
  PLAYER_SKIN_DEFINITIONS,
  getCharacterUnlockLevel,
  getAllCharacterDefinitions,
  getAllConsumableDefinitions,
  getAllPerkDefinitions,
  getAllSkinDefinitions,
  getDefaultEquippedInventoryPerkIds,
  getDefaultOwnedPerkIds,
  getDefaultSelectedCharacterId,
  getPlayerInventoryStorageKey,
  resolveUnlockedCharacterIdsByLevel,
} from "@/game/progression/playerInventoryConfig";
import { STORE_CATALOG_SECTIONS } from "@/game/progression/storeCatalog";
import { resolveLevelProgressSnapshot, resolveNextCharacterUnlock } from "@/game/progression/levelProgressionService";

function uniqueIds(values, validIds) {
  const next = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const id = String(value || "").trim();
    if (!id || !validIds.has(id) || next.includes(id)) return;
    next.push(id);
  });
  return next;
}

function normalizeWallet(wallet, fallback = PLAYER_INVENTORY_DEFAULTS.wallet) {
  return {
    coins: Math.max(0, Number(wallet?.coins) || Number(fallback?.coins) || 0),
    diamonds: Math.max(0, Number(wallet?.diamonds) || Number(fallback?.diamonds) || 0),
    keys: Math.max(0, Number(wallet?.keys) || Number(fallback?.keys) || 0),
  };
}

function normalizeConsumables(consumables) {
  const next = {};
  Object.keys(PLAYER_CONSUMABLE_DEFINITIONS).forEach((id) => {
    next[id] = Math.max(0, Number(consumables?.[id]) || 0);
  });
  return next;
}

function normalizeWardrobeOwnership(ownedWardrobeItemIds, ownedSkinIds = []) {
  const next = [];
  [...PLAYER_INVENTORY_DEFAULTS.ownedWardrobeItemIds, ...(Array.isArray(ownedSkinIds) ? ownedSkinIds : []), ...(Array.isArray(ownedWardrobeItemIds) ? ownedWardrobeItemIds : [])].forEach((value) => {
    const id = String(value || "").trim();
    if (!id || next.includes(id)) return;
    next.push(id);
  });
  return next;
}

function normalizeWardrobeCharacterLoadout(rawValue, ownedWardrobeItemIds, fallbackPresetItemId = "classic") {
  const owned = new Set(Array.isArray(ownedWardrobeItemIds) ? ownedWardrobeItemIds : []);
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const legacyPreset = typeof rawValue === "string" ? String(rawValue || "").trim() : "";
  const presetCandidate = String(source.presetItemId || legacyPreset || "").trim();
  const slotSource = source.slots && typeof source.slots === "object" ? source.slots : {};
  const slots = Object.entries(slotSource).reduce((acc, [slotKey, itemId]) => {
    const safeSlot = String(slotKey || "").trim();
    const safeItemId = String(itemId || "").trim();
    if (!safeSlot) return acc;
    if (!safeItemId || !owned.has(safeItemId)) return acc;
    acc[safeSlot] = safeItemId;
    return acc;
  }, {});
  return {
    presetItemId: owned.has(presetCandidate) ? presetCandidate : fallbackPresetItemId,
    slots,
  };
}

function normalizeEquippedWardrobeByCharacterId(equippedWardrobeByCharacterId, unlockedCharacterIds, ownedWardrobeItemIds) {
  const safeUnlockedIds = Array.isArray(unlockedCharacterIds) ? unlockedCharacterIds : [];
  return Object.keys(PLAYER_CHARACTER_DEFINITIONS).reduce((acc, characterId) => {
    if (!safeUnlockedIds.includes(characterId) && !PLAYER_CHARACTER_DEFINITIONS?.[characterId]?.unlockedByDefault) {
      acc[characterId] = normalizeWardrobeCharacterLoadout(
        PLAYER_INVENTORY_DEFAULTS.equippedWardrobeByCharacterId?.[characterId],
        ownedWardrobeItemIds,
        "classic"
      );
      return acc;
    }
    acc[characterId] = normalizeWardrobeCharacterLoadout(
      equippedWardrobeByCharacterId?.[characterId],
      ownedWardrobeItemIds,
      PLAYER_INVENTORY_DEFAULTS.equippedWardrobeByCharacterId?.[characterId]?.presetItemId || "classic"
    );
    return acc;
  }, {});
}

export function normalizePlayerInventory(rawInventory, options = {}) {
  const inventory = rawInventory && typeof rawInventory === "object" ? rawInventory : {};
  const walletFallback = options.walletFallback || PLAYER_INVENTORY_DEFAULTS.wallet;
  const xpTotal = Math.max(0, Number(inventory.xpTotal) || Number(options.xpTotalFallback) || Number(PLAYER_INVENTORY_DEFAULTS.xpTotal) || 0);
  const progressionSnapshot = resolveLevelProgressSnapshot(xpTotal);
  const perkValidIds = new Set(Object.keys(PERK_DEFINITIONS));
  const skinValidIds = new Set(Object.keys(PLAYER_SKIN_DEFINITIONS));
  const characterValidIds = new Set(Object.keys(PLAYER_CHARACTER_DEFINITIONS));

  const migratedOwnedPerks = uniqueIds(options.equippedPerkFallback, perkValidIds);
  const ownedPerkIds = uniqueIds(
    [...getDefaultOwnedPerkIds(), ...migratedOwnedPerks, ...(Array.isArray(inventory.ownedPerkIds) ? inventory.ownedPerkIds : [])],
    perkValidIds
  );

  const equippedPerkIdsSource = uniqueIds(
    inventory.equippedPerkIds,
    new Set(ownedPerkIds)
  ).slice(0, RUNNER_PERK_LOADOUT_LIMIT);
  const equippedPerkIds = equippedPerkIdsSource.length
    ? equippedPerkIdsSource
    : uniqueIds(
        [...(inventory.equippedPerkIds || []), ...options.equippedPerkFallback, ...getDefaultEquippedInventoryPerkIds()],
        new Set(ownedPerkIds)
      ).slice(0, RUNNER_PERK_LOADOUT_LIMIT);

  const ownedSkinIds = uniqueIds(
    [
      ...PLAYER_INVENTORY_DEFAULTS.ownedSkinIds,
      options.selectedSkinFallback,
      ...(Array.isArray(inventory.ownedSkinIds) ? inventory.ownedSkinIds : []),
    ],
    skinValidIds
  );
  const unlockedCharacterIds = uniqueIds(
    [
      ...PLAYER_INVENTORY_DEFAULTS.unlockedCharacterIds,
      ...resolveUnlockedCharacterIdsByLevel(Math.max(progressionSnapshot.currentLevel, Number(options.playerLevel) || 1)),
      options.selectedCharacterFallback,
      ...(Array.isArray(inventory.unlockedCharacterIds) ? inventory.unlockedCharacterIds : []),
    ],
    characterValidIds
  );
  const selectedCharacterId = unlockedCharacterIds.includes(String(inventory.selectedCharacterId || "").trim())
    ? String(inventory.selectedCharacterId || "").trim()
    : unlockedCharacterIds.includes(String(options.selectedCharacterFallback || "").trim())
      ? String(options.selectedCharacterFallback || "").trim()
      : unlockedCharacterIds[0] || getDefaultSelectedCharacterId();
  const normalizedConsumables = normalizeConsumables(inventory.consumables);
  const ownedWardrobeItemIds = normalizeWardrobeOwnership(inventory.ownedWardrobeItemIds, inventory.ownedSkinIds);
  const equippedWardrobeByCharacterId = normalizeEquippedWardrobeByCharacterId(
    inventory.equippedWardrobeByCharacterId,
    unlockedCharacterIds,
    ownedWardrobeItemIds
  );
  const selectedConsumableId = Object.prototype.hasOwnProperty.call(
    PLAYER_CONSUMABLE_DEFINITIONS,
    String(inventory.selectedConsumableId || "").trim()
  ) &&
    Math.max(0, Number(normalizedConsumables[String(inventory.selectedConsumableId || "").trim()]) || 0) > 0
      ? String(inventory.selectedConsumableId || "").trim()
      : "";

  return {
    wallet: normalizeWallet(inventory.wallet, walletFallback),
    xpTotal,
    ownedPerkIds: ownedPerkIds.length ? ownedPerkIds : getDefaultOwnedPerkIds(),
    equippedPerkIds: equippedPerkIds.length ? equippedPerkIds : getDefaultEquippedInventoryPerkIds(),
    selectedCharacterId,
    selectedConsumableId,
    ownedWardrobeItemIds,
    equippedWardrobeByCharacterId,
    consumables: normalizedConsumables,
    ownedSkinIds: ownedSkinIds.length ? ownedSkinIds : [...PLAYER_INVENTORY_DEFAULTS.ownedSkinIds],
    unlockedCharacterIds: unlockedCharacterIds.length ? unlockedCharacterIds : [...PLAYER_INVENTORY_DEFAULTS.unlockedCharacterIds],
  };
}

export function loadPlayerInventory(userId, options = {}) {
  if (typeof window === "undefined") {
    return normalizePlayerInventory({}, options);
  }
  try {
    const raw = window.localStorage.getItem(getPlayerInventoryStorageKey(userId));
    if (!raw) return normalizePlayerInventory({}, options);
    return normalizePlayerInventory(JSON.parse(raw), options);
  } catch {
    return normalizePlayerInventory({}, options);
  }
}

export function savePlayerInventory(userId, inventory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getPlayerInventoryStorageKey(userId), JSON.stringify(normalizePlayerInventory(inventory)));
  } catch {
    // Ignore storage quota errors in local preview mode.
  }
}

export function applyInventoryWalletDelta(inventory, delta = {}) {
  const normalized = normalizePlayerInventory(inventory);
  const wallet = normalized.wallet;
  return {
    ...normalized,
    wallet: {
      coins: Math.max(0, Number(wallet.coins || 0) + Math.max(0, Number(delta.coins) || 0)),
      diamonds: Math.max(0, Number(wallet.diamonds || 0) + Math.max(0, Number(delta.diamonds) || 0)),
      keys: Math.max(0, Number(wallet.keys || 0) + Math.max(0, Number(delta.keys) || 0)),
    },
  };
}

export function applyInventoryXpGain(inventory, xpGain = 0) {
  const normalized = normalizePlayerInventory(inventory);
  return {
    ...normalized,
    xpTotal: Math.max(0, Number(normalized.xpTotal || 0) + Math.max(0, Number(xpGain) || 0)),
  };
}

export function syncInventoryEquippedPerks(inventory, equippedPerkIds) {
  const normalized = normalizePlayerInventory(inventory);
  const ownedPerks = new Set(normalized.ownedPerkIds);
  const nextEquipped = uniqueIds(equippedPerkIds, ownedPerks).slice(0, RUNNER_PERK_LOADOUT_LIMIT);
  const fallback = normalized.equippedPerkIds.filter((id) => ownedPerks.has(id)).slice(0, RUNNER_PERK_LOADOUT_LIMIT);
  const resolved = nextEquipped.length ? nextEquipped : fallback;
  if (JSON.stringify(resolved) === JSON.stringify(normalized.equippedPerkIds)) return normalized;
  return {
    ...normalized,
    equippedPerkIds: resolved,
  };
}

export function syncInventorySelectedCharacter(inventory, selectedCharacterId, options = {}) {
  const normalized = normalizePlayerInventory(inventory, options);
  const nextId = String(selectedCharacterId || "").trim();
  if (!nextId || !normalized.unlockedCharacterIds.includes(nextId)) return normalized;
  if (normalized.selectedCharacterId === nextId) return normalized;
  return {
    ...normalized,
    selectedCharacterId: nextId,
  };
}

export function syncInventorySelectedConsumable(inventory, selectedConsumableId) {
  const normalized = normalizePlayerInventory(inventory);
  const nextId = String(selectedConsumableId || "").trim();
  if (!nextId) {
    if (!normalized.selectedConsumableId) return normalized;
    return {
      ...normalized,
      selectedConsumableId: "",
    };
  }
  if (!Object.prototype.hasOwnProperty.call(PLAYER_CONSUMABLE_DEFINITIONS, nextId)) return normalized;
  if (Math.max(0, Number(normalized.consumables?.[nextId]) || 0) <= 0) return normalized;
  if (normalized.selectedConsumableId === nextId) return normalized;
  return {
    ...normalized,
    selectedConsumableId: nextId,
  };
}

export function syncInventoryEquippedWardrobeItem(inventory, characterId, wardrobeItemId, slot = "preset") {
  const normalized = normalizePlayerInventory(inventory);
  const safeCharacterId = String(characterId || "").trim();
  const safeWardrobeItemId = String(wardrobeItemId || "").trim();
  const safeSlot = String(slot || "preset").trim().toLowerCase() || "preset";
  if (!safeCharacterId || !Object.prototype.hasOwnProperty.call(PLAYER_CHARACTER_DEFINITIONS, safeCharacterId)) return normalized;
  const currentLoadout = normalized.equippedWardrobeByCharacterId?.[safeCharacterId] || { presetItemId: "classic", slots: {} };
  if (safeSlot === "preset") {
    if (!safeWardrobeItemId || !normalized.ownedWardrobeItemIds.includes(safeWardrobeItemId)) return normalized;
    if (currentLoadout?.presetItemId === safeWardrobeItemId) return normalized;
    return normalizePlayerInventory({
      ...normalized,
      equippedWardrobeByCharacterId: {
        ...normalized.equippedWardrobeByCharacterId,
        [safeCharacterId]: {
          ...currentLoadout,
          presetItemId: safeWardrobeItemId,
        },
      },
    });
  }
  if (!safeWardrobeItemId) {
    if (!currentLoadout?.slots?.[safeSlot]) return normalized;
    const nextSlots = { ...(currentLoadout.slots || {}) };
    delete nextSlots[safeSlot];
    return normalizePlayerInventory({
      ...normalized,
      equippedWardrobeByCharacterId: {
        ...normalized.equippedWardrobeByCharacterId,
        [safeCharacterId]: {
          ...currentLoadout,
          slots: nextSlots,
        },
      },
    });
  }
  if (!normalized.ownedWardrobeItemIds.includes(safeWardrobeItemId)) return normalized;
  if (currentLoadout?.slots?.[safeSlot] === safeWardrobeItemId) return normalized;
  return normalizePlayerInventory({
    ...normalized,
    equippedWardrobeByCharacterId: {
      ...normalized.equippedWardrobeByCharacterId,
      [safeCharacterId]: {
        ...currentLoadout,
        slots: {
          ...(currentLoadout.slots || {}),
          [safeSlot]: safeWardrobeItemId,
        },
      },
    },
  });
}

export function consumeInventorySelectedConsumable(inventory, selectedConsumableId) {
  const normalized = normalizePlayerInventory(inventory);
  const nextId = String(selectedConsumableId || normalized.selectedConsumableId || "").trim();
  if (!nextId || !Object.prototype.hasOwnProperty.call(PLAYER_CONSUMABLE_DEFINITIONS, nextId)) {
    return { inventory: normalized, consumed: false, consumableId: "" };
  }
  const currentStock = Math.max(0, Number(normalized.consumables?.[nextId]) || 0);
  if (currentStock <= 0) {
    return {
      inventory: normalized.selectedConsumableId ? { ...normalized, selectedConsumableId: "" } : normalized,
      consumed: false,
      consumableId: nextId,
    };
  }
  const nextInventory = normalizePlayerInventory({
    ...normalized,
    selectedConsumableId: "",
    consumables: {
      ...normalized.consumables,
      [nextId]: currentStock - 1,
    },
  });
  return {
    inventory: nextInventory,
    consumed: true,
    consumableId: nextId,
  };
}

function inventoryOwnsRef(inventory, entry) {
  const normalized = normalizePlayerInventory(inventory);
  if (entry.itemType === "perk_unlock") return normalized.ownedPerkIds.includes(entry.itemRefId);
  if (entry.itemType === "skin_unlock") return normalized.ownedSkinIds.includes(entry.itemRefId);
  if (entry.itemType === "wardrobe_item_unlock") return normalized.ownedWardrobeItemIds.includes(entry.itemRefId);
  if (entry.itemType === "character_unlock") return normalized.unlockedCharacterIds.includes(entry.itemRefId);
  return false;
}

function getResolvedStoreSections(extraSections = []) {
  return [
    ...STORE_CATALOG_SECTIONS,
    ...(Array.isArray(extraSections) ? extraSections.filter((section) => section && typeof section === "object") : []),
  ];
}

export function purchaseStoreItem({ inventory, itemId, extraSections = [] }) {
  const normalized = normalizePlayerInventory(inventory);
  const catalogItem = getResolvedStoreSections(extraSections).flatMap((section) => section.items || []).find((item) => item.id === itemId);
  if (!catalogItem) {
    return { ok: false, error: "not_found", message: "Item nao encontrado." };
  }
  if (catalogItem.available === false) {
    return { ok: false, error: "unavailable", message: "Oferta ainda nao esta ativa." };
  }
  if (inventoryOwnsRef(normalized, catalogItem)) {
    return { ok: false, error: "owned", message: "Item ja desbloqueado." };
  }

  const currency = String(catalogItem.price?.currency || "coins").trim();
  const amount = Math.max(0, Number(catalogItem.price?.amount) || 0);
  const currentBalance = Math.max(0, Number(normalized.wallet?.[currency]) || 0);
  if (currentBalance < amount) {
    return { ok: false, error: "insufficient_funds", message: "Saldo insuficiente." };
  }

  const next = {
    ...normalized,
    wallet: {
      ...normalized.wallet,
      [currency]: currentBalance - amount,
    },
  };

  if (catalogItem.itemType === "perk_unlock") {
    next.ownedPerkIds = uniqueIds([...next.ownedPerkIds, catalogItem.itemRefId], new Set(Object.keys(PERK_DEFINITIONS)));
  } else if (catalogItem.itemType === "skin_unlock") {
    next.ownedSkinIds = uniqueIds([...next.ownedSkinIds, catalogItem.itemRefId], new Set(Object.keys(PLAYER_SKIN_DEFINITIONS)));
    next.ownedWardrobeItemIds = normalizeWardrobeOwnership([...normalized.ownedWardrobeItemIds, catalogItem.itemRefId], next.ownedSkinIds);
  } else if (catalogItem.itemType === "wardrobe_item_unlock") {
    next.ownedWardrobeItemIds = normalizeWardrobeOwnership([...normalized.ownedWardrobeItemIds, catalogItem.itemRefId], next.ownedSkinIds);
  } else if (catalogItem.itemType === "character_unlock") {
    next.unlockedCharacterIds = uniqueIds(
      [...next.unlockedCharacterIds, catalogItem.itemRefId],
      new Set(Object.keys(PLAYER_CHARACTER_DEFINITIONS))
    );
  } else if (catalogItem.itemType === "consumable") {
    next.consumables = {
      ...next.consumables,
      [catalogItem.itemRefId]: Math.max(0, Number(next.consumables?.[catalogItem.itemRefId]) || 0) + 1,
    };
  }

  return {
    ok: true,
    inventory: normalizePlayerInventory(next),
    item: catalogItem,
    message: `${catalogItem.title} adicionado ao inventario.`,
  };
}

export function buildStoreCatalogSnapshot({ inventory, extraSections = [] } = {}) {
  const normalized = normalizePlayerInventory(inventory);
  const sections = getResolvedStoreSections(extraSections);
  return {
    wallet: normalized.wallet,
    sections: sections.map((section) => ({
      ...section,
      items: (Array.isArray(section.items) ? section.items : []).map((item) => {
        const currency = String(item.price?.currency || "coins").trim();
        const amount = Math.max(0, Number(item.price?.amount) || 0);
        const currentBalance = Math.max(0, Number(normalized.wallet?.[currency]) || 0);
        const owned = inventoryOwnsRef(normalized, item);
        const stock = item.itemType === "consumable" ? Math.max(0, Number(normalized.consumables?.[item.itemRefId]) || 0) : 0;
        return {
          ...item,
          owned,
          stock,
          affordable: currentBalance >= amount,
        };
      }),
    })),
  };
}

export function buildCollectionSnapshot({ inventory, rewardGallery = [], equippedPerkIds = [], wardrobeItems = [] } = {}) {
  const normalized = syncInventoryEquippedPerks(inventory, equippedPerkIds);
  const progressionSnapshot = resolveLevelProgressSnapshot(normalized.xpTotal);
  const perkOwned = new Set(normalized.ownedPerkIds);
  const equipped = new Set(normalized.equippedPerkIds);
  const skinOwned = new Set(normalized.ownedSkinIds);
  const characterOwned = new Set(normalized.unlockedCharacterIds);

  const equippedWardrobeByCharacterId = normalized.equippedWardrobeByCharacterId && typeof normalized.equippedWardrobeByCharacterId === "object"
    ? normalized.equippedWardrobeByCharacterId
    : {};

  return {
    wallet: normalized.wallet,
    progression: progressionSnapshot,
    rewardGalleryCount: Array.isArray(rewardGallery) ? rewardGallery.length : 0,
    categories: PLAYER_COLLECTION_CATEGORIES,
    perks: getAllPerkDefinitions().map((perk) => ({
      ...perk,
      owned: perkOwned.has(perk.id),
      equipped: equipped.has(perk.id),
    })),
    consumables: getAllConsumableDefinitions().map((item) => ({
      ...item,
      amount: Math.max(0, Number(normalized.consumables?.[item.id]) || 0),
      selected: normalized.selectedConsumableId === item.id,
    })),
    skins: (Array.isArray(wardrobeItems) && wardrobeItems.length ? wardrobeItems : getAllSkinDefinitions()).map((item) => ({
      ...item,
      name: item.name || item.label,
      owned: item.owned ?? skinOwned.has(item.id),
      equippedBy: Object.entries(equippedWardrobeByCharacterId).reduce((acc, [characterId, loadout]) => {
        const presetItemId = String(loadout?.presetItemId || "").trim();
        const slotMatch = Object.entries(loadout?.slots || {}).find(([, equippedItemId]) => String(equippedItemId || "").trim() === String(item.id));
        if (presetItemId === String(item.id) || slotMatch) {
          acc.push({
            characterId,
            slot: slotMatch?.[0] || "preset",
          });
        }
        return acc;
      }, []),
    })),
    characters: getAllCharacterDefinitions().map((item) => ({
      ...item,
      owned: characterOwned.has(item.id),
      selected: normalized.selectedCharacterId === item.id,
      unlockLevel: getCharacterUnlockLevel(item.id),
    })),
  };
}

export function buildProgressionSnapshot({ inventory } = {}) {
  const normalized = normalizePlayerInventory(inventory);
  const progression = resolveLevelProgressSnapshot(normalized.xpTotal);
  const nextCharacterUnlock = resolveNextCharacterUnlock(progression.currentLevel);
  return {
    xpTotal: normalized.xpTotal,
    progression,
    nextCharacterUnlock,
  };
}
