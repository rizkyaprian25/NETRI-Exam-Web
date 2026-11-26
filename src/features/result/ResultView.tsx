'use client';

// Layar Bukti Selesai Ujian / ReceiptCard v2 (1:1 Mobile + Jam Live & Audit Trail Pelanggaran)

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
  const hh = String(finishedDate.getHours()).padStart(2, '0');
  const mm = String(finishedDate.getMinutes()).padStart(2, '0');
  const dateStr = `${finishedDate.getDate()}/${finishedDate.getMonth() + 1}/${finishedDate.getFullYear()}`;
  const timeDisplay = `${hh}:${mm} WIB (${dateStr})`;

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
            <span className="rounded-sm bg-brand-surface px-2 py-0.5 text-[10px] font-bold text-brand tabular-nums">
              {liveClock}
            </span>
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
                <span>Waktu Submit</span>
              </dt>
              <dd className="text-right font-semibold text-text-primary tabular-nums">
                {timeDisplay}
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
