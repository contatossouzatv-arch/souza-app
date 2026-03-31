import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const APP_SETTINGS_QUERY_KEY = ["app-settings"];
export const PUBLIC_UI_CONFIG_QUERY_KEY = ["public-ui-config"];
export const EMPTY_PUBLIC_UI_CONFIG = {
  settings: [],
  banners: [],
  socials: [],
};

export async function loadSafePublicUiConfig() {
  try {
    const payload = await base44.ui.publicConfig();
    return {
      settings: Array.isArray(payload?.settings) ? payload.settings : [],
      banners: Array.isArray(payload?.banners) ? payload.banners : [],
      socials: Array.isArray(payload?.socials) ? payload.socials : [],
    };
  } catch {
    return EMPTY_PUBLIC_UI_CONFIG;
  }
}

export function useAppSettings(options = {}) {
  return useQuery({
    queryKey: PUBLIC_UI_CONFIG_QUERY_KEY,
    queryFn: loadSafePublicUiConfig,
    select: (data) => {
      const settings = data?.settings;
      if (Array.isArray(settings)) return settings;
      if (settings && typeof settings === "object") return Object.values(settings);
      return [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}
