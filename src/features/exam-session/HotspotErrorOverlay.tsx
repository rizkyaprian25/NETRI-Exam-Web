'use client';

// Overlay Diagnostik Hotspot / Jaringan Lambat (1:1 dengan _buildHotspotErrorOverlay Mobile)

import { RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';

interface HotspotErrorOverlayProps {
  message: string;
  onReload: () => void;
  onEmergencyExit: () => void;
}

export function HotspotErrorOverlay({
  message,
  onReload,
  onEmergencyExit,
}: HotspotErrorOverlayProps) {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-bg p-5"
    >
      <div className="w-full max-w-[420px] text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-warning">
          <WifiOff className="h-11 w-11" aria-hidden="true" />
        </div>

        <h2 className="text-lg font-bold text-text-primary">
          Kendala Koneksi Hotspot / Jaringan
        </h2>

        <p className="mt-2 text-sm text-text-secondary leading-relaxed">{message}</p>

        <div className="mt-4 rounded-sm border border-border bg-surface p-3 text-left text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-text-primary">Tips Mengatasi Hotspot Macet:</p>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            <li>Pastikan HP pemberi Hotspot memiliki kuota data aktif.</li>
            <li>Nonaktifkan DNS Pribadi atau VPN jika terpasang.</li>
            <li>Dekatkan jarak perangkat dengan sumber Hotspot.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onReload}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Muat Ulang Soal
          </button>

          <button
            type="button"
            onClick={onEmergencyExit}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-danger px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-red-500/10"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Keluar Darurat (Pengawas)
          </button>
        </div>
      </div>
    </div>
  );
}
