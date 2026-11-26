// Verifikator Passcode Darurat Pengawas (SHA-256 Waktu Konstan & Anti Brute-Force)
// Mereplikasi logika EmergencyExitGuard dari versi mobile secara aman di sisi server

import crypto from 'node:crypto';
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

export class EmergencyVerifier {
  private readonly buckets = new Map<string, AttemptBucket>();

  private getSalt(): string {
    return process.env.PROCTOR_HASH_SALT || 'netri_exam_emergency_v1:';
  }

  private getExpectedDigest(): Buffer {
    const rawCode = (process.env.PROCTOR_EMERGENCY_CODE || '202627').trim();
    const salt = this.getSalt();
    return crypto.createHash('sha256').update(`${salt}${rawCode}`).digest();
  }

  private getOrCreateBucket(clientKey: string): AttemptBucket {
    const existing = this.buckets.get(clientKey);
    if (existing) return existing;
    const created: AttemptBucket = { failedAttempts: 0, lockedUntilMs: null };
    this.buckets.set(clientKey, created);
    return created;
  }

  /** Memeriksa status lockout aktif dan sisa waktu tunggu dalam detik */
  public getLockoutStatus(clientKey: string, nowMs = Date.now()): {
    lockedOut: boolean;
    remainingLockoutSeconds: number;
    remainingAttempts: number;
  } {
    const bucket = this.getOrCreateBucket(clientKey);
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
    }

    return {
      lockedOut: false,
      remainingLockoutSeconds: 0,
      remainingAttempts: Math.max(0, EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - bucket.failedAttempts),
    };
  }

  /** Memverifikasi 6 digit passcode pengawas dengan proteksi timing-safe dan rate limit 5x salah -> 30 detik */
  public verify(passcode: string, clientKey: string, nowMs = Date.now()): EmergencyCheckResult {
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
    const bucket = this.getOrCreateBucket(clientKey);

    if (!cleaned) {
      return {
        verified: false,
        lockedOut: false,
        remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - bucket.failedAttempts,
        remainingLockoutSeconds: 0,
      };
    }

    const salt = this.getSalt();
    const inputDigest = crypto.createHash('sha256').update(`${salt}${cleaned}`).digest();
    const expectedDigest = this.getExpectedDigest();

    const isMatch =
      inputDigest.length === expectedDigest.length &&
      crypto.timingSafeEqual(inputDigest, expectedDigest);

    if (isMatch) {
      bucket.failedAttempts = 0;
      bucket.lockedUntilMs = null;
      return {
        verified: true,
        lockedOut: false,
        remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS,
        remainingLockoutSeconds: 0,
      };
    }

    bucket.failedAttempts += 1;
    if (bucket.failedAttempts >= EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS) {
      bucket.lockedUntilMs = nowMs + EXAM_METRICS.EMERGENCY_LOCKOUT_SECONDS * 1000;
      bucket.failedAttempts = 0;
      return {
        verified: false,
        lockedOut: true,
        remainingAttempts: 0,
        remainingLockoutSeconds: EXAM_METRICS.EMERGENCY_LOCKOUT_SECONDS,
      };
    }

    return {
      verified: false,
      lockedOut: false,
      remainingAttempts: EXAM_METRICS.MAX_EMERGENCY_ATTEMPTS - bucket.failedAttempts,
      remainingLockoutSeconds: 0,
    };
  }

  /** Mereset bucket percobaan (khusus pengujian unit) */
  public resetAll(): void {
    this.buckets.clear();
  }
}

export const sharedEmergencyVerifier = new EmergencyVerifier();
