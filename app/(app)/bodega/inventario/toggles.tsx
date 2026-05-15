"use client";

import { cambiarEstadoHerramienta, cambiarEstadoInsumo } from "./acciones";

export function ToggleActivoHerramienta({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  return (
    <form action={cambiarEstadoHerramienta}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={String(!activo)} />
      <button
        type="submit"
        className={`min-h-touch rounded-lg px-3 text-xs ${
          activo
            ? "border border-zelanda-verde-700 text-zelanda-verde-700"
            : "bg-zelanda-verde-700 text-white"
        }`}
      >
        {activo ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}

export function ToggleActivoInsumo({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  return (
    <form action={cambiarEstadoInsumo}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={String(!activo)} />
      <button
        type="submit"
        className={`min-h-touch rounded-lg px-3 text-xs ${
          activo
            ? "border border-zelanda-verde-700 text-zelanda-verde-700"
            : "bg-zelanda-verde-700 text-white"
        }`}
      >
        {activo ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}
