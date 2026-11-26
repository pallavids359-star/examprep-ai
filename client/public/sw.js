// GenPrep service worker: makes the site installable as an app and shows a page when offline.
// Pages always come from the network first (so updates show at once). API calls are never cached.
const VERSION = "gp-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/genprep-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return; // always live

  // Pages: network first, then the last copy, then the offline page
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy));
          return res;
        })
        .catch(async () => (await caches.match("/")) || caches.match("/offline.html"))
    );
    return;
  }

  // Built files have a hash in their name, so they never change: cache first
  if (url.origin === location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Fonts: use the saved copy, refresh it in the background
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const fresh = fetch(req).then((res) => (res.ok && c.put(req, res.clone()), res)).catch(() => hit);
        return hit || fresh;
      })
    );
  }
});
