import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  createEntity,
  createSecurityEvent,
  deleteEntity,
  getAppSettingsMap,
  getEntityById,
  listEntity,
  normalizeRecord,
  normalizeUser,
  pool,
  updateEntity,
} from "../db/index.js";
import {
  listPlatformHistory,
  listProfileNotifications,
  listPublicProfileBasics,
  markProfileNotificationsRead,
} from "../services/profileReadService.js";
import { getCurrentPlatform, listActivePlatforms } from "../services/platformReadService.js";
import { deleteCacheKey, getCacheJson, getOrComputeCacheJson, setCacheJson, cacheMiss } from "../lib/cache.js";

const router = Router();

const BADGE_RULES_KEY = "achievement_badge_rules_v1";
const POINTS_RULES_KEY = "achievement_points_rules_v1";
const PROFILE_COMPETITION_KEY = "profile_competition_rules_v1";
const WEEKLY_TOP_CONFIG_KEY = "weekly_top_config_v2";
const DAILY_CHECKIN_CONFIG_KEY = "daily_checkin_config_v1";
const GAMIFICATION_STATE_TTL_MS = 60000;
const GAMIFICATION_RULES_TTL_MS = 60000;
const WEEKLY_CYCLE_TTL_MS = 30000;
const PROFILE_METRICS_TTL_MS = 45000;
const WINNERS_HISTORY_TTL_MS = 60000;
const HOME_SUMMARY_TTL_MS = 120000;
const HOME_FEED_SUMMARY_TTL_MS = 30000;
const PUBLIC_UI_CONFIG_TTL_MS = 60000;
const PUBLIC_PROFILE_SUMMARY_TTL_MS = 30000;
const PROFILE_PRIZE_GALLERY_TTL_MS = 20000;

const DEFAULT_POINTS_RULES = {
  points_per_participation: 12,
  points_per_approved_deposit: 8,
  amount_step_value: 10,
  points_per_amount_step: 1,
  points_per_win: 50,
  progress_target_participations: 25,
  live_badge_target: 30,
};

const DEFAULT_WEEKLY_CONFIG = {
  enabled: false,
  title: "Top Semanal",
  subtitle: "Acumule pontos durante o ciclo para subir no ranking.",
  instructions:
    "1) Some pontos nas ações ativas do app.\n2) Só contam os pontos semanais do ciclo atual.\n3) Ao fim do contador, o ranking fecha e reinicia.\n4) Confira no botão de ajuda quais ações estão pontuando hoje.",
  cycle_days: 7,
  starts_at: "",
  ends_at: "",
  reward_currency: "BRL",
  winners_count: 10,
  positions: [
    { position: 1, reward_type: "cash_prize", reward_value: 20, label: "1º Lugar" },
    { position: 2, reward_type: "cash_prize", reward_value: 20, label: "2º Lugar" },
    { position: 3, reward_type: "cash_prize", reward_value: 20, label: "3º Lugar" },
  ],
  fallback_reward_type: "cash_prize",
  fallback_reward_value: 20,
  active: false,
};

let gamificationStateCache = {
  value: null,
  expiresAt: 0,
};

let gamificationStatePromise = null;
let gamificationRulesCache = {
  value: null,
  expiresAt: 0,
  promise: null,
};
let weeklyCycleCache = {
  key: "",
  value: null,
  expiresAt: 0,
};
let profileMetricsCache = new Map();
let profileMetricsPromises = new Map();

const DEFAULT_DAILY_CHECKIN_CONFIG = {
  enabled: false,
  streak_days: 7,
  rewards: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    weekly_points: 0,
    label: `Dia ${index + 1}`,
    active: false,
  })),
};

const DEFAULT_BADGE_RULES = [
  { id: "starter-install", enabled: true, label: "Iniciante da Comunidade", metric: "totalParticipations", threshold: 0, icon: "star", color: "emerald", icon_url: "", description: "" },
  { id: "winner", enabled: true, label: "Ja ganhou premio no app", metric: "totalWins", threshold: 1, icon: "award", color: "pink", icon_url: "", description: "" },
  { id: "tickets-500", enabled: true, label: "Acumulou 500 bilhetes nos depositos", metric: "totalTickets", threshold: 500, icon: "trophy", color: "indigo", icon_url: "", description: "" },
  { id: "followers-50", enabled: true, label: "Atingiu 50 seguidores no perfil", metric: "totalFollowers", threshold: 50, icon: "heart", color: "pink", icon_url: "", description: "" },
  { id: "checkin-30", enabled: true, label: "Fez check in 30 dias no app", metric: "totalCheckins", threshold: 30, icon: "award", color: "cyan", icon_url: "", description: "" },
  { id: "live-10", enabled: true, label: "Participou de 10 lives", metric: "liveParticipations", threshold: 10, icon: "star", color: "cyan", icon_url: "", description: "" },
];

const ADMIN_ADJUSTABLE_METRICS = {
  xp_total: { label: "XP", cycleScoped: false },
  weekly_points: { label: "Pontos semanais", cycleScoped: true },
  engagement_points: { label: "Pontos de engajamento", cycleScoped: false },
  tickets_active: { label: "Bilhetes ativos", cycleScoped: false },
  tickets_bonus: { label: "Bilhetes bônus", cycleScoped: false },
  points_balance: { label: "Saldo / banca", cycleScoped: false, pointsLedger: true },
};

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clampInt(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  const base = 120;
  const growth = 1.28;
  return Math.floor(base * Math.pow(growth, safeLevel - 1));
}

