// Test End-to-End (E2E) Browser Playwright untuk NETRI Exam Web v2
// Memverifikasi PWA readiness (manifest & sw.js), mode PWA bebas notif fullscreen,
// 9 lapis anti-curang (Watermark, Strike 1 Cooldown 5s -> Strike 2 Hard Lock -> Anti-Refresh F5 -> Unlock 202627),
// tombol Back terblokir, 4 Gerbang Split-Screen, dan 3 viewport tanpa horizontal scroll leak.

import { expect, test, type Page } from '@playwright/test';

async function setupStaticExamTestHooks(page: Page, pwaStandalone = false) {
  await page.addInitScript((standaloneFlag: boolean) => {
    window.__NETRI_MOCK_ONLINE__ = true;
    window.__NETRI_MOCK_EMBED_URL__ = '/mock-form/';
    window.__NETRI_TEST_BYPASS_GRACE__ = true;
    if (standaloneFlag) {
      window.__NETRI_TEST_PWA_STANDALONE__ = true;
    }
  }, pwaStandalone);
}

test.describe('Alur Lengkap E2E NETRI Exam Web v2 (PWA & Anti-Curang 9 Lapis):', () => {
  test('Skenario PWA Readiness: manifest.json dan sw.js tersedia serta Mode PWA Standalone aktif tanpa memicu Fullscreen', async ({
    page,
    request,
  }) => {
    const manifestRes = await request.get('/manifest.json');
    expect(manifestRes.status()).toBe(200);
    const manifestJson = (await manifestRes.json()) as { display?: string; short_name?: string };
    expect(manifestJson.display).toBe('standalone');
    expect(manifestJson.short_name).toBe('Exam NETRI');

    const swRes = await request.get('/sw.js');
    expect(swRes.status()).toBe(200);

    await setupStaticExamTestHooks(page, true);
    await page.goto('/');

    // Pada mode PWA Standalone, banner hijau aktif tampil
    await expect(
      page.getByText('Mode Aplikasi (PWA) Aktif — Layar Penuh Tanpa Bar Browser'),
    ).toBeVisible();

    await page.getByLabel('Tautan Formulir Ujian').fill('https://forms.gle/pwaModeTest123');
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await page.getByRole('button', { name: 'Saya Siap & Mulai Mengerjakan' }).click();

    await expect(page.getByText('Exam NETRI (Terkunci)')).toBeVisible();
    // Pastikan di mode PWA Standalone tidak meminta fullscreen API sehingga bebas notifikasi tarik layar
    const inFullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));
    expect(inFullscreen).toBe(false);
  });

  test('Skenario Anti-Curang Lengkap: Watermark -> Back Terblokir -> Strike 1 (Cooldown 5s) -> Strike 2 Hard Lock -> Anti-Refresh F5 -> Unlock Pengawas -> Bukti Resmi', async ({
    page,
  }) => {
    await setupStaticExamTestHooks(page, false);
    await page.goto('/');

    // 1. Validasi Input Kosong & Domain Terlarang
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(
      page.getByText('Harap tempel tautan form atau pindai QR Code ujian.'),
    ).toBeVisible();

    const urlInput = page.getByLabel('Tautan Formulir Ujian');
    await urlInput.fill('https://youtube.com/video');
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(
      page.getByText(
        'Tautan harus berupa Google Forms (forms.gle) atau tautan pendek (s.id, gg.gg).',
      ),
    ).toBeVisible();

    // 2. Masuk dengan tautan pendek s.id tanpa https://
    await urlInput.fill('s.id/ujian7');
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(page.getByText('Mode Ujian Ketat (Anti-Curang)')).toBeVisible();
    await page.getByRole('button', { name: 'Saya Siap & Mulai Mengerjakan' }).click();

    await expect(page.getByText('Exam NETRI (Terkunci)')).toBeVisible();
    await expect(page.getByTestId('exam-tiled-watermark')).toBeVisible();

    // Klik & ketik di dalam iframe soal TIDAK boleh memicu pelanggaran
    const formFrame = page.frameLocator('iframe');
    await formFrame.getByLabel('Jawaban Soal 1').fill('20');
    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toHaveCount(0);

    // 3. Tombol Back browser tertahan & muncul dialog Dilarang Keluar!
    await page.goBack();
    await expect(page.getByText('Dilarang Keluar!')).toBeVisible();
    await page.getByRole('button', { name: 'Lanjut Mengerjakan Ujian' }).click();
    await expect(page.getByText('Dilarang Keluar!')).toHaveCount(0);

    // 4. Simulasikan Strike 1 (keluar tab 2 detik -> langsung tercatat karena batas diperketat!)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1600);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toBeVisible();
    await expect(page.getByText('1 Pelanggaran')).toBeVisible();
    // Tombol kembali terkunci selama cooldown 5 detik sebelum bisa diklik
    await expect(page.getByRole('button', { name: /Tunggu \d+ detik/i })).toBeDisabled();
    await page.getByRole('button', { name: 'Saya Mengerti, Kembali ke Ujian' }).click({
      timeout: 8000,
    });
    await expect(page.getByText('🚨 PERINGATAN KECURANGAN!')).toHaveCount(0);

    // 5. Simulasikan Strike 2 -> Langsung memicu HARD LOCK PERMANEN!
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByText('🔒 SESI UJIAN TERKUNCI')).toBeVisible();
    await expect(page.getByText('TERKUNCI', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Saya Mengerti, Kembali ke Ujian' }),
    ).toHaveCount(0);

    // 6. Uji Anti-Refresh Bypass: Tekan F5 / Reload halaman -> Sesi & Hard Lock WAJIB tetap terkunci!
    await page.reload();
    await expect(page.getByText('🔒 SESI UJIAN TERKUNCI')).toBeVisible();

    // 7. Pengawas membuka kunci Hard Lock dengan kode 202627
    const hardLockPinInput = page.getByPlaceholder('Masukkan 6 digit kode pengawas');
    await hardLockPinInput.fill('111111');
    await page.getByRole('button', { name: 'Buka Kunci & Lanjutkan Ujian' }).click();
    await expect(page.getByText(/Kode pengawas salah/i)).toBeVisible();

    await hardLockPinInput.fill('202627');
    await page.getByRole('button', { name: 'Buka Kunci & Lanjutkan Ujian' }).click();
    await expect(page.getByText('🔒 SESI UJIAN TERKUNCI')).toHaveCount(0);
    await expect(page.getByText('2 Pelanggaran')).toBeVisible();

    // 8. Kirim Form -> Masuk ResultView dengan Status Audit Pelanggaran
    await formFrame.getByRole('link', { name: 'Kirim Jawaban' }).click();
    await expect(formFrame.getByText('Jawaban Anda telah direkam')).toBeVisible();
    await page.getByRole('button', { name: 'Selesai Ujian' }).click();
    await page.getByRole('button', { name: 'Ya, Saya Sudah Kirim' }).click();

    await expect(page.getByText('Sesi Ujian Selesai')).toBeVisible();
    await expect(page.getByText('BUKTI RESMI SELESAI')).toBeVisible();
    await expect(page.getByText(/Tercatat 2 Pelanggaran/)).toBeVisible();
    await expect(page.getByText('Riwayat Catatan Pengawas')).toBeVisible();

    await page.getByRole('button', { name: 'Kembali ke Beranda' }).click();
    await expect(page.getByText('Aplikasi Ujian Aman (Anti-Curang)')).toBeVisible();
  });

  test('Skenario 4 Gerbang Anti-Split-Screen & Keluar Darurat Pengawas (202627)', async ({
    page,
  }) => {
    await setupStaticExamTestHooks(page, false);
    await page.goto('/');

    await page.evaluate(() => {
      window.__NETRI_TEST_SCREEN_CLEAR__ = false;
    });
    await page.getByLabel('Tautan Formulir Ujian').fill('https://forms.gle/splitTest123');
    await expect(page.getByText(/mode Split-Screen aktif di layar/i)).toBeVisible();

    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await expect(page.getByText('Mode Ujian Ketat (Anti-Curang)')).toHaveCount(0);

    await page.evaluate(() => {
      window.__NETRI_TEST_SCREEN_CLEAR__ = true;
    });
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await page.getByRole('button', { name: 'Saya Siap & Mulai Mengerjakan' }).click();
    await expect(page.getByText('Exam NETRI (Terkunci)')).toBeVisible();

    await page.getByRole('button', { name: 'Keluar Darurat (Pengawas)' }).click();
    await expect(page.getByRole('heading', { name: 'Keluar Darurat (Pengawas)' })).toBeVisible();

    const codeInput = page.getByPlaceholder('6 digit kode pengawas');
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
