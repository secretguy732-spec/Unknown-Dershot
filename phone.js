import { h, svg, api, t, prefs, applyPrefs, serverNow, clockInfo, syncClock, isoToSec, fmtDur, fmtDate } from './common.js';

const ICONS = {
  messages: ['M4 5h16v11H9l-5 4z'], notes: ['M6 3h12v18H6z', 'M9 8h6M9 12h6M9 16h3'],
  gallery: ['M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 6', 'M15 9h.01'], files: ['M3 6h6l2 2h10v11H3z'],
  browser: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  audio: ['M4 12v0M8 8v8M12 4v16M16 8v8M20 12v0'], cases: ['M3 8h18v12H3z', 'M8 8V5h8v3', 'M3 13h18'],
  settings: ['M4 7h10M18 7h2M4 17h2M10 17h10', 'M16 5v4M8 15v4'],
};
const icon = (k) => svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ICONS[k].map((d) => svg('path', { d })));

// RNG deterministik (mis. gambar & gelombang konsisten untuk teks yang sama)
const hash = (s) => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

export function openPhone(root, data, { onLock }) {
  const C = data.content;
  const timers = [];
  const stop = () => timers.forEach(clearInterval);
  root.replaceChildren();
  const screen = h('section', { class: 'screen home', 'aria-label': 'Home' });
  root.append(screen);
  const lang = () => prefs.lang;

  // Sesi berakhir saat episode berganti -> kunci ulang otomatis
  const endAt = isoToSec(data.expires_at);
  timers.push(setInterval(() => { if (serverNow() >= endAt + 1) { stop(); alert(t('expired')); onLock(); } }, 1000));

  const count = {
    messages: C.messages.reduce((n, th) => n + th.items.filter((i) => i.ep === C.current_ep).length, 0),
    notes: C.notes.filter((i) => i.ep === C.current_ep).length, gallery: C.gallery.filter((i) => i.ep === C.current_ep).length,
    files: C.files.filter((i) => i.ep === C.current_ep).length, browser: C.browser.filter((i) => i.ep === C.current_ep).length,
    audio: C.audio.filter((i) => i.ep === C.current_ep).length,
    cases: C.cases.reduce((n, k) => n + k.entries.filter((e) => e.ep === C.current_ep).length, 0),
  };
  const APPS = [['messages', 'msgs', renderMessages], ['notes', 'notes', renderNotes], ['gallery', 'gallery', renderGallery], ['files', 'files', renderFiles],
    ['browser', 'browser', renderBrowser], ['audio', 'audio', renderAudio], ['cases', 'cases', renderCases], ['settings', 'settings', renderSettings]];

  function home() {
    stop2();
    const summary = lang() === 'en' && data.episode.summary_en ? data.episode.summary_en : data.episode.summary;
    const left = h('b', {}, '--:--:--');
    const tick = () => { left.textContent = fmtDur(endAt - serverNow()); };
    tick(); appTimers.push(setInterval(tick, 1000));
    screen.className = 'screen home';
    screen.replaceChildren(h('div', { class: 'wall' }), h('div', { class: 'grain' }),
      h('div', { class: 'statusbar', 'aria-hidden': 'true' }, h('span', { class: 'carrier' }, 'DERSHOT'), h('span', {}, h('span', { class: 'sig' }, h('i'), h('i'), h('i'), h('i')), h('span', { class: 'batt' }))),
      h('header', {}, h('div', { class: 'ep' }, `${t('ep')} ${String(data.episode.seq).padStart(2, '0')}`), h('h2', {}, data.episode.title),
        h('p', { class: 'cliff' }, C.cliff || summary)),
      h('nav', { class: 'grid', 'aria-label': 'Apps' }, APPS.map(([key, label, fn]) =>
        h('button', { class: 'app', type: 'button', onclick: () => openApp(key, label, fn) }, h('span', { class: 'ico' }, icon(key)), t(label),
          count[key] ? h('span', { class: 'badge', 'aria-label': `${count[key]} ${t('newItems')}` }, count[key]) : null))),
      h('div', { class: 'foot' }, h('div', { class: 'chip' }, h('i', { class: 'pulse' }), h('span', {}, t('next'), ' ', left)),
        h('p', { class: 'ep' }, h('a', { href: '/archive' }, t('viewArchive')))),
      h('div', { class: 'homebar' }));
  }
  const appTimers = [];
  const stop2 = () => { appTimers.splice(0).forEach(clearInterval); };

  function openApp(key, label, fn) {
    stop2();
    screen.className = 'screen appview';
    const body = h('div', { class: 'appbody' });
    const title = h('h2', {}, t(label));
    const backBtn = h('button', { class: 'back', type: 'button', onclick: home }, t('back'));
    screen.replaceChildren(h('div', { class: 'appbar' }, backBtn, title), body);
    const ctl = { body, title, back: backBtn, goHome: home, setBack(fn2, text) { backBtn.onclick = fn2; backBtn.textContent = text || t('back'); }, reset() { backBtn.onclick = home; backBtn.textContent = t('back'); title.textContent = t(label); } };
    fn(ctl); backBtn.focus();
  }
  const empty = (body) => body.append(h('p', { class: 'empty' }, t('empty')));
  const isNew = (ep) => ep === C.current_ep;

  // ---------------- Messages ----------------
  function renderMessages(ctl) {
    const list = () => {
      ctl.reset(); ctl.body.replaceChildren();
      if (!C.messages.length) return empty(ctl.body);
      for (const th of C.messages) {
        const last = th.items[th.items.length - 1];
        ctl.body.append(h('button', { class: 'row', type: 'button', onclick: () => thread(th) },
          h('div', { class: 't' }, h('b', {}, th.thread), h('span', {}, last.text)), th.items.some((i) => isNew(i.ep)) ? h('i', { class: 'newdot' }) : null));
      }
    };
    const thread = (th) => {
      ctl.title.textContent = th.thread; ctl.setBack(list);
      ctl.body.replaceChildren();
      let prev = '';
      for (const m of th.items) {
        if (!m.mine && m.from !== prev) ctl.body.append(h('div', { class: 'sender' }, m.from));
        prev = m.mine ? '' : m.from;
        ctl.body.append(h('div', { class: 'bubble' + (m.mine ? ' mine' : '') }, m.text, m.at ? h('small', {}, m.at) : null));
      }
      ctl.body.scrollTop = ctl.body.scrollHeight;
    };
    list();
  }

  // ---------------- Notes / Files (daftar -> dokumen) ----------------
  function docApp(items, nameKey, mono) {
    return (ctl) => {
      const list = () => {
        ctl.reset(); ctl.body.replaceChildren();
        if (!items.length) return empty(ctl.body);
        [...items].reverse().forEach((it) => ctl.body.append(h('button', { class: 'row', type: 'button', onclick: () => open(it) },
          h('div', { class: 't' }, h('b', {}, it[nameKey]), h('span', {}, it.text.replace(/\s+/g, ' '))), isNew(it.ep) ? h('i', { class: 'newdot' }) : null)));
      };
      const open = (it) => { ctl.title.textContent = it[nameKey]; ctl.setBack(list); ctl.body.replaceChildren(h('div', { class: mono ? 'mono' : 'doc' }, it.text)); };
      list();
    };
  }
  const renderNotes = docApp(C.notes, 'title', false);
  const renderFiles = docApp(C.files, 'name', true);

  // ---------------- Gallery ----------------
  function photoSvg(g, big) {
    const W = 320, H = 220, r = rng(hash(g.caption));
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': g.caption });
    s.append(svg('rect', { width: W, height: H, fill: '#101113' }));
    for (let i = 0; i < 90; i++) s.append(svg('rect', { x: r() * W, y: r() * H, width: 1 + r() * 2, height: 1, fill: '#fff', opacity: (0.04 + r() * 0.1).toFixed(2) }));
    if (g.kind === 'clock') {
      const [hh, mm] = g.time.split(':').map(Number), cx = W / 2, cy = H / 2, R = 78;
      s.append(svg('circle', { cx, cy, r: R, fill: '#16171a', stroke: '#8e9195', 'stroke-width': 3 }));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s.append(svg('line', { x1: cx + Math.sin(a) * (R - 6), y1: cy - Math.cos(a) * (R - 6), x2: cx + Math.sin(a) * (R - (i % 3 ? 11 : 17)), y2: cy - Math.cos(a) * (R - (i % 3 ? 11 : 17)), stroke: '#ebe9e4', 'stroke-width': i % 3 ? 1.5 : 3 })); }
      const ha = (((hh % 12) + mm / 60) / 12) * Math.PI * 2, ma = (mm / 60) * Math.PI * 2;
      s.append(svg('line', { x1: cx, y1: cy, x2: cx + Math.sin(ha) * 40, y2: cy - Math.cos(ha) * 40, stroke: '#ebe9e4', 'stroke-width': 5, 'stroke-linecap': 'round' }));
      s.append(svg('line', { x1: cx, y1: cy, x2: cx + Math.sin(ma) * 62, y2: cy - Math.cos(ma) * 62, stroke: '#ebe9e4', 'stroke-width': 3, 'stroke-linecap': 'round' }));
      s.append(svg('circle', { cx, cy, r: 4, fill: '#e3b25a' }));
      s.append(svg('path', { d: `M${cx - 40} ${cy - R - 2} l9 14 -6 10 12 8`, stroke: '#e3b25a', 'stroke-width': 1.4, fill: 'none', opacity: 0.8 })); // retak kaca
    } else if (g.kind === 'symbols') {
      (g.lines || []).forEach((ln, i) => s.append(svg('text', { x: W / 2, y: 62 + i * 52, 'text-anchor': 'middle', fill: '#ebe9e4', 'font-size': 36, 'letter-spacing': 14, 'font-family': 'system-ui,sans-serif', opacity: 0.88 }, ln)));
    } else {
      for (let i = 0; i < 7; i++) s.append(svg('line', { x1: r() * W, y1: r() * H, x2: r() * W, y2: r() * H, stroke: '#ebe9e4', 'stroke-width': 0.8, opacity: 0.25 }));
      (g.lines || []).forEach((ln, i) => s.append(svg('text', { x: 18, y: H - 56 + i * 22, fill: '#ebe9e4', 'font-size': 14, 'font-family': 'ui-monospace,monospace', opacity: 0.85 }, ln)));
    }
    s.append(svg('rect', { x: 1, y: 1, width: W - 2, height: H - 2, fill: 'none', stroke: '#fff', opacity: 0.08 }));
    return s;
  }
  function renderGallery(ctl) {
    const grid = () => {
      ctl.reset(); ctl.body.replaceChildren();
      if (!C.gallery.length) return empty(ctl.body);
      ctl.body.append(h('div', { class: 'photos' }, [...C.gallery].reverse().map((g) =>
        h('button', { class: 'photo', type: 'button', onclick: () => one(g) }, photoSvg(g), h('span', {}, g.caption)))));
    };
    const one = (g) => { ctl.title.textContent = g.caption; ctl.setBack(grid); ctl.body.replaceChildren(h('div', { class: 'bigphoto' }, photoSvg(g, true)), h('p', { class: 'mono' }, g.caption)); };
    grid();
  }

  // ---------------- Browser ----------------
  function renderBrowser(ctl) {
    const list = () => {
      ctl.reset(); ctl.body.replaceChildren(h('p', { class: 'ep' }, t('history').toUpperCase()));
      if (!C.browser.length) return empty(ctl.body);
      [...C.browser].reverse().forEach((p) => ctl.body.append(h('button', { class: 'row', type: 'button', onclick: () => page(p) },
        h('div', { class: 't' }, h('b', {}, p.title), h('span', {}, p.url)), isNew(p.ep) ? h('i', { class: 'newdot' }) : null)));
    };
    const page = (p) => { ctl.title.textContent = p.url.split('/')[0]; ctl.setBack(list); ctl.body.replaceChildren(h('div', { class: 'urlbar' }, '🔒 ' + p.url), h('article', { class: 'page' }, h('h1', {}, p.title), p.body.map((x) => h('p', {}, x)))); };
    list();
  }

  // ---------------- Audio Logs ----------------
  const secs = (s) => { const [m, ss] = s.split(':').map(Number); return m * 60 + ss; };
  function renderAudio(ctl) {
    const list = () => {
      ctl.reset(); ctl.body.replaceChildren();
      if (!C.audio.length) return empty(ctl.body);
      [...C.audio].reverse().forEach((a) => ctl.body.append(h('button', { class: 'row', type: 'button', onclick: () => player(a) },
        h('div', { class: 't' }, h('b', {}, a.title), h('span', {}, a.duration)), isNew(a.ep) ? h('i', { class: 'newdot' }) : null)));
    };
    const player = (a) => {
      ctl.title.textContent = a.title; let iv = null;
      ctl.setBack(() => { clearInterval(iv); list(); });
      const total = secs(a.duration), r = rng(hash(a.title));
      const bars = Array.from({ length: 48 }, () => { const i = h('i'); i.style.height = `${18 + r() * 82}%`; return i; });
      let pos = 0, speed = 4, playing = false;
      const time = h('span', { class: 'mono' }, `00:00 / ${a.duration}`);
      const lines = a.transcript.map((l) => h('div', { class: 'tl future' }, h('div', { class: 'who' }, `${l.t} · ${l.speaker}`), h('div', {}, l.text)));
      const playBtn = h('button', { class: 'play', type: 'button', 'aria-label': 'Play/Pause', onclick: toggle }, '▶');
      const speedBtn = h('button', { class: 'btn', type: 'button', onclick: () => { speed = speed === 1 ? 4 : speed === 4 ? 16 : 1; speedBtn.textContent = `${t('speed')} ${speed}×`; } }, `${t('speed')} 4×`);
      const upd = () => {
        const f = pos / total; bars.forEach((b, i) => b.classList.toggle('on', i / bars.length < f));
        time.textContent = `${String(Math.floor(pos / 60)).padStart(2, '0')}:${String(Math.floor(pos % 60)).padStart(2, '0')} / ${a.duration}`;
        let cur = -1; a.transcript.forEach((l, i) => { if (secs(l.t) <= pos) cur = i; });
        lines.forEach((el, i) => { el.classList.toggle('now', i === cur); el.classList.toggle('future', i > cur); });
        if (cur >= 0) lines[cur].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      function toggle() {
        playing = !playing; playBtn.textContent = playing ? '❚❚' : '▶'; clearInterval(iv);
        if (playing) { if (pos >= total) pos = 0; iv = setInterval(() => { pos = Math.min(total, pos + speed * 0.25); upd(); if (pos >= total) { playing = false; playBtn.textContent = '▶'; clearInterval(iv); } }, 250); appTimers.push(iv); }
      }
      ctl.body.replaceChildren(h('div', { class: 'player' }, playBtn, h('div', { class: 'wave', 'aria-hidden': 'true' }, bars)), h('div', {}, time, ' ', speedBtn),
        h('p', { class: 'ep' }, t('transcript').toUpperCase()), lines);
      upd();
    };
    list();
  }

  // ---------------- Case Files ----------------
  function renderCases(ctl) {
    const list = () => {
      ctl.reset(); ctl.body.replaceChildren();
      if (!C.cases.length) return empty(ctl.body);
      C.cases.forEach((k) => ctl.body.append(h('button', { class: 'row', type: 'button', onclick: () => one(k) },
        h('div', { class: 't' }, h('b', {}, k.title), h('span', {}, `${t('status')}: ${k.status} · ${k.entries.length}`)), k.entries.some((e) => isNew(e.ep)) ? h('i', { class: 'newdot' }) : null)));
    };
    const one = (k) => {
      ctl.title.textContent = k.id; ctl.setBack(list);
      ctl.body.replaceChildren(h('h3', {}, k.title, ' ', h('span', { class: 'tag' }, k.status)),
        h('ol', { class: 'timeline' }, k.entries.map((e) => h('li', { class: isNew(e.ep) ? 'new' : '' }, h('time', {}, e.date), e.text))));
    };
    list();
  }

  // ---------------- Settings ----------------
  function renderSettings(ctl) {
    const draw = () => {
      const seg = (cur, opts, set) => h('div', { class: 'opt' }, opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(cur === v), onclick: () => { set(v); applyPrefs(); ctl.title.textContent = t('settings'); draw(); } }, label)));
      ctl.body.replaceChildren(
        h('label', {}, t('theme')), seg(prefs.theme, [['dark', t('themeDark')], ['ash', t('themeAsh')], ['mono', t('themeMono')]], (v) => { prefs.theme = v; }),
        h('label', {}, t('lang')), seg(prefs.lang, [['id', 'Indonesia'], ['en', 'English']], (v) => { prefs.lang = v; }),
        h('label', {}, t('textSize')), seg(prefs.fs, [['m', t('m')], ['l', t('l')]], (v) => { prefs.fs = v; }),
        h('label', {}, t('about')),
        h('p', { class: 'mono' }, `${data.episode.id}\n${t('session')}: ${fmtDate(data.expires_at)}`),
        h('button', { class: 'btn primary', type: 'button', onclick: async () => { await api('/api/passcode/lock', { method: 'POST' }); stop(); stop2(); onLock(); } }, t('lockNow')));
      ctl.back.textContent = t('back');
    };
    draw();
  }

  home();
}
