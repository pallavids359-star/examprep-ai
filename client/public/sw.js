// GenPrep is a website only now (no installable app).
// Browsers that installed the old app worker download this file, which removes itself and its saved copies,
// then reloads open tabs so they come straight from the website.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: "window" });
      tabs.forEach((t) => t.navigate(t.url));
    })()
  );
});
