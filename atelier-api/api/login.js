import { getProfilePasswordHash, issueSession, verifyPasswordRecord, SESSION_SECONDS } from "../_lib/auth.js";

import { cors, failures, storeConfigured } from "../_lib/store.js";

// Límite de intentos (#48): en Redis, compartido entre instancias de Vercel. Sin Redis, en memoria (solo orientativo).
const attempts = new Map();
const MAX_ATTEMPTS = 5, MAX_PER_PROFILE = 20;
const WINDOW_S = 5 * 60;

function clientIp(req) {
  // x-real-ip y x-vercel-forwarded-for los pone Vercel; x-forwarded-for puede venir manipulado
  return String(req.headers["x-real-ip"] || req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 64);
}
async function rateState(ip, profileId) {
  if (!storeConfigured()) {
    const it = attempts.get(ip + ":" + profileId), now = Date.now();
    if (!it || now - it.at > WINDOW_S * 1000) return { blocked: false };
    return it.count >= MAX_ATTEMPTS ? { blocked: true, retryAfter: Math.ceil(WINDOW_S - (now - it.at) / 1000) } : { blocked: false };
  }
  const [one, all] = await Promise.all([failures(ip + ":" + profileId, "get"), failures("profile:" + profileId, "get")]);
  if (one.count >= MAX_ATTEMPTS) return { blocked: true, retryAfter: Math.max(1, one.ttl) };
  if (all.count >= MAX_PER_PROFILE) return { blocked: true, retryAfter: Math.max(1, all.ttl) };
  return { blocked: false };
}
async function recordFailure(ip, profileId) {
  if (!storeConfigured()) {
    const k = ip + ":" + profileId, it = attempts.get(k), now = Date.now();
    if (!it || now - it.at > WINDOW_S * 1000) attempts.set(k, { count: 1, at: now }); else it.count++;
    return;
  }
  await Promise.all([failures(ip + ":" + profileId, "add", WINDOW_S), failures("profile:" + profileId, "add", WINDOW_S)]);
}
async function clearFailures(ip, profileId) {
  attempts.delete(ip + ":" + profileId);
  if (storeConfigured()) await failures(ip + ":" + profileId, "clear");
}

export default async function handler(req, res) {
  cors(req, res, "POST");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });

  const { profileId, password } = req.body || {};
  if (!["noelia","ana-maria","irene","eva","virginia"].includes(profileId) || typeof password !== "string") {
    return res.status(400).json({ error: "Credenciales no válidas." });
  }

  const ip = clientIp(req);
  let rate = { blocked: false };
  try { rate = await rateState(ip, profileId); } catch (e) { console.error("LOGIN_RATE", e.message); }
  if (rate.blocked) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    return res.status(429).json({ error: "Demasiados intentos. Inténtalo más tarde." });
  }

  const record = getProfilePasswordHash(profileId);
  if (!record) return res.status(503).json({ error: "Este perfil aún no está configurado en el servidor." });

  const ok = verifyPasswordRecord(password, record);
  if (!ok) {
    try { await recordFailure(ip, profileId); } catch (e) { console.error("LOGIN_RATE", e.message); }
    await new Promise(r => setTimeout(r, 350));
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  await clearFailures(ip, profileId).catch(e => console.error("LOGIN_RATE", e.message));
  const token = issueSession(profileId);
  return res.status(200).json({ token, profileId, expiresIn: SESSION_SECONDS });
}
