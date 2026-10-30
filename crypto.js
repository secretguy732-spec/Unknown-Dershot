// Semua kripto memakai Web Crypto (sama di Cloudflare Workers dan Node >= 20).
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64Url(str) {
  const p = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
export const randomId = (n = 16) => toB64Url(crypto.getRandomValues(new Uint8Array(n)));

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function hmacHex(secret, message) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message));
  return toHex(new Uint8Array(sig));
}

// Perbandingan waktu-konstan (panjang berbeda pun tidak short-circuit).
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// PIN: HMAC dengan pepper rahasia. Ruang PIN cuma 10.000, jadi hash polos trivial di-brute-force
// kalau database bocor; pepper hidup di secret Worker, bukan di database.
export const hashPin = (pepper, episodeId, pin) => hmacHex(pepper, `dershot:pin:v1:${episodeId}:${pin}`);
export async function verifyPin(pepper, episodeId, pin, storedHash) {
  return safeEqual(await hashPin(pepper, episodeId, pin), storedHash || '');
}

// Token bertanda tangan (cookie unlock & sesi admin)
export async function signToken(secret, label, payload) {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmacHex(secret, `${label}.${body}`)}`;
}
export async function verifyToken(secret, label, token, nowSec) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEqual(await hmacHex(secret, `${label}.${body}`), sig)) return null;
  try {
    const payload = JSON.parse(dec.decode(fromB64Url(body)));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    return payload;
  } catch { return null; }
}

// AES-256-GCM untuk solution_enc, diikat ke id episode lewat AAD.
async function aesKey(b64) {
  const raw = fromB64Url(b64);
  if (raw.length !== 32) throw new Error('DATA_KEY harus 32 byte (base64url)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(dataKey, obj, aad = '') {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    await aesKey(dataKey), enc.encode(JSON.stringify(obj)));
  return `v1.${toB64Url(iv)}.${toB64Url(new Uint8Array(ct))}`;
}
export async function open(dataKey, sealed, aad = '') {
  const [v, iv, ct] = String(sealed).split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('format segel tidak dikenal');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64Url(iv), additionalData: enc.encode(aad) },
    await aesKey(dataKey), fromB64Url(ct));
  return JSON.parse(dec.decode(pt));
}

// Password admin: PBKDF2-SHA256 (100.000 iterasi = batas Workers).
export async function hashPassword(password, iterations = 100000, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${toB64Url(salt)}$${toB64Url(new Uint8Array(bits))}`;
}
export async function verifyPassword(password, stored, maxIterations = 100000) {
  const [scheme, iter, salt, hash] = String(stored).split('$');
  const iterations = Number(iter);
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1000 || iterations > maxIterations) return false;
  const again = await hashPassword(password, iterations, fromB64Url(salt));
  return safeEqual(again.split('$')[3], hash);
}
// Pengganti agar login dengan email tak dikenal memakan waktu sama dengan email valid.
export const DUMMY_PASSWORD_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
