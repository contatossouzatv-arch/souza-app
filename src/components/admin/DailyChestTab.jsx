import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const REWARD_TYPE_OPTIONS = [
  { value: "xp_total", label: "XP", amountLabel: "Quantidade de XP", unitPlaceholder: "xp" },
  { value: "weekly_points", label: "Pontos semanais", amountLabel: "Quantidade de pontos", unitPlaceholder: "pontos" },
  { value: "engagement_points", label: "Pontos de engajamento", amountLabel: "Quantidade de pontos", unitPlaceholder: "pontos" },
  { value: "tickets_active", label: "Bilhetes", amountLabel: "Quantidade de bilhetes", unitPlaceholder: "bilhetes" },
  { value: "points_balance", label: "Banca / saldo", amountLabel: "Valor em R$", unitPlaceholder: "saldo" },
];

const RARITY_OPTIONS = [
  { value: "common", label: "Comum" },
  { value: "rare", label: "Raro" },
  { value: "epic", label: "Épico" },
  { value: "legendary", label: "Lendário" },
];

const VISUAL_THEME_OPTIONS = [
  { value: "aurora", label: "Aurora neon" },
  { value: "midnight", label: "Noite premium" },
  { value: "nebula", label: "Nebulosa" },
  { value: "teal", label: "Teal futurista" },
];

const ICON_OPTIONS = [
  { value: "sparkles", label: "Brilho" },
  { value: "gem", label: "Gema" },
  { value: "gift", label: "Presente" },
  { value: "star", label: "Estrela" },
  { value: "coins", label: "Moedas" },
];

const DEFAULT_REWARD = {
  id: "",
  title: "",
  subtitle: "",
  reward_type: "xp_total",
  reward_amount: 0,
  reward_unit: "xp",
  rarity: "rare",
  special_label: "",
  visual_theme: "aurora",
  icon: "sparkles",
  stock_total: 0,
  claimed_count: 0,
  weight: 1,
  grant_mode: "auto",
  gallery_image_url: "",
  active_from: "",
  active_until: "",
  applies_on: "",
  auto_apply: true,
  active: true,
  is_default: false,
  is_fallback: false,
  daily_cap: 0,
  sort_order: 100,
  asset_ref: "",
};

const EMPTY_REWARD = { ...DEFAULT_REWARD };

function normalizeRewardRecord(raw = {}) {
  return {
    ...DEFAULT_REWARD,
    ...raw,
    reward_type: raw?.reward_type ?? raw?.rewardType ?? DEFAULT_REWARD.reward_type,
    reward_amount: raw?.reward_amount ?? raw?.rewardAmount ?? DEFAULT_REWARD.reward_amount,
    reward_unit: raw?.reward_unit ?? raw?.rewardUnit ?? DEFAULT_REWARD.reward_unit,
    special_label: raw?.special_label ?? raw?.specialLabel ?? DEFAULT_REWARD.special_label,
    visual_theme: raw?.visual_theme ?? raw?.visualTheme ?? DEFAULT_REWARD.visual_theme,
    gallery_image_url: raw?.gallery_image_url ?? raw?.galleryImageUrl ?? DEFAULT_REWARD.gallery_image_url,
    stock_total: raw?.stock_total ?? raw?.stockTotal ?? DEFAULT_REWARD.stock_total,
    claimed_count: raw?.claimed_count ?? raw?.claimedCount ?? DEFAULT_REWARD.claimed_count,
    daily_cap: raw?.daily_cap ?? raw?.dailyCap ?? DEFAULT_REWARD.daily_cap,
    sort_order: raw?.sort_order ?? raw?.sortOrder ?? DEFAULT_REWARD.sort_order,
    auto_apply: raw?.auto_apply ?? raw?.autoApply ?? DEFAULT_REWARD.auto_apply,
    is_default: raw?.is_default ?? raw?.isDefault ?? DEFAULT_REWARD.is_default,
    is_fallback: raw?.is_fallback ?? raw?.isFallback ?? DEFAULT_REWARD.is_fallback,
    message_of_day: raw?.message_of_day ?? raw?.messageOfDay ?? "",
    applies_on: raw?.applies_on ?? raw?.appliesOn ?? DEFAULT_REWARD.applies_on,
    active_from: raw?.active_from ?? raw?.activeFrom ?? DEFAULT_REWARD.active_from,
    active_until: raw?.active_until ?? raw?.activeUntil ?? DEFAULT_REWARD.active_until,
  };
}

function selectClassName() {
  return "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400";
}

function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="mb-4">
        <h4 className="text-base font-bold text-white">{title}</h4>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-200">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function InfoPanel({ title, children, tone = "cyan" }) {
  const palette =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-50"
      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-50";

  return (
    <div className={`rounded-3xl border p-4 ${palette}`}>
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-2 space-y-2 text-sm leading-6">{children}</div>
    </div>
  );
}

function parseBooleanString(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value) === "true";
}

function getRewardTypeMeta(value) {
  return REWARD_TYPE_OPTIONS.find((entry) => entry.value === value) || REWARD_TYPE_OPTIONS[0];
}

