// Route Handler: Penelusur Tautan Pendek & Validasi Google Form (SSRF-Safe)
// Membuka shortlink s.id / forms.gle di sisi server, memvalidasi domain akhir, dan mengekstrak judul Form

import { NextRequest } from 'next/server';
import {
  EXAM_METRICS,
  ResolveFormRequestSchema,
  type ResolveFormData,
} from '@/contracts/exam';
import { errorJson, okJson } from '@/core/network/apiResponse';
import {
  extractHtmlTitle,
  isAllowedFinalExamUrl,
  toEmbedGoogleFormUrl,
  validateAndNormalizeExamUrl,
} from '@/core/url/examUrl';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('INVALID_JSON', 'Format permintaan tidak valid.', 400);
  }

  const parsed = ResolveFormRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(
      'INVALID_EXAM_URL',
      'Harap tempel tautan form atau pindai QR Code ujian.',
      400,
    );
  }

  const normalizedInput = validateAndNormalizeExamUrl(parsed.data.url);
  if (!normalizedInput) {
    return errorJson(
      'INVALID_EXAM_DOMAIN',
      'Tautan harus berupa Google Forms (forms.gle) atau tautan pendek (s.id, gg.gg).',
      400,
    );
  }

  const timeoutMs = Number(process.env.UPSTREAM_RESOLVE_TIMEOUT_MS || 8000);
  let currentUrl = normalizedInput;
  let htmlSnippet = '';

  try {
    // Telusuri redirect secara manual per hop agar setiap tujuan redirect lolos validasi anti-SSRF
    for (let hop = 0; hop < EXAM_METRICS.MAX_REDIRECT_HOPS; hop += 1) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        const nextUrl = new URL(location, currentUrl).toString();
        const safeNext = validateAndNormalizeExamUrl(nextUrl) ?? (isAllowedFinalExamUrl(nextUrl) ? nextUrl : null);
        if (!safeNext) {
          return errorJson(
            'EXTERNAL_TARGET_BLOCKED',
            'Tautan pendek mengarah ke situs di luar Google Forms dan diblokir demi keamanan ujian.',
            400,
          );
        }
        currentUrl = safeNext;
        continue;
      }

      if (!response.ok && response.status >= 500) {
        return errorJson(
          'UPSTREAM_UNAVAILABLE',
          'Server formulir atau jaringan sedang bermasalah. Silakan coba lagi.',
          503,
          true,
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        // Baca secukupnya saja untuk mengambil tag <title> tanpa membebani memori server
        const rawText = await response.text();
        htmlSnippet = rawText.slice(0, 16384);
      }
      break;
    }
  } catch {
    return errorJson(
      'HOTSPOT_OFFLINE',
      'Koneksi internet tidak terdeteksi pada Hotspot/Wi-Fi Anda! Pastikan Hotspot memiliki kuota aktif dan tidak terhalang halaman login operator sebelum memulai ujian.',
      503,
      true,
    );
  }

  if (!isAllowedFinalExamUrl(currentUrl)) {
    return errorJson(
      'EXTERNAL_TARGET_BLOCKED',
      'Tautan tujuan akhir bukan halaman Google Forms yang sah.',
      400,
    );
  }

  const embedUrl = toEmbedGoogleFormUrl(currentUrl);
  const examTitle = extractHtmlTitle(htmlSnippet) || 'Ujian Google Form';

  const payload: ResolveFormData = {
    normalizedUrl: currentUrl,
    embedUrl,
    examTitle,
  };

  return okJson(payload, 200);
}
