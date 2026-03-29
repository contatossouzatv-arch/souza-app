import { getAppSettingsMap, pool } from "../db/index.js";

const WEEKLY_TOP_CONFIG_KEY = "weekly_top_config_v2";
const PROFILE_COMPETITION_KEY = "profile_competition_rules_v1";

const DEFAULT_WEEKLY_CONFIG = {
  enabled: false,
  active: false,
  title: "Top Semanal",
  subtitle: "Acumule pontos durante o ciclo para subir no ranking.",
  instructions:
    "1) Some pontos nas acoes ativas do app.\n2) So contam os pontos semanais do ciclo atual.\n3) Ao fim do contador, o ranking fecha e reinicia.\n4) Confira no botao de ajuda quais acoes estao pontuando hoje.",
  cycle_days: 7,
  starts_at: "",
  ends_at: "",
  reward_currency: "BRL",
  winners_count: 10,
  positions: [
    { position: 1, reward_type: "cash_prize", reward_value: 20, label: "1o Lugar", active: true },
    { position: 2, reward_type: "cash_prize", reward_value: 20, label: "2o Lugar", active: true },
    { position: 3, reward_type: "cash_prize", reward_value: 20, label: "3o Lugar", active: true },
  ],
  fallback_reward_type: "cash_prize",
  fallback_reward_value: 20,
};

