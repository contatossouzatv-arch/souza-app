import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { History, ChevronDown, ChevronUp, Calendar, Ticket, TrendingUp, Gift } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CycleHistoryBox({ currentUserId }) {
  const [expandedCycle, setExpandedCycle] = useState(null);

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycle-history'],
    queryFn: () => base44.entities.DepositantDrawCycle.list('-created_date'),
  });

  const { data: allDeposits = [] } = useQuery({
    queryKey: ['all-deposits-history'],
    queryFn: () => base44.entities.Deposit.list(),
  });

  const endedCycles = cycles.filter(c => !c.active);

  const getCycleData = (cycle) => {
    const cycleDeposits = allDeposits.filter(
      d => d.cycle_id === cycle.id && d.status === 'approved' && d.user_id === currentUserId
    );
    
    const totalDeposited = cycleDeposits.reduce((sum, d) => sum + d.amount, 0);
    const basicTickets = Math.floor(totalDeposited / 50);
    const bonusTickets = Math.floor(totalDeposited / 100) * 5;
    const totalTickets = basicTickets + bonusTickets;

    return {
      totalDeposited,
      basicTickets,
      bonusTickets,
      totalTickets,
      deposits: cycleDeposits
    };
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-6 h-6 text-purple-400" />
        <h3 className="text-xl font-bold text-white">
           Histórico de Participação
        </h3>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Acompanhe seu histórico de depósitos e bilhetes gerados nos ciclos anteriores
      </p>

      {endedCycles.length === 0 ? (
        <div className="text-center py-12">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="mb-6"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          
          <h4 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 mb-3">
             Comece Sua Jornada!
          </h4>
          
          <p className="text-slate-300 mb-4 max-w-md mx-auto">
            Ainda não há histórico disponível. Seja um dos primeiros a participar e construir seu legado de vitórias!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-600/50 rounded-lg p-4">
              <div className="text-3xl mb-2"></div>
              <p className="text-sm font-bold text-green-300">Deposite</p>
              <p className="text-xs text-green-200 mt-1">Registre seus depósitos e ganhe bilhetes</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-2 border-purple-600/50 rounded-lg p-4">
              <div className="text-3xl mb-2"></div>
              <p className="text-sm font-bold text-purple-300">Acumule Bilhetes</p>
              <p className="text-xs text-purple-200 mt-1">Quanto mais bilhetes, mais chances de ganhar</p>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-2 border-yellow-600/50 rounded-lg p-4">
              <div className="text-3xl mb-2"></div>
              <p className="text-sm font-bold text-yellow-300">Ganhe Prêmios</p>
              <p className="text-xs text-yellow-200 mt-1">Participe dos sorteios e concorra a prêmios!</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-600/50 rounded-lg max-w-md mx-auto">
            <p className="text-sm text-indigo-200">
              ✨ <span className="font-bold">Dica:</span> Seus ciclos de participação aparecerão aqui automaticamente!
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
              className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">Ciclo #{cycle.cycle_number}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(cycle.start_date).toLocaleDateString('pt-BR')} - {new Date(cycle.end_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {cycleData.totalDeposited > 0 ? (
                    <>
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-green-400">
                          R$ {cycleData.totalDeposited.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {cycleData.totalTickets} bilhetes
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 mr-2">Sem participação</p>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
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
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-300 mb-1"> Total Depositado</p>
                            <p className="text-lg font-bold text-green-400">
                              R$ {cycleData.totalDeposited.toFixed(2)}
                            </p>
                          </div>
                          
                          <div className="bg-cyan-900/30 border border-cyan-600/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-cyan-300 mb-1"> Bilhetes Normais</p>
                            <p className="text-lg font-bold text-cyan-400">
                              {cycleData.basicTickets}
                            </p>
                          </div>
                          
                          <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-purple-300 mb-1"> Bilhetes Bônus</p>
                            <p className="text-lg font-bold text-purple-400">
                              {cycleData.bonusTickets}
                            </p>
                          </div>
                          
                          <div className="bg-indigo-900/30 border border-indigo-600/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-indigo-300 mb-1"> Total de Bilhetes</p>
                            <p className="text-lg font-bold text-indigo-400">
                              {cycleData.totalTickets}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Ticket className="w-4 h-4 text-cyan-400" />
                            <p className="text-sm font-bold text-slate-300">Detalhes dos Depósitos</p>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {cycleData.deposits.map((deposit, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-2 bg-slate-800/50 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-green-600/20 rounded flex items-center justify-center">
                                    <span className="text-xs text-green-400">#{i + 1}</span>
                                  </div>
                                  <span className="text-sm text-slate-300">
                                    {new Date(deposit.created_date).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-green-400">
                                    R$ {deposit.amount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {deposit.ticket_numbers?.length || 0} bilhetes
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-600/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-purple-200 mb-1">
                             Dica: A cada R$100 você ganha +5 bilhetes bônus!
                          </p>
                          <p className="text-xs text-purple-300">
                            Neste ciclo você conquistou {cycleData.bonusTickets} bônus
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-400">
                          Você não participou deste ciclo
                        </p>
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
