import test from 'node:test';
import assert from 'node:assert/strict';
import { episodes } from '../private/episodes.source.js';
import { validateUnlockContent, aggregateContent } from '../src/content.js';
import { normalizePin, parseEpisodeRef } from '../src/lib/normalize.js';
import { hashPin, verifyPin, seal, open } from '../src/lib/crypto.js';
import { buildEpisodeRows } from '../scripts/seed-lib.mjs';
import { EPOCH, SECRETS, ANSWERS } from './helpers.js';

test('ada 30 episode berurutan 1..30', () => {
  assert.equal(episodes.length, 30);
  episodes.forEach((e, i) => assert.equal(e.seq, i + 1));
});

test('setiap jawaban: 4 digit, dihitung ulang dari data, dan unik', () => {
  const seen = new Map();
  for (const e of episodes) {
    const a = e.derive.call(e);
    assert.match(a, /^\d{4}$/, `ep ${e.seq}`);
    assert.equal(e.derive.call(e), a, `deterministik ep ${e.seq}`);
    assert.ok(!seen.has(a), `jawaban ${a} kembar: ep ${seen.get(a)} dan ${e.seq}`);
    seen.set(a, e.seq);
  }
});

test('jawaban yang sudah diverifikasi manual (regresi)', () => {
  const expect = '1308 1706 3264 1023 1403 3119 9472 1955 4708 5609 2011 3142 1114 0247 8814 1321 7243 2970 1091 9803 7419 6403 1623 0813 2314 5368 7526 3262 3721 4829'.split(' ');
  assert.deepEqual(episodes.map((e) => e.derive.call(e)), expect);
});

test('teka-teki, petunjuk, ringkasan, dan cliffhanger tidak memuat jawabannya sendiri', () => {
  for (const e of episodes) {
    const a = ANSWERS[e.seq];
    const re = new RegExp(`(?<!\\d)${a}(?!\\d)`);
    for (const [k, t] of Object.entries({ riddle: e.riddle, hint1: e.hint1, hint2: e.hint2, summary: e.summary, cliff: e.content.cliff })) {
      assert.ok(!re.test(t), `ep ${e.seq} ${k} membocorkan ${a}`);
    }
  }
});

test('kelengkapan: pertanyaan jelas, 2 petunjuk berbeda, solusi, tingkat 1–5, konten valid', () => {
  for (const e of episodes) {
    assert.ok(e.riddle.length > 40, `riddle ep ${e.seq}`);
    assert.ok(e.hint1 && e.hint2 && e.hint1 !== e.hint2);
    assert.ok(e.solution.length > 20);
    assert.ok(e.difficulty >= 1 && e.difficulty <= 5);
    assert.ok(e.content.cliff, `cliffhanger ep ${e.seq}`);
    assert.deepEqual(validateUnlockContent(e.content), [], `konten ep ${e.seq}`);
    assert.ok(e.solution.includes(ANSWERS[e.seq]) || e.solution.includes(ANSWERS[e.seq].replace(/^0/, '')) || /\d/.test(e.solution), `solusi ep ${e.seq}`);
  }
  assert.equal(episodes[29].difficulty, 5);
});

test('tingkat kesulitan meningkat secara umum (rata-rata 10 episode terakhir > 10 pertama)', () => {
  const avg = (a) => a.reduce((s, e) => s + e.difficulty, 0) / a.length;
  assert.ok(avg(episodes.slice(20)) > avg(episodes.slice(0, 10)));
});

test('cerita: minimal 8 karakter original muncul di konten', () => {
  const blob = JSON.stringify(episodes.map((e) => e.content));
  for (const n of ['Laras', 'Damar', 'Bima', 'Sekar', 'Nadira', 'Harjo', 'Gilang', 'Ratna']) assert.ok(blob.includes(n), n);
  assert.ok(!/LNGSHOT/i.test(blob + JSON.stringify(episodes.map((e) => e.riddle))), 'tidak menyalin merek asal');
});

