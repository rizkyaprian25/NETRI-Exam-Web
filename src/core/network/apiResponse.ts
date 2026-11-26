// Helper pembentuk respon API terstandar sesuai kontrak SSOT

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/contracts/exam';

export function okJson<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorJson<T = never>(
  code: string,
  message: string,
  status: number,
  retryable = false,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        retryable,
        requestId: `req_${crypto.randomUUID().slice(0, 8)}`,
      },
    },
    { status },
  );
}
