import Link from "next/link";
import { Plus, Wrench, FlaskConical, PackagePlus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ToggleActivoHerramienta, ToggleActivoInsumo } from "./toggles";

export const metadata = { title: "Inventario" };

export default async function PaginaInventario() {
  await requerirUsuario("BODEGA");

  const [herramientas, insumos] = await Promise.all([
    prisma.herramientas.findMany({ orderBy: { nombre: "asc" } }),
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        categoria: string;
        unidad: string;
        stock_actual: string;
        stock_reservado: string;
        stock_disponible: string;
        stock_minimo: string;
        por_debajo_minimo: boolean;
        activo: boolean;
      }[]
    >`
      SELECT
        id, nombre, categoria::text, unidad,
        stock_actual::text, stock_reservado::text,
        stock_disponible::text, stock_minimo::text,
        por_debajo_minimo, activo
      FROM v_insumos_stock
      ORDER BY nombre
    `,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Inventario
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <Wrench className="h-5 w-5" /> Herramientas
          </h2>
          <Link
            href="/bodega/inventario/herramientas/nueva"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Nueva
          </Link>
        </div>

        {herramientas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay herramientas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {herramientas.map((h) => (
              <li
                key={h.id.toString()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/bodega/inventario/herramientas/${h.id}/editar`}
                    className={`block truncate font-medium ${
                      h.activo ? "text-zelanda-verde-900" : "text-zelanda-verde-700/50"
                    }`}
                  >
                    {h.nombre}
                  </Link>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {h.categoria} · Total {h.total}
                  </p>
                </div>
                <ToggleActivoHerramienta id={h.id.toString()} activo={h.activo} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <FlaskConical className="h-5 w-5" /> Insumos
          </h2>
          <Link
            href="/bodega/inventario/insumos/nuevo"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Nuevo
          </Link>
        </div>

        {insumos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay insumos registrados.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {insumos.map((i) => (
              <li
                key={i.id.toString()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/bodega/inventario/insumos/${i.id}/editar`}
                    className={`block truncate font-medium ${
                      i.activo ? "text-zelanda-verde-900" : "text-zelanda-verde-700/50"
                    }`}
                  >
                    {i.nombre}
                  </Link>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {i.categoria} · {i.stock_disponible} {i.unidad} disponible
                    {i.por_debajo_minimo && (
                      <span className="ml-2 rounded bg-estado-vencida/10 px-1.5 py-0.5 text-estado-vencida">
                        bajo mín
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/bodega/inventario/insumos/${i.id}/ingresar`}
                    className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1.5 text-xs text-zelanda-verde-700"
                  >
                    <PackagePlus className="h-4 w-4" /> Ingresar
                  </Link>
                  <ToggleActivoInsumo id={i.id.toString()} activo={i.activo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
