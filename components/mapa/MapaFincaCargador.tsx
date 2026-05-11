"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// Leaflet usa `window` y `document`, así que el componente real se carga
// solo en cliente (ssr:false). Este wrapper existe porque `dynamic({ssr:false})`
// no se puede invocar desde un Server Component.
const MapaFinca = dynamic(() => import("./MapaFinca"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

export function MapaFincaCargador(props: ComponentProps<typeof MapaFinca>) {
  return <MapaFinca {...props} />;
}
