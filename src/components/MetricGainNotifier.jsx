import React from "react";
import confetti from "canvas-confetti";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isInteractionSoundEnabled } from "@/lib/soundPrefs";
import { toast } from "@/components/ui/use-toast";
import commonRewardCollectSound from "../../assets-para-app/Songs/Song Coleta coisa comum no final da partida ou de baus no lobby.mp3";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatMetricLabel(metricKey, amount) {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (metricKey === "xp_total") return `+${formatNumber(safeAmount)} XP`;
  if (metricKey === "weekly_points") return `+${formatNumber(safeAmount)} pontos semanais`;
  if (metricKey === "engagement_points") return `+${formatNumber(safeAmount)} pontos de engajamento`;
  return `+${formatNumber(safeAmount)}`;
}

function mapSourceLabel(entry) {
  const source = String(entry?.source_type || "").toLowerCase();
  const ref = String(entry?.source_ref || "").toLowerCase();

  if (source.includes("daily_checkin") || ref.includes("daily_checkin")) return "check-in diario";
  if (source.includes("follow") || ref.includes("follow")) return "seguir um perfil";
  if (source.includes("like") || ref.includes("like")) return "curtir um perfil";
  if (source.includes("daily_chest") || ref.includes("daily_chest")) return "Bau Diario";
  if (source.includes("approved_deposit") || ref.includes("approved_deposit")) return "deposito aprovado";
  if (source.includes("live_participation") || ref.includes("live_participation")) return "participacao no Sorteio Live";
  if (source.includes("game_call") || ref.includes("game_call")) return "participacao no Call Jogo";
  if (source.includes("instant_raffle") || ref.includes("instant_raffle")) return "participacao no Sorteio Rapido";
  if (source.includes("validated_win") || ref.includes("validated_win")) return "premio confirmado";
  if (source.includes("admin")) return "ajuste administrativo";
  return "sua atividade no app";
}

function uniqueNonEmpty(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function buildPopupHeadline(groupCount) {
  if (groupCount <= 1) return "Ganhos liberados agora";
  return `Ganhos liberados em ${groupCount} acoes`;
}

function resolveEntryTitle(entry) {
  const metadata = entry?.metadata || {};
  return (
    String(
      metadata.reward_title ||
        metadata.title ||
        metadata.reward_label ||
        metadata.rule_name ||
        metadata.label ||
        ""
    ).trim() || mapSourceLabel(entry)
  );
}

function buildGroupedRewards(entries = [], fallbackDeltas = {}) {
  const positiveEntries = entries.filter((entry) => Number(entry?.amount || 0) > 0);
  if (!positiveEntries.length) {
    const fallbackMetrics = [
      ["xp_total", fallbackDeltas.xp_total],
      ["weekly_points", fallbackDeltas.weekly_points],
      ["engagement_points", fallbackDeltas.engagement_points],
    ]
      .map(([metricKey, amount]) => ({
        metricKey,
        amount: Math.max(0, Number(amount || 0)),
      }))
      .filter((item) => item.amount > 0);

    if (!fallbackMetrics.length) return [];
    return [
      {
        id: "fallback",
        title: "Atualizacao recente",
        subtitle: "Ganhos detectados sem detalhamento individual no ledger.",
        metrics: fallbackMetrics,
      },
    ];
  }

  const groups = new Map();
  positiveEntries
    .slice()
    .reverse()
    .forEach((entry) => {
      const metadata = entry?.metadata || {};
      const groupKey = [
        String(entry?.source_type || "").trim(),
        String(entry?.source_ref || "").trim(),
        String(metadata.reward_title || metadata.title || metadata.reward_label || metadata.rule_name || "").trim(),
      ].join("::");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: entry?.id || groupKey,
          title: resolveEntryTitle(entry),
          subtitle: mapSourceLabel(entry),
          metricsMap: new Map(),
        });
      }

      const group = groups.get(groupKey);
      const metricKey = String(entry?.metric_key || "").trim();
      group.metricsMap.set(metricKey, Number(group.metricsMap.get(metricKey) || 0) + Math.max(0, Number(entry?.amount || 0)));
    });

  return Array.from(groups.values()).map((group) => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    metrics: Array.from(group.metricsMap.entries()).map(([metricKey, amount]) => ({ metricKey, amount })),
  }));
}

function isExactLedgerEvent(entry) {
  if (!entry?.id) return false;
  if (Number(entry?.amount || 0) <= 0) return false;
  return Boolean(entry?.metadata?.exact_event);
}

function buildEventKey(entry) {
  const sourceType = String(entry?.source_type || "").trim();
  const sourceRef =
    String(entry?.metadata?.source_ref_id || "").trim() ||
    String(entry?.source_ref || "").trim() ||
    String(entry?.id || "").trim();
  return `${sourceType}::${sourceRef}`;
}

function buildSeenEntryKey(entry) {
  return [
    String(entry?.metric_key || "").trim(),
    buildEventKey(entry),
    String(entry?.occurred_at || "").trim(),
    String(Number(entry?.amount || 0)),
  ].join("::");
}

