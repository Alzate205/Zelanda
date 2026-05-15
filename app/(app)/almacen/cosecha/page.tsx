import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Cosechas" };

export default async function PaginaCosechas() {
  await requerirUsuario("ALMACEN");

  const cosechas = await prisma.cosechas.findMany({
    take: 50,
    orderBy: { fecha: "desc" },
    include: {
      persona: { select: { nombre_completo: true } },
      lotes: { select: { nombre: true } },
    },
  });

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Cosechas
          </h1>
        </div>
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {cosechas.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            Aún no hay cosechas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-zelanda-beige-200">
            {cosechas.map((c) => (
              <li
                key={c.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {c.persona.nombre_completo} · {c.lotes.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(c.fecha)} · {c.metodo_medicion}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
