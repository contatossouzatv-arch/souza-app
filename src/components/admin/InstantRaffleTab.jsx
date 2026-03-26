import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Gift, Zap, Trash2, EyeOff, Edit2, Check, X, UserX, Shuffle, RotateCcw, Users, History, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InstantRaffleTab() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("2 BANCAS DE R$20 LIBERADAS PRA SORTEIO");
  const [prizeAmount, setPrizeAmount] = useState("20");
  const [maxWinners, setMaxWinners] = useState(2);
  const [drawTime, setDrawTime] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [adminName, setAdminName] = useState("");
  const [autoDraw, setAutoDraw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryRaffle, setSelectedHistoryRaffle] = useState(null);

  const { data: activeRaffle } = useQuery({
    queryKey: ['admin-instant-raffle'],
    queryFn: async () => {
      const raffles = await base44.entities.InstantRaffle.filter({ active: true, ended: false });
      return raffles[0] || null;
    },
  });

  const { data: participantsRaw = [] } = useQuery({
    queryKey: ['admin-instant-participants', activeRaffle?.id],
    queryFn: async () => {
      const response = await base44.adminEvents.instantRaffles.listParticipants(activeRaffle.id);
      return response?.items || [];
    },
    enabled: !!activeRaffle,
    staleTime: 10000,
  });

  // Filtrar participantes únicos por user_id
  const participants = React.useMemo(() => {
    const uniqueUsers = new Map();
    participantsRaw.forEach(participant => {
      if (!uniqueUsers.has(participant.user_id)) {
        uniqueUsers.set(participant.user_id, participant);
      }
    });
    return Array.from(uniqueUsers.values());
  }, [participantsRaw]);

  const { data: previousRaffles = [] } = useQuery({
    queryKey: ['previous-instant-raffles'],
    queryFn: () => base44.entities.InstantRaffle.filter({ ended: true }, '-created_date', 10),
  });

  const { data: historyParticipantsRaw = [] } = useQuery({
    queryKey: ['history-instant-participants', selectedHistoryRaffle?.id],
    queryFn: async () => {
      const response = await base44.adminEvents.instantRaffles.listParticipants(selectedHistoryRaffle.id);
      return response?.items || [];
    },
    enabled: !!selectedHistoryRaffle,
    staleTime: 10000,
  });

  // Filtrar participantes do histórico únicos por user_id
  const historyParticipants = React.useMemo(() => {
    const uniqueUsers = new Map();
    historyParticipantsRaw.forEach(participant => {
      if (!uniqueUsers.has(participant.user_id)) {
        uniqueUsers.set(participant.user_id, participant);
      }
    });
    return Array.from(uniqueUsers.values());
  }, [historyParticipantsRaw]);

  useEffect(() => {
    if (activeRaffle && isEditing) {
      setTitle(activeRaffle.title);
      setPrizeAmount(activeRaffle.prize_amount.toString());
      setMaxWinners(activeRaffle.max_winners);
      setDrawTime(new Date(activeRaffle.draw_time).toISOString().slice(0, 16));
      setTelegramLink(activeRaffle.telegram_link);
      setAdminName(activeRaffle.admin_name);
      setAutoDraw(activeRaffle.auto_draw || false);
    }
  }, [activeRaffle, isEditing]);

  const createRaffleMutation = useMutation({
    mutationFn: async () => base44.adminEvents.instantRaffles.create({
      title,
      prizeAmount: parseFloat(prizeAmount),
      maxWinners,
      drawTime: new Date(drawTime).toISOString(),
      adminName,
      telegramLink,
      autoDraw,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      resetForm();
      alert("Sorteio criado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar sorteio:", error);
      alert("Erro ao criar sorteio. Tente novamente.");
    }
  });

  const createRaffleWithParticipantsMutation = useMutation({
    mutationFn: async ({ sourceRaffle, participants }) => {
      const response = await base44.adminEvents.instantRaffles.clone(sourceRaffle.id);
      return { added: response?.participant_count || participants.length, totalParticipants: participants.length, newRaffle: response?.raffle || null };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['previous-instant-raffles'] });
      setSelectedHistoryRaffle(null);
      setShowHistory(false);
      alert(`Novo sorteio criado com sucesso!\n\n ${data.added} participante(s) adicionado(s) de ${data.totalParticipants}\n\n Você pode editar as configurações agora!`);
    },
    onError: (error) => {
      alert(`Erro ao criar sorteio: ${error.message}`);
    }
  });

  const updateRaffleMutation = useMutation({
    mutationFn: async () => base44.adminEvents.instantRaffles.update(activeRaffle.id, {
      title,
      prizeAmount: parseFloat(prizeAmount),
      maxWinners,
      drawTime: new Date(drawTime).toISOString(),
      adminName,
      telegramLink,
      autoDraw,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      setIsEditing(false);
      alert("Sorteio atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar sorteio:", error);
      alert("Erro ao atualizar sorteio. Tente novamente.");
    }
  });

  const performDrawMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.adminEvents.instantRaffles.draw(activeRaffle.id);
      return { winnerCount: response?.winners?.length || 0, totalParticipants: participants.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
      alert(`Sorteio realizado com sucesso!\n\n ${data.winnerCount} ganhador(es) sorteado(s) de ${data.totalParticipants} participantes!\n\n Registrado na auditoria!`);
    },
    onError: (error) => {
      console.error("Erro ao realizar sorteio:", error);
      alert(`Erro ao realizar sorteio: ${error.message}`);
    }
  });

  const endRaffleMutation = useMutation({
    mutationFn: async (raffleId) => base44.adminEvents.instantRaffles.end(raffleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['previous-instant-raffles'] });
      alert("Sorteio fechado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao fechar sorteio:", error);
      alert("Erro ao fechar sorteio. Tente novamente.");
    }
  });

  const deleteRaffleMutation = useMutation({
    mutationFn: async (raffleId) => base44.adminEvents.instantRaffles.delete(raffleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      alert("Sorteio excluido com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao excluir sorteio:", error);
      alert("Erro ao excluir sorteio. Tente novamente.");
    }
  });

  const validateWinnerMutation = useMutation({
    mutationFn: async ({ participantId, validated }) => base44.adminEvents.instantRaffles.validateParticipant(participantId, validated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['active-instant-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
      queryClient.invalidateQueries({ queryKey: ['user-prize-gallery'] });
      queryClient.invalidateQueries({ queryKey: ['my-instant-participation'] });
      alert("Status atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao validar ganhador:", error);
      alert("Erro ao atualizar status. Tente novamente.");
    }
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId) => base44.adminEvents.instantRaffles.removeParticipant(participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
      alert("Participante removido com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao remover participante:", error);
      alert("Erro ao remover participante. Tente novamente.");
    }
  });

  const reactivateParticipantMutation = useMutation({
    mutationFn: async ({ participant, targetRaffleId }) => base44.adminEvents.instantRaffles.reactivate(targetRaffleId, [participant]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
    },
    onError: (error) => {
      console.error("Erro ao reativar participante:", error);
      alert(`Erro ao reativar participante: ${error.message}`);
    }
  });

  const reactivateAllMutation = useMutation({
    mutationFn: async ({ participants, targetRaffleId }) => {
      const response = await base44.adminEvents.instantRaffles.reactivate(targetRaffleId, participants);
      return { added: response?.added_count || 0, skipped: response?.skipped_count || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-instant-participants'] });
      queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
      alert(`Reativacao concluida!\n\n${data.added} adicionado(s)\n${data.skipped} ja estavam participando`);
    },
    onError: (error) => {
      console.error("Erro ao reativar todos os participantes:", error);
      alert(`Erro ao reativar todos os participantes: ${error.message}`);
    }
  });

  // Filtrar ganhadores e perdedores únicos direto do raw
  const winners = React.useMemo(() => {
    const uniqueWinners = new Map();
    participantsRaw.forEach(p => {
      if (p.won && p.validated !== false && !uniqueWinners.has(p.user_id)) {
        uniqueWinners.set(p.user_id, p);
      }
    });
    return Array.from(uniqueWinners.values());
  }, [participantsRaw]);

  const losers = React.useMemo(() => {
    const uniqueLosers = new Map();
    participantsRaw.forEach(p => {
      if ((!p.won || p.validated === false) && !uniqueLosers.has(p.user_id)) {
        uniqueLosers.set(p.user_id, p);
      }
    });
    return Array.from(uniqueLosers.values());
  }, [participantsRaw]);

  const renderUserAvatar = (participant, sizeClass = "h-10 w-10") => {
    const approvedImage = participant?.user_profile_image_url
      ? resolveAssetUrl(participant.user_profile_image_url)
      : null;

    if (approvedImage) {
      return (
        <img
          src={approvedImage}
          alt={participant.user_name || "Usuario"}
          className={`${sizeClass} rounded-full object-cover border border-white/30`}
        />
      );
    }

    return (
      <div className={`${sizeClass} flex items-center justify-center rounded-full bg-white/15 text-lg`}>
        {participant.user_avatar || "U"}
      </div>
    );
  };

  const maskPlatformId = (id) => {
    if (!id) return "****";
    const str = id.toString();
    if (str.length <= 4) return "****";
    return `****${str.slice(-4)}`;
  };

  const resetForm = () => {
    setTitle("2 BANCAS DE R$20 LIBERADAS PRA SORTEIO");
    setPrizeAmount("20");
    setMaxWinners(2);
    setDrawTime("");
    setTelegramLink("");
    setAdminName("");
    setAutoDraw(false);
  };

  const handleCreateRaffle = () => {
    if (!title || !prizeAmount || !drawTime || !telegramLink || !adminName) {
      alert("Preencha todos os campos!");
      return;
    }

    const drawDate = new Date(drawTime);
    const now = new Date();
    
    if (drawDate <= now) {
      alert("A data/hora do sorteio deve ser no futuro!");
      return;
    }

    if (confirm(` Criar sorteio "${title}" com ${maxWinners} ganhador(es)?`)) {
      createRaffleMutation.mutate();
    }
  };

  const handleCreateRaffleWithParticipants = (sourceRaffle, participants) => {
    const message = activeRaffle
      ? `CRIAR NOVO SORTEIO COM ${participants.length} PARTICIPANTES?\n\nO sorteio ativo atual será FECHADO automaticamente.\n\nConfigurações do novo sorteio:\n- Título: ${sourceRaffle.title}\n- Prêmio: R$ ${sourceRaffle.prize_amount.toFixed(2)}\n- Ganhadores: ${sourceRaffle.max_winners}\n- Data: Amanhã às 20:00\n- Participantes: ${participants.length}\n\nVocê poderá editar depois!`
      : `CRIAR NOVO SORTEIO COM ${participants.length} PARTICIPANTES?\n\nConfigurações:\n- Título: ${sourceRaffle.title}\n- Prêmio: R$ ${sourceRaffle.prize_amount.toFixed(2)}\n- Ganhadores: ${sourceRaffle.max_winners}\n- Data: Amanhã às 20:00\n- Participantes: ${participants.length}\n\nVocê poderá editar depois!`;

    if (confirm(message)) {
      createRaffleWithParticipantsMutation.mutate({ sourceRaffle, participants });
    }
  };

  const handleUpdateRaffle = () => {
    if (!title || !prizeAmount || !drawTime || !telegramLink || !adminName) {
      alert("Preencha todos os campos!");
      return;
    }

    if (confirm(" Salvar alterações no sorteio?")) {
      updateRaffleMutation.mutate();
    }
  };

  const handlePerformDraw = () => {
    if (participants.length === 0) {
      alert("Não há participantes para sortear!");
      return;
    }

    if (activeRaffle.winners_drawn) {
      alert("Este sorteio ja foi realizado!");
      return;
    }

    const message = ` REALIZAR SORTEIO AGORA?\n\n Total de participantes: ${participants.length}\n  Ganhadores a sortear: ${activeRaffle.max_winners}\n\nOs ganhadores serão registrados na auditoria!\n\nEsta ação não pode ser desfeita!`;

    if (confirm(message)) {
      performDrawMutation.mutate();
    }
  };

  const handleDeleteRaffle = () => {
    if (confirm("Tem certeza que deseja EXCLUIR este sorteio?\n\nIsso vai remover:\n- o sorteio\n- todos os participantes\n- todos os dados relacionados\n\nEsta ação não pode ser desfeita!")) {
      deleteRaffleMutation.mutate(activeRaffle.id);
    }
  };

  const handleEndRaffle = () => {
    if (confirm(" Fechar este sorteio?\n\nO box desaparecerá do Dashboard dos usuários.")) {
      endRaffleMutation.mutate(activeRaffle.id);
    }
  };

  const handleValidateWinner = (participantId, validated) => {
    const action = validated ? "CONFIRMAR" : "ANULAR";
    if (confirm(`${action} este ganhador?`)) {
      validateWinnerMutation.mutate({ participantId, validated });
    }
  };

  const handleRemoveParticipant = (participant) => {
    if (confirm(` BANIR ${participant.user_name} (@${participant.user_nick}) do sorteio?\n\nEle será removido da lista de participantes!\n\nEsta ação não pode ser desfeita!`)) {
      removeParticipantMutation.mutate(participant.id);
    }
  };

  const handleReactivateParticipant = (participant) => {
    if (!activeRaffle) {
      alert("Não há sorteio ativo! Crie um sorteio primeiro.");
      return;
    }

    if (confirm(` Reativar ${participant.user_name} (@${participant.user_nick}) no sorteio atual?\n\nEle será adicionado à lista de participantes!`)) {
      reactivateParticipantMutation.mutate({ 
        participant, 
        targetRaffleId: activeRaffle.id 
      });
    }
  };

  const handleReactivateAll = (participants) => {
    if (!activeRaffle) {
      alert("Não há sorteio ativo! Crie um sorteio primeiro.");
      return;
    }

    if (confirm(` Reativar TODOS os ${participants.length} participantes no sorteio atual?\n\nEles serão adicionados à lista!\n\n(Participantes que já estão na lista serão ignorados)`)) {
      reactivateAllMutation.mutate({ 
        participants, 
        targetRaffleId: activeRaffle.id 
      });
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {previousRaffles.length > 0 && (
        <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-700/50 p-4">
          <Button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <History className="w-4 h-4 mr-2" />
            {showHistory ? 'Ocultar Histórico' : `Ver Histórico de Sorteios Anteriores (${previousRaffles.length})`}
          </Button>
        </Card>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-gradient-to-br from-purple-950 to-purple-900 border-purple-700/50 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
               Histórico de Sorteios Anteriores
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {previousRaffles.map((raffle) => (
              <Card key={raffle.id} className="bg-indigo-900/30 border-indigo-700/50 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-indigo-200">{raffle.title}</h3>
                    <p className="text-sm text-indigo-300">
                       R$ {raffle.prize_amount.toFixed(2)} • 
                        {raffle.max_winners} ganhador(es) • 
                       {format(new Date(raffle.created_date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <Button
                    onClick={() => setSelectedHistoryRaffle(raffle)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Ver Participantes
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHistoryRaffle} onOpenChange={() => setSelectedHistoryRaffle(null)}>
        <DialogContent className="bg-gradient-to-br from-purple-950 to-purple-900 border-purple-700/50 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
               Participantes - {selectedHistoryRaffle?.title}
            </DialogTitle>
          </DialogHeader>

          {historyParticipants.length === 0 ? (
            <div className="text-center p-8 text-purple-300">
              Nenhum participante neste sorteio.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-4 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                <div>
                  <p className="text-purple-200 font-bold">
                    Total: {historyParticipants.length} participante(s)
                  </p>
                  <p className="text-sm text-purple-300">
                    Ganhadores: {historyParticipants.filter(p => p.won).length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <Button
                    onClick={() => handleCreateRaffleWithParticipants(selectedHistoryRaffle, historyParticipants)}
                    disabled={createRaffleWithParticipantsMutation.isPending}
                    className="flex-1 md:flex-initial bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 animate-pulse"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    {createRaffleWithParticipantsMutation.isPending ? "Criando..." : "Criar Novo Sorteio com Todos"}
                  </Button>
                  {activeRaffle && (
                    <Button
                      onClick={() => handleReactivateAll(historyParticipants)}
                      disabled={reactivateAllMutation.isPending}
                      className="flex-1 md:flex-initial bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {reactivateAllMutation.isPending ? "Reativando..." : "Reativar no Sorteio Ativo"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                <p className="text-sm text-yellow-200">
                  <strong> Dica:</strong>
                </p>
                <ul className="text-xs text-yellow-300 mt-2 space-y-1">
                  <li> <strong>"Criar Novo Sorteio":</strong> Fecha o sorteio ativo (se houver), cria um novo sorteio com as mesmas configurações e adiciona todos os participantes automaticamente.</li>
                  <li> <strong>"Reativar no Sorteio Ativo":</strong> Adiciona todos os participantes deste histórico ao sorteio *ativo atual*. Ignora quem já está.</li>
                  <li> <strong>"Reativar" individual:</strong> Adiciona apenas aquele participante específico ao sorteio *ativo atual*.</li>
                </ul>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {historyParticipants.map((participant) => (
                  <div 
                    key={participant.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      participant.won 
                        ? 'bg-green-900/30 border border-green-700/50' 
                        : 'bg-gray-900/30 border border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {renderUserAvatar(participant, "h-9 w-9")}
                      <div>
                        <div className="font-medium text-white">
                          {participant.user_name}
                          {participant.won && <span className="ml-2"> </span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          @{participant.user_nick} • ID: {maskPlatformId(participant.platform_id)}
                        </div>
                      </div>
                    </div>
                    {activeRaffle && (
                      <Button
                        onClick={() => handleReactivateParticipant(participant)}
                        disabled={reactivateParticipantMutation.isPending}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reativar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!activeRaffle ? (
        <Card className="bg-gradient-to-br from-pink-900/50 to-orange-900/50 border-pink-700/50 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Gift className="w-6 h-6 text-pink-400" />
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-orange-300">
              Criar Sorteio Instantneo
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-pink-200">Título do Sorteio</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 2 BANCAS DE R$20 LIBERADAS PRA SORTEIO"
                className="bg-pink-900/50 border-pink-700 text-white"
              />
              <p className="text-xs text-pink-300 mt-1"> Use MAIaSCULAS para mais impacto!</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prizeAmount" className="text-pink-200">Valor do Prêmio (R$)</Label>
                <Input
                  id="prizeAmount"
                  type="number"
                  value={prizeAmount}
                  onChange={(e) => setPrizeAmount(e.target.value)}
                  placeholder="20"
                  min="0"
                  step="0.01"
                  className="bg-pink-900/50 border-pink-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="maxWinners" className="text-pink-200">Quantidade de Ganhadores</Label>
                <Input
                  id="maxWinners"
                  type="number"
                  value={maxWinners}
                  onChange={(e) => setMaxWinners(parseInt(e.target.value))}
                  placeholder="2"
                  min="1"
                  className="bg-pink-900/50 border-pink-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="drawTime" className="text-pink-200">Data e Hora do Sorteio</Label>
              <Input
                id="drawTime"
                type="datetime-local"
                value={drawTime}
                onChange={(e) => setDrawTime(e.target.value)}
                className="bg-pink-900/50 border-pink-700 text-white"
              />
              <p className="text-xs text-pink-300 mt-1">⏱️ Exibir countdown até esta data</p>
            </div>

            <div>
              <Label htmlFor="adminName" className="text-pink-200">Nome do Admin Responsável</Label>
              <Input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Ex: João Silva"
                className="bg-pink-900/50 border-pink-700 text-white"
              />
              <p className="text-xs text-pink-300 mt-1"> Nome que aparecerá para o ganhador</p>
            </div>

            <div>
              <Label htmlFor="telegramLink" className="text-pink-200">Link do WhatsApp para Resgate</Label>
              <Input
                id="telegramLink"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                placeholder="https://wa.me/5511999999999"
                className="bg-pink-900/50 border-pink-700 text-white"
              />
              <p className="text-xs text-pink-300 mt-1"> Link para o ganhador falar no WhatsApp e resgatar o prêmio</p>
            </div>

            <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-700/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-blue-200 font-bold text-base"> Sorteio Automático</Label>
                  <p className="text-xs text-blue-300 mt-1">
                    {autoDraw
                      ? "Sistema sorteia automaticamente quando o tempo acabar"
                      : "Você precisará clicar em 'SORTEAR AGORA' manualmente"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoDraw"
                    checked={autoDraw}
                    onChange={(e) => setAutoDraw(e.target.checked)}
                    className="w-6 h-6 rounded border-blue-600 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            </Card>

            <div className="p-4 bg-orange-900/30 border border-orange-700/50 rounded-lg">
              <h4 className="text-sm font-bold text-orange-300 mb-2">Como funciona:</h4>
              <ul className="text-xs text-orange-200 space-y-1">
                <li> <strong>Sorteio Automático ON:</strong> Sistema sorteia sozinho quando o tempo acabar</li>
                <li> <strong>Sorteio Automático OFF:</strong> Você clica em "SORTEAR AGORA" quando quiser</li>
                <li>Data/hora define quando o countdown chega a zero</li>
                <li>Você tem controle total sobre quando realizar o sorteio</li>
                <li> Sorteará EXATAMENTE a quantidade de ganhadores configurada</li>
                <li> Os ganhadores serão automaticamente registrados na auditoria</li>
                <li> Botão "SORTEAR AGORA" funciona independente da configuração automática</li>
              </ul>
            </div>

            <Button
              onClick={handleCreateRaffle}
              disabled={createRaffleMutation.isPending}
              className="w-full bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 text-lg py-6"
            >
              <Zap className="w-5 h-5 mr-2" />
              {createRaffleMutation.isPending ? "ATIVANDO..." : "ATIVAR SORTEIO INSTANTANEO"}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-to-br from-pink-900/50 to-orange-900/50 border-pink-700/50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-pink-300">{activeRaffle.title}</h2>
                  {!isEditing && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      size="sm"
                      variant="ghost"
                      className="text-pink-300 hover:text-pink-200 hover:bg-pink-900/30"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-pink-200">
                   Prêmio: R$ {activeRaffle.prize_amount.toFixed(2)} • 
                    {activeRaffle.max_winners} ganhador(es) • 
                   {participants.length} participante(s)
                </p>
                <p className="text-sm text-pink-300 mt-1">
                   Admin: {activeRaffle.admin_name} • 
                  ⏱️ Sorteio: {format(new Date(activeRaffle.draw_time), 'dd/MM/yyyy HH:mm')} •
                  {activeRaffle.auto_draw ? '  Automático' : '  Manual'}
                </p>
                {activeRaffle.winners_drawn && (
                  <Badge className="bg-green-600 mt-2">Sorteio realizado - {winners.length} ganhador(es)</Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {!activeRaffle.winners_drawn && participants.length > 0 && (
                  <Button
                    onClick={handlePerformDraw}
                    disabled={performDrawMutation.isPending}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 animate-pulse"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    {performDrawMutation.isPending ? "SORTEANDO..." : "SORTEAR AGORA"}
                  </Button>
                )}
                <Button
                  onClick={handleEndRaffle}
                  disabled={endRaffleMutation.isPending}
                  variant="secondary"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  {endRaffleMutation.isPending ? "Fechando..." : "Fechar"}
                </Button>
                <Button
                  onClick={handleDeleteRaffle}
                  disabled={deleteRaffleMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteRaffleMutation.isPending ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>

            {!activeRaffle.winners_drawn && participants.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-900/30 border-2 border-yellow-600/50 rounded-lg animate-pulse">
                <p className="text-center text-yellow-200 font-bold">
                  ATENCAO: Clique em "SORTEAR AGORA" quando quiser realizar o sorteio.
                </p>
                <p className="text-center text-yellow-300 text-sm mt-1">
                  Serão sorteados exatamente {activeRaffle.max_winners} ganhador(es) de {participants.length} participantes
                </p>
              </div>
            )}
          </Card>

          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="bg-gradient-to-br from-purple-950 to-purple-900 border-purple-700/50 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-orange-300">
                  Editar Sorteio
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pr-2">
                <div>
                  <Label htmlFor="edit-title" className="text-pink-200">Título do Sorteio</Label>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-pink-900/50 border-pink-700 text-white"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-prize" className="text-pink-200">Valor do Prêmio (R$)</Label>
                    <Input
                      id="edit-prize"
                      type="number"
                      value={prizeAmount}
                      onChange={(e) => setPrizeAmount(e.target.value)}
                      className="bg-pink-900/50 border-pink-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-winners" className="text-pink-200">Quantidade de Ganhadores</Label>
                    <Input
                      id="edit-winners"
                      type="number"
                      value={maxWinners}
                      onChange={(e) => setMaxWinners(parseInt(e.target.value))}
                      className="bg-pink-900/50 border-pink-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-time" className="text-pink-200">Data e Hora do Sorteio</Label>
                  <Input
                    id="edit-time"
                    type="datetime-local"
                    value={drawTime}
                    onChange={(e) => setDrawTime(e.target.value)}
                    className="bg-pink-900/50 border-pink-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-admin" className="text-pink-200">Nome do Admin</Label>
                  <Input
                    id="edit-admin"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="bg-pink-900/50 border-pink-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-telegram" className="text-pink-200">Link do WhatsApp</Label>
                  <Input
                    id="edit-telegram"
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                    placeholder="https://wa.me/5511999999999"
                    className="bg-pink-900/50 border-pink-700 text-white"
                  />
                </div>

                <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-700/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-blue-200 font-bold"> Sorteio Automático</Label>
                      <p className="text-xs text-blue-300 mt-1">
                        {autoDraw
                          ? "Sorteara automaticamente quando o tempo acabar"
                          : "Sorteio manual (botao 'SORTEAR AGORA')"}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="edit-autoDraw"
                      checked={autoDraw}
                      onChange={(e) => setAutoDraw(e.target.checked)}
                      className="w-6 h-6 rounded border-blue-600 text-blue-600 focus:ring-blue-600 cursor-pointer"
                    />
                  </div>
                </Card>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleUpdateRaffle}
                    disabled={updateRaffleMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {updateRaffleMutation.isPending ? "SALVANDO..." : "SALVAR ALTERACOES"}
                  </Button>
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="border-pink-600 text-pink-300 hover:bg-pink-900/30"
                  >
                    CANCELAR
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {winners.length > 0 && (
            <Card className="bg-gradient-to-br from-green-900/50 to-teal-900/50 border-green-700/50 p-6">
              <h3 className="text-xl font-bold text-green-300 mb-4">
                  Ganhadores ({winners.length})
              </h3>
              <div className="space-y-3">
                {winners.map((winner) => (
                  <div key={winner.id} className="p-4 bg-green-900/30 border border-green-700/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {renderUserAvatar(winner, "h-11 w-11")}
                        <div>
                          <div className="font-bold text-green-200">{winner.user_name}</div>
                          <div className="text-sm text-green-300">@{winner.user_nick}</div>
                          <div className="text-xs text-green-400">ID: {maskPlatformId(winner.platform_id)}</div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        {winner.prize_claimed && (
                          <Badge className="bg-purple-600 mb-2">Usuario confirmou</Badge>
                        )}
                        {winner.validated === true && (
                          <Badge className="bg-blue-600 mb-2">Admin validou</Badge>
                        )}
                        {winner.validated === false && (
                          <Badge className="bg-red-600 mb-2">Admin anulou</Badge>
                        )}
                        <div className="text-xs text-green-400">
                          {format(new Date(winner.created_date), 'dd/MM HH:mm')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleValidateWinner(winner.id, true)}
                        disabled={winner.validated === true || validateWinnerMutation.isPending}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {winner.validated === true ? "Confirmado" : "Confirmar"}
                      </Button>
                      <Button
                        onClick={() => handleValidateWinner(winner.id, false)}
                        disabled={winner.validated === false || validateWinnerMutation.isPending}
                        size="sm"
                        variant="destructive"
                        className="flex-1 disabled:opacity-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        {winner.validated === false ? "Anulado" : "Anular"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {losers.length > 0 && (
            <Card className="bg-gradient-to-br from-gray-900/50 to-slate-900/50 border-gray-700/50 p-6">
              <h3 className="text-xl font-bold text-gray-300 mb-4">
                 Participantes Atuais ({losers.length})
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                 Passe o mouse sobre um participante para ver a opção de banir
              </p>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {losers.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-900/30 border border-gray-700/50 rounded-lg group hover:border-red-600/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {renderUserAvatar(participant, "h-9 w-9")}
                      <div>
                        <div className="font-medium text-gray-200">{participant.user_name}</div>
                        <div className="text-xs text-gray-400">
                          @{participant.user_nick} • ID: {maskPlatformId(participant.platform_id)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">
                        {format(new Date(participant.created_date), 'HH:mm')}
                      </div>
                      <Button
                        onClick={() => handleRemoveParticipant(participant)}
                        disabled={removeParticipantMutation.isPending}
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Banir participante"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Banir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}



