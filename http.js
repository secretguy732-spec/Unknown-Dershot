export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export const ok = (data, status = 200, headers) => json({ ok: true, data }, status, headers);
export const fail = (status, code, message, extra = {}, headers) =>
  json({ ok: false, error: { code, message, ...extra } }, status, headers);

export function withCookies(res, cookies = []) {
  for (const c of cookies) res.headers.append('set-cookie', c);
  return res;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
export function serializeCookie(name, value, { maxAge, secure = true, sameSite = 'Strict', path = '/', httpOnly = true } = {}) {
  let c = `${name}=${value}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
  return c;
}

export async function readJson(request, maxBytes = 2048) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Gunakan application/json.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Permintaan terlalu besar.');
  let data;
  try { data = JSON.parse(text); } catch { throw new HttpError(400, 'INVALID_JSON', 'JSON tidak valid.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'INVALID_JSON', 'Body harus berupa objek JSON.');
  return data;
}

export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
  "connect-src 'self'", "font-src 'self'", "manifest-src 'self'", "base-uri 'none'",
  "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

export function withSecurityHeaders(res, { secure = true } = {}) {
  const r = new Response(res.body, res);
  r.headers.set('content-security-policy', CSP);
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'no-referrer');
  r.headers.set('x-frame-options', 'DENY');
  r.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  r.headers.set('cross-origin-opener-policy', 'same-origin');
  if (secure) r.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return r;
}