function getLevelProgress(totalPoints) {
  const points = Math.max(0, Math.floor(Number(totalPoints || 0)));
  let level = 1;
  let spent = 0;
  let required = xpRequiredForLevel(level);

  while (points >= spent + required) {
    spent += required;
    level += 1;
    required = xpRequiredForLevel(level);
    if (level > 999) break;
  }

  const inLevel = points - spent;
  const pointsToNext = Math.max(0, required - inLevel);
  const progressPct = required > 0 ? Math.min(100, Math.round((inLevel / required) * 100)) : 0;

  return {
    level,
    inLevelPoints: inLevel,
    pointsRequired: required,
    pointsToNext,
    progressPct,
  };
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function normalizeEntityRecordRow(row) {
  if (!row) return null;
  const data = { ...(row.data || {}) };
  if (!data.id) data.id = row.id;
  if (!data.created_date) data.created_date = toIso(row.created_at);
  data.updated_date = toIso(row.updated_at);
  return data;
}

function buildHandle(nick = "", userId = "") {
  const base = String(nick || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "");
  return base || `usuario.${String(userId || "").slice(0, 6)}`;
}

function safeDate(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isInRange(dateValue, startsAt, endsAt) {
  const date = safeDate(dateValue);
  if (!date) return false;
  return date >= startsAt && date < endsAt;
}

function buildRequestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

function emitEntityChanged(req, entityName, entityId, action = "updated") {
  req.app?.locals?.io?.emit("entity:changed", {
    entity: entityName,
    entityName,
    entityId,
    action,
    emittedAt: new Date().toISOString(),
  });
}

function getCachedMapValue(cache, key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedMapValue(cache, key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

function inferPrizeSourceTypesFromAudit(audit = {}) {
  const raffleId = String(audit?.raffle_id || "").trim().toLowerCase();
  const raffleTitle = String(audit?.raffle_title || "").trim().toLowerCase();
  const gameCall = String(audit?.game_call || "").trim();

  if (raffleId === "depositant_draw") return ["deposit_draw"];
  if (gameCall) return ["game_call"];
  if (raffleTitle.includes("rápido") || raffleTitle.includes("rapido")) return ["instant_raffle"];
  if (raffleTitle.includes("ao vivo")) return ["live_draw"];
  return ["live_draw", "instant_raffle"];
}

function isPrizeGalleryMatchForAudit(item = {}, audit = {}) {
  if (String(item.user_id || "").trim() !== String(audit.user_id || "").trim()) return false;

  const allowedSourceTypes = inferPrizeSourceTypesFromAudit(audit);
  if (!allowedSourceTypes.includes(String(item.source_type || "").trim())) return false;

  const auditAmount = Number(audit.prize_amount || 0);
  const itemAmount = Number(item.reward_amount || 0);
  const metadata = item.metadata || {};

  if (String(item.source_type || "").trim() === "deposit_draw") {
    const auditCycle = String(audit.cycle_number || "").trim();
    return String(metadata.cycle_number || "").trim() === auditCycle && itemAmount === auditAmount;
  }

  const auditRaffleId = String(audit.raffle_id || "").trim();
  if (auditRaffleId && String(metadata.raffle_id || "").trim() === auditRaffleId && itemAmount === auditAmount) {
    return true;
  }

  const auditDate = new Date(audit.validated_at || audit.drawn_at || 0).getTime();
  const itemDate = new Date(item.claimed_at || item.created_date || item.updated_date || 0).getTime();
  if (Number.isFinite(auditDate) && Number.isFinite(itemDate)) {
    const diff = Math.abs(itemDate - auditDate);
    if (diff <= 1000 * 60 * 10 && itemAmount === auditAmount) return true;
  }

  return false;
}

function resolveAuditValidationCode(audit = {}, prizeItem = null) {
  return String(
    prizeItem?.metadata?.validation_code ||
      prizeItem?.metadata?.grant_result?.validationCode ||
      audit?.validation_code ||
      audit?.opening_id ||
      audit?.winner_id ||
      audit?.participant_id ||
      audit?.id ||
      ""
  ).trim();
}

function resolveAuditRewardType(audit = {}) {
  const normalized = String(audit?.reward_type || "").trim().toLowerCase();
  if (normalized === "points_balance" || normalized === "saldo" || normalized === "bonus") {
    return "points_balance";
  }
  return "cash_prize";
}

async function listAppSettingsMap() {
  const values = await getAppSettingsMap();
  const map = new Map();
  values.forEach((value, key) => {
    map.set(String(key), { key: String(key), value });
  });
  return map;
}

function buildDayKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value) {
  if (!value) return "Data nao informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data nao informada";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function extractPhoneLabel(rawValue = "") {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  if (/wa\.me|whatsapp\.com/i.test(raw)) {
    const digitsFromUrl = raw.replace(/\D/g, "");
    if (digitsFromUrl.length < 10) return "";
    const digits = digitsFromUrl;
    if (digits.length <= 10) return `+${digits}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`.trim();
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 10) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `+${digits}`;
  if (digits.length <= 10) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`.trim();
}

function normalizeAdminPhone(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/wa\.me|whatsapp\.com/i.test(raw)) {
    const digitsFromUrl = raw.replace(/\D/g, "");
    return digitsFromUrl.length >= 10 ? raw : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return `+${digits}`;
}

function resolveAuditSourceType(audit = {}) {
  return inferPrizeSourceTypesFromAudit(audit)[0] || "live_draw";
}

function resolveAuditSourceLabel(audit = {}) {
  return mapPrizeSourceLabel(resolveAuditSourceType(audit));
}

function normalizeAdminName(value, fallback = "Admin responsavel") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/wa\.me|whatsapp|https?:\/\//i.test(raw)) return fallback;
  const digits = raw.replace(/\D/g, "");
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (digits.length >= 8 && letters.length <= 2) return fallback;
  return raw;
}

const LEGACY_HISTORY_ADMIN_NAME = "ADM Gaby";
const LEGACY_HISTORY_ADMIN_PHONE = "+55 83 993005535";

function findPrizeItemForAudit(prizeItems = [], audit = {}, sourceType = "") {
  const auditUserId = String(audit?.user_id || "").trim();
  const auditRaffleId = String(audit?.raffle_id || "").trim();
  const auditAmount = Number(audit?.prize_amount || 0);
  const sourceRefId = String(audit?.participant_id || audit?.winner_id || "").trim();

  if (sourceRefId) {
    const directMatch = prizeItems.find(
      (item) =>
        String(item?.source_type || "").trim() === sourceType &&
        String(item?.source_ref_id || "").trim() === sourceRefId
    );
    if (directMatch) return directMatch;
  }

  return prizeItems.find((item) => {
    if (String(item?.source_type || "").trim() !== sourceType) return false;
    if (String(item?.user_id || "").trim() !== auditUserId) return false;
    if (Number(item?.reward_amount || 0) !== auditAmount) return false;

    const metadata = item?.metadata || {};
    if (auditRaffleId && String(metadata?.raffle_id || "").trim() === auditRaffleId) return true;

    const auditDate = new Date(audit?.validated_at || audit?.drawn_at || 0).getTime();
    const itemDate = new Date(item?.claimed_at || item?.created_date || item?.updated_date || 0).getTime();
    return Number.isFinite(auditDate) && Number.isFinite(itemDate) && Math.abs(itemDate - auditDate) <= 1000 * 60 * 10;
  }) || null;
}

async function upsertAppSetting(key, value, description = "") {
  const settings = await listEntity("AppSettings");
  const existing = settings.find((entry) => entry.key === key);
  const payload = {
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
    description,
  };
  if (existing?.id) {
    return updateEntity("AppSettings", existing.id, payload);
  }
  return createEntity("AppSettings", payload);
}

function normalizeWeeklyConfig(raw = {}) {
  const positions = Array.isArray(raw.positions)
    ? raw.positions
        .map((entry, index) => ({
          position: clampInt(entry?.position, index + 1, 1, 100),
          reward_type: String(entry?.reward_type || raw.fallback_reward_type || "cash_prize").trim() || "cash_prize",
          reward_value: Math.max(0, Number(entry?.reward_value ?? raw.fallback_reward_value ?? 0)),
          label: String(entry?.label || `${index + 1}º Lugar`).trim() || `${index + 1}º Lugar`,
          active: entry?.active !== false,
        }))
        .sort((a, b) => a.position - b.position)
    : [];
  const startsAt = safeDate(raw?.starts_at);
  const endsAt = safeDate(raw?.ends_at);
  const hasCustomWindow = Boolean(startsAt && endsAt && endsAt > startsAt);

  return {
    enabled: raw?.enabled !== false,
    active: raw?.active !== false,
    title: String(raw?.title || DEFAULT_WEEKLY_CONFIG.title).trim() || DEFAULT_WEEKLY_CONFIG.title,
    subtitle: String(raw?.subtitle || DEFAULT_WEEKLY_CONFIG.subtitle).trim() || DEFAULT_WEEKLY_CONFIG.subtitle,
    instructions: String(raw?.instructions || DEFAULT_WEEKLY_CONFIG.instructions).trim() || DEFAULT_WEEKLY_CONFIG.instructions,
    cycle_days: clampInt(raw?.cycle_days, DEFAULT_WEEKLY_CONFIG.cycle_days, 1, 30),
    starts_at: hasCustomWindow ? startsAt.toISOString() : "",
    ends_at: hasCustomWindow ? endsAt.toISOString() : "",
    reward_currency: String(raw?.reward_currency || DEFAULT_WEEKLY_CONFIG.reward_currency).trim() || DEFAULT_WEEKLY_CONFIG.reward_currency,
    winners_count: clampInt(raw?.winners_count, DEFAULT_WEEKLY_CONFIG.winners_count, 1, 100),
    positions: positions.length > 0 ? positions : DEFAULT_WEEKLY_CONFIG.positions,
    fallback_reward_type: String(raw?.fallback_reward_type || DEFAULT_WEEKLY_CONFIG.fallback_reward_type).trim() || DEFAULT_WEEKLY_CONFIG.fallback_reward_type,
    fallback_reward_value: Math.max(0, Number(raw?.fallback_reward_value ?? DEFAULT_WEEKLY_CONFIG.fallback_reward_value)),
  };
}

function invalidateGamificationStateCache() {
  gamificationStateCache = {
    value: null,
    expiresAt: 0,
  };
  gamificationRulesCache = {
    value: null,
    expiresAt: 0,
    promise: null,
  };
  weeklyCycleCache = {
    key: "",
    value: null,
    expiresAt: 0,
  };
  profileMetricsCache = new Map();
  profileMetricsPromises = new Map();
}

async function loadPublicUiConfig() {
  return getOrComputeCacheJson("ui:public-config", PUBLIC_UI_CONFIG_TTL_MS, async () => {
    const [settings, banners, socials] = await Promise.all([
      listEntity("AppSettings"),
      listEntity("BannerCarousel"),
      listEntity("SocialMedia"),
    ]);

    const payload = {
      settings: Array.isArray(settings) ? settings : [],
      banners: (Array.isArray(banners) ? banners : [])
        .filter((entry) => entry?.active !== false)
        .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)),
      socials: (Array.isArray(socials) ? socials : [])
        .filter((entry) => entry?.active !== false)
        .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)),
    };

    return payload;
  });
}

export async function refreshGamificationState(options = {}) {
  invalidateGamificationStateCache();
  return buildGamificationState({
    forceFresh: true,
    persistDerived: options?.persistDerived === true,
  });
}

function normalizeDailyCheckInConfig(raw = {}, rules = []) {
  const weeklyRule = rules.find(
    (entry) => entry?.active && String(entry.category || "") === "weekly" && String(entry.source_event || "") === "daily_checkin"
  );
  const fallbackReward = Math.max(0, Number(weeklyRule?.amount || 0));
  const incomingRewards = Array.isArray(raw?.rewards) ? raw.rewards : [];

  return {
    enabled: raw?.enabled !== false,
    streak_days: 7,
    rewards: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      const current = incomingRewards.find((entry) => Number(entry?.day) === day) || {};
      return {
        day,
        weekly_points: Math.max(0, Number(current?.weekly_points ?? fallbackReward)),
        label: String(current?.label || `Dia ${day}`).trim() || `Dia ${day}`,
        active: current?.active !== false,
      };
    }),
  };
}

function normalizeRule(raw = {}) {
  return {
    id: String(raw?.id || "").trim(),
    name: String(raw?.name || "Nova regra").trim() || "Nova regra",
    slug: String(raw?.slug || "").trim() || `rule-${Date.now()}`,
    category: String(raw?.category || "engagement").trim() || "engagement",
    description: String(raw?.description || "").trim(),
    source_event: String(raw?.source_event || "").trim() || "manual",
    metric_key: String(raw?.metric_key || "engagement_points").trim() || "engagement_points",
    amount: Math.max(0, Number(raw?.amount || 0)),
    condition_min: Math.max(0, Number(raw?.condition_min || 0)),
    condition_step: Math.max(1, Number(raw?.condition_step || 1)),
    limit_scope: String(raw?.limit_scope || "none").trim() || "none",
    limit_count: Math.max(0, Number(raw?.limit_count || 0)),
    dedupe_key: String(raw?.dedupe_key || raw?.slug || "").trim(),
    priority: clampInt(raw?.priority, 100, 0, 10000),
    active: raw?.active !== false,
    metadata: raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}

function buildLegacyRules(settingsMap) {
  const pointsRules = {
    ...DEFAULT_POINTS_RULES,
    ...parseJsonValue(settingsMap.get(POINTS_RULES_KEY)?.value, DEFAULT_POINTS_RULES),
  };
  const competitionConfig = parseJsonValue(settingsMap.get(PROFILE_COMPETITION_KEY)?.value, {});
  const competitionTasks = Array.isArray(competitionConfig?.tasks) ? competitionConfig.tasks : [];

  const rules = [
    {
      id: "",
      name: "Participação válida em dinâmica",
      slug: "engagement-participation",
      category: "engagement",
      description: "Pontua participação em live, call do jogo e sorteio rápido.",
      source_event: "participation",
      metric_key: "engagement_points",
      amount: clampInt(pointsRules.points_per_participation, 12),
      condition_step: 1,
      priority: 100,
      active: true,
      metadata: { variants: ["live_participation", "game_call_participation", "instant_raffle_participation"] },
    },
    {
      id: "",
      name: "Depósito aprovado",
      slug: "engagement-approved-deposit",
      category: "engagement",
      description: "Pontos globais por depósito aprovado.",
      source_event: "approved_deposit_count",
      metric_key: "engagement_points",
      amount: clampInt(pointsRules.points_per_approved_deposit, 8),
      condition_step: 1,
      priority: 110,
      active: true,
      metadata: {},
    },
    {
      id: "",
      name: "Volume de depósitos",
      slug: "engagement-approved-deposit-amount-step",
      category: "engagement",
      description: "Pontos globais a cada faixa de depósito aprovado.",
      source_event: "approved_deposit_amount_step",
      metric_key: "engagement_points",
      amount: clampInt(pointsRules.points_per_amount_step, 1),
      condition_step: Math.max(1, clampInt(pointsRules.amount_step_value, 10)),
      priority: 120,
      active: true,
      metadata: {},
    },
    {
      id: "",
      name: "Prêmio confirmado",
      slug: "engagement-validated-win",
      category: "engagement",
      description: "Pontos globais para prêmios confirmados.",
      source_event: "validated_win",
      metric_key: "engagement_points",
      amount: clampInt(pointsRules.points_per_win, 50),
      condition_step: 1,
      priority: 130,
      active: true,
      metadata: {},
    },
  ];

  competitionTasks.forEach((task, index) => {
    if (!task?.id) return;
    rules.push({
      id: "",
      name: String(task.label || task.id),
      slug: `weekly-${String(task.id).replace(/_/g, "-")}`,
      category: "weekly",
      description: "Regra do ranking semanal authoritative.",
      source_event: String(task.id),
      metric_key: "weekly_points",
      amount: Math.max(0, Number(task.points || 0)),
      condition_step: Math.max(1, Number(task.step_value || 1)),
      priority: 200 + index,
      active: task.enabled !== false,
      metadata: {},
    });
  });

  const chestXp = clampInt(settingsMap.get("daily_chest_xp_per_open")?.value, 18, 0, 100000);
  rules.push({
    id: "",
    name: "XP do Baú Diário",
    slug: "xp-daily-chest-open",
    category: "xp",
    description: "XP total concedido por abertura do baú.",
    source_event: "daily_chest_open",
    metric_key: "xp_total",
    amount: chestXp,
    condition_step: 1,
    priority: 300,
    active: true,
    metadata: {},
  });

  return rules.map(normalizeRule);
}

async function loadGamificationRules() {
  const now = Date.now();
  if (gamificationRulesCache.value && now < gamificationRulesCache.expiresAt) {
    return gamificationRulesCache.value;
  }

  if (gamificationRulesCache.promise) {
    return gamificationRulesCache.promise;
  }

  gamificationRulesCache.promise = (async () => {
    const [settingsMap, configured] = await Promise.all([
      listAppSettingsMap(),
      listEntity("GamificationRule", "-updated_date", 500),
    ]);
    const rules = configured.length > 0 ? configured.map(normalizeRule) : buildLegacyRules(settingsMap);
    const badgeRules = parseJsonValue(settingsMap.get(BADGE_RULES_KEY)?.value, DEFAULT_BADGE_RULES);
    const weeklyConfig = normalizeWeeklyConfig(
      parseJsonValue(settingsMap.get(WEEKLY_TOP_CONFIG_KEY)?.value, null) ||
        parseJsonValue(settingsMap.get(PROFILE_COMPETITION_KEY)?.value, DEFAULT_WEEKLY_CONFIG)
    );
    const dailyCheckInConfig = normalizeDailyCheckInConfig(
      parseJsonValue(settingsMap.get(DAILY_CHECKIN_CONFIG_KEY)?.value, DEFAULT_DAILY_CHECKIN_CONFIG),
      rules
    );
    const payload = {
      rules: rules.sort((a, b) => a.priority - b.priority),
      badgeRules: Array.isArray(badgeRules) ? badgeRules : DEFAULT_BADGE_RULES,
      weeklyConfig,
      dailyCheckInConfig,
    };
    gamificationRulesCache = {
      value: payload,
      expiresAt: Date.now() + GAMIFICATION_RULES_TTL_MS,
      promise: null,
    };
    return payload;
  })().catch((error) => {
    gamificationRulesCache = {
      value: null,
      expiresAt: 0,
      promise: null,
    };
    throw error;
  });

  return gamificationRulesCache.promise;
}

function resolveCurrentCycleWindow(config) {
  const safeConfig = normalizeWeeklyConfig(config);
  const configuredStartsAt = safeDate(safeConfig.starts_at);
  const configuredEndsAt = safeDate(safeConfig.ends_at);
  if (configuredStartsAt && configuredEndsAt && configuredEndsAt > configuredStartsAt) {
    const cycleKey = `${configuredStartsAt.getUTCFullYear()}-${String(configuredStartsAt.getUTCMonth() + 1).padStart(2, "0")}-${String(configuredStartsAt.getUTCDate()).padStart(2, "0")}-${String(configuredStartsAt.getUTCHours()).padStart(2, "0")}${String(configuredStartsAt.getUTCMinutes()).padStart(2, "0")}`;
    return {
      cycleKey,
      startsAt: configuredStartsAt,
      endsAt: configuredEndsAt,
      title: safeConfig.title,
    };
  }

  const now = new Date();
  const cycleDays = clampInt(safeConfig.cycle_days, 7, 1, 30);
  const startsAt = new Date(now);
  startsAt.setHours(0, 0, 0, 0);
  const dayOfWeek = startsAt.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  startsAt.setDate(startsAt.getDate() - diffToMonday);
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + cycleDays);
  const cycleKey = `${startsAt.getUTCFullYear()}-${String(startsAt.getUTCMonth() + 1).padStart(2, "0")}-${String(startsAt.getUTCDate()).padStart(2, "0")}`;
  return {
    cycleKey,
    startsAt,
    endsAt,
    title: `${safeConfig.title} • ${String(startsAt.getDate()).padStart(2, "0")}/${String(startsAt.getMonth() + 1).padStart(2, "0")}`,
  };
}

function storeWeeklyCycleCache(key, value) {
  weeklyCycleCache = {
    key: String(key || ""),
    value,
    expiresAt: Date.now() + WEEKLY_CYCLE_TTL_MS,
  };
  return value;
}

async function ensureActiveWeeklyCycle(config) {
  const windowData = resolveCurrentCycleWindow(config);
  if (
    weeklyCycleCache.value &&
    weeklyCycleCache.key === windowData.cycleKey &&
    Date.now() < weeklyCycleCache.expiresAt
  ) {
    return weeklyCycleCache.value;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentCycleResult = await client.query(
      `SELECT * FROM weekly_cycles
       WHERE cycle_key = $1
       LIMIT 1`,
      [windowData.cycleKey]
    );
    const currentCycle = currentCycleResult.rows[0];
    const activeCycleResult = await client.query(
      `SELECT * FROM weekly_cycles
       WHERE status = 'active'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    );
    const activeCycle = activeCycleResult.rows[0] || null;

    if (!currentCycle && activeCycle && String(activeCycle.cycle_key || "") !== String(windowData.cycleKey || "")) {
      await client.query(
        `INSERT INTO user_metric_balances (user_id, metric_key, cycle_key, amount, metadata, updated_at)
         SELECT user_id, metric_key, $2, amount, metadata, NOW()
           FROM user_metric_balances
          WHERE metric_key = 'weekly_points'
            AND cycle_key = $1
         ON CONFLICT (user_id, metric_key, cycle_key)
         DO UPDATE SET
           amount = GREATEST(user_metric_balances.amount, EXCLUDED.amount),
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [activeCycle.cycle_key, windowData.cycleKey]
      );
      await client.query(
        `DELETE FROM user_metric_balances
          WHERE metric_key = 'weekly_points'
            AND cycle_key = $1`,
        [activeCycle.cycle_key]
      );
      await client.query(
        `INSERT INTO user_metric_ledger (
          user_id, metric_key, cycle_key, amount, source_type, source_ref, occurred_at, metadata, updated_at
        )
         SELECT user_id, metric_key, $2, amount, source_type, source_ref, occurred_at, metadata, NOW()
           FROM user_metric_ledger
          WHERE metric_key = 'weekly_points'
            AND cycle_key = $1
         ON CONFLICT (user_id, metric_key, cycle_key, source_type, source_ref)
         DO UPDATE SET
           amount = EXCLUDED.amount,
           occurred_at = GREATEST(user_metric_ledger.occurred_at, EXCLUDED.occurred_at),
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [activeCycle.cycle_key, windowData.cycleKey]
      );
      await client.query(
        `DELETE FROM user_metric_ledger
          WHERE metric_key = 'weekly_points'
            AND cycle_key = $1`,
        [activeCycle.cycle_key]
      );
      const migrated = await client.query(
        `UPDATE weekly_cycles
         SET cycle_key = $2,
             status = 'active',
             title = $3,
             starts_at = $4,
             ends_at = $5,
             config_snapshot = $6::jsonb,
             closed_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          activeCycle.id,
          windowData.cycleKey,
          windowData.title,
          windowData.startsAt.toISOString(),
          windowData.endsAt.toISOString(),
          JSON.stringify(normalizeWeeklyConfig(config)),
        ]
      );
      await client.query("COMMIT");
      const row = migrated.rows[0];
      return storeWeeklyCycleCache(windowData.cycleKey, {
        id: row.id,
        cycle_key: row.cycle_key,
        title: row.title,
        status: row.status,
        starts_at: toIso(row.starts_at),
        ends_at: toIso(row.ends_at),
        closed_at: row.closed_at ? toIso(row.closed_at) : null,
        config_snapshot: row.config_snapshot || {},
        winners_snapshot: row.winners_snapshot || [],
        metadata: row.metadata || {},
      });
    }

    await client.query(
      `UPDATE weekly_cycles
       SET status = 'closed',
           closed_at = COALESCE(closed_at, NOW()),
           updated_at = NOW()
       WHERE status = 'active'
         AND cycle_key <> $1`,
      [windowData.cycleKey]
    );

    if (currentCycle) {
      if (currentCycle.status !== "active") {
        const reopened = await client.query(
        `UPDATE weekly_cycles
         SET status = 'active',
             title = $2,
             starts_at = $3,
             ends_at = $4,
             config_snapshot = $5::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          currentCycle.id,
          windowData.title,
          windowData.startsAt.toISOString(),
          windowData.endsAt.toISOString(),
            JSON.stringify(normalizeWeeklyConfig(config)),
        ]
        );
        await client.query("COMMIT");
        const row = reopened.rows[0];
        return storeWeeklyCycleCache(windowData.cycleKey, {
          id: row.id,
          cycle_key: row.cycle_key,
          title: row.title,
          status: row.status,
          starts_at: toIso(row.starts_at),
          ends_at: toIso(row.ends_at),
          closed_at: row.closed_at ? toIso(row.closed_at) : null,
          config_snapshot: row.config_snapshot || {},
          winners_snapshot: row.winners_snapshot || [],
          metadata: row.metadata || {},
        });
      }

      const currentStartsAt = safeDate(currentCycle.starts_at);
      const currentEndsAt = safeDate(currentCycle.ends_at);
      const currentWindowMismatch =
        !currentStartsAt ||
        !currentEndsAt ||
        currentStartsAt.getTime() !== windowData.startsAt.getTime() ||
        currentEndsAt.getTime() !== windowData.endsAt.getTime() ||
        String(currentCycle.title || "") !== String(windowData.title || "");

      if (currentWindowMismatch) {
        const refreshed = await client.query(
          `UPDATE weekly_cycles
           SET status = 'active',
               title = $2,
               starts_at = $3,
               ends_at = $4,
               config_snapshot = $5::jsonb,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            currentCycle.id,
            windowData.title,
            windowData.startsAt.toISOString(),
            windowData.endsAt.toISOString(),
            JSON.stringify(normalizeWeeklyConfig(config)),
          ]
        );
        await client.query("COMMIT");
        const row = refreshed.rows[0];
        return storeWeeklyCycleCache(windowData.cycleKey, {
          id: row.id,
          cycle_key: row.cycle_key,
          title: row.title,
          status: row.status,
          starts_at: toIso(row.starts_at),
          ends_at: toIso(row.ends_at),
          closed_at: row.closed_at ? toIso(row.closed_at) : null,
          config_snapshot: row.config_snapshot || {},
          winners_snapshot: row.winners_snapshot || [],
          metadata: row.metadata || {},
        });
      }

      await client.query("COMMIT");
      return storeWeeklyCycleCache(windowData.cycleKey, {
        id: currentCycle.id,
        cycle_key: currentCycle.cycle_key,
        title: currentCycle.title,
        status: currentCycle.status,
        starts_at: toIso(currentCycle.starts_at),
        ends_at: toIso(currentCycle.ends_at),
        closed_at: currentCycle.closed_at ? toIso(currentCycle.closed_at) : null,
        config_snapshot: currentCycle.config_snapshot || {},
        winners_snapshot: currentCycle.winners_snapshot || [],
        metadata: currentCycle.metadata || {},
      });
    }

    const inserted = await client.query(
      `INSERT INTO weekly_cycles (cycle_key, title, status, starts_at, ends_at, config_snapshot, winners_snapshot, metadata)
       VALUES ($1, $2, 'active', $3, $4, $5::jsonb, '[]'::jsonb, '{}'::jsonb)
       ON CONFLICT (cycle_key)
       DO UPDATE SET
         title = EXCLUDED.title,
         status = 'active',
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         config_snapshot = EXCLUDED.config_snapshot,
         updated_at = NOW()
       RETURNING *`,
      [windowData.cycleKey, windowData.title, windowData.startsAt.toISOString(), windowData.endsAt.toISOString(), JSON.stringify(normalizeWeeklyConfig(config))]
    );
    await client.query("COMMIT");
    return storeWeeklyCycleCache(windowData.cycleKey, {
      id: inserted.rows[0].id,
      cycle_key: inserted.rows[0].cycle_key,
      title: inserted.rows[0].title,
      status: inserted.rows[0].status,
      starts_at: toIso(inserted.rows[0].starts_at),
      ends_at: toIso(inserted.rows[0].ends_at),
      closed_at: null,
      config_snapshot: inserted.rows[0].config_snapshot || {},
      winners_snapshot: [],
      metadata: inserted.rows[0].metadata || {},
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function createUserSnapshot(user) {
  const approvedProfileImageUrl = getApprovedProfileImageUrl(user);
  return {
    user_id: user.id,
    nick: String(user.nick || user.full_name || "Usuário"),
    avatar_emoji: String(user.avatar_emoji || ""),
    profile_avatar_id: String(user.profile_avatar_id || ""),
    profile_image_mode: String(user.profile_image_mode || "avatar"),
    profile_image_url: approvedProfileImageUrl,
    xp_total: 0,
    engagement_points: 0,
    weekly_points: 0,
    totalApproved: 0,
    depositCount: 0,
    totalTickets: 0,
    totalParticipations: 0,
    totalWins: 0,
    liveParticipations: 0,
    gameParticipations: 0,
    instantParticipations: 0,
    chestRewards: 0,
    prizeCounts: 0,
    totalFollowers: 0,
    totalLikes: 0,
    totalCheckins: 0,
    followingCount: 0,
    breakdown: {},
    metricBreakdown: {},
    metricBreakdownMeta: {},
  };
}

function getApprovedProfileImageUrl(user) {
  return String(user?.profile_image_mode || "").toLowerCase() === "photo" &&
    String(user?.profile_image_status || "").toLowerCase() === "approved"
    ? String(user?.profile_image_url || "").trim() || (user?.id ? `/api/auth/profile-image/${user.id}` : "")
    : "";
}

function addMetric(state, metricKey, amount, sourceEvent, occurredAt = null, metadata = {}) {
  const safeAmount = Number(amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount === 0) return;
  state[metricKey] = Math.max(0, Number(state[metricKey] || 0) + safeAmount);
  state.breakdown[sourceEvent] = Number(state.breakdown[sourceEvent] || 0) + safeAmount;
  if (!state.metricBreakdown[metricKey]) {
    state.metricBreakdown[metricKey] = {};
  }
  state.metricBreakdown[metricKey][sourceEvent] = Number(state.metricBreakdown[metricKey][sourceEvent] || 0) + safeAmount;
  if (!state.metricBreakdownMeta[metricKey]) {
    state.metricBreakdownMeta[metricKey] = {};
  }
  const iso = occurredAt ? toIso(occurredAt) : "";
  const currentMeta = state.metricBreakdownMeta[metricKey][sourceEvent] || {};
  const currentIso = String(currentMeta.latestOccurredAt || "");
  state.metricBreakdownMeta[metricKey][sourceEvent] = {
    ...currentMeta,
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    latestOccurredAt: !currentIso || (iso && iso > currentIso) ? iso : currentIso,
  };
}

function applyRuleMetric(state, rule, units = 1, sourceEvent = "", occurredAt = null, metadata = {}) {
  if (!rule?.active) return;
  const metricKey = String(
    rule.metric_key || (String(rule.category || "") === "weekly" ? "weekly_points" : "engagement_points")
  ).trim();
  if (!metricKey) return;
  const totalAmount = Number(units || 0) * Number(rule.amount || 0);
  addMetric(state, metricKey, totalAmount, sourceEvent || `${rule.category}.${rule.source_event}`, occurredAt, metadata);
}

function rulesBySource(rules, category, sourceEvent) {
  return rules.filter((entry) => entry.active && entry.category === category && entry.source_event === sourceEvent);
}

function applyRulesForSource(state, rules, category, sourceEvent, units = 1, breakdownKey = "", occurredAt = null) {
  rulesBySource(rules, category, sourceEvent).forEach((rule) => {
    applyRuleMetric(state, rule, units, breakdownKey || `${category}.${sourceEvent}`, occurredAt);
  });
}

function resolveCheckInStreakRewards(config = {}) {
  const rewards = Array.isArray(config?.rewards) ? config.rewards : [];
  const map = new Map();
  rewards.forEach((entry) => {
    map.set(Number(entry.day || 0), {
      weekly_points: Math.max(0, Number(entry.weekly_points || 0)),
      active: entry?.active !== false,
    });
  });
  return map;
}

function isNextDay(previousDayKey, currentDayKey) {
  if (!previousDayKey || !currentDayKey) return false;
  const previous = new Date(`${previousDayKey}T12:00:00Z`);
  const current = new Date(`${currentDayKey}T12:00:00Z`);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  const diffMs = current.getTime() - previous.getTime();
  return diffMs === 24 * 60 * 60 * 1000;
}

function buildSnapshots({
  users,
  deposits,
  liveParticipants,
  gameParticipants,
  instantParticipants,
  prizeGalleryItems,
  chestXpGrants,
  competitionPointEvents,
  dailyCheckins,
  userFollows,
  profileLikes,
  rules,
  cycle,
  dailyCheckInConfig,
}) {
  const byUser = {};
  users.forEach((user) => {
    if (!user?.id) return;
    byUser[user.id] = createUserSnapshot(user);
  });

  deposits
    .filter((entry) => entry?.user_id)
    .forEach((deposit) => {
      const userState = byUser[deposit.user_id];
      if (!userState) return;
      if (String(deposit.status || "") !== "approved") return;
      const amount = Math.max(0, Number(deposit.amount || 0));
      const depositOccurredAt = deposit.approved_date || deposit.updated_date || deposit.created_date;
      const depositSourceRefId = String(deposit.id || "").trim();
      userState.totalApproved += amount;
      userState.depositCount += 1;
      userState.totalTickets += Math.max(0, Number(deposit.tickets_count || 0));

      rulesBySource(rules, "engagement", "approved_deposit_count").forEach((rule) => {
        applyRuleMetric(
          userState,
          rule,
          1,
          depositSourceRefId ? `engagement.approved_deposit_count:${rule.slug}:${depositSourceRefId}` : `engagement.approved_deposit_count:${rule.slug}`,
          depositOccurredAt,
          {
            exact_event: Boolean(depositSourceRefId),
            source: "approved_deposit",
            source_ref_id: depositSourceRefId,
            reward_title: String(rule.name || "Deposito aprovado").trim() || "Deposito aprovado",
          }
        );
      });

      rulesBySource(rules, "engagement", "approved_deposit_amount_step").forEach((rule) => {
        const steps = Math.floor(amount / Math.max(1, Number(rule.condition_step || 1)));
        if (steps <= 0) return;
        applyRuleMetric(
          userState,
          rule,
          steps,
          depositSourceRefId
            ? `engagement.approved_deposit_amount_step:${rule.slug}:${depositSourceRefId}`
            : `engagement.approved_deposit_amount_step:${rule.slug}`,
          depositOccurredAt,
          {
            exact_event: Boolean(depositSourceRefId),
            source: "approved_deposit",
            source_ref_id: depositSourceRefId,
            reward_title: String(rule.name || "Bonus por valor do deposito").trim() || "Bonus por valor do deposito",
          }
        );
      });

      if (cycle && isInRange(depositOccurredAt, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
        rulesBySource(rules, "weekly", "approved_deposit_count").forEach((rule) => {
          applyRuleMetric(
            userState,
            rule,
            1,
            depositSourceRefId ? `weekly.approved_deposit_count:${rule.slug}:${depositSourceRefId}` : `weekly.approved_deposit_count:${rule.slug}`,
            depositOccurredAt,
            {
              exact_event: Boolean(depositSourceRefId),
              source: "approved_deposit",
              source_ref_id: depositSourceRefId,
              reward_title: String(rule.name || "Pontos semanais do deposito").trim() || "Pontos semanais do deposito",
            }
          );
        });

        rulesBySource(rules, "weekly", "approved_deposit_amount_step").forEach((rule) => {
          const steps = Math.floor(amount / Math.max(1, Number(rule.condition_step || 1)));
          if (steps <= 0) return;
          applyRuleMetric(
            userState,
            rule,
            steps,
            depositSourceRefId
              ? `weekly.approved_deposit_amount_step:${rule.slug}:${depositSourceRefId}`
              : `weekly.approved_deposit_amount_step:${rule.slug}`,
            depositOccurredAt,
            {
              exact_event: Boolean(depositSourceRefId),
              source: "approved_deposit",
              source_ref_id: depositSourceRefId,
              reward_title: String(rule.name || "Bonus semanal por valor do deposito").trim() || "Bonus semanal por valor do deposito",
            }
          );
        });
      }
    });

  const participationSources = [
    { items: liveParticipants, source: "live_participation", statKey: "liveParticipations" },
    { items: gameParticipants, source: "game_call_participation", statKey: "gameParticipations" },
    { items: instantParticipants, source: "instant_raffle_participation", statKey: "instantParticipations" },
  ];

  participationSources.forEach(({ items, source, statKey }) => {
    items
      .filter((entry) => entry?.user_id)
      .forEach((entry) => {
        const userState = byUser[entry.user_id];
        if (!userState) return;
        userState.totalParticipations += 1;
        userState[statKey] += 1;

        applyRulesForSource(userState, rules, "engagement", "participation", 1, `engagement.${source}`, entry.created_date || entry.updated_date);
        applyRulesForSource(userState, rules, "engagement", source, 1, `engagement.${source}`, entry.created_date || entry.updated_date);

        if (cycle && isInRange(entry.created_date || entry.updated_date, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
          applyRulesForSource(userState, rules, "weekly", source, 1, `weekly.${source}`, entry.created_date || entry.updated_date);
        }
      });
  });

  const checkInRewardMap = resolveCheckInStreakRewards(dailyCheckInConfig);
  const dailyCheckinsByUser = dailyCheckins
    .filter((entry) => entry?.user_id)
    .reduce((acc, entry) => {
      const key = String(entry.user_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    }, {});

  Object.entries(dailyCheckinsByUser).forEach(([userId, items]) => {
    const userState = byUser[userId];
    if (!userState) return;
    const sortedItems = items
      .slice()
      .sort((a, b) => String(a.checkin_day_key || a.created_at || "").localeCompare(String(b.checkin_day_key || b.created_at || "")));

    let streakDay = 0;
    let previousDayKey = "";

    sortedItems.forEach((entry) => {
      userState.totalCheckins += 1;
      const currentDayKey = String(entry.checkin_day_key || "").trim();
      streakDay = isNextDay(previousDayKey, currentDayKey) ? Math.min(7, streakDay + 1) : 1;
      previousDayKey = currentDayKey;

      applyRulesForSource(userState, rules, "engagement", "daily_checkin", 1, "engagement.daily_checkin", entry.created_at || entry.updated_at);

      if (cycle && isInRange(entry.created_at || entry.updated_at, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
        const rewardEntry = checkInRewardMap.get(streakDay);
        const hasProgressionReward = dailyCheckInConfig?.enabled && rewardEntry?.active && Number(rewardEntry.weekly_points || 0) > 0;

        if (hasProgressionReward) {
          addMetric(userState, "weekly_points", Number(rewardEntry.weekly_points || 0), `weekly.daily_checkin.day_${streakDay}`, entry.created_at || entry.updated_at);
        } else {
          applyRulesForSource(userState, rules, "weekly", "daily_checkin", 1, "weekly.daily_checkin", entry.created_at || entry.updated_at);
        }
      }
    });
  });

  userFollows
    .filter((entry) => entry?.follower_user_id && entry?.target_user_id)
    .forEach((entry) => {
      const actorState = byUser[entry.follower_user_id];
      const targetState = byUser[entry.target_user_id];
      const firstFollowedAt = entry.first_followed_at || entry.followed_at || entry.created_at;
      const isActive = Boolean(entry.active);

      if (isActive && actorState) actorState.followingCount += 1;
      if (isActive && targetState) targetState.totalFollowers += 1;

      if (actorState && firstFollowedAt) {
        applyRulesForSource(actorState, rules, "engagement", "follow_profile", 1, "engagement.follow_profile", firstFollowedAt);

        if (cycle && isInRange(firstFollowedAt, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
          applyRulesForSource(actorState, rules, "weekly", "follow_profile", 1, "weekly.follow_profile", firstFollowedAt);
        }
      }
    });

  profileLikes
    .filter((entry) => entry?.actor_user_id && entry?.target_user_id)
    .forEach((entry) => {
      const actorState = byUser[entry.actor_user_id];
      const targetState = byUser[entry.target_user_id];
      const firstLikedAt = entry.first_liked_at || entry.liked_at || entry.created_at;
      const isActive = Boolean(entry.active);

      if (isActive && targetState) targetState.totalLikes += 1;

      if (actorState && firstLikedAt) {
        applyRulesForSource(actorState, rules, "engagement", "like_profile", 1, "engagement.like_profile", firstLikedAt);

        if (cycle && isInRange(firstLikedAt, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
          applyRulesForSource(actorState, rules, "weekly", "like_profile", 1, "weekly.like_profile", firstLikedAt);
        }
      }
    });

  chestXpGrants
    .filter((entry) => entry?.user_id)
    .forEach((entry) => {
      const userState = byUser[entry.user_id];
      if (!userState) return;
      const sourceRefId = String(entry.opening_id || entry.id || "").trim();
      addMetric(
        userState,
        "xp_total",
        Math.max(0, Number(entry.xp_amount || 0)),
        sourceRefId ? `xp.daily_chest_open:${sourceRefId}` : "xp.daily_chest_open",
        entry.created_date || entry.updated_date,
        {
          exact_event: Boolean(sourceRefId),
          source: "daily_chest",
          source_ref_id: sourceRefId,
          reward_title: "XP do Baú Diário",
        }
      );
    });

  prizeGalleryItems
    .filter((entry) => entry?.user_id)
    .forEach((entry) => {
      const userState = byUser[entry.user_id];
      if (!userState) return;
      userState.totalWins += 1;
      userState.prizeCounts += 1;
      if (String(entry.source_type || "") === "daily_chest") {
        userState.chestRewards += 1;
      }

      applyRulesForSource(userState, rules, "engagement", "validated_win", 1, "engagement.validated_win", entry.claimed_at || entry.created_date || entry.updated_date);

      if (cycle && isInRange(entry.claimed_at || entry.created_date || entry.updated_date, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
        applyRulesForSource(userState, rules, "weekly", "validated_win", 1, "weekly.validated_win", entry.claimed_at || entry.created_date || entry.updated_date);
      }
    });

  competitionPointEvents
    .filter((entry) => entry?.user_id)
    .forEach((entry) => {
      const userState = byUser[entry.user_id];
      if (!userState) return;
      const points = Math.max(0, Number(entry.points || 0));
      if (cycle && isInRange(entry.created_date || entry.updated_date, new Date(cycle.starts_at), new Date(cycle.ends_at))) {
        const source = String(entry.source || "admin_bonus").trim().toLowerCase();
        const sourceRefId = String(entry.source_ref_id || entry.id || "").trim();
        const sourceRef = sourceRefId ? `weekly.${source}:${sourceRefId}` : `weekly.${source}`;
        addMetric(
          userState,
          "weekly_points",
          points,
          sourceRef,
          entry.created_date || entry.updated_date,
          {
            exact_event: Boolean(sourceRefId),
            source,
            source_ref_id: sourceRefId,
            reward_title: String(entry.title || "Pontos de ranking").trim() || "Pontos de ranking",
          }
        );
      }
    });

  return byUser;
}

async function upsertLedgerEntry(client, { userId, metricKey, cycleKey = "", amount, sourceType, sourceRef, occurredAt, metadata = {} }) {
  await client.query(
    `INSERT INTO user_metric_ledger (
      user_id, metric_key, cycle_key, amount, source_type, source_ref, occurred_at, metadata, updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
     ON CONFLICT (user_id, metric_key, cycle_key, source_type, source_ref)
     DO UPDATE SET
       amount = EXCLUDED.amount,
       occurred_at = EXCLUDED.occurred_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`,
    [
      userId,
      metricKey,
      String(cycleKey || ""),
      Number(amount || 0),
      sourceType,
      sourceRef,
      occurredAt ? toIso(occurredAt) : new Date().toISOString(),
      JSON.stringify(metadata || {}),
    ]
  );
}

async function setBalance(client, { userId, metricKey, cycleKey = "", amount, metadata = {} }) {
  await client.query(
    `INSERT INTO user_metric_balances (user_id, metric_key, cycle_key, amount, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (user_id, metric_key, cycle_key)
     DO UPDATE SET
       amount = EXCLUDED.amount,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`,
    [userId, metricKey, String(cycleKey || ""), Number(amount || 0), JSON.stringify(metadata || {})]
  );
}

async function persistSnapshots(byUser, cycleKey = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderedSnapshots = Object.values(byUser).sort((a, b) => String(a.user_id || "").localeCompare(String(b.user_id || "")));
    for (const userState of orderedSnapshots) {
      await client.query(
        `DELETE FROM user_metric_ledger
         WHERE user_id = $1
           AND source_type IN ('snapshot', 'derived_event')`,
        [userState.user_id]
      );

      for (const [metricKey, sourceMap] of Object.entries(userState.metricBreakdown || {})) {
        const scopedCycleKey = metricKey === "weekly_points" ? String(cycleKey || "") : "";
        for (const [sourceRef, amount] of Object.entries(sourceMap || {})) {
          if (!Number(amount || 0)) continue;
          const currentMeta = userState.metricBreakdownMeta?.[metricKey]?.[sourceRef] || {};
          const latestOccurredAt = currentMeta.latestOccurredAt || null;
          await upsertLedgerEntry(client, {
            userId: userState.user_id,
            metricKey,
            cycleKey: scopedCycleKey,
            amount,
            sourceType: "derived_event",
            sourceRef,
            occurredAt: latestOccurredAt || new Date().toISOString(),
            metadata: {
              ...(currentMeta && typeof currentMeta === "object" ? currentMeta : {}),
              type: "consolidated_snapshot",
              source_ref: sourceRef,
              latest_occurred_at: latestOccurredAt || null,
            },
          });
        }
      }

      await setBalance(client, { userId: userState.user_id, metricKey: "xp_total", amount: userState.xp_total });
      await setBalance(client, { userId: userState.user_id, metricKey: "engagement_points", amount: userState.engagement_points });
      await setBalance(client, { userId: userState.user_id, metricKey: "tickets_active", amount: userState.totalTickets });
      await setBalance(client, { userId: userState.user_id, metricKey: "prize_counts", amount: userState.prizeCounts });
      await setBalance(client, { userId: userState.user_id, metricKey: "chest_rewards", amount: userState.chestRewards });
      await setBalance(client, { userId: userState.user_id, metricKey: "social_followers", amount: userState.totalFollowers });
      await setBalance(client, { userId: userState.user_id, metricKey: "social_following", amount: userState.followingCount });
      await setBalance(client, { userId: userState.user_id, metricKey: "social_likes", amount: userState.totalLikes });
      await setBalance(client, { userId: userState.user_id, metricKey: "daily_checkins", amount: userState.totalCheckins });
      if (cycleKey) {
        await setBalance(client, { userId: userState.user_id, metricKey: "weekly_points", cycleKey, amount: userState.weekly_points });
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileSnapshotsWithAuthoritativeBalances(byUser, cycleKey = "") {
  const scopedCycleKey = String(cycleKey || "");
  const authoritativeLedgerRows = await pool.query(
    `SELECT user_id, metric_key, cycle_key, amount, source_type, source_ref, occurred_at, metadata
       FROM user_metric_ledger
      WHERE metric_key = ANY($1::text[])
        AND source_type = ANY($2::text[])
        AND (
          (metric_key = 'weekly_points' AND cycle_key = $3)
          OR (metric_key <> 'weekly_points' AND cycle_key = '')
        )
      ORDER BY occurred_at ASC, created_at ASC`,
    [["xp_total", "engagement_points", "weekly_points"], ["daily_chest_reward", "admin_adjustment"], scopedCycleKey]
  );

  authoritativeLedgerRows.rows.forEach((row) => {
    const userId = String(row.user_id || "").trim();
    const metricKey = String(row.metric_key || "").trim();
    if (!userId || !metricKey) return;
    const userState = byUser[userId];
    if (!userState) return;

    const sourceType = String(row.source_type || "").trim() || "authoritative";
    const sourceRef = String(row.source_ref || "").trim() || "unknown";
    addMetric(
      userState,
      metricKey,
      Number(row.amount || 0),
      `authoritative.${sourceType}:${sourceRef}`,
      row.occurred_at || new Date().toISOString(),
      {
        type: "authoritative_ledger_reconciliation",
        source_type: sourceType,
        source_ref: sourceRef,
        ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      }
    );
  });

  const balanceRows = await pool.query(
    `SELECT user_id, metric_key, cycle_key, amount
       FROM user_metric_balances
      WHERE metric_key = ANY($1::text[])
        AND (
          (metric_key = 'weekly_points' AND cycle_key = $2)
          OR (metric_key <> 'weekly_points' AND cycle_key = '')
        )`,
    [["xp_total", "engagement_points", "weekly_points"], scopedCycleKey]
  );

  balanceRows.rows.forEach((row) => {
    const userId = String(row.user_id || "").trim();
    const metricKey = String(row.metric_key || "").trim();
    if (!userId || !metricKey) return;
    const userState = byUser[userId];
    if (!userState) return;

    const authoritativeAmount = Math.max(0, Number(row.amount || 0));
    const currentAmount = Math.max(0, Number(userState[metricKey] || 0));
    if (authoritativeAmount <= currentAmount) return;

    if (!userState.metricBreakdown[metricKey]) userState.metricBreakdown[metricKey] = {};
    if (!userState.metricBreakdownMeta[metricKey]) userState.metricBreakdownMeta[metricKey] = {};
    userState[metricKey] = authoritativeAmount;
    userState.metricBreakdown[metricKey].authoritative_balance_floor = authoritativeAmount;
    userState.metricBreakdownMeta[metricKey].authoritative_balance_floor = {
      type: "authoritative_balance_floor",
      metric_key: metricKey,
      latestOccurredAt: new Date().toISOString(),
    };
  });

  return byUser;
}

function computeAchievements(metrics, badgeRules = []) {
  return (Array.isArray(badgeRules) ? badgeRules : [])
    .filter((rule) => {
      if (!rule?.enabled) return false;
      if (String(rule.metric) === "positionTop") {
        const position = Number(metrics.position || 0);
        return position > 0 && position <= Number(rule.threshold || 0);
      }
      return Number(metrics[String(rule.metric) || ""] || 0) >= Number(rule.threshold || 0);
    })
    .map((rule) => ({
      key: String(rule.id || rule.label || ""),
      label: String(rule.label || "Conquista"),
      iconKey: String(rule.icon || "star"),
      colorKey: String(rule.color || "cyan"),
      iconUrl: String(rule.icon_url || ""),
      ruleText: String(rule.description || ""),
    }));
}

function buildProgressBadge(metrics, pointsRules) {
  const liveTarget = Math.max(1, Number(pointsRules?.live_badge_target || DEFAULT_POINTS_RULES.live_badge_target));
  const current = Math.max(0, Number(metrics.liveParticipations || 0));
  const currentInLevel = current % liveTarget;
  const progress = Math.min(100, Math.round((currentInLevel / liveTarget) * 100));
  const remaining = liveTarget - currentInLevel;
  return {
    key: "super-fan-live",
    title: "Super Fa das Lives do SouzaTV",
    subtitle: `Faltam ${remaining} participações para o próximo nível.`,
    current: currentInLevel,
    target: liveTarget,
    progress,
    completed: false,
  };
}

function mapPrizeSourceLabel(sourceType = "") {
  const normalized = String(sourceType || "").trim().toLowerCase();
  if (normalized === "daily_chest") return "Baú Diário";
  if (normalized === "live_draw") return "Sorteio Live";
  if (normalized === "game_call") return "Call Jogo";
  if (normalized === "instant_raffle") return "Sorteio Rápido";
  if (normalized === "deposit_draw") return "Sorteio dos Depositantes";
  if (normalized === "cashback") return "Cashback";
  return "Premiação do app";
}

function buildPrizeRewardLabel(item = {}) {
  const rewardType = String(item.reward_type || "").trim().toLowerCase();
  const amount = Number(item.reward_amount || 0);
  if (rewardType === "xp_total" || rewardType === "xp") return `${Math.round(amount)} XP`;
  if (rewardType === "weekly_points") return `${Math.round(amount)} pontos semanais`;
  if (rewardType === "engagement_points") return `${Math.round(amount)} pontos`;
  if (rewardType === "ticket_bonus" || rewardType === "tickets_active" || rewardType === "tickets_bonus" || rewardType === "bilhetes") {
    return `${Math.round(amount)} bilhetes`;
  }
  if (rewardType === "points_balance") return `Banca R$ ${amount.toFixed(2)}`;
  if (rewardType === "cash_prize") return `Prêmio R$ ${amount.toFixed(2)}`;
  if (amount > 0 && item.reward_unit) return `${amount} ${item.reward_unit}`;
  return String(item.special_label || item.title || "Prêmio").trim() || "Prêmio";
}

async function buildGamificationStateFresh(options = {}) {
  const persistDerived = options?.persistDerived === true;
  const [users, deposits, liveParticipants, gameParticipants, instantParticipants, prizeGalleryItems, chestXpGrants, competitionPointEvents, dailyCheckins, userFollows, profileLikes] =
    await Promise.all([
      listEntity("User"),
      listEntity("Deposit"),
      listEntity("LiveDrawParticipant"),
      listEntity("GameCallParticipant"),
      listEntity("InstantRaffleParticipant"),
      listEntity("UserPrizeGalleryItem"),
      listEntity("DailyChestXpGrant"),
      listEntity("CompetitionPointEvent"),
      pool.query("SELECT * FROM daily_checkins ORDER BY created_at DESC").then((result) => result.rows),
      pool.query("SELECT * FROM user_follows ORDER BY first_followed_at DESC, updated_at DESC").then((result) => result.rows),
      pool.query("SELECT * FROM profile_likes ORDER BY first_liked_at DESC, updated_at DESC").then((result) => result.rows),
    ]);

  const settingsMap = await listAppSettingsMap();
  const { rules, badgeRules, weeklyConfig, dailyCheckInConfig } = await loadGamificationRules();
  const cycle = await ensureActiveWeeklyCycle(weeklyConfig);
  const snapshots = buildSnapshots({
    users,
    deposits,
    liveParticipants,
    gameParticipants,
    instantParticipants,
    prizeGalleryItems,
    chestXpGrants,
    competitionPointEvents,
    dailyCheckins,
    userFollows,
    profileLikes,
    rules,
    cycle,
    dailyCheckInConfig,
  });
  if (persistDerived) {
    await reconcileSnapshotsWithAuthoritativeBalances(snapshots, cycle.cycle_key);
    await persistSnapshots(snapshots, cycle.cycle_key);
  }

  const leaderboardEntries = Object.values(snapshots)
    .sort((a, b) => {
      if (b.weekly_points !== a.weekly_points) return b.weekly_points - a.weekly_points;
      if (b.engagement_points !== a.engagement_points) return b.engagement_points - a.engagement_points;
      return a.nick.localeCompare(b.nick);
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

  const pointsRules = {
    ...DEFAULT_POINTS_RULES,
    ...parseJsonValue(settingsMap.get(POINTS_RULES_KEY)?.value, DEFAULT_POINTS_RULES),
  };

  return {
    rules,
    badgeRules,
    pointsRules,
    weeklyConfig,
    dailyCheckInConfig,
    cycle,
    leaderboardEntries,
    snapshots,
  };
}

async function buildGamificationState(options = {}) {
  const forceFresh = options?.forceFresh === true;
  const now = Date.now();
  if (!forceFresh && gamificationStateCache.value && now < gamificationStateCache.expiresAt) {
    return gamificationStateCache.value;
  }

  if (!forceFresh && gamificationStatePromise) {
    return gamificationStatePromise;
  }

  gamificationStatePromise = buildGamificationStateFresh({
    persistDerived: options?.persistDerived === true,
  })
    .then((state) => {
      gamificationStateCache = {
        value: state,
        expiresAt: Date.now() + GAMIFICATION_STATE_TTL_MS,
      };
      return state;
    })
    .catch((error) => {
      invalidateGamificationStateCache();
      throw error;
    })
    .finally(() => {
      gamificationStatePromise = null;
    });

  return gamificationStatePromise;
}

function buildCompetitionBoard(entries, cycle, config) {
  const startsAt = new Date(cycle.starts_at);
  const endsAt = new Date(cycle.ends_at);
  const now = Date.now();
  const remainingMs = Math.max(0, endsAt.getTime() - now);
  const totalMs = Math.max(1, endsAt.getTime() - startsAt.getTime());
  const elapsedMs = Math.max(0, now - startsAt.getTime());
  const progressPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  return {
    config,
    cycle: {
      ...cycle,
      remainingMs,
      totalMs,
      elapsedMs,
      progressPct,
    },
    entries: entries.slice(0, 50),
    rewardLabel: `O TOP ${Math.max(1, Number(config.winners_count || 10))} vai levar bancas garantidas!`,
  };
}

function extractProfileSummaryPayload(payload = {}) {
  const competitionBoard = payload?.competitionBoard || {};
  return {
    metrics: payload?.metrics || {},
    pointsRules: payload?.pointsRules || DEFAULT_POINTS_RULES,
    badgeRules: payload?.badgeRules || DEFAULT_BADGE_RULES,
    dailyCheckInConfig: payload?.dailyCheckInConfig || DEFAULT_DAILY_CHECKIN_CONFIG,
    achievements: Array.isArray(payload?.achievements) ? payload.achievements : [],
    progressBadges: Array.isArray(payload?.progressBadges) ? payload.progressBadges : [],
    currentCompetitionEntry: payload?.currentCompetitionEntry || null,
    competitionBoard: {
      config: competitionBoard?.config || DEFAULT_PROFILE_COMPETITION_CONFIG,
      cycle: competitionBoard?.cycle || { remainingMs: 0, progressPct: 0 },
      entries: Array.isArray(competitionBoard?.entries) ? competitionBoard.entries : [],
      rewardLabel: competitionBoard?.rewardLabel || "",
    },
  };
}

function extractProfileCompetitionBoardPayload(payload = {}) {
  const competitionBoard = payload?.competitionBoard || {};
  return {
    competitionBoard: {
      config: competitionBoard?.config || DEFAULT_PROFILE_COMPETITION_CONFIG,
      cycle: competitionBoard?.cycle || { remainingMs: 0, progressPct: 0 },
      entries: Array.isArray(competitionBoard?.entries) ? competitionBoard.entries : [],
      rewardLabel: competitionBoard?.rewardLabel || "",
    },
    currentCompetitionEntry: payload?.currentCompetitionEntry || null,
  };
}

async function buildLightweightProfileMetricsFresh(userId, options = {}) {
  const includeCompetitionBoard = options?.includeCompetitionBoard !== false;
  const [{ badgeRules, weeklyConfig, dailyCheckInConfig }, settingsMap] = await Promise.all([
    loadGamificationRules(),
    listAppSettingsMap(),
  ]);
  const cycle = await ensureActiveWeeklyCycle(weeklyConfig);

  const queryTasks = [
    pool.query(
      `SELECT metric_key, cycle_key, amount
         FROM user_metric_balances
        WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE entity_name = 'LiveDrawParticipant')::int AS live_participations,
         COUNT(*) FILTER (WHERE entity_name = 'GameCallParticipant')::int AS game_participations,
         COUNT(*) FILTER (WHERE entity_name = 'InstantRaffleParticipant')::int AS instant_participations
       FROM entity_records
       WHERE entity_name IN ('LiveDrawParticipant', 'GameCallParticipant', 'InstantRaffleParticipant')
         AND COALESCE(data->>'user_id', '') = $1`,
      [userId]
    ),
  ];

  if (includeCompetitionBoard) {
    queryTasks.push(
      pool.query(
        `WITH weekly AS (
           SELECT user_id, amount
             FROM user_metric_balances
            WHERE metric_key = 'weekly_points'
              AND cycle_key = $1
              AND amount > 0
         ),
         engagement AS (
           SELECT user_id, amount
             FROM user_metric_balances
            WHERE metric_key = 'engagement_points'
              AND cycle_key = ''
         ),
         ranked AS (
           SELECT
             w.user_id,
             w.amount AS weekly_points,
             COALESCE(e.amount, 0) AS engagement_points,
             ROW_NUMBER() OVER (ORDER BY w.amount DESC, COALESCE(e.amount, 0) DESC, u.nick ASC, u.id ASC) AS position,
             u.nick,
             u.full_name,
             u.profile_avatar_id,
             u.profile_image_mode,
             u.profile_image_status,
             CASE
               WHEN LOWER(COALESCE(u.profile_image_mode, 'avatar')) = 'photo'
                AND LOWER(COALESCE(u.profile_image_status, 'none')) = 'approved'
               THEN COALESCE(NULLIF(BTRIM(u.profile_image_url), ''), '/api/auth/profile-image/' || u.id::text)
               ELSE ''
             END AS profile_image_url
           FROM weekly w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN engagement e ON e.user_id = w.user_id
         )
         SELECT *
           FROM ranked
          WHERE position <= 20 OR user_id = $2
          ORDER BY position ASC`,
        [String(cycle?.cycle_key || ""), userId]
      )
    );
  }

  const [balanceRows, participationRows, leaderboardRowsResult = { rows: [] }] = await Promise.all(queryTasks);

  const pointsRules = {
    ...DEFAULT_POINTS_RULES,
    ...parseJsonValue(settingsMap.get(POINTS_RULES_KEY)?.value, DEFAULT_POINTS_RULES),
  };

  const balanceMap = new Map(
    balanceRows.rows.map((row) => [`${row.metric_key}::${row.cycle_key || ""}`, Number(row.amount || 0)])
  );
  const participationRow = participationRows?.rows?.[0] || {};

  const weeklyCycleKey = String(cycle?.cycle_key || "");
  const leaderboardEntries = (leaderboardRowsResult?.rows || []).map((row) => ({
    user_id: row.user_id,
    nick: String(row.nick || row.full_name || "Usuario"),
    profile_avatar_id: String(row.profile_avatar_id || ""),
    profile_image_mode: String(row.profile_image_mode || "avatar"),
    profile_image_status: String(row.profile_image_status || "none"),
    profile_image_url: String(row.profile_image_url || ""),
    weekly_points: Number(row.weekly_points || 0),
    engagement_points: Number(row.engagement_points || 0),
    position: Number(row.position || 0),
    points: Number(row.weekly_points || 0),
    stats: { approvedAmount: 0 },
  }));
  const currentCompetitionEntry =
    leaderboardEntries.find((entry) => entry.user_id === userId) || {
      user_id: userId,
      position: 0,
      weekly_points: 0,
      points: 0,
    };

  const metrics = {
    position: Number(currentCompetitionEntry.position || 0),
    totalApproved: 0,
    totalTickets: Number(balanceMap.get("tickets_active::") || 0),
    totalParticipations:
      Number(participationRow.live_participations || 0) +
      Number(participationRow.game_participations || 0) +
      Number(participationRow.instant_participations || 0),
    totalWins: Number(balanceMap.get("prize_counts::") || 0),
    liveParticipations: Number(participationRow.live_participations || 0),
    totalFollowers: Number(balanceMap.get("social_followers::") || 0),
    totalLikes: Number(balanceMap.get("social_likes::") || 0),
    totalCheckins: Number(balanceMap.get("daily_checkins::") || 0),
    followingCount: Number(balanceMap.get("social_following::") || 0),
    points: Number(balanceMap.get("engagement_points::") || 0),
    progress: Math.min(
      100,
      Math.round(
        ((Number(participationRow.live_participations || 0) +
          Number(participationRow.game_participations || 0) +
          Number(participationRow.instant_participations || 0)) /
          Math.max(1, Number(pointsRules.progress_target_participations || 25))) *
          100
      )
    ),
    xpTotal: Number(balanceMap.get("xp_total::") || 0),
    xp_total: Number(balanceMap.get("xp_total::") || 0),
    weeklyPoints: Number(balanceMap.get(`weekly_points::${weeklyCycleKey}`) || 0),
    weekly_points: Number(balanceMap.get(`weekly_points::${weeklyCycleKey}`) || 0),
    chestRewards: Number(balanceMap.get("chest_rewards::") || 0),
    prizeCounts: Number(balanceMap.get("prize_counts::") || 0),
  };

  const achievements = computeAchievements(metrics, badgeRules);
  const progressBadge = buildProgressBadge(metrics, pointsRules);

  return {
    metrics,
    pointsRules,
    badgeRules,
    dailyCheckInConfig,
    achievements,
    progressBadges: [progressBadge],
    competitionBoard: buildCompetitionBoard(leaderboardEntries, cycle, weeklyConfig),
    currentCompetitionEntry,
  };
}

async function buildLightweightProfileMetrics(userId, options = {}) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    throw new Error("Invalid user id");
  }

  const forceFresh = options?.forceFresh === true;
  const includeCompetitionBoard = options?.includeCompetitionBoard !== false;
  const now = Date.now();
  const cacheScope = includeCompetitionBoard ? "full" : "summary";
  const localCacheKey = `${safeUserId}:${cacheScope}`;
  const cached = profileMetricsCache.get(localCacheKey);
  const sharedCacheKey = `gamification:profile-metrics:${safeUserId}:${cacheScope}`;

  if (!forceFresh && cached && now < cached.expiresAt) {
    return cached.value;
  }

  if (!forceFresh) {
    const sharedCached = await getCacheJson(sharedCacheKey);
    if (!cacheMiss(sharedCached)) {
      profileMetricsCache.set(safeUserId, {
        value: sharedCached,
        expiresAt: Date.now() + PROFILE_METRICS_TTL_MS,
      });
      return sharedCached;
    }
  }

  if (!forceFresh && profileMetricsPromises.has(localCacheKey)) {
    return profileMetricsPromises.get(localCacheKey);
  }

  const buildPromise = buildLightweightProfileMetricsFresh(safeUserId, { includeCompetitionBoard })
    .then(async (payload) => {
      profileMetricsCache.set(localCacheKey, {
        value: payload,
        expiresAt: Date.now() + PROFILE_METRICS_TTL_MS,
      });
      await setCacheJson(sharedCacheKey, payload, PROFILE_METRICS_TTL_MS);
      return payload;
    })
    .catch((error) => {
      profileMetricsCache.delete(localCacheKey);
      throw error;
    })
    .finally(() => {
      profileMetricsPromises.delete(localCacheKey);
    });

  profileMetricsPromises.set(localCacheKey, buildPromise);
  return buildPromise;
}

function buildFallbackProfileMetricsFromState(userId, state) {
  const safeUserId = String(userId || "").trim();
  const snapshot = state?.snapshots?.[safeUserId] || createUserSnapshot({ id: safeUserId });
  const currentCompetitionEntry =
    (state?.leaderboardEntries || []).find((entry) => String(entry?.user_id || "") === safeUserId) || {
      user_id: safeUserId,
      position: 0,
      weekly_points: 0,
      points: 0,
    };
  const pointsRules = {
    ...DEFAULT_POINTS_RULES,
    ...(state?.pointsRules || {}),
  };
  const metrics = {
    position: Number(currentCompetitionEntry.position || 0),
    totalApproved: Number(snapshot.totalApproved || 0),
    totalTickets: Number(snapshot.totalTickets || 0),
    totalParticipations: Number(snapshot.totalParticipations || 0),
    totalWins: Number(snapshot.totalWins || 0),
    liveParticipations: Number(snapshot.liveParticipations || 0),
    totalFollowers: Number(snapshot.totalFollowers || 0),
    totalLikes: Number(snapshot.totalLikes || 0),
    totalCheckins: Number(snapshot.totalCheckins || 0),
    followingCount: Number(snapshot.followingCount || 0),
    points: Number(snapshot.engagement_points || 0),
    progress: Math.min(
      100,
      Math.round(
        (Number(snapshot.totalParticipations || 0) / Math.max(1, Number(pointsRules.progress_target_participations || 25))) * 100
      )
    ),
    xpTotal: Number(snapshot.xp_total || 0),
    xp_total: Number(snapshot.xp_total || 0),
    weeklyPoints: Number(snapshot.weekly_points || 0),
    weekly_points: Number(snapshot.weekly_points || 0),
    chestRewards: Number(snapshot.chestRewards || 0),
    prizeCounts: Number(snapshot.prizeCounts || snapshot.totalWins || 0),
  };
  const badgeRules = Array.isArray(state?.badgeRules) ? state.badgeRules : DEFAULT_BADGE_RULES;
  return {
    metrics,
    pointsRules,
    badgeRules,
    dailyCheckInConfig: state?.dailyCheckInConfig || DEFAULT_DAILY_CHECKIN_CONFIG,
    achievements: computeAchievements(metrics, badgeRules),
    progressBadges: [buildProgressBadge(metrics, pointsRules)],
    competitionBoard: buildCompetitionBoard(
      Array.isArray(state?.leaderboardEntries) ? state.leaderboardEntries : [],
      state?.cycle || { starts_at: new Date().toISOString(), ends_at: new Date().toISOString() },
      state?.weeklyConfig || DEFAULT_WEEKLY_CONFIG
    ),
    currentCompetitionEntry,
    _degraded: true,
  };
}

function normalizeChestRewardDraft(entry = {}) {
  const allowedRewardTypes = new Set(["xp_total", "weekly_points", "engagement_points", "tickets_active", "points_balance"]);
  const rewardTypeRaw = String(entry.reward_type || "").trim().toLowerCase();
  const rewardType = allowedRewardTypes.has(rewardTypeRaw) ? rewardTypeRaw : "xp_total";
  const rewardUnitByType = {
    xp_total: "xp",
    weekly_points: "pontos",
    engagement_points: "pontos",
    tickets_active: "bilhetes",
    points_balance: "saldo",
  };
  const titleByType = {
    xp_total: "XP do Baú",
    weekly_points: "Pontos semanais",
    engagement_points: "Pontos de engajamento",
    tickets_active: "Bilhetes",
    points_balance: "Saldo do Baú",
  };
  return {
    id: String(entry.id || ""),
    title: String(entry.title || "Prêmio do Baú").trim() || "Prêmio do Baú",
    subtitle: String(entry.subtitle || "").trim(),
    reward_type: String(entry.reward_type || "points_balance").trim() || "points_balance",
    reward_amount: Math.max(0, Number(entry.reward_amount || 0)),
    reward_unit: String(entry.reward_unit || "").trim(),
    rarity: String(entry.rarity || "rare").trim() || "rare",
    special_label: String(entry.special_label || "").trim(),
    visual_theme: String(entry.visual_theme || "aurora").trim() || "aurora",
    icon: String(entry.icon || "sparkles").trim() || "sparkles",
    stock_total: Math.max(0, Number(entry.stock_total || 0)),
    claimed_count: Math.max(0, Number(entry.claimed_count || 0)),
    weight: Math.max(1, Number(entry.weight || 1)),
    grant_mode: String(entry.grant_mode || "auto").trim() || "auto",
    gallery_image_url: String(entry.gallery_image_url || "").trim(),
    active_from: String(entry.active_from || "").trim(),
    active_until: String(entry.active_until || "").trim(),
    applies_on: String(entry.applies_on || "").trim(),
    auto_apply: entry.auto_apply !== false,
    active: entry.active !== false,
    is_default: Boolean(entry.is_default),
    is_fallback: Boolean(entry.is_fallback),
    daily_cap: Math.max(0, Number(entry.daily_cap || 0)),
    sort_order: clampInt(entry.sort_order, 100, 0, 10000),
    asset_ref: String(entry.asset_ref || "").trim(),
  };
}

function sanitizeChestRewardDraft(entry = {}) {
  const allowedRewardTypes = new Set(["xp_total", "weekly_points", "engagement_points", "tickets_active", "points_balance"]);
  const rewardTypeRaw = String(entry.reward_type || entry.rewardType || "").trim().toLowerCase();
  const rewardType = allowedRewardTypes.has(rewardTypeRaw) ? rewardTypeRaw : "xp_total";
  const rewardUnitByType = {
    xp_total: "xp",
    weekly_points: "pontos",
    engagement_points: "pontos",
    tickets_active: "bilhetes",
    points_balance: "saldo",
  };
  const titleByType = {
    xp_total: "XP do Bau",
    weekly_points: "Pontos semanais",
    engagement_points: "Pontos de engajamento",
    tickets_active: "Bilhetes",
    points_balance: "Saldo do Bau",
  };
  return {
    ...entry,
    title: String(entry.title || entry.reward_title || "").trim() || titleByType[rewardType] || "Premio do Bau",
    reward_type: rewardType,
    reward_amount: Math.max(0, Number(entry.reward_amount ?? entry.rewardAmount ?? 0)),
    reward_unit: String(entry.reward_unit || entry.rewardUnit || "").trim() || rewardUnitByType[rewardType] || "",
    admin_contact_name: String(entry.admin_contact_name || entry.adminContactName || "").trim(),
    admin_contact_phone: String(entry.admin_contact_phone || entry.adminContactPhone || "").trim(),
    is_fallback: Boolean(entry.is_fallback ?? entry.isFallback),
    is_default: Boolean(entry.is_default ?? entry.isDefault),
  };
}

function validateChestRewardDraft(entry = {}) {
  const allowedRewardTypes = new Set(["xp_total", "weekly_points", "engagement_points", "tickets_active", "points_balance"]);
  if (!String(entry.title || "").trim()) {
    const error = new Error("Informe o nome do premio.");
    error.status = 400;
    throw error;
  }
  if (!allowedRewardTypes.has(String(entry.reward_type || "").trim().toLowerCase())) {
    const error = new Error("Tipo de premio invalido.");
    error.status = 400;
    throw error;
  }
}

async function listChestDailyUsage(chestDayKey = "") {
  if (!chestDayKey) return [];
  const result = await pool.query(
    `SELECT reward_config_id, chest_day_key, claimed_count, updated_at
     FROM daily_chest_reward_daily_usage
     WHERE chest_day_key = $1`,
    [String(chestDayKey)]
  );
  return result.rows.map((row) => ({
    reward_config_id: row.reward_config_id,
    chest_day_key: row.chest_day_key,
    claimed_count: Number(row.claimed_count || 0),
    updated_at: toIso(row.updated_at),
  }));
}

function buildDailyChestWindowKey(settingsMap) {
  const resetHour = clampInt(settingsMap.get("daily_chest_reset_hour")?.value, 0, 0, 23);
  const resetMinute = clampInt(settingsMap.get("daily_chest_reset_minute")?.value, 0, 0, 59);
  const now = new Date();
  const start = new Date(now);
  start.setHours(resetHour, resetMinute, 0, 0);
  if (now < start) {
    start.setDate(start.getDate() - 1);
  }
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

function generateDailyAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function appendAdminAudit({ domain, action, targetKey, beforeData = {}, afterData = {}, metadata = {}, adminUserId, adminEmail }) {
  await pool.query(
    `INSERT INTO admin_config_audit_logs (
      domain, action, target_key, before_data, after_data, metadata, admin_user_id, admin_email
    )
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      domain,
      action,
      targetKey,
      JSON.stringify(beforeData || {}),
      JSON.stringify(afterData || {}),
      JSON.stringify(metadata || {}),
      adminUserId || null,
      adminEmail || null,
    ]
  );
}

async function listPointsBalancesMap() {
  const result = await pool.query(
    `SELECT user_id, COALESCE(SUM(amount), 0) AS balance
       FROM points_ledger
      GROUP BY user_id`
  );
  return new Map(result.rows.map((row) => [row.user_id, Number(row.balance || 0)]));
}

async function listLastActivityMap() {
  const result = await pool.query(
    `SELECT user_id, MAX(activity_at) AS last_activity_at
       FROM (
         SELECT user_id, occurred_at AS activity_at FROM user_metric_ledger
         UNION ALL
         SELECT user_id, created_at AS activity_at FROM points_ledger
         UNION ALL
         SELECT user_id, opened_at AS activity_at FROM daily_chest_openings
       ) activities
      GROUP BY user_id`
  );
  return new Map(result.rows.map((row) => [row.user_id, row.last_activity_at ? toIso(row.last_activity_at) : null]));
}

async function getAdminUserMetricSnapshot(userId) {
  const [{ items }, state, pointsBalanceMap] = await Promise.all([
    buildAdminUsersDataset(),
    buildGamificationState(),
    listPointsBalancesMap(),
  ]);
  const user = items.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }
  return {
    cycle_key: String(state?.cycle?.cycle_key || ""),
    metrics: {
      xp_total: Number(user.xp_total || 0),
      weekly_points: Number(user.weekly_points || 0),
      engagement_points: Number(user.engagement_points || 0),
      tickets_active: Number(user.tickets_active || 0),
      tickets_bonus: Number(user.tickets_bonus || 0),
      points_balance: Number(pointsBalanceMap.get(userId) || user.points_balance || 0),
    },
  };
}

async function applyAdminMetricAdjustment({ userId, metricKey, reason, requestId, adjustment, adminAuth, ip, userAgent }) {
  const metricConfig = ADMIN_ADJUSTABLE_METRICS[metricKey];
  if (!metricConfig) {
    const error = new Error("Métrica não pode ser ajustada manualmente.");
    error.status = 400;
    throw error;
  }

  const user = await getEntityById("User", userId);
  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (metricConfig.pointsLedger) {
    const existing = await pool.query("SELECT * FROM points_ledger WHERE request_id = $1 LIMIT 1", [requestId]);
    if (existing.rows[0]) {
      const balanceResult = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM points_ledger WHERE user_id = $1", [userId]);
      return {
        ok: true,
        idempotent: true,
        metric_key: metricKey,
        previous_value: null,
        adjustment,
        final_value: Number(balanceResult.rows[0]?.total || 0),
      };
    }

    const beforeResult = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM points_ledger WHERE user_id = $1", [userId]);
    const beforeValue = Number(beforeResult.rows[0]?.total || 0);
    await pool.query(
      `INSERT INTO points_ledger (user_id, amount, reason, request_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        userId,
        Math.round(adjustment),
        `Ajuste manual admin: ${reason}`,
        requestId,
        JSON.stringify({
          type: "admin_adjustment",
          metric_key: metricKey,
          reason,
          admin_user_id: adminAuth.sub,
          admin_email: adminAuth.email,
        }),
      ],
    );
    const finalValue = beforeValue + Math.round(adjustment);
    await appendAdminAudit({
      domain: "user_metric_adjustment",
      action: "adjust_points_balance",
      targetKey: userId,
      beforeData: { metric_key: metricKey, value: beforeValue },
      afterData: { metric_key: metricKey, value: finalValue },
      metadata: { user_id: userId, metric_key: metricKey, adjustment: Math.round(adjustment), reason, request_id: requestId },
      adminUserId: adminAuth.sub,
      adminEmail: adminAuth.email,
    });
    await createSecurityEvent({
      user_id: adminAuth.sub,
      type: "ADMIN_METRIC_ADJUSTED",
      ip,
      user_agent: userAgent,
      metadata: { target_user_id: userId, metric_key: metricKey, adjustment: Math.round(adjustment), request_id: requestId },
    });
    return {
      ok: true,
      idempotent: false,
      metric_key: metricKey,
      previous_value: beforeValue,
      adjustment: Math.round(adjustment),
      final_value: finalValue,
    };
  }

  const cycleKey = metricConfig.cycleScoped ? String((await buildGamificationState()).cycle?.cycle_key || "") : "";
  if (metricConfig.cycleScoped && !cycleKey) {
    const error = new Error("Não há ciclo semanal ativo para ajustar esta métrica.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT *
         FROM user_metric_ledger
        WHERE user_id = $1
          AND metric_key = $2
          AND cycle_key = $3
          AND source_type = 'admin_adjustment'
          AND source_ref = $4
        LIMIT 1`,
      [userId, metricKey, cycleKey, requestId],
    );
    const currentBalance = await client.query(
      `SELECT *
         FROM user_metric_balances
        WHERE user_id = $1
          AND metric_key = $2
          AND cycle_key = $3
        FOR UPDATE`,
      [userId, metricKey, cycleKey],
    );
    const beforeValue = Number(currentBalance.rows[0]?.amount || 0);
    const roundedAdjustment = Math.round(adjustment);
    const wasIdempotent = Boolean(existing.rows[0]);
    if (!existing.rows[0]) {
      await upsertLedgerEntry(client, {
        userId,
        metricKey,
        cycleKey,
        amount: roundedAdjustment,
        sourceType: "admin_adjustment",
        sourceRef: requestId,
        occurredAt: new Date().toISOString(),
        metadata: {
          reason,
          admin_user_id: adminAuth.sub,
          admin_email: adminAuth.email,
        },
      });
      await setBalance(client, {
        userId,
        metricKey,
        cycleKey,
        amount: beforeValue + roundedAdjustment,
        metadata: {
          last_adjustment_reason: reason,
          adjusted_by: adminAuth.email,
        },
      });
    }
    await client.query("COMMIT");
    const refreshed = await pool.query(
      `SELECT amount
         FROM user_metric_balances
        WHERE user_id = $1
          AND metric_key = $2
          AND cycle_key = $3
        LIMIT 1`,
      [userId, metricKey, cycleKey],
    );
    const finalValue = Number(refreshed.rows[0]?.amount || beforeValue);
    if (!wasIdempotent) {
      await appendAdminAudit({
        domain: "user_metric_adjustment",
        action: "adjust_metric",
        targetKey: userId,
        beforeData: { metric_key: metricKey, cycle_key: cycleKey, value: beforeValue },
        afterData: { metric_key: metricKey, cycle_key: cycleKey, value: finalValue },
        metadata: { user_id: userId, metric_key: metricKey, cycle_key: cycleKey, adjustment: roundedAdjustment, reason, request_id: requestId },
        adminUserId: adminAuth.sub,
        adminEmail: adminAuth.email,
      });
      await createSecurityEvent({
        user_id: adminAuth.sub,
        type: "ADMIN_METRIC_ADJUSTED",
        ip,
        user_agent: userAgent,
        metadata: { target_user_id: userId, metric_key: metricKey, cycle_key: cycleKey, adjustment: roundedAdjustment, request_id: requestId },
      });
    }
    return {
      ok: true,
      idempotent: wasIdempotent,
      metric_key: metricKey,
      cycle_key: cycleKey,
      previous_value: beforeValue,
      adjustment: roundedAdjustment,
      final_value: finalValue,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listRecentAdminAdjustments(limit = 20) {
  const result = await pool.query(
    `SELECT *
       FROM admin_config_audit_logs
      WHERE domain = 'user_metric_adjustment'
      ORDER BY created_at DESC
      LIMIT $1`,
    [Math.max(1, Number(limit || 20))]
  );
  return result.rows.map((row) => ({
    id: row.id,
    target_key: row.target_key,
    action: row.action,
    before_data: row.before_data || {},
    after_data: row.after_data || {},
    metadata: row.metadata || {},
    admin_user_id: row.admin_user_id || "",
    admin_email: row.admin_email || "",
    created_at: toIso(row.created_at),
  }));
}

function buildAnomalyReasons(item) {
  const reasons = [];
  if (Number(item.xp_total || 0) >= 5000) reasons.push("XP total alto");
  if (Number(item.weekly_points || 0) >= 1000) reasons.push("Pontos semanais acima do normal");
  if (Number(item.tickets_active || 0) >= 1000) reasons.push("Bilhetes ativos muito altos");
  if (Number(item.points_balance || 0) >= 1000) reasons.push("Saldo alto");
  if (Number(item.manual_adjustments_count || 0) >= 3) reasons.push("Muitos ajustes manuais recentes");
  return reasons;
}

function sortAdminUsers(items, sortBy = "weekly_points") {
  const list = [...items];
  list.sort((a, b) => {
    switch (sortBy) {
      case "xp_total":
      case "weekly_points":
      case "engagement_points":
      case "tickets_active":
      case "tickets_bonus":
      case "points_balance":
      case "prize_counts":
        return Number(b[sortBy] || 0) - Number(a[sortBy] || 0) || String(a.nick || "").localeCompare(String(b.nick || ""));
      case "name":
        return String(a.full_name || a.nick || "").localeCompare(String(b.full_name || b.nick || ""));
      case "last_activity":
        return new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime();
      default:
        return Number(b.weekly_points || 0) - Number(a.weekly_points || 0) || String(a.nick || "").localeCompare(String(b.nick || ""));
    }
  });
  return list;
}

async function buildAdminUsersDataset() {
  const [state, users, balancesResult, pointsBalanceMap, lastActivityMap, recentAdjustments] = await Promise.all([
    buildGamificationState(),
    listEntity("User"),
    pool.query("SELECT * FROM user_metric_balances"),
    listPointsBalancesMap(),
    listLastActivityMap(),
    listRecentAdminAdjustments(200),
  ]);

  const balanceMap = new Map();
  for (const row of balancesResult.rows) {
    const userId = row.user_id;
    if (!balanceMap.has(userId)) {
      balanceMap.set(userId, {});
    }
    balanceMap.get(userId)[`${row.metric_key}::${row.cycle_key || ""}`] = Number(row.amount || 0);
  }

  const adjustmentCountMap = recentAdjustments.reduce((acc, entry) => {
    const userId = entry.metadata?.user_id || entry.target_key;
    if (!userId) return acc;
    acc.set(userId, (acc.get(userId) || 0) + 1);
    return acc;
  }, new Map());

  const leaderboardMap = new Map(state.leaderboardEntries.map((entry) => [entry.user_id, entry]));
  const items = users.map((user) => {
    const metrics = state.snapshots[user.id] || createUserSnapshot({ id: user.id });
    const leaderboard = leaderboardMap.get(user.id);
    const balances = balanceMap.get(user.id) || {};
    const xpTotal = Number(balances["xp_total::"] ?? metrics.xp_total ?? 0);
    const weeklyPoints = Number(balances[`weekly_points::${state.cycle?.cycle_key || ""}`] ?? metrics.weekly_points ?? 0);
    const engagementPoints = Number(balances["engagement_points::"] ?? metrics.engagement_points ?? 0);
    const ticketsActive = Number(balances["tickets_active::"] ?? metrics.totalTickets ?? 0);
    const ticketsBonus = Number(balances["tickets_bonus::"] ?? 0);
    const prizeCounts = Number(balances["prize_counts::"] ?? metrics.prizeCounts ?? 0);
    const levelProgress = getLevelProgress(xpTotal);
    const item = {
      id: user.id,
      full_name: user.full_name || "",
      nick: user.nick || "",
      email: user.email || "",
      phone: user.phone || "",
      status: user.account_status || "active",
      role: user.role || "user",
      level: levelProgress.level,
      xp_total: xpTotal,
      weekly_points: weeklyPoints,
      engagement_points: engagementPoints,
      tickets_active: ticketsActive,
      tickets_bonus: ticketsBonus,
      points_balance: Number(pointsBalanceMap.get(user.id) || 0),
      prize_counts: prizeCounts,
      chest_rewards: Number(balances["chest_rewards::"] ?? metrics.chestRewards ?? 0),
      social_followers: Number(balances["social_followers::"] ?? metrics.totalFollowers ?? 0),
      social_likes: Number(balances["social_likes::"] ?? metrics.totalLikes ?? 0),
      total_participations: Number(metrics.totalParticipations || 0),
      ranking_position: Number(leaderboard?.position || 0),
      last_activity_at: lastActivityMap.get(user.id) || toIso(user.updated_at),
      had_manual_adjustment: adjustmentCountMap.has(user.id),
      manual_adjustments_count: Number(adjustmentCountMap.get(user.id) || 0),
    };
    item.anomaly_reasons = buildAnomalyReasons(item);
    item.has_anomaly = item.anomaly_reasons.length > 0;
    return item;
  });

  const dashboard = await buildAdminUserAccessDashboard(lastActivityMap);

  return {
    state,
    items,
    recentAdjustments: recentAdjustments.slice(0, 20),
    dashboard,
  };
}

async function buildAdminUserAccessDashboard(lastActivityMap = new Map()) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const onlineThreshold = new Date(now.getTime() - 10 * 60 * 1000);

  const [dayResult, monthResult, trendResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS total
         FROM (
           SELECT user_id, occurred_at AS activity_at FROM user_metric_ledger
           UNION ALL
           SELECT user_id, created_at AS activity_at FROM points_ledger
           UNION ALL
           SELECT user_id, opened_at AS activity_at FROM daily_chest_openings
         ) activities
        WHERE activity_at >= $1`,
      [dayStart.toISOString()],
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS total
         FROM (
           SELECT user_id, occurred_at AS activity_at FROM user_metric_ledger
           UNION ALL
           SELECT user_id, created_at AS activity_at FROM points_ledger
           UNION ALL
           SELECT user_id, opened_at AS activity_at FROM daily_chest_openings
         ) activities
        WHERE activity_at >= $1`,
      [monthStart.toISOString()],
    ),
    pool.query(
      `SELECT to_char(date_trunc('day', activity_at), 'DD/MM') AS label,
              COUNT(DISTINCT user_id)::int AS total
         FROM (
           SELECT user_id, occurred_at AS activity_at FROM user_metric_ledger
           UNION ALL
           SELECT user_id, created_at AS activity_at FROM points_ledger
           UNION ALL
           SELECT user_id, opened_at AS activity_at FROM daily_chest_openings
         ) activities
        WHERE activity_at >= NOW() - INTERVAL '6 days'
        GROUP BY 1
        ORDER BY MIN(date_trunc('day', activity_at)) ASC`,
    ),
  ]);

  let onlineNow = 0;
  for (const activityAt of lastActivityMap.values()) {
    if (!activityAt) continue;
    if (new Date(activityAt).getTime() >= onlineThreshold.getTime()) {
      onlineNow += 1;
    }
  }

  return {
    online_now: onlineNow,
    accesses_today: Number(dayResult.rows[0]?.total || 0),
    accesses_month: Number(monthResult.rows[0]?.total || 0),
    chart: trendResult.rows.map((row) => ({
      label: row.label,
      total: Number(row.total || 0),
    })),
  };
}

function formatUserAdminSummary(user) {
  return [
    `Nome: ${user.full_name || "-"}`,
    `@${user.nick || "-"}`,
    `Email: ${user.email || "-"}`,
    `Telefone: ${user.phone || "-"}`,
    `ID: ${user.id}`,
    `Nível: ${user.level || 1}`,
    `XP: ${Number(user.xp_total || 0)}`,
    `Pontos semanais: ${Number(user.weekly_points || 0)}`,
    `Pontos de engajamento: ${Number(user.engagement_points || 0)}`,
    `Bilhetes ativos: ${Number(user.tickets_active || 0)}`,
    `Bilhetes bônus: ${Number(user.tickets_bonus || 0)}`,
    `Saldo / banca: ${Number(user.points_balance || 0)}`,
    `Prêmios: ${Number(user.prize_counts || 0)}`,
    `Ranking atual: ${Number(user.ranking_position || 0) || "-"}`,
    `Status: ${user.status || "-"}`,
    `Cadastro: ${user.created_at || "-"}`,
    `Acessos ao app: ${Number(user.login_count || 0)}`,
    `Última atividade: ${user.last_activity_at || "-"}`,
  ].join("\n");
}

router.get("/profile/metrics", requireAuth, async (req, res) => {
  const userId = req.auth?.sub || "";
  const shouldForceRefresh = String(req.query.force || "").trim().toLowerCase() === "true";
  try {
    if (shouldForceRefresh) {
      profileMetricsCache.delete(String(userId || "").trim());
      profileMetricsPromises.delete(String(userId || "").trim());
      await deleteCacheKey(`gamification:profile-metrics:${String(userId || "").trim()}`);
    }
    const payload = shouldForceRefresh
      ? await buildLightweightProfileMetrics(userId, {
          forceFresh: true,
        })
      : buildFallbackProfileMetricsFromState(userId, await buildGamificationState());

    if (!shouldForceRefresh) {
      profileMetricsCache.set(String(userId || "").trim(), {
        value: payload,
        expiresAt: Date.now() + PROFILE_METRICS_TTL_MS,
      });
      await setCacheJson(`gamification:profile-metrics:${String(userId || "").trim()}`, payload, PROFILE_METRICS_TTL_MS);
    }

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load lightweight profile metrics", {
      userId,
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
    const staleCached = profileMetricsCache.get(String(userId || "").trim())?.value || null;
    if (staleCached) {
      console.warn("Serving stale cached profile metrics", { userId });
      return res.json({ ...staleCached, _degraded: true });
    }
    try {
      const state = await buildGamificationState();
      const fallbackPayload = buildFallbackProfileMetricsFromState(userId, state);
      console.warn("Serving fallback profile metrics from gamification state", { userId });
      return res.json(fallbackPayload);
    } catch (fallbackError) {
      console.error("Failed to build fallback profile metrics", {
        userId,
        message: fallbackError?.message || String(fallbackError),
      });
      return res.status(500).json({ error: "Nao foi possivel carregar os dados do perfil agora." });
    }
  }
});

router.get("/profile/summary", requireAuth, async (req, res) => {
  const userId = req.auth?.sub || "";
  const safeUserId = String(userId || "").trim();
  const shouldForceRefresh = String(req.query.force || "").trim().toLowerCase() === "true";
  try {
    if (shouldForceRefresh) {
      profileMetricsCache.delete(safeUserId);
      profileMetricsPromises.delete(safeUserId);
      await deleteCacheKey(`gamification:profile-metrics:${safeUserId}`);
    }

    const payload = extractProfileSummaryPayload(
      await buildLightweightProfileMetrics(userId, {
        forceFresh: shouldForceRefresh,
        includeCompetitionBoard: false,
      })
    );

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load profile summary", {
      userId,
      message: error?.message || String(error),
    });
    try {
      const fallbackPayload = extractProfileSummaryPayload(buildFallbackProfileMetricsFromState(userId, await buildGamificationState()));
      return res.json({ ...fallbackPayload, _degraded: true });
    } catch {
      return res.status(500).json({ error: "Nao foi possivel carregar o resumo do perfil agora." });
    }
  }
});

