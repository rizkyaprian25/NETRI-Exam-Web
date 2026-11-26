'use client';

// Layar Sesi Ujian Terkunci Web (1:1 dengan exam_session_screen.dart)
// Mengintegrasikan ExamBar 52px, sandboxed Google Form iframe, Audit Watermark halus,
// Watchdog 15s, Heartbeat 20s, deteksi navigasi submit, dialog Back 15s, dan Lockdown Engine.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import {
  EXAM_METRICS,
  type ActiveExamSession,
  type ConnectionStatus,
} from '@/contracts/exam';
import { EmergencyExitDialog } from '@/features/lockdown/EmergencyExitDialog';
import { sharedSirenAudio } from '@/features/lockdown/sirenAudio';
import { useLockdownEngine } from '@/features/lockdown/useLockdownEngine';
import { ExamBar } from './ExamBar';
import { HotspotErrorOverlay } from './HotspotErrorOverlay';
import { LockScreenDialog } from './LockScreenDialog';
import { SecurityCurtain } from './SecurityCurtain';

interface ExamSessionViewProps {
  session: ActiveExamSession;
  onCompleted: (strikeCount: number) => void;
  onEmergencyExited: () => void;
}

export function ExamSessionView({
  session,
  onCompleted,
  onEmergencyExited,
}: ExamSessionViewProps) {
  const [iframeLoadCount, setIframeLoadCount] = useState(0);
  const [isLoadingForm, setIsLoadingForm] = useState(true);
  const [webLoadError, setWebLoadError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connected');
  const [reloadNonce, setReloadNonce] = useState(0);

  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

  const watchdogRef = useRef<number | null>(null);

  const lockdown = useLockdownEngine({
    sessionId: session.sessionId,
    isActive: true,
    requiresFullscreen: session.requiresFullscreen,
    onBackAttempt: () => setIsBackDialogOpen(true),
  });

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const checkHeartbeatNow = useCallback(async () => {
    try {
      const response = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          isFullscreen: lockdown.isFullscreenOk,
        }),
      });
      setConnectionStatus(response.ok ? 'connected' : 'reconnecting');
    } catch {
      setConnectionStatus('offline');
    }
  }, [lockdown.isFullscreenOk, session.sessionId]);

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

  // Heartbeat periodik tiap 20 detik (1:1 dengan versi Mobile)
  useEffect(() => {
    const interval = window.setInterval(() => {
      void checkHeartbeatNow();
    }, EXAM_METRICS.HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
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
    onCompleted(lockdown.strikeCount);
  };

  const handleEmergencyVerified = async () => {
    setIsEmergencyDialogOpen(false);
    await lockdown.releaseAllLocks();
    onEmergencyExited();
  };

  const showSecurityCurtain =
    !lockdown.isScreenClear || (session.requiresFullscreen && !lockdown.isFullscreenOk);

  return (
    <div className="exam-no-select flex h-dvh w-full flex-col overflow-hidden bg-bg">
      <ExamBar
        connectionStatus={connectionStatus}
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
          // Sandbox memblokir navigasi keluar ke domain lain & mencegah pengubahan halaman induk
          sandbox="allow-forms allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-white"
        />

        {/* Audit Watermark Transparan Halus (Mitigasi Screenshot OS tanpa mengganggu keterbacaan soal) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex select-none items-end justify-end p-3"
        >
          <span className="rounded bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] text-black/25">
            EXAM NETRI • {session.sessionId}
          </span>
        </div>

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

      {/* Layar Peringatan Kecurangan (LockScreenDialog) */}
      <LockScreenDialog
        isOpen={lockdown.isLockedDialogOpen}
        strikeCount={lockdown.strikeCount}
        reason={lockdown.lockReason}
        onAcknowledge={lockdown.acknowledgeLock}
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
