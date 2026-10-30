# Unknown-Dershot

> **Every 48 hours, the truth changes.**

Website cerita misteri interaktif: perangkat misterius, PIN 4 digit, teka-teki yang berganti otomatis tiap 48 jam (waktu server UTC), dan simulasi ponsel fiktif berisi pesan, catatan, foto, berkas, browser, rekaman audio, serta arsip kasus. Cerita, karakter, teka-teki, logo, dan kode 100% original.

Stack: **Cloudflare Workers + D1** (satu Worker untuk API & halaman, aset statis via Workers Assets). Frontend HTML/CSS/JS murni (ES modules) — tanpa build step, tanpa dependensi runtime.

---

## 1. Struktur folder

```
unknown-dershot/
├─ src/
│  ├─ worker.js            entry Worker (fetch + scheduled)
│  ├─ app.js               router, API publik, validasi PIN, sesi unlock, arsip
│  ├─ admin.js             API admin (login, CRUD, validate, preview, stats, settings)
│  ├─ config.js            baca env, nama cookie, batas rate-limit
│  ├─ content.js           skema konten ponsel + agregasi kumulatif
│  ├─ store.js             semua SQL (D1), rate-limit atomik
│  ├─ d1-sqlite-shim.js    shim D1→node:sqlite (HANYA test & dev-server)
│  └─ lib/ schedule.js crypto.js normalize.js http.js
├─ public/                 frontend (index, archive, episode, about, privacy, admin, 404, css/, js/)
├─ migrations/0001_init.sql
├─ private/episodes.source.js   30 episode + jawaban + cerita  ⚠ JANGAN di-commit (di-.gitignore)
├─ scripts/                build-seed, create-admin, dev-admin, dev-server, gen-secrets, seed-lib
├─ tests/                  63 tes (node:test, fake clock, sqlite in-memory)
├─ wrangler.toml  .dev.vars.example  .env.example  .github/workflows/deploy.yml
```

## 2. Cara kerja inti

**Rotasi 48 jam.** `episode_aktif = floor((now_UTC − EPOCH_UTC) / 172800) + 1`. Murni hitungan dari jam server dan epoch tetap di konfigurasi: tidak ada state, tidak ada cron, tidak bergantung pada kunjungan pertama — jadi tetap berjalan walau tak ada satu pun pengunjung. Jam/zona waktu HP tidak pernah dipakai (klien hanya menampilkan hitung mundur dari jam server). Episode N tayang di `[EPOCH+(N−1)·48j, EPOCH+N·48j)`. Setelah episode ke-30 (hari ke-60) layar kunci menampilkan pesan fallback sampai kamu menambah episode lewat admin.

**Jawaban tidak pernah ke browser.** Database menyimpan `answer_hash = HMAC-SHA256(ANSWER_PEPPER, "id:PIN")`. Ruang PIN hanya 10.000, jadi hash polos akan langsung bisa di-brute-force bila DB bocor; *pepper* ada di secret Worker, bukan di DB. Penjelasan solusi (yang memuat PIN) disimpan terenkripsi AES-256-GCM (`DATA_KEY`) dan baru dibuka server **setelah episode berakhir** untuk halaman arsip.

**Sesi unlock.** PIN benar → server memberi cookie bertanda tangan (`HttpOnly; Secure; SameSite=Strict`) yang terikat ke episode itu dan kedaluwarsa tepat saat episode berganti. `/api/unlocked/content` memeriksa tanda tangan, kedaluwarsa, dan nomor episode di server. Mengganti URL tidak melewati passcode: halaman ponsel tidak ada sebagai URL; kontennya hanya ada di respons API terkunci.

**Anti brute-force.** Tiap percobaan *dihitung secara atomik sebelum diperiksa* (jadi request paralel tidak bisa menyelinap): 5 percobaan gratis per IP (/64 untuk IPv6) dan per perangkat per episode, lalu jeda 30 dtk → 60 → 120 → … maks 1 jam. Plus batas global per episode (`RL_GLOBAL_PER_HOUR`, default 600 salah/jam). Kunci rate-limit adalah HMAC (tidak ada IP/PIN mentah di DB). Jika penghitung gagal, verifikasi **tidak** dijalankan (fail-closed). Respons salah selalu identik; PIN tidak pernah masuk log.

**Petunjuk bertahap.** `hint1` terbuka 12 jam, `hint2` 30 jam setelah episode mulai — ditentukan server, bukan klien.

## 3. Endpoint

| Endpoint | Akses |
|---|---|
| `GET /api/episode/countdown` | publik; tidak menyentuh DB (hidup walau DB mati) |
| `GET /api/episode/current` | publik; teka-teki aktif + petunjuk yang sudah terbuka |
| `POST /api/passcode/verify` `{pin, episode_id?}` | publik, rate-limited |
| `POST /api/passcode/lock` | hapus cookie unlock |
| `GET /api/unlocked/content` | butuh cookie unlock valid untuk episode aktif |
| `GET /api/archive`, `GET /api/archive/:id` | publik, hanya episode yang **sudah berakhir** (aktif & masa depan = 404 identik) |
| `/api/admin/*` | sesi admin + header CSRF untuk non-GET |

