// ============================================================================
// UNKNOWN-DERSHOT — SUMBER EPISODE (PRIVAT: berisi jawaban & seluruh cerita)
// JANGAN di-commit ke repo publik. Jawaban dihitung oleh derive() dari data yang sama
// dengan yang tertulis di teka-teki/konten, sehingga teks dan jawaban tidak bisa saling bertentangan.
// ============================================================================
const pad = (n, w = 2) => String(n).padStart(w, '0');
const NUM = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
const digitsToWords = (d) => [...d].map((x) => NUM[x].toUpperCase()).join(' ');
const wordsToDigits = (w) => w.toLowerCase().split(/\s+/).map((x) => { const i = NUM.indexOf(x); if (i < 0) throw new Error('kata angka tak dikenal: ' + x); return i; }).join('');
const shift = (s, k) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k + 26) % 26) + 65));
const vig = (s, key, dir = 1) => { let i = 0; return s.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + dir * (key.charCodeAt(i++ % key.length) - 65) + 26) % 26) + 65)); };
const T9 = { A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 5, L: 5, M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7, T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9 };
const t9 = (w) => [...w].map((c) => T9[c]).join('');
const MORSE = ['-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.'];
const unique = (fn) => { const hits = []; for (let n = 0; n < 10000; n++) { const p = pad(n, 4); if (fn([...p].map(Number))) hits.push(p); } if (hits.length !== 1) throw new Error('teka-teki logika tidak unik: ' + hits.join(',')); return hits[0]; };

// ---- fakta dunia cerita (satu sumber kebenaran) ----
const BDAY = { laras: [13, 8, 1993], damar: [7, 5, 1996], bima: [3, 2, 1990], gilang: [14, 6, 1988] }; // [hari, bulan, tahun]
const LOKER = { no: 17, peron: 6 };
const FIRE = { d: 14, m: 3, y: 2019 };
const KASUS = { saksi: 3, hilang: 1, tahun: 2019 };
const SIMBOL = { '▲': 2, '●': 7, '■': 4, '◆': 9 };
const HARJO = { usia: 64 };
const LEMARI = { lemari: 47, laci: 8 };
const YAYASAN = { berdiri: 2011 };
const BERKAS = { halaman: 64, lampiran: 17, saksi: 3 };
const CHECKIN = '2024-03-14T23:00:00Z';
const KLINIK = 'Klinik Senja';
const PSIKIATER = 'Sekar Wulandari';
const JAM_BERHENTI = '02:47';

// ---- pembantu konten ----
const M = (thread, who, text, at = '') => ({ thread, from: who === '>' ? 'Pemilik perangkat' : who, mine: who === '>', text, at });
const N = (title, text) => ({ title, text });
const G = (caption, kind, extra = {}) => ({ caption, kind, ...extra });
const F = (name, text) => ({ name, text });
const B = (url, title, body) => ({ url, title, body });
const A = (title, duration, lines) => ({ title, duration, transcript: lines.map(([t, speaker, text]) => ({ t, speaker, text })) });
const C = (id, title, status, entries) => ({ id, title, status, entries: entries.map(([date, text]) => ({ date, text })) });
const K = (...a) => C('LENTERA', 'Kasus Lentera', ...a);

const dayDiff = (a, b) => Math.round((Date.UTC(2001, b[1] - 1, b[0]) - Date.UTC(2001, a[1] - 1, a[0])) / 86400000);

