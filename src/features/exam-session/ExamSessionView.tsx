'use client';

// Layar Sesi Ujian Terkunci Web v2 (1:1 Mobile + Penguatan 9 Lapis Anti-Curang)
// Mengintegrasikan ExamBar 52px, sandboxed Google Form iframe, Full-Screen Tiled Diagonal Watermark,
// Auto-Blur Privacy Shield, Watchdog 15s, Heartbeat 20s, deteksi navigasi submit, dan Hard Lock Pengawas.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import {
  EXAM_METRICS,
  type ActiveExamSession,
  type ConnectionStatus,
  type PersistedExamState,
  type ViolationLogEntry,
} from '@/contracts/exam';
import { checkInternetReachability } from '@/core/network/examClient';
import { EmergencyExitDialog } from '@/features/lockdown/EmergencyExitDialog';
import { sharedSirenAudio } from '@/features/lockdown/sirenAudio';
import { useLockdownEngine } from '@/features/lockdown/useLockdownEngine';
import { ExamBar } from './ExamBar';
import { HotspotErrorOverlay } from './HotspotErrorOverlay';
import { LockScreenDialog } from './LockScreenDialog';
import { SecurityCurtain } from './SecurityCurtain';

interface ExamSessionViewProps {
  session: ActiveExamSession;
  initialPersisted?: PersistedExamState;
  onCompleted: (summary: {
    strikeCount: number;
    totalAwaySeconds: number;
    violationLogs: ViolationLogEntry[];
  }) => void;
  onEmergencyExited: () => void;
}

function formatWibClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
}