Format error seragam: `{"ok":false,"error":{"code","message",...}}`. Kegagalan DB → `503 SERVICE_DEGRADED` dengan pesan fallback; tidak pernah ada kode palsu atau jawaban.

## 4. Menjalankan lokal (PC maupun Termux)

Butuh **Node ≥ 22.5** (memakai `node:sqlite`). Tidak perlu `npm install` untuk dev-server dan test.

```bash
cp .dev.vars.example .dev.vars
npm run secrets            # salin 3 baris ke .dev.vars (ANSWER_PEPPER, SESSION_SECRET, DATA_KEY)
npm run dev                # http://localhost:8787 — otomatis migrasi + seed 30 episode
npm test                   # 63 tes
```
Jika `.dev.vars` belum ada, `npm run dev` membuatnya sendiri (secret acak, epoch = 1 jam lalu agar episode 1 langsung aktif).

- Lihat episode lain: `DEV_FAKE_NOW=2026-11-14T12:00:00Z npm run dev` (jam server palsu yang tetap berjalan).
- Ingin tahu jawaban saat dev: ada di `private/episodes.source.js` (fungsi `derive`), atau lewat arsip setelah episodenya berakhir.
- Admin lokal: `ADMIN_EMAIL=kamu@contoh.com ADMIN_PASSWORD='minimal-12-karakter' node scripts/dev-admin.mjs`, lalu buka `/admin`.

### Termux (Android)
```bash
pkg update && pkg install nodejs git      # pastikan `node -v` >= 22.5; jika lebih lama: pkg upgrade
git clone <repo-kamu> unknown-dershot && cd unknown-dershot
npm run dev                                # buka http://localhost:8787 di Chrome HP
```
`wrangler dev` memakai *workerd* yang umumnya **tidak tersedia untuk Android/Termux** — karena itu ada `scripts/dev-server.mjs` yang menjalankan kode backend yang sama persis di atas SQLite. Untuk deploy dari HP: `wrangler deploy` murni (tanpa workerd) *mungkin* jalan di Termux, tetapi saya tidak bisa memverifikasinya; cadangan yang pasti: pakai `proot-distro` (Debian/Ubuntu) atau `.github/workflows/deploy.yml` (deploy dari GitHub Actions).

## 5. Deploy ke Cloudflare

```bash
npm install                                   # wrangler
npx wrangler login
npx wrangler d1 create dershot                # salin database_id ke wrangler.toml
npx wrangler d1 migrations apply dershot --remote

# 3 secret produksi (jangan sama dengan dev). Simpan di password manager!
npm run secrets
npx wrangler secret put ANSWER_PEPPER
npx wrangler secret put SESSION_SECRET
npx wrangler secret put DATA_KEY

# Tetapkan EPOCH_UTC di wrangler.toml (UTC, sebaiknya tengah malam, SETELAH tanggal deploy).
# JANGAN ubah lagi setelah publik.

# Seed 30 episode — secret & epoch HARUS sama dengan yang di Worker:
ANSWER_PEPPER=... DATA_KEY=... EPOCH_UTC=2026-11-02T00:00:00Z npm run seed:build
npx wrangler d1 execute dershot --remote --file build/seed.sql
rm build/seed.sql                              # berisi seluruh cerita

npx wrangler deploy
```
HTTPS disediakan Cloudflare (workers.dev atau custom domain); aplikasi menyetel HSTS dan cookie `Secure`/`__Host-`. Set `COOKIE_SECURE=true` (default) di produksi.

### Admin pertama (tanpa password default)
```bash
ADMIN_EMAIL=kamu@contoh.com npm run admin:sql      # password diminta tanpa echo (min 12 karakter)
npx wrangler d1 execute dershot --remote --file build/create-admin.sql
rm build/create-admin.sql
```
Hanya hash PBKDF2 yang ditulis; tidak ada password di source. Login admin juga dibatasi (rate-limit + jeda) dan sesinya 2 jam. **Disarankan** menaruh `/admin` dan `/api/admin/*` di belakang **Cloudflare Access** sebagai lapis kedua.

### Menambah episode
Panel `/admin` → *Episode baru*: pilih slot ke-N (menentukan jadwal 48 jam), isi teka-teki, dua petunjuk, jawaban (di-hash di server dan tidak pernah dikembalikan), penjelasan solusi, dan konten unlock (JSON). Gunakan **Preview** lalu **Validasi** (cek format hash, konten, jadwal, jawaban unik, jawaban tidak bocor di teks, dan tes PIN tanpa menyimpannya), baru ubah status ke `published`. Episode `draft`/`retired` tidak pernah disajikan.

