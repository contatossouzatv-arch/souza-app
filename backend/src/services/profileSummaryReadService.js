import { getAppSettingsMap, pool } from "../db/index.js";
import { getWeeklyLeaderboard } from "./weeklyLeaderboardReadService.js";

const BADGE_RULES_KEY = "achievement_badge_rules_v1";
const POINTS_RULES_KEY = "achievement_points_rules_v1";
const DAILY_CHECKIN_CONFIG_KEY = "daily_checkin_config_v1";

const DEFAULT_POINTS_RULES = {
  points_per_participation: 12,
  points_per_approved_deposit: 8,
  amount_step_value: 10,
  points_per_amount_step: 1,
  points_per_win: 50,
  progress_target_participations: 25,
  live_badge_target: 30,
};

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

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function getApprovedProfileImageUrl(user = {}) {
  return String(user?.profile_image_status || "").toLowerCase() === "approved"
    ? String(user?.profile_image_url || "").trim() || (user?.id ? `/api/auth/profile-image/${user.id}` : "")
    : "";
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
    subtitle: `Faltam ${remaining} participacoes para o proximo nivel.`,
    current: currentInLevel,
    target: liveTarget,
    progress,
    completed: false,
  };
}

async function loadProfileSummaryConfig() {
  const settingsMap = await getAppSettingsMap();
  const badgeRules = parseJsonValue(settingsMap.get(BADGE_RULES_KEY), DEFAULT_BADGE_RULES);
  const pointsRules = {
    ...DEFAULT_POINTS_RULES,
    ...parseJsonValue(settingsMap.get(POINTS_RULES_KEY), DEFAULT_POINTS_RULES),
  };
  const dailyCheckInConfig = {
    ...DEFAULT_DAILY_CHECKIN_CONFIG,
    ...parseJsonValue(settingsMap.get(DAILY_CHECKIN_CONFIG_KEY), DEFAULT_DAILY_CHECKIN_CONFIG),
  };

  return {
    badgeRules: Array.isArray(badgeRules) ? badgeRules : DEFAULT_BADGE_RULES,
    pointsRules,
    dailyCheckInConfig,
  };
}

