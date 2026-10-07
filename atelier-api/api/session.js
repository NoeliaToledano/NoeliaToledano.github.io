import { verifySession } from "../_lib/auth.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://noeliatoledano.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido." });
  const session = verifySession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, profileId: session.sub, exp: session.exp });
}
