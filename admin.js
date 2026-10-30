// Endpoint admin (/api/admin/*). Semua selain /login memerlukan sesi admin yang valid (server-side);
// semua metode non-GET juga memerlukan header CSRF dan Origin yang cocok.
import { HttpError, ok, withCookies, parseCookies, serializeCookie, readJson } from './lib/http.js';
import { hashPin, verifyPin, seal, open, signToken, verifyToken, verifyPassword, hmacHex, randomId, safeEqual, DUMMY_PASSWORD_HASH } from './lib/crypto.js';
import { windowForSeq, episodeId, toIso } from './lib/schedule.js';
import { isEmail, normalizePin, parseEpisodeRef } from './lib/normalize.js';
import { validateUnlockContent, parseContent, aggregateContent } from './content.js';

const STATUSES = ['draft', 'published', 'retired'];
const str = (v, max, name, { min = 1 } = {}) => {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max) throw new HttpError(400, 'INVALID_INPUT', `Field "${name}" tidak valid (1–${max} karakter).`);
  return v;
};

export async function handleAdmin(ctx) {
  const { request, path, cfg, store, nowSec } = ctx;
  const m = request.method;
  const sub = path.slice('/api/admin'.length + 1);

  if (sub === 'login') {
    if (m !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
    return login(ctx);
  }

  const admin = await requireAdmin(ctx);
  if (m !== 'GET' && m !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== ctx.url.origin) throw new HttpError(403, 'FORBIDDEN', 'Origin tidak diizinkan.');
    if (!safeEqual(request.headers.get('x-ds-csrf') || '', admin.csrf)) throw new HttpError(403, 'FORBIDDEN', 'Token CSRF tidak valid.');
  }

  if (sub === 'logout' && m === 'POST') {
    return withCookies(ok({ bye: true }), [serializeCookie(cfg.cookies.admin, '', { maxAge: 0, secure: cfg.secure })]);
  }
  if (sub === 'me' && m === 'GET') return ok({ email: admin.email, csrf: admin.csrf });
  if (sub === 'stats' && m === 'GET') return ok(await store.getStats());
  if (sub === 'settings') {
    if (m === 'GET') {
      const s = await store.getSettings();
      return ok({ fallback_title: s.fallback_title || '', fallback_message: s.fallback_message || '' });
    }
    if (m === 'PUT') {
      const b = await readJson(request, 4096);
      await store.setSetting('fallback_title', str(b.fallback_title, 120, 'fallback_title'));
      await store.setSetting('fallback_message', str(b.fallback_message, 600, 'fallback_message'));
      return ok({ saved: true });
    }
  }
  if (sub === 'schedule/resync' && m === 'POST') {
    const eps = await store.listEpisodes();
    for (const e of eps) {
      const w = windowForSeq(e.seq, cfg.epoch);
      await store.updateEpisode(e.id, { start_time: w.start, end_time: w.end, updated_at: nowSec });
    }
    return ok({ resynced: eps.length });
  }
  if (sub === 'episodes') {
    if (m === 'GET') return ok({ episodes: (await store.listEpisodes()).map((e) => adminView(ctx, e)), server_time: toIso(nowSec) });
    if (m === 'POST') return createEpisode(ctx);
  }
  const em = /^episodes\/([^/]+)(?:\/(validate|preview))?$/.exec(sub);
  if (em) {
    const seq = parseEpisodeRef(em[1]);
    const row = seq ? await store.getEpisodeBySeq(seq) : null;
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Episode tidak ditemukan.');
    if (!em[2]) {
      if (m === 'GET') return ok(adminView(ctx, row, true));
      if (m === 'PUT') return updateEpisode(ctx, row);
      if (m === 'DELETE') { await store.deleteEpisode(row.id); return ok({ deleted: row.id }); }
    }
    if (em[2] === 'validate' && m === 'POST') return validate(ctx, row);
    if (em[2] === 'preview' && m === 'GET') return preview(ctx, row);
  }
  throw new HttpError(404, 'NOT_FOUND', 'Tidak ditemukan.');
}