router.get("/profile/competition-board", requireAuth, async (req, res) => {
  const userId = req.auth?.sub || "";
  const safeUserId = String(userId || "").trim();
  const shouldForceRefresh = String(req.query.force || "").trim().toLowerCase() === "true";
  try {
    if (shouldForceRefresh) {
      profileMetricsCache.delete(safeUserId);
      profileMetricsPromises.delete(safeUserId);
      await deleteCacheKey(`gamification:profile-metrics:${safeUserId}`);
    }

    const payload = extractProfileCompetitionBoardPayload(
      await buildLightweightProfileMetrics(userId, {
        forceFresh: shouldForceRefresh,
        includeCompetitionBoard: true,
      })
    );

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load profile competition board", {
      userId,
      message: error?.message || String(error),
    });
    try {
      const fallbackPayload = extractProfileCompetitionBoardPayload(
        buildFallbackProfileMetricsFromState(userId, await buildGamificationState())
      );
      return res.json({ ...fallbackPayload, _degraded: true });
    } catch {
      return res.status(500).json({ error: "Nao foi possivel carregar o ranking do perfil agora." });
    }
  }
});

router.get("/profile/public/:userId/summary", async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const payload = await getOrComputeCacheJson(`gamification:public-profile-summary:${targetUserId}`, PUBLIC_PROFILE_SUMMARY_TTL_MS, async () => (
      buildFallbackProfileMetricsFromState(targetUserId, await buildGamificationState())
    ));
    return res.json({
      metrics: payload.metrics || {},
      currentCompetitionEntry: payload.currentCompetitionEntry || null,
    });
  } catch (error) {
    console.error("Failed to load public profile summary", {
      targetUserId: req.params?.userId || "",
      viewerUserId: req.auth?.sub || "",
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
    return res.status(500).json({ error: "Nao foi possivel carregar o resumo publico agora." });
  }
});

