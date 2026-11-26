'use client';

// Halaman Simulasi Google Form Lokal (hanya dipakai untuk uji E2E Playwright offline tanpa internet luar)

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function MockFormContent() {
  const searchParams = useSearchParams();
  const isSubmitted = searchParams.get('submitted') === '1';

  if (isSubmitted) {
    return (
      <main className="min-h-dvh bg-white p-6 text-slate-900">
        <div className="mx-auto max-w-lg rounded-lg border border-slate-200 p-6">
          <h1 className="text-xl font-bold">Jawaban Anda telah direkam</h1>
          <p className="mt-2 text-sm text-slate-600">
            Terima kasih telah mengikuti Ujian Simulasi NETRI Exam.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-white p-6 text-slate-900">
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 p-6">
        <h1 className="text-xl font-bold">Ujian Simulasi Google Form</h1>
        <p className="mt-2 text-sm text-slate-600">
          Soal 1: Berapakah hasil dari 12 + 8?
        </p>
        <input
          type="text"
          aria-label="Jawaban Soal 1"
          placeholder="Ketik jawaban di sini..."
          className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <a
          href="/mock-form?submitted=1"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Kirim Jawaban
        </a>
      </div>
    </main>
  );
}

export default function MockFormPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Memuat...</div>}>
      <MockFormContent />
    </Suspense>
  );
}
