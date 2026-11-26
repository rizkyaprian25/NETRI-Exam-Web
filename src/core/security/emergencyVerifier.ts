// Verifikator Passcode Darurat Pengawas (Universal Web Crypto SHA-256 Waktu Konstan & Anti Brute-Force)
// Mereplikasi logika EmergencyExitGuard dari versi mobile secara aman untuk hosting statis (GitHub Pages)

import { EXAM_METRICS } from '@/contracts/exam';

interface AttemptBucket {
  failedAttempts: number;
  lockedUntilMs: number | null;
}

export interface EmergencyCheckResult {
  verified: boolean;
  lockedOut: boolean;
  remainingAttempts: number;
  remainingLockoutSeconds: number;
}

const GUARD_STORAGE_KEY = 'netri_emergency_guard_v1';
const DEFAULT_SALT = 'netri_exam_emergency_v1:';
// Hash SHA-256 tersalt identik dengan emergency_exit_guard.dart (tanpa menyimpan kode polos di bundle client)
const DEFAULT_SALTED_HASH =
  '8b0c4cfa9539ac6475347744dbcbc3bc9a18c382ee2adeeabd163fbc94494e04';

/** Menghitung digest SHA-256 heksadesimal menggunakan Web Crypto API standar browser & Node */
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digestBuffer);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Membandingkan dua string hex dalam waktu konstan untuk mencegah timing side-channel */
function constantTimeHexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export class EmergencyVerifier {
  private readonly memoryBuckets = new Map<string, AttemptBucket>();

  private getSalt(): string {
    return DEFAULT_SALT;
  }

  private getExpectedSaltedHash(): string {
    return (
      process.env.NEXT_PUBLIC_PROCTOR_SALTED_HASH?.trim().toLowerCase() ||
      DEFAULT_SALTED_HASH
    );
  }

  private readStorageMap(): Record<string, AttemptBucket> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(GUARD_STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, AttemptBucket>)
        : {};
    } catch {
      return {};
    }
  }

  private writeStorageMap(map: Record<string, AttemptBucket>): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Abaikan jika penyimpanan lokal dibatasi oleh browser
    }
  }

  private getBucket(clientKey: string): AttemptBucket {
    if (typeof window !== 'undefined') {
      const map = this.readStorageMap();
      if (map[clientKey]) return map[clientKey];
    }
    return this.memoryBuckets.get(clientKey) ?? { failedAttempts: 0, lockedUntilMs: null };
  }

  private saveBucket(clientKey: string, bucket: AttemptBucket): void {
    this.memoryBuckets.set(clientKey, bucket);
    if (typeof window !== 'undefined') {
      const map = this.readStorageMap();
      map[clientKey] = bucket;
      this.writeStorageMap(map);
    }
  }

  /** Memeriksa status lockout aktif dan sisa waktu tunggu dalam detik */
  public getLockoutStatus(
    clientKey = 'default',
    nowMs = Date.now(),
  ): {
    lockedOut: boolean;
    remainingLockoutSeconds: number;
    remainingAttempts: number;
  } {
    const bucket = this.getBucket(clientKey);
    if (bucket.lockedUntilMs !== null && nowMs < bucket.lockedUntilMs) {
      const diffSec = Math.ceil((bucket.lockedUntilMs - nowMs) / 1000);
      return {
        lockedOut: true,
        remainingLockoutSeconds: Math.max(1, diffSec),
        remainingAttempts: 0,
      };
    }

    if (bucket.lockedUntilMs !== null && nowMs >= bucket.lockedUntilMs) {
      bucket.lockedUntilMs = null;
      bucket.failedAttempts = 0;
      this.saveBucket(clientKey, bucket);
    }

    return {
      lockedOut: false,
      remainingLockoutSeconds: 0,
      remainingAttempts: Math.max(
        0,
        EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - bucket.failedAttempts,
      ),
    };
  }

  /** Memverifikasi 6 digit passcode pengawas secara waktu konstan dengan batas 5x salah -> kunci 30 detik */
  public async verify(
    passcode: string,
    clientKey = 'default',
    nowMs = Date.now(),
  ): Promise<EmergencyCheckResult> {
    const status = this.getLockoutStatus(clientKey, nowMs);
    if (status.lockedOut) {
      return {
        verified: false,
        lockedOut: true,
        remainingAttempts: 0,
        remainingLockoutSeconds: status.remainingLockoutSeconds,
      };
    }

    const cleaned = passcode.trim();
    const bucket = this.getBucket(clientKey);

    if (!cleaned) {
      return {
        verified: false,
        lockedOut: false,
        remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - bucket.failedAttempts,
        remainingLockoutSeconds: 0,
      };
    }

    const inputHex = await sha256Hex(`${this.getSalt()}${cleaned}`);
    const expectedHex = this.getExpectedSaltedHash();

    if (constantTimeHexEquals(inputHex, expectedHex)) {
      this.saveBucket(clientKey, { failedAttempts: 0, lockedUntilMs: null });
      return {
        verified: true,
        lockedOut: false,
        remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS,
        remainingLockoutSeconds: 0,
      };
    }

    const nextFailed = bucket.failedAttempts + 1;
    if (nextFailed >= EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS) {
      const lockedUntilMs = nowMs + EXAM_METRICS.EMERGENCY_LOCKOUT_SECONDS * 1000;
      this.saveBucket(clientKey, { failedAttempts: 0, lockedUntilMs });
      return {
        verified: false,
        lockedOut: true,
        remainingAttempts: 0,
        remainingLockoutSeconds: EXAM_METRICS.EMERGENCY_LOCKOUT_SECONDS,
      };
    }

    this.saveBucket(clientKey, { failedAttempts: nextFailed, lockedUntilMs: null });
    return {
      verified: false,
      lockedOut: false,
      remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - nextFailed,
      remainingLockoutSeconds: 0,
    };
  }

  /** Mereset bucket percobaan (khusus pengujian unit) */
  public resetAll(): void {
    this.memoryBuckets.clear();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(GUARD_STORAGE_KEY);
      } catch {
        // Abaikan
      }
    }
  }
}

export const sharedEmergencyVerifier = new EmergencyVerifier();
