/* Service worker: keeps the shared shell on the device, answers repeat
   navigations from the cache before the network replies, and stores the pages
   a visitor is about to open so a click lands on an already-loaded document.
   Only same-origin GET requests are touched; live numbers and every request to
   the blog, booking, and GitHub hosts pass straight through to the network. */
"use strict";

const CACHE_VERSION = "v1";
const CACHE = `dibyajyoti-site-${CACHE_VERSION}`;
// The shell is the only thing fetched during install, so a first visit stays light.
const SHELL = ["/", "/assets/avatar.jpg", "/assets/favicon.svg"];
const CACHEABLE = new Set(["style", "script", "image", "font", "manifest"]);
// Repeated background refreshes for the same URL are collapsed into one request.
const refreshing = new Map();

const uncacheable = (response) => /(?:^|,)\s*no-store\b/i.test(response.headers.get("cache-control") || "");

function keepAlive(event, promise) {
  try { event.waitUntil(promise); } catch { /* The response itself is still delivered. */ }
}

function stored(cache, request) {
  // An in-flight refresh already covers this URL.
  if (refreshing.has(request.url)) return refreshing.get(request.url);
  const job = fetch(request, { cache: "no-cache", credentials: "same-origin", redirect: "follow" })
    .then((response) => {
      if (!response || !response.ok || response.type !== "basic" || uncacheable(response)) return response;
      return cache.put(request, response.clone()).then(() => response);
    })
    .catch(() => undefined)
    .finally(() => refreshing.delete(request.url));
  refreshing.set(request.url, job);
  return job;
}

async function navigation(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Show the saved page now; the newest copy replaces it for the next click.
    keepAlive(event, stored(cache, request));
    return cached;
  }
  const fresh = await stored(cache, request);
  // A real 404 stays a 404; only a network that cannot answer falls back to home.
  if (fresh) return fresh;
  return (await cache.match("/")) || Response.error();
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
      if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
      if (await cache.match(url.href)) return;
      const response = await fetch(new Request(url.href, { credentials: "same-origin" }));
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
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") { event.respondWith(navigation(request, event)); return; }
  if (CACHEABLE.has(request.destination)) event.respondWith(asset(request, event));
});