export const episodes = [
// ───────────────────────────── 1 ─────────────────────────────
{ seq: 1, title: 'Perangkat di Bangku Peron', difficulty: 1,
  riddle: `Sebuah ponsel ditemukan di bangku peron Stasiun Kalibening. Layarnya terkunci. Di punggung casing tertempel stiker lusuh:\n\n"L.A. — aku lahir empat hari sebelum Hari Kemerdekaan. Tulis tanggal dulu, baru bulan."\n\nMasukkan tanggal lalu bulan lahir pemilik stiker (DDMM).`,
  hint1: 'Hari Kemerdekaan Republik Indonesia jatuh pada 17 Agustus.',
  hint2: 'Mundur empat hari dari tanggal itu. Bulannya tetap Agustus, yaitu 08.',
  derive: () => { const d = new Date(Date.UTC(2001, 7, 17 - 4)); return pad(d.getUTCDate()) + pad(d.getUTCMonth() + 1); },
  solution: 'Empat hari sebelum 17 Agustus adalah 13 Agustus. Format tanggal-lalu-bulan (DDMM): 13 dan 08.',
  summary: 'Ponsel tanpa pemilik ditemukan di Stasiun Kalibening. Layarnya menyimpan satu pesan yang belum selesai ditulis dan catatan tentang sebuah loker.',
  content: {
    summary_en: 'An ownerless phone is found on a bench at Kalibening Station. It holds one unsent message and a note about a locker.',
    cliff: 'Draf pesan itu dibuka pukul 03.12 — dan seseorang masih mengetik di ujung sana.',
    messages: [
      M('Draf (belum terkirim)', '>', 'Kalau ini terbaca, aku tidak sempat kembali ke loker itu. Jangan percaya arsip yang sudah dirapikan. Aku tidak sedang paranoid. Aku sedang menghitung.', '03.12'),
      M('Bima P.', 'Bima P.', 'Kamu di mana? Sudah dua hari tidak ada kabar. Angkat teleponnya.', 'Kam 21.40'),
      M('Bima P.', 'Bima P.', 'Aku tidak akan bertanya soal berkas itu lagi. Pulang saja.', 'Kam 23.05'),
    ],
    notes: [N('Loker', `Loker: ${LOKER.no}. Peron: ${pad(LOKER.peron)}. Jangan simpan ini di cloud — Dershot membaca semuanya.`)],
    cases: [K('Terbuka', [['—', 'Berkas dibuka oleh pemilik perangkat. Pelapor: tidak dicantumkan.']])],
  } },
// ───────────────────────────── 2 ─────────────────────────────
{ seq: 2, title: 'Loker 17', difficulty: 1,
  riddle: 'Di aplikasi Notes ada catatan berjudul "Loker" (Episode 1). Susun nomor loker lalu nomor peron, masing-masing dua digit, tanpa spasi.',
  hint1: 'Hanya ada dua angka di catatan itu.',
  hint2: 'Nomor peron ditulis dengan nol di depan: 06.',
  derive: () => pad(LOKER.no) + pad(LOKER.peron),
  solution: 'Catatan "Loker" menyebut loker 17 dan peron 06. Digabung: 1706.',
  summary: 'Loker 17 berisi sebuah kunci berlabel ARSIP-E dan foto seorang pemuda yang wajahnya digores paku.',
  content: {
    cliff: 'Di balik foto itu tertulis satu huruf: D. Dan tulisannya masih baru.',
    notes: [N('Isi loker', 'Kunci kecil berlabel ARSIP-E. Foto seorang pemuda, wajahnya digores paku. Di baliknya: "D. — jangan cari aku di daftar."')],
    gallery: [G('Foto dari loker 17', 'frame', { lines: ['wajah digores', 'di balik foto: "D."'] })],
    messages: [M('Bima P.', 'Bima P.', 'Kamu ambil apa dari loker itu? Jangan lakukan ini sendirian, L.', 'Jum 00.12')],
    cases: [K('Terbuka', [['—', 'Barang bukti pertama: kunci ARSIP-E dan foto berwajah tergores (inisial D.).']])],
  } },
// ───────────────────────────── 3 ─────────────────────────────
{ seq: 3, title: 'Kamar yang Dikunci', difficulty: 1,
  riddle: 'Pintu sebuah kamar ditempeli gembok. Dindingnya penuh angka yang digores pensil:\n\n2 · 4 · 8 · 16 · ? · ?\n\nTeruskan pola itu dua langkah dan tulis kedua angkanya berurutan.',
  hint1: 'Setiap angka berasal dari angka sebelumnya dengan operasi yang sama.',
  hint2: 'Setiap angka adalah dua kali angka sebelumnya.',
  derive: () => { const s = [2, 4, 8, 16]; s.push(s[3] * 2, s[3] * 4); return String(s[4]) + String(s[5]); },
  solution: 'Pola ×2: 16 × 2 = 32, lalu 32 × 2 = 64. Digabung: 3264.',
  summary: 'Kamar milik "D." dikunci dari luar sejak 2019. Dindingnya penuh angka yang digandakan, tanda seseorang yang menghitung agar tidak takut.',
  content: {
    cliff: 'Di bawah tempat tidur ada sebuah kaset tanpa label. Pemutarnya masih hangat.',
    gallery: [G('Kamar D. — dinding penuh angka', 'frame', { lines: ['2  4  8  16 …', 'digores dengan pensil'] })],
    notes: [N('Kebiasaan D.', 'Dia menghitung kalau takut. Selalu menggandakan. Dua, empat, delapan… sampai napasnya teratur.')],
    messages: [M('D. (arsip 2019)', 'D.', 'Kak, kalau lampu padam jangan keluar kamar. Hitung saja. Aku akan hitung bersamamu.', '12 Mar 2019 22.40')],
  } },
// ───────────────────────────── 4 ─────────────────────────────
{ seq: 4, title: 'Sandi Tiga Langkah', difficulty: 2,
  riddle: `Di bagian dalam pintu lemari tertulis huruf kapital:\n\n${shift(digitsToWords('1023'), 3)}\n\nSetiap huruf telah melangkah beberapa kali ke depan dalam alfabet. Setiap kata adalah satu angka dalam bahasa Indonesia. Hasilnya adalah empat digit gembok.`,
  hint1: 'Jumlah langkahnya kurang dari lima.',
  hint2: 'Mundur tiga huruf: "VDWX" menjadi "SATU".',
  derive: () => wordsToDigits(shift(shift(digitsToWords('1023'), 3), -3)),
  solution: 'Sandi Caesar geser 3. Mundur tiga huruf: SATU NOL DUA TIGA = 1, 0, 2, 3.',
  summary: 'Kaset di kamar itu berisi suara anak muda yang berhitung. Dari lemari yang sama, sebuah kliping menyebut malam kebakaran.',
  content: {
    cliff: 'Pada kliping itu satu kalimat dicoret ulang berkali-kali: "korban hilang: satu".',
    files: [F('Kliping_Radar_Sendang.txt', `Kebakaran melanda sayap timur Gedung Arsip Daerah Sendang pada ${FIRE.d} Maret ${FIRE.y} malam. Seorang tercatat hilang. Penyebab masih diselidiki.`)],
    messages: [M('Bima P.', 'Bima P.', 'Yang bikin aku tidak bisa tidur bukan kebakarannya. Tapi daftar korbannya — jumlahnya terus berubah.', 'Jum 02.00')],
    cases: [K('Terbuka', [[`${FIRE.d} Mar ${FIRE.y}`, 'Kebakaran sayap timur Gedung Arsip Daerah Sendang. Satu orang dilaporkan hilang.']])],
  } },
// ───────────────────────────── 5 ─────────────────────────────
{ seq: 5, title: 'Hari Api', difficulty: 1,
  riddle: 'Kronologi kasus dimulai pada hari ketika sayap timur Gedung Arsip Daerah terbakar. Lihat kliping di aplikasi Files (Episode 4). Tulis tanggal lalu bulan kejadian (DDMM).',
  hint1: 'Kliping itu memuat tanggal lengkap kebakaran.',
  hint2: 'Bulan Maret adalah bulan ke-3, tulis dengan nol di depan.',
  derive: () => pad(FIRE.d) + pad(FIRE.m),
  solution: 'Kliping menyebut 14 Maret 2019. DDMM = 14 dan 03.',
  summary: 'Seorang wartawan bernama Nadira menghubungi pemilik ponsel. Ia tahu terlalu banyak tentang barang bukti yang seharusnya sudah hilang.',
  content: {
    cliff: 'Nadira mengaku punya foto yang tidak pernah dimuat. Foto itu diambil dari dalam gedung.',
    messages: [
      M('Nadira K.', 'Nadira K.', 'Aku wartawan Lantera Malam. Bima bilang kamu menyimpan sesuatu dari Arsip. Aku tidak akan menerbitkan apa pun tanpa izinmu.', 'Jum 07.30'),
      M('Diteruskan: Bima ↔ Nadira', 'Bima P.', 'Kode loker barang bukti kasus Lentera: jumlah saksi, jumlah orang hilang, lalu dua digit terakhir tahun kejadian.', 'Kam 18.02'),
      M('Diteruskan: Bima ↔ Nadira', 'Nadira K.', `Saksi ${KASUS.saksi}. Hilang ${KASUS.hilang}. Kejadiannya ${KASUS.tahun}.`, 'Kam 18.05'),
    ],
    notes: [N('Nadira', 'Wartawan Lantera Malam. Terlalu cepat percaya, atau terlalu cepat tahu? Catat lagi nanti.')],
  } },
// ───────────────────────────── 6 ─────────────────────────────
{ seq: 6, title: 'Pesan yang Diteruskan', difficulty: 2,
  riddle: 'Bima dan Nadira membicarakan kode loker barang bukti. Baca pesan terusan mereka di Messages (Episode 5) dan susun empat digitnya sesuai urutan yang Bima sebutkan.',
  hint1: 'Bima menyebut tiga hal: saksi, orang hilang, dan tahun.',
  hint2: 'Tahun hanya dua digit terakhir. Susunannya: saksi, hilang, lalu tahun.',
  derive: () => `${KASUS.saksi}${KASUS.hilang}${String(KASUS.tahun).slice(2)}`,
  solution: 'Saksi 3, hilang 1, tahun 2019 → dua digit terakhir 19. Susunan: 3 · 1 · 19 = 3119.',
  summary: 'Loker barang bukti terbuka. Di dalamnya ada selembar kertas dengan simbol-simbol aneh dan sebuah catatan bertulisan tangan anak muda.',
  content: {
    cliff: 'Simbol di kertas itu sama persis dengan yang tergores di dinding sebuah ruangan yang tidak ada di denah.',
    notes: [N('Alfabet D.', `D. membuat alfabet sendiri. ${Object.entries(SIMBOL).map(([s, n]) => `${s} = ${n}`).join(', ')}. Katanya, simbol tak bisa disadap oleh orang yang hanya bisa membaca.`)],
    gallery: [G('Dinding Ruang Rekam', 'symbols', { lines: ['■ ▲ ◆ ●', '◆ ■ ● ▲', '● ◆ ▲ ■'] })],
    cases: [K('Terbuka', [['—', 'Loker barang bukti dibuka. Isi: kertas bersimbol, catatan tulisan tangan.']])],
  } },
// ───────────────────────────── 7 ─────────────────────────────
{ seq: 7, title: 'Dinding Ruang Rekam', difficulty: 2,
  riddle: 'Di dinding Ruang Rekam tergores urutan simbol seperti pada foto di Gallery. Satu baris dilingkari kapur:\n\n◆ ■ ● ▲\n\nUbah menjadi empat digit memakai alfabet di catatan "Alfabet D." (Episode 6).',
  hint1: 'Setiap simbol punya nilai di catatan "Alfabet D.".',
  hint2: 'Baca dari kiri ke kanan: ◆ lebih dulu.',
  derive: () => [...'◆ ■ ● ▲'.replace(/ /g, '')].map((s) => SIMBOL[s]).join(''),
  solution: '◆ = 9, ■ = 4, ● = 7, ▲ = 2 → 9472.',
  summary: 'Ruang Rekam ternyata tersembunyi di balik rak arsip. Penjaga gedung, Pak Harjo, menolak bicara — tapi ia bertanya, "Apakah anak itu sudah pulang?"',
  content: {
    cliff: 'Pak Harjo menutup pintu, lalu terdengar suara kunci diputar dua kali. Dari dalam.',
    files: [F('Profil — Pak Harjo Santoso', `Penjaga Gedung Arsip Daerah Sendang selama 31 tahun. Lahir 30 Januari. Berusia ${HARJO.usia} tahun saat kebakaran 14 Maret 2019. Tinggal sendirian di rumah dinas yang tak pernah dikosongkan. Orang terakhir yang melihat Ruang 9 terbuka.`)],
    messages: [M('Bima P.', 'Bima P.', 'Harjo menolak bicara. Tapi dia bertanya, "Apakah anak itu sudah pulang?" Anak yang mana, L.?', 'Sab 10.10')],
    cases: [K('Terbuka', [['15 Mar 2019', 'Penjaga arsip, Harjo S., diperiksa sebentar lalu dilepaskan tanpa berita acara.']])],
  } },
// ───────────────────────────── 8 ─────────────────────────────
{ seq: 8, title: 'Usia Seorang Penjaga', difficulty: 2,
  riddle: 'Pak Harjo (profil di Files, Episode 7) berulang tahun setiap 30 Januari. Pada hari kebakaran, 14 Maret 2019, usianya 64 tahun. Tulis tahun kelahirannya.',
  hint1: 'Kebakaran terjadi setelah ulang tahunnya di tahun itu.',
  hint2: 'Karena sudah lewat 30 Januari 2019, usia 64 berarti 2019 dikurangi 64.',
  derive: () => String(FIRE.y - HARJO.usia),
  solution: 'Pada 14 Maret 2019 ulang tahunnya (30 Januari) sudah lewat, jadi usia 64 berarti lahir 2019 − 64 = 1955.',
  summary: 'Sebuah rekaman sesi terapi muncul: seorang psikiater dan seorang pasien yang mendengar ketukan dari dalam dinding.',
  content: {
    cliff: 'Di akhir rekaman, psikiater itu berbisik: "Maaf. Aku tidak punya pilihan."',
    audio: [A('Rekaman 03 — dr. S. dengan pasien ke-7', '06:42', [
      ['00:12', 'dr. S.', 'Sesi dua belas. Ruang tiga. Tolong ceritakan lagi soal lampu itu.'],
      ['00:31', 'Pasien', 'Lampunya mati. Lalu ada yang mengetuk dari dalam dinding. Dua, empat, delapan.'],
      ['01:50', 'dr. S.', `Catatan untuk berkas: salinan rekaman ini disimpan di lemari arsip nomor empat puluh tujuh, laci kedelapan.`],
      ['02:20', 'Pasien', 'Jangan simpan kalau Ibu itu datang.'],
      ['06:30', 'dr. S.', '(pelan, rekaman hampir berhenti) Maaf. Aku tidak punya pilihan.'],
    ])],
    messages: [M('Bima P.', 'Bima P.', 'Aku dengar rekamannya. Siapa pun psikiater itu, dia takut pada seseorang.', 'Min 01.00')],
  } },
// ───────────────────────────── 9 ─────────────────────────────
{ seq: 9, title: 'Lemari 47', difficulty: 2,
  riddle: 'Dalam rekaman dr. S. (Audio Logs, Episode 8) disebut tempat penyimpanan salinannya. Tulis nomor lemari lalu nomor laci, masing-masing dua digit.',
  hint1: 'Dengarkan bagian pencatatan untuk berkas, sekitar menit pertama.',
  hint2: 'Empat puluh tujuh dan kedelapan; laci ditulis 08.',
  derive: () => pad(LEMARI.lemari) + pad(LEMARI.laci),
  solution: 'Rekaman menyebut lemari nomor 47, laci ke-8. Digabung dua digit-dua digit: 4708.',
  summary: 'Lemari 47 menyimpan brosur sebuah klinik dan satu kartu akses. Nama klinik itu pernah muncul di rekaman.',
  content: {
    cliff: 'Kartu akses itu masih aktif. Seseorang mengisi saldonya minggu lalu.',
    files: [F('Brosur_Klinik_Senja.txt', 'Klinik Senja — ketenangan untuk pikiran yang lelah. Program Senja: terapi rekam-ulang memori. Didukung Yayasan Sendang Lestari.')],
    messages: [M('dr. Sekar W.', 'dr. Sekar W.', 'Kamu menemukan rekamannya. Tolong jangan putar yang ke-12. Belum waktunya.', 'Min 04.20')],
  } },
// ───────────────────────────── 10 ─────────────────────────────
{ seq: 10, title: 'Kata dari Belakang', difficulty: 2,
  riddle: `Di bagian belakang kartu akses klinik, seseorang menulis kode dengan membalik setiap kata:\n\n${digitsToWords('5609').split(' ').map((w) => [...w].reverse().join('')).join(' ')}\n\nBaca dari belakang, kata demi kata. Setiap kata adalah satu digit.`,
  hint1: 'Setiap kata ditulis terbalik, huruf demi huruf.',
  hint2: '"AMIL" dibaca dari belakang menjadi sebuah angka yang kurang dari enam.',
  derive: () => wordsToDigits(digitsToWords('5609').split(' ').map((w) => [...w].reverse().join('')).map((w) => [...w].reverse().join('')).join(' ')),
  solution: 'AMIL → LIMA (5), MANE → ENAM (6), LON → NOL (0), NALIBMES → SEMBILAN (9): 5609.',
  summary: 'Kartu itu membuka pintu samping Klinik Senja yang sudah tutup. Di meja resepsionis hanya ada satu brosur donasi dan jejak sepatu basah.',
  content: {
    cliff: 'Jejak sepatu basah itu berhenti di depan sebuah pintu yang seharusnya hanya tembok.',
    browser: [B('yayasansendanglestari.id', 'Yayasan Sendang Lestari — Merawat Ingatan Kota', [
      `Sejak ${YAYASAN.berdiri}, Yayasan Sendang Lestari mendanai pelestarian arsip, kesehatan jiwa, dan pendidikan di Kota Sendang.`,
      'Ketua Yayasan: Ibu Ratna Pramesti.',
      'Mitra: Klinik Senja, Gedung Arsip Daerah Sendang.',
      'Donasi arsip diterima setiap hari kerja.'])],
    messages: [M('Nadira K.', 'Nadira K.', 'Yayasan itu membiayai klinik DAN arsip. Satu terbakar, satu tutup mendadak. Aku tidak suka kebetulan yang serapi itu.', 'Sen 09.12')],
    cases: [K('Terbuka', [[`${YAYASAN.berdiri}`, 'Yayasan Sendang Lestari berdiri; kelak mendanai Klinik Senja dan Arsip Daerah.']])],
  } },
// ───────────────────────────── 11 ─────────────────────────────
{ seq: 11, title: 'Tahun Berdiri', difficulty: 2,
  riddle: 'Yayasan yang namanya tercetak di brosur klinik dan di dokumen pendanaan arsip punya situs di aplikasi Browser (Episode 10). Tulis tahun berdirinya.',
  hint1: 'Buka halaman Yayasan Sendang Lestari di Browser.',
  hint2: 'Kalimat pertamanya diawali dengan kata "Sejak".',
  derive: () => String(YAYASAN.berdiri),
  solution: 'Situs yayasan menyatakan berdiri sejak 2011.',
  summary: 'Penyidik Bima akhirnya mengaku: ia menyimpan salinan berkas yang seharusnya dimusnahkan atas perintah atasannya.',
  content: {
    cliff: 'Bima mengirim foto halaman terakhir berkas itu — namanya sendiri tertulis di sana, dicoret.',
    files: [F('Profil — Insp. Bima Prakoso', `Penyidik kepolisian Kota Sendang. Lahir ${pad(BDAY.bima[0])}-${pad(BDAY.bima[1])}-${BDAY.bima[2]}. Menangani kasus Lentera sejak hari ketiga. Diam-diam menyimpan salinan berkas yang seharusnya dimusnahkan.`)],
    messages: [M('Bima P.', 'Bima P.', 'Atasanku menyuruhku menutup kasus ini. Aku minta satu minggu lagi. Itu lima tahun yang lalu.', 'Sel 22.45')],
    cases: [K('Terbuka', [['16 Mar 2019', 'Penyidik utama ditunjuk: Insp. Bima Prakoso.']])],
  } },
// ───────────────────────────── 12 ─────────────────────────────
{ seq: 12, title: 'Urutan Kejadian', difficulty: 3,
  riddle: 'Empat peristiwa penting tercatat di arsip, tetapi nomornya diacak:\n\n① Kebakaran Arsip Daerah (Maret 2019)\n② Artikel pertama Nadira terbit (Juni 2019)\n③ D. mulai dirawat di Klinik Senja (September 2018)\n④ L.A. mulai mendigitalkan arsip (April 2019)\n\nUrutkan dari yang paling awal ke yang paling akhir, lalu tulis nomor-nomor itu berurutan.',
  hint1: 'Perhatikan tahun lebih dulu, baru bulan.',
  hint2: 'Yang paling awal adalah September 2018, yaitu nomor 3.',
  derive: () => { const ev = [['2019-03'], ['2019-06'], ['2018-09'], ['2019-04']]; return ev.map((e, i) => [e[0], i + 1]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]).join(''); },
  solution: 'Urutan waktu: ③ Sep 2018, ① Mar 2019, ④ Apr 2019, ② Jun 2019 → 3142.',
  summary: 'Formulir penerimaan Klinik Senja membuktikan "D." dirawat di sana sejak 2018 — di bawah pengawasan psikiater yang suaranya ada di rekaman.',
  content: {
    cliff: 'Tanda tangan penjamin di formulir itu buram, tetapi huruf pertamanya jelas: R.',
    files: [
      F('Formulir_Penerimaan_Klinik_Senja.txt', `${KLINIK}. Psikiater penanggung jawab: dr. ${PSIKIATER}. Pasien: D. (rahasia). Tanggal masuk: 21 September 2018. Program: Senja (rekam-ulang memori). Penjamin: Yayasan Sendang Lestari.`),
      F('Profil — dr. Sekar Wulandari', 'Lahir 21 November 1978. Psikiater, pendiri Program Senja. Menutup klinik seminggu setelah kebakaran tanpa penjelasan.'),
    ],
    cases: [K('Terbuka', [['21 Sep 2018', 'D. diterima di Klinik Senja, Program Senja.']])],
  } },
