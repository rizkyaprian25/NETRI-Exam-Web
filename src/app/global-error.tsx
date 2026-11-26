'use client';

// Global Error Boundary untuk mencegah White Screen of Death (SOP Seksi 3.3 & 5.1)

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="min-h-dvh bg-[#FAFAF7] text-[#14181F] dark:bg-[#0E1116] dark:text-[#F2F4F7] flex items-center justify-center p-6">
        <main className="w-full max-w-md rounded-lg border border-[#E4E7EC] dark:border-[#344054] bg-white dark:bg-[#171B22] p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-[#C62828] dark:text-[#FF8A80]">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold">Terjadi Kendala Tampilan</h1>
          <p className="mt-2 text-sm text-[#4A5260] dark:text-[#98A2B3] leading-relaxed">
            Aplikasi mengalami gangguan sementara saat memuat halaman. Tekan tombol di bawah untuk memulihkan sesi secara aman.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#1A4FD6] px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Muat Ulang Halaman
          </button>
        </main>
      </body>
    </html>
  );
}
