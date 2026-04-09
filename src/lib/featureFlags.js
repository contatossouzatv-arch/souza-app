import { createPageUrl } from "@/utils";

function readBooleanFlag(rawValue, fallback) {
  if (rawValue == null || rawValue === "") return fallback;
  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export const FEATURE_FLAGS = {
  GAME_MAIN_ENABLED: readBooleanFlag(import.meta.env.VITE_GAME_MAIN_ENABLED, false),
  DAILY_CHEST_3D_ENABLED: readBooleanFlag(import.meta.env.VITE_DAILY_CHEST_3D_ENABLED, false),
};

export const MAIN_GAME_PAGE_KEY = "DailyEvent";
export const MAIN_GAME_ROUTE_PATH = createPageUrl(MAIN_GAME_PAGE_KEY);
export const DAILY_CHEST_ROUTE_PATH = createPageUrl("Daily Chest");

export function isMainGamePage(pageKey) {
  return String(pageKey || "") === MAIN_GAME_PAGE_KEY;
}
