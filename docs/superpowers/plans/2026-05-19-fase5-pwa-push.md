# Fase 5 sub-proyecto 1 — PWA + Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir FincApp en PWA instalable y agregar notificaciones push para 4 eventos (asignación nueva, novedad reportada, stock bajo, resumen diario vencidas).

**Architecture:** Service worker manual (`public/sw.js`) + manifest + manifest meta tags. Web Push API con VAPID y librería `web-push` del lado server. Tabla `push_subscriptions` para guardar endpoints. Disparadores en server actions existentes + endpoint cron protegido por `CRON_SECRET`.

**Tech Stack:** Next.js 15.5, React 19, Prisma 6.19, Supabase, `web-push` (NPM).

**Spec:** `docs/superpowers/specs/2026-05-19-fase5-pwa-push-design.md`

**Convenciones:**
- Idioma español en UI/código/commits.
- Sin emojis en UI.
- `min-h-touch` (44px) en botones.
- BigInt → toString() antes de pasar a cliente.
- Server actions devuelven `EstadoEdicion` cuando aplica.

---

## Task 1: Schema migration + Prisma sync + dependencias

**Files:**
- Create: `supabase/migracion-fase5-push.sql`
- Modify: `prisma/schema.prisma`
- Modify: `esquema.sql`
- Modify: `package.json` (add web-push)

- [ ] **Step 1: Crear SQL idempotente**

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

- [ ] **Step 2: Aplicar el SQL en Supabase**

Manual: SQL Editor de Supabase proyecto `gyburlhzvisgmdmfkqhx`. Pegar y ejecutar.

- [ ] **Step 3: Agregar modelo a `prisma/schema.prisma`**

Agregar al final de `model usuarios`:
```prisma
  push_subscriptions push_subscriptions[]
```

Agregar nuevo modelo:
```prisma
model push_subscriptions {
  id          BigInt   @id @default(autoincrement())
  usuario_id  String   @db.Uuid
  endpoint    String   @unique
  p256dh      String
  auth        String
  user_agent  String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  usuarios    usuarios @relation(fields: [usuario_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@index([usuario_id], map: "idx_push_usuario")
  @@schema("public")
}
```

- [ ] **Step 4: Reflejar en `esquema.sql`**

Después de la tabla `usuarios`, agregar:
```sql
CREATE TABLE push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_usuario ON push_subscriptions(usuario_id);
```

- [ ] **Step 5: Instalar web-push**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 6: Verificar build + typecheck**

```bash
npx prisma generate
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migracion-fase5-push.sql prisma/schema.prisma esquema.sql package.json package-lock.json
git commit -m "feat(fase5): tabla push_subscriptions + dependencia web-push"
```

---

## Task 2: VAPID keys + variables de entorno

**Files:** ninguno (paso manual del usuario)

- [ ] **Step 1: Generar VAPID keys (manual del usuario)**

```bash
npx web-push generate-vapid-keys
```

Output:
```
=======================================
Public Key:
<base64-public>

Private Key:
<base64-private>
=======================================
```

- [ ] **Step 2: Agregar a `.env.local` (manual del usuario)**

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64-public>
VAPID_PRIVATE_KEY=<base64-private>
VAPID_SUBJECT=mailto:samuelalzateberrio@gmail.com
CRON_SECRET=<openssl rand -base64 32>
```

- [ ] **Step 3: Agregar a Vercel (manual del usuario)**

Dashboard Vercel → Project zelanda → Settings → Environment Variables → agregar las 4 variables, marcar todas para Production. Después un nuevo deploy las recoge.

---

## Task 3: Iconos placeholder + manifest

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/manifest.webmanifest`

- [ ] **Step 1: Generar iconos con script Node**

Crear `scripts/generar-iconos.mjs` que use canvas-node (o si está disponible, ImageMagick via spawn). Implementación con un PNG mínimo armado con la librería estándar Buffer es compleja; alternativa práctica:

