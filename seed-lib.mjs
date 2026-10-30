// Mengubah sumber episode (privat) menjadi baris database: jawaban di-HMAC, solusi dienkripsi.
import { hashPin, seal } from '../src/lib/crypto.js';
import { windowForSeq, episodeId } from '../src/lib/schedule.js';

export async function buildEpisodeRows({ pepper, dataKey, epoch, episodes, now = Math.floor(Date.now() / 1000), status = 'published' }) {
  const rows = [];
  for (const e of episodes) {
    const id = episodeId(e.seq);
    const pin = String(e.derive.call(e));
    if (!/^\d{4}$/.test(pin)) throw new Error(`${id}: jawaban bukan 4 digit`);
    const w = windowForSeq(e.seq, epoch);
    rows.push({
      id, seq: e.seq, title: e.title, riddle_text: e.riddle, hint1: e.hint1, hint2: e.hint2,
      answer_hash: await hashPin(pepper, id, pin),
      solution_enc: await seal(dataKey, { pin, text: e.solution }, id),
      summary: e.summary, unlock_content: JSON.stringify(e.content),
      start_time: w.start, end_time: w.end, difficulty: e.difficulty, status,
      created_at: now, updated_at: now,
    });
  }
  return rows;
}

const q = (v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export function rowsToSql(rows) {
  const cols = Object.keys(rows[0]);
  return rows.map((r) => `INSERT OR REPLACE INTO episodes (${cols.join(',')}) VALUES (${cols.map((c) => q(r[c])).join(',')});`).join('\n') + '\n';
}

export function parseVars(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
