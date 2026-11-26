'use client';

// Dialog Peringatan & Eskalasi Hard Lock Pengawas (Strike 1 = Cooldown 5s, Strike >= 2 = Hard Lock Permanen)

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  KeyRound,
  Lock,
  LockOpen,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import { EXAM_METRICS } from '@/contracts/exam';
import { sharedEmergencyVerifier } from '@/core/security/emergencyVerifier';

interface LockScreenDialogProps {
  isOpen: boolean;
  sessionId: string;
  strikeCount: number;
  isHardLocked: boolean;
  reason: string;
  onAcknowledge: () => void;
  onProctorUnlocked: () => void;
  onEmergencyExit: () => void;
}

export function LockScreenDialog({
  isOpen,
  sessionId,
  strikeCount,
  isHardLocked,
  reason,
  onAcknowledge,
  onProctorUnlocked,
  onEmergencyExit,
}: LockScreenDialogProps) {
  const [sirenSecondsLeft, setSirenSecondsLeft] = useState(15);
  const [cooldownLeft, setCooldownLeft] = useState<number>(
    EXAM_METRICS.STRIKE_COOLDOWN_SECONDS,
  );

  // State khusus pembuka kunci Hard Lock oleh Pengawas
  const [passcode, setPasscode] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    setSirenSecondsLeft(15);
    setCooldownLeft(isHardLocked ? 0 : EXAM_METRICS.STRIKE_COOLDOWN_SECONDS);
    setPasscode('');
    setIsVerifying(false);

    const status = sharedEmergencyVerifier.getLockoutStatus(sessionId);
    if (status.lockedOut) {
      setLockoutSeconds(status.remainingLockoutSeconds);
      setPinError(
        `Terlalu banyak percobaan salah. Coba lagi dalam ${status.remainingLockoutSeconds} detik.`,
      );
    } else {
      setLockoutSeconds(0);
      setPinError(null);
    }

    const timer = window.setInterval(() => {
      setSirenSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, isHardLocked, sessionId]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setPinError(null);
          return 0;
        }
        setPinError(
          `Terlalu banyak percobaan salah. Coba lagi dalam ${prev - 1} detik.`,
        );
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  const handleUnlockHardLock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isVerifying || lockoutSeconds > 0) return;

    const cleaned = passcode.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setPinError('Masukkan tepat 6 digit kode pengawas.');
      return;
    }

    setIsVerifying(true);
    setPinError(null);

    try {
      const result = await sharedEmergencyVerifier.verify(cleaned, sessionId);
      if (result.verified) {
        onProctorUnlocked();
        return;
      }

      if (result.lockedOut) {
        const secs = result.remainingLockoutSeconds || 30;
        setLockoutSeconds(secs);
        setPinError(`Terlalu banyak percobaan salah. Coba lagi dalam ${secs} detik.`);
      } else {
        setPinError(
          `Kode pengawas salah. Sisa percobaan: ${result.remainingAttempts} kali.`,
        );
      }
    } catch {
      setPinError('Gagal memverifikasi kode pengawas.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lock-dialog-title"
      className={`exam-no-select fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg p-5 ${
        isHardLocked ? 'proctor-beacon-border' : ''
      }`}
    >
      <div className="w-full max-w-[440px] text-center">
        {isHardLocked && (
          <div className="mb-4 rounded-md bg-[#C62828] px-4 py-2.5 text-xs font-extrabold tracking-wide text-white uppercase shadow-sm">
            PANGGIL PENGAWAS RUANG — SESI TERKUNCI
          </div>
        )}

        {/* Ikon Peringatan atau Kunci Permanen */}
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 text-danger">
          {isHardLocked ? (
            <Lock className="h-12 w-12" aria-hidden="true" />
          ) : (
            <BellRing className="h-14 w-14 animate-pulse" aria-hidden="true" />
          )}
        </div>

        <h2 id="lock-dialog-title" className="text-[22px] font-bold text-danger">
          {isHardLocked ? '🔒 SESI UJIAN TERKUNCI' : '🚨 PERINGATAN KECURANGAN!'}
        </h2>

        <div className="mt-3 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-4 py-2 text-xs font-bold text-danger tabular-nums">
            <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {sirenSecondsLeft > 0
                ? `Sirine Peringatan Berbunyi (${sirenSecondsLeft} detik)`
                : 'Sirine Telah Berakhir'}
            </span>
          </div>
        </div>

        <p className="mt-4 text-base font-semibold text-text-primary leading-snug">
          {reason}
        </p>

        <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
          {isHardLocked
            ? `Tercatat ${strikeCount} kali pelanggaran. Sesi dikunci permanen dan tidak dapat dilanjutkan sebelum Pengawas Ruang memasukkan kode 6-digit.`
            : `Pelanggaran tercatat (Strike #${strikeCount}). Peringatan terakhir: pelanggaran berikutnya akan mengunci ujian secara permanen hingga dibuka oleh pengawas!`}
        </p>

        {isHardLocked ? (
          /* Mode Hard Lock: Hanya Pengawas yang dapat membuka kunci sesi */
          <form
            onSubmit={(e) => void handleUnlockHardLock(e)}
            className="mt-5 rounded-lg border border-red-500/30 bg-surface p-4 text-left"
          >
            <label
              htmlFor="hardlock-proctor-pin"
              className="block text-xs font-bold text-text-primary"
            >
              Kode Buka Kunci Pengawas (6 Digit)
            </label>
            <div className="relative mt-2 flex items-center">
              <KeyRound
                className="pointer-events-none absolute left-3 h-4 w-4 text-text-secondary"
                aria-hidden="true"
              />
              <input
                id="hardlock-proctor-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                disabled={lockoutSeconds > 0 || isVerifying}
                value={passcode}
                onChange={(e) =>
                  setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Masukkan 6 digit kode pengawas"
                className="min-h-[48px] w-full rounded-sm border border-border bg-bg pl-10 pr-3 text-sm text-text-primary outline-none focus:border-brand disabled:opacity-50"
              />
            </div>
            {pinError && (
              <p role="alert" className="mt-2 text-xs font-medium text-danger">
                {pinError}
              </p>
            )}
            <button
              type="submit"
              disabled={lockoutSeconds > 0 || isVerifying}
              className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              <LockOpen className="h-4 w-4" aria-hidden="true" />
              Buka Kunci &amp; Lanjutkan Ujian
            </button>
          </form>
        ) : (
          /* Mode Strike 1: Wajib tunggu cooldown 5 detik sebelum bisa kembali */
          <div className="mt-6">
            <button
              type="button"
              disabled={cooldownLeft > 0}
              onClick={onAcknowledge}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60 tabular-nums"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {cooldownLeft > 0
                ? `Tunggu ${cooldownLeft} detik...`
                : 'Saya Mengerti, Kembali ke Ujian'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onEmergencyExit}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-red-500/10"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Keluar Darurat (Akhiri Sesi)
        </button>
      </div>
    </div>
  );
}
