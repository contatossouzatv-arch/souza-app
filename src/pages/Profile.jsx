import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Award, Bell, CalendarDays, CheckCircle2, Eye, Heart, HelpCircle, ImageUp, Loader2, Lock, Pencil, Sparkles, Star, Trophy, UserPlus, Wallet, XCircle } from "lucide-react";
import TechLoader from "@/components/TechLoader";
import { useToast } from "@/components/ui/use-toast";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import {
  isHandleAvailable,
  loadProfilePrefs,
  normalizeHandle,
  reserveHandle,
  saveProfilePrefs,
} from "@/lib/profilePrefs";
import { generateCroppedProfileImage, getProfileCropPreviewStyle } from "@/lib/profileImageCrop";
import {
  BADGE_COLOR_OPTIONS,
  BADGE_METRIC_OPTIONS,
  DEFAULT_BADGE_RULES,
  DEFAULT_POINTS_RULES,
  buildProgressBadge,
  computePointsFromRules,
  evaluateBadgeRules,
  normalizeBadgeRules,
  normalizePointsRules,
  parseJsonSetting,
} from "@/lib/achievementRules";
import {
  buildCompetitionLeaderboard,
  DEFAULT_PROFILE_COMPETITION_CONFIG,
  formatTimeLeft,
  normalizeCompetitionConfig,
  PROFILE_COMPETITION_SETTINGS_KEY,
} from "@/lib/profileCompetition";
import {
  DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG,
  normalizeEngagementGuideConfig,
  PROFILE_ENGAGEMENT_GUIDE_SETTINGS_KEY,
} from "@/lib/profileEngagementGuide";
import { getLevelProgress } from "@/lib/levelProgress";
import { isInteractionSoundEnabled } from "@/lib/soundPrefs";
import profileCoverTile from "../../assets-para-app/profile-cover-tile.png";
import firstBadgeIntroAnim from "../../assets-para-app/selo 001 app.webm";
import firstWinBadgeAnim from "../../assets-para-app/selo ganhou seu primeiro premio.webm";
import tenLivesBadgeAnim from "../../assets-para-app/selo participou de 10 lives.webm";
import sideBadgePlaceholder from "../../assets-para-app/selo-preto.png";
import badgeClickSound from "../../assets-para-app/click no selo.mp3";
import badgeWinSound from "../../assets-para-app/ganhando selo.mp3";
import commonRewardCollectSound from "../../assets-para-app/Songs/Song Coleta coisa comum no final da partida ou de baus no lobby.mp3";
import top1BorderAnimated from "../../assets-para-app/top-1-borda animada.webm";
import top2BorderAnimated from "../../assets-para-app/top-2-borda animada.webm";
import top3BorderAnimated from "../../assets-para-app/top-3-borda animada.webm";
import LegalLinksBar from "@/components/LegalLinksBar";
import { getProfileAvatarFallback, getProfileAvatarSrc } from "@/lib/profileMedia";
const PrizeGalleryCard = lazy(() => import("@/components/profile/PrizeGalleryCard"));

const avatarModules = import.meta.glob("../../assets-para-app/avatar/*.png", {
  eager: true,
  import: "default",
});
const webmBadgeModules = import.meta.glob("../../assets-para-app/*.webm", {
  eager: true,
  import: "default",
});
const mp3Modules = import.meta.glob("../../assets-para-app/*.mp3", {
  eager: true,
  import: "default",
});
const badgeCarouselTransitionSound =
  Object.entries(mp3Modules).find(([path]) => path.toLowerCase().includes("carrossel selos pop-up"))?.[1] || "";
const fiveHundredTicketsBadgeAnim =
  Object.entries(webmBadgeModules).find(([path]) => path.toLowerCase().includes("selo acumulou 500 bilhetes"))?.[1] || "";
const followersFiftyBadgeAnim =
  Object.entries(webmBadgeModules).find(([path]) => path.toLowerCase().includes("selo atingiu 50 seguidores no perfil"))?.[1] || "";
const checkin30DaysBadgeAnim =
  Object.entries(webmBadgeModules).find(([path]) => path.toLowerCase().includes("selo fez check in 30 dias no app"))?.[1] || "";
const winner10BadgeAnim =
  Object.entries(webmBadgeModules).find(([path]) => path.toLowerCase().includes("selo ganhou 10 pr"))?.[1] || "";

const avatarOptions = Object.entries(avatarModules)
  .map(([path, src]) => ({
    id: path.split("/").pop().replace(".png", ""),
    src,
    isFeatured: path.toLowerCase().includes("destaque"),
  }))
  .sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

const DEFAULT_AVATAR_ID =
  avatarOptions.find((item) => item.id.toLowerCase().includes("avatar padrao perfil sem foto"))?.id ||
  avatarOptions[0]?.id ||
  "";
const defaultAvatar =
  avatarOptions.find((item) => item.id === DEFAULT_AVATAR_ID)?.src ||
  avatarOptions[0]?.src ||
  "";
const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const BADGE_RULES_KEY = "achievement_badge_rules_v1";
const POINTS_RULES_KEY = "achievement_points_rules_v1";
const PROFILE_COMPETITION_KEY = PROFILE_COMPETITION_SETTINGS_KEY;
const PROFILE_ENGAGEMENT_GUIDE_KEY = PROFILE_ENGAGEMENT_GUIDE_SETTINGS_KEY;
const BADGE_COLOR_CLASS = BADGE_COLOR_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.className;
  return acc;
}, {});
const BADGE_METRIC_LABEL = BADGE_METRIC_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});
const BADGE_ICON_MAP = {
  star: Star,
  wallet: Wallet,
  trophy: Trophy,
  award: Award,
  user_plus: UserPlus,
  heart: Heart,
};
const BADGE_CELEBRATION_STORAGE_PREFIX = "profile_badge_celebration_seen_v1_";
const PROFILE_GESTURE_DRAG_ENABLED = true;
const PROFILE_AUTOPLAY_MEDIA_ENABLED = true;
const PROFILE_DEBUG_ENABLED = false;
const PROFILE_CORE_LOAD_DELAY_MS = 180;
const PROFILE_NON_CRITICAL_LOAD_DELAY_MS = 1800;
const PROFILE_ENGAGED_QUERY_LIMIT = 5;
const PROFILE_PUBLIC_ENRICHMENT_ENABLED = true;
const PROFILE_PRIVATE_TABS = [
  { id: "overview", label: "Resumo" },
  { id: "engagement", label: "Engajamento" },
  { id: "achievements", label: "Conquistas" },
  { id: "prizes", label: "Prêmios" },
];

function profileDebugLog() {}

function getSpecialBadgeVisual(achievement) {
  const normalizedLabel = String(achievement?.label || "").toLowerCase();
  const isStarterBadge = achievement?.key === "starter-install";
  const isFirstWinBadge =
    achievement?.key === "winner" || normalizedLabel.includes("primeiro premio");
  const isTenLivesBadge =
    achievement?.key === "live-10" ||
    achievement?.key === "live10" ||
    achievement?.key === "ten-lives" ||
    achievement?.key === "participou-10-lives" ||
    normalizedLabel.includes("10 lives");
  const isTickets500Badge =
    achievement?.key === "tickets-500" ||
    achievement?.key === "tickets500" ||
    achievement?.key === "500-bilhetes" ||
    achievement?.key === "bilhetes-500" ||
    normalizedLabel.includes("500 bilhetes");
  const isFollowers50Badge =
    achievement?.key === "followers-50" ||
    achievement?.key === "followers50" ||
    achievement?.key === "seguidores-50" ||
    normalizedLabel.includes("50 seguidores");
  const isCheckin30Badge =
    achievement?.key === "checkin-30" ||
    achievement?.key === "checkin30" ||
    achievement?.key === "check-in-30" ||
    normalizedLabel.includes("check in 30");
  const isWinner10Badge =
    achievement?.key === "winner10" ||
    achievement?.key === "winner-10" ||
    normalizedLabel.includes("10 premios");

  if (isStarterBadge) {
    return {
      kind: "video",
      src: firstBadgeIntroAnim,
      glowClass: "bg-amber-300/85",
      scaleClass: "scale-[4.45]",
      offsetClass: "translate-y-[4px]",
    };
  }

  if (isFirstWinBadge) {
    return {
      kind: "video",
      src: firstWinBadgeAnim,
      glowClass: "bg-violet-300/80",
      scaleClass: "scale-[2.5]",
      offsetClass: "",
    };
  }

  if (isTenLivesBadge) {
    return {
      kind: "video",
      src: tenLivesBadgeAnim,
      glowClass: "bg-orange-300/80",
      scaleClass: "scale-[2.8]",
      offsetClass: "translate-y-[2px]",
    };
  }

  if (isTickets500Badge && fiveHundredTicketsBadgeAnim) {
    return {
      kind: "video",
      src: fiveHundredTicketsBadgeAnim,
      glowClass: "bg-blue-300/80",
      scaleClass: "scale-[2.5]",
      offsetClass: "",
    };
  }

  if (isFollowers50Badge && followersFiftyBadgeAnim) {
    return {
      kind: "video",
      src: followersFiftyBadgeAnim,
      glowClass: "bg-emerald-300/80",
      scaleClass: "scale-[2.3]",
      offsetClass: "",
    };
  }

  if (isCheckin30Badge && checkin30DaysBadgeAnim) {
    return {
      kind: "video",
      src: checkin30DaysBadgeAnim,
      glowClass: "bg-cyan-300/80",
      scaleClass: "scale-[2.5]",
      offsetClass: "",
    };
  }

  if (isWinner10Badge && winner10BadgeAnim) {
    return {
      kind: "video",
      src: winner10BadgeAnim,
      glowClass: "bg-yellow-300/80",
      scaleClass: "scale-[2.5]",
      offsetClass: "",
    };
  }

  return null;
}

function getBadgeCelebrationText(achievement) {
  if (!achievement) return "Continue jogando para liberar mais conquistas.";
  const normalizedLabel = String(achievement.label || "").toLowerCase();
  const isTickets500Badge =
    achievement.key === "tickets-500" ||
    achievement.key === "tickets500" ||
    achievement.key === "500-bilhetes" ||
    achievement.key === "bilhetes-500" ||
    normalizedLabel.includes("500 bilhetes");
  const isFollowers50Badge =
    achievement.key === "followers-50" ||
    achievement.key === "followers50" ||
    achievement.key === "seguidores-50" ||
    normalizedLabel.includes("50 seguidores");
  const isWinner10Badge =
    achievement.key === "winner10" ||
    achievement.key === "winner-10" ||
    normalizedLabel.includes("10 premios");

  if (isTickets500Badge) {
    return "Você acumulou 500 bilhetes nos depósitos! Continue no ritmo para dominar o ranking.";
  }

  if (isFollowers50Badge) {
    return "Você atingiu 50 seguidores no perfil! Sua presença na comunidade está crescendo forte.";
  }

  if (isWinner10Badge) {
    return "Lendário! Você já ganhou 10 prêmios com o Souza e entrou no hall dos campeões.";
  }

  return achievement.ruleText || "Continue jogando para liberar mais conquistas.";
}

function loadSeenBadgeCelebrations(userId) {
  if (!userId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${BADGE_CELEBRATION_STORAGE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === "string" && item.trim().length > 0));
  } catch {
    return new Set();
  }
}

function saveSeenBadgeCelebrations(userId, keysSet) {
  if (!userId || typeof window === "undefined") return;
  try {
    const keys = Array.from(keysSet || []);
    window.localStorage.setItem(`${BADGE_CELEBRATION_STORAGE_PREFIX}${userId}`, JSON.stringify(keys));
  } catch {
    // Ignora falhas de storage para nao quebrar o fluxo de conquista.
  }
}

function preloadAudioElement(audio, timeoutMs = 9000) {
  if (!audio) return Promise.resolve();
  if (audio.readyState >= 3) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finalize = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("error", onError);
      resolve();
    };
    const onReady = () => finalize();
    const onError = () => finalize();
    timeoutId = window.setTimeout(finalize, timeoutMs);
    audio.addEventListener("canplaythrough", onReady);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("error", onError);
    try {
      audio.load();
    } catch {
      // Ignora erros de preload e segue.
    }
  });
}

function preloadBadgeVisual(achievement, timeoutMs = 9000) {
  if (!achievement || typeof window === "undefined") return Promise.resolve();
  const specialVisual = getSpecialBadgeVisual(achievement);
  if (specialVisual?.kind === "video" && specialVisual.src) {
    return new Promise((resolve) => {
      const probeVideo = document.createElement("video");
      probeVideo.preload = "auto";
      probeVideo.muted = true;
      probeVideo.playsInline = true;
      probeVideo.src = specialVisual.src;
      let settled = false;
      let timeoutId = null;
      const finalize = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        probeVideo.removeEventListener("canplaythrough", onReady);
        probeVideo.removeEventListener("loadeddata", onReady);
        probeVideo.removeEventListener("error", onError);
        resolve();
      };
      const onReady = () => finalize();
      const onError = () => finalize();
      timeoutId = window.setTimeout(finalize, timeoutMs);
      probeVideo.addEventListener("canplaythrough", onReady);
      probeVideo.addEventListener("loadeddata", onReady);
      probeVideo.addEventListener("error", onError);
      try {
        probeVideo.load();
      } catch {
        // segue
      }
    });
  }

  if (achievement.iconUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const finalize = () => {
        if (settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      const timeoutId = window.setTimeout(finalize, timeoutMs);
      img.onload = () => {
        window.clearTimeout(timeoutId);
        finalize();
      };
      img.onerror = () => {
        window.clearTimeout(timeoutId);
        finalize();
      };
      img.src = resolveAssetUrl(achievement.iconUrl);
    });
  }

  return Promise.resolve();
}

function normalizePublicHandleValue(value = "") {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "");
}

const SmartVideo = React.memo(function SmartVideo({
  src,
  className = "",
  active = true,
  preload = "metadata",
  muted = true,
  loop = true,
  playsInline = true,
  ariaHidden = true,
}) {
  const videoRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(true);
  const [isPageVisible, setIsPageVisible] = React.useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibilityChange = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  React.useEffect(() => {
    if (!PROFILE_AUTOPLAY_MEDIA_ENABLED) return;
    const node = videoRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(Boolean(entry?.isIntersecting) && Number(entry?.intersectionRatio || 0) > 0.12);
      },
      {
        threshold: [0, 0.12, 0.35, 0.6],
      }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const shouldPlay = PROFILE_AUTOPLAY_MEDIA_ENABLED && active && isVisible && isPageVisible;
    if (shouldPlay) {
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      return;
    }
    node.pause();
  }, [active, isPageVisible, isVisible]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted={muted}
      autoPlay={PROFILE_AUTOPLAY_MEDIA_ENABLED && active}
      loop={loop}
      playsInline={playsInline}
      disablePictureInPicture
      preload={PROFILE_AUTOPLAY_MEDIA_ENABLED ? preload : "metadata"}
      aria-hidden={ariaHidden}
      className={className}
    />
  );
});

const AchievementIcon = React.memo(function AchievementIcon({ achievement, playVideo = true }) {
  const specialVisual = getSpecialBadgeVisual(achievement);

  if (!achievement) return null;

  if (specialVisual?.kind === "video") {
    return (
      <div className="relative h-12 w-12 rounded-md">
        <div className={`pointer-events-none absolute inset-0 m-auto h-14 w-14 rounded-full blur-xl ${specialVisual.glowClass}`} />
        <SmartVideo
          src={specialVisual.src}
          active={playVideo}
          preload={playVideo ? "metadata" : "none"}
          className={`h-full w-full object-contain object-center ${specialVisual.scaleClass} ${specialVisual.offsetClass || ""}`}
        />
      </div>
    );
  }
  if (achievement?.iconUrl) {
    return (
      <img
        src={resolveAssetUrl(achievement.iconUrl)}
        alt={achievement.label}
        className="h-12 w-12 rounded-md object-contain"
        loading="lazy"
      />
    );
  }
  const Icon = achievement.icon;
  if (!Icon) return null;
  return <Icon className={`h-10 w-10 ${achievement.color || "text-cyan-300"}`} />;
});

const BadgeCelebrationMedia = React.memo(function BadgeCelebrationMedia({ achievement, variant = "default", playVideo = true }) {
  if (!achievement) return null;
  const specialVisual = getSpecialBadgeVisual(achievement);
  const isPopupStarter = variant === "popup" && achievement?.key === "starter-install";
  if (specialVisual?.kind === "video") {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className={`pointer-events-none absolute inset-0 m-auto h-44 w-44 rounded-full blur-3xl ${specialVisual.glowClass}`} />
        <SmartVideo
          src={specialVisual.src}
          active={playVideo}
          preload={playVideo ? "auto" : "metadata"}
          className={`relative h-full w-full object-contain ${isPopupStarter ? "scale-[1.42]" : ""}`}
        />
      </div>
    );
  }

  if (achievement?.iconUrl) {
    return (
      <img
        src={resolveAssetUrl(achievement.iconUrl)}
        alt={achievement.label}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    );
  }

  const Icon = achievement?.icon;
  if (!Icon) return null;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Icon className={`h-28 w-28 ${achievement.color || "text-cyan-300"}`} />
    </div>
  );
});

function formatBadgeRuleText(rule) {
  if (!rule) return "";
  const customDescription = String(rule.description || "").trim();
  if (customDescription) return customDescription;
  const badgeId = String(rule.id || "").trim();
  const badgeLabel = String(rule.label || "").trim();
  const threshold = Number(rule.threshold || 0);
  const friendlyDescriptions = {
    "starter-install":
      "Você já começou sua jornada no App do Souza. Continue participando para liberar conquistas cada vez mais especiais.",
    "first-step":
      "Dê seus primeiros passos no app e mostre que você chegou para jogar sério. Cada participação te aproxima de novas conquistas.",
    "deposit-300":
      "Movimente sua conta e alcance R$ 300 em depósitos aprovados para liberar este selo especial.",
    "premium-depositor":
      "Esse selo é para quem se destaca entre os grandes movimentadores do app. Continue evoluindo seus depósitos para conquistá-lo.",
    top10:
      "Entre para a elite do momento ficando entre os maiores depositantes do ciclo ativo.",
    winner:
      "Conquiste seu primeiro prêmio no app e desbloqueie esse selo de vencedor.",
    winner10:
      "Ganhe 10 prêmios e prove que você já faz parte do time dos campeões do App do Souza.",
    "tickets-500":
      "Acumule 500 bilhetes e mostre a força da sua jornada dentro do app.",
    "checkin-30":
      "Marque presença por 30 dias e transforme sua constância em uma conquista especial.",
    "followers-50":
      "Chegue a 50 seguidores no seu perfil e mostre que sua presença chama atenção na comunidade.",
    "live-10":
      "Participe de 10 lives e desbloqueie esse selo feito para quem acompanha tudo de perto.",
    "super-fan-live":
      "Esse selo é para quem vive as lives intensamente. Continue participando e mostre que você é fã de verdade.",
  };
  if (friendlyDescriptions[badgeId]) {
    return friendlyDescriptions[badgeId];
  }
  if (/top\s*10/i.test(badgeLabel)) {
    return "Fique entre os maiores destaques do ciclo e conquiste seu lugar no Top 10.";
  }
  if (rule.metric === "positionTop") {
    return `Fique entre os ${threshold} maiores depositantes do ciclo ativo para liberar este selo.`;
  }
  const metricText = BADGE_METRIC_LABEL[rule.metric] || "essa meta";
  const metricFriendlyText = {
    totalParticipations: `Participe ${threshold} vezes para conquistar este selo e mostrar sua presença no app.`,
    totalApproved: `Alcance ${threshold} em depósitos aprovados para desbloquear esta conquista.`,
    totalWins: `Ganhe ${threshold} prêmio${threshold === 1 ? "" : "s"} para liberar este selo.`,
    liveParticipations: `Marque presença em ${threshold} live${threshold === 1 ? "" : "s"} para conquistar este selo.`,
    ticketCount: `Acumule ${threshold} bilhetes e avance para desbloquear esta conquista.`,
    followerCount: `Chegue a ${threshold} seguidor${threshold === 1 ? "" : "es"} para liberar este selo especial.`,
    checkInStreak: `Complete ${threshold} check-in${threshold === 1 ? "" : "s"} e conquiste este selo.`,
    points: `Some ${threshold} ponto${threshold === 1 ? "" : "s"} para liberar esta conquista.`,
  };
  if (metricFriendlyText[rule.metric]) {
    return metricFriendlyText[rule.metric];
  }
  return `Complete a meta de ${threshold} em ${metricText.toLowerCase()} para liberar este selo.`;
}

function buildBadgeGalleryFromRules(rules = [], unlockedBadges = []) {
  const unlockedKeys = new Set((unlockedBadges || []).map((item) => item.key));
  const allBadges = (rules || [])
    .filter((rule) => Boolean(getSpecialBadgeVisual({ key: rule?.id, label: rule?.label })?.kind === "video"))
    .map((rule) => ({
      key: rule.id,
      label: rule.label,
      icon: BADGE_ICON_MAP[rule.icon] || Star,
      color: BADGE_COLOR_CLASS[rule.color] || "text-cyan-300",
      iconUrl: rule.icon_url || "",
      ruleText: formatBadgeRuleText(rule),
      unlocked: unlockedKeys.has(rule.id),
    }));
  return {
    unlocked: allBadges.filter((item) => item.unlocked),
    locked: allBadges.filter((item) => !item.unlocked),
    ordered: [
      ...allBadges.filter((item) => item.unlocked),
      ...allBadges.filter((item) => !item.unlocked),
    ],
  };
}

function getAvatarMotionVars(id) {
  const text = String(id || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const base = Math.abs(hash);
  const duration = 4.6 + (base % 18) / 10;
  const delay = ((base >> 3) % 24) / 10;
  const drift = ((base >> 5) % 9) - 4;
  const scale = 1 + ((base >> 7) % 6) / 1000;

  return {
    "--avatar-float-duration": `${duration}s`,
    "--avatar-float-delay": `-${delay}s`,
    "--avatar-float-drift": `${drift}px`,
    "--avatar-float-scale": String(scale),
  };
}

function normalizeMetricSourceLabel(entry) {
  const sourceType = String(entry?.source_type || entry?.metadata?.source_type || "").toLowerCase();
  const sourceRef = String(entry?.source_ref || "").toLowerCase();
  const source = `${sourceType} ${sourceRef}`;

  if (source.includes("daily_checkin")) return "Check-in diario";
  if (source.includes("daily_chest")) return "Bau diario";
  if (source.includes("follow")) return "Seguir perfis";
  if (source.includes("like")) return "Curtidas em perfis";
  if (source.includes("approved_deposit")) return "Depositos aprovados";
  if (source.includes("validated_win")) return "Prêmios confirmados";
  if (source.includes("live_participation") || source.includes("live_draw")) return "Participacao em live";
  if (source.includes("instant_raffle")) return "Sorteio rapido";
  if (source.includes("game_call")) return "Call do jogo";
  if (source.includes("cashback")) return "Cashback";
  if (source.includes("admin_adjustment")) return "Ajuste administrativo";
  return "Outras acoes do app";
}

function buildPointsHistorySummary(ledger = [], allowedMetricKeys = []) {
  const allowedSet = new Set(allowedMetricKeys);
  const grouped = new Map();
  const cycleKey =
    arguments.length > 2 && arguments[2] && typeof arguments[2] === "object"
      ? String(arguments[2].cycleKey || "").trim()
      : "";

  ledger
    .filter((entry) => {
      const metricKey = String(entry.metric_key || "");
      if (!allowedSet.has(metricKey)) return false;
      if (!cycleKey || metricKey !== "weekly_points") return true;
      return String(entry.cycle_key || "").trim() === cycleKey;
    })
    .forEach((entry) => {
      const label = normalizeMetricSourceLabel(entry);
      const current = grouped.get(label) || {
        label,
        total: 0,
        entries: 0,
        latestAt: "",
      };
      current.total += Number(entry.amount || 0);
      current.entries += 1;
      const occurredAt = String(entry.occurred_at || "");
      if (!current.latestAt || occurredAt > current.latestAt) {
        current.latestAt = occurredAt;
      }
      grouped.set(label, current);
    });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return String(b.latestAt || "").localeCompare(String(a.latestAt || ""));
  });
}

function buildCheckInCalendarDays(recentDays = []) {
  return recentDays.map((item) => {
    const date = new Date(`${item.dayKey}T12:00:00`);
    const weekday = Number.isNaN(date.getTime())
      ? item.dayKey
      : new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
    const dayNumber = Number.isNaN(date.getTime()) ? "--" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
    return {
      ...item,
      weekday,
      dayNumber,
    };
  });
}

function formatHistoryTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Profile() {
  const queryClient = useQueryClient();
  const simulatedStripRef = React.useRef(null);
  const publicOtherStripRef = React.useRef(null);
  const publicBadgeStripRef = React.useRef(null);
  const privateBadgeStripRef = React.useRef(null);
  const competitionRankingRef = React.useRef(null);
  const profileSwitchLoaderTimerRef = React.useRef({
    progressInterval: null,
    hideTimeout: null,
    failSafeTimeout: null,
  });
  const badgeClickAudioRef = React.useRef(null);
  const badgeWinAudioRef = React.useRef(null);
  const badgeCarouselAudioRef = React.useRef(null);
  const checkInCollectAudioRef = React.useRef(null);
  const checkInCarouselRef = React.useRef(null);
  const checkInDayRefs = React.useRef({});
  const checkInCarouselDragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    pointerId: null,
  });
  const simulatedDragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const publicOtherDragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const publicBadgeDragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const privateBadgeDragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const competitionRankingDragRef = React.useRef({
    isDragging: false,
    startY: 0,
    startScrollTop: 0,
    moved: false,
  });
  const { toast } = useToast();
  const { user: authUser, isLoadingAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [privatePhotoPreview, setPrivatePhotoPreview] = useState("");
  const [isPrivatePhotoLoading, setIsPrivatePhotoLoading] = useState(false);
  const [selectedEditPhotoFile, setSelectedEditPhotoFile] = useState(null);
  const [selectedEditPhotoPreview, setSelectedEditPhotoPreview] = useState("");
  const [selectedEditPhotoZoom, setSelectedEditPhotoZoom] = useState(1);
  const [selectedEditPhotoOffsetY, setSelectedEditPhotoOffsetY] = useState(0);
  const [isPreparingEditPhoto, setIsPreparingEditPhoto] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isPublicPhotoViewerOpen, setIsPublicPhotoViewerOpen] = useState(false);
  const [isProfileNotificationsOpen, setIsProfileNotificationsOpen] = useState(false);
  const [activeBadgeCelebration, setActiveBadgeCelebration] = useState(null);
  const [profileImageFallbackStep, setProfileImageFallbackStep] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSocialListOpen, setIsSocialListOpen] = useState(false);
  const [socialListType, setSocialListType] = useState("following");
  const [selectedBadgeInfo, setSelectedBadgeInfo] = useState(null);
  const [badgeViewerList, setBadgeViewerList] = useState([]);
  const [badgeViewerIndex, setBadgeViewerIndex] = useState(0);
  const [badgeViewerDirection, setBadgeViewerDirection] = useState(0);
  const [isCompetitionHelpOpen, setIsCompetitionHelpOpen] = useState(false);
  const [isEngagementGuideOpen, setIsEngagementGuideOpen] = useState(false);
  const [isLevelHudOpen, setIsLevelHudOpen] = useState(false);
  const [isPointsHistoryOpen, setIsPointsHistoryOpen] = useState(false);
  const [pointsHistoryTab, setPointsHistoryTab] = useState("weekly");
  const [isCheckInCalendarOpen, setIsCheckInCalendarOpen] = useState(false);
  const [isProfileSwitchLoading, setIsProfileSwitchLoading] = useState(false);
  const [profileSwitchProgress, setProfileSwitchProgress] = useState(0);
  const [initialProfileLoadProgress, setInitialProfileLoadProgress] = useState(12);
  const [competitionRemainingMsLive, setCompetitionRemainingMsLive] = useState(0);
  const [activePrivateTab, setActivePrivateTab] = useState("overview");
  const [shouldLoadCoreProfileData, setShouldLoadCoreProfileData] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );
  const [profilePrefs, setProfilePrefs] = useState({
    handle: "",
    alias: "",
    avatarId: "",
    selectedPhotoUrl: "",
    approvedPhotoUrls: [],
    removedApprovedPhotoUrls: [],
  });
  const [social, setSocial] = useState({ followers: 0, following: 0, likes: 0, isFollowing: false, isLiked: false });
  const [editData, setEditData] = useState({ nick: "", handle: "", phone: "", avatarId: "", imageMode: "avatar" });
  const [availabilityState, setAvailabilityState] = useState({
    nick: { checking: false, available: null, message: "" },
    phone: { checking: false, available: null, message: "" },
  });
  const [simState, setSimState] = useState({});
  const [followPendingById, setFollowPendingById] = useState({});
  const [likePendingById, setLikePendingById] = useState({});
  const [badgeCelebrationQueueSignal, setBadgeCelebrationQueueSignal] = useState(0);
  const pendingCelebrationSoundUnlockRef = React.useRef(null);
  const hasUnlockedBadgeWinAudioRef = React.useRef(false);
  const badgeCelebrationPreparingRef = React.useRef(false);
  const badgeCelebrationPrepareTokenRef = React.useRef(0);
  const badgeCelebrationQueueRef = React.useRef([]);
  const seenBadgeCelebrationsRef = React.useRef(new Set());
  const lastAchievementKeysRef = React.useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const profileDebugRenderCountRef = React.useRef(0);
  const profileDebugPrevEffectDepsRef = React.useRef({});
  const selectedPublicProfileHandle = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("u") || "";
  }, [location.search]);
  const selectedPublicProfileId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("user") || "";
  }, [location.search]);
  const isViewingPublicProfile = Boolean(selectedPublicProfileHandle || selectedPublicProfileId);
  const isOverviewTabActive = activePrivateTab === "overview";
  const isEngagementTabActive = activePrivateTab === "engagement";
  const isAchievementsTabActive = activePrivateTab === "achievements";
  const isPrizesTabActive = activePrivateTab === "prizes";

  const debugNavigate = React.useCallback(
    (target, options = undefined, reason = "unknown") => {
      profileDebugLog("navigate", {
        reason,
        fromPathname: location.pathname,
        fromSearch: location.search,
        target,
        options: options || null,
      });
      navigate(target, options);
    },
    [location.pathname, location.search, navigate]
  );

  const debugEffect = React.useCallback((name, deps) => {
    if (!PROFILE_DEBUG_ENABLED) return;
    const previous = profileDebugPrevEffectDepsRef.current[name];
    profileDebugPrevEffectDepsRef.current[name] = deps;
    profileDebugLog(`effect:${name}`, {
      previous: previous || null,
      current: deps,
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const hasBlockingOverlayOpen =
    Boolean(selectedBadgeInfo) ||
    Boolean(activeBadgeCelebration) ||
    isCompetitionHelpOpen ||
    isEngagementGuideOpen ||
    isPhotoViewerOpen ||
    isPublicPhotoViewerOpen ||
    isPhotoMenuOpen ||
    isSocialListOpen ||
    isEditOpen;
  const shouldPlayInlineBadgeVideos = isDocumentVisible && !hasBlockingOverlayOpen;
  const isLowEndDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const cores = Number(navigator.hardwareConcurrency || 0);
    const memory = Number(navigator.deviceMemory || 0);
    return (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
  }, []);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const useLiteBadgeViewer = isLowEndDevice || prefersReducedMotion;

  const enqueueBadgeCelebration = (achievement) => {
    if (!achievement) return;
    badgeCelebrationQueueRef.current.push(achievement);
    setBadgeCelebrationQueueSignal((prev) => prev + 1);
  };
  const { data: achievementRulesSettings = [] } = useAppSettings();
  const engagementGuideConfig = useMemo(() => {
    const rawValue = achievementRulesSettings.find((item) => item.key === PROFILE_ENGAGEMENT_GUIDE_KEY)?.value || "";
    return normalizeEngagementGuideConfig(parseJsonSetting(rawValue, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG));
  }, [achievementRulesSettings]);
  const avatarSrcById = useMemo(() => {
    const map = {};
    avatarOptions.forEach((item) => {
      map[item.id] = item.src;
    });
    return map;
  }, []);

  const [loadDiscoverProfiles, setLoadDiscoverProfiles] = useState(false);

  useEffect(() => {
    setShouldLoadCoreProfileData(false);
    if (!user?.id || isViewingPublicProfile) return undefined;

    const timerId = window.setTimeout(() => {
      setShouldLoadCoreProfileData(true);
    }, PROFILE_CORE_LOAD_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [isViewingPublicProfile, location.pathname, location.search, user?.id]);

  useEffect(() => {
    if (isViewingPublicProfile) return;
    setActivePrivateTab("overview");
  }, [isViewingPublicProfile, user?.id]);

  const { data: discoverProfilesData } = useQuery({
    queryKey: ["profile-discover-profiles", user?.id],
    queryFn: () => base44.social.discover({ limit: 12, offset: 0 }),
    enabled: !!user && loadDiscoverProfiles,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const simulatedBaseProfiles = useMemo(
    () =>
      (discoverProfilesData?.items || []).map((profile) => {
        const createdAt = new Date(profile.created_at || Date.now()).getTime();
        const daysSinceJoin = Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
        return {
          id: profile.id,
          nick: profile.nick || "Usuário",
          handle: profile.handle || String(profile.nick || "usuario").toLowerCase().replace(/\s+/g, "."),
          avatarSrc: getProfileAvatarSrc(profile, avatarSrcById, defaultAvatar) || defaultAvatar,
          followers: Number(profile.followers || 0),
          following: Number(profile.following || 0),
          likes: Number(profile.likes || 0),
          isFollowing: Boolean(profile.isFollowing),
          isLiked: Boolean(profile.isLiked),
          activeDays: Math.max(1, Math.min(daysSinceJoin + 1, 30)),
          activityCount: Number(profile.followers || 0) + Number(profile.likes || 0),
          depositedAmount: 0,
          daysSinceJoin,
          totalWins: 0,
          participations: 0,
          avatar_emoji: String(profile.avatar_emoji || ""),
          profile_avatar_id: String(profile.profile_avatar_id || ""),
          profile_image_mode: String(profile.profile_image_mode || "avatar"),
          profile_image_status: String(profile.profile_image_status || ""),
          profile_image_url: String(profile.profile_image_url || ""),
        };
      }),
    [discoverProfilesData?.items]
  );

  useEffect(() => {
    if (!authUser) {
      setUser((prev) => (prev === null ? prev : null));
      return;
    }

    setUser((prev) => {
      if (!prev) return authUser;

      const hasMeaningfulChange =
        prev.id !== authUser.id ||
        prev.nick !== authUser.nick ||
        prev.phone !== authUser.phone ||
        prev.profile_avatar_id !== authUser.profile_avatar_id ||
        prev.profile_image_mode !== authUser.profile_image_mode ||
        prev.profile_image_status !== authUser.profile_image_status ||
        prev.profile_image_url !== authUser.profile_image_url ||
        prev.profile_image_uploaded_at !== authUser.profile_image_uploaded_at;

      return hasMeaningfulChange ? authUser : prev;
    });
  }, [
    authUser?.id,
    authUser?.nick,
    authUser?.phone,
    authUser?.profile_avatar_id,
    authUser?.profile_image_mode,
    authUser?.profile_image_status,
    authUser?.profile_image_url,
    authUser?.profile_image_uploaded_at,
  ]);

  useEffect(() => {
    let revokedUrl = "";
    let active = true;

    async function loadPrivatePreview() {
      const shouldLoad = user?.profile_image_status === "manual_review" || user?.profile_image_status === "pending";

      if (!shouldLoad) {
        setPrivatePhotoPreview("");
        setIsPrivatePhotoLoading(false);
        return;
      }

      try {
        setIsPrivatePhotoLoading(true);
        const blob = await base44.auth.getMyPrivateProfileImage();
        revokedUrl = URL.createObjectURL(blob);
        if (active) setPrivatePhotoPreview(revokedUrl);
      } catch {
        if (active) setPrivatePhotoPreview("");
      } finally {
        if (active) setIsPrivatePhotoLoading(false);
      }
    }

    loadPrivatePreview();

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [user?.profile_image_mode, user?.profile_image_status, user?.profile_image_uploaded_at]);

  useEffect(() => {
    return () => {
      if (selectedEditPhotoPreview) {
        URL.revokeObjectURL(selectedEditPhotoPreview);
      }
    };
  }, [selectedEditPhotoPreview]);

  useEffect(() => {
    if (editData.imageMode !== "photo" && selectedEditPhotoPreview) {
      setSelectedEditPhotoFile(null);
      setSelectedEditPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setSelectedEditPhotoZoom(1);
      setSelectedEditPhotoOffsetY(0);
    }
  }, [editData.imageMode, selectedEditPhotoPreview]);

  useEffect(() => {
    if (!user?.id) return;
    const prefs = loadProfilePrefs(user.id);

    const normalized = {
      handle: prefs.handle || user.nick?.toLowerCase().replace(/\s+/g, "") || "usuario",
      alias: prefs.alias || "",
      avatarId: prefs.avatarId || user.profile_avatar_id || DEFAULT_AVATAR_ID,
      selectedPhotoUrl: prefs.selectedPhotoUrl || "",
      approvedPhotoUrls: Array.isArray(prefs.approvedPhotoUrls) ? prefs.approvedPhotoUrls : [],
      removedApprovedPhotoUrls: Array.isArray(prefs.removedApprovedPhotoUrls) ? prefs.removedApprovedPhotoUrls : [],
    };

    setProfilePrefs(normalized);
    setSocial({ followers: 0, following: 0, likes: 0, isFollowing: false, isLiked: false });
    setEditData({
      nick: user.nick || "",
      handle: normalized.handle,
      phone: user.phone || "",
      avatarId: normalized.avatarId,
      imageMode: user.profile_image_mode || "avatar",
    });
  }, [user]);

  useEffect(() => {
    const syncPrefs = () => {
      if (!user?.id) return;
      const prefs = loadProfilePrefs(user.id);
      setProfilePrefs((prev) => ({
        ...prev,
        selectedPhotoUrl: prefs.selectedPhotoUrl || prev.selectedPhotoUrl || "",
        approvedPhotoUrls: Array.isArray(prefs.approvedPhotoUrls) ? prefs.approvedPhotoUrls : prev.approvedPhotoUrls || [],
        removedApprovedPhotoUrls: Array.isArray(prefs.removedApprovedPhotoUrls)
          ? prefs.removedApprovedPhotoUrls
          : prev.removedApprovedPhotoUrls || [],
      }));
    };

    window.addEventListener("focus", syncPrefs);
    window.addEventListener("storage", syncPrefs);
    return () => {
      window.removeEventListener("focus", syncPrefs);
      window.removeEventListener("storage", syncPrefs);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (user.profile_image_status !== "approved" || !user.profile_image_url) return;

    setProfilePrefs((prev) => {
      const approvedUrl = user.profile_image_url;
      const nextApproved = prev.approvedPhotoUrls?.includes(approvedUrl)
        ? prev.approvedPhotoUrls
        : [approvedUrl, ...(prev.approvedPhotoUrls || []).filter((url) => url !== approvedUrl)];
      const nextRemoved = (prev.removedApprovedPhotoUrls || []).filter((url) => url !== approvedUrl);
      const hasValidSelection =
        !!prev.selectedPhotoUrl &&
        !nextRemoved.includes(prev.selectedPhotoUrl) &&
        nextApproved.includes(prev.selectedPhotoUrl);
      const nextSelected = hasValidSelection ? prev.selectedPhotoUrl : approvedUrl;

      if (
        prev.selectedPhotoUrl === nextSelected &&
        nextApproved === prev.approvedPhotoUrls &&
        nextRemoved === prev.removedApprovedPhotoUrls
      ) {
        return prev;
      }
      const next = {
        ...prev,
        selectedPhotoUrl: nextSelected,
        approvedPhotoUrls: nextApproved,
        removedApprovedPhotoUrls: nextRemoved,
      };
      saveProfilePrefs(user.id, next);
      return next;
    });
  }, [user?.id, user?.profile_image_status, user?.profile_image_url]);

  const approvedPhotoOptions = useMemo(() => {
    const removed = new Set(profilePrefs.removedApprovedPhotoUrls || []);
    const urls = [
      ...(profilePrefs.approvedPhotoUrls || []),
      user?.profile_image_status === "approved" && user?.profile_image_url ? user.profile_image_url : "",
    ].filter(Boolean);
    const unique = Array.from(new Set(urls));
    return unique.filter((url) => !removed.has(url));
  }, [profilePrefs.approvedPhotoUrls, profilePrefs.removedApprovedPhotoUrls, user?.profile_image_status, user?.profile_image_url]);

  const uploadImageMutation = useMutation({
    mutationFn: (file) => base44.auth.uploadProfileImage(file),
    onSuccess: (response) => {
      const isPendingStatus = response?.user?.profile_image_status === "manual_review" || response?.user?.profile_image_status === "pending";
      if (response?.user) {
        setUser(response.user);
        setEditData((prev) => ({ ...prev, imageMode: "photo" }));
        if (!isPendingStatus && user?.id && response.user.profile_image_url) {
          setProfilePrefs((prev) => {
            const next = {
              ...prev,
              selectedPhotoUrl: response.user.profile_image_url,
            };
            saveProfilePrefs(user.id, next);
            return next;
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["inicio-users"] });
      queryClient.invalidateQueries({ queryKey: ["inicio-recent-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["profile-discover-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-images", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-all-deposits"] });
      setSelectedEditPhotoFile(null);
      setSelectedEditPhotoPreview((prev) => {
        if (isPendingStatus) {
          setPrivatePhotoPreview((current) => {
            if (current && current !== prev) URL.revokeObjectURL(current);
            return prev || "";
          });
          return "";
        }
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setSelectedEditPhotoZoom(1);
      setSelectedEditPhotoOffsetY(0);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha no envio",
        description: error?.message || "Falha ao enviar foto.",
      });
    },
  });

  const cancelPendingImageMutation = useMutation({
    mutationFn: () => base44.auth.cancelMyPendingProfileImage(),
    onSuccess: (response) => {
      if (response?.user) {
        setUser(response.user);
      }
      setPrivatePhotoPreview("");
      queryClient.invalidateQueries({ queryKey: ["inicio-users"] });
      queryClient.invalidateQueries({ queryKey: ["inicio-recent-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["profile-discover-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-images", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-all-deposits"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao cancelar",
        description: error?.message || "Não foi possível cancelar o envio.",
      });
    },
  });

  const {
    data: profileSummaryData,
    isLoading: loadingProfileGamification,
    isFetching: fetchingProfileGamification,
    isError: isProfileGamificationError,
    error: profileGamificationError,
    refetch: refetchProfileSummary,
  } = useQuery({
    queryKey: ["profile-gamification-authoritative", user?.id],
    queryFn: ({ signal }) => {
      profileDebugLog("query:profile-summary-authoritative", {
        loggedUserId: user?.id || "",
        pathname: location.pathname,
        search: location.search,
      });
      return base44.gamification.profileSummary({ signal });
    },
    enabled: !!user && !isViewingPublicProfile && shouldLoadCoreProfileData,
    staleTime: 120000,
    retry: 1,
  });
  const shouldLoadCompetitionBoard =
    Boolean(user) &&
    !isViewingPublicProfile &&
    shouldLoadCoreProfileData &&
    isOverviewTabActive;
  const {
    data: profileCompetitionBoardData,
    isFetching: fetchingProfileCompetitionBoard,
    refetch: refetchProfileCompetitionBoard,
  } = useQuery({
    queryKey: ["profile-competition-board-authoritative", user?.id],
    queryFn: ({ signal }) => base44.gamification.profileCompetitionBoard({ signal }),
    enabled: shouldLoadCompetitionBoard,
    staleTime: 120000,
    retry: 1,
  });
  const profileGamification = useMemo(() => ({
    ...(profileSummaryData || {}),
    competitionBoard:
      profileCompetitionBoardData?.competitionBoard ||
      profileSummaryData?.competitionBoard ||
      {
        config: DEFAULT_PROFILE_COMPETITION_CONFIG,
        cycle: { remainingMs: 0, progressPct: 0 },
        entries: [],
        rewardLabel: "",
      },
    currentCompetitionEntry:
      profileCompetitionBoardData?.currentCompetitionEntry ||
      profileSummaryData?.currentCompetitionEntry ||
      null,
  }), [profileCompetitionBoardData, profileSummaryData]);
  const deferredProfileGamification = React.useDeferredValue(profileGamification);
  const [isRefreshingCompetitionData, setIsRefreshingCompetitionData] = useState(false);
  const [loadNonCriticalProfileData, setLoadNonCriticalProfileData] = useState(false);
  const hasProfileGamification = Boolean(profileSummaryData);
  const isProfileGamificationPending = !hasProfileGamification && (loadingProfileGamification || fetchingProfileGamification);
  const isProfileGamificationUnavailable = !hasProfileGamification && isProfileGamificationError;
  const canLoadDeferredProfileQueries =
    Boolean(user) &&
    loadNonCriticalProfileData &&
    hasProfileGamification &&
    !isProfileGamificationUnavailable;

  useEffect(() => {
    setLoadDiscoverProfiles(false);
    if (!canLoadDeferredProfileQueries || !isEngagementTabActive) return undefined;

    const timerId = window.setTimeout(() => {
      setLoadDiscoverProfiles(true);
    }, PROFILE_NON_CRITICAL_LOAD_DELAY_MS + 600);

    return () => window.clearTimeout(timerId);
  }, [canLoadDeferredProfileQueries, isEngagementTabActive, location.pathname, location.search, user?.id]);

  useEffect(() => {
    setLoadNonCriticalProfileData(false);
    if (!user?.id) return undefined;

    const timerId = window.setTimeout(() => {
      setLoadNonCriticalProfileData(true);
    }, PROFILE_NON_CRITICAL_LOAD_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [location.pathname, location.search, user?.id]);

  const refreshProfileCompetitionData = React.useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshingCompetitionData(true);
    try {
      const [freshSummary, freshBoard] = await Promise.all([
        base44.gamification.profileSummary({ force: true }),
        base44.gamification.profileCompetitionBoard({ force: true }),
      ]);
      queryClient.setQueryData(["profile-gamification-authoritative", user.id], freshSummary);
      queryClient.setQueryData(["profile-competition-board-authoritative", user.id], freshBoard);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["social-my-state", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["daily-checkin-state", user.id] }),
      ]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar perfil",
        description: error?.message || "Nao foi possivel atualizar os dados do perfil agora.",
      });
    } finally {
      setIsRefreshingCompetitionData(false);
    }
  }, [queryClient, toast, user?.id]);

  const { data: profileHistory, isLoading: loadingProfileHistory } = useQuery({
    queryKey: ["profile-history-authoritative", user?.id],
    queryFn: ({ signal }) => base44.gamification.profileHistory({ signal }),
    enabled: !!user && isPointsHistoryOpen,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: mySocialState } = useQuery({
    queryKey: ["social-my-state", user?.id],
    queryFn: () => base44.social.state("me"),
    enabled: canLoadDeferredProfileQueries,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: myFollowingProfiles = [], isLoading: loadingFollowingProfiles } = useQuery({
    queryKey: ["social-following-list", user?.id],
    queryFn: () => base44.social.following(),
    enabled: !!user && isSocialListOpen,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: myFollowerProfiles = [], isLoading: loadingFollowerProfiles } = useQuery({
    queryKey: ["social-follower-list", user?.id],
    queryFn: () => base44.social.followers(),
    enabled: !!user && isSocialListOpen,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: dailyCheckInState } = useQuery({
    queryKey: ["daily-checkin-state", user?.id],
    queryFn: () => base44.social.checkInState(),
    enabled: canLoadDeferredProfileQueries,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const pointsRules = useMemo(() => ({
    ...DEFAULT_POINTS_RULES,
    ...(deferredProfileGamification?.pointsRules || {}),
  }), [deferredProfileGamification]);

  const badgeRules = useMemo(
    () => normalizeBadgeRules(deferredProfileGamification?.badgeRules || DEFAULT_BADGE_RULES),
    [deferredProfileGamification]
  );

  const competitionBoard = useMemo(
    () =>
      deferredProfileGamification?.competitionBoard || {
        config: DEFAULT_PROFILE_COMPETITION_CONFIG,
        cycle: { remainingMs: 0, progressPct: 0 },
        entries: [],
        rewardLabel: "",
      },
    [deferredProfileGamification]
  );

  const activeCycle = competitionBoard?.cycle || null;

  const isLoading =
    isLoadingAuth ||
    !user;
  const initialProfileLoadTarget = useMemo(() => {
    const steps = [
      !isLoadingAuth,
      Boolean(user),
    ];
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  }, [isLoadingAuth, user]);

  const initialProfileLoadLabel = useMemo(() => {
    if (isLoadingAuth) return "Validando acesso";
    if (!user) return "Carregando dados do perfil";
    return "Finalizando perfil";
  }, [isLoadingAuth, user]);

  useEffect(() => {
    if (!isLoading) {
      setInitialProfileLoadProgress(100);
      return;
    }

    setInitialProfileLoadProgress((prev) => {
      const safePrev = Math.max(12, prev || 12);
      if (initialProfileLoadTarget <= safePrev) return safePrev;
      const nextStep = Math.max(2, (initialProfileLoadTarget - safePrev) * 0.35);
      return Math.min(initialProfileLoadTarget, safePrev + nextStep);
    });
  }, [initialProfileLoadTarget, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const timeoutId = window.setTimeout(() => {
      setInitialProfileLoadProgress(12);
    }, 240);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

  const metrics = useMemo(
    () =>
      deferredProfileGamification?.metrics || {
        position: 0,
        totalApproved: 0,
        totalTickets: 0,
        totalParticipations: 0,
        totalWins: 0,
        liveParticipations: 0,
        totalFollowers: 0,
        totalLikes: 0,
        totalCheckins: 0,
        followingCount: 0,
        points: 0,
        progress: 0,
        xpTotal: 0,
        xp_total: 0,
        weeklyPoints: 0,
      },
    [deferredProfileGamification]
  );

  useEffect(() => {
    if (!user?.id || !hasProfileGamification) return;
    const nextFollowers = Number(mySocialState?.followers ?? metrics.totalFollowers ?? 0);
    const nextFollowing = Number(mySocialState?.following ?? metrics.followingCount ?? 0);
    const nextLikes = Number(mySocialState?.likes ?? metrics.totalLikes ?? 0);

    setSocial((prev) => {
      if (
        prev.followers === nextFollowers &&
        prev.following === nextFollowing &&
        prev.likes === nextLikes &&
        prev.isFollowing === false &&
        prev.isLiked === false
      ) {
        return prev;
      }
      return {
        followers: nextFollowers,
        following: nextFollowing,
        likes: nextLikes,
        isFollowing: false,
        isLiked: false,
      };
    });
  }, [hasProfileGamification, metrics.followingCount, metrics.totalFollowers, metrics.totalLikes, mySocialState, user?.id]);

  const achievements = useMemo(
    () =>
      (deferredProfileGamification?.achievements || []).map((achievement) => ({
        key: achievement.key,
        label: achievement.label,
        icon: BADGE_ICON_MAP[achievement.iconKey] || Star,
        color: BADGE_COLOR_CLASS[achievement.colorKey] || "text-cyan-300",
        iconUrl: achievement.iconUrl || "",
        ruleText: achievement.ruleText || "",
      })),
    [deferredProfileGamification]
  );
  const badgeGallery = useMemo(() => buildBadgeGalleryFromRules(badgeRules, achievements), [badgeRules, achievements]);
  const progressBadges = useMemo(
    () =>
      deferredProfileGamification?.progressBadges?.length
        ? deferredProfileGamification.progressBadges
        : [buildProgressBadge(metrics, pointsRules)],
    [deferredProfileGamification, metrics, pointsRules]
  );
  const superFanProgress = progressBadges[0]?.progress ?? 0;
  const competitionEntryByUserId = useMemo(() => {
    const map = {};
    competitionBoard.entries.forEach((entry) => {
      map[entry.user_id] = entry;
    });
    return map;
  }, [competitionBoard.entries]);
  const realProfilesById = useMemo(() => {
    const map = {};
    const addProfile = (profile) => {
      if (!profile?.id) return;
      map[profile.id] = {
        ...(map[profile.id] || {}),
        ...profile,
      };
    };

    addProfile(user);
    (discoverProfilesData?.items || []).forEach(addProfile);
    (myFollowingProfiles || []).forEach(addProfile);
    (myFollowerProfiles || []).forEach(addProfile);
    return map;
  }, [discoverProfilesData?.items, myFollowerProfiles, myFollowingProfiles, user]);
  const simulatedProfiles = useMemo(() => {
    return simulatedBaseProfiles
      .map((profile) => {
        const leaderboardProfile = competitionEntryByUserId[profile.id] || {};
        const xpTotal = Math.max(0, Number(leaderboardProfile.xp_total || leaderboardProfile.xpTotal || profile.xpTotal || profile.xp_total || 0));
        const level = getLevelProgress(xpTotal).level;
        const engagementPoints = Math.max(0, Number(leaderboardProfile.engagement_points || profile.engagementPoints || profile.engagement_points || 0));
        const followers = Math.max(0, Number(profile.followers || leaderboardProfile.totalFollowers || 0));
        const totalParticipations = Math.max(
          0,
          Number(
            leaderboardProfile.totalParticipations ||
              profile.participations ||
              (Number(leaderboardProfile.liveParticipations || 0) +
                Number(leaderboardProfile.gameParticipations || 0) +
                Number(leaderboardProfile.instantParticipations || 0))
          )
        );
        const totalWins = Math.max(0, Number(leaderboardProfile.totalWins || profile.totalWins || 0));
        const weeklyPoints = Math.max(0, Number(leaderboardProfile.weekly_points || leaderboardProfile.points || profile.points || 0));
        const weeklyPosition = Math.max(0, Number(leaderboardProfile.position || 0));
        const participationStrength =
          totalParticipations * 1000000 +
          level * 100000 +
          totalWins * 10000 +
          weeklyPoints * 100 +
          followers * 10 +
          Math.max(0, 500 - weeklyPosition) +
          Number(profile.likes || leaderboardProfile.totalLikes || 0);
        return {
          ...profile,
          points: weeklyPoints,
          level,
          xpTotal,
          engagementPoints,
          participationStrength,
          weeklyPosition,
          tickets: Math.max(0, profile.followers + profile.likes),
          totalApproved: Number(leaderboardProfile.totalApproved || 0),
          totalWins,
          participations: totalParticipations,
          liveParticipations: Number(leaderboardProfile.liveParticipations || 0),
          gameParticipations: Number(leaderboardProfile.gameParticipations || 0),
          instantParticipations: Number(leaderboardProfile.instantParticipations || 0),
          following: Number(profile.following || leaderboardProfile.followingCount || 0),
          followers,
          likes: Number(profile.likes || leaderboardProfile.totalLikes || 0),
        };
      })
      .sort((a, b) => {
        if (b.participations !== a.participations) return b.participations - a.participations;
        if (b.level !== a.level) return b.level - a.level;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        if (b.points !== a.points) return b.points - a.points;
        if (a.weeklyPosition !== b.weeklyPosition) {
          if (!a.weeklyPosition) return 1;
          if (!b.weeklyPosition) return -1;
          return a.weeklyPosition - b.weeklyPosition;
        }
        if (b.followers !== a.followers) return b.followers - a.followers;
        if (b.xpTotal !== a.xpTotal) return b.xpTotal - a.xpTotal;
        if (b.participationStrength !== a.participationStrength) return b.participationStrength - a.participationStrength;
        if (b.engagementPoints !== a.engagementPoints) return b.engagementPoints - a.engagementPoints;
        return b.likes - a.likes;
      })
      .map((profile, index) => ({
        ...profile,
        position: index + 1,
      }));
  }, [competitionEntryByUserId, simulatedBaseProfiles]);

  const engagedProfiles = useMemo(() => {
    const candidateIds = new Set();

    (competitionBoard.entries || []).forEach((entry) => {
      const userId = String(entry?.user_id || "").trim();
      if (userId) candidateIds.add(userId);
    });
    (discoverProfilesData?.items || []).forEach((profile) => {
      const userId = String(profile?.id || "").trim();
      if (userId) candidateIds.add(userId);
    });
    (myFollowingProfiles || []).forEach((profile) => {
      const userId = String(profile?.id || "").trim();
      if (userId) candidateIds.add(userId);
    });
    (myFollowerProfiles || []).forEach((profile) => {
      const userId = String(profile?.id || "").trim();
      if (userId) candidateIds.add(userId);
    });

    return Array.from(candidateIds)
      .map((userId) => {
        const realProfile = realProfilesById[userId] || {};
        const leaderboardProfile = competitionEntryByUserId[userId] || {};
        const mergedProfile = {
          ...leaderboardProfile,
          ...realProfile,
          id: userId,
          profile_avatar_id: realProfile.profile_avatar_id || leaderboardProfile.profile_avatar_id || "",
          profile_image_mode: realProfile.profile_image_mode || leaderboardProfile.profile_image_mode || "avatar",
          profile_image_status: realProfile.profile_image_status || leaderboardProfile.profile_image_status || "",
          profile_image_url: realProfile.profile_image_url || leaderboardProfile.profile_image_url || "",
        };
        const nick = String(realProfile.nick || leaderboardProfile.nick || realProfile.full_name || "Usuário").trim() || "Usuário";
        const handle =
          String(realProfile.handle || "").trim() ||
          String(nick || "usuario")
            .toLowerCase()
            .replace(/\s+/g, ".")
            .replace(/[^a-z0-9._]/g, "") ||
          `usuario.${String(userId).slice(0, 6)}`;
        const avatarMatch = avatarSrcById[mergedProfile.profile_avatar_id] || "";
        const avatarSrc =
          getProfileAvatarSrc(mergedProfile, avatarSrcById, avatarMatch || defaultAvatar) ||
          avatarMatch ||
          defaultAvatar;
        const xpTotal = Math.max(
          0,
          Number(leaderboardProfile.xp_total || leaderboardProfile.xpTotal || realProfile.xp_total || realProfile.xpTotal || 0)
        );
        const level = getLevelProgress(xpTotal).level;
        const weeklyPoints = Math.max(0, Number(leaderboardProfile.weekly_points || leaderboardProfile.points || 0));
        const weeklyPosition = Math.max(0, Number(leaderboardProfile.position || 0));
        const totalWins = Math.max(0, Number(leaderboardProfile.totalWins || realProfile.totalWins || 0));
        const participations = Math.max(
          0,
          Number(
            leaderboardProfile.totalParticipations ||
              realProfile.participations ||
              (Number(leaderboardProfile.liveParticipations || 0) +
                Number(leaderboardProfile.gameParticipations || 0) +
                Number(leaderboardProfile.instantParticipations || 0))
          )
        );
        const followers = Math.max(0, Number(realProfile.followers || leaderboardProfile.totalFollowers || 0));
        const likes = Math.max(0, Number(realProfile.likes || leaderboardProfile.totalLikes || 0));
        const engagementPoints = Math.max(0, Number(leaderboardProfile.engagement_points || 0));
        const participationStrength =
          participations * 1000000 +
          level * 100000 +
          totalWins * 10000 +
          weeklyPoints * 100 +
          followers * 10 +
          Math.max(0, 500 - weeklyPosition) +
          likes;

        return {
          id: userId,
          nick,
          handle,
          avatarSrc,
          avatar_emoji: String(realProfile.avatar_emoji || ""),
          followers,
          likes,
          isFollowing: Boolean(realProfile.isFollowing),
          isLiked: Boolean(realProfile.isLiked),
          level,
          xpTotal,
          points: weeklyPoints,
          weeklyPosition,
          totalWins,
          participations,
          engagementPoints,
          participationStrength,
        };
      })
      .sort((a, b) => {
        if (b.participations !== a.participations) return b.participations - a.participations;
        if (b.level !== a.level) return b.level - a.level;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        if (b.points !== a.points) return b.points - a.points;
        if (a.weeklyPosition !== b.weeklyPosition) {
          if (!a.weeklyPosition) return 1;
          if (!b.weeklyPosition) return -1;
          return a.weeklyPosition - b.weeklyPosition;
        }
        if (b.followers !== a.followers) return b.followers - a.followers;
        if (b.xpTotal !== a.xpTotal) return b.xpTotal - a.xpTotal;
        if (b.participationStrength !== a.participationStrength) return b.participationStrength - a.participationStrength;
        if (b.engagementPoints !== a.engagementPoints) return b.engagementPoints - a.engagementPoints;
        return b.likes - a.likes;
      })
      .map((profile, index) => ({
        ...profile,
        position: index + 1,
      }));
  }, [
    avatarSrcById,
    competitionBoard.entries,
    competitionEntryByUserId,
    discoverProfilesData?.items,
    myFollowerProfiles,
    myFollowingProfiles,
    realProfilesById,
  ]);
  const engagedProfileSummaryQueries = useQueries({
    queries: engagedProfiles.slice(0, PROFILE_ENGAGED_QUERY_LIMIT).map((profile) => ({
      queryKey: ["public-profile-summary", profile.id, "engaged-card"],
      queryFn: ({ signal }) => base44.gamification.publicProfileSummary(profile.id, { signal }),
      enabled: PROFILE_PUBLIC_ENRICHMENT_ENABLED && canLoadDeferredProfileQueries && !!profile?.id,
      staleTime: 60000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  const publicProfileBasicIds = useMemo(() => {
    const ids = [];
    if (selectedPublicProfileId) ids.push(selectedPublicProfileId);
    if (canLoadDeferredProfileQueries) {
      engagedProfiles.slice(0, PROFILE_ENGAGED_QUERY_LIMIT).forEach((profile) => {
        if (profile?.id) ids.push(profile.id);
      });
    }
    return Array.from(new Set(ids.map((item) => String(item || "").trim()).filter(Boolean)));
  }, [canLoadDeferredProfileQueries, engagedProfiles, selectedPublicProfileId]);
  const {
    data: publicProfileBasicsPayload,
    isLoading: publicProfileBasicsLoading,
    isFetching: publicProfileBasicsFetching,
    error: publicProfileBasicsError,
  } = useQuery({
    queryKey: ["public-profile-basics", publicProfileBasicIds.join(","), String(selectedPublicProfileHandle || "").trim().toLowerCase()],
    queryFn: ({ signal }) =>
      base44.profile.publicBasics(
        publicProfileBasicIds,
        selectedPublicProfileHandle ? [selectedPublicProfileHandle] : [],
        { signal }
      ),
    enabled:
      !isLoadingAuth &&
      isViewingPublicProfile &&
      (publicProfileBasicIds.length > 0 || Boolean(selectedPublicProfileHandle)) &&
      (Boolean(selectedPublicProfileId) || Boolean(selectedPublicProfileHandle) || canLoadDeferredProfileQueries),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
  const publicProfileBasicsMap = useMemo(() => {
    const map = new Map();
    (publicProfileBasicsPayload?.items || []).forEach((item) => {
      if (item?.id) {
        map.set(String(item.id), item);
      }
    });
    return map;
  }, [publicProfileBasicsPayload?.items]);
  const selectedPublicUserByHandle = useMemo(() => {
    const normalizedHandle = normalizePublicHandleValue(selectedPublicProfileHandle);
    if (!normalizedHandle) return null;
    return (
      (publicProfileBasicsPayload?.items || []).find(
        (item) => normalizePublicHandleValue(item?.handle || item?.nick || "") === normalizedHandle
      ) || null
    );
  }, [publicProfileBasicsPayload?.items, selectedPublicProfileHandle]);
  const isPublicProfileResolving =
    isViewingPublicProfile &&
    (isLoadingAuth ||
      publicProfileBasicsLoading ||
      publicProfileBasicsFetching ||
      (!selectedPublicProfileId && Boolean(selectedPublicProfileHandle) && !simulatedProfiles.length));
  const hasPublicProfileLookupError =
    isViewingPublicProfile &&
    !isPublicProfileResolving &&
    Boolean(publicProfileBasicsError) &&
    !(publicProfileBasicsPayload?.items || []).length;
  const engagedProfileSocialQueries = useQueries({
    queries: engagedProfiles.slice(0, PROFILE_ENGAGED_QUERY_LIMIT).map((profile) => ({
      queryKey: ["social-target-state", user?.id, profile.id, "engaged-card"],
      queryFn: ({ signal }) => base44.social.state(profile.id, { signal }),
      enabled:
        !isLoadingAuth &&
        Boolean(user?.id) &&
        canLoadDeferredProfileQueries &&
        !!profile?.id &&
        String(profile.id || "") !== String(user?.id || ""),
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  const engagedProfilesWithSummary = useMemo(() => {
    const summaryMap = new Map();
    const socialMap = new Map();
    engagedProfiles.slice(0, PROFILE_ENGAGED_QUERY_LIMIT).forEach((profile, index) => {
      const payload = engagedProfileSummaryQueries[index]?.data || null;
      if (payload) summaryMap.set(profile.id, payload);
      const socialPayload = engagedProfileSocialQueries[index]?.data || null;
      if (socialPayload) socialMap.set(profile.id, socialPayload);
    });

    return engagedProfiles
      .map((profile) => {
        const realUser = publicProfileBasicsMap.get(String(profile.id || "")) || null;
        const summary = summaryMap.get(profile.id) || null;
        const summaryMetrics = summary?.metrics || {};
        const summaryEntry = summary?.currentCompetitionEntry || {};
        const socialState = socialMap.get(profile.id) || null;
        const xpTotal = Math.max(0, Number(summaryMetrics.xpTotal ?? summaryMetrics.xp_total ?? profile.xpTotal ?? 0));
        const level = getLevelProgress(xpTotal).level;
        const points = Math.max(0, Number(summaryEntry.weekly_points ?? profile.points ?? 0));
        const weeklyPosition = Math.max(0, Number(summaryEntry.position ?? profile.weeklyPosition ?? 0));
        const totalWins = Math.max(0, Number(summaryMetrics.totalWins ?? profile.totalWins ?? 0));
        const participations = Math.max(0, Number(summaryMetrics.totalParticipations ?? profile.participations ?? 0));
        const followers = Math.max(0, Number(socialState?.followers ?? summaryMetrics.totalFollowers ?? profile.followers ?? 0));
        const likes = Math.max(0, Number(socialState?.likes ?? summaryMetrics.totalLikes ?? profile.likes ?? 0));
        const engagementPoints = Math.max(0, Number(summaryMetrics.points ?? profile.engagementPoints ?? 0));
        const participationStrength =
          participations * 1000000 +
          level * 100000 +
          totalWins * 10000 +
          points * 100 +
          followers * 10 +
          Math.max(0, 500 - weeklyPosition) +
          likes;
        const avatarMatch = avatarSrcById[realUser?.profile_avatar_id || ""] || "";
        const avatarSrc =
          getProfileAvatarSrc(realUser || profile, avatarSrcById, avatarMatch || profile.avatarSrc || defaultAvatar) ||
          avatarMatch ||
          profile.avatarSrc ||
          defaultAvatar;

        return {
          ...profile,
          avatarSrc,
          xpTotal,
          level,
          points,
          weeklyPosition,
          totalWins,
          participations,
          followers,
          likes,
          isFollowing: Boolean(socialState?.isFollowing ?? profile.isFollowing),
          isLiked: Boolean(socialState?.isLiked ?? profile.isLiked),
          engagementPoints,
          participationStrength,
        };
      })
      .sort((a, b) => {
        if (b.participations !== a.participations) return b.participations - a.participations;
        if (b.level !== a.level) return b.level - a.level;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        if (b.points !== a.points) return b.points - a.points;
        if (a.weeklyPosition !== b.weeklyPosition) {
          if (!a.weeklyPosition) return 1;
          if (!b.weeklyPosition) return -1;
          return a.weeklyPosition - b.weeklyPosition;
        }
        if (b.followers !== a.followers) return b.followers - a.followers;
        if (b.xpTotal !== a.xpTotal) return b.xpTotal - a.xpTotal;
        if (b.participationStrength !== a.participationStrength) return b.participationStrength - a.participationStrength;
        if (b.engagementPoints !== a.engagementPoints) return b.engagementPoints - a.engagementPoints;
        return b.likes - a.likes;
      })
      .map((profile, index) => ({
        ...profile,
        position: index + 1,
      }));
  }, [avatarSrcById, engagedProfileSocialQueries, engagedProfileSummaryQueries, engagedProfiles, publicProfileBasicsMap]);

  useEffect(() => {
    if (!simulatedProfiles.length) return;
    const followingIds = new Set((myFollowingProfiles || []).map((profile) => String(profile?.id || "")));
    setSimState((prev) => {
      let changed = false;
      const next = { ...prev };
      simulatedProfiles.forEach((profile) => {
        const profileId = String(profile.id || "");
        const current = next[profileId] || {};
        const computed = {
          ...current,
          isFollowing:
            typeof current.isFollowing === "boolean"
              ? current.isFollowing
              : Boolean(profile.isFollowing) || followingIds.has(profileId),
          isLiked:
            typeof current.isLiked === "boolean"
              ? current.isLiked
              : Boolean(profile.isLiked),
          followers:
            typeof current.followers === "number"
              ? current.followers
              : Number(profile.followers || 0),
          likes:
            typeof current.likes === "number"
              ? current.likes
              : Number(profile.likes || 0),
        };

        if (
          current.isFollowing !== computed.isFollowing ||
          current.isLiked !== computed.isLiked ||
          current.followers !== computed.followers ||
          current.likes !== computed.likes
        ) {
          next[profileId] = computed;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [myFollowingProfiles, simulatedProfiles]);

  const currentCompetitionEntry = deferredProfileGamification?.currentCompetitionEntry || competitionEntryByUserId[user?.id] || {
    user_id: user?.id || "",
    points: 0,
    position: 0,
    weekly_points: 0,
  };
  const competitionTimeLeft = formatTimeLeft(competitionRemainingMsLive);
  const competitionInstructions = String(competitionBoard.config.instructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const engagementGuideInstructions = String(engagementGuideConfig.instructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const authoritativeXpTotal = Number(metrics.xpTotal ?? metrics.xp_total ?? 0);
  const levelProgress = useMemo(() => getLevelProgress(authoritativeXpTotal), [authoritativeXpTotal]);
  const weeklyPointsHistory = useMemo(
    () =>
      buildPointsHistorySummary(profileHistory?.ledger || [], ["weekly_points"], {
        cycleKey: deferredProfileGamification?.competitionBoard?.cycle?.cycle_key || "",
      }),
    [deferredProfileGamification?.competitionBoard?.cycle?.cycle_key, profileHistory?.ledger]
  );
  const profileLevelHistory = useMemo(
    () => buildPointsHistorySummary(profileHistory?.ledger || [], ["engagement_points", "xp_total"]),
    [profileHistory?.ledger]
  );
  const recentCheckInDays = useMemo(
    () => buildCheckInCalendarDays(dailyCheckInState?.recentDays || []),
    [dailyCheckInState?.recentDays]
  );
  const activePointsHistory = pointsHistoryTab === "weekly" ? weeklyPointsHistory : profileLevelHistory;
  const pointsHistoryTotal = activePointsHistory.reduce((acc, entry) => acc + Number(entry.total || 0), 0);
  const todayCheckInEntry = recentCheckInDays.find((item) => item.isToday) || null;
  const checkInCollectedDays = recentCheckInDays.filter((item) => item.checkedIn).length;
  const checkInProgressDays = useMemo(() => {
    const rewards = Array.isArray(dailyCheckInState?.rewards) ? dailyCheckInState.rewards : [];
    const streakDay = Math.max(0, Number(dailyCheckInState?.streakDay || 0));
    const nextDay = Math.min(7, Math.max(1, Number(dailyCheckInState?.nextDay || 1)));
    const checkedInToday = Boolean(dailyCheckInState?.checkedIn);

    return rewards.map((reward, index) => {
      const dayNumber = Number(reward?.day || index + 1);
      let state = "locked";
      if (checkedInToday ? dayNumber <= streakDay : dayNumber < nextDay) {
        state = "collected";
      } else if (!checkedInToday && dayNumber === nextDay) {
        state = "available";
      } else if (checkedInToday && dayNumber === Math.min(7, streakDay + 1)) {
        state = "next";
      }
      return {
        day: dayNumber,
        label: reward?.label || `Dia ${dayNumber}`,
        weeklyPoints: Number(reward?.weekly_points || 0),
        state,
      };
    });
  }, [dailyCheckInState?.checkedIn, dailyCheckInState?.nextDay, dailyCheckInState?.rewards, dailyCheckInState?.streakDay]);

  useEffect(() => {
    const endsAtRaw = competitionBoard?.cycle?.ends_at;
    const endsAtMs = new Date(endsAtRaw || 0).getTime();

    if (!Number.isFinite(endsAtMs) || endsAtMs <= 0) {
      setCompetitionRemainingMsLive(Math.max(0, Number(competitionBoard?.cycle?.remainingMs || 0)));
      return undefined;
    }

    const updateRemaining = () => {
      setCompetitionRemainingMsLive(Math.max(0, endsAtMs - Date.now()));
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [competitionBoard?.cycle?.ends_at, competitionBoard?.cycle?.remainingMs]);

  useEffect(() => {
    if (!isCheckInCalendarOpen) return;
    const container = checkInCarouselRef.current;
    if (!container) return;

    const focusDay =
      checkInProgressDays.find((day) => day.state === "available") ||
      checkInProgressDays.find((day) => day.state === "next") ||
      checkInProgressDays[0];

    if (!focusDay) return;

    const target = checkInDayRefs.current[focusDay.day];
    if (!target) return;

    const containerWidth = container.clientWidth;
    const targetLeft = target.offsetLeft;
    const targetWidth = target.clientWidth;
    const nextLeft = Math.max(0, targetLeft - (containerWidth - targetWidth) / 2);

    const timer = window.setTimeout(() => {
      container.scrollTo({
        left: nextLeft,
        behavior: "smooth",
      });
    }, 60);

    return () => window.clearTimeout(timer);
  }, [checkInProgressDays, isCheckInCalendarOpen]);

  const handleCheckInCarouselPointerDown = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = checkInCarouselRef.current;
    if (!container) return;
    checkInCarouselDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
      pointerId: event.pointerId,
    };
    container.setPointerCapture?.(event.pointerId);
  };

  const handleCheckInCarouselPointerMove = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = checkInCarouselRef.current;
    const state = checkInCarouselDragRef.current;
    if (!container || !state.isDragging) return;
    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 4) {
      state.moved = true;
    }
    container.scrollLeft = state.startScrollLeft - deltaX;
  };

  const handleCheckInCarouselPointerUpOrCancel = () => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = checkInCarouselRef.current;
    const state = checkInCarouselDragRef.current;
    if (container && state.pointerId !== null) {
      try {
        container.releasePointerCapture?.(state.pointerId);
      } catch {
        // ignore release failures
      }
    }
    checkInCarouselDragRef.current = {
      isDragging: false,
      startX: 0,
      startScrollLeft: 0,
      moved: false,
      pointerId: null,
    };
  };

  const handleCheckInCarouselClickCapture = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    if (checkInCarouselDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleCheckInCarouselWheel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = checkInCarouselRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    container.scrollLeft += event.deltaY;
  };

  const selectedAvatar =
    avatarOptions.find((item) => item.id === profilePrefs.avatarId) ||
    avatarOptions.find((item) => item.id === DEFAULT_AVATAR_ID) ||
    avatarOptions[0];
  const profileImageSrc =
    user?.profile_image_status === "manual_review" || user?.profile_image_status === "pending"
      ? privatePhotoPreview || selectedAvatar?.src
      : user?.profile_image_mode === "photo" && user?.profile_image_status === "approved"
      ? (profilePrefs.selectedPhotoUrl || user?.profile_image_url)
        ? resolveAssetUrl(profilePrefs.selectedPhotoUrl || user.profile_image_url)
        : selectedAvatar?.src
      : selectedAvatar?.src;
  const secondaryProfileImageSrc =
    user?.profile_image_status === "approved" &&
    user?.profile_image_url &&
    resolveAssetUrl(user.profile_image_url) !== profileImageSrc
      ? resolveAssetUrl(user.profile_image_url)
      : "";
  const safeProfileImageSrc =
    profileImageFallbackStep === 0
      ? profileImageSrc
      : profileImageFallbackStep === 1 && secondaryProfileImageSrc
      ? secondaryProfileImageSrc
      : selectedAvatar?.src;

  useEffect(() => {
    setProfileImageFallbackStep(0);
  }, [profileImageSrc, secondaryProfileImageSrc, selectedAvatar?.src]);

  profileDebugRenderCountRef.current += 1;
  profileDebugLog("render", {
    renderCount: profileDebugRenderCountRef.current,
    pathname: location.pathname,
    search: location.search,
    routeUserId: selectedPublicProfileId,
    routeHandle: selectedPublicProfileHandle,
    loggedUserId: user?.id || "",
    isViewingPublicProfile,
  });

  useEffect(() => {
    profileDebugLog("mount", {
      pathname: location.pathname,
      search: location.search,
      loggedUserId: user?.id || "",
    });
    return () => {
      profileDebugLog("unmount", {
        pathname: location.pathname,
        search: location.search,
        loggedUserId: user?.id || "",
      });
    };
  }, []);

  const selectedPublicUserById = publicProfileBasicsMap.get(String(selectedPublicProfileId || "")) || null;
  const selectedPublicUser = selectedPublicUserById || selectedPublicUserByHandle || null;

  useEffect(() => {
    debugEffect("scroll-public-profile", {
      isViewingPublicProfile,
      selectedPublicProfileHandle,
      selectedPublicProfileId,
    });
    if (!isViewingPublicProfile) return;
    const scrollRoot = document.querySelector('[data-app-scroll-root="true"]');
    if (scrollRoot && "scrollTo" in scrollRoot) {
      scrollRoot.scrollTo({ top: 0, behavior: "auto" });
    } else if (scrollRoot) {
      scrollRoot.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isViewingPublicProfile, selectedPublicProfileHandle, selectedPublicProfileId]);

  const selectedPublicProfile = useMemo(() => {
    if (!selectedPublicProfileHandle && !selectedPublicProfileId) return null;
    if (selectedPublicProfileId && competitionEntryByUserId[selectedPublicProfileId]) {
      const entry = competitionEntryByUserId[selectedPublicProfileId];
      const resolvedProfile = selectedPublicUser || realProfilesById[selectedPublicProfileId] || entry;
      const avatarMatch = avatarOptions.find((item) => item.id === resolvedProfile.profile_avatar_id || item.id === entry.profile_avatar_id);
      return {
        id: entry.user_id,
        nick: resolvedProfile.nick || entry.nick,
        handle: resolvedProfile.handle || String(resolvedProfile.nick || entry.nick || "usuario").toLowerCase().replace(/\s+/g, "."),
        avatarSrc:
          getProfileAvatarSrc(resolvedProfile, avatarSrcById, avatarMatch?.src || defaultAvatar) ||
          avatarMatch?.src ||
          defaultAvatar,
        avatar_emoji: String(resolvedProfile.avatar_emoji || entry.avatar_emoji || ""),
        profile_avatar_id: String(resolvedProfile.profile_avatar_id || entry.profile_avatar_id || ""),
        profile_image_mode: String(resolvedProfile.profile_image_mode || entry.profile_image_mode || "avatar"),
        profile_image_status: String(resolvedProfile.profile_image_status || entry.profile_image_status || ""),
        profile_image_url: String(resolvedProfile.profile_image_url || entry.profile_image_url || ""),
        points: Number(entry.weekly_points ?? entry.points ?? 0),
        xpTotal: Math.max(0, Number(entry.xp_total ?? entry.xpTotal ?? resolvedProfile.xp_total ?? resolvedProfile.xpTotal ?? 0)),
        xp_total: Math.max(0, Number(entry.xp_total ?? entry.xpTotal ?? resolvedProfile.xp_total ?? resolvedProfile.xpTotal ?? 0)),
        tickets: Number(entry.totalTickets || 0),
        participations:
          Number(entry.liveParticipations || 0) +
          Number(entry.gameParticipations || 0) +
          Number(entry.instantParticipations || 0),
        position: entry.position,
        totalWins: Number(entry.totalWins || 0),
        totalApproved: Number(entry.totalApproved || 0),
        liveParticipations: Number(entry.liveParticipations || 0),
        following: Number(entry.followingCount || 0),
        followers: Number(entry.totalFollowers || 0),
        likes: Number(entry.totalLikes || 0),
      };
    }
    if (selectedPublicUser) {
      return {
        id: selectedPublicUser.id,
        nick: selectedPublicUser.nick || "Usuário",
        handle:
          selectedPublicUser.handle ||
          String(selectedPublicUser.nick || "usuario")
            .toLowerCase()
            .replace(/\s+/g, "."),
        avatarSrc: getProfileAvatarSrc(selectedPublicUser, avatarSrcById, defaultAvatar) || defaultAvatar,
        avatar_emoji: String(selectedPublicUser.avatar_emoji || ""),
        profile_avatar_id: String(selectedPublicUser.profile_avatar_id || ""),
        profile_image_mode: String(selectedPublicUser.profile_image_mode || "avatar"),
        profile_image_status: String(selectedPublicUser.profile_image_status || ""),
        profile_image_url: String(selectedPublicUser.profile_image_url || ""),
        points: 0,
        xpTotal: Math.max(0, Number(selectedPublicUser.xp_total ?? selectedPublicUser.xpTotal ?? 0)),
        xp_total: Math.max(0, Number(selectedPublicUser.xp_total ?? selectedPublicUser.xpTotal ?? 0)),
        tickets: 0,
        participations: 0,
        position: 0,
        totalWins: 0,
        totalApproved: 0,
        liveParticipations: 0,
        following: Number(selectedPublicUser.following || 0),
        followers: Number(selectedPublicUser.followers || 0),
        likes: Number(selectedPublicUser.likes || 0),
      };
    }
    const baseProfile = selectedPublicProfileHandle
      ? simulatedProfiles.find((profile) => profile.handle === selectedPublicProfileHandle)
      : simulatedProfiles.find((profile) => profile.id === selectedPublicProfileId);
    if (!baseProfile) return null;
    const state = simState[baseProfile.id] || {};
    const resolvedBaseProfile =
      publicProfileBasicsMap.get(String(baseProfile.id || "")) ||
      realProfilesById[String(baseProfile.id || "")] ||
      baseProfile;
    return {
      ...baseProfile,
      avatarSrc:
        getProfileAvatarSrc(resolvedBaseProfile, avatarSrcById, baseProfile.avatarSrc || defaultAvatar) ||
        baseProfile.avatarSrc ||
        defaultAvatar,
      profile_avatar_id: String(resolvedBaseProfile.profile_avatar_id || baseProfile.profile_avatar_id || ""),
      profile_image_mode: String(resolvedBaseProfile.profile_image_mode || baseProfile.profile_image_mode || "avatar"),
      profile_image_status: String(resolvedBaseProfile.profile_image_status || baseProfile.profile_image_status || ""),
      profile_image_url: String(resolvedBaseProfile.profile_image_url || baseProfile.profile_image_url || ""),
      followers: state.followers ?? baseProfile.followers,
      likes: state.likes ?? baseProfile.likes,
    };
  }, [
    selectedPublicProfileHandle,
    selectedPublicProfileId,
    simulatedProfiles,
    simState,
    competitionEntryByUserId,
    avatarOptions,
    realProfilesById,
    selectedPublicUser,
    avatarSrcById,
    publicProfileBasicsMap,
  ]);

  const isSelectedRealProfile = Boolean(selectedPublicProfile?.id);
  const isOwnSelectedPublicProfile = Boolean(selectedPublicProfile?.id && selectedPublicProfile.id === user?.id);

  profileDebugLog("resolved-profile-target", {
    selectedPublicProfileId,
    selectedPublicProfileHandle,
    selectedPublicProfileResolvedId: selectedPublicProfile?.id || "",
    selectedPublicProfileResolvedHandle: selectedPublicProfile?.handle || "",
    isSelectedRealProfile,
    isOwnSelectedPublicProfile,
    loggedUserId: user?.id || "",
  });

  const { data: profileNotifications = [] } = useQuery({
    queryKey: ["profile-notifications", user?.id],
    queryFn: async () => {
      const response = await base44.profile.notifications({ limit: 50 });
      return response?.items || [];
    },
    enabled: Boolean(user?.id) && !isLoadingAuth && !isViewingPublicProfile && canLoadDeferredProfileQueries,
    staleTime: 15000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const markProfileNotificationsReadMutation = useMutation({
    mutationFn: async (notificationIds) => base44.profile.markNotificationsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-notifications", user?.id] });
    },
  });

  const unreadProfileNotifications = useMemo(
    () => profileNotifications.filter((item) => String(item?.status || "unread").toLowerCase() !== "read"),
    [profileNotifications]
  );

  const { data: selectedPublicSocialState } = useQuery({
    queryKey: ["social-target-state", user?.id, selectedPublicProfile?.id],
    queryFn: ({ signal }) => {
      profileDebugLog("query:social-target-state", {
        viewerUserId: user?.id || "",
        targetUserId: selectedPublicProfile?.id || "",
      });
      return base44.social.state(selectedPublicProfile.id, { signal });
    },
    enabled:
      !isLoadingAuth &&
      Boolean(user?.id) &&
      canLoadDeferredProfileQueries &&
      !!selectedPublicProfile?.id &&
      isSelectedRealProfile,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: selectedPublicProfileSummary } = useQuery({
    queryKey: ["public-profile-summary", selectedPublicProfile?.id],
    queryFn: ({ signal }) => {
      profileDebugLog("query:public-profile-summary", {
        targetUserId: selectedPublicProfile?.id || "",
        loggedUserId: user?.id || "",
      });
      return base44.gamification.publicProfileSummary(selectedPublicProfile.id, { signal });
    },
    enabled:
      PROFILE_PUBLIC_ENRICHMENT_ENABLED &&
      canLoadDeferredProfileQueries &&
      !!selectedPublicProfile?.id &&
      isSelectedRealProfile,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const randomizedOtherProfiles = useMemo(() => {
    const selectedId = selectedPublicProfile?.id;
    const prioritizedCandidates = simulatedProfiles.filter((profile) => {
      if (selectedId && profile.id === selectedId) return false;
      const state = simState[profile.id];
      // Para rotacionar recomendaÃ§Ãµes, removemos perfis jÃ¡ "concluÃ­dos" (seguindo + curtido).
      return !(state?.isFollowing && state?.isLiked);
    });

    const fallbackCandidates = simulatedProfiles.filter((profile) => {
      if (selectedId && profile.id === selectedId) return false;
      return true;
    });
    const candidates = prioritizedCandidates.length > 0 ? prioritizedCandidates : fallbackCandidates;

    const shuffled = [...candidates];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled.slice(0, 50);
  }, [selectedPublicProfile?.id, simulatedProfiles, simState]);

  useEffect(() => {
    debugEffect("badge-celebration-reset", {
      loggedUserId: user?.id || "",
      isViewingPublicProfile,
    });
    if (!user?.id || isViewingPublicProfile) {
      badgeCelebrationQueueRef.current = [];
      seenBadgeCelebrationsRef.current = new Set();
      lastAchievementKeysRef.current = new Set();
      badgeCelebrationPreparingRef.current = false;
      badgeCelebrationPrepareTokenRef.current += 1;
      setActiveBadgeCelebration(null);
      setBadgeCelebrationQueueSignal((prev) => prev + 1);
      return;
    }

    seenBadgeCelebrationsRef.current = loadSeenBadgeCelebrations(user.id);
    lastAchievementKeysRef.current = new Set();
    badgeCelebrationQueueRef.current = [];
    badgeCelebrationPreparingRef.current = false;
    badgeCelebrationPrepareTokenRef.current += 1;
    setActiveBadgeCelebration(null);
    setBadgeCelebrationQueueSignal((prev) => prev + 1);
  }, [user?.id, isViewingPublicProfile]);

  useEffect(() => {
    debugEffect("simulated-badge-from-querystring", {
      loggedUserId: user?.id || "",
      isViewingPublicProfile,
      search: location.search,
    });
    if (!user?.id || isViewingPublicProfile) return;
    const params = new URLSearchParams(location.search || "");
    const simulatedBadgeId = String(params.get("simBadge") || "").trim();
    if (!simulatedBadgeId) return;

    const matchedRule = badgeRules.find((rule) => rule.id === simulatedBadgeId) || null;
    if (!matchedRule) return;

    const simulatedAchievement = {
      key: matchedRule.id,
      label: matchedRule.label,
      icon: BADGE_ICON_MAP[matchedRule.icon] || Star,
      color: BADGE_COLOR_CLASS[matchedRule.color] || "text-cyan-300",
      iconUrl: matchedRule.icon_url || "",
      ruleText: formatBadgeRuleText(matchedRule),
    };
    enqueueBadgeCelebration(simulatedAchievement);
  }, [user?.id, isViewingPublicProfile, location.search, badgeRules]);

  useEffect(() => {
    debugEffect("new-achievements", {
      loggedUserId: user?.id || "",
      isViewingPublicProfile,
      achievementCount: achievements?.length || 0,
    });
    if (!user?.id || isViewingPublicProfile) return;

    const currentKeys = new Set((achievements || []).map((item) => item.key));
    const previousKeys = lastAchievementKeysRef.current;

    if (previousKeys.size === 0) {
      lastAchievementKeysRef.current = currentKeys;
      return;
    }

    const unlockedNow = (achievements || []).filter((item) => currentKeys.has(item.key) && !previousKeys.has(item.key));
    lastAchievementKeysRef.current = currentKeys;
    if (unlockedNow.length === 0) return;

    const unseenUnlocks = unlockedNow.filter((item) => !seenBadgeCelebrationsRef.current.has(item.key));
    if (unseenUnlocks.length === 0) return;

    unseenUnlocks.forEach((item) => {
      seenBadgeCelebrationsRef.current.add(item.key);
      enqueueBadgeCelebration(item);
    });
    saveSeenBadgeCelebrations(user.id, seenBadgeCelebrationsRef.current);
  }, [achievements, user?.id, isViewingPublicProfile]);

  useEffect(() => {
    return () => {
      profileDebugLog("cleanup:profile-unmount", {
        pathname: location.pathname,
        search: location.search,
      });
      const timers = profileSwitchLoaderTimerRef.current;
      if (timers.progressInterval) window.clearInterval(timers.progressInterval);
      if (timers.hideTimeout) window.clearTimeout(timers.hideTimeout);
      if (timers.failSafeTimeout) window.clearTimeout(timers.failSafeTimeout);

      const releasePointerCaptureSafely = (ref, dragRef) => {
        const container = ref?.current;
        const pointerId = dragRef?.current?.pointerId;
        if (container && pointerId !== null && pointerId !== undefined) {
          try {
            container.releasePointerCapture?.(pointerId);
          } catch {
            // ignore release failures during teardown
          }
        }
        if (dragRef?.current) {
          dragRef.current.isDragging = false;
          dragRef.current.moved = false;
          if ("pointerId" in dragRef.current) {
            dragRef.current.pointerId = null;
          }
        }
      };

      releasePointerCaptureSafely(checkInCarouselRef, checkInCarouselDragRef);
      releasePointerCaptureSafely(simulatedStripRef, simulatedDragRef);
      releasePointerCaptureSafely(publicOtherStripRef, publicOtherDragRef);
      releasePointerCaptureSafely(publicBadgeStripRef, publicBadgeDragRef);
      releasePointerCaptureSafely(privateBadgeStripRef, privateBadgeDragRef);
      releasePointerCaptureSafely(competitionRankingRef, competitionRankingDragRef);
    };
  }, []);

  const clearProfileSwitchLoaderTimers = () => {
    const timers = profileSwitchLoaderTimerRef.current;
    if (timers.progressInterval) {
      window.clearInterval(timers.progressInterval);
      timers.progressInterval = null;
    }
    if (timers.hideTimeout) {
      window.clearTimeout(timers.hideTimeout);
      timers.hideTimeout = null;
    }
    if (timers.failSafeTimeout) {
      window.clearTimeout(timers.failSafeTimeout);
      timers.failSafeTimeout = null;
    }
  };

  const startProfileSwitchLoader = () => {
    clearProfileSwitchLoaderTimers();
    setIsProfileSwitchLoading(true);
    setProfileSwitchProgress(8);

    profileSwitchLoaderTimerRef.current.progressInterval = window.setInterval(() => {
      setProfileSwitchProgress((prev) => {
        if (prev >= 88) return prev;
        const nextStep = Math.max(1.5, (88 - prev) * 0.18);
        return Math.min(88, prev + nextStep);
      });
    }, 85);

    profileSwitchLoaderTimerRef.current.failSafeTimeout = window.setTimeout(() => {
      clearProfileSwitchLoaderTimers();
      setProfileSwitchProgress(100);
      profileSwitchLoaderTimerRef.current.hideTimeout = window.setTimeout(() => {
        setIsProfileSwitchLoading(false);
        setProfileSwitchProgress(0);
      }, 240);
    }, 2600);
  };

  const finishProfileSwitchLoader = () => {
    const timers = profileSwitchLoaderTimerRef.current;
    if (timers.progressInterval) {
      window.clearInterval(timers.progressInterval);
      timers.progressInterval = null;
    }
    if (timers.failSafeTimeout) {
      window.clearTimeout(timers.failSafeTimeout);
      timers.failSafeTimeout = null;
    }
    if (timers.hideTimeout) {
      window.clearTimeout(timers.hideTimeout);
    }
    setProfileSwitchProgress(100);
    timers.hideTimeout = window.setTimeout(() => {
      setIsProfileSwitchLoading(false);
      setProfileSwitchProgress(0);
      timers.hideTimeout = null;
    }, 240);
  };

  useEffect(() => {
    debugEffect("profile-switch-loader-finish", {
      isProfileSwitchLoading,
      isViewingPublicProfile,
      selectedPublicProfileId: selectedPublicProfile?.id || "",
    });
    if (!isProfileSwitchLoading) return;
    if (isViewingPublicProfile && selectedPublicProfile) {
      finishProfileSwitchLoader();
    }
  }, [isProfileSwitchLoading, isViewingPublicProfile, selectedPublicProfile?.id]);

  useEffect(() => {
    const audio = new Audio(badgeClickSound);
    audio.preload = "auto";
    badgeClickAudioRef.current = audio;
    return () => {
      badgeClickAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = new Audio(badgeWinSound);
    audio.preload = "auto";
    badgeWinAudioRef.current = audio;
    const unlockAudioByGesture = () => {
      if (hasUnlockedBadgeWinAudioRef.current) return;
      const targetAudio = badgeWinAudioRef.current;
      if (!targetAudio) return;
      const previousMuted = targetAudio.muted;
      targetAudio.muted = true;
      targetAudio.currentTime = 0;
      targetAudio.play()
        .then(() => {
          targetAudio.pause();
          targetAudio.currentTime = 0;
          targetAudio.muted = previousMuted;
          hasUnlockedBadgeWinAudioRef.current = true;
          window.removeEventListener("pointerdown", unlockAudioByGesture);
          window.removeEventListener("keydown", unlockAudioByGesture);
          window.removeEventListener("touchstart", unlockAudioByGesture);
        })
        .catch(() => {
          targetAudio.muted = previousMuted;
        });
    };
    window.addEventListener("pointerdown", unlockAudioByGesture);
    window.addEventListener("keydown", unlockAudioByGesture);
    window.addEventListener("touchstart", unlockAudioByGesture);
    return () => {
      window.removeEventListener("pointerdown", unlockAudioByGesture);
      window.removeEventListener("keydown", unlockAudioByGesture);
      window.removeEventListener("touchstart", unlockAudioByGesture);
      if (pendingCelebrationSoundUnlockRef.current) {
        window.removeEventListener("pointerdown", pendingCelebrationSoundUnlockRef.current);
        window.removeEventListener("keydown", pendingCelebrationSoundUnlockRef.current);
        window.removeEventListener("touchstart", pendingCelebrationSoundUnlockRef.current);
        pendingCelebrationSoundUnlockRef.current = null;
      }
      badgeWinAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!badgeCarouselTransitionSound) return undefined;
    const audio = new Audio(badgeCarouselTransitionSound);
    audio.preload = "auto";
    badgeCarouselAudioRef.current = audio;
    return () => {
      badgeCarouselAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = new Audio(commonRewardCollectSound);
    audio.preload = "auto";
    checkInCollectAudioRef.current = audio;
    return () => {
      checkInCollectAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeBadgeCelebration) return undefined;
    if (pendingCelebrationSoundUnlockRef.current) {
      window.removeEventListener("pointerdown", pendingCelebrationSoundUnlockRef.current);
      window.removeEventListener("keydown", pendingCelebrationSoundUnlockRef.current);
      window.removeEventListener("touchstart", pendingCelebrationSoundUnlockRef.current);
      pendingCelebrationSoundUnlockRef.current = null;
    }

    if (isInteractionSoundEnabled()) {
      const audio = badgeWinAudioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().then(() => {
          hasUnlockedBadgeWinAudioRef.current = true;
        }).catch(() => {
          const unlockAndPlay = () => {
            const retryAudio = badgeWinAudioRef.current;
            if (!retryAudio || !isInteractionSoundEnabled()) return;
            retryAudio.currentTime = 0;
            retryAudio.play().then(() => {
              hasUnlockedBadgeWinAudioRef.current = true;
              window.removeEventListener("pointerdown", unlockAndPlay);
              window.removeEventListener("keydown", unlockAndPlay);
              window.removeEventListener("touchstart", unlockAndPlay);
              pendingCelebrationSoundUnlockRef.current = null;
            }).catch(() => {});
          };
          pendingCelebrationSoundUnlockRef.current = unlockAndPlay;
          window.addEventListener("pointerdown", unlockAndPlay);
          window.addEventListener("keydown", unlockAndPlay);
          window.addEventListener("touchstart", unlockAndPlay);
        });
      }
    }
    const timeoutId = window.setTimeout(() => {
      setActiveBadgeCelebration(null);
    }, 7000);
    return () => {
      window.clearTimeout(timeoutId);
      if (pendingCelebrationSoundUnlockRef.current) {
        window.removeEventListener("pointerdown", pendingCelebrationSoundUnlockRef.current);
        window.removeEventListener("keydown", pendingCelebrationSoundUnlockRef.current);
        window.removeEventListener("touchstart", pendingCelebrationSoundUnlockRef.current);
        pendingCelebrationSoundUnlockRef.current = null;
      }
    };
  }, [activeBadgeCelebration]);

  useEffect(() => {
    if (activeBadgeCelebration) return;
    if (badgeCelebrationPreparingRef.current) return;
    const next = badgeCelebrationQueueRef.current[0];
    if (!next) return;

    badgeCelebrationPreparingRef.current = true;
    const preparationToken = badgeCelebrationPrepareTokenRef.current;

    Promise.all([
      preloadAudioElement(badgeWinAudioRef.current),
      preloadBadgeVisual(next),
    ]).finally(() => {
      if (badgeCelebrationPrepareTokenRef.current !== preparationToken) return;
      badgeCelebrationPreparingRef.current = false;
      const readyAchievement = badgeCelebrationQueueRef.current.shift();
      if (readyAchievement) {
        setActiveBadgeCelebration(readyAchievement);
      }
      setBadgeCelebrationQueueSignal((prev) => prev + 1);
    });
  }, [activeBadgeCelebration, badgeCelebrationQueueSignal]);

  const syncGamificationViews = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["social-my-state", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["social-following-list", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["social-follower-list", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["daily-checkin-state", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["inicio-recent-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["profiles-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["profile-discover-profiles", user?.id] });
    if (selectedPublicProfile?.id) {
      queryClient.invalidateQueries({ queryKey: ["social-target-state", user?.id, selectedPublicProfile.id] });
    }
  }, [queryClient, selectedPublicProfile?.id, user?.id]);

  const patchProfileCollections = React.useCallback(
    (targetUserId, patch) => {
      if (!targetUserId) return;
      const applyPatch = (profile) => {
        if (!profile || String(profile.id || "") !== String(targetUserId)) return profile;
        return {
          ...profile,
          ...(typeof patch === "function" ? patch(profile) : patch),
        };
      };

      queryClient.setQueryData(["profile-discover-profiles", user?.id], (current) => {
        if (!current || !Array.isArray(current.items)) return current;
        return {
          ...current,
          items: current.items.map(applyPatch),
        };
      });

      queryClient.setQueryData(["inicio-recent-profiles"], (current) => {
        if (!current || !Array.isArray(current.items)) return current;
        return {
          ...current,
          items: current.items.map(applyPatch),
        };
      });

      queryClient.setQueryData(["profiles-gallery"], (current) => {
        if (!current || !Array.isArray(current.pages)) return current;
        return {
          ...current,
          pages: current.pages.map((page) => {
            if (!page || !Array.isArray(page.items)) return page;
            return {
              ...page,
              items: page.items.map(applyPatch),
            };
          }),
        };
      });
    },
    [queryClient, user?.id]
  );

  const patchSocialRelationLists = React.useCallback(
    (targetUserId, patch) => {
      if (!targetUserId || !user?.id) return;
      const applyPatch = (profile) => {
        if (!profile || String(profile.id || "") !== String(targetUserId)) return profile;
        return {
          ...profile,
          ...(typeof patch === "function" ? patch(profile) : patch),
        };
      };

      queryClient.setQueryData(["social-following-list", user.id], (current) =>
        Array.isArray(current) ? current.map(applyPatch) : current
      );
      queryClient.setQueryData(["social-follower-list", user.id], (current) =>
        Array.isArray(current) ? current.map(applyPatch) : current
      );
    },
    [queryClient, user?.id]
  );

  useEffect(() => {
    if (!isProfileNotificationsOpen) return;
    if (!unreadProfileNotifications.length) return;
    if (markProfileNotificationsReadMutation.isPending) return;
    markProfileNotificationsReadMutation.mutate(unreadProfileNotifications.map((item) => item.id));
  }, [isProfileNotificationsOpen, unreadProfileNotifications, markProfileNotificationsReadMutation]);

  const followMutation = useMutation({
    mutationFn: ({ targetUserId, shouldFollow }) =>
      shouldFollow ? base44.social.follow(targetUserId) : base44.social.unfollow(targetUserId),
    onSuccess: (response) => {
      const targetUserId = String(response?.state?.targetUserId || "");
      if (targetUserId) {
        setSimState((prev) => ({
          ...prev,
          [targetUserId]: {
            ...(prev?.[targetUserId] || {}),
            isFollowing: Boolean(response?.state?.isFollowing),
            followers: Number(response?.state?.followers ?? prev?.[targetUserId]?.followers ?? 0),
            following: Number(response?.state?.following ?? prev?.[targetUserId]?.following ?? 0),
            isLiked:
              typeof prev?.[targetUserId]?.isLiked === "boolean"
                ? Boolean(prev[targetUserId].isLiked)
                : false,
            likes: Number(response?.state?.likes ?? prev?.[targetUserId]?.likes ?? 0),
          },
        }));
      }
      if (targetUserId && user?.id) {
        queryClient.setQueryData(["social-target-state", user.id, targetUserId], (previous) => ({
          ...(previous && typeof previous === "object" ? previous : {}),
          ...(response?.state || {}),
        }));
      }
      if (targetUserId) {
        patchProfileCollections(targetUserId, (profile) => ({
          isFollowing: Boolean(response?.state?.isFollowing),
          followers: Number(response?.state?.followers ?? profile?.followers ?? 0),
        }));
        patchSocialRelationLists(targetUserId, (profile) => ({
          isFollowing: Boolean(response?.state?.isFollowing),
          followers: Number(response?.state?.followers ?? profile?.followers ?? 0),
        }));
      }
      if (user?.id && targetUserId && targetUserId !== user.id) {
        queryClient.setQueryData(["social-my-state", user.id], (previous) => {
          const baseState = previous && typeof previous === "object" ? previous : {};
          const currentFollowing = Number(baseState.following || 0);
          const nextFollowing = response?.alreadyProcessed
            ? currentFollowing
            : currentFollowing + (response?.state?.isFollowing ? 1 : -1);
          return {
            ...baseState,
            following: Math.max(0, nextFollowing),
          };
        });
      }
      if (response?.state?.targetUserId === user?.id || response?.state?.targetUserId === "me") {
        setSocial((prev) => ({
          ...prev,
          followers: Number(response.state.followers || 0),
          following: Number(response.state.following || 0),
          likes: prev.likes,
          isFollowing: Boolean(response.state.isFollowing),
        }));
      }
      syncGamificationViews();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar seguimento",
        description: error?.message || "Tente novamente.",
      });
    },
  });

  const likeMutation = useMutation({
    mutationFn: ({ targetUserId, shouldLike }) =>
      shouldLike ? base44.social.like(targetUserId) : base44.social.unlike(targetUserId),
    onSuccess: (response) => {
      const targetUserId = String(response?.state?.targetUserId || "");
      if (targetUserId) {
        setSimState((prev) => ({
          ...prev,
          [targetUserId]: {
            ...(prev?.[targetUserId] || {}),
            isLiked: Boolean(response?.state?.isLiked),
            likes: Number(response?.state?.likes ?? prev?.[targetUserId]?.likes ?? 0),
            isFollowing:
              typeof prev?.[targetUserId]?.isFollowing === "boolean"
                ? Boolean(prev[targetUserId].isFollowing)
                : false,
            followers: Number(response?.state?.followers ?? prev?.[targetUserId]?.followers ?? 0),
            following: Number(response?.state?.following ?? prev?.[targetUserId]?.following ?? 0),
          },
        }));
      }
      if (targetUserId && user?.id) {
        queryClient.setQueryData(["social-target-state", user.id, targetUserId], (previous) => ({
          ...(previous && typeof previous === "object" ? previous : {}),
          ...(response?.state || {}),
        }));
      }
      if (targetUserId) {
        patchProfileCollections(targetUserId, (profile) => ({
          isLiked: Boolean(response?.state?.isLiked),
          likes: Number(response?.state?.likes ?? profile?.likes ?? 0),
        }));
        patchSocialRelationLists(targetUserId, (profile) => ({
          isLiked: Boolean(response?.state?.isLiked),
          likes: Number(response?.state?.likes ?? profile?.likes ?? 0),
        }));
      }
      if (response?.state?.targetUserId === user?.id || response?.state?.targetUserId === "me") {
        setSocial((prev) => ({
          ...prev,
          followers: prev.followers,
          following: prev.following,
          likes: Number(response.state.likes || 0),
          isLiked: Boolean(response.state.isLiked),
        }));
      }
      syncGamificationViews();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar curtida",
        description: error?.message || "Tente novamente.",
      });
    },
  });

  const dailyCheckInMutation = useMutation({
    mutationFn: () => base44.social.dailyCheckIn(),
    onSuccess: async (response) => {
      queryClient.setQueryData(["daily-checkin-state", user?.id], (previous) => {
        const baseState = previous && typeof previous === "object" ? previous : {};
        const todayDayKey = String(response?.dayKey || baseState.dayKey || "");
        const previousRecentDays = Array.isArray(baseState.recentDays) ? baseState.recentDays : [];
        const nextCheckedAt = response?.checkedAt || baseState.checkedAt || new Date().toISOString();
        let hasTodayEntry = false;
        const nextRecentDays = previousRecentDays.map((entry) => {
          if (String(entry?.dayKey || "") !== todayDayKey) return entry;
          hasTodayEntry = true;
          return {
            ...entry,
            checkedIn: true,
            checkedAt: nextCheckedAt,
            isToday: true,
          };
        });
        if (todayDayKey && !hasTodayEntry) {
          nextRecentDays.push({
            dayKey: todayDayKey,
            checkedIn: true,
            checkedAt: nextCheckedAt,
            isToday: true,
          });
        }

        return {
          ...baseState,
          dayKey: todayDayKey || baseState.dayKey || "",
          checkedIn: true,
          checkedAt: nextCheckedAt,
          totalCheckins: Number(baseState.totalCheckins || 0) + (response?.alreadyCheckedIn ? 0 : 1),
          streakDay: Number(baseState.streakDay || 0),
          nextDay: Math.min(7, Math.max(1, Number(baseState.nextDay || 1))),
          recentDays: nextRecentDays,
        };
      });
      syncGamificationViews();
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["daily-checkin-state", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-history-authoritative", user?.id] }),
      ]);
      toast({
        title: response?.alreadyCheckedIn ? "Check-in já registrado" : "Check-in diário confirmado",
        description: response?.alreadyCheckedIn
          ? "Você já fez check-in hoje. O backend manteve o estado correto."
          : "Seu check-in foi registrado e já alimenta a gamificação authoritative.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha no check-in diário",
        description: error?.message || "Tente novamente.",
      });
      },
    });

    const handleDailyCheckInCollect = () => {
      if (dailyCheckInMutation.isPending || dailyCheckInState?.checkedIn) return;
      if (isInteractionSoundEnabled()) {
        const audio = checkInCollectAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
      dailyCheckInMutation.mutate();
    };

  const updateFollow = () => {
    toast({
      title: "Ação disponível em perfis públicos",
      description: "Use seguir em um perfil público real para registrar a ação no backend.",
    });
  };

  const likeProfile = () => {
    toast({
      title: "Ação disponível em perfis públicos",
      description: "Use curtir em um perfil público real para registrar a ação no backend.",
    });
  };

  const toggleSimFollow = (profileId) => {
    setSimState((prev) => {
      const current = prev[profileId];
      if (!current) return prev;
      const willFollow = !current.isFollowing;
      return {
        ...prev,
        [profileId]: {
          ...current,
          isFollowing: willFollow,
          followers: Math.max(0, current.followers + (willFollow ? 1 : -1)),
        },
      };
    });
  };

  const toggleSimLike = (profileId) => {
    setSimState((prev) => {
      const current = prev[profileId];
      if (!current) return prev;
      const willLike = !current.isLiked;
      return {
        ...prev,
        [profileId]: {
          ...current,
          isLiked: willLike,
          likes: Math.max(0, current.likes + (willLike ? 1 : -1)),
        },
      };
    });
  };

  const toggleAuthoritativePublicFollow = async () => {
    if (!selectedPublicProfile?.id || !isSelectedRealProfile) return;
    const targetUserId = String(selectedPublicProfile.id || "");
    const current = {
      isFollowing:
        typeof simState?.[targetUserId]?.isFollowing === "boolean"
          ? Boolean(simState[targetUserId].isFollowing)
          : Boolean(selectedPublicSocialState?.isFollowing),
      followers: Number(
        simState?.[targetUserId]?.followers ??
        selectedPublicSocialState?.followers ??
        selectedPublicProfile?.followers ??
        0
      ),
      following: Number(
        simState?.[targetUserId]?.following ??
        selectedPublicSocialState?.following ??
        selectedPublicProfile?.following ??
        0
      ),
      isLiked:
        typeof simState?.[targetUserId]?.isLiked === "boolean"
          ? Boolean(simState[targetUserId].isLiked)
          : Boolean(selectedPublicSocialState?.isLiked),
      likes: Number(
        simState?.[targetUserId]?.likes ??
        selectedPublicSocialState?.likes ??
        selectedPublicProfile?.likes ??
        0
      ),
    };
    const shouldFollow = !current.isFollowing;

    setSimState((prev) => ({
      ...prev,
      [targetUserId]: {
        ...(prev?.[targetUserId] || {}),
        ...current,
        isFollowing: shouldFollow,
        followers: Math.max(0, current.followers + (shouldFollow ? 1 : -1)),
      },
    }));

    try {
      setFollowPendingById((prev) => ({ ...prev, [targetUserId]: true }));
      await followMutation.mutateAsync({ targetUserId, shouldFollow });
    } catch {
      setSimState((prev) => ({
        ...prev,
        [targetUserId]: {
          ...(prev?.[targetUserId] || {}),
          ...current,
        },
      }));
    } finally {
      setFollowPendingById((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const syncDiscoverCardState = React.useCallback((profileId, updater) => {
    setSimState((prev) => {
      const current = prev[profileId];
      if (!current) return prev;
      const nextState = typeof updater === "function" ? updater(current) : { ...current, ...(updater || {}) };
      return {
        ...prev,
        [profileId]: nextState,
      };
    });
  }, []);

  const toggleDiscoverFollow = React.useCallback(
    async (profile) => {
      const targetUserId = String(profile?.id || "");
      if (!targetUserId || targetUserId === String(user?.id || "")) return;

      const current = simState[targetUserId] || {
        isFollowing: false,
        isLiked: false,
        followers: Number(profile?.followers || 0),
        likes: Number(profile?.likes || 0),
      };
      const shouldFollow = !current.isFollowing;

      syncDiscoverCardState(targetUserId, {
        ...current,
        isFollowing: shouldFollow,
        followers: Math.max(0, Number(current.followers || 0) + (shouldFollow ? 1 : -1)),
      });

      try {
        setFollowPendingById((prev) => ({ ...prev, [targetUserId]: true }));
        const response = await followMutation.mutateAsync({ targetUserId, shouldFollow });
        if (response?.state) {
          syncDiscoverCardState(targetUserId, (prev) => ({
            ...prev,
            isFollowing: Boolean(response.state.isFollowing),
            followers: Number(response.state.followers ?? prev.followers ?? 0),
          }));
        }
      } catch {
        syncDiscoverCardState(targetUserId, current);
      } finally {
        setFollowPendingById((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [followMutation, simState, syncDiscoverCardState, user?.id]
  );

  const toggleSocialListFollow = React.useCallback(
    async (profile) => {
      const targetUserId = String(profile?.id || "");
      if (!targetUserId || targetUserId === String(user?.id || "")) return;

      const current = {
        isFollowing:
          typeof simState?.[targetUserId]?.isFollowing === "boolean"
            ? Boolean(simState[targetUserId].isFollowing)
            : Boolean(profile?.isFollowing),
        followers: Number(simState?.[targetUserId]?.followers ?? profile?.followers ?? 0),
      };
      const shouldFollow = !current.isFollowing;

      syncDiscoverCardState(targetUserId, {
        ...(simState?.[targetUserId] || {}),
        isFollowing: shouldFollow,
        followers: Math.max(0, current.followers + (shouldFollow ? 1 : -1)),
      });

      try {
        setFollowPendingById((prev) => ({ ...prev, [targetUserId]: true }));
        const response = await followMutation.mutateAsync({ targetUserId, shouldFollow });
        if (response?.state) {
          syncDiscoverCardState(targetUserId, (prev) => ({
            ...prev,
            isFollowing: Boolean(response.state.isFollowing),
            followers: Number(response.state.followers ?? prev?.followers ?? current.followers),
          }));
        }
      } catch {
        syncDiscoverCardState(targetUserId, {
          ...(simState?.[targetUserId] || {}),
          isFollowing: current.isFollowing,
          followers: current.followers,
        });
      } finally {
        setFollowPendingById((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [followMutation, simState, syncDiscoverCardState, user?.id]
  );

  const followingProfileIds = useMemo(
    () => new Set((myFollowingProfiles || []).map((profile) => String(profile?.id || ""))),
    [myFollowingProfiles]
  );

  const mapRealSocialProfile = React.useCallback(
    (profile) => {
      const leaderboardProfile = competitionEntryByUserId[profile.id];
      const avatarMatch = avatarSrcById[profile.profile_avatar_id] || "";
      const avatarSrc =
        profile.profile_image_mode === "photo" && profile.profile_image_url
          ? resolveAssetUrl(profile.profile_image_url)
          : avatarMatch;

      return {
        id: profile.id,
        nick: profile.nick,
        handle: profile.handle,
        avatarSrc,
        followers: Number(profile.followers || 0),
        following: Number(profile.following || 0),
        likes: Number(profile.likes || 0),
        isFollowing:
          typeof simState?.[profile.id]?.isFollowing === "boolean"
            ? Boolean(simState[profile.id].isFollowing)
            : followingProfileIds.has(String(profile.id || "")),
        tickets: leaderboardProfile?.stats?.approvedDeposits || leaderboardProfile?.stats?.approvedAmount || 0,
        points: Number(leaderboardProfile?.weekly_points ?? leaderboardProfile?.points ?? 0),
        position: leaderboardProfile?.position || 0,
      };
    },
    [avatarSrcById, competitionEntryByUserId, followingProfileIds, simState]
  );

  const followingProfiles = useMemo(
    () => myFollowingProfiles.map(mapRealSocialProfile),
    [mapRealSocialProfile, myFollowingProfiles]
  );

  const followerProfiles = useMemo(
    () =>
      myFollowerProfiles
        .map(mapRealSocialProfile)
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return a.nick.localeCompare(b.nick);
        }),
    [mapRealSocialProfile, myFollowerProfiles]
  );

  const socialListProfiles = socialListType === "following" ? followingProfiles : followerProfiles;
  const isLoadingSocialList = socialListType === "following" ? loadingFollowingProfiles : loadingFollowerProfiles;

  const toggleAuthoritativePublicLike = async () => {
    if (!selectedPublicProfile?.id || !isSelectedRealProfile) return;
    const targetUserId = String(selectedPublicProfile.id || "");
    const current = {
      isFollowing:
        typeof simState?.[targetUserId]?.isFollowing === "boolean"
          ? Boolean(simState[targetUserId].isFollowing)
          : Boolean(selectedPublicSocialState?.isFollowing),
      followers: Number(
        simState?.[targetUserId]?.followers ??
        selectedPublicSocialState?.followers ??
        selectedPublicProfile?.followers ??
        0
      ),
      following: Number(
        simState?.[targetUserId]?.following ??
        selectedPublicSocialState?.following ??
        selectedPublicProfile?.following ??
        0
      ),
      isLiked:
        typeof simState?.[targetUserId]?.isLiked === "boolean"
          ? Boolean(simState[targetUserId].isLiked)
          : Boolean(selectedPublicSocialState?.isLiked),
      likes: Number(
        simState?.[targetUserId]?.likes ??
        selectedPublicSocialState?.likes ??
        selectedPublicProfile?.likes ??
        0
      ),
    };
    const shouldLike = !current.isLiked;

    setSimState((prev) => ({
      ...prev,
      [targetUserId]: {
        ...(prev?.[targetUserId] || {}),
        ...current,
        isLiked: shouldLike,
        likes: Math.max(0, current.likes + (shouldLike ? 1 : -1)),
      },
    }));

    try {
      setLikePendingById((prev) => ({ ...prev, [targetUserId]: true }));
      await likeMutation.mutateAsync({ targetUserId, shouldLike });
    } catch {
      setSimState((prev) => ({
        ...prev,
        [targetUserId]: {
          ...(prev?.[targetUserId] || {}),
          ...current,
        },
      }));
    } finally {
      setLikePendingById((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const toggleDiscoverLike = React.useCallback(
    async (profile) => {
      const targetUserId = String(profile?.id || "");
      if (!targetUserId || targetUserId === String(user?.id || "")) return;

      const current = simState[targetUserId] || {
        isFollowing: false,
        isLiked: false,
        followers: Number(profile?.followers || 0),
        likes: Number(profile?.likes || 0),
      };
      const shouldLike = !current.isLiked;

      syncDiscoverCardState(targetUserId, {
        ...current,
        isLiked: shouldLike,
        likes: Math.max(0, Number(current.likes || 0) + (shouldLike ? 1 : -1)),
      });

      try {
        setLikePendingById((prev) => ({ ...prev, [targetUserId]: true }));
        const response = await likeMutation.mutateAsync({ targetUserId, shouldLike });
        if (response?.state) {
          syncDiscoverCardState(targetUserId, (prev) => ({
            ...prev,
            isLiked: Boolean(response.state.isLiked),
            likes: Number(response.state.likes ?? prev.likes ?? 0),
          }));
        }
      } catch {
        syncDiscoverCardState(targetUserId, current);
      } finally {
        setLikePendingById((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [likeMutation, simState, syncDiscoverCardState, user?.id]
  );

  const handleSimPointerDown = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = simulatedStripRef.current;
    if (!container) return;
    if (event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,a,input,textarea,select,label");
    if (interactiveTarget) return;

    simulatedDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    container.setPointerCapture?.(event.pointerId);
  };

  const handleSimPointerMove = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = simulatedStripRef.current;
    const state = simulatedDragRef.current;
    if (!container || !state.isDragging) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 8) {
      simulatedDragRef.current.moved = true;
    }
    container.scrollLeft = state.startScrollLeft - deltaX;
    event.preventDefault();
  };

  const handleSimPointerUpOrCancel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = simulatedStripRef.current;
    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    simulatedDragRef.current.isDragging = false;
  };

  const handleSimClickCapture = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    if (simulatedDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      simulatedDragRef.current.moved = false;
    }
  };

  const handleSimWheel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = simulatedStripRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
    }
  };

  const handlePublicOtherPointerDown = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = publicOtherStripRef.current;
    if (!container) return;
    if (event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,a,input,textarea,select,label");
    if (interactiveTarget) return;

    publicOtherDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    container.setPointerCapture?.(event.pointerId);
  };

  const handlePublicOtherPointerMove = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = publicOtherStripRef.current;
    const state = publicOtherDragRef.current;
    if (!container || !state.isDragging) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 8) {
      publicOtherDragRef.current.moved = true;
    }
    container.scrollLeft = state.startScrollLeft - deltaX;
    event.preventDefault();
  };

  const handlePublicOtherPointerUpOrCancel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = publicOtherStripRef.current;
    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    publicOtherDragRef.current.isDragging = false;
  };

  const handlePublicOtherClickCapture = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    if (publicOtherDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      publicOtherDragRef.current.moved = false;
    }
  };

  const handlePublicOtherWheel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = publicOtherStripRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
    }
  };

  const handleBadgePointerDown = (event, containerRef, dragRef) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = containerRef.current;
    if (!container) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,a,input,textarea,select,label");
    const startedOnInteractive = Boolean(interactiveTarget);

    dragRef.current = {
      isDragging: true,
      pointerType: event.pointerType || "mouse",
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
      pointerId: event.pointerId,
      startedOnInteractive,
    };

    if (!(startedOnInteractive && event.pointerType === "mouse")) {
      container.setPointerCapture?.(event.pointerId);
    }
  };

  const handleBadgePointerMove = (event, containerRef, dragRef) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = containerRef.current;
    const state = dragRef.current;
    if (!container || !state.isDragging) return;

    const deltaX = event.clientX - state.startX;
    const moveThreshold = state.pointerType === "mouse" ? 12 : 6;
    if (Math.abs(deltaX) > moveThreshold) {
      if (!state.moved && state.startedOnInteractive && state.pointerType === "mouse") {
        container.setPointerCapture?.(state.pointerId);
      }
      dragRef.current.moved = true;
      container.scrollLeft = state.startScrollLeft - deltaX;
      event.preventDefault();
    }
  };

  const handleBadgePointerUpOrCancel = (event, containerRef, dragRef) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = containerRef.current;
    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    dragRef.current.isDragging = false;
  };

  const handleBadgeClickCapture = (event, dragRef) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    if (dragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.moved = false;
    }
  };

  const handleBadgeWheel = (event, containerRef) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = containerRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
    }
  };

  const handlePublicBadgePointerDown = (event) => handleBadgePointerDown(event, publicBadgeStripRef, publicBadgeDragRef);
  const handlePublicBadgePointerMove = (event) => handleBadgePointerMove(event, publicBadgeStripRef, publicBadgeDragRef);
  const handlePublicBadgePointerUpOrCancel = (event) =>
    handleBadgePointerUpOrCancel(event, publicBadgeStripRef, publicBadgeDragRef);
  const handlePublicBadgeClickCapture = (event) => handleBadgeClickCapture(event, publicBadgeDragRef);
  const handlePublicBadgeWheel = (event) => handleBadgeWheel(event, publicBadgeStripRef);

  const handlePrivateBadgePointerDown = (event) => handleBadgePointerDown(event, privateBadgeStripRef, privateBadgeDragRef);
  const handlePrivateBadgePointerMove = (event) => handleBadgePointerMove(event, privateBadgeStripRef, privateBadgeDragRef);
  const handlePrivateBadgePointerUpOrCancel = (event) =>
    handleBadgePointerUpOrCancel(event, privateBadgeStripRef, privateBadgeDragRef);
  const handlePrivateBadgeClickCapture = (event) => handleBadgeClickCapture(event, privateBadgeDragRef);
  const handlePrivateBadgeWheel = (event) => handleBadgeWheel(event, privateBadgeStripRef);

  const handleCompetitionRankingPointerDown = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = competitionRankingRef.current;
    if (!container) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,a,input,textarea,select,label");
    if (interactiveTarget) return;

    competitionRankingDragRef.current = {
      isDragging: true,
      pointerType: event.pointerType || "mouse",
      startY: event.clientY,
      startScrollTop: container.scrollTop,
      moved: false,
    };
    container.setPointerCapture?.(event.pointerId);
  };

  const handleCompetitionRankingPointerMove = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = competitionRankingRef.current;
    const state = competitionRankingDragRef.current;
    if (!container || !state.isDragging) return;

    const deltaY = event.clientY - state.startY;
    const moveThreshold = state.pointerType === "mouse" ? 12 : 6;
    if (Math.abs(deltaY) > moveThreshold) {
      competitionRankingDragRef.current.moved = true;
      container.scrollTop = state.startScrollTop - deltaY;
      event.preventDefault();
    }
  };

  const handleCompetitionRankingPointerUpOrCancel = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    const container = competitionRankingRef.current;
    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    competitionRankingDragRef.current.isDragging = false;
  };

  const handleCompetitionRankingClickCapture = (event) => {
    if (!PROFILE_GESTURE_DRAG_ENABLED) return;
    if (competitionRankingDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      competitionRankingDragRef.current.moved = false;
    }
  };

  const handleRemoveApprovedPhoto = (photoUrl) => {
    if (!user?.id) return;
    setProfilePrefs((prev) => {
      const nextApproved = (prev.approvedPhotoUrls || []).filter((url) => url !== photoUrl);
      const nextRemoved = [photoUrl, ...(prev.removedApprovedPhotoUrls || []).filter((url) => url !== photoUrl)];
      const nextSelected = prev.selectedPhotoUrl === photoUrl ? "" : prev.selectedPhotoUrl;
      const next = {
        ...prev,
        approvedPhotoUrls: nextApproved,
        removedApprovedPhotoUrls: nextRemoved,
        selectedPhotoUrl: nextSelected,
      };
      saveProfilePrefs(user.id, next);
      return next;
    });
  };

  const normalizePhoneForAvailability = React.useCallback((value) => String(value || "").replace(/\D/g, ""), []);

  useEffect(() => {
    if (!isEditOpen || !user?.id) return;

    const normalizedNick = String(editData.nick || "").trim().replace(/^@+/, "").toLowerCase();
    const normalizedCurrentNick = String(user.nick || "").trim().replace(/^@+/, "").toLowerCase();
    const normalizedPhone = normalizePhoneForAvailability(editData.phone);
    const normalizedCurrentPhone = normalizePhoneForAvailability(user.phone);
    const shouldCheckNick = normalizedNick.length > 0 && normalizedNick !== normalizedCurrentNick;
    const shouldCheckPhone = normalizedPhone.length >= 10 && normalizedPhone !== normalizedCurrentPhone;

    setAvailabilityState((prev) => ({
      nick: shouldCheckNick ? { ...prev.nick, checking: true, message: "Pesquisando disponibilidade..." } : { checking: false, available: null, message: "" },
      phone: shouldCheckPhone ? { ...prev.phone, checking: true, message: "Pesquisando disponibilidade..." } : { checking: false, available: null, message: "" },
    }));

    if (!shouldCheckNick && !shouldCheckPhone) return;

    const timer = setTimeout(async () => {
      try {
        const response = await base44.auth.checkAvailability({
          nick: shouldCheckNick ? editData.nick : "",
          phone: shouldCheckPhone ? editData.phone : "",
        });

        setAvailabilityState({
          nick: shouldCheckNick
            ? {
                checking: false,
                available: Boolean(response?.nick?.available),
                message: response?.nick?.available ? "Nome disponível." : "Esse nome já está em uso.",
              }
            : { checking: false, available: null, message: "" },
          phone: shouldCheckPhone
            ? {
                checking: false,
                available: Boolean(response?.phone?.available),
                message: response?.phone?.available ? "Telefone disponível." : "Esse telefone já está em uso.",
              }
            : { checking: false, available: null, message: "" },
        });
      } catch {
        setAvailabilityState((prev) => ({
          nick: shouldCheckNick ? { ...prev.nick, checking: false, available: null, message: "Não foi possível consultar agora." } : { checking: false, available: null, message: "" },
          phone: shouldCheckPhone ? { ...prev.phone, checking: false, available: null, message: "Não foi possível consultar agora." } : { checking: false, available: null, message: "" },
        }));
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [editData.nick, editData.phone, isEditOpen, normalizePhoneForAvailability, user?.id, user?.nick, user?.phone]);

  const saveQuickEdit = async () => {
    if (!user) return;
    try {
      const nextHandle = normalizeHandle(editData.handle) || "usuario";
      if (!isHandleAvailable(nextHandle, user.id)) {
        toast({
          variant: "destructive",
          title: "@ ja em uso",
          description: "Escolha outro @ para continuar.",
        });
        return;
      }

      if (availabilityState.nick.available === false) {
        toast({
          variant: "destructive",
          title: "Nome já em uso",
          description: "Escolha outro nome para continuar.",
        });
        return;
      }

      if (availabilityState.phone.available === false) {
        toast({
          variant: "destructive",
          title: "Telefone já em uso",
          description: "Use outro telefone para continuar.",
        });
        return;
      }

      await base44.auth.updateMe({
        nick: editData.nick,
        phone: editData.phone,
        profile_image_mode: editData.imageMode || "avatar",
        profile_avatar_id: editData.avatarId || profilePrefs.avatarId,
      });

      const nextPrefs = {
        ...profilePrefs,
        handle: nextHandle,
        avatarId: editData.avatarId || profilePrefs.avatarId,
      };

      reserveHandle(user.id, nextHandle);
      setProfilePrefs(nextPrefs);
      saveProfilePrefs(user.id, nextPrefs);

      setUser((prev) => ({
        ...prev,
        nick: editData.nick,
        phone: editData.phone,
        profile_image_mode: editData.imageMode || "avatar",
        profile_avatar_id: editData.avatarId || profilePrefs.avatarId,
      }));
      queryClient.invalidateQueries({ queryKey: ["inicio-users"] });
      queryClient.invalidateQueries({ queryKey: ["inicio-recent-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["profile-discover-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile-gamification-authoritative"] });
      queryClient.invalidateQueries({ queryKey: ["profile-competition-board-authoritative"] });
      setIsEditOpen(false);
      toast({
        title: "Perfil atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating quick profile:", error);
      toast({
        variant: "destructive",
        title: "Falha ao salvar",
        description: "Não foi possível atualizar o perfil agora.",
      });
    }
  };

  const openSocialList = (type) => {
    setSocialListType(type);
    setIsSocialListOpen(true);
  };

  const openQuickEditModal = () => {
    const currentAvatarId = profilePrefs.avatarId || user?.profile_avatar_id || DEFAULT_AVATAR_ID;
    setEditData({
      nick: user?.nick || "",
      handle: profilePrefs.handle || "",
      phone: user?.phone || "",
      avatarId: currentAvatarId,
      imageMode: user?.profile_image_mode || "avatar",
    });
    setAvailabilityState({
      nick: { checking: false, available: null, message: "" },
      phone: { checking: false, available: null, message: "" },
    });
    setIsEditOpen(true);
  };

  const openPublicProfilePage = (profileRef) => {
    if (!profileRef) return;
    const entryByUser = typeof profileRef === "string" ? competitionEntryByUserId[profileRef] : null;
    const normalizedProfileRef = typeof profileRef === "string" ? String(profileRef).trim() : "";
    const resolvedProfile =
      typeof profileRef === "string" && !entryByUser
        ? simulatedProfiles.find((profile) => profile.id === profileRef || profile.handle === profileRef)
        : profileRef;
    setIsSocialListOpen(false);
    if (entryByUser?.user_id) {
      const targetUrl = `${createPageUrl("Profile")}?user=${encodeURIComponent(entryByUser.user_id)}`;
      const currentUrl = `${location.pathname}${location.search}`;
      if (targetUrl === currentUrl) return;
      startProfileSwitchLoader();
      debugNavigate(targetUrl, undefined, "openPublicProfilePage:ranking-entry");
      return;
    }
    if (normalizedProfileRef && (realProfilesById[normalizedProfileRef] || selectedPublicUserById?.id === normalizedProfileRef || normalizedProfileRef.includes("-"))) {
      const targetUrl = `${createPageUrl("Profile")}?user=${encodeURIComponent(normalizedProfileRef)}`;
      const currentUrl = `${location.pathname}${location.search}`;
      if (targetUrl === currentUrl) return;
      startProfileSwitchLoader();
      debugNavigate(targetUrl, undefined, "openPublicProfilePage:user-id");
      return;
    }
    const nextHandle = resolvedProfile?.handle;
    if (!nextHandle) return;
    const targetUrl = `${createPageUrl("Profile")}?u=${encodeURIComponent(nextHandle)}`;
    const currentUrl = `${location.pathname}${location.search}`;
    if (targetUrl === currentUrl) return;
    startProfileSwitchLoader();
    debugNavigate(targetUrl, undefined, "openPublicProfilePage:handle");
  };

  const openPublicProfileByUserId = (userId) => {
    if (userId === null || userId === undefined || userId === "") return;
    const safeUserId = String(userId);
    const targetUrl = `${createPageUrl("Profile")}?user=${encodeURIComponent(safeUserId)}`;
    const currentUrl = `${location.pathname}${location.search}`;
    if (targetUrl === currentUrl) return;
    setIsSocialListOpen(false);
    startProfileSwitchLoader();
    debugNavigate(targetUrl, undefined, "openPublicProfileByUserId");
  };

  const closePublicProfilePage = () => {
    setIsPublicPhotoViewerOpen(false);
    debugNavigate(createPageUrl("Profile"), undefined, "closePublicProfilePage");
  };

  const getLevelLabelFromXp = (xpValue) => {
    const level = getLevelProgress(Number(xpValue || 0)).level;
    return `LV ${level}`;
  };

  const getCompetitiveTopLabel = (profile) => {
    const competitionPosition = competitionEntryByUserId[profile?.id]?.position;
    const fallbackPosition = activeCycle ? Number(profile?.position || 0) : 0;
    const position = Number(competitionPosition || fallbackPosition || 0);
    return position > 0 ? `#${position}` : "-";
  };
  const podiumFrameByPosition = {
    1: top1BorderAnimated,
    2: top2BorderAnimated,
    3: top3BorderAnimated,
  };

  const playBadgeCarouselTransitionAudio = () => {
    if (!isInteractionSoundEnabled()) return;
    const audio = badgeCarouselAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // ignora
    }
  };

  const closeBadgeViewer = () => {
    playBadgeCarouselTransitionAudio();
    setSelectedBadgeInfo(null);
    setBadgeViewerList([]);
    setBadgeViewerIndex(0);
    setBadgeViewerDirection(0);
  };

  const moveBadgeViewer = (direction) => {
    if (!badgeViewerList.length) return;
    playBadgeCarouselTransitionAudio();
    const nextDirection = direction >= 0 ? 1 : -1;
    setBadgeViewerDirection(nextDirection);
    setBadgeViewerIndex((prev) => {
      const total = badgeViewerList.length;
      const next = (prev + nextDirection + total) % total;
      setSelectedBadgeInfo(badgeViewerList[next] || null);
      return next;
    });
  };

  const handleBadgeViewerDragEnd = (_event, info) => {
    if (badgeViewerList.length < 2) return;
    const deltaX = Number(info?.offset?.x || 0);
    const velocityX = Number(info?.velocity?.x || 0);
    if (Math.abs(deltaX) < 42 && Math.abs(velocityX) < 380) return;
    moveBadgeViewer(deltaX < 0 ? 1 : -1);
  };

  const openBadgeInfo = (achievement, achievementList = []) => {
    const safeList = Array.isArray(achievementList) && achievementList.length ? achievementList : [achievement];
    const matchedIndex = Math.max(
      0,
      safeList.findIndex((item) => item?.key === achievement?.key)
    );
    if (!isInteractionSoundEnabled()) {
      setBadgeViewerDirection(0);
      setBadgeViewerList(safeList);
      setBadgeViewerIndex(matchedIndex);
      setSelectedBadgeInfo(safeList[matchedIndex] || achievement);
      return;
    }
    const audio = badgeClickAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    setBadgeViewerDirection(0);
    setBadgeViewerList(safeList);
    setBadgeViewerIndex(matchedIndex);
    setSelectedBadgeInfo(safeList[matchedIndex] || achievement);
  };

  const { viewerHasMultipleBadges, viewerPrevBadge, viewerNextBadge } = useMemo(() => {
    const hasMultiple = badgeViewerList.length > 1;
    if (!hasMultiple) {
      return {
        viewerHasMultipleBadges: false,
        viewerPrevBadge: null,
        viewerNextBadge: null,
      };
    }
    const total = badgeViewerList.length;
    const prevIndex = (badgeViewerIndex - 1 + total) % total;
    const nextIndex = (badgeViewerIndex + 1) % total;
    return {
      viewerHasMultipleBadges: true,
      viewerPrevBadge: badgeViewerList[prevIndex] || null,
      viewerNextBadge: badgeViewerList[nextIndex] || null,
    };
  }, [badgeViewerList, badgeViewerIndex]);

  const renderBadgeViewerContent = () => {
    if (!selectedBadgeInfo) return null;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-20 pt-14 text-center">
        <p className="text-center text-base font-black uppercase tracking-wide text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]">
          {selectedBadgeInfo?.label || "Selo"}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300/85">
          {viewerHasMultipleBadges ? "Deslize para trocar de selo" : "Selo desbloqueado"}
        </p>
        <div className="relative mx-auto mt-1 h-56 w-full max-w-[760px] overflow-visible select-none">
          {viewerPrevBadge ? (
            <div
              key={`viewer-prev-${viewerPrevBadge.key}-${badgeViewerIndex}`}
              onClick={() => moveBadgeViewer(-1)}
              className="absolute left-3 top-1/2 h-28 w-28 -translate-y-1/2 cursor-pointer rounded-2xl bg-slate-950/40 p-2 opacity-35 transition-all duration-200 hover:opacity-55 sm:left-6"
            >
              {!viewerPrevBadge.unlocked ? (
                <>
                  <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500/90 bg-slate-900/90">
                    <Lock className="h-2.5 w-2.5 text-slate-200" />
                  </span>
                  <span className="absolute inset-0 rounded-2xl bg-black/35" />
                </>
              ) : null}
              <img
                src={sideBadgePlaceholder}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain opacity-80"
                loading="lazy"
              />
            </div>
          ) : null}
          {viewerNextBadge ? (
            <div
              key={`viewer-next-${viewerNextBadge.key}-${badgeViewerIndex}`}
              onClick={() => moveBadgeViewer(1)}
              className="absolute right-3 top-1/2 h-28 w-28 -translate-y-1/2 cursor-pointer rounded-2xl bg-slate-950/40 p-2 opacity-35 transition-all duration-200 hover:opacity-55 sm:right-6"
            >
              {!viewerNextBadge.unlocked ? (
                <>
                  <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500/90 bg-slate-900/90">
                    <Lock className="h-2.5 w-2.5 text-slate-200" />
                  </span>
                  <span className="absolute inset-0 rounded-2xl bg-black/35" />
                </>
              ) : null}
              <img
                src={sideBadgePlaceholder}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain opacity-80"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <AnimatePresence mode="wait" custom={badgeViewerDirection}>
              <motion.div
                key={`viewer-main-${selectedBadgeInfo.key}-${badgeViewerIndex}`}
                custom={badgeViewerDirection}
                initial={(direction) => ({
                  x: direction > 0 ? 86 : direction < 0 ? -86 : 0,
                  opacity: direction === 0 ? 1 : 0.2,
                  scale: direction === 0 ? 1 : 0.84,
                })}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={(direction) => ({
                  x: direction > 0 ? -86 : direction < 0 ? 86 : 0,
                  opacity: 0.18,
                  scale: 0.84,
                })}
                transition={
                  useLiteBadgeViewer
                    ? { duration: 0.16, ease: "easeOut" }
                    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                }
                drag={viewerHasMultipleBadges ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={useLiteBadgeViewer ? 0.08 : 0.16}
                onDragEnd={handleBadgeViewerDragEnd}
                className={`inline-flex h-40 w-40 cursor-grab touch-pan-y items-center justify-center rounded-2xl bg-transparent ${
                  useLiteBadgeViewer ? "shadow-[0_0_10px_rgba(34,211,238,0.2)]" : "shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                } active:cursor-grabbing`}
              >
                {!selectedBadgeInfo.unlocked ? (
                  <>
                    <span className="absolute right-2.5 top-2.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500/90 bg-slate-900/90">
                      <Lock className="h-3 w-3 text-slate-200" />
                    </span>
                    <span className="absolute inset-0 rounded-2xl bg-black/35" />
                  </>
                ) : null}
                <BadgeCelebrationMedia achievement={selectedBadgeInfo} variant="popup" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-cyan-100">Como conquistar</p>
        <p className="hide-scrollbar mt-1 h-24 w-full max-w-[520px] overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-900/55 p-3 text-xs leading-relaxed text-slate-100 backdrop-blur-sm">
          {selectedBadgeInfo.ruleText || "Conclua as metas da plataforma para liberar este selo."}
        </p>
        <button
          type="button"
          onClick={closeBadgeViewer}
          className={`fixed bottom-5 left-1/2 z-50 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-300/50 bg-slate-900/70 text-cyan-100 ${
            useLiteBadgeViewer ? "shadow-[0_0_8px_rgba(34,211,238,0.2)] backdrop-blur-[1px]" : "shadow-[0_0_14px_rgba(34,211,238,0.28)] backdrop-blur-[2px]"
          } transition hover:bg-slate-800/90`}
          aria-label="Fechar visualizador de selos"
        >
          <XCircle className="h-5 w-5" />
        </button>
      </div>
    );
  };

  const renderLevelHud = (progress) => (
    <div className="absolute right-2 top-2 z-20">
      <button
        type="button"
        onClick={() => setIsLevelHudOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-full border border-cyan-400/45 bg-slate-950/90 px-2 py-1 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_8px_18px_rgba(2,132,199,0.22)] backdrop-blur-sm"
        aria-label="Abrir detalhes de nivel"
      >
        <Sparkles className="h-3 w-3 text-cyan-200" />
        <span className="text-[10px] font-black uppercase tracking-wide text-cyan-100">LV {progress.level}</span>
      </button>
      <AnimatePresence>
        {isLevelHudOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-full mt-1.5 w-40 rounded-lg border border-cyan-500/35 bg-slate-950/95 p-2 shadow-[0_10px_24px_rgba(6,182,212,0.22)]"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-black text-cyan-100">LV {progress.level}</span>
              <span className="text-[9px] font-semibold text-slate-300">{progress.progressPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-[9px] font-semibold text-cyan-200">
              XP {progress.inLevelPoints}/{progress.pointsRequired}
            </p>
            <p className="text-[9px] text-slate-300">Faltam {progress.pointsToNext} para o próximo</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const renderProfileNotificationsHud = () => (
    <div className="absolute left-2 top-2 z-20">
      <button
        type="button"
        onClick={() => setIsProfileNotificationsOpen(true)}
        className="relative inline-flex items-center justify-center rounded-full border border-fuchsia-400/45 bg-slate-950/90 p-2 text-fuchsia-100 shadow-[0_0_0_1px_rgba(232,121,249,0.18),0_8px_18px_rgba(126,34,206,0.22)] backdrop-blur-sm transition hover:border-fuchsia-300/70 hover:text-white"
        aria-label="Abrir notificações do perfil"
      >
        <Bell className="h-4 w-4" />
        {unreadProfileNotifications.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black text-white ring-2 ring-slate-950">
            {Math.min(99, unreadProfileNotifications.length)}
          </span>
        ) : null}
      </button>
    </div>
  );

  const renderCompetitionCard = ({ entry, titleSuffix = "Seu desempenho no ciclo atual." }) => {
    if (!competitionBoard.config.enabled || competitionBoard.config.active === false) return null;
    const safeEntryPoints = Number(entry?.weekly_points ?? entry?.points ?? 0);
    const isCompetitionFinishedPreview = competitionBoard.config.preview_mode === "finished";
    const topEntries = competitionBoard.entries.slice(0, 20);
    const visibleEntries = [...topEntries];
    const isEntryInTop20 = Boolean(entry?.user_id) && topEntries.some((item) => item.user_id === entry.user_id);
    const showOwnEntryOutsideTop = Boolean(entry?.user_id) && Number(entry?.position || 0) > 20 && !isEntryInTop20;
    const winnersCount = Math.max(1, Number(competitionBoard.config.winners_count || 10));
    const prizePerWinner = Number(competitionBoard.config.fallback_reward_value || 0);
    const rankedEntriesByPoints = [...competitionBoard.entries]
      .map((item) => ({
        ...item,
        _safePoints: Number(item?.weekly_points ?? item?.points ?? 0) || 0,
        _safeApprovedAmount: Number(item?.stats?.approvedAmount ?? 0) || 0,
      }))
      .sort((a, b) => {
        if (b._safePoints !== a._safePoints) return b._safePoints - a._safePoints;
        if (b._safeApprovedAmount !== a._safeApprovedAmount) return b._safeApprovedAmount - a._safeApprovedAmount;
        return String(a.nick || "").localeCompare(String(b.nick || ""));
      });
    const finishedWinnerEntries = rankedEntriesByPoints.slice(0, winnersCount).map((item, index) => ({
      ...item,
      points: Number(item._safePoints || 0),
      winnerPosition: index + 1,
    }));
    const winnerEntries = [...finishedWinnerEntries];
    const top3FrameUrl = resolveAssetUrl(competitionBoard.config.top3_frame_url || "");
    const localTopFrameByPosition = {
      1: top1BorderAnimated,
      2: top2BorderAnimated,
      3: top3BorderAnimated,
    };
    const formatCompetitionRewardLabel = (position) => {
      const safePosition = Number(position || 0);
      if (safePosition <= 0 || safePosition > winnersCount) return "";
      const rewardConfig =
        (competitionBoard.config.positions || []).find((item) => Number(item?.position || 0) === safePosition) || {
          reward_type: competitionBoard.config.fallback_reward_type,
          reward_value: competitionBoard.config.fallback_reward_value,
        };
      const rewardType = String(rewardConfig?.reward_type || "").trim().toLowerCase();
      const rewardValue = Math.max(0, Number(rewardConfig?.reward_value || 0));
      if (rewardValue <= 0) return "";
      if (rewardType === "cash_prize" || rewardType === "points_balance") {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: competitionBoard.config.reward_currency || "BRL",
          minimumFractionDigits: 2,
        }).format(rewardValue);
      }
      return `${rewardValue.toLocaleString("pt-BR")}`;
    };
    const isVideoFrameAsset = (src) => /\.(webm|mp4)(\?.*)?$/i.test(String(src || ""));
    const renderFrameOverlay = (src, className) => {
      if (!src) return null;
      if (isVideoFrameAsset(src)) {
        return (
          <SmartVideo
            src={src}
            preload="metadata"
            className={className}
          />
        );
      }
      return <img src={src} alt="" aria-hidden="true" className={className} />;
    };

    const getRankingAvatarSrc = (item) => {
      if (item?.profile_image_mode === "photo" && item?.profile_image_url) {
        return resolveAssetUrl(item.profile_image_url);
      }
      if (item?.profile_avatar_id && avatarSrcById[item.profile_avatar_id]) {
        return avatarSrcById[item.profile_avatar_id];
      }
      return selectedAvatar?.src || "";
    };

    return (
      <Card className="relative overflow-hidden border border-amber-400/35 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/35 p-4 shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_16px_40px_rgba(120,53,15,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.24),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.18),transparent_35%)]" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Modo Semanal</p>
              <h3 className="text-lg font-black uppercase tracking-wide text-white">
                {isCompetitionFinishedPreview ? competitionBoard.config.finished_title : competitionBoard.config.title || "COMPETIÇÃO SEMANAL"}
              </h3>
              <p className="text-xs text-slate-300">
                {isCompetitionFinishedPreview ? competitionBoard.config.finished_subtitle : competitionBoard.config.subtitle}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => !isCompetitionFinishedPreview && setIsCompetitionHelpOpen(true)}
              disabled={isCompetitionFinishedPreview}
              className="h-8 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 text-[11px] font-bold text-amber-100 hover:bg-amber-500/20"
            >
              <HelpCircle className="mr-1 h-3.5 w-3.5" />
              {isCompetitionFinishedPreview ? (competitionBoard.config.finished_cta_label || "Encerrado") : "Como pontuar"}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-2">
              <p className="text-[10px] text-slate-400">Tempo restante</p>
              <p className="text-xs font-black text-amber-300">
                {isCompetitionFinishedPreview ? "Encerrado" : competitionTimeLeft}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-2">
              <p className="text-[10px] text-slate-400">Pontos no periodo</p>
              <p className="text-base font-black text-cyan-300">{safeEntryPoints.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-2">
              <p className="text-[10px] text-slate-400">Posicao ranking</p>
              <p className="text-base font-black text-emerald-300">#{entry?.position || "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
            {isCompetitionFinishedPreview
              ? "Resultado do ciclo em validacao. O ranking sera reiniciado no proximo ciclo."
              : competitionBoard.rewardLabel}
          </div>

          {isCompetitionFinishedPreview ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-200">Top {winnersCount} Ganhadores do ciclo</p>
                <p className="mt-1 text-[11px] text-emerald-100">
                  Premiação configurada no admin. Valor base atual: R${prizePerWinner.toFixed(2)}. Novo ciclo começa em breve.
                </p>
              </div>
              <div
                ref={competitionRankingRef}
                onPointerDown={handleCompetitionRankingPointerDown}
                onPointerMove={handleCompetitionRankingPointerMove}
                onPointerUp={handleCompetitionRankingPointerUpOrCancel}
                onPointerCancel={handleCompetitionRankingPointerUpOrCancel}
                onClickCapture={handleCompetitionRankingClickCapture}
                className="hide-scrollbar max-h-52 space-y-1.5 overflow-y-auto select-none"
              >
                {winnerEntries.map((item) => (
                  <button
                    key={`winner-${item.user_id}`}
                    type="button"
                    onClick={() => {
                      if (item.isSample) return;
                      openPublicProfileByUserId(item.user_id);
                    }}
                    className={`relative flex w-full items-center rounded-lg border border-slate-700/70 bg-slate-900/75 px-2.5 py-2 text-left transition ${
                      item.isSample ? "cursor-default" : "hover:border-cyan-400/55"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none text-4xl font-black leading-none text-slate-700/35"
                    >
                      {item.winnerPosition}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-slate-500/80 bg-slate-800">
                        {item.isSample ? (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-200">
                            {(item.nick || "G").slice(0, 1).toUpperCase()}
                          </div>
                        ) : (
                          <img
                            src={getRankingAvatarSrc(item)}
                            alt={item.nick}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <p className="truncate text-xs font-bold text-white">{item.nick}</p>
                    </div>
                    <div className="absolute right-12 top-1/2 w-[78px] -translate-y-1/2 text-center">
                      <p className="text-[11px] font-black text-cyan-200">
                        {Number(item.weekly_points ?? item.points ?? 0).toLocaleString("pt-BR")} pts
                        {formatCompetitionRewardLabel(item.winnerPosition) ? ` / ${formatCompetitionRewardLabel(item.winnerPosition)}` : ""}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-300">#{item.winnerPosition}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Top Ranking do Ciclo</p>
                  <p className="text-[11px] text-slate-400">{titleSuffix}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => refreshProfileCompetitionData()}
                  disabled={fetchingProfileGamification || isRefreshingCompetitionData}
                  className="h-8 rounded-full border border-cyan-400/45 bg-cyan-500/10 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-70"
                >
                  {fetchingProfileGamification || isRefreshingCompetitionData ? "Atualizando..." : "Atualizar dados"}
                </Button>
              </div>
              {visibleEntries.length === 0 ? (
                <p className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
                  Ainda sem pontuacao no ciclo.
                </p>
              ) : (
                <div
                  ref={competitionRankingRef}
                  onPointerDown={handleCompetitionRankingPointerDown}
                  onPointerMove={handleCompetitionRankingPointerMove}
                  onPointerUp={handleCompetitionRankingPointerUpOrCancel}
                  onPointerCancel={handleCompetitionRankingPointerUpOrCancel}
                  onClickCapture={handleCompetitionRankingClickCapture}
                  className="hide-scrollbar max-h-44 space-y-1.5 overflow-y-auto select-none"
                >
                  {visibleEntries.map((item) => {
                    const podiumRowClass =
                      item.position === 1 ? "py-3" : item.position === 2 ? "py-2.5" : item.position === 3 ? "py-2" : "py-1.5";
                    const avatarSizeClass =
                      item.position === 1 ? "h-7 w-7" : item.position === 2 ? "h-[1.625rem] w-[1.625rem]" : item.position === 3 ? "h-6 w-6" : "h-6 w-6";
                    const frameSizeClass =
                      item.position === 1 ? "h-13 w-13 scale-[1.24]" : item.position === 2 ? "h-12 w-12 scale-[1.2]" : "h-11 w-11 scale-[1.16]";

                    return (
                      <button
                        key={item.user_id}
                        type="button"
                        onClick={() => {
                          if (item.isSample) return;
                          openPublicProfilePage(item.user_id);
                        }}
                        className={`flex w-full items-center rounded-lg border px-2.5 text-left transition ${podiumRowClass} ${
                          item.user_id === entry?.user_id
                            ? "border-amber-400/65 bg-amber-500/15"
                            : "border-slate-700/70 bg-slate-900/65 hover:border-cyan-400/45"
                        }`}
                      >
                        <div className="mr-2">
                          <div className={`relative ${avatarSizeClass}`}>
                            <div className={`${avatarSizeClass} overflow-hidden rounded-full border border-slate-500/80 bg-slate-800`}>
                              {item.isSample ? (
                                <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-slate-200">
                                  {(item.nick || "C").slice(0, 1).toUpperCase()}
                                </div>
                              ) : (
                                <img
                                  src={getRankingAvatarSrc(item)}
                                  alt={item.nick}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                            {item.position <= 3 && top3FrameUrl
                              ? renderFrameOverlay(
                                  top3FrameUrl,
                                  `pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain ${frameSizeClass}`
                                )
                              : null}
                            {item.position <= 3 && !top3FrameUrl && localTopFrameByPosition[item.position]
                              ? renderFrameOverlay(
                                  localTopFrameByPosition[item.position],
                                  `pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain ${frameSizeClass}`
                                )
                              : null}
                          </div>
                        </div>
                        <p className="truncate text-xs font-bold text-white">#{item.position} {item.nick}</p>
                        <div className="ml-auto pl-2 text-right">
                          <p className="text-[11px] font-black text-cyan-200">
                            {Number(item.weekly_points ?? item.points ?? 0).toLocaleString("pt-BR")} pts
                            {formatCompetitionRewardLabel(item.position) ? ` / ${formatCompetitionRewardLabel(item.position)}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {showOwnEntryOutsideTop ? (
                    <button
                      type="button"
                      onClick={() => openPublicProfilePage(entry.user_id)}
                      className="flex w-full items-center rounded-lg border border-amber-400/65 bg-amber-500/15 px-2.5 py-1.5 text-left"
                    >
                      <div className="mr-2">
                        <div className="relative h-6 w-6">
                          <div className="h-6 w-6 overflow-hidden rounded-full border border-slate-500/80 bg-slate-800">
                            <img src={getRankingAvatarSrc(entry)} alt={entry.nick || "Voce"} className="h-full w-full object-cover" />
                          </div>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-white">Sua colocação: #{entry.position} {entry.nick || "Você"}</p>
                        <p className="shrink-0 text-[11px] font-black text-cyan-200">
                          {safeEntryPoints.toLocaleString("pt-BR")} pts
                          {formatCompetitionRewardLabel(entry.position) ? ` / ${formatCompetitionRewardLabel(entry.position)}` : ""}
                        </p>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderSectionSkeleton = ({ title, subtitle = "Carregando dados...", rows = 3, compact = false }) => (
    <Card className="border-slate-800 bg-slate-900/70 p-4">
      <div className="animate-pulse">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="h-4 w-32 rounded-full bg-slate-800" />
            <div className="mt-2 h-3 w-44 rounded-full bg-slate-800/80" />
          </div>
          {!compact ? <div className="h-8 w-28 rounded-full bg-slate-800" /> : null}
        </div>
        <p className="mb-3 text-xs text-slate-400">{subtitle}</p>
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={`${title}-${index}`}
              className={`rounded-xl border border-slate-800 bg-slate-950/70 ${compact ? "h-12" : "h-16"}`}
            />
          ))}
        </div>
      </div>
    </Card>
  );

  const renderGamificationUnavailableCard = ({ title, subtitle }) => (
    <Card className="border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
        <p className="text-sm font-semibold text-amber-100">Os dados deste bloco não carregaram agora.</p>
        <p className="mt-1 text-xs text-amber-50/80">
          {profileGamificationError?.message || "Tente atualizar os dados do perfil novamente."}
        </p>
        <Button
          type="button"
          onClick={() => refreshProfileCompetitionData()}
          disabled={isRefreshingCompetitionData}
          className="mt-3 h-9 rounded-xl bg-amber-400 px-4 text-slate-950 hover:bg-amber-300"
        >
          {isRefreshingCompetitionData ? "Atualizando..." : "Atualizar dados"}
        </Button>
      </div>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.14),_transparent_35%)]" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
          <TechLoader />
          <div className="mt-6 w-[min(88vw,24rem)] rounded-2xl border border-cyan-300/25 bg-white/10 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.42)] backdrop-blur-md">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wide text-cyan-100">Carregando perfil</p>
              <p className="text-[11px] font-bold text-cyan-200">{Math.round(initialProfileLoadProgress)}%</p>
            </div>
            <p className="mb-3 text-xs text-cyan-50/80">{initialProfileLoadLabel}</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800/90">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                animate={{ width: `${Math.round(initialProfileLoadProgress)}%` }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const profileSwitchLoaderOverlay = (
    <AnimatePresence>
      {isProfileSwitchLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/28 backdrop-blur-[2px]"
        >
          <div className="w-[min(88vw,22rem)] rounded-2xl border border-cyan-300/40 bg-white/12 px-4 py-3 shadow-[0_14px_40px_rgba(8,145,178,0.28)] backdrop-blur-md">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wide text-cyan-100">Carregando perfil</p>
              <p className="text-[11px] font-bold text-cyan-200">{Math.round(profileSwitchProgress)}%</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/90">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400"
                animate={{ width: `${Math.round(profileSwitchProgress)}%` }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (isViewingPublicProfile) {
    const publicState = selectedPublicProfile
      ? isSelectedRealProfile
        ? {
            isFollowing:
              typeof simState?.[selectedPublicProfile.id]?.isFollowing === "boolean"
                ? Boolean(simState[selectedPublicProfile.id].isFollowing)
                : Boolean(selectedPublicSocialState?.isFollowing),
            isLiked:
              typeof simState?.[selectedPublicProfile.id]?.isLiked === "boolean"
                ? Boolean(simState[selectedPublicProfile.id].isLiked)
                : Boolean(selectedPublicSocialState?.isLiked),
            following: Number(
              simState?.[selectedPublicProfile.id]?.following ??
              selectedPublicSocialState?.following ??
              selectedPublicProfile.following ??
              0
            ),
            followers: Number(
              simState?.[selectedPublicProfile.id]?.followers ??
              selectedPublicSocialState?.followers ??
              selectedPublicProfile.followers ??
              0
            ),
            likes: Number(
              simState?.[selectedPublicProfile.id]?.likes ??
              selectedPublicSocialState?.likes ??
              selectedPublicProfile.likes ??
              0
            ),
          }
        : simState[selectedPublicProfile.id] || {
            isFollowing: false,
            isLiked: false,
            following: selectedPublicProfile.following,
            followers: selectedPublicProfile.followers,
            likes: selectedPublicProfile.likes,
          }
      : null;
    const publicMetrics = selectedPublicProfile
      ? {
          totalTickets: Number(selectedPublicProfileSummary?.metrics?.totalTickets ?? selectedPublicProfile.tickets ?? 0),
          points: Number(
            selectedPublicProfileSummary?.currentCompetitionEntry?.weekly_points ??
            selectedPublicProfileSummary?.metrics?.weeklyPoints ??
            selectedPublicProfile.points ??
            0
          ),
          xpTotal: Number(selectedPublicProfileSummary?.metrics?.xpTotal ?? selectedPublicProfile.xpTotal ?? selectedPublicProfile.xp_total ?? 0),
          position: activeCycle
            ? Number(selectedPublicProfileSummary?.currentCompetitionEntry?.position ?? selectedPublicProfile.position ?? 0)
            : 0,
          totalWins: Number(selectedPublicProfileSummary?.metrics?.totalWins ?? selectedPublicProfile.totalWins ?? 0),
          totalApproved: Number(selectedPublicProfileSummary?.metrics?.totalApproved ?? selectedPublicProfile.totalApproved ?? 0),
          totalParticipations: selectedPublicProfile.participations,
          liveParticipations: selectedPublicProfile.liveParticipations || 0,
          totalFollowers: Number(publicState?.followers ?? selectedPublicProfile.followers ?? 0),
          progress: Math.min(
            100,
            Math.round(
              (selectedPublicProfile.participations / Math.max(1, Number(pointsRules.progress_target_participations || 25))) * 100
            )
          ),
        }
      : null;
    const publicAchievements = publicMetrics
      ? evaluateBadgeRules(publicMetrics, badgeRules).map((rule) => ({
          key: rule.id,
          label: rule.label,
          icon: BADGE_ICON_MAP[rule.icon] || Star,
          color: BADGE_COLOR_CLASS[rule.color] || "text-cyan-300",
          iconUrl: rule.icon_url || "",
          ruleText: formatBadgeRuleText(rule),
        }))
      : [];
    const publicProgressBadges = publicMetrics ? [buildProgressBadge(publicMetrics, pointsRules)] : [];
    const publicBadgeGallery = buildBadgeGalleryFromRules(badgeRules, publicAchievements);
    const publicSuperFanProgress = publicProgressBadges[0]?.progress ?? 0;
    const publicLevelProgress = getLevelProgress(publicMetrics?.xpTotal || 0);
    const publicCompetitionEntry =
      selectedPublicProfileSummary?.currentCompetitionEntry ||
      (selectedPublicProfile?.id && competitionEntryByUserId[selectedPublicProfile.id]) ||
      {
        points: publicMetrics?.points || 0,
        position: publicMetrics?.position || 0,
      };
    const otherProfiles = randomizedOtherProfiles;

    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Button
          type="button"
          onClick={closePublicProfilePage}
          className="w-fit gap-2 bg-slate-800 text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao meu perfil
        </Button>

        {selectedPublicProfile ? (
          <>
          <Card className="relative overflow-hidden border-slate-800 bg-gradient-to-br from-cyan-950/70 via-slate-900 to-slate-900 p-4">
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center bg-repeat opacity-[0.04]"
              style={{ backgroundImage: `url(${profileCoverTile})` }}
            />
            <div className="relative z-10 mb-3 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setIsPublicPhotoViewerOpen(true)}
                className="h-24 w-24 overflow-hidden rounded-full border-2 border-cyan-400/50 transition hover:scale-[1.02] hover:ring-2 hover:ring-cyan-400/30"
                aria-label="Ampliar foto do perfil"
              >
                {selectedPublicProfile.avatarSrc ? (
                  <img
                    src={selectedPublicProfile.avatarSrc}
                    alt={selectedPublicProfile.nick}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white">AV</div>
                )}
              </button>
              <p className="mt-2 text-xl font-bold text-white">{selectedPublicProfile.nick}</p>
              <p className="text-sm text-cyan-300">@{selectedPublicProfile.handle}</p>
              {publicAchievements.length ? (
                <div className="relative mt-2 flex w-full justify-center">
                  <div className="flex gap-2">
                    {publicAchievements.map((achievement) => {
                      const Icon = achievement.icon;
                      return (
                        <div key={achievement.key} className="relative">
                          <button
                            type="button"
                            onClick={() => openBadgeInfo(achievement, publicBadgeGallery.ordered)}
                            className="rounded-full border border-slate-700 bg-slate-900/70 p-1.5 transition hover:border-cyan-500/50"
                            aria-label={achievement.label}
                            title={achievement.label}
                          >
                            <Icon className={`h-4 w-4 ${achievement.color}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {renderLevelHud(publicLevelProgress)}
            </div>

            {isOwnSelectedPublicProfile ? null : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={isSelectedRealProfile ? toggleAuthoritativePublicFollow : () => toggleSimFollow(selectedPublicProfile.id)}
                  disabled={isSelectedRealProfile && Boolean(followPendingById[selectedPublicProfile.id])}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    publicState?.isFollowing
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {publicState?.isFollowing ? "Seguindo" : "Seguir"}
                </button>
                <button
                  type="button"
                  onClick={isSelectedRealProfile ? toggleAuthoritativePublicLike : () => toggleSimLike(selectedPublicProfile.id)}
                  disabled={isSelectedRealProfile && Boolean(likePendingById[selectedPublicProfile.id])}
                  className={`rounded-xl px-3 py-2 text-xs font-bold text-white transition ${
                    publicState?.isLiked ? "bg-pink-500 hover:bg-pink-400" : "bg-pink-600/60 hover:bg-pink-500/80"
                  }`}
                >
                  {publicState?.isLiked ? "Descurtir" : "Curtir"}
                </button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-white">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                <p className="text-[11px] text-slate-400">Seguindo</p>
                <p className="text-base font-bold">{publicState?.following ?? selectedPublicProfile.following}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                <p className="text-[11px] text-slate-400">Seguidores</p>
                <p className="text-base font-bold">{publicState?.followers ?? selectedPublicProfile.followers}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                <p className="text-[11px] text-slate-400">Curtidas</p>
                <p className="text-base font-bold">{publicState?.likes ?? selectedPublicProfile.likes}</p>
              </div>
            </div>
          </Card>

          {renderCompetitionCard({
            entry: publicCompetitionEntry,
            titleSuffix: "Visivel para todos que abrirem este perfil.",
          })}

          <Card className="border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Resumo Publico</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className="text-xs text-slate-400">Bilhetes</p>
                <p className="text-xl font-black text-cyan-300">{publicMetrics?.totalTickets ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className="text-xs text-slate-400">Top Semanal</p>
                <p className="text-xl font-black text-emerald-300">#{publicMetrics?.position || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className="text-xs text-slate-400">Prêmios Ganhos</p>
                <p className="text-xl font-black text-yellow-300">{publicMetrics?.totalWins}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-400">Super Fã das Lives do SouzaTV</span>
                <span className="text-cyan-300">{publicSuperFanProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                  style={{ width: `${publicSuperFanProgress}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Selos e Conquistas</h2>
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <p className="font-semibold uppercase tracking-wide text-emerald-300">
                {publicBadgeGallery.unlocked.length} de {publicBadgeGallery.ordered.length} desbloqueados
              </p>
              <p className="text-slate-400">Arraste para ver</p>
            </div>
            <div
              ref={publicBadgeStripRef}
              onPointerDown={handlePublicBadgePointerDown}
              onPointerMove={handlePublicBadgePointerMove}
              onPointerUp={handlePublicBadgePointerUpOrCancel}
              onPointerCancel={handlePublicBadgePointerUpOrCancel}
              onClickCapture={handlePublicBadgeClickCapture}
              onWheel={handlePublicBadgeWheel}
              className="hide-scrollbar touch-pan-x flex cursor-grab gap-2 overflow-x-auto overflow-y-hidden pb-1 pr-1 active:cursor-grabbing select-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {publicBadgeGallery.ordered.map((achievement) => (
                <button
                  key={`public-badge-${achievement.key}`}
                  type="button"
                  onClick={() => openBadgeInfo(achievement, publicBadgeGallery.ordered)}
                  className={`relative h-[86px] w-[86px] shrink-0 rounded-xl border p-2 text-center transition ${
                    achievement.unlocked
                      ? "border-emerald-400/35 bg-gradient-to-b from-emerald-500/10 via-slate-950 to-slate-900 hover:border-emerald-300/60"
                      : "border-slate-800 bg-slate-950/90 hover:border-slate-600"
                  }`}
                  aria-label={`Detalhes do selo ${achievement.label}`}
                >
                  {!achievement.unlocked ? (
                    <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600/90 bg-slate-900/90">
                      <Lock className="h-2.5 w-2.5 text-slate-300" />
                    </span>
                  ) : null}
                  {achievement.unlocked ? (
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_65%)]" />
                  ) : null}
                  <div className={`${achievement.unlocked ? "" : "opacity-40 grayscale"} flex h-full items-center justify-center ${getSpecialBadgeVisual(achievement) ? "scale-[0.72]" : ""}`}>
                    <AchievementIcon achievement={achievement} playVideo={shouldPlayInlineBadgeVideos} />
                  </div>
                  {!achievement.unlocked ? <span className="pointer-events-none absolute inset-0 rounded-xl bg-black/40" /> : null}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {publicProgressBadges.map((badge) => (
                <div key={badge.key} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <p className="font-semibold text-cyan-200">{badge.title}</p>
                    <p className="text-slate-300">
                      Nível {badge.level}
                    </p>
                  </div>
                  <p className="mb-2 text-[11px] text-slate-400">{badge.subtitle}</p>
                  <div className="h-2 w-full rounded-full bg-slate-800">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${badge.completed ? "bg-emerald-400" : "bg-gradient-to-r from-cyan-400 to-blue-500"}`}
                      style={{ width: `${badge.progress}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-[11px] ${badge.completed ? "text-emerald-300" : "text-slate-400"}`}>
                    {badge.current}/{badge.target} para o Nível {badge.nextLevel} ({badge.progress}%)
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Suspense fallback={null}>
            <PrizeGalleryCard
              userId={selectedPublicProfile?.id}
              title="Galeria de Prêmios"
              subtitle="Modo público: outras pessoas conseguem ver os prêmios já registrados neste perfil."
              emptyTitle="Este perfil ainda não exibiu prêmios na galeria"
              emptySubtitle="Quando esse usuário ganhar e resgatar recompensas, elas vão aparecer aqui em formato de coleção."
              countLabel="registrados"
              privateView={false}
            />
          </Suspense>

          <Card className="border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Outros Perfis</h2>
              <span className="text-xs text-slate-400">Arraste para o lado</span>
            </div>
            <div
              ref={publicOtherStripRef}
              data-nav-swipe-lock="true"
              onPointerDown={handlePublicOtherPointerDown}
              onPointerMove={handlePublicOtherPointerMove}
              onPointerUp={handlePublicOtherPointerUpOrCancel}
              onPointerCancel={handlePublicOtherPointerUpOrCancel}
              onClickCapture={handlePublicOtherClickCapture}
              onWheel={handlePublicOtherWheel}
              className="hide-scrollbar touch-pan-x flex gap-3 overflow-x-auto pb-1 select-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {otherProfiles.map((profile, index) => {
                const state = simState[profile.id] || {
                  isFollowing: false,
                  isLiked: false,
                  followers: profile.followers,
                  likes: profile.likes,
                };
                const podiumPosition = index + 1;
                const isPodium = podiumPosition <= 3;
                const podiumFrameSrc = podiumFrameByPosition[podiumPosition] || "";

                return (
                  <div key={profile.id} className="w-[240px] shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="mb-2 flex items-center gap-2.5">
                      <div className="relative h-11 w-11 shrink-0">
                        <button
                          type="button"
                          onClick={() => openPublicProfilePage(profile.id)}
                          className={`h-11 w-11 overflow-hidden rounded-full transition ${
                            isPodium ? "border border-transparent" : "border border-cyan-500/40 hover:border-cyan-300/70"
                          }`}
                          aria-label={`Abrir perfil de ${profile.nick}`}
                        >
                          {profile.avatarSrc ? (
                            <img
                              src={profile.avatarSrc}
                              alt={profile.nick}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = defaultAvatar;
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-white">
                              {getProfileAvatarFallback(profile, "AV")}
                            </div>
                          )}
                        </button>
                        {isPodium && podiumFrameSrc ? (
                          <SmartVideo
                            src={podiumFrameSrc}
                            preload="metadata"
                            className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[12.8rem] w-[12.8rem] -translate-x-1/2 -translate-y-1/2 scale-[1.2] object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openPublicProfilePage(profile.id)}
                          className="block w-full truncate text-left text-sm font-bold leading-tight text-white transition hover:text-cyan-200"
                        >
                          {profile.nick}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPublicProfilePage(profile.id)}
                          className="mt-0 block w-full truncate text-left text-xs leading-tight text-cyan-300 transition hover:text-cyan-200"
                        >
                          @{profile.handle}
                        </button>
                      </div>
                    </div>

                    <div className="mb-2 grid grid-cols-3 gap-1 text-center">
                      <div className="rounded-lg bg-slate-900 p-1.5">
                        <p className="text-center text-[10px] text-slate-400">LV</p>
                        <p className="text-xs font-bold text-cyan-200">{getLevelLabelFromXp(profile.xpTotal ?? profile.xp_total ?? 0)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-900 p-1.5">
                        <p className="text-center text-[10px] text-slate-400">Prêmios</p>
                        <p className="text-xs font-bold text-indigo-200">{profile.totalWins}</p>
                      </div>
                      <div className="rounded-lg bg-slate-900 p-1.5">
                        <p className="text-center text-[10px] text-slate-400 whitespace-nowrap">Top sem.</p>
                        <p className="text-xs font-bold text-emerald-200">{getCompetitiveTopLabel(profile)}</p>
                      </div>
                    </div>

                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>{state.followers} seguidores</span>
                      <span>{state.likes} curtidas</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleDiscoverFollow(profile)}
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                          state.isFollowing
                            ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                            : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        }`}
                      >
                        {state.isFollowing ? "Seguindo" : "Seguir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDiscoverLike(profile)}
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold text-white transition ${
                          state.isLiked ? "bg-pink-500 hover:bg-pink-400" : "bg-pink-600/60 hover:bg-pink-500/80"
                        }`}
                      >
                        {state.isLiked ? "Curtido" : "Curtir"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!otherProfiles.length ? (
                <div className="w-full rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-center text-sm text-slate-300">
                  Sem novas recomendações por agora. Volte depois para descobrir novos perfis.
                </div>
              ) : null}
            </div>
          </Card>

          <Dialog open={isPublicPhotoViewerOpen} onOpenChange={setIsPublicPhotoViewerOpen}>
            <DialogContent className="rounded-3xl border border-slate-700/90 bg-slate-950/95 text-white shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-center text-base font-bold text-white">
                  Foto de {selectedPublicProfile.nick}
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_14px_40px_rgba(2,6,23,0.55)]">
                <div className="overflow-hidden rounded-[1.15rem] border border-slate-700/80 bg-slate-900">
                  {selectedPublicProfile.avatarSrc ? (
                    <img src={selectedPublicProfile.avatarSrc} alt={selectedPublicProfile.nick} className="max-h-[70vh] w-full object-contain" />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-slate-300">Sem imagem</div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCompetitionHelpOpen} onOpenChange={setIsCompetitionHelpOpen}>
            <DialogContent className="border-amber-400/45 bg-slate-950 text-white shadow-[0_0_35px_rgba(251,191,36,0.22)]">
              <DialogHeader>
                <DialogTitle className="text-center text-base font-black uppercase tracking-wide text-amber-200">
                  Como ganhar pontos
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Regras do ciclo</p>
                  <p className="mt-1 text-xs text-slate-200">{competitionBoard.rewardLabel}</p>
                </div>
                <div className="space-y-1.5">
                  {competitionInstructions.length === 0 ? (
                    <p className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-300">
                      Sem instrucoes cadastradas.
                    </p>
                  ) : (
                    competitionInstructions.map((line, index) => (
                      <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-200">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(selectedBadgeInfo)} onOpenChange={(open) => !open && closeBadgeViewer()}>
            <DialogContent
              hideClose
              className={`h-[100dvh] w-screen max-w-none border-0 p-0 text-white shadow-none ${
                useLiteBadgeViewer ? "bg-white/8 backdrop-blur-[1px]" : "bg-white/10 backdrop-blur-[2px]"
              }`}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedBadgeInfo?.label || "Selo"}</DialogTitle>
              </DialogHeader>
          {renderBadgeViewerContent()}
        </DialogContent>
      </Dialog>
          </>
        ) : isPublicProfileResolving ? (
          <Card className="border-slate-800 bg-slate-900/70 p-6">
            <TechLoader />
          </Card>
        ) : hasPublicProfileLookupError ? (
          <Card className="border-slate-800 bg-slate-900/70 p-6 text-center text-slate-200">
            Não foi possível carregar esse perfil agora. Tente novamente.
          </Card>
        ) : (
          <Card className="border-slate-800 bg-slate-900/70 p-6 text-center text-slate-200">
            Perfil não encontrado.
          </Card>
        )}
      {profileSwitchLoaderOverlay}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="relative overflow-hidden border-slate-800 bg-gradient-to-br from-cyan-950/70 via-slate-900 to-slate-900 p-4">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-repeat opacity-[0.04]"
          style={{ backgroundImage: `url(${profileCoverTile})` }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => setIsPhotoMenuOpen(true)}
            className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-cyan-400/50 bg-slate-800 ring-2 ring-cyan-500/20 transition hover:scale-[1.02] hover:ring-cyan-400/40"
            aria-label="Opcoes da foto de perfil"
          >
            {safeProfileImageSrc ? (
              <img
                src={safeProfileImageSrc}
                alt="Avatar"
                className="h-full w-full object-cover"
                onError={() => setProfileImageFallbackStep((step) => Math.min(step + 1, 2))}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-white">{user.avatar_emoji || "U"}</div>
            )}
            {(isPrivatePhotoLoading || uploadImageMutation.isPending) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/65">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-100" />
              </div>
            )}
          </button>

          <div className="mt-3 min-w-0">
            <h1 className="truncate text-xl font-bold text-white">{user.nick || user.full_name || "Usuário"}</h1>
            <p className="text-sm font-medium text-cyan-300">@{profilePrefs.handle || "usuário"}</p>
            {profilePrefs.alias ? <p className="text-xs text-slate-300">{profilePrefs.alias}</p> : null}
            {(user.profile_image_status === "manual_review" || user.profile_image_status === "pending") && (
              <p className="text-[11px] text-cyan-300">Sua foto está em análise e visível apenas para você.</p>
            )}
          </div>

          {renderProfileNotificationsHud()}
          {isProfileGamificationPending || isProfileGamificationUnavailable ? null : renderLevelHud(levelProgress)}

          <button
            type="button"
            onClick={openQuickEditModal}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-200"
            aria-label="Editar perfil rápido"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar rápido
          </button>

          {!isViewingPublicProfile ? null : (
            <div className="mt-3 w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={updateFollow}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    social.isFollowing
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                      : "bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {social.isFollowing ? "Seguindo" : "Seguir"}
                </button>
                <button
                  type="button"
                  onClick={likeProfile}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${
                    social.isLiked ? "bg-pink-500 hover:bg-pink-400" : "bg-pink-600/60 hover:bg-pink-500/80"
                  }`}
                >
                  <Heart className="h-3.5 w-3.5" />
                  {social.isLiked ? "Descurtir" : "Curtir"}
                </button>
              </div>
            </div>
          )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPointsHistoryTab("weekly");
                  setIsPointsHistoryOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Historico de Pontos
              </button>
              <button
                type="button"
                onClick={() => setIsCheckInCalendarOpen(true)}
                className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-bold transition ${
                  dailyCheckInState?.checkedIn
                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                }`}
              >
                Check-in diario
              </button>
            </div>
          </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-white">
          <button
            type="button"
            onClick={() => openSocialList("following")}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/50 hover:bg-slate-800/80"
          >
            <p className="text-[11px] text-slate-400">Seguindo</p>
            <p className="text-base font-bold">{social.following}</p>
          </button>
          <button
            type="button"
            onClick={() => openSocialList("followers")}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/50 hover:bg-slate-800/80"
          >
            <p className="text-[11px] text-slate-400">Seguidores</p>
            <p className="text-base font-bold">{social.followers}</p>
          </button>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
            <p className="text-[11px] text-slate-400">Curtidas</p>
            <p className="text-base font-bold">{social.likes}</p>
          </div>
        </div>

        <div className="mt-4">
          {isProfileGamificationPending
            ? renderSectionSkeleton({
                title: "Top Semanal",
                subtitle: "Preparando ranking, pontos e premiação do ciclo.",
                rows: 4,
              })
            : isProfileGamificationUnavailable
            ? renderGamificationUnavailableCard({
                title: "Top Semanal",
                subtitle: "Não foi possível carregar o ranking do ciclo agora.",
              })
            : renderCompetitionCard({
                entry: currentCompetitionEntry,
                titleSuffix: "Sua pontuacao atual na temporada.",
              })}
        </div>

      </Card>

      <Card className="border-slate-800 bg-slate-900/70 p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROFILE_PRIVATE_TABS.map((tab) => {
            const isActive = activePrivateTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePrivateTab(tab.id)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  isActive
                    ? "bg-cyan-500 text-slate-950"
                    : "bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {isEngagementTabActive ? (isProfileGamificationPending ? (
        renderSectionSkeleton({
          title: "Mais Engajados",
          subtitle: "Carregando os perfis com maior nível, top semanal e engajamento.",
          rows: 2,
        })
      ) : isProfileGamificationUnavailable ? (
        renderGamificationUnavailableCard({
          title: "Mais Engajados",
          subtitle: "Não foi possível montar a lista de perfis mais engajados agora.",
        })
      ) : (
        <Card className="border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Mais Engajados</h2>
            {engagementGuideConfig.enabled ? (
              <button
                type="button"
                onClick={() => setIsEngagementGuideOpen(true)}
                className="text-xs text-slate-400 underline decoration-slate-500/70 underline-offset-2 transition hover:text-cyan-300"
              >
                {engagementGuideConfig.link_label}
              </button>
            ) : (
              <span className="text-xs text-slate-500">Guia oculto</span>
            )}
          </div>
          <div
            ref={simulatedStripRef}
            data-nav-swipe-lock="true"
            onPointerDown={handleSimPointerDown}
            onPointerMove={handleSimPointerMove}
            onPointerUp={handleSimPointerUpOrCancel}
            onPointerCancel={handleSimPointerUpOrCancel}
            onClickCapture={handleSimClickCapture}
            onWheel={handleSimWheel}
            className="hide-scrollbar touch-pan-x flex gap-3 overflow-x-auto pb-1 select-none"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {engagedProfilesWithSummary.slice(0, 5).map((profile, index) => {
              const state = simState[profile.id] || {
                isFollowing: Boolean(profile.isFollowing),
                isLiked: Boolean(profile.isLiked),
                followers: profile.followers,
                likes: profile.likes,
              };
              const podiumPosition = index + 1;
              const isPodium = podiumPosition <= 3;
              const podiumFrameSrc = podiumFrameByPosition[podiumPosition] || "";

              return (
                <div
                  key={profile.id}
                  className="relative w-[240px] shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  {podiumPosition <= 10 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 top-1 z-10 select-none text-5xl font-black leading-none text-slate-600/40"
                    >
                      {podiumPosition}
                    </span>
                  ) : null}
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="relative h-11 w-11 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPublicProfileByUserId(profile.id)}
                        className={`h-11 w-11 overflow-hidden rounded-full transition ${
                          isPodium ? "border border-transparent" : "border border-cyan-500/40 hover:border-cyan-300/70"
                        }`}
                        aria-label={`Abrir perfil de ${profile.nick}`}
                      >
                        {profile.avatarSrc ? (
                          <img
                            src={profile.avatarSrc}
                            alt={profile.nick}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = defaultAvatar;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white">
                            {getProfileAvatarFallback(profile, "AV")}
                          </div>
                        )}
                      </button>
                      {isPodium && podiumFrameSrc ? (
                        <SmartVideo
                          src={podiumFrameSrc}
                          preload="metadata"
                          className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[12.8rem] w-[12.8rem] -translate-x-1/2 -translate-y-1/2 scale-[1.2] object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openPublicProfileByUserId(profile.id)}
                        className="block w-full truncate text-left text-sm font-bold leading-tight text-white transition hover:text-cyan-200"
                      >
                        {profile.nick}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPublicProfileByUserId(profile.id)}
                        className="mt-0 block w-full truncate text-left text-xs leading-tight text-cyan-300 transition hover:text-cyan-200"
                      >
                        @{profile.handle}
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 grid grid-cols-3 gap-1 text-center">
                    <div className="rounded-lg bg-slate-900 p-1.5">
                      <p className="text-center text-[10px] text-slate-400">LV</p>
                      <p className="text-xs font-bold text-cyan-200">{getLevelLabelFromXp(profile.xpTotal ?? profile.xp_total ?? 0)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-1.5">
                      <p className="text-center text-[10px] text-slate-400">Prêmios</p>
                      <p className="text-xs font-bold text-indigo-200">{profile.totalWins}</p>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-1.5">
                      <p className="text-center text-[10px] text-slate-400 whitespace-nowrap">Top sem.</p>
                      <p className="text-xs font-bold text-emerald-200">{getCompetitiveTopLabel(profile)}</p>
                    </div>
                  </div>

                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                    <span>{state.followers} seguidores</span>
                    <span>{state.likes} curtidas</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleDiscoverFollow(profile)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                        state.isFollowing
                          ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {state.isFollowing ? "Seguindo" : "Seguir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDiscoverLike(profile)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-bold text-white transition ${
                        state.isLiked ? "bg-pink-500 hover:bg-pink-400" : "bg-pink-600/60 hover:bg-pink-500/80"
                      }`}
                    >
                      {state.isLiked ? "Curtido" : "Curtir"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )) : null}

      {isOverviewTabActive ? (isProfileGamificationPending ? (
        renderSectionSkeleton({
          title: "Resumo Publico",
          subtitle: "Buscando bilhetes, posição no top semanal e progresso geral.",
          rows: 2,
          compact: true,
        })
      ) : isProfileGamificationUnavailable ? (
        renderGamificationUnavailableCard({
          title: "Resumo Publico",
          subtitle: "Não foi possível carregar o resumo do perfil agora.",
        })
      ) : (
        <Card className="border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Resumo Publico</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">Bilhetes</p>
              <p className="text-xl font-black text-cyan-300">{metrics.totalTickets}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">Top Semanal</p>
              <p className="text-xl font-black text-emerald-300">#{metrics.position || "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">Prêmios Ganhos</p>
              <p className="text-xl font-black text-yellow-300">{metrics.totalWins}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-400">Super Fã das Lives do SouzaTV</span>
              <span className="text-cyan-300">{superFanProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${superFanProgress}%` }}
              />
            </div>
          </div>
        </Card>
      )) : null}

      {isAchievementsTabActive ? (isProfileGamificationPending ? (
        renderSectionSkeleton({
          title: "Selos e Conquistas",
          subtitle: "Carregando selos, níveis e progresso do perfil.",
          rows: 4,
        })
      ) : isProfileGamificationUnavailable ? (
        renderGamificationUnavailableCard({
          title: "Selos e Conquistas",
          subtitle: "Não foi possível validar seus selos e progresso agora.",
        })
      ) : (
        <Card className="border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Selos e Conquistas</h2>
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <p className="font-semibold uppercase tracking-wide text-emerald-300">
              {badgeGallery.unlocked.length} de {badgeGallery.ordered.length} desbloqueados
            </p>
            <p className="text-slate-400">Arraste para ver</p>
          </div>
          <div
            ref={privateBadgeStripRef}
            onPointerDown={handlePrivateBadgePointerDown}
            onPointerMove={handlePrivateBadgePointerMove}
            onPointerUp={handlePrivateBadgePointerUpOrCancel}
            onPointerCancel={handlePrivateBadgePointerUpOrCancel}
            onClickCapture={handlePrivateBadgeClickCapture}
            onWheel={handlePrivateBadgeWheel}
            className="hide-scrollbar touch-pan-x flex cursor-grab gap-2 overflow-x-auto overflow-y-hidden pb-1 pr-1 active:cursor-grabbing select-none"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {badgeGallery.ordered.map((achievement) => (
              <button
                key={`badge-${achievement.key}`}
                type="button"
                onClick={() => openBadgeInfo(achievement, badgeGallery.ordered)}
                className={`relative h-[86px] w-[86px] shrink-0 rounded-xl border p-2 text-center transition ${
                  achievement.unlocked
                    ? "border-emerald-400/35 bg-gradient-to-b from-emerald-500/10 via-slate-950 to-slate-900 hover:border-emerald-300/60"
                    : "border-slate-800 bg-slate-950/90 hover:border-slate-600"
                }`}
                aria-label={`Detalhes do selo ${achievement.label}`}
              >
                {!achievement.unlocked ? (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600/90 bg-slate-900/90">
                    <Lock className="h-2.5 w-2.5 text-slate-300" />
                  </span>
                ) : null}
                {achievement.unlocked ? (
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_65%)]" />
                ) : null}
                <div className={`${achievement.unlocked ? "" : "opacity-40 grayscale"} flex h-full items-center justify-center ${getSpecialBadgeVisual(achievement) ? "scale-[0.72]" : ""}`}>
                  <AchievementIcon achievement={achievement} playVideo={shouldPlayInlineBadgeVideos} />
                </div>
                {!achievement.unlocked ? <span className="pointer-events-none absolute inset-0 rounded-xl bg-black/40" /> : null}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {progressBadges.map((badge) => (
              <div key={badge.key} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <p className="font-semibold text-cyan-200">{badge.title}</p>
                  <p className="text-slate-300">
                    Nível {badge.level}
                  </p>
                </div>
                <p className="mb-2 text-[11px] text-slate-400">{badge.subtitle}</p>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${badge.completed ? "bg-emerald-400" : "bg-gradient-to-r from-cyan-400 to-blue-500"}`}
                    style={{ width: `${badge.progress}%` }}
                  />
                </div>
                <p className={`mt-1 text-[11px] ${badge.completed ? "text-emerald-300" : "text-slate-400"}`}>
                  {badge.current}/{badge.target} para o Nível {badge.nextLevel} ({badge.progress}%)
                </p>
              </div>
            ))}
          </div>
        </Card>
      )) : null}

      {isPrizesTabActive ? (<Suspense
        fallback={renderSectionSkeleton({
          title: "Seus Prêmios",
          subtitle: "Montando sua galeria privada de prêmios.",
          rows: 3,
        })}
      >
        <PrizeGalleryCard
          userId={user?.id}
          title="Seus Prêmios"
          subtitle="Esta é a sua galeria privada. Aqui você acompanha tudo o que já ganhou no app em formato de coleção."
          emptyTitle="Você ainda não tem prêmios salvos na sua galeria"
          emptySubtitle="Os prêmios resgatados no Baú Diário e nas próximas experiências vão aparecer aqui automaticamente."
          countLabel="na coleção"
          privateView={true}
        />
      </Suspense>) : null}

      <Dialog open={isPointsHistoryOpen} onOpenChange={setIsPointsHistoryOpen}>
        <DialogContent className="border-cyan-500/30 bg-slate-950 text-white shadow-[0_0_45px_rgba(34,211,238,0.15)]">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black uppercase tracking-wide text-cyan-100">
              Histórico de Pontos
            </DialogTitle>
          </DialogHeader>
          {loadingProfileHistory ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-sm text-slate-300">
              Carregando histórico...
            </div>
          ) : (
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setPointsHistoryTab("weekly")}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  pointsHistoryTab === "weekly"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Top semanal
              </button>
              <button
                type="button"
                onClick={() => setPointsHistoryTab("level")}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  pointsHistoryTab === "level"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Nível do perfil
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Total acumulado</p>
                <p className="mt-1 text-2xl font-black text-white">{pointsHistoryTotal.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fontes registradas</p>
                <p className="mt-1 text-2xl font-black text-white">{activePointsHistory.length}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {pointsHistoryTab === "weekly"
                  ? "Tudo o que já contou para o Top Semanal"
                  : "Tudo o que já fortaleceu o nível do seu perfil"}
              </p>
              <div className="hide-scrollbar mt-3 max-h-[48dvh] space-y-2 overflow-y-auto pr-1">
                {activePointsHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-5 text-center text-sm text-slate-400">
                    Ainda não existem pontos registrados nessa aba.
                  </div>
                ) : (
                  activePointsHistory.map((entry) => (
                    <div
                      key={`${pointsHistoryTab}-${entry.label}`}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">
                            {entry.total.toLocaleString("pt-BR")} pontos por {entry.label.toLowerCase()} até o momento
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {entry.entries} registro{entry.entries === 1 ? "" : "s"}
                            {entry.latestAt ? ` • Último em ${formatHistoryTimestamp(entry.latestAt)}` : ""}
                          </p>
                        </div>
                        <div className="rounded-xl bg-cyan-500/15 px-2 py-1 text-xs font-black text-cyan-200">
                          +{entry.total.toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileNotificationsOpen} onOpenChange={setIsProfileNotificationsOpen}>
        <DialogContent className="max-w-lg border-fuchsia-500/30 bg-slate-950 text-white shadow-[0_0_45px_rgba(217,70,239,0.14)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-fuchsia-100">
              <Bell className="h-5 w-5 text-fuchsia-300" />
              Central do perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Aqui aparecem novos seguidores, curtidas e outros avisos importantes do seu perfil.
            </p>

            {profileNotifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-5 text-center text-sm text-slate-400">
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              <div className="hide-scrollbar max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {profileNotifications.map((notification) => {
                  const actorAvatarSrc = getProfileAvatarSrc(notification, avatarSrcById, "") || "";
                  const actorAvatarFallback = getProfileAvatarFallback(notification, "U");
                  const actorLabel = notification.actor_nick
                    ? `@${notification.actor_nick}`
                    : notification.actor_name || "Usuário";
                  const isUnread = String(notification.status || "unread").toLowerCase() !== "read";
                  const actorUserId = String(notification.actor_user_id || "");
                  const canOpenActorProfile = Boolean(actorUserId);
                  return (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => {
                        if (!canOpenActorProfile) return;
                        setIsProfileNotificationsOpen(false);
                        openPublicProfilePage(actorUserId);
                      }}
                      className={`rounded-2xl border p-3 ${
                        isUnread
                          ? "border-fuchsia-400/35 bg-fuchsia-500/10"
                          : "border-slate-800 bg-slate-900/70"
                      } ${canOpenActorProfile ? "w-full text-left transition hover:border-cyan-400/40 hover:bg-slate-900/90" : "w-full text-left"}`}
                    >
                      <div className="flex items-start gap-3">
                        {actorAvatarSrc ? (
                          <img
                            src={actorAvatarSrc}
                            alt={notification.actor_name || "Usuário"}
                            className="h-11 w-11 rounded-full border border-slate-700 object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                              const fallbackNode = event.currentTarget.nextElementSibling;
                              if (fallbackNode instanceof HTMLElement) {
                                fallbackNode.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-base font-black text-white"
                          style={{ display: actorAvatarSrc ? "none" : "flex" }}
                          aria-hidden={actorAvatarSrc ? "true" : "false"}
                        >
                          <span>{actorAvatarFallback}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-white">{notification.title || "Notificação"}</p>
                            {isUnread ? (
                              <span className="inline-flex rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                Novo
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-200">{notification.message || "Você recebeu uma nova interação no perfil."}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                            <span className="truncate">{actorLabel}</span>
                            <span>
                              {notification.created_date ? formatHistoryTimestamp(notification.created_date) : "Agora"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckInCalendarOpen} onOpenChange={setIsCheckInCalendarOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg overflow-hidden border-emerald-500/30 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(2,6,23,0.96)_45%)] px-3 py-5 text-white shadow-[0_0_45px_rgba(16,185,129,0.18)] sm:px-5">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black uppercase tracking-[0.2em] text-emerald-100">
              Check-in diário
            </DialogTitle>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <div className="rounded-[1.4rem] border border-emerald-400/20 bg-slate-950/75 p-4 text-center shadow-[0_18px_50px_rgba(2,6,23,0.38)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                Boas-vindas do dia
              </p>
              <p className="mt-2 text-base font-black text-white sm:text-lg">
                {dailyCheckInState?.checkedIn ? "Coleta diária concluída" : "Colete seu ponto do dia"}
              </p>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                Cada coleta válida fortalece sua disputa no Top Semanal conforme a regra configurada no admin.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                  Progressão de 7 dias
                </p>
                <div
                  ref={checkInCarouselRef}
                  onPointerDown={handleCheckInCarouselPointerDown}
                  onPointerMove={handleCheckInCarouselPointerMove}
                  onPointerUp={handleCheckInCarouselPointerUpOrCancel}
                  onPointerCancel={handleCheckInCarouselPointerUpOrCancel}
                  onClickCapture={handleCheckInCarouselClickCapture}
                  onWheel={handleCheckInCarouselWheel}
                  className="hide-scrollbar mt-3 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] touch-pan-x"
                >
                  {checkInProgressDays.map((day, index) => {
                    const calendarDay = recentCheckInDays[index];
                    const isCollectable = day.state === "available" && !dailyCheckInMutation.isPending;
                    return (
                      <button
                        ref={(node) => {
                          if (node) {
                            checkInDayRefs.current[day.day] = node;
                          } else {
                            delete checkInDayRefs.current[day.day];
                          }
                        }}
                        key={`progress-${day.day}`}
                        type="button"
                        onClick={() => {
                          if (isCollectable) handleDailyCheckInCollect();
                        }}
                        disabled={!isCollectable}
                        className={`relative w-[142px] flex-none snap-center rounded-[1.25rem] border px-3 py-4 text-left sm:w-[158px] ${
                          day.state === "collected"
                            ? "border-emerald-300/40 bg-emerald-500/20"
                            : day.state === "available"
                              ? "border-cyan-300/70 bg-cyan-500/20 shadow-[0_0_26px_rgba(34,211,238,0.28)] ring-1 ring-cyan-300/35 animate-pulse"
                              : day.state === "next"
                                ? "border-amber-300/30 bg-amber-500/10"
                                : "border-slate-700 bg-slate-800/90 text-slate-400 grayscale"
                        }`}
                      >
                        {day.state === "available" ? (
                          <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_58%)]" />
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Dia {day.day}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                              {calendarDay?.weekday || day.label}
                            </p>
                          </div>
                          {day.state === "collected" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                          ) : null}
                        </div>
                        {calendarDay?.dayNumber ? (
                          <p className="mt-3 text-2xl font-black leading-none text-white">{calendarDay.dayNumber}</p>
                        ) : (
                          <div className="mt-3 h-7" />
                        )}
                        <p className="mt-3 text-base font-black text-white">+{day.weeklyPoints}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                          pontos semanais
                        </p>
                        <p className="mt-3 line-clamp-2 text-[11px] font-semibold text-slate-200">{day.label}</p>
                        <p className="mt-2 text-[11px] font-semibold text-slate-300">
                          {day.state === "collected"
                            ? "Coletado"
                            : day.state === "available"
                              ? "Toque para coletar"
                              : day.state === "next"
                                ? "Proximo da fila"
                                : "Perdido"}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Arraste para o lado para ver todos os 7 dias.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dias coletados</p>
                <p className="mt-1 text-2xl font-black text-white">{checkInCollectedDays}/7</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Estado de hoje</p>
                <p className="mt-1 text-sm font-black text-white">
                  {dailyCheckInState?.checkedIn
                    ? "Já coletado"
                    : dailyCheckInMutation.isPending
                    ? "Coletando..."
                    : "Disponível para coleta"}
                </p>
                {todayCheckInEntry?.checkedAt ? (
                  <p className="mt-1 text-[11px] text-emerald-100/80">
                    Registrado em {formatHistoryTimestamp(todayCheckInEntry.checkedAt)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                Toque no quadrado de hoje para coletar e confirmar sua presença.
              </p>
              <div className="flex items-center gap-2">
                {!dailyCheckInState?.checkedIn ? (
                  <Button
                    type="button"
                    onClick={handleDailyCheckInCollect}
                    disabled={dailyCheckInMutation.isPending}
                    className="rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {dailyCheckInMutation.isPending ? "Coletando..." : "Coletar agora"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => setIsCheckInCalendarOpen(false)}
                  className="rounded-2xl bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
                >
                  {dailyCheckInState?.checkedIn ? "Concluir" : "Fechar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhotoMenuOpen} onOpenChange={setIsPhotoMenuOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-bold text-white">Foto de perfil</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              onClick={() => {
                setIsPhotoMenuOpen(false);
                setIsPhotoViewerOpen(true);
              }}
              className="gap-2 bg-slate-800 text-white hover:bg-slate-700"
            >
              <Eye className="h-4 w-4" />
              Ver foto
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsPhotoMenuOpen(false);
                openQuickEditModal();
              }}
              className="gap-2 bg-cyan-700 text-white hover:bg-cyan-600"
            >
              <Pencil className="h-4 w-4" />
              Editar foto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={Boolean(activeBadgeCelebration)} onOpenChange={(open) => !open && setActiveBadgeCelebration(null)}>
        <DialogContent
          hideOverlay
          hideClose
          className="w-screen max-w-none border-0 bg-transparent p-0 text-white shadow-none outline-none ring-0"
        >
          <div className="mx-auto flex w-[min(92vw,420px)] flex-col items-center justify-center px-3 py-2 text-center">
            <DialogHeader>
              <DialogTitle className="text-center text-base font-black uppercase tracking-wide text-amber-100 drop-shadow-[0_0_14px_rgba(251,191,36,0.55)] sm:text-lg">
                PARABÉNS! VOCÊ CONQUISTOU
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-center text-sm font-black uppercase tracking-wide text-cyan-100 sm:text-base">
              {activeBadgeCelebration?.label || "NOVO SELO"}
            </p>
            <div className="relative mt-2 flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
              <BadgeCelebrationMedia achievement={activeBadgeCelebration} />
            </div>
            <p className="mt-2 rounded-xl border border-cyan-300/30 bg-slate-950/75 px-3 py-2 text-[11px] text-cyan-100">
              {getBadgeCelebrationText(activeBadgeCelebration)}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompetitionHelpOpen} onOpenChange={setIsCompetitionHelpOpen}>
        <DialogContent className="border-amber-400/45 bg-slate-950 text-white shadow-[0_0_35px_rgba(251,191,36,0.22)]">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black uppercase tracking-wide text-amber-200">
              Como ganhar pontos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Regras do ciclo</p>
              <p className="mt-1 text-xs text-slate-200">{competitionBoard.rewardLabel}</p>
            </div>
            <div className="space-y-1.5">
              {competitionInstructions.length === 0 ? (
                <p className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-300">
                  Sem instrucoes cadastradas.
                </p>
              ) : (
                competitionInstructions.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-200">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEngagementGuideOpen} onOpenChange={setIsEngagementGuideOpen}>
        <DialogContent className="border-cyan-400/45 bg-slate-950 text-white shadow-[0_0_35px_rgba(34,211,238,0.2)]">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black uppercase tracking-wide text-cyan-200">
              {engagementGuideConfig.modal_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                {engagementGuideConfig.modal_subtitle}
              </p>
              <p className="mt-1 text-xs text-slate-200">{engagementGuideConfig.highlight_text}</p>
            </div>
            <div className="space-y-1.5">
              {engagementGuideInstructions.length === 0 ? (
                <p className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-300">
                  Sem instrucoes cadastradas.
                </p>
              ) : (
                engagementGuideInstructions.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-200">
                    {line}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-1.5">
              {engagementGuideConfig.rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-cyan-900/60 bg-slate-900/80 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{rule.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedBadgeInfo)} onOpenChange={(open) => !open && closeBadgeViewer()}>
        <DialogContent
          hideClose
          className={`h-[100dvh] w-screen max-w-none border-0 p-0 text-white shadow-none ${
            useLiteBadgeViewer ? "bg-white/8 backdrop-blur-[1px]" : "bg-white/10 backdrop-blur-[2px]"
          }`}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedBadgeInfo?.label || "Selo"}</DialogTitle>
          </DialogHeader>
          {renderBadgeViewerContent()}
        </DialogContent>
      </Dialog>

      <Dialog open={isPhotoViewerOpen} onOpenChange={setIsPhotoViewerOpen}>
        <DialogContent className="rounded-3xl border border-slate-700/90 bg-slate-950/95 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-bold text-white">Sua foto de perfil</DialogTitle>
          </DialogHeader>
          <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_14px_40px_rgba(2,6,23,0.55)]">
            <div className="overflow-hidden rounded-[1.15rem] border border-slate-700/80 bg-slate-900">
              {safeProfileImageSrc ? (
                <img
                  src={safeProfileImageSrc}
                  alt="Foto de perfil"
                  className="max-h-[70vh] w-full object-contain"
                  onError={() => setProfileImageFallbackStep((step) => Math.min(step + 1, 2))}
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-slate-300">Sem imagem</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSocialListOpen} onOpenChange={setIsSocialListOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-bold text-white">
              {socialListType === "following" ? "Pessoas que você segue" : "Seguidores"}
            </DialogTitle>
          </DialogHeader>
          <div className="hide-scrollbar max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {isLoadingSocialList ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-center text-sm text-slate-300">
                Carregando lista...
              </div>
            ) : socialListProfiles.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-center text-sm text-slate-300">
                {socialListType === "following"
                  ? "Você ainda não segue ninguém."
                  : "Ainda não há seguidores para mostrar."}
              </div>
            ) : (
              socialListProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-cyan-500/40">
                    {profile.avatarSrc ? (
                      <img src={profile.avatarSrc} alt={profile.nick} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-white">AV</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{profile.nick}</p>
                    <button
                      type="button"
                      onClick={() => openPublicProfileByUserId(profile.id)}
                      className="truncate text-xs text-cyan-300 transition hover:text-cyan-200"
                    >
                      @{profile.handle}
                    </button>
                  </div>
                  {String(profile.id || "") !== String(user?.id || "") ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(followPendingById[profile.id])}
                      onClick={() => toggleSocialListFollow(profile)}
                      className={
                        profile.isFollowing
                          ? "min-w-[104px] rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                          : "min-w-[104px] rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      }
                    >
                      {profile.isFollowing ? "Seguindo" : "Seguir"}
                    </Button>
                  ) : (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-400">Você</span>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-bold text-white">Editar perfil rápido</DialogTitle>
          </DialogHeader>
          <div className="hide-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <Label className="mb-2 block text-slate-300">Foto de perfil</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditData((prev) => ({ ...prev, imageMode: "avatar" }))}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    editData.imageMode === "avatar"
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Usar avatar
                </button>
                <button
                  type="button"
                  onClick={() => setEditData((prev) => ({ ...prev, imageMode: "photo" }))}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    editData.imageMode === "photo"
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Usar foto
                </button>
              </div>

              {editData.imageMode === "photo" ? (
                <div className="mt-2 space-y-2">
                  {approvedPhotoOptions.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/80 p-2">
                      <p className="text-[11px] font-semibold text-slate-300">Fotos aprovadas</p>
                      <div className="grid grid-cols-3 gap-2">
                        {approvedPhotoOptions.map((photoUrl) => {
                          const isSelected = profilePrefs.selectedPhotoUrl === photoUrl;
                          return (
                            <button
                              key={photoUrl}
                              type="button"
                              onClick={() => {
                                setSelectedEditPhotoFile(null);
                                setSelectedEditPhotoPreview((prev) => {
                                  if (prev) URL.revokeObjectURL(prev);
                                  return "";
                                });
                                setSelectedEditPhotoZoom(1);
                                setSelectedEditPhotoOffsetY(0);
                                setEditData((prev) => ({ ...prev, imageMode: "photo" }));
                                setProfilePrefs((prev) => {
                                  const next = { ...prev, selectedPhotoUrl: photoUrl };
                                  if (user?.id) saveProfilePrefs(user.id, next);
                                  return next;
                                });
                              }}
                              className={`relative mx-auto h-16 w-16 overflow-visible rounded-full border-2 transition ${
                                isSelected
                                  ? "border-cyan-400 ring-2 ring-cyan-400/30"
                                  : "border-slate-700 hover:border-cyan-500/60"
                              }`}
                            >
                              <img
                                src={resolveAssetUrl(photoUrl)}
                                alt="Foto aprovada"
                                className="h-full w-full rounded-full object-cover"
                              />
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleRemoveApprovedPhoto(photoUrl);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleRemoveApprovedPhoto(photoUrl);
                                  }
                                }}
                                className="absolute -right-2 -top-2 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600/95 text-[9px] font-bold text-white shadow-md"
                              >
                                x
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-700/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/30">
                    {uploadImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageUp className="h-4 w-4" />
                    )}
                    Selecionar foto
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadImageMutation.isPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const normalizedType = String(file.type || "").toLowerCase();
                        const isSupportedType =
                          (normalizedType && SUPPORTED_IMAGE_MIME_TYPES.has(normalizedType)) ||
                          SUPPORTED_IMAGE_EXTENSIONS.test(String(file.name || ""));
                        if (!isSupportedType) {
                          toast({
                            variant: "destructive",
                            title: "Formato não suportado",
                            description: "Use uma imagem JPG, PNG, WEBP ou GIF.",
                          });
                          event.target.value = "";
                          return;
                        }
                        const nextPreview = URL.createObjectURL(file);
                        setSelectedEditPhotoFile(file);
                        setSelectedEditPhotoZoom(1);
                        setSelectedEditPhotoOffsetY(0);
                        setSelectedEditPhotoPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return nextPreview;
                        });
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {selectedEditPhotoPreview ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-cyan-600/40 bg-slate-900 p-3">
                      <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-cyan-400/60 bg-slate-800">
                        <img
                          src={selectedEditPhotoPreview}
                          alt="Prévia da nova foto"
                          className="h-full w-full object-cover"
                          style={getProfileCropPreviewStyle(selectedEditPhotoZoom, selectedEditPhotoOffsetY)}
                        />
                      </div>
                      <p className="text-[11px] text-cyan-200">Prévia final do perfil</p>
                    </div>
                  ) : null}

                  {selectedEditPhotoPreview ? (
                    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/80 p-2">
                      <div>
                        <Label className="mb-1 block text-[11px] text-slate-300">Zoom</Label>
                        <input
                          type="range"
                          min="1"
                          max="2.8"
                          step="0.01"
                          value={selectedEditPhotoZoom}
                          onChange={(event) => setSelectedEditPhotoZoom(Number(event.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-[11px] text-slate-300">Posição vertical</Label>
                        <input
                          type="range"
                          min="-140"
                          max="140"
                          step="1"
                          value={selectedEditPhotoOffsetY}
                          onChange={(event) => setSelectedEditPhotoOffsetY(Number(event.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    disabled={!selectedEditPhotoFile || uploadImageMutation.isPending || isPreparingEditPhoto}
                    onClick={async () => {
                      if (!selectedEditPhotoFile) return;
                      try {
                        setIsPreparingEditPhoto(true);
                        const cropped = await generateCroppedProfileImage(selectedEditPhotoFile, {
                          zoom: selectedEditPhotoZoom,
                          offsetY: selectedEditPhotoOffsetY,
                        });
                        uploadImageMutation.mutate(cropped);
                      } catch (error) {
                        toast({
                          variant: "destructive",
                          title: "Falha na preparação",
                          description: error?.message || "Falha ao preparar a foto.",
                        });
                      } finally {
                        setIsPreparingEditPhoto(false);
                      }
                    }}
                    className="h-8 gap-1 bg-cyan-700 px-2 text-[11px] font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
                  >
                    {uploadImageMutation.isPending || isPreparingEditPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                    {uploadImageMutation.isPending ? "Enviando foto..." : isPreparingEditPhoto ? "Preparando foto..." : "Enviar foto selecionada"}
                  </Button>

                  {selectedEditPhotoPreview ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedEditPhotoFile(null);
                        setSelectedEditPhotoPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return "";
                        });
                        setSelectedEditPhotoZoom(1);
                        setSelectedEditPhotoOffsetY(0);
                      }}
                      className="h-8 border-slate-700 px-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Excluir foto selecionada
                    </Button>
                  ) : null}

                  {(user.profile_image_status === "manual_review" || user.profile_image_status === "pending") && (
                    <button
                      type="button"
                      onClick={() => cancelPendingImageMutation.mutate()}
                      disabled={cancelPendingImageMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-700/90 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                      {cancelPendingImageMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Cancelar envio
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <div>
              <Label className="mb-2 block text-slate-300">Avatar</Label>
              <div className="hide-scrollbar touch-pan-y grid max-h-44 grid-cols-5 gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                {avatarOptions.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setEditData((prev) => ({ ...prev, avatarId: avatar.id, imageMode: "avatar" }))}
                    style={getAvatarMotionVars(avatar.id)}
                    className={`relative overflow-hidden rounded-full border-2 transition ${
                      editData.avatarId === avatar.id
                        ? "border-cyan-400 ring-2 ring-cyan-400/40"
                        : avatar.isFeatured
                        ? "border-amber-500/80"
                        : "border-slate-700"
                    }`}
                  >
                    {avatar.isFeatured ? (
                      <span className="absolute left-0.5 top-0.5 z-10 inline-flex items-center rounded-full bg-amber-500 p-0.5 text-slate-950">
                        <Star className="h-2.5 w-2.5 fill-slate-950" />
                      </span>
                    ) : null}
                    <img src={avatar.src} alt={avatar.id} className="avatar-elastic-float h-12 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

              <div>
                <Label className="mb-1 block text-slate-300">Nick público</Label>
                <Input
                  value={editData.nick}
                  onChange={(e) => setEditData((prev) => ({ ...prev, nick: e.target.value }))}
                  placeholder="Seu nome público"
                  className="border-slate-700 bg-slate-900 text-white"
                />
                {availabilityState.nick.message ? (
                  <p
                    className={`mt-1 text-xs ${
                      availabilityState.nick.checking
                        ? "text-slate-400"
                        : availabilityState.nick.available
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {availabilityState.nick.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label className="mb-1 block text-slate-300">@ usuário</Label>
                <Input
                value={editData.handle}
                onChange={(e) => setEditData((prev) => ({ ...prev, handle: e.target.value }))}
                  placeholder="seuusuario"
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>

              <div>
                <Label className="mb-1 block text-slate-300">Telefone</Label>
                <Input
                  value={editData.phone}
                  onChange={(e) => setEditData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="border-slate-700 bg-slate-900 text-white"
                />
                {availabilityState.phone.message ? (
                  <p
                    className={`mt-1 text-xs ${
                      availabilityState.phone.checking
                        ? "text-slate-400"
                        : availabilityState.phone.available
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {availabilityState.phone.message}
                  </p>
                ) : null}
              </div>

            <Button
              onClick={saveQuickEdit}
              disabled={availabilityState.nick.checking || availabilityState.phone.checking}
              className="w-full bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-60"
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LegalLinksBar />
      {profileSwitchLoaderOverlay}
    </motion.div>
  );
}








