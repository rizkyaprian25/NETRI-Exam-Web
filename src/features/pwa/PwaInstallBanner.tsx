'use client';

// Banner Instalasi PWA Ringan (< 500 KB, Tanpa APK) & Status Mode Aplikasi Standalone

import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react';
import { usePwaInstall } from './usePwaInstall';

export function PwaInstallBanner() {
  const { isStandalone, isIos, canPromptInstall, justInstalled, triggerInstall } =
    usePwaInstall();

  if (isStandalone || justInstalled) {
    return (
      <div
        role="status"
        className="mt-3 flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-success"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Mode Aplikasi (PWA) Aktif — Layar Penuh Tanpa Bar Browser</span>
      </div>
    );
  }

  if (canPromptInstall) {
    return (
      <section className="mt-3 flex items-center justify-between gap-3 rounded-md border border-brand/30 bg-brand-surface p-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-text-primary">
            Pasang Exam NETRI ke Layar Utama
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary leading-snug">
            Tanpa unduh APK. Bebas bar Chrome &amp; bebas notifikasi tarik layar penuh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void triggerInstall()}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-xs font-bold text-white transition-transform active:scale-95"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Pasang Aplikasi
        </button>
      </section>
    );
  }

  if (isIos) {
    return (
      <section className="mt-3 flex items-start gap-2.5 rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
        <Share className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-text-primary">Mode Layar Penuh iPhone:</strong> Ketuk ikon{' '}
          <strong>Bagikan (Share)</strong> di Safari lalu pilih{' '}
          <strong>&ldquo;Tambah ke Layar Utama&rdquo;</strong>.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5 text-[11px] text-text-secondary">
      <Smartphone className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span>
        Tips: Pilih menu browser <strong>Instal Aplikasi / Tambahkan ke Layar Utama</strong> agar tampilan ujian lebih fokus tanpa address bar.
      </span>
    </div>
  );
}
