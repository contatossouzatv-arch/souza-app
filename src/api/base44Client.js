const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3011").replace(/\/$/, "");
const TOKEN_KEY = "souza_local_token";
const REFRESH_TOKEN_KEY = "souza_local_refresh_token";

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

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
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

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      const api = new URL(API_BASE_URL);
      const uploadLikePath =
        parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/uploads/");

      if (uploadLikePath && parsed.host !== api.host) {
        parsed.protocol = api.protocol;
        parsed.host = api.host;
        return parsed.toString();
      }

      if (isLocalHost(parsed.hostname) && !isLocalHost(api.hostname)) {
        parsed.protocol = api.protocol;
        parsed.host = api.host;
        return parsed.toString();
      }

      return parsed.toString();
    }
  } catch {
    // ignore parse error and fallback to API base
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return `${API_BASE_URL}/${value.replace(/^\/+/, "")}`;
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

async function tryRefreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        setToken(null);
        setRefreshToken(null);
        return false;
      }
      const data = await response.json();
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      return Boolean(data?.token);
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const skipRefresh =
    Boolean(options.__skipAuthRefresh) || path === "/api/auth/refresh" || path === "/api/auth/login";

  if (response.status === 401 && !skipRefresh && hasToken() && getRefreshToken()) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      const retryHeaders = { ...(options.headers || {}) };
      const retryToken = getToken();
      if (retryToken) retryHeaders.Authorization = `Bearer ${retryToken}`;
      response = await fetch(buildUrl(path), {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return parseResponse(response);
}

async function requestBlob(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const skipRefresh =
    Boolean(options.__skipAuthRefresh) || path === "/api/auth/refresh" || path === "/api/auth/login";

  if (response.status === 401 && !skipRefresh && hasToken() && getRefreshToken()) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      const retryHeaders = { ...(options.headers || {}) };
      const retryToken = getToken();
      if (retryToken) retryHeaders.Authorization = `Bearer ${retryToken}`;
      response = await fetch(buildUrl(path), {
        ...options,
        headers: retryHeaders,
      });
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
    throw error;
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

    async me() {
      return request("/api/auth/me");
    },

    async login({ email, password, otp }) {
      const data = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, otp }),
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      return data;
    },

    async register({ email, password, full_name, nick, phone }) {
      const data = await request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name, nick, phone }),
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      return data;
    },

    async loginWithGoogle(credential, otp) {
      const data = await request("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, otp }),
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      return data;
    },

    async updateMe(payload = {}) {
      return request("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
      return data;
    },

    async logoutAll() {
      return request("/api/auth/logout-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        __skipAuthRefresh: true,
      });
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
          body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
      }
      setToken(null);
      setRefreshToken(null);
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
      });
      setToken(data?.token || null);
      setRefreshToken(data?.refreshToken || null);
      return data;
    },
  },

  entities: entitiesProxy,

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

    async my() {
      return request("/api/deposits/my");
    },

    async adminList({ status = "", cycleId = "", limit } = {}) {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (cycleId) params.set("cycleId", cycleId);
      if (limit) params.set("limit", String(limit));
      return request(`/api/admin/deposits${params.toString() ? `?${params.toString()}` : ""}`);
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

  adminEvents: {
    liveDraws: {
      create({ title, maxWinners, prizeAmount, requestId } = {}) {
        return request("/api/admin/live-draws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, maxWinners, prizeAmount, requestId: requestId || createRequestId("admin-live-create") }),
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
      create({ title, prizeAmount, maxAttempts, maxWinners, requestId } = {}) {
        return request("/api/admin/game-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, prizeAmount, maxAttempts, maxWinners, requestId: requestId || createRequestId("admin-game-create") }),
        });
      },
      update(id, { maxAttempts, maxWinners, requestId } = {}) {
        return request(`/api/admin/game-calls/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxAttempts, maxWinners, requestId: requestId || createRequestId("admin-game-update") }),
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
      complete(id, requestId) {
        return request(`/api/admin/deposit-draws/${id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId || createRequestId("admin-deposit-complete") }),
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
    profile: {
      syncPhone(phone, requestId) {
        return request("/api/profile/sync-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, requestId: requestId || createRequestId("profile-sync-phone") }),
        });
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

      async following() {
        return request("/api/social/following/my");
      },

      async followers() {
        return request("/api/social/followers/my");
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

    async state(targetUserId = "me") {
      return request(`/api/social/state/${encodeURIComponent(targetUserId)}`);
    },

    async following() {
      return request("/api/social/following/my");
    },

    async followers() {
      return request("/api/social/followers/my");
    },

    async discover({ limit = 12, offset = 0 } = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
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

  gamification: {
    async profileMetrics() {
      return request("/api/profile/metrics");
    },

    async profileHistory() {
      return request("/api/profile/history");
    },

    async feedWins() {
      return request("/api/feed/wins");
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
    async deleteWinnerAudit(auditId) {
      return request(`/api/admin/audits/winners/${encodeURIComponent(auditId)}`, {
        method: "DELETE",
      });
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
