// Membuat secret acak. Cetak ke layar; salin ke .dev.vars (lokal) atau `wrangler secret put` (produksi).
import { randomBytes } from 'node:crypto';
const b = (n) => randomBytes(n).toString('base64url');
console.log(`ANSWER_PEPPER=${b(32)}\nSESSION_SECRET=${b(32)}\nDATA_KEY=${b(32)}`);
console.error('\n# Simpan di password manager. Mengganti ANSWER_PEPPER/DATA_KEY berarti seed harus dibuat ulang.');
