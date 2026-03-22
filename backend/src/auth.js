import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "./config/env.js";

const accessTtl = `${Math.max(1, Number(env.accessTokenTtlMin || 15))}m`;
const refreshTtlDays = Math.max(1, Number(env.refreshTokenTtlDays || 30));

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role || "user",
      email: user.email,
    },
    env.jwtAccessSecret,
    { expiresIn: accessTtl }
  );
}

export function parseAccessToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtAccessSecret);
  } catch {
    return null;
  }
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function buildRefreshExpiryDate() {
  const now = Date.now();
  return new Date(now + refreshTtlDays * 24 * 60 * 60 * 1000).toISOString();
}

// Backward compatibility for existing imports.
export const signToken = signAccessToken;
export const parseToken = parseAccessToken;
