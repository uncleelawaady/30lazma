/* TechAI News — Service Worker (PWA + Cache) */
const CACHE = "techai-v3";
const CORE = ["index.html", "article.html", "category.html", "search.html", "special.html",
  "quiz.html", "account.html", "static.html", "author.html", "security.html", "offline.html",
  "style.css", "script.js", "data.js", "icon.svg", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* شبكة أولاً مع احتياطي من الكاش — مناسب لموقع أخبار */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
