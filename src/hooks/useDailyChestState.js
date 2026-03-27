import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useDailyChestState() {
  const queryClient = useQueryClient();

  const stateQuery = useQuery({
    queryKey: ["daily-chest-state"],
    queryFn: () => base44.dailyChest.getState(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const openMutation = useMutation({
    mutationFn: (slotType) => base44.dailyChest.open(slotType),
    onSuccess: (data) => {
      queryClient.setQueryData(["daily-chest-state"], data);
      queryClient.invalidateQueries({ queryKey: ["profile-daily-chest-xp"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative"] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (code) => base44.dailyChest.unlock(code),
    onSuccess: (data) => {
      queryClient.setQueryData(["daily-chest-state"], data);
      queryClient.invalidateQueries({ queryKey: ["profile-daily-chest-xp"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative"] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: () => base44.dailyChest.claim(),
    onSuccess: (data) => {
      queryClient.setQueryData(["daily-chest-state"], data);
      queryClient.invalidateQueries({ queryKey: ["points-me"] });
      queryClient.invalidateQueries({ queryKey: ["user-prize-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-bonus-events"] });
      queryClient.invalidateQueries({ queryKey: ["profile-daily-chest-xp"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });

  return {
    ...stateQuery,
    state: stateQuery.data || null,
    openChest: openMutation.mutateAsync,
    unlockChest: unlockMutation.mutateAsync,
    claimChest: claimMutation.mutateAsync,
    isOpening: openMutation.isPending,
    isUnlocking: unlockMutation.isPending,
    isClaiming: claimMutation.isPending,
    openError: openMutation.error,
    unlockError: unlockMutation.error,
    claimError: claimMutation.error,
  };
}
