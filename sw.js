/* Wardrobe — offline support. The app's files are cached when this worker installs, so Wardrobe
   opens without a connection. Bump VERSION whenever a file in FILES changes, or phones keep using
   the old copy. Photos and records never pass through here: they live in the browser's own storage.
   Only caches named wardrobe-* are touched, because other apps share this origin. */
const VERSION = 'wardrobe-v4';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/alegreya-italic-400-700-latin-ext.woff2',
  'fonts/alegreya-italic-400-700-latin.woff2',
  'fonts/alegreya-normal-400-700-latin-ext.woff2',
  'fonts/alegreya-normal-400-700-latin.woff2',
  'fonts/alegreya-sans-italic-400-latin-ext.woff2',
  'fonts/alegreya-sans-italic-400-latin.woff2',
  'fonts/alegreya-sans-normal-400-latin-ext.woff2',
  'fonts/alegreya-sans-normal-400-latin.woff2',
  'fonts/alegreya-sans-normal-500-latin-ext.woff2',
  'fonts/alegreya-sans-normal-500-latin.woff2',
  'fonts/alegreya-sans-normal-700-latin-ext.woff2',
  'fonts/alegreya-sans-normal-700-latin.woff2',
  'src/base.css',
  'src/wardrobe.css',
  'src/core.js',
  'src/store.js',
  'src/ui.js',
  'src/cutout.js',
  'src/colour.js',
  'src/model.js',
  'src/weather.js',
  'src/suggest.js',
  'src/view-closet.js',
  'src/view-item.js',
  'src/view-outfits.js',
  'src/view-calendar.js',
  'src/view-stats.js',
  'src/view-more.js',
  'src/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wardrobe-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
          })
          .catch((err) => {
            if (req.mode === 'navigate') return cache.match('./').then((page) => page || Promise.reject(err));
            throw err;
          });
      })
    )
  );
});
