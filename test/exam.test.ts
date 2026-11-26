// Unit & Integration Tests untuk Kontrak, URL Guard, Split-Screen Ratio, EmergencyVerifier, & OfflineQueue

import { describe, expect, it } from 'vitest';
import { EmergencyVerifier } from '@/core/security/emergencyVerifier';
import { OfflineViolationQueue } from '@/core/storage/offlineQueue';
import {
  extractHtmlTitle,
  isAllowedFinalExamUrl,
  toEmbedGoogleFormUrl,
  validateAndNormalizeExamUrl,
} from '@/core/url/examUrl';
import { isWindowWidthUnshrunk } from '@/features/lockdown/screenCheck';

describe('Validasi & Normalisasi Tautan Ujian', () => {
  it('menerima tautan pendek s.id tanpa skema https dan menambahkannya otomatis', () => {
    expect(validateAndNormalizeExamUrl('s.id/ujian7')).toBe('https://s.id/ujian7');
    expect(validateAndNormalizeExamUrl('forms.gle/sample123')).toBe(
      'https://forms.gle/sample123',
    );
  });

  it('menolak situs di luar whitelist, Google Docs non-form, dan IP lokal SSRF', () => {
    expect(validateAndNormalizeExamUrl('https://youtube.com/watch?v=123')).toBeNull();
    expect(validateAndNormalizeExamUrl('https://docs.google.com/document/d/123')).toBeNull();
    expect(validateAndNormalizeExamUrl('http://127.0.0.1:3000/admin')).toBeNull();
    expect(validateAndNormalizeExamUrl('http://localhost/forms')).toBeNull();
  });

  it('memvalidasi URL tujuan akhir redirect dengan ketat', () => {
    expect(
      isAllowedFinalExamUrl('https://docs.google.com/forms/d/e/1FAIpQLScX/viewform'),
    ).toBe(true);
    expect(isAllowedFinalExamUrl('https://www.google.com/search?q=jawaban')).toBe(false);
    expect(isAllowedFinalExamUrl('https://chatgpt.com')).toBe(false);
  });

  it('menambahkan ?embedded=true tanpa menghapus parameter pre-fill NIS', () => {
    const prefilled =
      'https://docs.google.com/forms/d/e/1FAIpQLScX/viewform?usp=pp_url&entry.123=102938';
    const result = toEmbedGoogleFormUrl(prefilled);
    expect(result).toContain('entry.123=102938');
    expect(result).toContain('embedded=true');
  });

  it('mengekstrak judul formulir bersih dari HTML Google Form', () => {
    const html = '<html><head><title>PAS Matematika XII - Google Forms</title></head></html>';
    expect(extractHtmlTitle(html)).toBe('PAS Matematika XII');
  });
});

describe('Deteksi Split-Screen / Floating Window (Ambang 88% Mobile / 45% Desktop)', () => {
  it('menganggap layar bersih jika lebar jendela normal atau >= ambang', () => {
    expect(isWindowWidthUnshrunk(1440, 1440)).toBe(true);
    expect(isWindowWidthUnshrunk(1280, 1920)).toBe(true);
    expect(isWindowWidthUnshrunk(390, 412)).toBe(true);
  });

  it('mendeteksi split-screen jika lebar jendela menyusut di bawah ambang', () => {
    expect(isWindowWidthUnshrunk(500, 1440)).toBe(false);
    expect(isWindowWidthUnshrunk(360, 720)).toBe(false);
    expect(isWindowWidthUnshrunk(280, 412)).toBe(false);
  });
});

describe('EmergencyVerifier (Constant-Time SHA-256 & Anti Brute-Force)', () => {
  it('menerima kode 202627 dan mengunci 30 detik setelah 5 kali percobaan salah', () => {
    const verifier = new EmergencyVerifier();
    const clientKey = '127.0.0.1:ses_test_1';
    const baseTime = 1_700_000_000_000;

    // 4 kali salah pertama mengembalikan sisa percobaan 4 -> 1
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = verifier.verify('111111', clientKey, baseTime + attempt * 100);
      expect(res.verified).toBe(false);
      expect(res.lockedOut).toBe(false);
      expect(res.remainingAttempts).toBe(5 - attempt);
    }

    // Kesalahan ke-5 langsung memicu lockout 30 detik
    const fifth = verifier.verify('111111', clientKey, baseTime + 500);
    expect(fifth.verified).toBe(false);
    expect(fifth.lockedOut).toBe(true);
    expect(fifth.remainingLockoutSeconds).toBe(30);

    // Selama lockout 30 detik, bahkan kode benar ditolak sampai cooldown habis
    const duringLock = verifier.verify('202627', clientKey, baseTime + 10_000);
    expect(duringLock.verified).toBe(false);
    expect(duringLock.lockedOut).toBe(true);

    // Setelah 31 detik, kode 202627 berhasil diverifikasi
    const afterCooldown = verifier.verify('202627', clientKey, baseTime + 31_000);
    expect(afterCooldown.verified).toBe(true);
    expect(afterCooldown.lockedOut).toBe(false);
  });
});

describe('OfflineViolationQueue', () => {
  it('menyimpan antrean saat gagal kirim lalu mengirim ulang ketika koneksi pulih', async () => {
    let isOnline = false;
    const deliveredIds: string[] = [];

    const queue = new OfflineViolationQueue(async (event) => {
      if (!isOnline) return false;
      deliveredIds.push(event.id);
      return true;
    });

    await queue.enqueue({
      id: 'evt_offline_1',
      sessionId: 'ses_1',
      type: 'app_exit',
      severity: 'warning',
      clientTimestamp: new Date().toISOString(),
      isExcused: false,
    });

    expect(queue.pendingCount).toBe(1);

    isOnline = true;
    await queue.flush();

    expect(queue.pendingCount).toBe(0);
    expect(deliveredIds).toEqual(['evt_offline_1']);
  });
});
