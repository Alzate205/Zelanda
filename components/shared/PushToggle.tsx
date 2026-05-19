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

  async function refrescar() {
    if (typeof window === "undefined") return;
    if (
      !("Notification" in window) ||
      !("PushManager" in window) ||
      !("serviceWorker" in navigator)
    ) {
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

  useEffect(() => {
    refrescar();
  }, []);

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
        applicationServerKey: urlBase64ToUint8Array(pub) as BufferSource,
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