Usar `sharp` temporalmente solo para esto. Comando:
```bash
npm install -D sharp
```

Después `scripts/generar-iconos.mjs`:
```js
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (size) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#3D5C42"/>
  <text x="50%" y="55%" font-family="Georgia, serif" font-size="${size * 0.6}" fill="white" text-anchor="middle" dominant-baseline="middle">Z</text>
</svg>`;

await mkdir("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}
```

Ejecutar:
```bash
node scripts/generar-iconos.mjs
```

Después de generar, **desinstalar sharp** (solo se usó para esto):
```bash
npm uninstall sharp
```

- [ ] **Step 2: Crear `public/manifest.webmanifest`**

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

- [ ] **Step 3: Commit**

```bash
git add public/icons public/manifest.webmanifest scripts/generar-iconos.mjs package.json package-lock.json
git commit -m "feat(fase5): manifest PWA e iconos placeholder"
```

---

## Task 4: Service worker + registro

**Files:**
- Create: `public/sw.js`
- Create: `components/shared/RegistroSW.tsx`
- Modify: `app/layout.tsx` (agregar manifest links + RegistroSW)

- [ ] **Step 1: Crear `public/sw.js`**

```js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
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
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.endsWith(url) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Crear `components/shared/RegistroSW.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export function RegistroSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed", err);
    });
  }, []);
  return null;
}
```

- [ ] **Step 3: Modificar `app/layout.tsx`**

Leer primero el archivo actual con Read. Agregar en el `<head>` (o vía metadata) los links del manifest y el componente RegistroSW en el body.

Buscar el `<html>` o `<body>` y agregar dentro de body o como hijo del layout `<RegistroSW />`. Si el layout usa `metadata` exportada de Next, agregar:

```tsx
export const metadata: Metadata = {
  // ... existente
  manifest: "/manifest.webmanifest",
  themeColor: "#3D5C42",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "La Zelanda",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};
```

Y dentro del JSX renderizar `<RegistroSW />` al final del body. Import:
```tsx
import { RegistroSW } from "@/components/shared/RegistroSW";
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add public/sw.js components/shared/RegistroSW.tsx app/layout.tsx
git commit -m "feat(fase5): service worker y registro automatico"
```

---

## Task 5: Helper de envío push + acciones suscribir/desuscribir

**Files:**
- Create: `lib/push/enviar.ts`
- Create: `app/(app)/_acciones/push.ts`

- [ ] **Step 1: Crear `lib/push/enviar.ts`**

```ts
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configurado = false;

function configurarVapid() {
  if (configurado) return;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !subject) {
    console.warn("VAPID env vars faltantes; push no se enviará");
    return;
  }
  webpush.setVapidDetails(subject, publica, privada);
  configurado = true;
}

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
  configurarVapid();
  if (!configurado) return;

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
          await prisma.push_subscriptions
            .delete({ where: { id: s.id } })
            .catch(() => {});
        } else {
          console.warn(`Push error (${code}) endpoint=${s.endpoint.slice(0, 40)}`);
        }
      }
    }),
  );
}
```

- [ ] **Step 2: Crear `app/(app)/_acciones/push.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

export async function suscribirPush(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const endpoint = String(formData.get("endpoint") ?? "");
  const p256dh = String(formData.get("p256dh") ?? "");
  const auth = String(formData.get("auth") ?? "");
  const userAgent =
    String(formData.get("userAgent") ?? "").slice(0, 500) || null;

  if (!endpoint || !p256dh || !auth) return;

  await prisma.push_subscriptions.upsert({
    where: { endpoint },
    create: {
      usuario_id: usuario.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    update: {
      usuario_id: usuario.id,
      p256dh,
      auth,
      user_agent: userAgent,
    },
  });
}

export async function desuscribirPush(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const endpoint = String(formData.get("endpoint") ?? "");
  if (!endpoint) return;

  await prisma.push_subscriptions
    .deleteMany({ where: { endpoint, usuario_id: usuario.id } })
    .catch(() => {});
}
```

**Nota:** verificar que `obtenerUsuarioActual` exista en `lib/auth.ts`. Si no, agregar:
```ts
export async function obtenerUsuarioActual() {
  const supabase = await crearClienteSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.usuarios.findUnique({ where: { id: user.id } });
}
```

(Si `requerirUsuario` ya hace algo similar pero con redirect, abstraer la parte de "obtener sin redirect" en `obtenerUsuarioActual` y refactorizar `requerirUsuario` para llamarla.)

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add lib/push "app/(app)/_acciones/push.ts" lib/auth.ts
git commit -m "feat(fase5): helper envio push y acciones suscribir/desuscribir"
```

---

## Task 6: PushPrompt banner

**Files:**
- Create: `components/shared/PushPrompt.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Crear `components/shared/PushPrompt.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { suscribirPush } from "../../app/(app)/_acciones/push";

const POSPONER_KEY = "push-postponed-until";
const POSPONER_DIAS = 7;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Plana = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Plana);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushPrompt() {
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    const pospuesto = localStorage.getItem(POSPONER_KEY);
    if (pospuesto && Number(pospuesto) > Date.now()) return;
    setMostrar(true);
  }, []);

  const activar = async () => {
    setEnviando(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMostrar(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        console.warn("VAPID public key faltante");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pub),
      });
      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", sub.endpoint);
      fd.set("p256dh", json.keys?.p256dh ?? "");
      fd.set("auth", json.keys?.auth ?? "");
      fd.set("userAgent", navigator.userAgent);
      await suscribirPush(fd);
      setMostrar(false);
    } catch (e) {
      console.warn("Suscripción push falló", e);
      setMostrar(false);
    } finally {
      setEnviando(false);
    }
  };

  const posponer = () => {
    localStorage.setItem(
      POSPONER_KEY,
      String(Date.now() + POSPONER_DIAS * 24 * 60 * 60 * 1000),
    );
    setMostrar(false);
  };

  if (!mostrar) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-screen-md px-3 pb-2">
      <div className="rounded-xl border border-zelanda-beige-300 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-zelanda-verde-700/10 p-2 text-zelanda-verde-800">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-zelanda-verde-900">
              Activar notificaciones
            </p>
            <p className="mt-1 text-xs text-zelanda-verde-700/80">
              Enterate de asignaciones, novedades y vencidas aunque no tengas
              la app abierta.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={activar}
                disabled={enviando}
                className="min-h-touch rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {enviando ? "Activando..." : "Activar"}
              </button>
              <button
                type="button"
                onClick={posponer}
                disabled={enviando}
                className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm text-zelanda-verde-700"
              >
                Más tarde
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={posponer}
            aria-label="Cerrar"
            className="text-zelanda-verde-700/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Agregar `<PushPrompt />` en `app/(app)/layout.tsx`**

Leer el archivo, identificar dónde montar (típicamente al final del body protegido, antes o después de `<BottomNav>`). Agregar import e instancia.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add components/shared/PushPrompt.tsx "app/(app)/layout.tsx"
git commit -m "feat(fase5): banner activacion push notifications"
```

---

## Task 7: Toggle en /mi-perfil

**Files:**
- Create: `components/shared/PushToggle.tsx`
- Modify: `app/(app)/mi-perfil/page.tsx`

- [ ] **Step 1: Crear `components/shared/PushToggle.tsx`**

Client component que muestra el estado actual del permiso + suscripción en este dispositivo y permite activar/desactivar.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  suscribirPush,
  desuscribirPush,
} from "../../app/(app)/_acciones/push";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Plana = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Plana);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "no-soporta" | "denegado" | "activo" | "inactivo" | "cargando";

