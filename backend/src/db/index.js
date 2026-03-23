import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({ connectionString: env.databaseUrl });

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

export async function ensureDb() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      full_name TEXT,
      nick TEXT,
      phone TEXT,
      platform_id TEXT,
      avatar_emoji TEXT,
      profile_avatar_id TEXT,
      profile_image_mode TEXT NOT NULL DEFAULT 'avatar',
      profile_image_url TEXT,
      profile_image_status TEXT NOT NULL DEFAULT 'none',
      profile_image_reject_reason TEXT,
      profile_image_moderation_score NUMERIC,
      profile_image_uploaded_at TIMESTAMPTZ,
      profile_image_pending_name TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      deactivated_at TIMESTAMPTZ,
      role TEXT NOT NULL DEFAULT 'user',
      two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      two_factor_secret TEXT,
      terms_accepted BOOLEAN NOT NULL DEFAULT false,
      privacy_accepted BOOLEAN NOT NULL DEFAULT false,
      onboarding_completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_avatar_id TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_mode TEXT NOT NULL DEFAULT 'avatar'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_status TEXT NOT NULL DEFAULT 'none'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_reject_reason TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_moderation_score NUMERIC");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_uploaded_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_pending_name TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent TEXT,
      ip TEXT,
      rotate_family_id TEXT NOT NULL
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(rotate_family_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      reason TEXT NOT NULL,
      request_id TEXT NOT NULL UNIQUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_points_ledger_user_id ON points_ledger(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profile_images (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      approved_mime_type TEXT,
      approved_file_name TEXT,
      approved_data BYTEA,
      pending_mime_type TEXT,
      pending_file_name TEXT,
      pending_data BYTEA,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profile_image_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime_type TEXT,
      file_name TEXT,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_profile_image_versions_user_created
      ON user_profile_image_versions (user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_metric_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      metric_key TEXT NOT NULL,
      cycle_key TEXT NOT NULL DEFAULT '',
      amount NUMERIC NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, metric_key, cycle_key, source_type, source_ref)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_metric_ledger_user_metric ON user_metric_ledger(user_id, metric_key)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_metric_ledger_cycle ON user_metric_ledger(cycle_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_metric_balances (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      metric_key TEXT NOT NULL,
      cycle_key TEXT NOT NULL DEFAULT '',
      amount NUMERIC NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, metric_key, cycle_key)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_metric_balances_metric ON user_metric_balances(metric_key, cycle_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_cycles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cycle_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ,
      config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      winners_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_weekly_cycles_status ON weekly_cycles(status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_weekly_cycles_period ON weekly_cycles(starts_at, ends_at)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_config_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL,
      action TEXT NOT NULL,
      target_key TEXT NOT NULL,
      before_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      after_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      admin_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_admin_config_audit_logs_domain ON admin_config_audit_logs(domain, created_at DESC)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_chest_reward_daily_usage (
      reward_config_id TEXT NOT NULL,
      chest_day_key TEXT NOT NULL,
      claimed_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (reward_config_id, chest_day_key)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_reward_daily_usage_day ON daily_chest_reward_daily_usage(chest_day_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_chest_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chest_day_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'opened',
      reward_config_id TEXT,
      reward_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      grant_result JSONB NOT NULL DEFAULT '{}'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, chest_day_key)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_claims_user_id ON daily_chest_claims(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_claims_day_key ON daily_chest_claims(chest_day_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_chest_openings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chest_day_key TEXT NOT NULL,
      slot_index INT NOT NULL,
      slot_source TEXT NOT NULL DEFAULT 'base',
      status TEXT NOT NULL DEFAULT 'opened',
      reward_config_id TEXT,
      reward_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      grant_result JSONB NOT NULL DEFAULT '{}'::jsonb,
      xp_awarded INT NOT NULL DEFAULT 0,
      xp_grant_ref_id TEXT,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, chest_day_key, slot_index)
    )
  `);
  await pool.query("ALTER TABLE daily_chest_openings ADD COLUMN IF NOT EXISTS slot_source TEXT NOT NULL DEFAULT 'base'");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_openings_user_day ON daily_chest_openings(user_id, chest_day_key)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_openings_status ON daily_chest_openings(status)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_chest_access_unlocks (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chest_day_key TEXT NOT NULL,
      code_value TEXT,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, chest_day_key)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_access_unlocks_day ON daily_chest_access_unlocks(chest_day_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_chest_bonus_grants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chest_day_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      slots_awarded INT NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_type, source_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_chest_bonus_user_day ON daily_chest_bonus_grants(user_id, chest_day_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entity_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_name TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_entity_records_entity_name ON entity_records(entity_name)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposit_ticket_counters (
      cycle_id TEXT PRIMARY KEY,
      next_ticket_number BIGINT NOT NULL DEFAULT 1000000,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposit_processing_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deposit_id TEXT NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      request_id TEXT UNIQUE,
      previous_status TEXT,
      next_status TEXT,
      tickets_granted INT NOT NULL DEFAULT 0,
      basic_tickets INT NOT NULL DEFAULT 0,
      bonus_tickets INT NOT NULL DEFAULT 0,
      ticket_start BIGINT,
      ticket_end BIGINT,
      rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      processed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      processed_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_deposit_processing_events_deposit_id ON deposit_processing_events(deposit_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_deposit_processing_events_user_id ON deposit_processing_events(user_id)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposit_processing_approve ON deposit_processing_events(deposit_id, event_type) WHERE event_type = 'approved'");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposit_processing_reject ON deposit_processing_events(deposit_id, event_type) WHERE event_type = 'rejected'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_domain_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_entity_name TEXT,
      record_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(domain, scope_key, user_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_domain_registry_user_id ON user_domain_registry(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_domain_registry_domain_scope ON user_domain_registry(domain, scope_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS engagement_processing_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL,
      action TEXT NOT NULL,
      request_id TEXT UNIQUE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      entity_name TEXT,
      entity_id TEXT,
      status TEXT NOT NULL DEFAULT 'accepted',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      processed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      processed_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_engagement_processing_events_user_id ON engagement_processing_events(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_engagement_processing_events_entity ON engagement_processing_events(entity_name, entity_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      checkin_day_key TEXT NOT NULL,
      request_id TEXT UNIQUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, checkin_day_key)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id ON daily_checkins(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_daily_checkins_day_key ON daily_checkins(checkin_day_key)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_follows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT true,
      request_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unfollowed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(follower_user_id, target_user_id),
      CHECK (follower_user_id <> target_user_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_user_id, active)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_follows_target ON user_follows(target_user_id, active)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT true,
      request_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unliked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(actor_user_id, target_user_id),
      CHECK (actor_user_id <> target_user_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_profile_likes_actor ON profile_likes(actor_user_id, active)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_profile_likes_target ON profile_likes(target_user_id, active)");
}

export async function ensureDevAdmin(config) {
  const email = String(config?.email || "admin@local.dev").toLowerCase();
  const fullName = config?.fullName || "Admin Local";
  const nick = config?.nick || "admin";
  const passwordHash = config?.passwordHash || null;

  const found = await pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  if (found.rows[0]) {
    const updated = await pool.query(
      `UPDATE users
       SET role = 'admin',
           full_name = COALESCE(NULLIF($1, ''), full_name),
           nick = COALESCE(NULLIF($2, ''), nick),
           password_hash = COALESCE($3, password_hash),
           terms_accepted = true,
           privacy_accepted = true,
           onboarding_completed = true,
           updated_at = NOW()
       WHERE email = $4
       RETURNING *`,
      [fullName, nick, passwordHash, email]
    );
    return normalizeUser(updated.rows[0]);
  }

  const inserted = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, nick, role, terms_accepted, privacy_accepted, onboarding_completed, avatar_emoji)
     VALUES ($1, $2, $3, $4, 'admin', true, true, true, $5)
     RETURNING *`,
    [email, passwordHash, fullName, nick, "🎰"]
  );

  return normalizeUser(inserted.rows[0]);
}

export function normalizeUser(row) {
  if (!row) return null;
  const createdAt = row.created_at ? toIso(row.created_at) : null;
  const updatedAt = row.updated_at ? toIso(row.updated_at) : null;
  const approvedProfileImageUrl = String(row.profile_image_url || "").trim()
    || (String(row.profile_image_status || "none") === "approved" && row.id
      ? `/api/auth/profile-image/${row.id}`
      : "");
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name || "",
    nick: row.nick || "",
    phone: row.phone || "",
    platform_id: row.platform_id || "",
    avatar_emoji: row.avatar_emoji || "🎰",
    profile_avatar_id: row.profile_avatar_id || "",
    profile_image_mode: row.profile_image_mode || "avatar",
    profile_image_url: approvedProfileImageUrl,
    profile_image_status: row.profile_image_status || "none",
    profile_image_reject_reason: row.profile_image_reject_reason || "",
    profile_image_moderation_score:
      row.profile_image_moderation_score === null || row.profile_image_moderation_score === undefined
        ? null
        : Number(row.profile_image_moderation_score),
    profile_image_uploaded_at: row.profile_image_uploaded_at ? toIso(row.profile_image_uploaded_at) : null,
    account_status: row.account_status || "active",
    deactivated_at: row.deactivated_at ? toIso(row.deactivated_at) : null,
    role: row.role || "user",
    two_factor_enabled: Boolean(row.two_factor_enabled),
    terms_accepted: Boolean(row.terms_accepted),
    privacy_accepted: Boolean(row.privacy_accepted),
    onboarding_completed: Boolean(row.onboarding_completed),
    created_at: createdAt,
    updated_at: updatedAt,
    created_date: createdAt,
    updated_date: updatedAt,
  };
}

export async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return normalizeUser(result.rows[0]);
}

export async function findUserPrivateById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...normalizeUser(row),
    profile_image_pending_name: row.profile_image_pending_name || "",
  };
}

export async function findUserRowByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  return result.rows[0] || null;
}

export async function findUserRowById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const row = await findUserRowByEmail(email);
  return normalizeUser(row);
}

export async function findUserByGoogleId(googleId) {
  const result = await pool.query("SELECT * FROM users WHERE google_id = $1 LIMIT 1", [googleId]);
  return normalizeUser(result.rows[0]);
}

export async function findOrCreateUserByEmail(email, defaults = {}) {
  const existing = await findUserRowByEmail(email);
  if (existing) return normalizeUser(existing);

  const inserted = await pool.query(
    `INSERT INTO users (email, password_hash, google_id, full_name, nick, phone, role, terms_accepted, privacy_accepted, onboarding_completed, avatar_emoji)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      email,
      defaults.password_hash || null,
      defaults.google_id || null,
      defaults.full_name || "",
      defaults.nick || email.split("@")[0],
      defaults.phone || "",
      defaults.role || "user",
      defaults.terms_accepted ?? false,
      defaults.privacy_accepted ?? false,
      defaults.onboarding_completed ?? false,
      defaults.avatar_emoji || "🎰",
    ]
  );

  return normalizeUser(inserted.rows[0]);
}

export async function updateUserById(userId, payload) {
  const keys = Object.keys(payload || {});
  if (keys.length === 0) {
    return findUserById(userId);
  }

  const columns = [];
  const values = [];

  for (const key of keys) {
    columns.push(`${key} = $${columns.length + 1}`);
    values.push(payload[key]);
  }

  values.push(userId);
  const query = `
    UPDATE users
    SET ${columns.join(", ")}, updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return normalizeUser(result.rows[0]);
}

export async function updateUserGoogleLink(userId, googleId) {
  const result = await pool.query(
    "UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [googleId, userId]
  );
  return normalizeUser(result.rows[0]);
}

export async function deleteUserById(userId) {
  const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [userId]);
  return normalizeUser(result.rows[0]);
}

