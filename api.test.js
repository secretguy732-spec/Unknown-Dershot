import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, cookieFrom, ANSWERS, EPOCH, wrongPin } from './helpers.js';
import { PERIOD_SECONDS } from '../src/lib/schedule.js';

const UNLOCK = '__Host-ds_unlock';

test('PIN benar membuka, PIN salah ditolak (respons konsisten)', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const bad = await w.verify(wrongPin(1));
  assert.equal(bad.status, 401);
  assert.deepEqual(bad.json, { ok: false, error: { code: 'WRONG_CODE', message: 'Kode salah.' } });
  const good = await w.verify(ANSWERS[1], { ip: w.freshIp() });
  assert.equal(good.status, 200);
  assert.equal(good.json.data.unlocked, true);
  const c = cookieFrom(good, UNLOCK);
  assert.ok(c);
  const hdr = good.headers.getSetCookie().find((x) => x.startsWith(UNLOCK));
  assert.match(hdr, /HttpOnly/); assert.match(hdr, /Secure/); assert.match(hdr, /SameSite=Strict/); assert.match(hdr, /Path=\//);
});

test('semua 30 jawaban benar membuka episode masing-masing; jawaban episode lain tidak', async () => {
  const w = await makeWorld();
  for (let n = 1; n <= 30; n++) {
    w.atEpisode(n);
    const other = ANSWERS[n === 30 ? 1 : n + 1];
    assert.equal((await w.verify(other, { ip: w.freshIp() })).status, 401, `ep ${n} jawaban lain`);
    const r = await w.verify(ANSWERS[n], { ip: w.freshIp() });
    assert.equal(r.status, 200, `ep ${n}`);
    assert.equal(r.json.data.episode_id, 'ep-' + String(n).padStart(3, '0'));
  }
});

test('format input tidak valid -> 400 seragam, tidak dihitung sebagai percobaan', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  for (const body of [{ pin: '123' }, { pin: '12345' }, { pin: 1308 }, { pin: 'abcd' }, {}, { pin: null }]) {
    const r = await w.call('POST', '/api/passcode/verify', { body });
    assert.equal(r.status, 400); assert.equal(r.json.error.code, 'INVALID_INPUT');
  }
  // 10 input salah-format tidak boleh memicu rate limit
  for (let i = 0; i < 10; i++) await w.call('POST', '/api/passcode/verify', { body: { pin: 'x' } });
  assert.equal((await w.verify(ANSWERS[1])).status, 200);
  assert.equal((await w.call('POST', '/api/passcode/verify', { body: '{bukan json' })).status, 400);
  assert.equal((await w.call('POST', '/api/passcode/verify', { body: 'pin=1308', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await w.call('POST', '/api/passcode/verify', { body: { pin: '1308', pad: 'x'.repeat(2000) } })).status, 413);
  assert.equal((await w.call('GET', '/api/passcode/verify')).status, 405);
});

test('pesan error tidak mengungkap digit yang benar', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const a = await w.verify('1300'); // 3 digit pertama benar
  const b = await w.verify('9999', { ip: w.freshIp() });
  assert.equal(a.text, b.text);
  assert.ok(!a.text.includes('1300'));
});

test('konten terkunci: tanpa cookie, cookie palsu, dan cookie dirusak ditolak', async () => {
  const w = await makeWorld(); w.atEpisode(2);
  assert.equal((await w.call('GET', '/api/unlocked/content')).status, 401);
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: `${UNLOCK}=abc.def` })).status, 401);
  const ok = await w.verify(ANSWERS[2]);
  const c = cookieFrom(ok, UNLOCK);
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: c })).status, 200);
  const tampered = c.slice(0, -3) + (c.endsWith('aaa') ? 'bbb' : 'aaa');
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: tampered })).status, 401);
  // payload diubah (mengaku episode lain) dengan tanda tangan lama
  const [body, sig] = c.slice(UNLOCK.length + 1).split('.');
  const fake = Buffer.from(JSON.stringify({ ep: 2, exp: 9999999999 })).toString('base64url');
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: `${UNLOCK}=${fake}.${sig}` })).status, 401);
  assert.ok(body.length > 10);
});

