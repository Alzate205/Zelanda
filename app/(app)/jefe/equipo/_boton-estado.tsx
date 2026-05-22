"use client";

import { cambiarEstadoMiembro } from "./acciones";

export function BotonEstadoMiembro({
  id,
  nombre,
  activo,
}: {
  id: string;
  nombre: string;
  activo: boolean;
}) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (activo) {
      const ok = window.confirm(
        `¿Desactivar a ${nombre}? Va a perder acceso al sistema. Podés reactivarlo después.`,
      );
      if (!ok) {
        e.preventDefault();
      }
    }
  }

  return (
    <form action={cambiarEstadoMiembro} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={activo ? "false" : "true"} />
      <button
        type="submit"
        className="min-h-touch rounded-lg px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:bg-zelanda-beige-100 hover:text-zelanda-verde-900"
      >
        {activo ? "Desactivar" : "Reactivar"}
      </button>
    </form>
  );
}