export async function getUserProfileImages(userId) {
  const result = await pool.query(
    `SELECT user_id, approved_mime_type, approved_file_name, approved_data,
            pending_mime_type, pending_file_name, pending_data, updated_at
       FROM user_profile_images
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function upsertUserProfileImages(userId, payload = {}) {
  const current = (await getUserProfileImages(userId)) || {};
  const next = {
    approved_mime_type: payload.approved_mime_type !== undefined ? payload.approved_mime_type : current.approved_mime_type || null,
    approved_file_name: payload.approved_file_name !== undefined ? payload.approved_file_name : current.approved_file_name || null,
    approved_data: payload.approved_data !== undefined ? payload.approved_data : current.approved_data || null,
    pending_mime_type: payload.pending_mime_type !== undefined ? payload.pending_mime_type : current.pending_mime_type || null,
    pending_file_name: payload.pending_file_name !== undefined ? payload.pending_file_name : current.pending_file_name || null,
    pending_data: payload.pending_data !== undefined ? payload.pending_data : current.pending_data || null,
  };

  const result = await pool.query(
    `INSERT INTO user_profile_images (
       user_id, approved_mime_type, approved_file_name, approved_data,
       pending_mime_type, pending_file_name, pending_data, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       approved_mime_type = EXCLUDED.approved_mime_type,
       approved_file_name = EXCLUDED.approved_file_name,
       approved_data = EXCLUDED.approved_data,
       pending_mime_type = EXCLUDED.pending_mime_type,
       pending_file_name = EXCLUDED.pending_file_name,
       pending_data = EXCLUDED.pending_data,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      next.approved_mime_type,
      next.approved_file_name,
      next.approved_data,
      next.pending_mime_type,
      next.pending_file_name,
      next.pending_data,
    ]
  );
  return result.rows[0] || null;
}

export async function createUserProfileImageVersion(userId, payload = {}) {
  const result = await pool.query(
    `INSERT INTO user_profile_image_versions (user_id, mime_type, file_name, data)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, mime_type, file_name, created_at`,
    [
      userId,
      payload.mime_type || "image/jpeg",
      payload.file_name || `profile-${userId}`,
      payload.data,
    ]
  );
  return result.rows[0] || null;
}

export async function getUserProfileImageVersion(versionId) {
  const result = await pool.query(
    `SELECT id, user_id, mime_type, file_name, data, created_at
       FROM user_profile_image_versions
      WHERE id = $1
      LIMIT 1`,
    [versionId]
  );
  return result.rows[0] || null;
}

export async function listUserProfileImageVersions(userId) {
  const result = await pool.query(
    `SELECT id, user_id, mime_type, file_name, created_at
       FROM user_profile_image_versions
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    mime_type: row.mime_type || "image/jpeg",
    file_name: row.file_name || "",
    created_at: row.created_at ? toIso(row.created_at) : toIso(new Date()),
  }));
}

export async function createRefreshToken(payload) {
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip, rotate_family_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      payload.user_id,
      payload.token_hash,
      payload.expires_at,
      payload.user_agent || "",
      payload.ip || "",
      payload.rotate_family_id,
    ]
  );
  return result.rows[0] || null;
}

export async function findActiveRefreshTokenByHash(tokenHash) {
  const result = await pool.query(
    `SELECT *
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

export async function revokeRefreshTokenById(id) {
  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

export async function revokeRefreshTokensByUserId(userId) {
  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE user_id = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [userId]
  );
  return result.rowCount || 0;
}

export async function revokeRefreshTokensByFamilyId(familyId) {
  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE rotate_family_id = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [familyId]
  );
  return result.rowCount || 0;
}

export async function createSecurityEvent(payload) {
  const result = await pool.query(
    `INSERT INTO security_events (user_id, type, ip, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [
      payload.user_id || null,
      payload.type,
      payload.ip || "",
      payload.user_agent || "",
      JSON.stringify(payload.metadata || {}),
    ]
  );
  return result.rows[0] || null;
}

export async function createLoginAttempt(payload) {
  const result = await pool.query(
    `INSERT INTO login_attempts (identifier, ip, user_agent, success)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      String(payload.identifier || "").toLowerCase(),
      payload.ip || "",
      payload.user_agent || "",
      Boolean(payload.success),
    ]
  );
  return result.rows[0] || null;
}

export async function countFailedLoginAttemptsSince(identifier, ip, sinceIso) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM login_attempts
     WHERE identifier = $1
       AND ip = $2
       AND success = false
       AND created_at >= $3::timestamptz`,
    [String(identifier || "").toLowerCase(), ip || "", sinceIso]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function createPasswordResetToken(payload) {
  const result = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [payload.user_id, payload.token_hash, payload.expires_at]
  );
  return result.rows[0] || null;
}

export async function findValidPasswordResetTokenByHash(tokenHash) {
  const result = await pool.query(
    `SELECT *
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