function getRarityLabel(value) {
  return RARITY_OPTIONS.find((entry) => entry.value === value)?.label || "Raro";
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function toDateTimeLocalValue(date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const pad = (value) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function formatDateTimeLabel(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detectSchedulePreset(settings = {}) {
  const start = String(settings.daily_chest_schedule_start_at ?? "");
  const end = String(settings.daily_chest_schedule_end_at ?? "");

  if (!start && !end) {
    return "always";
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 0, 0);

  const startNext7 = new Date(now);
  startNext7.setHours(0, 0, 0, 0);
  const endNext7 = new Date(now);
  endNext7.setDate(endNext7.getDate() + 6);
  endNext7.setHours(23, 59, 0, 0);

  if (start === toDateTimeLocalValue(startToday) && end === toDateTimeLocalValue(endToday)) {
    return "today";
  }

  if (start === toDateTimeLocalValue(startNext7) && end === toDateTimeLocalValue(endNext7)) {
    return "next7";
  }

  return "";
}

function simulateRewards(rewards, openings = 1000) {
  const activeRewards = rewards.filter((entry) => entry.active !== false);
  const fallbackRewards = activeRewards.filter((entry) => entry.is_fallback);
  const limitedUsage = new Map();
  const results = new Map();
  let estimatedCashCost = 0;

  function canUseReward(reward) {
    const used = limitedUsage.get(reward.id) || 0;
    if (Number(reward.daily_cap || 0) > 0 && used >= Number(reward.daily_cap || 0)) {
      return false;
    }
    if (Number(reward.stock_total || 0) > 0 && used >= Number(reward.stock_total || 0)) {
      return false;
    }
    return true;
  }

  function pickReward() {
    const available = activeRewards.filter(canUseReward);
    const exactRewards = available.filter((entry) => !entry.is_fallback);
    const pool = exactRewards.length > 0 ? exactRewards : fallbackRewards;
    const totalWeight = pool.reduce((acc, entry) => acc + Math.max(0, Number(entry.weight || 0)), 0);
    if (pool.length === 0) {
      return null;
    }
    if (totalWeight <= 0) {
      return pool[0];
    }
    let cursor = Math.random() * totalWeight;
    for (const reward of pool) {
      cursor -= Math.max(0, Number(reward.weight || 0));
      if (cursor <= 0) {
        return reward;
      }
    }
    return pool[pool.length - 1];
  }

  for (let index = 0; index < openings; index += 1) {
    const chosen = pickReward();
    if (!chosen) {
      continue;
    }
    limitedUsage.set(chosen.id, (limitedUsage.get(chosen.id) || 0) + 1);
    results.set(chosen.id, {
      id: chosen.id,
      title: chosen.title,
      reward_type: chosen.reward_type,
      reward_amount: Number(chosen.reward_amount || 0),
      reward_unit: chosen.reward_unit || "",
      is_fallback: Boolean(chosen.is_fallback),
      count: (results.get(chosen.id)?.count || 0) + 1,
    });
    if (chosen.reward_type === "points_balance") {
      estimatedCashCost += Number(chosen.reward_amount || 0);
    }
  }

  return {
    openings,
    estimatedCashCost,
    entries: Array.from(results.values()).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
  };
}

function getRewardCashCost(reward) {
  if (reward.reward_type !== "points_balance") return 0;
  return Number(reward.reward_amount || 0);
}

function buildPlannerSuggestion(rewards, planner) {
  const activeRewards = rewards.filter((entry) => entry.active !== false);
  const nonFallback = activeRewards.filter((entry) => !entry.is_fallback);
  const fallback = activeRewards.find((entry) => entry.is_fallback) || null;
  const cashReward = nonFallback.find((entry) => entry.reward_type === "points_balance") || null;
  const openingsPerDay = Math.max(1, Number(planner.people || 0) * Math.max(1, Number(planner.spinsPerPerson || 0)));
  const dailyBudget = Math.max(0, Number(planner.dailyBudget || 0));
  const desiredCashPrizeCount = Math.max(0, Number(planner.cashPrizeCount || 0));
  const desiredCashPrizeValue = Math.max(0, Number(planner.cashPrizeValue || 0));

  let remainingBudget = dailyBudget;
  const suggestions = nonFallback.map((reward) => {
    const unitCost = getRewardCashCost(reward);
    const desiredCap = Math.max(0, Number(reward.daily_cap || 0));
    let suggestedCap = desiredCap;
    let estimatedUnitCost = unitCost;

    if (cashReward && reward.id === cashReward.id) {
      suggestedCap = desiredCashPrizeCount > 0 ? desiredCashPrizeCount : desiredCap;
      estimatedUnitCost = desiredCashPrizeValue > 0 ? desiredCashPrizeValue : unitCost;
    }

    if (estimatedUnitCost > 0) {
      const budgetCap = Math.floor(remainingBudget / estimatedUnitCost);
      suggestedCap =
        desiredCap > 0 && !(cashReward && reward.id === cashReward.id)
          ? Math.min(desiredCap, budgetCap)
          : Math.min(suggestedCap, budgetCap);
      remainingBudget -= suggestedCap * estimatedUnitCost;
    }

    const trafficShare = openingsPerDay > 0 ? (suggestedCap / openingsPerDay) * 100 : 0;
    return {
      id: reward.id,
      title: reward.title,
      rewardType: reward.reward_type,
      currentWeight: Number(reward.weight || 0),
      currentCap: desiredCap,
      suggestedCap,
      trafficShare,
      estimatedDailyCost: suggestedCap * estimatedUnitCost,
      suggestedAmount:
        cashReward && reward.id === cashReward.id && desiredCashPrizeValue > 0
          ? desiredCashPrizeValue
          : Number(reward.reward_amount || 0),
    };
  });

  const recommendedWeightBase = suggestions.reduce((acc, entry) => acc + Math.max(0, entry.suggestedCap), 0) || 1;
  const normalized = suggestions.map((entry) => ({
    ...entry,
    suggestedWeight: Math.max(1, Math.round((Math.max(0, entry.suggestedCap) / recommendedWeightBase) * 100)),
  }));

  return {
    openingsPerDay,
    dailyBudget,
    weeklyBudget: dailyBudget * 7,
    monthlyBudget: dailyBudget * 30,
    remainingBudget,
    suggestions: normalized.sort((a, b) => b.suggestedCap - a.suggestedCap || a.title.localeCompare(b.title)),
    fallbackTitle: fallback?.title || "Fallback não configurado",
    cashRewardId: cashReward?.id || "",
  };
}

export default function DailyChestTab() {
  const queryClient = useQueryClient();
  const [settingsDraft, setSettingsDraft] = React.useState({});
  const [rewardDraft, setRewardDraft] = React.useState(DEFAULT_REWARD);
  const [selectedRewardId, setSelectedRewardId] = React.useState("");
  const [simulation, setSimulation] = React.useState(null);
  const [planner, setPlanner] = React.useState({
    people: 200,
    spinsPerPerson: 5,
    dailyBudget: 500,
    cashPrizeCount: 50,
    cashPrizeValue: 10,
    cashWinsPerUserDay: 1,
  });
  const accessLinkReadyRef = React.useRef(false);
  const lastPersistedAccessLinkRef = React.useRef("");

  const { data } = useQuery({
    queryKey: ["admin-daily-chest-config-v2"],
    queryFn: () => base44.adminDailyChest.config(),
    staleTime: 10000,
  });

  React.useEffect(() => {
    setSettingsDraft(data?.settings || {});
    lastPersistedAccessLinkRef.current = String(data?.settings?.daily_chest_access_group_link ?? "");
  }, [data?.settings]);

  React.useEffect(() => {
    const rewards = Array.isArray(data?.rewards) ? data.rewards.map((entry) => normalizeRewardRecord(entry)) : [];
    if (rewards.length === 0) {
      setRewardDraft(EMPTY_REWARD);
      setSelectedRewardId("");
      return;
    }

    const selected = rewards.find((entry) => entry.id === selectedRewardId);
    if (selected) {
      setRewardDraft(selected);
      return;
    }

    const current = rewards.find((entry) => entry.id === rewardDraft.id);
    if (current) {
      setRewardDraft(current);
      setSelectedRewardId(current.id || "");
      return;
    }

    setRewardDraft(rewards[0]);
    setSelectedRewardId(rewards[0]?.id || "");
  }, [data?.rewards, rewardDraft.id, selectedRewardId]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => base44.adminDailyChest.saveSettings(settingsDraft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
      toast({ title: "Configuração salva", description: "Regras e disponibilidade do Baú Diário foram atualizadas." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao salvar", description: error?.message || "Tente novamente." });
    },
  });

  const saveRewardMutation = useMutation({
    mutationFn: () => {
      const payload = normalizeRewardRecord(rewardDraft);
      if (rewardDraft.id) {
        return base44.adminDailyChest.updateReward(rewardDraft.id, payload);
      }
      return base44.adminDailyChest.createReward(payload);
    },
    onSuccess: (result) => {
      const normalized = normalizeRewardRecord(result || rewardDraft);
      setRewardDraft(normalized);
      setSelectedRewardId(normalized.id || "");
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
      toast({ title: "Prêmio salvo", description: "O pool do Baú Diário foi persistido no backend." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao salvar prêmio", description: error?.message || "Tente novamente." });
    },
  });

  const deleteRewardMutation = useMutation({
    mutationFn: (rewardId) => base44.adminDailyChest.deleteReward(rewardId),
    onSuccess: (_result, rewardId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
      if (String(selectedRewardId || "") === String(rewardId || "")) {
        setRewardDraft(EMPTY_REWARD);
        setSelectedRewardId("");
      }
      toast({ title: "Prêmio excluído", description: "O prêmio do Baú Diário foi removido do pool." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao excluir prêmio", description: error?.message || "Tente novamente." });
    },
  });

  const generateAccessCodeMutation = useMutation({
    mutationFn: (customCode = "") => base44.adminDailyChest.generateAccessCode(customCode),
    onSuccess: (result) => {
      setSettingsDraft((prev) => ({
        ...prev,
        daily_chest_access_code: result?.code || "",
        daily_chest_access_code_day_key: result?.chestDayKey || "",
      }));
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
      toast({
        title: "Chave gerada",
        description: `Codigo ${result?.code || ""} salvo para o ciclo ${result?.chestDayKey || "-"}.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao gerar chave",
        description: error?.message || "Tente novamente.",
      });
    },
  });

  const saveAccessGroupLinkMutation = useMutation({
    mutationFn: (link) =>
      base44.adminDailyChest.saveSettings({
        daily_chest_access_group_link: link,
      }),
    onSuccess: () => {
      lastPersistedAccessLinkRef.current = String(settingsDraft.daily_chest_access_group_link ?? "");
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao salvar link",
        description: error?.message || "Tente novamente.",
      });
    },
  });

  const applyPlannerMutation = useMutation({
    mutationFn: async () => {
      const cashRewardId = plannerSuggestion.cashRewardId;
      if (!cashRewardId) {
        throw new Error("Cadastre e ative um prêmio do tipo Banca / saldo para aplicar a sugestão.");
      }

      const targetSuggestion = plannerSuggestion.suggestions.find((entry) => entry.id === cashRewardId);
      if (!targetSuggestion) {
        throw new Error("Não foi possível montar a sugestão para o prêmio em dinheiro.");
      }

      const cashReward = configuredRewards.find((entry) => entry.id === cashRewardId);
      if (!cashReward) {
        throw new Error("Prêmio em dinheiro não encontrado.");
      }

      await base44.adminDailyChest.saveSettings({
        ...settingsDraft,
        daily_chest_balance_wins_per_user_day: String(Math.max(0, Number(planner.cashWinsPerUserDay || 0))),
      });

      await base44.adminDailyChest.updateReward(cashRewardId, {
        ...cashReward,
        reward_amount: Number(planner.cashPrizeValue || targetSuggestion.suggestedAmount || cashReward.reward_amount || 0),
        daily_cap: Number(targetSuggestion.suggestedCap || 0),
        weight: Number(targetSuggestion.suggestedWeight || cashReward.weight || 1),
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-daily-chest-config-v2"] });
      toast({
        title: "Sugestão aplicada",
        description: "O prêmio em dinheiro e o limite por pessoa no dia foram atualizados.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao aplicar sugestão",
        description: error?.message || "Tente novamente.",
      });
    },
  });

  function updateSetting(key, value) {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateReward(patch) {
    setRewardDraft((prev) => ({ ...prev, ...patch }));
  }

  function applySchedulePreset(mode) {
    const now = new Date();
    if (mode === "always") {
      setSettingsDraft((prev) => ({
        ...prev,
        daily_chest_enabled: "true",
        daily_chest_schedule_start_at: "",
        daily_chest_schedule_end_at: "",
      }));
      return;
    }
    if (mode === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      setSettingsDraft((prev) => ({
        ...prev,
        daily_chest_enabled: "true",
        daily_chest_schedule_start_at: toDateTimeLocalValue(start),
        daily_chest_schedule_end_at: toDateTimeLocalValue(end),
      }));
      return;
    }
    if (mode === "next7") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 0, 0);
      setSettingsDraft((prev) => ({
        ...prev,
        daily_chest_enabled: "true",
        daily_chest_schedule_start_at: toDateTimeLocalValue(start),
        daily_chest_schedule_end_at: toDateTimeLocalValue(end),
      }));
    }
  }

  const rewardTypeMeta = getRewardTypeMeta(rewardDraft.reward_type);
  const selectedSchedulePreset = React.useMemo(() => detectSchedulePreset(settingsDraft), [settingsDraft]);
  const configuredRewards = React.useMemo(
    () => (Array.isArray(data?.rewards) ? data.rewards.map((entry) => normalizeRewardRecord(entry)) : []),
    [data?.rewards]
  );
  const dailyUsage = data?.dailyUsage || [];
  const chestOverview = data?.overview || {
    chestDayKey: "",
    totalDistributedToday: 0,
    fallbackDistributedToday: 0,
    balanceDistributedToday: 0,
    uniqueWinnersToday: 0,
  };
  const recentWinners = data?.recentWinners || [];
  const usageRows = React.useMemo(
    () =>
      dailyUsage
        .map((entry) => {
          const reward = configuredRewards.find((item) => item.id === entry.reward_config_id);
          const claimedCount = Number(entry.claimed_count || 0);
          const dailyCap = Number(reward?.daily_cap || 0);
          return {
            id: entry.reward_config_id,
            title: reward?.title || "Prêmio",
            claimedCount,
            rewardType: reward?.reward_type || "",
            rewardAmount: Number(reward?.reward_amount || 0),
            rewardUnit: reward?.reward_unit || "",
            isFallback: Boolean(reward?.is_fallback),
            dailyCap,
            usagePct: dailyCap > 0 ? Math.min(100, Math.round((claimedCount / dailyCap) * 100)) : 0,
          };
        })
        .sort((a, b) => b.claimedCount - a.claimedCount || a.title.localeCompare(b.title)),
    [configuredRewards, dailyUsage]
  );
  const nearLimitRewards = usageRows.filter((entry) => entry.dailyCap > 0 && entry.usagePct >= 80);
  const plannerSuggestion = React.useMemo(
    () => buildPlannerSuggestion(configuredRewards, planner),
    [configuredRewards, planner]
  );
  const chestWarnings = [];

  if (!configuredRewards.some((entry) => entry.is_fallback)) {
    chestWarnings.push("O pool não tem fallback ativo. Todo mundo precisa receber alguma recompensa.");
  }
  if (Number(settingsDraft.daily_chest_xp_per_open ?? 0) > 250) {
    chestWarnings.push("O XP por abertura está alto. Vale revisar para não inflar a progressão do app.");
  }
  const totalWeight = configuredRewards.filter((entry) => entry.active !== false && !entry.is_fallback).reduce((acc, entry) => acc + Number(entry.weight || 0), 0);
  if (totalWeight > 2000) {
    chestWarnings.push("O peso total dos prêmios especiais está alto. Pode deixar a distribuição difícil de prever.");
  }
  if (configuredRewards.some((entry) => !entry.is_fallback && Number(entry.daily_cap || 0) === 0 && Number(entry.stock_total || 0) === 0 && entry.reward_type === "points_balance")) {
    chestWarnings.push("Existe prêmio em saldo sem limite diário nem estoque total. Revise para evitar custo aberto demais.");
  }

  React.useEffect(() => {
    const currentLink = String(settingsDraft.daily_chest_access_group_link ?? "");
    if (!accessLinkReadyRef.current) {
      accessLinkReadyRef.current = true;
      return;
    }

    if (currentLink === lastPersistedAccessLinkRef.current) {
      return;
    }

    if (saveAccessGroupLinkMutation.isPending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveAccessGroupLinkMutation.mutate(currentLink);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [saveAccessGroupLinkMutation, saveAccessGroupLinkMutation.isPending, settingsDraft.daily_chest_access_group_link]);

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-cyan-700/40 bg-gradient-to-br from-slate-900/85 to-cyan-950/45 p-6">
        <h2 className="text-2xl font-black text-white">Baú Diário</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Organize a ativação, a abertura do baú, os bônus por depósito e o pool de prêmios sem lidar com chaves técnicas.
        </p>
      </Card>


      <Card className="border-emerald-700/40 bg-gradient-to-br from-slate-900/85 to-emerald-950/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Chave diaria de acesso</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Gere o codigo do dia a qualquer momento. Ele ja fica salvo automaticamente no backend e libera o bau base do reset.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Ciclo atual</p>
            <p className="mt-1">{settingsDraft.daily_chest_access_code_day_key || chestOverview.chestDayKey || "-"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <Field label="Link da comunidade / grupo">
              <Input
                value={settingsDraft.daily_chest_access_group_link ?? ""}
                onChange={(event) => updateSetting("daily_chest_access_group_link", event.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="border-slate-700 bg-slate-950/70 text-white"
              />
            </Field>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Codigo atual</p>
              <p className="mt-2 text-xl font-black tracking-[0.24em] text-cyan-200">
                {settingsDraft.daily_chest_access_code || "-"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Gere novamente se precisar trocar o codigo ainda no mesmo dia.
              </p>
            </div>
          </div>

          <div className="flex min-w-[220px] items-start">
            <Button
              type="button"
              onClick={() => generateAccessCodeMutation.mutate("")}
              disabled={generateAccessCodeMutation.isPending}
              className="w-full bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300"
            >
              {generateAccessCodeMutation.isPending ? "Gerando..." : settingsDraft.daily_chest_access_code ? "Gerar novamente" : "Gerar chave do dia"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Operação do dia</h3>
            <p className="mt-1 text-sm text-slate-400">
              Visão rápida de quantos prêmios já saíram e quem ganhou recentemente no Baú Diário.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Ciclo atual</p>
            <p className="mt-1">{chestOverview.chestDayKey || "-"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">Prêmios entregues hoje</p>
            <p className="mt-2 text-2xl font-black text-white">{formatNumber(chestOverview.totalDistributedToday)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">Bancas saídas hoje</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{formatNumber(chestOverview.balanceDistributedToday)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">Fallback usado hoje</p>
            <p className="mt-2 text-2xl font-black text-cyan-200">{formatNumber(chestOverview.fallbackDistributedToday)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">Usuários premiados hoje</p>
            <p className="mt-2 text-2xl font-black text-white">{formatNumber(chestOverview.uniqueWinnersToday)}</p>
          </div>
        </div>

        {nearLimitRewards.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-amber-100">Prêmios próximos do limite diário</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-amber-50">
              {nearLimitRewards.slice(0, 4).map((entry) => (
                <span key={`near-${entry.id}`} className="rounded-full border border-amber-400/20 bg-black/20 px-3 py-1">
                  {entry.title}: {entry.claimedCount}/{entry.dailyCap} ({entry.usagePct}%)
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <InfoPanel title="Últimos ganhadores do Baú Diário">
            {recentWinners.length === 0 ? (
              <p>Ainda não há premiações registradas neste ciclo.</p>
            ) : (
              recentWinners.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{entry.user_label}</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {entry.title}
                        {entry.reward_amount ? ` • ${entry.reward_amount} ${entry.reward_unit || ""}` : ""}
                      </p>
                      {entry.subtitle ? <p className="mt-1 text-xs text-slate-400">{entry.subtitle}</p> : null}
                    </div>
                    <div className="text-right text-xs text-slate-300">
                      <p className="font-semibold text-white">{getRarityLabel(entry.rarity)}</p>
                      <p className="mt-1">{formatDateTimeLabel(entry.claimed_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </InfoPanel>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-bold text-cyan-200">Configurações gerais</h3>
        <p className="mt-1 text-sm text-slate-400">
          Ajuste o comportamento do baú por grupos: ativação, abertura, reset, bônus por depósito e visual.
        </p>

        {chestWarnings.length > 0 ? (
          <div className="mt-4 space-y-2 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Avisos automáticos</p>
            {chestWarnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-50">
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Ativação" description="Controle se o Baú Diário está no ar e qual mensagem aparece para o usuário.">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => applySchedulePreset("always")}
                className={selectedSchedulePreset === "always" ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 bg-slate-950/60 text-white"}
              >
                Sempre ativo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applySchedulePreset("today")}
                className={selectedSchedulePreset === "today" ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 bg-slate-950/60 text-white"}
              >
                Só hoje
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applySchedulePreset("next7")}
                className={selectedSchedulePreset === "next7" ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 bg-slate-950/60 text-white"}
              >
                Próximos 7 dias
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Baú Diário ativo">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch
                    checked={parseBooleanString(settingsDraft.daily_chest_enabled, false)}
                    onCheckedChange={(checked) => updateSetting("daily_chest_enabled", checked ? "true" : "false")}
                  />
                </div>
              </Field>
              <Field label="XP por abertura" hint="XP garantido para cada baú realmente aberto.">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_xp_per_open ?? "18"}
                  onChange={(event) => updateSetting("daily_chest_xp_per_open", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Mensagem principal" hint="Texto curto que aparece como instrução do dia para o usuário.">
                <Textarea
                  value={settingsDraft.daily_chest_message_of_day ?? ""}
                  onChange={(event) => updateSetting("daily_chest_message_of_day", event.target.value)}
                  rows={3}
                  className="border-slate-700 bg-slate-950/70 text-white md:col-span-2"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Janela de disponibilidade" description="Defina um período de campanha quando o baú só pode funcionar entre datas específicas.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Início da campanha" hint="Opcional. Se vazio, começa imediatamente.">
                <Input
                  type="datetime-local"
                  value={settingsDraft.daily_chest_schedule_start_at ?? ""}
                  onChange={(event) => updateSetting("daily_chest_schedule_start_at", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Fim da campanha" hint="Opcional. Se vazio, o baú segue ativo sem data final.">
                <Input
                  type="datetime-local"
                  value={settingsDraft.daily_chest_schedule_end_at ?? ""}
                  onChange={(event) => updateSetting("daily_chest_schedule_end_at", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Regras de abertura" description="Defina quantos toques são necessários e quantos baús a pessoa ganha por dia.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Meta de toques para abrir">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_tap_goal ?? "4"}
                  onChange={(event) => updateSetting("daily_chest_tap_goal", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Baús base por dia" hint="Quantidade inicial sem considerar depósitos extras.">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_base_daily_chests ?? "1"}
                  onChange={(event) => updateSetting("daily_chest_base_daily_chests", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Máximo de bancas por pessoa no dia" hint="Use 1 para espalhar melhor as bancas entre mais pessoas.">
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={settingsDraft.daily_chest_balance_wins_per_user_day ?? "1"}
                  onChange={(event) => updateSetting("daily_chest_balance_wins_per_user_day", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Tema visual" hint="Define o visual principal da cena e da aura.">
                <select value={settingsDraft.daily_chest_scene_theme ?? "aurora"} onChange={(event) => updateSetting("daily_chest_scene_theme", event.target.value)} className={selectClassName()}>
                  {VISUAL_THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Reset diário" description="Escolha o horário e o fuso em que o baú renova.">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Hora do reset">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={settingsDraft.daily_chest_reset_hour ?? "0"}
                  onChange={(event) => updateSetting("daily_chest_reset_hour", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Minuto do reset">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={settingsDraft.daily_chest_reset_minute ?? "0"}
                  onChange={(event) => updateSetting("daily_chest_reset_minute", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Fuso horário">
                <Input
                  value={settingsDraft.daily_chest_timezone ?? "America/Sao_Paulo"}
                  onChange={(event) => updateSetting("daily_chest_timezone", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Bônus por depósito" description="Libere baús extras conforme depósitos aprovados ou por faixa de valor.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Bônus por depósito ligado">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch
                    checked={parseBooleanString(settingsDraft.daily_chest_deposit_bonus_enabled, false)}
                    onCheckedChange={(checked) => updateSetting("daily_chest_deposit_bonus_enabled", checked ? "true" : "false")}
                  />
                </div>
              </Field>
              <Field label="Baús extras por depósito aprovado">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_bonus_chests_per_approved ?? "1"}
                  onChange={(event) => updateSetting("daily_chest_bonus_chests_per_approved", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Faixa em R$ para bônus extra" hint="Use 0 para ignorar esse comportamento.">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_bonus_amount_step ?? "0"}
                  onChange={(event) => updateSetting("daily_chest_bonus_amount_step", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Baús extras por faixa" hint="Quantos baús ganham a cada faixa preenchida.">
                <Input
                  type="number"
                  value={settingsDraft.daily_chest_bonus_chests_per_step ?? "0"}
                  onChange={(event) => updateSetting("daily_chest_bonus_chests_per_step", event.target.value)}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Visual do baú" description="Defina a raridade visual padrão quando o usuário entra na experiência.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Raridade visual principal">
                <select value={settingsDraft.daily_chest_rarity_visual ?? "rare"} onChange={(event) => updateSetting("daily_chest_rarity_visual", event.target.value)} className={selectClassName()}>
                  {RARITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tema da cena" hint="Ajusta o estilo geral do palco 3D, partículas e aura.">
                <select value={settingsDraft.daily_chest_scene_theme ?? "aurora"} onChange={(event) => updateSetting("daily_chest_scene_theme", event.target.value)} className={selectClassName()}>
                  {VISUAL_THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>
        </div>

        <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending} className="mt-6 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
          {saveSettingsMutation.isPending ? "Salvando..." : "Salvar configurações do baú"}
          </Button>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-bold text-white">Planejador de gastos e distribuição</h3>
        <p className="mt-1 text-sm text-slate-400">
          Informe o volume esperado e o orçamento do dia para receber uma sugestão inicial de limites e pesos sem mexer na lógica do sistema.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard
            title="Cenário esperado"
            description="Esse bloco ajuda a planejar quantos giros podem acontecer e quanto você quer gastar por dia."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Pessoas esperadas no dia">
                <Input
                  type="number"
                  value={planner.people}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, people: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Giros por pessoa">
                <Input
                  type="number"
                  value={planner.spinsPerPerson}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, spinsPerPerson: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Orçamento diário em R$">
                <Input
                  type="number"
                  value={planner.dailyBudget}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, dailyBudget: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Quantidade de bancas no dia" hint="Quantas saídas em dinheiro você quer liberar nesse ciclo diário.">
                <Input
                  type="number"
                  value={planner.cashPrizeCount}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, cashPrizeCount: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Valor de cada banca em R$" hint="Ex.: 10 para soltar 50 bancas de R$10.">
                <Input
                  type="number"
                  value={planner.cashPrizeValue}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, cashPrizeValue: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Máximo de bancas por pessoa no dia" hint="Use 1 como padrão. Só aumente quando quiser uma campanha especial.">
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={planner.cashWinsPerUserDay}
                  onChange={(event) => setPlanner((prev) => ({ ...prev, cashWinsPerUserDay: Number(event.target.value || 0) }))}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Aberturas por dia</p>
                <p className="mt-2 text-2xl font-black text-white">{formatNumber(plannerSuggestion.openingsPerDay)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Gasto diário</p>
                <p className="mt-2 text-2xl font-black text-white">R$ {formatNumber(plannerSuggestion.dailyBudget)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Gasto semanal</p>
                <p className="mt-2 text-2xl font-black text-white">R$ {formatNumber(plannerSuggestion.weeklyBudget)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Gasto mensal</p>
                <p className="mt-2 text-2xl font-black text-white">R$ {formatNumber(plannerSuggestion.monthlyBudget)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
              <p>
                <span className="font-semibold text-white">Fallback atual:</span> {plannerSuggestion.fallbackTitle}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-white">Regra de banca por pessoa:</span> até {planner.cashWinsPerUserDay} no dia
              </p>
              <p className="mt-2">
                O planejador só sugere uma base. Você continua com o controle final dos limites, pesos e do custo diário.
              </p>
            </div>
          </SectionCard>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => applyPlannerMutation.mutate()}
              disabled={applyPlannerMutation.isPending}
              className="bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300"
            >
              {applyPlannerMutation.isPending ? "Aplicando..." : "Aplicar sugestão automática"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRewardDraft((prev) => ({
                  ...prev,
                  reward_type: "points_balance",
                  reward_amount: Number(planner.cashPrizeValue || prev.reward_amount || 0),
                  daily_cap: Number(planner.cashPrizeCount || prev.daily_cap || 0),
                }))
              }
              className="border-slate-700 bg-slate-950/60 text-white"
            >
              Levar para o editor de prêmio
            </Button>
          </div>

          <SectionCard
            title="Sugestão automática de balanceamento"
            description="Use isso como ponto de partida para deixar o app divertido sem perder o controle de gastos."
          >
            <div className="space-y-3">
              {plannerSuggestion.suggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-5 text-sm text-slate-400">
                  Ative e configure pelo menos um prêmio limitado para receber sugestões automáticas.
                </div>
              ) : (
                plannerSuggestion.suggestions.map((entry) => (
                  <div key={`planner-${entry.id}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{entry.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Cap sugerido: {formatNumber(entry.suggestedCap)} por dia â€¢ Peso sugerido: {formatNumber(entry.suggestedWeight)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/5 px-3 py-2 text-right text-xs text-slate-200">
                        <p>Atual: cap {formatNumber(entry.currentCap)}</p>
                        <p>Atual: peso {formatNumber(entry.currentWeight)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                      <p>Participação estimada: {entry.trafficShare.toFixed(1)}% das aberturas</p>
                      <p>Custo diário estimado: R$ {formatNumber(entry.estimatedDailyCost)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-emerald-200">Pool de prêmios</h3>
            <p className="mt-1 text-sm text-slate-400">
              Monte prêmios limitados, especiais e um fallback garantido. O formulário se adapta ao tipo escolhido.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => { setRewardDraft(EMPTY_REWARD); setSelectedRewardId(""); }} className="border-slate-700 bg-slate-950/60 text-white">
            Novo prêmio
          </Button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <InfoPanel title="Como funciona a porcentagem de ganho">
            <p>
              A <span className="font-semibold text-white">chance de sorteio</span> funciona como um{" "}
              <span className="font-semibold text-white">peso relativo</span> entre os prêmios limitados que ainda podem sair.
            </p>
            <p>
              Exemplo: um prêmio com peso <span className="font-semibold text-white">60</span> tende a sair mais que um com peso{" "}
              <span className="font-semibold text-white">30</span>.
            </p>
            <p>
              O <span className="font-semibold text-white">fallback</span> não disputa com os prêmios especiais enquanto ainda existir prêmio limitado disponível.
              Ele entra quando os melhores acabam ou batem no limite.
            </p>
          </InfoPanel>

          <InfoPanel title="Exemplo prático: 200 pessoas e 5 giros por dia" tone="amber">
            <p>
              Se 200 pessoas fizerem 5 giros, o sistema pode ter perto de <span className="font-semibold text-white">1000 aberturas no dia</span>.
            </p>
            <p>
              Se você quer distribuir só <span className="font-semibold text-white">50 bancas</span>, crie esse prêmio com{" "}
              <span className="font-semibold text-white">limite diário 50</span>. Assim ele nunca passa disso.
            </p>
            <p>
              O resto do volume pode ser dividido entre XP, pontos, bilhetes e outros prêmios menores. Todo mundo ainda recebe algo por causa do fallback.
            </p>
          </InfoPanel>

          <InfoPanel title="Passo a passo para montar um pool equilibrado">
            <p>1. Estime quantos giros totais você quer liberar no dia.</p>
            <p>2. Coloque limite diário nos prêmios mais caros.</p>
            <p>3. Use os pesos para equilibrar a saída entre os limitados.</p>
            <p>4. Deixe um fallback ativo para garantir recompensa para todos.</p>
          </InfoPanel>

          <InfoPanel title="Exemplo de configuração equilibrada">
            <p><span className="font-semibold text-white">Banca R$10</span>: peso 15, limite diário 50</p>
            <p><span className="font-semibold text-white">Bilhetes extras</span>: peso 35, limite diário 180</p>
            <p><span className="font-semibold text-white">Pontos semanais</span>: peso 45, limite diário 260</p>
            <p><span className="font-semibold text-white">XP</span>: fallback ativo, sem limite</p>
          </InfoPanel>

          <InfoPanel title="Se só está vindo XP">
            <p>Verifique se os outros prêmios estão ativos.</p>
            <p>Confirme se o limite diário deles não já foi atingido.</p>
            <p>Revise se o peso dos prêmios especiais não está zerado ou muito baixo.</p>
            <p>Use a simulação de 1000 aberturas antes de salvar.</p>
          </InfoPanel>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="Editor do prêmio" description="Configure como esse prêmio aparece, quanto distribui e quais limites precisa respeitar.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do prêmio">
                <Input value={rewardDraft.title ?? ""} onChange={(event) => updateReward({ title: event.target.value })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>
              <Field label="Tipo do prêmio">
                <select
                  value={rewardDraft.reward_type}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    updateReward({
                      reward_type: nextType,
                      reward_unit: getRewardTypeMeta(nextType).unitPlaceholder,
                    });
                  }}
                  className={selectClassName()}
                >
                  {REWARD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={rewardTypeMeta.amountLabel}>
                <Input
                  type="number"
                  value={rewardDraft.reward_amount ?? 0}
                  onChange={(event) => updateReward({ reward_amount: Number(event.target.value || 0) })}
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </Field>
              <Field label="Unidade exibida" hint="Ex.: XP, bilhetes, saldo, pontos.">
                <Input value={rewardDraft.reward_unit ?? ""} onChange={(event) => updateReward({ reward_unit: event.target.value })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>

              <Field label="Chance de sorteio" hint="Peso relativo do prêmio dentro do pool.">
                <Input type="number" value={rewardDraft.weight ?? 0} onChange={(event) => updateReward({ weight: Number(event.target.value || 0) })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>
              <Field label="Máximo de ganhadores por dia" hint="Use 0 para ilimitado por dia.">
                <Input type="number" value={rewardDraft.daily_cap ?? 0} onChange={(event) => updateReward({ daily_cap: Number(event.target.value || 0) })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>

              <Field label="Estoque total" hint="Use 0 para sem limite global.">
                <Input type="number" value={rewardDraft.stock_total ?? 0} onChange={(event) => updateReward({ stock_total: Number(event.target.value || 0) })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>
              <Field label="Ordem de exibição" hint="Apenas organiza visualmente a lista no admin.">
                <Input type="number" value={rewardDraft.sort_order ?? 100} onChange={(event) => updateReward({ sort_order: Number(event.target.value || 0) })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>

              <Field label="Mensagem exibida" hint="Texto curto que ajuda o usuário a entender o prêmio.">
                <Textarea value={rewardDraft.subtitle ?? ""} onChange={(event) => updateReward({ subtitle: event.target.value })} rows={3} className="border-slate-700 bg-slate-950/70 text-white md:col-span-2" />
              </Field>

              <Field label="Raridade visual">
                <select value={rewardDraft.rarity ?? "rare"} onChange={(event) => updateReward({ rarity: event.target.value })} className={selectClassName()}>
                  {RARITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ícone principal">
                <select value={rewardDraft.icon ?? "sparkles"} onChange={(event) => updateReward({ icon: event.target.value })} className={selectClassName()}>
                  {ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tema visual do prêmio">
                <select value={rewardDraft.visual_theme ?? "aurora"} onChange={(event) => updateReward({ visual_theme: event.target.value })} className={selectClassName()}>
                  {VISUAL_THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Imagem / arte da galeria" hint="Opcional. Use uma URL quando quiser uma arte própria na galeria de prêmios.">
                <Input value={rewardDraft.gallery_image_url ?? ""} onChange={(event) => updateReward({ gallery_image_url: event.target.value })} className="border-slate-700 bg-slate-950/70 text-white" />
              </Field>

              <Field label="Ativo">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch checked={Boolean(rewardDraft.active)} onCheckedChange={(checked) => updateReward({ active: checked })} />
                </div>
              </Field>
              <Field label="Entrega automática">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch checked={Boolean(rewardDraft.auto_apply)} onCheckedChange={(checked) => updateReward({ auto_apply: checked })} />
                </div>
              </Field>
              <Field label="Prêmio fallback">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch checked={Boolean(rewardDraft.is_fallback)} onCheckedChange={(checked) => updateReward({ is_fallback: checked })} />
                </div>
              </Field>
              <Field label="Usar como prêmio padrão">
                <div className="flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3">
                  <Switch checked={Boolean(rewardDraft.is_default)} onCheckedChange={(checked) => updateReward({ is_default: checked })} />
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Resumo do prêmio" description="Confirme rapidamente o comportamento antes de salvar.">
            <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-lg font-bold text-white">{rewardDraft.title || "Novo prêmio"}</p>
              <p className="text-sm text-slate-300">{rewardDraft.subtitle || "Sem mensagem definida."}</p>
              <div className="grid gap-3 text-sm text-slate-300">
                <p>
                  <span className="font-semibold text-white">Tipo:</span> {rewardTypeMeta.label}
                </p>
                <p>
                  <span className="font-semibold text-white">Entrega:</span> {rewardDraft.reward_amount || 0} {rewardDraft.reward_unit || rewardTypeMeta.unitPlaceholder}
                </p>
                <p>
                  <span className="font-semibold text-white">Chance:</span> peso {rewardDraft.weight || 0}
                </p>
                <p>
                  <span className="font-semibold text-white">Limite diário:</span> {rewardDraft.daily_cap ? `${rewardDraft.daily_cap} por dia` : "sem limite diário"}
                </p>
                <p>
                  <span className="font-semibold text-white">Estoque total:</span> {rewardDraft.stock_total ? rewardDraft.stock_total : "ilimitado"}
                </p>
                <p>
                  <span className="font-semibold text-white">Fallback:</span> {rewardDraft.is_fallback ? "sim, garante recompensa" : "não"}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => saveRewardMutation.mutate()} disabled={saveRewardMutation.isPending} className="bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300">
          {saveRewardMutation.isPending ? "Salvando..." : "Salvar prêmio"}
        </Button>
          {rewardDraft.id ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteRewardMutation.mutate(rewardDraft.id)}
              disabled={deleteRewardMutation.isPending}
              className="border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20"
            >
              {deleteRewardMutation.isPending ? "Excluindo..." : "Excluir prêmio"}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-bold text-white">Prêmios configurados</h3>
        <p className="mt-1 text-sm text-slate-400">
          Clique em um prêmio para editar. Os limites e o uso do dia aparecem de forma operacional, sem abrir o banco mentalmente.
        </p>
        <div className="mt-4">
          <InfoPanel title="Como ler a lista de prêmios configurados">
            <p>
              <span className="font-semibold text-white">Hoje:</span> quantas vezes esse prêmio já saiu no dia atual.
            </p>
            <p>
              <span className="font-semibold text-white">Limite diário:</span> quantidade máxima que ele pode sair no dia.
            </p>
            <p>
              <span className="font-semibold text-white">Estoque:</span> limite total histórico, se você quiser travar uma campanha inteira.
            </p>
            <p>
              <span className="font-semibold text-white">Garantido:</span> significa fallback, usado para não deixar ninguém sem recompensa.
            </p>
          </InfoPanel>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {configuredRewards.map((entry) => {
            const usage = dailyUsage.find((item) => item.reward_config_id === entry.id);
            const typeMeta = getRewardTypeMeta(entry.reward_type);
            return (
              <button
                type="button"
                key={entry.id}
                  onClick={() => {
                    setRewardDraft(normalizeRewardRecord(entry));
                    setSelectedRewardId(String(entry.id || ""));
                  }}
                className="block w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-emerald-400/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{entry.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{typeMeta.label}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    {entry.is_fallback ? "Garantido" : "Limitado"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400">
                  <p>
                    {entry.reward_amount} {entry.reward_unit || typeMeta.unitPlaceholder} • {getRarityLabel(entry.rarity)}
                  </p>
                  <p>
                    Hoje: {usage?.claimed_count ?? 0}/{entry.daily_cap || "ilimitado"} • Estoque: {entry.claimed_count ?? 0}/{entry.stock_total || "ilimitado"}
                  </p>
                  <p>
                    Peso {entry.weight} • {entry.active ? "ativo" : "inativo"} • {entry.auto_apply ? "entrega automática" : "entrega manual"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Simulação rápida do baú</h3>
            <p className="mt-1 text-sm text-slate-400">
              Teste como o pool tende a se comportar em 1000 aberturas antes de alterar probabilidades e limites.
            </p>
          </div>
          <Button type="button" onClick={() => setSimulation(simulateRewards(configuredRewards, 1000))} className="bg-violet-400 font-bold text-slate-950 hover:bg-violet-300">
            Simular 1000 aberturas
          </Button>
        </div>

        {simulation ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Aberturas simuladas</p>
                <p className="mt-2 text-2xl font-black text-white">{formatNumber(simulation.openings)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Tipos distribuídos</p>
                <p className="mt-2 text-2xl font-black text-white">{formatNumber(simulation.entries.length)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Custo estimado em saldo</p>
                <p className="mt-2 text-2xl font-black text-white">R$ {formatNumber(simulation.estimatedCashCost)}</p>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {simulation.entries.map((entry) => {
                const meta = getRewardTypeMeta(entry.reward_type);
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{entry.title}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {entry.is_fallback ? "fallback" : meta.label.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatNumber(entry.count)} saídas • {entry.reward_amount} {entry.reward_unit || ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