export function PushToggle() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    refrescar();
  }, []);

  async function refrescar() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
      setEstado("no-soporta");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setEstado(sub ? "activo" : "inactivo");
  }

  async function activar() {
    setTrabajando(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        await refrescar();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pub),
      });
      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", sub.endpoint);
      fd.set("p256dh", json.keys?.p256dh ?? "");
      fd.set("auth", json.keys?.auth ?? "");
      fd.set("userAgent", navigator.userAgent);
      await suscribirPush(fd);
      setEstado("activo");
    } catch (e) {
      console.warn("Activación push falló", e);
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await desuscribirPush(fd);
        await sub.unsubscribe();
      }
      setEstado("inactivo");
    } catch (e) {
      console.warn("Desactivación push falló", e);
    } finally {
      setTrabajando(false);
    }
  }

  if (estado === "cargando") {
    return <p className="text-sm text-zelanda-verde-700/70">Cargando...</p>;
  }
  if (estado === "no-soporta") {
    return (
      <p className="text-sm text-zelanda-verde-700/70">
        Este navegador no soporta notificaciones push.
      </p>
    );
  }
  if (estado === "denegado") {
    return (
      <p className="text-sm text-estado-vencida">
        Permiso denegado en el navegador. Activá los permisos en Ajustes del
        sitio para poder recibir notificaciones.
      </p>
    );
  }
  if (estado === "activo") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zelanda-verde-900">
          <Bell className="h-4 w-4 text-zelanda-verde-700" />
          Notificaciones activas en este dispositivo
        </div>
        <button
          type="button"
          onClick={desactivar}
          disabled={trabajando}
          className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm text-zelanda-verde-700 disabled:opacity-60"
        >
          {trabajando ? "..." : "Desactivar"}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-zelanda-verde-700/70">
        <BellOff className="h-4 w-4" />
        Notificaciones desactivadas
      </div>
      <button
        type="button"
        onClick={activar}
        disabled={trabajando}
        className="min-h-touch rounded-lg bg-zelanda-verde-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {trabajando ? "..." : "Activar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Agregar sección en `app/(app)/mi-perfil/page.tsx`**

