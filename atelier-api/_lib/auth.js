import crypto from "node:crypto";

const PROFILE_HASH_ENV = {
  noelia: "ATELIER_PASSWORD_NOELIA",
  "ana-maria": "ATELIER_PASSWORD_ANA_MARIA",
  irene: "ATELIER_PASSWORD_IRENE"
};

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function verifyPasswordRecord(password, record) {
  if (!record || !record.startsWith("scrypt$")) return false;
  const [, nS, rS, pS, saltB64, hashB64] = record.split("$");
  const n = Number(nS), r = Number(rS), p = Number(pS);
  if (!n || !r || !p || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(password, salt, expected.length, { N: n, r, p });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function getProfilePasswordHash(profileId) {
  const envName = PROFILE_HASH_ENV[profileId];
  return envName ? process.env[envName] : null;
}

export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function issueSession(profileId) {
  const secret = process.env.ATELIER_SESSION_SECRET;
  if (!secret) throw new Error("ATELIER_SESSION_SECRET is not configured");
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: profileId, iat: now, exp: now + SESSION_SECONDS };
  const encoded = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return encoded + "." + sig;
}

export function verifySession(req) {
  const secret = process.env.ATELIER_SESSION_SECRET;
  if (!secret) return null;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!timingSafeEqualString(sig, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { return null; }
  if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
