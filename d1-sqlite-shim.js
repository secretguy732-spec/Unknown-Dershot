// Shim kecil yang meniru API D1 di atas node:sqlite. DIPAKAI HANYA untuk test & dev-server lokal
// (Termux), TIDAK di-bundle ke Worker.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createSqliteD1(path = ':memory:') {
  const db = new DatabaseSync(path);
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare(sql) {
      let params = [];
      const st = {
        bind(...a) { params = a; return st; },
        async first() { return db.prepare(sql).get(...params) ?? null; },
        async all() { return { results: db.prepare(sql).all(...params), success: true }; },
        async run() { const r = db.prepare(sql).run(...params); return { success: true, meta: { changes: Number(r.changes) } }; },
      };
      return st;
    },
  };
}

export function applyMigrations(d1, dir = new URL('../migrations/', import.meta.url)) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    d1.exec(readFileSync(new URL(f, dir), 'utf8'));
  }
}
