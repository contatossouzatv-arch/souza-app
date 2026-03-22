function trimString(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function trimStringArray(values, maxItems = 8, maxLen = 500) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => trimString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizePublicUser(row = {}) {
  return {
    id: row.id,
    full_name: String(row.full_name || ""),
    nick: String(row.nick || ""),
    avatar_emoji: String(row.avatar_emoji || "🎰"),
    platform_id: String(row.platform_id || ""),
    profile_avatar_id: String(row.profile_avatar_id || ""),
    profile_image_mode: String(row.profile_image_mode || "avatar"),
    profile_image_url: String(row.profile_image_url || ""),
    profile_image_status: String(row.profile_image_status || "none"),
    account_status: String(row.account_status || "active"),
    created_date: row.created_date || null,
    updated_date: row.updated_date || null,
  };
}

function sanitizeParticipantLike(row = {}) {
  const sanitized = { ...row };
  delete sanitized.user_email;
  delete sanitized.user_phone;
  return sanitized;
}

function sanitizeAuditLike(row = {}) {
  const sanitized = { ...row };
  delete sanitized.user_email;
  delete sanitized.user_phone;
  return sanitized;
}

const PUBLIC_APP_SETTINGS_KEYS = new Set([
  "achievement_badge_rules_v1",
  "achievement_points_rules_v1",
  "cashback_active",
  "cashback_redeem_link",
  "cta_box_active",
  "cta_box_link",
  "cta_box_title",
  "daily_chest_base_daily_chests",
  "daily_chest_bonus_amount_step",
  "daily_chest_bonus_chests_per_approved",
  "daily_chest_bonus_chests_per_step",
  "daily_chest_deposit_bonus_enabled",
  "daily_chest_enabled",
  "daily_chest_message_of_day",
  "daily_chest_rarity_visual",
  "daily_chest_reset_hour",
  "daily_chest_reset_minute",
  "daily_chest_schedule_end_at",
  "daily_chest_schedule_start_at",
  "daily_chest_scene_theme",
  "daily_chest_tap_goal",
  "daily_chest_timezone",
  "daily_chest_xp_per_open",
  "deposit_check_link",
  "deposit_check_link_2",
  "deposit_check_link_3",
  "depositant_draw_active",
  "deposits_enabled",
  "live_link",
  "platform_link",
  "profile_competition_rules_v1",
  "profile_engagement_guide_rules_v1",
  "social_bar_active",
  "tickets_box_active",
  "tickets_goal_amount",
  "tickets_reward_per_goal",
  "use_carousel_banner",
]);

function isPublicAppSettingKey(key) {
  const normalized = trimString(key, 160);
  if (!normalized) return false;
  if (PUBLIC_APP_SETTINGS_KEYS.has(normalized)) return true;
  return (
    normalized.startsWith("deposit_check_link_") ||
    normalized.startsWith("banner_text_") ||
    normalized.startsWith("banner_link_") ||
    normalized.startsWith("instant_raffle_")
  );
}

function sanitizeAppSettingRead(row = {}, auth) {
  if (String(auth?.role || "user") === "admin") return row;
  if (!isPublicAppSettingKey(row?.key)) return null;
  return {
    id: row.id,
    key: trimString(row.key, 160),
    value: typeof row.value === "string" ? row.value : String(row.value || ""),
    description: trimString(row.description, 240),
    created_date: row.created_date || null,
    updated_date: row.updated_date || null,
  };
}

function sanitizePushNotificationRead(row = {}, auth) {
  if (String(auth?.role || "user") === "admin") return row;
  if (String(row?.status || "").toLowerCase() !== "sent") return null;
  return {
    id: row.id,
    title: trimString(row.title, 120),
    message: trimString(row.message, 2000),
    status: "sent",
    sent_at: row.sent_at || null,
    created_date: row.created_date || null,
    updated_date: row.updated_date || null,
  };
}

function sanitizePublicWinnerAuditRead(row = {}, auth) {
  if (String(auth?.role || "user") === "admin") return sanitizeAuditLike(row);
  if (String(row?.status || "").toLowerCase() !== "validated") return null;
  const sanitized = sanitizeAuditLike(row);
  return {
    id: sanitized.id,
    user_id: sanitized.user_id,
    user_name: trimString(sanitized.user_name, 160),
    user_nick: trimString(sanitized.user_nick, 120),
    user_avatar: trimString(sanitized.user_avatar, 32),
    prize_amount: toSafeNumber(sanitized.prize_amount),
    raffle_title: trimString(sanitized.raffle_title, 200),
    cycle_number: sanitized.cycle_number ?? null,
    game_call: trimString(sanitized.game_call, 120),
    status: "validated",
    drawn_at: sanitized.drawn_at || null,
    validated_date: sanitized.validated_date || null,
    created_date: sanitized.created_date || null,
    updated_date: sanitized.updated_date || null,
  };
}

const POLICY_BY_ENTITY = {
  User: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead(row, auth) {
      if (String(auth?.role || "user") === "admin") return row;
      return sanitizePublicUser(row);
    },
  },
  AppSettings: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizeAppSettingRead,
  },
  CurrentPlatform: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  Platform: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  BannerCarousel: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  SocialMedia: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  PushNotification: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizePushNotificationRead,
  },
  DrawWinnerAudit: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizePublicWinnerAuditRead,
  },
  DepositantDrawCycle: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  DepositantDrawWinner: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizeAuditLike,
  },
  LiveDrawRaffle: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  GameCallRaffle: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  InstantRaffle: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  LiveDrawParticipant: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizeParticipantLike,
  },
  GameCallParticipant: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizeParticipantLike,
  },
  InstantRaffleParticipant: {
    read: "auth",
    create: "admin",
    update: "admin",
    delete: "admin",
    sanitizeRead: sanitizeParticipantLike,
  },
  Deposit: {
    read: "owner",
    create: "none",
    update: "none",
    delete: "none",
    ownerField: "user_id",
    sanitizeCreate(payload, auth) {
      return {
        user_id: auth.sub,
        user_email: trimString(auth.email || "", 320),
        user_name: trimString(payload?.user_name || "", 160),
        user_platform_id: trimString(payload?.user_platform_id || "", 120),
        platform_name: trimString(payload?.platform_name || "", 120),
        amount: Math.max(0, toSafeNumber(payload?.amount)),
        proof_image_url: trimString(payload?.proof_image_url || "", 1000),
        proof_image_urls: trimStringArray(payload?.proof_image_urls, 6, 1000),
        cycle_id: trimString(payload?.cycle_id || "", 120),
        status: "pending",
        ticket_numbers: [],
      };
    },
  },
  PlatformHistory: {
    read: "owner",
    create: "self",
    update: "owner",
    delete: "owner",
    ownerField: "user_id",
    sanitizeCreate(_payload, auth) {
      return {
        user_id: auth.sub,
      };
    },
    sanitizeUpdate() {
      return {};
    },
  },
  CashbackClaim: {
    read: "owner",
    create: "admin",
    update: "admin",
    delete: "admin",
    ownerField: "user_id",
  },
  DailyChestRewardConfig: { read: "admin", create: "admin", update: "admin", delete: "admin" },
  DailyChestXpGrant: {
    read: "owner",
    create: "admin",
    update: "admin",
    delete: "admin",
    ownerField: "user_id",
  },
  UserPrizeGalleryItem: {
    read: "owner",
    create: "admin",
    update: "admin",
    delete: "admin",
    ownerField: "user_id",
  },
  CompetitionPointEvent: { read: "admin", create: "admin", update: "admin", delete: "admin" },
  IslandGameConfig: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  IslandGameTheme: { read: "auth", create: "admin", update: "admin", delete: "admin" },
  IslandGameSession: { read: "admin", create: "admin", update: "admin", delete: "admin" },
};

