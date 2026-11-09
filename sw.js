// Health OS service worker: caches the app shell for offline use.
// Data requests (api.github.com) are never cached here — the app keeps its own cache + write queue.
const VERSION = 'hos-v1.0.0';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './app/main.js', './app/ui.js', './app/today.js', './app/checkin.js', './app/trends.js', './app/plan.js', './app/more.js', './app/forms.js', './app/setup.js', './app/lock.js',
  './lib/store.js', './lib/github.js', './lib/dates.js', './lib/demo.js', './lib/ics.js', './lib/md.js', './lib/charts.js',
  './vendor/preact.js', './vendor/hooks.js', './vendor/htm.js', './vendor/uplot.js', './vendor/uplot.css', './vendor/marked.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // GitHub API etc. go straight to network
  // network-first for the shell (so updates arrive), cache fallback offline
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
