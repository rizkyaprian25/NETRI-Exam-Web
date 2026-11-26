// Utilitas Validasi, Normalisasi, dan Keamanan URL Ujian (Anti-SSRF & Whitelist Domain)
// Mereplikasi penuh aturan domain masuk dari LoginScreen versi mobile

import {
  ALLOWED_ENTRY_DOMAINS,
  ALLOWED_FINAL_EXAM_HOSTS,
} from '@/contracts/exam';

/** Memeriksa apakah host termasuk alamat lokal atau jaringan privat (pencegahan SSRF) */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // Blokir rentang IPv4 privat umum (10.x, 127.x, 169.254.x, 172.16-31.x, 192.168.x)
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const a = Number(ipv4Match[1]);
  const b = Number(ipv4Match[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function matchesAllowedDomain(host: string, allowlist: readonly string[]): boolean {
  return allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Menormalisasi dan memvalidasi URL formulir ujian atau pemendek tautan yang sah.
 * Menambahkan skema https:// secara otomatis jika pengguna mengetik s.id/... secara langsung.
 */
export function validateAndNormalizeExamUrl(raw: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (!host || isPrivateOrLoopbackHost(host)) {
    return null;
  }

  // Khusus docs.google.com, wajib mengarah ke /forms agar tidak disalahgunakan membuka Google Docs/Drive lain
  if (host === 'docs.google.com') {
    return path.startsWith('/forms') ? parsed.toString() : null;
  }

  const isEntryDomain = matchesAllowedDomain(host, ALLOWED_ENTRY_DOMAINS);
  const isGoogleFormPath =
    (host === 'google.com' || host === 'www.google.com') &&
    path.startsWith('/forms');

  return isEntryDomain || isGoogleFormPath ? parsed.toString() : null;
}

/** Memastikan URL tujuan akhir setelah redirect benar-benar formulir ujian yang sah */
export function isAllowedFinalExamUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (!host || isPrivateOrLoopbackHost(host)) {
    return false;
  }

  // Tolak mutlak halaman pencarian umum Google Search
  if (host === 'google.com' || host === 'www.google.com') {
    return path.startsWith('/forms');
  }

  if (host === 'docs.google.com') {
    return path.startsWith('/forms');
  }

  return matchesAllowedDomain(host, ALLOWED_FINAL_EXAM_HOSTS);
}

/** Menambahkan ?embedded=true ke URL Google Forms tanpa merusak parameter pre-fill NIS */
export function toEmbedGoogleFormUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 'docs.google.com' && path.startsWith('/forms')) {
      if (!parsed.searchParams.has('embedded')) {
        parsed.searchParams.set('embedded', 'true');
      }
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/** Mengekstrak judul formulir secara aman dari dokumen HTML Google Forms */
export function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match || !match[1]) return null;

  const decoded = match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const cleaned = decoded
    .replace(/\s*-\s*Google\s+(Forms|Formulir)\s*$/i, '')
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 140) : null;
}
