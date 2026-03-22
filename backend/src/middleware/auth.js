import { parseToken } from "../auth.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = parseToken(token);

  if (!payload?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.auth = payload;
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
