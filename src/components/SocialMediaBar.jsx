import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Instagram, MessageCircle, Youtube, Facebook, Twitter, Send } from "lucide-react";

const SOCIAL_ICONS = {
  instagram: { Icon: Instagram, defaultGradient: ['#e4405f', '#f77737'] },
  whatsapp: { Icon: MessageCircle, defaultGradient: ['#25D366', '#128C7E'] },
  youtube: { Icon: Youtube, defaultGradient: ['#FF0000', '#CC0000'] },
  facebook: { Icon: Facebook, defaultGradient: ['#1877F2', '#0C5CC7'] },
  twitter: { Icon: Twitter, defaultGradient: ['#1DA1F2', '#0C85D0'] },
  tiktok: { Icon: MessageCircle, defaultGradient: ['#000000', '#fe2c55'] },
  telegram: { Icon: Send, defaultGradient: ['#0088cc', '#006699'] },
};

export default function SocialMediaBar() {
  const { data: socials = [] } = useQuery({
    queryKey: ['active-socials'],
    queryFn: async () => {
      const allSocials = await base44.entities.SocialMedia.filter({ active: true }, 'order');
      return allSocials;
    },
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['social-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const getSettingValue = (key, defaultValue = "") => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  const socialBarActive = getSettingValue('social_bar_active') === 'true';

  if (!socialBarActive || socials.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="mx-auto w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur-md">
        <p className="mb-2 text-center text-[11px] font-semibold tracking-wide text-slate-200">
          Redes Sociais do SouzaTV
        </p>
        <div className="flex items-center justify-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {socials.map((social, index) => {
            const { Icon, defaultGradient } = SOCIAL_ICONS[social.icon] || SOCIAL_ICONS.instagram;
            const gradientFrom = social.color_from || defaultGradient[0];
            const gradientTo = social.color_to || defaultGradient[1];

            return (
              <motion.a
                key={social.id}
                href={social.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.08, y: -1 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white shadow-md transition-all duration-300 hover:border-white/40 hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                }}
                title={social.name}
                aria-label={social.name}
              >
                <Icon className="h-5 w-5" />
              </motion.a>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
