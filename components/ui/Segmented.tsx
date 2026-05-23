"use client";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  opciones,
  valor,
  onCambio,
  className,
}: {
  opciones: { id: T; etiqueta: React.ReactNode }[];
  valor: T;
  onCambio: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]",
        className,
      )}
    >
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onCambio(o.id)}
            className={cn(
              "rounded-lg px-2 py-2 text-[13px] font-semibold transition",
              activo
                ? "bg-white text-zelanda-verde-900 shadow-suave"
                : "text-zelanda-verde-700 hover:text-zelanda-verde-900",
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
