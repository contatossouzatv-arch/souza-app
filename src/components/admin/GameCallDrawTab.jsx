import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, Trash2, Check, X, Sparkles, Coins, Trophy, Crown, Dices, Gem, UserMinus, UserCheck } from "lucide-react";
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

function ParticipantAvatar({ imageUrl, fallback, sizeClass = "h-10 w-10 text-2xl" }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Avatar"
        className={`${sizeClass} rounded-full border border-cyan-300/70 object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full border border-cyan-300/70 bg-cyan-900/40`}>
      {fallback || "U"}
    </div>
  );
}

function GameCallParticipantsList({ participants, isDrawing, maskPlatformId, maxAttempts, getParticipantImageUrl }) {
  const [visibleParticipantIndex, setVisibleParticipantIndex] = useState(0);

  useEffect(() => {
    if (participants.length === 0) return;
    
    const interval = setInterval(() => {
      setVisibleParticipantIndex(prev => {
        const next = prev + 3;
        return next >= participants.length ? 0 : next;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [participants.length]);

  return (
    <AnimatePresence mode="wait">
      {participants.slice(visibleParticipantIndex, visibleParticipantIndex + 3).map((p, idx) => (
        <motion.div
          key={`${p.id}-${visibleParticipantIndex}`}
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: 20 }}
          transition={{ 
            duration: 0.5,
            delay: idx * 0.1
          }}
          className="bg-cyan-800/50 rounded-lg p-3 border border-cyan-600/50 mb-2"
        >
          <div className="flex items-center gap-2">
            <motion.div 
              animate={isDrawing ? {
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              } : {}}
              transition={isDrawing ? {
                duration: 0.4,
                repeat: Infinity,
                ease: "easeInOut"
              } : {}}
            >
              <ParticipantAvatar
                imageUrl={getParticipantImageUrl?.(p)}
                fallback={p.user_avatar}
                sizeClass="h-12 w-12 text-2xl"
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-base truncate">{p.user_name}</div>
              <div className="text-xs text-cyan-400">ID: {maskPlatformId(p.user_platform_id)}</div>
              <div className="text-xs text-cyan-300 italic truncate">"{p.game_call}"</div>
              <div className="text-xs text-cyan-500">{p.attempts || 0}/{maxAttempts}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function GameCallDrawTab() {
  const queryClient = useQueryClient();
  const [newRaffleTitle, setNewRaffleTitle] = useState("");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [maxWinners, setMaxWinners] = useState(1);
  const [winnersPerDraw, setWinnersPerDraw] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [animatingWinners, setAnimatingWinners] = useState([]);
  const [finalWinners, setFinalWinners] = useState([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [particles, setParticles] = useState([]);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationDrawing, setSimulationDrawing] = useState(false);

  const { data: activeRaffle } = useQuery({
    queryKey: ['admin-active-gamecall'],
    queryFn: async () => {
      const raffles = await base44.entities.GameCallRaffle.filter({ active: true, ended: false });
      return raffles[0] || null;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['admin-gamecall-participants', activeRaffle?.id],
    queryFn: () => base44.entities.GameCallParticipant.filter({ raffle_id: activeRaffle.id }, '-created_date'),
    enabled: !!activeRaffle,
  });

  const { data: validatedWinners = [] } = useQuery({
    queryKey: ['validated-gamecall-winners', activeRaffle?.id],
    queryFn: () => base44.entities.GameCallParticipant.filter({ 
      raffle_id: activeRaffle.id,
      validated: true
    }),
    enabled: !!activeRaffle,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['gamecall-users-avatars'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000,
  });

  const usersById = React.useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const getParticipantImageUrl = (participant) => {
    if (!participant) return "";

    if (participant.user_profile_image_url) {
      return resolveAssetUrl(participant.user_profile_image_url);
    }

    const linkedUser = usersById[participant.user_id];
    if (linkedUser?.profile_image_status === "approved" && linkedUser?.profile_image_url) {
      return resolveAssetUrl(linkedUser.profile_image_url);
    }

    return "";
  };

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

  const createRaffleMutation = useMutation({
    mutationFn: () => base44.adminEvents.gameCalls.create({
      title: newRaffleTitle,
      prizeAmount: parseFloat(prizeAmount),
      maxAttempts,
      maxWinners,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-gamecall'] });
      queryClient.invalidateQueries({ queryKey: ['active-gamecall-raffle'] });
      setNewRaffleTitle("");
      setPrizeAmount("");
      setMaxAttempts(3);
      setMaxWinners(1);
    },
  });

  const updateRaffleSettingsMutation = useMutation({
    mutationFn: ({ maxAttempts, maxWinners }) => base44.adminEvents.gameCalls.update(activeRaffle.id, { maxAttempts, maxWinners }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-gamecall'] });
      queryClient.invalidateQueries({ queryKey: ['active-gamecall-raffle'] });
    },
  });

  const endRaffleMutation = useMutation({
    mutationFn: (raffleId) => base44.adminEvents.gameCalls.end(raffleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-gamecall'] });
      queryClient.invalidateQueries({ queryKey: ['active-gamecall-raffle'] });
      setFinalWinners([]);
      setShowAnimation(false);
    },
  });

  const validateWinnerMutation = useMutation({
    mutationFn: async ({ participant }) => base44.adminEvents.gameCalls.updateParticipant(participant.id, "validate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-gamecall-winners'] });
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
    },
  });

  const invalidateWinnerMutation = useMutation({
    mutationFn: async ({ participant }) => base44.adminEvents.gameCalls.updateParticipant(participant.id, "invalidate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-gamecall-winners'] });
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
    },
  });

  const reactivateWinnerMutation = useMutation({
    mutationFn: (participantId) => base44.adminEvents.gameCalls.updateParticipant(participantId, "reactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-gamecall-winners'] });
    },
  });

  const clearParticipantsMutation = useMutation({
    mutationFn: async () => base44.adminEvents.gameCalls.clearParticipants(activeRaffle.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] }),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => base44.adminEvents.gameCalls.removeParticipant(participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] });
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
    },
  });

  const reactivateParticipantMutation = useMutation({
    mutationFn: (participantId) => base44.adminEvents.gameCalls.updateParticipant(participantId, "reactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gamecall-participants'] });
      queryClient.invalidateQueries({ queryKey: ['my-gamecall-participation'] });
    },
  });

  const maskPlatformId = (platformId) => {
    if (!platformId) return "****";
    const cleaned = platformId.toString();
    if (cleaned.length <= 4) return "****";
    const lastFour = cleaned.slice(-4);
    return `****${lastFour}`;
  };

  const drawMutation = useMutation({
    mutationFn: ({ raffleId, winnerCount }) => base44.adminEvents.gameCalls.draw(raffleId, { winnerCount }),
  });

  const handleDraw = async () => {
    const eligibleParticipants = participants.filter(p => 
      p.validation_status === 'pending' && 
      !p.validated && 
      (p.attempts || 0) < (activeRaffle.max_attempts || 3)
    );

    if (eligibleParticipants.length === 0) {
      alert("Não há participantes elegíveis para sortear!");
      return;
    }

    const drawCount = Math.min(winnersPerDraw, eligibleParticipants.length);
    
    setIsDrawing(true);
    setShowAnimation(true);
    setAnimatingWinners([]);

    let winners = [];
    try {
      const response = await drawMutation.mutateAsync({
        raffleId: activeRaffle.id,
        winnerCount: drawCount,
      });
      winners = response?.winners || [];
    } catch (error) {
      setIsDrawing(false);
      setShowAnimation(false);
      alert(error?.message || "Erro ao sortear participantes.");
      return;
    }

    const animationDuration = 10000;
    const interval = 100;
    let elapsed = 0;

    const animationInterval = setInterval(() => {
      const randomParticipant = eligibleParticipants[Math.floor(Math.random() * eligibleParticipants.length)];
      setAnimatingWinners([randomParticipant]);
      elapsed += interval;

      if (elapsed >= animationDuration) {
        clearInterval(animationInterval);
        setAnimatingWinners([]);
        setFinalWinners(winners);
        setIsDrawing(false);

        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 }
        });

        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 120,
            origin: { y: 0.6 }
          });
        }, 300);
      }
    }, interval);
  };

  const handleValidate = (winner) => {
    validateWinnerMutation.mutate({
      participant: winner,
    });
    setFinalWinners(prev => prev.filter(w => w.id !== winner.id));
    
    if (finalWinners.length === 1) {
      setTimeout(() => {
        setShowAnimation(false);
      }, 1000);
    }
  };

  const handleInvalidate = (winner) => {
    invalidateWinnerMutation.mutate({
      participant: winner,
    });
    setFinalWinners(prev => prev.filter(w => w.id !== winner.id));
    
    if (finalWinners.length === 1) {
      setTimeout(() => {
        setShowAnimation(false);
      }, 1000);
    }
  };

  const handleReactivate = (winnerId) => {
    reactivateWinnerMutation.mutate(winnerId);
  };

  const activeParticipants = participants.filter(p => 
    p.validation_status === 'pending' && 
    !p.validated &&
    (p.attempts || 0) < (activeRaffle?.max_attempts || 3)
  );

  const particleSpeed = isDrawing ? 0.3 : 1.5;

  const mockParticipants = [
    { id: '1', user_avatar: '', user_name: 'João Silva', user_platform_id: '12345', game_call: 'Fortune Tiger', attempts: 1, user_nick: 'joaosilva' },
    { id: '2', user_avatar: '', user_name: 'Maria Santos', user_platform_id: '67890', game_call: 'Gates of Olympus', attempts: 0, user_nick: 'mariasantos' },
    { id: '3', user_avatar: '', user_name: 'Pedro Costa', user_platform_id: '11111', game_call: 'Sweet Bonanza', attempts: 2, user_nick: 'pedrocosta' },
    { id: '4', user_avatar: ' ', user_name: 'Ana Oliveira', user_platform_id: '22222', game_call: 'Spaceman', attempts: 1, user_nick: 'anaoliveira' },
    { id: '5', user_avatar: '', user_name: 'Carlos Souza', user_platform_id: '33333', game_call: 'Aviator', attempts: 0, user_nick: 'carlossouza' },
  ];

  const [simulationWinnersPerDraw, setSimulationWinnersPerDraw] = useState(1);
  const [simulationAnimatingWinners, setSimulationAnimatingWinners] = useState([]);
  const [simulationFinalWinners, setSimulationFinalWinners] = useState([]);
  const [simulationShowAnimation, setSimulationShowAnimation] = useState(false);

  const handleSimulationDraw = () => {
    const drawCount = Math.min(simulationWinnersPerDraw, mockParticipants.length);
    
    setSimulationDrawing(true);
    setSimulationShowAnimation(true);
    setSimulationAnimatingWinners([]);

    // Algoritmo Fisher-Yates (extremamente aleatório e justo)
    const shuffled = [...mockParticipants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Embaralha múltiplas vezes com crypto.getRandomValues para máxima aleatoriedade
    const cryptoArray = new Uint32Array(shuffled.length);
    crypto.getRandomValues(cryptoArray);
    shuffled.sort((a, b) => {
      const aIndex = shuffled.indexOf(a);
      const bIndex = shuffled.indexOf(b);
      return cryptoArray[aIndex] - cryptoArray[bIndex];
    });
    
    const winners = shuffled.slice(0, drawCount);

    const animationDuration = 10000;
    const interval = 100;
    let elapsed = 0;

    const animationInterval = setInterval(() => {
      const randomParticipant = mockParticipants[Math.floor(Math.random() * mockParticipants.length)];
      setSimulationAnimatingWinners([randomParticipant]);
      elapsed += interval;

      if (elapsed >= animationDuration) {
        clearInterval(animationInterval);
        setSimulationAnimatingWinners([]);
        setSimulationFinalWinners(winners);
        setSimulationDrawing(false);

        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 }
        });

        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 120,
            origin: { y: 0.6 }
          });
        }, 300);
      }
    }, interval);
  };

  const simulationParticleSpeed = simulationDrawing ? 0.3 : 1.5;

  return (
    <Tabs defaultValue="control" className="mt-6">
      <TabsList className="grid w-full grid-cols-2 bg-blue-900/50">
        <TabsTrigger value="control">Controle</TabsTrigger>
        <TabsTrigger value="display">Tela do Sorteio</TabsTrigger>
      </TabsList>

      <TabsContent value="control">
        <div className="space-y-6">
          {/* Simulação */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-purple-300"> Simulação da Tela</h3>
                <p className="text-sm text-purple-400">Visualize como ficará antes de ativar</p>
              </div>
              <Button
                onClick={() => setShowSimulation(!showSimulation)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {showSimulation ? 'Ocultar Simulação' : 'Ver Simulação'}
              </Button>
            </div>

            {showSimulation && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 mt-4">
                <Card className="min-h-[600px] bg-gradient-to-br from-blue-950 to-cyan-950 rounded-2xl border-4 border-cyan-500/50 shadow-2xl overflow-hidden relative">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-blue-600/10 to-cyan-600/10 animate-pulse" />
                    
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0" style={{
                        backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)',
                        backgroundSize: '50px 50px'
                      }} />
                    </div>

                    {particles.map((particle) => (
                      <motion.div
                        key={particle.id}
                        className="absolute rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40"
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
                          duration: particle.duration * 1.5,
                          delay: particle.delay,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    ))}

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
                            duration: icon.duration * 1.5,
                            delay: icon.delay,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <IconComponent size={icon.size} strokeWidth={2} />
                        </motion.div>
                      );
                    })}

                    <motion.div
                      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                      animate={{
                        top: ['0%', '100%'],
                        opacity: [0, 1, 0]
                      }}
                      transition={{
                        duration: simulationDrawing ? 1 : 4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                    <motion.div
                      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                      animate={{
                        top: ['100%', '0%'],
                        opacity: [0, 1, 0]
                      }}
                      transition={{
                        duration: simulationDrawing ? 1 : 4,
                        repeat: Infinity,
                        ease: "linear",
                        delay: simulationDrawing ? 0.5 : 2
                      }}
                    />
                    
                    <motion.div
                      className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
                      animate={{
                        left: ['0%', '100%'],
                        opacity: [0, 1, 0]
                      }}
                      transition={{
                        duration: simulationDrawing ? 1.5 : 5,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  </div>
                  
                  {!simulationShowAnimation ? (
                    <div className="relative h-full flex flex-col items-center justify-center p-8 pt-32 z-10">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="mb-8"
                      >
                        <Gamepad2 className="w-24 h-24 text-cyan-400" />
                      </motion.div>
                      
                      <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 mb-3 text-center">
                        CALL DE JOGO DA LIVE
                      </h2>
                      <p className="text-xl text-cyan-300 mb-8">Prêmio: R$ 30.00</p>
                      
                      <div className="mb-6 px-6 py-3 bg-cyan-900/50 rounded-lg border border-cyan-600/50">
                        <div className="flex items-center gap-4">
                          <Label className="text-cyan-200">Quantidade:</Label>
                          <Input
                            type="number"
                            value={simulationWinnersPerDraw}
                            onChange={(e) => setSimulationWinnersPerDraw(parseInt(e.target.value))}
                            min="1"
                            max="5"
                            className="w-24 bg-cyan-900/50 border-cyan-700 text-white text-center"
                          />
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleSimulationDraw}
                        disabled={simulationDrawing}
                        className="px-10 py-6 text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white shadow-2xl transform hover:scale-105 transition-all"
                      >
                        <Sparkles className="w-6 h-6 mr-2" />
                        {simulationDrawing ? "SORTEANDO..." : "INICIAR SORTEIO"}
                      </Button>

                      <div className="mt-8 p-3 bg-cyan-900/50 rounded-lg border border-cyan-600/50">
                        <p className="text-cyan-200 text-center">
                          a 5 participantes (simulação)
                        </p>
                      </div>
                    </div>
                  ) : simulationFinalWinners.length > 0 ? (
                    <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                      <Trophy className="w-20 h-20 text-cyan-400 mb-4 animate-bounce" />
                      <h3 className="text-4xl font-bold text-cyan-300 mb-6"> GANHADORES! </h3>
                      
                      <div className="space-y-4 w-full max-w-2xl mb-6">
                        {simulationFinalWinners.map((winner, idx) => (
                          <motion.div
                            key={winner.id}
                            initial={{ x: -100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.3 }}
                            className="bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-2 border-cyan-500 rounded-xl p-5 text-center"
                          >
                            <div className="mb-2 flex justify-center">
                              <ParticipantAvatar
                                imageUrl={getParticipantImageUrl(winner)}
                                fallback={winner.user_avatar}
                                sizeClass="h-16 w-16 text-3xl"
                              />
                            </div>
                            <p className="text-2xl font-bold text-cyan-200 mb-1">{winner.user_name}</p>
                            <p className="text-lg text-cyan-300">@{winner.user_nick}</p>
                            <p className="text-sm text-cyan-500 mt-1">ID: {maskPlatformId(winner.user_platform_id)}</p>
                            <div className="p-3 bg-cyan-900/50 border border-cyan-500 rounded-lg mt-3 mb-2">
                              <p className="text-xs text-cyan-300 mb-1">Call escolhida:</p>
                              <p className="text-lg font-bold text-yellow-300 italic">"{winner.game_call}"</p>
                            </div>
                            <p className="text-xs text-cyan-400">Tentativas: {winner.attempts}/3</p>
                            <p className="text-xl font-bold text-green-400 mt-2">R$ 30.00</p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="w-full max-w-2xl space-y-2 mb-4">
                        {simulationFinalWinners.map((winner) => (
                          <div key={`validate-${winner.id}`} className="flex items-center justify-between p-3 bg-cyan-900/50 border border-cyan-700/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <ParticipantAvatar
                                imageUrl={getParticipantImageUrl(winner)}
                                fallback={winner.user_avatar}
                                sizeClass="h-10 w-10 text-xl"
                              />
                              <div className="text-left">
                                <div className="font-bold text-white text-sm">{winner.user_name}</div>
                                <div className="text-xs text-cyan-300">ID: {maskPlatformId(winner.user_platform_id)} ⬢ "{winner.game_call}"</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSimulationFinalWinners(prev => prev.filter(w => w.id !== winner.id));
                                  if (simulationFinalWinners.length === 1) {
                                    setSimulationShowAnimation(false);
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Validar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSimulationFinalWinners(prev => prev.filter(w => w.id !== winner.id));
                                  if (simulationFinalWinners.length === 1) {
                                    setSimulationShowAnimation(false);
                                  }
                                }}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Anular
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={() => {
                          setSimulationFinalWinners([]);
                          setSimulationShowAnimation(false);
                        }}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        Fechar Resultados
                      </Button>
                    </div>
                  ) : (
                    <div className="relative h-full flex items-center justify-center z-10">
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
                        <Gamepad2 className="w-40 h-40 text-cyan-400/40 drop-shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                      </motion.div>

                      <AnimatePresence mode="wait">
                        {simulationAnimatingWinners.map((p) => (
                          <motion.div
                            key={p.id}
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
                              <ParticipantAvatar
                                imageUrl={getParticipantImageUrl(p)}
                                fallback={p.user_avatar}
                                sizeClass="h-14 w-14 text-2xl"
                              />
                            </motion.div>
                            <p className="text-4xl font-bold text-white">{p.user_name}</p>
                            <p className="text-2xl text-cyan-300 mt-2">@{p.user_nick}</p>
                            <p className="text-xl text-cyan-400 mt-2">ID: {maskPlatformId(p.user_platform_id)}</p>
                            <div className="mt-3 p-3 bg-cyan-900/50 border border-cyan-500 rounded-lg inline-block">
                              <p className="text-sm text-cyan-300">Call:</p>
                              <p className="text-xl font-bold text-yellow-300 italic">"{p.game_call}"</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </Card>

                <Card className="bg-cyan-900/90 backdrop-blur-lg rounded-xl border-2 border-cyan-600/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-3 text-center">
                    <p className="text-white font-bold">Participantes</p>
                    <p className="text-xs text-cyan-100">5</p>
                  </div>
                  
                  <div className="h-[540px] flex flex-col justify-center p-4">
                    <GameCallParticipantsList 
                      participants={mockParticipants} 
                      isDrawing={simulationDrawing}
                      maskPlatformId={maskPlatformId}
                      maxAttempts={3}
                      getParticipantImageUrl={getParticipantImageUrl}
                    />
                  </div>
                  
                  {simulationFinalWinners.length > 0 && (
                    <div className="p-3 bg-cyan-900/50 border-t border-cyan-600/50">
                      <p className="text-xs text-cyan-200 text-center font-bold">
                          {simulationFinalWinners.length} sorteado(s)
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </Card>

          {!activeRaffle ? (
            <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-700/50 p-6">
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
                Criar Sorteio de Call de Jogo
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-blue-200">Título do Sorteio</Label>
                  <Input
                    id="title"
                    value={newRaffleTitle}
                    onChange={(e) => setNewRaffleTitle(e.target.value)}
                    placeholder="Ex: Call de Jogo da Live"
                    className="bg-blue-900/50 border-blue-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="prize" className="text-blue-200">Valor do Prêmio (R$)</Label>
                  <Input
                    id="prize"
                    type="number"
                    value={prizeAmount}
                    onChange={(e) => setPrizeAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="bg-blue-900/50 border-blue-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxAttempts" className="text-blue-200">Máximo de Tentativas</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                      min="1"
                      className="bg-blue-900/50 border-blue-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxWinners" className="text-blue-200">Total de Ganhadores</Label>
                    <Input
                      id="maxWinners"
                      type="number"
                      value={maxWinners}
                      onChange={(e) => setMaxWinners(parseInt(e.target.value))}
                      min="1"
                      className="bg-blue-900/50 border-blue-700 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => createRaffleMutation.mutate()}
                  disabled={!newRaffleTitle || !prizeAmount}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Ativar Sorteio
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border-cyan-700/50 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-cyan-300">{activeRaffle.title}</h2>
                    <p className="text-cyan-200">
                      {activeParticipants.length} participantes elegíveis ⬢ {activeRaffle.max_winners} ganhador(es) ⬢ R$ {activeRaffle.prize_amount?.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={() => endRaffleMutation.mutate(activeRaffle.id)}
                    variant="destructive"
                  >
                    Desativar Sorteio
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="maxAttempts" className="text-cyan-200">Máximo de Tentativas</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        value={activeRaffle.max_attempts || 3}
                        onChange={(e) => updateRaffleSettingsMutation.mutate({
                          maxAttempts: parseInt(e.target.value),
                          maxWinners: activeRaffle.max_winners || 1
                        })}
                        min="1"
                        className="bg-blue-900/50 border-blue-700 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxWinners" className="text-cyan-200">Total de Ganhadores</Label>
                      <Input
                        id="maxWinners"
                        type="number"
                        value={activeRaffle.max_winners || 1}
                        onChange={(e) => updateRaffleSettingsMutation.mutate({
                          maxAttempts: activeRaffle.max_attempts || 3,
                          maxWinners: parseInt(e.target.value)
                        })}
                        min="1"
                        className="bg-blue-900/50 border-blue-700 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="winnersPerDraw" className="text-cyan-200">Quantidade por Sorteio</Label>
                      <Input
                        id="winnersPerDraw"
                        type="number"
                        value={winnersPerDraw}
                        onChange={(e) => setWinnersPerDraw(parseInt(e.target.value))}
                        min="1"
                        max={activeRaffle.max_winners}
                        className="bg-blue-900/50 border-blue-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => clearParticipantsMutation.mutate()}
                      variant="outline"
                      className="border-red-600 text-red-400 hover:bg-red-900/30"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar Lista
                    </Button>
                  </div>
                </div>
              </Card>

              {finalWinners.length > 0 && (
                <Card className="bg-gradient-to-br from-yellow-900/50 to-orange-900/50 border-yellow-700/50 p-6">
                  <h3 className="text-xl font-bold text-yellow-300 mb-4"> Ganhadores Sorteados</h3>
                  <p className="text-sm text-yellow-200 mb-4">Valide ou anule os resultados:</p>
                  <div className="space-y-3">
                    {finalWinners.map((winner) => (
                      <div key={winner.id} className="flex items-center justify-between p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-12 w-12 text-2xl"
                          />
                          <div>
                            <div className="font-bold text-yellow-200">{winner.user_name}</div>
                            <div className="text-sm text-yellow-300">@{winner.user_nick} ⬢ ID: {maskPlatformId(winner.user_platform_id)}</div>
                            <div className="text-xs text-yellow-400 italic">Call: "{winner.game_call}" ⬢ {winner.attempts || 0}/{activeRaffle.max_attempts} tentativas</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleValidate(winner)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Validar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleInvalidate(winner)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Anular
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
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-12 w-12 text-2xl"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-green-200">{winner.user_name}</div>
                            <div className="text-sm text-green-300">@{winner.user_nick} ⬢ ID: {maskPlatformId(winner.user_platform_id)}</div>
                            <div className="text-xs text-green-400 italic truncate">Call: "{winner.game_call}"</div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleReactivate(winner.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Reativar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => invalidateWinnerMutation.mutate({ 
                              participant: winner,
                              raffleTitle: activeRaffle.title,
                              prizeAmount: activeRaffle.prize_amount
                            })}
                            className="border-red-600 text-red-400"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Anular
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-700/50 p-6">
                <h3 className="text-xl font-bold text-cyan-300 mb-4">
                  Participantes Ativos ({activeParticipants.length})
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {activeParticipants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-cyan-900/30 border border-cyan-700/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <ParticipantAvatar
                          imageUrl={getParticipantImageUrl(p)}
                          fallback={p.user_avatar}
                          sizeClass="h-10 w-10 text-xl"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-cyan-100">{p.user_name}</div>
                          <div className="text-xs text-cyan-300">ID: {maskPlatformId(p.user_platform_id)}</div>
                          <div className="text-xs text-cyan-400 italic truncate max-w-xs">"{p.game_call}"</div>
                          <div className="text-xs text-cyan-500">
                            {format(new Date(p.created_date), 'HH:mm:ss')} ⬢ {p.attempts || 0}/{activeRaffle.max_attempts} tentativas
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-600">
                          Pendente
                        </Badge>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Remover ${p.user_name} da lista?`)) {
                              removeParticipantMutation.mutate(p.id);
                            }
                          }}
                          className="h-8"
                        >
                          <UserMinus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="display">
        {activeRaffle && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 mt-6">
            <Card className="min-h-[600px] bg-gradient-to-br from-blue-950 to-cyan-950 rounded-2xl border-4 border-cyan-500/50 shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-blue-600/10 to-cyan-600/10 animate-pulse" />
                
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }} />
                </div>

                {particles.map((particle) => (
                  <motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40"
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

                <motion.div
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
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
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
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
                  className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
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
                <div className="relative h-full flex flex-col items-center justify-center p-8 pt-32 z-10">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mb-8"
                  >
                    <Gamepad2 className="w-24 h-24 text-cyan-400" />
                  </motion.div>
                  
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 mb-8 text-center">
                    {activeRaffle.title}
                  </h2>
                  
                  <div className="mb-6 px-6 py-3 bg-cyan-900/50 rounded-lg border border-cyan-600/50">
                    <div className="flex items-center gap-4">
                      <Label className="text-cyan-200">Quantidade:</Label>
                      <Input
                        type="number"
                        value={winnersPerDraw}
                        onChange={(e) => setWinnersPerDraw(parseInt(e.target.value))}
                        min="1"
                        max={activeRaffle.max_winners}
                        className="w-24 bg-cyan-900/50 border-cyan-700 text-white text-center"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleDraw}
                    disabled={isDrawing || activeParticipants.length === 0}
                    className="px-10 py-6 text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white shadow-2xl transform hover:scale-105 transition-all"
                  >
                    <Sparkles className="w-6 h-6 mr-2" />
                    {isDrawing ? "SORTEANDO..." : "INICIAR SORTEIO"}
                  </Button>

                  <div className="mt-8 p-3 bg-cyan-900/50 rounded-lg border border-cyan-600/50">
                    <p className="text-cyan-200 text-center">
                      a {activeParticipants.length} participantes elegíveis
                    </p>
                  </div>
                </div>
              ) : finalWinners.length > 0 ? (
                <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                  <Trophy className="w-20 h-20 text-cyan-400 mb-4 animate-bounce" />
                  <h3 className="text-4xl font-bold text-cyan-300 mb-6"> GANHADORES! </h3>
                  
                  <div className="space-y-4 w-full max-w-2xl mb-6">
                    {finalWinners.map((winner, idx) => (
                      <motion.div
                        key={winner.id}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.3 }}
                        className="bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-2 border-cyan-500 rounded-xl p-5 text-center"
                      >
                        <div className="mb-2 flex justify-center">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-16 w-16 text-3xl"
                          />
                        </div>
                        <p className="text-2xl font-bold text-cyan-200 mb-1">{winner.user_name}</p>
                        <p className="text-lg text-cyan-300">@{winner.user_nick}</p>
                        <p className="text-sm text-cyan-500 mt-1">ID: {maskPlatformId(winner.user_platform_id)}</p>
                        <div className="p-3 bg-cyan-900/50 border border-cyan-500 rounded-lg mt-3 mb-2">
                          <p className="text-xs text-cyan-300 mb-1">Call escolhida:</p>
                          <p className="text-lg font-bold text-yellow-300 italic">"{winner.game_call}"</p>
                        </div>
                        <p className="text-xs text-cyan-400">Tentativas: {winner.attempts || 0}/{activeRaffle.max_attempts}</p>
                        <p className="text-xl font-bold text-green-400 mt-2">
                          R$ {activeRaffle.prize_amount?.toFixed(2)}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="w-full max-w-2xl space-y-2">
                    {finalWinners.map((winner) => (
                      <div key={`validate-${winner.id}`} className="flex items-center justify-between p-3 bg-cyan-900/50 border border-cyan-700/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-10 w-10 text-xl"
                          />
                          <div className="text-left">
                            <div className="font-bold text-white text-sm">{winner.user_name}</div>
                            <div className="text-xs text-cyan-300">ID: {maskPlatformId(winner.user_platform_id)} ⬢ "{winner.game_call}"</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleValidate(winner)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Validar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleInvalidate(winner)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Anular
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative h-full flex items-center justify-center z-10">
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
                    <Gamepad2 className="w-40 h-40 text-cyan-400/40 drop-shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {animatingWinners.map((p) => (
                      <motion.div
                        key={p.id}
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
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(p)}
                            fallback={p.user_avatar}
                            sizeClass="h-14 w-14 text-2xl"
                          />
                        </motion.div>
                        <p className="text-4xl font-bold text-white">{p.user_name}</p>
                        <p className="text-2xl text-cyan-300 mt-2">@{p.user_nick}</p>
                        <p className="text-xl text-cyan-400 mt-2">ID: {maskPlatformId(p.user_platform_id)}</p>
                        <div className="mt-3 p-3 bg-cyan-900/50 border border-cyan-500 rounded-lg inline-block">
                          <p className="text-sm text-cyan-300">Call:</p>
                          <p className="text-xl font-bold text-yellow-300 italic">"{p.game_call}"</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>

            <Card className="bg-cyan-900/90 backdrop-blur-lg rounded-xl border-2 border-cyan-600/50 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-3 text-center">
                <p className="text-white font-bold">Participantes</p>
                <p className="text-xs text-cyan-100">{activeParticipants.length}</p>
              </div>
              
              <div className="h-[540px] flex flex-col justify-center p-4">
                <GameCallParticipantsList 
                  participants={activeParticipants} 
                  isDrawing={isDrawing}
                  maskPlatformId={maskPlatformId}
                  maxAttempts={activeRaffle.max_attempts}
                  getParticipantImageUrl={getParticipantImageUrl}
                />
              </div>
            </Card>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
