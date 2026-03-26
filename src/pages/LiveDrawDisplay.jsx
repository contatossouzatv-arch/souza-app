import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Trophy, Crown, Dices, Gem, Sparkles } from "lucide-react";

const CASINOO_ICOONS = [
  { Icon: Coins, color: "text-yellow-400" },
  { Icon: Trophy, color: "text-orange-400" },
  { Icon: Crown, color: "text-yellow-300" },
  { Icon: Dices, color: "text-pink-400" },
  { Icon: Gem, color: "text-purple-400" },
  { Icon: Sparkles, color: "text-cyan-400" }
];

export default function LiveDrawDisplay() {
  const [latestParticipant, setLatestParticipant] = useState(null);
  const [particles, setParticles] = useState([]);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: displaySummary } = useQuery({
    queryKey: ['display-raffle'],
    queryFn: () => base44.liveDrawDisplay.current(),
  });
  const activeRaffle = displaySummary?.raffle || null;
  const participants = displaySummary?.participants || [];

  // Detectar quando está sorteando (participantes mudando rapidamente)
  const [lastParticipantCount, setLastParticipantCount] = useState(0);
  const [rapidChanges, setRapidChanges] = useState(0);

  useEffect(() => {
    if (participants.length !== lastParticipantCount) {
      setLastParticipantCount(participants.length);
      setRapidChanges(prev => prev + 1);
    }
  }, [participants]);

  useEffect(() => {
    // Se tiver mudanças rápidas, está sorteando
    if (rapidChanges > 0) {
      setIsDrawing(true);
      const timeout = setTimeout(() => {
        setIsDrawing(false);
        setRapidChanges(0);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [rapidChanges]);

  useEffect(() => {
    // Generate background particles
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);

    // Generate floating casino icons
    const icons = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      ...CASINOO_ICOONS[i % CASINOO_ICOONS.length],
      x: (i * 8) + Math.random() * 8,
      y: Math.random() * 90 + 5,
      size: Math.random() * 12 + 24,
      rotation: Math.random() * 360,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 2
    }));
    setFloatingIcons(icons);
  }, []);

  useEffect(() => {
    if (participants.length > 0 && participants[0]) {
      const newest = participants[0];
      if (!latestParticipant || newest.id !== latestParticipant.id) {
        setLatestParticipant(newest);
        setTimeout(() => setLatestParticipant(null), 5000);
      }
    }
  }, [participants]);

  if (!activeRaffle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>
        
        <div className="text-white text-2xl opacity-30 relative z-10">Aguardando sorteio...</div>
      </div>
    );
  }

  // Velocidade das partículas baseada no estado de sorteio
  const particleSpeed = isDrawing ? 0.3 : 1.5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 p-8 relative overflow-hidden">
      {/* Animated Tech Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Floating Particles */}
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
        
        {/* Side Scanning Lines */}
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

      {/* Sidebar de Participantes */}
      <div className="absolute right-8 top-8 bottom-8 w-80 z-20">
        <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-lg rounded-2xl border-2 border-yellow-400/50 shadow-2xl h-full overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4 text-center">
            <h2 className="text-2xl font-bold text-white">Participantes</h2>
            <p className="text-sm text-yellow-100">{participants.length} na fila</p>
          </div>
          
          <div className="h-[calc(100%-80px)] overflow-hidden relative">
            <motion.div
              animate={{ y: ["0%", "-50%"] }}
              transition={{
                duration: isDrawing ? Math.max(participants.length * 0.5, 3) : Math.max(participants.length * 2, 10),
                repeat: Infinity,
                ease: "linear"
              }}
              className="space-y-3 p-4"
            >
              {[...participants, ...participants].map((p, i) => (
                <motion.div
                  key={`${p.id}-${i}`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    scale: isDrawing ? [1, 1.05, 1] : 1
                  }}
                  transition={isDrawing ? {
                    scale: {
                      duration: 0.3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  } : {}}
                  className="bg-purple-800/50 backdrop-blur-sm rounded-lg p-3 border border-purple-600/50"
                >
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="text-3xl"
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
                      <div className="font-bold text-white truncate">{p.user_name}</div>
                      <div className="text-xs text-purple-300">@{p.user_nick}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Notificação de Novo Participante */}
      <AnimatePresence>
        {latestParticipant && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -100 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 p-6 rounded-2xl shadow-2xl border-4 border-white/30 min-w-[400px]">
              <div className="text-center">
                <motion.div 
                  className="text-6xl mb-3"
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: 3
                  }}
                >
                  {latestParticipant.user_avatar}
                </motion.div>
                <div className="text-2xl font-bold text-white mb-1">
                  {latestParticipant.user_name}
                </div>
                <div className="text-lg text-yellow-100">entrou no sorteio! </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicador de Sorteio Ativo */}
      {isDrawing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
        >
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              rotate: [0, 360]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            className="text-yellow-400/30"
          >
            <Sparkles size={120} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