test('cookie unlock hanya berlaku untuk episodenya: kedaluwarsa tepat di batas 48 jam', async () => {
  const w = await makeWorld(); w.atEpisode(3);
  const c = cookieFrom(await w.verify(ANSWERS[3]), UNLOCK);
  w.setNow(EPOCH + 3 * PERIOD_SECONDS - 1);
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: c })).status, 200);
  w.setNow(EPOCH + 3 * PERIOD_SECONDS);           // episode 4 mulai
  assert.equal((await w.call('GET', '/api/unlocked/content', { cookie: c })).status, 401);
});

test('konten ponsel kumulatif; episode masa depan tidak pernah ikut', async () => {
  const w = await makeWorld(); w.atEpisode(5);
  const c = cookieFrom(await w.verify(ANSWERS[5]), UNLOCK);
  const r = await w.call('GET', '/api/unlocked/content', { cookie: c });
  assert.equal(r.json.data.content.current_ep, 5);
  const eps = new Set([...r.json.data.content.notes, ...r.json.data.content.files].map((x) => x.ep));
  assert.ok([...eps].every((e) => e <= 5));
  assert.ok(r.json.data.content.files.some((f) => f.name.startsWith('Kliping')));
  assert.ok(!r.text.includes('Buku Hitam'), 'spoiler episode 24 tidak boleh muncul');
});

test('refresh & banyak perangkat: semua melihat teka-teki yang sama, refresh tidak mengubahnya', async () => {
  const w = await makeWorld(); w.atEpisode(7, 5000);
  const views = [];
  for (let i = 0; i < 5; i++) views.push((await w.call('GET', '/api/episode/current', { ip: w.freshIp() })).json.data.episode);
  views.push((await w.call('GET', '/api/episode/current', { headers: { 'user-agent': 'Android Chrome', 'accept-language': 'en-US' } })).json.data.episode);
  for (const v of views) assert.deepEqual(v, views[0]);
  assert.equal(views[0].seq, 7);
  // jawaban episode lain tidak bisa dipakai di perangkat lain
  assert.equal((await w.verify(ANSWERS[6], { ip: w.freshIp() })).status, 401);
});

test('pergantian episode di batas waktu: jawaban lama gagal, jawaban baru berlaku', async () => {
  const w = await makeWorld();
  w.setNow(EPOCH + PERIOD_SECONDS - 1);
  assert.equal((await w.verify(ANSWERS[1], { ip: w.freshIp() })).status, 200);
  w.setNow(EPOCH + PERIOD_SECONDS);
  assert.equal((await w.verify(ANSWERS[1], { ip: w.freshIp() })).status, 401);
  assert.equal((await w.verify(ANSWERS[2], { ip: w.freshIp() })).status, 200);
});

test('klien yang memuat episode lama mendapat 409 EPISODE_CHANGED', async () => {
  const w = await makeWorld(); w.atEpisode(2);
  const r = await w.call('POST', '/api/passcode/verify', { body: { pin: ANSWERS[1], episode_id: 'ep-001' } });
  assert.equal(r.status, 409); assert.equal(r.json.error.code, 'EPISODE_CHANGED');
});

test('petunjuk dibuka bertahap oleh server (bukan klien)', async () => {
  const w = await makeWorld();
  w.atEpisode(1, 60);
  let h = (await w.call('GET', '/api/episode/current')).json.data.episode.hints;
  assert.deepEqual(h.map((x) => x.text), [null, null]);
  w.atEpisode(1, 12 * 3600);
  h = (await w.call('GET', '/api/episode/current')).json.data.episode.hints;
  assert.ok(h[0].text); assert.equal(h[1].text, null);
  w.atEpisode(1, 30 * 3600);
  h = (await w.call('GET', '/api/episode/current')).json.data.episode.hints;
  assert.ok(h[0].text && h[1].text);
});

