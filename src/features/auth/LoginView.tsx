'use client';

// Layar Beranda NETRI Exam Web (1:1 dengan login_screen.dart)
// Dilengkapi Input Link Formulir, Scan QR Kamera WebRTC, 4 Gerbang Anti-Split-Screen,
// Cek Internet Hotspot via Server Resolver, dan Lembar Konfirmasi Mode Ujian Ketat.

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Link2,
  Lock,
  Play,
  QrCode,
  Shield,
  X,
} from 'lucide-react';
import type {
  ActiveExamSession,
  ResolveFormData,
} from '@/contracts/exam';
import { resolveExamFormClient } from '@/core/network/examClient';
import { withBasePath } from '@/core/url/basePath';
import { validateAndNormalizeExamUrl } from '@/core/url/examUrl';
import {
  checkScreenClear,
  isFullscreenSupported,
  isStandalonePwa,
  requestExamFullscreen,
} from '@/features/lockdown/screenCheck';
import { sharedSirenAudio } from '@/features/lockdown/sirenAudio';
import { PwaInstallBanner } from '@/features/pwa/PwaInstallBanner';
import { QrScannerModal } from '@/features/qr-scanner/QrScannerModal';

const FLOATING_APP_ERROR =
  'Terdeteksi jendela mengambang atau mode Split-Screen aktif di layar! Harap maksimalkan jendela browser menjadi layar penuh sebelum memulai ujian.';

interface LoginViewProps {
  onStartExam: (session: ActiveExamSession) => void;
}

