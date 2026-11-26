// Test End-to-End (E2E) Browser Playwright untuk NETRI Exam Web App
// Memverifikasi paritas 1:1 terhadap test/e2e_exam_flow_test.dart dan inspeksi 3 viewport tanpa horizontal scroll leak

import { expect, test, type Page } from '@playwright/test';

async function mockResolveToLocalForm(page: Page) {
  await page.route('**/api/resolve-form', async (route) => {
    const requestBody = route.request().postDataJSON() as { url?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          normalizedUrl: requestBody.url || 'https://forms.gle/sampleExamNetri123',
          embedUrl: '/mock-form',
          examTitle: 'Penilaian Akhir Semester - Matematika XII',
        },
      }),
    });
  });
}

test.describe('Alur Lengkap E2E NETRI Exam Web (Paritas 1:1 Mobile)', () => {
  test('Skenario Utama: Validasi Domain -> Masuk Ujian -> Klik Iframe Aman -> Back Terblokir -> Pindah Tab -> Kirim Form -> Bukti Resmi', async ({
    page,
  }) => {
    await mockResolveToLocalForm(page);
    await page.goto('/');

    // 1. Validasi Input Kosong
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(
      page.getByText('Harap tempel tautan form atau pindai QR Code ujian.'),
    ).toBeVisible();

    // 2. Validasi Domain Terlarang (YouTube)
    const urlInput = page.getByLabel('Tautan Formulir Ujian');
    await urlInput.fill('https://youtube.com/video');
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(
      page.getByText(
        'Tautan harus berupa Google Forms (forms.gle) atau tautan pendek (s.id, gg.gg).',
      ),
    ).toBeVisible();

    // 3. Masukkan tautan pendek s.id tanpa https://
    await urlInput.fill('s.id/ujian7');
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();

    // 4. Verifikasi Bottom Sheet Konfirmasi Mode Ujian Ketat
    await expect(page.getByText('Mode Ujian Ketat (Anti-Curang)')).toBeVisible();
    await page.getByRole('button', { name: 'Saya Siap & Mulai Mengerjakan' }).click();

    // 5. Verifikasi masuk ke ExamSessionView dan ExamBar tampil
    await expect(page.getByText('Exam NETRI (Terkunci)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Selesai Ujian' })).toHaveCount(0);

    // Pastikan iframe soal benar-benar termuat dan mengetik di dalam iframe TIDAK memicu false-positive pelanggaran
    const formFrame = page.frameLocator('iframe');
    await formFrame.getByLabel('Jawaban Soal 1').fill('20');
    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toHaveCount(0);

    // 6. Uji Tombol Back Browser: harus tertahan dan memicu dialog Dilarang Keluar! + Sirine 15 detik
    await page.goBack();
    await expect(page.getByText('Dilarang Keluar!')).toBeVisible();
    await expect(
      page.getByText('Sirine peringatan aktif berbunyi keras selama 15 detik!'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Lanjut Mengerjakan Ujian' }).click();
    await expect(page.getByText('Dilarang Keluar!')).toHaveCount(0);

    // 7. Lewati masa tenggang startup 5 detik, lalu simulasikan pindah tab / window blur
    await page.waitForTimeout(5300);
    await page.evaluate(() => {
      // Simulasikan halaman tersembunyi selama 4 detik lalu kembali aktif
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(4100);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toBeVisible();
    await page.getByRole('button', { name: 'Saya Mengerti, Kembali ke Ujian' }).click();
    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toHaveCount(0);

    // 8. Klik Kirim Jawaban di dalam iframe -> tombol Selesai Ujian muncul -> Konfirmasi -> ResultView
    await formFrame.getByRole('link', { name: 'Kirim Jawaban' }).click();
    await expect(formFrame.getByText('Jawaban Anda telah direkam')).toBeVisible();
    await page.getByRole('button', { name: 'Selesai Ujian' }).click();
    await page.getByRole('button', { name: 'Ya, Saya Sudah Kirim' }).click();

    await expect(page.getByText('Sesi Ujian Selesai')).toBeVisible();
    await expect(page.getByText('BUKTI RESMI SELESAI')).toBeVisible();
    await expect(page.getByText('Penilaian Akhir Semester - Matematika XII')).toBeVisible();

    // Kembali ke beranda bersih
    await page.getByRole('button', { name: 'Kembali ke Beranda' }).click();
    await expect(page.getByText('Aplikasi Ujian Aman (Anti-Curang)')).toBeVisible();
  });

  test('Skenario 4 Gerbang Anti-Split-Screen & Keluar Darurat Pengawas (202627)', async ({
    page,
  }) => {
    await mockResolveToLocalForm(page);
    await page.goto('/');

    // Gerbang 1 & 2: Paksa status split-screen aktif lewat hook uji
    await page.evaluate(() => {
      window.__NETRI_TEST_SCREEN_CLEAR__ = false;
    });
    await page.getByLabel('Tautan Formulir Ujian').fill('https://forms.gle/splitTest123');
    await expect(page.getByText(/mode Split-Screen aktif di layar/i)).toBeVisible();

    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(page.getByText('Mode Ujian Ketat (Anti-Curang)')).toHaveCount(0);

    // Pulihkan kebersihan layar lalu masuk ujian
    await page.evaluate(() => {
      window.__NETRI_TEST_SCREEN_CLEAR__ = true;
    });
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await page.getByRole('button', { name: 'Saya Siap & Mulai Mengerjakan' }).click();
    await expect(page.getByText('Exam NETRI (Terkunci)')).toBeVisible();

    // Buka dialog Keluar Darurat (Pengawas)
    await page.getByRole('button', { name: 'Keluar Darurat (Pengawas)' }).click();
    await expect(page.getByRole('heading', { name: 'Keluar Darurat (Pengawas)' })).toBeVisible();

    // Uji passcode salah ('111111') ditolak
    const codeInput = page.getByPlaceholder('6 digit kode pengawas');
    await codeInput.fill('111111');
    await page.getByRole('button', { name: 'Buka Kunci & Keluar' }).click();
    await expect(page.getByText(/Kode darurat salah/i)).toBeVisible();

    // Uji passcode benar ('202627') berhasil keluar ke Beranda
    await codeInput.fill('202627');
    await page.getByRole('button', { name: 'Buka Kunci & Keluar' }).click();
    await expect(page.getByText('Aplikasi Ujian Aman (Anti-Curang)')).toBeVisible();
  });

  test('Inspeksi Multi-Viewport (375px Mobile, 768px Tablet, 1440px Desktop): Bebas Horizontal Scroll Leak', async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/');
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasOverflow, `Horizontal overflow pada lebar ${vp.width}px`).toBe(false);
    }
  });
});
