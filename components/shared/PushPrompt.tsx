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
        applicationServerKey: urlBase64ToUint8Array(pub) as BufferSource,
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
