import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Estado = "aldia" | "proxima" | "vencida" | "neutro";

const ESTILOS: Record<Estado, { borde: string; fondo: string; icono: string }> =
  {
    aldia: {
      borde: "border-l-estado-aldia",
      fondo: "bg-[#e9f0eb]",
      icono: "text-zelanda-verde-700",
    },
    proxima: {
      borde: "border-l-zelanda-ocre-400",
      fondo: "bg-[#fbf3df]",
      icono: "text-zelanda-ocre-700",
    },
    vencida: {
      borde: "border-l-estado-vencida",
      fondo: "bg-[#fcefec]",
      icono: "text-[#7b2a23]",
    },
    neutro: {
      borde: "border-l-zelanda-verde-300",
      fondo: "bg-[#f0eee8]",
      icono: "text-zelanda-verde-700",
    },
  };

export function AlertaItem({
  estado,
  icono: Icono,
  titulo,
  sub,
  href,
}: {
  estado: Estado;
  icono: LucideIcon;
  titulo: string;
  sub: string;
  href: string;
}) {
  const c = ESTILOS[estado];
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-l-[3px] border-zelanda-beige-200 bg-white px-3 py-2.5 shadow-suave transition hover:border-zelanda-verde-300",
        c.borde,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          c.fondo,
          c.icono,
        )}
      >
        <Icono className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
          {titulo}
        </p>
        <p className="mt-0.5 text-[12.5px] text-zelanda-verde-700">{sub}</p>
      </div>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-zelanda-verde-400" />
    </Link>
  );
}
