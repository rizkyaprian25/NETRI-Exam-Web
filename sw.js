// Service Worker NETRI Exam Web PWA
// Memenuhi syarat instalasi WebAPK Chromium (Android/Desktop) tanpa mengintersep request lintas-origin ke Google Forms

const CACHE_NAME = 'netri-exam-pwa-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Wajib abaikan seluruh request lintas-origin (docs.google.com, google.com/generate_204, dll)
  if (url.origin !== self.location.origin) return;

  // Untuk aset statis gambar/ikon/manifest gunakan cache-first dengan pembaruan latar belakang
  const isStaticAsset =
    url.pathname.includes('/images/') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('favicon.png') ||
    url.pathname.endsWith('manifest.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    );
    return;
  }

  // Untuk navigasi dokumen HTML & bundle JS gunakan network-first dengan fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
