'use client';

// Dialog Peringatan & Sirine Kecurangan Layar Penuh (1:1 dengan lock_screen_dialog.dart)

import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, ShieldAlert, Volume2 } from 'lucide-react';

interface LockScreenDialogProps {
  isOpen: boolean;
  strikeCount: number;
  reason: string;
  onAcknowledge: () => void;
  onEmergencyExit: () => void;
}

export function LockScreenDialog({
  isOpen,
  strikeCount,
  reason,
  onAcknowledge,
  onEmergencyExit,
}: LockScreenDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(15);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(15);

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lock-dialog-title"
      className="exam-no-select fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg p-5"
    >
      <div className="w-full max-w-[420px] text-center">
        {/* Ikon Sirine Berkedip Merah */}
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 text-danger">
          <BellRing className="h-14 w-14 animate-pulse" aria-hidden="true" />
        </div>

        <h2 id="lock-dialog-title" className="text-[22px] font-bold text-danger">
          🚨 PERINGATAN KECURANGAN!
        </h2>

        <div className="mt-3 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-4 py-2 text-xs font-bold text-danger tabular-nums">
            <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {secondsLeft > 0
                ? `Sirine Peringatan Berbunyi (${secondsLeft} detik)`
                : 'Sirine Telah Berakhir'}
            </span>
          </div>
        </div>

        <p className="mt-4 text-base font-semibold text-text-primary leading-snug">
          {reason}
        </p>

        <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
          Pelanggaran tercatat (Strike #{strikeCount}). Anda dilarang keras berpindah tab, mengecilkan layar, atau membuka aplikasi lain selama ujian berlangsung.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAcknowledge}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Saya Mengerti, Kembali ke Ujian
          </button>

          <button
            type="button"
            onClick={onEmergencyExit}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-red-500/10"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Keluar Darurat (Kode Pengawas)
          </button>
        </div>
      </div>
    </div>
  );
}