async function requireAdmin(ctx) {
  const { request, cfg, store, nowSec } = ctx;
  const token = parseCookies(request.headers.get('cookie'))[cfg.cookies.admin];
  const p = await verifyToken(cfg.sessionSecret, 'admin', token, nowSec);
  if (!p) throw new HttpError(401, 'UNAUTHORIZED', 'Perlu login admin.');
  let a;
  try { a = await store.getAdminById(p.adm); } catch { throw new HttpError(503, 'SERVICE_DEGRADED', 'Layanan sementara tidak tersedia.'); }
  if (!a || a.disabled) throw new HttpError(401, 'UNAUTHORIZED', 'Perlu login admin.');
  return { id: a.id, email: a.email, csrf: p.csrf };
}

async function login(ctx) {
  const { request, cfg, store, nowSec } = ctx;
  const b = await readJson(request, 1024);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const ip = (request.headers.get('cf-connecting-ip') || '0.0.0.0');
  const ipKey = `adm:ip:${(await hmacHex(cfg.sessionSecret, 'admip:' + ip)).slice(0, 32)}`;
  const emKey = `adm:em:${(await hmacHex(cfg.sessionSecret, 'admem:' + email)).slice(0, 32)}`;
  const rate = { ...cfg.rate, free: 5 };
  const bad = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');

  let admin = null;
  try {
    const pre = await store.peekRate([ipKey, emKey], nowSec);
    if (pre.blocked) throw new HttpError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar.', { retry_after: pre.retry_after });
    const c1 = await store.chargeRate(ipKey, nowSec, rate);
    const c2 = await store.chargeRate(emKey, nowSec, rate);
    if (!c1.allowed || !c2.allowed) throw new HttpError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar.', { retry_after: 30 });
    if (isEmail(email)) admin = await store.getAdminByEmail(email);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, 'SERVICE_DEGRADED', 'Layanan sementara tidak tersedia.');
  }
  // selalu jalankan PBKDF2 agar waktu respons tidak membedakan email valid / tidak
  const good = await verifyPassword(password, admin ? admin.password_hash : DUMMY_PASSWORD_HASH);
  if (!admin || admin.disabled || !good) throw bad();
  try { await store.clearRate([ipKey, emKey]); } catch { /* best-effort */ }
  const csrf = randomId(18);
  const token = await signToken(cfg.sessionSecret, 'admin', { adm: admin.id, csrf, iat: nowSec, exp: nowSec + cfg.adminSessionSec });
  return withCookies(ok({ email: admin.email, csrf }), [serializeCookie(cfg.cookies.admin, token, { maxAge: cfg.adminSessionSec, secure: cfg.secure })]);
}

// Tampilan admin: TIDAK PERNAH memuat answer_hash/solution_enc/PIN.
function adminView(ctx, e, full = false) {
  const w = windowForSeq(e.seq, ctx.cfg.epoch);
  const v = {
    id: e.id, seq: e.seq, title: e.title, difficulty: e.difficulty, status: e.status,
    start_time: toIso(e.start_time), end_time: toIso(e.end_time),
    scheduled_start: toIso(w.start), scheduled_end: toIso(w.end),
    schedule_ok: e.start_time === w.start && e.end_time === w.end,
    live: e.status === 'published' && ctx.nowSec >= w.start && ctx.nowSec < w.end,
    phase: ctx.nowSec < w.start ? 'upcoming' : ctx.nowSec < w.end ? 'active' : 'ended',
    updated_at: toIso(e.updated_at),
  };
  if (full) Object.assign(v, { riddle_text: e.riddle_text, hint1: e.hint1, hint2: e.hint2, summary: e.summary, unlock_content: parseContent(e.unlock_content) });
  return v;
}

