import { parseToken } from "../auth.js";
import { env } from "../config/env.js";

function parseCookies(rawCookie = "") {
  const input = String(rawCookie || "").trim();
  if (!input) return {};

  return input.split(";").reduce((acc, chunk) => {
    const [rawName, ...rawValue] = chunk.split("=");
    const name = String(rawName || "").trim();
    if (!name) return acc;
    acc[name] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {});
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies[env.authAccessCookieName] || null;
  const token = bearerToken || cookieToken;
  const payload = parseToken(token);

  console.log("[DEBUG AUTH HEADERS]", {
    path: req.originalUrl,
    authorization: req.headers.authorization || null,
    cookie: req.headers.cookie || null,
  });

  console.info("[auth-check]", {
    path: req.originalUrl,
    method: req.method,
    hasAuth: Boolean(req.headers.authorization),
    hasAccessCookie: Boolean(cookieToken),
    userId: payload?.sub || null,
  });

  if (!payload?.sub) {
    console.warn("[auth-backend] requireAuth denied", {
      path: req.originalUrl,
      method: req.method,
      hasAuthorizationHeader: Boolean(bearerToken),
      hasCookieHeader: Boolean(req.headers.cookie),
      hasAccessCookie: Boolean(cookieToken),
    });
    return res.status(401).json({ error: "Authentication required" });
  }

  req.auth = payload;
  req.authSource = bearerToken ? "bearer" : "cookie";
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.auth?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (String(req.auth.role || "user") !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}
