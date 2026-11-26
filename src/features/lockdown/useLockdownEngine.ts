'use client';

// Hook WebLockdownEngine v2: Pengawasan 9 Lapis Anti-Curang Browser
// Mengelola sensor pindah tab ketat (>= 1s), window.blur -> Auto-Blur Shield, multi-tab BroadcastChannel,
// jebakan tombol Back, Hard Lock permanen pada Strike >= 2 (persisten anti-refresh),
// blokir drag/copy/PrintScreen/shortcut, pembersihan clipboard, serta sirine 15 detik.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXAM_METRICS,
  type ActiveExamSession,
  type PersistedExamState,
  type ViolationLogEntry,
  type ViolationSeverity,
  type ViolationType,
} from '@/contracts/exam';
import { sharedOfflineQueue } from '@/core/storage/offlineQueue';
import {
  checkScreenClear,
  exitExamFullscreen,
  isCurrentlyFullscreen,
  isFullscreenSupported,
  requestExamFullscreen,
} from './screenCheck';
import {
  clearPersistedExamState,
  savePersistedExamState,
} from './sessionPersistence';
import { sharedSirenAudio } from './sirenAudio';

declare global {
  interface Window {
    __NETRI_TEST_BYPASS_GRACE__?: boolean;
  }
}

interface UseLockdownEngineOptions {
  session: ActiveExamSession;
  isActive: boolean;
  initialPersisted?: PersistedExamState;
  onBackAttempt: () => void;
}

export interface LockdownEngineState {
  strikeCount: number;
  totalAwaySeconds: number;
  isHardLocked: boolean;
  isLockedDialogOpen: boolean;
  lockReason: string;
  violationLogs: ViolationLogEntry[];
  isFullscreenOk: boolean;
  isScreenClear: boolean;
  isWindowBlurred: boolean;
  acknowledgeLock: () => void;
  unlockHardLockByProctor: () => void;
  reenterFullscreen: () => Promise<boolean>;
  releaseAllLocks: () => Promise<void>;
}

function wipeClipboardSafely(): void {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText('').catch(() => {
    // Abaikan jika izin clipboard ditolak browser
  });
}

