'use client';

// Layar Bukti Selesai Ujian / ReceiptCard v2.1
// Menampilkan Jam Live berdenyut, Waktu Mulai, Waktu Selesai, Total Durasi Terkunci (anti-Incognito/reset),
// Status Integritas, serta Riwayat Audit Pelanggaran untuk diperiksa Pengawas Ruang.

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  Fingerprint,
  GraduationCap,
  Home,
  Info,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import type { ActiveExamSession, ViolationLogEntry } from '@/contracts/exam';

interface ResultViewProps {
  session: ActiveExamSession;
  strikeCount: number;
  totalAwaySeconds: number;
  violationLogs: ViolationLogEntry[];
  finishedAtIso: string;
  onReturnHome: () => void;
}

function formatWibSeconds(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
}

/** Menghitung dan memformat selisih waktu terkunci antara mulai dan selesai ujian */
function formatLockedDuration(startedAtIso: string, finishedAtIso: string): {
  label: string;
  totalMinutes: number;
} {
  const startMs = new Date(startedAtIso).getTime();
  const endMs = new Date(finishedAtIso).getTime();
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;

  if (mins === 0) {
    return { label: `< 1 Menit (${secs} Detik)`, totalMinutes: 0 };
  }
  return { label: `${mins} Menit ${secs} Detik`, totalMinutes: mins };
}

export function ResultView({
  session,
  strikeCount,
  totalAwaySeconds,
  violationLogs,
  finishedAtIso,
  onReturnHome,
}: ResultViewProps) {
  const [liveClock, setLiveClock] = useState(() => formatWibSeconds(new Date()));

  // Cegah tombol Back browser kembali ke soal ujian yang sudah selesai
  useEffect(() => {
    window.history.pushState({ netriResultLocked: true }, '', window.location.href);
    const preventBack = () => {
      window.history.pushState({ netriResultLocked: true }, '', window.location.href);
    };
    window.addEventListener('popstate', preventBack);

    const clockTimer = window.setInterval(() => {
      setLiveClock(formatWibSeconds(new Date()));
    }, 1000);

    return () => {
      window.removeEventListener('popstate', preventBack);
      window.clearInterval(clockTimer);
    };
  }, []);

  const finishedDate = new Date(finishedAtIso);
  const dateStr = `${finishedDate.getDate()}/${finishedDate.getMonth() + 1}/${finishedDate.getFullYear()}`;
  const startTimeStr = formatWibSeconds(session.startedAt);
  const finishTimeStr = formatWibSeconds(finishedAtIso);
  const durationInfo = formatLockedDuration(session.startedAt, finishedAtIso);
  const isVeryShortSession = durationInfo.totalMinutes < 5;

  const isClean = strikeCount === 0;

  return (
    <div className="min-h-dvh w-full bg-bg flex items-center justify-center px-5 py-8">
      <main className="w-full max-w-[480px]">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-success">
          <CheckCircle2 className="h-12 w-12" aria-hidden="true" />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-text-primary">
          Sesi Ujian Selesai
        </h1>
        <p className="mt-1.5 text-center text-sm text-text-secondary">
          Jawaban Anda di Google Form telah terekam dan sesi ujian telah ditutup secara sah.
        </p>

        {/* Kartu Bukti Digital Resmi */}
        <section className="mt-5 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-success">
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold tracking-wider uppercase">
                BUKTI RESMI SELESAI
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-sm bg-brand-surface px-2 py-0.5 text-[10px] font-bold text-brand tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
              <span>LIVE {liveClock}</span>
            </div>
          </div>

          {/* Kotak Bukti Durasi Terkunci (Anti-Incognito & Anti-Reset Tengah Ujian) */}
          <div className="mt-3.5 rounded-md border border-border bg-bg p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
                <Timer className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                <span>Total Durasi Terkunci</span>
              </span>
              <span
                data-testid="locked-duration-value"
                className={`font-bold tabular-nums ${
                  isVeryShortSession ? 'text-warning' : 'text-text-primary'
                }`}
              >
                {durationInfo.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
              <div>
                <span className="block text-text-secondary">Waktu Mulai</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {startTimeStr}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-text-secondary">Waktu Selesai</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {finishTimeStr}
                </span>
              </div>
            </div>
          </div>

          <hr className="my-3.5 border-border" />

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-text-secondary">
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Mata Pelajaran</span>
              </dt>
              <dd className="text-right font-bold text-brand truncate max-w-[60%]">
                {session.subject}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-text-secondary">
                <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Mode Akses</span>
              </dt>
              <dd className="text-right font-semibold text-text-primary">
                {session.isPwaStandalone ? 'Aplikasi PWA (Standalone)' : session.className}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-text-secondary">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tanggal Ujian</span>
              </dt>
              <dd className="text-right font-semibold text-text-primary tabular-nums">
                {dateStr}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-text-secondary">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Status Integritas</span>
              </dt>
              <dd
                className={`text-right font-bold ${
                  isClean ? 'text-success' : 'text-danger'
                }`}
              >
                {isClean
                  ? 'BERSIH — Terkunci & Sah (0 Pelanggaran)'
                  : `Tercatat ${strikeCount} Pelanggaran (Total ${totalAwaySeconds} dtk keluar)`}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-text-secondary">
                <Fingerprint className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>ID Sesi</span>
              </dt>
              <dd className="text-right font-mono text-xs font-semibold text-text-primary">
                {session.sessionId}
              </dd>
            </div>
          </dl>

          {/* Riwayat Audit Pelanggaran untuk Diperiksa Pengawas Ruang */}
          {violationLogs.length > 0 && (
            <div className="mt-4 rounded-sm border border-red-500/25 bg-red-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-danger">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Riwayat Catatan Pengawas</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-[11px] text-text-secondary">
                {violationLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-2">
                    <span className="shrink-0 font-mono text-text-primary tabular-nums">
                      {formatWibSeconds(log.timestamp)}
                    </span>
                    <span>{log.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Mode proteksi layar penuh telah dilepas. Tunjukkan kartu bukti ini kepada pengawas ruang.
          </span>
        </div>

        <button
          type="button"
          onClick={onReturnHome}
          className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-[15px] font-bold text-white transition-transform active:scale-95"
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          Kembali ke Beranda
        </button>
      </main>
    </div>
  );
}
