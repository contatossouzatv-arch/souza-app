import { resolveApiBaseUrl } from "@/lib/apiBaseUrl";
import { queryClientInstance } from "@/lib/query-client";

const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_KEY = "souza_local_token";
const REFRESH_TOKEN_KEY = "souza_local_refresh_token";
const LOGIN_2FA_PENDING_KEY = "souza_login_2fa_pending_v1";
const AUTH_REQUIRED_EVENT = "souza:auth-required";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const PROFILE_REQUEST_TIMEOUT_MS = 30000;
const ADMIN_ACTION_TIMEOUT_MS = 45000;
const ADMIN_READ_TIMEOUT_MS = 30000;
const RAFFLE_PARTICIPANT_TIMEOUT_MS = 30000;
const REQUEST_DIAGNOSTIC_SLOW_MS = 1200;
const REQUEST_DIAGNOSTIC_NOISY_CONCURRENCY = 4;
const DEFAULT_FETCH_CREDENTIALS = "include";

function logAuthClient(message, details) {
  console.info(`[auth-client] ${message}`, details || {});
}

function shouldLogRequest(path = "", status = null) {
  const normalizedPath = String(path || "").trim();
  if (normalizedPath === "/api/auth/me" || normalizedPath === "/api/auth/refresh") return true;
  if (normalizedPath.startsWith("/api/auth/")) return Number(status) >= 500;
  return Number(status) >= 500;
}

function logRequestResult(message, details) {
  console.info(`[api-client] ${message}`, details || {});
}

function getRequestDiagnosticsStore() {
  if (typeof window === "undefined") return null;
  if (!window.__souzaRequestDiagnostics) {
    window.__souzaRequestDiagnostics = {
      inFlight: 0,
      active: new Map(),
      recent: [],
    };
  }
  return window.__souzaRequestDiagnostics;
}

