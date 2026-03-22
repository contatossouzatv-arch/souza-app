export const BADGE_METRIC_OPTIONS = [
  { value: "totalParticipations", label: "Participacoes totais (>=)" },
  { value: "totalApproved", label: "Valor depositado aprovado (>=)" },
  { value: "totalWins", label: "Premios ganhos (>=)" },
  { value: "liveParticipations", label: "Participacoes em live (>=)" },
  { value: "totalFollowers", label: "Seguidores no perfil (>=)" },
  { value: "points", label: "Pontos (>=)" },
  { value: "totalTickets", label: "Bilhetes no ciclo (>=)" },
  { value: "positionTop", label: "Top posicao (<=)" },
];

export const BADGE_ICON_OPTIONS = [
  { value: "star", label: "Estrela" },
  { value: "wallet", label: "Carteira" },
  { value: "trophy", label: "Trofeu" },
  { value: "award", label: "Conquista" },
  { value: "user_plus", label: "Usuario+" },
  { value: "heart", label: "Coracao" },
];

export const BADGE_COLOR_OPTIONS = [
  { value: "cyan", label: "Ciano", className: "text-cyan-300" },
  { value: "emerald", label: "Verde", className: "text-emerald-300" },
  { value: "yellow", label: "Amarelo", className: "text-yellow-300" },
  { value: "pink", label: "Rosa", className: "text-pink-300" },
  { value: "fuchsia", label: "Fuchsia", className: "text-fuchsia-300" },
  { value: "indigo", label: "Indigo", className: "text-indigo-300" },
];

export const DEFAULT_POINTS_RULES = {
  points_per_participation: 12,
  points_per_approved_deposit: 8,
  amount_step_value: 10,
  points_per_amount_step: 1,
  points_per_win: 50,
  progress_target_participations: 25,
  live_badge_target: 30,
};

export const DEFAULT_BADGE_RULES = [
  {
    id: "starter-install",
    enabled: true,
    label: "Iniciante da Comunidade",
    metric: "totalParticipations",
    threshold: 0,
    icon: "star",
    color: "emerald",
    icon_url: "",
    description: "Você já ganhou este selo por entrar na comunidade. Complete os próximos desafios para evoluir.",
  },
  {
    id: "first-step",
    enabled: true,
    label: "Entrou nas dinamicas",
    metric: "totalParticipations",
    threshold: 1,
    icon: "star",
    color: "cyan",
    icon_url: "",
    description: "",
  },
  {
    id: "deposit-300",
    enabled: true,
    label: "Top depositante 300+",
    metric: "totalApproved",
    threshold: 300,
    icon: "wallet",
    color: "emerald",
    icon_url: "",
    description: "",
  },
  {
    id: "premium-depositor",
    enabled: true,
    label: "Depositante Premium",
    metric: "totalApproved",
    threshold: 1000,
    icon: "wallet",
    color: "yellow",
    icon_url: "",
    description: "",
  },
  {
    id: "top10",
    enabled: true,
    label: "Top 10 depositantes",
    metric: "positionTop",
    threshold: 10,
    icon: "trophy",
    color: "yellow",
    icon_url: "",
    description: "",
  },
  {
    id: "winner",
    enabled: true,
    label: "Ja ganhou premio no app",
    metric: "totalWins",
    threshold: 1,
    icon: "award",
    color: "pink",
    icon_url: "",
    description: "",
  },
  {
    id: "winner10",
    enabled: true,
    label: "Ja ganhou 10 premios com o Souza",
    metric: "totalWins",
    threshold: 10,
    icon: "award",
    color: "fuchsia",
    icon_url: "",
    description: "",
  },
  {
    id: "tickets-500",
    enabled: true,
    label: "Acumulou 500 bilhetes nos depositos",
    metric: "totalTickets",
    threshold: 500,
    icon: "trophy",
    color: "indigo",
    icon_url: "",
    description: "Acumule 500 bilhetes nos depositos para desbloquear este selo especial.",
  },
  {
    id: "checkin-30",
    enabled: true,
    label: "Fez check in 30 dias no app",
    metric: "totalCheckins",
    threshold: 30,
    icon: "award",
    color: "cyan",
    icon_url: "",
    description: "Faça check-in por 30 dias no app para desbloquear este selo.",
  },
  {
    id: "followers-50",
    enabled: true,
    label: "Atingiu 50 seguidores no perfil",
    metric: "totalFollowers",
    threshold: 50,
    icon: "heart",
    color: "pink",
    icon_url: "",
    description: "Atinga 50 seguidores no seu perfil para desbloquear este selo.",
  },
  {
    id: "live-10",
    enabled: true,
    label: "Participou de 10 lives",
    metric: "liveParticipations",
    threshold: 10,
    icon: "star",
    color: "cyan",
    icon_url: "",
    description: "",
  },
  {
    id: "super-fan-live",
    enabled: true,
    label: "Selo Super Fa de Lives",
    metric: "liveParticipations",
    threshold: 30,
    icon: "star",
    color: "indigo",
    icon_url: "",
    description: "",
  },
];

function clampNonNegativeInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

export function parseJsonSetting(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function normalizePointsRules(raw = {}) {
  return {
    points_per_participation: clampNonNegativeInt(raw.points_per_participation, DEFAULT_POINTS_RULES.points_per_participation),
    points_per_approved_deposit: clampNonNegativeInt(raw.points_per_approved_deposit, DEFAULT_POINTS_RULES.points_per_approved_deposit),
    amount_step_value: Math.max(1, clampNonNegativeInt(raw.amount_step_value, DEFAULT_POINTS_RULES.amount_step_value)),
    points_per_amount_step: clampNonNegativeInt(raw.points_per_amount_step, DEFAULT_POINTS_RULES.points_per_amount_step),
    points_per_win: clampNonNegativeInt(raw.points_per_win, DEFAULT_POINTS_RULES.points_per_win),
    progress_target_participations: Math.max(1, clampNonNegativeInt(raw.progress_target_participations, DEFAULT_POINTS_RULES.progress_target_participations)),
    live_badge_target: Math.max(1, clampNonNegativeInt(raw.live_badge_target, DEFAULT_POINTS_RULES.live_badge_target)),
  };
}

export function normalizeBadgeRules(rawList = []) {
  if (!Array.isArray(rawList) || rawList.length === 0) return DEFAULT_BADGE_RULES;

  const normalized = rawList
    .map((rule, index) => {
      const metric = BADGE_METRIC_OPTIONS.some((item) => item.value === rule?.metric) ? rule.metric : "totalParticipations";
      const icon = BADGE_ICON_OPTIONS.some((item) => item.value === rule?.icon) ? rule.icon : "star";
      const color = BADGE_COLOR_OPTIONS.some((item) => item.value === rule?.color) ? rule.color : "cyan";
      return {
        id: String(rule?.id || `rule-${index + 1}`),
        enabled: Boolean(rule?.enabled),
        label: String(rule?.label || "Novo selo"),
        metric,
        threshold: clampNonNegativeInt(rule?.threshold, 1),
        icon,
        color,
        icon_url: String(rule?.icon_url || "").trim(),
        description: String(rule?.description || "").trim(),
      };
    })
    .filter((rule) => rule.label.trim().length > 0);

  const requiredDefaults = ["starter-install", "live-10", "tickets-500", "followers-50", "checkin-30"];
  requiredDefaults.forEach((ruleId) => {
    const exists = normalized.some((rule) => rule.id === ruleId);
    if (exists) return;
    const defaultRule = DEFAULT_BADGE_RULES.find((rule) => rule.id === ruleId);
    if (!defaultRule) return;
    if (ruleId === "starter-install") normalized.unshift({ ...defaultRule });
    else normalized.push({ ...defaultRule });
  });

  return normalized;
}

export function computePointsFromRules(metrics, rules) {
  const safeRules = normalizePointsRules(rules);
  const totalApproved = Number(metrics.totalApproved || 0);
  const depositCount = Number(metrics.depositCount || 0);
  const totalParticipations = Number(metrics.totalParticipations || 0);
  const totalWins = Number(metrics.totalWins || 0);
  const amountSteps = Math.floor(totalApproved / safeRules.amount_step_value);

  return (
    totalParticipations * safeRules.points_per_participation +
    depositCount * safeRules.points_per_approved_deposit +
    amountSteps * safeRules.points_per_amount_step +
    totalWins * safeRules.points_per_win
  );
}

export function evaluateBadgeRules(metrics, rules) {
  const normalized = normalizeBadgeRules(rules);
  return normalized.filter((rule) => {
    if (!rule.enabled) return false;
    if (rule.metric === "positionTop") {
      const position = Number(metrics.position || 0);
      return position > 0 && position <= Number(rule.threshold || 0);
    }
    const metricValue = Number(metrics[rule.metric] || 0);
    return metricValue >= Number(rule.threshold || 0);
  });
}

export function buildProgressBadge(metrics, pointsRules) {
  const safeRules = normalizePointsRules(pointsRules);
  const liveCurrent = Math.max(0, Number(metrics.liveParticipations || 0));
  const liveTarget = safeRules.live_badge_target;
  const liveLevel = Math.floor(liveCurrent / liveTarget);
  const currentInLevel = liveCurrent % liveTarget;
  const nextLevel = liveLevel + 1;
  const remainingToNext = liveTarget - currentInLevel;
  const liveProgress = Math.min(100, Math.round((currentInLevel / liveTarget) * 100));

  return {
    key: "super-fan-live",
    title: "Super Fa das Lives do SouzaTV",
    subtitle: `Nivel ${liveLevel} - Faltam ${remainingToNext} participacoes para o Nivel ${nextLevel}`,
    current: currentInLevel,
    target: liveTarget,
    progress: liveProgress,
    level: liveLevel,
    nextLevel,
    completed: false,
  };
}
