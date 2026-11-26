'use client';

// ExamBar: Bar Tipis Status Ujian 52px (1:1 dengan exam_bar.dart Mobile)
// Menampilkan StatusPill koneksi nyata, indikator Exam NETRI (Terkunci), Muat Ulang Soal, dan Keluar Darurat

import { Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { EXAM_METRICS, type ConnectionStatus } from '@/contracts/exam';

interface ExamBarProps {
  connectionStatus: ConnectionStatus;
  onReloadForm: () => void;
  onEmergencyExit: () => void;
}

const STATUS_DISPLAY: Record<
  ConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  connected: {
    label: 'Terhubung',
    dotClass: 'bg-success',
    badgeClass: 'bg-emerald-500/15 text-success',
  },
  reconnecting: {
    label: 'Menyambung',
    dotClass: 'bg-warning',
    badgeClass: 'bg-amber-500/15 text-warning',
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-danger',
    badgeClass: 'bg-red-500/15 text-danger',
  },
};

export function ExamBar({
  connectionStatus,
  onReloadForm,
  onEmergencyExit,
}: ExamBarProps) {
  const pill = STATUS_DISPLAY[connectionStatus];

  return (
    <header
      style={{ height: `${EXAM_METRICS.EXAM_BAR_HEIGHT_PX}px` }}
      className="exam-no-select flex w-full shrink-0 items-center justify-between border-b border-border bg-surface px-2 sm:px-3"
    >
      {/* Status Koneksi Nyata (StatusPill) */}
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.badgeClass}`}
      >
        <span className={`h-2 w-2 rounded-full ${pill.dotClass}`} aria-hidden="true" />
        <span>{pill.label}</span>
      </div>

      {/* Indikator Status Ujian Terkunci */}
      <div className="mx-1.5 flex min-w-0 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-surface px-2.5 py-1 text-xs font-bold text-brand">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Exam NETRI (Terkunci)</span>
      </div>

      {/* Aksi Muat Ulang Soal & Keluar Darurat Pengawas (area sentuh minimal 44x44px) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onReloadForm}
          title="Muat Ulang Soal"
          aria-label="Muat Ulang Soal"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEmergencyExit}
          title="Keluar Darurat (Pengawas)"
          aria-label="Keluar Darurat (Pengawas)"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-danger transition-colors hover:bg-red-500/10 active:scale-95"
        >
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