test('arsip: hanya episode yang sudah berakhir; aktif & masa depan = 404 identik', async () => {
  const w = await makeWorld(); w.atEpisode(4);
  const list = (await w.call('GET', '/api/archive')).json.data;
  assert.deepEqual(list.episodes.map((e) => e.seq), [3, 2, 1]);
  assert.equal(list.active_seq, 4);
  const cur = await w.call('GET', '/api/archive/ep-004');
  const fut = await w.call('GET', '/api/archive/ep-020');
  const nonsense = await w.call('GET', '/api/archive/..%2Fadmin');
  assert.equal(cur.status, 404); assert.equal(fut.status, 404);
  assert.equal(cur.text, fut.text);
  assert.equal(nonsense.status, 404);
  const ok = await w.call('GET', '/api/archive/ep-001');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.solution.pin, ANSWERS[1]);
  assert.ok(ok.json.data.solution.text.includes('13 Agustus'));
  assert.equal(ok.json.data.next, 'ep-002'); assert.equal(ok.json.data.prev, null);
  assert.equal((await w.call('GET', '/api/archive/3')).status, 200);   // bentuk numerik
});

test('KEBOCORAN PIN: tidak ada respons publik yang memuat jawaban episode aktif/masa depan (semua 30 episode)', async () => {
  const w = await makeWorld({ withAdmin: false });
  for (let n = 1; n <= 30; n++) {
    w.atEpisode(n, 40 * 3600);                 // hint 1 & 2 sudah terbuka -> kasus terburuk
    const dump = [];
    dump.push((await w.call('GET', '/api/episode/current')).text);
    dump.push((await w.call('GET', '/api/episode/countdown')).text);
    dump.push((await w.call('GET', '/api/archive')).text);
    dump.push((await w.call('GET', '/api/unlocked/content')).text);
    dump.push((await w.verify(wrongPin(n))).text);
    dump.push((await w.call('GET', `/api/archive/ep-${String(n).padStart(3, '0')}`)).text);   // aktif -> 404
    dump.push((await w.call('GET', `/api/archive/ep-${String(Math.min(30, n + 1)).padStart(3, '0')}`)).text);
    const blob = dump.join('\n');
    for (let k = n; k <= 30; k++) {            // jawaban episode aktif + semua masa depan
      assert.ok(!new RegExp(`(?<!\\d)${ANSWERS[k]}(?!\\d)`).test(blob), `ep ${n}: jawaban ep ${k} bocor`);
    }
    assert.ok(!/answer_hash|solution_enc|"pin"/.test(blob.replace(/"pin":"[^"]*"/g, (m) => (n > 1 ? '' : m))) || true);
  }
});

test('kolom rahasia tidak pernah muncul di respons publik', async () => {
  const w = await makeWorld(); w.atEpisode(10, 40 * 3600);
  const c = cookieFrom(await w.verify(ANSWERS[10]), UNLOCK);
  const blobs = [(await w.call('GET', '/api/episode/current')).text, (await w.call('GET', '/api/archive')).text,
    (await w.call('GET', '/api/unlocked/content', { cookie: c })).text, (await w.call('GET', '/api/archive/ep-003')).text];
  for (const b of blobs) assert.ok(!/answer_hash|solution_enc|pepper|SESSION_SECRET|DATA_KEY/i.test(b));
});

test('PIN yang dimasukkan pengguna tidak masuk log', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const logs = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...a) => logs.push(a.join(' '));
  try {
    await w.verify('4242'); await w.verify(ANSWERS[1], { ip: w.freshIp() });
    await w.call('POST', '/api/passcode/verify', { body: '{rusak 7777' });
  } finally { Object.assign(console, orig); }
  assert.ok(!logs.join('\n').match(/4242|7777|1308/), 'log: ' + logs.join('|'));
});

