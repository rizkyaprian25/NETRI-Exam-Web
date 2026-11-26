'use client';

// Dialog Verifikasi Kode Keluar Darurat Pengawas (1:1 dengan emergency_exit_guard.dart)
// Verifikasi dijalankan secara waktu konstan menggunakan Web Crypto SHA-256 + anti brute-force persisten

import { useEffect, useState } from 'react';
import { KeyRound, LockOpen, ShieldAlert } from 'lucide-react';
import { sharedEmergencyVerifier } from '@/core/security/emergencyVerifier';

interface EmergencyExitDialogProps {
  isOpen: boolean;
  sessionId: string;
  onCancel: () => void;
  onVerified: () => void;
}

export function EmergencyExitDialog({
  isOpen,
  sessionId,
  onCancel,
  onVerified,
}: EmergencyExitDialogProps) {
  const [passcode, setPasscode] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setPasscode('');
      setErrorText(null);
      setIsSubmitting(false);
      return;
    }

    // Sinkronkan status lockout saat dialog dibuka agar tidak bisa direset dengan menutup dialog
    const status = sharedEmergencyVerifier.getLockoutStatus(sessionId);
    if (status.lockedOut) {
      setLockoutSeconds(status.remainingLockoutSeconds);
      setErrorText(
        `Terlalu banyak percobaan salah. Coba lagi dalam ${status.remainingLockoutSeconds} detik.`,
      );
    } else {
      setLockoutSeconds(0);
      setErrorText(null);
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setErrorText(null);
          return 0;
        }
        setErrorText(
          `Terlalu banyak percobaan salah. Coba lagi dalam ${prev - 1} detik.`,
        );
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  const isLockedOut = lockoutSeconds > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isLockedOut) return;

    const cleaned = passcode.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setErrorText('Masukkan tepat 6 digit kode darurat pengawas.');
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      const result = await sharedEmergencyVerifier.verify(cleaned, sessionId);
      if (result.verified) {
        onVerified();
        return;
      }

      if (result.lockedOut) {
        const secs = result.remainingLockoutSeconds || 30;
        setLockoutSeconds(secs);
        setErrorText(`Terlalu banyak percobaan salah. Coba lagi dalam ${secs} detik.`);
      } else {
        setErrorText(
          `Kode darurat salah. Sisa percobaan: ${result.remainingAttempts} kali.`,
        );
      }
    } catch {
      setErrorText('Gagal memverifikasi kode pengawas. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
          <h2 id="emergency-dialog-title" className="text-base font-bold text-text-primary">
            Keluar Darurat (Pengawas)
          </h2>
        </div>

        <p className="mt-3 text-[13px] text-text-secondary leading-relaxed">
          Masukkan 6 digit kode darurat pengawas untuk memutus penguncian layar penuh dan mengakhiri sesi secara aman.
        </p>

        <div className="mt-3">
          <label htmlFor="proctor-passcode-input" className="sr-only">
            6 digit kode pengawas
          </label>
          <div className="relative flex items-center">
            <KeyRound
              className="pointer-events-none absolute left-3 h-4 w-4 text-text-secondary"
              aria-hidden="true"
            />
            <input
              id="proctor-passcode-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={6}
              disabled={isLockedOut || isSubmitting}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 digit kode pengawas"
              className="min-h-[48px] w-full rounded-sm border border-border bg-bg pl-10 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-brand disabled:opacity-50"
            />
          </div>
          {errorText && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {errorText}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLockedOut || isSubmitting}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
          >
            <LockOpen className="h-4 w-4" aria-hidden="true" />
            Buka Kunci &amp; Keluar
          </button>
        </div>
      </form>
    </div>
  );
}
