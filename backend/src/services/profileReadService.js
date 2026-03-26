import { normalizeRecord, pool } from "../db/index.js";

export async function listPublicProfileBasics(ids = []) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 50);

  if (uniqueIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `SELECT id, full_name, nick, avatar_emoji, profile_avatar_id, profile_image_mode, profile_image_url, profile_image_status, account_status
       FROM users
      WHERE id = ANY($1::uuid[])`,
    [uniqueIds]
  );

  const usersById = new Map(
    result.rows.map((row) => {
      const user = row || {};
      return [
        String(user.id),
        {
          id: user.id,
          full_name: user.full_name || "",
          nick: user.nick || "",
          avatar_emoji: user.avatar_emoji || "🎰",
          profile_avatar_id: user.profile_avatar_id || "",
          profile_image_mode: user.profile_image_mode || "avatar",
          profile_image_url: user.profile_image_url || "",
          profile_image_status: user.profile_image_status || "none",
          account_status: user.account_status || "active",
        },
      ];
    })
  );

  return uniqueIds.map((id) => usersById.get(id)).filter(Boolean);
}

export async function listProfileNotifications(userId, limit = 50) {
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = 'ProfileNotification'
        AND COALESCE(data->>'user_id', '') = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(normalizeRecord);
}

export async function listPlatformHistory(userId, limit = 100) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit || 100)));
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at
       FROM entity_records
      WHERE entity_name = 'PlatformHistory'
        AND COALESCE(data->>'user_id', '') = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [normalizedUserId, safeLimit]
  );

  return result.rows.map(normalizeRecord);
}

export async function markProfileNotificationsRead(userId, ids = []) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 100);

  if (uniqueIds.length === 0) {
    return { updated: 0, items: [] };
  }

  const result = await pool.query(
    `UPDATE entity_records
        SET data =
              COALESCE(data, '{}'::jsonb) ||
              jsonb_build_object('status', 'read', 'read_at', NOW()::text),
            updated_at = NOW()
      WHERE entity_name = 'ProfileNotification'
        AND id = ANY($1::uuid[])
        AND COALESCE(data->>'user_id', '') = $2
    RETURNING id, data, created_at, updated_at`,
    [uniqueIds, userId]
  );

  return {
    updated: Number(result.rowCount || 0),
    items: result.rows.map(normalizeRecord),
  };
}