function clampInt(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeDate(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeWeeklyConfig(raw = {}) {
  const positions = Array.isArray(raw.positions)
    ? raw.positions
        .map((entry, index) => ({
          position: clampInt(entry?.position, index + 1, 1, 100),
          reward_type: String(entry?.reward_type || raw.fallback_reward_type || "cash_prize").trim() || "cash_prize",
          reward_value: Math.max(0, Number(entry?.reward_value ?? raw.fallback_reward_value ?? 0)),
          label: String(entry?.label || `${index + 1}o Lugar`).trim() || `${index + 1}o Lugar`,
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

function resolveCurrentCycleWindow(config) {
  const safeConfig = normalizeWeeklyConfig(config);
  const configuredStartsAt = safeDate(safeConfig.starts_at);
  const configuredEndsAt = safeDate(safeConfig.ends_at);
  if (configuredStartsAt && configuredEndsAt && configuredEndsAt > configuredStartsAt) {
    const cycleKey = `${configuredStartsAt.getUTCFullYear()}-${String(configuredStartsAt.getUTCMonth() + 1).padStart(2, "0")}-${String(configuredStartsAt.getUTCDate()).padStart(2, "0")}-${String(configuredStartsAt.getUTCHours()).padStart(2, "0")}${String(configuredStartsAt.getUTCMinutes()).padStart(2, "0")}`;
    return {
      cycle_key: cycleKey,
      starts_at: configuredStartsAt.toISOString(),
      ends_at: configuredEndsAt.toISOString(),
      title: safeConfig.title,
      status: safeConfig.active === false ? "inactive" : "active",
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

  return {
    cycle_key: `${startsAt.getUTCFullYear()}-${String(startsAt.getUTCMonth() + 1).padStart(2, "0")}-${String(startsAt.getUTCDate()).padStart(2, "0")}`,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    title: `${safeConfig.title} - ${String(startsAt.getDate()).padStart(2, "0")}/${String(startsAt.getMonth() + 1).padStart(2, "0")}`,
    status: safeConfig.active === false ? "inactive" : "active",
  };
}

function getApprovedProfileImageUrl(user = {}) {
  return String(user?.profile_image_status || "").toLowerCase() === "approved"
    ? String(user?.profile_image_url || "").trim() || (user?.id ? `/api/auth/profile-image/${user.id}` : "")
    : "";
}

async function loadWeeklyLeaderboardConfig() {
  const settingsMap = await getAppSettingsMap();
  const configured = parseJsonValue(settingsMap.get(WEEKLY_TOP_CONFIG_KEY), null);
  const fallback = parseJsonValue(settingsMap.get(PROFILE_COMPETITION_KEY), DEFAULT_WEEKLY_CONFIG);
  return normalizeWeeklyConfig(configured || fallback || DEFAULT_WEEKLY_CONFIG);
}

async function resolveLeaderboardCycle(config) {
  const activeResult = await pool.query(
    `SELECT *
       FROM weekly_cycles
      WHERE status = 'active'
         OR (starts_at <= NOW() AND ends_at >= NOW())
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        starts_at DESC,
        created_at DESC
      LIMIT 1`
  );
  const activeCycle = activeResult.rows[0] || null;
  if (activeCycle) {
    return activeCycle;
  }

  const latestResult = await pool.query(
    `SELECT *
       FROM weekly_cycles
      ORDER BY starts_at DESC, created_at DESC
      LIMIT 1`
  );
  if (latestResult.rows[0]) {
    return latestResult.rows[0];
  }

  return resolveCurrentCycleWindow(config);
}

function buildCompetitionBoard(entries, cycle, config) {
  const startsAt = new Date(cycle?.starts_at || new Date().toISOString());
  const endsAt = new Date(cycle?.ends_at || startsAt.toISOString());
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

export async function getWeeklyLeaderboard({ userId = "", limit = 50 } = {}) {
  const safeUserId = String(userId || "").trim();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const weeklyConfig = await loadWeeklyLeaderboardConfig();
  const cycle = await resolveLeaderboardCycle(weeklyConfig);
  const resolvedConfig = normalizeWeeklyConfig(cycle?.config_snapshot || weeklyConfig);
  const cycleKey = String(cycle?.cycle_key || "");

  const result = await pool.query(
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
         ROW_NUMBER() OVER (
           ORDER BY
             w.amount DESC,
             COALESCE(e.amount, 0) DESC,
             COALESCE(NULLIF(BTRIM(u.nick), ''), NULLIF(BTRIM(u.full_name), ''), 'Usuario') ASC,
             u.id ASC
         ) AS position,
         u.id,
         u.nick,
         u.full_name,
         u.avatar_emoji,
         u.profile_avatar_id,
         u.profile_image_mode,
         u.profile_image_status,
         u.profile_image_url
       FROM weekly w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN engagement e ON e.user_id = w.user_id
     )
     SELECT *
       FROM ranked
      WHERE position <= $2
         OR ($3 <> '' AND user_id::text = $3)
      ORDER BY position ASC`,
    [cycleKey, safeLimit, safeUserId]
  );

  const topEntries = [];
  let currentCompetitionEntry = {
    user_id: safeUserId,
    position: 0,
    weekly_points: 0,
    engagement_points: 0,
    points: 0,
  };

  for (const row of result.rows || []) {
    const entry = {
      user_id: String(row.user_id || ""),
      nick: String(row.nick || row.full_name || "Usuario"),
      avatar_emoji: String(row.avatar_emoji || "🎰"),
      profile_avatar_id: String(row.profile_avatar_id || ""),
      profile_image_mode: String(row.profile_image_mode || "avatar"),
      profile_image_status: String(row.profile_image_status || "none"),
      profile_image_url: getApprovedProfileImageUrl(row),
      weekly_points: Number(row.weekly_points || 0),
      engagement_points: Number(row.engagement_points || 0),
      position: Number(row.position || 0),
      points: Number(row.weekly_points || 0),
      stats: { approvedAmount: 0 },
    };

    if (entry.position <= safeLimit) {
      topEntries.push(entry);
    }

    if (safeUserId && entry.user_id === safeUserId) {
      currentCompetitionEntry = entry;
    }
  }

  return {
    cycle,
    weeklyConfig: resolvedConfig,
    topEntries,
    userWeeklyPoints: Number(currentCompetitionEntry.weekly_points || 0),
    currentCompetitionEntry,
    competitionBoard: buildCompetitionBoard(topEntries, cycle, resolvedConfig),
  };
}
