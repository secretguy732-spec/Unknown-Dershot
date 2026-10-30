// Jadwal rotasi 48 jam: fungsi murni dari (waktu server UTC, epoch tetap).
// Tanpa state, tanpa cron, tidak bergantung pada kunjungan pertama.
export const PERIOD_SECONDS = 172800; // 48 jam

export function parseEpoch(value) {
  const s = String(value ?? '');
  const ms = Date.parse(s);
  if (!Number.isFinite(ms) || !/(Z|[+-]\d\d:\d\d)$/.test(s)) {
    throw new Error('EPOCH_UTC harus ISO-8601 dengan zona waktu, mis. 2026-11-02T00:00:00Z');
  }
  return Math.floor(ms / 1000);
}

export function windowForSeq(seq, epoch) {
  const start = epoch + (seq - 1) * PERIOD_SECONDS;
  return { seq, start, end: start + PERIOD_SECONDS };
}

export function slotAt(nowSec, epoch) {
  if (nowSec < epoch) return { state: 'pre_launch', seq: 0, start: null, end: epoch, next_start: epoch };
  const idx = Math.floor((nowSec - epoch) / PERIOD_SECONDS);
  const w = windowForSeq(idx + 1, epoch);
  return { state: 'running', seq: w.seq, start: w.start, end: w.end, next_start: w.end };
}

export const toIso = (sec) => new Date(sec * 1000).toISOString().replace('.000Z', 'Z');
export const episodeId = (seq) => 'ep-' + String(seq).padStart(3, '0');
