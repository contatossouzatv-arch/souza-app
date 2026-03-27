import React, { Suspense } from "react";
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
import { useAuth } from "@/lib/AuthContext";

const PrizeGalleryCard = React.lazy(() => import("@/components/profile/PrizeGalleryCard"));
const WinnersHistoryBox = React.lazy(() => import("@/components/WinnersHistoryBox"));

const HEAVY_SECTIONS_DELAY_MS = 150;

function DeferredDashboardSection({ active, children }) {
  if (!active) {
    return (
      <Card className="border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
        Preparando informacoes extras...
      </Card>
    );
  }

  return (
    <Suspense fallback={<Card className="border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Carregando painel...</Card>}>
      {children}
    </Suspense>
  );
}

export default function Dashboard() {
  const { user, isLoadingAuth } = useAuth();
  const [showHeavySections, setShowHeavySections] = React.useState(false);

  const { data: dynamicsSummary, isLoading: dynamicsLoading } = useQuery({
    queryKey: ["dashboard-dynamics-summary"],
    queryFn: () => base44.dynamics.summary(),
    enabled: !!user,
    staleTime: 120000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  React.useEffect(() => {
    setShowHeavySections(false);
    if (!user || dynamicsLoading) return undefined;
    const timerId = window.setTimeout(() => {
      setShowHeavySections(true);
    }, HEAVY_SECTIONS_DELAY_MS);
    return () => window.clearTimeout(timerId);
  }, [dynamicsLoading, user?.id]);

  const promoBoxes = dynamicsSummary?.promoBoxes || [];
  const instantSummary = dynamicsSummary?.instantRaffle || null;
  const liveDrawSummary = dynamicsSummary?.liveDraw || null;
  const gameCallSummary = dynamicsSummary?.gameCall || null;
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

  if (isLoadingAuth || !user) {
    return <TechLoader />;
  }

  const hasActiveDynamics =
    Boolean(instantSummary?.raffle) ||
    Boolean(liveDrawSummary?.raffle) ||
    Boolean(gameCallSummary?.raffle) ||
    promoBoxes.length > 0;

  return (
    <div className="w-full overflow-x-hidden bg-slate-950">
      <AutoAppUpdater />

      <motion.div
        className="w-full space-y-4 px-2 py-2 sm:px-3 sm:py-3"
        variants={containerVariants}
        initial={false}
        animate="show"
      >
        <motion.div variants={itemVariants} className="px-2 text-center">
          <h1 className="text-2xl font-bold text-white">Sorteios e Dinamicas</h1>
          <p className="text-sm text-slate-400">Entre nas dinamicas ativas e acompanhe os resultados ao vivo.</p>
        </motion.div>

        {dynamicsLoading ? (
          <>
            <motion.div variants={itemVariants}>
              <Card className="border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                Carregando sorteios e dinâmicas...
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <DeferredDashboardSection active={showHeavySections}>
                <PrizeGalleryCard
                  userId={user.id}
                  title="Seus Premios"
                  subtitle="Aqui voce acompanha sua colecao pessoal de premios ja ganhos e registrados no app."
                  emptyTitle="Sua colecao de premios ainda esta vazia"
                  emptySubtitle="Quando voce ganhar e resgatar recompensas, elas vao aparecer aqui automaticamente."
                  countLabel="na colecao"
                  privateView={true}
                  eagerPreview={true}
                />
              </DeferredDashboardSection>
            </motion.div>
          </>
        ) : hasActiveDynamics ? (
          <>
            <motion.div variants={itemVariants}>
              <InstantRaffleBox user={user} summary={instantSummary} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <WinnerNotification userId={user.id} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <LiveDrawBox user={user} summary={liveDrawSummary} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <GameCallBox user={user} summary={gameCallSummary} />
            </motion.div>

            {promoBoxes.length > 0 ? (
              <motion.div variants={itemVariants} className="space-y-4">
                {promoBoxes.map((promo) => (
                  <Card key={promo.id} className="border-slate-800 bg-slate-900/70 p-4">
                    {promo.image_url ? (
                      <img
                        src={promo.image_url}
                        alt={promo.title}
                        className="mb-3 h-44 w-full rounded-lg object-cover"
                      />
                    ) : null}
                    <h3 className="mb-1 text-lg font-bold text-white">{promo.title}</h3>
                    <p className="text-sm text-slate-300">{promo.description}</p>
                  </Card>
                ))}
              </motion.div>
            ) : null}

            <motion.div variants={itemVariants}>
              <DeferredDashboardSection active={showHeavySections}>
                <WinnersHistoryBox />
              </DeferredDashboardSection>
            </motion.div>

            <motion.div variants={itemVariants}>
              <DeferredDashboardSection active={showHeavySections}>
                <PrizeGalleryCard
                  userId={user.id}
                  title="Seus Premios"
                  subtitle="Aqui voce acompanha sua colecao pessoal de premios ja ganhos e registrados no app."
                  emptyTitle="Sua colecao de premios ainda esta vazia"
                  emptySubtitle="Quando voce ganhar e resgatar recompensas, elas vao aparecer aqui automaticamente."
                  countLabel="na colecao"
                  privateView={true}
                  eagerPreview={true}
                />
              </DeferredDashboardSection>
            </motion.div>
          </>
        ) : (
          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              <Card className="overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15">
                  <Sparkles className="h-7 w-7 text-cyan-300" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">Nenhum sorteio ativo no momento</h3>
                <p className="mb-5 text-sm text-slate-400">
                  Assim que uma dinamica for ativada, ela aparece aqui automaticamente para voce participar.
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
                    Dinamica rapida
                  </div>
                </div>
              </Card>

              <DeferredDashboardSection active={showHeavySections}>
                <PrizeGalleryCard
                  userId={user.id}
                  title="Seus Premios"
                  subtitle="Aqui voce acompanha sua colecao pessoal de premios ja ganhos e registrados no app."
                  emptyTitle="Sua colecao de premios ainda esta vazia"
                  emptySubtitle="Quando voce ganhar e resgatar recompensas, elas vao aparecer aqui automaticamente."
                  countLabel="na colecao"
                  privateView={true}
                  eagerPreview={true}
                />
              </DeferredDashboardSection>

              <div className="mt-4">
                <DeferredDashboardSection active={showHeavySections}>
                  <WinnersHistoryBox />
                </DeferredDashboardSection>
              </div>
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
