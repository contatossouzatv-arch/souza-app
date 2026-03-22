import { DEFAULT_WARDROBE_ITEMS } from "@/game/progression/wardrobeCatalogConfig";

function normalizeString(value, fallback = "") {
  const next = String(value || "").trim();
  return next || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeWardrobeCollection(rawWardrobe) {
  const source = rawWardrobe && typeof rawWardrobe === "object" ? rawWardrobe : {};
  return {
    library: Array.isArray(source.library) ? source.library.filter((item) => item && typeof item === "object") : [],
    equipped: source.equipped && typeof source.equipped === "object" ? { ...source.equipped } : {},
    presets: Array.isArray(source.presets) ? source.presets.filter((item) => item && typeof item === "object") : [],
  };
}

export function normalizeWardrobeCatalogEntries(rawEntries, options = {}) {
  const { loadoutWardrobe } = options;
  const sourceWardrobe = normalizeWardrobeCollection(loadoutWardrobe);
  const validAssetIds = new Set(sourceWardrobe.library.map((item) => normalizeString(item?.id)));
  const validPresetIds = new Set(sourceWardrobe.presets.map((item) => normalizeString(item?.id)));
  const next = [];

  (Array.isArray(rawEntries) ? rawEntries : []).forEach((entry, index) => {
    const id = normalizeString(entry?.id, `wardrobe_item_${index}`);
    if (!id || next.some((item) => item.id === id)) return;
    const slot = normalizeString(entry?.slot, "preset").toLowerCase();
    const assetRef = normalizeString(entry?.assetRef);
    const presetRef = normalizeString(entry?.presetRef);
    if (assetRef && !validAssetIds.has(assetRef)) return;
    if (presetRef && !validPresetIds.has(presetRef)) return;
    next.push({
      id,
      label: normalizeString(entry?.label, "Wardrobe item"),
      description: normalizeString(entry?.description, "Item publicado do Wardrobe Studio."),
      characterId: normalizeString(entry?.characterId, "all"),
      slot,
      rarity: normalizeString(entry?.rarity, "Wardrobe"),
      assetRef,
      presetRef,
      ownedByDefault: !!entry?.ownedByDefault,
      priceCoins: Math.max(0, Math.round(normalizeNumber(entry?.priceCoins, 0))),
      priceDiamonds: Math.max(0, Math.round(normalizeNumber(entry?.priceDiamonds, 0))),
      unlockLevel: Math.max(1, Math.round(normalizeNumber(entry?.unlockLevel, 1))),
      source: normalizeString(entry?.source, "dev_wardrobe"),
      accent: normalizeString(entry?.accent, "from-slate-500 via-slate-600 to-slate-800"),
    });
  });

  return next;
}

export function buildWardrobeCatalogSnapshot({ loadoutWardrobe, catalogEntries, selectedCharacterId, ownedWardrobeItemIds, playerLevel }) {
  const published = normalizeWardrobeCatalogEntries(catalogEntries, { loadoutWardrobe });
  const ownedIds = new Set(Array.isArray(ownedWardrobeItemIds) ? ownedWardrobeItemIds.map((item) => String(item || "").trim()) : []);
  const safeCharacterId = normalizeString(selectedCharacterId, "sam");
  const safePlayerLevel = Math.max(1, Math.round(normalizeNumber(playerLevel, 1)));
  const items = [...DEFAULT_WARDROBE_ITEMS, ...published].map((item) => {
    const compatible =
      item.characterId === "all" ||
      item.characterId === safeCharacterId;
    const unlockedByLevel = safePlayerLevel >= Math.max(1, Number(item.unlockLevel || 1));
    const owned = item.ownedByDefault || ownedIds.has(item.id);
    return {
      ...item,
      compatible,
      unlockedByLevel,
      owned,
      locked: !owned,
    };
  });

  return {
    items,
    compatibleItems: items.filter((item) => item.compatible),
    publishedItems: published,
  };
}

function resolveWardrobePrice(item) {
  const priceCoins = Math.max(0, Number(item?.priceCoins) || 0);
  const priceDiamonds = Math.max(0, Number(item?.priceDiamonds) || 0);
  if (priceDiamonds > 0) return { currency: "diamonds", amount: priceDiamonds };
  if (priceCoins > 0) return { currency: "coins", amount: priceCoins };

  const rarity = String(item?.rarity || "").trim().toLowerCase();
  if (rarity === "lendaria") return { currency: "diamonds", amount: 18 };
  if (rarity === "epica") return { currency: "diamonds", amount: 12 };
  if (rarity === "rara") return { currency: "coins", amount: 1280 };
  return { currency: "coins", amount: 760 };
}

export function buildWardrobeStoreSection({ wardrobeItems = [], playerLevel = 1 } = {}) {
  const safePlayerLevel = Math.max(1, Number(playerLevel) || 1);
  const publishedItems = (Array.isArray(wardrobeItems) ? wardrobeItems : []).filter((item) => item && item.source === "dev_wardrobe");
  if (!publishedItems.length) return null;

  return {
    id: "wardrobe_published",
    title: "Wardrobe publicado",
    description: "Pecas e presets liberados do Wardrobe Studio para virar item real do jogo.",
    items: publishedItems.map((item) => ({
      id: `published_${item.id}`,
      itemType: "wardrobe_item_unlock",
      itemRefId: item.id,
      title: item.label,
      description: item.description,
      price: resolveWardrobePrice(item),
      available: safePlayerLevel >= Math.max(1, Number(item.unlockLevel || 1)),
      rarity: item.rarity,
      slot: item.slot,
      characterId: item.characterId,
      unlockLevel: Math.max(1, Number(item.unlockLevel || 1)),
      source: item.source,
    })),
  };
}

export function resolveWardrobeItemById(catalogItems, itemId) {
  const safeId = normalizeString(itemId);
  if (!safeId) return null;
  return (Array.isArray(catalogItems) ? catalogItems : []).find((item) => item.id === safeId) || null;
}

export function resolveEffectiveWardrobe(loadoutWardrobe, wardrobeSelection = {}) {
  const source = normalizeWardrobeCollection(loadoutWardrobe);
  const next = {
    library: source.library.map((item) => ({ ...item })),
    equipped: Object.entries(source.equipped).reduce((acc, [slotKey, entry]) => {
      acc[slotKey] = entry && typeof entry === "object"
        ? {
            itemId: normalizeString(entry.itemId),
            transform: entry.transform && typeof entry.transform === "object" ? { ...entry.transform } : {},
          }
        : { itemId: "", transform: {} };
      return acc;
    }, {}),
    presets: source.presets.map((item) => ({
      ...item,
      equipped: item?.equipped && typeof item.equipped === "object" ? { ...item.equipped } : {},
    })),
  };

  const presetItem = wardrobeSelection?.presetItem || null;
  const slotItemsBySlot = wardrobeSelection?.slotItemsBySlot && typeof wardrobeSelection.slotItemsBySlot === "object"
    ? wardrobeSelection.slotItemsBySlot
    : {};

  if (presetItem?.presetRef) {
    const preset = next.presets.find((item) => normalizeString(item?.id) === normalizeString(presetItem.presetRef));
    if (preset?.equipped && typeof preset.equipped === "object") {
      next.equipped = Object.entries(preset.equipped).reduce((acc, [slotKey, entry]) => {
        acc[slotKey] = entry && typeof entry === "object"
          ? {
              itemId: normalizeString(entry.itemId),
              transform: entry.transform && typeof entry.transform === "object" ? { ...entry.transform } : {},
            }
          : { itemId: "", transform: {} };
        return acc;
      }, {});
    }
  }

  Object.values(slotItemsBySlot).forEach((wardrobeItem) => {
    if (!wardrobeItem?.assetRef || !wardrobeItem?.slot) return;
    const current = next.equipped?.[wardrobeItem.slot] || { itemId: "", transform: {} };
    next.equipped = {
      ...next.equipped,
      [wardrobeItem.slot]: {
        itemId: normalizeString(wardrobeItem.assetRef),
        transform: current?.transform && typeof current.transform === "object" ? { ...current.transform } : {},
      },
    };
  });

  return next;
}
