import { h, api, nav } from './common.js';
const app = document.getElementById('app');
let csrf = null;
const call = (path, method = 'GET', body) => api('/api/admin/' + path, { method, body, headers: csrf ? { 'x-ds-csrf': csrf } : {} });
const toast = (el, r, okMsg) => { el.className = r.ok ? 'ok' : 'bad'; el.textContent = r.ok ? okMsg : `${r.error?.code || r.status}: ${r.error?.message || 'gagal'}`; };

async function boot() {
  const me = await call('me');
  if (me.ok) { csrf = me.data.csrf; return dash(me.data.email); }
  loginView();
}
function loginView(msg) {
  const out = h('p', { role: 'status', class: 'bad' }, msg || '');
  const email = h('input', { type: 'email', autocomplete: 'username', required: true }), pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    const r = await call('login', 'POST', { email: email.value, password: pw.value }); pw.value = '';
    if (r.ok) { csrf = r.data.csrf; dash(r.data.email); }
    else out.textContent = r.error?.code === 'RATE_LIMITED' ? `Terlalu banyak percobaan. Tunggu ${r.error.retry_after || 30} detik.` : r.status === 401 ? 'Email atau password salah.' : 'Gagal masuk.';
  } }, h('label', {}, 'Email'), email, h('label', {}, 'Password'), pw, h('button', { class: 'btn primary', type: 'submit' }, 'Masuk'), out);
  app.replaceChildren(nav('admin'), h('h1', {}, 'Admin'), h('p', { class: 'lead' }, 'Khusus administrator terotorisasi.'), form);
}

function dash(emailAddr) {
  const view = h('div'); let tab = 'episodes';
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const go = (t) => { tab = t; paintTabs(); ({ episodes, stats, settings })[t](view); };
  const paintTabs = () => tabs.replaceChildren(...[['episodes', 'Episode'], ['stats', 'Statistik'], ['settings', 'Fallback']].map(([k, l]) =>
    h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => go(k) }, l)),
    h('button', { onclick: async () => { await call('logout', 'POST', {}); csrf = null; loginView(); } }, `Keluar (${emailAddr})`));
  app.replaceChildren(nav('admin'), h('h1', {}, 'Admin'), tabs, view); go('episodes');
}

async function episodes(view) {
  const r = await call('episodes');
  if (!r.ok) return view.replaceChildren(h('p', { class: 'bad' }, 'Gagal memuat: ' + (r.error?.code || r.status)));
  const rows = r.data.episodes.map((e) => h('tr', {}, h('td', {}, e.seq), h('td', {}, e.title), h('td', {}, e.difficulty), h('td', {}, e.status), h('td', {}, e.phase + (e.live ? ' • LIVE' : '')),
    h('td', { class: e.schedule_ok ? 'ok' : 'bad' }, e.schedule_ok ? 'ok' : 'jadwal beda'), h('td', {}, h('button', { class: 'btn', onclick: () => editor(view, e.seq) }, 'Edit'))));
  view.replaceChildren(h('p', {}, h('button', { class: 'btn primary', onclick: () => editor(view, null) }, '+ Episode baru'), ' ',
    h('button', { class: 'btn', onclick: async () => { const x = await call('schedule/resync', 'POST', {}); alert(x.ok ? `Disinkronkan: ${x.data.resynced}` : 'Gagal'); episodes(view); } }, 'Sinkronkan jadwal')),
    h('div', {}, h('table', {}, h('thead', {}, h('tr', {}, ['#', 'Judul', 'Lvl', 'Status', 'Fase', 'Jadwal', ''].map((x) => h('th', {}, x)))), h('tbody', {}, rows))));
}

