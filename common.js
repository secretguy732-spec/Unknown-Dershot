// Utilitas bersama. Semua teks dari server dirender dengan textContent (tidak ada innerHTML).
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  for (const kid of kids.flat(Infinity)) if (kid) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// ---------- preferensi ----------
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* mode privat */ } } };
export const prefs = {
  get lang() { return store.get('ds_lang', 'id'); }, set lang(v) { store.set('ds_lang', v); },
  get theme() { return store.get('ds_theme', 'dark'); }, set theme(v) { store.set('ds_theme', v); applyPrefs(); },
  get fs() { return store.get('ds_fs', 'm'); }, set fs(v) { store.set('ds_fs', v); applyPrefs(); },
};
export function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.fs = prefs.fs;
  document.documentElement.lang = prefs.lang;
}

const D = {
  id: {
    enter: 'Enter Passcode', emergency: 'Emergency', cancel: 'Cancel', del: 'Delete', encrypted: 'PESAN TERENKRIPSI', read: 'Ketuk untuk membaca selengkapnya',
    next: 'Teka-teki berikutnya dalam', wrong: 'Kode salah.', wait: (s) => `Terlalu banyak percobaan. Coba lagi dalam ${s}.`, down: 'Sinyal terputus. Coba lagi sebentar lagi.',
    changed: 'Transmisi telah berganti. Memuat ulang…', invalid: 'Masukkan 4 digit.', net: 'Tidak ada koneksi.', closeX: 'Tutup', ep: 'EPISODE', diff: 'Kesulitan',
    hint: 'Petunjuk', hintLocked: (t) => `Terbuka ${t}`, hintIn: 'dalam', riddle: 'Teka-teki',
    emTitle: 'Kartu Darurat', emOwner: 'Pemilik', emUnknown: 'Tidak diketahui', emBlood: 'Golongan darah', emContact: 'Kontak darurat', emNone: 'Tidak ada',
    emNote: 'Perangkat fiksi ini tidak menelepon siapa pun. Jika kamu mengalami keadaan darurat sungguhan, hubungi 112.', emHints: 'Petunjuk dari arsip',
    pre: 'Transmisi pertama belum dimulai.', preIn: 'Dimulai dalam', dormant: 'Belum ada transmisi aktif.', unlocking: 'Membuka…',
    msgs: 'Messages', notes: 'Notes', gallery: 'Gallery', files: 'Files', browser: 'Browser', audio: 'Audio Logs', cases: 'Case Files', settings: 'Settings',
    back: '‹ Kembali', home: 'Beranda', empty: 'Belum ada isi.', transcript: 'Transkrip (tanpa suara asli)', speed: 'Kecepatan', history: 'Riwayat', status: 'Status',
    theme: 'Tema', themeDark: 'Gelap', themeAsh: 'Abu terang', themeMono: 'Kontras tinggi', lang: 'Bahasa', textSize: 'Ukuran teks', m: 'Normal', l: 'Besar',
    lockNow: 'Kunci perangkat', about: 'Tentang perangkat', session: 'Sesi terbuka sampai', expired: 'Transmisi berganti — perangkat terkunci kembali.',
    newItems: 'baru', viewArchive: 'Arsip episode', unknownSender: 'Pengirim tak dikenal',
  },
  en: {
    enter: 'Enter Passcode', emergency: 'Emergency', cancel: 'Cancel', del: 'Delete', encrypted: 'ENCRYPTED MESSAGE', read: 'Tap to read more',
    next: 'Next riddle in', wrong: 'Wrong code.', wait: (s) => `Too many attempts. Try again in ${s}.`, down: 'Signal lost. Please try again shortly.',
    changed: 'The transmission changed. Reloading…', invalid: 'Enter 4 digits.', net: 'No connection.', closeX: 'Close', ep: 'EPISODE', diff: 'Difficulty',
    hint: 'Hint', hintLocked: (t) => `Unlocks ${t}`, hintIn: 'in', riddle: 'Riddle',
    emTitle: 'Emergency Card', emOwner: 'Owner', emUnknown: 'Unknown', emBlood: 'Blood type', emContact: 'Emergency contact', emNone: 'None',
    emNote: 'This fictional device calls nobody. If you are in a real emergency, contact your local emergency number.', emHints: 'Hints from the archive',
    pre: 'The first transmission has not started.', preIn: 'Starts in', dormant: 'No active transmission.', unlocking: 'Unlocking…',
    msgs: 'Messages', notes: 'Notes', gallery: 'Gallery', files: 'Files', browser: 'Browser', audio: 'Audio Logs', cases: 'Case Files', settings: 'Settings',
    back: '‹ Back', home: 'Home', empty: 'Nothing here yet.', transcript: 'Transcript (no real audio)', speed: 'Speed', history: 'History', status: 'Status',
    theme: 'Theme', themeDark: 'Dark', themeAsh: 'Light ash', themeMono: 'High contrast', lang: 'Language', textSize: 'Text size', m: 'Normal', l: 'Large',
    lockNow: 'Lock device', about: 'About this device', session: 'Session open until', expired: 'The transmission changed — device locked again.',
    newItems: 'new', viewArchive: 'Episode archive', unknownSender: 'Unknown sender',
  },
};
export const t = (k, ...a) => { const v = (D[prefs.lang] || D.id)[k] ?? D.id[k] ?? k; return typeof v === 'function' ? v(...a) : v; };

// ---------- API ----------
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  try {
    const res = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, json, ok: res.ok && json?.ok, data: json?.data, error: json?.error };
  } catch { return { status: 0, json: null, ok: false, error: { code: 'NETWORK' } }; }
}

// ---------- jam server (bukan jam HP) ----------
let anchor = null;
export async function syncClock() {
  const r = await api('/api/episode/countdown');
  const d = r.data || r.error?.timing;
  if (d) anchor = { server: d.server_epoch, perf: performance.now(), info: d };
  return d || null;
}
export const serverNow = () => (anchor ? anchor.server + (performance.now() - anchor.perf) / 1000 : Date.now() / 1000);
export const clockInfo = () => anchor?.info || null;
export const isoToSec = (iso) => Date.parse(iso) / 1000;
export function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export const fmtShort = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s` : `${sec}s`);
export const stars = (n) => '●'.repeat(n) + '○'.repeat(5 - n);
export const fmtDate = (iso) => new Date(iso).toLocaleString(prefs.lang === 'en' ? 'en-GB' : 'id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';

export function nav(current) {
  const link = (href, label, key) => h('a', { href, 'aria-current': key === current ? 'page' : false }, label);
  return h('div', { class: 'nav' }, h('a', { href: '/' }, h('img', { src: '/logo.svg', alt: 'Unknown-Dershot' })),
    h('nav', {}, link('/', 'Passcode', 'home'), link('/archive', prefs.lang === 'en' ? 'Archive' : 'Arsip', 'archive'), link('/about', prefs.lang === 'en' ? 'About' : 'Tentang', 'about'), link('/privacy', 'Privacy', 'privacy')));
}
applyPrefs();
