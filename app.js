import { HttpError, ok, fail, json, withCookies, parseCookies, serializeCookie, readJson, withSecurityHeaders } from './lib/http.js';
import { slotAt, windowForSeq, toIso } from './lib/schedule.js';
import { hmacHex, verifyPin, signToken, verifyToken, open, randomId } from './lib/crypto.js';
import { normalizePin, parseEpisodeRef } from './lib/normalize.js';
import { aggregateContent, parseContent } from './content.js';
import { loadConfig, DEFAULT_FALLBACK } from './config.js';
import { handleAdmin } from './admin.js';

const PAGES = { '/': '/index.html', '/archive': '/archive.html', '/about': '/about.html', '/privacy': '/privacy.html', '/admin': '/admin.html' };
const DEVICE_RE = /^[A-Za-z0-9_-]{22}$/;

export function createApp({ env, store, now = () => Date.now() }) {
  async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    let cfg;
    try { cfg = loadConfig(env); } catch (e) {
      if (path.startsWith('/api/')) return fail(500, e.code || 'SERVER_MISCONFIGURED', 'Konfigurasi server belum lengkap.');
      return new Response('Server belum dikonfigurasi.', { status: 500 });
    }
    const ctx = { env, cfg, store, request, url, path, nowSec: Math.floor(now() / 1000) };
    ctx.slot = slotAt(ctx.nowSec, cfg.epoch);

    if (path.startsWith('/api/')) {
      try {
        return await routeApi(ctx);
      } catch (e) {
        if (e instanceof HttpError) {
          const headers = e.extra?.retry_after ? { 'retry-after': String(e.extra.retry_after) } : undefined;
          return fail(e.status, e.code, e.message, e.extra, headers);
        }
        console.error('unhandled', e?.name, e?.message); // tidak pernah mencatat body/PIN
        return fail(500, 'INTERNAL', 'Terjadi kesalahan di server.');
      }
    }
    return servePage(ctx);
  }

  async function servePage({ path, request, url, cfg }) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    let target = PAGES[path];
    if (!target && /^\/episode\/[A-Za-z0-9-]{1,12}$/.test(path)) target = '/episode.html';
    if (!target) {
      const direct = await env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: 'GET' }));
      if (direct.status === 200 && /^\/(css|js)\/|^\/(favicon\.svg|logo\.svg)$/.test(path)) {
        const r = withSecurityHeaders(direct, { secure: cfg.secure });
        r.headers.set('cache-control', 'public, max-age=300');
        return r;
      }
      target = '/404.html';
      const nf = await env.ASSETS.fetch(new Request(new URL(target, url.origin)));
      return withSecurityHeaders(new Response(nf.body, { status: 404, headers: nf.headers }), { secure: cfg.secure });
    }
    const res = await env.ASSETS.fetch(new Request(new URL(target, url.origin)));
    const r = withSecurityHeaders(new Response(res.body, { status: res.status, headers: res.headers }), { secure: cfg.secure });
    r.headers.set('cache-control', 'no-cache');
    return r;
  }

  // ------------------------------------------------------------------ API
  async function routeApi(ctx) {
    const { request, path } = ctx;
    const m = request.method;
    const must = (method) => { if (m !== method) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.', {}); };
    if (path === '/api/admin' || path.startsWith('/api/admin/')) return handleAdmin(ctx);
    switch (path) {
      case '/api/episode/countdown': must('GET'); return countdown(ctx);
      case '/api/episode/current': must('GET'); return currentEpisode(ctx);
      case '/api/passcode/verify': must('POST'); return verify(ctx);
      case '/api/passcode/lock': must('POST'); return lock(ctx);
      case '/api/unlocked/content': must('GET'); return unlocked(ctx);
      case '/api/archive': must('GET'); return archive(ctx);
      default: {
        const am = /^\/api\/archive\/([^/]+)$/.exec(path);
        if (am) { must('GET'); return archiveDetail(ctx, am[1]); }
        throw new HttpError(404, 'NOT_FOUND', 'Tidak ditemukan.');
      }
    }
  }

  const timing = (ctx) => {
    const { slot, nowSec } = ctx;
    return {
      server_time: toIso(nowSec), server_epoch: nowSec, state: slot.state, seq: slot.seq,
      starts_at: slot.start ? toIso(slot.start) : null, ends_at: toIso(slot.end),
      seconds_remaining: Math.max(0, slot.end - nowSec), next_start: toIso(slot.next_start),
    };
  };

  // Tidak menyentuh database: tetap hidup saat DB gagal.
  function countdown(ctx) { return ok(timing(ctx)); }

  function degraded(ctx) {
    return new HttpError(503, 'SERVICE_DEGRADED', DEFAULT_FALLBACK.message, { fallback: DEFAULT_FALLBACK, timing: timing(ctx) });
  }

  async function dormantFallback(ctx) {
    let s = {};
    try { s = await ctx.store.getSettings(); } catch { /* pakai default */ }
    return { title: s.fallback_title || 'Transmisi belum tiba', message: s.fallback_message || 'Belum ada pesan baru. Perangkat ini masih menunggu.' };
  }

  async function currentEpisode(ctx) {
    const { slot, nowSec, cfg } = ctx;
    if (slot.state === 'pre_launch') {
      return ok({ ...timing(ctx), state: 'pre_launch', fallback: await dormantFallback(ctx) });
    }
    let row;
    try { row = await ctx.store.getEpisodeBySeq(slot.seq); } catch { throw degraded(ctx); }
    if (!row || row.status !== 'published') return ok({ ...timing(ctx), state: 'dormant', fallback: await dormantFallback(ctx) });
    const t1 = slot.start + cfg.hint1After; const t2 = slot.start + cfg.hint2After;
    return ok({
      ...timing(ctx), state: 'active',
      episode: {
        id: row.id, seq: row.seq, title: row.title, riddle_text: row.riddle_text, difficulty: row.difficulty,
        hints: [
          { level: 1, available_at: toIso(t1), text: nowSec >= t1 ? row.hint1 : null },
          { level: 2, available_at: toIso(t2), text: nowSec >= t2 ? row.hint2 : null },
        ],
      },
    });
  }

  async function identity(ctx) {
    const { request, cfg } = ctx;
    const raw = request.headers.get('cf-connecting-ip') || '0.0.0.0';
    const ip = raw.includes(':') ? raw.split(':').slice(0, 4).join(':') : raw; // IPv6: per /64
    const cookies = parseCookies(request.headers.get('cookie'));
    let deviceId = cookies[cfg.cookies.device];
    const newDevice = !DEVICE_RE.test(deviceId || '');
    if (newDevice) deviceId = randomId(16);
    const seq = ctx.slot.seq;
    const ipKey = `ip:${(await hmacHex(cfg.sessionSecret, 'ip:' + ip)).slice(0, 32)}:${seq}`;
    const devKey = `dev:${(await hmacHex(cfg.sessionSecret, 'dev:' + deviceId)).slice(0, 32)}:${seq}`;
    const cookie = newDevice ? serializeCookie(cfg.cookies.device, deviceId, { maxAge: 86400 * 400, secure: cfg.secure }) : null;
    return { ipKey, devKey, cookie };
  }

  const limited = (retry, cookies) => withCookies(
    fail(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.', { retry_after: retry }, { 'retry-after': String(retry) }), cookies);

  async function verify(ctx) {
    const { request, cfg, store, slot, nowSec } = ctx;
    const body = await readJson(request, 512);
    const pin = normalizePin(body.pin);
    if (!pin) throw new HttpError(400, 'INVALID_INPUT', 'Masukkan tepat 4 digit angka.');
    if (slot.state !== 'running') throw new HttpError(404, 'NO_ACTIVE_EPISODE', 'Belum ada transmisi aktif.');

    let ep;
    try { ep = await store.getEpisodeBySeq(slot.seq); } catch { throw degraded(ctx); }
    if (!ep || ep.status !== 'published') throw new HttpError(404, 'NO_ACTIVE_EPISODE', 'Belum ada transmisi aktif.');
    if (body.episode_id !== undefined && body.episode_id !== ep.id) {
      throw new HttpError(409, 'EPISODE_CHANGED', 'Transmisi telah berganti. Muat ulang halaman.');
    }

    const who = await identity(ctx);
    const cookies = who.cookie ? [who.cookie] : [];
    // Gagal-tertutup: jika penghitung rate-limit tak bisa dipakai, JANGAN memeriksa PIN.
    try {
      const pre = await store.peekRate([who.ipKey, who.devKey], nowSec);
      if (pre.blocked) return limited(pre.retry_after, cookies);
      const g = await store.globalCheck(`g:${slot.seq}`, nowSec, cfg.globalPerHour, 3600);
      if (g.blocked) return limited(g.retry_after, cookies);
      const c1 = await store.chargeRate(who.ipKey, nowSec, cfg.rate);
      const c2 = await store.chargeRate(who.devKey, nowSec, cfg.rate);
      if (!c1.allowed || !c2.allowed) {
        const again = await store.peekRate([who.ipKey, who.devKey], nowSec);
        return limited(Math.max(1, again.retry_after), cookies);
      }
    } catch { throw degraded(ctx); }

    const match = await verifyPin(cfg.pepper, ep.id, pin, ep.answer_hash); // selalu dihitung, apa pun hasilnya
    try { await store.recordAttempt(slot.seq, new Date(nowSec * 1000).toISOString().slice(0, 10), match); } catch { /* statistik best-effort */ }

    if (!match) {
      try { await store.globalBump(`g:${slot.seq}`, nowSec, 3600); } catch { /* best-effort */ }
      return withCookies(fail(401, 'WRONG_CODE', 'Kode salah.'), cookies);
    }
    try { await store.clearRate([who.ipKey, who.devKey]); } catch { /* best-effort */ }
    const token = await signToken(cfg.sessionSecret, 'unlock', { ep: slot.seq, id: ep.id, iat: nowSec, exp: slot.end, n: randomId(8) });
    cookies.push(serializeCookie(cfg.cookies.unlock, token, { maxAge: slot.end - nowSec, secure: cfg.secure }));
    return withCookies(ok({ unlocked: true, episode_id: ep.id, expires_at: toIso(slot.end) }), cookies);
  }

  function lock(ctx) {
    const { cfg } = ctx;
    return withCookies(ok({ locked: true }), [serializeCookie(cfg.cookies.unlock, '', { maxAge: 0, secure: cfg.secure })]);
  }

  async function unlocked(ctx) {
    const { request, cfg, store, slot, nowSec } = ctx;
    const token = parseCookies(request.headers.get('cookie'))[cfg.cookies.unlock];
    const payload = await verifyToken(cfg.sessionSecret, 'unlock', token, nowSec);
    if (!payload || slot.state !== 'running' || payload.ep !== slot.seq) {
      throw new HttpError(401, 'LOCKED', 'Perangkat terkunci.');
    }
    let rows;
    try { rows = await store.listPublishedContentUpTo(slot.seq); } catch { throw degraded(ctx); }
    const current = rows.find((r) => r.seq === slot.seq);
    if (!current) throw new HttpError(401, 'LOCKED', 'Perangkat terkunci.');
    const content = aggregateContent(rows.map((r) => ({ seq: r.seq, content: parseContent(r.unlock_content) })), slot.seq);
    return ok({
      episode: { id: current.id, seq: current.seq, title: current.title, summary: current.summary },
      expires_at: toIso(slot.end),
      content,
    });
  }

  const endedMax = (ctx) => (ctx.slot.state === 'running' ? ctx.slot.seq - 1 : 0);

  async function archive(ctx) {
    const maxSeq = endedMax(ctx);
    let rows = [];
    try { rows = maxSeq > 0 ? await ctx.store.listArchive(maxSeq) : []; } catch { throw degraded(ctx); }
    const w = (seq) => windowForSeq(seq, ctx.cfg.epoch);
    return ok({
      server_time: toIso(ctx.nowSec),
      active_seq: ctx.slot.state === 'running' ? ctx.slot.seq : null,
      episodes: rows.map((r) => ({ id: r.id, seq: r.seq, title: r.title, summary: r.summary, difficulty: r.difficulty,
        starts_at: toIso(w(r.seq).start), ends_at: toIso(w(r.seq).end) })),
    });
  }

  // Episode aktif & masa depan sengaja memberi respons yang IDENTIK (404) agar URL tidak membocorkan apa pun.
  async function archiveDetail(ctx, ref) {
    const seq = parseEpisodeRef(ref);
    const notFound = new HttpError(404, 'NOT_FOUND', 'Arsip tidak ditemukan.');
    if (!seq || seq > endedMax(ctx)) throw notFound;
    let row;
    try { row = await ctx.store.getEpisodeBySeq(seq); } catch { throw degraded(ctx); }
    if (!row || row.status !== 'published') throw notFound;
    let solution = null;
    try { solution = await open(ctx.cfg.dataKey, row.solution_enc, row.id); } catch { /* solusi tak terbaca: tampilkan tanpa */ }
    const w = windowForSeq(seq, ctx.cfg.epoch);
    return ok({
      id: row.id, seq, title: row.title, summary: row.summary, difficulty: row.difficulty,
      starts_at: toIso(w.start), ends_at: toIso(w.end),
      riddle_text: row.riddle_text, hints: [row.hint1, row.hint2],
      solution: solution ? { pin: solution.pin, text: solution.text } : null,
      content: parseContent(row.unlock_content),
      prev: seq > 1 ? `ep-${String(seq - 1).padStart(3, '0')}` : null,
      next: seq < endedMax(ctx) ? `ep-${String(seq + 1).padStart(3, '0')}` : null,
    });
  }

  return {
    fetch: handle,
    async scheduled() { await store.prune(Math.floor(now() / 1000)); },
  };
}