// ───────────────────────────── 13 ─────────────────────────────
{ seq: 13, title: 'Dua Nama, Satu Hitungan', difficulty: 2,
  riddle: `Dua digit pertama: jumlah huruf pada nama klinik tempat D. dirawat, tanpa spasi. Dua digit terakhir: jumlah huruf pada nama lengkap psikiaternya, tanpa gelar dan tanpa spasi. Datanya ada di Files (Episode 12).`,
  hint1: 'Hitung hanya huruf, abaikan spasi dan gelar "dr.".',
  hint2: '"Senja" ditambah satu kata lain untuk nama klinik; nama psikiater terdiri dari dua kata.',
  derive: () => pad(KLINIK.replace(/[^A-Za-z]/g, '').length) + pad(PSIKIATER.replace(/[^A-Za-z]/g, '').length),
  solution: '"KlinikSenja" = 11 huruf. "SekarWulandari" = 5 + 9 = 14 huruf. Digabung: 1114.',
  summary: 'Sebuah foto dari Ruang Rekam muncul di Gallery. Jam dinding di dalamnya berhenti.',
  content: {
    cliff: 'Seseorang masuk foto itu: bayangan di sudut kaca, memegang lentera kecil.',
    gallery: [G('IMG_0314 — jam dinding Ruang Rekam', 'clock', { time: JAM_BERHENTI })],
    notes: [N('Pukul berapa', 'Jam itu berhenti. Bukan karena baterai. Aku memotretnya sebelum polisi datang.')],
    cases: [K('Terbuka', [[`15 Mar ${FIRE.y}, ${JAM_BERHENTI.replace(':', '.')}`, 'Jam dinding Ruang Rekam berhenti pada pukul ini. Listrik padam sepuluh menit sebelumnya.']])],
  } },