Read del archivo. Agregar sección "Notificaciones" antes del cierre del div principal:
```tsx
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="font-serif text-lg text-zelanda-verde-900">Notificaciones</h2>
  <p className="mt-1 text-xs text-zelanda-verde-700/70">
    Recibí avisos de asignaciones, novedades y vencidas en este dispositivo.
  </p>
  <div className="mt-3">
    <PushToggle />
  </div>
</section>
```

Import al inicio:
```tsx
import { PushToggle } from "@/components/shared/PushToggle";
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add components/shared/PushToggle.tsx "app/(app)/mi-perfil/page.tsx"
git commit -m "feat(fase5): seccion notificaciones en mi-perfil"
```

---

## Task 8: Disparador en crearAsignacion

**Files:**
- Modify: `app/(app)/jefe/asignaciones/acciones.ts`

- [ ] **Step 1: Localizar la acción `crearAsignacion`**

Leer `app/(app)/jefe/asignaciones/acciones.ts`. Identificar dónde se hace el `prisma.asignaciones.create({...})` exitoso (después del try y antes del redirect).

- [ ] **Step 2: Agregar push al destinatario**

Justo después del create, antes del redirect:

```ts
// Push a la persona asignada (si tiene usuario)
try {
  const destinatario = await prisma.usuarios.findFirst({
    where: { persona_id: nueva.persona_id, activo: true },
    select: { id: true },
  });
  if (destinatario) {
    const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
    const ubicacion = lote?.nombre ?? apiario?.nombre ?? "—";
    await enviarPushAUsuarios([destinatario.id], {
      titulo: "Nueva tarea asignada",
      cuerpo: `${tipoTarea.nombre} · ${ubicacion}`,
      url: `/trabajador/avance/${nueva.id}`,
      tag: `asignacion-${nueva.id}`,
    });
  }
} catch (e) {
  console.warn("Push asignación falló:", e);
}
```

