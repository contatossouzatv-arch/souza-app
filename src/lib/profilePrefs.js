const PREFS_KEY = "souza_profile_prefs_v1";
const SOCIAL_KEY = "souza_profile_social_v1";
const HANDLE_REGISTRY_KEY = "souza_handle_registry_v1";

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeHandle(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

export function isHandleAvailable(handle, userId) {
  const key = normalizeHandle(handle);
  if (!key) return false;
  const registry = readJson(HANDLE_REGISTRY_KEY);
  return !registry[key] || registry[key] === userId;
}

export function reserveHandle(userId, handle) {
  const key = normalizeHandle(handle);
  if (!userId || !key) return false;

  const registry = readJson(HANDLE_REGISTRY_KEY);
  const existingOwner = registry[key];
  if (existingOwner && existingOwner !== userId) return false;

  Object.keys(registry).forEach((entry) => {
    if (registry[entry] === userId && entry !== key) {
      delete registry[entry];
    }
  });

  registry[key] = userId;
  writeJson(HANDLE_REGISTRY_KEY, registry);
  return true;
}

export function loadProfilePrefs(userId) {
  if (!userId) return {};
  const all = readJson(PREFS_KEY);
  return all[userId] || {};
}

export function saveProfilePrefs(userId, prefs) {
  if (!userId) return;
  const all = readJson(PREFS_KEY);
  all[userId] = { ...(all[userId] || {}), ...prefs };
  writeJson(PREFS_KEY, all);
}

export function loadProfileSocial(userId, seed = 0) {
  if (!userId) return { followers: 0, following: 0, likes: 0, isFollowing: false, isLiked: false };
  const all = readJson(SOCIAL_KEY);
  if (all[userId]) {
    return { isLiked: false, ...all[userId] };
  }

  const generated = {
    followers: 20 + (seed % 130),
    following: 10 + (seed % 65),
    likes: 35 + (seed % 180),
    isFollowing: false,
    isLiked: false,
  };
  all[userId] = generated;
  writeJson(SOCIAL_KEY, all);
  return generated;
}

export function saveProfileSocial(userId, social) {
  if (!userId) return;
  const all = readJson(SOCIAL_KEY);
  all[userId] = social;
  writeJson(SOCIAL_KEY, all);
}

export function ensureAutoFollowCreator(userId, creatorId = "") {
  if (!userId) return false;

  const prefs = loadProfilePrefs(userId);
  if (prefs.autoFollowCreatorDone) {
    return false;
  }

  const seed = String(userId).length;
  const social = loadProfileSocial(userId, seed);
  const nextFollowing = Math.max(0, Number(social.following) || 0) + 1;
  const shouldAutoLike = !social.isLiked;
  const nextLikes = shouldAutoLike ? Math.max(0, Number(social.likes) || 0) + 1 : Math.max(0, Number(social.likes) || 0);

  saveProfileSocial(userId, {
    ...social,
    following: nextFollowing,
    likes: nextLikes,
    creator_auto_follow: true,
    creator_auto_like: true,
    isLiked: true,
  });

  saveProfilePrefs(userId, {
    autoFollowCreatorDone: true,
    autoFollowCreatorId: creatorId || "",
  });

  return true;
}