// ───────────────────────────── 14 ─────────────────────────────
{ seq: 14, title: 'Jam yang Berhenti', difficulty: 2,
  riddle: 'Jam dinding di foto Gallery (Episode 13) berhenti pada satu waktu. Tulis jam lalu menitnya dalam format 24 jam.',
  hint1: 'Buka foto IMG_0314 di Gallery.',
  hint2: 'Jarum pendek menunjuk angka 2; jam itu bukan siang, jadi tulis 02.',
  derive: () => JAM_BERHENTI.replace(':', ''),
  solution: 'Jam berhenti pada pukul 02:47 dini hari. Format 24 jam tanpa titik dua: 0247.',
  summary: 'Daftar kontak darurat ditemukan. Salah satunya adalah orang yang memperbaiki ponsel ini lima tahun lalu.',
  content: {
    cliff: 'Gilang membalas pesan dari ponsel yang seharusnya sudah ia buang.',
    files: [F('Kontak_Darurat.txt', `1. Bima P. — penyidik\n2. Nadira K. — Lantera Malam\n3. Gilang M. — lahir ${pad(BDAY.gilang[0])}-${pad(BDAY.gilang[1])}-${BDAY.gilang[2]} — "orang yang memperbaiki apa pun yang rusak"\n4. Sekar W.`)],
    messages: [M('Gilang M.', 'Gilang M.', 'Itu ponsel yang kuperbaiki lima tahun lalu. Kenapa masih menyala? Seharusnya baterainya sudah mati sendiri.', 'Rab 08.00')],
  } },