Notas:
- `nueva` es el objeto retornado del create. Si la variable tiene otro nombre, adaptar.
- `lote` y `apiario` son los datos que ya tiene el flujo. Si necesita un fetch extra, hacerlo (`prisma.lotes.findUnique` y `prisma.apiarios.findUnique`).
- `tipoTarea` debe estar disponible; si no, fetch: `prisma.tipos_tarea.findUnique({where: {id: tipoTareaId}, select: {nombre: true}})`.
- Si la acción no fetchea estos datos hoy, agregar los fetchs antes del push.
- El `try/catch` aísla el push para que un error no rompa la creación de la asignación.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add "app/(app)/jefe/asignaciones/acciones.ts"
git commit -m "feat(fase5): push al trabajador cuando se crea asignacion"
```

---

## Task 9: Disparador en crearNovedad

**Files:**
- Modify: `app/(app)/trabajador/novedad/nueva/acciones.ts`

- [ ] **Step 1: Localizar acción**

Leer el archivo. Identificar el create exitoso de novedad.

- [ ] **Step 2: Agregar push al jefe**

```ts
const ETIQUETA_TIPO_NOV: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

// Después del create:
try {
  const arbol = await prisma.arboles.findUnique({
    where: { id: arbolId },
    select: { numero_placa: true, lotes: { select: { nombre: true } } },
  });
  if (arbol) {
    const jefes = await prisma.usuarios.findMany({
      where: { rol: "JEFE", activo: true },
      select: { id: true },
    });
    if (jefes.length > 0) {
      const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
      await enviarPushAUsuarios(
        jefes.map((j) => j.id),
        {
          titulo: `Novedad: ${ETIQUETA_TIPO_NOV[tipo] ?? tipo}`,
          cuerpo: `Árbol ${arbol.numero_placa} · Lote ${arbol.lotes.nombre}`,
          url: `/jefe/novedades/${nuevaNovedad.id}`,
          tag: `novedad-${nuevaNovedad.id}`,
        },
      );
    }
  }
} catch (e) {
  console.warn("Push novedad falló:", e);
}
```

Adaptar variables según los nombres del archivo. Si `arbolId` no existe como variable, usar el campo de `formData` ya parseado.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add "app/(app)/trabajador/novedad/nueva/acciones.ts"
git commit -m "feat(fase5): push al jefe cuando se reporta novedad"
```

---

## Task 10: Helper stock-bajo + disparadores en despachos

**Files:**
- Create: `lib/push/stock-bajo.ts`
- Modify: `app/(app)/bodega/despachos/acciones.ts`