export async function markPasswordResetTokenUsed(id) {
  const result = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = COALESCE(used_at, NOW())
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

export async function findPointsLedgerByRequestId(requestId) {
  const result = await pool.query(
    `SELECT *
     FROM points_ledger
     WHERE request_id = $1
     LIMIT 1`,
    [String(requestId || "")]
  );
  return result.rows[0] || null;
}

export async function createPointsLedgerEntry(payload) {
  const result = await pool.query(
    `INSERT INTO points_ledger (user_id, amount, reason, request_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [
      payload.user_id,
      Number(payload.amount || 0),
      String(payload.reason || ""),
      String(payload.request_id || ""),
      JSON.stringify(payload.metadata || {}),
    ]
  );
  return result.rows[0] || null;
}

export async function getPointsBalanceByUserId(userId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS balance
     FROM points_ledger
     WHERE user_id = $1`,
    [userId]
  );
  return Number(result.rows[0]?.balance || 0);
}

export async function listPointsLedgerByUserId(userId, limit = 50) {
  const parsedLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const result = await pool.query(
    `SELECT id, user_id, amount, reason, request_id, metadata, created_at
     FROM points_ledger
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, parsedLimit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    amount: Number(row.amount || 0),
    reason: row.reason || "",
    request_id: row.request_id || "",
    metadata: row.metadata || {},
    created_at: toIso(row.created_at),
  }));
}

function normalizeDailyChestClaim(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    chest_day_key: row.chest_day_key,
    status: row.status || "opened",
    reward_config_id: row.reward_config_id || "",
    reward_snapshot: row.reward_snapshot || {},
    grant_result: row.grant_result || {},
    opened_at: row.opened_at ? toIso(row.opened_at) : null,
    claimed_at: row.claimed_at ? toIso(row.claimed_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeDailyChestOpening(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    chest_day_key: row.chest_day_key,
    slot_index: Number(row.slot_index || 0),
    slot_source: String(row.slot_source || "base"),
    status: row.status || "opened",
    reward_config_id: row.reward_config_id || "",
    reward_snapshot: row.reward_snapshot || {},
    grant_result: row.grant_result || {},
    xp_awarded: Number(row.xp_awarded || 0),
    xp_grant_ref_id: row.xp_grant_ref_id || "",
    opened_at: row.opened_at ? toIso(row.opened_at) : null,
    claimed_at: row.claimed_at ? toIso(row.claimed_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeDailyChestAccessUnlock(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    chest_day_key: row.chest_day_key,
    code_value: row.code_value || "",
    unlocked_at: row.unlocked_at ? toIso(row.unlocked_at) : null,
    created_at: row.created_at ? toIso(row.created_at) : null,
    updated_at: row.updated_at ? toIso(row.updated_at) : null,
  };
}

function normalizeDailyChestBonusGrant(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    chest_day_key: row.chest_day_key,
    source_type: row.source_type || "",
    source_id: row.source_id || "",
    slots_awarded: Number(row.slots_awarded || 0),
    metadata: row.metadata || {},
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export async function findDailyChestClaimByUserDay(userId, chestDayKey) {
  const result = await pool.query(
    `SELECT *
     FROM daily_chest_claims
     WHERE user_id = $1 AND chest_day_key = $2
     LIMIT 1`,
    [userId, chestDayKey]
  );
  return normalizeDailyChestClaim(result.rows[0]);
}

export async function upsertDailyChestOpenedClaim({ userId, chestDayKey, rewardConfigId, rewardSnapshot }) {
  const result = await pool.query(
    `INSERT INTO daily_chest_claims (user_id, chest_day_key, status, reward_config_id, reward_snapshot, opened_at, updated_at)
     VALUES ($1, $2, 'opened', $3, $4::jsonb, NOW(), NOW())
     ON CONFLICT (user_id, chest_day_key)
     DO UPDATE SET
       status = CASE
         WHEN daily_chest_claims.status = 'claimed' THEN daily_chest_claims.status
         ELSE 'opened'
       END,
       reward_config_id = COALESCE(daily_chest_claims.reward_config_id, EXCLUDED.reward_config_id),
       reward_snapshot = CASE
         WHEN daily_chest_claims.status = 'claimed' THEN daily_chest_claims.reward_snapshot
         ELSE COALESCE(NULLIF(daily_chest_claims.reward_snapshot, '{}'::jsonb), EXCLUDED.reward_snapshot)
       END,
       opened_at = COALESCE(daily_chest_claims.opened_at, NOW()),
       updated_at = NOW()
     RETURNING *`,
    [userId, chestDayKey, rewardConfigId || null, JSON.stringify(rewardSnapshot || {})]
  );
  return normalizeDailyChestClaim(result.rows[0]);
}

export async function markDailyChestClaimClaimed({ claimId, grantResult, status = "claimed" }) {
  const result = await pool.query(
    `UPDATE daily_chest_claims
     SET status = $2,
         grant_result = $3::jsonb,
         claimed_at = COALESCE(claimed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [claimId, status, JSON.stringify(grantResult || {})]
  );
  return normalizeDailyChestClaim(result.rows[0]);
}

export async function listDailyChestOpeningsByUserDay(userId, chestDayKey) {
  const result = await pool.query(
    `SELECT *
     FROM daily_chest_openings
     WHERE user_id = $1 AND chest_day_key = $2
     ORDER BY slot_index DESC, opened_at DESC`,
    [userId, chestDayKey]
  );
  return result.rows.map(normalizeDailyChestOpening);
}

export async function findLatestDailyChestOpeningByUserDay(userId, chestDayKey) {
  const result = await pool.query(
    `SELECT *
     FROM daily_chest_openings
     WHERE user_id = $1 AND chest_day_key = $2
     ORDER BY slot_index DESC, opened_at DESC
     LIMIT 1`,
    [userId, chestDayKey]
  );
  return normalizeDailyChestOpening(result.rows[0]);
}

export async function createDailyChestOpening({
  userId,
  chestDayKey,
  slotIndex,
  slotSource = "base",
  rewardConfigId,
  rewardSnapshot,
  xpAwarded = 0,
  xpGrantRefId = "",
}) {
  const result = await pool.query(
    `INSERT INTO daily_chest_openings (
        user_id,
        chest_day_key,
        slot_index,
        slot_source,
        status,
        reward_config_id,
        reward_snapshot,
      xp_awarded,
      xp_grant_ref_id,
      opened_at,
      updated_at
    )
      VALUES ($1, $2, $3, $4, 'opened', $5, $6::jsonb, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        userId,
        chestDayKey,
        Number(slotIndex || 0),
        String(slotSource || "base"),
        rewardConfigId || null,
        JSON.stringify(rewardSnapshot || {}),
        Math.max(0, Number(xpAwarded || 0)),
        String(xpGrantRefId || ""),
      ]
    );
  return normalizeDailyChestOpening(result.rows[0]);
}

export async function markDailyChestOpeningClaimed({ openingId, grantResult, status = "claimed" }) {
  const result = await pool.query(
    `UPDATE daily_chest_openings
     SET status = $2,
         grant_result = $3::jsonb,
         claimed_at = COALESCE(claimed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [openingId, status, JSON.stringify(grantResult || {})]
  );
  return normalizeDailyChestOpening(result.rows[0]);
}

export async function listDailyChestBonusGrantsByUserDay(userId, chestDayKey) {
  const result = await pool.query(
    `SELECT *
     FROM daily_chest_bonus_grants
     WHERE user_id = $1 AND chest_day_key = $2
     ORDER BY created_at DESC`,
    [userId, chestDayKey]
  );
  return result.rows.map(normalizeDailyChestBonusGrant);
}

export async function getDailyChestAccessUnlock(userId, chestDayKey) {
  const result = await pool.query(
    `SELECT *
     FROM daily_chest_access_unlocks
     WHERE user_id = $1 AND chest_day_key = $2
     LIMIT 1`,
    [String(userId || ""), String(chestDayKey || "")]
  );
  return normalizeDailyChestAccessUnlock(result.rows[0]);
}

export async function upsertDailyChestAccessUnlock({ userId, chestDayKey, codeValue = "" }) {
  const result = await pool.query(
    `INSERT INTO daily_chest_access_unlocks (user_id, chest_day_key, code_value, unlocked_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id, chest_day_key)
     DO UPDATE SET
       code_value = EXCLUDED.code_value,
       unlocked_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [String(userId || ""), String(chestDayKey || ""), String(codeValue || "")]
  );
  return normalizeDailyChestAccessUnlock(result.rows[0]);
}

export async function createDailyChestBonusGrant({
  userId,
  chestDayKey,
  sourceType,
  sourceId,
  slotsAwarded,
  metadata,
}) {
  const result = await pool.query(
    `INSERT INTO daily_chest_bonus_grants (
      user_id,
      chest_day_key,
      source_type,
      source_id,
      slots_awarded,
      metadata,
      created_at,
      updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
     ON CONFLICT (source_type, source_id)
     DO NOTHING
     RETURNING *`,
    [
      userId,
      chestDayKey,
      String(sourceType || ""),
      String(sourceId || ""),
      Math.max(0, Number(slotsAwarded || 0)),
      JSON.stringify(metadata || {}),
    ]
  );
  return normalizeDailyChestBonusGrant(result.rows[0] || null);
}

function readBooleanSetting(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readNumberSetting(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getDailyChestSettingsMap(settings = []) {
  const map = new Map();
  settings.forEach((entry) => {
    map.set(String(entry?.key || ""), entry?.value);
  });
  return map;
}

function padDailyChestValue(value) {
  return String(value).padStart(2, "0");
}

function getDailyChestWindowForDate(date, resetHour, resetMinute) {
  const now = new Date(date || Date.now());
  const start = new Date(now);
  start.setHours(resetHour, resetMinute, 0, 0);
  if (now < start) {
    start.setDate(start.getDate() - 1);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const chestDayKey = `${start.getFullYear()}-${padDailyChestValue(start.getMonth() + 1)}-${padDailyChestValue(start.getDate())}`;
  return {
    now,
    availableAt: start,
    resetAt: end,
    chestDayKey,
  };
}

async function loadDailyChestDepositBonusSettings() {
  const settings = await listEntity("AppSettings");
  const map = getDailyChestSettingsMap(settings);
  return {
    depositBonusEnabled: readBooleanSetting(map.get("daily_chest_deposit_bonus_enabled"), false),
    chestsPerApprovedDeposit: readNumberSetting(map.get("daily_chest_bonus_chests_per_approved"), 1, 0, 20),
    amountStep: readNumberSetting(map.get("daily_chest_bonus_amount_step"), 0, 0, 1_000_000),
    chestsPerAmountStep: readNumberSetting(map.get("daily_chest_bonus_chests_per_step"), 0, 0, 20),
    resetHour: readNumberSetting(map.get("daily_chest_reset_hour"), 0, 0, 23),
    resetMinute: readNumberSetting(map.get("daily_chest_reset_minute"), 0, 0, 59),
  };
}

async function maybeGrantDailyChestBonusForDeposit(deposit) {
  if (!deposit?.id || !deposit?.user_id || deposit?.status !== "approved") return;
  const settings = await loadDailyChestDepositBonusSettings();
  if (!settings.depositBonusEnabled) return;

  const amount = Math.max(0, Number(deposit.amount || 0));
  const slotsFromApproved = Math.max(0, Number(settings.chestsPerApprovedDeposit || 0));
  const slotsFromAmountStep =
    settings.amountStep > 0
      ? Math.floor(amount / Math.max(1, Number(settings.amountStep || 0))) * Math.max(0, Number(settings.chestsPerAmountStep || 0))
      : 0;
  const totalSlots = Math.max(0, Math.round(slotsFromApproved + slotsFromAmountStep));
  if (totalSlots <= 0) return;

  const approvedAt = deposit.approved_date || deposit.updated_date || deposit.created_date || new Date().toISOString();
  const windowInfo = getDailyChestWindowForDate(approvedAt, settings.resetHour, settings.resetMinute);

  await createDailyChestBonusGrant({
    userId: deposit.user_id,
    chestDayKey: windowInfo.chestDayKey,
    sourceType: "deposit_approved",
    sourceId: deposit.id,
    slotsAwarded: totalSlots,
    metadata: {
      amount,
      approved_at: approvedAt,
      deposit_id: deposit.id,
      slots_from_approved: slotsFromApproved,
      slots_from_amount_step: slotsFromAmountStep,
    },
  });
}

export async function listUsersByProfileImageStatus(status = "manual_review") {
  const result = await pool.query(
    `SELECT id, email, full_name, nick, profile_image_status, profile_image_reject_reason,
            profile_image_moderation_score, profile_image_uploaded_at, profile_image_pending_name,
            profile_image_url, updated_at
     FROM users
     WHERE profile_image_status = $1
     ORDER BY profile_image_uploaded_at DESC NULLS LAST, updated_at DESC`,
    [status]
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    full_name: row.full_name || "",
    nick: row.nick || "",
    profile_image_status: row.profile_image_status || "none",
    profile_image_reject_reason: row.profile_image_reject_reason || "",
    profile_image_moderation_score:
      row.profile_image_moderation_score === null || row.profile_image_moderation_score === undefined
        ? null
        : Number(row.profile_image_moderation_score),
    profile_image_uploaded_at: row.profile_image_uploaded_at ? toIso(row.profile_image_uploaded_at) : null,
    profile_image_pending_name: row.profile_image_pending_name || "",
    profile_image_url: row.profile_image_url || "",
    updated_date: toIso(row.updated_at),
  }));
}

export function normalizeRecord(row) {
  if (!row) return null;
  const data = { ...(row.data || {}) };

  if (!data.id) data.id = row.id;
  if (!data.created_date) data.created_date = toIso(row.created_at);
  data.updated_date = toIso(row.updated_at);

  return data;
}

function normalizeDepositProcessingEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    deposit_id: row.deposit_id,
    user_id: row.user_id || "",
    event_type: row.event_type || "",
    request_id: row.request_id || "",
    previous_status: row.previous_status || "",
    next_status: row.next_status || "",
    tickets_granted: Number(row.tickets_granted || 0),
    basic_tickets: Number(row.basic_tickets || 0),
    bonus_tickets: Number(row.bonus_tickets || 0),
    ticket_start: row.ticket_start === null || row.ticket_start === undefined ? null : Number(row.ticket_start),
    ticket_end: row.ticket_end === null || row.ticket_end === undefined ? null : Number(row.ticket_end),
    rule_snapshot: row.rule_snapshot || {},
    metadata: row.metadata || {},
    processed_by_user_id: row.processed_by_user_id || "",
    processed_by_email: row.processed_by_email || "",
    created_at: toIso(row.created_at),
  };
}

function normalizeEngagementProcessingEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    domain: row.domain || "",
    action: row.action || "",
    request_id: row.request_id || "",
    user_id: row.user_id || "",
    entity_name: row.entity_name || "",
    entity_id: row.entity_id || "",
    status: row.status || "accepted",
    metadata: row.metadata || {},
    processed_by_user_id: row.processed_by_user_id || "",
    processed_by_email: row.processed_by_email || "",
    created_at: toIso(row.created_at),
  };
}

function compareValues(a, b, direction = "asc") {
  const left = a ?? null;
  const right = b ?? null;

  if (left === right) return 0;
  if (left === null) return direction === "asc" ? -1 : 1;
  if (right === null) return direction === "asc" ? 1 : -1;

  if (left > right) return direction === "asc" ? 1 : -1;
  return direction === "asc" ? -1 : 1;
}

function applySort(rows, sort) {
  if (!sort || typeof sort !== "string") return rows;
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  const direction = descending ? "desc" : "asc";

  return [...rows].sort((a, b) => compareValues(a[field], b[field], direction));
}

function applyLimit(rows, limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return rows;
  return rows.slice(0, parsed);
}

export function getEntityRecordData(row) {
  if (!row) return null;
  return normalizeRecord(row);
}

async function getAppSettingsMap() {
  const result = await pool.query(
    "SELECT data FROM entity_records WHERE entity_name = 'AppSettings' ORDER BY created_at DESC"
  );
  const map = new Map();
  result.rows.forEach((row) => {
    const data = row.data || {};
    if (data?.key) {
      map.set(String(data.key), data.value);
    }
  });
  return map;
}

function readDepositNumberSetting(value, fallback, min = 0, max = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function loadDepositTicketRuleSettings() {
  const settings = await getAppSettingsMap();
  return {
    reward50: readDepositNumberSetting(settings.get("tickets_reward_50"), 50, 0, 100_000),
    reward100: readDepositNumberSetting(settings.get("tickets_reward_100"), 100, 0, 100_000),
  };
}

function computeDepositTicketBreakdown(totalApprovedAmount, reward50, reward100) {
  const total = Math.max(0, Number(totalApprovedAmount || 0));
  const marks50 = Math.floor(total / 50);
  const marks100 = Math.floor(total / 100);
  const pure50 = Math.max(0, marks50 - marks100);
  const basicTickets = pure50 * Math.max(0, Number(reward50 || 0));
  const bonusTickets = marks100 * Math.max(0, Number(reward100 || 0));
  return {
    totalApprovedAmount: total,
    basicTickets,
    bonusTickets,
    totalTickets: basicTickets + bonusTickets,
  };
}

function buildSequentialTicketNumbers(startNumber, count) {
  const total = Math.max(0, Number(count || 0));
  const start = Math.max(1, Number(startNumber || 1));
  return Array.from({ length: total }, (_item, index) => String(start + index));
}

export async function findEntityRecordByNameAndIdForUpdate(client, entityName, id) {
  const result = await client.query(
    `SELECT *
     FROM entity_records
     WHERE entity_name = $1 AND id = $2
     LIMIT 1
     FOR UPDATE`,
    [entityName, id]
  );
  return result.rows[0] || null;
}

export async function listEntityRecordsForUpdate(client, entityName, filters = {}) {
  const clauses = [`entity_name = $1`];
  const values = [String(entityName || "")];
  let index = values.length + 1;

  for (const [key, value] of Object.entries(filters || {})) {
    clauses.push(`COALESCE(data->>'${String(key)}', '') = $${index}`);
    values.push(String(value ?? ""));
    index += 1;
  }

  const result = await client.query(
    `SELECT *
     FROM entity_records
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at ASC
     FOR UPDATE`,
    values
  );
  return result.rows.map(normalizeRecord);
}

async function listApprovedDepositsForUserCycle(client, userId, cycleId, excludeDepositId = "") {
  const result = await client.query(
    `SELECT *
     FROM entity_records
     WHERE entity_name = 'Deposit'
       AND data->>'user_id' = $1
       AND COALESCE(data->>'cycle_id', '') = $2
       AND COALESCE(data->>'status', '') = 'approved'
       AND id <> $3
     ORDER BY created_at ASC
     FOR UPDATE`,
    [String(userId || ""), String(cycleId || ""), String(excludeDepositId || "")]
  );
  return result.rows.map(normalizeRecord);
}

function sumDepositTicketCount(deposits = []) {
  return deposits.reduce((sum, deposit) => {
    if (Number.isFinite(Number(deposit?.tickets_count))) {
      return sum + Number(deposit.tickets_count || 0);
    }
    if (Array.isArray(deposit?.ticket_numbers)) {
      return sum + deposit.ticket_numbers.length;
    }
    return sum;
  }, 0);
}

async function ensureTicketCounterForCycle(client, cycleId) {
  await client.query(
    `INSERT INTO deposit_ticket_counters (cycle_id, next_ticket_number, updated_at)
     VALUES ($1, 1000000, NOW())
     ON CONFLICT (cycle_id) DO NOTHING`,
    [String(cycleId || "default")]
  );
}

async function lockTicketCounterForCycle(client, cycleId) {
  await ensureTicketCounterForCycle(client, cycleId);
  const result = await client.query(
    `SELECT *
     FROM deposit_ticket_counters
     WHERE cycle_id = $1
     LIMIT 1
     FOR UPDATE`,
    [String(cycleId || "default")]
  );
  return result.rows[0] || null;
}

async function updateTicketCounterForCycle(client, cycleId, nextTicketNumber) {
  await client.query(
    `UPDATE deposit_ticket_counters
     SET next_ticket_number = $2,
         updated_at = NOW()
     WHERE cycle_id = $1`,
    [String(cycleId || "default"), Number(nextTicketNumber || 1000000)]
  );
}

export async function createDailyChestDepositTicketGrant({
  userId,
  openingId,
  chestDayKey,
  rewardSnapshot = {},
  ticketsGranted = 0,
}) {
  const safeTickets = Math.max(0, Math.round(Number(ticketsGranted || 0)));
  if (safeTickets <= 0) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT *
         FROM entity_records
        WHERE entity_name = 'Deposit'
          AND COALESCE(data->>'source_type', '') = 'daily_chest_ticket_reward'
          AND COALESCE(data->>'opening_id', '') = $1
        LIMIT 1
        FOR UPDATE`,
      [String(openingId || "")]
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return normalizeRecord(existing.rows[0]);
    }

    const cycleLocked = await client.query(
      `SELECT *
         FROM entity_records
        WHERE entity_name = 'DepositantDrawCycle'
        ORDER BY
          CASE WHEN COALESCE(data->>'active', 'false') = 'true' THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 1
        FOR UPDATE`
    );
    if (!cycleLocked.rows[0]) {
      const error = new Error("Não há nenhum ciclo do sorteio dos depositantes para gerar bilhetes.");
      error.status = 409;
      throw error;
    }

    const cycle = normalizeRecord(cycleLocked.rows[0]);
    const counter = await lockTicketCounterForCycle(client, cycle.id || "default");
    const ticketStart = Number(counter?.next_ticket_number || 1000000);
    const ticketNumbers = buildSequentialTicketNumbers(ticketStart, safeTickets);
    await updateTicketCounterForCycle(client, cycle.id || "default", ticketStart + safeTickets);

    const now = new Date().toISOString();
    const deposit = await createEntityRecordData(client, "Deposit", {
      user_id: String(userId || ""),
      user_name: "",
      user_email: "",
      platform_name: "Baú Diário",
      user_platform_id: "",
      cycle_id: String(cycle.id || ""),
      proof_image_url: "",
      proof_image_urls: [],
      amount: 0,
      status: "approved",
      ticket_numbers: ticketNumbers,
      tickets_count: safeTickets,
      basic_ticket_count: safeTickets,
      bonus_ticket_count: 0,
      approved_date: now,
      processed_at: now,
      processed_by_user_id: "system:daily_chest",
      processed_by_email: "system:daily_chest",
      source_type: "daily_chest_ticket_reward",
      opening_id: String(openingId || ""),
      chest_day_key: String(chestDayKey || ""),
      ticket_reward_title: String(rewardSnapshot?.title || "Bilhetes do Baú Diário").trim() || "Bilhetes do Baú Diário",
      ticket_rule_snapshot: {
        source: "daily_chest",
        reward_type: String(rewardSnapshot?.rewardType || "tickets_active"),
        reward_amount: safeTickets,
      },
      updated_date: now,
    });

    const processingEvent = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: String(userId || ""),
      event_type: "approved",
      request_id: `daily-chest-ticket:${String(openingId || "")}`,
      previous_status: null,
      next_status: "approved",
      tickets_granted: safeTickets,
      basic_tickets: safeTickets,
      bonus_tickets: 0,
      ticket_start: ticketStart,
      ticket_end: Number(ticketNumbers[ticketNumbers.length - 1] || ticketStart),
      rule_snapshot: {
        source: "daily_chest",
        reward_type: String(rewardSnapshot?.rewardType || "tickets_active"),
      },
      metadata: {
        source: "daily_chest",
        opening_id: String(openingId || ""),
        chest_day_key: String(chestDayKey || ""),
      },
      processed_by_user_id: null,
      processed_by_email: "system:daily_chest",
    });

    const updatedDeposit = await updateEntityRecordData(client, "Deposit", deposit.id, {
      ...deposit,
      processing_event_id: processingEvent?.id || "",
    });

    await client.query("COMMIT");
    return updatedDeposit;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findDepositProcessingEventByRequestId(requestId) {
  if (!requestId) return null;
  const result = await pool.query(
    `SELECT *
     FROM deposit_processing_events
     WHERE request_id = $1
     LIMIT 1`,
    [String(requestId || "")]
  );
  return normalizeDepositProcessingEvent(result.rows[0] || null);
}

async function listDepositProcessingEventsByDepositId(depositId) {
  const result = await pool.query(
    `SELECT *
     FROM deposit_processing_events
     WHERE deposit_id = $1
     ORDER BY created_at ASC`,
    [String(depositId || "")]
  );
  return result.rows.map(normalizeDepositProcessingEvent);
}

function sanitizeDepositProofUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
}

function buildChangedFields(before = {}, after = {}, fields = []) {
  const changes = {};
  for (const field of fields) {
    const previous = before?.[field];
    const next = after?.[field];
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changes[field] = { before: previous, after: next };
    }
  }
  return changes;
}

async function createDepositProcessingEvent(client, payload) {
  const result = await client.query(
    `INSERT INTO deposit_processing_events (
      deposit_id,
      user_id,
      event_type,
      request_id,
      previous_status,
      next_status,
      tickets_granted,
      basic_tickets,
      bonus_tickets,
      ticket_start,
      ticket_end,
      rule_snapshot,
      metadata,
      processed_by_user_id,
      processed_by_email
    )
     VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15
    )
     RETURNING *`,
    [
      String(payload.deposit_id || ""),
      payload.user_id || null,
      String(payload.event_type || ""),
      payload.request_id ? String(payload.request_id) : null,
      payload.previous_status || null,
      payload.next_status || null,
      Math.max(0, Number(payload.tickets_granted || 0)),
      Math.max(0, Number(payload.basic_tickets || 0)),
      Math.max(0, Number(payload.bonus_tickets || 0)),
      payload.ticket_start === null || payload.ticket_start === undefined ? null : Number(payload.ticket_start),
      payload.ticket_end === null || payload.ticket_end === undefined ? null : Number(payload.ticket_end),
      JSON.stringify(payload.rule_snapshot || {}),
      JSON.stringify(payload.metadata || {}),
      payload.processed_by_user_id || null,
      payload.processed_by_email || null,
    ]
  );
  return normalizeDepositProcessingEvent(result.rows[0] || null);
}

export async function createEntityRecordData(client, entityName, data) {
  const result = await client.query(
    `INSERT INTO entity_records (entity_name, data)
     VALUES ($1, $2::jsonb)
     RETURNING *`,
    [String(entityName || ""), JSON.stringify(data || {})]
  );
  return normalizeRecord(result.rows[0] || null);
}

async function findUserDomainRegistryForUpdate(client, domain, scopeKey, userId) {
  const result = await client.query(
    `SELECT *
     FROM user_domain_registry
     WHERE domain = $1 AND scope_key = $2 AND user_id = $3
     LIMIT 1
     FOR UPDATE`,
    [String(domain || ""), String(scopeKey || ""), userId]
  );
  return result.rows[0] || null;
}

async function upsertUserDomainRegistry(client, { domain, scopeKey, userId, recordEntityName = null, recordId = null, metadata = {} }) {
  const result = await client.query(
    `INSERT INTO user_domain_registry (
      domain,
      scope_key,
      user_id,
      record_entity_name,
      record_id,
      metadata,
      updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (domain, scope_key, user_id)
     DO UPDATE SET
       record_entity_name = COALESCE(EXCLUDED.record_entity_name, user_domain_registry.record_entity_name),
       record_id = COALESCE(EXCLUDED.record_id, user_domain_registry.record_id),
       metadata = CASE
         WHEN EXCLUDED.metadata = '{}'::jsonb THEN user_domain_registry.metadata
         ELSE EXCLUDED.metadata
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      String(domain || ""),
      String(scopeKey || ""),
      userId,
      recordEntityName,
      recordId,
      JSON.stringify(metadata || {}),
    ]
  );
  return result.rows[0] || null;
}

export async function findEngagementProcessingEventByRequestId(requestId) {
  if (!requestId) return null;
  const result = await pool.query(
    `SELECT *
     FROM engagement_processing_events
     WHERE request_id = $1
     LIMIT 1`,
    [String(requestId || "")]
  );
  return normalizeEngagementProcessingEvent(result.rows[0] || null);
}

export async function createEngagementProcessingEvent(client, payload) {
  const result = await client.query(
    `INSERT INTO engagement_processing_events (
      domain,
      action,
      request_id,
      user_id,
      entity_name,
      entity_id,
      status,
      metadata,
      processed_by_user_id,
      processed_by_email
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      String(payload.domain || ""),
      String(payload.action || ""),
      payload.request_id ? String(payload.request_id) : null,
      payload.user_id || null,
      payload.entity_name || null,
      payload.entity_id || null,
      String(payload.status || "accepted"),
      JSON.stringify(payload.metadata || {}),
      payload.processed_by_user_id || null,
      payload.processed_by_email || null,
    ]
  );
  return normalizeEngagementProcessingEvent(result.rows[0] || null);
}

export async function updateEntityRecordData(client, entityName, id, data) {
  const result = await client.query(
    `UPDATE entity_records
     SET data = $1::jsonb, updated_at = NOW()
     WHERE entity_name = $2 AND id = $3
     RETURNING *`,
    [JSON.stringify(data || {}), String(entityName || ""), String(id || "")]
  );
  return normalizeRecord(result.rows[0] || null);
}

export async function createDepositRecord({
  userId,
  userEmail,
  userName,
  platformName,
  userPlatformId,
  amount,
  proofImageUrl,
  proofImageUrls,
  cycleId,
  requestId,
}) {
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const existingDeposit = await getEntityById("Deposit", existingEvent.deposit_id);
      if (existingDeposit) {
        return {
          deposit: existingDeposit,
          idempotent: true,
          processing_event: existingEvent,
        };
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (normalizedRequestId) {
      const existing = await client.query(
        `SELECT *
         FROM deposit_processing_events
         WHERE request_id = $1
         LIMIT 1
         FOR UPDATE`,
        [normalizedRequestId]
      );
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        const event = normalizeDepositProcessingEvent(existing.rows[0]);
        const deposit = await getEntityById("Deposit", event.deposit_id);
        return { deposit, idempotent: true, processing_event: event };
      }
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      user_email: String(userEmail || ""),
      user_name: String(userName || ""),
      user_platform_id: String(userPlatformId || ""),
      platform_name: String(platformName || ""),
      amount: Math.max(0, Number(amount || 0)),
      proof_image_url: String(proofImageUrl || ""),
      proof_image_urls: Array.isArray(proofImageUrls) ? proofImageUrls.filter(Boolean) : [],
      status: "pending",
      ticket_numbers: [],
      tickets_count: 0,
      basic_ticket_count: 0,
      bonus_ticket_count: 0,
      cycle_id: String(cycleId || ""),
      created_date: now,
      updated_date: now,
      created_by_user_id: userId,
      submitted_request_id: normalizedRequestId || "",
      processed_at: null,
      processed_by_user_id: "",
      processed_by_email: "",
      approved_date: null,
      rejected_date: null,
      processing_event_id: "",
      ticket_rule_snapshot: {},
    };

    const result = await client.query(
      `INSERT INTO entity_records (entity_name, data)
       VALUES ('Deposit', $1::jsonb)
       RETURNING *`,
      [JSON.stringify(payload)]
    );
    const deposit = normalizeRecord(result.rows[0]);
    const event = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: userId,
      event_type: "created",
      request_id: normalizedRequestId || null,
      previous_status: null,
      next_status: "pending",
      metadata: {
        cycle_id: payload.cycle_id,
        amount: payload.amount,
      },
      processed_by_user_id: userId,
      processed_by_email: userEmail,
    });

    await client.query("COMMIT");
    return { deposit: { ...deposit, processing_event_id: event?.id || "" }, idempotent: false, processing_event: event };
  } catch (error) {
    await client.query("ROLLBACK");
    if (normalizedRequestId && error?.code === "23505") {
      const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
      if (existingEvent?.deposit_id) {
        const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
        return { deposit, idempotent: true, processing_event: existingEvent };
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listDepositsByUserId(userId) {
  const result = await pool.query(
    `SELECT *
     FROM entity_records
     WHERE entity_name = 'Deposit'
       AND data->>'user_id' = $1
     ORDER BY created_at DESC`,
    [String(userId || "")]
  );
  return result.rows.map(normalizeRecord);
}

export async function listAdminDeposits({ status = "", cycleId = "", limit } = {}) {
  const result = await pool.query(
    `SELECT *
     FROM entity_records
     WHERE entity_name = 'Deposit'
     ORDER BY created_at DESC`
  );
  let rows = result.rows.map(normalizeRecord);
  if (status) {
    rows = rows.filter((item) => String(item.status || "") === String(status));
  }
  if (cycleId) {
    rows = rows.filter((item) => String(item.cycle_id || "") === String(cycleId));
  }
  return applyLimit(rows, limit);
}

export async function listDepositCycleLeaderboard({ cycleId = "", limit = 10 } = {}) {
  const values = [];
  const where = [
    "entity_name = 'Deposit'",
    "data->>'status' = 'approved'",
    "COALESCE(data->>'user_id', '') <> ''",
  ];

  if (cycleId) {
    values.push(String(cycleId));
    where.push(`data->>'cycle_id' = $${values.length}`);
  }

  values.push(Number(limit) > 0 ? Number(limit) : 10);

  const result = await pool.query(
    `SELECT
       data->>'user_id' AS user_id,
       MAX(NULLIF(data->>'user_name', '')) AS user_name,
       COALESCE(SUM((data->>'amount')::numeric), 0) AS total_amount,
       COUNT(*)::int AS deposits_count,
       COALESCE(SUM(COALESCE((data->>'tickets_count')::numeric, 0)), 0)::int AS tickets_count
     FROM entity_records
     WHERE ${where.join(" AND ")}
     GROUP BY data->>'user_id'
     ORDER BY total_amount DESC, deposits_count DESC, user_id ASC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map((row) => ({
    user_id: String(row.user_id || ""),
    user_name: String(row.user_name || ""),
    total: Number(row.total_amount || 0),
    deposits_count: Number(row.deposits_count || 0),
    tickets_count: Number(row.tickets_count || 0),
  }));
}

export async function getDepositAdminHistory(depositId) {
  return listDepositProcessingEventsByDepositId(depositId);
}

export async function updateDepositAdminRecord({
  depositId,
  adminUserId,
  adminEmail,
  requestId = "",
  reason = "",
  patch = {},
}) {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    const error = new Error("Motivo obrigatório para editar depósito.");
    error.status = 400;
    throw error;
  }

  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
      return { deposit, processing_event: existingEvent, idempotent: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);
    const nextDeposit = { ...deposit };
    const editableFields = ["platform_name", "user_platform_id", "proof_image_url", "proof_image_urls"];

    if ("platform_name" in patch) nextDeposit.platform_name = String(patch.platform_name || "").trim();
    if ("user_platform_id" in patch) nextDeposit.user_platform_id = String(patch.user_platform_id || "").trim();
    if ("proof_image_url" in patch) nextDeposit.proof_image_url = String(patch.proof_image_url || "").trim();
    if ("proof_image_urls" in patch) nextDeposit.proof_image_urls = sanitizeDepositProofUrls(patch.proof_image_urls);

    if ("amount" in patch) {
      if (String(deposit.status || "") === "approved") {
        const error = new Error("Não é permitido alterar o valor de um depósito já aprovado.");
        error.status = 409;
        throw error;
      }
      const amount = Number(patch.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        const error = new Error("Valor inválido para edição.");
        error.status = 400;
        throw error;
      }
      nextDeposit.amount = amount;
      editableFields.push("amount");
    }

    const changes = buildChangedFields(deposit, nextDeposit, editableFields);
    if (Object.keys(changes).length === 0) {
      await client.query("COMMIT");
      return { deposit, processing_event: null, idempotent: true };
    }

    nextDeposit.updated_date = new Date().toISOString();
    const updated = await updateEntityRecordData(client, "Deposit", deposit.id, nextDeposit);
    const event = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: deposit.user_id,
      event_type: "edited",
      request_id: normalizedRequestId || null,
      previous_status: deposit.status || null,
      next_status: updated.status || null,
      tickets_granted: Number(updated.tickets_count || 0),
      basic_tickets: Number(updated.basic_ticket_count || 0),
      bonus_tickets: Number(updated.bonus_ticket_count || 0),
      rule_snapshot: updated.ticket_rule_snapshot || {},
      metadata: {
        reason: normalizedReason,
        changes,
      },
      processed_by_user_id: adminUserId,
      processed_by_email: adminEmail,
    });

    await client.query("COMMIT");
    return { deposit: updated, processing_event: event, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function adjustDepositTicketsAdmin({
  depositId,
  adminUserId,
  adminEmail,
  requestId = "",
  reason = "",
  adjustment = 0,
}) {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    const error = new Error("Motivo obrigatório para ajustar bilhetes.");
    error.status = 400;
    throw error;
  }

  const delta = Number(adjustment);
  if (!Number.isInteger(delta) || delta === 0) {
    const error = new Error("O ajuste de bilhetes deve ser um inteiro diferente de zero.");
    error.status = 400;
    throw error;
  }

  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
      return { deposit, processing_event: existingEvent, idempotent: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);
    if (String(deposit.status || "") !== "approved") {
      const error = new Error("Ajuste manual de bilhetes só é permitido em depósitos aprovados.");
      error.status = 409;
      throw error;
    }

    const currentTickets = Array.isArray(deposit.ticket_numbers) ? [...deposit.ticket_numbers] : [];
    const beforeCount = Number(deposit.tickets_count || currentTickets.length || 0);
    const afterCount = beforeCount + delta;
    if (afterCount < 0) {
      const error = new Error("O ajuste deixaria a quantidade de bilhetes negativa.");
      error.status = 409;
      throw error;
    }

    let nextTicketNumbers = currentTickets;
    let ticketStart = null;
    let ticketEnd = null;
    let removedTickets = [];

    if (delta > 0) {
      const counter = await lockTicketCounterForCycle(client, deposit.cycle_id || "default");
      ticketStart = Number(counter?.next_ticket_number || 1000000);
      const addedTickets = buildSequentialTicketNumbers(ticketStart, delta);
      nextTicketNumbers = [...currentTickets, ...addedTickets];
      ticketEnd = Number(addedTickets[addedTickets.length - 1] || ticketStart);
      await updateTicketCounterForCycle(client, deposit.cycle_id || "default", Number(counter.next_ticket_number) + delta);
    } else {
      removedTickets = currentTickets.slice(delta);
      nextTicketNumbers = currentTickets.slice(0, currentTickets.length + delta);
    }

    const nextDeposit = {
      ...deposit,
      ticket_numbers: nextTicketNumbers,
      tickets_count: afterCount,
      manual_ticket_adjustment_count: Number(deposit.manual_ticket_adjustment_count || 0) + delta,
      updated_date: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      processed_by_user_id: String(adminUserId || ""),
      processed_by_email: String(adminEmail || ""),
    };

    const updated = await updateEntityRecordData(client, "Deposit", deposit.id, nextDeposit);
    const event = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: deposit.user_id,
      event_type: "tickets_adjusted",
      request_id: normalizedRequestId || null,
      previous_status: deposit.status || null,
      next_status: updated.status || null,
      tickets_granted: Number(updated.tickets_count || 0),
      basic_tickets: Number(updated.basic_ticket_count || 0),
      bonus_tickets: Number(updated.bonus_ticket_count || 0),
      ticket_start: ticketStart,
      ticket_end: ticketEnd,
      rule_snapshot: updated.ticket_rule_snapshot || {},
      metadata: {
        reason: normalizedReason,
        adjustment: delta,
        previous_count: beforeCount,
        final_count: afterCount,
        removed_tickets: removedTickets,
      },
      processed_by_user_id: adminUserId,
      processed_by_email: adminEmail,
    });

    await client.query("COMMIT");
    return { deposit: updated, processing_event: event, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function invalidateDepositAdmin({
  depositId,
  adminUserId,
  adminEmail,
  requestId = "",
  reason = "",
}) {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    const error = new Error("Motivo obrigatório para invalidar depósito.");
    error.status = 400;
    throw error;
  }

  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
      return { deposit, processing_event: existingEvent, idempotent: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);
    if (String(deposit.status || "") === "invalidated") {
      const existingEvent = await client.query(
        `SELECT *
         FROM deposit_processing_events
         WHERE deposit_id = $1 AND event_type = 'invalidated'
         ORDER BY created_at DESC
         LIMIT 1`,
        [String(depositId || "")]
      );
      await client.query("COMMIT");
      return {
        deposit,
        processing_event: normalizeDepositProcessingEvent(existingEvent.rows[0] || null),
        idempotent: true,
      };
    }

    const nextDeposit = {
      ...deposit,
      status: "invalidated",
      invalidated_at: new Date().toISOString(),
      invalidated_by_user_id: String(adminUserId || ""),
      invalidated_by_email: String(adminEmail || ""),
      invalidation_reason: normalizedReason,
      processed_at: new Date().toISOString(),
      processed_by_user_id: String(adminUserId || ""),
      processed_by_email: String(adminEmail || ""),
      updated_date: new Date().toISOString(),
    };

    const updated = await updateEntityRecordData(client, "Deposit", deposit.id, nextDeposit);
    const event = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: deposit.user_id,
      event_type: "invalidated",
      request_id: normalizedRequestId || null,
      previous_status: deposit.status || null,
      next_status: "invalidated",
      tickets_granted: Number(deposit.tickets_count || 0),
      basic_tickets: Number(deposit.basic_ticket_count || 0),
      bonus_tickets: Number(deposit.bonus_ticket_count || 0),
      rule_snapshot: deposit.ticket_rule_snapshot || {},
      metadata: {
        reason: normalizedReason,
        previous_tickets: Number(deposit.tickets_count || 0),
      },
      processed_by_user_id: adminUserId,
      processed_by_email: adminEmail,
    });

    await client.query("COMMIT");
    return { deposit: updated, processing_event: event, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteDepositAdmin({
  depositId,
  adminUserId,
  adminEmail,
  requestId = "",
  reason = "",
}) {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    const error = new Error("Motivo obrigatório para excluir depósito.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);

    await client.query("DELETE FROM deposit_processing_events WHERE deposit_id = $1", [String(deposit.id || "")]);
    await client.query(
      "DELETE FROM daily_chest_bonus_grants WHERE source_type = 'deposit_approved' AND source_id = $1",
      [String(deposit.id || "")]
    );
    await client.query(
      "DELETE FROM entity_records WHERE entity_name = 'Deposit' AND id = $1",
      [String(deposit.id || "")]
    );

    await client.query("COMMIT");
    return {
      deposit: {
        ...deposit,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: String(adminUserId || ""),
        deleted_by_email: String(adminEmail || ""),
        deletion_reason: normalizedReason,
        request_id: String(requestId || "").trim(),
      },
      idempotent: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function approveDepositRecord({ depositId, adminUserId, adminEmail, requestId = "" }) {
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
      return { deposit, processing_event: existingEvent, idempotent: true };
    }
  }

  const settings = await loadDepositTicketRuleSettings();
  const client = await pool.connect();
  let approvedDeposit = null;
  let processingEvent = null;
  let shouldGrantDailyChestBonus = false;
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);
    const currentStatus = String(deposit.status || "pending");

    if (currentStatus === "approved") {
      const existingApproved = await client.query(
        `SELECT *
         FROM deposit_processing_events
         WHERE deposit_id = $1 AND event_type = 'approved'
         LIMIT 1`,
        [String(depositId || "")]
      );
      await client.query("COMMIT");
      return {
        deposit,
        processing_event: normalizeDepositProcessingEvent(existingApproved.rows[0] || null),
        idempotent: true,
      };
    }

    if (currentStatus !== "pending") {
      const error = new Error("Deposit is not eligible for approval");
      error.status = 409;
      throw error;
    }

    const approvedDeposits = await listApprovedDepositsForUserCycle(
      client,
      deposit.user_id,
      deposit.cycle_id,
      deposit.id
    );
    const totalApprovedBefore = approvedDeposits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const breakdownBefore = computeDepositTicketBreakdown(totalApprovedBefore, settings.reward50, settings.reward100);
    const totalApprovedAfter = totalApprovedBefore + Number(deposit.amount || 0);
    const breakdownAfter = computeDepositTicketBreakdown(totalApprovedAfter, settings.reward50, settings.reward100);
    const basicTicketsGranted = Math.max(0, breakdownAfter.basicTickets - breakdownBefore.basicTickets);
    const bonusTicketsGranted = Math.max(0, breakdownAfter.bonusTickets - breakdownBefore.bonusTickets);
    const ticketsGranted = basicTicketsGranted + bonusTicketsGranted;

    const counter = await lockTicketCounterForCycle(client, deposit.cycle_id || "default");
    const ticketStart = ticketsGranted > 0 ? Number(counter?.next_ticket_number || 1000000) : null;
    const ticketNumbers = ticketsGranted > 0 ? buildSequentialTicketNumbers(ticketStart, ticketsGranted) : [];
    const ticketEnd = ticketNumbers.length > 0 ? Number(ticketNumbers[ticketNumbers.length - 1]) : null;
    if (ticketsGranted > 0) {
      await updateTicketCounterForCycle(client, deposit.cycle_id || "default", Number(counter.next_ticket_number) + ticketsGranted);
    }

    const now = new Date().toISOString();
    const nextDeposit = {
      ...deposit,
      status: "approved",
      ticket_numbers: ticketNumbers,
      tickets_count: ticketsGranted,
      basic_ticket_count: basicTicketsGranted,
      bonus_ticket_count: bonusTicketsGranted,
      approved_date: deposit.approved_date || now,
      rejected_date: null,
      processed_at: now,
      processed_by_user_id: String(adminUserId || ""),
      processed_by_email: String(adminEmail || ""),
      ticket_rule_snapshot: {
        reward50: settings.reward50,
        reward100: settings.reward100,
        total_approved_before: totalApprovedBefore,
        total_approved_after: totalApprovedAfter,
        total_tickets_before: breakdownBefore.totalTickets,
        total_tickets_after: breakdownAfter.totalTickets,
      },
      updated_date: now,
    };

    processingEvent = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: deposit.user_id,
      event_type: "approved",
      request_id: normalizedRequestId || null,
      previous_status: currentStatus,
      next_status: "approved",
      tickets_granted: ticketsGranted,
      basic_tickets: basicTicketsGranted,
      bonus_tickets: bonusTicketsGranted,
      ticket_start: ticketStart,
      ticket_end: ticketEnd,
      rule_snapshot: nextDeposit.ticket_rule_snapshot,
      metadata: {
        cycle_id: deposit.cycle_id || "",
        amount: Number(deposit.amount || 0),
      },
      processed_by_user_id: adminUserId,
      processed_by_email: adminEmail,
    });

    nextDeposit.processing_event_id = processingEvent?.id || "";
    approvedDeposit = await updateEntityRecordData(client, "Deposit", deposit.id, nextDeposit);
    shouldGrantDailyChestBonus = true;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (shouldGrantDailyChestBonus && approvedDeposit) {
    await maybeGrantDailyChestBonusForDeposit(approvedDeposit);
  }

  return {
    deposit: approvedDeposit,
    processing_event: processingEvent,
    idempotent: false,
  };
}

export async function rejectDepositRecord({ depositId, adminUserId, adminEmail, requestId = "", reason = "" }) {
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findDepositProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.deposit_id) {
      const deposit = await getEntityById("Deposit", existingEvent.deposit_id);
      return { deposit, processing_event: existingEvent, idempotent: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedRecord = await findEntityRecordByNameAndIdForUpdate(client, "Deposit", depositId);
    if (!lockedRecord) {
      await client.query("ROLLBACK");
      return null;
    }

    const deposit = getEntityRecordData(lockedRecord);
    const currentStatus = String(deposit.status || "pending");

    if (currentStatus === "rejected") {
      const existingRejected = await client.query(
        `SELECT *
         FROM deposit_processing_events
         WHERE deposit_id = $1 AND event_type = 'rejected'
         LIMIT 1`,
        [String(depositId || "")]
      );
      await client.query("COMMIT");
      return {
        deposit,
        processing_event: normalizeDepositProcessingEvent(existingRejected.rows[0] || null),
        idempotent: true,
      };
    }

    if (currentStatus !== "pending") {
      const error = new Error("Deposit is not eligible for rejection");
      error.status = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const event = await createDepositProcessingEvent(client, {
      deposit_id: deposit.id,
      user_id: deposit.user_id,
      event_type: "rejected",
      request_id: normalizedRequestId || null,
      previous_status: currentStatus,
      next_status: "rejected",
      metadata: {
        reason: String(reason || "").trim(),
        cycle_id: deposit.cycle_id || "",
      },
      processed_by_user_id: adminUserId,
      processed_by_email: adminEmail,
    });

    const nextDeposit = {
      ...deposit,
      status: "rejected",
      processed_at: now,
      processed_by_user_id: String(adminUserId || ""),
      processed_by_email: String(adminEmail || ""),
      rejected_date: now,
      approved_date: null,
      ticket_numbers: [],
      tickets_count: 0,
      basic_ticket_count: 0,
      bonus_ticket_count: 0,
      rejection_reason: String(reason || "").trim(),
      processing_event_id: event?.id || "",
      updated_date: now,
    };

    const rejected = await updateEntityRecordData(client, "Deposit", deposit.id, nextDeposit);
    await client.query("COMMIT");
    return { deposit: rejected, processing_event: event, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeParticipationUserSnapshot(user) {
  return {
    user_id: user.id,
    user_email: String(user.email || ""),
    user_name: String(user.full_name || user.nick || ""),
    user_nick: String(user.nick || user.full_name || ""),
    user_avatar: String(user.avatar_emoji || ""),
    user_phone: String(user.phone || ""),
    user_platform_id: String(user.platform_id || ""),
    user_profile_image_url:
      user.profile_image_status === "approved" && user.profile_image_url
        ? String(user.profile_image_url)
        : "",
  };
}

async function findActiveRaffleForUpdate(client, entityName, raffleId) {
  const locked = await findEntityRecordByNameAndIdForUpdate(client, entityName, raffleId);
  if (!locked) throw createHttpError("Evento não encontrado.", 404);
  const raffle = getEntityRecordData(locked);
  if (!raffle || String(raffle.active) !== "true" || String(raffle.ended) === "true") {
    throw createHttpError("Evento indisponível.", 409);
  }
  return raffle;
}

function buildParticipationRegistryKey(domainPrefix, raffleId) {
  return `${String(domainPrefix || "")}:${String(raffleId || "")}`;
}

async function createOrReuseParticipation({
  domain,
  requestId,
  raffleEntityName,
  participantEntityName,
  raffleId,
  userId,
  buildNewData,
  updateExistingData,
  eventAction,
}) {
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findEngagementProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.entity_name === participantEntityName && existingEvent?.entity_id) {
      const existingParticipation = await getEntityById(participantEntityName, existingEvent.entity_id);
      if (existingParticipation) {
        return {
          participation: existingParticipation,
          raffle: await getEntityById(raffleEntityName, raffleId),
          processing_event: existingEvent,
          idempotent: true,
        };
      }
    }
  }

  const user = await findUserById(userId);
  if (!user) throw createHttpError("Usuário não encontrado.", 404);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const raffle = await findActiveRaffleForUpdate(client, raffleEntityName, raffleId);
    const registryScopeKey = buildParticipationRegistryKey(domain, raffleId);
    const registry = await upsertUserDomainRegistry(client, {
      domain,
      scopeKey: registryScopeKey,
      userId,
      metadata: { raffle_id: raffleId, participant_entity_name: participantEntityName },
    });

    let participation = null;
    if (registry?.record_id) {
      const lockedExisting = await findEntityRecordByNameAndIdForUpdate(client, participantEntityName, registry.record_id);
      participation = getEntityRecordData(lockedExisting);
    }

    let created = false;
    const now = new Date().toISOString();
    if (!participation) {
      participation = await createEntityRecordData(client, participantEntityName, {
        ...normalizeParticipationUserSnapshot(user),
        ...buildNewData({ raffle, user, now }),
        created_date: now,
        updated_date: now,
      });
      await upsertUserDomainRegistry(client, {
        domain,
        scopeKey: registryScopeKey,
        userId,
        recordEntityName: participantEntityName,
        recordId: participation.id,
        metadata: { raffle_id: raffleId, participant_entity_name: participantEntityName },
      });
      created = true;
    } else if (typeof updateExistingData === "function") {
      const nextData = {
        ...participation,
        ...updateExistingData({ current: participation, raffle, user, now }),
        id: participation.id,
        created_date: participation.created_date,
        updated_date: now,
      };
      participation = await updateEntityRecordData(client, participantEntityName, participation.id, nextData);
    }

    const processingEvent = await createEngagementProcessingEvent(client, {
      domain,
      action: eventAction,
      request_id: normalizedRequestId || null,
      user_id: userId,
      entity_name: participantEntityName,
      entity_id: participation.id,
      status: created ? "created" : "updated",
      metadata: {
        raffle_id: raffleId,
      },
    });

    await client.query("COMMIT");
    return {
      participation,
      raffle,
      processing_event: processingEvent,
      idempotent: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function joinLiveDraw({ raffleId, userId, requestId = "" }) {
  return createOrReuseParticipation({
    domain: "live_draw_join",
    requestId,
    raffleEntityName: "LiveDrawRaffle",
    participantEntityName: "LiveDrawParticipant",
    raffleId,
    userId,
    eventAction: "join",
    buildNewData: ({ raffle }) => ({
      raffle_id: raffle.id,
      won: false,
      validated: false,
      validation_status: "pending",
      claimed_at: null,
    }),
  });
}

export async function joinGameCall({ raffleId, userId, requestId = "" }) {
  return createOrReuseParticipation({
    domain: "game_call_participation",
    requestId,
    raffleEntityName: "GameCallRaffle",
    participantEntityName: "GameCallParticipant",
    raffleId,
    userId,
    eventAction: "join",
    buildNewData: ({ raffle }) => ({
      raffle_id: raffle.id,
      game_call: "",
      attempts: 0,
      won: false,
      validated: false,
      validation_status: "pending",
      claimed_at: null,
    }),
  });
}

export async function submitGameCall({ raffleId, userId, gameCall, requestId = "" }) {
  const normalizedGameCall = String(gameCall || "").trim().slice(0, 140);
  if (!normalizedGameCall) {
    throw createHttpError("Digite a call do jogo.", 400);
  }

  return createOrReuseParticipation({
    domain: "game_call_participation",
    requestId,
    raffleEntityName: "GameCallRaffle",
    participantEntityName: "GameCallParticipant",
    raffleId,
    userId,
    eventAction: "submit",
    buildNewData: ({ raffle }) => ({
      raffle_id: raffle.id,
      game_call: normalizedGameCall,
      attempts: 0,
      won: false,
      validated: false,
      validation_status: "pending",
      claimed_at: null,
    }),
    updateExistingData: ({ current }) => ({
      game_call: normalizedGameCall,
      validation_status: current.validation_status === "invalidated" ? "pending" : current.validation_status || "pending",
    }),
  });
}

export async function joinInstantRaffle({ raffleId, userId, platformId = "", requestId = "" }) {
  return createOrReuseParticipation({
    domain: "instant_raffle_participation",
    requestId,
    raffleEntityName: "InstantRaffle",
    participantEntityName: "InstantRaffleParticipant",
    raffleId,
    userId,
    eventAction: "join",
    buildNewData: ({ raffle, user }) => {
      if (raffle.winners_drawn) {
        throw createHttpError("Este sorteio já foi encerrado.", 409);
      }
      const normalizedPlatformId = String(platformId || user?.platform_id || "").trim().slice(0, 120);
      if (!normalizedPlatformId) {
        throw createHttpError("ID da plataforma obrigatório.", 400);
      }
      return {
        raffle_id: raffle.id,
        platform_id: normalizedPlatformId,
        user_email: String(user.email || ""),
        user_name: String(user.full_name || user.nick || ""),
        user_nick: String(user.nick || ""),
        user_avatar: String(user.avatar_emoji || ""),
        won: false,
        prize_claimed: false,
        claimed_date: null,
      };
    },
    updateExistingData: ({ current, raffle }) => {
      if (raffle.winners_drawn) {
        throw createHttpError("Este sorteio já foi encerrado.", 409);
      }
      if (current.prize_claimed) {
        throw createHttpError("Este sorteio já foi encerrado para você.", 409);
      }
      return {};
    },
  });
}

export async function dismissInstantRaffle({ raffleId, userId, requestId = "" }) {
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findEngagementProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.entity_name === "InstantRaffleParticipant" && existingEvent?.entity_id) {
      const existingParticipation = await getEntityById("InstantRaffleParticipant", existingEvent.entity_id);
      if (existingParticipation) {
        return { participation: existingParticipation, processing_event: existingEvent, idempotent: true };
      }
    }
  }

  const user = await findUserById(userId);
  if (!user) throw createHttpError("Usuário não encontrado.", 404);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const raffle = await findActiveRaffleForUpdate(client, "InstantRaffle", raffleId);
    if (!raffle.winners_drawn) {
      throw createHttpError("O sorteio ainda não foi encerrado.", 409);
    }

    const registry = await upsertUserDomainRegistry(client, {
      domain: "instant_raffle_participation",
      scopeKey: buildParticipationRegistryKey("instant_raffle_participation", raffleId),
      userId,
      metadata: { raffle_id: raffleId, participant_entity_name: "InstantRaffleParticipant" },
    });

    let participation = null;
    if (registry?.record_id) {
      const lockedExisting = await findEntityRecordByNameAndIdForUpdate(client, "InstantRaffleParticipant", registry.record_id);
      participation = getEntityRecordData(lockedExisting);
    }

    const now = new Date().toISOString();
    if (!participation) {
      participation = await createEntityRecordData(client, "InstantRaffleParticipant", {
        ...normalizeParticipationUserSnapshot(user),
        raffle_id: raffle.id,
        platform_id: "",
        won: false,
        prize_claimed: true,
        claimed_date: now,
        dismissed_at: now,
        created_date: now,
        updated_date: now,
      });
      await upsertUserDomainRegistry(client, {
        domain: "instant_raffle_participation",
        scopeKey: buildParticipationRegistryKey("instant_raffle_participation", raffleId),
        userId,
        recordEntityName: "InstantRaffleParticipant",
        recordId: participation.id,
        metadata: { raffle_id: raffleId, participant_entity_name: "InstantRaffleParticipant" },
      });
    } else if (!participation.prize_claimed) {
      participation = await updateEntityRecordData(client, "InstantRaffleParticipant", participation.id, {
        ...participation,
        prize_claimed: true,
        dismissed_at: now,
        updated_date: now,
      });
    }

    const processingEvent = await createEngagementProcessingEvent(client, {
      domain: "instant_raffle_participation",
      action: "dismiss",
      request_id: normalizedRequestId || null,
      user_id: userId,
      entity_name: "InstantRaffleParticipant",
      entity_id: participation.id,
      status: "accepted",
      metadata: { raffle_id: raffleId },
    });

    await client.query("COMMIT");
    return { participation, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const WINNING_KIND_CONFIG = {
  "live-draw": {
    entityName: "LiveDrawParticipant",
    ownedByField: "user_id",
    claim(current, now) {
      return {
        ...current,
        claimed_at: current.claimed_at || now,
        updated_date: now,
      };
    },
    dismiss(current, now) {
      return {
        ...current,
        dismissed_at: current.dismissed_at || now,
        updated_date: now,
      };
    },
  },
  "deposit-draw": {
    entityName: "DepositantDrawWinner",
    ownedByField: "user_id",
    claim(current, now) {
      return {
        ...current,
        claimed_at: current.claimed_at || now,
        updated_date: now,
      };
    },
    dismiss(current, now) {
      return {
        ...current,
        dismissed_at: current.dismissed_at || now,
        updated_date: now,
      };
    },
  },
  "game-call": {
    entityName: "GameCallParticipant",
    ownedByField: "user_id",
    claim(current, now) {
      return {
        ...current,
        claimed_at: current.claimed_at || now,
        won: false,
        updated_date: now,
      };
    },
    dismiss(current, now) {
      return {
        ...current,
        dismissed_at: current.dismissed_at || now,
        won: false,
        updated_date: now,
      };
    },
  },
  "instant-raffle": {
    entityName: "InstantRaffleParticipant",
    ownedByField: "user_id",
    claim(current, now) {
      return {
        ...current,
        prize_claimed: true,
        claimed_date: current.claimed_date || now,
        updated_date: now,
      };
    },
    dismiss(current, now) {
      return {
        ...current,
        prize_claimed: true,
        dismissed_at: current.dismissed_at || now,
        updated_date: now,
      };
    },
  },
};

async function processWinningAction({ kind, recordId, userId, requestId = "", action }) {
  const config = WINNING_KIND_CONFIG[String(kind || "")];
  if (!config) throw createHttpError("Tipo de premiação inválido.", 400);

  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findEngagementProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.entity_name === config.entityName && existingEvent?.entity_id === String(recordId || "")) {
      const existingRecord = await getEntityById(config.entityName, recordId);
      if (existingRecord) {
        return { record: existingRecord, processing_event: existingEvent, idempotent: true };
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await findEntityRecordByNameAndIdForUpdate(client, config.entityName, recordId);
    if (!locked) {
      await client.query("ROLLBACK");
      return null;
    }

    const current = getEntityRecordData(locked);
    if (String(current[config.ownedByField] || "") !== String(userId || "")) {
      throw createHttpError("Você não pode alterar esta premiação.", 403);
    }

    const alreadyProcessed =
      action === "claim"
        ? Boolean(current.claimed_at || current.claimed_date || current.prize_claimed)
        : Boolean(current.dismissed_at || (config.entityName === "InstantRaffleParticipant" && current.prize_claimed));

    if (alreadyProcessed) {
      const existingAction = await client.query(
        `SELECT *
         FROM engagement_processing_events
         WHERE domain = 'winning'
           AND action = $1
           AND entity_name = $2
           AND entity_id = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [action, config.entityName, String(recordId || "")]
      );
      await client.query("COMMIT");
      return {
        record: current,
        processing_event: normalizeEngagementProcessingEvent(existingAction.rows[0] || null),
        idempotent: true,
      };
    }

    const now = new Date().toISOString();
    const nextRecord =
      action === "claim" ? config.claim(current, now) : config.dismiss(current, now);
    const updated = await updateEntityRecordData(client, config.entityName, recordId, nextRecord);
    const processingEvent = await createEngagementProcessingEvent(client, {
      domain: "winning",
      action,
      request_id: normalizedRequestId || null,
      user_id: userId,
      entity_name: config.entityName,
      entity_id: recordId,
      status: "accepted",
      metadata: {
        kind,
        previous_state: {
          claimed_at: current.claimed_at || current.claimed_date || null,
          prize_claimed: Boolean(current.prize_claimed),
          dismissed_at: current.dismissed_at || null,
          won: current.won,
        },
        next_state: {
          claimed_at: updated.claimed_at || updated.claimed_date || null,
          prize_claimed: Boolean(updated.prize_claimed),
          dismissed_at: updated.dismissed_at || null,
          won: updated.won,
        },
      },
    });

    await client.query("COMMIT");
    return { record: updated, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function claimWinning({ kind, recordId, userId, requestId = "" }) {
  return processWinningAction({ kind, recordId, userId, requestId, action: "claim" });
}

export async function dismissWinning({ kind, recordId, userId, requestId = "" }) {
  return processWinningAction({ kind, recordId, userId, requestId, action: "dismiss" });
}

async function sumApprovedDepositsAmountByUserId(client, userId) {
  const deposits = await listEntityRecordsForUpdate(client, "Deposit", {
    user_id: userId,
    status: "approved",
  });
  return deposits.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
}

function getCashbackGoalConfig(goalType) {
  if (goalType === "first_goal") {
    return {
      threshold: 500,
      reward_label: "50 bilhetes extra",
      reward_type: "tickets_bonus",
    };
  }

  if (goalType === "second_goal") {
    return {
      threshold: 1000,
      reward_label: "10% cashback + 100 bilhetes extras",
      reward_type: "cashback_bonus",
    };
  }

  throw createHttpError("Meta de cashback inválida.", 400);
}

export async function claimCashbackReward({ userId, requestId = "", goalType }) {
  const normalizedGoalType = String(goalType || "").trim();
  const goalConfig = getCashbackGoalConfig(normalizedGoalType);
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    const existingEvent = await findEngagementProcessingEventByRequestId(normalizedRequestId);
    if (existingEvent?.entity_name === "CashbackClaim" && existingEvent?.entity_id) {
      const existingClaim = await getEntityById("CashbackClaim", existingEvent.entity_id);
      if (existingClaim) {
        return { claim: existingClaim, processing_event: existingEvent, idempotent: true };
      }
    }
  }

  const user = await findUserById(userId);
  if (!user) throw createHttpError("Usuário não encontrado.", 404);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const totalApproved = await sumApprovedDepositsAmountByUserId(client, userId);
    if (totalApproved < goalConfig.threshold) {
      throw createHttpError("Você ainda não atingiu a meta para resgatar este cashback.", 409);
    }

    const registryScopeKey = `cashback:${normalizedGoalType}`;
    const registry = await upsertUserDomainRegistry(client, {
      domain: "cashback_claim",
      scopeKey: registryScopeKey,
      userId,
      metadata: { goal_type: normalizedGoalType },
    });

    let claim = null;
    if (registry?.record_id) {
      const lockedExisting = await findEntityRecordByNameAndIdForUpdate(client, "CashbackClaim", registry.record_id);
      claim = getEntityRecordData(lockedExisting);
    }

    const now = new Date().toISOString();
    if (!claim) {
      claim = await createEntityRecordData(client, "CashbackClaim", {
        user_id: userId,
        user_email: String(user.email || ""),
        user_name: String(user.full_name || user.nick || ""),
        goal_type: normalizedGoalType,
        amount: totalApproved,
        claimed: true,
        claimed_date: now,
        validated: false,
        reward_type: goalConfig.reward_type,
        reward_label: goalConfig.reward_label,
        threshold_amount: goalConfig.threshold,
        created_date: now,
        updated_date: now,
      });
      await upsertUserDomainRegistry(client, {
        domain: "cashback_claim",
        scopeKey: registryScopeKey,
        userId,
        recordEntityName: "CashbackClaim",
        recordId: claim.id,
        metadata: { goal_type: normalizedGoalType },
      });
    } else if (!claim.claimed) {
      claim = await updateEntityRecordData(client, "CashbackClaim", claim.id, {
        ...claim,
        claimed: true,
        claimed_date: now,
        amount: totalApproved,
        updated_date: now,
      });
    } else {
      const existingAction = await client.query(
        `SELECT *
         FROM engagement_processing_events
         WHERE domain = 'cashback'
           AND action = 'claim'
           AND entity_name = 'CashbackClaim'
           AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [claim.id]
      );
      await client.query("COMMIT");
      return {
        claim,
        processing_event: normalizeEngagementProcessingEvent(existingAction.rows[0] || null),
        idempotent: true,
      };
    }

    const processingEvent = await createEngagementProcessingEvent(client, {
      domain: "cashback",
      action: "claim",
      request_id: normalizedRequestId || null,
      user_id: userId,
      entity_name: "CashbackClaim",
      entity_id: claim.id,
      status: "accepted",
      metadata: {
        goal_type: normalizedGoalType,
        total_approved_amount: totalApproved,
        threshold_amount: goalConfig.threshold,
      },
    });

    await client.query("COMMIT");
    return { claim, processing_event: processingEvent, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function matchesFilters(row, filters = {}) {
  const entries = Object.entries(filters || {});
  if (entries.length === 0) return true;

  for (const [key, value] of entries) {
    const current = row[key];
    if (Array.isArray(value)) {
      if (!value.includes(current)) return false;
      continue;
    }
    if (value !== null && typeof value === "object") {
      if ("$in" in value && Array.isArray(value.$in)) {
        if (!value.$in.includes(current)) return false;
      }
      if ("$ne" in value) {
        if (current === value.$ne) return false;
      }
      continue;
    }
    if (current !== value) return false;
  }

  return true;
}

export async function listEntity(entityName, sort, limit) {
  if (entityName === "User") {
    const users = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    const mapped = users.rows.map(normalizeUser);
    return applyLimit(applySort(mapped, sort), limit);
  }

  const result = await pool.query(
    "SELECT * FROM entity_records WHERE entity_name = $1 ORDER BY created_at DESC",
    [entityName]
  );

  const rows = result.rows.map(normalizeRecord);
  return applyLimit(applySort(rows, sort), limit);
}

export async function filterEntity(entityName, filters, sort, limit) {
  const rows = await listEntity(entityName, null, null);
  const filtered = rows.filter((row) => matchesFilters(row, filters));
  return applyLimit(applySort(filtered, sort), limit);
}

export async function getEntityById(entityName, id) {
  if (entityName === "User") {
    return findUserById(id);
  }

  const result = await pool.query(
    "SELECT * FROM entity_records WHERE entity_name = $1 AND id = $2 LIMIT 1",
    [entityName, id]
  );

  return normalizeRecord(result.rows[0]);
}

export async function createEntity(entityName, payload) {
  if (entityName === "User") {
    const email = payload.email;
    if (!email) throw new Error("email is required for User");
    return findOrCreateUserByEmail(email, payload);
  }

  const now = new Date().toISOString();
  const data = {
    ...(payload || {}),
    created_date: payload?.created_date || now,
    updated_date: now,
  };

  const result = await pool.query(
    `INSERT INTO entity_records (entity_name, data)
     VALUES ($1, $2::jsonb)
     RETURNING *`,
    [entityName, JSON.stringify(data)]
  );
  const created = normalizeRecord(result.rows[0]);

  if (entityName === "Deposit") {
    await maybeGrantDailyChestBonusForDeposit(created);
  }

  return created;
}

export async function updateEntity(entityName, id, payload) {
  if (entityName === "User") {
    return updateUserById(id, payload);
  }

  const current = await getEntityById(entityName, id);
  if (!current) return null;

  const merged = {
    ...current,
    ...(payload || {}),
    id: current.id,
    created_date: current.created_date,
    updated_date: new Date().toISOString(),
  };

  const result = await pool.query(
    `UPDATE entity_records
     SET data = $1::jsonb, updated_at = NOW()
     WHERE entity_name = $2 AND id = $3
     RETURNING *`,
    [JSON.stringify(merged), entityName, id]
  );
  const updated = normalizeRecord(result.rows[0]);

  if (entityName === "Deposit" && current?.status !== "approved" && updated?.status === "approved") {
    await maybeGrantDailyChestBonusForDeposit(updated);
  }

  return updated;
}

export async function deleteEntity(entityName, id) {
  if (entityName === "User") {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    return normalizeUser(result.rows[0]);
  }

  const result = await pool.query(
    "DELETE FROM entity_records WHERE entity_name = $1 AND id = $2 RETURNING *",
    [entityName, id]
  );

  return normalizeRecord(result.rows[0]);
}

export async function appendNavigationLog(payload) {
  return createEntity("NavigationLog", {
    ...(payload || {}),
    created_date: new Date().toISOString(),
  });
}

export async function seedDefaults() {
  const settings = await listEntity("AppSettings");
  if (settings.length > 0) return;

  const defaults = [
    { key: "deposits_enabled", value: "false", description: "Ativar registro de depósitos" },
    { key: "tickets_box_active", value: "false", description: "Ativar caixa de bilhetes" },
    { key: "social_bar_active", value: "false", description: "Ativar redes sociais" },
    { key: "depositant_draw_active", value: "false", description: "Ativar sorteio dos depositantes" },
    { key: "use_carousel_banner", value: "false", description: "Usar carrossel no topo" },
    { key: "deposit_check_link", value: "https://wa.me/", description: "Link para conferência" },
    { key: "tickets_goal_amount", value: "100", description: "Meta de depósitos para progresso" },
    { key: "tickets_reward_per_goal", value: "10", description: "Recompensa padrão" },
    { key: "daily_chest_enabled", value: "false", description: "Ativa o Baú Diário 3D" },
    { key: "daily_chest_tap_goal", value: "4", description: "Quantidade de toques para abrir o baú diário" },
    { key: "daily_chest_message_of_day", value: "Toque no baú para abrir", description: "Mensagem principal do Baú Diário" },
    { key: "daily_chest_reset_hour", value: "0", description: "Hora de reset do Baú Diário" },
    { key: "daily_chest_reset_minute", value: "0", description: "Minuto de reset do Baú Diário" },
    { key: "daily_chest_timezone", value: "America/Sao_Paulo", description: "Timezone do reset do Baú Diário" },
    { key: "daily_chest_rarity_visual", value: "rare", description: "Raridade visual padrão do Baú Diário" },
    { key: "daily_chest_scene_theme", value: "aurora", description: "Tema visual padrão do palco 3D do Baú Diário" },
    { key: "daily_chest_base_daily_chests", value: "1", description: "Quantidade base de baús liberados por dia" },
    { key: "daily_chest_xp_per_open", value: "18", description: "XP ganho ao abrir um baú" },
    { key: "daily_chest_schedule_start_at", value: "", description: "Data inicial opcional para ativar o Baú Diário" },
    { key: "daily_chest_schedule_end_at", value: "", description: "Data final opcional para encerrar o Baú Diário" },
    { key: "daily_chest_deposit_bonus_enabled", value: "false", description: "Permite ganhar baús extras por depósitos aprovados" },
    { key: "daily_chest_bonus_chests_per_approved", value: "1", description: "Baús extras por depósito aprovado" },
    { key: "daily_chest_bonus_amount_step", value: "0", description: "Valor para gerar baús extras por faixa de depósito" },
    { key: "daily_chest_bonus_chests_per_step", value: "0", description: "Quantidade extra de baús por faixa de depósito" }
  ];

  for (const item of defaults) {
    await createEntity("AppSettings", item);
  }

}