// ───────────────────────────── 15 ─────────────────────────────
{ seq: 15, title: 'Kunci Seorang Teknisi', difficulty: 2,
  riddle: 'Gilang mengunci server pribadinya dengan dua digit terakhir tahun lahirnya, diikuti tanggal lahirnya (tanpa bulan). Datanya ada di Files, "Kontak_Darurat" (Episode 14).',
  hint1: 'Tahun lahir ditulis dua digit terakhir saja.',
  hint2: 'Susunan: dua digit tahun, lalu dua digit hari.',
  derive: () => String(BDAY.gilang[2]).slice(2) + pad(BDAY.gilang[0]),
  solution: 'Gilang lahir 14-06-1988. Dua digit terakhir tahun = 88, tanggal = 14 → 8814.',
  summary: 'Gilang mengaku: seseorang memintanya menulis program yang berjalan sendiri, tepat setiap dua hari. Ia tidak tahu apa isinya.',
  content: {
    cliff: 'Gilang berhenti membalas di tengah kalimat. Status terakhirnya: sedang mengetik.',
    messages: [M('Gilang M.', 'Gilang M.', 'Aku tidak tahu apa yang L. sembunyikan. Dia cuma minta sesuatu yang berjalan sendiri. Tiap dua hari. Namanya Dershot.', 'Kam 20.30')],
    notes: [N('Teori sementara', 'A. Pemilik ponsel adalah orang yang hilang.\nB. Pemilik ponsel sedang bersembunyi.\nC. Pemilik ponsel sudah tiada, dan seseorang meneruskan pesannya.')],
  } },
// ───────────────────────────── 16 ─────────────────────────────
{ seq: 16, title: 'Deret yang Menyala', difficulty: 2,
  riddle: 'Di layar server Gilang berkedip deretan angka:\n\n1 · 1 · 2 · 3 · 5 · 8 · ? · ?\n\nTulis dua angka berikutnya berurutan.',
  hint1: 'Jumlahkan dua angka terakhir untuk mendapat angka berikutnya.',
  hint2: '5 + 8 = ?, lalu jumlahkan lagi dengan angka sebelumnya.',
  derive: () => { const s = [1, 1, 2, 3, 5, 8]; for (let i = 0; i < 2; i++) s.push(s[s.length - 1] + s[s.length - 2]); return String(s[6]) + String(s[7]); },
  solution: 'Deret Fibonacci: 5 + 8 = 13, 8 + 13 = 21 → 1321.',
  summary: 'Gilang menamai tiap proses dengan angka Fibonacci. Proses 13 mengirim pesan; proses 21 menghapus jejaknya.',
  content: {
    cliff: 'Proses ke-34 tidak ada di dokumentasi Gilang — tapi muncul di daftar proses ponsel ini.',
    notes: [N('Jam server', 'Gilang menamai tiap proses dengan angka Fibonacci. Proses 13 mengirim pesan. Proses 21 menghapus jejak.')],
    messages: [M('Gilang M.', 'Gilang M.', 'Proses 13 itu jam. Dua hari sekali, tepat. Aku sengaja membuatnya tidak bisa kubatalkan sendiri.', 'Jum 07.00')],
  } },
// ───────────────────────────── 17 ─────────────────────────────
{ seq: 17, title: 'Empat Digit Berbeda', difficulty: 3,
  riddle: 'Gilang menemukan aturan kode di catatan D. Empat digit (D1 D2 D3 D4):\n• Semua digit berbeda.\n• D1 + D2 = 9, dan D1 lebih besar dari D2.\n• D1 ganjil, D2 genap.\n• D3 adalah dua kali D2.\n• D4 adalah D1 dikurangi D3.',
  hint1: 'Mulai dari pasangan (D1, D2) yang jumlahnya 9, D1 ganjil dan D2 genap.',
  hint2: 'Ada tiga pasangan: (9,0), (7,2), (5,4). Dua di antaranya gagal pada aturan "berbeda" atau "D4 valid".',
  derive: () => unique(([a, b, c, d]) => new Set([a, b, c, d]).size === 4 && a + b === 9 && a > b && a % 2 === 1 && b % 2 === 0 && c === 2 * b && d === a - c),
  solution: '(9,0) gagal: D3 = 0 sama dengan D2. (5,4) gagal: D3 = 8 lalu D4 = −3. Sisanya (7,2): D3 = 4, D4 = 3 → 7243.',
  summary: 'Ibu Ratna Pramesti, ketua yayasan, muncul. Ia menawarkan pendanaan kepada Nadira — terlalu cepat, terlalu manis.',
  content: {
    cliff: 'Foto Ratna di acara amal: di belakangnya, di dinding, ada tiga angka yang digores. 2, 4, 8.',
    files: [F('Profil — Ibu Ratna Pramesti', 'Lahir 25 Desember 1965. Ketua Yayasan Sendang Lestari. Dikenal dermawan. Hadir di setiap pembukaan klinik dan arsip. Tidak pernah hadir saat ada pemeriksaan.')],
    messages: [M('Nadira K.', 'Nadira K.', 'Ratna menawariku pendanaan untuk Lantera Malam. Terlalu cepat. Terlalu manis.', 'Sab 14.20')],
    cases: [K('Terbuka', [['Des 2018', 'Yayasan Sendang Lestari menyumbang renovasi listrik sayap timur Gedung Arsip — tiga bulan sebelum kebakaran.']])],
  } },
// ───────────────────────────── 18 ─────────────────────────────
{ seq: 18, title: 'Sandi Senja', difficulty: 4,
  riddle: `Gilang menyimpan pesan di log server, disandikan dengan kunci satu kata: kata kedua dari nama tempat D. dirawat (tanpa spasi).\n\n${vig(digitsToWords('2970'), 'SENJA')}\n\nSetiap kata yang terbuka adalah satu angka dalam bahasa Indonesia.`,
  hint1: 'Ini sandi Vigenère: kunci kata, bukan satu geseran tetap.',
  hint2: 'Kuncinya SENJA diulang: S E N J A S E N J A… Huruf pertama dibuka dengan mundur 18 langkah (S).',
  derive: () => wordsToDigits(vig(vig(digitsToWords('2970'), 'SENJA'), 'SENJA', -1)),
  solution: 'Kunci SENJA (kata kedua "Klinik Senja"). Setelah didekripsi: DUA SEMBILAN TUJUH NOL = 2970.',
  summary: 'Berkas Lentera yang tersisa berhasil dihitung: separuh halamannya hilang. Seseorang merobeknya, rapi, dengan penggaris.',
  content: {
    cliff: 'Halaman yang hilang itu bernomor 31. Bima yakin ia pernah membacanya.',
    files: [F('Berkas_Lentera_daftar_isi.txt', `Halaman: ${BERKAS.halaman}. Lampiran: ${BERKAS.lampiran}. Saksi kunci: ${BERKAS.saksi} (nama dihitamkan).`)],
    messages: [M('Bima P.', 'Bima P.', 'Aku sudah menghitung halamannya. Seharusnya 120. Tersisa separuh lebih sedikit.', 'Min 23.40')],
    cases: [K('Terbuka', [['Berkas', 'Berkas Lentera yang tersisa: 64 halaman, 17 lampiran, 3 saksi kunci. Halaman 31 hilang.']])],
  } },
