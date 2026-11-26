// Route Handler: Pencatatan Kejadian Pelanggaran Idempoten dengan Logging Terstruktur

import { NextRequest } from 'next/server';
import { ViolationEventSchema } from '@/contracts/exam';
import { errorJson, okJson } from '@/core/network/apiResponse';

// Cache deduplikasi ringan agar pengiriman ulang dari offline queue bersifat idempoten
const processedEventIds = new Set<string>();
const MAX_TRACKED_EVENTS = 5000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('INVALID_JSON', 'Format payload pelanggaran tidak valid.', 400);
  }

  const parsed = ViolationEventSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson('INVALID_VIOLATION_EVENT', 'Data kejadian pelanggaran tidak lengkap.', 400);
  }

  const event = parsed.data;
  const serverTimestamp = new Date().toISOString();
  const isDuplicate = processedEventIds.has(event.id);

  if (!isDuplicate) {
    if (processedEventIds.size >= MAX_TRACKED_EVENTS) {
      processedEventIds.clear();
    }
    processedEventIds.add(event.id);

    // Log audit terstruktur JSON tanpa membocorkan informasi sensitif
    console.info(
      JSON.stringify({
        ts: serverTimestamp,
        level: 'INFO',
        module: 'SECURITY_VIOLATION',
        eventId: event.id,
        sessionId: event.sessionId,
        type: event.type,
        severity: event.severity,
        isExcused: event.isExcused,
        durationSeconds: event.durationSeconds ?? 0,
      }),
    );
  }

  return okJson({
    accepted: true,
    duplicate: isDuplicate,
    serverTimestamp,
  });
}
