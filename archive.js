import { h, api, nav, stars, fmtDate, prefs } from './common.js';
const app = document.getElementById('app');
app.replaceChildren(nav('archive'), h('h1', {}, prefs.lang === 'en' ? 'Archive' : 'Arsip'),
  h('p', { class: 'lead' }, 'Episode yang sudah berakhir, lengkap dengan pembahasan solusinya.'));
const list = h('div', {}, h('p', { class: 'glitch' }, '…')); app.append(list);
const r = await api('/api/archive');
if (!r.ok) list.replaceChildren(h('p', {}, r.status === 503 ? 'Arsip sedang tidak terjangkau. Coba lagi sebentar lagi.' : 'Gagal memuat arsip.'));
else {
  const { episodes, active_seq } = r.data;
  const items = [];
  if (active_seq) items.push(h('div', { class: 'card' }, h('div', { class: 'meta' }, `EPISODE ${String(active_seq).padStart(2, '0')} · SEDANG BERLANGSUNG`), h('h3', {}, '▒▒▒▒▒▒▒▒'),
    h('p', {}, 'Terkunci sampai berakhir. '), h('a', { class: 'btn', href: '/' }, 'Buka layar kunci')));
  for (const e of episodes) items.push(h('a', { class: 'card', href: `/episode/${e.id}` }, h('div', { class: 'meta' }, `EPISODE ${String(e.seq).padStart(2, '0')} · ${fmtDate(e.starts_at)}`),
    h('h3', {}, e.title), h('p', {}, e.summary), h('p', { class: 'diff' }, stars(e.difficulty))));
  if (!items.length) items.push(h('p', {}, 'Belum ada episode yang berakhir.'));
  list.replaceChildren(...items);
}
