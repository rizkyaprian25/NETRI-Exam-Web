'use client';

// ExamBar: Bar Tipis Status Ujian 52px dengan Proctor Sightline Visual Beacon
// Ketika strikeCount > 0, seluruh bar berubah merah terang agar terlihat pengawas dari jauh meski HP di-silent

import { AlertTriangle, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { EXAM_METRICS, type ConnectionStatus } from '@/contracts/exam';

interface ExamBarProps {
  connectionStatus: ConnectionStatus;
  strikeCount: number;
  isHardLocked: boolean;
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
  strikeCount,
  isHardLocked,
  onReloadForm,
  onEmergencyExit,
}: ExamBarProps) {
  const pill = STATUS_DISPLAY[connectionStatus];
  const hasViolation = strikeCount > 0;

  return (
    <header
      data-testid="exam-bar"
      style={{ height: `${EXAM_METRICS.EXAM_BAR_HEIGHT_PX}px` }}
      className={`exam-no-select flex w-full shrink-0 items-center justify-between border-b px-2 sm:px-3 transition-colors ${
        hasViolation
          ? 'border-red-900 bg-[#C62828] text-white'
          : 'border-border bg-surface text-text-primary'
      }`}
    >
      {/* Status Koneksi Nyata (StatusPill) */}
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          hasViolation ? 'bg-black/25 text-white' : pill.badgeClass
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${hasViolation ? 'bg-white' : pill.dotClass}`}
          aria-hidden="true"
        />
        <span className="hidden xs:inline sm:inline">{pill.label}</span>
      </div>

      {/* Indikator Status Ujian Terkunci & Proctor Visual Beacon */}
      <div className="mx-1.5 flex min-w-0 items-center gap-1.5">
        <div
          className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
            hasViolation
              ? 'border-white/30 bg-white/15 text-white'
              : 'border-brand/30 bg-brand-surface text-brand'
          }`}
        >
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Exam NETRI (Terkunci)</span>
        </div>

        {hasViolation && (
          <div
            role="status"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#991B1B] tabular-nums"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{isHardLocked ? 'TERKUNCI' : `${strikeCount} Pelanggaran`}</span>
          </div>
        )}
      </div>

      {/* Aksi Muat Ulang Soal & Keluar Darurat Pengawas (area sentuh minimal 44x44px) */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onReloadForm}
          title="Muat Ulang Soal"
          aria-label="Muat Ulang Soal"
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors active:scale-95 ${
            hasViolation
              ? 'text-white hover:bg-white/15'
              : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEmergencyExit}
          title="Keluar Darurat (Pengawas)"
          aria-label="Keluar Darurat (Pengawas)"
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors active:scale-95 ${
            hasViolation
              ? 'text-white hover:bg-white/15'
              : 'text-danger hover:bg-red-500/10'
          }`}
        >
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