router.get("/profile/public-basics", async (req, res) => {
  try {
    const items = await listPublicProfileBasics(
      String(req.query?.ids || "").split(","),
      String(req.query?.handles || "").split(",")
    );
    return res.json({ items });
  } catch (error) {
    console.error("Failed to load public profile basics", error);
    return res.status(500).json({ error: "Nao foi possivel carregar os perfis agora." });
  }
});

router.get("/profile/public-directory", async (req, res) => {
  try {
    const limit = clampInt(req.query?.limit, 24, 1, 60);
    const offset = clampInt(req.query?.offset, 0, 0, 5000);
    const payload = await getOrComputeCacheJson(
      `gamification:profile-public-directory:${limit}:${offset}`,
      PROFILE_PUBLIC_BASICS_TTL_MS,
      async () => {
        const result = await pool.query(
          `SELECT
             u.id,
             u.nick,
             u.full_name,
             u.avatar_emoji,
             u.profile_avatar_id,
             u.profile_image_mode,
             u.profile_image_status,
             u.profile_image_url,
             u.created_at,
             COUNT(*) OVER()::int AS total_count
           FROM users u
           WHERE COALESCE(u.account_status, 'active') <> 'deactivated'
           ORDER BY
             CASE
               WHEN LOWER(COALESCE(u.profile_image_mode, '')) = 'photo'
                AND LOWER(COALESCE(u.profile_image_status, '')) = 'approved'
                AND COALESCE(NULLIF(BTRIM(u.profile_image_url), ''), '') <> ''
                 THEN 0
               WHEN COALESCE(NULLIF(BTRIM(u.profile_avatar_id), ''), '') <> ''
                 OR COALESCE(NULLIF(BTRIM(u.avatar_emoji), ''), '') <> ''
                 THEN 1
               ELSE 2
             END ASC,
             u.created_at DESC
           LIMIT $1
          OFFSET $2`,
          [limit + 1, offset]
        );

        const rows = result.rows || [];
        const visibleRows = rows.slice(0, limit);
        const items = visibleRows.map((row) => {
          const approvedProfileImageUrl =
            String(row.profile_image_mode || "").toLowerCase() === "photo" &&
            String(row.profile_image_status || "").toLowerCase() === "approved"
              ? String(row.profile_image_url || "").trim() || (row.id ? `/api/auth/profile-image/${row.id}` : "")
              : "";

          return {
            id: row.id,
            nick: row.nick || row.full_name || "Usuario",
            handle: buildHandle(row.nick || row.full_name || "", row.id),
            avatar_emoji: row.avatar_emoji || "",
            profile_avatar_id: row.profile_avatar_id || "",
            profile_image_mode: row.profile_image_mode || "avatar",
            profile_image_status: row.profile_image_status || "none",
            profile_image_url: approvedProfileImageUrl,
            created_date: toIso(row.created_at),
          };
        });
        const total = Number(visibleRows[0]?.total_count || rows[0]?.total_count || 0);

        return {
          items,
          total,
          limit,
          offset,
          nextOffset: offset + items.length,
          hasMore: rows.length > limit,
        };
      }
    );

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load public profile directory", error);
    return res.status(500).json({ error: "Nao foi possivel carregar a galeria de perfis." });
  }
});

