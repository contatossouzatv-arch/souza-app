import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

const EVENT_OPTIONS = [
  { value: "daily_checkin", label: "Check-in diário", description: "Usado quando a pessoa coleta a presença do dia no perfil." },
  { value: "approved_deposit_count", label: "Depósito aprovado", description: "Pontua uma vez quando um depósito é aprovado." },
  { value: "approved_deposit_amount_step", label: "Depósito por faixa de valor", description: "Pontua em passos, por exemplo a cada R$ 20 aprovados." },
  { value: "participation", label: "Participação válida", description: "Aplica para participações válidas nas dinâmicas do app." },
  { value: "live_participation", label: "Participação em live", description: "Pontua apenas entrada válida em live." },
  { value: "game_call_participation", label: "Participação na call do jogo", description: "Pontua apenas a call do jogo." },
  { value: "instant_raffle_participation", label: "Participação no sorteio rápido", description: "Pontua apenas o sorteio rápido." },
  { value: "validated_win", label: "Vitória confirmada", description: "Usado quando um prêmio é validado como ganho real." },
  { value: "daily_chest_open", label: "Baú Diário aberto", description: "Pontua cada abertura válida do Baú Diário." },
  { value: "follow_profile", label: "Seguir novo perfil", description: "Pontua a primeira vez que a pessoa segue um perfil válido." },
  { value: "like_profile", label: "Curtir perfil", description: "Pontua a primeira curtida válida em perfil." },
  { value: "manual", label: "Ajuste manual", description: "Use quando quiser uma regra que exista só para operações internas." },
];