function getCurrentRouteLabel() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname || ""}${window.location.search || ""}`;
}

function registerRequestStart(path) {
  const store = getRequestDiagnosticsStore();
  if (!store) return null;
  const requestId = createRequestId("http");
  const route = getCurrentRouteLabel();
  const startedAt = performance.now();
  store.inFlight += 1;
  store.active.set(requestId, { path, route, startedAt });

  if (store.inFlight >= REQUEST_DIAGNOSTIC_NOISY_CONCURRENCY) {
    logRequestResult("concurrency spike", {
      path,
      route,
      inFlight: store.inFlight,
      activePaths: Array.from(store.active.values()).map((item) => item.path).slice(-8),
    });
  }

  return { requestId, route, startedAt };
}

function registerRequestEnd(meta, status, outcome, extra = {}) {
  const store = getRequestDiagnosticsStore();
  if (!store || !meta?.requestId) return;
  const activeMeta = store.active.get(meta.requestId);
  const startedAt = activeMeta?.startedAt ?? meta.startedAt ?? performance.now();
  const elapsedMs = Math.round(performance.now() - startedAt);
  const record = {
    path: meta.path,
    route: activeMeta?.route || meta.route || getCurrentRouteLabel(),
    status: Number(status || 0),
    outcome,
    elapsedMs,
    inFlightAfter: Math.max(0, store.inFlight - 1),
    ...extra,
  };
  store.active.delete(meta.requestId);
  store.inFlight = Math.max(0, store.inFlight - 1);
  store.recent.push(record);
  if (store.recent.length > 40) {
    store.recent.splice(0, store.recent.length - 40);
  }

  if (elapsedMs >= REQUEST_DIAGNOSTIC_SLOW_MS || outcome !== "success") {
    logRequestResult("diagnostic", record);
  }
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function resolveTimeoutMs(path = "", timeoutMs) {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
  const normalizedPath = String(path || "").trim();
  if (normalizedPath === "/api/auth/me" || normalizedPath === "/api/auth/refresh") {
    return AUTH_REQUEST_TIMEOUT_MS;
  }
  if (
    normalizedPath === "/api/profile/metrics" ||
    normalizedPath === "/api/profile/metrics?force=true" ||
    normalizedPath === "/api/profile/summary" ||
    normalizedPath === "/api/profile/summary?force=true" ||
    normalizedPath === "/api/profile/competition-board" ||
    normalizedPath === "/api/profile/competition-board?force=true" ||
    normalizedPath === "/api/profile/public-basics" ||
    normalizedPath.startsWith("/api/profile/public-basics?") ||
    normalizedPath.startsWith("/api/profile/public/")
  ) {
    return PROFILE_REQUEST_TIMEOUT_MS;
  }
  if (
    normalizedPath === "/api/entities/InstantRaffleParticipant/filter" ||
    normalizedPath === "/api/entities/LiveDrawParticipant/filter" ||
    normalizedPath === "/api/entities/GameCallParticipant/filter" ||
    (normalizedPath.includes("/api/admin/instant-raffles/") && normalizedPath.includes("/participants"))
  ) {
    return RAFFLE_PARTICIPANT_TIMEOUT_MS;
  }
  if (
    normalizedPath === "/api/daily-chest/state" ||
    normalizedPath === "/api/daily-chest/open" ||
    normalizedPath === "/api/daily-chest/claim" ||
    normalizedPath === "/api/daily-chest/unlock" ||
    normalizedPath === "/api/home/summary" ||
    normalizedPath === "/api/home/feed-summary" ||
    normalizedPath.startsWith("/api/home/feed-summary?") ||
    normalizedPath === "/api/dynamics/summary" ||
    normalizedPath === "/api/deposits/dashboard-summary" ||
    normalizedPath === "/api/deposits/leaderboard" ||
    normalizedPath.startsWith("/api/deposits/leaderboard?") ||
    normalizedPath === "/api/profile/platform-history" ||
    normalizedPath.startsWith("/api/profile/platform-history?") ||
    normalizedPath === "/api/profile/prize-gallery" ||
    normalizedPath.startsWith("/api/profile/prize-gallery?") ||
    normalizedPath.startsWith("/api/social/state/")
  ) {
    return 25000;
  }
  if (
    normalizedPath.startsWith("/api/social/follow/") ||
    normalizedPath.startsWith("/api/social/like/")
  ) {
    return 30000;
  }
  if (
    normalizedPath === "/api/admin/gamification/overview" ||
    normalizedPath.startsWith("/api/admin/users") ||
    normalizedPath.includes("/api/admin/instant-raffles/participants/") ||
    normalizedPath.includes("/api/admin/deposit-draws/winners/") ||
    normalizedPath.includes("/api/admin/audits/winners/") ||
    normalizedPath.endsWith("/approve") ||
    normalizedPath.endsWith("/reject") ||
    normalizedPath.endsWith("/validate") ||
    normalizedPath.endsWith("/complete") ||
    normalizedPath.endsWith("/redeem")
  ) {
    return ADMIN_ACTION_TIMEOUT_MS;
  }
  if (
    normalizedPath === "/api/admin/audits/winners" ||
    normalizedPath.startsWith("/api/admin/audits/winners?") ||
    normalizedPath === "/api/admin/deposits" ||
    normalizedPath.startsWith("/api/admin/deposits?") ||
    normalizedPath === "/api/admin/deposit-cycles/summary"
  ) {
    return ADMIN_READ_TIMEOUT_MS;
  }
  return DEFAULT_REQUEST_TIMEOUT_MS;
}

function isLocalHost(hostname = "") {
  const value = String(hostname || "").toLowerCase();
  return value === "localhost" || value === "127.0.0.1";
}

function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

function hasToken() {
  return Boolean(getToken());
}

function hasRefreshToken() {
  return Boolean(getRefreshToken());
}

function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function setRefreshToken(token) {
  if (token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

function clearClientAuthState(reason = "unknown") {
  clearMeCache();
  setToken(null);
  setRefreshToken(null);
  try {
    window.sessionStorage.removeItem(LOGIN_2FA_PENDING_KEY);
  } catch {
    // ignore sessionStorage errors
  }
  try {
    queryClientInstance.clear();
  } catch {
    // ignore cache clear errors
  }
  logAuthClient("cleared local auth state", { reason });
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function fetchWithTimeout(path, options = {}) {
  const { __timeoutMs, signal: externalSignal, ...fetchOptions } = options;
  const timeoutMs = resolveTimeoutMs(path, __timeoutMs);
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timerId);
      throw new DOMException("Aborted", "AbortError");
    }
    externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(buildUrl(path), {
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      if (externalSignal?.aborted) {
        throw error;
      }
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      timeoutError.code = "ETIMEDOUT";
      timeoutError.status = 0;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
    window.clearTimeout(timerId);
  }
}

function createRequestId(prefix = "req") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveAssetUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const normalizeUploadPath = (pathname = "") => {
    const safePath = String(pathname || "").replace(/\\/g, "/");
    if (safePath.startsWith("/api/uploads/")) return safePath;
    if (safePath.startsWith("/uploads/")) return `/api${safePath}`;
    return safePath;
  };

  const isProfileImagePath = (pathname = "") => {
    const safePath = String(pathname || "").replace(/\\/g, "/");
    return (
      safePath.startsWith("/api/auth/profile-image/") ||
      safePath.startsWith("/api/auth/profile-image-version/")
    );
  };

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      const api = new URL(API_BASE_URL);
      const uploadLikePath =
        parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/uploads/");
      const profileImagePath = isProfileImagePath(parsed.pathname);

      if ((uploadLikePath || profileImagePath) && parsed.host !== api.host) {
        parsed.protocol = api.protocol;
        parsed.host = api.host;
        parsed.pathname = normalizeUploadPath(parsed.pathname);
        return parsed.toString();
      }

      if (isLocalHost(parsed.hostname) && !isLocalHost(api.hostname)) {
        parsed.protocol = api.protocol;
        parsed.host = api.host;
        parsed.pathname = normalizeUploadPath(parsed.pathname);
        return parsed.toString();
      }

      if (uploadLikePath) {
        parsed.pathname = normalizeUploadPath(parsed.pathname);
      }

      return parsed.toString();
    }
  } catch {
    // ignore parse error and fallback to API base
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${normalizeUploadPath(value)}`;
  }

  return `${API_BASE_URL}/${normalizeUploadPath(`/${value.replace(/^\/+/, "")}`).replace(/^\/+/, "")}`;
}

async function parseResponse(response) {
  if (response.ok) {
    if (response.status === 204) return null;
    return response.json();
  }

  let message = `HTTP ${response.status}`;
  try {
    const data = await response.json();
    message = data?.error || data?.message || message;
  } catch {
    // ignore parse error
  }

  const error = new Error(message);
  error.status = response.status;
  throw error;
}

let refreshPromise = null;
let mePromise = null;
let meCache = {
  value: null,
  expiresAt: 0,
};

function cacheAuthenticatedUser(user) {
  meCache = {
    value: user || null,
    expiresAt: Date.now() + 15_000,
  };
}

function clearMeCache() {
  meCache = {
    value: null,
    expiresAt: 0,
  };
}

async function tryRefreshSession() {
  const refreshToken = getRefreshToken();
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetchWithTimeout("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: DEFAULT_FETCH_CREDENTIALS,
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
      if (!response.ok) {
        if (response.status === 401) {
          clearClientAuthState("refresh_failed");
          return { ok: false, reason: "unauthorized" };
        }
        return { ok: false, reason: "server_error", status: response.status };
      }
      const data = await response.json();
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return {
        ok: Boolean(data?.token),
        reason: data?.token ? "success" : "invalid_payload",
      };
    } catch (error) {
      return {
        ok: false,
        reason: isRecoverableAuthError(error) ? "network_error" : "unknown_error",
        error,
      };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function createRecoverableAuthRefreshError(path = "", refreshResult = null) {
  const error = refreshResult?.error instanceof Error
    ? refreshResult.error
    : new Error("Nao foi possivel renovar sua sessao agora.");
  error.status = 0;
  error.code = "AUTH_REFRESH_UNAVAILABLE";
  error.authPath = path;
  return error;
}

function isAuthPath(path = "") {
  return String(path || "").startsWith("/api/auth/");
}

function shouldSkipAuthRefresh(path = "", explicitSkip = false) {
  if (Boolean(explicitSkip)) return true;
  const normalizedPath = String(path || "").trim();
  const refreshExcludedPaths = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google",
    "/api/auth/dev-login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/logout",
    "/api/auth/refresh",
  ]);
  return refreshExcludedPaths.has(normalizedPath);
}