export function LoginView({ onStartExam }: LoginViewProps) {
  const [urlInput, setUrlInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ResolveFormData | null>(null);
  const [isConfirmSheetOpen, setIsConfirmSheetOpen] = useState(false);
  const [isFullscreenRequiredOpen, setIsFullscreenRequiredOpen] = useState(false);

  // Gerbang 1: Pantau kebersihan layar saat halaman aktif & ketika ukuran jendela berubah
  useEffect(() => {
    const syncScreenClear = () => {
      const clear = checkScreenClear();
      if (!clear) {
        setErrorMessage((prev) =>
          prev && prev.includes('Split-Screen') ? prev : FLOATING_APP_ERROR,
        );
      } else {
        setErrorMessage((prev) =>
          prev && prev.includes('Split-Screen') ? null : prev,
        );
      }
    };

    syncScreenClear();
    window.addEventListener('resize', syncScreenClear);
    return () => window.removeEventListener('resize', syncScreenClear);
  }, []);

  const handleUrlChange = (nextVal: string) => {
    setUrlInput(nextVal);
    if (!checkScreenClear()) {
      setErrorMessage(FLOATING_APP_ERROR);
    } else if (errorMessage && errorMessage.includes('Split-Screen')) {
      setErrorMessage(null);
    }
  };

  const handleQrDetected = (scannedUrl: string) => {
    const normalized = validateAndNormalizeExamUrl(scannedUrl) ?? scannedUrl.trim();
    setUrlInput(normalized);
    setIsQrOpen(false);
    setErrorMessage(checkScreenClear() ? null : FLOATING_APP_ERROR);
    setToastMessage('Tautan QR Code berhasil dipindai!');
    window.setTimeout(() => setToastMessage(null), 2500);
  };

  const handleOpenQr = () => {
    if (!checkScreenClear()) {
      setErrorMessage(FLOATING_APP_ERROR);
      return;
    }
    setErrorMessage(null);
    setIsQrOpen(true);
  };

  const handleStartClick = async (event: React.FormEvent) => {
    event.preventDefault();
    const raw = urlInput.trim();
    if (!raw) {
      setErrorMessage('Harap tempel tautan form atau pindai QR Code ujian.');
      return;
    }

    const normalizedLocal = validateAndNormalizeExamUrl(raw);
    if (!normalizedLocal) {
      setErrorMessage(
        'Tautan harus berupa Google Forms (forms.gle) atau tautan pendek (s.id, gg.gg).',
      );
      return;
    }

    // Gerbang 2: Tolak mulai jika terdeteksi Split-Screen atau jendela diperkecil
    if (!checkScreenClear()) {
      setErrorMessage(FLOATING_APP_ERROR);
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);

    try {
      // Validasi tautan dan cek keterjangkauan internet nyata Hotspot secara client-native
      const resolved = await resolveExamFormClient(normalizedLocal);
      if (!resolved.ok) {
        setErrorMessage(resolved.message);
        return;
      }

      setPendingFormData(resolved.data);
      setIsConfirmSheetOpen(true);
    } catch {
      setErrorMessage(
        'Koneksi internet tidak terdeteksi pada Hotspot/Wi-Fi Anda! Pastikan Hotspot memiliki kuota aktif sebelum memulai ujian.',
      );
    } finally {
      setIsChecking(false);
    }
  };

  const launchExamSession = async (data: ResolveFormData) => {
    // Gerbang 3: Verifikasi kebersihan layar tepat saat menekan "Saya Siap & Mulai Mengerjakan"
    if (!checkScreenClear()) {
      setIsConfirmSheetOpen(false);
      setErrorMessage(FLOATING_APP_ERROR);
      return;
    }

    // Buka kunci Web Audio API pada event klik langsung pengguna agar sirine 15 detik pasti berbunyi di HP
    await sharedSirenAudio.unlock();

    // Jika dibuka dari aplikasi PWA terpasang (Standalone), bar Chrome sudah hilang sehingga tidak memicu notif "tarik layar"
    const inPwaMode = isStandalonePwa();
    const shouldUseFullscreen = !inPwaMode && isFullscreenSupported();

    if (shouldUseFullscreen) {
      const enteredFullscreen = await requestExamFullscreen();
      if (!enteredFullscreen) {
        setIsConfirmSheetOpen(false);
        setIsFullscreenRequiredOpen(true);
        setErrorMessage(
          'Ujian tidak dapat dimulai karena mode Layar Penuh belum diaktifkan!',
        );
        return;
      }
    }

    // Gerbang 4: Verifikasi ulang kebersihan layar SETELAH Fullscreen aktif (menutup celah TOCTOU)
    if (!checkScreenClear()) {
      setIsConfirmSheetOpen(false);
      setErrorMessage(FLOATING_APP_ERROR);
      return;
    }

    setIsConfirmSheetOpen(false);
    setIsFullscreenRequiredOpen(false);
    setErrorMessage(null);

    const now = new Date();
    onStartExam({
      sessionId: `ses_${now.getTime()}`,
      rawInputUrl: data.normalizedUrl,
      embedFormUrl: data.embedUrl,
      examTitle: data.examTitle,
      subject: data.examTitle || 'Ujian Google Form',
      className: inPwaMode ? 'Aplikasi PWA (Terkunci)' : 'Web Browser (Umum)',
      startedAt: now.toISOString(),
      requiresFullscreen: shouldUseFullscreen,
      isPwaStandalone: inPwaMode,
    });
  };

  return (
    <div className="min-h-dvh w-full bg-bg flex items-center justify-center px-4 py-6">
      <main className="w-full max-w-[440px]">
        {/* Header Logo Resmi */}
        <div className="flex flex-col items-center">
          <Image
            src={withBasePath('/images/logo.png')}
            alt="Logo NETRI Exam"
            width={200}
            height={96}
            priority
            className="h-24 w-auto rounded-md object-contain"
          />

          {/* Status Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-surface px-3 py-1 text-[11px] font-bold text-brand">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Aplikasi Ujian Aman (Anti-Curang)</span>
          </div>
        </div>

        {/* Kartu Utama Input Tautan & Scan QR */}
        <section className="mt-5 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <form onSubmit={(e) => void handleStartClick(e)} noValidate>
            <label
              htmlFor="exam-url-input"
              className="block text-sm font-bold text-text-primary"
            >
              Tautan Formulir Ujian
            </label>
            <p className="mt-1 text-xs text-text-secondary">
              Pindai QR Code dari pengawas atau tempel tautan form di sini:
            </p>

            <div className="relative mt-2.5 flex items-center">
              <Link2
                className="pointer-events-none absolute left-3 h-4 w-4 text-text-secondary"
                aria-hidden="true"
              />
              <input
                id="exam-url-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={urlInput}
                onFocus={() => {
                  if (!checkScreenClear()) setErrorMessage(FLOATING_APP_ERROR);
                }}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://forms.gle/... atau s.id/... atau docs.google.com..."
                className="min-h-[48px] w-full rounded-sm border border-border bg-bg pl-9 pr-10 text-sm text-text-primary outline-none transition-colors focus:border-brand"
              />
              {urlInput.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleUrlChange('')}
                  aria-label="Hapus tautan"
                  className="absolute right-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-text-secondary hover:text-text-primary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenQr}
              className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm border border-brand px-4 py-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand-surface active:scale-95"
            >
              <QrCode className="h-5 w-5" aria-hidden="true" />
              Scan QR Code Soal
            </button>

            <button
              type="submit"
              disabled={isChecking}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-base font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              {isChecking ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Memeriksa Tautan...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" aria-hidden="true" />
                  <span>Mulai Ujian</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Banner Instalasi PWA Ringan (< 500 KB, Tanpa APK) */}
        <PwaInstallBanner />

        {/* Pesan Error */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-sm border border-red-500/35 bg-red-500/10 p-3 text-[13px] text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Toast Sukses Scan QR */}
        {toastMessage && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-sm bg-success px-3.5 py-2.5 text-xs font-semibold text-white"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
        )}
      </main>

      {/* Bottom Sheet Konfirmasi Mode Ujian Ketat */}
      {isConfirmSheetOpen && pendingFormData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-sheet-title"
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-t-lg sm:rounded-lg border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand">
                <Shield className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 id="confirm-sheet-title" className="text-base font-bold text-text-primary">
                  Mode Ujian Ketat (Anti-Curang)
                </h2>
                <p className="text-xs font-semibold text-brand">
                  Pengawasan Guru • Layar Penuh • Sirine Aktif
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-sm border border-amber-600/35 bg-amber-500/10 p-3 text-xs font-semibold text-warning leading-relaxed">
              Wajib Layar Penuh: Browser akan mengunci tampilan menjadi Layar Penuh (Fullscreen). Keluar dari layar penuh atau berpindah tab akan langsung menutup soal dan membunyikan sirine!
            </div>

            <div className="mt-3 text-xs text-text-secondary leading-relaxed">
              <p className="font-bold text-text-primary">Peraturan Ujian:</p>
              <ul className="mt-1.5 space-y-1">
                <li>• Dilarang berpindah tab, mengecilkan jendela, atau membuka aplikasi lain.</li>
                <li>• Pelanggaran ke-1 membunyikan sirine keras 15 detik dan tercatat di laporan akhir.</li>
                <li>• Pelanggaran ke-2 mengunci ujian secara permanen hingga dibuka oleh pengawas.</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void launchExamSession(pendingFormData)}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                Saya Siap &amp; Mulai Mengerjakan
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmSheetOpen(false)}
                className="min-h-[44px] w-full rounded-md px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Peringatan Wajib Kunci Layar Penuh (jika browser menolak atau dibatalkan siswa) */}
      {isFullscreenRequiredOpen && pendingFormData && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="fs-req-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center gap-2 text-danger">
              <Lock className="h-6 w-6 shrink-0" aria-hidden="true" />
              <h2 id="fs-req-title" className="text-base font-bold">
                Wajib Kunci Layar Penuh!
              </h2>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-text-primary leading-relaxed">
              Ujian tidak dapat dimulai karena mode Layar Penuh belum aktif.
            </p>
            <div className="mt-3 rounded-sm border border-red-500/35 bg-red-500/10 p-3 text-xs text-text-secondary leading-relaxed">
              Tekan tombol &ldquo;Kunci Layar Sekarang&rdquo; dan izinkan browser masuk ke mode Layar Penuh agar sesi ujian dapat dibuka.
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreenRequiredOpen(false)}
                className="min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void launchExamSession(pendingFormData)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Kunci Layar Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      <QrScannerModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        onDetected={handleQrDetected}
      />
    </div>
  );
}
