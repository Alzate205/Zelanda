// Service worker para Hacienda La Zelanda — sub-fase 5.2b
// Push + cache de app shell para navegación offline.

// La versión se sube a mano en cada cambio de este archivo. Al activarse borra
// las cachés de versiones viejas: es la vía para invalidar contenido que quedó
// mal guardado en los celulares (por ejemplo, páginas de otra cuenta).
const VERSION = 'b2-2';
const CACHE_SHELL = `zelanda-shell-${VERSION}`;
const CACHE_DATOS = `zelanda-datos-${VERSION}`;
const CACHE_BALDOSAS = `zelanda-baldosas-${VERSION}`;
// Guarda de quién son las páginas cacheadas. No lleva versión: sobrevive a los
// deploys porque la pregunta que responde ("¿sigue siendo el mismo usuario?")
// no depende de la versión del worker.
const CACHE_SESION = 'zelanda-sesion';
const URL_DUENO = 'https://zelanda.local/dueno';
const URL_ROL = 'https://zelanda.local/rol';

const HOME_POR_ROL = {
  TRABAJADOR: '/trabajador',
  BODEGA: '/bodega',
  ALMACEN: '/almacen',
  JEFE: '/jefe',
};
const HOSTS_BALDOSAS = [
  'mt0.google.com',
  'mt1.google.com',
  'mt2.google.com',
  'mt3.google.com',
  'elevation-tiles-prod.s3.amazonaws.com',
];
const MAX_BALDOSAS = 300;

const SHELL_URLS = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

const RUTAS_NAVEGABLES = ['/trabajador', '/bodega', '/almacen', '/jefe', '/mi-perfil'];

const ESTILO_PAGINA =
  'body{background:#F5F1E8;color:#3D5C42;font-family:system-ui;display:flex;flex-direction:column;' +
  'align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;gap:12px}' +
  'a{display:inline-block;background:#3D5C42;color:#F5F1E8;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600}' +
  'p{margin:0;max-width:34ch;line-height:1.5}';

/**
 * HTML mínimo que manda a la home del rol que inició sesión en este celular.
 *
 * Antes caía a "/trabajador" cuando no había rol guardado, y por eso un usuario
 * de bodega abría la app sin señal y aterrizaba en la pantalla del trabajador.
 * Ahora, si no sabemos el rol, no adivinamos: pedimos abrir con internet.
 */
const LAUNCHER_HTML = `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#3D5C42">
<title>La Zelanda</title>
<style>${ESTILO_PAGINA}</style>
</head><body>
<p id="msj">Cargando…</p>
<script>
(function(){
  var mapa={TRABAJADOR:"/trabajador",BODEGA:"/bodega",ALMACEN:"/almacen",JEFE:"/jefe"};
  var rol=null;
  try{rol=localStorage.getItem("zelanda_rol_ultimo")}catch(e){}
  if(mapa[rol]){location.replace(mapa[rol]);return}
  document.getElementById("msj").textContent=
    "No hay sesión guardada en este celular. Conectate a internet una vez para entrar.";
})();
</script>
</body></html>`;

