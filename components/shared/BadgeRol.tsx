import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types";

const ESTILOS: Record<RolUsuario, string> = {
  JEFE: "bg-zelanda-verde-100 text-zelanda-verde-800 border-zelanda-verde-200",
  BODEGA: "bg-zelanda-ocre-50 text-zelanda-ocre-700 border-zelanda-ocre-200",
  ALMACEN: "bg-zelanda-beige-200 text-zelanda-verde-800 border-zelanda-beige-300",
  TRABAJADOR: "bg-zelanda-verde-50 text-zelanda-verde-700 border-zelanda-verde-100",
};

const ETIQUETAS: Record<RolUsuario, string> = {
  JEFE: "Jefe",
  BODEGA: "Bodega",
  ALMACEN: "Almacén",
  TRABAJADOR: "Trabajador",
};

export function BadgeRol({
  rol,
  className,
}: {
  rol: RolUsuario;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        ESTILOS[rol],
        className,
      )}
    >
      {ETIQUETAS[rol]}
    </span>
  );
}

export function BadgeBase({
  children,
  tono = "neutro",
  className,
}: {
  children: React.ReactNode;
  tono?: "neutro" | "alerta" | "info";
  className?: string;
}) {
  const estilos = {
    neutro: "bg-zelanda-beige-100 text-zelanda-verde-700 border-zelanda-beige-200",
    alerta: "bg-estado-vencida/10 text-estado-vencida border-estado-vencida/20",
    info: "bg-zelanda-ocre-50 text-zelanda-ocre-700 border-zelanda-ocre-200",
  }[tono];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        estilos,
        className,
      )}
    >
      {children}
    </span>
  );
}
