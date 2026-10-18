/* Service worker: keeps the shared shell on the device, loads pages from the
   network first so a deploy shows up on the next visit, and falls back to the
   saved copy when the network is down or slow.
   Only same-origin GET requests are touched; live numbers and every request to
   the blog, booking, and GitHub hosts pass straight through to the network. */
"use strict";

const CACHE_VERSION = "v3";
const CACHE = `dibyajyoti-site-${CACHE_VERSION}`;
// The shell is the only thing fetched during install, so a first visit stays light.
const SHELL = ["/", "/assets/avatar.jpg", "/assets/favicon.svg"];
const CACHEABLE = new Set(["style", "script", "image", "font", "manifest"]);
// Pages are served for 10 minutes from the browser's HTTP cache, so a refetch
// that trusted it could store the page from before a deploy. A conditional
// request costs a 304 when nothing changed.
const PAGE_FETCH = "no-cache";
// A page waits this long for the network before the saved copy is shown instead.
const PAGE_TIMEOUT_MS = 2500;
// Repeated background refreshes for the same URL are collapsed into one request.
const refreshing = new Map();

const uncacheable = (response) => /(?:^|,)\s*no-store\b/i.test(response.headers.get("cache-control") || "");

function keepAlive(event, promise) {
  try { event.waitUntil(promise); } catch { /* The response itself is still delivered. */ }
}

function stored(cache, request, mode = "default") {
  // An in-flight refresh already covers this URL.
  if (refreshing.has(request.url)) return refreshing.get(request.url);
  // For assets the browser's own rules decide freshness, so a copy it already
  // holds fresh (including one a prefetch put there) is reused instead of
  // re-fetched. Pages pass "no-cache" so they always revalidate with the server.
  const job = fetch(request, { cache: mode, credentials: "same-origin", redirect: "follow" })
    .then((response) => {
      if (!response || !response.ok || response.type !== "basic" || uncacheable(response)) return response;
      return cache.put(request, response.clone()).then(() => response);
    })
    .catch(() => undefined)
    .finally(() => refreshing.delete(request.url));
  refreshing.set(request.url, job);
  return job;
}

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function navigation(request, event) {
  const cache = await caches.open(CACHE);
  // Serving the saved page first meant every deploy showed the old page until a
  // second reload. The network answers first now; the copy is only a fallback.
  const network = stored(cache, request, PAGE_FETCH);
  keepAlive(event, network);
  const fresh = await Promise.race([network, timeout(PAGE_TIMEOUT_MS)]);
  // A real 404 stays a 404; only a network that cannot answer falls back.
  if (fresh) return fresh;
  return (await cache.match(request)) || (await network) || (await cache.match("/")) || Response.error();
}

async function asset(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // The saved file paints immediately; the newest copy replaces it quietly.
    keepAlive(event, stored(cache, request));
    return cached;
  }
  const fresh = await stored(cache, request);
  return fresh || fetch(request);
}

async function warm(urls) {
  const cache = await caches.open(CACHE);
  const targets = urls.filter((value) => typeof value === "string").slice(0, 12);
  await Promise.all(targets.map(async (value) => {
    try {
      const url = new URL(value, self.location.origin);
      if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
          url.pathname === "/ebooks/thank-you.html") return;
      if (await cache.match(url.href)) return;
      // Lowest priority: saving a page must never compete with the page on screen.
      const response = await fetch(new Request(url.href, { credentials: "same-origin", priority: "low" }));
      if (response.ok && response.type === "basic" && !uncacheable(response)) await cache.put(url.href, response.clone());
    } catch { /* A page that cannot be warmed simply loads from the network. */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("dibyajyoti-site-") && name !== CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm" && Array.isArray(data.urls)) keepAlive(event, warm(data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
      url.pathname === "/ebooks/thank-you.html") return;
  if (request.mode === "navigate") { event.respondWith(navigation(request, event)); return; }
  if (CACHEABLE.has(request.destination)) event.respondWith(asset(request, event));
});
