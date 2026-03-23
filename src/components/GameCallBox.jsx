import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, ExternalLink, AlertTriangle, Check, Edit, PartyPopper } from "lucide-react";
import { format } from "date-fns";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export default function GameCallBox({ user }) {
  const queryClient = useQueryClient();
  const [gameCall, setGameCall] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: activeRaffle } = useQuery({
    queryKey: ['active-gamecall-raffle'],
    queryFn: async () => {
      const raffles = await base44.entities.GameCallRaffle.filter({ active: true, ended: false });
      return raffles[0] || null;
    },
  });

  const { data: myParticipation } = useQuery({
    queryKey: ['my-gamecall-participation', activeRaffle?.id, user?.id],
    queryFn: async () => {
      if (!activeRaffle || !user) return null;
      const participations = await base44.entities.GameCallParticipant.filter({
        raffle_id: activeRaffle.id,
        user_id: user.id
      });
      return participations[0] || null;
    },
    enabled: !!activeRaffle && !!user,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['gamecall-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const whatsappRedeemLink = settings.find((s) => s.key === "cashback_redeem_link")?.value || "#";
  const hasApprovedPhoto = Boolean(user?.profile_image_status === "approved" && user?.profile_image_url);
  const profileImageSrc = hasApprovedPhoto ? resolveAssetUrl(user.profile_image_url) : "";

  useEffect(() => {
    if (myParticipation?.game_call) {
      setGameCall(myParticipation.game_call);
      setIsEditing(false); // Fecha modo edicao quando carrega participacao
    }
  }, [myParticipation]);

  const submitCallMutation = useMutation({
    mutationFn: async (call) => base44.gameCall.submit(activeRaffle.id, { gameCall: call }),
    onMutate: () => {
      setLoading(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
      setLoading(false);
      setGameCall("");
    },
    onError: (error) => {
      setLoading(false);
      alert(error.message || 'Erro ao enviar call. Tente novamente.');
    },
  });

  const claimPrizeMutation = useMutation({
    mutationFn: () => base44.winnings.claim("game-call", myParticipation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
    }
  });

  const handleSubmit = async () => {
    if (!gameCall.trim()) {
      alert("Digite a call do jogo!");
      return;
    }

    if (hasReachedLimit) {
      alert("Você já usou todas as tentativas disponíveis nesta call.");
      return;
    }

    if (loading || submitCallMutation.isPending) {
      return; // Previne cliques multiplos
    }

    try {
      await submitCallMutation.mutateAsync(gameCall);
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao enviar call:", error);
    }
  };

  if (!activeRaffle) return null;

  const maxAttempts = activeRaffle.max_attempts || 3;
  const attempts = myParticipation?.attempts || 0;
  const hasReachedLimit = !!myParticipation && attempts >= maxAttempts;
  const isValidated = myParticipation?.validated && myParticipation?.won;
  const wasInvalidated = myParticipation?.validation_status === 'invalidated';
  const raffleAdminName = String(activeRaffle.admin_name || "").trim();
  const raffleAdminPhone = String(activeRaffle.admin_phone || "").trim();
  const raffleAdminWhatsAppLink = buildWhatsAppLink(raffleAdminPhone) || whatsappRedeemLink;

  if (isValidated) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-green-700/50 bg-gradient-to-br from-green-900/50 to-emerald-900/50 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-green-400/20 animate-pulse" />
        
        <div className="relative p-4 md:p-6 text-center">
          <div className="mb-4 flex justify-center">
            {profileImageSrc ? (
              <img
                src={profileImageSrc}
                alt={user?.full_name || user?.nick || "Perfil"}
                className="h-20 w-20 rounded-full border-2 border-green-300/80 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-300/80 bg-green-900/40 text-3xl shadow-lg">
                {user?.avatar_emoji || "U"}
              </div>
            )}
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-green-300 to-yellow-300">
            PARABENS! SUA CALL DEU BOA!
          </h2>

          <div className="mb-4">
            <p className="text-sm text-green-200 mb-2">Sua call vencedora:</p>
            <p className="text-lg font-bold text-green-300 italic">"{myParticipation.game_call}"</p>
          </div>

          <div className="mb-4">
            <p className="text-3xl md:text-4xl font-bold text-yellow-400">
              R$ {myParticipation.prize_amount?.toFixed(2)}
            </p>
          </div>

          <div className="mb-4 p-3 bg-purple-900/50 border border-purple-600/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-purple-200 text-sm">
              <span>
                Premiado em: {format(new Date(myParticipation.updated_date), 'dd/MM/yyyy HH:mm:ss')}
              </span>
            </div>
          </div>

          <div className="mb-6 p-3 md:p-4 bg-purple-900/50 border border-purple-600/50 rounded-lg">
            <p className="text-xs md:text-sm text-purple-200 mb-2">
              Para resgatar seu prêmio, entre em contato {raffleAdminName ? `com ${raffleAdminName}` : "com o admin"} via WhatsApp:
            </p>
            <a
              href={raffleAdminWhatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all text-sm md:text-base"
            >
              <ExternalLink className="w-4 h-4" />
              Falar no WhatsApp
            </a>
          </div>

          <Button
            onClick={() => claimPrizeMutation.mutate()}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-base md:text-lg font-bold py-4 md:py-6"
          >
            <Check className="w-5 h-5 mr-2" />
            JA RESGATEI MEU PREMIO
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-blue-700/50 bg-gradient-to-br from-blue-900/50 to-cyan-900/50 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-cyan-400/10" />
      
      <div className="relative p-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Gamepad2 className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
            Call de Jogo em Live Disponível!
          </h3>
        </div>

        <div className="text-center mb-4">
          <p className="text-lg font-bold text-blue-200">
            {activeRaffle.title}
          </p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            Premio: R$ {activeRaffle.prize_amount?.toFixed(2)}
          </p>
        </div>

        {wasInvalidated && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600/50 rounded-lg">
            <p className="text-sm text-red-200 text-center">
               Poxa, sua call deu ruim. Mas você pode escolher outra e tentar novamente!
            </p>
            <p className="text-xs text-red-300 text-center mt-1">
              Tentativa {attempts + 1} de {maxAttempts}
            </p>
          </div>
        )}

        {hasReachedLimit && (
          <div className="mb-4 rounded-lg border border-red-500/60 bg-red-950/40 p-3">
            <p className="text-center text-sm text-red-200">
              Suas tentativas acabaram nesta rodada. Aguarde o admin reativar sua participação ou abrir uma nova call.
            </p>
          </div>
        )}

        {myParticipation && !isEditing ? (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-500/50 rounded-xl text-center animate-pulse">
              <div className="mb-3 flex justify-center">
                {profileImageSrc ? (
                  <img
                    src={profileImageSrc}
                    alt={user?.full_name || user?.nick || "Perfil"}
                    className="h-16 w-16 rounded-full border-2 border-green-300/70 object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-300/70 bg-green-900/40 text-2xl shadow-lg">
                    {user?.avatar_emoji || "U"}
                  </div>
                )}
              </div>
              <PartyPopper className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h4 className="text-xl md:text-2xl font-bold text-green-300 mb-2">
                 PARABENS!
              </h4>
              <p className="text-base md:text-lg text-green-200 mb-3">
                Você está participando do sorteio!
              </p>
              
              <div className="bg-cyan-900/50 border border-cyan-500/50 rounded-lg p-4 mb-4">
                <p className="text-xs text-cyan-300 mb-2"> Sua call enviada:</p>
                <p className="text-lg md:text-xl font-bold text-yellow-300 italic">"{myParticipation.game_call}"</p>
              </div>

              <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-200">
                  Tentativas restantes: <span className="font-bold text-yellow-300">{Math.max(0, maxAttempts - attempts)}/{maxAttempts}</span>
                </p>
              </div>

              <p className="text-xs text-green-200 mb-4">
                Aguarde o resultado na live!
              </p>
            </div>

            {!hasReachedLimit ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full whitespace-normal bg-gradient-to-r from-orange-600 to-amber-600 py-5 text-base font-bold leading-tight hover:from-orange-700 hover:to-amber-700 md:text-lg"
              >
                <Edit className="w-5 h-5 mr-2" />
                EDITAR CALL ENVIADA
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Input
                value={gameCall}
                onChange={(e) => setGameCall(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && gameCall.trim()) {
                    handleSubmit();
                  }
                }}
                placeholder="Digite a call do jogo (ex: MINES X5)"
                className="bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-400 text-center text-lg"
                disabled={loading || submitCallMutation.isPending}
              />
              <p className="text-xs text-blue-300 text-center mt-2">
                {myParticipation ? `Você tem ${Math.max(0, maxAttempts - attempts)} tentativa(s) restante(s)` : `Você tem ${maxAttempts} tentativas`}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {isEditing && (
                <Button
                  onClick={() => {
                    setGameCall(myParticipation.game_call);
                    setIsEditing(false);
                  }}
                  variant="outline"
                  className="w-full min-w-0 border-gray-600 py-4 text-base font-bold text-gray-300 hover:bg-gray-800/30 md:text-lg sm:flex-1"
                >
                  Cancelar
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading || submitCallMutation.isPending || !gameCall.trim() || hasReachedLimit}
                className={`${isEditing ? 'w-full sm:flex-1' : 'w-full'} min-w-0 whitespace-normal break-words bg-gradient-to-r from-cyan-600 to-blue-600 py-4 text-sm font-bold leading-tight hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed sm:text-base md:text-lg`}
              >
                <Gamepad2 className="w-5 h-5 mr-2" />
                {(loading || submitCallMutation.isPending) ? "ENVIANDO CALL..." : isEditing ? "SALVAR ALTERACOES" : myParticipation ? "ATUALIZAR CALL" : "ENVIAR CALL"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}



