import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const APP_SETTINGS_QUERY_KEY = ["app-settings"];

export function useAppSettings(options = {}) {
  return useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}
