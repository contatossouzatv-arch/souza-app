import { Router } from "express";
import { createEntity, createSecurityEvent, findUserById, listEntity, pool } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { refreshGamificationState } from "./gamification.js";

const router = Router();
const DAILY_CHECKIN_CONFIG_KEY = "daily_checkin_config_v1";

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDayKey(date = new Date()) {
  const parts = dayKeyFormatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getRecentDayKeys(totalDays = 7, endDate = new Date()) {
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(date.getDate() - (totalDays - index - 1));
    return getDayKey(date);
  });
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function buildRequestMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
    user_agent: String(req.headers["user-agent"] || ""),
  };
}

function normalizeRequestId(value, fallback = "") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function loadDailyCheckInConfig() {
  const settings = await listEntity("AppSettings");
  const setting = Array.isArray(settings) ? settings.find((entry) => entry?.key === DAILY_CHECKIN_CONFIG_KEY) : null;
  const parsed = parseJsonValue(setting?.value, {});
  const rewards = Array.isArray(parsed?.rewards) ? parsed.rewards : [];
  return {
    enabled: parsed?.enabled !== false,
    rewards: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      const current = rewards.find((entry) => Number(entry?.day) === day) || {};
      return {
        day,
        weekly_points: Math.max(0, Number(current?.weekly_points || 0)),
        label: String(current?.label || `Dia ${day}`).trim() || `Dia ${day}`,
        active: current?.active !== false,
      };
    }),
  };
}

function isNextDay(previousDayKey, currentDayKey) {
  if (!previousDayKey || !currentDayKey) return false;
  const previous = new Date(`${previousDayKey}T12:00:00Z`);
  const current = new Date(`${currentDayKey}T12:00:00Z`);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  const diffMs = current.getTime() - previous.getTime();
  return diffMs === 24 * 60 * 60 * 1000;
}

function computeCurrentStreakDay(dayKeys = []) {
  if (!Array.isArray(dayKeys) || dayKeys.length === 0) return 0;
  const sorted = dayKeys.slice().sort((a, b) => String(a).localeCompare(String(b)));
  let streakDay = 0;
  let previous = "";
  sorted.forEach((dayKey) => {
    streakDay = isNextDay(previous, dayKey) ? Math.min(7, streakDay + 1) : 1;
    previous = dayKey;
  });
  return streakDay;
}

function emitEntityChanged(req, entityName, entityId, action = "updated") {
  req.app?.locals?.io?.emit("entity:changed", {
    entityName,
    entityId,
    action,
    emittedAt: new Date().toISOString(),
  });
}

function buildHandle(nick = "", userId = "") {
  const base = String(nick || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "");
  return base || `usuario.${String(userId || "").slice(0, 6)}`;
}

function mapSocialProfile(row) {
  const canExposeApprovedPhoto =
    String(row.profile_image_mode || "").toLowerCase() === "photo" &&
    String(row.profile_image_status || "").toLowerCase() === "approved" &&
    String(row.profile_image_url || "").trim();
  return {
    id: row.id,
    nick: row.nick || row.full_name || "Usuário",
    handle: buildHandle(row.nick || row.full_name || "", row.id),
    avatar_emoji: row.avatar_emoji || "🎰",
    profile_avatar_id: row.profile_avatar_id || "",
    profile_image_mode: row.profile_image_mode || "avatar",
    profile_image_status: row.profile_image_status || "none",
    profile_image_url: canExposeApprovedPhoto ? String(row.profile_image_url || "").trim() : "",
    followers: Number(row.followers || 0),
    following: Number(row.following || 0),
    likes: Number(row.likes || 0),
    isFollowing: Boolean(row.is_following),
    isLiked: Boolean(row.is_liked),
    created_at: row.created_at ? toIso(row.created_at) : null,
  };
}

