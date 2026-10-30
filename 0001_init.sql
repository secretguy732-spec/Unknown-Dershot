-- Unknown-Dershot — skema awal (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS episodes (
  id             TEXT PRIMARY KEY,
  seq            INTEGER NOT NULL UNIQUE CHECK (seq >= 1),
  title          TEXT NOT NULL,
  riddle_text    TEXT NOT NULL,
  hint1          TEXT NOT NULL,
  hint2          TEXT NOT NULL,
  answer_hash    TEXT NOT NULL,
  solution_enc   TEXT NOT NULL,
  summary        TEXT NOT NULL,
  unlock_content TEXT NOT NULL,
  start_time     INTEGER NOT NULL,
  end_time       INTEGER NOT NULL,
  difficulty     INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodes_status_seq ON episodes(status, seq);

CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  fails         INTEGER NOT NULL DEFAULT 0,
  window_start  INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated ON rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS attempt_stats (
  episode_seq INTEGER NOT NULL,
  day         TEXT NOT NULL,
  total       INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (episode_seq, day)
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
