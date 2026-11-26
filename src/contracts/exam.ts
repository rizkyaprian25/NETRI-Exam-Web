// Single Source of Truth (SSOT) Kontrak Data & Konstanta NETRI Exam Web
// Selaras dengan spesifikasi contracts/models.dart dan contracts/types.ts versi mobile

import { z } from 'zod';

/** Daftar domain masuk yang sah untuk formulir Google Forms dan pemendek tautan */
export const ALLOWED_ENTRY_DOMAINS = [
  'docs.google.com',
  'forms.google.com',
  'forms.gle',
  's.id',
  'gg.gg',
  'bit.ly',
  'rizkyaprian25.github.io',
] as const;

/** Daftar domain tujuan akhir yang diizinkan setelah penelusuran redirect shortlink */
export const ALLOWED_FINAL_EXAM_HOSTS = [
  'docs.google.com',
  'forms.google.com',
  'forms.gle',
  'rizkyaprian25.github.io',
] as const;

/** Konstanta metrik ujian & ambang batas keamanan terpusat (anti magic numbers) */
export const EXAM_METRICS = {
  EXAM_BAR_HEIGHT_PX: 52,
  MIN_TOUCH_TARGET_PX: 44,
  SIREN_DURATION_MS: 15000,
  WATCHDOG_TIMEOUT_MS: 15000,
  HEARTBEAT_INTERVAL_MS: 20000,
  STARTUP_GRACE_MS: 5000,
  BRIEF_EXCUSED_SECONDS: 3,
  MIN_SCREEN_WIDTH_RATIO: 0.88,
  MAX_EMERGENCY_ATTEMPTS: 5,
  EMERGENCY_LOCKOUT_SECONDS: 30,
  MAX_REDIRECT_HOPS: 6,
} as const;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export const ViolationTypeSchema = z.enum([
  'app_exit',
  'screenshot_attempt',
  'split_screen',
  'fullscreen_exit',
  'external_navigation',
  'back_button',
]);

export type ViolationType = z.infer<typeof ViolationTypeSchema>;

export const ViolationSeveritySchema = z.enum(['info', 'warning', 'danger']);
export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

export const ViolationEventSchema = z.object({
  id: z.string().min(1).max(120),
  sessionId: z.string().min(1).max(120),
  type: ViolationTypeSchema,
  severity: ViolationSeveritySchema,
  clientTimestamp: z.string().min(1),
  serverTimestamp: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  isExcused: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export type ViolationEventModel = z.infer<typeof ViolationEventSchema>;

export const ActiveExamSessionSchema = z.object({
  sessionId: z.string().min(1),
  rawInputUrl: z.string().url(),
  embedFormUrl: z.string().url(),
  examTitle: z.string().min(1),
  subject: z.string().min(1),
  className: z.string().min(1),
  startedAt: z.string().min(1),
  requiresFullscreen: z.boolean(),
});

export type ActiveExamSession = z.infer<typeof ActiveExamSessionSchema>;

export const ResolveFormRequestSchema = z.object({
  url: z.string().trim().min(1, 'Tautan formulir tidak boleh kosong.').max(2048),
});

export const ResolveFormDataSchema = z.object({
  normalizedUrl: z.string().url(),
  embedUrl: z.string().url(),
  examTitle: z.string().min(1),
});

export type ResolveFormData = z.infer<typeof ResolveFormDataSchema>;

export const VerifyEmergencyRequestSchema = z.object({
  passcode: z.string().trim().regex(/^\d{6}$/, 'Kode darurat harus tepat 6 digit angka.'),
  sessionId: z.string().trim().max(120).optional(),
});

export const VerifyEmergencyDataSchema = z.object({
  verified: z.boolean(),
  lockedOut: z.boolean(),
  remainingAttempts: z.number().int().min(0),
  remainingLockoutSeconds: z.number().int().min(0),
});

export type VerifyEmergencyData = z.infer<typeof VerifyEmergencyDataSchema>;

/** Amplop respon standar API (Contract-First) */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
}
