// Layanan Jaringan & Resolusi Tautan Client-Native (1:1 dengan ApiClient Flutter Mobile)
// Berjalan 100% di sisi browser sehingga kompatibel penuh dengan GitHub Pages Static Hosting

import type { ResolveFormData } from '@/contracts/exam';
import { withBasePath } from '@/core/url/basePath';
import {
  toEmbedGoogleFormUrl,
  validateAndNormalizeExamUrl,
} from '@/core/url/examUrl';

declare global {
  interface Window {
    __NETRI_MOCK_ONLINE__?: boolean;
    __NETRI_MOCK_EMBED_URL__?: string;
  }
}

const HOTSPOT_OFFLINE_MESSAGE =
  'Koneksi internet tidak terdeteksi pada Hotspot/Wi-Fi Anda! Pastikan Hotspot memiliki kuota aktif dan tidak terhalang halaman login operator sebelum memulai ujian.';

/** Memeriksa keterjangkauan internet nyata pra-ujian dan saat heartbeat 20 detik */
export async function checkInternetReachability(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (typeof window.__NETRI_MOCK_ONLINE__ === 'boolean') {
    return window.__NETRI_MOCK_ONLINE__;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  // Pada pengujian lokal (atau localhost), cukup verifikasi origin sendiri tanpa bergantung DNS luar
  if (isLocalHost) {
    try {
      const res = await fetch(`${withBasePath('/favicon.png')}?t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Di GitHub Pages / jaringan siswa, verifikasi keterjangkauan langsung ke Google (no-cors opaque OK)
  try {
    await fetch(`https://www.google.com/generate_204?t=${Date.now()}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

/** Memvalidasi tautan formulir ujian, mengecek internet Hotspot, dan menyiapkan URL embed */
export async function resolveExamFormClient(
  rawInput: string,
): Promise<{ ok: true; data: ResolveFormData } | { ok: false; message: string }> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: 'Harap tempel tautan form atau pindai QR Code ujian.',
    };
  }

  const normalizedUrl = validateAndNormalizeExamUrl(trimmed);
  if (!normalizedUrl) {
    return {
      ok: false,
      message:
        'Tautan harus berupa Google Forms (forms.gle) atau tautan pendek (s.id, gg.gg).',
    };
  }

  const isOnline = await checkInternetReachability();
  if (!isOnline) {
    return {
      ok: false,
      message: HOTSPOT_OFFLINE_MESSAGE,
    };
  }

  const mockEmbed =
    typeof window !== 'undefined' ? window.__NETRI_MOCK_EMBED_URL__ : undefined;
  const embedUrl = mockEmbed || toEmbedGoogleFormUrl(normalizedUrl);

  return {
    ok: true,
    data: {
      normalizedUrl,
      embedUrl,
      examTitle: 'Ujian Google Form',
    },
  };
}
