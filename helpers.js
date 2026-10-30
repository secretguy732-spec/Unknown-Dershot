import { createSqliteD1, applyMigrations } from '../src/d1-sqlite-shim.js';
import { createStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { buildEpisodeRows } from '../scripts/seed-lib.mjs';
import { parseEpoch, PERIOD_SECONDS } from '../src/lib/schedule.js';
import { hashPassword, randomId } from '../src/lib/crypto.js';
import { episodes } from '../private/episodes.source.js';

export const EPOCH_ISO = '2026-11-02T00:00:00Z';
export const EPOCH = parseEpoch(EPOCH_ISO);
export const SECRETS = { ANSWER_PEPPER: 'test-pepper-test-pepper-test-pepper', SESSION_SECRET: 'test-session-test-session-test-secret', DATA_KEY: randomId(32) };
export const ANSWERS = Object.fromEntries(episodes.map((e) => [e.seq, e.derive.call(e)]));
export const ADMIN = { email: 'admin@example.test', password: 'correct horse battery staple' };

export function makeEnv(extra = {}) {
  return { ...SECRETS, EPOCH_UTC: EPOCH_ISO, COOKIE_SECURE: 'true', RL_GLOBAL_PER_HOUR: '600', ASSETS: fakeAssets(), ...extra };
}
export function fakeAssets() {
  return { async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/404.html') return new Response('<h1>404</h1>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (['/index.html', '/archive.html', '/episode.html', '/about.html', '/privacy.html', '/admin.html'].includes(p)) return new Response('<html>' + p + '</html>', { headers: { 'content-type': 'text/html' } });
    if (p === '/js/lock.js') return new Response('//js', { headers: { 'content-type': 'text/javascript' } });
    return new Response('nf', { status: 404 });
  } };
}

// Dunia uji lengkap: DB sqlite in-memory + 30 episode ter-seed + jam palsu.
export async function makeWorld({ seed = true, env: envExtra = {}, withAdmin = true } = {}) {
  const d1 = createSqliteD1();
  applyMigrations(d1);
  const store = createStore(d1);
  const env = makeEnv(envExtra);
  if (seed) {
    const rows = await buildEpisodeRows({ pepper: env.ANSWER_PEPPER, dataKey: env.DATA_KEY, epoch: EPOCH, episodes });
    for (const r of rows) await store.insertEpisode(r);
  }
  if (withAdmin) await store.createAdmin(ADMIN.email, await hashPassword(ADMIN.password, 1000), 0);
  const clock = { ms: (EPOCH + 3600) * 1000 };
  const app = createApp({ env, store, now: () => clock.ms });
  let ipCounter = 0;
  const world = {
    d1, store, env, clock, app,
    setNow: (sec) => { clock.ms = sec * 1000; },
    atEpisode: (seq, offsetSec = 3600) => world.setNow(EPOCH + (seq - 1) * PERIOD_SECONDS + offsetSec),
    freshIp: () => `203.0.113.${(ipCounter++ % 250) + 1}`,
    async call(method, path, { body, cookie, ip = '198.51.100.7', headers = {} } = {}) {
      const h = { 'cf-connecting-ip': ip, ...headers };
      if (cookie) h.cookie = cookie;
      let b;
      if (body !== undefined) { h['content-type'] = h['content-type'] || 'application/json'; b = typeof body === 'string' ? body : JSON.stringify(body); }
      const res = await app.fetch(new Request('https://dershot.test' + path, { method, headers: h, body: b }));
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* html */ }
      return { status: res.status, headers: res.headers, text, json };
    },
    verify: (pin, opts = {}) => world.call('POST', '/api/passcode/verify', { body: { pin }, ...opts }),
  };
  return world;
}

export const cookieFrom = (res, name) => {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const c = all.find((x) => x && x.startsWith(name + '='));
  return c ? c.split(';')[0] : null;
};
export const wrongPin = (seq) => (ANSWERS[seq] === '0000' ? '0001' : '0000');
