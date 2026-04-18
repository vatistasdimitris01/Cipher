self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through fetch with network-first fallback
  e.respondWith(
    fetch(e.request).catch(() => new Response("Network offline connection severed."))
  );
});
