// Almacenamiento del armario en Upstash Redis (REST, sin dependencias).
// Variables: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//            (o KV_REST_API_URL + KV_REST_API_TOKEN, que crea la integración de Vercel).

const url = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const storeConfigured = () => Boolean(url() && token());

async function call(path, body) {
  const r = await fetch(url().replace(/\/$/, "") + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error("STORE_" + r.status + (data?.error ? ": " + data.error : ""));
  return data;
}

// Un comando: ["GET","clave"] → resultado
export async function redis(command) {
  const data = await call("", command);
  if (data.error) throw new Error("STORE: " + data.error);
  return data.result;
}

// Varios comandos en una sola petición → lista de resultados
export async function pipeline(commands) {
  const data = await call("/pipeline", commands);
  return data.map(x => {
    if (x.error) throw new Error("STORE: " + x.error);
    return x.result;
  });
}

// Claves por perfil
export const keys = profile => ({
  rev: `atelier:v1:${profile}:rev`,
  state: `atelier:v1:${profile}:state`,
  images: `atelier:v1:${profile}:images`,
  image: id => `atelier:v1:${profile}:img:${id}`
});

// Guarda el estado solo si nadie lo ha cambiado desde baseRev (comprobación atómica en Redis).
const CAS_SCRIPT = `
local rev = tonumber(redis.call('GET', KEYS[1]) or '0')
if rev ~= tonumber(ARGV[1]) then return {0, rev} end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[1], rev + 1)
return {1, rev + 1}`;

export async function saveIfRev(profile, baseRev, stateJson) {
  const k = keys(profile);
  const [ok, rev] = await redis(["EVAL", CAS_SCRIPT, "2", k.rev, k.state, String(baseRev), stateJson]);
  return { ok: Number(ok) === 1, rev: Number(rev) };
}

// CORS común para la app publicada en GitHub Pages y pruebas locales
const allowedOrigins = new Set(["https://noeliatoledano.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
export function cors(req, res, methods) {
  const origin = req.headers.origin || "";
  if (allowedOrigins.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods + ", OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}
