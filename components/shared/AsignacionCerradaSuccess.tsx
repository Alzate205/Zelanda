import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function AsignacionCerradaSuccess({
  loteNombre,
  tareaNombre,
  arboles,
  duracion,
  tramos,
  novedades,
  proxima,
  href = "/trabajador",
}: {
  loteNombre: string;
  tareaNombre: string;
  arboles: number;
  duracion: string;
  tramos: number;
  novedades: number;
  proxima: string;
  href?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <Image
          src="/logo-zelanda.png"
          alt=""
          width={200}
          height={336}
          style={{ height: 200, width: "auto" }}
          className="drop-shadow-lg"
        />
        <span
          className={cn(
            "absolute -right-2 top-1.5",
            "flex h-14 w-14 items-center justify-center rounded-full",
            "border-[3px] border-zelanda-beige-50 bg-zelanda-verde-700 text-zelanda-beige-50 shadow-card",
          )}
        >
          <Check className="h-7 w-7" strokeWidth={2.8} />
        </span>
      </div>
      <p className="mt-5 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
        Tarea cerrada
      </p>
      <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
        ¡{loteNombre}, listo!
      </h1>
      <p className="mt-1 max-w-[280px] text-sm text-zelanda-verde-700">
        {tareaNombre} · {arboles.toLocaleString("es-CO")} árboles · {duracion}
      </p>

      <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2.5 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Stat label="Árboles" valor={arboles.toLocaleString("es-CO")} />
        <Stat label="Tramos" valor={String(tramos)} />
        <Stat label="Novedades" valor={String(novedades)} />
        <Stat label="Próximo" valor={proxima} />
      </div>

      <Link
        href={href}
        className="mt-5 flex min-h-touch w-full max-w-xs items-center justify-center rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        Volver a mis tareas
      </Link>
    </div>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-zelanda-beige-50 px-2.5 py-2">
      <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-zelanda-verde-700">
        {label}
      </p>
      <p className="m-0 mt-0.5 font-serif text-lg text-zelanda-verde-900">
        {valor}
      </p>
    </div>
  );
}
