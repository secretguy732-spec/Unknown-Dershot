import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { slotAt, windowForSeq, parseEpoch, PERIOD_SECONDS } from '../src/lib/schedule.js';
import { makeWorld, EPOCH } from './helpers.js';

test('periode = tepat 48 jam = 172.800 detik', () => assert.equal(PERIOD_SECONDS, 172800));

test('rotasi tepat setiap 48 jam dan pergantian di batas waktu (fake clock)', () => {
  assert.deepEqual([slotAt(EPOCH - 1, EPOCH).state, slotAt(EPOCH, EPOCH).seq], ['pre_launch', 1]);
  for (let n = 1; n <= 40; n++) {
    const start = EPOCH + (n - 1) * PERIOD_SECONDS;
    assert.equal(slotAt(start, EPOCH).seq, n, `awal episode ${n}`);
    assert.equal(slotAt(start + PERIOD_SECONDS - 1, EPOCH).seq, n, `detik terakhir episode ${n}`);
    assert.equal(slotAt(start + PERIOD_SECONDS, EPOCH).seq, n + 1, `detik pertama episode ${n + 1}`);
    assert.equal(slotAt(start, EPOCH).end - slotAt(start, EPOCH).start, PERIOD_SECONDS);
  }
});

test('tidak ada drift: jadwal tidak bergantung pada kunjungan pertama', () => {
  // meski dihitung dari titik acak, hasilnya selalu sama dengan grid epoch
  for (const t of [EPOCH + 5, EPOCH + 86399, EPOCH + 172799, EPOCH + 172800 * 29 + 17]) {
    const s = slotAt(t, EPOCH);
    assert.equal((s.start - EPOCH) % PERIOD_SECONDS, 0);
  }
  assert.deepEqual(windowForSeq(3, EPOCH), { seq: 3, start: EPOCH + 2 * PERIOD_SECONDS, end: EPOCH + 3 * PERIOD_SECONDS });
});

test('parseEpoch menolak nilai tanpa zona waktu', () => {
  assert.throws(() => parseEpoch('2026-11-02T00:00:00'));
  assert.throws(() => parseEpoch('bukan tanggal'));
  assert.equal(parseEpoch('2026-11-02T07:00:00+07:00'), parseEpoch('2026-11-02T00:00:00Z'));
});

test('zona waktu perangkat/proses tidak mempengaruhi slot', () => {
  const code = `import('./src/lib/schedule.js').then(m=>{const e=m.parseEpoch('2026-11-02T00:00:00Z');
    console.log(JSON.stringify([2,3,5].map(d=>m.slotAt(e+d*86400+1234,e).seq)))})`;
  const out = ['Asia/Jakarta', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'].map((TZ) =>
    execFileSync(process.execPath, ['--no-warnings', '-e', code], { env: { ...process.env, TZ }, cwd: new URL('..', import.meta.url).pathname }).toString().trim());
  assert.equal(new Set(out).size, 1);
  assert.equal(out[0], '[2,2,3]');
});

test('API mengabaikan jam/zona waktu klien', async () => {
  const w = await makeWorld();
  w.atEpisode(4);
  const a = await w.call('GET', '/api/episode/countdown');
  const b = await w.call('GET', '/api/episode/countdown', { headers: { date: 'Mon, 01 Jan 2001 00:00:00 GMT', 'cf-timezone': 'Pacific/Auckland', 'x-timezone': 'Asia/Tokyo' } });
  assert.deepEqual(a.json, b.json);
  assert.equal(a.json.data.seq, 4);
});

test('countdown konsisten dengan jam server di berbagai titik', async () => {
  const w = await makeWorld();
  w.setNow(EPOCH + PERIOD_SECONDS - 10);
  assert.equal((await w.call('GET', '/api/episode/countdown')).json.data.seconds_remaining, 10);
  w.setNow(EPOCH + PERIOD_SECONDS);
  const r = (await w.call('GET', '/api/episode/countdown')).json.data;
  assert.equal(r.seq, 2); assert.equal(r.seconds_remaining, PERIOD_SECONDS);
});

test('rotasi tetap berjalan meski sepi pengunjung (tidak ada kunjungan di episode 2–5)', async () => {
  const w = await makeWorld();
  w.atEpisode(1); await w.call('GET', '/api/episode/current');
  w.atEpisode(6);                       // tidak ada satupun request di antara episode 1 dan 6
  const r = (await w.call('GET', '/api/episode/current')).json.data;
  assert.equal(r.episode.seq, 6);
});
