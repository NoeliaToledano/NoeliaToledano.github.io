import { verifySession, issueSession, RENEW_AFTER_SECONDS, SESSION_SECONDS } from "../_lib/auth.js";
import { cors } from "../_lib/store.js";

export default function handler(req, res) {
  cors(req, res, "GET");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido." });
  const session = verifySession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  const out = { authenticated: true, profileId: session.sub, exp: session.exp };
  // Renovación deslizante (B4): si la sesión tiene más de 7 días, se entrega una nueva de 30 días.
  if (!session.iat || Math.floor(Date.now() / 1000) - session.iat > RENEW_AFTER_SECONDS) {
    try { out.token = issueSession(session.sub); out.expiresIn = SESSION_SECONDS; } catch (e) { console.error("SESSION_RENEW", e.message); }
  }
  return res.status(200).json(out);
}