const METRIC_OPTIONS = [
  { value: "xp_total", label: "XP", description: "Ajuda a subir o nível do perfil.", colorClass: "border-violet-500/30 bg-violet-500/10 text-violet-100" },
  { value: "weekly_points", label: "Pontos semanais", description: "Entram no ranking do Top Semanal.", colorClass: "border-amber-500/30 bg-amber-500/10 text-amber-100" },
  { value: "engagement_points", label: "Pontos de engajamento", description: "Fortalecem o progresso do perfil e telas de engajamento.", colorClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100" },
  { value: "tickets_active", label: "Bilhetes ativos", description: "Bilhetes normais liberados para o usuário.", colorClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" },
  { value: "tickets_bonus", label: "Bilhetes bônus", description: "Bilhetes extras fora da entrega padrão.", colorClass: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100" },
  { value: "points_balance", label: "Saldo / banca", description: "Crédito operacional em banca ou saldo do app.", colorClass: "border-lime-500/30 bg-lime-500/10 text-lime-100" },
];

const LIMIT_SCOPE_OPTIONS = [
  { value: "none", label: "Sem limite", description: "A regra vale sempre que o evento acontecer." },
  { value: "event", label: "Uma vez por evento", description: "Evita contar o mesmo evento duas vezes." },
  { value: "daily", label: "Limite diário", description: "Controla quantas vezes pode pontuar por dia." },
  { value: "weekly", label: "Limite semanal", description: "Controla a pontuação por semana." },
  { value: "cycle", label: "Uma vez por ciclo", description: "Usa o ciclo semanal ativo como trava." },
];

const WEEKLY_REWARD_OPTIONS = [
  { value: "cash_prize", label: "Pix" },
  { value: "points_balance", label: "Banca / saldo" },
  { value: "xp_total", label: "XP" },
  { value: "weekly_points", label: "Pontos semanais" },
  { value: "tickets_active", label: "Bilhetes" },
  { value: "special_prize", label: "Prêmio especial" },
];

const inputClassName = "border-slate-700 bg-slate-950 text-white";
const selectClassName = "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400";

const GAMIFICATION_PRESETS = [
  {
    id: "inclusive",
    label: "Inclusivo (Recomendado)",
    badge: "Todos conseguem competir",
    description:
      "Dá força para check-in, baú e participações. Depósito acelera, mas quem usa o app todos os dias ainda pode buscar Top 10.",
    dailyCheckInPoints: [10, 12, 14, 16, 18, 22, 28],
    groups: [
      {
        name: "Check-in diário",
        source_event: "daily_checkin",
        description: "Recompensa a constância diária e ajuda a pessoa a voltar ao app.",
        priority: 80,
        rewards: { xp_total: 18, weekly_points: 0, engagement_points: 8, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Baú Diário aberto",
        source_event: "daily_chest_open",
        description: "Entrega sensação rápida de progresso sempre que a pessoa abre o baú.",
        priority: 90,
        rewards: { xp_total: 24, weekly_points: 4, engagement_points: 10, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Participação válida em dinâmica",
        source_event: "participation",
        description: "Pontua presença real nas dinâmicas e mantém o app movimentado.",
        priority: 100,
        rewards: { xp_total: 12, weekly_points: 6, engagement_points: 10, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Seguir novo perfil",
        source_event: "follow_profile",
        description: "Estimula rede social, descoberta de perfis e hábito de navegação.",
        priority: 110,
        limit_scope: "daily",
        limit_count: 10,
        rewards: { xp_total: 10, weekly_points: 3, engagement_points: 5, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Curtir perfil",
        source_event: "like_profile",
        description: "Gera pequenas doses de progresso por interação social leve.",
        priority: 120,
        limit_scope: "daily",
        limit_count: 20,
        rewards: { xp_total: 4, weekly_points: 1, engagement_points: 2, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Depósito aprovado",
        source_event: "approved_deposit_count",
        description: "Entrega um salto de progresso quando o depósito realmente entra.",
        priority: 130,
        rewards: { xp_total: 65, weekly_points: 22, engagement_points: 28, tickets_active: 0, tickets_bonus: 2, points_balance: 0 },
      },
      {
        name: "Depósito por faixa de valor",
        source_event: "approved_deposit_amount_step",
        description: "Quanto maior o depósito, mais o usuário acelera sem desequilibrar demais.",
        priority: 140,
        condition_step: 20,
        rewards: { xp_total: 14, weekly_points: 8, engagement_points: 10, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Vitória confirmada",
        source_event: "validated_win",
        description: "Reforça emocionalmente a conquista real com um bônus extra de progresso.",
        priority: 150,
        rewards: { xp_total: 35, weekly_points: 14, engagement_points: 20, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
    ],
    notes: [
      "Usuário ativo sem depósito consegue pontuar por check-in, baú, participações, follows e likes.",
      "Depósito continua mais forte, mas não tira totalmente a chance de quem é constante.",
    ],
  },
  {
    id: "deposit_boost",
    label: "Foco em Depósito",
    badge: "Receita forte",
    description:
      "Mantém o app vivo para todos, mas dá vantagem mais clara para quem deposita. Útil para campanhas de conversão.",
    dailyCheckInPoints: [8, 10, 12, 14, 16, 18, 24],
    groups: [
      {
        name: "Check-in diário",
        source_event: "daily_checkin",
        description: "Mantém a volta diária ativa mesmo com foco maior em monetização.",
        priority: 80,
        rewards: { xp_total: 14, weekly_points: 0, engagement_points: 6, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Baú Diário aberto",
        source_event: "daily_chest_open",
        description: "Continua entregando progresso rápido fora do depósito.",
        priority: 90,
        rewards: { xp_total: 20, weekly_points: 3, engagement_points: 8, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Participação válida em dinâmica",
        source_event: "participation",
        description: "Mantém o usuário comum no jogo semanal, mas sem ultrapassar o peso do depósito.",
        priority: 100,
        rewards: { xp_total: 10, weekly_points: 5, engagement_points: 8, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Seguir novo perfil",
        source_event: "follow_profile",
        description: "Pequena recompensa social para incentivar navegação.",
        priority: 110,
        limit_scope: "daily",
        limit_count: 10,
        rewards: { xp_total: 6, weekly_points: 2, engagement_points: 4, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Curtir perfil",
        source_event: "like_profile",
        description: "Micro recompensa para não inflar demais o ranking por ação muito fácil.",
        priority: 120,
        limit_scope: "daily",
        limit_count: 20,
        rewards: { xp_total: 2, weekly_points: 1, engagement_points: 1, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Depósito aprovado",
        source_event: "approved_deposit_count",
        description: "O principal salto de progresso da campanha.",
        priority: 130,
        rewards: { xp_total: 90, weekly_points: 32, engagement_points: 40, tickets_active: 0, tickets_bonus: 4, points_balance: 0 },
      },
      {
        name: "Depósito por faixa de valor",
        source_event: "approved_deposit_amount_step",
        description: "Aumenta a sensação de ganho conforme o valor sobe.",
        priority: 140,
        condition_step: 20,
        rewards: { xp_total: 18, weekly_points: 10, engagement_points: 12, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Vitória confirmada",
        source_event: "validated_win",
        description: "Premia a conquista e reforça o ciclo emocional de recompensa.",
        priority: 150,
        rewards: { xp_total: 40, weekly_points: 16, engagement_points: 24, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
    ],
    notes: [
      "Quem deposita acelera forte e tende a dominar as posições altas.",
      "Quem não deposita ainda participa do Top 10 pela constância, mas com menos margem.",
    ],
  },
  {
    id: "community",
    label: "Comunidade e Retenção",
    badge: "Engaja mais perfis",
    description:
      "Valoriza muito check-in, baú e social. Bom para crescer uso diário, seguidores e permanência no app.",
    dailyCheckInPoints: [12, 14, 16, 18, 22, 26, 32],
    groups: [
      {
        name: "Check-in diário",
        source_event: "daily_checkin",
        description: "É o motor principal de retorno e sensação de progresso diário.",
        priority: 80,
        rewards: { xp_total: 20, weekly_points: 0, engagement_points: 10, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Baú Diário aberto",
        source_event: "daily_chest_open",
        description: "Reforça a visita diária com um ganho visual e numérico forte.",
        priority: 90,
        rewards: { xp_total: 26, weekly_points: 5, engagement_points: 12, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Participação válida em dinâmica",
        source_event: "participation",
        description: "Faz a pessoa se sentir avançando por estar presente nas ações do app.",
        priority: 100,
        rewards: { xp_total: 14, weekly_points: 7, engagement_points: 12, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Seguir novo perfil",
        source_event: "follow_profile",
        description: "Ajuda a formar rede social e descoberta dentro do app.",
        priority: 110,
        limit_scope: "daily",
        limit_count: 12,
        rewards: { xp_total: 12, weekly_points: 4, engagement_points: 6, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Curtir perfil",
        source_event: "like_profile",
        description: "Pequena recompensa frequente para manter a navegação gostosa.",
        priority: 120,
        limit_scope: "daily",
        limit_count: 25,
        rewards: { xp_total: 5, weekly_points: 2, engagement_points: 2, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Depósito aprovado",
        source_event: "approved_deposit_count",
        description: "Ainda vale bastante, mas sem matar a disputa de quem só usa o app.",
        priority: 130,
        rewards: { xp_total: 55, weekly_points: 18, engagement_points: 24, tickets_active: 0, tickets_bonus: 2, points_balance: 0 },
      },
      {
        name: "Depósito por faixa de valor",
        source_event: "approved_deposit_amount_step",
        description: "Complementa o depósito sem tornar o ranking impossível para o usuário comum.",
        priority: 140,
        condition_step: 20,
        rewards: { xp_total: 10, weekly_points: 6, engagement_points: 8, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
      {
        name: "Vitória confirmada",
        source_event: "validated_win",
        description: "Reforça a emoção da vitória e dá visibilidade à conquista.",
        priority: 150,
        rewards: { xp_total: 30, weekly_points: 12, engagement_points: 18, tickets_active: 0, tickets_bonus: 0, points_balance: 0 },
      },
    ],
    notes: [
      "Melhor preset para criar hábito diário e sensação de progresso constante.",
      "Top 10 fica bem mais acessível para quem interage muito, mesmo sem depósito.",
    ],
  },
];

function buildSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createEmptyRewards() {
  return METRIC_OPTIONS.reduce((acc, option) => {
    acc[option.value] = 0;
    return acc;
  }, {});
}

function buildRuleGroupDraft() {
  return {
    group_id: `rule-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "Nova regra",
    source_event: "daily_checkin",
    description: "",
    condition_min: 0,
    condition_step: 1,
    limit_scope: "none",
    limit_count: 0,
    priority: 100,
    active: true,
    rewards: { ...createEmptyRewards(), weekly_points: 10 },
    ruleIds: {},
  };
}

function buildRuleGroupFromPreset(group, index) {
  return {
    group_id: `preset-${buildSlug(group.name)}-${index + 1}`,
    name: group.name,
    source_event: group.source_event || "manual",
    description: group.description || "",
    condition_min: Number(group.condition_min || 0),
    condition_step: Math.max(1, Number(group.condition_step || 1)),
    limit_scope: group.limit_scope || "none",
    limit_count: Number(group.limit_count || 0),
    priority: Number(group.priority || 100),
    active: group.active !== false,
    rewards: {
      ...createEmptyRewards(),
      ...(group.rewards || {}),
    },
    ruleIds: {},
  };
}

function buildPosition(positionNumber, rewardType = "cash_prize", rewardValue = 20, label) {
  return {
    position: positionNumber,
    reward_type: rewardType,
    reward_value: rewardValue,
    label: label || `${positionNumber}º lugar`,
    active: true,
  };
}

function normalizeWeeklyPositions(config) {
  const winnersCount = Math.max(1, Number(config?.winners_count || 10));
  const current = Array.isArray(config?.positions) ? config.positions : [];
  const fallbackRewardType = config?.fallback_reward_type || "cash_prize";

  return Array.from({ length: winnersCount }, (_, index) => {
    const positionNumber = index + 1;
    const currentEntry = current.find((entry) => Number(entry.position) === positionNumber) || current[index];
    return {
      ...buildPosition(positionNumber, fallbackRewardType, 20, `${positionNumber}º lugar`),
      ...currentEntry,
      position: positionNumber,
      active: currentEntry?.active !== false,
    };
  });
}

function normalizeWeeklyDraft(config) {
  if (!config) return null;
  const normalized = {
    ...config,
    enabled: config.enabled !== false,
    active: config.active !== false,
    instructions: String(config.instructions || "").trim(),
    winners_count: Math.max(1, Number(config.winners_count || 10)),
    fallback_reward_type: config.fallback_reward_type || "cash_prize",
    starts_at: formatDateTimeLocalValue(config.starts_at),
    ends_at: formatDateTimeLocalValue(config.ends_at),
  };
  normalized.positions = normalizeWeeklyPositions(normalized);
  return normalized;
}

function formatDateTimeLocalValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function serializeDateTimeLocalValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function serializeWeeklyDraft(config) {
  if (!config) return {};
  return {
    ...config,
    enabled: config.enabled !== false,
    active: config.active !== false,
    instructions: String(config.instructions || "").trim(),
    starts_at: serializeDateTimeLocalValue(config.starts_at),
    ends_at: serializeDateTimeLocalValue(config.ends_at),
  };
}

function formatWeeklyPointsReward(amount) {
  return `+${Math.max(0, Number(amount || 0)).toLocaleString("pt-BR")} pontos semanais`;
}

function buildWeeklyInstructionLine(group) {
  const eventOption = EVENT_OPTIONS.find((option) => option.value === group.source_event);
  const rewardAmount = Number(group.rewards?.weekly_points || 0);
  if (rewardAmount <= 0 || group.active === false) return "";

  const parts = [];
  const baseLabel = String(group.name || eventOption?.label || "Ação ativa").trim();
  parts.push(baseLabel);

  if (group.source_event === "approved_deposit_amount_step" && Number(group.condition_step || 0) > 0) {
    parts.push(`a cada R$ ${Number(group.condition_step || 0).toLocaleString("pt-BR")}`);
  } else if (Number(group.condition_min || 0) > 0) {
    parts.push(`com mínimo de ${Number(group.condition_min || 0).toLocaleString("pt-BR")}`);
  }

  parts.push(formatWeeklyPointsReward(rewardAmount));

  if (group.limit_scope !== "none") {
    const limitLabel = LIMIT_SCOPE_OPTIONS.find((option) => option.value === group.limit_scope)?.label || group.limit_scope;
    if (Number(group.limit_count || 0) > 0) {
      parts.push(`limite de ${Number(group.limit_count || 0)} por ${String(limitLabel).toLowerCase()}`);
    } else {
      parts.push(`controle por ${String(limitLabel).toLowerCase()}`);
    }
  }

  return parts.join(" • ");
}

function buildWeeklyInstructionsFromSystem({ weeklyDraft, ruleGroupsDraft, checkInDraft }) {
  const lines = [];
  const activeRuleLines = (Array.isArray(ruleGroupsDraft) ? ruleGroupsDraft : [])
    .filter((group) => group?.active !== false && Number(group?.rewards?.weekly_points || 0) > 0)
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))
    .map(buildWeeklyInstructionLine)
    .filter(Boolean);

  if (activeRuleLines.length > 0) {
    lines.push(...activeRuleLines.map((line, index) => `${index + 1}) ${line}.`));
  }

  const activeCheckInRewards = (checkInDraft?.rewards || [])
    .filter((entry) => entry?.active !== false && Number(entry?.weekly_points || 0) > 0)
    .sort((a, b) => Number(a.day || 0) - Number(b.day || 0));
  if (checkInDraft?.enabled !== false && activeCheckInRewards.length > 0) {
    const summary = activeCheckInRewards
      .map((entry) => `${entry.label || `Dia ${entry.day}`}: ${formatWeeklyPointsReward(entry.weekly_points)}`)
      .join(" • ");
    lines.push(`${lines.length + 1}) Check-in diário ativo • ${summary}.`);
  }

  lines.push(
    `${lines.length + 1}) Só contam os pontos semanais do ciclo atual${weeklyDraft?.title ? ` em "${weeklyDraft.title}"` : ""}.`
  );

  const winnersCount = Math.max(1, Number(weeklyDraft?.winners_count || 10));
  lines.push(`${lines.length + 1}) O ranking premia ${winnersCount} posição${winnersCount > 1 ? "ões" : ""} ao final do ciclo.`);

  return lines.join("\n");
}

function parseBooleanString(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function formatMetricList(rewards = {}) {
  return METRIC_OPTIONS.filter((metric) => Number(rewards?.[metric.value] || 0) > 0)
    .map((metric) => `${Number(rewards[metric.value] || 0)} ${metric.label.toLowerCase()}`)
    .join(" + ");
}

function formatDailyChestRewardType(entry = {}) {
  const rewardType = String(entry.reward_type || "").trim().toLowerCase();
  const amount = Number(entry.reward_amount || 0);
  if (rewardType === "points_balance") return `banca de R$ ${amount.toFixed(2)}`;
  if (rewardType === "xp_total" || rewardType === "xp") return `${amount} XP`;
  if (rewardType === "weekly_points") return `${amount} pontos semanais`;
  if (rewardType === "engagement_points") return `${amount} pontos de engajamento`;
  if (rewardType === "tickets_active") return `${amount} bilhetes`;
  return entry.title || rewardType || "prêmio";
}

function buildSystemSummary({ weeklyDraft, ruleGroupsDraft, checkInDraft, dailyChestConfig }) {
  const lines = [];
  const activeRuleGroups = (Array.isArray(ruleGroupsDraft) ? ruleGroupsDraft : [])
    .filter((group) => group?.active !== false)
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
  const activeWeeklyGroups = activeRuleGroups.filter((group) => Number(group?.rewards?.weekly_points || 0) > 0);
  const activeCheckInRewards = (checkInDraft?.rewards || []).filter((entry) => entry?.active !== false);
  const chestSettings = dailyChestConfig?.settings || {};
  const chestRewards = Array.isArray(dailyChestConfig?.rewards) ? dailyChestConfig.rewards.filter((entry) => entry?.active !== false) : [];

  lines.push("RESUMO ATUAL DA GAMIFICAÇÃO");
  lines.push("");

  lines.push("1. TOP SEMANAL");
  lines.push(`Status público: ${weeklyDraft?.enabled !== false && weeklyDraft?.active !== false ? "ativo" : "oculto"}.`);
  lines.push(`Título público: ${weeklyDraft?.title || "Top Semanal"}.`);
  lines.push(`Texto de apoio: ${weeklyDraft?.subtitle || "-"}.`);
  lines.push(`Janela do ciclo: ${weeklyDraft?.starts_at ? weeklyDraft.starts_at.replace("T", " ") : "automática"} até ${weeklyDraft?.ends_at ? weeklyDraft.ends_at.replace("T", " ") : "automática"}.`);
  lines.push(`Quantidade de premiados: ${Number(weeklyDraft?.winners_count || 0)}.`);
  const activePositions = (weeklyDraft?.positions || []).filter((entry) => entry?.active !== false);
  if (activePositions.length > 0) {
    lines.push("Premiação por posição:");
    activePositions.forEach((position) => {
      lines.push(`- ${position.position}º lugar: ${position.label || `${position.position}º lugar`} • ${position.reward_type} • valor ${Number(position.reward_value || 0)}.`);
    });
  }
  lines.push("");

  lines.push("2. REGRAS DE PONTUAÇÃO ATIVAS");
  if (activeRuleGroups.length === 0) {
    lines.push("Nenhuma regra ativa cadastrada.");
  } else {
    activeRuleGroups.forEach((group, index) => {
      const eventLabelText = EVENT_OPTIONS.find((option) => option.value === group.source_event)?.label || group.source_event;
      const limitLabel = group.limit_scope !== "none" ? LIMIT_SCOPE_OPTIONS.find((option) => option.value === group.limit_scope)?.label || group.limit_scope : "";
      const details = [
        `Gatilho: ${eventLabelText}`,
        Number(group.condition_min || 0) > 0 ? `mínimo ${Number(group.condition_min || 0)}` : "",
        Number(group.condition_step || 1) > 1 ? `passo ${Number(group.condition_step || 1)}` : "",
        formatMetricList(group.rewards) ? `entrega ${formatMetricList(group.rewards)}` : "",
        group.limit_scope !== "none" ? `limite ${Number(group.limit_count || 0) > 0 ? Number(group.limit_count || 0) : "configurado"} em ${String(limitLabel).toLowerCase()}` : "",
      ]
        .filter(Boolean)
        .join(" • ");
      lines.push(`${index + 1}) ${group.name || `Regra ${index + 1}`} • ${details}.`);
    });
  }
  lines.push("");

  lines.push("3. CHECK-IN DIÁRIO");
  lines.push(`Status: ${checkInDraft?.enabled !== false ? "ativo" : "desligado"}.`);
  if (activeCheckInRewards.length === 0) {
    lines.push("Não há dias ativos no check-in.");
  } else {
    activeCheckInRewards
      .sort((a, b) => Number(a.day || 0) - Number(b.day || 0))
      .forEach((entry) => {
        lines.push(`- Dia ${entry.day}: ${entry.label || `Dia ${entry.day}`} • ${Number(entry.weekly_points || 0)} pontos semanais.`);
      });
  }
  lines.push("");

  lines.push("4. BAÚ DIÁRIO");
  lines.push(`Status: ${parseBooleanString(chestSettings.daily_chest_enabled, true) ? "ativo" : "desligado"}.`);
  lines.push(`XP por abertura: ${Number(chestSettings.daily_chest_xp_per_open || 0)}.`);
  lines.push(`Baús base por dia: ${Number(chestSettings.daily_chest_base_daily_chests || 0)}.`);
  lines.push(`Meta de toques para abrir: ${Number(chestSettings.daily_chest_tap_goal || 0)}.`);
  lines.push(`Mensagem do dia: ${chestSettings.daily_chest_message_of_day || "-"}.`);
  lines.push(`Janela do baú: ${chestSettings.daily_chest_schedule_start_at || "sempre ligado"} até ${chestSettings.daily_chest_schedule_end_at || "sem fim definido"}.`);
  lines.push(
    `Bônus por depósito: ${parseBooleanString(chestSettings.daily_chest_deposit_bonus_enabled, true) ? "ativo" : "desligado"} • ${Number(chestSettings.daily_chest_bonus_chests_per_approved || 0)} baú(s) por depósito aprovado • passo de valor ${Number(chestSettings.daily_chest_bonus_amount_step || 0)} gerando ${Number(chestSettings.daily_chest_bonus_chests_per_step || 0)} baú(s).`
  );
  lines.push(`Limite de vitórias em banca por usuário no dia: ${Number(chestSettings.daily_chest_balance_wins_per_user_day || 0)}.`);
  if (chestRewards.length === 0) {
    lines.push("Nenhum prêmio ativo no pool do baú.");
  } else {
    lines.push("Prêmios ativos no pool do baú:");
    chestRewards.slice(0, 12).forEach((entry) => {
      lines.push(
        `- ${entry.title || "Prêmio"} • ${formatDailyChestRewardType(entry)} • raridade ${entry.rarity || "rare"} • peso ${Number(entry.weight || 0)} • limite diário ${Number(entry.daily_cap || 0)} • estoque ${Number(entry.stock_total || 0)}.`
      );
    });
    if (chestRewards.length > 12) {
      lines.push(`- ... e mais ${chestRewards.length - 12} prêmio(s) ativo(s).`);
    }
  }
  lines.push("");

  lines.push("5. TEXTO ATUAL DO POPUP 'COMO GANHAR PONTOS'");
  lines.push(weeklyDraft?.instructions ? weeklyDraft.instructions : "Sem texto salvo no momento.");
  lines.push("");

  lines.push("6. LEITURA OPERACIONAL");
  lines.push(`Hoje existem ${activeRuleGroups.length} regra(s) ativa(s), ${activeWeeklyGroups.length} delas entregando pontos semanais diretamente, ${activeCheckInRewards.length} dia(s) ativos no check-in e ${chestRewards.length} prêmio(s) ativo(s) no baú diário.`);

  return lines.join("\n");
}

function normalizeCheckInDraft(config) {
  const rewards = Array.isArray(config?.rewards) ? config.rewards : [];
  return {
    enabled: config?.enabled !== false,
    rewards: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      const current = rewards.find((entry) => Number(entry?.day) === day) || {};
      return {
        day,
        label: current?.label || `Dia ${day}`,
        weekly_points: Math.max(0, Number(current?.weekly_points || 0)),
        active: current?.active !== false,
      };
    }),
  };
}

function eventLabel(sourceEvent) {
  return EVENT_OPTIONS.find((option) => option.value === sourceEvent)?.label || sourceEvent;
}

function groupRulesForEditor(rules = []) {
  const groups = new Map();

  rules.forEach((rule, index) => {
    const metadata = rule?.metadata && typeof rule.metadata === "object" ? rule.metadata : {};
    const groupId = String(metadata.group_id || `legacy-${rule.id || rule.slug || index}`);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        group_id: groupId,
        name: metadata.group_label || rule.name || `Regra ${index + 1}`,
        source_event: rule.source_event || "manual",
        description: rule.description || "",
        condition_min: Number(rule.condition_min || 0),
        condition_step: Number(rule.condition_step || 1),
        limit_scope: rule.limit_scope || "none",
        limit_count: Number(rule.limit_count || 0),
        priority: Number(rule.priority || 100),
        active: rule.active !== false,
        rewards: createEmptyRewards(),
        ruleIds: {},
      });
    }

    const current = groups.get(groupId);
    current.rewards[rule.metric_key] = Math.max(0, Number(rule.amount || 0));
    current.ruleIds[rule.metric_key] = {
      id: rule.id || "",
      slug: rule.slug || "",
    };
    current.active = current.active || rule.active !== false;
  });

  return Array.from(groups.values()).sort((a, b) => a.priority - b.priority);
}

function expandRuleGroups(groups = []) {
  return groups.flatMap((group, index) =>
    METRIC_OPTIONS.filter((metric) => Number(group.rewards?.[metric.value] || 0) > 0).map((metric) => {
      const existing = group.ruleIds?.[metric.value] || {};
      const slugBase = buildSlug(group.name) || `regra-${index + 1}`;
      return {
        id: existing.id || "",
        name: group.name || `Regra ${index + 1}`,
        slug: existing.slug || `${slugBase}-${metric.value}`,
        category: metric.value === "weekly_points" ? "weekly" : "engagement",
        description: group.description || "",
        source_event: group.source_event || "manual",
        metric_key: metric.value,
        amount: Math.max(0, Number(group.rewards?.[metric.value] || 0)),
        condition_min: Math.max(0, Number(group.condition_min || 0)),
        condition_step: Math.max(1, Number(group.condition_step || 1)),
        limit_scope: group.limit_scope || "none",
        limit_count: Math.max(0, Number(group.limit_count || 0)),
        dedupe_key: `${group.source_event || "manual"}:${metric.value}:${group.group_id}`,
        priority: Math.max(0, Number(group.priority || 100)),
        active: group.active !== false,
        metadata: {
          group_id: group.group_id,
          group_label: group.name || `Regra ${index + 1}`,
        },
      };
    })
  );
}

function buildRuleSummary(group) {
  const rewardParts = METRIC_OPTIONS.filter((metric) => Number(group.rewards?.[metric.value] || 0) > 0).map(
    (metric) => `${Number(group.rewards[metric.value] || 0)} ${metric.label.toLowerCase()}`
  );
  const base = [`Quando acontecer ${eventLabel(group.source_event).toLowerCase()}`];

  if (Number(group.condition_min || 0) > 0) {
    base.push(`com valor mínimo de ${Number(group.condition_min || 0)}`);
  }
  if (Number(group.condition_step || 1) > 1) {
    base.push(`a cada ${Number(group.condition_step || 1)} unidades`);
  }
  if (rewardParts.length > 0) {
    base.push(`gera ${rewardParts.join(" + ")}`);
  }
  if (group.limit_scope !== "none") {
    const limitLabel = LIMIT_SCOPE_OPTIONS.find((option) => option.value === group.limit_scope)?.label || group.limit_scope;
    base.push(
      Number(group.limit_count || 0) > 0
        ? `com limite de ${Number(group.limit_count || 0)} em ${limitLabel.toLowerCase()}`
        : `com controle em ${limitLabel.toLowerCase()}`
    );
  }

  return `${base.join(", ")}.`;
}

function FieldHint({ children }) {
  return <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{children}</p>;
}

// ─── Resultado Top Semanal ────────────────────────────────────────────────────

const STATUS_LABEL = {
  pending:   { text: "Pendente",  classes: "border-slate-600/60 bg-slate-700/40 text-slate-300" },
  validated: { text: "Validado",  classes: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
  annulled:  { text: "Anulado",   classes: "border-red-500/50 bg-red-500/15 text-red-300" },
};

const MEDAL = ["🥇", "🥈", "🥉"];

function WeeklyResultsSection({ cycles = [], queryClient }) {
  const [selectedCycleId, setSelectedCycleId] = React.useState("");
  const [confirmDialog, setConfirmDialog] = React.useState(null); // { userId, nick, action }

  // Seleciona automaticamente o ciclo mais recente fechado
  React.useEffect(() => {
    if (selectedCycleId) return;
    const first = cycles.find((c) => c.status === "closed") || cycles[0];
    if (first) setSelectedCycleId(first.id);
  }, [cycles, selectedCycleId]);

  const { data: resultsData, isLoading, isFetching } = useQuery({
    queryKey: ["admin-weekly-results", selectedCycleId],
    queryFn: () => base44.adminGamification.weeklyResults(selectedCycleId),
    enabled: Boolean(selectedCycleId),
    staleTime: 15000,
  });

  const validateMutation = useMutation({
    mutationFn: ({ userId, action }) =>
      base44.adminGamification.validateWeeklyWinner(selectedCycleId, userId, action),
    onSuccess: (_, vars) => {
      toast({
        title: vars.action === "validate" ? "✅ Ganhador validado!" : "❌ Ganhador anulado",
        description: vars.action === "validate"
          ? "Prêmio adicionado à galeria e usuário notificado."
          : "Prêmio removido. O próximo da lista assumiu a posição.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-weekly-results", selectedCycleId] });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err?.message || "Operação falhou.", variant: "destructive" });
    },
  });

  const handleConfirm = () => {
    if (!confirmDialog) return;
    validateMutation.mutate({ userId: confirmDialog.userId, action: confirmDialog.action });
    setConfirmDialog(null);
  };

  const entries = resultsData?.entries || [];
  const winnersCount = resultsData?.winners_count || 10;
  const cycle = resultsData?.cycle || null;

  // Separa ganhadores efetivos dos demais
  const effectiveWinners = entries.filter((e) => e.is_effective_winner);
  const others = entries.filter((e) => !e.is_effective_winner);

  return (
    <div className="space-y-4">
      {/* Seletor de ciclo */}
      <Card className="border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-semibold text-slate-300">Ciclo</label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione um ciclo...</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.cycle_key} — {c.status === "active" ? "🟢 Ativo" : "🔒 Encerrado"}
                </option>
              ))}
            </select>
          </div>
          {cycle ? (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{cycle.title}</span>
              &nbsp;·&nbsp;
              {new Date(cycle.starts_at).toLocaleDateString("pt-BR")}
              &nbsp;→&nbsp;
              {new Date(cycle.ends_at).toLocaleDateString("pt-BR")}
              &nbsp;·&nbsp;
              <span className={cycle.status === "closed" ? "text-amber-400" : "text-emerald-400"}>
                {cycle.status === "closed" ? "Encerrado" : "Ativo"}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Conteúdo */}
      {isLoading || isFetching ? (
        <Card className="border-slate-800 bg-slate-900/80 p-8 text-center">
          <p className="text-sm text-slate-400">Carregando resultados...</p>
        </Card>
      ) : !selectedCycleId ? (
        <Card className="border-slate-800 bg-slate-900/80 p-8 text-center">
          <p className="text-sm text-slate-500">Selecione um ciclo acima para ver os resultados.</p>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/80 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum participante com pontuação neste ciclo.</p>
        </Card>
      ) : (
        <>
          {/* Top ganhadores */}
          <Card className="border-amber-400/25 bg-slate-900/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <h3 className="text-base font-black text-amber-300">
                Top {winnersCount} Ganhadores Efetivos
              </h3>
              <span className="ml-auto rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                {effectiveWinners.length}/{winnersCount} preenchidos
              </span>
            </div>

            <div className="space-y-2">
              {effectiveWinners.map((entry) => {
                const statusInfo = STATUS_LABEL[entry.validation_status] || STATUS_LABEL.pending;
                const medal = MEDAL[entry.effective_position - 1] || null;
                return (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2.5"
                  >
                    {/* Posição */}
                    <div className="w-8 shrink-0 text-center">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-sm font-black text-slate-400">#{entry.effective_position}</span>
                      )}
                    </div>

                    {/* Nick + pontos */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{entry.nick}</p>
                      <p className="text-[11px] text-slate-400">
                        {Number(entry.weekly_points).toLocaleString("pt-BR")} pts
                        {entry.reward_label ? ` · ${entry.reward_label}` : ""}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.classes}`}>
                      {statusInfo.text}
                    </span>

                    {/* Ações */}
                    <div className="flex shrink-0 gap-2">
                      {entry.validation_status !== "validated" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={validateMutation.isPending}
                          onClick={() => setConfirmDialog({ userId: entry.user_id, nick: entry.nick, action: "validate" })}
                          className="h-7 bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-500"
                        >
                          Validar
                        </Button>
                      ) : null}
                      {entry.validation_status !== "annulled" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={validateMutation.isPending}
                          onClick={() => setConfirmDialog({ userId: entry.user_id, nick: entry.nick, action: "annul" })}
                          className="h-7 border border-red-500/50 bg-red-500/10 px-3 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                        >
                          Anular
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* Aviso de posições ainda a preencher */}
              {effectiveWinners.length < winnersCount ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-200">
                  ⚠️ {winnersCount - effectiveWinners.length} posição(ões) ainda sem ganhador efetivo.
                  Adicione mais participantes ou reduza o número de ganhadores no painel de configuração.
                </div>
              ) : null}
            </div>
          </Card>

          {/* Demais participantes */}
          {others.length > 0 ? (
            <Card className="border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-300">
                Participantes fora do Top {winnersCount}
                <span className="ml-2 text-slate-500">({others.length})</span>
              </h3>
              <div className="space-y-1.5">
                {others.map((entry) => {
                  const statusInfo = STATUS_LABEL[entry.validation_status] || STATUS_LABEL.pending;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                        entry.validation_status === "annulled"
                          ? "border border-red-500/20 bg-red-500/5"
                          : "border border-slate-800/60 bg-slate-950/40"
                      }`}
                    >
                      <span className="w-7 shrink-0 text-center text-xs font-black text-slate-500">
                        #{entry.position}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm text-slate-300">{entry.nick}</p>
                      <p className="shrink-0 text-[11px] text-slate-500">
                        {Number(entry.weekly_points).toLocaleString("pt-BR")} pts
                      </p>
                      {entry.validation_status === "annulled" ? (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.classes}`}>
                          Anulado — subiu na lista
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </>
      )}

      {/* Modal de confirmação */}
      {confirmDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-black text-white">
              {confirmDialog.action === "validate" ? "✅ Confirmar validação" : "❌ Confirmar anulação"}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {confirmDialog.action === "validate" ? (
                <>
                  Validar <strong className="text-white">{confirmDialog.nick}</strong> como ganhador?
                  <br />
                  <span className="text-xs text-slate-400">
                    O prêmio será adicionado à galeria e o usuário será notificado.
                  </span>
                </>
              ) : (
                <>
                  Anular <strong className="text-white">{confirmDialog.nick}</strong>?
                  <br />
                  <span className="text-xs text-slate-400">
                    O prêmio será removido e o próximo da lista assumirá a posição automaticamente.
                  </span>
                </>
              )}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 border border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={validateMutation.isPending}
                className={`flex-1 font-bold ${
                  confirmDialog.action === "validate"
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-red-600 text-white hover:bg-red-500"
                }`}
              >
                {validateMutation.isPending ? "Aguarde..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GamificationTab() {
  const queryClient = useQueryClient();
  const [ruleGroupsDraft, setRuleGroupsDraft] = React.useState([]);
  const [weeklyDraft, setWeeklyDraft] = React.useState(null);
  const [checkInDraft, setCheckInDraft] = React.useState(null);
  const [systemSummary, setSystemSummary] = React.useState("");
  const [activeSection, setActiveSection] = React.useState("overview");

  const { data: overview } = useQuery({
    queryKey: ["admin-gamification-overview"],
    queryFn: () => base44.adminGamification.overview(),
    staleTime: 10000,
  });

  const { data: rulesResponse } = useQuery({
    queryKey: ["admin-gamification-rules"],
    queryFn: () => base44.adminGamification.rules(),
    staleTime: 10000,
  });

  const { data: weeklyConfig } = useQuery({
    queryKey: ["admin-gamification-weekly-config"],
    queryFn: () => base44.adminGamification.weeklyConfig(),
    staleTime: 10000,
  });

  const { data: checkInConfig } = useQuery({
    queryKey: ["admin-gamification-checkin-config"],
    queryFn: () => base44.adminGamification.checkInConfig(),
    staleTime: 10000,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["admin-gamification-cycles"],
    queryFn: () => base44.adminGamification.cycles(),
    staleTime: 10000,
  });

  const { data: dailyChestConfig } = useQuery({
    queryKey: ["admin-daily-chest-config-v2"],
    queryFn: () => base44.adminDailyChest.config(),
    staleTime: 10000,
  });

  React.useEffect(() => {
    setRuleGroupsDraft(groupRulesForEditor(Array.isArray(rulesResponse?.rules) ? rulesResponse.rules : []));
  }, [rulesResponse]);

  React.useEffect(() => {
    setWeeklyDraft(normalizeWeeklyDraft(weeklyConfig));
  }, [weeklyConfig]);

  React.useEffect(() => {
    setCheckInDraft(normalizeCheckInDraft(checkInConfig));
  }, [checkInConfig]);

  const warnings = React.useMemo(() => {
    const items = [];
    const seenFingerprints = new Set();
    const duplicates = new Set();

    ruleGroupsDraft.forEach((group) => {
      const rewardKeys = METRIC_OPTIONS.filter((metric) => Number(group.rewards?.[metric.value] || 0) > 0)
        .map((metric) => metric.value)
        .sort();
      const fingerprint = `${group.source_event}:${group.condition_min}:${group.condition_step}:${rewardKeys.join(",")}`;
      if (seenFingerprints.has(fingerprint)) duplicates.add(fingerprint);
      seenFingerprints.add(fingerprint);
      if (Number(group.rewards?.xp_total || 0) >= 500) {
        items.push(`A regra "${group.name}" concede XP muito alto. Vale revisar antes de salvar.`);
      }
    });

    if (duplicates.size > 0) {
      items.push("Existem regras muito parecidas para o mesmo gatilho. Revise para não duplicar pontuação sem querer.");
    }

    if (checkInDraft) {
      const activeRewards = checkInDraft.rewards.filter((entry) => entry.active !== false);
      if (activeRewards.length === 0) {
        items.push("O check-in diário ficou sem dias ativos. Isso desliga a progressão prática do calendário.");
      }
      if (activeRewards.some((entry) => Number(entry.weekly_points || 0) >= 1000)) {
        items.push("Existe um dia do check-in com pontuação semanal muito alta.");
      }
    }

    const positions = Array.isArray(weeklyDraft?.positions) ? weeklyDraft.positions : [];
    const activePositions = positions.filter((entry) => entry.active !== false);
    if (weeklyDraft && Number(weeklyDraft.winners_count || 0) > activePositions.length) {
      items.push("O Top Semanal tem menos posições ativas do que o total de premiados configurado.");
    }
    if (weeklyDraft?.starts_at && weeklyDraft?.ends_at) {
      const startsAt = new Date(weeklyDraft.starts_at);
      const endsAt = new Date(weeklyDraft.ends_at);
      if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt <= startsAt) {
        items.push("No Top Semanal, a data final precisa ser maior que a data inicial.");
      }
    }

    return items;
  }, [checkInDraft, ruleGroupsDraft, weeklyDraft]);

  const saveRulesMutation = useMutation({
    mutationFn: () => base44.adminGamification.saveRules(expandRuleGroups(ruleGroupsDraft)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Regras salvas", description: "A gamificação authoritative foi atualizada." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao salvar regras", description: error?.message || "Tente novamente." });
    },
  });

  const saveCheckInMutation = useMutation({
    mutationFn: () => base44.adminGamification.saveCheckInConfig(checkInDraft || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-checkin-config"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Check-in salvo", description: "A progressão de 7 dias já está valendo no backend." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao salvar check-in", description: error?.message || "Tente novamente." });
    },
  });

  const saveWeeklyMutation = useMutation({
    mutationFn: () => base44.adminGamification.saveWeeklyConfig(serializeWeeklyDraft(weeklyDraft || {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-weekly-config"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Top semanal salvo", description: "As posições premiadas e o ciclo foram atualizados." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao salvar top semanal", description: error?.message || "Tente novamente." });
    },
  });

  const openCycleMutation = useMutation({
    mutationFn: () => base44.adminGamification.openCycle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Novo ciclo aberto", description: "O ranking semanal já está rodando no backend." });
    },
  });

  const closeCycleMutation = useMutation({
    mutationFn: (cycleId) => base44.adminGamification.closeCycle(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Ciclo fechado", description: "O snapshot dos vencedores foi persistido." });
    },
  });

  function updateRuleGroup(index, patch) {
    setRuleGroupsDraft((prev) => prev.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)));
  }

  function removeRuleGroup(index) {
    setRuleGroupsDraft((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
  }

  function updateRuleReward(index, metricKey, enabled, amount) {
    setRuleGroupsDraft((prev) =>
      prev.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        return {
          ...entry,
          rewards: {
            ...entry.rewards,
            [metricKey]: enabled
              ? Math.max(0, Number(amount ?? entry.rewards?.[metricKey] ?? 1))
              : 0,
          },
        };
      })
    );
  }

  function updateWeekly(patch) {
    setWeeklyDraft((prev) => normalizeWeeklyDraft({ ...(prev || {}), ...patch }));
  }

  function updateWeeklyPosition(index, patch) {
    setWeeklyDraft((prev) =>
      normalizeWeeklyDraft({
        ...(prev || {}),
        positions: (prev?.positions || []).map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
      })
    );
  }

  function updateCheckInDay(index, patch) {
    setCheckInDraft((prev) => {
      const rewards = (prev?.rewards || []).map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
      return normalizeCheckInDraft({ ...(prev || {}), rewards });
    });
  }

  function applyWeeklyPreset(type) {
    setWeeklyDraft((prev) => {
      const current = normalizeWeeklyDraft(prev || {});
      const winnersCount = type === "top3" ? 3 : type === "top5" ? 5 : 10;
      const next = { ...current, winners_count: winnersCount };
      const basePositions = normalizeWeeklyPositions(next);

      if (type === "equal") {
        next.positions = basePositions.map((entry) => ({
          ...entry,
          reward_type: current?.fallback_reward_type || "cash_prize",
          reward_value: current?.positions?.[0]?.reward_value || 10,
          label: `${entry.position}º lugar`,
        }));
        return normalizeWeeklyDraft(next);
      }

      next.positions = basePositions.map((entry, index) => ({
        ...entry,
        reward_type: current?.positions?.[index]?.reward_type || current?.fallback_reward_type || "cash_prize",
        reward_value: current?.positions?.[index]?.reward_value || Math.max(5, winnersCount - index) * 5,
        label: current?.positions?.[index]?.label || `${entry.position}º lugar`,
      }));
      return normalizeWeeklyDraft(next);
    });
  }

  function applyGamificationPreset(presetId) {
    const preset = GAMIFICATION_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    setRuleGroupsDraft(preset.groups.map((group, index) => buildRuleGroupFromPreset(group, index)));
    setCheckInDraft({
      enabled: true,
      rewards: preset.dailyCheckInPoints.map((points, index) => ({
        day: index + 1,
        label: `Dia ${index + 1}`,
        weekly_points: Number(points || 0),
        active: true,
      })),
    });
    setActiveSection("rules");
    toast({
      title: "Lógica aplicada na tela",
      description: `${preset.label} carregado. Revise e salve quando estiver do jeito que você quer.`,
    });
  }

  function generateSystemSummary() {
    setSystemSummary(
      buildSystemSummary({
        weeklyDraft,
        ruleGroupsDraft,
        checkInDraft,
        dailyChestConfig,
      })
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-emerald-700/40 bg-gradient-to-br from-slate-900/85 to-emerald-950/40 p-6">
        <h2 className="text-2xl font-black text-white">Gamificação e Ranking</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Configure pontos, XP, check-in, Top Semanal e recompensas com linguagem operacional. A execução continua authoritative no backend.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Usuários ativos</p>
            <p className="mt-2 text-2xl font-black text-white">{overview?.overview?.users ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Regras ligadas</p>
            <p className="mt-2 text-2xl font-black text-white">{overview?.overview?.activeRules ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ciclo da semana</p>
            <p className="mt-2 text-sm font-bold text-white">{overview?.activeCycle?.title || "Sem ciclo ativo"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Líder atual</p>
            <p className="mt-2 text-sm font-bold text-white">{overview?.topWeekly?.[0]?.nick || "Sem dados ainda"}</p>
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "overview", label: "Visão geral" },
            { id: "checkin", label: "Check-in diário" },
            { id: "rules", label: "Regras de pontos" },
            { id: "weekly", label: "Top semanal" },
            { id: "results", label: "Resultado Top Semanal" },
            { id: "summary", label: "Resumo do sistema" },
          ].map((section) => (
            <Button
              key={section.id}
              type="button"
              variant="outline"
              onClick={() => setActiveSection(section.id)}
              className={
                activeSection === section.id
                  ? "border-emerald-400 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  : "border-slate-700 bg-slate-950/60 text-white"
              }
            >
              {section.label}
            </Button>
          ))}
        </div>
      </Card>

      {warnings.length > 0 ? (
        <Card className="border-amber-500/20 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-amber-100">Avisos automáticos</p>
          <div className="mt-3 space-y-2">
            {warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-50">
                {warning}
              </p>
            ))}
          </div>
        </Card>
      ) : null}

      {activeSection === "overview" ? (
        <Card className="border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Lógicas prontas para aplicar</h3>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Escolha uma linha de balanceamento para carregar automaticamente check-in e regras principais. Depois você só ajusta o fino.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              <p className="font-semibold text-white">Objetivo recomendado</p>
              <p className="mt-1">Depósito acelera mais, mas uso diário ainda mantém chance real de Top 10.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {GAMIFICATION_PRESETS.map((preset) => (
              <div key={preset.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-white">{preset.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-300">{preset.badge}</p>
                  </div>
                  <Button type="button" onClick={() => applyGamificationPreset(preset.id)} className="bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
                    Aplicar
                  </Button>
                </div>
                <p className="mt-3 text-sm text-slate-300">{preset.description}</p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <p className="font-semibold text-white">Check-in de 7 dias</p>
                  <p className="mt-1">{preset.dailyCheckInPoints.join(" • ")} pontos semanais</p>
                </div>
                <div className="mt-4 space-y-2">
                  {preset.notes.map((note) => (
                    <p key={`${preset.id}-${note}`} className="text-sm text-slate-400">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeSection === "checkin" && checkInDraft ? (
        <Card className="border-emerald-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-emerald-200">Check-in diário</h3>
              <p className="mt-1 text-sm text-slate-400">
                Ligue ou desligue o check-in e defina a progressão real dos 7 dias. Esses pontos entram no Top Semanal pelo backend.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Ativo</span>
              <Switch checked={Boolean(checkInDraft.enabled)} onCheckedChange={(checked) => setCheckInDraft((prev) => ({ ...(prev || {}), enabled: checked }))} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {checkInDraft.rewards.map((reward, index) => (
              <div key={reward.day} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">Dia {reward.day}</p>
                  <Switch checked={reward.active !== false} onCheckedChange={(checked) => updateCheckInDay(index, { active: checked })} />
                </div>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-200">Nome curto</Label>
                    <Input value={reward.label} onChange={(event) => updateCheckInDay(index, { label: event.target.value })} className={inputClassName} />
                    <FieldHint>Texto operacional para identificar esse dia no painel.</FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-200">Pontos do Top Semanal</Label>
                    <Input type="number" min="0" value={reward.weekly_points} onChange={(event) => updateCheckInDay(index, { weekly_points: Number(event.target.value || 0) })} className={inputClassName} />
                    <FieldHint>Valor entregue quando esse dia da progressão é coletado.</FieldHint>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={() => saveCheckInMutation.mutate()} disabled={saveCheckInMutation.isPending} className="mt-6 bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
            {saveCheckInMutation.isPending ? "Salvando..." : "Salvar check-in"}
          </Button>
        </Card>
      ) : null}

      {activeSection === "rules" ? (
      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-cyan-200">Regras de XP, pontos e bilhetes</h3>
            <p className="mt-1 text-sm text-slate-400">
              Aqui você monta uma regra de negócio e pode marcar várias recompensas ao mesmo tempo. O sistema salva isso como regras authoritative no backend.
            </p>
          </div>
          <Button type="button" onClick={() => setRuleGroupsDraft((prev) => [...prev, buildRuleGroupDraft()])} className="bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
            Nova regra
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {ruleGroupsDraft.map((group, index) => (
            <div key={group.group_id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-white">{group.name || `Regra ${index + 1}`}</p>
                  <p className="mt-1 max-w-3xl text-sm text-slate-400">{buildRuleSummary(group)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm(`Excluir a regra "${group.name || `Regra ${index + 1}`}"?`)) return;
                      removeRuleGroup(index);
                    }}
                    className="border-rose-700/70 bg-rose-950/40 text-rose-100 hover:bg-rose-900/60"
                  >
                    Excluir regra
                  </Button>
                  <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Ativa</span>
                    <Switch checked={Boolean(group.active)} onCheckedChange={(checked) => updateRuleGroup(index, { active: checked })} />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Nome da regra</Label>
                  <Input value={group.name} onChange={(event) => updateRuleGroup(index, { name: event.target.value })} className={inputClassName} />
                  <FieldHint>Nome visível para operação do dia a dia.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Quando acontecer</Label>
                  <select value={group.source_event} onChange={(event) => updateRuleGroup(index, { source_event: event.target.value })} className={selectClassName}>
                    {EVENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldHint>{EVENT_OPTIONS.find((option) => option.value === group.source_event)?.description}</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Valor mínimo / condição</Label>
                  <Input type="number" value={group.condition_min} onChange={(event) => updateRuleGroup(index, { condition_min: Number(event.target.value || 0) })} className={inputClassName} />
                  <FieldHint>Use para valor mínimo do depósito ou outra trava numérica do gatilho.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Faixa / passo</Label>
                  <Input type="number" min="1" value={group.condition_step} onChange={(event) => updateRuleGroup(index, { condition_step: Number(event.target.value || 1) })} className={inputClassName} />
                  <FieldHint>Exemplo: a cada R$ 20 aprovados, ou a cada 1 evento.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Limite</Label>
                  <select value={group.limit_scope} onChange={(event) => updateRuleGroup(index, { limit_scope: event.target.value })} className={selectClassName}>
                    {LIMIT_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldHint>{LIMIT_SCOPE_OPTIONS.find((option) => option.value === group.limit_scope)?.description}</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Quantidade do limite</Label>
                  <Input type="number" value={group.limit_count} onChange={(event) => updateRuleGroup(index, { limit_count: Number(event.target.value || 0) })} className={inputClassName} />
                  <FieldHint>Preencha só quando quiser limitar quantas vezes a regra vale.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Prioridade</Label>
                  <Input type="number" value={group.priority} onChange={(event) => updateRuleGroup(index, { priority: Number(event.target.value || 100) })} className={inputClassName} />
                  <FieldHint>Use prioridade menor para regras mais importantes na ordem de leitura.</FieldHint>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-slate-200">Descrição da regra</Label>
                  <Textarea value={group.description} onChange={(event) => updateRuleGroup(index, { description: event.target.value })} rows={2} className={inputClassName} />
                  <FieldHint>Texto para explicar quando e por que essa regra existe.</FieldHint>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Recompensas da regra</p>
                  <p className="text-xs text-slate-400">
                    Marque tudo o que essa ação deve gerar. Assim você não precisa cadastrar várias regras iguais.
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {METRIC_OPTIONS.map((metric) => {
                    const enabled = Number(group.rewards?.[metric.value] || 0) > 0;
                    return (
                      <div key={`${group.group_id}-${metric.value}`} className={`rounded-2xl border p-3 ${metric.colorClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{metric.label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-inherit/80">{metric.description}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => updateRuleReward(index, metric.value, event.target.checked, enabled ? group.rewards?.[metric.value] : 1)}
                            className="mt-1 h-4 w-4 rounded border-white/40 bg-transparent"
                          />
                        </div>
                        <div className="mt-3">
                          <Label className="text-[11px] uppercase tracking-wide text-inherit/80">Quantidade</Label>
                          <Input
                            type="number"
                            min="0"
                            value={enabled ? group.rewards?.[metric.value] || 0 : ""}
                            placeholder="0"
                            disabled={!enabled}
                            onChange={(event) => updateRuleReward(index, metric.value, true, Number(event.target.value || 0))}
                            className="mt-1 border-white/15 bg-black/20 text-white placeholder:text-white/40 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => saveRulesMutation.mutate()} disabled={saveRulesMutation.isPending} className="mt-6 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
          {saveRulesMutation.isPending ? "Salvando..." : "Salvar regras"}
        </Button>
      </Card>
      ) : null}

      {activeSection === "weekly" && weeklyDraft ? (
        <Card className="border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-amber-200">Top Semanal</h3>
              <p className="mt-1 text-sm text-slate-400">
                Defina se o box aparece para o público, o título exibido, a janela do ciclo e como cada posição recebe o prêmio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openCycleMutation.mutate()} className="border-slate-700 bg-slate-950/70 text-white">
                Abrir ciclo
              </Button>
              {cycles[0]?.id ? (
                <Button type="button" variant="outline" onClick={() => closeCycleMutation.mutate(cycles[0].id)} className="border-rose-700/70 bg-rose-950/40 text-rose-100">
                  Fechar ciclo
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Exibir para o público</p>
                  <p className="mt-1 text-xs text-slate-400">Desligue para esconder o box do Top Semanal no app.</p>
                </div>
                <Switch
                  checked={Boolean(weeklyDraft.enabled && weeklyDraft.active)}
                  onCheckedChange={(checked) => updateWeekly({ enabled: checked, active: checked })}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-slate-200">Título público</Label>
              <Input value={weeklyDraft.title || ""} onChange={(event) => updateWeekly({ title: event.target.value })} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Texto de apoio</Label>
              <Input value={weeklyDraft.subtitle || ""} onChange={(event) => updateWeekly({ subtitle: event.target.value })} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Duração em dias</Label>
              <Input type="number" value={weeklyDraft.cycle_days || 7} onChange={(event) => updateWeekly({ cycle_days: Number(event.target.value || 7) })} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Quantidade de premiados</Label>
              <Input type="number" min="1" max="100" value={weeklyDraft.winners_count || 10} onChange={(event) => updateWeekly({ winners_count: Number(event.target.value || 10) })} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Data e hora de início</Label>
              <Input type="datetime-local" value={weeklyDraft.starts_at || ""} onChange={(event) => updateWeekly({ starts_at: event.target.value })} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Data e hora de fim</Label>
              <Input type="datetime-local" value={weeklyDraft.ends_at || ""} onChange={(event) => updateWeekly({ ends_at: event.target.value })} className={inputClassName} />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Presets rápidos</p>
                <p className="text-xs text-slate-400">Crie uma estrutura pronta e depois ajuste só o necessário.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => applyWeeklyPreset("top3")} className="border-slate-700 bg-slate-900 text-white">
                  Top 3
                </Button>
                <Button type="button" variant="outline" onClick={() => applyWeeklyPreset("top5")} className="border-slate-700 bg-slate-900 text-white">
                  Top 5
                </Button>
                <Button type="button" variant="outline" onClick={() => applyWeeklyPreset("top10")} className="border-slate-700 bg-slate-900 text-white">
                  Top 10
                </Button>
                <Button type="button" variant="outline" onClick={() => applyWeeklyPreset("equal")} className="border-slate-700 bg-slate-900 text-white">
                  Prêmio igual
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Texto do popup "Como ganhar pontos"</p>
                <p className="mt-1 text-xs text-slate-400">
                  Esse conteúdo aparece no popup público do link de ajuda. Você pode gerar automático pelas regras ativas e depois ajustar manualmente.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateWeekly({
                    instructions: buildWeeklyInstructionsFromSystem({
                      weeklyDraft,
                      ruleGroupsDraft,
                      checkInDraft,
                    }),
                  })
                }
                className="border-amber-500/50 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
              >
                Gerar regras automáticas
              </Button>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label className="text-slate-200">Instruções do popup</Label>
              <Textarea
                value={weeklyDraft.instructions || ""}
                onChange={(event) => updateWeekly({ instructions: event.target.value })}
                rows={8}
                className={inputClassName}
              />
              <FieldHint>Salve aqui para refletir no popup aberto pelo botão/link de "Como ganhar pontos" no público.</FieldHint>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(weeklyDraft.positions || []).map((position, index) => (
              <div key={`${position.position}-${index}`} className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-[120px_1fr_160px_120px_90px]">
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Posição</Label>
                  <Input value={position.position} disabled className={inputClassName} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Label amigável</Label>
                  <Input value={position.label || ""} onChange={(event) => updateWeeklyPosition(index, { label: event.target.value })} className={inputClassName} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Tipo de prêmio</Label>
                  <select value={position.reward_type} onChange={(event) => updateWeeklyPosition(index, { reward_type: event.target.value })} className={selectClassName}>
                    {WEEKLY_REWARD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Valor</Label>
                  <Input type="number" value={position.reward_value} onChange={(event) => updateWeeklyPosition(index, { reward_value: Number(event.target.value || 0) })} className={inputClassName} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ativo</span>
                  <Switch checked={position.active !== false} onCheckedChange={(checked) => updateWeeklyPosition(index, { active: checked })} />
                </div>
              </div>
            ))}
          </div>

          <Button onClick={() => saveWeeklyMutation.mutate()} disabled={saveWeeklyMutation.isPending} className="mt-6 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">
            {saveWeeklyMutation.isPending ? "Salvando..." : "Salvar top semanal"}
          </Button>
        </Card>
      ) : null}

      {activeSection === "results" ? (
        <WeeklyResultsSection cycles={cycles} queryClient={queryClient} />
      ) : null}

      {activeSection === "summary" ? (
        <Card className="border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Resumo atual do sistema</h3>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Gere um texto detalhado com a leitura atual de regras, pontuações, check-in, Top Semanal e Baú Diário. Sempre que você mudar algo, pode gerar de novo aqui.
              </p>
            </div>
            <Button type="button" onClick={generateSystemSummary} className="bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
              Gerar novo resumo
            </Button>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="space-y-1.5">
              <Label className="text-slate-200">Texto gerado</Label>
              <Textarea
                value={systemSummary}
                onChange={(event) => setSystemSummary(event.target.value)}
                rows={24}
                className={`${inputClassName} font-mono text-[12px] leading-6`}
                placeholder="Clique em 'Gerar novo resumo' para montar a explicação completa do sistema atual."
              />
              <FieldHint>Você pode regenerar a qualquer momento. O texto usa o estado atual do painel de gamificação e a configuração salva do Baú Diário.</FieldHint>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
