// Normalisasi & validasi input. Menolak, bukan memperbaiki diam-diam, apa pun yang ambigu.
export function normalizePin(input) {
  if (typeof input !== 'string') return null;   // angka JSON (1234) ditolak: nol di depan hilang
  const s = input.normalize('NFKC').trim();    // angka lebar-penuh -> ASCII
  return /^[0-9]{4}$/.test(s) ? s : null;
}

// 'ep-007' | 'ep007' | '7' -> 7
export function parseEpisodeRef(ref) {
  const m = /^(?:ep-?)?(\d{1,4})$/i.exec(String(ref ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