async function parseEpisodeBody(request, { creating }) {
  const b = await readJson(request, 200000);
  const out = {};
  if (creating || b.title !== undefined) out.title = str(b.title, 120, 'title');
  if (creating || b.riddle_text !== undefined) out.riddle_text = str(b.riddle_text, 2000, 'riddle_text');
  if (creating || b.hint1 !== undefined) out.hint1 = str(b.hint1, 500, 'hint1');
  if (creating || b.hint2 !== undefined) out.hint2 = str(b.hint2, 500, 'hint2');
  if (creating || b.summary !== undefined) out.summary = str(b.summary, 600, 'summary');
  if (creating || b.difficulty !== undefined) {
    if (!Number.isInteger(b.difficulty) || b.difficulty < 1 || b.difficulty > 5) throw new HttpError(400, 'INVALID_INPUT', 'difficulty harus 1–5.');
    out.difficulty = b.difficulty;
  }
  if (creating || b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'INVALID_INPUT', 'status tidak valid.');
    out.status = b.status;
  }
  if (creating || b.unlock_content !== undefined) {
    let c = b.unlock_content;
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch { throw new HttpError(400, 'INVALID_INPUT', 'unlock_content bukan JSON valid.'); } }
    const errs = validateUnlockContent(c);
    if (errs.length) throw new HttpError(400, 'INVALID_INPUT', 'unlock_content tidak valid: ' + errs.slice(0, 5).join('; '));
    out.unlock_content = JSON.stringify(c);
  }
  if (creating || b.answer !== undefined) {
    const pin = normalizePin(b.answer);
    if (!pin) throw new HttpError(400, 'INVALID_INPUT', 'answer harus string tepat 4 digit.');
    out.answer = pin;
  }
  if (creating || b.solution_text !== undefined) out.solution_text = str(b.solution_text, 2000, 'solution_text');
  if (creating) {
    if (!Number.isInteger(b.seq) || b.seq < 1 || b.seq > 9999) throw new HttpError(400, 'INVALID_INPUT', 'seq harus bilangan bulat 1–9999.');
    out.seq = b.seq;
  }
  return out;
}

async function createEpisode(ctx) {
  const { request, cfg, store, nowSec } = ctx;
  const b = await parseEpisodeBody(request, { creating: true });
  const id = episodeId(b.seq);
  if (await store.getEpisodeBySeq(b.seq)) throw new HttpError(409, 'CONFLICT', 'Slot episode itu sudah terisi.');
  const w = windowForSeq(b.seq, cfg.epoch);
  await store.insertEpisode({
    id, seq: b.seq, title: b.title, riddle_text: b.riddle_text, hint1: b.hint1, hint2: b.hint2, summary: b.summary,
    answer_hash: await hashPin(cfg.pepper, id, b.answer),
    solution_enc: await seal(cfg.dataKey, { pin: b.answer, text: b.solution_text }, id),
    unlock_content: b.unlock_content, start_time: w.start, end_time: w.end,
    difficulty: b.difficulty, status: b.status, created_at: nowSec, updated_at: nowSec,
  });
  return ok(adminView(ctx, await store.getEpisodeById(id), true), 201);
}

async function updateEpisode(ctx, row) {
  const { request, cfg, store, nowSec } = ctx;
  const b = await parseEpisodeBody(request, { creating: false });
  const patch = { updated_at: nowSec };
  for (const k of ['title', 'riddle_text', 'hint1', 'hint2', 'summary', 'difficulty', 'status', 'unlock_content']) if (b[k] !== undefined) patch[k] = b[k];
  if (b.answer !== undefined || b.solution_text !== undefined) {
    let cur = null;
    try { cur = await open(cfg.dataKey, row.solution_enc, row.id); } catch { /* rusak */ }
    const pin = b.answer ?? cur?.pin; const text = b.solution_text ?? cur?.text;
    if (!pin || !text) throw new HttpError(400, 'INVALID_INPUT', 'Isi answer dan solution_text bersamaan.');
    patch.solution_enc = await seal(cfg.dataKey, { pin, text }, row.id);
    if (b.answer !== undefined) patch.answer_hash = await hashPin(cfg.pepper, row.id, pin);
  }
  await store.updateEpisode(row.id, patch);
  return ok(adminView(ctx, await store.getEpisodeById(row.id), true));
}