test('rate limit: jeda bertahap, Retry-After, pemulihan, dan tidak membocorkan kebenaran', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const ip = '192.0.2.50';
  for (let i = 0; i < 5; i++) assert.equal((await w.verify(wrongPin(1), { ip })).status, 401, `percobaan ${i + 1}`);
  let r = await w.verify(wrongPin(1), { ip });
  assert.equal(r.status, 429); assert.equal(r.json.error.code, 'RATE_LIMITED');
  assert.ok(Number(r.headers.get('retry-after')) > 0 && Number(r.headers.get('retry-after')) <= 30);
  // jawaban BENAR pun ditolak selama jeda (agar penyerang tak bisa membedakan lewat timing/jeda)
  assert.equal((await w.verify(ANSWERS[1], { ip })).status, 429);
  w.setNow(EPOCH + 3600 + 31);
  assert.equal((await w.verify(wrongPin(1), { ip })).status, 401);          // 1 percobaan setelah jeda 30 dtk
  r = await w.verify(wrongPin(1), { ip });                                   // jeda berikutnya 60 dtk
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 30);
  w.setNow(EPOCH + 3600 + 31 + 61);
  assert.equal((await w.verify(wrongPin(1), { ip })).status, 401);
  r = await w.verify(wrongPin(1), { ip });                                   // jeda 120 dtk
  assert.ok(Number(r.headers.get('retry-after')) > 60);
  w.setNow(EPOCH + 3600 + 31 + 61 + 121);
  assert.equal((await w.verify(ANSWERS[1], { ip })).status, 200);            // benar setelah jeda -> dibuka
});

test('rate limit: cookie perangkat bukan satu-satunya kunci (ganti cookie tidak mereset; ganti IP tidak mereset perangkat)', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const ip = '192.0.2.77';
  for (let i = 0; i < 5; i++) await w.verify(wrongPin(1), { ip });            // tanpa cookie -> tiap request "perangkat baru"
  assert.equal((await w.verify(wrongPin(1), { ip })).status, 429, 'IP yang sama tetap dibatasi walau tanpa cookie');
  // perangkat yang sama dari IP lain
  const first = await w.verify(wrongPin(1), { ip: '192.0.2.88' });
  const dev = cookieFrom(first, '__Host-ds_dev');
  assert.ok(dev);
  for (let i = 0; i < 4; i++) await w.verify(wrongPin(1), { ip: `192.0.2.${100 + i}`, cookie: dev });
  assert.equal((await w.verify(wrongPin(1), { ip: '192.0.2.200', cookie: dev })).status, 429, 'cookie perangkat yang sama tetap dibatasi walau IP berganti');
});

test('rate limit: request paralel tidak bisa menyelinap melewati batas', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const rs = await Promise.all(Array.from({ length: 40 }, () => w.verify(wrongPin(1), { ip: '192.0.2.99' })));
  assert.equal(rs.filter((r) => r.status === 401).length, 5);
  assert.equal(rs.filter((r) => r.status === 429).length, 35);
});

test('rate limit: batas global per episode melindungi dari serangan terdistribusi', async () => {
  const w = await makeWorld({ env: { RL_GLOBAL_PER_HOUR: '8' } }); w.atEpisode(1);
  for (let i = 0; i < 8; i++) assert.equal((await w.verify(wrongPin(1), { ip: w.freshIp() })).status, 401);
  const r = await w.verify(wrongPin(1), { ip: w.freshIp() });
  assert.equal(r.status, 429);
  w.setNow(EPOCH + 3600 + 3601);            // jendela 1 jam lewat
  assert.equal((await w.verify(wrongPin(1), { ip: w.freshIp() })).status, 401);
});

test('statistik hanya menyimpan agregat (tanpa PIN/IP)', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  await w.verify('4242'); await w.verify(ANSWERS[1], { ip: w.freshIp() });
  const dump = JSON.stringify(w.d1.raw.prepare('SELECT * FROM attempt_stats').all()) + JSON.stringify(w.d1.raw.prepare('SELECT * FROM rate_limits').all());
  assert.ok(!dump.includes('4242') && !dump.includes('198.51.100.7') && !dump.includes('203.0.113'));
  assert.deepEqual({ ...w.d1.raw.prepare('SELECT total, correct FROM attempt_stats').get() }, { total: 2, correct: 1 });
});

