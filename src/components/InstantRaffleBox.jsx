import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, Zap, Check, Gift, ExternalLink, PartyPopper, Frown, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function InstantRaffleBox({ user }) {
  const queryClient = useQueryClient();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isShaking, setIsShaking] = useState(false);

  const { data: activeRaffle } = useQuery({
    queryKey: ['active-instant-raffles'],
    queryFn: () => base44.entities.InstantRaffle.filter({ active: true, ended: false }),
    select: (raffles) => raffles[0] || null,
    staleTime: 15_000,
  });

  const { data: settings = [] } = useAppSettings();

  const { data: myParticipationRaw } = useQuery({
    queryKey: ['my-instant-participation', activeRaffle?.id, user?.id],
    queryFn: () => base44.entities.InstantRaffleParticipant.filter({ 
      raffle_id: activeRaffle.id, 
      user_id: user.id 
    }),
    enabled: !!activeRaffle && !!user,
  });

  // Se houver múltiplas entradas, priorizar a que ganhou
  const myParticipation = React.useMemo(() => {
    if (!myParticipationRaw || myParticipationRaw.length === 0) return null;
    
    // Procurar entrada que ganhou e segue válida
    const winnerEntry = myParticipationRaw.find((p) => p.won && p.validated !== false);
    if (winnerEntry) return [winnerEntry];
    
    // Senão, retornar a primeira
    return [myParticipationRaw[0]];
  }, [myParticipationRaw]);

  const { data: allParticipantsRaw = [] } = useQuery({
    queryKey: ['instant-raffle-participants', activeRaffle?.id],
    queryFn: () => base44.entities.InstantRaffleParticipant.filter({ raffle_id: activeRaffle.id }),
    enabled: !!activeRaffle,
  });

  // Filtrar participantes únicos (remover duplicatas por user_id)
  const allParticipants = React.useMemo(() => {
    const uniqueUsers = new Map();
    allParticipantsRaw.forEach(participant => {
      if (!uniqueUsers.has(participant.user_id)) {
        uniqueUsers.set(participant.user_id, participant);
      }
    });
    return Array.from(uniqueUsers.values());
  }, [allParticipantsRaw]);

  // Filtrar ganhadores únicos direto do raw para não perder nenhum ganhador
  const winners = React.useMemo(() => {
    const uniqueWinners = new Map();
    allParticipantsRaw.forEach(p => {
      if (p.won && p.validated !== false && !uniqueWinners.has(p.user_id)) {
        uniqueWinners.set(p.user_id, p);
      }
    });
    return Array.from(uniqueWinners.values());
  }, [allParticipantsRaw]);

  const [isProcessing, setIsProcessing] = useState(false);

  const getParticipantVisual = React.useCallback((participant) => {
    const profileImageUrl = String(participant?.user_profile_image_url || "").trim();

    return {
      imageUrl: profileImageUrl ? resolveAssetUrl(profileImageUrl) : null,
      avatarFallback: participant.user_avatar || "U",
      displayName: participant.user_nick || participant.user_name || "Participante",
    };
  }, []);

  const participateMutation = useMutation({
    mutationFn: async () => base44.instantRaffles.join(activeRaffle.id),
    onMutate: () => {
      setIsProcessing(true);
      return { timestamp: Date.now() };
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['my-instant-participation'] });
        queryClient.invalidateQueries({ queryKey: ['instant-raffle-participants'] });
        setIsProcessing(false);
      }, 1000);
    },
    onError: (error) => {
      setIsProcessing(false);
      if (error.message?.includes('Rate limit')) {
        alert('Muitas tentativas! Aguarde alguns segundos e tente novamente.');
      } else {
        alert(error.message || "Erro ao confirmar participação");
      }
    },
  });

  const claimPrizeMutation = useMutation({
    mutationFn: async () => {
      const participation = myParticipation[0];
      await base44.winnings.claim("instant-raffle", participation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-instant-participation'] });
    },
  });

  const dismissLoserBoxMutation = useMutation({
    mutationFn: async () => {
      const participation = myParticipation[0];
      await base44.winnings.dismiss("instant-raffle", participation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-instant-participation'] });
    },
  });

  const dismissEndedBoxMutation = useMutation({
    mutationFn: async () => base44.instantRaffles.dismiss(activeRaffle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-instant-participation'] });
    },
  });

  // Countdown timer (APENAS exibição - sorteio feito no admin)
  useEffect(() => {
    if (!activeRaffle || !activeRaffle.draw_time) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const drawTime = new Date(activeRaffle.draw_time).getTime();
      const distance = drawTime - now;

      if (distance < 0) {
        setTimeRemaining(0);
        
        // APENAS mostrar animação - NUNCA executar sorteio aqui
        // O sorteio é feito APENAS no Admin Panel
        if (!activeRaffle.winners_drawn && !isShaking) {
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
          }, 5000);
        }
        return;
      }

      // Calculate total hours including days
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeRaffle, isShaking]);



  const handleParticipate = () => {
    // Previne cliques múltiplos enquanto está processando
    if (participateMutation.isPending || isProcessing) {
      return;
    }
    
    participateMutation.mutate();
  };

  if (!activeRaffle) return null;

  const myEntry = myParticipation?.[0];
  const hasParticipated = !!myEntry;
  const isWinner = Boolean(myEntry?.won && myEntry?.validated !== false);
  const hasEnded = activeRaffle.winners_drawn;
  const redeemLink = buildWhatsAppLink(activeRaffle.telegram_link);

  // Se confirmou (ganhou e recebeu ou perdeu e fechou), some o box
  if (myEntry?.prize_claimed) return null;

  // Cores configuráveis
  const getSettingValue = (key, defaultValue) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  const colorFrom = getSettingValue('instant_raffle_color_from', '#db2777');
  const colorTo = getSettingValue('instant_raffle_color_to', '#f97316');
  const borderColor = getSettingValue('instant_raffle_border_color', '#ec4899');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl md:rounded-3xl border-2 md:border-4 shadow-2xl w-full"
      style={{
        background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`,
        borderColor: borderColor
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden" />

      {/* Content */}
      <div className="relative z-10 p-4 md:p-8">
        <div className="text-center mb-4 md:mb-6">
          <AnimatePresence mode="wait">
            {isShaking ? (
              <motion.div
                key="shaking"
                initial={{ scale: 1 }}
                animate={{ 
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.2, 1.1, 1.2, 1.1, 1],
                }}
                transition={{
                  duration: 0.5,
                  repeat: 10,
                  ease: "easeInOut"
                }}
                className="flex justify-center mb-4"
              >
                <Gift className="w-24 h-24 md:w-32 md:h-32 text-yellow-300" />
              </motion.div>
            ) : (
              <div className="flex justify-center gap-2 mb-3 md:mb-4">
                <Gift className="w-8 h-8 md:w-12 md:h-12 text-yellow-300" />
                <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-white" />
                <Zap className="w-8 h-8 md:w-12 md:h-12 text-yellow-300" />
              </div>
            )}
          </AnimatePresence>

          {!isShaking && (
            <>
              <h2
                className="text-xl md:text-3xl lg:text-5xl font-black text-white mb-2 md:mb-3 px-2"
                style={{
                  textShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(236, 72, 153, 0.6)',
                }}
              >
                {activeRaffle.title}
              </h2>

              {/* Pessoas Participando - Scroll Horizontal Suave */}
              {allParticipants.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 mb-3 md:mb-4 w-full overflow-hidden">
                  <p className="text-xs md:text-sm font-bold text-white mb-3 text-center">
                     Participando ({allParticipants.length})
                  </p>
                  <div className="relative h-[50px] overflow-hidden">
                    <motion.div
                      className="flex gap-2 items-center absolute"
                      animate={{
                        x: [-10, -100 * Math.min(allParticipants.length, 10)]
                      }}
                      transition={{
                        duration: Math.min(allParticipants.length, 15) * 2,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    >
                      {/* Duplica os participantes para loop infinito suave */}
                      {[...allParticipants, ...allParticipants].map((p, idx) => {
                        const participantVisual = getParticipantVisual(p);
                        return (
                          <div
                            key={`${p.id}-${idx}`}
                            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 md:px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0"
                          >
                            {participantVisual.imageUrl ? (
                              <img
                                src={participantVisual.imageUrl}
                                alt={participantVisual.displayName}
                                className="h-7 w-7 md:h-8 md:w-8 rounded-full object-cover border border-white/40"
                              />
                            ) : (
                              <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-white/25 text-sm md:text-base">
                                {participantVisual.avatarFallback}
                              </span>
                            )}
                            <span className="text-xs md:text-sm font-bold text-white">
                              {participantVisual.displayName}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>
                </div>
              )}

              {timeRemaining !== null && timeRemaining !== 0 && !isShaking && (
                <div className="bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 inline-block">
                  <p className="text-xs md:text-sm text-white mb-2">Sorteio em:</p>
                  <div className="flex gap-1.5 md:gap-2 text-center">
                    <div className="bg-white/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 min-w-[50px] md:min-w-[60px]">
                      <motion.div
                        key={timeRemaining.hours}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-xl md:text-2xl font-black text-white"
                      >
                        {String(timeRemaining.hours).padStart(2, '0')}
                      </motion.div>
                      <div className="text-[10px] md:text-xs text-white/80">Horas</div>
                    </div>
                    <div className="text-2xl md:text-3xl text-white self-center">:</div>
                    <div className="bg-white/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 min-w-[50px] md:min-w-[60px]">
                      <motion.div
                        key={timeRemaining.minutes}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-xl md:text-2xl font-black text-white"
                      >
                        {String(timeRemaining.minutes).padStart(2, '0')}
                      </motion.div>
                      <div className="text-[10px] md:text-xs text-white/80">Min</div>
                    </div>
                    <div className="text-2xl md:text-3xl text-white self-center">:</div>
                    <div className="bg-white/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 min-w-[50px] md:min-w-[60px]">
                      <motion.div
                        key={timeRemaining.seconds}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-xl md:text-2xl font-black text-white"
                      >
                        {String(timeRemaining.seconds).padStart(2, '0')}
                      </motion.div>
                      <div className="text-[10px] md:text-xs text-white/80">Seg</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {isShaking && (
            <p className="text-2xl md:text-3xl font-bold text-white animate-pulse">
               AGUARDE O SORTEIO... 
            </p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!hasParticipated && !hasEnded && !isShaking ? (
            <motion.div
              key="participate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto space-y-3 md:space-y-4"
            >
              <Card className="bg-white/90 backdrop-blur-sm p-4 md:p-6">
                <Button
                  onClick={handleParticipate}
                  disabled={participateMutation.isPending || isProcessing || hasParticipated}
                  className="w-full min-h-[52px] md:min-h-[60px] px-4 py-3 md:py-4 text-sm md:text-base leading-tight font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-normal"
                >
                  {participateMutation.isPending || isProcessing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="mr-2"
                      >
                        <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                      </motion.div>
                      CONFIRMANDO...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                      CONFIRMAR PARTICIPACAO
                    </>
                  )}
                </Button>
              </Card>
            </motion.div>
          ) : !hasParticipated && hasEnded && !isShaking ? (
            <motion.div
              key="ended-no-participation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <Card className="bg-white/90 backdrop-blur-sm p-6 md:p-8 max-w-md mx-auto relative">
                <Button
                  onClick={() => dismissEndedBoxMutation.mutate()}
                  disabled={dismissEndedBoxMutation.isPending}
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
                >
                  <X className="w-5 h-5" />
                </Button>

                <div className="text-5xl md:text-6xl mb-3 md:mb-4"></div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 md:mb-3">
                  ESSE SORTEIO ACABOU!
                </h3>
                <p className="text-base md:text-lg text-gray-700 mb-4">
                  Você perdeu essa chance, mas não se preocupe.</p>
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4 md:p-5">
                  <p className="text-sm md:text-base font-bold text-purple-800 mb-2">
                    Fique ligado nas notificações.
                  </p>
                  <p className="text-xs md:text-sm text-purple-700">
                    Novos sorteios podem aparecer a qualquer momento. Não perca o próximo.</p>
                </div>

                {winners.length > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4">
                    <h4 className="text-base md:text-lg font-bold text-gray-800 mb-3">
                        {winners.length > 1 ? `Quem Ganhou (${winners.length}):` : 'Quem Ganhou:'}
                    </h4>
                    <div className="space-y-2">
                      {winners.map((winner) => (
                        <div
                          key={`ended-winner-${winner.id}`}
                          className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm"
                        >
                          <div className="text-xl md:text-2xl">{winner.user_avatar}</div>
                          <div className="text-left flex-1">
                            <div className="font-bold text-gray-800 text-xs md:text-sm">
                              {winner.user_name}
                            </div>
                            <div className="text-xs text-gray-600">
                              @{winner.user_nick}
                            </div>
                          </div>
                          <div className="text-lg"> </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ) : hasParticipated && !hasEnded && !isShaking ? (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <Card className="bg-white/90 backdrop-blur-sm p-4 md:p-6 max-w-md mx-auto">
                <Trophy className="w-12 h-12 md:w-16 md:h-16 text-pink-600 mx-auto mb-3 md:mb-4" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
                  Participacao confirmada!
                </h3>
                <p className="text-sm md:text-base text-gray-700">
                  Aguarde o sorteio. Boa sorte!</p>
              </Card>
            </motion.div>
          ) : hasEnded && isWinner && !isShaking ? (
            <motion.div
              key="winner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <Card className="bg-gradient-to-br from-yellow-400 to-orange-400 p-6 md:p-8 max-w-md mx-auto">
                <PartyPopper className="w-16 h-16 md:w-20 md:h-20 text-white mx-auto mb-3 md:mb-4" />
                <h3 className="text-3xl md:text-4xl font-black text-white mb-3 md:mb-4">
                   VOCE GANHOU!</h3>
                <p className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">
                  Premio: R$ {activeRaffle.prize_amount.toFixed(2)}
                </p>
                
                <div className="space-y-3">
                  <div className="bg-white/90 p-3 md:p-4 rounded-lg mb-3">
                    <p className="text-xs md:text-sm font-bold text-gray-800 mb-2">
                       Fale com o admin <span className="text-pink-600">{activeRaffle.admin_name}</span> no WhatsApp abaixo para resgatar:
                    </p>
                  </div>

                  {redeemLink ? (
                    <a href={redeemLink} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full py-4 md:py-6 text-base md:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                        <ExternalLink className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                        RESGATAR NO WHATSAPP
                      </Button>
                    </a>
                  ) : (
                    <Button
                      disabled
                      className="w-full py-4 md:py-6 text-base md:text-lg font-bold bg-slate-500 text-white cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                      WHATSAPP INDISPONIVEL
                    </Button>
                  )}
                  
                  {!myEntry.prize_claimed && (
                    <Button
                      onClick={() => claimPrizeMutation.mutate()}
                      disabled={claimPrizeMutation.isPending}
                      className="w-full py-3 md:py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-sm md:text-base"
                    >
                      <Check className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                      {claimPrizeMutation.isPending ? "CONFIRMANDO..." : "JA RECEBI O PREMIO"}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ) : hasEnded && !isWinner && !isShaking ? (
            <motion.div
              key="loser"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <Card className="bg-white/90 backdrop-blur-sm p-6 md:p-8 max-w-2xl mx-auto relative">
                <Button
                  onClick={() => dismissLoserBoxMutation.mutate()}
                  disabled={dismissLoserBoxMutation.isPending}
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
                >
                  <X className="w-5 h-5" />
                </Button>

                <Frown className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-3 md:mb-4" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 md:mb-3">
                  POXA, NAO FOI DESSA VEZ!</h3>
                <p className="text-base md:text-lg text-gray-700 mb-4 md:mb-6 px-2">
                  Mas fica esperto: outra notificação como essa pode surgir a qualquer momento.</p>

                {winners.length > 0 && (
                  <div className="bg-gradient-to-r from-pink-100 to-orange-100 rounded-xl p-4 md:p-6">
                    <h4 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">
                        {winners.length > 1 ? `Ganhadores (${winners.length}):` : 'Ganhador:'}
                    </h4>
                    <div className="space-y-2 md:space-y-3">
                      {winners.map((winner) => (
                        <div
                          key={`loser-winner-${winner.id}`}
                          className="flex items-center justify-between p-2 md:p-3 bg-white rounded-lg shadow"
                        >
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="text-2xl md:text-3xl">{winner.user_avatar}</div>
                            <div className="text-left">
                              <div className="font-bold text-gray-800 text-sm md:text-base">
                                {winner.user_name}
                              </div>
                              <div className="text-xs md:text-sm text-gray-600">
                                @{winner.user_nick}
                              </div>
                            </div>
                          </div>
                          <div className="text-xl md:text-2xl"> </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}



