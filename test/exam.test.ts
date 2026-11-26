// Unit & Integration Tests untuk Kontrak, URL Guard, Split-Screen Ratio,
// EmergencyVerifier, OfflineQueue, & Persistensi Sesi Anti-Refresh

import { describe, expect, it } from 'vitest';
import { EXAM_METRICS, PersistedExamStateSchema } from '@/contracts/exam';
import { EmergencyVerifier } from '@/core/security/emergencyVerifier';
import { OfflineViolationQueue } from '@/core/storage/offlineQueue';
import {
  extractHtmlTitle,
  isAllowedFinalExamUrl,
  toEmbedGoogleFormUrl,
  validateAndNormalizeExamUrl,
} from '@/core/url/examUrl';
import { isWindowHeightUnshrunk, isWindowWidthUnshrunk } from '@/features/lockdown/screenCheck';
import {
  clearPersistedExamState,
  loadPersistedExamState,
  loadPersistedExamStateAsync,
  savePersistedExamState,
} from '@/features/lockdown/sessionPersistence';

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

  it('menambahkan ?embedded=true tanpa menghapus parameter pre-fill NIS dan mengonversi /edit ke /viewform', () => {
    const prefilled =
      'https://docs.google.com/forms/d/e/1FAIpQLScX/viewform?usp=pp_url&entry.123=102938';
    const result = toEmbedGoogleFormUrl(prefilled);
    expect(result).toContain('entry.123=102938');
    expect(result).toContain('embedded=true');

    const editLink = 'https://docs.google.com/forms/d/1AbCdEf/edit';
    expect(toEmbedGoogleFormUrl(editLink)).toBe(
      'https://docs.google.com/forms/d/1AbCdEf/viewform?embedded=true',
    );
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

  it('mendeteksi split-screen horizontal jika lebar jendela menyusut di bawah ambang', () => {
    expect(isWindowWidthUnshrunk(500, 1440)).toBe(false);
    expect(isWindowWidthUnshrunk(360, 720)).toBe(false);
    expect(isWindowWidthUnshrunk(280, 412)).toBe(false);
  });

  it('mendeteksi split-screen vertikal (atas-bawah) khusus perangkat mobile/tablet', () => {
    expect(isWindowHeightUnshrunk(800, 844, 390)).toBe(true);
    expect(isWindowHeightUnshrunk(420, 844, 390)).toBe(false);
    // Layar desktop lebar (> 1024px) tidak terkena false-positive tinggi
    expect(isWindowHeightUnshrunk(720, 1440, 1920)).toBe(true);
  });
});

describe('EmergencyVerifier (Web Crypto SHA-256 & Anti Brute-Force)', () => {
  it('menerima kode pengawas sah dan mengunci 30 detik setelah 5 kali percobaan salah', async () => {
    const verifier = new EmergencyVerifier();
    const clientKey = '127.0.0.1:ses_test_1';
    const baseTime = 1_700_000_000_000;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await verifier.verify('111111', clientKey, baseTime + attempt * 100);
      expect(res.verified).toBe(false);
      expect(res.lockedOut).toBe(false);
      expect(res.remainingAttempts).toBe(5 - attempt);
    }

    const fifth = await verifier.verify('111111', clientKey, baseTime + 500);
    expect(fifth.verified).toBe(false);
    expect(fifth.lockedOut).toBe(true);
    expect(fifth.remainingLockoutSeconds).toBe(30);

    const duringLock = await verifier.verify('202627', clientKey, baseTime + 10_000);
    expect(duringLock.verified).toBe(false);
    expect(duringLock.lockedOut).toBe(true);

    const afterCooldown = await verifier.verify('202627', clientKey, baseTime + 31_000);
    expect(afterCooldown.verified).toBe(true);
    expect(afterCooldown.lockedOut).toBe(false);
  });
});

describe('Persistensi Anti-Refresh & Ambang Hard Lock', () => {
  it('menetapkan ambang Hard Lock tepat pada Strike ke-2 dan cooldown 5 detik', () => {
    expect(EXAM_METRICS.HARD_LOCK_STRIKE_THRESHOLD).toBe(2);
    expect(EXAM_METRICS.STRIKE_COOLDOWN_SECONDS).toBe(5);
    expect(EXAM_METRICS.BRIEF_EXCUSED_SECONDS).toBe(0);
  });

  it('memvalidasi struktur PersistedExamState secara ketat dengan Zod dan aman dipanggil di SSR/Node', async () => {
    const valid = PersistedExamStateSchema.safeParse({
      session: {
        sessionId: 'ses_123',
        rawInputUrl: 'https://forms.gle/abc',
        embedFormUrl: 'https://docs.google.com/forms/d/e/1/viewform?embedded=true',
        examTitle: 'Ujian Google Form',
        subject: 'Ujian Google Form',
        className: 'Aplikasi PWA (Terkunci)',
        startedAt: new Date().toISOString(),
        requiresFullscreen: false,
        isPwaStandalone: true,
      },
      strikeCount: 2,
      totalAwaySeconds: 7,
      isHardLocked: true,
      lastLockReason: 'Halaman ujian ditinggalkan selama 4 detik!',
      violationLogs: [
        {
          id: 'evt_1',
          type: 'app_exit',
          timestamp: new Date().toISOString(),
          durationSeconds: 4,
          notes: 'Halaman ujian ditinggalkan selama 4 detik!',
        },
      ],
    });
    expect(valid.success).toBe(true);

    // Pastikan helper storage aman dipanggil di environment Node tanpa window
    savePersistedExamState(valid.data!);
    expect(loadPersistedExamState()).toBeNull();
    expect(await loadPersistedExamStateAsync()).toBeNull();
    clearPersistedExamState();
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
