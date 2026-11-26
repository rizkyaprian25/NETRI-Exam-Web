import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Konfigurasi Next.js Static Export untuk GitHub Pages & hosting statis
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
