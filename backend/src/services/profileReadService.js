import { normalizeRecord, pool } from "../db/index.js";

export async function listPublicProfileBasics(ids = [], handles = []) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 50);
  const uniqueHandles = Array.from(
    new Set(
      (Array.isArray(handles) ? handles : [])
        .map((value) => String(value || "").trim().replace(/^@+/, "").toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 50);

  if (uniqueIds.length === 0 && uniqueHandles.length === 0) {
    return [];
  }

  const clauses = [];
  const values = [];
  if (uniqueIds.length > 0) {
    values.push(uniqueIds);
    clauses.push(`id = ANY($${values.length}::uuid[])`);
  }
  if (uniqueHandles.length > 0) {
    values.push(uniqueHandles);
    clauses.push(`LOWER(COALESCE(nick, '')) = ANY($${values.length}::text[])`);
  }

  const result = await pool.query(
    `SELECT id, full_name, nick, avatar_emoji, profile_avatar_id, profile_image_mode, profile_image_url, profile_image_status, account_status
       FROM users
      WHERE ${clauses.join(" OR ")}`,
    values
  );

  const usersById = new Map(
    result.rows.map((row) => {
      const user = row || {};
      const approvedProfileImageUrl =
        String(user.profile_image_status || "none") === "approved"
          ? String(user.profile_image_url || "").trim() || (user.id ? `/api/auth/profile-image/${user.id}` : "")
          : "";
      return [
        String(user.id),
        {
          id: user.id,
          full_name: user.full_name || "",
          nick: user.nick || "",
          avatar_emoji: user.avatar_emoji || "🎰",
          profile_avatar_id: user.profile_avatar_id || "",
          profile_image_mode: user.profile_image_mode || "avatar",
          profile_image_url: approvedProfileImageUrl,
          profile_image_status: user.profile_image_status || "none",
          account_status: user.account_status || "active",
        },
      ];
    })
  );
  const usersByHandle = new Map(
    result.rows
      .map((row) => {
        const nick = String(row?.nick || "").trim().toLowerCase();
        return nick ? [nick, usersById.get(String(row.id))] : null;
      })
      .filter(Boolean)
  );

  return [
    ...uniqueIds.map((id) => usersById.get(id)).filter(Boolean),
    ...uniqueHandles.map((handle) => usersByHandle.get(handle)).filter(Boolean),
  ].filter((item, index, arr) => arr.findIndex((entry) => String(entry?.id || "") === String(item?.id || "")) === index);
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
