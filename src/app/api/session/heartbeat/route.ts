// Route Handler: Pemeriksaan Konektivitas Nyata & Heartbeat Sesi Ujian

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorJson, okJson } from '@/core/network/apiResponse';

const HeartbeatSchema = z.object({
  sessionId: z.string().min(1).max(120),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  isFullscreen: z.boolean().optional(),
});

export async function GET() {
  return okJson({
    status: 'connected',
    serverTime: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('INVALID_JSON', 'Format heartbeat tidak valid.', 400);
  }

  const parsed = HeartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson('INVALID_HEARTBEAT', 'Payload heartbeat tidak valid.', 400);
  }

  return okJson({
    status: 'connected',
    sessionId: parsed.data.sessionId,
    serverTime: new Date().toISOString(),
  });
}
