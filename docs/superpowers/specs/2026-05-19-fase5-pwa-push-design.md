# Fase 5 sub-proyecto 1 — PWA instalable + Push notifications

> Fecha: 2026-05-19
> Autor: Samuel Alzate + Claude

## 1. Objetivo

Convertir FincApp en PWA instalable al home screen y agregar notificaciones push para 4 eventos clave: nueva asignación (al trabajador), novedad reportada (al jefe), resumen diario de vencidas (al jefe, 5 PM Colombia) y stock bajo (a bodega).

## 2. Alcance

**Adentro:**
- Manifest + iconos placeholder + meta tags para PWA instalable.
- Service worker mínimo (`public/sw.js`) que maneja `push` y `notificationclick`. Sin offline caching todavía.
- VAPID keys configuradas en env.
- Tabla `push_subscriptions` + RLS.
- Acción `suscribir(p256dh, auth, endpoint)` y `desuscribir(endpoint)`.
- Componente `<PushPrompt>` (banner en layout autenticado).
- Sección "Notificaciones" en `/mi-perfil`.
- Helper server `enviarPushAUsuarios(usuarioIds, payload)`.
- 3 disparadores en server actions existentes + 1 endpoint cron protegido.
- Configuración de Vercel Cron en `vercel.json`.

**Afuera:**
- Modo offline completo (próximo sub-proyecto).
- Página de notificaciones (lista histórica). Las push son fire-and-forget.
- Personalización fina de qué eventos quiere cada usuario (toggle global on/off por ahora).
- Notificaciones por email/SMS (solo Web Push).

## 3. Eventos

| Evento | Disparador | Destinatarios | URL al tocar |
|---|---|---|---|
| Nueva asignación | `crearAsignacion` (post insert) | `usuarios` donde `persona_id = nueva.persona_id` | `/trabajador/avance/<asignacion_id>` |
| Novedad reportada | `crearNovedad` (post insert) | `usuarios` donde `rol='JEFE' AND activo` | `/jefe/novedades/<id>` |
| Stock bajo | Al final de `crearDespacho` y `cerrarDespacho`, chequear si algún insumo del despacho quedó `stock_disponible <= stock_minimo`; si sí, push al rol BODEGA | `usuarios` donde `rol='BODEGA' AND activo` | `/bodega/inventario?cat=INSUMOS` |
| Resumen vencidas | Cron diario 5 PM Colombia (22:00 UTC) | `usuarios` donde `rol='JEFE' AND activo` | `/jefe` |

Stock bajo: para evitar spam, solo se manda si el item cruzó el umbral en esta operación (estaba por encima antes, ahora está por debajo o igual). Para `crearDespacho` chequea contra el snapshot pre-transacción; para `cerrarDespacho` lo mismo.

Resumen vencidas: contenido del cuerpo "N tareas vencidas, M próximas a vencer". Solo se manda si N+M > 0.

## 4. Cambio de esquema