- [ ] **Step 1: Crear `lib/push/stock-bajo.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarPushAUsuarios } from "./enviar";

export async function snapshotDisponiblesAntes(
  insumoIds: bigint[],
): Promise<Map<string, number>> {
  if (insumoIds.length === 0) return new Map();
  const filas = await prisma.$queryRaw<
    { id: bigint; stock_disponible: string }[]
  >`
    SELECT id, stock_disponible::text
    FROM v_insumos_stock
    WHERE id IN (${Prisma.join(insumoIds)})
  `;
  const m = new Map<string, number>();
  for (const f of filas) {
    m.set(f.id.toString(), Number(f.stock_disponible));
  }
  return m;
}

export async function notificarStockBajoSiCorresponde(
  insumoIds: bigint[],
  disponiblesAntes: Map<string, number>,
): Promise<void> {
  if (insumoIds.length === 0) return;
  const actuales = await prisma.$queryRaw<
    {
      id: bigint;
      nombre: string;
      unidad: string;
      stock_disponible: string;
      stock_minimo: string;
    }[]
  >`
    SELECT id, nombre, unidad, stock_disponible::text, stock_minimo::text
    FROM v_insumos_stock
    WHERE id IN (${Prisma.join(insumoIds)})
  `;
  const cruzados = actuales.filter((i) => {
    const antes = disponiblesAntes.get(i.id.toString()) ?? Number.MAX_VALUE;
    const ahora = Number(i.stock_disponible);
    const min = Number(i.stock_minimo);
    return antes > min && ahora <= min;
  });
  if (cruzados.length === 0) return;

  const bodegueros = await prisma.usuarios.findMany({
    where: { rol: "BODEGA", activo: true },
    select: { id: true },
  });
  if (bodegueros.length === 0) return;

  await enviarPushAUsuarios(
    bodegueros.map((b) => b.id),
    {
      titulo:
        cruzados.length === 1
          ? `Stock bajo: ${cruzados[0].nombre}`
          : `${cruzados.length} insumos bajo mínimo`,
      cuerpo: cruzados
        .map(
          (c) =>
            `${c.nombre} (${Number(c.stock_disponible).toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${c.unidad})`,
        )
        .join(" · "),
      url: "/bodega/inventario?cat=INSUMOS",
      tag: "stock-bajo",
    },
  );
}
```

- [ ] **Step 2: Modificar `crearDespacho`**

Read del archivo. Identificar el bloque del transaction. ANTES de iniciar la transaction, calcular insumoIds involucrados:
```ts
const insumoIds = items
  .filter((it) => it.tipo === "INSUMO")
  .map((it) => BigInt(it.ref_id));
const disponiblesAntes = await snapshotDisponiblesAntes(insumoIds);
```

DESPUÉS de que la transaction se commitea exitosamente (después del `await prisma.$transaction(...)`, antes del revalidatePath/redirect):
```ts
try {
  await notificarStockBajoSiCorresponde(insumoIds, disponiblesAntes);
} catch (e) {
  console.warn("Push stock bajo falló:", e);
}
```

Imports:
```ts
import {
  notificarStockBajoSiCorresponde,
  snapshotDisponiblesAntes,
} from "@/lib/push/stock-bajo";
```

- [ ] **Step 3: Modificar `cerrarDespacho`**

Antes de la transaction, calcular insumoIds e snapshot:
```ts
const insumoIds = despacho.despacho_items
  .filter((it) => it.tipo_item === "INSUMO" && it.insumo_id !== null)
  .map((it) => it.insumo_id as bigint);
const disponiblesAntes = await snapshotDisponiblesAntes(insumoIds);
```

Después de la transaction:
```ts
try {
  await notificarStockBajoSiCorresponde(insumoIds, disponiblesAntes);
} catch (e) {
  console.warn("Push stock bajo falló:", e);
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add lib/push/stock-bajo.ts "app/(app)/bodega/despachos/acciones.ts"
git commit -m "feat(fase5): push a bodega cuando insumo cruza minimo"
```

---

## Task 11: Endpoint cron resumen diario + vercel.json

**Files:**
- Create: `app/api/cron/resumen-vencidas/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Crear el endpoint**

`app/api/cron/resumen-vencidas/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularResumen } from "@/lib/fechas-tarea";
import { enviarPushAUsuarios } from "@/lib/push/enviar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [lotes, tiposCultivo, frecuenciasOverride, completadasLote] =
    await Promise.all([
      prisma.lotes.findMany({
        where: { deleted_at: null },
        select: { id: true },
      }),
      prisma.tipos_tarea.findMany({
        where: { area: "CULTIVO", activo: true },
        select: { id: true, frecuencia_dias_default: true },
      }),
      prisma.frecuencias_lote.findMany({
        select: {
          lote_id: true,
          tipo_tarea_id: true,
          frecuencia_dias: true,
        },
      }),
      prisma.asignaciones.groupBy({
        by: ["lote_id", "tipo_tarea_id"],
        where: { estado: "COMPLETADA", lote_id: { not: null } },
        _max: { fecha_completada: true },
      }),
    ]);

  const mapaFreq = new Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }
  const mapaUlt = new Map<string, Date | null>();
  for (const c of completadasLote) {
    if (c.lote_id) {
      mapaUlt.set(`${c.lote_id}_${c.tipo_tarea_id}`, c._max.fecha_completada);
    }
  }

  let totalVencidas = 0;
  let totalProximas = 0;
  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUlt.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const r = calcularResumen(ultima, freq);
      if (r.estado === "vencida" || r.estado === "sin_historial") totalVencidas++;
      else if (r.estado === "proxima") totalProximas++;
    }
  }

  if (totalVencidas + totalProximas === 0) {
    return NextResponse.json({ enviado: false, motivo: "nada-que-reportar" });
  }

  const jefes = await prisma.usuarios.findMany({
    where: { rol: "JEFE", activo: true },
    select: { id: true },
  });
  if (jefes.length === 0) {
    return NextResponse.json({ enviado: false, motivo: "sin-jefes-activos" });
  }

  const cuerpoPartes: string[] = [];
  if (totalVencidas > 0) {
    cuerpoPartes.push(
      `${totalVencidas} vencida${totalVencidas === 1 ? "" : "s"}`,
    );
  }
  if (totalProximas > 0) {
    cuerpoPartes.push(
      `${totalProximas} próxima${totalProximas === 1 ? "" : "s"}`,
    );
  }

  await enviarPushAUsuarios(
    jefes.map((j) => j.id),
    {
      titulo: "Resumen del día",
      cuerpo: cuerpoPartes.join(", "),
      url: "/jefe",
      tag: "resumen-diario",
    },
  );

  return NextResponse.json({ enviado: true, totalVencidas, totalProximas });
}
```

- [ ] **Step 2: Crear `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/resumen-vencidas", "schedule": "0 22 * * *" }
  ]
}
```

`0 22 * * *` = 22:00 UTC = 5:00 PM Colombia (UTC-5).

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add app/api/cron/resumen-vencidas/route.ts vercel.json
git commit -m "feat(fase5): endpoint cron resumen diario para jefe"
```