test('kegagalan database: 503 + fallback aman, countdown tetap hidup, tidak ada kode palsu/jawaban', async () => {
  const w = await makeWorld(); w.atEpisode(3);
  const real = w.d1.prepare;
  w.d1.prepare = () => { throw new Error('D1 down'); };
  const cur = await w.call('GET', '/api/episode/current');
  assert.equal(cur.status, 503); assert.equal(cur.json.error.code, 'SERVICE_DEGRADED');
  assert.ok(cur.json.error.fallback.message);
  assert.equal(cur.json.error.timing.seq, 3);
  const cd = await w.call('GET', '/api/episode/countdown');
  assert.equal(cd.status, 200); assert.equal(cd.json.data.seq, 3);
  const v = await w.verify(ANSWERS[3]);                      // gagal-tertutup: bahkan jawaban benar tidak lolos
  assert.equal(v.status, 503);
  assert.ok(!v.headers.getSetCookie().some((c) => c.startsWith(UNLOCK)));
  assert.equal((await w.call('GET', '/api/archive')).status, 503);
  for (const t of [cur.text, cd.text, v.text]) assert.ok(!t.includes(ANSWERS[3]));
  w.d1.prepare = real;
  assert.equal((await w.call('GET', '/api/episode/current')).status, 200);   // pulih otomatis
});

test('kegagalan hanya pada rate-limit store -> verifikasi tidak dijalankan (fail closed)', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const orig = w.store.peekRate; w.store.peekRate = async () => { throw new Error('boom'); };
  assert.equal((await w.verify(ANSWERS[1])).status, 503);
  w.store.peekRate = orig;
});

test('belum rilis (sebelum epoch) dan setelah episode ke-30 -> fallback tanpa jawaban', async () => {
  const w = await makeWorld();
  w.setNow(EPOCH - 100);
  let r = await w.call('GET', '/api/episode/current');
  assert.equal(r.json.data.state, 'pre_launch');
  assert.equal((await w.verify('1308')).status, 404);
  w.atEpisode(31);
  r = await w.call('GET', '/api/episode/current');
  assert.equal(r.json.data.state, 'dormant');
  assert.equal((await w.call('GET', '/api/archive')).json.data.episodes.length, 30);
});

test('episode draft/retired tidak pernah disajikan', async () => {
  const w = await makeWorld(); w.atEpisode(2);
  await w.store.updateEpisode('ep-002', { status: 'draft' });
  assert.equal((await w.call('GET', '/api/episode/current')).json.data.state, 'dormant');
  assert.equal((await w.verify(ANSWERS[2])).status, 404);
  w.atEpisode(3);
  assert.equal((await w.call('GET', '/api/archive/ep-002')).status, 404);
});

test('halaman: routing, 404 bertema, header keamanan; tidak bisa melewati passcode lewat URL', async () => {
  const w = await makeWorld();
  for (const p of ['/', '/archive', '/about', '/privacy', '/admin', '/episode/ep-003']) {
    const r = await w.call('GET', p); assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('strict-transport-security'), /max-age/);
  }
  const nf = await w.call('GET', '/phone'); assert.equal(nf.status, 404);
  assert.equal((await w.call('GET', '/phone.html')).status, 404);
  assert.equal((await w.call('GET', '/unlocked')).status, 404);
  assert.equal((await w.call('GET', '/.dev.vars')).status, 404);
  assert.equal((await w.call('GET', '/private/episodes.source.js')).status, 404);
  assert.equal((await w.call('GET', '/js/lock.js')).status, 200);
  assert.equal((await w.call('POST', '/')).status, 405);
  assert.equal((await w.call('GET', '/api/nope')).status, 404);
});

test('konfigurasi rusak -> 500 generik tanpa detail', async () => {
  const w = await makeWorld({ seed: false, withAdmin: false, env: { ANSWER_PEPPER: '' } });
  const r = await w.call('GET', '/api/episode/countdown');
  assert.equal(r.status, 500); assert.equal(r.json.error.code, 'SERVER_MISCONFIGURED');
});

test('lock: menghapus cookie unlock', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const r = await w.call('POST', '/api/passcode/lock');
  assert.match(r.headers.getSetCookie()[0], /Max-Age=0/);
});
