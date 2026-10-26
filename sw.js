// Service worker: tiene in cache i file dell'app così si apre anche offline.
// I dati arrivano sempre da Supabase (serve internet per salvarli).
// Quando modifichi un file dell'app, aumenta il numero di versione qui sotto:
// i file si scaricano comunque dalla rete per primi, ma così la cache offline si rinnova.
const VERSION = "v5";
const CACHE = "conti-" + VERSION;
const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/calc.js",
  "./js/store.js",
  "./js/config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("conti-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// File dell'app: prima la rete (così vedi subito gli aggiornamenti), cache se sei offline.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
