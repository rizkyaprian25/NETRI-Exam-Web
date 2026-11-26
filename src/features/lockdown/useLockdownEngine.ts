'use client';

// Hook WebLockdownEngine: Pengawas Keamanan Browser 1:1 dengan LockdownService Mobile
// Mengelola sensor pindah tab, window.blur (aman terhadap klik iframe), tombol Back,
// keluar Fullscreen, Screen Wake Lock, blokir shortcut/copy, serta sirine 15 detik.

import { useCallback, useEffect, useRef, useState } from 'react';
import { EXAM_METRICS, type ViolationSeverity, type ViolationType } from '@/contracts/exam';
import { sharedOfflineQueue } from '@/core/storage/offlineQueue';
import {
  checkScreenClear,
  exitExamFullscreen,
  isCurrentlyFullscreen,
  isFullscreenSupported,
  requestExamFullscreen,
} from './screenCheck';
import { sharedSirenAudio } from './sirenAudio';

interface UseLockdownEngineOptions {
  sessionId: string;
  isActive: boolean;
  requiresFullscreen: boolean;
  onBackAttempt: () => void;
}

export interface LockdownEngineState {
  strikeCount: number;
  isLockedDialogOpen: boolean;
  lockReason: string;
  isFullscreenOk: boolean;
  isScreenClear: boolean;
  acknowledgeLock: () => void;
  reenterFullscreen: () => Promise<boolean>;
  releaseAllLocks: () => Promise<void>;
  triggerSimulatedViolation: (type: ViolationType, reason: string) => void;
}

