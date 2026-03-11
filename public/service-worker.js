const CACHE_NAME = 'sharkscout-cache-lake-city-for-realz-v2'; // Increment this when updating
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/lato-v24-latin-regular.woff2',
  '/images/down_arrow.png',
  'mobile.html',
  'css/mobile.css',
  'js/mobile.js',
  'images/menu.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      })
    )).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Network-first strategy for HTML pages
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache the updated page
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      // Return cached version immediately
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          // Update cache with new version
          if (networkRes && networkRes.status === 200 && req.method === 'GET') {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch((error) => {
          console.log('Fetch failed:', error);
          if (req.destination === 'image') {
            return caches.match('/images/favicon.png');
          }
          return null;
        });

      // Return cached response immediately, or wait for network if no cache
      return cached || fetchPromise;
    })
  );
});

// Optional: Clean up old caches periodically
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});