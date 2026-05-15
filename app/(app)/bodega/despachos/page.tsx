import Link from "next/link";
import { Plus, PackageOpen, CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Despachos" };

export default async function PaginaDespachos() {
  await requerirUsuario("BODEGA");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [abiertos, cerradosHoy] = await Promise.all([
    prisma.despachos.findMany({
      where: { estado: "ABIERTO" },
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
    prisma.despachos.findMany({
      where: {
        estado: "CERRADO",
        fecha_devolucion: { gte: inicioDia },
      },
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha_devolucion: "desc" },
    }),
  ]);

  const fmtHora = (d: Date) =>
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Bodega
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Despachos
          </h1>
        </div>
        <Link
          href="/bodega/despachos/nuevo"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <PackageOpen className="h-5 w-5" /> Abiertos ({abiertos.length})
        </h2>
        {abiertos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            No hay despachos abiertos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {abiertos.map((d) => (
              <li key={d.id.toString()}>
                <Link
                  href={`/bodega/despachos/${d.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {d.persona.nombre_completo}
                    </p>
                    <p className="text-xs text-zelanda-verde-700/70">
                      {fmtHora(d.fecha)} · {d._count.despacho_items} item(s)
                    </p>
                  </div>
                  <span className="text-xs text-zelanda-verde-700">Cerrar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <CheckCircle2 className="h-5 w-5" /> Cerrados hoy ({cerradosHoy.length})
        </h2>
        {cerradosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no se han cerrado despachos hoy.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cerradosHoy.map((d) => (
              <li key={d.id.toString()} className="py-3 text-sm">
                <p className="font-medium text-zelanda-verde-900">
                  {d.persona.nombre_completo}
                </p>
                <p className="text-xs text-zelanda-verde-700/70">
                  {fmtHora(d.fecha)} → {d.fecha_devolucion && fmtHora(d.fecha_devolucion)} · {d._count.despacho_items} item(s)
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