## 6. Batas layanan gratis (diperiksa Oktober 2026 dari dokumentasi Cloudflare — cek ulang sebelum launch)
- **Workers Free:** 100.000 request/hari (reset 00:00 UTC) dan **10 ms CPU per request**; melewati batas = request gagal sampai reset. Aset statis (js/css/svg) gratis & tak terbatas dan tidak masuk hitungan karena dilayani langsung oleh Assets; halaman HTML dan `/api/*` melewati Worker.
- **D1 Free:** 5 juta baris dibaca/hari, 100.000 baris ditulis/hari, 5 GB. Satu percobaan PIN ≈ 4 tulis (2 penghitung rate-limit, statistik, penghitung global) → kira-kira **±20 ribu percobaan/hari** sebelum batas tulis tercapai; di atas itu verifikasi gagal-tertutup (503), bukan terbuka.
- **Catatan CPU:** login admin memakai PBKDF2 100.000 iterasi (batas Workers). Itu bisa melebihi 10 ms di paket Free. Jika login admin kena error CPU: pakai paket Workers Paid ($5/bln), atau andalkan Cloudflare Access dan jangan menurunkan iterasi. Alur pemain (HMAC) ringan.
- Cron `17 3 * * *` hanya housekeeping; rotasi tidak memerlukannya. R2 tidak dipakai (semua aset inline/SVG).

## 7. Keamanan & batasan yang jujur
- PIN 4 digit **secara teoritis tetap bisa ditebak** oleh penyerang terdistribusi (botnet dengan banyak IP). Mitigasi: batas per-IP/perangkat, jeda bertahap, batas global per jam (default 600 → ≈28.800 tebakan/48 jam, masih di atas 10.000 sehingga **bukan jaminan**; turunkan `RL_GLOBAL_PER_HOUR` ke ≤200 untuk menutupnya, dengan risiko pemain sah ikut tertahan saat diserang). Opsi tambahan: Cloudflare Turnstile / WAF rate-limiting rule pada `/api/passcode/verify`.
- Siapa pun yang memecahkan episode bisa membagikan jawaban/isi ponselnya. Itu sifat permainan; episode lama memang publik di arsip.
- Siapa pun dengan akses tulis ke D1 + secret dapat membaca seluruh cerita (konten unlock disimpan sebagai JSON biasa agar bisa diedit admin). Jawaban sendiri tidak ada plaintext di DB.
- Repo publik: **jangan** commit `private/` (jawaban + cerita), `.dev.vars`, `build/`. `.gitignore` sudah menutupnya. Test membutuhkan `private/`; di CI publik, simpan folder itu di repo privat/secret.
- CSP ketat (`script-src 'self'`, tanpa inline), tidak ada `innerHTML`, tanpa source map, tanpa pelacak pihak ketiga. Situs **tidak** mengakses perangkat/izin apa pun milik pengunjung; layar "Emergency" fiktif dan tidak menelepon.

## 8. Status verifikasi

**Sudah diverifikasi (otomatis, `npm test`, 63 lulus):** rotasi tepat 48 jam & batas waktu (fake clock, 40 episode), kebal zona waktu klien/proses, rotasi tanpa pengunjung, PIN benar/salah untuk seluruh 30 episode, normalisasi input, tiap jawaban dihitung ulang dari data dan unik, tidak ada jawaban di teks/hash/respons publik/log untuk 30 episode, sesi cookie (dirusak, kedaluwarsa di batas, episode lain), rate-limit (jeda bertahap, paralel, ganti cookie/IP, global), kegagalan DB (503 + fallback + fail-closed + pulih), arsip hanya untuk episode berakhir, 404 identik, akses admin tanpa/dengan sesi pemain, CSRF/Origin, CRUD admin, preview, validasi, statistik tanpa PIN, serta smoke test HTTP asli lewat dev-server.

**Belum bisa saya verifikasi di lingkungan ini (perlu kamu coba):**
1. `wrangler deploy`/D1 remote/Workers Assets (`run_worker_first` berupa daftar rute, `html_handling="none"`) — tidak ada jaringan di sandbox; sintaks mengikuti dokumentasi wrangler 4 tetapi belum dijalankan. Jika rute halaman tidak terlayani, ubah `run_worker_first = true` (konsekuensi: aset statis ikut menghabiskan kuota).
2. Tampilan UI di browser nyata (tidak ada browser headless di sandbox): JS lolos pemeriksaan sintaks dan audit statis (tanpa innerHTML/inline), dan semua API yang dipakainya sudah teruji, tetapi layout/animasi di HP Android perlu dicek langsung.
3. Konten audio hanyalah transkrip dengan pemutar simulasi (tidak ada suara asli).
4. Bahasa Inggris: antarmuka penuh + ringkasan terpilih (episode 1 dan 30); sisa konten cerita berbahasa Indonesia.