function normalizeListLimit(value, fallback = 12, max = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function normalizeListOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

async function createProfileNotification({
  targetUserId,
  actor,
  type,
  title,
  message,
  metadata = {},
}) {
  if (!targetUserId || !actor?.id) return null;
  if (String(targetUserId) === String(actor.id)) return null;
  return createEntity("ProfileNotification", {
    user_id: String(targetUserId),
    actor_user_id: String(actor.id),
    actor_name: String(actor.full_name || actor.nick || "Usuário").trim(),
    actor_nick: String(actor.nick || "").trim(),
    actor_avatar_emoji: String(actor.avatar_emoji || "").trim(),
    actor_profile_avatar_id: String(actor.profile_avatar_id || "").trim(),
    actor_profile_image_mode: String(actor.profile_image_mode || "avatar").trim(),
    actor_profile_image_status: String(actor.profile_image_status || "").trim(),
    actor_profile_image_url: String(actor.profile_image_url || "").trim(),
    type: String(type || "info").trim(),
    title: String(title || "").trim(),
    message: String(message || "").trim(),
    status: "unread",
    read_at: null,
    metadata,
  });
}

async function findEngagementEventByRequestId(client, requestId) {
  if (!requestId) return null;
  const result = await client.query(
    `SELECT * FROM engagement_processing_events
     WHERE request_id = $1
     LIMIT 1`,
    [requestId]
  );
  return result.rows[0] || null;
}

async function appendEngagementEvent(client, payload) {
  await client.query(
    `INSERT INTO engagement_processing_events (
      domain, action, request_id, user_id, entity_name, entity_id, status, metadata, processed_by_user_id, processed_by_email
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     ON CONFLICT (request_id) DO NOTHING`,
    [
      payload.domain,
      payload.action,
      payload.request_id || null,
      payload.user_id || null,
      payload.entity_name || null,
      payload.entity_id || null,
      payload.status || "accepted",
      JSON.stringify(payload.metadata || {}),
      payload.processed_by_user_id || null,
      payload.processed_by_email || null,
    ]
  );
}

async function buildSocialState(client, viewerUserId, targetUserId) {
  const summaryResult = await client.query(
    `SELECT
       $1::uuid AS target_user_id,
       COALESCE((SELECT COUNT(*)::int FROM user_follows WHERE target_user_id = $1 AND active = true), 0) AS followers,
       COALESCE((SELECT COUNT(*)::int FROM user_follows WHERE follower_user_id = $1 AND active = true), 0) AS following,
       COALESCE((SELECT COUNT(*)::int FROM profile_likes WHERE target_user_id = $1 AND active = true), 0) AS likes,
       COALESCE((SELECT active FROM user_follows WHERE follower_user_id = $2 AND target_user_id = $1 LIMIT 1), false) AS is_following,
       COALESCE((SELECT active FROM profile_likes WHERE actor_user_id = $2 AND target_user_id = $1 LIMIT 1), false) AS is_liked`,
    [targetUserId, viewerUserId]
  );
  const row = summaryResult.rows[0] || {};
  return {
    targetUserId,
    followers: Number(row.followers || 0),
    following: Number(row.following || 0),
    likes: Number(row.likes || 0),
    isFollowing: Boolean(row.is_following) && targetUserId !== viewerUserId,
    isLiked: Boolean(row.is_liked) && targetUserId !== viewerUserId,
  };
}

async function listRelationProfiles(client, type, userId) {
  const relationSql =
    type === "following"
      ? `SELECT u.*,
            COALESCE(followers.count, 0) AS followers,
            COALESCE(following.count, 0) AS following,
            COALESCE(likes.count, 0) AS likes
         FROM user_follows rel
         JOIN users u ON u.id = rel.target_user_id
         LEFT JOIN (
           SELECT target_user_id, COUNT(*)::int AS count
           FROM user_follows
           WHERE active = true
           GROUP BY target_user_id
         ) followers ON followers.target_user_id = u.id
         LEFT JOIN (
           SELECT follower_user_id, COUNT(*)::int AS count
           FROM user_follows
           WHERE active = true
           GROUP BY follower_user_id
         ) following ON following.follower_user_id = u.id
         LEFT JOIN (
           SELECT target_user_id, COUNT(*)::int AS count
           FROM profile_likes
           WHERE active = true
           GROUP BY target_user_id
         ) likes ON likes.target_user_id = u.id
         WHERE rel.follower_user_id = $1
           AND rel.active = true
         ORDER BY rel.followed_at DESC, rel.updated_at DESC`
      : `SELECT u.*,
            COALESCE(followers.count, 0) AS followers,
            COALESCE(following.count, 0) AS following,
            COALESCE(likes.count, 0) AS likes
         FROM user_follows rel
         JOIN users u ON u.id = rel.follower_user_id
         LEFT JOIN (
           SELECT target_user_id, COUNT(*)::int AS count
           FROM user_follows
           WHERE active = true
           GROUP BY target_user_id
         ) followers ON followers.target_user_id = u.id
         LEFT JOIN (
           SELECT follower_user_id, COUNT(*)::int AS count
           FROM user_follows
           WHERE active = true
           GROUP BY follower_user_id
         ) following ON following.follower_user_id = u.id
         LEFT JOIN (
           SELECT target_user_id, COUNT(*)::int AS count
           FROM profile_likes
           WHERE active = true
           GROUP BY target_user_id
         ) likes ON likes.target_user_id = u.id
         WHERE rel.target_user_id = $1
           AND rel.active = true
         ORDER BY rel.followed_at DESC, rel.updated_at DESC`;

  const result = await client.query(relationSql, [userId]);
  return result.rows.map(mapSocialProfile);
}

async function listDiscoverProfiles(client, viewerUserId, { limit = 12, offset = 0 } = {}) {
  const queryLimit = Math.max(1, Number(limit || 12));
  const queryOffset = Math.max(0, Number(offset || 0));
  const result = await client.query(
    `SELECT u.*,
        COALESCE(followers.count, 0) AS followers,
        COALESCE(following.count, 0) AS following,
        COALESCE(likes.count, 0) AS likes,
        COALESCE(viewer_follow.active, false) AS is_following,
        COALESCE(viewer_like.active, false) AS is_liked
     FROM users u
     LEFT JOIN (
       SELECT target_user_id, COUNT(*)::int AS count
       FROM user_follows
       WHERE active = true
       GROUP BY target_user_id
     ) followers ON followers.target_user_id = u.id
     LEFT JOIN (
       SELECT follower_user_id, COUNT(*)::int AS count
       FROM user_follows
       WHERE active = true
       GROUP BY follower_user_id
     ) following ON following.follower_user_id = u.id
     LEFT JOIN (
       SELECT target_user_id, COUNT(*)::int AS count
       FROM profile_likes
       WHERE active = true
       GROUP BY target_user_id
     ) likes ON likes.target_user_id = u.id
     LEFT JOIN user_follows viewer_follow
       ON viewer_follow.target_user_id = u.id
      AND viewer_follow.follower_user_id = $3
     LEFT JOIN profile_likes viewer_like
       ON viewer_like.target_user_id = u.id
       AND viewer_like.actor_user_id = $3
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
       LIMIT $1 OFFSET $2`,
      [queryLimit + 1, queryOffset, viewerUserId]
    );

  const rows = result.rows || [];
  const items = rows.slice(0, queryLimit).map(mapSocialProfile);
  return {
    items,
    nextOffset: rows.length > queryLimit ? queryOffset + queryLimit : null,
    hasMore: rows.length > queryLimit,
  };
}

router.get("/check-in/state", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const dayKey = getDayKey();
  const recentDayKeys = getRecentDayKeys(7);
  const [config, result, recentResult] = await Promise.all([
    loadDailyCheckInConfig(),
    pool.query(
      `SELECT
         (SELECT created_at FROM daily_checkins WHERE user_id = $1 AND checkin_day_key = $2 LIMIT 1) AS checked_at,
         (SELECT COUNT(*)::int FROM daily_checkins WHERE user_id = $1) AS total_checkins`,
      [userId, dayKey]
    ),
    pool.query(
    `SELECT checkin_day_key, created_at
     FROM daily_checkins
     WHERE user_id = $1
       AND checkin_day_key = ANY($2::text[])
     ORDER BY checkin_day_key ASC`,
      [userId, recentDayKeys]
    ),
  ]);
  const row = result.rows[0] || {};
  const recentMap = recentResult.rows.reduce((acc, entry) => {
    acc[String(entry.checkin_day_key)] = entry.created_at ? toIso(entry.created_at) : null;
    return acc;
  }, {});
  const checkedDayKeys = recentResult.rows.map((entry) => String(entry.checkin_day_key));
  const streakDay = computeCurrentStreakDay(checkedDayKeys);
  const nextDay = Math.min(7, (Boolean(row.checked_at) ? streakDay : streakDay + 1) || 1);
  res.json({
    dayKey,
    enabled: config.enabled,
    checkedIn: Boolean(row.checked_at),
    checkedAt: row.checked_at ? toIso(row.checked_at) : null,
    totalCheckins: Number(row.total_checkins || 0),
    streakDay,
    nextDay,
    rewards: config.rewards,
    recentDays: recentDayKeys.map((key) => ({
      dayKey: key,
      checkedIn: Boolean(recentMap[key]),
      checkedAt: recentMap[key] || null,
      isToday: key === dayKey,
    })),
  });
});

