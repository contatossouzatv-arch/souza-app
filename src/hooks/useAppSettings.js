import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const APP_SETTINGS_QUERY_KEY = ["app-settings"];
export const PUBLIC_UI_CONFIG_QUERY_KEY = ["public-ui-config"];

export function useAppSettings(options = {}) {
  return useQuery({
    queryKey: PUBLIC_UI_CONFIG_QUERY_KEY,
    queryFn: () => base44.ui.publicConfig(),
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