// ───────────────────────────── 19 ─────────────────────────────
{ seq: 19, title: 'Hitungan Berkas', difficulty: 3,
  riddle: 'Berkas Lentera (Files, Episode 18) memuat jumlah halaman, lampiran, dan saksi kunci. Kalikan jumlah halaman dengan jumlah lampiran, lalu tambahkan jumlah saksi kunci.',
  hint1: 'Rumus: (halaman × lampiran) + saksi kunci.',
  hint2: 'Halaman 64, lampiran 17: 64 × 17 = 1088. Lalu tambahkan jumlah saksi.',
  derive: () => String(BERKAS.halaman * BERKAS.lampiran + BERKAS.saksi),
  solution: '64 × 17 = 1088, ditambah 3 saksi kunci = 1091.',
  summary: 'Identitas "D." akhirnya terbaca di sebuah kartu pasien: Damar Anindya. Kolom "kakak" mencantumkan inisial pemilik ponsel ini: L.A.',
  content: {
    cliff: 'Kolom "status pasien" di kartu itu bukan "pulang" atau "dirawat". Hanya satu kata: DIPINDAHKAN.',
    files: [F('Kartu_Pasien_D.txt', `Nama: Damar Anindya. Lahir ${pad(BDAY.damar[0])}-${pad(BDAY.damar[1])}-${BDAY.damar[2]}. Pasien Program Senja sejak 21-09-2018. Kakak: L.A. (lahir ${BDAY.laras[2]}). Kontak darurat: tidak ada yang menjawab. Status: DIPINDAHKAN.`)],
    messages: [M('Bima P.', 'Bima P.', 'Kamu tidak pernah menyebut namanya Damar. Kamu hanya bilang "adikku". Itu sudah cukup.', 'Sen 21.05')],
  } },
// ───────────────────────────── 20 ─────────────────────────────
{ seq: 20, title: 'Dua Ulang Tahun', difficulty: 4,
  riddle: 'Dua digit pertama: jumlah hari dari ulang tahun Damar ke ulang tahun L.A. di tahun yang sama (anggap bukan tahun kabisat). Dua digit terakhir: selisih umur L.A. dan Damar dalam tahun. Tanggal lahir L.A. ada di stiker perangkat (Episode 1) dan tahun lahirnya di kartu pasien Damar (Episode 19).',
  hint1: 'Damar lahir 7 Mei, L.A. lahir 13 Agustus. Hitung hari dari 7 Mei sampai 13 Agustus.',
  hint2: 'Sisa Mei: 24 hari, Juni 30, Juli 31, lalu 13 hari di Agustus.',
  derive: () => pad(dayDiff(BDAY.damar, BDAY.laras)) + pad(BDAY.damar[2] - BDAY.laras[2]),
  solution: '7 Mei → 13 Agustus = 24 + 30 + 31 + 13 = 98 hari. Selisih tahun lahir 1996 − 1993 = 3 → "03". Digabung: 9803.',
  summary: 'Gilang membuka sedikit rahasianya: Dershot adalah agen yang merilis arsip jika pemiliknya berhenti melapor. Ia menulisnya untuk satu orang.',
  content: {
    cliff: 'README itu ditutup dengan satu baris kecil: "Jika kamu membaca ini, interval sudah terlewat."',
    browser: [B('github.com/gilangm/dershot', 'dershot-agent — README', [
      'Dershot adalah agen yang mengirim pesan terjadwal.',
      'Mode release_on_miss: jika pemilik tidak melakukan check-in dalam interval, satu bagian arsip dirilis.',
      'Interval bawaan: 48 jam.',
      'Dibuat oleh Gilang Mahendra untuk satu pengguna.'])],
    messages: [M('Gilang M.', 'Gilang M.', 'Itu bukan hantu, Bima. Itu cron.', 'Rab 16.00')],
  } },
// ───────────────────────────── 21 ─────────────────────────────
{ seq: 21, title: 'Titik dan Garis', difficulty: 3,
  riddle: `Gilang pernah menjadi operator radio amatir. Di bagian bawah README ia menaruh empat kelompok titik dan garis:\n\n${'7419'.split('').map((d) => MORSE[d]).join('   ')}\n\nSetiap kelompok adalah satu digit dalam kode Morse.`,
  hint1: 'Kode Morse angka selalu terdiri dari lima tanda.',
  hint2: 'Satu titik lalu empat garis berarti 1; lima garis berarti 0.',
  derive: () => '7419'.split('').map((d) => MORSE[d]).map((m) => MORSE.indexOf(m)).join(''),
  solution: '--... = 7, ....- = 4, .---- = 1, ----. = 9 → 7419.',
  summary: 'Rekaman uji coba Gilang terdengar: ia sendiri menolak ide itu, karena terlalu berbahaya bagi siapa pun yang memegang ponselnya.',
  content: {
    cliff: 'Di detik terakhir rekaman terdengar langkah kaki ketiga orang. Gilang tidak sendirian.',
    audio: [A('Rekaman Gilang — uji coba Dershot', '03:10', [
      ['00:05', 'Gilang', 'Uji coba satu. Kalau dia tidak check-in dua hari, sistem membuka satu berkas.'],
      ['00:40', 'Gilang', 'Aku bilang itu terlalu berbahaya. Dia bilang, "Justru karena itu."'],
      ['02:55', 'Gilang', '(berbisik) Siapa di sana?'],
    ])],
  } },
// ───────────────────────────── 22 ─────────────────────────────
{ seq: 22, title: 'Empat Lampu', difficulty: 3,
  riddle: 'Empat kelompok LED di server Gilang masing-masing menunjukkan empat bit. ● menyala = 1, ○ padam = 0. Baca setiap kelompok sebagai bilangan biner menjadi satu digit desimal:\n\n○●●○   ○●○○   ○○○○   ○○●●',
  hint1: 'Setiap kelompok punya empat lampu: nilai 8, 4, 2, 1 dari kiri ke kanan.',
  hint2: '○●●○ = 0 + 4 + 2 + 0.',
  derive: () => '○●●○ ○●○○ ○○○○ ○○●●'.split(' ').map((g) => parseInt([...g].map((c) => (c === '●' ? 1 : 0)).join(''), 2)).join(''),
  solution: '0110 = 6, 0100 = 4, 0000 = 0, 0011 = 3 → 6403.',
  summary: 'Log server Gilang berhasil dibaca. Ada waktu check-in terakhir dan interval — dan sesuatu yang menunggu setelahnya.',
  content: {
    cliff: 'Baris terakhir log itu bukan angka: "rilis #1 → dijadwalkan. Penerima: semua orang."',
    files: [F('dershot.log', `last_checkin=${CHECKIN}\ninterval=48h\nrelease #1 -> dijadwalkan\npenerima=publik`)],
    messages: [M('Nadira K.', 'Nadira K.', 'Rilis pertama muncul tepat saat pemilik ponsel seharusnya sampai ke stasiun. Aku yakin itu bukan kebetulan.', 'Kam 02.15')],
  } },
// ───────────────────────────── 23 ─────────────────────────────
{ seq: 23, title: 'Rilis Pertama', difficulty: 4,
  riddle: 'Waktu rilis pertama Dershot = waktu check-in terakhir + satu interval. Lihat dershot.log di Files (Episode 22). Tulis tanggal rilis (hari, DD) lalu jam rilis (HH, 24 jam UTC).',
  hint1: 'Check-in terakhir 14 Maret 2024 pukul 23.00 UTC; interval 48 jam.',
  hint2: '48 jam = tepat 2 hari. 14 + 2 = ?; jamnya tidak berubah.',
  derive: () => { const d = new Date(Date.parse(CHECKIN) + 48 * 3600 * 1000); return pad(d.getUTCDate()) + pad(d.getUTCHours()); },
  solution: '14 Maret 2024 23:00 UTC + 48 jam = 16 Maret 2024 23:00 UTC. Hari 16, jam 23 → 1623.',
  summary: 'Identitas pemilik ponsel terbukti: Laras Anindya, arsiparis forensik. Kakak Damar. Orang yang menyalakan Dershot.',
  content: {
    cliff: 'Foto di kartu identitas itu tersenyum. Foto di loker 17 tidak.',
    files: [F('Kartu_Identitas_L.A.txt', `Nama: Laras Anindya. Lahir ${pad(BDAY.laras[0])}-${pad(BDAY.laras[1])}-${BDAY.laras[2]}. Arsiparis forensik, Gedung Arsip Daerah Sendang. Adik: Damar Anindya.`)],
    messages: [M('Bima P.', 'Bima P.', 'Laras. Akhirnya aku bisa menulis namamu lagi.', 'Sab 06.00')],
    cases: [K('Terbuka', [['14 Mar 2024', 'Laras Anindya terakhir check-in Dershot pukul 23.00 UTC, lalu menghilang dari Stasiun Kalibening.']])],
  } },
