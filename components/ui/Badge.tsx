import { cn } from "@/lib/utils";

export type EstadoBadge = "aldia" | "proxima" | "vencida" | "neutro";

const ESTILOS: Record<
  EstadoBadge,
  { wrap: string; dot: string; label: string }
> = {
  aldia: {
    wrap: "bg-[#e1ecde] text-zelanda-verde-800",
    dot: "bg-estado-aldia",
    label: "Al día",
  },
  proxima: {
    wrap: "bg-[#f8ebd1] text-zelanda-ocre-700",
    dot: "bg-estado-proxima",
    label: "Próxima",
  },
  vencida: {
    wrap: "bg-[#f4dad7] text-[#7b2a23]",
    dot: "bg-estado-vencida",
    label: "Vencida",
  },
  neutro: {
    wrap: "bg-[#e8e6e1] text-[#4b4843]",
    dot: "bg-estado-neutro",
    label: "Programada",
  },
};

export function Badge({
  estado,
  children,
  className,
}: {
  estado: EstadoBadge;
  children?: React.ReactNode;
  className?: string;
}) {
  const c = ESTILOS[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-none tracking-[0.02em]",
        c.wrap,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {children ?? c.label}
    </span>
  );
}
