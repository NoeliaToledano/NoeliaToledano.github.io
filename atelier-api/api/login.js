import { getProfilePasswordHash, issueSession, verifyPasswordRecord } from "../_lib/auth.js";

const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

function rateKey(req, profileId) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  return ip + ":" + profileId;
}

function checkRateLimit(key) {
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || now - item.startedAt > WINDOW_MS) {
    attempts.set(key, { count: 0, startedAt: now });
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  if (item.count >= MAX_ATTEMPTS) return { blocked: true, retryAfterMs: WINDOW_MS - (now - item.startedAt) };
  return { blocked: false, remaining: MAX_ATTEMPTS - item.count };
}

function recordFailure(key) {
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || now - item.startedAt > WINDOW_MS) attempts.set(key, { count: 1, startedAt: now });
  else item.count += 1;
}

function clearFailures(key) { attempts.delete(key); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://noeliatoledano.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });

  const { profileId, password } = req.body || {};
  if (!["noelia","ana-maria","irene"].includes(profileId) || typeof password !== "string") {
    return res.status(400).json({ error: "Credenciales no válidas." });
  }

  const key = rateKey(req, profileId);
  const rate = checkRateLimit(key);
  if (rate.blocked) {
    res.setHeader("Retry-After", Math.ceil(rate.retryAfterMs / 1000));
    return res.status(429).json({ error: "Demasiados intentos. Inténtalo más tarde." });
  }

  const record = getProfilePasswordHash(profileId);
  if (!record) return res.status(503).json({ error: "Este perfil aún no está configurado en el servidor." });

  const ok = verifyPasswordRecord(password, record);
  if (!ok) {
    recordFailure(key);
    await new Promise(r => setTimeout(r, 350));
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  clearFailures(key);
  const token = issueSession(profileId);
  return res.status(200).json({ token, profileId, expiresIn: 43200 });
}
