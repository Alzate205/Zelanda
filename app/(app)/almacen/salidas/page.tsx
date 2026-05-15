import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Salidas" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

export default async function PaginaSalidas() {
  await requerirUsuario("ALMACEN");

  const salidas = await prisma.salidas_cosecha.findMany({
    take: 50,
    orderBy: { fecha: "desc" },
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
            Salidas
          </h1>
        </div>
        <Link
          href="/almacen/salidas/nueva"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {salidas.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-zelanda-beige-200">
            {salidas.map((s) => (
              <li
                key={s.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    {s.cliente_detalle && (
                      <span className="truncate text-zelanda-verde-900">
                        {s.cliente_detalle}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(s.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {Number(s.cantidad_kg).toLocaleString("es-CO", {
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
