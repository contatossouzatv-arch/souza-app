import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import LiveDrawBox from "../components/LiveDrawBox";
import WinnerNotification from "../components/WinnerNotification";
import GameCallBox from "../components/GameCallBox";
import InstantRaffleBox from "../components/InstantRaffleBox";
import AutoAppUpdater from "../components/AutoAppUpdater";
import TechLoader from "../components/TechLoader";
import { Card } from "@/components/ui/card";
import { Sparkles, Trophy, Gamepad2 } from "lucide-react";
import LegalLinksBar from "@/components/LegalLinksBar";
import PrizeGalleryCard from "@/components/profile/PrizeGalleryCard";
import { useAuth } from "@/lib/AuthContext";

export default function Dashboard() {
  const { user, isLoadingAuth } = useAuth();

  const { data: promoBoxes = [], isLoading: promoBoxesLoading } = useQuery({
    queryKey: ["promoBoxes"],
    queryFn: () => base44.entities.PromoBox.filter({ active: true }, "-created_date"),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: activeInstantRaffles = [], isLoading: instantLoading } = useQuery({
    queryKey: ["active-instant-raffles"],
    queryFn: () => base44.entities.InstantRaffle.filter({ active: true, ended: false }),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: activeLiveRaffles = [], isLoading: liveLoading } = useQuery({
    queryKey: ["active-live-raffles"],
    queryFn: () => base44.entities.LiveDrawRaffle.filter({ active: true, ended: false }),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: activeGameCallRaffles = [], isLoading: gameCallLoading } = useQuery({
    queryKey: ["active-gamecall-raffles"],
    queryFn: () => base44.entities.GameCallRaffle.filter({ active: true, ended: false }),
    enabled: !!user,
    staleTime: 30000,
  });
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.16,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  };

  const isLoading = isLoadingAuth || !user || promoBoxesLoading || instantLoading || liveLoading || gameCallLoading;

  if (isLoading) {
    return <TechLoader />;
  }

  const hasActiveDynamics =
    activeInstantRaffles.length > 0 ||
    activeLiveRaffles.length > 0 ||
    activeGameCallRaffles.length > 0 ||
    promoBoxes.length > 0;

  return (
    <div className="w-full overflow-x-hidden bg-slate-950">
      <AutoAppUpdater />

      <motion.div
        className="w-full space-y-4 px-2 sm:px-3 py-2 sm:py-3"
        variants={containerVariants}
        initial={false}
        animate="show"
      >
        <motion.div variants={itemVariants} className="text-center px-2">
          <h1 className="text-2xl font-bold text-white">Sorteios e Dinâmicas</h1>
          <p className="text-sm text-slate-400">Entre nas dinâmicas ativas e acompanhe os resultados ao vivo.</p>
        </motion.div>

        {hasActiveDynamics ? (
          <>
            <motion.div variants={itemVariants}>
              <InstantRaffleBox user={user} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <WinnerNotification userId={user.id} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <LiveDrawBox user={user} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <GameCallBox user={user} />
            </motion.div>

            {promoBoxes.length > 0 ? (
              <motion.div variants={itemVariants} className="space-y-4">
                {promoBoxes.map((promo) => (
                  <Card key={promo.id} className="bg-slate-900/70 border-slate-800 p-4">
                    {promo.image_url ? (
                      <img
                        src={promo.image_url}
                        alt={promo.title}
                        className="w-full h-44 object-cover rounded-lg mb-3"
                      />
                    ) : null}
                    <h3 className="text-lg font-bold text-white mb-1">{promo.title}</h3>
                    <p className="text-sm text-slate-300">{promo.description}</p>
                  </Card>
                ))}
              </motion.div>
            ) : null}

            <motion.div variants={itemVariants}>
              <PrizeGalleryCard
                userId={user.id}
                title="Seus Prêmios"
                subtitle="Aqui você acompanha sua coleção pessoal de prêmios já ganhos e registrados no app."
                emptyTitle="Sua coleção de prêmios ainda está vazia"
                emptySubtitle="Quando você ganhar e resgatar recompensas, elas vão aparecer aqui automaticamente."
                countLabel="na coleção"
                privateView={true}
              />
            </motion.div>
          </>
        ) : (
          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              <Card className="overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15">
                  <Sparkles className="h-7 w-7 text-cyan-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Nenhum sorteio ativo no momento</h3>
                <p className="text-sm text-slate-400 mb-5">
                  Assim que uma dinâmica for ativada, ela aparece aqui automaticamente para você participar.
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                    <Trophy className="mx-auto mb-1 h-4 w-4 text-yellow-400" />
                    Sorteio
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                    <Gamepad2 className="mx-auto mb-1 h-4 w-4 text-cyan-400" />
                    Call de jogo
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                    <Sparkles className="mx-auto mb-1 h-4 w-4 text-pink-400" />
                    Dinâmica rápida
                  </div>
                </div>
              </Card>

              <PrizeGalleryCard
                userId={user.id}
                title="Seus Prêmios"
                subtitle="Aqui você acompanha sua coleção pessoal de prêmios já ganhos e registrados no app."
                emptyTitle="Sua coleção de prêmios ainda está vazia"
                emptySubtitle="Quando você ganhar e resgatar recompensas, elas vão aparecer aqui automaticamente."
                countLabel="na coleção"
                privateView={true}
              />
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <LegalLinksBar />
        </motion.div>
      </motion.div>
    </div>
  );
}

