import { verifySession } from "../_lib/auth.js";

export default async function handler(req, res) {
  const allowedOrigins = new Set([
    "https://noeliatoledano.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ]);
  const origin = req.headers.origin || "";
  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });

  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "Sesión no válida o caducada." });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Atelier AI aún no tiene configurada la clave de OpenAI." });
  }

  try {
    const { image } = req.body || {};
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Falta una imagen válida." });
    }
    if (image.length > 8_000_000) {
      return res.status(413).json({ error: "La imagen es demasiado grande. Haz una foto con menor resolución." });
    }

    const prompt = [
      "Cataloga la prenda de la foto. No inventes marca ni detalles no visibles; usa null si dudas.",
      "Responde SOLO JSON en español con estas claves y valores:",
      'name: nombre corto; type: top|bottom|dress|outerwear|shoes|bag|accessory|homewear|underwear|swimwear; color: Negro|Blanco|Gris|Beige|Marrón|Azul|Vaquero|Verde|Rojo|Rosa|Morado|Amarillo|Plateado|Dorado|Multicolor; style: casual|smart|party|sport; season: all|warm|cold; fabric: unknown|cotton|denim|linen|wool|knit|leather|satin|silk|synthetic|mixed; pattern: plain|stripes|checks|floral|animal|dots|graphic|other; length: na|cropped|regular|midi|long; formality: casual|smartcasual|formal|party|sport; occasions: lista de daily|work|sport|beach|home|event|party|formal; notes: máx 10 palabras o ""',
      'Añade garmentType con el tipo exacto seleccionado de esta lista (null si no se distingue): Arriba=Camiseta|Camisa|Blusa|Top|Crop top|Jersey|Sudadera|Polo|Body|Camiseta técnica; Abajo=Vaqueros|Pantalón|Leggings|Mallas deportivas|Shorts|Falda|Pantalón deportivo; Vestidos=Vestido corto|Vestido midi|Vestido largo|Mono corto|Mono largo|Enterizo|Peto; Capas=Blazer|Chaqueta|Cazadora|Abrigo|Gabardina|Chaleco|Cárdigan; Zapatos=Deportivas|Zapatos|Botas|Botines|Sandalias|Tacones|Mocasines|Bailarinas|Alpargatas|Zuecos|Zapatillas de casa; Bolsos=Bolso de mano|Bolso de hombro|Bandolera|Mochila|Bolso de fiesta; Accesorios=Cinturón|Gafas de sol|Gafas|Pañuelo|Bufanda|Guantes|Gorro|Sombrero|Collar|Pendientes|Pulsera|Anillo|Joyería|Reloj|Corbata|Pajarita|Diadema|Pinza de pelo|Coletero|Accesorio de pelo; Casa=Pijama|Camisón|Bata|Conjunto de estar en casa; Baño=Bañador|Bikini|Top de bikini|Braguita de bikini|Trikini|Short de baño|Pareos|Salida de baño. garmentType debe corresponder con type (categoría general).',
      'Usa solo ocasiones generales: sport incluye gimnasio, yoga, pilates, running y senderismo; beach incluye playa y piscina; home incluye dormir. Pijamas y batas: home; bañadores: beach. No uses travel ni holiday.',
      'Para pijama, camisón o bata usa type homewear y categoría Casa. Para ropa interior íntima, calcetines y medias usa type underwear porque Atelier no las admite. Crop top es top/Arriba, no underwear. Para Baño usa type swimwear; el estilo sport puede aplicarse a cualquier categoría y no cambia la categoría. Un body se clasifica como top/Arriba y garmentType Body; un mono o enterizo (prenda de una pieza con perneras) como dress/Vestidos y garmentType Mono corto, Mono largo o Enterizo. No confundirlos con vestidos.',
      'Si son visibles, añade también subtype (tipo específico), secondaryColor, fit (oversize|holgado|regular|entallado|ajustado|recto), sleeve (sin mangas|corta|tres cuartos|larga|no aplica), neckline (redondo|pico|camisero|alto|barco|palabra de honor|no aplica), thickness (ligero|medio|grueso), warmth (bajo|medio|alto), details (máx. 8 palabras) y confidence (alta|media|baja). Omite lo que no se pueda reconocer con fiabilidad; no adivines la composición ni la marca.'
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image, detail: "low" }
          ]
        }],
        max_output_tokens: 350
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI error", response.status, data);
      return res.status(502).json({ error: "La IA no ha podido analizar la prenda.", detail: data?.error?.message || null });
    }

    const text = data.output_text || (data.output || [])
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text)
      .join("\n");

    const cleaned = String(text || "").replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Respuesta JSON no válida.");
    const garment = JSON.parse(cleaned.slice(start, end + 1));

    return res.status(200).json({ garment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error interno analizando la prenda." });
  }
}