export function ExamSessionView({
  session,
  initialPersisted,
  onCompleted,
  onEmergencyExited,
}: ExamSessionViewProps) {
  const [iframeLoadCount, setIframeLoadCount] = useState(0);
  const [isLoadingForm, setIsLoadingForm] = useState(true);
  const [webLoadError, setWebLoadError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connected');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [liveClock, setLiveClock] = useState(() => formatWibClock(new Date()));

  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

  const watchdogRef = useRef<number | null>(null);

  const lockdown = useLockdownEngine({
    session,
    isActive: true,
    initialPersisted,
    onBackAttempt: () => setIsBackDialogOpen(true),
  });

  // Perbarui jam detik untuk watermark anti-screenshot palsu
  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setLiveClock(formatWibClock(new Date()));
    }, 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const checkHeartbeatNow = useCallback(async () => {
    try {
      const reachable = await checkInternetReachability();
      setConnectionStatus(reachable ? 'connected' : 'offline');
    } catch {
      setConnectionStatus('offline');
    }
  }, []);

  const startWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = window.setTimeout(() => {
      setIsLoadingForm(false);
      setWebLoadError(
        'Waktu pemuatan soal habis karena koneksi Hotspot lambat atau tidak stabil. Periksa sinyal/kuota Hotspot Anda lalu tekan Muat Ulang Soal.',
      );
      void checkHeartbeatNow();
    }, EXAM_METRICS.WATCHDOG_TIMEOUT_MS);
  }, [checkHeartbeatNow, clearWatchdog]);

  useEffect(() => {
    startWatchdog();
    return () => clearWatchdog();
  }, [reloadNonce, startWatchdog, clearWatchdog]);

  // Heartbeat periodik tiap 20 detik & listener status online/offline browser
  useEffect(() => {
    const handleOnline = () => void checkHeartbeatNow();
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = window.setInterval(() => {
      void checkHeartbeatNow();
    }, EXAM_METRICS.HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [checkHeartbeatNow]);

  const handleIframeLoad = () => {
    clearWatchdog();
    setIsLoadingForm(false);
    setWebLoadError(null);
    setConnectionStatus('connected');
    setIframeLoadCount((prev) => prev + 1);
  };

  const handleReloadForm = () => {
    setWebLoadError(null);
    setIsLoadingForm(true);
    setConnectionStatus('reconnecting');
    void checkHeartbeatNow();
    setReloadNonce((n) => n + 1);
  };

  const handleCompleteExam = async () => {
    await lockdown.releaseAllLocks();
    onCompleted({
      strikeCount: lockdown.strikeCount,
      totalAwaySeconds: lockdown.totalAwaySeconds,
      violationLogs: lockdown.violationLogs,
    });
  };

  const handleEmergencyVerified = async () => {
    setIsEmergencyDialogOpen(false);
    await lockdown.releaseAllLocks();
    onEmergencyExited();
  };

  const showSecurityCurtain =
    !lockdown.isScreenClear || (session.requiresFullscreen && !lockdown.isFullscreenOk);

  const watermarkText = `EXAM NETRI • ${session.sessionId} • ${liveClock}`;

  return (
    <div className="exam-no-select flex h-dvh w-full flex-col overflow-hidden bg-bg">
      <ExamBar
        connectionStatus={connectionStatus}
        strikeCount={lockdown.strikeCount}
        isHardLocked={lockdown.isHardLocked}
        onReloadForm={handleReloadForm}
        onEmergencyExit={() => {
          sharedSirenAudio.stop();
          setIsEmergencyDialogOpen(true);
        }}
      />

      {/* Area Lembar Soal Google Form Terkunci */}
      <main className="relative flex-1 overflow-hidden bg-white">
        {isLoadingForm && !webLoadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg/95 p-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
            <p className="mt-3 text-sm font-medium text-text-secondary">
              Memuat lembar soal ujian...
            </p>
          </div>
        )}

        <iframe
          key={`${session.embedFormUrl}_${reloadNonce}`}
          src={session.embedFormUrl}
          title={session.examTitle || 'Lembar Soal Ujian Google Form'}
          onLoad={handleIframeLoad}
          sandbox="allow-forms allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          className={`h-full w-full border-0 bg-white transition-[filter] duration-150 ${
            lockdown.isWindowBlurred || lockdown.isLockedDialogOpen ? 'blur-xl' : ''
          }`}
        />

        {/* Full-Screen Tiled Diagonal Watermark (Mitigasi Foto HP & Screenshot tanpa menghalangi bacaan) */}
        <div
          aria-hidden="true"
          data-testid="exam-tiled-watermark"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
        >
          <div className="grid h-[140%] w-[140%] -translate-x-[15%] -translate-y-[15%] -rotate-[24deg] grid-cols-2 sm:grid-cols-3 gap-y-16 gap-x-8 items-center justify-items-center">
            {Array.from({ length: 12 }).map((_, idx) => (
              <span
                key={idx}
                className="whitespace-nowrap font-mono text-[11px] font-semibold tracking-wider text-slate-900/[0.07]"
              >
                {watermarkText}
              </span>
            ))}
          </div>
        </div>

        {/* Auto-Blur Privacy Shield saat jendela kehilangan fokus (di luar iframe) */}
        {lockdown.isWindowBlurred &&
          !lockdown.isLockedDialogOpen &&
          !showSecurityCurtain && (
            <div
              role="status"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/65 p-6 text-center text-white backdrop-blur-md"
            >
              <EyeOff className="h-10 w-10 text-amber-300" aria-hidden="true" />
              <p className="mt-3 text-base font-bold">Layar Ujian Dilindungi</p>
              <p className="mt-1 text-xs text-white/80">
                Fokus kembali ke jendela ujian untuk melanjutkan melihat soal.
              </p>
            </div>
          )}

        {/* Tombol Selesai hanya tampil setelah iframe mengalami navigasi/kirim lanjutan (load >= 2) */}
        {iframeLoadCount >= 2 && !webLoadError && (
          <div className="fixed bottom-4 inset-x-4 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md border border-emerald-600/30 bg-surface/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-primary">
                Sudah menekan tombol Kirim di Form?
              </p>
              <p className="text-[11px] text-text-secondary truncate">
                Pastikan halaman konfirmasi Google Form sudah muncul.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFinishConfirmOpen(true)}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md bg-success px-3.5 py-2 text-xs font-bold text-white transition-transform active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Selesai Ujian
            </button>
          </div>
        )}

        {webLoadError && (
          <HotspotErrorOverlay
            message={webLoadError}
            onReload={handleReloadForm}
            onEmergencyExit={() => {
              sharedSirenAudio.stop();
              setIsEmergencyDialogOpen(true);
            }}
          />
        )}
      </main>

      {/* Dialog Peringatan Tombol Back (Dilarang Keluar! + Sirine 15 Detik) */}
      {isBackDialogOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="back-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center gap-2.5 text-danger">
              <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden="true" />
              <h2 id="back-dialog-title" className="text-base font-bold">
                Dilarang Keluar!
              </h2>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-sm border border-red-500/35 bg-red-500/10 p-2.5 text-xs font-bold text-danger">
              <Volume2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Sirine peringatan aktif berbunyi keras selama 15 detik!</span>
            </div>

            <p className="mt-3 text-[13px] text-text-secondary leading-relaxed">
              Tombol kembali dinonaktifkan demi integritas ujian. Anda tidak diizinkan meninggalkan lembar ujian sebelum menyelesaikan seluruh soal.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  sharedSirenAudio.stop();
                  setIsBackDialogOpen(false);
                  setIsEmergencyDialogOpen(true);
                }}
                className="min-h-[44px] rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-red-500/10"
              >
                Keluar Darurat
              </button>
              <button
                type="button"
                onClick={() => {
                  sharedSirenAudio.stop();
                  setIsBackDialogOpen(false);
                }}
                className="min-h-[44px] rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95"
              >
                Lanjut Mengerjakan Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Ganda Sebelum Mengakhiri Ujian */}
      {isFinishConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finish-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h2 id="finish-confirm-title" className="text-base font-bold text-text-primary">
              Konfirmasi Penyelesaian Ujian
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Pastikan Anda sudah menekan tombol <strong>Kirim / Submit</strong> di Google Form dan melihat pesan konfirmasi dari Google Form sebelum menutup lembar ujian.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFinishConfirmOpen(false)}
                className="min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
              >
                Kembali ke Soal
              </button>
              <button
                type="button"
                onClick={() => void handleCompleteExam()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-success px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95"
              >
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Ya, Saya Sudah Kirim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layar Peringatan Kecurangan / Hard Lock Pengawas */}
      <LockScreenDialog
        isOpen={lockdown.isLockedDialogOpen}
        sessionId={session.sessionId}
        strikeCount={lockdown.strikeCount}
        isHardLocked={lockdown.isHardLocked}
        reason={lockdown.lockReason}
        onAcknowledge={lockdown.acknowledgeLock}
        onProctorUnlocked={lockdown.unlockHardLockByProctor}
        onEmergencyExit={() => {
          sharedSirenAudio.stop();
          setIsEmergencyDialogOpen(true);
        }}
      />

      {/* Tirai Keamanan saat Fullscreen dilepas atau Split-Screen */}
      <SecurityCurtain
        isVisible={showSecurityCurtain && !lockdown.isLockedDialogOpen}
        isSplitScreenViolation={!lockdown.isScreenClear}
        onReenterFullscreen={() => void lockdown.reenterFullscreen()}
        onEmergencyExit={() => {
          sharedSirenAudio.stop();
          setIsEmergencyDialogOpen(true);
        }}
      />

      {/* Dialog Keluar Darurat Kode Pengawas */}
      <EmergencyExitDialog
        isOpen={isEmergencyDialogOpen}
        sessionId={session.sessionId}
        onCancel={() => setIsEmergencyDialogOpen(false)}
        onVerified={() => void handleEmergencyVerified()}
      />
    </div>
  );
}