async function editor(view, seq) {
  const e = seq ? (await call(`episodes/${seq}`)).data : { seq: '', title: '', riddle_text: '', hint1: '', hint2: '', summary: '', difficulty: 1, status: 'draft', unlock_content: { cliff: '' } };
  if (!e) return episodes(view);
  const f = {};
  const inp = (k, label, tag = 'input', val = e[k] ?? '') => { f[k] = h(tag, tag === 'select' ? {} : { value: val }); if (tag === 'textarea') f[k].value = val; return [h('label', {}, label), f[k]]; };
  f.status = h('select', {}, ['draft', 'published', 'retired'].map((s) => h('option', { value: s, selected: s === e.status }, s)));
  f.difficulty = h('select', {}, [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: n === e.difficulty }, n)));
  f.unlock_content = h('textarea', {}); f.unlock_content.value = JSON.stringify(e.unlock_content, null, 2); f.unlock_content.style.minHeight = '240px';
  const out = h('p', { role: 'status' }), checks = h('div');
  const body = () => ({ seq: Number(f.seq.value), title: f.title.value, riddle_text: f.riddle_text.value, hint1: f.hint1.value, hint2: f.hint2.value, summary: f.summary.value,
    difficulty: Number(f.difficulty.value), status: f.status.value, unlock_content: f.unlock_content.value,
    ...(f.answer.value ? { answer: f.answer.value } : {}), ...(f.solution_text.value ? { solution_text: f.solution_text.value } : {}) });
  const save = async () => {
    const b = body(); let r;
    if (seq) { delete b.seq; r = await call(`episodes/${seq}`, 'PUT', b); } else r = await call('episodes', 'POST', b);
    toast(out, r, 'Tersimpan.'); if (r.ok) { f.answer.value = ''; if (!seq) setTimeout(() => episodes(view), 600); }
  };
  const validate = async () => {
    const r = await call(`episodes/${seq}/validate`, 'POST', f.testpin.value ? { pin: f.testpin.value } : {});
    if (!r.ok) return toast(out, r, '');
    checks.replaceChildren(h('p', { class: r.data.all_ok ? 'ok' : 'bad' }, r.data.all_ok ? 'Semua pemeriksaan lolos.' : 'Ada yang gagal:'),
      h('ul', {}, r.data.checks.map((c) => h('li', { class: c.ok ? 'ok' : 'bad' }, `${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`))));
  };
  const preview = async () => {
    const r = await call(`episodes/${seq}/preview`);
    if (!r.ok) return toast(out, r, '');
    const p = r.data, ph = p.phone;
    checks.replaceChildren(h('h3', {}, 'Preview layar kunci'), h('p', { class: 'doc' }, p.lock_screen.riddle_text),
      h('p', {}, `Petunjuk terbuka setelah ${p.lock_screen.hint1_after_hours} jam dan ${p.lock_screen.hint2_after_hours} jam.`),
      h('p', { class: 'mono' }, `Isi ponsel (kumulatif sampai episode ini): ${ph.messages.length} thread, ${ph.notes.length} catatan, ${ph.gallery.length} foto, ${ph.files.length} berkas, ${ph.browser.length} halaman, ${ph.audio.length} audio, ${ph.cases.length} kasus.\nCliffhanger: ${ph.cliff || '-'}\nStatus: ${p.status}`));
  };
  const del = async () => { if (!confirm(`Hapus episode ${seq}?`)) return; const r = await call(`episodes/${seq}`, 'DELETE'); if (r.ok) episodes(view); else toast(out, r, ''); };
  view.replaceChildren(h('button', { class: 'btn', onclick: () => episodes(view) }, '← Daftar'), h('h2', {}, seq ? `Edit episode ${seq}` : 'Episode baru'),
    h('div', { class: 'cols' }, h('div', {}, inp('seq', 'Slot ke- (menentukan jadwal 48 jam)', 'input', e.seq)), h('div', {}, h('label', {}, 'Tingkat kesulitan'), f.difficulty)),
    inp('title', 'Judul'), inp('riddle_text', 'Teka-teki', 'textarea'), inp('hint1', 'Petunjuk 1', 'textarea'), inp('hint2', 'Petunjuk 2', 'textarea'), inp('summary', 'Ringkasan (publik)', 'textarea'),
    h('label', {}, 'Status'), f.status,
    h('div', { class: 'cols' }, h('div', {}, inp('answer', seq ? 'Jawaban baru (kosongkan = tidak diubah)' : 'Jawaban (4 digit)', 'input', '')), h('div', {}, inp('solution_text', seq ? 'Penjelasan solusi (kosongkan = tetap)' : 'Penjelasan solusi', 'textarea', ''))),
    h('label', {}, 'Konten unlock (JSON: messages, notes, gallery, files, browser, audio, cases, cliff)'), f.unlock_content,
    h('p', {}, h('button', { class: 'btn primary', onclick: save }, 'Simpan'), ' ', seq ? [h('button', { class: 'btn', onclick: preview }, 'Preview'), ' ', h('button', { class: 'btn', onclick: validate }, 'Validasi'), ' ', h('button', { class: 'btn', onclick: del }, 'Hapus')] : null),
    seq ? [h('label', {}, 'PIN uji untuk validasi (tidak disimpan)'), (f.testpin = h('input', { inputmode: 'numeric', maxlength: 4, autocomplete: 'off' }))] : null, out, checks);
  f.answer.setAttribute('autocomplete', 'off');
  if (seq) f.seq.setAttribute('disabled', '');
}

async function stats(view) {
  const r = await call('stats');
  if (!r.ok) return view.replaceChildren(h('p', { class: 'bad' }, 'Gagal memuat.'));
  const tbl = (rows, cols) => h('table', {}, h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, c[1])))), h('tbody', {}, rows.map((x) => h('tr', {}, cols.map((c) => h('td', {}, x[c[0]]))))));
  view.replaceChildren(h('p', { class: 'lead' }, 'Hanya angka agregat. PIN, IP, dan identitas tidak disimpan.'), h('h2', {}, 'Per episode'),
    tbl(r.data.per_episode, [['seq', 'Episode'], ['total', 'Percobaan'], ['correct', 'Benar']]), h('h2', {}, '14 hari terakhir'), tbl(r.data.per_day, [['day', 'Hari (UTC)'], ['total', 'Percobaan'], ['correct', 'Benar']]));
}

async function settings(view) {
  const r = await call('settings');
  const t1 = h('input', { value: r.data?.fallback_title || '' }), t2 = h('textarea', {}); t2.value = r.data?.fallback_message || '';
  const out = h('p', { role: 'status' });
  view.replaceChildren(h('p', { class: 'lead' }, 'Tampil di layar kunci saat tidak ada episode aktif (sebelum rilis, atau jadwal habis). Saat database gagal, server memakai pesan bawaan.'),
    h('label', {}, 'Judul'), t1, h('label', {}, 'Pesan'), t2, h('p', {}, h('button', { class: 'btn primary', onclick: async () => toast(out, await call('settings', 'PUT', { fallback_title: t1.value, fallback_message: t2.value }), 'Tersimpan.') }, 'Simpan')), out);
}
boot();