async function validate(ctx, row) {
  const { request, cfg, store } = ctx;
  let body = {};
  try { body = await readJson(request, 256); } catch (e) { if (request.headers.get('content-length') !== '0' && e.code !== 'UNSUPPORTED_MEDIA_TYPE' && e.code !== 'INVALID_JSON') throw e; }
  const checks = [];
  const add = (name, pass, detail = '') => checks.push({ name, ok: !!pass, detail });
  add('answer_hash berformat HMAC-SHA256 (64 hex)', /^[0-9a-f]{64}$/.test(row.answer_hash));
  const content = parseContent(row.unlock_content);
  const cErr = validateUnlockContent(content);
  add('unlock_content valid', cErr.length === 0, cErr.slice(0, 3).join('; '));
  const w = windowForSeq(row.seq, cfg.epoch);
  add('jadwal sesuai epoch (48 jam tetap)', row.start_time === w.start && row.end_time === w.end, row.start_time === w.start ? '' : 'jalankan "sinkronkan jadwal"');
  add('petunjuk 1 & 2 terisi dan berbeda', row.hint1 && row.hint2 && row.hint1 !== row.hint2);
  let sol = null;
  try { sol = await open(cfg.dataKey, row.solution_enc, row.id); add('solusi terenkripsi dapat dibuka', true); }
  catch { add('solusi terenkripsi dapat dibuka', false, 'DATA_KEY berbeda atau data rusak'); }
  if (sol) {
    add('PIN solusi = answer_hash', await verifyPin(cfg.pepper, row.id, sol.pin, row.answer_hash), 'ANSWER_PEPPER berbeda atau jawaban diubah di luar admin');
    const token = new RegExp(`(?<!\\d)${sol.pin}(?!\\d)`);
    add('teka-teki/petunjuk/ringkasan tidak memuat jawaban', ![row.riddle_text, row.hint1, row.hint2, row.summary].some((t) => token.test(t)));
    let dup = null;
    for (const o of await store.listEpisodes()) {
      if (o.id === row.id) continue;
      try { if ((await open(cfg.dataKey, o.solution_enc, o.id)).pin === sol.pin) dup = o.id; } catch { /* abaikan */ }
    }
    add('jawaban unik di antara episode', !dup, dup ? `sama dengan ${dup}` : '');
  }
  if (body.pin !== undefined) {
    const pin = normalizePin(body.pin);
    add('PIN uji cocok (tidak disimpan)', !!pin && await verifyPin(cfg.pepper, row.id, pin, row.answer_hash));
  }
  return ok({ id: row.id, all_ok: checks.every((c) => c.ok), checks });
}

// Preview = apa yang pemain akan lihat, termasuk episode draft. Tidak pernah memuat jawaban.
async function preview(ctx, row) {
  const { cfg, store } = ctx;
  const upto = (await store.listEpisodes()).filter((e) => e.seq < row.seq && e.status === 'published');
  const list = [...upto, row].map((e) => ({ seq: e.seq, content: parseContent(e.unlock_content) }));
  return ok({
    lock_screen: { id: row.id, title: row.title, riddle_text: row.riddle_text, difficulty: row.difficulty,
      hints: [row.hint1, row.hint2], hint1_after_hours: cfg.hint1After / 3600, hint2_after_hours: cfg.hint2After / 3600 },
    phone: aggregateContent(list, row.seq),
    status: row.status,
  });
}
