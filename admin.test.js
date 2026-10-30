import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, cookieFrom, ANSWERS, ADMIN, EPOCH } from './helpers.js';
import { episodes } from '../private/episodes.source.js';

const ADM = '__Host-ds_admin';
async function login(w, creds = ADMIN, ip = '198.51.100.9') {
  const r = await w.call('POST', '/api/admin/login', { body: creds, ip });
  return { r, cookie: cookieFrom(r, ADM), csrf: r.json?.data?.csrf };
}
const authed = (w, s) => (method, path, body, extra = {}) =>
  w.call(method, path, { body, cookie: s.cookie, headers: { 'x-ds-csrf': s.csrf, ...extra } });

const newEpisode = (seq = 31) => ({
  seq, title: 'Episode Baru', riddle_text: 'Berapa hasil 20 + 22, lalu 11 × 3? Tulis berurutan.', hint1: 'Dua operasi.', hint2: '42 lalu 33.',
  summary: 'Ringkasan percobaan.', difficulty: 2, status: 'draft', answer: '4233', solution_text: '20+22=42 dan 11×3=33 → 4233.',
  unlock_content: { cliff: 'Sesuatu bergerak.', notes: [{ title: 'Uji', text: 'Catatan uji' }] },
});

test('akses admin tanpa autentikasi / oleh non-admin ditolak di SEMUA endpoint', async () => {
  const w = await makeWorld(); w.atEpisode(1);
  const user = cookieFrom(await w.verify(ANSWERS[1]), '__Host-ds_unlock');   // pemain biasa yang sudah membuka ponsel
  const endpoints = [['GET', '/api/admin/me'], ['GET', '/api/admin/episodes'], ['POST', '/api/admin/episodes'], ['GET', '/api/admin/episodes/1'],
    ['PUT', '/api/admin/episodes/1'], ['DELETE', '/api/admin/episodes/1'], ['POST', '/api/admin/episodes/1/validate'], ['GET', '/api/admin/episodes/1/preview'],
    ['GET', '/api/admin/stats'], ['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings'], ['POST', '/api/admin/schedule/resync'], ['POST', '/api/admin/logout']];
  for (const [m, p] of endpoints) {
    for (const cookie of [undefined, user, `${ADM}=palsu.palsu`]) {
      const r = await w.call(m, p, { cookie, body: m === 'GET' || m === 'DELETE' ? undefined : {} });
      assert.equal(r.status, 401, `${m} ${p}`);
      assert.equal(r.json.error.code, 'UNAUTHORIZED');
    }
  }
  assert.equal((await w.call('GET', '/api/admin/')).status, 401);
});

test('login: password salah / email tak dikenal -> respons identik; benar -> cookie HttpOnly', async () => {
  const w = await makeWorld();
  const a = await login(w, { email: ADMIN.email, password: 'salah-salah-salah' }, '10.0.0.1');
  const b = await login(w, { email: 'tidak@ada.test', password: 'salah-salah-salah' }, '10.0.0.2');
  assert.equal(a.r.status, 401); assert.equal(a.r.text, b.r.text);
  assert.equal((await w.call('POST', '/api/admin/login', { body: { email: 123, password: {} } })).status, 401);
  const ok = await login(w, ADMIN, '10.0.0.3');
  assert.equal(ok.r.status, 200);
  const hdr = ok.r.headers.getSetCookie().find((c) => c.startsWith(ADM));
  assert.match(hdr, /HttpOnly/); assert.match(hdr, /Secure/); assert.match(hdr, /SameSite=Strict/);
  assert.ok(!ok.r.text.includes('pbkdf2'));
});

test('login: dibatasi (rate limit + jeda bertahap)', async () => {
  const w = await makeWorld();
  for (let i = 0; i < 5; i++) assert.equal((await login(w, { email: ADMIN.email, password: 'x' + i }, '10.1.1.1')).r.status, 401);
  assert.equal((await login(w, ADMIN, '10.1.1.1')).r.status, 429);          // password benar pun ditahan
  assert.equal((await login(w, ADMIN, '10.9.9.9')).r.status, 429);          // email yang sama dari IP lain tetap ditahan
});

test('tidak ada admin default: tabel admins kosong -> tak seorang pun bisa login', async () => {
  const w = await makeWorld({ withAdmin: false });
  for (const creds of [ADMIN, { email: 'admin', password: 'admin' }, { email: 'admin@admin.com', password: 'password' }]) {
    assert.equal((await login(w, creds, w.freshIp())).r.status, 401);
  }
});

