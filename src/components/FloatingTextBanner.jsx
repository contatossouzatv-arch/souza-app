import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Trophy, Crown, Dices, Gem } from "lucide-react";

const CASINOO_ICOONS = [
  { Icon: Coins, color: "text-yellow-400" },
  { Icon: Trophy, color: "text-orange-400" },
  { Icon: Crown, color: "text-yellow-300" },
  { Icon: Dices, color: "text-pink-400" },
  { Icon: Gem, color: "text-purple-400" }
];

export default function FloatingTextBanner() {
  const [particles, setParticles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [floatingIcons, setFloatingIcons] = useState([]);

  const { data: settings = [] } = useQuery({
    queryKey: ['floating-banner-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const getSettingValue = (key, defaultValue) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  const bannerTexts = [
    {
      text: getSettingValue('banner_text_1', ' Entre no nosso WhatsApp!'),
      link: getSettingValue('banner_link_1', '#')
    },
    {
      text: getSettingValue('banner_text_2', ' Siga nosso Instagram!'),
      link: getSettingValue('banner_link_2', '#')
    },
    {
      text: getSettingValue('banner_text_3', ' Acesse a plataforma!'),
      link: getSettingValue('banner_link_3', '#')
    }
  ];

  useEffect(() => {
    // Generate background particles
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 3
    }));
    setParticles(newParticles);

    // Generate floating casino icons
    const icons = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      ...CASINOO_ICOONS[i % CASINOO_ICOONS.length],
      x: (i * 12) + Math.random() * 10,
      y: Math.random() * 80 + 10,
      size: Math.random() * 8 + 20,
      rotation: Math.random() * 360,
      duration: Math.random() * 3 + 3,
      delay: Math.random() * 2
    }));
    setFloatingIcons(icons);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerTexts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [bannerTexts.length]);

  const currentBanner = bannerTexts[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-purple-900/30 border border-purple-700/50 p-6 md:p-10">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Small Floating Particles */}
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
              y: [0, -40, 0],
              x: [0, Math.random() * 30 - 15, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: particle.duration,
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
                y: [0, -30, 0],
                x: [0, Math.random() * 20 - 10, 0],
                rotate: [icon.rotation, icon.rotation + 360],
                opacity: [0.1, 0.3, 0.1],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: icon.duration,
                delay: icon.delay,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <IconComponent size={icon.size} strokeWidth={2} />
            </motion.div>
          );
        })}

        {/* Glowing Lines */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
          animate={{
            x: ['-100%', '100%'],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400 to-transparent"
          animate={{
            x: ['100%', '-100%'],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 1.5
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center gap-4">
        {/* Left Casino Icon */}
        <motion.div
          animate={{
            rotate: [0, 20, -20, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="hidden md:block"
        >
          <Trophy className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
        </motion.div>

        {/* Rotating Text with Links */}
        <div className="flex-1 min-h-[80px] md:min-h-[100px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              className="relative"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ 
                duration: 0.7,
                ease: "easeInOut"
              }}
            >
              {/* Background glow for text */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 via-pink-900/60 to-purple-900/60 blur-2xl rounded-full scale-110" />
              
              <a
                href={currentBanner.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block text-2xl md:text-5xl font-black text-center hover:scale-105 transition-transform cursor-pointer px-6 md:px-12 py-3 md:py-6"
                style={{
                  textShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(236, 72, 153, 0.6), 0 0 60px rgba(168, 85, 247, 0.4)',
                  background: 'linear-gradient(to right, #fef08a, #fbbf24, #ec4899, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {currentBanner.text}
              </a>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Casino Icon */}
        <motion.div
          animate={{
            rotate: [0, -20, 20, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
          className="hidden md:block"
        >
          <Crown className="w-10 h-10 text-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]" />
        </motion.div>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {bannerTexts.map((_, idx) => (
          <motion.div
            key={idx}
            className={`h-1.5 rounded-full transition-all ${
              idx === currentIndex 
                ? 'bg-gradient-to-r from-yellow-400 to-pink-400 w-10 shadow-[0_0_10px_rgba(251,191,36,0.8)]' 
                : 'bg-white/30 w-2'
            }`}
            animate={idx === currentIndex ? {
              scaleX: [0, 1],
            } : {}}
            transition={idx === currentIndex ? {
              duration: 5,
              ease: "linear"
            } : {}}
          />
        ))}
      </div>

      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-transparent via-yellow-400 to-transparent blur-md opacity-60" />
      
      {/* Floating Mini Icons near the text */}
      <motion.div
        className="absolute left-[15%] top-1/2 -translate-y-1/2"
        animate={{
          y: [0, -15, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Dices className="w-8 h-8 text-purple-400/40 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
      </motion.div>
      
      <motion.div
        className="absolute right-[15%] top-1/2 -translate-y-1/2"
        animate={{
          y: [0, 15, 0],
          rotate: [0, -180, -360],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      >
        <Gem className="w-8 h-8 text-pink-400/40 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
      </motion.div>
    </div>
  );
}