router.get("/profile/notifications", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth?.sub || "").trim();
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 50)));
    const items = await listProfileNotifications(userId, limit);
    return res.json({ items });
  } catch (error) {
    console.error("Failed to load profile notifications", error);
    return res.status(500).json({ error: "Nao foi possivel carregar as notificacoes agora." });
  }
});

router.post("/profile/notifications/read", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth?.sub || "").trim();
    const payload = await markProfileNotificationsRead(userId, req.body?.ids);
    return res.json(payload);
  } catch (error) {
    console.error("Failed to mark profile notifications as read", error);
    return res.status(500).json({ error: "Nao foi possivel atualizar as notificacoes agora." });
  }
});

router.get("/profile/platform-history", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth?.sub || "").trim();
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100)));
    const items = await listPlatformHistory(userId, limit);
    return res.json({ items });
  } catch (error) {
    console.error("Failed to load platform history", error);
    return res.status(500).json({ error: "Nao foi possivel carregar o historico de plataformas agora." });
  }
});

router.get("/platforms/summary", requireAuth, async (_req, res) => {
  try {
    const [currentPlatform, activePlatforms] = await Promise.all([
      getCurrentPlatform(),
      listActivePlatforms(),
    ]);
    return res.json({ currentPlatform, activePlatforms });
  } catch (error) {
    console.error("Failed to load platforms summary", error);
    return res.status(500).json({ error: "Nao foi possivel carregar as plataformas agora." });
  }
});

router.get("/ui/public-config", requireAuth, async (_req, res) => {
  try {
    return res.json(await loadPublicUiConfig());
  } catch (error) {
    console.error("Failed to load public UI config", error);
    return res.status(500).json({ error: "Nao foi possivel carregar a configuracao publica agora." });
  }
});

router.get("/profile/history", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const [ledger, balances, prizes] = await Promise.all([
    pool.query(
      `SELECT * FROM user_metric_ledger
       WHERE user_id = $1
       ORDER BY occurred_at DESC, created_at DESC
       LIMIT 80`,
      [userId]
    ),
    pool.query(
      `SELECT * FROM user_metric_balances
       WHERE user_id = $1
       ORDER BY metric_key ASC`,
      [userId]
    ),
    listEntity("UserPrizeGalleryItem", "-claimed_at", 40).then((items) => items.filter((item) => item.user_id === userId)),
  ]);

  res.json({
    ledger: ledger.rows.map((row) => ({
      id: row.id,
      metric_key: row.metric_key,
      cycle_key: row.cycle_key,
      amount: Number(row.amount || 0),
      source_type: row.source_type,
      source_ref: row.source_ref,
      occurred_at: toIso(row.occurred_at),
      metadata: row.metadata || {},
    })),
    balances: balances.rows.map((row) => ({
      metric_key: row.metric_key,
      cycle_key: row.cycle_key,
      amount: Number(row.amount || 0),
      metadata: row.metadata || {},
      updated_at: toIso(row.updated_at),
    })),
    prizes,
  });
});

