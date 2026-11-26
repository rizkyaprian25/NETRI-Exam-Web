'use client';

// Error Boundary rute utama aplikasi (tidak pernah membocorkan stack trace internal ke pengguna)

import { AlertCircle, RotateCcw } from 'lucide-react';

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-bg text-text-primary">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-danger">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold">Halaman Mengalami Gangguan</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Silakan muat ulang komponen ini untuk melanjutkan ujian Anda dengan aman.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white transition-transform active:scale-95"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
