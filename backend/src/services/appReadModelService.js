import { deleteCacheByPrefix, deleteCacheKey, getOrComputeCacheJson } from "../lib/cache.js";

const HOME_SUMMARY_KEY = "app-read:home-summary";
const HOME_FEED_SHARED_KEY = "app-read:home-feed-shared";
const HOME_FEED_USER_PREFIX = "app-read:home-feed-user:";
const DASHBOARD_DYNAMICS_PREFIX = "app-read:dashboard-dynamics:";
const PROFILE_SUMMARY_PREFIX = "app-read:profile-summary:";
const PROFILE_COMPETITION_PREFIX = "app-read:profile-competition:";
const PUBLIC_PROFILE_SUMMARY_PREFIX = "app-read:public-profile-summary:";

function normalizeUserId(userId = "") {
  return String(userId || "").trim();
}

export async function getHomeSummaryReadModel(loader, ttlMs) {
  return getOrComputeCacheJson(HOME_SUMMARY_KEY, ttlMs, loader);
}

export async function getHomeFeedSharedReadModel(loader, ttlMs) {
  return getOrComputeCacheJson(HOME_FEED_SHARED_KEY, ttlMs, loader);
}

export async function getHomeFeedUserReadModel(userId, loader, ttlMs) {
  const safeUserId = normalizeUserId(userId);
  return getOrComputeCacheJson(`${HOME_FEED_USER_PREFIX}${safeUserId}`, ttlMs, loader);
}

export async function getDashboardDynamicsReadModel(userId, { forceFresh = false, ttlMs, loader } = {}) {
  const safeUserId = normalizeUserId(userId);
  const key = `${DASHBOARD_DYNAMICS_PREFIX}${safeUserId}`;
  if (forceFresh) {
    await deleteCacheKey(key);
  }
  return getOrComputeCacheJson(key, ttlMs, loader);
}

export async function getProfileSummaryReadModel(userId, { forceFresh = false, ttlMs, loader } = {}) {
  const safeUserId = normalizeUserId(userId);
  const key = `${PROFILE_SUMMARY_PREFIX}${safeUserId}`;
  if (forceFresh) {
    await deleteCacheKey(key);
  }
  return getOrComputeCacheJson(key, ttlMs, loader);
}

export async function getProfileCompetitionReadModel(userId, { forceFresh = false, ttlMs, loader } = {}) {
  const safeUserId = normalizeUserId(userId);
  const key = `${PROFILE_COMPETITION_PREFIX}${safeUserId}`;
  if (forceFresh) {
    await deleteCacheKey(key);
  }
  return getOrComputeCacheJson(key, ttlMs, loader);
}

export async function getPublicProfileSummaryReadModel(userId, ttlMs, loader) {
  const safeUserId = normalizeUserId(userId);
  return getOrComputeCacheJson(`${PUBLIC_PROFILE_SUMMARY_PREFIX}${safeUserId}`, ttlMs, loader);
}

export async function invalidateHomeReadModels(userId = "") {
  const safeUserId = normalizeUserId(userId);
  await Promise.all([
    deleteCacheKey(HOME_SUMMARY_KEY),
    deleteCacheKey(HOME_FEED_SHARED_KEY),
    safeUserId ? deleteCacheKey(`${DASHBOARD_DYNAMICS_PREFIX}${safeUserId}`) : Promise.resolve(),
    safeUserId ? deleteCacheKey(`${HOME_FEED_USER_PREFIX}${safeUserId}`) : Promise.resolve(),
    deleteCacheByPrefix(DASHBOARD_DYNAMICS_PREFIX),
    deleteCacheByPrefix(HOME_FEED_USER_PREFIX),
  ]);
}

export async function invalidateProfileReadModels(userId = "") {
  const safeUserId = normalizeUserId(userId);
  await Promise.all([
    safeUserId ? deleteCacheKey(`${PROFILE_SUMMARY_PREFIX}${safeUserId}`) : Promise.resolve(),
    safeUserId ? deleteCacheKey(`${PROFILE_COMPETITION_PREFIX}${safeUserId}`) : Promise.resolve(),
    safeUserId ? deleteCacheKey(`${PUBLIC_PROFILE_SUMMARY_PREFIX}${safeUserId}`) : Promise.resolve(),
    deleteCacheByPrefix(PROFILE_SUMMARY_PREFIX),
    deleteCacheByPrefix(PROFILE_COMPETITION_PREFIX),
    deleteCacheByPrefix(PUBLIC_PROFILE_SUMMARY_PREFIX),
  ]);
}
