# NETRI Exam Web

Pembungkus ujian terkunci (*secure exam wrapper*) berbasis web untuk **Google Forms** yang dapat diinstal ringan sebagai **PWA (*Progressive Web App*)** tanpa file APK. Dirancang agar siswa dapat mengerjakan ujian langsung dari browser maupun ikon aplikasi di HP (Android/iPhone) dan Laptop/Chromebook.

**Live App (GitHub Pages):** https://rizkyaprian25.github.io/NETRI-Exam-Web/

---

## 1. Fitur Utama & 9 Lapis Penguatan Anti-Curang

- **Installable PWA 1-Tap (`sw.js` + `manifest.json`):** Dapat dipasang ke Layar Utama Android, Desktop Chrome/Edge, maupun iPhone (*Tambah ke Layar Utama* Safari) dengan ukuran sangat ringan. Saat dibuka lewat ikon PWA (*Standalone Mode*), address bar & tab browser hilang total **tanpa memicu notifikasi Chrome/Android *"Untuk keluar dari layar penuh, tarik dari bagian bawah/atas"*** karena aplikasi tidak memanggil `Fullscreen API` tambahan.
- **Input Link & Validasi Domain Ketat:** Mendukung Google Forms (`docs.google.com/forms`, `forms.gle`), otomatis mengubah `/edit` menjadi `/viewform?embedded=true`, dan menerima tautan pendek (`s.id`, `gg.gg`, `bit.ly`) sambil menolak situs di luar domain resmi.
- **Pemindai QR Code Kamera Langsung:** Memindai QR Code soal dari pengawas via kamera WebRTC (dilengkapi kontrol senter jika perangkat mendukung, putar kamera, serta unggah gambar QR dari galeri).
- **4 Gerbang Anti-Split-Screen:** Menolak memulai ujian apabila jendela diperkecil (*Split-Screen* / *Floating Window*) dan membunyikan peringatan bila jendela disandingkan dengan aplikasi lain di tengah ujian.
- **Eskalasi Hard Lock Pengawas pada Strike ke-2:**
  - **Strike ke-1:** Sirine darurat 15 detik (`600–1400 Hz`), layar peringatan terkunci 5 detik sebelum siswa bisa kembali, serta badge merah pelanggaran di `ExamBar`.
  - **Strike ke-2:** **Hard Lock Permanen** — siswa tidak bisa kembali ke soal sebelum Pengawas Ruang memasukkan 6-digit kode pembuka kunci.
- **Anti-Refresh Bypass (`localStorage`):** Jumlah Strike, total detik keluar, status Hard Lock, dan riwayat waktu pelanggaran tersimpan persisten sehingga menekan *Refresh (`F5`)* tidak akan menghapus pelanggaran maupun membuka kunci.
- **Deteksi Multi-Tab (`BroadcastChannel`), Auto-Blur Shield, & Anti-Print:** Membuka tab kedua langsung tercatat, jendela soal otomatis diburamkan seketika saat kehilangan fokus di luar kotak soal, clipboard dibersihkan, serta hasil *Print/PDF* disembunyikan (`@media print`).
- **Tiled Diagonal Watermark & Audit Trail `ReceiptCard`:** Seluruh layar soal dilapisi watermark diagonal transparan (`ID Sesi + Jam Detik WIB`), dan Kartu Bukti Selesai menampilkan jam detik berjalan secara *real-time*, status integritas (`BERSIH` vs `Tercatat X Pelanggaran`), serta riwayat jam setiap pelanggaran.

---

## 2. Teknologi yang Digunakan

- **Framework:** Next.js 15 (`output: 'export'` Static PWA) + React 19 + TypeScript (`strict`)
- **Styling & Desain:** Tailwind CSS + CSS Variables SSOT (Mode Terang/Gelap otomatis, kontras WCAG AA, area sentuh minimal `44×44 px`)
- **Keamanan Client:** Web Crypto API (`SHA-256` tersalt waktu konstan), `BroadcastChannel`, Service Worker `sw.js`
- **Pengujian:** Vitest (Unit & Integration) dan Playwright (End-to-End Browser Multi-Viewport)

---

## 3. Panduan Instalasi & Menjalankan Lokal

```bash
# 1. Pasang dependensi
npm install

# 2. Salin template konfigurasi lingkungan
cp .env.example .env

# 3. Jalankan server pengembangan
npm run dev
```

Buka `http://localhost:3000` di browser.

### Menjalankan Pengujian & Build Produksi

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e

# Build statis untuk GitHub Pages (menghasilkan folder out/)
NEXT_PUBLIC_BASE_PATH=/NETRI-Exam-Web npm run build
```

---

## 4. Deploy Otomatis ke GitHub Pages

Workflow `.github/workflows/deploy.yml` otomatis membangun folder `out/` dengan `NEXT_PUBLIC_BASE_PATH=/NETRI-Exam-Web` dan menerbitkannya ke branch `gh-pages` setiap kali ada push ke `staging` atau `main`.

Pada pengaturan repositori GitHub (**Settings -> Pages -> Build and deployment**):
- **Source:** `Deploy from a branch`
- **Branch:** `gh-pages` / `/ (root)`

---

## 5. Variabel Lingkungan (`.env.example`)

| Variabel | Keterangan |
| :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Nama tampilan aplikasi (`Exam NETRI`) |
| `NEXT_PUBLIC_BASE_PATH` | Kosong (`""`) untuk root/localhost, atau `"/NETRI-Exam-Web"` untuk GitHub Pages |
| `NEXT_PUBLIC_PROCTOR_SALTED_HASH` | Hash SHA-256 tersalt kode keluar darurat & pembuka Hard Lock pengawas 6-digit |
