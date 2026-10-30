import { HttpError } from './lib/http.js';
import { parseEpoch } from './lib/schedule.js';

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };

export const DEFAULT_FALLBACK = {
  title: 'Sinyal terputus',
  message: 'Perangkat ini kehilangan sambungan ke arsipnya. Transmisi tetap berjalan menurut jadwal; coba lagi sebentar lagi.',
};

export function loadConfig(env) {
  for (const k of ['ANSWER_PEPPER', 'SESSION_SECRET', 'DATA_KEY', 'EPOCH_UTC']) {
    if (!env[k]) throw new HttpError(500, 'SERVER_MISCONFIGURED', 'Konfigurasi server belum lengkap.');
  }
  if (String(env.ANSWER_PEPPER).length < 24 || String(env.SESSION_SECRET).length < 24) {
    throw new HttpError(500, 'SERVER_MISCONFIGURED', 'Konfigurasi server belum lengkap.');
  }
  let epoch;
  try { epoch = parseEpoch(env.EPOCH_UTC); } catch { throw new HttpError(500, 'SERVER_MISCONFIGURED', 'Konfigurasi server belum lengkap.'); }
  const secure = String(env.COOKIE_SECURE ?? 'true') !== 'false';
  const prefix = secure ? '__Host-' : '';
  return {
    epoch, secure,
    pepper: env.ANSWER_PEPPER, sessionSecret: env.SESSION_SECRET, dataKey: env.DATA_KEY,
    cookies: { unlock: `${prefix}ds_unlock`, device: `${prefix}ds_dev`, admin: `${prefix}ds_admin` },
    hint1After: num(env.HINT1_AFTER_HOURS, 12) * 3600,
    hint2After: num(env.HINT2_AFTER_HOURS, 30) * 3600,
    rate: { free: Math.max(2, num(env.RL_FREE_ATTEMPTS, 5)), base: 30, cap: 3600, windowSec: 21600 },
    globalPerHour: num(env.RL_GLOBAL_PER_HOUR, 600),
    adminSessionSec: 2 * 3600,
  };
}
