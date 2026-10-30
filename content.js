// Struktur konten episode (unlock_content) + agregasi untuk simulasi ponsel.
export const SECTIONS = ['messages', 'notes', 'gallery', 'files', 'browser', 'audio', 'cases'];
const isStr = (v, max = 4000) => typeof v === 'string' && v.length > 0 && v.length <= max;

export function validateUnlockContent(c) {
  const errs = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['unlock_content harus objek'];
  if (c.cliff !== undefined && !isStr(c.cliff, 400)) errs.push('cliff harus string');
  if (c.summary_en !== undefined && !isStr(c.summary_en, 800)) errs.push('summary_en harus string');
  for (const s of SECTIONS) if (c[s] !== undefined && !Array.isArray(c[s])) errs.push(`${s} harus array`);
  const each = (name, fn) => (Array.isArray(c[name]) ? c[name] : []).forEach((it, i) => { const e = fn(it); if (e) errs.push(`${name}[${i}]: ${e}`); });
  each('messages', (m) => (!isStr(m.thread, 80) || !isStr(m.from, 80) || !isStr(m.text) ? 'thread/from/text wajib' : ''));
  each('notes', (n) => (!isStr(n.title, 120) || !isStr(n.text) ? 'title/text wajib' : ''));
  each('gallery', (g) => (!isStr(g.caption, 200) || !['clock', 'frame', 'symbols'].includes(g.kind) ? 'caption/kind tidak valid'
    : g.kind === 'clock' && !/^\d\d:\d\d$/.test(g.time || '') ? 'clock butuh time HH:MM' : ''));
  each('files', (f) => (!isStr(f.name, 120) || !isStr(f.text) ? 'name/text wajib' : ''));
  each('browser', (b) => (!isStr(b.url, 200) || !isStr(b.title, 200) || !Array.isArray(b.body) || !b.body.every((x) => isStr(x)) ? 'url/title/body wajib' : ''));
  each('audio', (a) => (!isStr(a.title, 200) || !isStr(a.duration, 12) || !Array.isArray(a.transcript) || !a.transcript.length
    || !a.transcript.every((l) => isStr(l.t, 12) && isStr(l.speaker, 80) && isStr(l.text)) ? 'title/duration/transcript tidak valid' : ''));
  each('cases', (k) => (!isStr(k.id, 40) || !isStr(k.title, 120) || !isStr(k.status, 60) || !Array.isArray(k.entries)
    || !k.entries.every((e) => isStr(e.date, 60) && isStr(e.text)) ? 'id/title/status/entries tidak valid' : ''));
  return errs;
}

export function parseContent(text) {
  try { const o = JSON.parse(text); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

// Menggabungkan konten episode 1..N menjadi satu "isi ponsel" kumulatif.
// Setiap item diberi `ep` supaya UI bisa menandai yang baru.
export function aggregateContent(episodes, currentSeq) {
  const out = { messages: [], notes: [], gallery: [], files: [], browser: [], audio: [], cases: [], current_ep: currentSeq, cliff: '' };
  const threads = new Map();
  const cases = new Map();
  for (const { seq, content } of episodes) {
    const c = content || {};
    for (const m of c.messages || []) {
      if (!threads.has(m.thread)) threads.set(m.thread, { thread: m.thread, items: [], last_ep: seq });
      const t = threads.get(m.thread);
      t.items.push({ from: m.from, mine: !!m.mine, text: m.text, at: m.at || '', ep: seq });
      t.last_ep = seq;
    }
    for (const s of ['notes', 'gallery', 'files', 'browser', 'audio']) for (const it of c[s] || []) out[s].push({ ...it, ep: seq });
    for (const k of c.cases || []) {
      if (!cases.has(k.id)) cases.set(k.id, { id: k.id, title: k.title, status: k.status, entries: [] });
      const e = cases.get(k.id);
      e.title = k.title; e.status = k.status;
      for (const en of k.entries) e.entries.push({ ...en, ep: seq });
    }
    if (seq === currentSeq) out.cliff = c.cliff || '';
  }
  out.messages = [...threads.values()].sort((a, b) => b.last_ep - a.last_ep);
  out.cases = [...cases.values()];
  return out;
}