---

## Task 12: Verificación final + push

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: PASS sin errores. Anotar número de rutas.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Configurar vars en Vercel (manual)**

En el dashboard de Vercel, agregar las 4 vars del Task 2 a Production. Hacer redeploy.

- [ ] **Step 5: Smoke test después del deploy**

1. En Chrome móvil → abrir `zelanda.vercel.app` → ver opción "Instalar app" → instalar.
2. Login → banner pide permiso → activar.
3. Verificar en Supabase tabla `push_subscriptions` que se guardó la suscripción.
4. Como jefe, crear asignación a un trabajador con usuario → debería recibir push.
5. Como ese trabajador, reportar novedad → el jefe debería recibir push.
6. Crear despacho que deje un insumo bajo mínimo → bodega recibe push.
7. Esperar 5:00 PM Colombia (o invocar manualmente con curl + CRON_SECRET) → jefe recibe resumen.
8. /mi-perfil → desactivar → confirmar que ya no llegan.

Invocación manual del cron (para probar antes de las 5 PM):
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://zelanda.vercel.app/api/cron/resumen-vencidas
```

---

## Self-review checklist

- [x] Cada tarea tiene archivos exactos y código completo.
- [x] Migración SQL idempotente.
- [x] Push siempre dentro de try/catch (no rompe la transacción principal).
- [x] Helper `enviarPushAUsuarios` limpia subs muertas (404/410).
- [x] VAPID keys solo en server excepto `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- [x] Cron protegido con `CRON_SECRET`.
- [x] Stock bajo: solo cruza umbral (no spam).
- [x] Resumen diario: no manda push vacíos.
- [x] PushPrompt respetuoso: dismissible, posponer 7 días.
- [x] Toggle perfil maneja todos los estados (no-soporta, denegado, activo, inactivo).
