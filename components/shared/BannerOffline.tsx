"use client";

import Link from "next/link";
import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useColaPendientes } from "@/hooks/useColaPendientes";

export function BannerOffline() {
  const online = useOnlineStatus();
  const { total, errores } = useColaPendientes();

  if (online && total === 0) return null;

  let tono = "bg-zelanda-ocre-50 border-zelanda-ocre-300 text-zelanda-ocre-700";
  let Icono = CloudOff;
  let texto: string;

  if (!online && total > 0) {
    texto = `${total} pendiente${total === 1 ? "" : "s"} · Sin señal`;
  } else if (!online) {
    texto = "Sin señal";
  } else if (errores > 0) {
    tono = "bg-estado-vencida/10 border-estado-vencida/40 text-estado-vencida";
    Icono = AlertTriangle;
    texto = `${errores} con error · revisar`;
  } else {
    tono = "bg-zelanda-verde-50 border-zelanda-verde-300 text-zelanda-verde-800";
    Icono = RefreshCw;
    texto = `Sincronizando · ${total} pendiente${total === 1 ? "" : "s"}`;
  }

  const cuerpo = (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-suave ${tono}`}
    >
      <Icono className="h-3.5 w-3.5" />
      <span>{texto}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto flex max-w-screen-md justify-center px-4"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {total > 0 ? (
        <Link href="/trabajador/pendientes" aria-label="Ver pendientes">
          {cuerpo}
        </Link>
      ) : (
        cuerpo
      )}
    </div>
  );
}
