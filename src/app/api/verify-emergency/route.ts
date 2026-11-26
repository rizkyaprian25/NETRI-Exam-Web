// Route Handler: Verifikasi Kode Keluar Darurat Pengawas (Server-Side Anti Brute-Force)

import { NextRequest } from 'next/server';
import { VerifyEmergencyRequestSchema, type VerifyEmergencyData } from '@/contracts/exam';
import { errorJson, okJson } from '@/core/network/apiResponse';
import { sharedEmergencyVerifier } from '@/core/security/emergencyVerifier';

function resolveClientKey(request: NextRequest, sessionId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return sessionId ? `${forwarded}:${sessionId}` : forwarded;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('INVALID_JSON', 'Format permintaan tidak valid.', 400);
  }

  const parsed = VerifyEmergencyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(
      'INVALID_PASSCODE_FORMAT',
      parsed.error.issues[0]?.message || 'Kode darurat harus tepat 6 digit angka.',
      400,
    );
  }

  const clientKey = resolveClientKey(request, parsed.data.sessionId);
  const result = sharedEmergencyVerifier.verify(parsed.data.passcode, clientKey);

  const payload: VerifyEmergencyData = {
    verified: result.verified,
    lockedOut: result.lockedOut,
    remainingAttempts: result.remainingAttempts,
    remainingLockoutSeconds: result.remainingLockoutSeconds,
  };

  if (result.lockedOut) {
    return okJson(payload, 429);
  }

  if (!result.verified) {
    return okJson(payload, 401);
  }

  return okJson(payload, 200);
}
