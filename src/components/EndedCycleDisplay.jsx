import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function EndedCycleDisplay({ currentUserId }) {
  const [expandedCycle, setExpandedCycle] = useState(null);

  const { data: depositsDashboardSummary = null } = useQuery({
    queryKey: ["all-ended-cycles"],
    queryFn: () => base44.deposits.dashboardSummary(),
  });

  const allCycles = depositsDashboardSummary?.cycles || [];
  const raffleWinners = depositsDashboardSummary?.drawWinners || [];
  const endedCycles = allCycles.filter((cycle) => !cycle.active);

  const getCycleRaffleWinners = (cycleId) => {
    return raffleWinners.filter((winner) => winner.cycle_id === cycleId);
  };

  const hasRaffleWinners = (cycle) => {
    if (Array.isArray(cycle?.raffle_winners) && cycle.raffle_winners.length > 0) return true;
    return getCycleRaffleWinners(cycle.id).length > 0;
  };

  if (endedCycles.length === 0) return null;

  const getCycleData = (cycle) => {
    const topParticipants = Array.isArray(cycle?.top_participants) ? cycle.top_participants : [];
    return {
      top1: topParticipants[0] || null,
      top2: topParticipants[1] || null,
      top3: topParticipants[2] || null,
    };
  };

  return (
    <Card className="relative border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-6 flex items-center gap-2">
        <Trophy className="h-6 w-6 text-cyan-400" />
        <h3 className="text-xl font-bold text-white">Sorteios Já Realizados pelo SouzaTV</h3>
      </div>

      <div className="space-y-3">
        {endedCycles.map((cycle) => {
          const isExpanded = expandedCycle === cycle.id;
          const { top1, top2, top3 } = getCycleData(cycle);
          const oldFormatWinners = Array.isArray(cycle?.raffle_winners) ? cycle.raffle_winners : [];
          const newFormatWinners = getCycleRaffleWinners(cycle.id);
          const displayWinners = oldFormatWinners.length > 0 ? oldFormatWinners : newFormatWinners;
          const raffleCompleted = displayWinners.length > 0 || cycle.raffle_completed;
          const userWonRaffle = displayWinners.find((winner) => winner.user_id === currentUserId);
          const userIsTop3 = [top1?.user_id, top2?.user_id, top3?.user_id].includes(currentUserId);

          return (
            <div key={cycle.id} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50">
              <button
                onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">CICLO ENCERRADO #{cycle.cycle_number}</p>
                    <p className="text-xs text-slate-400">
                      Período: {new Date(cycle.start_date).toLocaleDateString("pt-BR")} -{" "}
                      {new Date(cycle.end_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-slate-700"
                  >
                    <div className="space-y-6 p-4">
                      <div>
                        <h4 className="mb-3 text-sm font-bold text-slate-300">Top 3 Maiores Depositantes do Ciclo:</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div
                            className={`rounded-lg border-2 p-4 text-center ${
                              userIsTop3 && currentUserId === top1?.user_id
                                ? "animate-pulse border-yellow-400 bg-yellow-900/30"
                                : "border-yellow-600/50 bg-yellow-900/30"
                            }`}
                          >
                            <div className="text-xs font-bold text-yellow-300">Prêmio de R$ 500</div>
                            <div className="mt-1 truncate text-xs text-yellow-200">{top1?.user_name || "-"}</div>
                          </div>
                          <div
                            className={`rounded-lg border-2 p-4 text-center ${
                              userIsTop3 && currentUserId === top2?.user_id
                                ? "animate-pulse border-gray-400 bg-gray-700/30"
                                : "border-gray-500/50 bg-gray-700/30"
                            }`}
                          >
                            <div className="text-xs font-bold text-gray-300">Prêmio de R$ 300</div>
                            <div className="mt-1 truncate text-xs text-gray-200">{top2?.user_name || "-"}</div>
                          </div>
                          <div
                            className={`rounded-lg border-2 p-4 text-center ${
                              userIsTop3 && currentUserId === top3?.user_id
                                ? "animate-pulse border-orange-400 bg-orange-900/30"
                                : "border-orange-600/50 bg-orange-900/30"
                            }`}
                          >
                            <div className="text-xs font-bold text-orange-300">Prêmio de R$ 200</div>
                            <div className="mt-1 truncate text-xs text-orange-200">{top3?.user_name || "-"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                        {!raffleCompleted ? (
                          <div className="w-full text-center">
                            <div className="mb-3 text-3xl">⏳</div>
                            <p className="mb-2 text-lg font-bold text-cyan-400">Sorteio dos Bilhetes Em Breve</p>
                            <p className="text-sm text-slate-400">Os ganhadores dos bilhetes serão sorteados em breve.</p>
                            <p className="mt-2 text-xs text-slate-500">Fique atento para não perder.</p>
                          </div>
                        ) : (
                          <div className="w-full">
                            <div className="mb-4 flex items-center justify-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-400" />
                              <p className="text-lg font-bold text-green-400">Sorteio Realizado!</p>
                            </div>
                            <p className="mb-3 text-center text-sm text-slate-300">Ganhadores dos R$ 200:</p>
                            <div className="space-y-2">
                              {displayWinners.map((winner, index) => (
                                <div
                                  key={`${winner.user_id || "winner"}-${index}`}
                                  className={`rounded-lg border-2 p-3 ${
                                    winner.user_id === currentUserId
                                      ? "animate-pulse border-green-400 bg-gradient-to-r from-green-900/30 to-emerald-900/30"
                                      : "border-slate-700 bg-gradient-to-r from-slate-900/50 to-slate-800/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-xl shadow-lg">
                                      {winner.user_avatar || ""}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-white">{winner.user_name}</p>
                                      <p className="truncate text-xs text-slate-400">@{winner.user_nick || winner.user_name}</p>
                                      <p className="text-xs font-bold text-green-400">Ganhou R$ 200</p>
                                    </div>
                                  </div>
                                  {winner.user_id === currentUserId ? (
                                    <div className="mt-3 rounded-lg border border-green-600 bg-green-800/30 p-3 text-center">
                                      <p className="text-sm font-bold text-green-300">VOCÊ GANHOU R$ 200!</p>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {(userIsTop3 || userWonRaffle) && (
                        <div className="animate-pulse rounded-lg border-2 border-green-500 bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 text-center">
                          <p className="mb-2 text-xl font-bold text-green-300">PARABÉNS! VOCÊ GANHOU!</p>
                          <p className="text-sm text-green-200">Entre em contato com o admin para resgatar seu prêmio</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
