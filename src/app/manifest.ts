import type { MetadataRoute } from 'next';

// Konfigurasi PWA Web Manifest agar siswa iOS/Android dapat memasang ikon ke Layar Utama tanpa Play Store
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NETRI Exam - Aplikasi Ujian Aman',
    short_name: 'Exam NETRI',
    description: 'Pembungkus ujian terkunci dan anti-curang untuk Google Forms berbasis Web.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: '#1A4FD6',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/Icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/Icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/Icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/Icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
