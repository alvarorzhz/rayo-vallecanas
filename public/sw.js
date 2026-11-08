// Service worker del Rayo Vallecañas.
// - Recursos estáticos: caché primero.
// - Páginas: red primero; sin conexión se muestra la última versión vista o /offline.
// - Cualquier petición que no sea GET (ventas, cobros…) va SIEMPRE a la red: nunca se encola
//   ni se reintenta offline, para evitar duplicidades.
const VERSION = "rv-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/escudo.png", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
  }
});

// ------------------------------------------------------------------ Notificaciones push
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Rayo Vallecañas", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Rayo Vallecañas";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/", reply: data.reply || null },
  };
  // Botones (Voy / No voy). Donde el sistema no los admite (Safari, iPhone) simplemente no salen
  // y tocar el aviso abre la app como siempre.
  if (Array.isArray(data.actions) && data.actions.length && data.reply) options.actions = data.actions.slice(0, 2);
  event.waitUntil(self.registration.showNotification(title, options));
});

// Abre (o enfoca) la app en esa dirección
function openApp(path) {
  const url = new URL(path || "/", self.location.origin).href;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin) && "focus" in w) {
        w.navigate(url);
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  });
}

// Contesta (convocatoria o votación) sin abrir la app y confirma con otro aviso. Si falla, abre la app.
const REPLY_ENDPOINTS = ["/api/convocatoria/responder", "/api/votacion/responder"];
function replyFromNotification(n, reply) {
  const d = n.data || {};
  const endpoint = REPLY_ENDPOINTS.includes(d.reply.endpoint) ? d.reply.endpoint : REPLY_ENDPOINTS[0];
  return fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: d.reply.token, reply }),
  })
    .then((res) => res.json().catch(() => ({})).then((j) => ({ ok: res.ok && j.ok, j })))
    .then(({ ok, j }) =>
      self.registration.showNotification(ok ? j.title : j.failTitle || "No se pudo apuntar tu respuesta", {
        body: ok ? j.body : (j.error || "Sin conexión") + ". Toca para contestar en la app.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: n.tag || undefined,
        silent: ok,
        data: { url: d.url || "/" },
      }),
    )
    .then(() => {
      // Si la app está abierta, que se refresque para enseñar la respuesta
      return self.clients.matchAll({ type: "window" }).then((wins) => wins.forEach((w) => w.postMessage({ type: "callup-replied" })));
    })
    .catch(() => openApp(d.url));
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  n.close();
  const d = n.data || {};
  if ((event.action === "yes" || event.action === "no") && d.reply && d.reply.token) {
    event.waitUntil(replyFromNotification(n, event.action));
    return;
  }
  event.waitUntil(openApp(d.url));
});