export function useLockdownEngine({
  sessionId,
  isActive,
  requiresFullscreen,
  onBackAttempt,
}: UseLockdownEngineOptions): LockdownEngineState {
  const [strikeCount, setStrikeCount] = useState(0);
  const [isLockedDialogOpen, setIsLockedDialogOpen] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [isFullscreenOk, setIsFullscreenOk] = useState(() =>
    requiresFullscreen && isFullscreenSupported() ? isCurrentlyFullscreen() : true,
  );
  const [isScreenClear, setIsScreenClear] = useState(() => checkScreenClear());

  const startTimeRef = useRef<number>(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isCompletedRef = useRef(false);

  const recordViolation = useCallback(
    (
      type: ViolationType,
      severity: ViolationSeverity,
      notes: string,
      durationSeconds?: number,
      isExcused = false,
    ) => {
      if (isCompletedRef.current) return;

      if (!isExcused) {
        setStrikeCount((prev) => prev + 1);
        setLockReason(notes);
        setIsLockedDialogOpen(true);
        sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
      }

      void sharedOfflineQueue.enqueue({
        id: `evt_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId,
        type,
        severity,
        clientTimestamp: new Date().toISOString(),
        durationSeconds,
        isExcused,
        notes,
      });
    },
    [sessionId],
  );

  // Aktifkan Screen Wake Lock API agar layar HP tidak otomatis meredup/terkunci selama membaca soal
  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Abaikan jika browser/baterai hemat daya menolak Wake Lock
    }
  }, []);

  const releaseAllLocks = useCallback(async () => {
    isCompletedRef.current = true;
    sharedSirenAudio.stop();
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Abaikan jika sudah terlepas
      }
      wakeLockRef.current = null;
    }
    await exitExamFullscreen();
  }, []);

  const acknowledgeLock = useCallback(() => {
    sharedSirenAudio.stop();
    setIsLockedDialogOpen(false);
    if (requiresFullscreen && isFullscreenSupported() && !isCurrentlyFullscreen()) {
      void requestExamFullscreen().then((ok) => setIsFullscreenOk(ok));
    }
  }, [requiresFullscreen]);

  const reenterFullscreen = useCallback(async () => {
    const ok = await requestExamFullscreen();
    setIsFullscreenOk(ok || !isFullscreenSupported());
    if (ok) {
      sharedSirenAudio.stop();
    }
    return ok;
  }, []);

  const triggerSimulatedViolation = useCallback(
    (type: ViolationType, reason: string) => {
      recordViolation(type, 'danger', reason);
    },
    [recordViolation],
  );

  useEffect(() => {
    if (!isActive) return;

    isCompletedRef.current = false;
    startTimeRef.current = Date.now();
    void acquireWakeLock();

    // Pasang jebakan riwayat agar tombol Back browser/Android tidak mengeluarkan siswa dari ujian
    window.history.pushState({ netriExamLocked: true }, '', window.location.href);

    const isInStartupGrace = () =>
      Date.now() - startTimeRef.current < EXAM_METRICS.STARTUP_GRACE_MS;

    const handlePopState = () => {
      if (isCompletedRef.current) return;
      window.history.pushState({ netriExamLocked: true }, '', window.location.href);
      sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
      onBackAttempt();
    };

    const handleVisibilityChange = () => {
      if (isCompletedRef.current) return;
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        if (!isInStartupGrace()) {
          sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
        }
      } else {
        void acquireWakeLock();
        if (hiddenAtRef.current !== null && !isInStartupGrace()) {
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - hiddenAtRef.current) / 1000),
          );
          hiddenAtRef.current = null;
          const isExcused = durationSeconds <= EXAM_METRICS.BRIEF_EXCUSED_SECONDS;
          recordViolation(
            'app_exit',
            isExcused ? 'info' : 'warning',
            isExcused
              ? `Interupsi kilat ${durationSeconds} detik`
              : `Halaman ujian ditinggalkan selama ${durationSeconds} detik!`,
            durationSeconds,
            isExcused,
          );
        } else {
          hiddenAtRef.current = null;
        }
      }
    };

    const handleWindowBlur = () => {
      if (isCompletedRef.current || isInStartupGrace()) return;
      // PENTING: Ketika siswa mengeklik soal di dalam <iframe> Google Form,
      // browser memicu window.blur sementara document.activeElement berubah ke IFRAME tersebut.
      // Abaikan blur yang berasal dari fokus ke dalam iframe soal agar tidak false-positive!
      setTimeout(() => {
        if (isCompletedRef.current) return;
        const activeTag = document.activeElement?.tagName?.toUpperCase();
        if (activeTag === 'IFRAME') return;

        // Jika fokus benar-benar keluar ke aplikasi lain / window lain
        if (!document.hasFocus()) {
          recordViolation(
            'app_exit',
            'danger',
            'PERINGATAN EXAM NETRI: Anda Terdeteksi Pindah Tab atau Membuka Aplikasi Lain!',
          );
        }
      }, 60);
    };

    const handleFullscreenChange = () => {
      if (isCompletedRef.current || !requiresFullscreen || !isFullscreenSupported()) return;
      const full = isCurrentlyFullscreen();
      setIsFullscreenOk(full);
      if (!full && !isInStartupGrace()) {
        sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
        void sharedOfflineQueue.enqueue({
          id: `evt_fs_${Date.now()}`,
          sessionId,
          type: 'fullscreen_exit',
          severity: 'danger',
          clientTimestamp: new Date().toISOString(),
          isExcused: false,
          notes: 'Siswa keluar dari mode layar penuh (Fullscreen) saat ujian berlangsung',
        });
      }
    };

    const handleResize = () => {
      if (isCompletedRef.current) return;
      const clearNow = checkScreenClear();
      setIsScreenClear(clearNow);
      if (!clearNow && !isInStartupGrace()) {
        recordViolation(
          'split_screen',
          'danger',
          'Terdeteksi mode Split-Screen atau jendela browser diperkecil!',
        );
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isCompletedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleCopyOrCut = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCompletedRef.current) return;
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      // Tangkap tombol PrintScreen sebagai indikasi tangkapan layar
      if (event.key === 'PrintScreen') {
        event.preventDefault();
        recordViolation(
          'screenshot_attempt',
          'danger',
          'Upaya pengambilan tangkapan layar (PrintScreen) terdeteksi!',
        );
        return;
      }

      // Blokir DevTools, View Source, Print, Save, Find, dan Copy massal
      if (
        event.key === 'F12' ||
        (ctrlOrMeta && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrlOrMeta && (key === 'u' || key === 'p' || key === 's'))
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyOrCut);
    document.addEventListener('cut', handleCopyOrCut);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyOrCut);
      document.removeEventListener('cut', handleCopyOrCut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [acquireWakeLock, isActive, onBackAttempt, recordViolation, requiresFullscreen, sessionId]);

  return {
    strikeCount,
    isLockedDialogOpen,
    lockReason,
    isFullscreenOk,
    isScreenClear,
    acknowledgeLock,
    reenterFullscreen,
    releaseAllLocks,
    triggerSimulatedViolation,
  };
}
