import { h, svg, api, t, prefs, syncClock, serverNow, clockInfo, isoToSec, fmtDur, fmtShort, stars, fmtDate } from './common.js';
import { openPhone } from './phone.js';

const root = document.getElementById('device');
let state = { ep: null, pin: '', busy: false, blockedUntil: 0, view: null, timers: [], mode: 'active' };

const LETTERS = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
const clearTimers = () => { state.timers.forEach(clearInterval); state.timers = []; };

function statusBar() {
  const clock = h('span', { id: 'sb-time' });
  const tick = () => { const d = new Date(serverNow() * 1000); clock.textContent = d.toISOString().slice(11, 16); };
  tick(); state.timers.push(setInterval(tick, 1000));
  return h('div', { class: 'statusbar', 'aria-hidden': 'true' }, h('span', { class: 'carrier' }, 'DERSHOT'),
    h('span', {}, clock, ' ', h('span', { class: 'sig' }, h('i'), h('i'), h('i'), h('i')), h('span', { class: 'batt' })));
}

function bootSplash() {
  const el = h('div', { class: 'boot', role: 'status' },
    svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, svg('circle', { cx: 32, cy: 32, r: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-dasharray': '1.8 2.6' }), svg('path', { d: 'M40 10 28 54', stroke: '#e3b25a', 'stroke-width': 3, 'stroke-linecap': 'round' })),
    h('span', {}, 'D E R S H O T'));
  root.append(el);
  return () => { el.classList.add('done'); setTimeout(() => el.remove(), 700); };
}

async function init() {
  clearTimers(); root.replaceChildren();
  const hideBoot = bootSplash();
  const [info, cur] = await Promise.all([syncClock(), api('/api/episode/current')]);
  const minWait = new Promise((r) => setTimeout(r, 600)); await minWait;
  if (cur.ok) {
    const d = cur.data;
    if (d.state === 'active') { state.ep = d.episode; state.mode = 'active'; }
    else { state.ep = null; state.mode = d.state; state.fallback = d.fallback; }
  } else if (cur.status === 503) { state.ep = null; state.mode = 'degraded'; state.fallback = cur.error?.fallback; }
  else { state.ep = null; state.mode = 'degraded'; state.fallback = { title: t('net'), message: t('net') }; }

  // Jika sudah membuka episode ini (cookie masih berlaku), langsung ke ponsel.
  if (state.mode === 'active') {
    const c = await api('/api/unlocked/content');
    if (c.ok) { hideBoot(); return openPhone(root, c.data, { onLock: init }); }
  }
  renderLock(); hideBoot();
}

function renderLock() {
  clearTimers();
  const info = clockInfo();
  const ep = state.ep;
  const clockEl = h('div', { class: 'clock', id: 'big-clock' });
  const dateEl = h('div', { class: 'date' });
  const tickClock = () => {
    const d = new Date(serverNow() * 1000);
    clockEl.textContent = d.toISOString().slice(11, 16);
    dateEl.textContent = d.toLocaleDateString(prefs.lang === 'en' ? 'en-GB' : 'id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  };
  tickClock();

  const countdown = h('b', {}, '--:--:--');
  const chip = h('div', { class: 'chip', 'aria-live': 'off' }, h('i', { class: 'pulse' }), h('span', {}, state.mode === 'pre_launch' ? t('preIn') : t('next'), ' ', countdown));
  const targetSec = () => (info ? isoToSec(state.mode === 'pre_launch' ? info.ends_at : info.ends_at) : 0);
  let reloaded = false;
  const tickCount = () => {
    tickClock();
    const left = targetSec() - serverNow();
    countdown.textContent = fmtDur(left);
    if (info && left <= -1 && !reloaded) { reloaded = true; setTimeout(init, 800 + Math.random() * 1500); }
  };
  tickCount(); state.timers.push(setInterval(tickCount, 1000));

  const msg = h('p', { class: 'msg', role: 'status', 'aria-live': 'polite' });
  const dotsEl = h('div', { class: 'dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('span', { class: 'dot' })));
  const keys = h('div', { class: 'pad', role: 'group', 'aria-label': 'Keypad' });
  const dis = state.mode !== 'active';
  const mk = (n) => h('button', { class: 'key', type: 'button', 'data-k': n, 'aria-label': String(n), disabled: dis, onclick: () => press(String(n)) },
    String(n), h('small', {}, LETTERS[n] || ''));
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) keys.append(mk(n));
  keys.append(h('span', { class: 'key ghost' }), mk(0), h('span', { class: 'key ghost' }));

  const cancelBtn = h('button', { class: 'cancel', type: 'button', onclick: onCancel }, t('cancel'));
  const noteCard = ep
    ? h('button', { class: 'note', type: 'button', onclick: openRiddle },
        h('small', {}, `${t('encrypted')} · ${t('ep')} ${String(ep.seq).padStart(2, '0')}`), h('p', {}, ep.riddle_text), h('em', {}, t('read')))
    : h('div', { class: 'note' }, h('small', {}, state.fallback?.title || ''), h('p', {}, state.fallback?.message || t('dormant')));

  const screen = h('section', { class: 'screen lock', 'aria-label': 'Lock screen' },
    h('div', { class: 'wall' }), h('div', { class: 'grain' }), statusBar(), clockEl, dateEl, chip, noteCard,
    h('h1', {}, t('enter')), dotsEl, msg, keys,
    h('div', { class: 'bottom' }, h('button', { class: 'em', type: 'button', onclick: openEmergency }, t('emergency')), cancelBtn));
  root.replaceChildren(screen);
  state.view = { screen, msg, dotsEl, keys, cancelBtn };
  if (state.mode === 'degraded') setMsg(state.fallback?.message || t('down'), true);

  function onCancel() {
    if (state.pin.length) { state.pin = state.pin.slice(0, -1); paint(); }
    else { // Cancel dalam konteks fiksi: layar "tidur" — redup sampai disentuh
      screen.classList.add('asleep'); screen.style.opacity = '.12';
      const wake = () => { screen.style.opacity = ''; screen.classList.remove('asleep'); removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true); };
      setTimeout(() => { addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); }, 50);
    }
  }
}

function paint() {
  const { dotsEl, cancelBtn } = state.view;
  [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i < state.pin.length));
  cancelBtn.textContent = state.pin.length ? t('del') : t('cancel');
}
function setMsg(text, err) { if (!state.view) return; state.view.msg.textContent = text || ''; state.view.msg.classList.toggle('err', !!err); }
function setDisabled(v) { state.view?.keys.querySelectorAll('button').forEach((b) => { b.disabled = v; }); }

function press(d) {
  if (state.busy || state.mode !== 'active' || state.pin.length >= 4 || serverNow() < state.blockedUntil) return;
  state.pin += d; setMsg(''); paint();
  if (state.pin.length === 4) submit();
}

async function submit() {
  state.busy = true; setDisabled(true);
  const pin = state.pin;
  const r = await api('/api/passcode/verify', { method: 'POST', body: { pin, episode_id: state.ep.id } });
  state.pin = '';
  if (r.ok) return unlock();
  const code = r.error?.code;
  const fail = (text, wait) => {
    const { dotsEl } = state.view; dotsEl.classList.add('shake'); navigator.vibrate?.(60);
    setTimeout(() => { dotsEl.classList.remove('shake'); paint(); state.busy = false; if (!wait) setDisabled(false); }, 480);
    setMsg(text, true);
  };
  if (code === 'WRONG_CODE') fail(t('wrong'));
  else if (code === 'RATE_LIMITED') {
    const secs = Math.max(1, r.error.retry_after || 30); state.blockedUntil = serverNow() + secs;
    fail(t('wait', fmtShort(secs)), true);
    const iv = setInterval(() => {
      const left = Math.ceil(state.blockedUntil - serverNow());
      if (left <= 0) { clearInterval(iv); setMsg(''); setDisabled(false); state.busy = false; } else setMsg(t('wait', fmtShort(left)), true);
    }, 1000); state.timers.push(iv);
  } else if (code === 'EPISODE_CHANGED') { setMsg(t('changed'), true); setTimeout(init, 900); }
  else if (code === 'INVALID_INPUT') fail(t('invalid'));
  else if (r.status === 503 || code === 'SERVICE_DEGRADED') fail(t('down'));
  else if (code === 'NO_ACTIVE_EPISODE') { setMsg(t('dormant'), true); setTimeout(init, 1200); }
  else fail(r.status === 0 ? t('net') : t('down'));
}

async function unlock() {
  setMsg(t('unlocking'));
  const { dotsEl, screen } = state.view;
  [...dotsEl.children].forEach((d) => d.classList.add('on'));
  const c = await api('/api/unlocked/content');
  if (!c.ok) { state.busy = false; setDisabled(false); setMsg(t('down'), true); paint(); return; }
  screen.classList.add('opening');
  setTimeout(() => { clearTimers(); state.busy = false; openPhone(root, c.data, { onLock: init }); }, 520);
}

// ----- sheet -----
function sheet(content) {
  const wrap = h('div', { class: 'sheet-wrap', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet' }, h('div', { class: 'grab' }), content));
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const btn = h('button', { class: 'btn', type: 'button', onclick: close }, t('closeX'));
  wrap.firstChild.append(btn);
  root.append(wrap); btn.focus();
  return close;
}
function hintBlocks() {
  const info = clockInfo();
  return (state.ep?.hints || []).map((hh) => {
    const left = isoToSec(hh.available_at) - serverNow();
    return hh.text ? h('div', { class: 'hint' }, h('b', {}, `${t('hint')} ${hh.level}: `), hh.text)
      : h('div', { class: 'hint locked' }, `${t('hint')} ${hh.level} — ${t('hintLocked', `${t('hintIn')} ${fmtDur(left)}`)}`);
  });
}
function openRiddle() {
  const ep = state.ep; if (!ep) return;
  sheet([h('div', { class: 'meta' }, `${t('ep')} ${String(ep.seq).padStart(2, '0')} · ${t('diff')} `, h('span', { class: 'diff' }, stars(ep.difficulty))),
    h('h2', {}, ep.title), h('div', { class: 'riddle' }, ep.riddle_text), hintBlocks()]);
}
function openEmergency() {
  sheet([h('h2', {}, t('emTitle')),
    h('dl', { class: 'medid' }, h('dt', {}, t('emOwner')), h('dd', {}, t('emUnknown')), h('dt', {}, t('emBlood')), h('dd', {}, h('span', { class: 'redact' }, 'AB+')),
      h('dt', {}, t('emContact')), h('dd', {}, t('emNone'))),
    state.ep ? [h('div', { class: 'meta' }, t('emHints').toUpperCase()), hintBlocks()] : null,
    h('p', { class: 'meta' }, t('emNote')),
    h('a', { class: 'btn', href: '/archive' }, t('viewArchive'))]);
}

addEventListener('keydown', (e) => {
  if (!state.view || document.querySelector('.sheet-wrap')) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace' && state.pin.length && !state.busy) { state.pin = state.pin.slice(0, -1); paint(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.mode !== 'degraded') syncClock(); });
init();
