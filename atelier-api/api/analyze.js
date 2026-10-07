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
      "Analiza la prenda de la imagen como un catalogador experto de moda.",
      "No inventes marca, material ni detalles que no puedan inferirse visualmente.",
      "Devuelve SOLO JSON válido, sin markdown ni texto adicional.",
      "Los valores deben estar en español.",
      "Usa null cuando no puedas determinar un valor con confianza.",
      "Formato exacto:",
      JSON.stringify({
        name: "nombre corto y útil de la prenda",
        type: "top|bottom|dress|outerwear|shoes|bag|accessory",
        color: "Negro|Blanco|Gris|Beige|Marrón|Azul|Vaquero|Verde|Rojo|Rosa|Morado|Amarillo|Plateado|Dorado|Multicolor",
        style: "basic|casual|smart|party|sport",
        season: "all|warm|cold",
        fabric: "unknown|cotton|denim|linen|wool|knit|leather|satin|silk|synthetic|mixed",
        pattern: "plain|stripes|checks|floral|animal|dots|graphic|other",
        length: "na|cropped|regular|midi|long",
        formality: "casual|smartcasual|formal|party|sport",
        occasions: ["daily","work","dinner","event","travel"],
        notes: "una frase breve con detalles visibles útiles o cadena vacía",
        confidence: 0.0
      })
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }],
        max_output_tokens: 700
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
