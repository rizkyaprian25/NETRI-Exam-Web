// Antrean Pelanggaran Offline & Jejak Audit Lokal (Fail-Open Resilience)
// Menyimpan seluruh pelanggaran secara lokal di browser dan mengirim ke webhook opsional dengan Exponential Backoff + Jitter

import type { ViolationEventModel } from '@/contracts/exam';

const STORAGE_KEY = 'netri_offline_violation_queue_v1';
const AUDIT_LOG_KEY = 'netri_recorded_violations_v1';
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8000;
const MAX_JITTER_MS = 200;

export type SendViolationFn = (event: ViolationEventModel) => Promise<boolean>;

function appendAuditHistory(event: ViolationEventModel): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_KEY);
    const list: ViolationEventModel[] = raw ? (JSON.parse(raw) as ViolationEventModel[]) : [];
    const exists = list.some((item) => item.id === event.id);
    if (!exists) {
      list.push(event);
      window.localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(list.slice(-200)));
    }
  } catch {
    // Abaikan jika localStorage penuh
  }
}

async function defaultPostViolation(event: ViolationEventModel): Promise<boolean> {
  appendAuditHistory(event);

  const webhookUrl = process.env.NEXT_PUBLIC_VIOLATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    // Pada mode statis murni GitHub Pages tanpa webhook eksternal, event tercatat aman di audit lokal
    return true;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export class OfflineViolationQueue {
  private queue: ViolationEventModel[] = [];
  private activeFlushPromise: Promise<void> | null = null;
  private sendFn: SendViolationFn;

  constructor(sendFn: SendViolationFn = defaultPostViolation) {
    this.sendFn = sendFn;
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.queue = parsed as ViolationEventModel[];
      }
    } catch {
      this.queue = [];
    }
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Abaikan kegagalan kuota penyimpanan lokal agar ujian tetap berjalan (fail-open)
    }
  }

  public async enqueue(event: ViolationEventModel): Promise<void> {
    this.queue.push(event);
    this.persistToStorage();
    void this.flush();
  }

  public async flush(): Promise<void> {
    // Jika flush sedang berlangsung, tunggu hingga siklus saat ini selesai lalu periksa ulang antrean
    if (this.activeFlushPromise) {
      await this.activeFlushPromise;
      if (this.queue.length === 0) return;
    }

    if (this.queue.length === 0) return;

    this.activeFlushPromise = this.runFlushLoop();
    try {
      await this.activeFlushPromise;
    } finally {
      this.activeFlushPromise = null;
    }
  }

  private async runFlushLoop(): Promise<void> {
    let retryDelayMs = BASE_RETRY_DELAY_MS;

    while (this.queue.length > 0) {
      const current = this.queue[0];
      const ok = await this.sendFn(current);
      if (ok) {
        this.queue.shift();
        this.persistToStorage();
        retryDelayMs = BASE_RETRY_DELAY_MS;
      } else {
        // Terapkan exponential backoff + jitter agar tidak membanjiri server saat sinyal pulih bersamaan
        const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs + jitter));
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
        break;
      }
    }
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
    this.persistToStorage();
  }
}

export const sharedOfflineQueue = new OfflineViolationQueue();