function shouldHandleUnauthorized(path, status) {
  if (Number(status) !== 401 || !isAuthPath(path)) return false;
  const normalizedPath = String(path || "").trim();
  const publicAuthEndpoints = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/2fa/diagnose",
    "/api/auth/2fa/setup",
    "/api/auth/2fa/enable",
    "/api/auth/2fa/disable",
  ]);
  return !publicAuthEndpoints.has(normalizedPath);
}

function isRecoverableAuthError(error) {
  return error?.name === "TimeoutError" || !Number.isFinite(Number(error?.status || NaN));
}

function notifyUnauthorized(path, error) {
  clearMeCache();
  clearClientAuthState(`401:${path}`);
  const detail = {
    path,
    status: Number(error?.status || 401),
    message: String(error?.message || "Authentication required"),
  };
  logAuthClient("dispatching auth-required", detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail }));
  }
}

async function request(path, options = {}) {
  const startedAt = performance.now();
  const { __skipAuthRefresh, __timeoutMs, __omitAuthToken, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  const token = __omitAuthToken ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const diagnosticMeta = registerRequestStart(path);
  if (diagnosticMeta) {
    diagnosticMeta.path = path;
  }

  let response;
  try {
    response = await fetchWithTimeout(path, {
      ...fetchOptions,
      headers,
      credentials: DEFAULT_FETCH_CREDENTIALS,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    const elapsedMs = Math.round(performance.now() - startedAt);
    logRequestResult("network failure", {
      path,
      elapsedMs,
      apiBaseUrl: API_BASE_URL,
      hasToken: hasToken(),
      isTimeout: error?.name === "TimeoutError",
      message: error?.message || "Network error",
    });
    registerRequestEnd(diagnosticMeta, error?.status || 0, "network_failure", {
      isTimeout: error?.name === "TimeoutError",
      message: error?.message || "Network error",
    });
    throw error;
  }

  const skipRefresh = shouldSkipAuthRefresh(path, __skipAuthRefresh || __omitAuthToken);

  if (response.status === 401 && !skipRefresh) {
    const refreshResult = await tryRefreshSession();
    if (refreshResult?.ok) {
      const retryHeaders = { ...(fetchOptions.headers || {}) };
      const retryToken = getToken();
      if (retryToken) retryHeaders.Authorization = `Bearer ${retryToken}`;
      response = await fetchWithTimeout(path, {
        ...fetchOptions,
        headers: retryHeaders,
        credentials: DEFAULT_FETCH_CREDENTIALS,
        __timeoutMs,
      });
    } else if (refreshResult?.reason === "network_error" || refreshResult?.reason === "server_error") {
      const error = createRecoverableAuthRefreshError(path, refreshResult);
      logRequestResult("refresh unavailable", {
        path,
        apiBaseUrl: API_BASE_URL,
        hasToken: hasToken(),
        refreshReason: refreshResult.reason,
        message: error?.message || "Nao foi possivel renovar sua sessao agora.",
      });
      registerRequestEnd(diagnosticMeta, 0, "network_failure", {
        isTimeout: error?.name === "TimeoutError",
        message: error?.message || "Nao foi possivel renovar sua sessao agora.",
        refreshReason: refreshResult.reason,
      });
      throw error;
    }
  }
  try {
    const data = await parseResponse(response);
    if (shouldLogRequest(path, response.status)) {
      logRequestResult("response", {
        path,
        status: response.status,
        elapsedMs: Math.round(performance.now() - startedAt),
        apiBaseUrl: API_BASE_URL,
        hasToken: hasToken(),
      });
    }
    registerRequestEnd(diagnosticMeta, response.status, "success");
    return data;
  } catch (error) {
    if (shouldLogRequest(path, error?.status)) {
      logRequestResult("response error", {
        path,
        status: Number(error?.status || 0),
        elapsedMs: Math.round(performance.now() - startedAt),
        apiBaseUrl: API_BASE_URL,
        hasToken: hasToken(),
        message: error?.message || "Request failed",
      });
    }
    if (shouldHandleUnauthorized(path, error?.status)) {
      notifyUnauthorized(path, error);
    }
    registerRequestEnd(diagnosticMeta, error?.status || 0, "response_error", {
      message: error?.message || "Request failed",
    });
    throw error;
  }
}

async function requestBlob(path, options = {}) {
  const startedAt = performance.now();
  const { __skipAuthRefresh, __timeoutMs, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetchWithTimeout(path, {
      ...fetchOptions,
      headers,
      credentials: DEFAULT_FETCH_CREDENTIALS,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    logRequestResult("blob network failure", {
      path,
      elapsedMs: Math.round(performance.now() - startedAt),
      apiBaseUrl: API_BASE_URL,
      isTimeout: error?.name === "TimeoutError",
      message: error?.message || "Network error",
    });
    throw error;
  }

  const skipRefresh = shouldSkipAuthRefresh(path, __skipAuthRefresh);

  if (response.status === 401 && !skipRefresh) {
    const refreshResult = await tryRefreshSession();
    if (refreshResult?.ok) {
      const retryHeaders = { ...(fetchOptions.headers || {}) };
      const retryToken = getToken();
      if (retryToken) retryHeaders.Authorization = `Bearer ${retryToken}`;
      response = await fetchWithTimeout(path, {
        ...fetchOptions,
        headers: retryHeaders,
        credentials: DEFAULT_FETCH_CREDENTIALS,
        __timeoutMs,
      });
    } else if (refreshResult?.reason === "network_error" || refreshResult?.reason === "server_error") {
      throw createRecoverableAuthRefreshError(path, refreshResult);
    }
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {
      // ignore parse error
    }
    const error = new Error(message);
    error.status = response.status;
    if (shouldLogRequest(path, error?.status)) {
      logRequestResult("blob response error", {
        path,
        status: Number(error?.status || 0),
        elapsedMs: Math.round(performance.now() - startedAt),
        apiBaseUrl: API_BASE_URL,
        message: error?.message || "Request failed",
      });
    }
    if (shouldHandleUnauthorized(path, error?.status)) {
      notifyUnauthorized(path, error);
    }
    throw error;
  }

  if (shouldLogRequest(path, response.status)) {
    logRequestResult("blob response", {
      path,
      status: response.status,
      elapsedMs: Math.round(performance.now() - startedAt),
      apiBaseUrl: API_BASE_URL,
    });
  }

  return response.blob();
}

function createEntityClient(entityName) {
  return {
    list(sort, limit) {
      const params = new URLSearchParams();
      if (sort) params.set("sort", sort);
      if (limit) params.set("limit", String(limit));
      const query = params.toString();
      return request(`/api/entities/${entityName}${query ? `?${query}` : ""}`);
    },

    filter(filters = {}, sort, limit) {
      return request(`/api/entities/${entityName}/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, sort, limit }),
      });
    },

    create(payload = {}) {
      return request(`/api/entities/${entityName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    update(id, payload = {}) {
      return request(`/api/entities/${entityName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    delete(id) {
      return request(`/api/entities/${entityName}/${id}`, {
        method: "DELETE",
      });
    },
  };
}

const entitiesProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!prop || typeof prop !== "string") return undefined;
      return createEntityClient(prop);
    },
  }
);

async function uploadFile({ file, folder, filename } = {}) {
  const form = new FormData();
  if (folder) form.append("folder", String(folder));
  if (filename) form.append("filename", String(filename));
  form.append("file", file);

  return request("/api/uploads", {
    method: "POST",
    body: form,
  });
}

async function deleteFile({ fileUrl, path } = {}) {
  const payload = {};
  if (fileUrl) payload.file_url = String(fileUrl);
  if (path) payload.path = String(path);
  return request("/api/uploads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const base44 = {
  auth: {
    hasToken,
    hasRefreshToken,

    clearClientAuthState,

    isRecoverableAuthError,

    async me() {
      if (meCache.value && Date.now() < meCache.expiresAt) {
        return meCache.value;
      }
      if (mePromise) {
        return mePromise;
      }

      mePromise = (async () => {
        const user = await request("/api/auth/me");
        cacheAuthenticatedUser(user);
        return user;
      })()
        .finally(() => {
          mePromise = null;
        });

      return mePromise;
    },

    async login({ email, password, otp }) {
      const data = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, otp }),
        __skipAuthRefresh: true,
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return data;
    },

    async register({ email, password, full_name, nick, phone }) {
      const data = await request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name, nick, phone }),
        __skipAuthRefresh: true,
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return data;
    },

    async loginWithGoogle(credential, otp) {
      const data = await request("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, otp }),
        __skipAuthRefresh: true,
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return data;
    },

    async updateMe(payload = {}) {
      const result = await request("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      clearMeCache();
      return result;
    },

    async checkAvailability({ nick = "", phone = "" } = {}) {
      const params = new URLSearchParams();
      if (nick) params.set("nick", String(nick));
      if (phone) params.set("phone", String(phone));
      return request(`/api/auth/availability${params.toString() ? `?${params.toString()}` : ""}`);
    },

    async deactivateMe() {
      return request("/api/auth/me/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async deleteMe() {
      return request("/api/auth/me", {
        method: "DELETE",
      });
    },

    async uploadProfileImage(file) {
      const form = new FormData();
      form.append("file", file);
      return request("/api/auth/me/profile-image", {
        method: "POST",
        body: form,
      });
    },

    async getMyPrivateProfileImage() {
      return requestBlob("/api/auth/me/profile-image/private");
    },

    async listMyProfileImages() {
      return request("/api/auth/me/profile-images");
    },

    async cancelMyPendingProfileImage() {
      return request("/api/auth/me/profile-image/pending", {
        method: "DELETE",
      });
    },

    async listAdminProfileImages(status = "manual_review") {
      const params = new URLSearchParams();
      params.set("status", status);
      return request(`/api/auth/admin/profile-images?${params.toString()}`);
    },

    async getAdminProfileImagePreview(userId) {
      return requestBlob(`/api/auth/admin/profile-images/${userId}/preview`);
    },

    async approveAdminProfileImage(userId) {
      return request(`/api/auth/admin/profile-images/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async rejectAdminProfileImage(userId, reason) {
      return request(`/api/auth/admin/profile-images/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },

    async refresh() {
      const refreshToken = getRefreshToken();
      const data = await request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        __skipAuthRefresh: true,
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return data;
    },

    async logoutAll() {
      try {
        return await request("/api/auth/logout-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          __skipAuthRefresh: true,
        });
      } finally {
        clearMeCache();
        clearClientAuthState("logout_all");
      }
    },

    async forgotPassword(email) {
      return request("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        __skipAuthRefresh: true,
      });
    },

    async resetPassword(token, newPassword) {
      return request("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
        __skipAuthRefresh: true,
      });
    },

    async changePassword(currentPassword, newPassword) {
      return request("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    async setup2FA() {
      return request("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async enable2FA(otp) {
      return request("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
    },

    async disable2FA(otp) {
      return request("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
    },

    async diagnose2FA(otp) {
      return request("/api/auth/2fa/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
    },

    logout(redirectUrl) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        fetch(buildUrl("/api/auth/logout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
      } else {
        fetch(buildUrl("/api/auth/logout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({}),
        }).catch(() => {});
      }
      clearClientAuthState("logout");
      clearMeCache();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.reload();
      }
    },

    redirectToLogin() {
      window.location.href = "/login";
    },

    async devLogin() {
      const data = await request("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@local.dev" }),
        __skipAuthRefresh: true,
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      cacheAuthenticatedUser(data?.user || null);
      return data;
    },
  },

  entities: entitiesProxy,

  profile: {
    syncPhone(phone, requestId) {
      return request("/api/profile/sync-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, requestId: requestId || createRequestId("profile-sync-phone") }),
      });
    },
    notifications({ limit = 50 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      return request(`/api/profile/notifications?${params.toString()}`);
    },
    markNotificationsRead(ids = []) {
      return request("/api/profile/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    publicBasics(ids = [], handles = [], options = {}) {
      const uniqueIds = Array.from(
        new Set((Array.isArray(ids) ? ids : []).map((item) => String(item || "").trim()).filter(Boolean))
      );
      const uniqueHandles = Array.from(
        new Set(
          (Array.isArray(handles) ? handles : [])
            .map((item) => String(item || "").trim().replace(/^@+/, "").toLowerCase())
            .filter(Boolean)
        )
      );
      const params = new URLSearchParams();
      if (uniqueIds.length > 0) params.set("ids", uniqueIds.join(","));
      if (uniqueHandles.length > 0) params.set("handles", uniqueHandles.join(","));
      return request(`/api/profile/public-basics?${params.toString()}`, options);
    },
    publicDirectory({ limit = 24, offset = 0 } = {}, options = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return request(`/api/profile/public-directory?${params.toString()}`, options);
    },
    platformHistory({ limit = 100 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      return request(`/api/profile/platform-history?${params.toString()}`);
    },
  },

  points: {
    async me(limit = 50) {
      return request(`/api/points/me?limit=${encodeURIComponent(String(limit))}`);
    },

    async award({ userId, amount, reason, requestId, metadata = {} }) {
      return request("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, reason, requestId, metadata }),
      });
    },
  },

  deposits: {
    async create({
      amount,
      platformName,
      userPlatformId,
      cycleId,
      proofImageUrl = "",
      proofImageUrls = [],
      userName = "",
      requestId,
    }) {
      return request("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          platformName,
          userPlatformId,
          cycleId,
          proofImageUrl,
          proofImageUrls,
          userName,
          requestId: requestId || createRequestId("deposit-create"),
        }),
      });
    },

    async my(options = {}) {
      return request("/api/deposits/my", options);
    },

    async dashboardSummary(options = {}) {
      return request("/api/deposits/dashboard-summary", options);
    },

    async leaderboard({ cycleId = "", limit, signal } = {}) {
      const params = new URLSearchParams();
      if (cycleId) params.set("cycleId", cycleId);
      if (limit) params.set("limit", String(limit));
      return request(`/api/deposits/leaderboard${params.toString() ? `?${params.toString()}` : ""}`, { signal });
    },

    async adminList({ status = "", cycleId = "", limit, signal } = {}) {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (cycleId) params.set("cycleId", cycleId);
      if (limit) params.set("limit", String(limit));
      return request(`/api/admin/deposits${params.toString() ? `?${params.toString()}` : ""}`, { signal });
    },

    async adminHistory(id) {
      return request(`/api/admin/deposits/${id}/history`);
    },

    async approve(id, requestId) {
      return request(`/api/admin/deposits/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("deposit-approve") }),
      });
    },

    async reject(id, reason = "", requestId) {
      return request(`/api/admin/deposits/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          requestId: requestId || createRequestId("deposit-reject"),
        }),
      });
    },

    async adminUpdate(id, payload = {}) {
      return request(`/api/admin/deposits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestId: payload.requestId || createRequestId("deposit-edit"),
        }),
      });
    },

    async adjustTickets(id, { adjustment, reason, requestId } = {}) {
      return request(`/api/admin/deposits/${id}/adjust-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment,
          reason,
          requestId: requestId || createRequestId("deposit-adjust"),
        }),
      });
    },

    async invalidate(id, { reason, requestId } = {}) {
      return request(`/api/admin/deposits/${id}/invalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          requestId: requestId || createRequestId("deposit-invalidate"),
        }),
      });
    },

    async adminDelete(id, { reason, requestId } = {}) {
      return request(`/api/admin/deposits/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          requestId: requestId || createRequestId("deposit-delete"),
        }),
      });
    },
  },

  liveDraws: {
    async join(id, requestId) {
      return request(`/api/live-draws/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId || createRequestId("live-draw-join"),
        }),
      });
    },
  },

  gameCall: {
    async join(id, requestId) {
      return request(`/api/game-call/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId || createRequestId("game-call-join"),
        }),
      });
    },

    async submit(id, { gameCall, requestId } = {}) {
      return request(`/api/game-call/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameCall,
          requestId: requestId || createRequestId("game-call-submit"),
        }),
      });
    },
  },

  instantRaffles: {
    async basic(id) {
      return request(`/api/instant-raffles/${id}/basic`);
    },

    async join(id, { platformId, requestId } = {}) {
      return request(`/api/instant-raffles/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId,
          requestId: requestId || createRequestId("instant-raffle-join"),
        }),
      });
    },

    async dismiss(id, requestId) {
      return request(`/api/instant-raffles/${id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId || createRequestId("instant-raffle-dismiss"),
        }),
      });
    },
  },

  winnings: {
    async summary() {
      return request("/api/winnings/summary");
    },

    async claim(kind, id, requestId) {
      return request(`/api/winnings/${kind}/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId || createRequestId("winning-claim"),
        }),
      });
    },

    async dismiss(kind, id, requestId) {
      return request(`/api/winnings/${kind}/${id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId || createRequestId("winning-dismiss"),
        }),
      });
    },
  },

  cashback: {
    async status() {
      return request("/api/cashback/status");
    },
    async claim(goalType, requestId) {
      return request("/api/cashback/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalType,
          requestId: requestId || createRequestId("cashback-claim"),
        }),
      });
    },
  },

  home: {
    async summary() {
      return request("/api/home/summary");
    },

    async feedSummary() {
      return request("/api/home/feed-summary");
    },
  },

  notifications: {
    async recent({ limit = 50, signal } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      return request(`/api/notifications/recent?${params.toString()}`, { signal });
    },
  },

  platforms: {
    async summary(options = {}) {
      return request("/api/platforms/summary", {
        ...options,
        __omitAuthToken: true,
      });
    },
  },

  adminEvents: {
    liveDraws: {
      current() {
        return request("/api/admin/live-draws/current");
      },
      listParticipants(id, { limit = 2000 } = {}) {
        const search = new URLSearchParams();
        if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
          search.set("limit", String(limit));
        }
        const query = search.toString();
        return request(`/api/admin/live-draws/${id}/participants${query ? `?${query}` : ""}`);
      },
      create({ title, maxWinners, prizeAmount, adminName, adminPhone, requestId } = {}) {
        return request("/api/admin/live-draws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, maxWinners, prizeAmount, adminName, adminPhone, requestId: requestId || createRequestId("admin-live-create") }),
        });
      },
      update(id, { adminName, adminPhone, requestId } = {}) {
        return request(`/api/admin/live-draws/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminName, adminPhone, requestId: requestId || createRequestId("admin-live-update") }),
        });
      },
      draw(id, { winnerCount, requestId } = {}) {
        return request(`/api/admin/live-draws/${id}/draw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerCount, requestId: requestId || createRequestId("admin-live-draw") }),
        });
      },
      end(id, requestId) {
        return request(`/api/admin/live-draws/${id}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-live-end") }),
        });
      },
      updateParticipant(id, action, requestId) {
        return request(`/api/admin/live-draws/participants/${id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId(`admin-live-${action}`) }),
        });
      },
      clearParticipants(id, requestId) {
        return request(`/api/admin/live-draws/${id}/participants/clear`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-live-clear") }),
        });
      },
      removeParticipant(id) {
        return request(`/api/admin/live-draws/participants/${id}`, { method: "DELETE" });
      },
    },
    gameCalls: {
      current() {
        return request("/api/admin/game-calls/current");
      },
      listParticipants(id, { limit = 2000 } = {}) {
        const search = new URLSearchParams();
        if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
          search.set("limit", String(limit));
        }
        const query = search.toString();
        return request(`/api/admin/game-calls/${id}/participants${query ? `?${query}` : ""}`);
      },
      create({ title, prizeAmount, maxAttempts, maxWinners, adminName, adminPhone, requestId } = {}) {
        return request("/api/admin/game-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, prizeAmount, maxAttempts, maxWinners, adminName, adminPhone, requestId: requestId || createRequestId("admin-game-create") }),
        });
      },
      update(id, { maxAttempts, maxWinners, adminName, adminPhone, requestId } = {}) {
        return request(`/api/admin/game-calls/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxAttempts, maxWinners, adminName, adminPhone, requestId: requestId || createRequestId("admin-game-update") }),
        });
      },
      draw(id, { winnerCount, requestId } = {}) {
        return request(`/api/admin/game-calls/${id}/draw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerCount, requestId: requestId || createRequestId("admin-game-draw") }),
        });
      },
      end(id, requestId) {
        return request(`/api/admin/game-calls/${id}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-game-end") }),
        });
      },
      updateParticipant(id, action, requestId) {
        return request(`/api/admin/game-calls/participants/${id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId(`admin-game-${action}`) }),
        });
      },
      clearParticipants(id, requestId) {
        return request(`/api/admin/game-calls/${id}/participants/clear`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-game-clear") }),
        });
      },
      removeParticipant(id) {
        return request(`/api/admin/game-calls/participants/${id}`, { method: "DELETE" });
      },
    },
    instantRaffles: {
      listParticipants(id, { limit = 2000 } = {}) {
        const search = new URLSearchParams();
        if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
          search.set("limit", String(limit));
        }
        const query = search.toString();
        return request(`/api/admin/instant-raffles/${id}/participants${query ? `?${query}` : ""}`);
      },
      create(payload = {}) {
        return request("/api/admin/instant-raffles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, requestId: payload.requestId || createRequestId("admin-instant-create") }),
        });
      },
      update(id, payload = {}) {
        return request(`/api/admin/instant-raffles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, requestId: payload.requestId || createRequestId("admin-instant-update") }),
        });
      },
      draw(id, requestId) {
        return request(`/api/admin/instant-raffles/${id}/draw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-instant-draw") }),
        });
      },
      end(id, requestId) {
        return request(`/api/admin/instant-raffles/${id}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-instant-end") }),
        });
      },
      clone(id, requestId) {
        return request(`/api/admin/instant-raffles/${id}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-instant-clone") }),
        });
      },
      reactivate(id, participants = [], requestId) {
        return request(`/api/admin/instant-raffles/${id}/reactivate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants, requestId: requestId || createRequestId("admin-instant-reactivate") }),
        });
      },
      validateParticipant(id, validated, requestId) {
        return request(`/api/admin/instant-raffles/participants/${id}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validated, requestId: requestId || createRequestId("admin-instant-validate") }),
        });
      },
      removeParticipant(id) {
        return request(`/api/admin/instant-raffles/participants/${id}`, { method: "DELETE" });
      },
      delete(id) {
        return request(`/api/admin/instant-raffles/${id}`, { method: "DELETE" });
      },
    },
    depositDraws: {
      overview({ cycleId } = {}) {
        const search = new URLSearchParams();
        if (cycleId) search.set("cycleId", String(cycleId));
        const query = search.toString();
        return request(`/api/admin/deposit-draws/overview${query ? `?${query}` : ""}`);
      },
      draw(id, { prizeAmount, winnerCount, requestId } = {}) {
        return request(`/api/admin/deposit-draws/${id}/draw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prizeAmount, winnerCount, requestId: requestId || createRequestId("admin-deposit-draw") }),
        });
      },
      validateWinner(id, requestId) {
        return request(`/api/admin/deposit-draws/winners/${id}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-validate") }),
        });
      },
      deleteWinner(id) {
        return request(`/api/admin/deposit-draws/winners/${id}`, {
          method: "DELETE",
        });
      },
      complete(id, { winners = [], requestId } = {}) {
        return request(`/api/admin/deposit-draws/${id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winners,
            requestId: requestId || createRequestId("admin-deposit-complete"),
          }),
        });
      },
      resetTickets(id, requestId) {
        return request(`/api/admin/deposit-draws/${id}/reset-tickets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-reset") }),
        });
      },
    },
    depositCycles: {
      create({ drawDate, requestId } = {}) {
        return request("/api/admin/deposit-cycles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drawDate: drawDate || null,
            requestId: requestId || createRequestId("admin-deposit-cycle-create"),
          }),
        });
      },
      summary() {
        return request("/api/admin/deposit-cycles/summary");
      },
      totals(id) {
        return request(`/api/admin/deposit-cycles/${id}/totals`);
      },
      update(id, { drawDate, endDate, requestId } = {}) {
        return request(`/api/admin/deposit-cycles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drawDate,
            endDate,
            requestId: requestId || createRequestId("admin-deposit-cycle-update"),
          }),
        });
      },
      end(id, requestId) {
        return request(`/api/admin/deposit-cycles/${id}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-cycle-end") }),
        });
      },
      reactivate(id, requestId) {
        return request(`/api/admin/deposit-cycles/${id}/reactivate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-cycle-reactivate") }),
        });
      },
      delete(id, requestId) {
        return request(`/api/admin/deposit-cycles/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-cycle-delete") }),
        });
      },
    },
    profile: {
      syncPhone(phone, requestId) {
        return request("/api/profile/sync-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, requestId: requestId || createRequestId("profile-sync-phone") }),
        });
      },
      notifications({ limit = 50 } = {}) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        return request(`/api/profile/notifications?${params.toString()}`);
      },
      markNotificationsRead(ids = []) {
        return request("/api/profile/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      },
      publicBasics(ids = [], handles = [], options = {}) {
        const uniqueIds = Array.from(
          new Set((Array.isArray(ids) ? ids : []).map((item) => String(item || "").trim()).filter(Boolean))
        );
        const uniqueHandles = Array.from(
          new Set((Array.isArray(handles) ? handles : []).map((item) => String(item || "").trim().replace(/^@+/, "").toLowerCase()).filter(Boolean))
        );
        const params = new URLSearchParams();
        if (uniqueIds.length > 0) params.set("ids", uniqueIds.join(","));
        if (uniqueHandles.length > 0) params.set("handles", uniqueHandles.join(","));
        return request(`/api/profile/public-basics?${params.toString()}`, options);
      },
      publicDirectory({ limit = 24, offset = 0 } = {}, options = {}) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        return request(`/api/profile/public-directory?${params.toString()}`, options);
      },
      platformHistory({ limit = 100 } = {}) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        return request(`/api/profile/platform-history?${params.toString()}`);
      },
    },

    social: {
      async checkInState() {
        return request("/api/check-in/state");
      },

      async dailyCheckIn(requestId) {
        return request("/api/check-in/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("daily-checkin") }),
        });
      },

      async state(targetUserId = "me") {
        return request(`/api/social/state/${encodeURIComponent(targetUserId)}`);
      },

      async following({ limit = 24, offset = 0 } = {}) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        return request(`/api/social/following/my?${params.toString()}`);
      },

      async followers({ limit = 24, offset = 0 } = {}) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        return request(`/api/social/followers/my?${params.toString()}`);
      },

      async follow(targetUserId, requestId) {
        return request(`/api/social/follow/${encodeURIComponent(targetUserId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("social-follow") }),
        });
      },

      async unfollow(targetUserId, requestId) {
        return request(`/api/social/follow/${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("social-unfollow") }),
        });
      },

      async like(targetUserId, requestId) {
        return request(`/api/social/like/${encodeURIComponent(targetUserId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("social-like") }),
        });
      },

      async unlike(targetUserId, requestId) {
        return request(`/api/social/like/${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("social-unlike") }),
        });
      },

      async autoFollowCreator(requestId) {
        return request("/api/social/auto-follow-creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("social-auto-follow-creator") }),
        });
      },
    },
  },

  dailyChest: {
    async getState() {
      return request("/api/daily-chest/state");
    },

    async unlock(code) {
      return request("/api/daily-chest/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    },

    async open(slotType = "base") {
      return request("/api/daily-chest/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotType }),
      });
    },

    async claim() {
      return request("/api/daily-chest/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async getAdminSummary() {
      return request("/api/daily-chest/admin/summary");
    },
  },

  social: {
    async checkInState() {
      return request("/api/check-in/state");
    },

    async dailyCheckIn(requestId) {
      return request("/api/check-in/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("daily-checkin") }),
      });
    },

    async state(targetUserId = "me", options = {}) {
      return request(`/api/social/state/${encodeURIComponent(targetUserId)}`, options);
    },

    async following({ limit = 24, offset = 0 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return request(`/api/social/following/my?${params.toString()}`);
    },

    async followers({ limit = 24, offset = 0 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return request(`/api/social/followers/my?${params.toString()}`);
    },

    async discover({ limit = 12, offset = 0, sort = "recent" } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.set("sort", String(sort || "recent"));
      return request(`/api/social/discover?${params.toString()}`);
    },

    async follow(targetUserId, requestId) {
      return request(`/api/social/follow/${encodeURIComponent(targetUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-follow") }),
      });
    },

    async unfollow(targetUserId, requestId) {
      return request(`/api/social/follow/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-unfollow") }),
      });
    },

    async like(targetUserId, requestId) {
      return request(`/api/social/like/${encodeURIComponent(targetUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-like") }),
      });
    },

    async unlike(targetUserId, requestId) {
      return request(`/api/social/like/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-unlike") }),
      });
    },

    async autoFollowCreator(requestId) {
      return request("/api/social/auto-follow-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-auto-follow-creator") }),
      });
    },

    async autoLikeCreator(requestId) {
      return request("/api/social/auto-like-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId || createRequestId("social-auto-like-creator") }),
      });
    },
  },

  dynamics: {
    async summary() {
      return request("/api/dynamics/summary");
    },
  },

  ui: {
    async publicConfig(options = {}) {
      return request("/api/ui/public-config", {
        ...options,
        __omitAuthToken: true,
      });
    },
  },

  gamification: {
    async profileSummary(options = {}) {
      const params = new URLSearchParams();
      if (options?.force) params.set("force", "true");
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request(`/api/profile/summary${suffix}`, options);
    },

    async profileCompetitionBoard(options = {}) {
      const params = new URLSearchParams();
      if (options?.force) params.set("force", "true");
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request(`/api/profile/competition-board${suffix}`, options);
    },

    async profileMetrics(options = {}) {
      const params = new URLSearchParams();
      if (options?.force) params.set("force", "true");
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request(`/api/profile/metrics${suffix}`, options);
    },

    async publicProfileSummary(userId, options = {}) {
      return request(`/api/profile/public/${encodeURIComponent(userId)}/summary`, options);
    },

    async prizeGallery({ userId = "", limit = 3, offset = 0 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (userId) params.set("userId", String(userId));
      return request(`/api/profile/prize-gallery?${params.toString()}`);
    },

    async profileHistory(options = {}) {
      return request("/api/profile/history", options);
    },

    async winnersHistory(options = {}) {
      const params = new URLSearchParams();
      if (options.limitDays != null) params.set("limitDays", String(options.limitDays));
      if (options.skipDays != null) params.set("skipDays", String(options.skipDays));
      const query = params.toString();
      return request(query ? `/api/prizes/winners-history?${query}` : "/api/prizes/winners-history");
    },

    async feedWins() {
      return request("/api/feed/wins");
    },

    async feedLikes() {
      return request("/api/feed/likes");
    },

    async likeFeedPost(postId) {
      return request(`/api/feed/likes/${encodeURIComponent(postId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async weeklyLeaderboard() {
      return request("/api/leaderboards/weekly");
    },
  },

  adminGamification: {
    async overview() {
      return request("/api/admin/gamification/overview");
    },

    async rules() {
      return request("/api/admin/gamification/rules");
    },

    async saveRules(rules = []) {
      return request("/api/admin/gamification/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
    },

    async checkInConfig() {
      return request("/api/admin/gamification/checkin-config");
    },

    async saveCheckInConfig(payload = {}) {
      return request("/api/admin/gamification/checkin-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async weeklyConfig() {
      return request("/api/admin/gamification/weekly-config");
    },

    async saveWeeklyConfig(payload = {}) {
      return request("/api/admin/gamification/weekly-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async cycles() {
      return request("/api/admin/gamification/cycles");
    },

    async openCycle() {
      return request("/api/admin/gamification/cycles/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async closeCycle(id) {
      return request(`/api/admin/gamification/cycles/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async weeklyLeaderboard() {
      return request("/api/admin/leaderboards/weekly");
    },

    async weeklyResults(cycleId) {
      return request(`/api/admin/gamification/weekly-results/${cycleId}`);
    },

    async validateWeeklyWinner(cycleId, userId, action) {
      return request(`/api/admin/gamification/weekly-results/${cycleId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
    },
  },

  adminDailyChest: {
    async config() {
      return request("/api/admin/daily-chest/config");
    },

    async saveSettings(payload = {}) {
      return request("/api/admin/daily-chest/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async generateAccessCode(code = "") {
      return request("/api/admin/daily-chest/access-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    },

    async createReward(payload = {}) {
      return request("/api/admin/daily-chest/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async updateReward(id, payload = {}) {
      return request(`/api/admin/daily-chest/rewards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async deleteReward(id) {
      return request(`/api/admin/daily-chest/rewards/${id}`, {
        method: "DELETE",
      });
    },
  },

  adminUsers: {
    async list(params = {}) {
      const search = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "" || value === false) return;
        search.set(key, String(value));
      });
      const query = search.toString();
      return request(`/api/admin/users${query ? `?${query}` : ""}`);
    },

    async detail(id) {
      return request(`/api/admin/users/${encodeURIComponent(id)}`);
    },

    async history(id) {
      return request(`/api/admin/users/${encodeURIComponent(id)}/history`);
    },

    async adjustMetric(id, payload = {}) {
      return request(`/api/admin/users/${encodeURIComponent(id)}/adjust-metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestId: payload.requestId || createRequestId("admin-metric-adjust"),
        }),
      });
    },

    async resetMetrics(id, payload = {}) {
      return request(`/api/admin/users/${encodeURIComponent(id)}/reset-metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestId: payload.requestId || createRequestId("admin-user-reset"),
        }),
      });
    },

    async restoreLastReset(id, payload = {}) {
      return request(`/api/admin/users/${encodeURIComponent(id)}/restore-last-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestId: payload.requestId || createRequestId("admin-user-restore"),
        }),
      });
    },

    async recentAdjustments() {
      return request("/api/admin/users/adjustments/recent");
    },
  },

  adminAudit: {
    async listWinnerAudits({ limit = 300, signal } = {}) {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      return request(`/api/admin/audits/winners${params.toString() ? `?${params.toString()}` : ""}`, { signal });
    },
    async redeemWinnerAudit(auditId) {
      return request(`/api/admin/audits/winners/${encodeURIComponent(auditId)}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: createRequestId("admin-audit-redeem") }),
      });
    },
    async deleteWinnerAudit(auditId) {
      return request(`/api/admin/audits/winners/${encodeURIComponent(auditId)}`, {
        method: "DELETE",
      });
    },
  },

  liveDrawDisplay: {
    async current() {
      return request("/api/live-draws/current-display");
    },
  },

  integrations: {
    Core: {
      UploadFile: uploadFile,
      DeleteFile: deleteFile,
      async InvokeLLM() {
        throw new Error("InvokeLLM not implemented in local backend");
      },
      async SendEmail() {
        throw new Error("SendEmail not implemented in local backend");
      },
      async SendSMS() {
        throw new Error("SendSMS not implemented in local backend");
      },
      async GenerateImage() {
        throw new Error("GenerateImage not implemented in local backend");
      },
      async ExtractDataFromUploadedFile() {
        throw new Error("ExtractDataFromUploadedFile not implemented in local backend");
      },
    },
  },

  appLogs: {
    async logUserInApp(pageName) {
      const me = await base44.auth.me();
      return request("/api/logs/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageName, userId: me.id }),
      });
    },
  },
};
