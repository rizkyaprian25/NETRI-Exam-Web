import type { Metadata, Viewport } from 'next';
import { withBasePath } from '@/core/url/basePath';
import './globals.css';

export const metadata: Metadata = {
  title: 'Exam NETRI — Aplikasi Ujian Aman (Web)',
  description:
    'Platform ujian terkunci berbasis web untuk Google Forms tanpa perlu mengunduh aplikasi, lengkap dengan deteksi keluar layar dan sirine pengawas.',
  manifest: withBasePath('/manifest.json'),
  icons: {
    icon: withBasePath('/favicon.png'),
    apple: withBasePath('/icons/Icon-192.png'),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Exam NETRI',
  },
  openGraph: {
    title: 'Exam NETRI — Aplikasi Ujian Aman',
    description:
      'Masuk ujian Google Form langsung dari browser dengan pengawasan mode layar penuh dan anti-curang.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1116' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-dvh bg-bg text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