test('sesi admin: kedaluwarsa 2 jam, admin dinonaktifkan langsung tak berlaku', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  assert.equal((await call('GET', '/api/admin/me')).status, 200);
  w.setNow(EPOCH + 3600 + 2 * 3600 + 1);
  assert.equal((await call('GET', '/api/admin/me')).status, 401);
  w.setNow(EPOCH + 3600);
  const s2 = await login(w, ADMIN, '10.2.2.2');
  w.d1.raw.prepare('UPDATE admins SET disabled = 1').run();
  assert.equal((await authed(w, s2)('GET', '/api/admin/me')).status, 401);
});

test('CSRF: metode mengubah data butuh header token + Origin yang cocok', async () => {
  const w = await makeWorld(); const s = await login(w);
  const noCsrf = await w.call('POST', '/api/admin/episodes', { body: newEpisode(), cookie: s.cookie });
  assert.equal(noCsrf.status, 403);
  const wrong = await w.call('POST', '/api/admin/episodes', { body: newEpisode(), cookie: s.cookie, headers: { 'x-ds-csrf': 'salah' } });
  assert.equal(wrong.status, 403);
  const evil = await w.call('POST', '/api/admin/episodes', { body: newEpisode(), cookie: s.cookie, headers: { 'x-ds-csrf': s.csrf, origin: 'https://evil.test' } });
  assert.equal(evil.status, 403);
  assert.equal((await authed(w, s)('POST', '/api/admin/episodes', newEpisode(), { origin: 'https://dershot.test' })).status, 201);
});

test('CRUD episode + jawaban di-hash di server + tidak pernah dikembalikan', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  const list = await call('GET', '/api/admin/episodes');
  assert.equal(list.json.data.episodes.length, 30);
  assert.ok(list.json.data.episodes.every((e) => e.schedule_ok));

  const c = await call('POST', '/api/admin/episodes', newEpisode());
  assert.equal(c.status, 201); assert.equal(c.json.data.id, 'ep-031');
  assert.ok(!/answer|4233|hash|solution_enc/.test(c.text.replace('answer_hash', '')) , 'tidak ada jawaban di respons');
  const row = w.d1.raw.prepare("SELECT * FROM episodes WHERE id='ep-031'").get();
  assert.match(row.answer_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes('4233'), 'tidak ada plaintext PIN di database');
  assert.equal(row.start_time, EPOCH + 30 * 172800);

  assert.equal((await call('POST', '/api/admin/episodes', newEpisode())).status, 409);              // slot terisi
  for (const bad of [{ ...newEpisode(40), answer: '123' }, { ...newEpisode(40), answer: 1234 }, { ...newEpisode(40), difficulty: 9 },
    { ...newEpisode(40), status: 'live' }, { ...newEpisode(40), title: '' }, { ...newEpisode(0) }, { ...newEpisode(40), unlock_content: { messages: 'x' } }, { ...newEpisode(40), unlock_content: '{bukan json' }]) {
    assert.equal((await call('POST', '/api/admin/episodes', bad)).status, 400, JSON.stringify(bad).slice(0, 80));
  }

  const u = await call('PUT', '/api/admin/episodes/31', { title: 'Judul Baru', status: 'published' });
  assert.equal(u.status, 200); assert.equal(u.json.data.title, 'Judul Baru');
  const u2 = await call('PUT', '/api/admin/episodes/ep-031', { answer: '9999' });          // ganti jawaban saja
  assert.equal(u2.status, 200);
  assert.equal((await call('POST', '/api/admin/episodes/31/validate', { pin: '9999' })).json.data.checks.at(-1).ok, true);
  assert.equal((await call('POST', '/api/admin/episodes/31/validate', { pin: '4233' })).json.data.checks.at(-1).ok, false);

  assert.equal((await call('GET', '/api/admin/episodes/99')).status, 404);
  assert.equal((await call('DELETE', '/api/admin/episodes/31')).status, 200);
  assert.equal((await call('GET', '/api/admin/episodes/31')).status, 404);
});

test('episode yang dibuat admin benar-benar tayang pada slot-nya dan bisa dipecahkan', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  await call('POST', '/api/admin/episodes', { ...newEpisode(31), status: 'published' });
  w.atEpisode(31, 100);
  const cur = await w.call('GET', '/api/episode/current');
  assert.equal(cur.json.data.episode.title, 'Episode Baru');
  assert.equal((await w.verify('4233')).status, 200);
});

