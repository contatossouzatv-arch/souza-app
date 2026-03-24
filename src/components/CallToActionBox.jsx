import React from "react";
import { motion } from "framer-motion";
import { ExternalLink, Sparkles, Trophy, Zap } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function CallToActionBox() {
  const { data: settings = [] } = useAppSettings();

  const getSettingValue = (key, defaultValue = "") => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  const ctaActive = getSettingValue('cta_box_active') === 'true';
  const ctaTitle = getSettingValue('cta_box_title', 'JOGUE AGORA NA P20BET');
  const ctaLink = getSettingValue('cta_box_link', '#');

  if (!ctaActive) return null;

  return (
    <motion.a
      href={ctaLink}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="block relative overflow-hidden rounded-2xl md:rounded-3xl border-2 md:border-4 border-yellow-400 shadow-2xl cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
      }}
    >
      {/* Static Background - Sem animações pesadas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradiente estático suave */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.2) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 py-6 px-4 md:py-12 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6">
          {/* Icons - Animação suave e leve */}
          <div className="flex gap-2">
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Trophy className="w-8 h-8 md:w-12 md:h-12 text-yellow-300" />
            </motion.div>
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-pink-300" />
            </motion.div>
            <motion.div
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            >
              <Zap className="w-8 h-8 md:w-12 md:h-12 text-yellow-300" />
            </motion.div>
          </div>

          {/* Text - Animação mínima */}
          <div className="text-center md:text-left">
            <motion.h2
              className="text-2xl md:text-4xl lg:text-5xl font-black text-white mb-2"
              style={{
                textShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(236, 72, 153, 0.6)',
              }}
              animate={{
                scale: [1, 1.03, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {ctaTitle}
            </motion.h2>
            <p className="text-xs md:text-base text-yellow-100 font-medium">
               Clique aqui e comece a se divertir agora mesmo! 
            </p>
          </div>

          {/* Arrow - Animação simples */}
          <motion.div
            animate={{
              x: [0, 8, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <ExternalLink className="w-6 h-6 md:w-10 md:h-10 text-yellow-300" />
          </motion.div>
        </div>
      </div>

      {/* Hover Effect - Leve */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 pointer-events-none" />

      {/* Pulse Border - Animação muito suave */}
      <motion.div
        className="absolute inset-0 border-2 md:border-4 border-yellow-300 rounded-2xl md:rounded-3xl pointer-events-none"
        animate={{
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.a>
  );
}
