// Menghasilkan build/seed.sql (30 episode). Secret HARUS sama dengan secret Worker.
//   ANSWER_PEPPER=... DATA_KEY=... EPOCH_UTC=2026-11-02T00:00:00Z node scripts/build-seed.mjs
// Atau tanpa env: membaca .dev.vars (untuk lokal).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { buildEpisodeRows, rowsToSql, parseVars } from './seed-lib.mjs';
import { parseEpoch } from '../src/lib/schedule.js';

const vars = existsSync('.dev.vars') ? parseVars(readFileSync('.dev.vars', 'utf8')) : {};
const env = { ...vars, ...process.env };
for (const k of ['ANSWER_PEPPER', 'DATA_KEY', 'EPOCH_UTC']) {
  if (!env[k]) { console.error(`Env ${k} belum diisi (lihat .dev.vars.example / npm run secrets).`); process.exit(1); }
}
if (!existsSync('private/episodes.source.js')) { console.error('private/episodes.source.js tidak ada.'); process.exit(1); }
const { episodes } = await import('../private/episodes.source.js');
const rows = await buildEpisodeRows({ pepper: env.ANSWER_PEPPER, dataKey: env.DATA_KEY, epoch: parseEpoch(env.EPOCH_UTC), episodes });
mkdirSync('build', { recursive: true });
writeFileSync('build/seed.sql', rowsToSql(rows));
console.log(`OK: ${rows.length} episode -> build/seed.sql (epoch ${env.EPOCH_UTC})`);
console.log('Berkas ini berisi seluruh cerita. Jangan di-commit.');