/** Página para una ruta que no quedó guardada: ofrece volver a la home del rol. */
function paginaSinSenal(mensaje) {
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#3D5C42">
<title>Sin señal · La Zelanda</title>
<style>${ESTILO_PAGINA}</style>
</head><body>
<p>${mensaje}</p>
<a id="volver" href="/">Volver al inicio</a>
<script>
(function(){
  var mapa={TRABAJADOR:"/trabajador",BODEGA:"/bodega",ALMACEN:"/almacen",JEFE:"/jefe"};
  var rol=null;
  try{rol=localStorage.getItem("zelanda_rol_ultimo")}catch(e){}
  if(mapa[rol])document.getElementById("volver").href=mapa[rol];
})();
</script>
</body></html>`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves
          // CACHE_SESION no lleva versión y debe sobrevivir: es lo que permite
          // detectar un cambio de cuenta después de un deploy.
          .filter((k) => k.startsWith('zelanda-') && k !== CACHE_SESION && !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// === Dueño de las cachés ===
//
// El shell y los payloads RSC son HTML YA AUTENTICADO: traen el nombre, las
// tareas y los datos de quien los pidió. Si en el mismo celular entra otra
// persona, servirle esas respuestas es filtrarle la sesión ajena. Por eso la
// app avisa quién está adentro y acá se borra todo cuando cambia.

async function leerDueno() {
  try {
    const cache = await caches.open(CACHE_SESION);
    const hit = await cache.match(URL_DUENO);
    if (!hit) return null;
    return await hit.text();
  } catch {
    return null;
  }
}

async function guardarDueno(usuarioId) {
  const cache = await caches.open(CACHE_SESION);
  await cache.put(URL_DUENO, new Response(usuarioId));
}

async function borrarCachesDeUsuario() {
  const claves = await caches.keys();
  await Promise.all(
    claves
      // Las baldosas del mapa son públicas: no identifican a nadie y volver a
      // bajarlas cuesta datos, así que se conservan.
      .filter((k) => k.startsWith('zelanda-shell-') || k.startsWith('zelanda-datos-'))
      .map((k) => caches.delete(k))
  );
}

async function registrarSesion(usuarioId, rol) {
  if (!usuarioId) return;
  // El rol se guarda siempre: es lo que permite, sin señal, devolver la home
  // de quien está adentro en vez de una pantalla muerta.
  if (rol) {
    const cache = await caches.open(CACHE_SESION);
    await cache.put(URL_ROL, new Response(rol));
  }
  const anterior = await leerDueno();
  if (anterior === usuarioId) return;
  if (anterior !== null) await borrarCachesDeUsuario();
  await guardarDueno(usuarioId);
}

async function leerRol() {
  try {
    const cache = await caches.open(CACHE_SESION);
    const hit = await cache.match(URL_ROL);
    return hit ? await hit.text() : null;
  } catch {
    return null;
  }
}

async function olvidarSesion() {
  await borrarCachesDeUsuario();
  try {
    const cache = await caches.open(CACHE_SESION);
    await cache.delete(URL_DUENO);
    await cache.delete(URL_ROL);
  } catch {
    /* la caché de sesión no existe: nada que olvidar */
  }
}

self.addEventListener('message', (event) => {
  const dato = event.data;
  if (!dato || typeof dato !== 'object') return;
  if (dato.tipo === 'sesion') {
    event.waitUntil(registrarSesion(dato.usuarioId, dato.rol));
    return;
  }
  if (dato.tipo === 'cerrar-sesion') {
    event.waitUntil(olvidarSesion());
    return;
  }
  if (dato.tipo === 'precargar' && Array.isArray(dato.urls)) {
    event.waitUntil(precargarPantallas(dato.urls));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // Baldosas de mapa (satélite/terreno): cache-first con tope.
    if (HOSTS_BALDOSAS.includes(url.hostname)) {
      event.respondWith(cacheBaldosas(req));
    }
    return;
  }

  // No cachear endpoints de mutación
  if (
    url.pathname.startsWith('/api/trabajador/avance') ||
    url.pathname.startsWith('/api/trabajador/novedad') ||
    url.pathname.startsWith('/api/bodega/despacho') ||
    url.pathname.startsWith('/api/almacen/cosecha') ||
    url.pathname.startsWith('/api/almacen/salida') ||
    url.pathname.startsWith('/api/push') ||
    url.pathname.startsWith('/api/cron')
  ) {
    return;
  }

  // Snapshots de cualquier rol: network-first con fallback a cache
  if (
    url.pathname.startsWith('/api/trabajador/snapshot') ||
    url.pathname.startsWith('/api/bodega/snapshot') ||
    url.pathname.startsWith('/api/almacen/snapshot') ||
    url.pathname.startsWith('/api/jefe/snapshot')
  ) {
    event.respondWith(networkFirst(req, CACHE_DATOS));
    return;
  }

  // Navegación client-side de Next (peticiones RSC): network-first con
  // fallback a cache, para poder moverse entre páginas ya visitadas sin señal.
  const esRsc = req.headers.get('rsc') === '1' || url.searchParams.has('_rsc');
  if (esRsc && !url.pathname.startsWith('/api/')) {
    event.respondWith(rscNetworkFirst(req, url));
    return;
  }

  // Navegación HTML: cualquier ruta de la app con revalidación
  if (req.mode === 'navigate') {
    const esRutaApp =
      url.pathname === '/' ||
      RUTAS_NAVEGABLES.some((r) => url.pathname === r || url.pathname.startsWith(`${r}/`));
    if (esRutaApp) {
      event.respondWith(navegacionConFallback(req, url));
      return;
    }
  }

  // Recursos estáticos de Next (_next/static) → cache-first
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirst(req, CACHE_SHELL));
    return;
  }
});

async function navegacionConFallback(req, url) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    // Un reintento antes de rendirse: al abrir la app desde el icono, la radio
    // del celular a veces todavía no está lista y el primer fetch falla aunque
    // haya señal. Sin esto, abrir la app mostraba "sin señal" de la nada.
    let res;
    try {
      res = await fetch(req);
    } catch {
      res = await fetch(req);
    }
    // No cacheamos redirects: Safari rechaza responses cacheadas con .redirected=true.
    if (res.ok && !res.redirected) {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    // Sin red. Si piden "/", devolvemos un launcher que redirige según el rol.
    if (url.pathname === '/') {
      return new Response(LAUNCHER_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    // Cache directo de la ruta pedida
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;

    // Respaldo: la home DEL ROL QUE ESTÁ ADENTRO. Se puede porque las cachés se
    // borran al cambiar de cuenta, así que lo guardado es de esta persona y de
    // nadie más. Antes se devolvía la primera home que hubiera, sin mirar quién
    // estaba adentro, y un usuario de bodega terminaba en la del trabajador.
    const rol = await leerRol();
    const home = HOME_POR_ROL[rol];
    if (home) {
      const inicio = await cache.match(home, { ignoreVary: true });
      if (inicio) return inicio;
    }

    // No hay nada guardado. Suele ser la primera vez que se abre después de una
    // actualización: el worker nuevo borra lo viejo y hace falta una carga con
    // internet para volver a llenarlo.
    return new Response(
      paginaSinSenal(
        'No hay nada guardado todavía en este celular. Conectate a internet una vez y vuelve a abrir la app.'
      ),
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Deja listas para usar sin señal las pantallas que la app pida.
 *
 * Hacen falta dos respuestas por pantalla: el HTML (para cuando se abre la app
 * de cero o se recarga) y el payload RSC (para cuando se llega navegando con un
 * Link desde adentro). El prefetch de Next no sirve: trae payloads parciales y
 * `rscNetworkFirst` los descarta a propósito.
 */
const PRECARGA_CONCURRENCIA = 3;
const PRECARGA_MAX = 60;

async function precargarUna(url, shell, datos) {
  // Las dos piezas de la misma pantalla se piden a la vez: en serie, con varias
  // tareas asignadas, la precarga tardaba tanto que el trabajador salía al
  // campo antes de que terminara.
  const [html, rsc] = await Promise.all([
    fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } }),
    fetch(url.href, { credentials: 'same-origin', headers: { RSC: '1' } }),
  ]);
  if (html.ok && !html.redirected) await shell.put(url.href, html.clone());
  if (rsc.ok && !rsc.redirected) await datos.put(claveRsc(url), rsc.clone());
}

async function precargarPantallas(urls) {
  const shell = await caches.open(CACHE_SHELL);
  const datos = await caches.open(CACHE_DATOS);

  const lista = [];
  for (const raw of urls.slice(0, PRECARGA_MAX)) {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin === self.location.origin) lista.push(url);
    } catch {
      // URL inservible: se ignora.
    }
  }

  let siguiente = 0;
  async function turno() {
    while (siguiente < lista.length) {
      const url = lista[siguiente++];
      try {
        await precargarUna(url, shell, datos);
      } catch {
        // Se cortó la señal: lo que falte se precarga en la próxima carga.
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PRECARGA_CONCURRENCIA, lista.length) }, turno));
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// El payload RSC de una misma página llega con `?_rsc=<hash>` distinto cada
// vez; se normaliza la URL para que el cache funcione por página.
function claveRsc(url) {
  const u = new URL(url.href);
  u.searchParams.delete('_rsc');
  u.searchParams.append('_zelanda_rsc', '1');
  return u.href;
}

async function rscNetworkFirst(req, url) {
  const cache = await caches.open(CACHE_DATOS);
  // Los prefetch traen payloads parciales: no sirven como respaldo offline.
  const esPrefetch =
    req.headers.get('next-router-prefetch') === '1' || req.headers.get('purpose') === 'prefetch';
  const clave = claveRsc(url);
  try {
    const res = await fetch(req);
    if (res.ok && !esPrefetch) {
      cache.put(clave, res.clone());
    }
    return res;
  } catch {
    const hit = await cache.match(clave);
    if (hit) return hit;
    return Response.error();
  }
}

async function cacheBaldosas(req) {
  const cache = await caches.open(CACHE_BALDOSAS);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Las baldosas pueden llegar opacas (no-cors desde <img>); también se cachean.
    if (res.ok || res.type === 'opaque') {
      await cache.put(req, res.clone());
      // Tope FIFO: borrar las más viejas si nos pasamos.
      const claves = await cache.keys();
      if (claves.length > MAX_BALDOSAS) {
        for (const vieja of claves.slice(0, claves.length - MAX_BALDOSAS)) {
          await cache.delete(vieja);
        }
      }
    }
    return res;
  } catch {
    return Response.error();
  }
}

// === Push ===

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { titulo: 'La Zelanda', cuerpo: event.data.text() };
  }
  const titulo = payload.titulo || 'La Zelanda';
  const opciones = {
    body: payload.cuerpo || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || undefined,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.endsWith(url) && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
