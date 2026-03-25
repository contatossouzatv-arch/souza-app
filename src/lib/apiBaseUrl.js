const DEV_API_BASE_URL = "http://localhost:3011";

function normalizeBaseUrl(value = "") {
  return String(value || "").trim().replace(/\/$/, "");
}

function getWindowHostname() {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").toLowerCase();
}

function isLocalHostname(hostname = "") {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBaseUrl() {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const mode = String(import.meta.env.MODE || "").toLowerCase();
  const hostname = getWindowHostname();
  const isDevelopment = mode === "development" || isLocalHostname(hostname);

  if (isDevelopment) return configured || DEV_API_BASE_URL;
  if (configured) return configured;

  throw new Error("VITE_API_BASE_URL is required in production");
}

export function buildApiUrl(path = "") {
  return `${resolveApiBaseUrl()}${String(path || "")}`;
}