test('validate: mendeteksi jawaban bocor di teks, jawaban kembar, dan jadwal salah', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  const good = await call('POST', '/api/admin/episodes/1/validate', {});
  assert.equal(good.json.data.all_ok, true, JSON.stringify(good.json.data.checks.filter((c) => !c.ok)));
  await call('POST', '/api/admin/episodes', { ...newEpisode(32), answer: ANSWERS[1], riddle_text: `Jawabannya ${ANSWERS[1]} kok.` });
  const bad = (await call('POST', '/api/admin/episodes/32/validate', {})).json.data;
  assert.equal(bad.all_ok, false);
  assert.ok(bad.checks.find((c) => c.name.includes('tidak memuat jawaban')).ok === false);
  assert.ok(bad.checks.find((c) => c.name.includes('unik')).ok === false);
  w.d1.raw.prepare("UPDATE episodes SET start_time = start_time + 3600 WHERE id='ep-005'").run();
  assert.equal((await call('POST', '/api/admin/episodes/5/validate', {})).json.data.checks.find((c) => c.name.includes('jadwal')).ok, false);
  assert.equal((await call('POST', '/api/admin/schedule/resync', {})).json.data.resynced, 31);
  assert.equal((await call('POST', '/api/admin/episodes/5/validate', {})).json.data.checks.find((c) => c.name.includes('jadwal')).ok, true);
});

test('semua 30 episode lolos validasi otomatis admin', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  for (let n = 1; n <= 30; n++) {
    const r = (await call('POST', `/api/admin/episodes/${n}/validate`, { pin: ANSWERS[n] })).json.data;
    assert.equal(r.all_ok, true, `ep ${n}: ` + JSON.stringify(r.checks.filter((c) => !c.ok)));
  }
});

test('preview episode draft (tanpa jawaban) sebelum publikasi', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  await call('POST', '/api/admin/episodes', newEpisode(31));
  const p = await call('GET', '/api/admin/episodes/31/preview');
  assert.equal(p.status, 200); assert.equal(p.json.data.status, 'draft');
  assert.equal(p.json.data.phone.current_ep, 31);
  assert.ok(p.json.data.phone.notes.some((n) => n.title === 'Uji'));
  assert.ok(!p.text.includes('4233'));
  // dan pemain biasa tetap tidak bisa melihatnya
  w.atEpisode(31); assert.equal((await w.call('GET', '/api/episode/current')).json.data.state, 'dormant');
});

test('statistik percobaan tanpa PIN; pengaturan fallback bekerja untuk pemain', async () => {
  const w = await makeWorld(); const s = await login(w); const call = authed(w, s);
  w.atEpisode(1); await w.verify('0000'); await w.verify(ANSWERS[1], { ip: w.freshIp() });
  const st = await call('GET', '/api/admin/stats');
  assert.deepEqual(st.json.data.per_episode, [{ seq: 1, total: 2, correct: 1 }]);
  assert.ok(!st.text.includes('0000'));
  assert.equal((await call('PUT', '/api/admin/settings', { fallback_title: '', fallback_message: 'x' })).status, 400);
  assert.equal((await call('PUT', '/api/admin/settings', { fallback_title: 'Sunyi', fallback_message: 'Belum ada pesan baru dari perangkat.' })).status, 200);
  w.atEpisode(35);
  const cur = await w.call('GET', '/api/episode/current');
  assert.equal(cur.json.data.fallback.title, 'Sunyi');
});

test('logout menghapus cookie', async () => {
  const w = await makeWorld(); const s = await login(w);
  const r = await authed(w, s)('POST', '/api/admin/logout', {});
  assert.match(r.headers.getSetCookie()[0], /Max-Age=0/);
});

test('seed lengkap: 30 episode × status published × jadwal sesuai epoch', async () => {
  const w = await makeWorld();
  const rows = w.d1.raw.prepare('SELECT seq, status, start_time, end_time FROM episodes ORDER BY seq').all();
  assert.equal(rows.length, episodes.length);
  rows.forEach((r, i) => { assert.equal(r.status, 'published'); assert.equal(r.start_time, EPOCH + i * 172800); assert.equal(r.end_time - r.start_time, 172800); });
});