// ───────────────────────────── 24 ─────────────────────────────
{ seq: 24, title: 'Nama Pemilik', difficulty: 2,
  riddle: 'Kini pemilik perangkat punya nama. Tulis tanggal lahirnya dengan format bulan lebih dulu, lalu tanggal (MMDD). Datanya ada di Files, "Kartu_Identitas_L.A." (Episode 23).',
  hint1: 'Formatnya terbalik dari episode pertama: bulan dulu.',
  hint2: 'Lahir 13 Agustus: bulan 08, tanggal 13.',
  derive: () => pad(BDAY.laras[1]) + pad(BDAY.laras[0]),
  solution: 'Laras lahir 13-08-1993. MMDD = 08 dan 13 → 0813.',
  summary: 'Catatan terakhir Laras ditemukan: ia mengumpulkan semuanya dalam satu buku, "Buku Hitam" — daftar pasien Program Senja yang "dipindahkan".',
  content: {
    cliff: 'Di halaman 31 Buku Hitam tercetak nama Damar. Di sebelahnya, cap merah: DIHAPUS.',
    notes: [N('Catatan terakhir Laras', 'Aku mengumpulkan semuanya di satu tempat: Buku Hitam. Daftar pasien Program Senja yang "dipindahkan". Damar ada di halaman 31. Di sebelah namanya ada cap merah: DIHAPUS.')],
    cases: [K('Terbuka', [['Buku Hitam', 'Daftar pasien Program Senja yang dipindahkan. Halaman 31: Damar Anindya — cap DIHAPUS.']])],
  } },
// ───────────────────────────── 25 ─────────────────────────────
{ seq: 25, title: 'Ruang Interogasi', difficulty: 4,
  riddle: 'Empat orang diminta berdiri berderet di Ruang Interogasi (posisi 1 sampai 4, dari kiri): Bima, Sekar, Nadira, dan Ratna.\n• Bima tidak berdiri di ujung.\n• Sekar berdiri tepat di sebelah kanan Bima.\n• Ratna berdiri di salah satu ujung.\n• Nadira tidak bersebelahan dengan Ratna.\n• Nadira berdiri lebih kiri daripada Ratna.\n\nTulis posisi Bima, Sekar, Nadira, lalu Ratna secara berurutan.',
  hint1: 'Bima hanya bisa di posisi 2 atau 3.',
  hint2: 'Jika Bima di 3, Sekar di 4, lalu Ratna harus di 1 dan Nadira di 2 — yang melanggar aturan.',
  derive: () => { const sol = []; const perm = (a, r = []) => { if (!a.length) { sol.push(r); return; } a.forEach((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)], [...r, x])); }; perm([1, 2, 3, 4]); const ok = sol.filter(([b, s, n, r]) => b !== 1 && b !== 4 && s === b + 1 && (r === 1 || r === 4) && Math.abs(n - r) !== 1 && n < r); if (ok.length !== 1) throw new Error('logika posisi tidak unik'); return ok[0].join(''); },
  solution: 'Bima di 2 → Sekar di 3. Ratna di ujung (1 atau 4). Nadira harus lebih kiri dari Ratna: Ratna 4, Nadira 1. Urutan (Bima, Sekar, Nadira, Ratna) = 2, 3, 1, 4 → 2314.',
  summary: 'Rekaman interogasi Ratna bocor. Ia menyangkal semuanya — tetapi ada satu kalimat yang tidak pernah ia ralat.',
  content: {
    cliff: 'Sekar mengirim pesan terakhir: "Aku akan bicara. Tapi bukan lewat ponsel ini."',
    audio: [A('Rekaman interogasi — Ratna P.', '12:05', [
      ['00:20', 'Penyidik', 'Ibu Ratna, apa hubungan Yayasan dengan Program Senja?'],
      ['00:45', 'Ratna', 'Saya hanya menyumbang. Yang terjadi di dalam klinik bukan urusan saya.'],
      ['09:10', 'Penyidik', 'Siapa yang menyetujui pemindahan pasien?'],
      ['09:30', 'Ratna', 'Anak-anak itu sudah tenang. Itu yang penting.'],
    ])],
    messages: [M('dr. Sekar W.', 'dr. Sekar W.', 'Aku akan bicara. Tapi bukan lewat ponsel ini.', 'Min 03.30')],
    cases: [K('Terbuka', [['2024', 'Ratna Pramesti dimintai keterangan; menolak menjawab pertanyaan tentang Program Senja.']])],
  } },
// ───────────────────────────── 26 ─────────────────────────────
{ seq: 26, title: 'Keypad Lama', difficulty: 3,
  riddle: 'Kasus ini dikenal dengan nama sandi LENTERA. Ambil empat huruf pertamanya dan ketik di keypad ponsel lama (ABC=2, DEF=3, GHI=4, JKL=5, MNO=6, PQRS=7, TUV=8, WXYZ=9). Tulis angka yang dihasilkan.',
  hint1: 'Empat huruf pertama LENTERA adalah L, E, N, T.',
  hint2: 'L ada di tombol JKL, E di DEF, N di MNO, T di TUV.',
  derive: () => t9('LENT'),
  solution: 'L=5, E=3, N=6, T=8 → 5368.',
  summary: 'Kunci ARSIP-E akhirnya dipakai: Ruang 9, ruangan yang tidak ada di denah resmi, pintunya besi tanpa gagang dari luar.',
  content: {
    cliff: 'Pintu itu sudah terbuka sedikit. Seseorang meninggalkan lentera kecil, masih menyala.',
    files: [F('Ruang_9.txt', 'Ruang di sayap timur yang tak ada di denah resmi. Pintu besi, tanpa gagang luar. Hanya ada satu salinan kunci: ARSIP-E.')],
    notes: [N('Kenapa Lentera', 'Lentera: lampu kecil yang dibawa ke ruangan yang listriknya diputus. Damar menyebut ruangan itu begitu.')],
    messages: [M('Pak Harjo', 'Pak Harjo', 'Kunci itu kunci Ruang 9. Jangan buka sendirian. Jangan buka pada malam hari.', 'Sab 05.12')],
  } },
