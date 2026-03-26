import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Sparkles, Trophy, ExternalLink, Heart } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function LiveDrawBox({ user, summary = null }) {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useAppSettings();

  const liveLink = settings.find((s) => s.key === "live_link")?.value || "";

  const { data: liveDrawSummaryFromQuery = null } = useQuery({
    queryKey: ["dashboard-dynamics-summary"],
    queryFn: () => base44.dynamics.summary(),
    select: (data) => data?.liveDraw || null,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled: !summary?.raffle,
  });

  const liveSummary = summary || liveDrawSummaryFromQuery || null;
  const activeRaffle = liveSummary?.raffle || null;
  const myParticipation = liveSummary?.myParticipation || [];

  const hasParticipated = myParticipation.length > 0;

  const participateMutation = useMutation({
    mutationFn: async () => base44.liveDraws.join(activeRaffle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-dynamics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["my-live-participation"] });
      queryClient.invalidateQueries({ queryKey: ["raffle-participants"] });
    },
    onError: (error) => {
      alert(error?.message || "Erro ao participar. Tente novamente.");
    },
  });

  if (!activeRaffle) return null;

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-red-700/50 bg-gradient-to-br from-red-900/50 to-pink-900/50 shadow-xl">
      <div className="relative p-6">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Zap className="h-6 w-6 text-yellow-400" />
          <h3 className="bg-gradient-to-r from-yellow-300 via-red-300 to-pink-300 bg-clip-text text-center text-xl font-bold uppercase text-transparent">
            Sorteio ao Vivo Disponivel!
          </h3>
          <Zap className="h-6 w-6 text-yellow-400" />
        </div>

        <div className="mb-4 text-center">
          <p className="mb-2 text-lg font-bold text-purple-200">{activeRaffle.title}</p>
          <p className="text-3xl font-bold text-green-400">Premio: R$ {activeRaffle.prize_amount?.toFixed(2)}</p>
        </div>

        <div className="mb-4 rounded-lg border border-yellow-600/50 bg-yellow-900/30 p-3 text-center">
          <p className="mb-1 flex items-center justify-center gap-2 text-sm font-bold text-yellow-200">
            <Heart className="h-4 w-4 animate-pulse" />
            REGRAS DO SORTEIO
          </p>
          <p className="text-xs text-yellow-100">Deixe seu LIKE na live para participar!</p>
        </div>

        {liveLink && (
          <a href={liveLink} target="_blank" rel="noopener noreferrer" className="mb-4 block">
            <Button className="w-full transform bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 text-white shadow-lg transition-all hover:scale-105 hover:from-red-700 hover:via-pink-700 hover:to-purple-700 hover:shadow-xl">
              <ExternalLink className="mr-2 h-5 w-5" />
              ASSISTIR LIVE AGORA!
            </Button>
          </a>
        )}

        {!hasParticipated ? (
          <Button
            onClick={() => participateMutation.mutate()}
            disabled={participateMutation.isPending}
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {participateMutation.isPending ? "ENTRANDO..." : "PARTICIPAR AGORA!"}
          </Button>
        ) : (
          <div className="rounded-lg border border-green-600/50 bg-green-900/30 p-4 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-green-400" />
            <p className="font-bold text-green-300">Você está participando!</p>
            <p className="mt-1 text-sm text-green-200">Aguarde o sorteio ao vivo</p>
          </div>
        )}
      </div>
    </Card>
  );
}

