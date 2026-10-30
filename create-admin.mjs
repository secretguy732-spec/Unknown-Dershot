// Membuat SQL untuk admin pertama. Password TIDAK pernah tertanam di source:
//   ADMIN_EMAIL=kamu@contoh.com node scripts/create-admin.mjs   (password diminta tanpa echo, atau pakai ADMIN_PASSWORD)
// Output: build/create-admin.sql -> jalankan dengan `wrangler d1 execute dershot --remote --file build/create-admin.sql`
import { writeFileSync, mkdirSync } from 'node:fs';
import { hashPassword } from '../src/lib/crypto.js';
import { isEmail } from '../src/lib/normalize.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!isEmail(email)) { console.error('Set ADMIN_EMAIL=alamat@email.valid'); process.exit(1); }

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) { console.error('Butuh terminal interaktif atau ADMIN_PASSWORD.'); process.exit(1); }
  process.stderr.write('Password admin (min 12 karakter, tidak tampil): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let s = '';
    process.stdin.on('data', (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); return resolve(s); }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f') s = s.slice(0, -1); else s += c;
      }
    });
  });
}
const pw = await readPassword();
if (pw.length < 12) { console.error('Password minimal 12 karakter.'); process.exit(1); }
const hash = await hashPassword(pw, 100000);
mkdirSync('build', { recursive: true });
const now = Math.floor(Date.now() / 1000);
writeFileSync('build/create-admin.sql',
  `INSERT INTO admins (email, password_hash, created_at) VALUES ('${email.replace(/'/g, "''")}', '${hash}', ${now});\n`);
console.log('OK -> build/create-admin.sql (hanya berisi hash PBKDF2). Hapus berkas setelah dijalankan.');