const PLATFORM_HISTORY_MUTABLE_FIELDS = ["platform_name", "platform_id"];

function isAdmin(auth) {
  return String(auth?.role || "user") === "admin";
}

function getEntityPolicy(entityName) {
  return POLICY_BY_ENTITY[entityName] || {
    read: "admin",
    create: "admin",
    update: "admin",
    delete: "admin",
  };
}

function canOperate(mode, auth) {
  if (mode === "admin") return isAdmin(auth);
  if (mode === "auth") return Boolean(auth?.sub);
  if (mode === "self") return Boolean(auth?.sub);
  if (mode === "owner") return Boolean(auth?.sub);
  return false;
}

function isOwner(policy, auth, row) {
  if (isAdmin(auth)) return true;
  if (!auth?.sub || !row) return false;
  if (policy.ownerField) {
    return String(row[policy.ownerField] || "") === String(auth.sub);
  }
  return String(row.id || "") === String(auth.sub);
}

export function canReadEntity(entityName, auth) {
  const policy = getEntityPolicy(entityName);
  return canOperate(policy.read, auth);
}

export function canCreateEntity(entityName, auth) {
  const policy = getEntityPolicy(entityName);
  return canOperate(policy.create, auth);
}

export function canUpdateEntity(entityName, auth, currentRow) {
  const policy = getEntityPolicy(entityName);
  if (policy.update === "owner") return isOwner(policy, auth, currentRow);
  return canOperate(policy.update, auth);
}

export function canDeleteEntity(entityName, auth, currentRow) {
  const policy = getEntityPolicy(entityName);
  if (policy.delete === "owner") return isOwner(policy, auth, currentRow);
  return canOperate(policy.delete, auth);
}

export function scopeEntityRows(entityName, auth, rows = []) {
  const policy = getEntityPolicy(entityName);
  let scoped = Array.isArray(rows) ? rows : [];

  if (policy.read === "owner" && !isAdmin(auth)) {
    scoped = scoped.filter((row) => isOwner(policy, auth, row));
  }

  if (typeof policy.sanitizeRead === "function") {
    return scoped
      .map((row) => policy.sanitizeRead(row, auth))
      .filter(Boolean);
  }

  return scoped;
}

export function scopeEntityRow(entityName, auth, row) {
  if (!row) return null;
  return scopeEntityRows(entityName, auth, [row])[0] || null;
}

export function sanitizeCreatePayload(entityName, payload, auth) {
  const policy = getEntityPolicy(entityName);

  if (entityName === "PlatformHistory") {
    return {
      ...(policy.sanitizeCreate ? policy.sanitizeCreate(payload, auth) : {}),
      platform_name: trimString(payload?.platform_name || "", 120),
      platform_id: trimString(payload?.platform_id || "", 120),
    };
  }

  if (typeof policy.sanitizeCreate === "function") {
    return policy.sanitizeCreate(payload, auth);
  }

  return payload || {};
}

export function sanitizeUpdatePayload(entityName, payload) {
  if (entityName === "PlatformHistory") {
    const next = {};
    for (const field of PLATFORM_HISTORY_MUTABLE_FIELDS) {
      if (field in (payload || {})) {
        next[field] = trimString(payload[field], 120);
      }
    }
    return next;
  }

  return payload || {};
}
