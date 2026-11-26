'use client';

// Tirai Pelindung Keamanan saat keluar dari Mode Layar Penuh atau terdeteksi Split-Screen
// Mereplikasi langsung _buildSecurityCurtain() pada exam_session_screen.dart

import { Lock, ShieldAlert } from 'lucide-react';

interface SecurityCurtainProps {
  isVisible: boolean;
  isSplitScreenViolation: boolean;
  onReenterFullscreen: () => void;
  onEmergencyExit: () => void;
}

export function SecurityCurtain({
  isVisible,
  isSplitScreenViolation,
  onReenterFullscreen,
  onEmergencyExit,
}: SecurityCurtainProps) {
  if (!isVisible) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Kunci Layar Ujian Wajib Aktif"
      className="exam-no-select fixed inset-0 z-40 flex items-center justify-center bg-[#141824] p-5 text-white"
    >
      <div className="w-full max-w-[440px] text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-400 bg-red-500/15 text-red-400">
          <Lock className="h-10 w-10" aria-hidden="true" />
        </div>

        <h2 className="text-[19px] font-bold">
          {isSplitScreenViolation
            ? 'Mode Split-Screen / Jendela Mengambang Terdeteksi!'
            : 'Kunci Layar Ujian (Layar Penuh) Wajib Aktif!'}
        </h2>

        <p className="mt-3 text-sm text-white/75 leading-relaxed">
          {isSplitScreenViolation
            ? 'Harap kembalikan jendela browser ke ukuran penuh 100% dan tutup aplikasi lain di samping layar sebelum melanjutkan mengerjakan soal.'
            : 'Anda baru saja keluar dari mode layar penuh. Tekan tombol di bawah untuk mengunci kembali layar penuh dan melanjutkan ujian.'}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onReenterFullscreen}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#1A4FD6] px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Kunci Layar &amp; Lanjut Ujian
          </button>

          <button
            type="button"
            onClick={onEmergencyExit}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-red-400/50 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Keluar Darurat (Pengawas)
          </button>
        </div>
      </div>
    </div>
  );
}
