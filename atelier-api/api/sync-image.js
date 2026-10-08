import { verifySession } from "../_lib/auth.js";
import { cors, keys, pipeline, redis, storeConfigured } from "../_lib/store.js";

// GET  /api/sync-image?id=… → { image }
// POST /api/sync-image  { id, image } → { ok }
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const IMAGE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 2_000_000;

export default async function handler(req, res) {
  cors(req, res, "GET, POST");
  if (req.method === "OPTIONS") return res.status(204).end();
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Sesión no válida o caducada." });
  if (!storeConfigured()) return res.status(503).json({ error: "La sincronización no está configurada en el servidor." });
  const k = keys(session.sub);

  try {
    if (req.method === "GET") {
      const id = String(req.query?.id || "");
      if (!ID.test(id)) return res.status(400).json({ error: "Identificador no válido." });
      const image = await redis(["GET", k.image(id)]);
      if (!image) return res.status(404).json({ error: "Foto no encontrada." });
      return res.status(200).json({ image });
    }

    if (req.method === "POST") {
      const { id, image } = req.body || {};
      if (!ID.test(String(id || ""))) return res.status(400).json({ error: "Identificador no válido." });
      if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE.test(image)) {
        return res.status(400).json({ error: "Foto no válida o demasiado grande." });
      }
      await pipeline([["SET", k.image(id), image], ["SADD", k.images, id]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido." });
  } catch (error) {
    console.error("SYNC_IMAGE", error);
    return res.status(500).json({ error: "Error interno guardando la foto." });
  }
}
