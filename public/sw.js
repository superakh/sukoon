/* Sukoon Service Worker — offline-first caching */
var CACHE_NAME = 'sukoon-v1';
var PAGES = [
  '/',
  '/index.html',
  '/explore.html',
  '/meditate.html',
  '/daily.html',
  '/sleep.html',
  '/sounds.html',
  '/focus.html',
  '/friend.html',
  '/sos.html',
  '/journal.html',
  '/quotes.html',
  '/courses.html',
  '/progress.html',
  '/you.html',
  '/videos.html',
  '/privacy.html',
  '/onboarding.html',
  '/css/shell.css',
  '/js/shell.js',
  '/js/sukoon-engine.js'
];

// Install: cache shell + pages
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PAGES);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Skip non-GET and API calls
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets and pages
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // Return cache, update in background
        var fetchPromise = fetch(e.request).then(function(response) {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, response);
            });
          }
          return response.clone();
        }).catch(function() {});
        return cached;
      }
      // Not in cache — fetch and cache
      return fetch(e.request).then(function(response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback for HTML pages
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
