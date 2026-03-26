import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Play, Trash2, Check, X, Trophy, Sparkles, Gift, Coins, Crown, Dices, Gem } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const CASINOO_ICOONS = [
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
        className={`${sizeClass} rounded-full border border-purple-300/70 object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full border border-purple-300/70 bg-purple-900/40`}>
      {fallback || "U"}
    </div>
  );
}

function LiveParticipantsList({ participants, isDrawing, maskPhone, maskPlatformId, getParticipantImageUrl }) {
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
          className="bg-purple-800/50 rounded-lg p-3 border border-purple-600/50 mb-2"
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
              <div className="text-xs text-purple-400">{maskPhone(p.user_phone)}</div>
              <div className="text-xs text-purple-500">ID: {maskPlatformId(p.user_platform_id)}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function LiveDrawTab() {
  const queryClient = useQueryClient();
  const [newRaffleTitle, setNewRaffleTitle] = useState("");
  const [maxWinners, setMaxWinners] = useState(1);
  const [winnersPerDraw, setWinnersPerDraw] = useState(1);
  const [prizeAmount, setPrizeAmount] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [animatingWinners, setAnimatingWinners] = useState([]);
  const [finalWinners, setFinalWinners] = useState([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [particles, setParticles] = useState([]);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationDrawing, setSimulationDrawing] = useState(false);

  const mockParticipants = [
    { id: '1', user_avatar: '', user_name: 'João Silva', user_phone: '11987654321', user_platform_id: '12345', user_nick: 'joaosilva' },
    { id: '2', user_avatar: '', user_name: 'Maria Santos', user_phone: '11976543210', user_platform_id: '67890', user_nick: 'mariasantos' },
    { id: '3', user_avatar: '', user_name: 'Pedro Costa', user_phone: '11965432109', user_platform_id: '11111', user_nick: 'pedrocosta' },
    { id: '4', user_avatar: ' ', user_name: 'Ana OOliveira', user_phone: '11954321098', user_platform_id: '22222', user_nick: 'anaoliveira' },
    { id: '5', user_avatar: '', user_name: 'Carlos Souza', user_phone: '11943210987', user_platform_id: '33333', user_nick: 'carlossouza' },
  ];

  const [simulationWinnersPerDraw, setSimulationWinnersPerDraw] = useState(1);
  const [simulationAnimatingWinners, setSimulationAnimatingWinners] = useState([]);
  const [simulationFinalWinners, setSimulationFinalWinners] = useState([]);
  const [simulationShowAnimation, setSimulationShowAnimation] = useState(false);

  const { data: activeRaffle } = useQuery({
    queryKey: ['active-raffle'],
    queryFn: async () => {
      const response = await base44.adminEvents.liveDraws.current();
      return response?.item || null;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['raffle-participants', activeRaffle?.id],
    queryFn: async () => {
      const response = await base44.adminEvents.liveDraws.listParticipants(activeRaffle.id);
      return response?.items || [];
    },
    enabled: !!activeRaffle,
  });

  const getParticipantImageUrl = (participant) => {
    if (!participant) return "";
    return participant.user_profile_image_url
      ? resolveAssetUrl(participant.user_profile_image_url)
      : "";
  };

  useEffect(() => {
    if (activeRaffle) {
      setAdminName(activeRaffle.admin_name || "");
      setAdminPhone(activeRaffle.admin_phone || "");
      return;
    }
    setAdminName("");
    setAdminPhone("");
  }, [activeRaffle]);

  useEffect(() => {
    if (!activeRaffle) {
      setFinalWinners([]);
      setShowAnimation(false);
      return;
    }

    const pendingIds = Array.isArray(activeRaffle.pending_draw_candidates)
      ? activeRaffle.pending_draw_candidates.map((id) => String(id))
      : [];

    if (pendingIds.length === 0) {
      if (!isDrawing) {
        setFinalWinners([]);
        setShowAnimation(false);
      }
      return;
    }

    const pendingWinners = pendingIds
      .map((id) => participants.find((participant) => String(participant.id) === id))
      .filter(Boolean);

    if (pendingWinners.length > 0 && !isDrawing) {
      setFinalWinners(pendingWinners);
      setShowAnimation(false);
    }
  }, [activeRaffle, participants, isDrawing]);

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
      ...CASINOO_ICOONS[i % CASINOO_ICOONS.length],
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
    mutationFn: async () => base44.adminEvents.liveDraws.create({
      title: newRaffleTitle,
      maxWinners,
      prizeAmount: parseFloat(prizeAmount),
      adminName,
      adminPhone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-live-raffle-box'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
      setNewRaffleTitle("");
      setMaxWinners(1);
      setPrizeAmount("");
      setAdminName("");
      setAdminPhone("");
    },
  });

  const updateRaffleMutation = useMutation({
    mutationFn: ({ adminName: nextAdminName, adminPhone: nextAdminPhone }) =>
      base44.adminEvents.liveDraws.update(activeRaffle.id, { adminName: nextAdminName, adminPhone: nextAdminPhone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-live-raffle-box'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['winner-raffles'] });
      queryClient.invalidateQueries({ queryKey: ['user-prize-gallery'] });
    },
  });

  const endRaffleMutation = useMutation({
    mutationFn: (raffleId) => base44.adminEvents.liveDraws.end(raffleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['active-live-raffle-box'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
      setFinalWinners([]);
      setShowAnimation(false);
    },
  });

  const validateWinnerMutation = useMutation({
    mutationFn: async ({ participant }) => base44.adminEvents.liveDraws.updateParticipant(participant.id, "validate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-winners'] });
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['my-winnings'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
    },
  });

  const invalidateWinnerMutation = useMutation({
    mutationFn: async ({ participant }) => base44.adminEvents.liveDraws.updateParticipant(participant.id, "invalidate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-winners'] });
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['my-winnings'] });
      queryClient.invalidateQueries({ queryKey: ['winner-audits'] });
    },
  });

  const reactivateWinnerMutation = useMutation({
    mutationFn: (participantId) => base44.adminEvents.liveDraws.updateParticipant(participantId, "reactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['validated-winners'] });
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
    },
  });

  const clearParticipantsMutation = useMutation({
    mutationFn: async () => base44.adminEvents.liveDraws.clearParticipants(activeRaffle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => base44.adminEvents.liveDraws.removeParticipant(participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-participants'] });
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
    },
  });

  const drawMutation = useMutation({
    mutationFn: ({ raffleId, winnerCount }) => base44.adminEvents.liveDraws.draw(raffleId, { winnerCount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-raffle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-dynamics-summary'] });
    },
  });

  const maskPhone = (phone) => {
    if (!phone) return "****";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return "****";
    const lastFour = cleaned.slice(-4);
    return `****${lastFour}`;
  };

  const maskPlatformId = (platformId) => {
    if (!platformId) return "****";
    const cleaned = platformId.toString();
    if (cleaned.length <= 4) return "****";
    const lastFour = cleaned.slice(-4);
    return `****${lastFour}`;
  };

  const handleDraw = async () => {
    if (activeParticipants.length === 0) {
      alert("Não há participantes elegíveis para sortear!");
      return;
    }

    const drawCount = Math.min(winnersPerDraw, activeParticipants.length);
    
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
      const randomParticipant = activeParticipants[Math.floor(Math.random() * activeParticipants.length)];
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

  const handleSimulationDraw = () => {
    const drawCount = Math.min(simulationWinnersPerDraw, mockParticipants.length);
    
    setSimulationDrawing(true);
    setSimulationShowAnimation(true);
    setSimulationAnimatingWinners([]);

    const shuffled = [...mockParticipants].sort(() => Math.random() - 0.5);
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

  // SORTEIO LIVE: Todos que clicarem em participar devem aparecer
  // Não há filtro por depósitos - diferente do Sorteio dos Depositantes
  const validatedWinners = participants.filter((participant) => participant.validation_status === 'validated' || participant.validated);
  const validatedIds = new Set(validatedWinners.map(w => w.id));
  const activeParticipants = participants.filter(p => 
    p.validation_status === 'pending' && 
    !validatedIds.has(p.id)
  );
  const particleSpeed = isDrawing ? 0.3 : 1.5;
  const simulationParticleSpeed = simulationDrawing ? 0.3 : 1.5;

  return (
    <Tabs defaultValue="control" className="mt-6">
      <TabsList className="grid w-full grid-cols-2 bg-purple-900/50">
        <TabsTrigger value="control">Controle</TabsTrigger>
        <TabsTrigger value="display">Tela do Sorteio</TabsTrigger>
      </TabsList>

      <TabsContent value="control">
        <div className="space-y-6">
          {/* Simulação */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-blue-900/50 border-indigo-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-indigo-300"> Simulação da Tela</h3>
                <p className="text-sm text-indigo-400">Visualize como ficará antes de ativar</p>
              </div>
              <Button
                onClick={() => setShowSimulation(!showSimulation)}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              >
                {showSimulation ? 'Ocultar Simulação' : 'Ver Simulação'}
              </Button>
            </div>

            {showSimulation && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 mt-4">
                <Card className="min-h-[600px] bg-gradient-to-br from-purple-950 to-indigo-950 rounded-2xl border-4 border-yellow-500/50 shadow-2xl overflow-hidden relative">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
                    
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0" style={{
                        backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
                        backgroundSize: '50px 50px'
                      }} />
                    </div>

                    {particles.map((particle) => (
                      <motion.div
                        key={particle.id}
                        className="absolute rounded-full bg-gradient-to-br from-yellow-400/40 to-pink-500/40"
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
                          duration: particle.duration * simulationParticleSpeed,
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
                            duration: icon.duration * simulationParticleSpeed,
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
                      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
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
                      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400 to-transparent"
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
                        <Gift className="w-24 h-24 text-yellow-400" />
                      </motion.div>
                      
                      <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 mb-3 text-center">
                        SORTEIO ESPECIAL DA LIVE
                      </h2>
                      <p className="text-xl text-purple-300 mb-8">Prêmio: R$ 50.00</p>
                      
                      <div className="mb-6 px-6 py-3 bg-purple-900/50 rounded-lg border border-purple-600/50">
                        <div className="flex items-center gap-4">
                          <Label className="text-purple-200">Quantidade:</Label>
                          <Input
                            type="number"
                            value={simulationWinnersPerDraw}
                            onChange={(e) => setSimulationWinnersPerDraw(parseInt(e.target.value))}
                            min="1"
                            max="5"
                            className="w-24 bg-purple-900/50 border-purple-700 text-white text-center"
                          />
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleSimulationDraw}
                        disabled={simulationDrawing}
                        className="px-10 py-6 text-xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl transform hover:scale-105 transition-all"
                      >
                        <Sparkles className="w-6 h-6 mr-2" />
                        {simulationDrawing ? "SORTEANDO..." : "INICIAR SORTEIO"}
                      </Button>

                      <div className="mt-8 p-3 bg-purple-900/50 rounded-lg border border-purple-600/50">
                        <p className="text-purple-200 text-center">
                          a 5 participantes (simulação)
                        </p>
                      </div>
                    </div>
                  ) : simulationFinalWinners.length > 0 ? (
                    <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                      <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce" />
                      <h3 className="text-4xl font-bold text-yellow-300 mb-6"> GANHADORES! </h3>
                      
                      <div className="space-y-4 w-full max-w-2xl mb-6">
                        {simulationFinalWinners.map((winner, idx) => (
                          <motion.div
                            key={winner.id}
                            initial={{ x: -100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.3 }}
                            className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-2 border-yellow-500 rounded-xl p-5 text-center"
                          >
                            <div className="mb-2 flex justify-center">
                              <ParticipantAvatar
                                imageUrl={getParticipantImageUrl(winner)}
                                fallback={winner.user_avatar}
                                sizeClass="h-16 w-16 text-3xl"
                              />
                            </div>
                            <p className="text-2xl font-bold text-yellow-200 mb-1">{winner.user_name}</p>
                            <p className="text-lg text-yellow-300">@{winner.user_nick}</p>
                            <p className="text-base text-yellow-400 mt-1">{maskPhone(winner.user_phone)}</p>
                            <p className="text-sm text-yellow-500 mt-1">ID: {maskPlatformId(winner.user_platform_id)}</p>
                            <p className="text-xl font-bold text-green-400 mt-2">R$ 50.00</p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="w-full max-w-2xl space-y-2 mb-4">
                        {simulationFinalWinners.map((winner) => (
                          <div key={`validate-${winner.id}`} className="flex items-center justify-between p-3 bg-purple-900/50 border border-purple-700/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <ParticipantAvatar
                                imageUrl={getParticipantImageUrl(winner)}
                                fallback={winner.user_avatar}
                                sizeClass="h-10 w-10 text-xl"
                              />
                              <div className="text-left">
                                <div className="font-bold text-white text-sm">{winner.user_name}</div>
                                <div className="text-xs text-purple-300">{maskPhone(winner.user_phone)} - ID: {maskPlatformId(winner.user_platform_id)}</div>
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
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
                        <Gift className="w-40 h-40 text-yellow-400/40 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
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
                            <p className="text-2xl text-purple-300 mt-2">@{p.user_nick}</p>
                            <p className="text-xl text-purple-400 mt-2">ID: {maskPlatformId(p.user_platform_id)}</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </Card>

                <Card className="bg-purple-900/90 backdrop-blur-lg rounded-xl border-2 border-purple-600/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 text-center">
                    <p className="text-white font-bold">Participantes</p>
                    <p className="text-xs text-yellow-100">5</p>
                  </div>
                  
                  <div className="h-[540px] flex flex-col justify-center p-4">
                    <LiveParticipantsList 
                      participants={mockParticipants} 
                      isDrawing={simulationDrawing}
                      maskPhone={maskPhone}
                      maskPlatformId={maskPlatformId}
                      getParticipantImageUrl={getParticipantImageUrl}
                    />
                  </div>
                  
                  {simulationFinalWinners.length > 0 && (
                    <div className="p-3 bg-purple-900/50 border-t border-purple-600/50">
                      <p className="text-xs text-purple-200 text-center font-bold">
                          {simulationFinalWinners.length} sorteado(s)
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </Card>

          {!activeRaffle ? (
            <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 p-6">
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                Criar Novo Sorteio ao Vivo
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-purple-200">Título do Sorteio</Label>
                  <Input
                    id="title"
                    value={newRaffleTitle}
                    onChange={(e) => setNewRaffleTitle(e.target.value)}
                    placeholder="Ex: Sorteio Especial da Noite"
                    className="bg-purple-900/50 border-purple-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="winners" className="text-purple-200">Total de Ganhadores</Label>
                    <Input
                      id="winners"
                      type="number"
                      value={maxWinners}
                      onChange={(e) => setMaxWinners(parseInt(e.target.value))}
                      min="1"
                      className="bg-purple-900/50 border-purple-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prize" className="text-purple-200">Valor do Prêmio (R$)</Label>
                    <Input
                      id="prize"
                      type="number"
                      value={prizeAmount}
                      onChange={(e) => setPrizeAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="bg-purple-900/50 border-purple-700 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="liveAdminName" className="text-purple-200">Nome do ADM</Label>
                    <Input
                      id="liveAdminName"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Ex: Souza Cass"
                      className="bg-purple-900/50 border-purple-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="liveAdminPhone" className="text-purple-200">Telefone / WhatsApp do ADM</Label>
                    <Input
                      id="liveAdminPhone"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="Ex: 11999999999"
                      className="bg-purple-900/50 border-purple-700 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => createRaffleMutation.mutate()}
                  disabled={!newRaffleTitle || !prizeAmount}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Ativar Sorteio
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-700/50 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-green-300">{activeRaffle.title}</h2>
                    <p className="text-green-200">
                      {activeParticipants.length} participantes elegíveis - {activeRaffle.max_winners} ganhador(es) - R$ {activeRaffle.prize_amount?.toFixed(2)}
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="activeLiveAdminName" className="text-green-200">Nome do ADM</Label>
                      <Input
                        id="activeLiveAdminName"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="bg-green-900/50 border-green-700 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activeLiveAdminPhone" className="text-green-200">Telefone / WhatsApp do ADM</Label>
                      <Input
                        id="activeLiveAdminPhone"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        className="bg-green-900/50 border-green-700 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="winnersPerDraw" className="text-green-200">Quantidade por Sorteio</Label>
                    <Input
                      id="winnersPerDraw"
                      type="number"
                      value={winnersPerDraw}
                      onChange={(e) => setWinnersPerDraw(parseInt(e.target.value))}
                      min="1"
                      max={activeRaffle.max_winners}
                      className="bg-green-900/50 border-green-700 text-white"
                    />
                    <p className="text-xs text-green-300 mt-1">
                      Sortear de {winnersPerDraw} em {winnersPerDraw} (máx: {activeRaffle.max_winners})
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => updateRaffleMutation.mutate({ adminName, adminPhone })}
                      disabled={updateRaffleMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {updateRaffleMutation.isPending ? "SALVANDO..." : "Salvar Contato do ADM"}
                    </Button>
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
                            <div className="text-sm text-yellow-300">@{winner.user_nick} - {maskPhone(winner.user_phone)}</div>
                            <div className="text-xs text-yellow-400">ID: {maskPlatformId(winner.user_platform_id)}</div>
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
                    ? Ganhadores Validados ({validatedWinners.length})
                  </h3>
                  <div className="space-y-3">
                    {validatedWinners.map((winner) => (
                      <div key={winner.id} className="flex items-center justify-between p-4 bg-green-900/30 border border-green-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-12 w-12 text-2xl"
                          />
                          <div>
                            <div className="font-bold text-green-200">{winner.user_name}</div>
                            <div className="text-sm text-green-300">@{winner.user_nick} - {maskPhone(winner.user_phone)}</div>
                            <div className="text-xs text-green-400">ID: {maskPlatformId(winner.user_platform_id)}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReactivate(winner.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Participar Novamente
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

              <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-6">
                <h3 className="text-xl font-bold text-purple-300 mb-4">
                  Participantes Ativos ({activeParticipants.length})
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {activeParticipants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <ParticipantAvatar
                          imageUrl={getParticipantImageUrl(p)}
                          fallback={p.user_avatar}
                          sizeClass="h-10 w-10 text-xl"
                        />
                        <div>
                          <div className="font-medium text-purple-100">{p.user_name}</div>
                          <div className="text-xs text-purple-400">
                            {maskPhone(p.user_phone)} - {format(new Date(p.created_date), 'HH:mm:ss')}
                          </div>
                          <div className="text-xs text-purple-500">ID: {maskPlatformId(p.user_platform_id)}</div>
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
                            if (confirm(`Remover ${p.user_name} da lista de participantes?`)) {
                              removeParticipantMutation.mutate(p.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
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
            <Card className="min-h-[600px] bg-gradient-to-br from-purple-950 to-indigo-950 rounded-2xl border-4 border-yellow-500/50 shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
                
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }} />
                </div>

                {particles.map((particle) => (
                  <motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-gradient-to-br from-yellow-400/40 to-pink-500/40"
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
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400 to-transparent"
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
                    <Gift className="w-24 h-24 text-yellow-400" />
                  </motion.div>
                  
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 mb-3 text-center">
                    {activeRaffle.title}
                  </h2>
                  <p className="text-xl text-purple-300 mb-8">Prêmio: R$ {activeRaffle.prize_amount?.toFixed(2)}</p>
                  
                  <div className="mb-6 px-6 py-3 bg-purple-900/50 rounded-lg border border-purple-600/50">
                    <div className="flex items-center gap-4">
                      <Label className="text-purple-200">Quantidade:</Label>
                      <Input
                        type="number"
                        value={winnersPerDraw}
                        onChange={(e) => setWinnersPerDraw(parseInt(e.target.value))}
                        min="1"
                        max={activeRaffle.max_winners}
                        className="w-24 bg-purple-900/50 border-purple-700 text-white text-center"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleDraw}
                    disabled={isDrawing || activeParticipants.length === 0}
                    className="px-10 py-6 text-xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl transform hover:scale-105 transition-all"
                  >
                    <Sparkles className="w-6 h-6 mr-2" />
                    {isDrawing ? "SORTEANDO..." : "INICIAR SORTEIO"}
                  </Button>

                  <div className="mt-8 p-3 bg-purple-900/50 rounded-lg border border-purple-600/50">
                    <p className="text-purple-200 text-center">
                      a {activeParticipants.length} participantes elegíveis
                    </p>
                  </div>
                </div>
              ) : finalWinners.length > 0 ? (
                <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
                  <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce" />
                  <h3 className="text-4xl font-bold text-yellow-300 mb-6"> GANHADORES! </h3>
                  
                  <div className="space-y-4 w-full max-w-2xl mb-6">
                    {finalWinners.map((winner, idx) => (
                      <motion.div
                        key={winner.id}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.3 }}
                        className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-2 border-yellow-500 rounded-xl p-5 text-center"
                      >
                        <div className="mb-2 flex justify-center">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-16 w-16 text-3xl"
                          />
                        </div>
                        <p className="text-2xl font-bold text-yellow-200 mb-1">{winner.user_name}</p>
                        <p className="text-lg text-yellow-300">@{winner.user_nick}</p>
                        <p className="text-base text-yellow-400 mt-1">{maskPhone(winner.user_phone)}</p>
                        <p className="text-sm text-yellow-500 mt-1">ID: {maskPlatformId(winner.user_platform_id)}</p>
                        <p className="text-xl font-bold text-green-400 mt-2">
                          R$ {activeRaffle.prize_amount?.toFixed(2)}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="w-full max-w-2xl space-y-2">
                    {finalWinners.map((winner) => (
                      <div key={`validate-${winner.id}`} className="flex items-center justify-between p-3 bg-purple-900/50 border border-purple-700/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ParticipantAvatar
                            imageUrl={getParticipantImageUrl(winner)}
                            fallback={winner.user_avatar}
                            sizeClass="h-10 w-10 text-xl"
                          />
                          <div className="text-left">
                            <div className="font-bold text-white text-sm">{winner.user_name}</div>
                            <div className="text-xs text-purple-300">{maskPhone(winner.user_phone)} - ID: {maskPlatformId(winner.user_platform_id)}</div>
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
                    <Gift className="w-40 h-40 text-yellow-400/40 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
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
                        <p className="text-2xl text-purple-300 mt-2">@{p.user_nick}</p>
                        <p className="text-xl text-purple-400 mt-2">ID: {maskPlatformId(p.user_platform_id)}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>

            <Card className="bg-purple-900/90 backdrop-blur-lg rounded-xl border-2 border-purple-600/50 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 text-center">
                <p className="text-white font-bold">Participantes</p>
                <p className="text-xs text-yellow-100">{activeParticipants.length}</p>
              </div>
              
              <div className="h-[540px] flex flex-col justify-center p-4">
                <LiveParticipantsList 
                  participants={activeParticipants} 
                  isDrawing={isDrawing}
                  maskPhone={maskPhone}
                  maskPlatformId={maskPlatformId}
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
