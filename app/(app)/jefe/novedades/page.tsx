import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Novedades" };

type SearchParams = Promise<{ resueltas?: string }>;

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function PaginaNovedades({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;
  const verResueltas = sp.resueltas === "si";

  const novedades = await prisma.novedades.findMany({
    where: { resuelta: verResueltas },
    orderBy: { fecha: "desc" },
    take: 100,
    include: {
      arboles: {
        select: {
          numero_placa: true,
          lotes: { select: { nombre: true } },
        },
      },
      persona: { select: { nombre_completo: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reportes de campo
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Novedades
        </h1>
      </header>

      <nav className="flex gap-1.5">
        <Link
          href="/jefe/novedades"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            !verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Pendientes
        </Link>
        <Link
          href="/jefe/novedades?resueltas=si"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Resueltas
        </Link>
      </nav>

      <ul className="space-y-2">
        {novedades.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            {verResueltas ? "No hay novedades resueltas." : "No hay novedades pendientes."}
          </li>
        ) : (
          novedades.map((n) => (
            <li key={String(n.id)} className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
              <Link href={`/jefe/novedades/${n.id}`} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
                    <span className="text-xs text-zelanda-verde-700">
                      {formatearFechaCorta(n.fecha)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zelanda-verde-900">
                    Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
                  </p>
                  <p className="truncate text-xs text-zelanda-verde-700">
                    {n.descripcion}
                  </p>
                  <p className="mt-0.5 text-xs text-zelanda-verde-700/80">
                    por {n.persona.nombre_completo}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