router.get("/profile/prize-gallery", async (req, res) => {
  try {
    const requestedUserId = String(req.query?.userId || "").trim();
    const userId = requestedUserId || String(req.auth?.sub || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Usuario invalido." });
    }
    const limit = clampInt(req.query?.limit, 3, 1, 24);
    const offset = clampInt(req.query?.offset, 0, 0, 2000);
    const payload = await getOrComputeCacheJson(
      `gamification:profile-prize-gallery:${userId}:${limit}:${offset}`,
      PROFILE_PRIZE_GALLERY_TTL_MS,
      async () => {
        const [countResult, itemsResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS total
               FROM entity_records
              WHERE entity_name = 'UserPrizeGalleryItem'
                AND COALESCE(data->>'user_id', '') = $1`,
            [userId]
          ),
          pool.query(
            `SELECT id, data, created_at, updated_at
               FROM entity_records
              WHERE entity_name = 'UserPrizeGalleryItem'
                AND COALESCE(data->>'user_id', '') = $1
              ORDER BY created_at DESC,
                       updated_at DESC,
                       id ASC
              LIMIT $2
             OFFSET $3`,
            [userId, limit, offset]
          ),
        ]);

        const items = itemsResult.rows
          .map(normalizeEntityRecordRow)
          .sort((a, b) => {
            const timeA = Date.parse(String(a?.claimed_at || a?.created_date || a?.created_at || ""));
            const timeB = Date.parse(String(b?.claimed_at || b?.created_date || b?.created_at || ""));
            const safeA = Number.isFinite(timeA) ? timeA : 0;
            const safeB = Number.isFinite(timeB) ? timeB : 0;
            if (safeB !== safeA) return safeB - safeA;
            return String(b?.id || "").localeCompare(String(a?.id || ""));
          });
        const total = Number(countResult.rows[0]?.total || 0);

        return {
          items,
          total,
          limit,
          offset,
          nextOffset: offset + items.length,
          hasMore: offset + items.length < total,
        };
      }
    );

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load profile prize gallery", error);
    return res.status(500).json({ error: "Nao foi possivel carregar a galeria de premios." });
  }
});

router.get("/prizes/winners-history", requireAuth, async (req, res) => {
  const parsedLimitDays = Number.parseInt(String(req.query?.limitDays || "").trim(), 10);
  const parsedSkipDays = Number.parseInt(String(req.query?.skipDays || "").trim(), 10);
  const limitDays = Number.isFinite(parsedLimitDays) && parsedLimitDays > 0 ? parsedLimitDays : null;
  const skipDays = Number.isFinite(parsedSkipDays) && parsedSkipDays > 0 ? parsedSkipDays : 0;
  const cacheKey = `${limitDays ?? "all"}:${skipDays}`;
  try {
    const payload = await getOrComputeCacheJson(`gamification:winners-history:${cacheKey}`, WINNERS_HISTORY_TTL_MS, async () => {
  const isRecentOnlyRequest = skipDays === 0 && limitDays === 1;
  const auditsFetchLimit = isRecentOnlyRequest ? 250 : 1000;
  const prizeFetchLimit = isRecentOnlyRequest ? 250 : 1000;
  const raffleFetchLimit = isRecentOnlyRequest ? 120 : 300;
  const userFetchLimit = isRecentOnlyRequest ? 400 : 1000;

        const [audits, users, instantRaffles, liveRaffles, gameCallRaffles, prizeItems] = await Promise.all([
          listEntity("DrawWinnerAudit", "-drawn_at", auditsFetchLimit),
          listEntity("User", "-created_date", userFetchLimit),
          listEntity("InstantRaffle", "-created_date", raffleFetchLimit),
          listEntity("LiveDrawRaffle", "-created_date", raffleFetchLimit),
          listEntity("GameCallRaffle", "-created_date", raffleFetchLimit),
    listEntity("UserPrizeGalleryItem", "-claimed_at", prizeFetchLimit),
  ]);

  const validatedAudits = audits.filter((audit) => String(audit?.status || "").toLowerCase() === "validated");
  const usersById = new Map(users.map((user) => [String(user.id), user]));
  const instantById = new Map(instantRaffles.map((item) => [String(item.id), item]));
  const liveById = new Map(liveRaffles.map((item) => [String(item.id), item]));
  const gameCallById = new Map(gameCallRaffles.map((item) => [String(item.id), item]));
  const groupedDays = new Map();

  validatedAudits.forEach((audit) => {
    const sourceType = resolveAuditSourceType(audit);
    const raffleId = String(audit?.raffle_id || "").trim();
    const user = usersById.get(String(audit?.user_id || "").trim()) || null;
    const relatedRaffle =
      sourceType === "instant_raffle"
        ? instantById.get(raffleId) || null
        : sourceType === "game_call"
          ? gameCallById.get(raffleId) || null
          : sourceType === "live_draw"
            ? liveById.get(raffleId) || null
            : null;

    const auditDate = audit?.validated_at || audit?.drawn_at || audit?.created_date || null;
    const dayKey = buildDayKey(auditDate);
    if (!dayKey) return;

    if (!groupedDays.has(dayKey)) {
      groupedDays.set(dayKey, {
        day_key: dayKey,
        date_label: formatDayLabel(auditDate),
        raw_date: auditDate,
        total_winners: 0,
        total_draws: 0,
        draws_map: new Map(),
      });
    }

    const dayBucket = groupedDays.get(dayKey);
    const drawKey =
      sourceType === "deposit_draw"
        ? `deposit_draw:${String(audit?.cycle_number || "geral").trim()}`
        : `${sourceType}:${raffleId || String(audit?.raffle_title || "").trim()}`;

    if (!dayBucket.draws_map.has(drawKey)) {
      const matchedPrize = findPrizeItemForAudit(prizeItems, audit, sourceType);
      const prizeSnapshot = matchedPrize?.metadata?.reward_snapshot || {};
      let adminPhone = normalizeAdminPhone(
        audit?.admin_phone ||
          relatedRaffle?.telegram_link ||
          matchedPrize?.metadata?.admin_phone ||
          prizeSnapshot?.adminContactPhone ||
          prizeSnapshot?.admin_contact_phone ||
          ""
      );
      let adminName = normalizeAdminName(
        audit?.admin_name ||
          relatedRaffle?.admin_name ||
          matchedPrize?.metadata?.admin_name ||
          prizeSnapshot?.adminContactName ||
          prizeSnapshot?.admin_contact_name
      );

      if (!adminPhone) {
        adminPhone = LEGACY_HISTORY_ADMIN_PHONE;
      }

      if (!adminName || adminName === "Admin responsavel") {
        adminName = LEGACY_HISTORY_ADMIN_NAME;
      }

      dayBucket.draws_map.set(drawKey, {
        draw_key: drawKey,
        source_type: sourceType,
        source_label: resolveAuditSourceLabel(audit),
        raffle_title: String(audit?.raffle_title || relatedRaffle?.title || resolveAuditSourceLabel(audit)).trim(),
        cycle_number: audit?.cycle_number ?? null,
        admin_name: adminName,
        admin_phone: adminPhone,
        admin_phone_label: extractPhoneLabel(adminPhone),
        winners: [],
      });
      dayBucket.total_draws += 1;
    }

    const drawBucket = dayBucket.draws_map.get(drawKey);
    const profileImageUrl =
      user?.profile_image_mode === "photo" &&
      user?.profile_image_status === "approved" &&
      user?.id
        ? `/api/auth/profile-image/${user.id}`
        : "";

    drawBucket.winners.push({
      audit_id: audit.id,
      user_id: audit.user_id,
      name: String(audit.user_name || user?.full_name || user?.nick || "Participante").trim(),
      nick: String(audit.user_nick || user?.nick || "").trim(),
      avatar_emoji: String(user?.avatar_emoji || audit.user_avatar || "🎰"),
      profile_avatar_id: String(user?.profile_avatar_id || ""),
      profile_image_mode: String(user?.profile_image_mode || "avatar"),
      profile_image_status: String(user?.profile_image_status || "none"),
      profile_image_url: profileImageUrl,
      prize_amount: Number(audit.prize_amount || 0),
      game_call: String(audit.game_call || "").trim(),
      drawn_at: auditDate,
    });

    dayBucket.total_winners += 1;
  });

  const allDays = Array.from(groupedDays.values())
    .sort((a, b) => new Date(b.raw_date || 0).getTime() - new Date(a.raw_date || 0).getTime())
    .map((day) => ({
      day_key: day.day_key,
      date_label: day.date_label,
      total_winners: day.total_winners,
      total_draws: day.total_draws,
      draws: Array.from(day.draws_map.values()).map((draw) => ({
        ...draw,
        winners: draw.winners.sort((a, b) => new Date(b.drawn_at || 0).getTime() - new Date(a.drawn_at || 0).getTime()),
      })),
    }));

  const days = allDays.slice(skipDays, limitDays ? skipDays + limitDays : undefined);
      return { days };
    });
    return res.json(payload);
  } catch (error) {
    console.error("Failed to load winners history", error);
    return res.status(500).json({ error: "Nao foi possivel carregar o historico de ganhadores agora." });
  }
});

router.get("/home/summary", requireAuth, async (_req, res) => {
  try {
    const payload = await getOrComputeCacheJson("gamification:home-summary", HOME_SUMMARY_TTL_MS, async () => {
    const [totalMembersResult, creatorResult, recentProfilesResult] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM users"),
      pool.query(
        `SELECT *
           FROM users
          WHERE role = 'admin'
          ORDER BY created_at ASC
          LIMIT 1`
      ),
      pool.query(
        `SELECT *
           FROM users
          ORDER BY created_at DESC
          LIMIT 10`
      ),
    ]);

    const creator = creatorResult.rows[0] ? normalizeUser(creatorResult.rows[0]) : null;
    const recentProfiles = recentProfilesResult.rows.map((row) => normalizeUser(row));

      const payload = {
      totalMembers: Number(totalMembersResult.rows[0]?.total || 0),
      creator: creator
        ? {
            id: creator.id,
            full_name: creator.full_name,
            nick: creator.nick,
            avatar_emoji: creator.avatar_emoji,
            profile_avatar_id: creator.profile_avatar_id,
            profile_image_mode: creator.profile_image_mode,
            profile_image_url: creator.profile_image_url,
            profile_image_status: creator.profile_image_status,
          }
        : null,
      recentProfiles: recentProfiles.map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        nick: profile.nick,
        avatar_emoji: profile.avatar_emoji,
        profile_avatar_id: profile.profile_avatar_id,
        profile_image_mode: profile.profile_image_mode,
        profile_image_url: profile.profile_image_url,
        profile_image_status: profile.profile_image_status,
      })),
      };

      return payload;
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to load home summary", error);
    return res.status(500).json({ error: "Nao foi possivel carregar a pagina inicial agora." });
  }
});

router.get("/feed/wins", requireAuth, async (_req, res) => {
  const recentInventory = (await listEntity("UserPrizeGalleryItem", "-claimed_at", 120))
    .filter((item) => ["validated", "applied"].includes(String(item.claim_status || "").trim().toLowerCase()))
    .slice(0, 40);

  const userIds = Array.from(new Set(recentInventory.map((item) => item.user_id).filter(Boolean)));
  let usersById = new Map();
  if (userIds.length > 0) {
    const userRows = await pool.query(
      `SELECT id, nick, full_name, avatar_emoji, profile_avatar_id, profile_image_mode, profile_image_url, profile_image_status
         FROM users
        WHERE id = ANY($1::uuid[])`,
      [userIds]
    );
    usersById = new Map(userRows.rows.map((row) => [row.id, row]));
  }

  res.json({
    items: recentInventory.map((item) => {
      const user = usersById.get(item.user_id) || null;
      return {
        id: item.id,
        user_id: item.user_id,
        user_name: user?.full_name || item.metadata?.user_name || "Participante",
        user_nick: user?.nick || item.metadata?.user_nick || "",
        user_avatar: user?.avatar_emoji || "",
        profile_avatar_id: user?.profile_avatar_id || "",
        profile_image_mode: user?.profile_image_mode || "avatar",
        profile_image_url: getApprovedProfileImageUrl(user),
        source_type: item.source_type || "",
        source_label: mapPrizeSourceLabel(item.source_type),
        reward_label: buildPrizeRewardLabel(item),
        reward_type: item.reward_type || "",
        reward_amount: Number(item.reward_amount || 0),
        reward_unit: item.reward_unit || "",
        title: item.title || "",
        subtitle: item.subtitle || "",
        rarity: item.rarity || "rare",
        claimed_at: item.claimed_at || item.created_date || item.updated_date || null,
      };
    }),
  });
});

router.get("/home/feed-summary", requireAuth, async (req, res) => {
  const userId = String(req.auth?.sub || "").trim();
  try {
    const payload = await getOrComputeCacheJson(
      `gamification:home-feed-summary:${userId}`,
      HOME_FEED_SUMMARY_TTL_MS,
      async () => {
        const [postsResult, recentInventoryResult] = await Promise.all([
          pool.query(
            `SELECT id, data, created_at, updated_at
               FROM entity_records
              WHERE entity_name = 'PushNotification'
              ORDER BY created_at DESC
              LIMIT 30`
          ),
          listEntity("UserPrizeGalleryItem", "-claimed_at", 120).then((items) =>
            items
              .filter((item) => ["validated", "applied"].includes(String(item.claim_status || "").trim().toLowerCase()))
              .slice(0, 40)
          ),
        ]);

        const posts = postsResult.rows.map(normalizeEntityRecordRow);
        const recentInventory = recentInventoryResult;
        const targetPostIds = [
          ...posts.map((post) => `notice-${post.id}`),
          ...recentInventory.map((item) => `winner-${item.id}`),
        ].filter(Boolean);
        const winnerUserIds = Array.from(new Set(recentInventory.map((item) => item.user_id).filter(Boolean)));
        const [userRowsResult, countRowsResult, likedRowsResult] = await Promise.allSettled([
          winnerUserIds.length > 0
            ? pool.query(
                `SELECT id, nick, full_name, avatar_emoji, profile_avatar_id, profile_image_mode, profile_image_url, profile_image_status
                   FROM users
                  WHERE id = ANY($1::uuid[])`,
                [winnerUserIds]
              )
            : Promise.resolve({ rows: [] }),
          targetPostIds.length > 0
            ? pool.query(
                `SELECT COALESCE(data->>'post_id', '') AS post_id, COUNT(*)::int AS like_count
                   FROM entity_records
                  WHERE entity_name = 'FeedPostLike'
                    AND COALESCE(data->>'post_id', '') = ANY($1::text[])
                  GROUP BY COALESCE(data->>'post_id', '')`,
                [targetPostIds]
              )
            : Promise.resolve({ rows: [] }),
          targetPostIds.length > 0
            ? pool.query(
                `SELECT COALESCE(data->>'post_id', '') AS post_id
                   FROM entity_records
                  WHERE entity_name = 'FeedPostLike'
                    AND COALESCE(data->>'user_id', '') = $1
                    AND COALESCE(data->>'post_id', '') = ANY($2::text[])`,
                [userId, targetPostIds]
              )
            : Promise.resolve({ rows: [] }),
        ]);

        if (countRowsResult.status === "rejected") {
          console.error("Failed to load feed like counts", countRowsResult.reason);
        }
        if (likedRowsResult.status === "rejected") {
          console.error("Failed to load user feed likes", likedRowsResult.reason);
        }
        if (userRowsResult.status === "rejected") {
          console.error("Failed to load feed winner users", userRowsResult.reason);
        }

        const usersById = new Map(
          (userRowsResult.status === "fulfilled" ? userRowsResult.value.rows : []).map((row) => [row.id, row])
        );

        const counts = (countRowsResult.status === "fulfilled" ? countRowsResult.value.rows : []).reduce((acc, row) => {
          const postId = String(row.post_id || "").trim();
          if (!postId) return acc;
          acc[postId] = Number(row.like_count || 0);
          return acc;
        }, {});

        const likedPostIds = (likedRowsResult.status === "fulfilled" ? likedRowsResult.value.rows : [])
          .map((row) => String(row.post_id || "").trim())
          .filter(Boolean);

        return {
          posts,
          winnerFeed: {
            items: recentInventory.map((item) => {
              const user = usersById.get(item.user_id) || null;
              return {
                id: item.id,
                user_id: item.user_id,
                user_name: user?.full_name || item.metadata?.user_name || "Participante",
                user_nick: user?.nick || item.metadata?.user_nick || "",
                user_avatar: user?.avatar_emoji || "",
                profile_avatar_id: user?.profile_avatar_id || "",
                profile_image_mode: user?.profile_image_mode || "avatar",
                profile_image_url: getApprovedProfileImageUrl(user),
                source_type: item.source_type || "",
                source_label: mapPrizeSourceLabel(item.source_type),
                reward_label: buildPrizeRewardLabel(item),
                reward_type: item.reward_type || "",
                reward_amount: Number(item.reward_amount || 0),
                reward_unit: item.reward_unit || "",
                title: item.title || "",
                subtitle: item.subtitle || "",
                rarity: item.rarity || "rare",
                claimed_at: item.claimed_at || item.created_date || item.updated_date || null,
              };
            }),
          },
          feedLikes: {
            counts,
            likedPostIds,
          },
        };
      }
    );
    return res.json(payload);
  } catch (error) {
    console.error("Failed to load home feed summary", error);
    return res.status(500).json({ error: "Nao foi possivel carregar o feed inicial agora." });
  }
});

router.get("/notifications/recent", requireAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 50)));
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at
         FROM entity_records
        WHERE entity_name = 'PushNotification'
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    );
    return res.json({ items: result.rows.map(normalizeRecord) });
  } catch (error) {
    console.error("Failed to load recent notifications", error);
    return res.status(500).json({ error: "Nao foi possivel carregar as notificacoes agora." });
  }
});

router.get("/feed/likes", requireAuth, async (req, res) => {
  const userId = String(req.auth?.sub || "").trim();
  const [countRows, likedRows] = await Promise.all([
    pool.query(
      `SELECT COALESCE(data->>'post_id', '') AS post_id, COUNT(*)::int AS like_count
         FROM entity_records
        WHERE entity_name = 'FeedPostLike'
        GROUP BY COALESCE(data->>'post_id', '')`
    ),
    pool.query(
      `SELECT COALESCE(data->>'post_id', '') AS post_id
         FROM entity_records
        WHERE entity_name = 'FeedPostLike'
          AND COALESCE(data->>'user_id', '') = $1`,
      [userId]
    ),
  ]);

  const counts = countRows.rows.reduce((acc, row) => {
    const postId = String(row.post_id || "").trim();
    if (!postId) return acc;
    acc[postId] = Number(row.like_count || 0);
    return acc;
  }, {});

  const likedPostIds = likedRows.rows
    .map((row) => String(row.post_id || "").trim())
    .filter(Boolean);

  return res.json({ counts, likedPostIds });
});

router.post("/feed/likes/:postId", requireAuth, async (req, res) => {
  const userId = String(req.auth?.sub || "").trim();
  const postId = String(req.params.postId || "").trim();

  if (!postId || (!postId.startsWith("winner-") && !postId.startsWith("notice-"))) {
    return res.status(400).json({ error: "Post inválido." });
  }

  const existingLike = await pool.query(
    `SELECT id
       FROM entity_records
      WHERE entity_name = 'FeedPostLike'
        AND COALESCE(data->>'post_id', '') = $1
        AND COALESCE(data->>'user_id', '') = $2
      LIMIT 1`,
    [postId, userId]
  );

  if (existingLike.rows[0]?.id) {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS like_count
         FROM entity_records
        WHERE entity_name = 'FeedPostLike'
          AND COALESCE(data->>'post_id', '') = $1`,
      [postId]
    );
    return res.json({
      ok: true,
      liked: true,
      alreadyLiked: true,
      postId,
      likes: Number(countResult.rows[0]?.like_count || 0),
    });
  }

  await createEntity("FeedPostLike", {
    post_id: postId,
    user_id: userId,
  });

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS like_count
       FROM entity_records
      WHERE entity_name = 'FeedPostLike'
        AND COALESCE(data->>'post_id', '') = $1`,
    [postId]
  );

  await deleteCacheKey(`gamification:home-feed-summary:${userId}`);

  return res.json({
    ok: true,
    liked: true,
    alreadyLiked: false,
    postId,
    likes: Number(countResult.rows[0]?.like_count || 0),
  });
});

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { items, recentAdjustments, dashboard } = await buildAdminUsersDataset();
  const query = String(req.query.q || "").trim().toLowerCase();
  const sortBy = String(req.query.sortBy || "weekly_points").trim();
  const withPrizes = String(req.query.withPrizes || "false") === "true";
  const onlyAdjusted = String(req.query.onlyAdjusted || "false") === "true";
  const onlyAnomaly = String(req.query.onlyAnomaly || "false") === "true";

  let filtered = items;
  if (query) {
    filtered = filtered.filter((item) =>
      [item.full_name, item.nick, item.email, item.phone, item.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }
  if (withPrizes) {
    filtered = filtered.filter((item) => Number(item.prize_counts || 0) > 0);
  }
  if (onlyAdjusted) {
    filtered = filtered.filter((item) => item.had_manual_adjustment);
  }
  if (onlyAnomaly) {
    filtered = filtered.filter((item) => item.has_anomaly);
  }

  res.json({
    items: sortAdminUsers(filtered, sortBy).map((item) => ({
      ...item,
      summary_text: formatUserAdminSummary(item),
    })),
    recentAdjustments,
    dashboard,
  });
});

router.get("/admin/users/adjustments/recent", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ items: await listRecentAdminAdjustments(20) });
});

router.get("/admin/audits/winners", requireAuth, requireAdmin, async (req, res) => {
  const limit = clampInt(req.query?.limit, 300, 50, 500);
  const [audits, users, platformHistory, prizeGalleryItems] = await Promise.all([
    listEntity("DrawWinnerAudit", "-drawn_at", limit),
    listEntity("User", "-created_date", Math.max(limit, 300)),
    listEntity("PlatformHistory", "-created_date", Math.max(limit, 300)),
    listEntity("UserPrizeGalleryItem", "-claimed_at", Math.max(limit, 300)),
  ]);

  const usersById = new Map(users.map((user) => [String(user?.id || ""), user]));
  const historyByUserId = new Map();
  platformHistory.forEach((entry) => {
    const userId = String(entry?.user_id || "").trim();
    if (!userId) return;
    if (!historyByUserId.has(userId)) {
      historyByUserId.set(userId, []);
    }
    historyByUserId.get(userId).push(entry);
  });

  const prizeByAuditKey = new Map();
  prizeGalleryItems.forEach((item) => {
    const auditId = String(item?.metadata?.audit_id || "").trim();
    if (auditId) prizeByAuditKey.set(`audit:${auditId}`, item);
    const openingId = String(item?.source_ref_id || item?.metadata?.opening_id || "").trim();
    if (openingId) prizeByAuditKey.set(`opening:${openingId}`, item);
  });

  const items = audits.map((audit) => {
    const user = usersById.get(String(audit?.user_id || "")) || null;
    const matchedPrize =
      prizeByAuditKey.get(`audit:${String(audit?.id || "").trim()}`) ||
      prizeByAuditKey.get(`opening:${String(audit?.opening_id || "").trim()}`) ||
      null;
    const platformId = audit.user_platform_id || audit.platform_id || user?.platform_id || "";
    const userHistory = historyByUserId.get(String(audit?.user_id || "")) || [];
    const platformName =
      audit.platform_name ||
      userHistory.find((entry) => String(entry?.platform_id || "").trim() === String(platformId || "").trim())?.platform_name ||
      userHistory[0]?.platform_name ||
      audit.platform ||
      "NÃ£o informado";
    const avatarUrlRaw = audit.user_profile_image_url || user?.profile_image_url || "";
    const canUseApprovedPhoto =
      Boolean(audit.user_profile_image_url) ||
      (user?.profile_image_mode === "photo" &&
        user?.profile_image_status === "approved" &&
        user?.profile_image_url);

    return {
      ...audit,
      user_name: audit.user_name || user?.full_name || user?.nick || "Sem nome",
      user_nick: audit.user_nick || user?.nick || "-",
      user_email: audit.user_email || user?.email || "",
      user_phone: audit.user_phone || user?.phone || "",
      user_platform_id: platformId,
      platform_name: platformName,
      avatar_url: canUseApprovedPhoto && avatarUrlRaw ? avatarUrlRaw : "",
      raffle_title: audit.raffle_title || "Sorteio sem titulo",
      game_call: audit.game_call || "",
      status: audit.status || "validated",
      reward_type: resolveAuditRewardType(audit),
      validation_code: resolveAuditValidationCode(audit, matchedPrize),
      redemption_status: audit.redemption_status || "pending",
      redeemed_at: audit.redeemed_at || null,
      prize_amount: Number(audit.prize_amount || 0) || 0,
    };
  });

  res.json({ items });
});

router.post("/admin/audits/winners/:id/redeem", requireAuth, requireAdmin, async (req, res) => {
  const auditId = String(req.params.id || "").trim();
  if (!auditId) {
    return res.status(400).json({ error: "Informe um auditId válido." });
  }

  const audit = await getEntityById("DrawWinnerAudit", auditId);
  if (!audit) {
    return res.status(404).json({ error: "Registro de auditoria não encontrado." });
  }

  const nextAudit = {
    ...audit,
    redemption_status: "redeemed",
    redeemed_at: audit.redeemed_at || new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE entity_records
        SET data = $2::jsonb,
            updated_at = NOW()
      WHERE entity_name = 'DrawWinnerAudit'
        AND id = $1`,
    [auditId, JSON.stringify(nextAudit)]
  );

  req.app?.locals?.io?.emit("entity:changed", {
    entity: "DrawWinnerAudit",
    action: "redeemed",
    payload: {
      audit_id: auditId,
      user_id: String(audit.user_id || ""),
      redemption_status: "redeemed",
    },
  });

  return res.json({ item: nextAudit });
});

router.delete("/admin/audits/winners/:id", requireAuth, requireAdmin, async (req, res) => {
  const auditId = String(req.params.id || "").trim();
  if (!auditId) {
    return res.status(400).json({ error: "Informe um auditId válido." });
  }

  const audit = await getEntityById("DrawWinnerAudit", auditId);
  if (!audit) {
    return res.status(404).json({ error: "Registro de auditoria não encontrado." });
  }

  const prizeItems = await listEntity("UserPrizeGalleryItem", "-claimed_at", 500);
  const matchedPrizeItems = prizeItems.filter((item) => isPrizeGalleryMatchForAudit(item, audit));
  const normalizedRaffleId = String(audit.raffle_id || "").trim();
  const isInstantRaffleAudit = normalizedRaffleId.startsWith("instant_");
  const instantParticipants = isInstantRaffleAudit
    ? (await listEntity("InstantRaffleParticipant", "-created_date", 1000)).filter((item) => {
        return (
          String(item.raffle_id || "").trim() === normalizedRaffleId &&
          String(item.user_id || "").trim() === String(audit.user_id || "").trim()
        );
      })
    : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const participant of instantParticipants) {
      await client.query(
        `UPDATE entity_records
            SET data = $3::jsonb,
                updated_at = NOW()
          WHERE entity_name = 'InstantRaffleParticipant'
            AND id = $1
            AND user_id = $2`,
        [
          participant.id,
          participant.user_id,
          JSON.stringify({
            ...participant,
            won: false,
            validated: false,
            prize_claimed: false,
            dismissed: false,
            updated_date: new Date().toISOString(),
          }),
        ]
      );
    }

    for (const item of matchedPrizeItems) {
      await client.query("DELETE FROM entity_records WHERE entity_name = 'UserPrizeGalleryItem' AND id = $1", [item.id]);
    }

    await client.query("DELETE FROM entity_records WHERE entity_name = 'DrawWinnerAudit' AND id = $1", [auditId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  emitEntityChanged(req, "DrawWinnerAudit", auditId, "deleted");
  matchedPrizeItems.forEach((item) => {
    emitEntityChanged(req, "UserPrizeGalleryItem", item.id, "deleted");
  });
  instantParticipants.forEach((participant) => {
    emitEntityChanged(req, "InstantRaffleParticipant", participant.id, "updated");
  });
  if (normalizedRaffleId) {
    emitEntityChanged(req, "InstantRaffle", normalizedRaffleId, "updated");
  }
  if (audit.user_id) {
    emitEntityChanged(req, "user", audit.user_id, "updated");
  }

  return res.json({
    ok: true,
    audit_id: auditId,
    removed_gallery_items: matchedPrizeItems.map((item) => item.id),
  });
});

router.get("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const user = await getEntityById("User", userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const [dataset, loginCountResult, ipRowsResult] = await Promise.all([
    buildAdminUsersDataset(),
    pool.query(
      `SELECT COUNT(*)::int AS total
         FROM login_attempts
        WHERE success = true
          AND LOWER(identifier) = LOWER($1)`,
      [String(user.email || "").trim()],
    ),
    pool.query(
      `SELECT ip, COUNT(*)::int AS hits, MAX(created_at) AS last_seen
         FROM login_attempts
        WHERE success = true
          AND LOWER(identifier) = LOWER($1)
          AND COALESCE(ip, '') <> ''
        GROUP BY ip
        ORDER BY MAX(created_at) DESC
        LIMIT 10`,
      [String(user.email || "").trim()],
    ),
  ]);
  const { items, state } = dataset;
  const item = items.find((entry) => entry.id === userId);
  const leaderboard = state.leaderboardEntries.find((entry) => entry.user_id === userId) || null;
  if (!item) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const ipList = ipRowsResult.rows.map((row) => ({
    ip: row.ip || "",
    hits: Number(row.hits || 0),
    last_seen: row.last_seen ? toIso(row.last_seen) : null,
  }));
  const suspiciousIpUsersResult = ipList.length > 0
    ? await pool.query(
        `SELECT ip, ARRAY_AGG(DISTINCT identifier) AS identifiers
           FROM login_attempts
          WHERE success = true
            AND ip = ANY($1::text[])
          GROUP BY ip`,
        [ipList.map((entry) => entry.ip)],
      )
    : { rows: [] };
  const sharedIpMap = new Map(
    suspiciousIpUsersResult.rows.map((row) => [
      row.ip,
      Array.isArray(row.identifiers) ? row.identifiers.filter((entry) => String(entry).toLowerCase() !== String(user.email || "").toLowerCase()) : [],
    ]),
  );
  const enrichedUser = {
    ...item,
    avatar_url: String(user.profile_image_url || "").trim() || (user.id ? `/api/auth/profile-image/${user.id}` : ""),
    created_at: user.created_at || user.created_date || null,
    updated_at: user.updated_at || user.updated_date || null,
    login_count: Number(loginCountResult.rows[0]?.total || 0),
    ips: ipList.map((entry) => ({
      ...entry,
      shared_accounts: sharedIpMap.get(entry.ip) || [],
      shared_accounts_count: (sharedIpMap.get(entry.ip) || []).length,
    })),
  };

  res.json({
    user: {
      ...enrichedUser,
      summary_text: formatUserAdminSummary(enrichedUser),
    },
    leaderboard,
  });
});

