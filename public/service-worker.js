const CACHE_NAME = 'sharkscout-cache-v2-BGRC-2025';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/images/down_arrow.png',
  '/images/information_icon.png',
  '/images/favicon.ico',
  '/manifest.json',
  '/lato-v24-latin-regular.woff2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@sgratzl/chartjs-chart-boxplot@4.4.4/build/index.umd.min.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); 
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim(); 
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
