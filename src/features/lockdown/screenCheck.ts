// Utilitas Pemeriksaan Kebersihan Layar (Anti Split-Screen / Floating Window) & Fullscreen API
// Mengadopsi ambang rasio 88% identik dengan isActivityWidthShrunk() di MainActivity.kt

import { EXAM_METRICS } from '@/contracts/exam';

declare global {
  interface Window {
    __NETRI_TEST_SCREEN_CLEAR__?: boolean;
    __NETRI_TEST_PWA_STANDALONE__?: boolean;
  }
}

/** Memeriksa apakah aplikasi sedang dibuka dari mode PWA terpasang (Standalone / Layar Utama) */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.__NETRI_TEST_PWA_STANDALONE__ === 'boolean') {
    return window.__NETRI_TEST_PWA_STANDALONE__;
  }

  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches);
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return Boolean(displayModeStandalone || iosStandalone);
}

/** Mendeteksi perangkat iPhone/iPad/iPod untuk menampilkan panduan "Tambah ke Layar Utama" Safari */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface WebkitHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

/**
 * Menghitung apakah lebar viewport masih aman (tidak menyusut menjadi split-screen / floating window).
 * - Pada perangkat mobile/tablet (layar <= 1024px), memakai ambang ketat 88% identik dengan MainActivity.kt.
 * - Pada layar desktop lebar (> 1024px), memakai ambang 55% agar jendela desktop normal (misal 1280px di monitor 1920px)
 *   tetap bisa memulai ujian menuju Fullscreen, namun jendela split-screen 50:50 tetap terdeteksi dan ditolak.
 */
export function isWindowWidthUnshrunk(
  currentWidth: number,
  referenceWidth: number,
): boolean {
  if (currentWidth <= 0 || referenceWidth <= 0) return true;
  const ratio =
    referenceWidth > 1024 ? 0.45 : EXAM_METRICS.MIN_SCREEN_WIDTH_RATIO;
  return currentWidth >= referenceWidth * ratio;
}

/**
 * Mendeteksi split-screen vertikal (atas-bawah) pada layar mobile/tablet (<= 1024px)
 * memakai perbandingan outerHeight terhadap screen.height agar tidak terpicu oleh keyboard virtual.
 */
export function isWindowHeightUnshrunk(
  outerHeight: number,
  screenHeight: number,
  availWidth: number,
): boolean {
  if (availWidth <= 0 || availWidth > 1024) return true;
  if (outerHeight <= 0 || screenHeight <= 0) return true;
  return outerHeight >= screenHeight * EXAM_METRICS.MIN_MOBILE_HEIGHT_RATIO;
}

/**
 * Memeriksa apakah layar browser bersih dari mode Split-Screen (horizontal & vertikal) atau Floating Window.
 * Menghormati hook pengujian __NETRI_TEST_SCREEN_CLEAR__ untuk uji E2E 4 gerbang.
 */
export function checkScreenClear(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.__NETRI_TEST_SCREEN_CLEAR__ === 'boolean') {
    return window.__NETRI_TEST_SCREEN_CLEAR__;
  }

  // Jika mode Fullscreen aktif, browser menempati 100% layar fisik
  if (isCurrentlyFullscreen()) {
    return true;
  }

  const availWidth = window.screen?.availWidth || 0;
  // Di desktop, outerWidth dibandingkan dengan availWidth; di mobile Android split-screen/pop-up, innerWidth juga menyusut
  const outerOk =
    window.outerWidth > 0 ? isWindowWidthUnshrunk(window.outerWidth, availWidth) : true;
  const innerOk =
    window.innerWidth > 0 && availWidth > 0
      ? isWindowWidthUnshrunk(window.innerWidth, availWidth)
      : true;
  const heightOk = isWindowHeightUnshrunk(
    window.outerHeight,
    window.screen?.height || 0,
    availWidth,
  );

  return outerOk && innerOk && heightOk;
}

/** Memeriksa apakah browser mendukung Fullscreen API (iOS Safari tab biasa mengembalikan false) */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

/** Memeriksa apakah halaman sedang dalam mode Fullscreen aktif */
export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** Meminta browser masuk ke mode Fullscreen layar penuh */
export async function requestExamFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (!isFullscreenSupported()) return false;
  if (isCurrentlyFullscreen()) return true;

  const root = document.documentElement as WebkitHTMLElement;
  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    } else if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
    }
    return isCurrentlyFullscreen();
  } catch {
    return false;
  }
}

/** Keluar secara bersih dari mode Fullscreen saat ujian selesai atau darurat */
export async function exitExamFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!isCurrentlyFullscreen()) return;

  const doc = document as WebkitDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Abaikan jika browser sudah keluar fullscreen lebih dulu
  }
}