router.get("/admin/users/:id/history", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const user = await getEntityById("User", userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const [metricLedger, pointLedger, deposits, prizes, chestOpenings, engagements, adjustments, cashbackClaims] = await Promise.all([
    pool.query(
      `SELECT *
         FROM user_metric_ledger
        WHERE user_id = $1
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT 60`,
      [userId],
    ),
    pool.query(
      `SELECT *
         FROM points_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [userId],
    ),
    listEntity("Deposit", "-created_date", 100).then((items) => items.filter((item) => item.user_id === userId).slice(0, 20)),
    listEntity("UserPrizeGalleryItem", "-claimed_at", 100).then((items) => items.filter((item) => item.user_id === userId).slice(0, 20)),
    pool.query(
      `SELECT *
         FROM daily_chest_openings
        WHERE user_id = $1
        ORDER BY opened_at DESC
        LIMIT 20`,
      [userId],
    ),
    pool.query(
      `SELECT *
         FROM engagement_processing_events
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [userId],
    ),
    pool.query(
      `SELECT *
         FROM admin_config_audit_logs
        WHERE domain = 'user_metric_adjustment'
          AND target_key = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [userId],
    ),
    listEntity("CashbackClaim", "-created_date", 100).then((items) => items.filter((item) => item.user_id === userId).slice(0, 20)),
  ]);

  res.json({
    metricLedger: metricLedger.rows.map((row) => ({
      id: row.id,
      metric_key: row.metric_key,
      cycle_key: row.cycle_key,
      amount: Number(row.amount || 0),
      source_type: row.source_type,
      source_ref: row.source_ref,
      metadata: row.metadata || {},
      occurred_at: toIso(row.occurred_at),
      created_at: toIso(row.created_at),
    })),
    pointLedger: pointLedger.rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      reason: row.reason || "",
      metadata: row.metadata || {},
      created_at: toIso(row.created_at),
    })),
    deposits,
    prizes,
    chestOpenings: chestOpenings.rows.map((row) => ({
      id: row.id,
      chest_day_key: row.chest_day_key,
      slot_index: Number(row.slot_index || 0),
      status: row.status,
      reward_snapshot: row.reward_snapshot || {},
      xp_awarded: Number(row.xp_awarded || 0),
      opened_at: toIso(row.opened_at),
      claimed_at: row.claimed_at ? toIso(row.claimed_at) : null,
    })),
    participations: engagements.rows.map((row) => ({
      id: row.id,
      action_type: row.action_type,
      entity_name: row.entity_name,
      entity_id: row.entity_id,
      outcome: row.outcome,
      metadata: row.metadata || {},
      created_at: toIso(row.created_at),
    })),
    cashbackClaims,
    adjustments: adjustments.rows.map((row) => ({
      id: row.id,
      action: row.action,
      before_data: row.before_data || {},
      after_data: row.after_data || {},
      metadata: row.metadata || {},
      admin_user_id: row.admin_user_id || "",
      admin_email: row.admin_email || "",
      created_at: toIso(row.created_at),
    })),
  });
});

router.post("/admin/users/:id/adjust-metric", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const metricKey = String(req.body?.metricKey || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const requestId = String(req.body?.requestId || "").trim();
  const adjustment = Number(req.body?.adjustment);

  if (!userId || !metricKey || !reason || !requestId || !Number.isFinite(adjustment) || adjustment === 0) {
    return res.status(400).json({ error: "Envie userId, metricKey, adjustment, reason e requestId válidos." });
  }
  const result = await applyAdminMetricAdjustment({
    userId,
    metricKey,
    reason,
    requestId,
    adjustment,
    adminAuth: req.auth,
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    userAgent: String(req.headers["user-agent"] || ""),
  });
  return res.status(result.idempotent ? 200 : 201).json(result);
});

router.post("/admin/users/:id/reset-metrics", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const requestId = String(req.body?.requestId || "").trim();
  const reason = String(req.body?.reason || "").trim() || "Reset administrativo do usuário";
  const clearDisplayData = req.body?.clearDisplayData !== false;

  if (!userId || !requestId) {
    return res.status(400).json({ error: "Envie userId e requestId válidos." });
  }

  const snapshot = await getAdminUserMetricSnapshot(userId);
  if (!snapshot) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const resetClient = await pool.connect();
  try {
    await resetClient.query("BEGIN");
    const depositIdsResult = await resetClient.query(
      `SELECT id
         FROM entity_records
        WHERE entity_name = 'Deposit'
          AND COALESCE(data->>'user_id', '') = $1`,
      [userId],
    );
    const depositIds = depositIdsResult.rows.map((row) => String(row.id || "")).filter(Boolean);

    if (depositIds.length > 0) {
      await resetClient.query("DELETE FROM deposit_processing_events WHERE deposit_id = ANY($1::text[])", [depositIds]);
      await resetClient.query(
        "DELETE FROM daily_chest_bonus_grants WHERE source_type = 'deposit_approved' AND source_id = ANY($1::text[])",
        [depositIds],
      );
    }

    await resetClient.query("DELETE FROM daily_chest_openings WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM daily_chest_access_unlocks WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM daily_chest_bonus_grants WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM daily_checkins WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM engagement_processing_events WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM user_follows WHERE follower_user_id = $1 OR target_user_id = $1", [userId]);
    await resetClient.query("DELETE FROM profile_likes WHERE actor_user_id = $1 OR target_user_id = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'Deposit' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'LiveDrawParticipant' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'GameCallParticipant' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'InstantRaffleParticipant' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'DailyChestXpGrant' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'CompetitionPointEvent' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM entity_records WHERE entity_name = 'CashbackClaim' AND COALESCE(data->>'user_id', '') = $1", [userId]);
    await resetClient.query("DELETE FROM user_metric_ledger WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM user_metric_balances WHERE user_id = $1", [userId]);
    await resetClient.query("DELETE FROM points_ledger WHERE user_id = $1", [userId]);
    await resetClient.query("COMMIT");
  } catch (error) {
    await resetClient.query("ROLLBACK");
    throw error;
  } finally {
    resetClient.release();
  }

  let removedPrizeCount = 0;
  let removedAuditCount = 0;
  if (clearDisplayData) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userPrizeItems = (await listEntity("UserPrizeGalleryItem", "-claimed_at", 500)).filter((item) => item.user_id === userId);
      const userAudits = (await listEntity("DrawWinnerAudit", "-created_date", 500)).filter((item) => item.user_id === userId);

      for (const item of userPrizeItems) {
        await client.query("DELETE FROM entity_records WHERE entity_name = 'UserPrizeGalleryItem' AND id = $1", [item.id]);
      }
      for (const item of userAudits) {
        await client.query("DELETE FROM entity_records WHERE entity_name = 'DrawWinnerAudit' AND id = $1", [item.id]);
      }

      removedPrizeCount = userPrizeItems.length;
      removedAuditCount = userAudits.length;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  await appendAdminAudit({
    domain: "user_metric_reset",
    action: "reset_metrics",
    targetKey: userId,
    beforeData: snapshot.metrics,
    afterData: Object.fromEntries(Object.keys(snapshot.metrics).map((key) => [key, 0])),
    metadata: {
      user_id: userId,
      request_id: requestId,
      reason,
      snapshot_cycle_key: snapshot.cycle_key,
      restored: false,
      clear_display_data: clearDisplayData,
      removed_prize_count: removedPrizeCount,
      removed_audit_count: removedAuditCount,
    },
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });

  invalidateGamificationStateCache();
  emitEntityChanged(req, "user", userId, "updated");
  emitEntityChanged(req, "Deposit", userId, "deleted");
  emitEntityChanged(req, "Gamification", userId, "reset");
  if (clearDisplayData) {
    emitEntityChanged(req, "UserPrizeGalleryItem", userId, "deleted");
    emitEntityChanged(req, "DrawWinnerAudit", userId, "deleted");
  }

  return res.status(201).json({
    ok: true,
    user_id: userId,
    reset_count: 0,
    snapshot: snapshot.metrics,
    removed_prize_count: removedPrizeCount,
    removed_audit_count: removedAuditCount,
  });
});

router.post("/admin/users/:id/restore-last-reset", requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const requestId = String(req.body?.requestId || "").trim();
  const reason = String(req.body?.reason || "").trim() || "Restauração administrativa do usuário";

  if (!userId || !requestId) {
    return res.status(400).json({ error: "Envie userId e requestId válidos." });
  }

  const resetAuditResult = await pool.query(
    `SELECT *
       FROM admin_config_audit_logs
      WHERE domain = 'user_metric_reset'
        AND action = 'reset_metrics'
        AND target_key = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  const resetAudit = resetAuditResult.rows[0];
  if (!resetAudit) {
    return res.status(404).json({ error: "Nenhum reset recente encontrado para restaurar." });
  }

  if (Boolean(resetAudit.metadata?.restored)) {
    return res.status(409).json({ error: "O último reset já foi restaurado." });
  }

  const current = await getAdminUserMetricSnapshot(userId);
  if (!current) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const snapshot = resetAudit.before_data || {};
  if (Number(snapshot.weekly_points || 0) !== 0 && String(resetAudit.metadata?.snapshot_cycle_key || "") !== String(current.cycle_key || "")) {
    return res.status(400).json({ error: "O ciclo semanal mudou após o reset. Não é seguro restaurar os pontos semanais automaticamente." });
  }

  const adjustments = [];
  for (const [metricKey, targetValue] of Object.entries(snapshot)) {
    const delta = Number(targetValue || 0) - Number(current.metrics?.[metricKey] || 0);
    if (!Number.isFinite(delta) || delta === 0) continue;
    const result = await applyAdminMetricAdjustment({
      userId,
      metricKey,
      reason: `${reason} (${ADMIN_ADJUSTABLE_METRICS[metricKey]?.label || metricKey})`,
      requestId: `${requestId}:${metricKey}`,
      adjustment: delta,
      adminAuth: req.auth,
      ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
      userAgent: String(req.headers["user-agent"] || ""),
    });
    adjustments.push(result);
  }

  await pool.query(
    `UPDATE admin_config_audit_logs
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $1`,
    [
      resetAudit.id,
      JSON.stringify({
        restored: true,
        restored_at: new Date().toISOString(),
        restore_request_id: requestId,
      }),
    ],
  );

  await appendAdminAudit({
    domain: "user_metric_reset",
    action: "restore_metrics",
    targetKey: userId,
    beforeData: current.metrics,
    afterData: snapshot,
    metadata: {
      user_id: userId,
      request_id: requestId,
      reason,
      restored_from_audit_id: resetAudit.id,
      snapshot_cycle_key: resetAudit.metadata?.snapshot_cycle_key || "",
    },
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });

  return res.status(201).json({
    ok: true,
    user_id: userId,
    restored_count: adjustments.length,
    snapshot,
  });
});

router.get("/leaderboards/weekly", requireAuth, async (_req, res) => {
  const state = await buildGamificationState();
  res.json(buildCompetitionBoard(state.leaderboardEntries, state.cycle, state.weeklyConfig));
});

router.get("/admin/gamification/overview", requireAuth, requireAdmin, async (_req, res) => {
  const state = await buildGamificationState();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const chestDayKey = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;

  const [cycleRows, configAudits, chestRewards, xpTodayResult, ticketsTodayResult, weeklyPointsResult, prizeTypeRows, fallbackRows, todayTopRows] = await Promise.all([
    pool.query("SELECT * FROM weekly_cycles ORDER BY starts_at DESC LIMIT 12"),
    pool.query("SELECT * FROM admin_config_audit_logs ORDER BY created_at DESC LIMIT 20"),
    listEntity("DailyChestRewardConfig", "-updated_date", 30),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM user_metric_ledger
        WHERE metric_key = 'xp_total'
          AND occurred_at >= $1
          AND occurred_at < $2`,
      [dayStart.toISOString(), dayEnd.toISOString()],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM user_metric_ledger
        WHERE metric_key IN ('tickets_active', 'tickets_bonus')
          AND occurred_at >= $1
          AND occurred_at < $2`,
      [dayStart.toISOString(), dayEnd.toISOString()],
    ),
    state.cycle?.cycle_key
      ? pool.query(
          `SELECT COALESCE(SUM(amount), 0) AS total
             FROM user_metric_balances
            WHERE metric_key = 'weekly_points'
              AND cycle_key = $1`,
          [state.cycle.cycle_key],
        )
      : Promise.resolve({ rows: [{ total: 0 }] }),
    pool.query(
      `SELECT
          COALESCE(data->>'reward_type', 'unknown') AS reward_type,
          COUNT(*)::int AS count,
          COALESCE(SUM(NULLIF(data->>'reward_amount', '')::numeric), 0) AS total_amount
         FROM entity_records
        WHERE entity_name = 'UserPrizeGalleryItem'
          AND COALESCE(NULLIF(data->>'claimed_at', ''), created_at::text)::timestamptz >= $1
          AND COALESCE(NULLIF(data->>'claimed_at', ''), created_at::text)::timestamptz < $2
        GROUP BY 1
        ORDER BY count DESC, reward_type ASC`,
      [dayStart.toISOString(), dayEnd.toISOString()],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
         FROM daily_chest_openings
        WHERE chest_day_key = $1
          AND COALESCE((reward_snapshot->>'isFallback')::boolean, false) = true`,
      [chestDayKey],
    ),
    pool.query(
      `SELECT
          l.user_id,
          COALESCE(u.nick, u.full_name, u.email, l.user_id::text) AS nick,
          COALESCE(SUM(
            CASE
              WHEN l.metric_key = 'xp_total' THEN l.amount
              WHEN l.metric_key = 'weekly_points' THEN l.amount
              WHEN l.metric_key = 'engagement_points' THEN l.amount
              ELSE 0
            END
          ), 0) AS score
         FROM user_metric_ledger l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.occurred_at >= $1
          AND l.occurred_at < $2
        GROUP BY l.user_id, u.nick, u.full_name, u.email
        HAVING COALESCE(SUM(
          CASE
            WHEN l.metric_key = 'xp_total' THEN l.amount
            WHEN l.metric_key = 'weekly_points' THEN l.amount
            WHEN l.metric_key = 'engagement_points' THEN l.amount
            ELSE 0
          END
        ), 0) > 0
        ORDER BY score DESC, nick ASC
        LIMIT 5`,
      [dayStart.toISOString(), dayEnd.toISOString()],
    ),
  ]);

  const dailyUsage = await listChestDailyUsage(chestDayKey);
  const chestRewardHealth = chestRewards.map((entry) => {
    const usage = dailyUsage.find((item) => item.reward_config_id === entry.id);
    const claimedToday = Number(usage?.claimed_count || 0);
    const dailyCap = Math.max(0, Number(entry.daily_cap || 0));
    const usagePercent = dailyCap > 0 ? Math.min(100, Math.round((claimedToday / dailyCap) * 100)) : 0;
    return {
      id: entry.id,
      title: entry.title || "Prêmio",
      reward_type: entry.reward_type || "points_balance",
      reward_amount: Number(entry.reward_amount || 0),
      reward_unit: entry.reward_unit || "",
      rarity: entry.rarity || "rare",
      active: entry.active !== false,
      weight: Number(entry.weight || 0),
      is_fallback: entry.is_fallback !== false,
      claimed_today: claimedToday,
      daily_cap: dailyCap,
      usage_percent: usagePercent,
      near_limit: dailyCap > 0 && usagePercent >= 80,
      out_of_stock_today: dailyCap > 0 && claimedToday >= dailyCap,
    };
  });

  res.json({
    activeCycle: state.cycle,
    topWeekly: state.leaderboardEntries.slice(0, 10),
    overview: {
      users: Object.keys(state.snapshots).length,
      configuredRules: state.rules.length,
      activeRules: state.rules.filter((rule) => rule.active).length,
      chestRewards: chestRewards.length,
      xpToday: Number(xpTodayResult.rows[0]?.total || 0),
      ticketsToday: Number(ticketsTodayResult.rows[0]?.total || 0),
      weeklyPointsTotal: Number(weeklyPointsResult.rows[0]?.total || 0),
      prizesToday: prizeTypeRows.rows.reduce((acc, row) => acc + Number(row.count || 0), 0),
      fallbackToday: Number(fallbackRows.rows[0]?.total || 0),
    },
    todayTopUsers: todayTopRows.rows.map((row) => ({
      user_id: row.user_id,
      nick: row.nick,
      score: Number(row.score || 0),
    })),
    rewardsTodayByType: prizeTypeRows.rows.map((row) => ({
      reward_type: row.reward_type,
      count: Number(row.count || 0),
      total_amount: Number(row.total_amount || 0),
    })),
    chestHealth: chestRewardHealth,
    weeklyConfig: state.weeklyConfig,
    recentCycles: cycleRows.rows.map((row) => ({
      id: row.id,
      cycle_key: row.cycle_key,
      title: row.title,
      status: row.status,
      starts_at: toIso(row.starts_at),
      ends_at: toIso(row.ends_at),
      closed_at: row.closed_at ? toIso(row.closed_at) : null,
      winners_snapshot: row.winners_snapshot || [],
    })),
    configAudit: configAudits.rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      action: row.action,
      target_key: row.target_key,
      before_data: row.before_data || {},
      after_data: row.after_data || {},
      metadata: row.metadata || {},
      admin_user_id: row.admin_user_id || "",
      admin_email: row.admin_email || "",
      created_at: toIso(row.created_at),
    })),
  });
});

router.get("/admin/gamification/rules", requireAuth, requireAdmin, async (_req, res) => {
  const state = await loadGamificationRules();
  res.json({
    rules: state.rules,
    grouped: state.rules.reduce((acc, rule) => {
      const key = rule.category || "general";
      if (!acc[key]) acc[key] = [];
      acc[key].push(rule);
      return acc;
    }, {}),
  });
});

router.put("/admin/gamification/rules", requireAuth, requireAdmin, async (req, res) => {
  const incoming = Array.isArray(req.body?.rules) ? req.body.rules.map(normalizeRule) : [];
  if (incoming.length === 0) {
    return res.status(400).json({ error: "Envie uma lista de regras." });
  }
  const existing = await listEntity("GamificationRule", "-updated_date", 1000);
  const seen = new Set();
  for (const rule of incoming) {
    const payload = {
      name: rule.name,
      slug: rule.slug,
      category: rule.category,
      description: rule.description,
      source_event: rule.source_event,
      metric_key: rule.metric_key,
      amount: rule.amount,
      condition_min: rule.condition_min,
      condition_step: rule.condition_step,
      limit_scope: rule.limit_scope,
      limit_count: rule.limit_count,
      dedupe_key: rule.dedupe_key,
      priority: rule.priority,
      active: rule.active,
      metadata: rule.metadata,
    };
    const found = existing.find((entry) => entry.id === rule.id);
    if (found?.id) {
      await updateEntity("GamificationRule", found.id, payload);
      seen.add(found.id);
    } else {
      const created = await createEntity("GamificationRule", payload);
      seen.add(created.id);
    }
  }
  for (const stale of existing) {
    if (!seen.has(stale.id)) {
      await updateEntity("GamificationRule", stale.id, { ...stale, active: false });
    }
  }
  await appendAdminAudit({
    domain: "gamification_rules",
    action: "bulk_save",
    targetKey: "GamificationRule",
    beforeData: { count: existing.length },
    afterData: { count: incoming.length },
    metadata: { slugs: incoming.map((rule) => rule.slug) },
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  invalidateGamificationStateCache();
  emitEntityChanged(req, "GamificationRule", "bulk", "updated");
  res.json({ ok: true });
});

router.get("/admin/gamification/checkin-config", requireAuth, requireAdmin, async (_req, res) => {
  const { dailyCheckInConfig } = await loadGamificationRules();
  res.json(dailyCheckInConfig);
});

router.put("/admin/gamification/checkin-config", requireAuth, requireAdmin, async (req, res) => {
  const { rules } = await loadGamificationRules();
  const settingsMap = await listAppSettingsMap();
  const before = normalizeDailyCheckInConfig(
    parseJsonValue(settingsMap.get(DAILY_CHECKIN_CONFIG_KEY)?.value, DEFAULT_DAILY_CHECKIN_CONFIG),
    rules
  );
  const after = normalizeDailyCheckInConfig(req.body || {}, rules);
  await upsertAppSetting(DAILY_CHECKIN_CONFIG_KEY, after, "Configuracao authoritative do check-in diario");
  await appendAdminAudit({
    domain: "daily_checkin_config",
    action: "update",
    targetKey: DAILY_CHECKIN_CONFIG_KEY,
    beforeData: before,
    afterData: after,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  invalidateGamificationStateCache();
  emitEntityChanged(req, "gamification_checkin_config", DAILY_CHECKIN_CONFIG_KEY, "updated");
  res.json(after);
});

router.get("/admin/gamification/weekly-config", requireAuth, requireAdmin, async (_req, res) => {
  const { weeklyConfig } = await loadGamificationRules();
  res.json(weeklyConfig);
});

router.put("/admin/gamification/weekly-config", requireAuth, requireAdmin, async (req, res) => {
  const beforeMap = await listAppSettingsMap();
  const before = normalizeWeeklyConfig(parseJsonValue(beforeMap.get(WEEKLY_TOP_CONFIG_KEY)?.value, DEFAULT_WEEKLY_CONFIG));
  const after = normalizeWeeklyConfig(req.body || {});
  await upsertAppSetting(WEEKLY_TOP_CONFIG_KEY, after, "Configuração authoritative do top semanal");
  await appendAdminAudit({
    domain: "weekly_top",
    action: "update_config",
    targetKey: WEEKLY_TOP_CONFIG_KEY,
    beforeData: before,
    afterData: after,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  invalidateGamificationStateCache();
  emitEntityChanged(req, "WeeklyTopConfig", WEEKLY_TOP_CONFIG_KEY, "updated");
  res.json(after);
});

router.get("/admin/gamification/cycles", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT * FROM weekly_cycles ORDER BY starts_at DESC LIMIT 50");
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      cycle_key: row.cycle_key,
      title: row.title,
      status: row.status,
      starts_at: toIso(row.starts_at),
      ends_at: toIso(row.ends_at),
      closed_at: row.closed_at ? toIso(row.closed_at) : null,
      config_snapshot: row.config_snapshot || {},
      winners_snapshot: row.winners_snapshot || [],
      metadata: row.metadata || {},
    }))
  );
});

router.post("/admin/gamification/cycles/open", requireAuth, requireAdmin, async (req, res) => {
  const { weeklyConfig } = await loadGamificationRules();
  await pool.query("UPDATE weekly_cycles SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), updated_at = NOW() WHERE status = 'active'");
  const cycle = await ensureActiveWeeklyCycle(weeklyConfig);
  invalidateGamificationStateCache();
  emitEntityChanged(req, "WeeklyCycle", cycle.id, "opened");
  res.status(201).json(cycle);
});

router.post("/admin/gamification/cycles/:id/close", requireAuth, requireAdmin, async (req, res) => {
  const state = await buildGamificationState();
  const cycleId = String(req.params.id || "");
  const cycleResult = await pool.query("SELECT * FROM weekly_cycles WHERE id = $1 LIMIT 1", [cycleId]);
  const cycleRow = cycleResult.rows[0];
  if (!cycleRow) {
    return res.status(404).json({ error: "Ciclo não encontrado." });
  }
  const winnersCount = Math.max(1, Number(state.weeklyConfig.winners_count || 10));
  const winnersSnapshot = state.leaderboardEntries.slice(0, winnersCount).map((entry) => ({
    user_id: entry.user_id,
    nick: entry.nick,
    weekly_points: entry.weekly_points,
    position: entry.position,
  }));
  await pool.query(
    `UPDATE weekly_cycles
     SET status = 'closed',
         closed_at = NOW(),
         winners_snapshot = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [cycleId, JSON.stringify(winnersSnapshot)]
  );
  await appendAdminAudit({
    domain: "weekly_cycle",
    action: "close_cycle",
    targetKey: cycleId,
    beforeData: { status: cycleRow.status },
    afterData: { status: "closed" },
    metadata: { winners_snapshot: winnersSnapshot },
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  invalidateGamificationStateCache();
  emitEntityChanged(req, "WeeklyCycle", cycleId, "closed");
  res.json({ ok: true, winnersSnapshot });
});

router.get("/admin/leaderboards/weekly", requireAuth, requireAdmin, async (_req, res) => {
  const state = await buildGamificationState();
  res.json({
    cycle: state.cycle,
    config: state.weeklyConfig,
    entries: state.leaderboardEntries,
  });
});

router.get("/admin/daily-chest/config", requireAuth, requireAdmin, async (_req, res) => {
  const settingsMap = await listAppSettingsMap();
  const rewards = (await listEntity("DailyChestRewardConfig", "-updated_date", 200))
    .map(sanitizeChestRewardDraft)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  const chestDayKey = buildDailyChestWindowKey(settingsMap);
  const dailyUsage = await listChestDailyUsage(chestDayKey);
  const rewardById = new Map(rewards.map((entry) => [entry.id, entry]));
  const recentInventory = (await listEntity("UserPrizeGalleryItem", "-claimed_at", 80))
    .filter((item) => item.source_type === "daily_chest" && item.chest_day_key === chestDayKey)
    .slice(0, 20);
  const recentUserIds = Array.from(new Set(recentInventory.map((item) => item.user_id).filter(Boolean)));
  let userMap = new Map();
  if (recentUserIds.length > 0) {
    const userRows = await pool.query(
      `SELECT id, nick, full_name, email
         FROM users
        WHERE id = ANY($1::uuid[])`,
      [recentUserIds]
    );
    userMap = new Map(
      userRows.rows.map((row) => [row.id, { nick: row.nick || "", full_name: row.full_name || "", email: row.email || "" }])
    );
  }
  const totalDistributedToday = dailyUsage.reduce((sum, entry) => sum + Number(entry.claimed_count || 0), 0);
  const fallbackDistributedToday = dailyUsage.reduce((sum, entry) => {
    const reward = rewardById.get(entry.reward_config_id);
    return reward?.is_fallback ? sum + Number(entry.claimed_count || 0) : sum;
  }, 0);
  const balanceDistributedToday = dailyUsage.reduce((sum, entry) => {
    const reward = rewardById.get(entry.reward_config_id);
    return reward?.reward_type === "points_balance" ? sum + Number(entry.claimed_count || 0) : sum;
  }, 0);
  res.json({
    settings: {
      daily_chest_enabled: settingsMap.get("daily_chest_enabled")?.value || "true",
      daily_chest_tap_goal: settingsMap.get("daily_chest_tap_goal")?.value || "4",
      daily_chest_base_daily_chests: settingsMap.get("daily_chest_base_daily_chests")?.value || "1",
      daily_chest_xp_per_open: settingsMap.get("daily_chest_xp_per_open")?.value || "18",
      daily_chest_balance_wins_per_user_day: settingsMap.get("daily_chest_balance_wins_per_user_day")?.value || "1",
      daily_chest_message_of_day: settingsMap.get("daily_chest_message_of_day")?.value || "Toque no baú para abrir",
      daily_chest_reset_hour: settingsMap.get("daily_chest_reset_hour")?.value || "0",
      daily_chest_reset_minute: settingsMap.get("daily_chest_reset_minute")?.value || "0",
      daily_chest_timezone: settingsMap.get("daily_chest_timezone")?.value || "America/Sao_Paulo",
      daily_chest_rarity_visual: settingsMap.get("daily_chest_rarity_visual")?.value || "rare",
      daily_chest_scene_theme: settingsMap.get("daily_chest_scene_theme")?.value || "aurora",
      daily_chest_schedule_start_at: settingsMap.get("daily_chest_schedule_start_at")?.value || "",
      daily_chest_schedule_end_at: settingsMap.get("daily_chest_schedule_end_at")?.value || "",
      daily_chest_deposit_bonus_enabled: settingsMap.get("daily_chest_deposit_bonus_enabled")?.value || "true",
      daily_chest_bonus_chests_per_approved: settingsMap.get("daily_chest_bonus_chests_per_approved")?.value || "1",
      daily_chest_bonus_amount_step: settingsMap.get("daily_chest_bonus_amount_step")?.value || "0",
      daily_chest_bonus_chests_per_step: settingsMap.get("daily_chest_bonus_chests_per_step")?.value || "0",
      daily_chest_access_group_link: settingsMap.get("daily_chest_access_group_link")?.value || "",
      daily_chest_access_code: settingsMap.get("daily_chest_access_code")?.value || "",
      daily_chest_access_code_day_key: settingsMap.get("daily_chest_access_code_day_key")?.value || "",
    },
    rewards,
    dailyUsage,
    overview: {
      chestDayKey,
      totalDistributedToday,
      fallbackDistributedToday,
      balanceDistributedToday,
      uniqueWinnersToday: new Set(recentInventory.map((item) => item.user_id).filter(Boolean)).size,
    },
    recentWinners: recentInventory.map((item) => {
      const user = userMap.get(item.user_id) || null;
      return {
        id: item.id,
        user_id: item.user_id,
        user_label: user?.nick || user?.full_name || user?.email || item.user_id,
        title: item.title || "Prêmio",
        subtitle: item.subtitle || "",
        reward_type: item.reward_type || "",
        reward_amount: Number(item.reward_amount || 0),
        reward_unit: item.reward_unit || "",
        rarity: item.rarity || "rare",
        claimed_at: item.claimed_at || item.created_date || null,
      };
    }),
  });
});

router.put("/admin/daily-chest/settings", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const beforeMap = await listAppSettingsMap();
  const nextEntries = Object.entries(payload).filter(([key]) => String(key).startsWith("daily_chest_"));
  for (const [key, value] of nextEntries) {
    await upsertAppSetting(key, String(value ?? ""), `Configuração do Baú Diário: ${key}`);
  }
  await appendAdminAudit({
    domain: "daily_chest",
    action: "update_settings",
    targetKey: "daily_chest_settings",
    beforeData: Object.fromEntries([...beforeMap.entries()].filter(([key]) => key.startsWith("daily_chest_")).map(([key, value]) => [key, value.value])),
    afterData: payload,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  emitEntityChanged(req, "DailyChestSettings", "daily_chest_settings", "updated");
  res.json({ ok: true });
});

router.post("/admin/daily-chest/access-code/generate", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const beforeMap = await listAppSettingsMap();
  const chestDayKey = buildDailyChestWindowKey(beforeMap);
  const code = String(payload.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32) || generateDailyAccessCode();

  await upsertAppSetting("daily_chest_access_code", code, "Codigo diario do Bau Diario");
  await upsertAppSetting("daily_chest_access_code_day_key", chestDayKey, "Ciclo diario da chave do Bau Diario");

  await appendAdminAudit({
    domain: "daily_chest_access_code",
    action: "generate_code",
    targetKey: chestDayKey,
    beforeData: {
      daily_chest_access_code: beforeMap.get("daily_chest_access_code")?.value || "",
      daily_chest_access_code_day_key: beforeMap.get("daily_chest_access_code_day_key")?.value || "",
    },
    afterData: {
      daily_chest_access_code: code,
      daily_chest_access_code_day_key: chestDayKey,
    },
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });

  emitEntityChanged(req, "DailyChestSettings", "daily_chest_access_code", "updated");
  res.json({ code, chestDayKey });
});

router.post("/admin/daily-chest/rewards", requireAuth, requireAdmin, async (req, res) => {
  const reward = sanitizeChestRewardDraft({
    ...(req.body || {}),
    id: undefined,
    created_date: undefined,
    updated_date: undefined,
    claimed_count: Math.max(0, Number(req.body?.claimed_count || 0)),
  });
  validateChestRewardDraft(reward);
  const created = await createEntity("DailyChestRewardConfig", reward);
  await appendAdminAudit({
    domain: "daily_chest_reward",
    action: "create_reward",
    targetKey: created.id,
    beforeData: {},
    afterData: reward,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  emitEntityChanged(req, "DailyChestRewardConfig", created.id, "created");
  res.status(201).json(created);
});

router.patch("/admin/daily-chest/rewards/:id", requireAuth, requireAdmin, async (req, res) => {
  const rewardId = String(req.params.id || "");
  const existing = await getEntityById("DailyChestRewardConfig", rewardId);
  if (!existing) {
    return res.status(404).json({ error: "Prêmio não encontrado." });
  }
  const next = sanitizeChestRewardDraft({
    ...existing,
    ...(req.body || {}),
    id: existing.id,
    created_date: existing.created_date,
    updated_date: existing.updated_date,
  });
  validateChestRewardDraft(next);
  const updated = await updateEntity("DailyChestRewardConfig", rewardId, next);
  await appendAdminAudit({
    domain: "daily_chest_reward",
    action: "update_reward",
    targetKey: rewardId,
    beforeData: existing,
    afterData: next,
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });
  emitEntityChanged(req, "DailyChestRewardConfig", rewardId, "updated");
  res.json(updated);
});

router.delete("/admin/daily-chest/rewards/:id", requireAuth, requireAdmin, async (req, res) => {
  const rewardId = String(req.params.id || "");
  const existing = await getEntityById("DailyChestRewardConfig", rewardId);
  if (!existing) {
    return res.status(404).json({ error: "Prêmio não encontrado." });
  }

  await pool.query(
    `DELETE FROM daily_chest_reward_daily_usage
      WHERE reward_config_id = $1`,
    [rewardId]
  );
  await deleteEntity("DailyChestRewardConfig", rewardId);

  await appendAdminAudit({
    domain: "daily_chest_reward",
    action: "delete_reward",
    targetKey: rewardId,
    beforeData: existing,
    afterData: {},
    adminUserId: req.auth.sub,
    adminEmail: req.auth.email,
  });

  emitEntityChanged(req, "DailyChestRewardConfig", rewardId, "deleted");
  res.json({ ok: true, id: rewardId });
});

export default router;
