# NETRI Exam Web

Pembungkus ujian terkunci (*secure exam wrapper*) berbasis web untuk **Google Forms**. Dirancang agar siswa dapat mengerjakan ujian langsung dari browser HP (Android/iOS) maupun Laptop/Chromebook tanpa perlu mengunduh atau memasang file APK terlebih dahulu.

---

## 1. Fitur Utama (Paritas 1:1 dengan Versi Mobile)

- **Input Link & Resolver Tautan Pendek Aman:** Mendukung tautan Google Forms (`docs.google.com/forms`, `forms.gle`) serta pemendek tautan (`s.id`, `gg.gg`, `bit.ly`). Setiap tautan pendek ditelusuri di sisi server agar tautan palsu yang mengarah ke luar Google Forms otomatis ditolak sebelum ujian dimulai.
- **Pemindai QR Code Kamera Langsung:** Memindai QR Code soal dari pengawas via kamera browser WebRTC (dilengkapi tombol lampu senter jika perangkat mendukung, ganti kamera depan/belakang, serta opsi unggah gambar QR dari galeri).
- **4 Gerbang Anti-Split-Screen & Wajib Layar Penuh:** Menolak memulai ujian apabila jendela browser diperkecil (*Split-Screen* / *Floating Window* di bawah 88% lebar layar), mengunci tampilan ke mode **Fullscreen** dengan **Screen Wake Lock** agar layar tidak redup, serta menutup soal dengan **Tirai Keamanan** jika siswa keluar dari layar penuh.
- **Deteksi Pindah Tab, Tombol Kembali, & Sirine 15 Detik:** Menahan tombol *Back* browser dengan dialog peringatan, memantau perpindahan tab atau aplikasi (`visibilitychange` & `blur`), dan membunyikan sirine darurat 600–1400 Hz berdurasi 15 detik melalui Web Audio API tanpa membutuhkan berkas audio tambahan.
- **Ketahanan Hotspot & Antrean Offline:** Pemeriksaan koneksi nyata pra-ujian, *ExamBar* dengan indikator koneksi (`Terhubung`, `Menyambung`, `Offline`), *watchdog* 15 detik saat jaringan melambat, serta antrean catatan pelanggaran di `localStorage` dengan strategi *Exponential Backoff + Jitter*.
- **Keluar Darurat Kode Pengawas (Server-Side):** Verifikasi kode rahasia 6-digit milik pengawas ruang dijalankan di sisi server dengan hash SHA-256 waktu konstan dan kunci otomatis 30 detik setelah 5 kali percobaan salah.
- **Bukti Resmi Selesai (`ReceiptCard`):** Menampilkan kartu bukti digital berisi nama ujian, waktu submit WIB, status integritas, dan ID sesi setelah formulir selesai dikirim.

---

## 2. Teknologi yang Digunakan

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (`strict`)
- **Styling & Desain:** Tailwind CSS + CSS Variables SSOT (mendukung Mode Terang, Mode Gelap otomatis, kontras WCAG AA, dan target sentuh minimal `44×44 px`)
- **Validasi Runtime:** Zod pada seluruh batas API Route Handlers
- **Pengujian:** Vitest (Unit & Integration) dan Playwright (End-to-End Browser Multi-Viewport)

---

## 3. Panduan Instalasi & Menjalankan Lokal

### Prasyarat
- Node.js 20 atau 22+ (`npm` bawaan)

### Langkah Menjalankan

```bash
# 1. Pasang dependensi
npm install

# 2. Salin template konfigurasi lingkungan dan sesuaikan kode pengawas
cp .env.example .env

# 3. Jalankan server pengembangan
npm run dev
```

Buka `http://localhost:3000` di browser.

### Menjalankan Pengujian & Build Produksi

```bash
# Pemeriksaan tipe statis TypeScript & ESLint
npm run typecheck && npm run lint

# Unit & integration test (Vitest)
npm run test

# Pengujian browser end-to-end (Playwright)
npm run test:e2e

# Build produksi penuh
npm run build
```

---

## 4. Variabel Lingkungan (`.env.example`)

| Variabel | Keterangan |
| :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Nama tampilan aplikasi (`Exam NETRI`) |
| `PROCTOR_EMERGENCY_CODE` | 6-digit kode rahasia pengawas ruang untuk keluar darurat (wajib diubah di produksi) |
| `PROCTOR_HASH_SALT` | Salt kriptografis untuk perbandingan kode pengawas di server |
| `UPSTREAM_RESOLVE_TIMEOUT_MS` | Batas waktu tunggu penelusuran shortlink dalam milidetik |

---

## 5. Catatan Teknis Browser Sandbox

Karena aplikasi web berjalan di dalam sandbox browser (Chrome, Safari, Edge), browser secara bawaan tidak mengizinkan website mematikan tombol fisik *Home*/*Volume* perangkat atau memblokir fitur tangkapan layar tingkat sistem operasi. Sebagai kompensasi, **NETRI Exam Web** mengombinasikan penguncian Fullscreen, tirai penutup layar instan, sensor perpindahan tab/fokus, *sandboxed `<iframe>`*, sirine 15 detik, dan watermark ID sesi transparan pada area soal.