test('clue lintas-episode ada di episode yang dirujuk', () => {
  const has = (seq, s) => assert.ok(JSON.stringify(episodes[seq - 1].content).includes(s), `ep ${seq} harus memuat "${s}"`);
  has(1, 'Loker: 17'); has(4, '14 Maret 2019'); has(5, 'Saksi 3'); has(6, '▲ = 2'); has(7, '64 tahun'); has(8, 'empat puluh tujuh');
  has(10, '2011'); has(12, 'Klinik Senja'); has(13, '02:47'); has(14, '14-06-1988'); has(18, '64'); has(19, '07-05-1996'); has(22, '2024-03-14T23:00:00Z'); has(23, '13-08-1993');
});

test('normalisasi PIN', () => {
  assert.equal(normalizePin('1234'), '1234');
  assert.equal(normalizePin(' 0042 '), '0042');
  assert.equal(normalizePin('１２３４'), '1234');           // lebar-penuh
  for (const bad of ['123', '12345', '12a4', '', '١٢٣٤', '12 34', '1.23', null, undefined, 1234, ['1234'], {}]) assert.equal(normalizePin(bad), null, String(bad));
});

test('parseEpisodeRef', () => {
  assert.equal(parseEpisodeRef('ep-007'), 7); assert.equal(parseEpisodeRef('7'), 7); assert.equal(parseEpisodeRef('EP12'), 12);
  for (const bad of ['', '0', 'ep-', 'ep-abc', '../etc', '7;drop', '12345']) assert.equal(parseEpisodeRef(bad), null, bad);
});

test('hash PIN: benar/salah, terikat id episode, dan bukan plaintext', async () => {
  const h = await hashPin(SECRETS.ANSWER_PEPPER, 'ep-001', '1308');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(await verifyPin(SECRETS.ANSWER_PEPPER, 'ep-001', '1308', h));
  assert.ok(!(await verifyPin(SECRETS.ANSWER_PEPPER, 'ep-001', '1309', h)));
  assert.ok(!(await verifyPin(SECRETS.ANSWER_PEPPER, 'ep-002', '1308', h)), 'hash terikat ke episode');
  assert.ok(!(await verifyPin('pepper-lain-pepper-lain-pepper-lain', 'ep-001', '1308', h)), 'tanpa pepper tak bisa diverifikasi');
  assert.ok(!h.includes('1308'));
});

test('baris seed: tidak ada PIN plaintext di kolom mana pun, solusi terenkripsi bisa dibuka', async () => {
  const rows = await buildEpisodeRows({ pepper: SECRETS.ANSWER_PEPPER, dataKey: SECRETS.DATA_KEY, epoch: EPOCH, episodes });
  assert.equal(rows.length, 30);
  for (const r of rows) {
    const pin = ANSWERS[r.seq];
    const re = new RegExp(`(?<!\\d)${pin}(?!\\d)`);
    for (const col of ['answer_hash', 'solution_enc', 'riddle_text', 'hint1', 'hint2', 'summary']) assert.ok(!re.test(r[col]), `ep ${r.seq} kolom ${col}`);
    assert.equal((await open(SECRETS.DATA_KEY, r.solution_enc, r.id)).pin, pin);
    await assert.rejects(open(SECRETS.DATA_KEY, r.solution_enc, 'ep-999'), 'AAD mengikat ke id episode');
  }
});

test('seal/open menolak kunci salah dan data diubah', async () => {
  const s = await seal(SECRETS.DATA_KEY, { a: 1 }, 'x');
  await assert.rejects(open(SECRETS.DATA_KEY, s.slice(0, -2) + 'AA', 'x'));
});

test('aggregateContent: kumulatif, thread tergabung, kasus berurutan', () => {
  const agg = aggregateContent(episodes.slice(0, 5).map((e) => ({ seq: e.seq, content: e.content })), 5);
  assert.equal(agg.current_ep, 5);
  assert.ok(agg.cases[0].entries.length >= 3);
  assert.equal(agg.messages.find((t) => t.thread === 'Bima P.').items.length >= 4, true);
  assert.equal(agg.cliff, episodes[4].content.cliff);
  assert.ok(agg.notes.every((n) => n.ep >= 1 && n.ep <= 5));
});