// ───────────────────────────── 27 ─────────────────────────────
{ seq: 27, title: 'Kisi Pintu Besi', difficulty: 3,
  riddle: 'Di balik pintu Ruang 9 ada kisi 4×4 yang terukir pada besi:\n\n7  1  4  9\n2  5  8  3\n6  0  2  1\n4  8  3  6\n\nSentuh angka-angkanya dari sudut kiri atas menuju sudut kanan bawah, tepat di diagonal utama, lalu tulis berurutan.',
  hint1: 'Diagonal utama: baris 1 kolom 1, baris 2 kolom 2, dan seterusnya.',
  hint2: 'Angka pertamanya adalah 7. Angka kedua ada di baris kedua.',
  derive: () => { const g = [[7, 1, 4, 9], [2, 5, 8, 3], [6, 0, 2, 1], [4, 8, 3, 6]]; return g.map((r, i) => r[i]).join(''); },
  solution: 'Diagonal: baris1[1]=7, baris2[2]=5, baris3[3]=2, baris4[4]=6 → 7526.',
  summary: 'Di dalam Ruang 9: sebuah dipan, selimut lapuk, dan suara dari dalam dinding yang memutar rekaman yang sama berulang kali.',
  content: {
    cliff: 'Rekaman itu berhenti ketika kamu berdiri di depannya. Lalu mulai lagi, dari awal.',
    gallery: [G('Pintu besi Ruang 9', 'frame', { lines: ['kisi 4 × 4 terukir', 'bekas kuku di tepi'] })],
    audio: [A('Suara dari dalam dinding', '00:47', [
      ['00:05', '—', '(ketukan: dua, empat, delapan)'],
      ['00:20', 'Suara anak muda', 'Kak? … Jangan matikan lampunya.'],
    ])],
  } },
// ───────────────────────────── 28 ─────────────────────────────
{ seq: 28, title: 'Lima Huruf Berantai', difficulty: 4,
  riddle: `Di bawah kisi tergores lima huruf berantai:\n\n${shift('DAMAR', 5)}\n\nSetiap huruf telah maju lima langkah dalam alfabet. Setelah terbaca, ketik empat huruf pertamanya di keypad ponsel lama (ABC=2, DEF=3, GHI=4, JKL=5, MNO=6, PQRS=7, TUV=8, WXYZ=9).`,
  hint1: 'Mundur lima huruf pada setiap huruf. "I" menjadi "D".',
  hint2: 'Kata hasilnya adalah nama seseorang yang kamu kenal dari episode 19. Ambil empat huruf pertamanya.',
  derive: () => t9(shift(shift('DAMAR', 5), -5).slice(0, 4)),
  solution: 'Mundur 5: IFRFW → DAMAR. Empat huruf pertama DAMA: D=3, A=2, M=6, A=2 → 3262.',
  summary: 'Sepucuk surat Pak Harjo ditemukan di bawah dipan: malam kebakaran, ia membuka Ruang 9 sebelum api mencapainya.',
  content: {
    cliff: 'Surat itu ditandatangani dua kali: sekali oleh Harjo, sekali oleh tulisan tangan yang lebih muda.',
    files: [F('Surat_Pak_Harjo.txt', 'Malam itu aku membuka Ruang 9 sebelum api mencapainya. Anak itu masih bernapas. Aku membawanya keluar lewat pintu belakang, dan sejak itu aku membuat seluruh kota percaya dia sudah tiada.')],
    messages: [M('Bima P.', 'Bima P.', 'Hidup? Damar hidup? Lima tahun, Laras.', 'Rab 00.30')],
    cases: [K('Terbuka', [['14 Mar 2019, 23.40', 'Harjo S. mengeluarkan seorang pasien dari Ruang 9 sebelum api menjalar. Tidak dilaporkan.']])],
  } },
// ───────────────────────────── 29 ─────────────────────────────
{ seq: 29, title: 'Empat Orang', difficulty: 4,
  riddle: 'Empat orang terhubung langsung dengan malam kebakaran dan arsip ini: Laras, Damar, Bima, dan Gilang. Jumlahkan angka tanggal lahir keempatnya (hari saja) menjadi dua digit. Lalu jumlahkan angka bulan lahir keempatnya menjadi dua digit. Tulis keduanya berurutan.',
  hint1: 'Tanggal lahir ada di profil dan kartu: Laras (Ep. 1 & 23), Damar (Ep. 19), Bima (Ep. 11), Gilang (Ep. 14).',
  hint2: 'Hari: 13 + 7 + 3 + 14. Bulan: 8 + 5 + 2 + 6.',
  derive: () => { const p = Object.values(BDAY); return pad(p.reduce((s, x) => s + x[0], 0)) + pad(p.reduce((s, x) => s + x[1], 0)); },
  solution: 'Hari: 13 + 7 + 3 + 14 = 37. Bulan: 8 + 5 + 2 + 6 = 21. Digabung: 3721.',
  summary: 'Nadira dan Gilang akhirnya satu suara: Dershot akan merilis seluruh Buku Hitam. Hanya satu hal yang bisa menghentikannya — check-in palsu.',
  content: {
    cliff: 'Pada pukul 22.58 UTC, ponsel ini bergetar sendiri. Seseorang sedang mencoba masuk.',
    messages: [
      M('Nadira K.', 'Nadira K.', 'Aku punya semua berkas. Dershot akan merilis Buku Hitam kalau Laras tidak check-in.', 'Kam 15.00'),
      M('Gilang M.', 'Gilang M.', 'Ada yang mencoba mematikan agennya dari dalam jaringan yayasan.', 'Kam 15.12'),
    ],
    notes: [N('Rencana', 'Jika Laras tidak kembali dalam 48 jam berikutnya, seluruh Buku Hitam dirilis ke Nadira. Ratna akan tahu itu. Dia punya satu cara menghentikannya: check-in palsu.')],
    cases: [K('Terbuka', [['2024', 'Dershot bersiap merilis seluruh Buku Hitam pada interval berikutnya.']])],
  } },
// ───────────────────────────── 30 ─────────────────────────────
{ seq: 30, title: 'Dershot Menghitung', difficulty: 5,
  riddle: 'Dershot menghitung. Interval check-in: 48 jam. Pesan yang sudah terkirim sebelum yang ini: dua puluh sembilan (setiap episode di arsip adalah satu pesan). Tulis interval lalu jumlah pesan sebelumnya, masing-masing dua digit.',
  hint1: 'Interval adalah angka yang sama dengan nama proyek ini: setiap berapa jam kebenaran berubah?',
  hint2: 'Interval 48, jumlah pesan sebelumnya 29.',
  derive: function () { return pad(48) + pad(this.seq - 1); },
  solution: 'Interval = 48 jam, pesan sebelumnya = 29 (episode 1 sampai 29). Digabung dua digit-dua digit: 4829.',
  summary: 'Check-in masuk dari perangkat yang tidak dikenal. Lalu satu pesan: "Kak. Aku sudah pulang." Siapa yang sebenarnya memegang ponsel ini?',
  content: {
    summary_en: 'A check-in arrives from an unknown device. Then one message: "Sis. I\'m home." Who is really holding this phone?',
    cliff: 'Dershot berhenti menghitung. Ponsel ini sekarang menunggu jawabanmu — bukan sebaliknya.',
    messages: [
      M('Dershot', 'Dershot', 'CHECK-IN DITERIMA — 23.00 UTC. Pemilik: (tidak dikenal).', 'Kam 23.00'),
      M('Nomor tak dikenal', '???', 'Kak. Aku sudah pulang. Jangan matikan lampunya.', '—'),
    ],
    notes: [N('Terakhir', 'Bukan Ratna. Bukan Bima. Bukan Gilang. Yang melakukan check-in tahu kata sandi yang hanya kami berdua tahu: dua, empat, delapan.')],
    cases: [K('Terbuka — lanjutan', [['Kini', 'Check-in diterima dari perangkat tak dikenal. Dershot kembali hidup. Apa yang kamu putuskan dengan Buku Hitam?']])],
  } },
];