export async function getProfileSummary({ viewerId = "", targetUserId } = {}) {
  const safeTargetUserId = String(targetUserId || "").trim();
  const safeViewerId = String(viewerId || "").trim();
  if (!safeTargetUserId) {
    throw new Error("Invalid target user id");
  }

  const [{ badgeRules, pointsRules, dailyCheckInConfig }, weeklyLeaderboard, userResult, balancesResult, participationResult, socialResult, pointsBalanceResult] =
    await Promise.all([
      loadProfileSummaryConfig(),
      getWeeklyLeaderboard({ userId: safeTargetUserId, limit: 20 }),
      pool.query(
        `SELECT
           id,
           email,
           full_name,
           nick,
           avatar_emoji,
           profile_avatar_id,
           profile_image_mode,
           profile_image_status,
           profile_image_url,
           account_status,
           created_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [safeTargetUserId]
      ),
      pool.query(
        `SELECT metric_key, cycle_key, amount
           FROM user_metric_balances
          WHERE user_id = $1
            AND (
              metric_key = ANY($2::text[])
              OR (metric_key = 'weekly_points' AND cycle_key = $3)
            )`,
        [
          safeTargetUserId,
          ["tickets_active", "prize_counts", "social_followers", "social_likes", "daily_checkins", "social_following", "engagement_points", "xp_total", "chest_rewards"],
          String(weeklyLeaderboard?.cycle?.cycle_key || ""),
        ]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE entity_name = 'LiveDrawParticipant')::int AS live_participations,
           COUNT(*) FILTER (WHERE entity_name = 'GameCallParticipant')::int AS game_participations,
           COUNT(*) FILTER (WHERE entity_name = 'InstantRaffleParticipant')::int AS instant_participations
         FROM entity_records
         WHERE entity_name IN ('LiveDrawParticipant', 'GameCallParticipant', 'InstantRaffleParticipant')
           AND COALESCE(data->>'user_id', '') = $1`,
        [safeTargetUserId]
      ),
      pool.query(
        `SELECT
           COALESCE((SELECT COUNT(*)::int FROM user_follows WHERE target_user_id = $1 AND active = true), 0) AS followers,
           COALESCE((SELECT COUNT(*)::int FROM user_follows WHERE follower_user_id = $1 AND active = true), 0) AS following,
           COALESCE((SELECT COUNT(*)::int FROM profile_likes WHERE target_user_id = $1 AND active = true), 0) AS likes,
           COALESCE((SELECT active FROM user_follows WHERE follower_user_id = NULLIF($2, '')::uuid AND target_user_id = $1 LIMIT 1), false) AS viewer_is_following,
           COALESCE((SELECT active FROM profile_likes WHERE actor_user_id = NULLIF($2, '')::uuid AND target_user_id = $1 LIMIT 1), false) AS viewer_is_liked`,
        [safeTargetUserId, safeViewerId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS balance
           FROM points_ledger
          WHERE user_id = $1`,
        [safeTargetUserId]
      ),
    ]);

  const user = userResult.rows[0];
  if (!user) {
    throw new Error("User not found");
  }

  const balanceMap = new Map(
    (balancesResult.rows || []).map((row) => [`${row.metric_key}::${row.cycle_key || ""}`, Number(row.amount || 0)])
  );
  const participation = participationResult.rows[0] || {};
  const social = socialResult.rows[0] || {};
  const currentCompetitionEntry = weeklyLeaderboard?.currentCompetitionEntry || {
    user_id: safeTargetUserId,
    position: 0,
    weekly_points: 0,
    points: 0,
  };

  const metrics = {
    position: Number(currentCompetitionEntry.position || 0),
    totalApproved: 0,
    totalTickets: Number(balanceMap.get("tickets_active::") || 0),
    totalParticipations:
      Number(participation.live_participations || 0) +
      Number(participation.game_participations || 0) +
      Number(participation.instant_participations || 0),
    totalWins: Number(balanceMap.get("prize_counts::") || 0),
    liveParticipations: Number(participation.live_participations || 0),
    totalFollowers: Number((social.followers ?? balanceMap.get("social_followers::")) || 0),
    totalLikes: Number((social.likes ?? balanceMap.get("social_likes::")) || 0),
    totalCheckins: Number(balanceMap.get("daily_checkins::") || 0),
    followingCount: Number((social.following ?? balanceMap.get("social_following::")) || 0),
    points: Number(balanceMap.get("engagement_points::") || 0),
    progress: Math.min(
      100,
      Math.round(
        ((Number(participation.live_participations || 0) +
          Number(participation.game_participations || 0) +
          Number(participation.instant_participations || 0)) /
          Math.max(1, Number(pointsRules.progress_target_participations || 25))) *
          100
      )
    ),
    xpTotal: Number(balanceMap.get("xp_total::") || 0),
    xp_total: Number(balanceMap.get("xp_total::") || 0),
    weeklyPoints: Number(currentCompetitionEntry.weekly_points || 0),
    weekly_points: Number(currentCompetitionEntry.weekly_points || 0),
    chestRewards: Number(balanceMap.get("chest_rewards::") || 0),
    prizeCounts: Number(balanceMap.get("prize_counts::") || 0),
    pointsBalance: Number(pointsBalanceResult.rows[0]?.balance || 0),
    points_balance: Number(pointsBalanceResult.rows[0]?.balance || 0),
  };

  const achievements = computeAchievements(metrics, badgeRules);
  const levelProgress = getLevelProgress(metrics.xpTotal);

  return {
    user: {
      id: user.id,
      email: String(user.email || ""),
      full_name: String(user.full_name || ""),
      nick: String(user.nick || ""),
      avatar_emoji: String(user.avatar_emoji || "🎰"),
      profile_avatar_id: String(user.profile_avatar_id || ""),
      profile_image_mode: String(user.profile_image_mode || "avatar"),
      profile_image_status: String(user.profile_image_status || "none"),
      profile_image_url: getApprovedProfileImageUrl(user),
      account_status: String(user.account_status || "active"),
      created_at: user.created_at,
    },
    viewerState: {
      isFollowing: Boolean(social.viewer_is_following),
      isLiked: Boolean(social.viewer_is_liked),
    },
    metrics,
    pointsRules,
    badgeRules,
    dailyCheckInConfig,
    achievements,
    progressBadges: [buildProgressBadge(metrics, pointsRules)],
    currentCompetitionEntry,
    competitionBoard: weeklyLeaderboard?.competitionBoard || {
      config: weeklyLeaderboard?.weeklyConfig || {},
      cycle: weeklyLeaderboard?.cycle || { remainingMs: 0, progressPct: 0 },
      entries: [],
      rewardLabel: "",
    },
    levelProgress,
  };
}