function pickLatestEventEntries(entries = []) {
  const exactEntries = entries.filter(isExactLedgerEvent);
  if (!exactEntries.length) return [];

  const sorted = exactEntries
    .slice()
    .sort((a, b) => String(b?.occurred_at || "").localeCompare(String(a?.occurred_at || "")));

  const latest = sorted[0];
  const latestKey = buildEventKey(latest);
  return sorted.filter((entry) => buildEventKey(entry) === latestKey);
}

function fireCelebration() {
  confetti({
    particleCount: 36,
    spread: 72,
    startVelocity: 28,
    origin: { x: 0.22, y: 0.08 },
    scalar: 0.95,
    zIndex: 120,
    colors: ["#67e8f9", "#22d3ee", "#38bdf8", "#a78bfa", "#fde68a"],
  });
  confetti({
    particleCount: 30,
    spread: 66,
    startVelocity: 24,
    origin: { x: 0.78, y: 0.08 },
    scalar: 0.9,
    zIndex: 120,
    colors: ["#67e8f9", "#2dd4bf", "#818cf8", "#facc15", "#ffffff"],
  });
}

function GainToastContent({ groups }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-violet-400 text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.35)]">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-white">Parabens!</p>
          </div>
          <p className="text-sm font-semibold text-white">{buildPopupHeadline(groups.length)}</p>
          <p className="text-xs text-cyan-100/85">Resumo detalhado dos ganhos detectados agora.</p>
        </div>
        <div className="space-y-1.5">
          {groups.map((group) => (
            <div key={group.id} className="text-xs leading-relaxed text-slate-100">
              <p className="font-semibold text-white">
                {group.title}
                <span className="font-normal text-cyan-200/90"> • {group.subtitle}</span>
              </p>
              <p className="text-cyan-50/95">
                {group.metrics.map((item) => formatMetricLabel(item.metricKey, item.amount)).join(" • ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MetricGainNotifier() {
  const { user, isAuthenticated } = useAuth();
  const initializedRef = React.useRef(false);
  const lastTotalsRef = React.useRef({ xp_total: 0, weekly_points: 0, engagement_points: 0 });
  const seenLedgerKeysRef = React.useRef(new Set());
  const audioRef = React.useRef(null);
  const activeToastRef = React.useRef(null);

const { data: profileMetrics } = useQuery({
  queryKey: ["profile-gamification-authoritative", user?.id],
  queryFn: () => base44.gamification.profileMetrics(),
  enabled: Boolean(isAuthenticated && user?.id),
  staleTime: 0,
  refetchInterval: 5000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
});

const { data: profileHistory } = useQuery({
  queryKey: ["profile-history-authoritative", user?.id],
  queryFn: () => base44.gamification.profileHistory(),
  enabled: Boolean(isAuthenticated && user?.id),
  staleTime: 0,
  refetchInterval: 5000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
});

  React.useEffect(() => {
    const audio = new Audio(commonRewardCollectSound);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!user?.id) {
      initializedRef.current = false;
      lastTotalsRef.current = { xp_total: 0, weekly_points: 0, engagement_points: 0 };
      seenLedgerKeysRef.current = new Set();
      return;
    }

    const metrics = profileMetrics?.metrics || {};
    const currentXp = Math.max(0, Number(metrics.xpTotal || 0));
    const currentWeekly = Math.max(0, Number(metrics.weeklyPoints || 0));
    const currentEngagement = Math.max(0, Number(metrics.engagementPoints || metrics.points || 0));
    const ledger = Array.isArray(profileHistory?.ledger) ? profileHistory.ledger : [];

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastTotalsRef.current = { xp_total: currentXp, weekly_points: currentWeekly, engagement_points: currentEngagement };
      seenLedgerKeysRef.current = new Set(ledger.filter(isExactLedgerEvent).map(buildSeenEntryKey));
      return;
    }

    const recentEntries = ledger.filter((entry) => {
      if (!isExactLedgerEvent(entry)) return false;
      if (seenLedgerKeysRef.current.has(buildSeenEntryKey(entry))) return false;
      return isExactLedgerEvent(entry);
    });

    ledger.forEach((entry) => {
      if (isExactLedgerEvent(entry)) {
        seenLedgerKeysRef.current.add(buildSeenEntryKey(entry));
      }
    });

    lastTotalsRef.current = { xp_total: currentXp, weekly_points: currentWeekly, engagement_points: currentEngagement };

    const latestEventEntries = pickLatestEventEntries(recentEntries);
    const groupedRewards = buildGroupedRewards(latestEventEntries);

    if (!groupedRewards.length) return;

    if (isInteractionSoundEnabled()) {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = 0;
          audio.volume = 0.9;
          audio.play().catch(() => {});
        } catch {
          // noop
        }
      }
    }

    fireCelebration();
    activeToastRef.current?.dismiss?.();
    activeToastRef.current = toast({
      duration: 8000,
      className:
        "border-cyan-300/20 bg-[linear-gradient(180deg,rgba(14,24,40,0.96)_0%,rgba(8,14,28,0.98)_100%)] text-white shadow-[0_22px_60px_rgba(6,182,212,0.18)] backdrop-blur-xl",
      title: <GainToastContent groups={groupedRewards} />,
    });
  }, [profileHistory, profileMetrics, user?.id]);

  return null;
}
