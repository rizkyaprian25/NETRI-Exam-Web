// Persistensi Sesi Ujian & Status Hard Lock di localStorage (Anti-Refresh Bypass)
// Mencegah siswa menghapus catatan Strike atau melepas kunci pengawas dengan menekan Refresh (F5)

import { PersistedExamStateSchema, type PersistedExamState } from '@/contracts/exam';

const PERSISTED_SESSION_KEY = 'netri_active_exam_state_v2';

/** Menyimpan status sesi ujian dan riwayat pelanggaran ke localStorage */
export function savePersistedExamState(state: PersistedExamState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Abaikan jika penyimpanan lokal dibatasi oleh mode privat browser
  }
}

/** Membaca status sesi aktif dengan validasi skema Zod dan self-healing jika data rusak */
export function loadPersistedExamState(): PersistedExamState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERSISTED_SESSION_KEY);
    if (!raw) return null;

    const parsedJson: unknown = JSON.parse(raw);
    const validated = PersistedExamStateSchema.safeParse(parsedJson);
    if (!validated.success) {
      window.localStorage.removeItem(PERSISTED_SESSION_KEY);
      return null;
    }

    return validated.data;
  } catch {
    try {
      window.localStorage.removeItem(PERSISTED_SESSION_KEY);
    } catch {
      // Abaikan
    }
    return null;
  }
}

/** Menghapus state sesi aktif secara bersih saat ujian selesai atau keluar darurat oleh pengawas */
export function clearPersistedExamState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PERSISTED_SESSION_KEY);
  } catch {
    // Abaikan
  }
}
