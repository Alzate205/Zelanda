// Service worker para Hacienda La Zelanda — sub-fase 5.2a
// Maneja push notifications + cache de app shell para navegación offline.

const VERSION = "5.2a-1";
const CACHE_SHELL = `zelanda-shell-${VERSION}`;
const CACHE_DATOS = `zelanda-datos-${VERSION}`;

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL_URLS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((k) => k.startsWith("zelanda-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // No cachear endpoints de mutación
  if (
    url.pathname.startsWith("/api/trabajador/avance") ||
    url.pathname.startsWith("/api/trabajador/novedad") ||
    url.pathname.startsWith("/api/push") ||
    url.pathname.startsWith("/api/cron")
  ) {
    return;
  }

  // Snapshot: network-first con fallback a cache
  if (url.pathname.startsWith("/api/trabajador/snapshot")) {
    event.respondWith(networkFirst(req, CACHE_DATOS));
    return;
  }

  // Navegación HTML del trabajador → cache-first con revalidación
  if (req.mode === "navigate" && url.pathname.startsWith("/trabajador")) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
    return;
  }

  // Recursos estáticos de Next (_next/static) → cache-first
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(cacheFirst(req, CACHE_SHELL));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}

// === Push (sin cambios) ===

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { titulo: "La Zelanda", cuerpo: event.data.text() };
  }
  const titulo = payload.titulo || "La Zelanda";
  const opciones = {
    body: payload.cuerpo || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.endsWith(url) && "focus" in w) return w.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
