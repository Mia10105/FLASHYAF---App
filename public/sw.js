const CACHE = "flashyaf-v2"; // bumped so old, over-broad caches get cleared out
const PRECACHE = ["/", "/index.html", "/manifest.json", "/app-icon.svg"];

// SECURITY FIX: previously this cached every successful GET response
// except URLs containing "firestore"/"firebase" — a default-allow with a
// couple exclusions. That's risky going forward: any future API route,
// authenticated response, export, or report would get cached by default
// until someone remembered to exclude it too. Switched to a default-deny
// allowlist of known-safe, static, same-origin asset types instead.
const CACHEABLE_EXTENSIONS = [
  ".html", ".js", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg",
  ".woff", ".woff2", ".ico",
];

function isCacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false; // same-origin only
  if (url.pathname.startsWith("/api")) return false;
  if (url.pathname.includes("firestore") || url.pathname.includes("firebase")) return false;
  return CACHEABLE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext)) || url.pathname === "/";
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (!isCacheable(e.request)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
