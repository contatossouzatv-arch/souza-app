import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, CheckCircle, Ticket, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function EndedCycleDisplay({ currentUserId }) {
  const [expandedCycle, setExpandedCycle] = useState(null);

  // Buscar todos os ciclos encerrados
  const { data: allCycles = [] } = useQuery({
    queryKey: ['all-ended-cycles'],
    queryFn: () => base44.entities.DepositantDrawCycle.list('-created_date'),
  });

  // Buscar todos os depósitos
  const { data: allDeposits = [] } = useQuery({
    queryKey: ['all-deposits-ended'],
    queryFn: () => base44.entities.Deposit.list(),
  });

  // Buscar ganhadores do sorteio de R$200
  const { data: raffleWinners = [] } = useQuery({
    queryKey: ['depositant-raffle-winners-display'],
    queryFn: async () => {
      const winners = await base44.entities.DepositantDrawWinner.filter({ prize_type: 'raffle' }, '-draw_date');
      return winners;
    },
  });

  // Buscar auditoria de ganhadores (para ciclos antigos)
  const { data: auditWinners = [] } = useQuery({
    queryKey: ['audit-winners-display'],
    queryFn: async () => {
      const audit = await base44.entities.DrawWinnerAudit.list('-drawn_at');
      return audit;
    },
  });

  const endedCycles = allCycles.filter(c => !c.active);

  // Filtrar ganhadores por ciclo (formato novo - DepositantDrawWinner)
  const getCycleRaffleWinners = (cycleId, cycleNumber) => {
    const directWinners = raffleWinners.filter(w => w.cycle_id === cycleId);
    
    // Se não encontrar, buscar na auditoria
    if (directWinners.length === 0) {
      // Buscar ganhadores da auditoria que correspondam a este ciclo
      const auditForCycle = auditWinners.filter(w => {
        const isPrize200 = w.prize_amount === 200;
        
        // Priorizar o campo cycle_number se existir
        if (w.cycle_number !== undefined && w.cycle_number !== null) {
          return isPrize200 && w.cycle_number === cycleNumber && w.status === 'validated';
        }
        
        // Fallback: buscar pelo título
        const title = w.raffle_title?.toLowerCase() || '';
        const matchesCycleExact = 
          title.includes(`ciclo ${cycleNumber}`) || 
          title.includes(`ciclo#${cycleNumber}`) ||
          title.includes(`#${cycleNumber}`);
        
        return isPrize200 && matchesCycleExact && w.status === 'validated';
      });
      
      // Converter formato de auditoria para formato esperado
      return auditForCycle.map(w => ({
        user_id: w.user_id,
        user_name: w.user_name,
        user_nick: w.user_nick,
        user_avatar: w.user_avatar,
        ticket_number: w.game_call || 'N/A',
        prize_amount: w.prize_amount
      }));
    }
    
    return directWinners;
  };
  
  // Verificar se o ciclo tem ganhadores (priorizar dados salvos no próprio ciclo)
  const hasRaffleWinners = (cycle) => {
    // Prioridade: cycle.raffle_winners (dados históricos salvos no ciclo)
    if (cycle.raffle_winners && cycle.raffle_winners.length > 0) return true;
    // Fallback: DepositantDrawWinner ou auditoria
    const newFormatWinners = getCycleRaffleWinners(cycle.id, cycle.cycle_number);
    return newFormatWinners.length > 0;
  };

  if (endedCycles.length === 0) return null;

  const getCycleData = (cycle) => {
    const cycleDeposits = allDeposits.filter(d => d.cycle_id === cycle.id && d.status === 'approved');
    
    const totals = {};
    cycleDeposits.forEach(d => {
      if (!totals[d.user_id]) {
        totals[d.user_id] = {
          user_id: d.user_id,
          user_name: d.user_name,
          total: 0
        };
      }
      totals[d.user_id].total += d.amount;
    });
    
    const userTotals = Object.values(totals).sort((a, b) => b.total - a.total);
    
    return {
      top1: userTotals[0],
      top2: userTotals[1],
      top3: userTotals[2],
    };
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 p-6 relative">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">
             Sorteios Já Realizados pelo SouzaTV
          </h3>
        </div>

        <div className="space-y-3">
          {endedCycles.map((cycle) => {
            const isExpanded = expandedCycle === cycle.id;
            const { top1, top2, top3 } = getCycleData(cycle);
            
            // PRIOORIDADE: dados salvos no próprio ciclo (histórico)
            const oldFormatWinners = cycle.raffle_winners || [];
            const newFormatWinners = getCycleRaffleWinners(cycle.id, cycle.cycle_number);
            
            // Usar dados do ciclo se existirem, senão buscar no DepositantDrawWinner ou auditoria
            const displayWinners = oldFormatWinners.length > 0 ? oldFormatWinners : newFormatWinners;
            
            // Considerar completo se: tem ganhadores ou campo raffle_completed esta true
            const raffleCompleted = displayWinners.length > 0 || cycle.raffle_completed;
            
            const userWonRaffle = displayWinners.find(w => w.user_id === currentUserId);
            const userIsTop3 = [top1?.user_id, top2?.user_id, top3?.user_id].includes(currentUserId);

            return (
              <div key={cycle.id} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white"> CICLO ENCERRADO #{cycle.cycle_number}</p>
                      <p className="text-xs text-slate-400">
                        Período: {new Date(cycle.start_date).toLocaleDateString('pt-BR')} - {new Date(cycle.end_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
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
                      <div className="p-4 space-y-6">
                        {/* Top 3 */}
                        <div>
                          <h4 className="text-sm font-bold text-slate-300 mb-3"> Top 3 Maiores Depositantes do Ciclo:</h4>
                          <div className="grid grid-cols-3 gap-3">
                          <div className={`p-4 bg-yellow-900/30 border-2 rounded-lg text-center ${userIsTop3 && currentUserId === top1?.user_id ? 'border-yellow-400 animate-pulse' : 'border-yellow-600/50'}`}>
                            <div className="text-2xl mb-1"></div>
                            <div className="text-xs font-bold text-yellow-300">Prêmio de R$ 500</div>
                            <div className="text-xs text-yellow-200 mt-1 truncate">{top1?.user_name || '-'}</div>
                          </div>
                          <div className={`p-4 bg-gray-700/30 border-2 rounded-lg text-center ${userIsTop3 && currentUserId === top2?.user_id ? 'border-gray-400 animate-pulse' : 'border-gray-500/50'}`}>
                            <div className="text-2xl mb-1"></div>
                            <div className="text-xs font-bold text-gray-300">Prêmio de R$ 300</div>
                            <div className="text-xs text-gray-200 mt-1 truncate">{top2?.user_name || '-'}</div>
                          </div>
                          <div className={`p-4 bg-orange-900/30 border-2 rounded-lg text-center ${userIsTop3 && currentUserId === top3?.user_id ? 'border-orange-400 animate-pulse' : 'border-orange-600/50'}`}>
                            <div className="text-2xl mb-1"></div>
                            <div className="text-xs font-bold text-orange-300">Prêmio de R$ 200</div>
                            <div className="text-xs text-orange-200 mt-1 truncate">{top3?.user_name || '-'}</div>
                          </div>
                          </div>
                        </div>

                        {/* Sorteio dos R$ 200 */}
                        <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg min-h-[200px] flex items-center justify-center">
                          {!raffleCompleted ? (
                            <div className="text-center w-full">
                              <div className="text-3xl mb-3">⏳</div>
                              <p className="text-lg font-bold text-cyan-400 mb-2">Sorteio dos Bilhetes Em Breve</p>
                              <p className="text-sm text-slate-400">OOs ganhadores dos bilhetes serão sorteados em breve...</p>
                              <p className="text-xs text-slate-500 mt-2">Fique atento para não perder!</p>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="flex items-center justify-center gap-2 mb-4">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <p className="text-lg font-bold text-green-400">Sorteio Realizado!</p>
                              </div>
                              <p className="text-sm text-slate-300 mb-3 text-center">️ Ganhadores dos R$ 200:</p>
                              <div className="space-y-2">
                                {displayWinners.map((winner, i) => (
                                  <div
                                    key={i}
                                    className={`p-3 rounded-lg border-2 ${
                                      winner.user_id === currentUserId
                                        ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-400 animate-pulse'
                                        : 'bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-xl shadow-lg flex-shrink-0">
                                        {winner.user_avatar || ''}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{winner.user_name}</p>
                                        <p className="text-xs text-slate-400 truncate">@{winner.user_nick || winner.user_name}</p>
                                        <p className="text-xs font-bold text-green-400"> Ganhou R$ 200</p>
                                      </div>
                                      <div className="text-xl flex-shrink-0"></div>
                                    </div>
                                    {winner.user_id === currentUserId && (
                                      <div className="mt-3 p-3 bg-green-800/30 rounded-lg text-center border border-green-600">
                                        <p className="text-sm font-bold text-green-300"> VOCÊ GANHOU R$ 200! </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {(userIsTop3 || userWonRaffle) && (
                          <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500 rounded-lg text-center animate-pulse">
                            <p className="text-xl font-bold text-green-300 mb-2"> PARABÉNS! VOCÊ GANHOU! </p>
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
