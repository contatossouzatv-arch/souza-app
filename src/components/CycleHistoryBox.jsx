import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { History, ChevronDown, ChevronUp, Calendar, Ticket, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CycleHistoryBox({ currentUserId }) {
  const [expandedCycle, setExpandedCycle] = useState(null);

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycle-history"],
    queryFn: async () => {
      const response = await base44.deposits.dashboardSummary();
      return response.cycles || [];
    },
  });

  const { data: myDeposits = [] } = useQuery({
    queryKey: ["all-deposits-history"],
    queryFn: async () => {
      const response = await base44.deposits.my();
      return response.items || [];
    },
  });

  const endedCycles = cycles.filter((cycle) => !cycle.active);

  const getCycleData = (cycle) => {
    const cycleDeposits = myDeposits.filter(
      (deposit) => deposit.cycle_id === cycle.id && deposit.status === "approved" && deposit.user_id === currentUserId
    );

    const totalDeposited = cycleDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const basicTickets = Math.floor(totalDeposited / 50);
    const bonusTickets = Math.floor(totalDeposited / 100) * 5;
    const totalTickets = basicTickets + bonusTickets;

    return {
      totalDeposited,
      basicTickets,
      bonusTickets,
      totalTickets,
      deposits: cycleDeposits,
    };
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-6 w-6 text-purple-400" />
        <h3 className="text-xl font-bold text-white">Histórico de Participação</h3>
      </div>

      <p className="mb-6 text-sm text-slate-400">
        Acompanhe seu histórico de depósitos e bilhetes gerados nos ciclos anteriores
      </p>

      {endedCycles.length === 0 ? (
        <div className="py-12 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mb-6"
          >
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600">
              <Calendar className="h-12 w-12 text-white" />
            </div>
          </motion.div>

          <h4 className="mb-3 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-2xl font-bold text-transparent">
            Comece Sua Jornada!
          </h4>

          <p className="mx-auto mb-4 max-w-md text-slate-300">
            Ainda não há histórico disponível. Seja um dos primeiros a participar e construir seu legado de vitórias.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border-2 border-green-600/50 bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-4">
              <p className="text-sm font-bold text-green-300">Deposite</p>
              <p className="mt-1 text-xs text-green-200">Registre seus depósitos e ganhe bilhetes</p>
            </div>
            <div className="rounded-lg border-2 border-purple-600/50 bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-4">
              <p className="text-sm font-bold text-purple-300">Acumule Bilhetes</p>
              <p className="mt-1 text-xs text-purple-200">Quanto mais bilhetes, mais chances de ganhar</p>
            </div>
            <div className="rounded-lg border-2 border-yellow-600/50 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 p-4">
              <p className="text-sm font-bold text-yellow-300">Ganhe Prêmios</p>
              <p className="mt-1 text-xs text-yellow-200">Participe dos sorteios e concorra a prêmios</p>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-md rounded-lg border border-indigo-600/50 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-4">
            <p className="text-sm text-indigo-200">
              <span className="font-bold">Dica:</span> Seus ciclos de participação aparecerão aqui automaticamente.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {endedCycles.map((cycle) => {
            const cycleData = getCycleData(cycle);
            const isExpanded = expandedCycle === cycle.id;

            return (
              <motion.div
                key={cycle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50"
              >
                <button
                  onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                  className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-800/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white">Ciclo #{cycle.cycle_number}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(cycle.start_date).toLocaleDateString("pt-BR")} -{" "}
                        {new Date(cycle.end_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {cycleData.totalDeposited > 0 ? (
                      <>
                        <div className="hidden text-right md:block">
                          <p className="text-sm font-bold text-green-400">R$ {cycleData.totalDeposited.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">{cycleData.totalTickets} bilhetes</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/20">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        </div>
                      </>
                    ) : (
                      <p className="mr-2 text-sm text-slate-500">Sem participação</p>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
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
                      {cycleData.totalDeposited > 0 ? (
                        <div className="space-y-4 p-4">
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-lg border border-green-600/50 bg-green-900/30 p-3 text-center">
                              <p className="mb-1 text-xs text-green-300">Total Depositado</p>
                              <p className="text-lg font-bold text-green-400">R$ {cycleData.totalDeposited.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg border border-cyan-600/50 bg-cyan-900/30 p-3 text-center">
                              <p className="mb-1 text-xs text-cyan-300">Bilhetes Normais</p>
                              <p className="text-lg font-bold text-cyan-400">{cycleData.basicTickets}</p>
                            </div>
                            <div className="rounded-lg border border-purple-600/50 bg-purple-900/30 p-3 text-center">
                              <p className="mb-1 text-xs text-purple-300">Bilhetes Bônus</p>
                              <p className="text-lg font-bold text-purple-400">{cycleData.bonusTickets}</p>
                            </div>
                            <div className="rounded-lg border border-indigo-600/50 bg-indigo-900/30 p-3 text-center">
                              <p className="mb-1 text-xs text-indigo-300">Total de Bilhetes</p>
                              <p className="text-lg font-bold text-indigo-400">{cycleData.totalTickets}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Ticket className="h-4 w-4 text-cyan-400" />
                              <p className="text-sm font-bold text-slate-300">Detalhes dos Depósitos</p>
                            </div>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                              {cycleData.deposits.map((deposit, index) => (
                                <div key={deposit.id || index} className="flex items-center justify-between rounded bg-slate-800/50 p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-green-600/20">
                                      <span className="text-xs text-green-400">#{index + 1}</span>
                                    </div>
                                    <span className="text-sm text-slate-300">
                                      {new Date(deposit.created_date).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-green-400">R$ {deposit.amount.toFixed(2)}</p>
                                    <p className="text-xs text-slate-400">{deposit.ticket_numbers?.length || 0} bilhetes</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg border border-purple-600/50 bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-3 text-center">
                            <p className="mb-1 text-xs text-purple-200">Dica: A cada R$100 você ganha +5 bilhetes bônus!</p>
                            <p className="text-xs text-purple-300">Neste ciclo você conquistou {cycleData.bonusTickets} bônus</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
                            <Calendar className="h-8 w-8 text-slate-600" />
                          </div>
                          <p className="text-sm text-slate-400">Você não participou deste ciclo</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
