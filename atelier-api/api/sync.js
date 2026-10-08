import { verifySession } from "../_lib/auth.js";
import { cors, keys, pipeline, saveIfRev, storeConfigured } from "../_lib/store.js";

// GET  /api/sync → { rev, updatedAt, data, images }   (armario sin fotos + ids de fotos guardadas)
// PUT  /api/sync   { baseRev, data } → { rev }         (409 si otro dispositivo guardó antes)
const MAX_STATE_BYTES = 1_500_000;

export default async function handler(req, res) {
  cors(req, res, "GET, PUT");
  if (req.method === "OPTIONS") return res.status(204).end();
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Sesión no válida o caducada." });
  if (!storeConfigured()) return res.status(503).json({ error: "La sincronización no está configurada en el servidor." });
  const profile = session.sub, k = keys(profile);

  try {
    if (req.method === "GET") {
      const [rev, state, images] = await pipeline([["GET", k.rev], ["GET", k.state], ["SMEMBERS", k.images]]);
      const parsed = state ? JSON.parse(state) : null;
      return res.status(200).json({ rev: Number(rev) || 0, updatedAt: parsed?.updatedAt || null, data: parsed?.data || null, images: images || [] });
    }

    if (req.method === "PUT") {
      const { baseRev, data } = req.body || {};
      if (!Number.isInteger(baseRev) || baseRev < 0 || !data || typeof data !== "object" || !Array.isArray(data.garments)) {
        return res.status(400).json({ error: "Datos de sincronización no válidos." });
      }
      // El estado nunca lleva fotos: van aparte por /api/sync-image.
      data.garments = data.garments.map(({ image, ...g }) => g);
      const stateJson = JSON.stringify({ updatedAt: new Date().toISOString(), data });
      if (Buffer.byteLength(stateJson) > MAX_STATE_BYTES) return res.status(413).json({ error: "El armario es demasiado grande para sincronizar." });

      const saved = await saveIfRev(profile, baseRev, stateJson);
      if (!saved.ok) return res.status(409).json({ error: "Otro dispositivo ha guardado cambios.", rev: saved.rev });

      // Borra del servidor las fotos de prendas que ya no existen.
      const keep = new Set(data.garments.map(g => String(g.id)));
      const [stored] = await pipeline([["SMEMBERS", k.images]]);
      const orphans = (stored || []).filter(id => !keep.has(id));
      if (orphans.length) await pipeline([["DEL", ...orphans.map(k.image)], ["SREM", k.images, ...orphans]]);

      return res.status(200).json({ rev: saved.rev });
    }

    return res.status(405).json({ error: "Método no permitido." });
  } catch (error) {
    console.error("SYNC", error);
    return res.status(500).json({ error: "Error interno de sincronización." });
  }
}
