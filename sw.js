"use strict";
const CACHE_PREFIX = "seabattle-shell-";
const CACHE_NAME = CACHE_PREFIX + "v0.7.1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./favicon.ico",
  "./assets/seabattle-icon.svg", "./assets/icon-192.png", "./assets/icon-512.png",
  "./js/config.js", "./js/career.js", "./js/ui-state.js",
  "./js/engine.js", "./js/ai.js", "./js/daily.js", "./js/tactics.js", "./js/ui.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) return cached;
    try { return await fetch(request); }
    catch (error) {
      if (request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      throw error;
    }
  }));
});
