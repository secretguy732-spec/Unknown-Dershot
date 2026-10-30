// Server lokal TANPA workerd/wrangler — jalan di Termux (Node >= 22.5) dan di PC.
// Memakai kode backend yang SAMA dengan Worker (src/app.js) di atas SQLite (node:sqlite).
//   npm run dev        -> http://localhost:8787
// Pertama kali jalan: otomatis membuat DB di .dev/, menerapkan migrasi, dan seed 30 episode.
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createSqliteD1, applyMigrations } from '../src/d1-sqlite-shim.js';
import { createStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { parseEpoch } from '../src/lib/schedule.js';
import { buildEpisodeRows, parseVars } from './seed-lib.mjs';

if (!existsSync('.dev.vars')) {
  const b = (n) => randomBytes(n).toString('base64url');
  writeFileSync('.dev.vars', `ANSWER_PEPPER=${b(32)}\nSESSION_SECRET=${b(32)}\nDATA_KEY=${b(32)}\nEPOCH_UTC=${new Date(Date.now() - 3600e3).toISOString().slice(0, 13)}:00:00Z\nCOOKIE_SECURE=false\n`);
  console.log('> .dev.vars dibuat (secret acak, epoch = 1 jam lalu sehingga episode 1 langsung aktif).');
}
const vars = parseVars(readFileSync('.dev.vars', 'utf8'));
const env = { ...vars, ...process.env };
const PORT = Number(env.PORT || 8787);

mkdirSync('.dev', { recursive: true });
const d1 = createSqliteD1('.dev/dershot.sqlite');
applyMigrations(d1);
const store = createStore(d1);
if ((await store.countEpisodes()) === 0) {
  if (!existsSync('private/episodes.source.js')) { console.error('private/episodes.source.js tidak ditemukan.'); process.exit(1); }
  const { episodes } = await import('../private/episodes.source.js');
  const rows = await buildEpisodeRows({ pepper: env.ANSWER_PEPPER, dataKey: env.DATA_KEY, epoch: parseEpoch(env.EPOCH_UTC), episodes });
  for (const r of rows) await store.insertEpisode(r);
  console.log(`> seed: ${rows.length} episode`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const PUBLIC = join(process.cwd(), 'public');
env.ASSETS = { async fetch(req) {
  const p = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, p);
  if (!file.startsWith(PUBLIC) || !existsSync(file) || file === PUBLIC) return new Response('nf', { status: 404 });
  try { return new Response(readFileSync(file), { headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('nf', { status: 404 }); }
} };

// Jam palsu opsional: DEV_FAKE_NOW=2026-11-14T12:00:00Z (jam tetap berjalan maju dari titik itu)
const offset = env.DEV_FAKE_NOW ? Date.parse(env.DEV_FAKE_NOW) - Date.now() : 0;
if (env.DEV_FAKE_NOW) console.log(`> DEV_FAKE_NOW aktif: server mengira sekarang ${env.DEV_FAKE_NOW}`);
const app = createApp({ env, store, now: () => Date.now() + offset });

http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = { ...req.headers, 'cf-connecting-ip': req.socket.remoteAddress || '127.0.0.1' };
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const r = await app.fetch(request);
    const out = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
    out['set-cookie'] = r.headers.getSetCookie();
    res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); res.writeHead(500); res.end('dev-server error'); }
}).listen(PORT, () => {
  console.log(`\nUnknown-Dershot dev: http://localhost:${PORT}   (admin: buat dulu dengan npm run admin:sql, lalu sqlite — lihat README)`);
});