router.post("/check-in/daily", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const dayKey = getDayKey();
  const requestId = normalizeRequestId(req.body?.requestId, `daily-checkin:${userId}:${dayKey}`);
  const config = await loadDailyCheckInConfig();
  if (!config.enabled) {
    return res.status(403).json({ error: "O check-in diario esta desativado no momento." });
  }
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingEvent = await findEngagementEventByRequestId(client, requestId);
    if (existingEvent) {
      const state = await client.query(
        `SELECT created_at
         FROM daily_checkins
         WHERE user_id = $1 AND checkin_day_key = $2
         LIMIT 1`,
        [userId, dayKey]
      );
      await client.query("COMMIT");
      return res.json({
        ok: true,
        alreadyCheckedIn: true,
        dayKey,
        checkedAt: state.rows[0]?.created_at ? toIso(state.rows[0].created_at) : null,
      });
    }

    const insertResult = await client.query(
      `INSERT INTO daily_checkins (user_id, checkin_day_key, request_id, metadata, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (user_id, checkin_day_key)
       DO NOTHING
       RETURNING *`,
      [userId, dayKey, requestId, JSON.stringify({ source: "daily_checkin" })]
    );
    const inserted = insertResult.rows[0] || null;

    await appendEngagementEvent(client, {
      domain: "social",
      action: "daily_checkin",
      request_id: requestId,
      user_id: userId,
      entity_name: "daily_checkins",
      entity_id: inserted?.id || null,
      status: inserted ? "accepted" : "duplicate",
      metadata: { day_key: dayKey },
      processed_by_user_id: userId,
    });

    await client.query("COMMIT");

    await createSecurityEvent({
      user_id: userId,
      type: inserted ? "DAILY_CHECKIN_ACCEPTED" : "DAILY_CHECKIN_DUPLICATE",
      ...buildRequestMeta(req),
      metadata: { day_key: dayKey, request_id: requestId },
    });

    emitEntityChanged(req, "daily_checkins", inserted?.id || dayKey, inserted ? "created" : "duplicate");
    emitEntityChanged(req, "gamification", userId, "updated");
    await refreshGamificationState();

    return res.json({
      ok: true,
      alreadyCheckedIn: !inserted,
      dayKey,
      checkedAt: inserted?.created_at ? toIso(inserted.created_at) : new Date().toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/social/state/:targetUserId", requireAuth, async (req, res) => {
  const viewerUserId = req.auth.sub;
  const targetUserId = req.params.targetUserId === "me" ? viewerUserId : String(req.params.targetUserId || "");

  const target = await findUserById(targetUserId);
  if (!target) {
    return res.status(404).json({ error: "Perfil não encontrado" });
  }

  const client = await pool.connect();
  try {
    const state = await buildSocialState(client, viewerUserId, targetUserId);
    res.json(state);
  } finally {
    client.release();
  }
});

router.get("/social/following/my", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const items = await listRelationProfiles(client, "following", req.auth.sub);
    res.json(items);
  } finally {
    client.release();
  }
});

