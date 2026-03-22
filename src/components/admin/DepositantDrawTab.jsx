import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Gift, Sparkles, Check, X, Ticket, Coins, Crown, Dices, Gem, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const CASINO_ICONS = [
  { Icon: Coins, color: "text-yellow-400" },
  { Icon: Trophy, color: "text-orange-400" },
  { Icon: Crown, color: "text-yellow-300" },
  { Icon: Dices, color: "text-pink-400" },
  { Icon: Gem, color: "text-purple-400" },
  { Icon: Sparkles, color: "text-cyan-400" }
];

export default function DepositantDrawTab() {
  const queryClient = useQueryClient();
  const [isDrawing, setIsDrawing] = useState(false);
  const [animatingParticipants, setAnimatingParticipants] = useState([]);
  const [drawnTicketNumber, setDrawnTicketNumber] = useState(null);
  const [drawnWinner, setDrawnWinner] = useState(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [particles, setParticles] = useState([]);
  const [floatingIcons, setFloatingIcons] = useState([]);

  // Buscar TODOS os ciclos que precisam ter o sorteio dos bilhetes realizado
  const { data: pendingRaffleCycles = [] } = useQuery({
    queryKey: ['pending-raffle-cycles'],
    queryFn: async () => {
      // Buscar TODOS os ciclos que ainda nao tiveram o sorteio dos bilhetes concluido
      const allCycles = await base44.entities.DepositantDrawCycle.list('-cycle_number');
      return allCycles.filter(c => !c.raffle_completed);
    },
  });

  // Ciclo selecionado para sorteio
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  
  useEffect(() => {
    // Selecionar automaticamente o primeiro ciclo pendente
    if (pendingRaffleCycles.length > 0 && !selectedCycleId) {
      setSelectedCycleId(pendingRaffleCycles[0].id);
    }
  }, [pendingRaffleCycles, selectedCycleId]);

  const lastEndedCycle = pendingRaffleCycles.find(c => c.id === selectedCycleId) || null;

  const { data: deposits = [] } = useQuery({
    queryKey: ['cycle-deposits-depositant', lastEndedCycle?.id],
    queryFn: () => base44.entities.Deposit.filter({ 
      cycle_id: lastEndedCycle.id,
      status: 'approved' 
    }, '-created_date'),
    enabled: !!lastEndedCycle,
  });

  const { data: winners = [] } = useQuery({
    queryKey: ['depositant-winners'],
    queryFn: () => base44.entities.DepositantDrawWinner.list('-created_date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['depositant-draw-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const depositantDrawActive = settings.find(s => s.key === 'depositant_draw_active')?.value === 'true';

  // Gerar particulas e icones flutuantes
  useEffect(() => {
    const newParticles = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);

    const icons = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      ...CASINO_ICONS[i % CASINO_ICONS.length],
      x: (i * 6.5) + Math.random() * 6,
      y: Math.random() * 90 + 5,
      size: Math.random() * 12 + 20,
      rotation: Math.random() * 360,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 2
    }));
    setFloatingIcons(icons);
  }, []);

  // Calcular participantes usando os bilhetes ja gerados
  const calculateParticipants = () => {
    const userMap = {};
    
    deposits.forEach(deposit => {
      const amount = parseFloat(deposit.amount) || 0;
      const ticketsCount = deposit.ticket_numbers?.length || 0;
      
      if (!userMap[deposit.user_id]) {
        userMap[deposit.user_id] = {
          user_id: deposit.user_id,
          user_name: deposit.user_name,
          user_email: deposit.user_email,
          user_nick: deposit.user_name,
          user_avatar: "",
          user_platform_id: deposit.user_platform_id || "",
          total_deposited: 0,
          tickets_count: 0
        };
      }
      
      userMap[deposit.user_id].total_deposited += amount;
      // Usar os bilhetes ja gerados no deposito
      userMap[deposit.user_id].tickets_count += ticketsCount;
    });

    // Retornar apenas usuarios com pelo menos 1 bilhete
    return Object.values(userMap).filter(u => u.tickets_count > 0);
  };

  const participants = calculateParticipants();
  const totalTickets = participants.reduce((sum, p) => sum + p.tickets_count, 0);

  // Filtrar ganhadores apenas do ultimo ciclo encerrado
  const cycleWinners = lastEndedCycle ? winners.filter(w => w.cycle_id === lastEndedCycle.id) : [];
  const pendingWinners = cycleWinners.filter(w => !w.validated);
  const validatedWinners = cycleWinners.filter(w => w.validated);

  const registerWinnerMutation = useMutation({
    mutationFn: async ({ prizeAmount, drawCount }) =>
      base44.adminEvents.depositDraws.draw(lastEndedCycle.id, {
        prizeAmount,
        winnerCount: drawCount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositant-winners'] });
    }
  });

  const validateWinnerMutation = useMutation({
    mutationFn: async (winner) => base44.adminEvents.depositDraws.validateWinner(winner.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositant-winners'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      alert("Ganhador validado e registrado na auditoria!");
    }
  });

  const deleteWinnerMutation = useMutation({
    mutationFn: (winnerId) => base44.adminEvents.depositDraws.deleteWinner(winnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositant-winners'] });
    }
  });

  const clearAllTicketsMutation = useMutation({
    mutationFn: async () => base44.adminEvents.depositDraws.resetTickets(lastEndedCycle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-approved-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] }); // Invalidate general deposits if any component uses it
      alert("Todos os bilhetes foram zerados com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao zerar bilhetes:", error);
      alert("Ocorreu um erro ao zerar os bilhetes. Tente novamente.");
    }
  });

  const maskPlatformId = (platformId) => {
    if (!platformId) return "****";
    const cleaned = platformId.toString();
    if (cleaned.length <= 4) return "****";
    const lastFour = cleaned.slice(-4);
    return `****${lastFour}`;
  };

  const handleDraw = async (prizeAmount, drawCount = 1) => {
    if (totalTickets === 0) {
      alert("Não há bilhetes para sortear!");
      return;
    }

    if (!prizeAmount || parseFloat(prizeAmount) <= 0) {
      alert("Digite um valor de prêmio válido!");
      return;
    }

    const count = parseInt(drawCount) || 1;
    if (count < 1 || count > totalTickets) {
      alert(`Digite uma quantidade valida entre 1 e ${totalTickets}!`);
      return;
    }

    setIsDrawing(true);
    setShowAnimation(true);
    setAnimatingParticipants([]);
    setDrawnTicketNumber(null);
    setDrawnWinner(null);

    let drawnWinners = [];
    try {
      const response = await registerWinnerMutation.mutateAsync({
        prizeAmount: parseFloat(prizeAmount),
        drawCount: count,
      });
      drawnWinners = response?.winners || [];
    } catch (error) {
      setIsDrawing(false);
      setShowAnimation(false);
      alert(error?.message || "Erro ao sortear bilhetes.");
      return;
    }

    const animationDuration = 10000;
    const interval = 100;
    let elapsed = 0;

    const animationInterval = setInterval(() => {
      const randomParticipant = participants[Math.floor(Math.random() * participants.length)];
      setAnimatingParticipants([randomParticipant]);
      elapsed += interval;

      if (elapsed >= animationDuration) {
        clearInterval(animationInterval);
        
        setAnimatingParticipants([]);
        setIsDrawing(false);

        if (count === 1) {
          setDrawnTicketNumber(drawnWinners[0]?.ticket_numbers?.[0] || null);
          setDrawnWinner(drawnWinners[0] || null);
        } else {
          alert(`${count} bilhetes sorteados!\n\nConfira na aba "Controle".`);
          setShowAnimation(false);
        }

        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.6 }
        });

        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
          });
        }, 300);
      }
    }, interval);
  };

  const handleValidate = (winner) => {
    validateWinnerMutation.mutate(winner);
  };

  const handleDelete = (winnerId) => {
    if (confirm("Tem certeza que deseja remover este ganhador?")) {
      deleteWinnerMutation.mutate(winnerId);
    }
  };

  const handleClearAllTickets = () => {
    if (confirm("ATENÇÃO! Esta ação vai ZERAR TODOS OS BILHETES de TODOS os usuários!\n\nIsso permitirá começar um novo ciclo de sorteio.\n\nDeseja continuar?")) {
      clearAllTicketsMutation.mutate();
    }
  };

  const handleFinishDraw = () => {
    setShowAnimation(false);
    setDrawnTicketNumber(null);
    setDrawnWinner(null);
  };

  const completeRaffleMutation = useMutation({
    mutationFn: async () => {
      if (!lastEndedCycle) return;
      await base44.adminEvents.depositDraws.complete(lastEndedCycle.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['last-ended-cycle-depositant-draw'] });
      queryClient.invalidateQueries({ queryKey: ['all-ended-cycles'] });
      alert("Sorteio marcado como concluido! Agora os ganhadores aparecerao para o público.");
    }
  });

  const particleSpeed = isDrawing ? 0.3 : 1.5;

  if (!depositantDrawActive) {
    return (
      <div className="mt-6">
        <Card className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border-orange-700/50 p-6">
          <p className="text-center text-orange-200">
            Sorteio dos Depositantes esta desativado nas configuracoes.
          </p>
        </Card>
      </div>
    );
  }

  if (pendingRaffleCycles.length === 0) {
    return (
      <div className="mt-6">
        <Card className="bg-gradient-to-br from-orange-900/50 to-yellow-900/50 border-orange-700/50 p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-orange-300 mb-2">Nenhum Ciclo Disponivel</h3>
            <p className="text-orange-200">
              Todos os ciclos já tiveram seus sorteios de bilhetes realizados ou não há ciclos criados ainda.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!lastEndedCycle) {
    return null;
  }

  return (
    <div className="mt-6">
      {/* Seletor de Ciclos Pendentes */}
      {pendingRaffleCycles.length > 1 && (
        <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-4 mb-4">
          <h3 className="text-lg font-bold text-purple-300 mb-3"> Ciclos Pendentes de Sorteio:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {pendingRaffleCycles.map((cycle) => (
              <button
                key={cycle.id}
                onClick={() => setSelectedCycleId(cycle.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedCycleId === cycle.id
                    ? 'bg-purple-700 border-purple-400 shadow-lg scale-105'
                    : 'bg-purple-900/50 border-purple-700/50 hover:bg-purple-800/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-200">#{cycle.cycle_number}</div>
                  <div className="text-xs text-purple-300 mt-1">
                    {cycle.active ? ' Ativo' : 'Encerrado'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

    <Tabs defaultValue="control">
      <TabsList className="grid w-full grid-cols-2 bg-orange-900/50">
        <TabsTrigger value="control">Controle</TabsTrigger>
        <TabsTrigger value="display">Tela do Sorteio</TabsTrigger>
      </TabsList>

      <TabsContent value="control">
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-orange-900/50 to-yellow-900/50 border-orange-700/50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                  Estatisticas do Sorteio
                </h2>
                <p className="text-sm text-orange-300 mt-1">
                  Ciclo #{lastEndedCycle.cycle_number} • {new Date(lastEndedCycle.start_date).toLocaleDateString('pt-BR')} - {lastEndedCycle.end_date ? new Date(lastEndedCycle.end_date).toLocaleDateString('pt-BR') : 'Em andamento'}
                </p>
                <div className="flex gap-2 mt-2">
                  {lastEndedCycle.active ? (
                    <Badge className="bg-blue-600">CICLO ATIVO</Badge>
                  ) : (
                    <Badge className="bg-gray-600">CICLO ENCERRADO</Badge>
                  )}
                  {lastEndedCycle.raffle_completed ? (
                    <Badge className="bg-green-600">SORTEIO CONCLUIDO</Badge>
                  ) : (
                    <Badge className="bg-yellow-600">AGUARDANDO SORTEIO DOS BILHETES</Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={handleClearAllTickets}
                variant="outline"
                className="border-red-600 text-red-400 hover:bg-red-900/30"
                disabled={clearAllTicketsMutation.isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {clearAllTicketsMutation.isLoading ? "Zerando..." : "Zerar Todos os Bilhetes"}
              </Button>
            </div>

            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-300">Atencao ao Zerar Bilhetes:</p>
                  <p className="text-xs text-red-200 mt-1">
                    Esta ação remove TODOS os bilhetes de TODOS os usuários. Use apenas para iniciar um novo ciclo de sorteio mensal.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-center">
                <div className="text-3xl font-bold text-yellow-300">{participants.length}</div>
                <div className="text-xs text-yellow-200 mt-1">Participantes</div>
              </div>
              <div className="p-4 bg-orange-900/30 border border-orange-700/50 rounded-lg text-center">
                <div className="text-3xl font-bold text-orange-300">{totalTickets}</div>
                <div className="text-xs text-orange-200 mt-1">Bilhetes Totais</div>
              </div>
              <div className="p-4 bg-green-900/30 border border-green-700/50 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-300">{validatedWinners.length}</div>
                <div className="text-xs text-green-200 mt-1">Validados</div>
              </div>
              <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-300">{pendingWinners.length}</div>
                <div className="text-xs text-blue-200 mt-1">Pendentes</div>
              </div>
            </div>

            {lastEndedCycle && !lastEndedCycle.raffle_completed && validatedWinners.length > 0 && (
              <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-600/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-green-300 mb-1">
                      Sorteio dos Bilhetes Concluido
                    </p>
                    <p className="text-sm text-green-200">
                      Clique em "Encerrar Sorteio" para finalizar e exibir os ganhadores para o público
                    </p>
                  </div>
                  <Button
                    onClick={() => completeRaffleMutation.mutate()}
                    disabled={completeRaffleMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {completeRaffleMutation.isPending ? "Encerrando..." : "Encerrar Sorteio"}
                  </Button>
                </div>
              </div>
            )}

            {lastEndedCycle && lastEndedCycle.raffle_completed && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border-2 border-blue-600/50 rounded-lg">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-300">
                    Sorteio Finalizado - Ganhadores Visiveis ao Publico
                  </p>
                  <p className="text-sm text-blue-200 mt-1">
                    Ciclo #{lastEndedCycle.cycle_number} encerrado completamente
                  </p>
                </div>
              </div>
            )}
          </Card>

          {pendingWinners.length > 0 && (
            <Card className="bg-gradient-to-br from-yellow-900/50 to-orange-900/50 border-yellow-700/50 p-6">
              <h3 className="text-xl font-bold text-yellow-300 mb-4">
                 Ganhadores Pendentes ({pendingWinners.length})
              </h3>
              <p className="text-sm text-yellow-200 mb-4">Valide ou remova os ganhadores:</p>
              <div className="space-y-3">
                {pendingWinners.map((winner) => (
                  <div key={winner.id} className="flex items-center justify-between p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{winner.user_avatar || ""}</div>
                      <div>
                        <div className="font-bold text-yellow-200">{winner.user_name}</div>
                        <div className="text-sm text-yellow-300">@{winner.user_nick} • ID: {maskPlatformId(winner.user_platform_id)}</div>
                        <div className="text-xs text-yellow-400">
                          R$ {winner.total_deposited?.toFixed(2)} depositado
                        </div>
                        <div className="text-sm font-bold text-green-400 mt-1">
                          Premio: R$ {winner.prize_amount?.toFixed(2)}
                        </div>
                        <div className="text-xs text-yellow-500">
                          {format(new Date(winner.draw_date), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleValidate(winner)}
                        disabled={validateWinnerMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {validateWinnerMutation.isPending ? "Validando..." : "Validar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(winner.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {validatedWinners.length > 0 && (
            <Card className="bg-gradient-to-br from-green-900/50 to-teal-900/50 border-green-700/50 p-6">
              <h3 className="text-xl font-bold text-green-300 mb-4">
                Ganhadores Validados ({validatedWinners.length})
              </h3>
              <div className="space-y-3">
                {validatedWinners.map((winner) => (
                  <div key={winner.id} className="flex items-center justify-between p-4 bg-green-900/30 border border-green-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{winner.user_avatar || ""}</div>
                      <div>
                        <div className="font-bold text-green-200">{winner.user_name}</div>
                        <div className="text-sm text-green-300">@{winner.user_nick} • ID: {maskPlatformId(winner.user_platform_id)}</div>
                        <div className="text-xs text-green-400">
                          R$ {winner.total_deposited?.toFixed(2)} depositado
                        </div>
                        <div className="text-sm font-bold text-yellow-400 mt-1">
                          Premio: R$ {winner.prize_amount?.toFixed(2)}
                        </div>
                        <div className="text-xs text-green-500">
                          Sorteado: {format(new Date(winner.draw_date), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                        {winner.validated_date && (
                          <div className="text-xs text-green-500">
                            Validado: {format(new Date(winner.validated_date), 'dd/MM/yyyy HH:mm:ss')}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(winner.id)}
                      className="border-red-600 text-red-400"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 p-6">
            <h3 className="text-xl font-bold text-purple-300 mb-4">
               Participantes ({participants.length})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {participants.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{p.user_avatar}</div>
                    <div>
                      <div className="font-medium text-purple-100">{p.user_name}</div>
                      <div className="text-xs text-purple-300">ID: {maskPlatformId(p.user_platform_id)}</div>
                      <div className="text-xs text-purple-400">
                        R$ {p.total_deposited.toFixed(2)} depositado
                      </div>
                    </div>
                    </div>
                    <Badge className="bg-orange-600">
                    {p.tickets_count} bilhetes
                    </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="display">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 mt-6">
          <Card className="h-[600px] bg-gradient-to-br from-orange-950 to-yellow-950 rounded-2xl border-4 border-yellow-500/50 shadow-2xl overflow-hidden relative">
            {/* Animated Tech Background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 via-yellow-600/10 to-orange-600/10 animate-pulse" />
              
              {/* Grid Pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(251, 146, 60, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251, 146, 60, 0.3) 1px, transparent 1px)',
                  backgroundSize: '50px 50px'
                }} />
              </div>

              {/* Floating Particles */}
              {particles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute rounded-full bg-gradient-to-br from-yellow-400/40 to-orange-500/40"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                  }}
                  animate={{
                    y: [0, -60, 0],
                    x: [0, Math.random() * 40 - 20, 0],
                    opacity: [0.2, 0.8, 0.2],
                    scale: [1, 1.5, 1],
                  }}
                  transition={{
                    duration: particle.duration * particleSpeed,
                    delay: particle.delay,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}

              {/* Floating Casino Icons */}
              {floatingIcons.map((icon) => {
                const IconComponent = icon.Icon;
                return (
                  <motion.div
                    key={icon.id}
                    className={`absolute ${icon.color} opacity-20`}
                    style={{
                      left: `${icon.x}%`,
                      top: `${icon.y}%`,
                    }}
                    animate={{
                      y: [0, -40, 0],
                      x: [0, Math.random() * 30 - 15, 0],
                      rotate: [icon.rotation, icon.rotation + 360],
                      opacity: [0.1, 0.3, 0.1],
                      scale: [0.8, 1.3, 0.8],
                    }}
                    transition={{
                      duration: icon.duration * particleSpeed,
                      delay: icon.delay,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <IconComponent size={icon.size} strokeWidth={2} />
                  </motion.div>
                );
              })}

              {/* Scanning Lines */}
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
                animate={{
                  top: ['0%', '100%'],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: isDrawing ? 1 : 4,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent"
                animate={{
                  top: ['100%', '0%'],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: isDrawing ? 1 : 4,
                  repeat: Infinity,
                  ease: "linear",
                  delay: isDrawing ? 0.5 : 2
                }}
              />
              
              <motion.div
                className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-yellow-400 to-transparent"
                animate={{
                  left: ['0%', '100%'],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: isDrawing ? 1.5 : 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </div>
            
            {!showAnimation ? (
              <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mb-6"
                >
                  <Trophy className="w-20 h-20 text-yellow-400" />
                </motion.div>
                
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 mb-2 text-center">
                  Sorteio dos Depositantes
                </h2>
                <p className="text-base text-orange-400 mb-1 text-center">Ciclo #{lastEndedCycle.cycle_number}</p>
                <p className="text-lg text-orange-300 mb-6">{participants.length} Participantes • {totalTickets} Bilhetes</p>
                
                <div className="mb-5 px-5 py-3 bg-orange-900/50 rounded-lg border border-orange-600/50 space-y-3">
                  <div>
                    <Label className="text-orange-200 block mb-1 text-center text-sm">Valor do Premio (R$)</Label>
                    <Input
                      id="prizeAmount"
                      type="number"
                      placeholder="Ex: 200.00"
                      step="0.01"
                      min="0"
                      className="w-40 bg-orange-900/50 border-orange-700 text-white text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-orange-200 block mb-1 text-center text-sm">Quantidade de Bilhetes</Label>
                    <Input
                      id="drawCount"
                      type="number"
                      placeholder="1"
                      defaultValue="1"
                      min="1"
                      max={totalTickets}
                      className="w-40 bg-orange-900/50 border-orange-700 text-white text-center"
                    />
                    <p className="text-xs text-orange-300 text-center mt-1">Sortear multiplos de uma vez</p>
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    const prizeInput = document.getElementById('prizeAmount');
                    const countInput = document.getElementById('drawCount');
                    handleDraw(prizeInput.value, countInput.value);
                  }}
                  disabled={isDrawing || participants.length === 0}
                  className="px-8 py-5 text-lg font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl transform hover:scale-105 transition-all"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isDrawing ? "SORTEANDO..." : "INICIAR SORTEIO"}
                </Button>

                <div className="mt-5 p-2 bg-orange-900/50 rounded-lg border border-orange-600/50">
                  <p className="text-orange-200 text-center text-sm">
                     {totalTickets} bilhetes no sorteio
                  </p>
                </div>
              </div>
            ) : drawnWinner && drawnTicketNumber ? (
              <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce" />
                <h3 className="text-4xl font-bold text-yellow-300 mb-6"> GANHADOR! </h3>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-4 border-yellow-500 rounded-2xl p-8 text-center mb-6 max-w-2xl"
                >
                  <div className="text-6xl mb-4">{drawnWinner.user_avatar}</div>
                  <p className="text-3xl font-bold text-yellow-200 mb-2">{drawnWinner.user_name}</p>
                  <p className="text-xl text-yellow-300 mb-3">@{drawnWinner.user_nick}</p>
                  <p className="text-lg text-yellow-400 mb-4">ID: {maskPlatformId(drawnWinner.user_platform_id)}</p>
                  
                  <div className="p-4 bg-yellow-900/50 border-2 border-yellow-500 rounded-xl mb-4">
                    <p className="text-sm text-yellow-300 mb-2"> Bilhete Sorteado:</p>
                    <p className="text-5xl font-bold text-green-400">{drawnTicketNumber}</p>
                  </div>

                  <div className="text-sm text-yellow-300 mb-4">
                    <p>Total depositado: R$ {drawnWinner.total_deposited?.toFixed(2)}</p>
                    <p>Bilhetes: {drawnWinner.tickets_count}</p>
                  </div>
                </motion.div>

                <Button
                  onClick={handleFinishDraw}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg font-bold"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Concluir Sorteio
                </Button>
              </div>
            ) : (
              <div className="relative h-full flex items-center justify-center z-10">
                {/* Presente Sendo Agitado Durante Sorteio */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  animate={{
                    rotate: [-15, 15, -15, 15, -10, 10, -5, 5, 0],
                    scale: [1, 1.3, 0.9, 1.3, 0.9, 1.2, 1],
                    y: [0, -20, 20, -15, 15, -10, 10, 0]
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Gift className="w-40 h-40 text-yellow-400/40 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
                </motion.div>

                <AnimatePresence mode="wait">
                  {animatingParticipants.map((p) => (
                    <motion.div
                      key={p.user_id}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.1 }}
                      className="text-center relative z-20"
                    >
                      <motion.div 
                        className="text-8xl mb-4"
                        animate={{
                          rotate: [0, 10, -10, 0],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{
                          duration: 0.3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {p.user_avatar}
                      </motion.div>
                      <p className="text-4xl font-bold text-white">{p.user_name}</p>
                      <p className="text-2xl text-orange-300 mt-2">@{p.user_nick}</p>
                      <p className="text-xl text-orange-400 mt-2">ID: {maskPlatformId(p.user_platform_id)}</p>
                      <p className="text-lg text-yellow-400 mt-2">{p.tickets_count} bilhetes</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>

          <Card className="h-[600px] bg-orange-900/90 backdrop-blur-lg rounded-xl border-2 border-orange-600/50 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 text-center flex-shrink-0">
              <p className="text-white font-bold">Participantes</p>
              <p className="text-xs text-yellow-100">{participants.length}</p>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{
                  duration: isDrawing ? Math.max(participants.length * 0.3, 3) : Math.max(participants.length * 1.5, 30),
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="space-y-2 p-2"
              >
                {[...participants, ...participants].map((p, i) => (
                  <motion.div
                    key={`${p.user_id}-${i}`}
                    className="bg-orange-800/50 rounded-lg p-2 border border-orange-600/50"
                    animate={isDrawing ? {
                      scale: [1, 1.05, 1]
                    } : {}}
                    transition={isDrawing ? {
                      duration: 0.3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div 
                        className="text-2xl"
                        animate={isDrawing ? {
                          rotate: [0, 10, -10, 0]
                        } : {}}
                        transition={isDrawing ? {
                          duration: 0.4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        } : {}}
                      >
                        {p.user_avatar}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{p.user_name}</div>
                        <div className="text-xs text-orange-400">ID: {maskPlatformId(p.user_platform_id)}</div>
                        <div className="text-xs text-yellow-400">{p.tickets_count} bilhetes</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    </div>
  );
}



