// Lapisan akses data (D1). Semua SQL terparameter. Tidak ada PIN/IP mentah yang pernah disimpan.
const EPISODE_COLS = ['id','seq','title','riddle_text','hint1','hint2','answer_hash','solution_enc','summary',
  'unlock_content','start_time','end_time','difficulty','status','created_at','updated_at'];
const UPDATABLE = new Set(EPISODE_COLS.filter((c) => !['id','seq','created_at'].includes(c)));

export function createStore(db) {
  const one = (sql, ...p) => db.prepare(sql).bind(...p).first();
  const all = async (sql, ...p) => (await db.prepare(sql).bind(...p).all()).results || [];
  const run = (sql, ...p) => db.prepare(sql).bind(...p).run();
  const inList = (n) => Array.from({ length: n }, (_, i) => '?' + (i + 1)).join(',');

  return {
    getEpisodeBySeq: (seq) => one('SELECT * FROM episodes WHERE seq = ?1', seq),
    getEpisodeById: (id) => one('SELECT * FROM episodes WHERE id = ?1', id),
    listEpisodes: () => all('SELECT * FROM episodes ORDER BY seq'),
    // untuk konten ponsel (tanpa kolom jawaban)
    listPublishedContentUpTo: (seq) => all(
      "SELECT id, seq, title, summary, unlock_content FROM episodes WHERE status='published' AND seq <= ?1 ORDER BY seq", seq),
    listArchive: (maxSeq) => all(
      "SELECT id, seq, title, summary, difficulty FROM episodes WHERE status='published' AND seq <= ?1 ORDER BY seq DESC", maxSeq),

    async insertEpisode(row) {
      const cols = EPISODE_COLS;
      await run(`INSERT INTO episodes (${cols.join(',')}) VALUES (${inList(cols.length)})`, ...cols.map((c) => row[c]));
    },
    async upsertEpisode(row) {
      const cols = EPISODE_COLS;
      await run(`INSERT OR REPLACE INTO episodes (${cols.join(',')}) VALUES (${inList(cols.length)})`, ...cols.map((c) => row[c]));
    },
    async updateEpisode(id, patch) {
      const keys = Object.keys(patch).filter((k) => UPDATABLE.has(k));
      if (!keys.length) return;
      const sets = keys.map((k, i) => `${k} = ?${i + 2}`).join(', ');
      await run(`UPDATE episodes SET ${sets} WHERE id = ?1`, id, ...keys.map((k) => patch[k]));
    },
    async deleteEpisode(id) { return (await run('DELETE FROM episodes WHERE id = ?1', id)).meta.changes > 0; },
    countEpisodes: async () => (await one('SELECT COUNT(*) AS n FROM episodes')).n,

    // ---- Rate limiting -------------------------------------------------
    async peekRate(keys, now) {
      const rows = await all(`SELECT key, blocked_until FROM rate_limits WHERE key IN (${inList(keys.length)})`, ...keys);
      let retry = 0;
      for (const r of rows) if (r.blocked_until > now) retry = Math.max(retry, r.blocked_until - now);
      return { blocked: retry > 0, retry_after: retry };
    },
    // "Charge-then-verify": setiap percobaan DIHITUNG secara atomik SEBELUM jawaban diperiksa.
    // Request paralel tidak bisa menyelinap: begitu hitungan mencapai `free`, blocked_until langsung
    // diset dan UPDATE berikutnya ditolak oleh klausa WHERE.
    async chargeRate(key, now, { free = 5, base = 30, cap = 3600, windowSec = 21600 } = {}) {
      const stale = now - windowSec;
      const nf = 'CASE WHEN window_start < ?3 THEN 1 ELSE fails + 1 END';
      const row = await one(
        `INSERT INTO rate_limits (key, fails, window_start, blocked_until, updated_at)
         VALUES (?1, 1, ?2, 0, ?2)
         ON CONFLICT(key) DO UPDATE SET
           fails = ${nf},
           blocked_until = CASE WHEN (${nf}) >= ?4
                                THEN ?2 + MIN(?6, ?5 * (1 << MIN(10, (${nf}) - ?4))) ELSE 0 END,
           window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END,
           updated_at = ?2
         WHERE blocked_until <= ?2
         RETURNING fails, blocked_until`,
        key, now, stale, free, base, cap);
      return row ? { allowed: true, fails: row.fails } : { allowed: false };
    },
    async clearRate(keys) { await run(`DELETE FROM rate_limits WHERE key IN (${inList(keys.length)})`, ...keys); },
    async globalCheck(key, now, limit, windowSec) {
      const r = await one('SELECT fails, window_start FROM rate_limits WHERE key = ?1', key);
      if (r && now - r.window_start < windowSec && r.fails >= limit) {
        return { blocked: true, retry_after: r.window_start + windowSec - now };
      }
      return { blocked: false };
    },
    async globalBump(key, now, windowSec) {
      await run(
        `INSERT INTO rate_limits (key, fails, window_start, blocked_until, updated_at) VALUES (?1, 1, ?2, 0, ?2)
         ON CONFLICT(key) DO UPDATE SET
           fails = CASE WHEN window_start < ?3 THEN 1 ELSE fails + 1 END,
           window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END,
           updated_at = ?2`, key, now, now - windowSec);
    },
    async prune(now, olderThanSec = 86400) { await run('DELETE FROM rate_limits WHERE updated_at < ?1', now - olderThanSec); },

    // ---- Statistik (agregat saja) --------------------------------------
    async recordAttempt(seq, day, correct) {
      await run(
        `INSERT INTO attempt_stats (episode_seq, day, total, correct) VALUES (?1, ?2, 1, ?3)
         ON CONFLICT(episode_seq, day) DO UPDATE SET total = total + 1, correct = correct + ?3`,
        seq, day, correct ? 1 : 0);
    },
    async getStats() {
      return {
        per_episode: await all('SELECT episode_seq AS seq, SUM(total) AS total, SUM(correct) AS correct FROM attempt_stats GROUP BY episode_seq ORDER BY episode_seq'),
        per_day: await all('SELECT day, SUM(total) AS total, SUM(correct) AS correct FROM attempt_stats GROUP BY day ORDER BY day DESC LIMIT 14'),
      };
    },

    // ---- Settings & admin ---------------------------------------------
    async getSettings() {
      const out = {};
      for (const r of await all('SELECT key, value FROM settings')) out[r.key] = r.value;
      return out;
    },
    async setSetting(key, value) {
      await run('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2', key, value);
    },
    getAdminByEmail: (email) => one('SELECT * FROM admins WHERE email = ?1', email),
    getAdminById: (id) => one('SELECT id, email, disabled FROM admins WHERE id = ?1', id),
    async createAdmin(email, passwordHash, now) {
      await run('INSERT INTO admins (email, password_hash, created_at) VALUES (?1, ?2, ?3)', email, passwordHash, now);
    },
  };
}
