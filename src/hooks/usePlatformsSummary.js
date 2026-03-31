import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const PLATFORMS_SUMMARY_QUERY_KEY = ["platforms-summary"];
export const EMPTY_PLATFORMS_SUMMARY = {
  currentPlatform: null,
  activePlatforms: [],
};

export async function loadSafePlatformsSummary() {
  try {
    const payload = await base44.platforms.summary();
    return {
      currentPlatform: payload?.currentPlatform || null,
      activePlatforms: Array.isArray(payload?.activePlatforms) ? payload.activePlatforms : [],
    };
  } catch {
    return EMPTY_PLATFORMS_SUMMARY;
  }
}

export function usePlatformsSummary(options = {}) {
  return useQuery({
    queryKey: PLATFORMS_SUMMARY_QUERY_KEY,
    queryFn: loadSafePlatformsSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}
