import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Plus, Calendar, Award, CheckCircle, Pencil, Users, DollarSign, Ticket } from "lucide-react";

// Componente para exibir detalhes do ciclo ativo
function ActiveCycleDetails({ activeCycle, totals = [], onEdit, onEnd, onDelete }) {
  const top3 = activeCycle?.top_participants || [];
  const userStats = totals;
  const totalDeposits = Number(activeCycle?.approved_total || 0);
  const totalPending = Number(activeCycle?.pending_total || 0);
  const totalTickets = Number(activeCycle?.tickets_total || 0);

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6 mb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Badge className="bg-green-600 mb-2">ATIVO</Badge>
            <h3 className="text-xl font-bold text-white">Ciclo #{activeCycle.cycle_number}</h3>
            <p className="text-sm text-slate-400">
              Iniciado em: {new Date(activeCycle.start_date).toLocaleString('pt-BR')}
            </p>
            {activeCycle.draw_date && (
              <p className="text-xs text-cyan-400 mt-1">
                Data do Sorteio: {new Date(activeCycle.draw_date).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onEdit}
              variant="outline"
              className="border-cyan-600 text-cyan-400"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button
              onClick={onEnd}
              variant="destructive"
            >
              Encerrar Ciclo
            </Button>
            <Button
              onClick={onDelete}
              variant="outline"
              className="border-rose-600 text-rose-400 hover:bg-rose-900/20"
            >
              Excluir Ciclo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-indigo-900/30 border border-indigo-600/50 rounded-lg p-4 text-center">
            <Calendar className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Dias Ativos</p>
            <p className="text-lg font-bold text-cyan-400">
              {Math.floor((new Date() - new Date(activeCycle.start_date)) / (1000 * 60 * 60 * 24))}
            </p>
          </div>
          <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Total Aprovado</p>
            <p className="text-lg font-bold text-green-400">R$ {totalDeposits.toFixed(2)}</p>
          </div>
          <div className="bg-orange-900/30 border border-orange-600/50 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Pendente</p>
            <p className="text-lg font-bold text-orange-400">R$ {totalPending.toFixed(2)}</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-4 text-center">
            <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Participantes</p>
            <p className="text-lg font-bold text-purple-400">{userStats.length}</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 text-center">
            <Ticket className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Total Bilhetes</p>
            <p className="text-lg font-bold text-yellow-400">{totalTickets}</p>
          </div>
        </div>
      </Card>

      {/* Top 3 Atual */}
      <Card className="bg-slate-800/50 border-slate-700 p-6 mb-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Top 3 Atual (Liderança)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((index) => {
            const user = top3[index];
            const medals = ['', '', ''];
            const colors = [
              'bg-yellow-900/30 border-yellow-600/50',
              'bg-gray-700/30 border-gray-500/50',
              'bg-orange-900/30 border-orange-600/50'
            ];
            const prizes = ['Prêmio de R$ 500', 'Prêmio de R$ 300', 'Prêmio de R$ 200'];
            
            return (
              <div key={index} className={`${colors[index]} border rounded-lg p-4`}>
                <div className="text-center mb-3">
                  <div className="text-3xl mb-1">{medals[index]}</div>
                  <p className="text-xs font-bold text-white">{prizes[index]}</p>
                </div>
                {user ? (
                  <>
                    <p className="text-sm font-bold text-white truncate mb-1">{user.user_name}</p>
                    <p className="text-xs text-slate-400 truncate mb-2">{user.user_email}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Total:</span>
                        <span className="text-green-400 font-bold">R$ {user.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Depósitos:</span>
                        <span className="text-white">{user.deposits_count}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Bilhetes:</span>
                        <span className="text-yellow-400">{user.tickets_count}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center">Aguardando...</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ranking Completo */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          Ranking Completo ({userStats.length} participantes)
        </h4>
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">ID Plataforma</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Depósitos</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Bilhetes</th>
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Nenhum depósito aprovado ainda neste ciclo
                    </td>
                  </tr>
                ) : (
                  userStats.map((user, index) => (
                    <tr 
                      key={user.user_id} 
                      className={`border-t border-slate-800 hover:bg-slate-800/30 ${
                        index < 3 ? 'bg-indigo-900/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-gray-400' :
                          index === 2 ? 'text-orange-400' :
                          'text-slate-500'
                        }`}>
                          {index + 1}º
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-white">{user.user_name}</div>
                          <div className="text-xs text-slate-400">{user.user_email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {user.platform_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-green-400">
                        R$ {user.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-white">
                        {user.deposits_count}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-yellow-400">
                        {user.tickets_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}

// Componente auxiliar para exibir ciclo encerrado
function EndedCycleCard({ cycle, onEdit, onViewTotals, onRegisterRaffle, onReactivate, onDelete }) {
  const top1 = cycle?.top_participants?.[0];
  const top2 = cycle?.top_participants?.[1];
  const top3 = cycle?.top_participants?.[2];

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Badge className="bg-slate-600 mb-2">ENCERRADO</Badge>
          <h3 className="text-xl font-bold text-white">Ciclo #{cycle.cycle_number}</h3>
          <p className="text-sm text-slate-400">
            {new Date(cycle.start_date).toLocaleDateString('pt-BR')} - {new Date(cycle.end_date).toLocaleDateString('pt-BR')}
          </p>
          {cycle.draw_date && (
            <p className="text-xs text-cyan-400 mt-1">
              Data do Sorteio: {new Date(cycle.draw_date).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => onViewTotals(cycle)}
            variant="outline"
            className="border-blue-600 text-blue-400"
          >
            <Users className="w-4 h-4 mr-2" />
            Ver Totais
          </Button>
          <Button
            onClick={() => onEdit(cycle)}
            variant="outline"
            className="border-cyan-600 text-cyan-400"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {!cycle.raffle_completed && (
            <Button
              onClick={() => onRegisterRaffle(cycle)}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Registrar Sorteio
            </Button>
          )}
          {cycle.raffle_completed && (
            <Badge className="bg-green-600">SORTEIO REALIZADO</Badge>
          )}
          <Button
            onClick={() => onReactivate(cycle)}
            variant="outline"
            className="border-green-600 text-green-400"
          >
            <Award className="w-4 h-4 mr-2" />
            Reativar
          </Button>
          <Button
            onClick={() => onDelete(cycle)}
            variant="outline"
            className="border-rose-600 text-rose-400 hover:bg-rose-900/20"
          >
            Excluir Ciclo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4">
          <p className="text-xs text-yellow-300 mb-1"> 1º Lugar</p>
          <p className="font-bold text-white text-sm">{top1?.user_name || '-'}</p>
          <p className="text-xs text-yellow-400">R$ {top1?.total?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-gray-700/30 border border-gray-500/50 rounded-lg p-4">
          <p className="text-xs text-gray-300 mb-1"> 2º Lugar</p>
          <p className="font-bold text-white text-sm">{top2?.user_name || '-'}</p>
          <p className="text-xs text-gray-400">R$ {top2?.total?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-orange-900/30 border border-orange-600/50 rounded-lg p-4">
          <p className="text-xs text-orange-300 mb-1"> 3º Lugar</p>
          <p className="font-bold text-white text-sm">{top3?.user_name || '-'}</p>
          <p className="text-xs text-orange-400">R$ {top3?.total?.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      {cycle.raffle_completed && cycle.raffle_winners?.length > 0 && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
          <p className="text-sm font-bold text-green-300 mb-2">️ Sorteio dos R$ 200 (5 ganhadores):</p>
          <div className="space-y-2">
            {cycle.raffle_winners.map((winner, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-800/50 rounded p-2">
                <span className="text-sm text-white">{winner.user_name} ({winner.user_nick})</span>
                <Badge className="bg-green-600">#{winner.ticket_number}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DepositCyclesTab() {
  const queryClient = useQueryClient();
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showWinners, setShowWinners] = useState(null);
  const [editingCycle, setEditingCycle] = useState(null);
  const [editEndDate, setEditEndDate] = useState("");
  const [editDrawDate, setEditDrawDate] = useState("");
  const [viewingCycleTotals, setViewingCycleTotals] = useState(null);

  const { data: cyclesSummaryResponse } = useQuery({
    queryKey: ['deposit-cycles'],
    queryFn: () => base44.adminEvents.depositCycles.summary(),
  });
  const cycles = cyclesSummaryResponse?.items || [];

  const { data: viewingCycleTotalsResponse } = useQuery({
    queryKey: ['cycle-deposits', viewingCycleTotals?.id],
    queryFn: () => base44.adminEvents.depositCycles.totals(viewingCycleTotals.id),
    enabled: !!viewingCycleTotals,
  });

  const { data: activeCycleTotalsResponse } = useQuery({
    queryKey: ['active-cycle-totals', cycles.find(c => c.active)?.id],
    queryFn: () => base44.adminEvents.depositCycles.totals(cycles.find(c => c.active).id),
    enabled: Boolean(cycles.find(c => c.active)?.id),
  });

  const activeCycle = cycles.find(c => c.active);
  const endedCycles = cycles.filter(c => !c.active);
  const cycleTotals = viewingCycleTotalsResponse?.totals || [];
  const activeCycleTotals = activeCycleTotalsResponse?.totals || [];

  const [newCycleDrawDate, setNewCycleDrawDate] = useState("");

  const createCycleMutation = useMutation({
    mutationFn: async () => base44.adminEvents.depositCycles.create({ drawDate: newCycleDrawDate || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
      setShowNewCycle(false);
      setNewCycleDrawDate("");
    },
  });

  const endCycleMutation = useMutation({
    mutationFn: async (cycleId) => base44.adminEvents.depositCycles.end(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
    },
  });

  const completeRaffleMutation = useMutation({
    mutationFn: async ({ cycleId, winners }) => {
      await base44.adminEvents.depositDraws.complete(cycleId, { winners });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
      setShowWinners(null);
    },
  });

  const updateCycleMutation = useMutation({
    mutationFn: async ({ cycleId, data }) => {
      await base44.adminEvents.depositCycles.update(cycleId, {
        drawDate: data.draw_date,
        endDate: data.end_date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
      setEditingCycle(null);
    },
  });

  const reactivateCycleMutation = useMutation({
    mutationFn: async (cycleId) => base44.adminEvents.depositCycles.reactivate(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
      alert('✅ Ciclo reativado com sucesso!');
    },
  });

  const deleteCycleMutation = useMutation({
    mutationFn: async (cycleId) => base44.adminEvents.depositCycles.delete(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-deposits'] });
      alert('✅ Ciclo excluído com sucesso!');
    },
    onError: (error) => {
      alert(`Erro ao excluir ciclo: ${error?.message || 'falha inesperada'}`);
    },
  });

  const [raffleWinners, setRaffleWinners] = useState([
    { user_id: '', user_name: '', user_nick: '', ticket_number: '' },
    { user_id: '', user_name: '', user_nick: '', ticket_number: '' },
    { user_id: '', user_name: '', user_nick: '', ticket_number: '' },
    { user_id: '', user_name: '', user_nick: '', ticket_number: '' },
    { user_id: '', user_name: '', user_nick: '', ticket_number: '' },
  ]);

  const updateWinner = (index, field, value) => {
    const updated = [...raffleWinners];
    updated[index][field] = value;
    setRaffleWinners(updated);
  };

  const getUserTotalsForCycle = () => {
    return cycleTotals.map((entry) => ({
      id: entry.user_id,
      name: entry.user_name,
      email: entry.user_email,
      platform_id: entry.platform_id,
      total: entry.total,
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-cyan-400" />
              Gerenciar Ciclos de Sorteio
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Controle os ciclos de depósitos e sorteios dos depositantes
            </p>
          </div>
          <Button
            onClick={() => setShowNewCycle(true)}
            disabled={!!activeCycle}
            className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Ciclo
          </Button>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
            <TabsTrigger value="active" className="data-[state=active]:bg-indigo-600">
              Ciclo Ativo
            </TabsTrigger>
            <TabsTrigger value="ended" className="data-[state=active]:bg-slate-700">
              Ciclos Encerrados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeCycle ? (
              <ActiveCycleDetails 
                activeCycle={activeCycle}
                totals={activeCycleTotals}
                onEdit={() => {
                  setEditingCycle(activeCycle);
                  setEditDrawDate(activeCycle.draw_date ? new Date(activeCycle.draw_date).toISOString().slice(0, 16) : "");
                  setEditEndDate("");
                }}
                onEnd={() => {
                  if (confirm('Tem certeza que deseja ENCERRAR este ciclo? OOs top 3 serão calculados automaticamente.')) {
                    endCycleMutation.mutate(activeCycle.id);
                  }
                }}
                onDelete={() => {
                  if (
                    confirm(
                      `Tem certeza que deseja EXCLUIR o Ciclo #${activeCycle.cycle_number}? Esta ação não pode ser desfeita.`
                    )
                  ) {
                    deleteCycleMutation.mutate(activeCycle.id);
                  }
                }}
              />
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">Nenhum ciclo ativo no momento</p>
                <Button onClick={() => setShowNewCycle(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Novo Ciclo
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ended" className="mt-6">
            <div className="space-y-4">
              {endedCycles.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhum ciclo encerrado ainda</p>
                </div>
              ) : (
                endedCycles.map((cycle) => (
                  <EndedCycleCard 
                    key={cycle.id} 
                    cycle={cycle} 
                    onEdit={(c) => {
                      setEditingCycle(c);
                      setEditEndDate(c.end_date ? new Date(c.end_date).toISOString().slice(0, 16) : "");
                      setEditDrawDate(c.draw_date ? new Date(c.draw_date).toISOString().slice(0, 16) : "");
                    }} 
                    onViewTotals={setViewingCycleTotals} 
                    onRegisterRaffle={setShowWinners}
                    onReactivate={(c) => {
                      if (confirm(`Tem certeza que deseja REATIVAR o Ciclo #${c.cycle_number}? Qualquer ciclo ativo será encerrado.`)) {
                        reactivateCycleMutation.mutate(c.id);
                      }
                    }}
                    onDelete={(c) => {
                      if (
                        confirm(
                          `Tem certeza que deseja EXCLUIR o Ciclo #${c.cycle_number}? Esta ação não pode ser desfeita.`
                        )
                      ) {
                        deleteCycleMutation.mutate(c.id);
                      }
                    }}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Dialog Novo Ciclo */}
      <Dialog open={showNewCycle} onOpenChange={setShowNewCycle}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Criar Novo Ciclo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">
              Tem certeza que deseja iniciar um novo ciclo de sorteio dos depositantes?
            </p>
            <p className="text-sm text-slate-400">
              Um novo ciclo #{cycles.length + 1} será criado e começará a contar depósitos imediatamente.
            </p>
            <div className="space-y-2">
              <Label htmlFor="draw-date" className="text-slate-300">Data do Sorteio (OOpcional)</Label>
              <Input
                id="draw-date"
                type="datetime-local"
                value={newCycleDrawDate}
                onChange={(e) => setNewCycleDrawDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400">
                Esta data será usada para o countdown no painel do usuário
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createCycleMutation.mutate()} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                Confirmar Criação
              </Button>
              <Button onClick={() => setShowNewCycle(false)} variant="outline" className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Ciclo */}
      <Dialog open={!!editingCycle} onOpenChange={() => setEditingCycle(null)}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Editar Ciclo #{editingCycle?.cycle_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-draw-date" className="text-slate-300">Data do Sorteio</Label>
              <Input
                id="edit-draw-date"
                type="datetime-local"
                value={editDrawDate}
                onChange={(e) => setEditDrawDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400">
                Data usada para o countdown no painel do usuário
              </p>
            </div>

            {!editingCycle?.active && (
              <div className="space-y-2">
                <Label htmlFor="edit-end-date" className="text-slate-300">Data de Encerramento</Label>
                <Input
                  id="edit-end-date"
                  type="datetime-local"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">
                  Data em que o ciclo foi encerrado
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const updateData = {};
                  if (editDrawDate) updateData.draw_date = new Date(editDrawDate).toISOString();
                  if (editEndDate && !editingCycle?.active) updateData.end_date = new Date(editEndDate).toISOString();
                  
                  updateCycleMutation.mutate({
                    cycleId: editingCycle.id,
                    data: updateData
                  });
                }}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
              >
                Salvar Alterações
              </Button>
              <Button onClick={() => setEditingCycle(null)} variant="outline" className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Registrar Sorteio */}
      <Dialog open={!!showWinners} onOpenChange={() => setShowWinners(null)}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Registrar Ganhadores do Sorteio - Ciclo #{showWinners?.cycle_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">Informe os 5 ganhadores dos R$ 200:</p>
            {raffleWinners.map((winner, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-700 p-4">
                <p className="text-sm font-bold text-cyan-400 mb-2">Ganhador {i + 1}</p>
                <div className="space-y-2">
                  <Input
                    placeholder="ID do Usuário"
                    value={winner.user_id}
                    onChange={(e) => updateWinner(i, 'user_id', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    placeholder="Nome do Usuário"
                    value={winner.user_name}
                    onChange={(e) => updateWinner(i, 'user_name', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    placeholder="Nick do Usuário"
                    value={winner.user_nick}
                    onChange={(e) => updateWinner(i, 'user_nick', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    placeholder="Número do Bilhete"
                    value={winner.ticket_number}
                    onChange={(e) => updateWinner(i, 'ticket_number', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (raffleWinners.every(w => w.user_name && w.ticket_number)) {
                    completeRaffleMutation.mutate({
                      cycleId: showWinners.id,
                      winners: raffleWinners
                    });
                  } else {
                    alert('Preencha todos os campos obrigatórios');
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Salvar Ganhadores
              </Button>
              <Button onClick={() => setShowWinners(null)} variant="outline" className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Ver Totais por Usuário */}
      <Dialog open={!!viewingCycleTotals} onOpenChange={() => setViewingCycleTotals(null)}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Totais por Usuário - Ciclo #{viewingCycleTotals?.cycle_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="rounded-lg border border-slate-700 overflow-hidden mt-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">ID Plataforma</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Total Aprovado</th>
                  </tr>
                </thead>
                <tbody>
                  {getUserTotalsForCycle().length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-slate-400">
                        Nenhum depósito aprovado neste ciclo.
                      </td>
                    </tr>
                  ) : (
                    getUserTotalsForCycle().map((user) => (
                      <tr key={user.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-white">{user.name}</div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {user.platform_id || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-400">
                          R$ {user.total.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {getUserTotalsForCycle().length > 0 && (
              <div className="bg-slate-900/50 px-4 py-3 border-t border-slate-700">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-300">Total Geral do Ciclo:</span>
                  <span className="text-green-400">
                    R$ {getUserTotalsForCycle().reduce((sum, u) => sum + u.total, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
