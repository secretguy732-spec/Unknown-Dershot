// Membuat admin di DB LOKAL (.dev/dershot.sqlite) untuk development.
//   ADMIN_EMAIL=a@b.test ADMIN_PASSWORD='minimal-12-karakter' node scripts/dev-admin.mjs
import { createSqliteD1, applyMigrations } from '../src/d1-sqlite-shim.js';
import { hashPassword } from '../src/lib/crypto.js';
import { isEmail } from '../src/lib/normalize.js';
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); const pw = process.env.ADMIN_PASSWORD || '';
if (!isEmail(email) || pw.length < 12) { console.error('Butuh ADMIN_EMAIL valid dan ADMIN_PASSWORD >= 12 karakter.'); process.exit(1); }
const d1 = createSqliteD1('.dev/dershot.sqlite'); applyMigrations(d1);
d1.raw.prepare('INSERT OR REPLACE INTO admins (id, email, password_hash, created_at) VALUES ((SELECT id FROM admins WHERE email = ?1), ?1, ?2, ?3)')
  .run(email, await hashPassword(pw, 100000), Math.floor(Date.now() / 1000));
console.log('Admin lokal siap:', email);