`supabase/migracion-fase5-push.sql`:
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_subscriptions(usuario_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_select_propio ON push_subscriptions;
CREATE POLICY push_select_propio ON push_subscriptions FOR SELECT
  USING (usuario_id = auth.uid() OR public.es_jefe());

DROP POLICY IF EXISTS push_insert_propio ON push_subscriptions;
CREATE POLICY push_insert_propio ON push_subscriptions FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS push_delete_propio ON push_subscriptions;
CREATE POLICY push_delete_propio ON push_subscriptions FOR DELETE
  USING (usuario_id = auth.uid() OR public.es_jefe());

COMMIT;
```

Reflejar en `esquema.sql`. Las acciones del server bypassean RLS por usar service role, pero las policies son defense-in-depth.

## 5. Variables de entorno nuevas

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64-public>
VAPID_PRIVATE_KEY=<base64-private>
VAPID_SUBJECT=mailto:samuelalzateberrio@gmail.com
CRON_SECRET=<random-32-bytes-base64>
```

Generación de VAPID:
```bash
npx web-push generate-vapid-keys
```

`CRON_SECRET` se compara contra el header `Authorization: Bearer <secret>` que envía Vercel Cron.

## 6. Manifest y meta tags

`public/manifest.webmanifest`:
```json
{
  "name": "Hacienda La Zelanda",
  "short_name": "La Zelanda",
  "description": "Sistema de gestión de la finca",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5F1E8",
  "theme_color": "#3D5C42",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

En `app/layout.tsx` agregar:
```tsx
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#3D5C42" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

Generar los dos PNG con Node script al hacer build (placeholder verde con "Z" en serif blanca). Commit los iconos al repo.

## 7. Service worker

`public/sw.js`:
```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { /* ignore */ }
  const titulo = payload.titulo || "La Zelanda";
  const opciones = {
    body: payload.cuerpo || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
```

Registro del SW: componente client `<RegistroSW>` que corre `navigator.serviceWorker.register("/sw.js")` al montar (si está disponible). Se incluye una vez en el layout.

## 8. Activación del lado cliente

### Banner `<PushPrompt>`

Componente cliente que se monta en `app/(app)/layout.tsx`. Lógica al montar:
```ts
if (!("Notification" in window) || !("PushManager" in window)) return;
const perm = Notification.permission;
if (perm !== "default") return; // ya decidió, no mostrar
const postponed = localStorage.getItem("push-postponed-until");
if (postponed && Number(postponed) > Date.now()) return;
setMostrar(true);
```

UI: banner fijo encima del bottom nav.
```
[Activar notificaciones]
Recibí avisos de asignaciones, novedades y vencidas
aunque no tengas la app abierta.
[Activar] [Más tarde]
```

Al tocar "Activar":
```ts
const perm = await Notification.requestPermission();
if (perm !== "granted") return;
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY),
});
await suscribir({ endpoint, p256dh, auth, userAgent });
```

Al tocar "Más tarde": `localStorage.setItem("push-postponed-until", Date.now() + 7*24*60*60*1000)`.

### Sección en `/mi-perfil`

Componente cliente que muestra el estado actual:
- Si `Notification.permission === "denied"`: nota "Activá los permisos del navegador en Ajustes del sitio".
- Si está suscrito en este dispositivo: "Activas" + botón "Desactivar" (llama `desuscribir`).
- Si no está suscrito: "Desactivadas" + botón "Activar" (mismo flujo que el banner).

## 9. Server actions y helpers

### `lib/push/enviar.ts`

```ts
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  url?: string;
  tag?: string;
};

export async function enviarPushAUsuarios(
  usuarioIds: string[],
  payload: PayloadPush,
): Promise<void> {
  if (usuarioIds.length === 0) return;
  const subs = await prisma.push_subscriptions.findMany({
    where: { usuario_id: { in: usuarioIds } },
  });
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.push_subscriptions.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}
```

### `app/(app)/_acciones/push.ts`

```ts
"use server";

export async function suscribir(formData: FormData) {
  const usuario = await requerirUsuarioCualquierRol();
  const endpoint = String(formData.get("endpoint"));
  const p256dh = String(formData.get("p256dh"));
  const auth = String(formData.get("auth"));
  const userAgent = String(formData.get("userAgent") ?? "").slice(0, 500) || null;
  if (!endpoint || !p256dh || !auth) return;
  await prisma.push_subscriptions.upsert({
    where: { endpoint },
    create: { usuario_id: usuario.id, endpoint, p256dh, auth, user_agent: userAgent },
    update: { usuario_id: usuario.id, p256dh, auth, user_agent: userAgent },
  });
}

export async function desuscribir(formData: FormData) {
  await requerirUsuarioCualquierRol();
  const endpoint = String(formData.get("endpoint"));
  if (!endpoint) return;
  await prisma.push_subscriptions.delete({ where: { endpoint } }).catch(() => {});
}
```

### Disparadores en acciones existentes

**`crearAsignacion`** (en `app/(app)/jefe/asignaciones/acciones.ts`): después del insert exitoso:
```ts
const destinatario = await prisma.usuarios.findFirst({
  where: { persona_id: nueva.persona_id, activo: true },
});
if (destinatario) {
  await enviarPushAUsuarios([destinatario.id], {
    titulo: "Nueva tarea asignada",
    cuerpo: `${tipoTarea.nombre} · ${lote?.nombre ?? apiario?.nombre}`,
    url: `/trabajador/avance/${nueva.id}`,
    tag: `asignacion-${nueva.id}`,
  });
}
```

**`crearNovedad`** (en `app/(app)/trabajador/novedad/nueva/acciones.ts`): después del insert:
```ts
const jefes = await prisma.usuarios.findMany({
  where: { rol: "JEFE", activo: true },
  select: { id: true },
});
await enviarPushAUsuarios(jefes.map((j) => j.id), {
  titulo: `Novedad: ${ETIQUETA[tipo]}`,
  cuerpo: `Árbol ${arbol.numero_placa} · Lote ${arbol.lotes.nombre}`,
  url: `/jefe/novedades/${creada.id}`,
  tag: `novedad-${creada.id}`,
});
```

**Stock bajo en `crearDespacho` y `cerrarDespacho`** (en `app/(app)/bodega/despachos/acciones.ts`): después del commit, comparar el snapshot pre y post para cada `insumo_id` involucrado. Si alguno cruzó el mínimo (antes `disponible > minimo`, ahora `disponible <= minimo`), mandar push a BODEGA. Ver lib helper abajo.

`lib/push/stock-bajo.ts`:
```ts
export async function notificarStockBajoSiCorresponde(
  insumoIds: bigint[],
  disponibleAntes: Map<string, number>,
): Promise<void> {
  if (insumoIds.length === 0) return;
  const actuales = await prisma.$queryRaw<
    { id: bigint; nombre: string; unidad: string; stock_disponible: string; stock_minimo: string }[]
  >`
    SELECT id, nombre, unidad, stock_disponible::text, stock_minimo::text
    FROM v_insumos_stock
    WHERE id IN (${Prisma.join(insumoIds)})
  `;
  const cruzados = actuales.filter((i) => {
    const antes = disponibleAntes.get(i.id.toString()) ?? Number.MAX_VALUE;
    const ahora = Number(i.stock_disponible);
    const min = Number(i.stock_minimo);
    return antes > min && ahora <= min;
  });
  if (cruzados.length === 0) return;
  const bodegueros = await prisma.usuarios.findMany({
    where: { rol: "BODEGA", activo: true },
    select: { id: true },
  });
  await enviarPushAUsuarios(bodegueros.map((b) => b.id), {
    titulo: cruzados.length === 1 ? `Stock bajo: ${cruzados[0].nombre}` : `${cruzados.length} insumos bajo mínimo`,
    cuerpo: cruzados.map((c) => `${c.nombre} (${c.stock_disponible} ${c.unidad})`).join(" · "),
    url: "/bodega/inventario?cat=INSUMOS",
    tag: "stock-bajo",
  });
}
```

### Endpoint cron diario

`app/api/cron/resumen-vencidas/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularResumen } from "@/lib/fechas-tarea";
import { enviarPushAUsuarios } from "@/lib/push/enviar";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Reutilizar la lógica que ya tiene /jefe/page.tsx para vencidas + próximas
  // [implementación detallada en el plan]

  const totalVencidas = ...;
  const totalProximas = ...;
  if (totalVencidas + totalProximas === 0) return NextResponse.json({ enviado: false });

  const jefes = await prisma.usuarios.findMany({
    where: { rol: "JEFE", activo: true },
    select: { id: true },
  });
  await enviarPushAUsuarios(jefes.map((j) => j.id), {
    titulo: "Resumen diario",
    cuerpo: `${totalVencidas} vencida${totalVencidas === 1 ? "" : "s"}, ${totalProximas} próxima${totalProximas === 1 ? "" : "s"}`,
    url: "/jefe",
    tag: "resumen-diario",
  });
  return NextResponse.json({ enviado: true, totalVencidas, totalProximas });
}
```

### Vercel Cron config

`vercel.json` (nuevo en la raíz):
```json
{
  "crons": [
    { "path": "/api/cron/resumen-vencidas", "schedule": "0 22 * * *" }
  ]
}
```

`0 22 * * *` en UTC = 5:00 PM Colombia (UTC-5).

## 10. Permisos en server actions

`suscribir` y `desuscribir` requieren autenticación pero cualquier rol. Helper `requerirUsuarioCualquierRol()`:
```ts
export async function requerirUsuarioCualquierRol() {
  const user = await obtenerUsuarioActual();
  if (!user) redirect("/login");
  return user;
}
```

Si `obtenerUsuarioActual` ya existe en `lib/auth.ts`, reutilizar. Si no, agregar.

## 11. Iconos placeholder

Script `scripts/generar-iconos.mjs` que con `sharp` o canvas-node genera dos PNG. Como `sharp` puede ser pesado, opción simple: dos archivos `icon-192.png` y `icon-512.png` ya generados manualmente (fondo verde `#3D5C42`, letra "Z" blanca centrada serif). Genero los archivos directo en el plan, sin script.

## 12. Decisiones explícitas

| # | Decisión | Razón |
|---|---|---|
| 1 | Service worker manual, sin next-pwa | Mayor control con Next 15, evitar deps. Una sola pieza. |
| 2 | Banner al login + toggle perfil | Banner asegura adopción; toggle permite control. |
| 3 | Una suscripción por endpoint (upsert) | Permite múltiples dispositivos por usuario sin duplicados. |
| 4 | Limpieza automática si endpoint expira (410) | Evita acumular suscripciones muertas. |
| 5 | Stock bajo: solo si cruza umbral en la op | Evita spam constante mientras esté bajo. |
| 6 | Cron diario solo si hay algo que reportar | Evita push vacíos. |
| 7 | Tag por evento (asignacion-X, novedad-Y, etc.) | Notificaciones del mismo tipo se reemplazan; no se acumulan 20 push si hay 20 novedades en un rato — la última agrupa. Excepción: el tag distingue, mantenerlas separadas es OK pero ayuda a no spamear. |
| 8 | Iconos placeholder al inicio | Logo real cuando esté listo; reemplazar archivos. |
| 9 | Sin página de notificaciones histórica | Las push son fire-and-forget; el contexto está en la pantalla destino. |
| 10 | Toggle global (no por evento) | Simpler; iteramos si hace falta granularidad. |

## 13. UX detallada

- Banner al login: dismissible por 7 días con "Más tarde".
- Si el usuario cambia de dispositivo, el banner vuelve a aparecer (porque cada navegador es nuevo).
- Si revoca permisos en el SO, la suscripción queda huérfana — el primer push fallido la limpia.
- En `/mi-perfil`, si está suscrito en este dispositivo pero también en otro, solo muestra/borra el de este.

## 14. Tests manuales

Después del deploy:
1. Abrir en Chrome móvil → ver botón "Instalar app" → instalar al home screen.
2. Abrir la app instalada → banner pide permiso → activar → permiso `granted`.
3. Como jefe, crear asignación a Diego → Diego recibe push.
4. Como Diego, reportar novedad de un árbol → jefe recibe push.
5. Como Diego, hacer cosecha de canastas (no aplica) → como Diego, crear despacho que deje un insumo bajo mínimo → bodega recibe push.
6. Esperar al cron de las 5 PM Colombia → si hay vencidas, jefe recibe push.
7. En /mi-perfil → desactivar → confirmar que ya no llegan.
