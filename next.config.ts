import type { NextConfig } from 'next';

// Konfigurasi Next.js dengan penguatan HTTP Security Headers standar industri
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            // Kamera, Fullscreen, dan WakeLock harus diizinkan pada origin sendiri untuk QR Scanner dan Lockdown
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(self), fullscreen=(self), wake-lock=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
