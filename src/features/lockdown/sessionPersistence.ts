// Dual-Persistence Sesi Ujian & Status Hard Lock (localStorage + IndexedDB Mirror)
// Mencegah siswa mereset catatan Strike atau Hard Lock hanya dengan menghapus data situs ringan / localStorage

import { PersistedExamStateSchema, type PersistedExamState } from '@/contracts/exam';

const PERSISTED_SESSION_KEY = 'netri_active_exam_state_v2';
const IDB_NAME = 'netri_exam_mirror_db';
const IDB_STORE = 'exam_state';
const IDB_KEY = 'active_session_v2';

function openMirrorDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIndexedDbMirror(state: PersistedExamState): Promise<void> {
  const db = await openMirrorDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function readIndexedDbMirror(): Promise<PersistedExamState | null> {
  const db = await openMirrorDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        const validated = PersistedExamStateSchema.safeParse(req.result);
        resolve(validated.success ? validated.data : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function deleteIndexedDbMirror(): Promise<void> {
  const db = await openMirrorDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Menyimpan status sesi ujian dan riwayat pelanggaran ke localStorage dan mirror IndexedDB */
export function savePersistedExamState(state: PersistedExamState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Abaikan jika penyimpanan lokal dibatasi oleh mode privat browser
  }
  void writeIndexedDbMirror(state);
}

/** Membaca status sesi aktif secara sinkron dari localStorage dengan validasi Zod */
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

/**
 * Memulihkan status sesi aktif dengan Dual-Persistence:
 * bila localStorage kosong/dihapus siswa, otomatis pulihkan dari IndexedDB lalu sinkronkan kembali.
 */
export async function loadPersistedExamStateAsync(): Promise<PersistedExamState | null> {
  const local = loadPersistedExamState();
  if (local) {
    void writeIndexedDbMirror(local);
    return local;
  }

  const mirror = await readIndexedDbMirror();
  if (mirror && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(mirror));
    } catch {
      // Abaikan
    }
    return mirror;
  }

  return null;
}

/** Menghapus state sesi aktif secara bersih di kedua penyimpanan saat ujian selesai atau keluar darurat */
export function clearPersistedExamState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PERSISTED_SESSION_KEY);
  } catch {
    // Abaikan
  }
  void deleteIndexedDbMirror();
}
