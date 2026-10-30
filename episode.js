import { h, api, nav, stars, fmtDate } from './common.js';
const app = document.getElementById('app');
app.replaceChildren(nav('archive'));
const id = location.pathname.split('/').pop();
const r = await api('/api/archive/' + encodeURIComponent(id));
if (!r.ok) {
  app.append(h('h1', {}, 'Terkunci'), h('p', { class: 'lead' }, r.status === 404 ? 'Episode ini belum berakhir, atau tidak ada. Hanya episode yang sudah selesai yang masuk arsip.' : 'Arsip sedang tidak terjangkau.'),
    h('a', { class: 'btn primary', href: '/' }, 'Ke layar kunci'), ' ', h('a', { class: 'btn', href: '/archive' }, 'Arsip'));
} else {
  const e = r.data, c = e.content || {};
  document.title = `${e.title} — Unknown-Dershot`;
  const sec = (title, kids) => (kids.length ? [h('h2', {}, title), ...kids] : []);
  app.append(h('div', { class: 'meta glitch' }, `EPISODE ${String(e.seq).padStart(2, '0')} · ${fmtDate(e.starts_at)} → ${fmtDate(e.ends_at)}`),
    h('h1', {}, e.title), h('p', { class: 'diff' }, stars(e.difficulty)), h('p', { class: 'lead' }, e.summary),
    h('h2', {}, 'Teka-teki'), h('p', { class: 'doc' }, e.riddle_text),
    h('h2', {}, 'Petunjuk'), h('ol', {}, e.hints.map((x) => h('li', {}, x))),
    h('h2', {}, 'Solusi'), e.solution ? [h('p', {}, 'PIN: ', h('code', {}, e.solution.pin)), h('p', {}, e.solution.text)] : h('p', {}, 'Penjelasan tidak tersedia.'),
    sec('Pesan', (c.messages || []).map((m) => h('p', {}, h('b', {}, `${m.thread} — ${m.from}: `), m.text))),
    sec('Catatan', (c.notes || []).map((n) => h('p', {}, h('b', {}, n.title + ': '), n.text))),
    sec('Berkas', (c.files || []).map((n) => h('p', {}, h('b', {}, n.name + ': '), n.text))),
    sec('Rekaman', (c.audio || []).map((a) => h('div', {}, h('b', {}, `${a.title} (${a.duration})`), a.transcript.map((l) => h('p', {}, `${l.t} ${l.speaker}: ${l.text}`))))),
    sec('Kasus', (c.cases || []).map((k) => h('div', {}, h('b', {}, `${k.title} — ${k.status}`), k.entries.map((x) => h('p', {}, `${x.date}: ${x.text}`))))),
    c.cliff ? [h('h2', {}, 'Cliffhanger'), h('p', { class: 'lead' }, c.cliff)] : null,
    h('p', {}, e.prev ? h('a', { class: 'btn', href: `/episode/${e.prev}` }, '← Sebelumnya') : null, ' ', e.next ? h('a', { class: 'btn', href: `/episode/${e.next}` }, 'Berikutnya →') : null));
}