router.get("/social/followers/my", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const items = await listRelationProfiles(client, "followers", req.auth.sub);
    res.json(items);
  } finally {
    client.release();
  }
});

router.get("/social/discover", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = normalizeListLimit(req.query?.limit, 12, 60);
    const offset = normalizeListOffset(req.query?.offset);
    const result = await listDiscoverProfiles(client, req.auth.sub, { limit, offset });
    res.json(result);
  } finally {
    client.release();
  }
});

async function upsertFollowState(req, res, active) {
  const userId = req.auth.sub;
  const targetUserId = String(req.params.targetUserId || "");
  const requestId = normalizeRequestId(req.body?.requestId, active ? `follow:${userId}:${targetUserId}` : `unfollow:${userId}:${targetUserId}`);

  if (!targetUserId) {
    return res.status(400).json({ error: "Perfil de destino é obrigatório" });
  }
  if (targetUserId === userId) {
    return res.status(400).json({ error: "Não é permitido seguir o próprio perfil" });
  }

  const [target, actor] = await Promise.all([findUserById(targetUserId), findUserById(userId)]);
  if (!target) {
    return res.status(404).json({ error: "Perfil não encontrado" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingEvent = await findEngagementEventByRequestId(client, requestId);
    if (existingEvent) {
      const state = await buildSocialState(client, userId, targetUserId);
      await client.query("COMMIT");
      return res.json({ ok: true, state, alreadyProcessed: true });
    }

    const relationResult = await client.query(
      `SELECT *
       FROM user_follows
       WHERE follower_user_id = $1 AND target_user_id = $2
       FOR UPDATE`,
      [userId, targetUserId]
    );
    const current = relationResult.rows[0] || null;
    let relation = current;
    let applied = false;

    if (!current) {
      if (active) {
        const insertResult = await client.query(
          `INSERT INTO user_follows (
            follower_user_id, target_user_id, active, request_id, metadata, first_followed_at, followed_at, updated_at
          )
           VALUES ($1, $2, true, $3, $4::jsonb, NOW(), NOW(), NOW())
           RETURNING *`,
          [userId, targetUserId, requestId, JSON.stringify({ source: "social_follow" })]
        );
        relation = insertResult.rows[0] || null;
        applied = true;
      }
    } else if (Boolean(current.active) !== Boolean(active)) {
      const updateResult = await client.query(
        `UPDATE user_follows
         SET active = $2,
             request_id = $3,
             followed_at = CASE WHEN $2 THEN NOW() ELSE followed_at END,
             unfollowed_at = CASE WHEN $2 THEN NULL ELSE NOW() END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [current.id, active, requestId]
      );
      relation = updateResult.rows[0] || current;
      applied = true;
    }

    await appendEngagementEvent(client, {
      domain: "social",
      action: active ? "follow_profile" : "unfollow_profile",
      request_id: requestId,
      user_id: userId,
      entity_name: "user_follows",
      entity_id: relation?.id || current?.id || null,
      status: applied ? "accepted" : "duplicate",
      metadata: { target_user_id: targetUserId, active },
      processed_by_user_id: userId,
    });

    const state = await buildSocialState(client, userId, targetUserId);
    await client.query("COMMIT");

    await createSecurityEvent({
      user_id: userId,
      type: active ? (applied ? "SOCIAL_FOLLOW_ACCEPTED" : "SOCIAL_FOLLOW_DUPLICATE") : applied ? "SOCIAL_UNFOLLOW_ACCEPTED" : "SOCIAL_UNFOLLOW_DUPLICATE",
      ...buildRequestMeta(req),
      metadata: { target_user_id: targetUserId, request_id: requestId },
    });

    if (active && applied && actor) {
      await createProfileNotification({
        targetUserId,
        actor,
        type: "follow",
        title: "Novo seguidor",
        message: `${actor.full_name || actor.nick || "Alguém"} seguiu você.`,
        metadata: {
          relation_id: relation?.id || "",
          request_id: requestId,
        },
      });
    }

    emitEntityChanged(req, "user_follows", relation?.id || targetUserId, applied ? "updated" : "duplicate");
    emitEntityChanged(req, "ProfileNotification", targetUserId, active && applied ? "created" : "updated");
    emitEntityChanged(req, "gamification", userId, "updated");
    emitEntityChanged(req, "gamification", targetUserId, "updated");
    await refreshGamificationState();

    return res.json({ ok: true, state, alreadyProcessed: !applied });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertLikeState(req, res, active) {
  const userId = req.auth.sub;
  const targetUserId = String(req.params.targetUserId || "");
  const requestId = normalizeRequestId(req.body?.requestId, active ? `like:${userId}:${targetUserId}` : `unlike:${userId}:${targetUserId}`);

  if (!targetUserId) {
    return res.status(400).json({ error: "Perfil de destino é obrigatório" });
  }
  if (targetUserId === userId) {
    return res.status(400).json({ error: "Não é permitido curtir o próprio perfil" });
  }

  const [target, actor] = await Promise.all([findUserById(targetUserId), findUserById(userId)]);
  if (!target) {
    return res.status(404).json({ error: "Perfil não encontrado" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingEvent = await findEngagementEventByRequestId(client, requestId);
    if (existingEvent) {
      const state = await buildSocialState(client, userId, targetUserId);
      await client.query("COMMIT");
      return res.json({ ok: true, state, alreadyProcessed: true });
    }

    const relationResult = await client.query(
      `SELECT *
       FROM profile_likes
       WHERE actor_user_id = $1 AND target_user_id = $2
       FOR UPDATE`,
      [userId, targetUserId]
    );
    const current = relationResult.rows[0] || null;
    let relation = current;
    let applied = false;

    if (!current) {
      if (active) {
        const insertResult = await client.query(
          `INSERT INTO profile_likes (
            actor_user_id, target_user_id, active, request_id, metadata, first_liked_at, liked_at, updated_at
          )
           VALUES ($1, $2, true, $3, $4::jsonb, NOW(), NOW(), NOW())
           RETURNING *`,
          [userId, targetUserId, requestId, JSON.stringify({ source: "profile_like" })]
        );
        relation = insertResult.rows[0] || null;
        applied = true;
      }
    } else if (Boolean(current.active) !== Boolean(active)) {
      const updateResult = await client.query(
        `UPDATE profile_likes
         SET active = $2,
             request_id = $3,
             liked_at = CASE WHEN $2 THEN NOW() ELSE liked_at END,
             unliked_at = CASE WHEN $2 THEN NULL ELSE NOW() END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [current.id, active, requestId]
      );
      relation = updateResult.rows[0] || current;
      applied = true;
    }

    await appendEngagementEvent(client, {
      domain: "social",
      action: active ? "like_profile" : "unlike_profile",
      request_id: requestId,
      user_id: userId,
      entity_name: "profile_likes",
      entity_id: relation?.id || current?.id || null,
      status: applied ? "accepted" : "duplicate",
      metadata: { target_user_id: targetUserId, active },
      processed_by_user_id: userId,
    });

    const state = await buildSocialState(client, userId, targetUserId);
    await client.query("COMMIT");

    await createSecurityEvent({
      user_id: userId,
      type: active ? (applied ? "SOCIAL_LIKE_ACCEPTED" : "SOCIAL_LIKE_DUPLICATE") : applied ? "SOCIAL_UNLIKE_ACCEPTED" : "SOCIAL_UNLIKE_DUPLICATE",
      ...buildRequestMeta(req),
      metadata: { target_user_id: targetUserId, request_id: requestId },
    });

    if (active && applied && actor) {
      await createProfileNotification({
        targetUserId,
        actor,
        type: "like",
        title: "Novo like no perfil",
        message: `${actor.full_name || actor.nick || "Alguém"} curtiu seu perfil.`,
        metadata: {
          relation_id: relation?.id || "",
          request_id: requestId,
        },
      });
    }

    emitEntityChanged(req, "profile_likes", relation?.id || targetUserId, applied ? "updated" : "duplicate");
    emitEntityChanged(req, "ProfileNotification", targetUserId, active && applied ? "created" : "updated");
    emitEntityChanged(req, "gamification", userId, "updated");
    emitEntityChanged(req, "gamification", targetUserId, "updated");
    await refreshGamificationState();

    return res.json({ ok: true, state, alreadyProcessed: !applied });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

router.post("/social/follow/:targetUserId", requireAuth, (req, res) => upsertFollowState(req, res, true));
router.delete("/social/follow/:targetUserId", requireAuth, (req, res) => upsertFollowState(req, res, false));
router.post("/social/like/:targetUserId", requireAuth, (req, res) => upsertLikeState(req, res, true));
router.delete("/social/like/:targetUserId", requireAuth, (req, res) => upsertLikeState(req, res, false));

router.post("/social/auto-follow-creator", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const creatorResult = await pool.query(
    `SELECT id
     FROM users
     WHERE role = 'admin'
       AND id <> $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId]
  );
  const creatorId = creatorResult.rows[0]?.id || "";
  if (!creatorId) {
    return res.json({ ok: true, followed: false, reason: "creator_not_found" });
  }

  req.params.targetUserId = creatorId;
  req.body = { ...(req.body || {}), requestId: normalizeRequestId(req.body?.requestId, `auto-follow-creator:${userId}:${creatorId}`) };
  return upsertFollowState(req, res, true);
});

router.post("/social/auto-like-creator", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const creatorResult = await pool.query(
    `SELECT id
     FROM users
     WHERE role = 'admin'
       AND id <> $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId]
  );
  const creatorId = creatorResult.rows[0]?.id || "";
  if (!creatorId) {
    return res.json({ ok: true, liked: false, reason: "creator_not_found" });
  }

  req.params.targetUserId = creatorId;
  req.body = { ...(req.body || {}), requestId: normalizeRequestId(req.body?.requestId, `auto-like-creator:${userId}:${creatorId}`) };
  return upsertLikeState(req, res, true);
});

export default router;