export function useLockdownEngine({
  session,
  isActive,
  initialPersisted,
  onBackAttempt,
}: UseLockdownEngineOptions): LockdownEngineState {
  const [strikeCount, setStrikeCount] = useState(
    () => initialPersisted?.strikeCount ?? 0,
  );
  const [totalAwaySeconds, setTotalAwaySeconds] = useState(
    () => initialPersisted?.totalAwaySeconds ?? 0,
  );
  const [isHardLocked, setIsHardLocked] = useState(
    () => initialPersisted?.isHardLocked ?? false,
  );
  const [isLockedDialogOpen, setIsLockedDialogOpen] = useState(
    () => Boolean(initialPersisted?.isHardLocked),
  );
  const [lockReason, setLockReason] = useState(
    () => initialPersisted?.lastLockReason ?? '',
  );
  const [violationLogs, setViolationLogs] = useState<ViolationLogEntry[]>(
    () => initialPersisted?.violationLogs ?? [],
  );
  const [isFullscreenOk, setIsFullscreenOk] = useState(() =>
    session.requiresFullscreen && isFullscreenSupported()
      ? isCurrentlyFullscreen()
      : true,
  );
  const [isScreenClear, setIsScreenClear] = useState(() => checkScreenClear());
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  const startTimeRef = useRef<number>(
    initialPersisted ? 0 : Date.now(),
  );
  const hiddenAtRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isCompletedRef = useRef(false);

  // Ref sinkron agar eskalasi Hard Lock & penyimpanan localStorage bebas race condition
  const strikeCountRef = useRef(strikeCount);
  const totalAwayRef = useRef(totalAwaySeconds);
  const logsRef = useRef<ViolationLogEntry[]>(violationLogs);
  const hardLockedRef = useRef(isHardLocked);

  const persistSnapshot = useCallback(
    (
      nextStrikes: number,
      nextAwaySeconds: number,
      nextHardLocked: boolean,
      nextReason: string,
      nextLogs: ViolationLogEntry[],
    ) => {
      savePersistedExamState({
        session,
        strikeCount: nextStrikes,
        totalAwaySeconds: nextAwaySeconds,
        isHardLocked: nextHardLocked,
        lastLockReason: nextReason,
        violationLogs: nextLogs,
      });
    },
    [session],
  );

  // Simpan snapshot awal segera saat sesi ujian dimulai agar Refresh (F5) tetap memulihkan sesi
  useEffect(() => {
    if (!isActive) return;
    persistSnapshot(
      strikeCountRef.current,
      totalAwayRef.current,
      hardLockedRef.current,
      lockReason,
      logsRef.current,
    );
    wipeClipboardSafely();
  }, [isActive, lockReason, persistSnapshot]);

  const recordViolation = useCallback(
    (
      type: ViolationType,
      severity: ViolationSeverity,
      notes: string,
      durationSeconds?: number,
    ) => {
      if (isCompletedRef.current) return;

      const nextStrikes = strikeCountRef.current + 1;
      const addedSeconds = durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
      const nextAwaySeconds = totalAwayRef.current + addedSeconds;
      const nextHardLocked =
        hardLockedRef.current ||
        nextStrikes >= EXAM_METRICS.HARD_LOCK_STRIKE_THRESHOLD;

      const nowIso = new Date().toISOString();
      const entryId = `evt_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newEntry: ViolationLogEntry = {
        id: entryId,
        type,
        timestamp: nowIso,
        durationSeconds: addedSeconds > 0 ? addedSeconds : undefined,
        notes,
      };
      const nextLogs = [...logsRef.current, newEntry].slice(-50);

      strikeCountRef.current = nextStrikes;
      totalAwayRef.current = nextAwaySeconds;
      hardLockedRef.current = nextHardLocked;
      logsRef.current = nextLogs;

      setStrikeCount(nextStrikes);
      setTotalAwaySeconds(nextAwaySeconds);
      setIsHardLocked(nextHardLocked);
      setLockReason(notes);
      setViolationLogs(nextLogs);
      setIsLockedDialogOpen(true);

      sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
      persistSnapshot(nextStrikes, nextAwaySeconds, nextHardLocked, notes, nextLogs);

      void sharedOfflineQueue.enqueue({
        id: entryId,
        sessionId: session.sessionId,
        type,
        severity,
        clientTimestamp: nowIso,
        durationSeconds: addedSeconds > 0 ? addedSeconds : undefined,
        isExcused: false,
        notes,
      });
    },
    [persistSnapshot, session.sessionId],
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
    clearPersistedExamState();
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
    // Hard Lock hanya boleh dibuka oleh pengawas melalui unlockHardLockByProctor()
    if (hardLockedRef.current) return;

    sharedSirenAudio.stop();
    setIsLockedDialogOpen(false);
    setIsWindowBlurred(false);
    if (
      session.requiresFullscreen &&
      isFullscreenSupported() &&
      !isCurrentlyFullscreen()
    ) {
      void requestExamFullscreen().then((ok) => setIsFullscreenOk(ok));
    }
  }, [session.requiresFullscreen]);

  const unlockHardLockByProctor = useCallback(() => {
    sharedSirenAudio.stop();
    hardLockedRef.current = false;
    setIsHardLocked(false);
    setIsLockedDialogOpen(false);
    setIsWindowBlurred(false);

    // Tetap simpan jumlah strike dan timeline pelanggaran di localStorage sebagai bukti audit
    persistSnapshot(
      strikeCountRef.current,
      totalAwayRef.current,
      false,
      '',
      logsRef.current,
    );

    if (
      session.requiresFullscreen &&
      isFullscreenSupported() &&
      !isCurrentlyFullscreen()
    ) {
      void requestExamFullscreen().then((ok) => setIsFullscreenOk(ok));
    }
  }, [persistSnapshot, session.requiresFullscreen]);

  const reenterFullscreen = useCallback(async () => {
    const ok = await requestExamFullscreen();
    setIsFullscreenOk(ok || !isFullscreenSupported());
    if (ok) {
      sharedSirenAudio.stop();
    }
    return ok;
  }, []);

  useEffect(() => {
    if (!isActive) return;

    isCompletedRef.current = false;
    if (!initialPersisted) {
      startTimeRef.current = Date.now();
    }
    void acquireWakeLock();

    // Pasang jebakan riwayat agar tombol Back browser/Android tidak mengeluarkan siswa dari ujian
    window.history.pushState({ netriExamLocked: true }, '', window.location.href);

    const isInStartupGrace = () => {
      if (window.__NETRI_TEST_BYPASS_GRACE__ === true) return false;
      if (strikeCountRef.current > 0) return false;
      return Date.now() - startTimeRef.current < EXAM_METRICS.STARTUP_GRACE_MS;
    };

    // Deteksi Multi-Tab: catat pelanggaran jika siswa membuka tab kedua NETRI Exam
    const tabId = `tab_${Math.random().toString(36).slice(2, 9)}`;
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('netri_exam_single_tab_v1');
        broadcastChannel.onmessage = (msg: MessageEvent<{ type?: string; sender?: string }>) => {
          if (isCompletedRef.current) return;
          if (msg.data?.type === 'NETRI_TAB_PING' && msg.data?.sender !== tabId) {
            recordViolation(
              'multi_tab',
              'danger',
              'Terdeteksi membuka tab browser NETRI lain secara bersamaan!',
            );
          }
        };
        broadcastChannel.postMessage({ type: 'NETRI_TAB_PING', sender: tabId });
      } catch {
        broadcastChannel = null;
      }
    }

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
        setIsWindowBlurred(true);
        if (!isInStartupGrace()) {
          sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
        }
      } else {
        setIsWindowBlurred(false);
        void acquireWakeLock();
        if (hiddenAtRef.current !== null && !isInStartupGrace()) {
          const elapsedMs = Date.now() - hiddenAtRef.current;
          hiddenAtRef.current = null;
          // Perketat toleransi: keluar tab >= 500ms (>= 1 detik) langsung dicatat sebagai pelanggaran
          if (elapsedMs >= 500) {
            const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));
            recordViolation(
              'app_exit',
              durationSeconds >= 3 ? 'danger' : 'warning',
              `Halaman ujian ditinggalkan selama ${durationSeconds} detik!`,
              durationSeconds,
            );
          }
        } else {
          hiddenAtRef.current = null;
        }
      }
    };

    const handleWindowFocus = () => {
      setIsWindowBlurred(false);
    };

    const handleWindowBlur = () => {
      if (isCompletedRef.current || isInStartupGrace()) return;
      // PENTING: Abaikan blur saat siswa mengeklik ke dalam <iframe> soal Google Form
      window.setTimeout(() => {
        if (isCompletedRef.current) return;
        const activeTag = document.activeElement?.tagName?.toUpperCase();
        if (activeTag === 'IFRAME') return;

        if (!document.hasFocus()) {
          setIsWindowBlurred(true);
          recordViolation(
            'app_exit',
            'danger',
            'PERINGATAN EXAM NETRI: Anda Terdeteksi Pindah Tab atau Membuka Aplikasi Lain!',
          );
        }
      }, 60);
    };

    const handleFullscreenChange = () => {
      if (
        isCompletedRef.current ||
        !session.requiresFullscreen ||
        !isFullscreenSupported()
      ) {
        return;
      }
      const full = isCurrentlyFullscreen();
      setIsFullscreenOk(full);
      if (!full && !isInStartupGrace()) {
        sharedSirenAudio.start(EXAM_METRICS.SIREN_DURATION_MS);
        void sharedOfflineQueue.enqueue({
          id: `evt_fs_${Date.now()}`,
          sessionId: session.sessionId,
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

    const handleDragOrDrop = (event: DragEvent) => {
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

      // Tangkap tombol PrintScreen atau kombinasi screenshot OS populer
      if (
        event.key === 'PrintScreen' ||
        (event.metaKey && event.shiftKey && key === 's')
      ) {
        event.preventDefault();
        wipeClipboardSafely();
        recordViolation(
          'screenshot_attempt',
          'danger',
          'Upaya pengambilan tangkapan layar terdeteksi!',
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
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragOrDrop);
    document.addEventListener('drop', handleDragOrDrop);
    document.addEventListener('copy', handleCopyOrCut);
    document.addEventListener('cut', handleCopyOrCut);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      broadcastChannel?.close();
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragOrDrop);
      document.removeEventListener('drop', handleDragOrDrop);
      document.removeEventListener('copy', handleCopyOrCut);
      document.removeEventListener('cut', handleCopyOrCut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    acquireWakeLock,
    initialPersisted,
    isActive,
    onBackAttempt,
    recordViolation,
    session.requiresFullscreen,
    session.sessionId,
  ]);

  return {
    strikeCount,
    totalAwaySeconds,
    isHardLocked,
    isLockedDialogOpen,
    lockReason,
    violationLogs,
    isFullscreenOk,
    isScreenClear,
    isWindowBlurred,
    acknowledgeLock,
    unlockHardLockByProctor,
    reenterFullscreen,
    releaseAllLocks,
  };
}
