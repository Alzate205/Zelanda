import { Wrench, FlaskConical } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Inventario" };

export default async function PaginaInventarioJefe() {
  await requerirUsuario("JEFE");

  const [herramientas, insumos] = await Promise.all([
    prisma.herramientas.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
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
      }[]
    >`
      SELECT
        id, nombre, categoria::text, unidad,
        stock_actual::text, stock_reservado::text,
        stock_disponible::text, stock_minimo::text,
        por_debajo_minimo
      FROM v_insumos_stock
      WHERE activo = TRUE
      ORDER BY nombre
    `,
  ]);

  const insumosAlerta = insumos.filter((i) => i.por_debajo_minimo).length;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Inventario de bodega
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {herramientas.length} herramientas · {insumos.length} insumos
          {insumosAlerta > 0 ? ` · ${insumosAlerta} en alerta` : ""}
        </p>
      </header>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <FlaskConical className="h-4 w-4 text-zelanda-ocre-600" /> Insumos{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({insumos.length})
          </span>
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zelanda-beige-200 text-left text-xs uppercase text-zelanda-verde-700">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3 text-right">Actual</th>
                <th className="py-2 pr-3 text-right">Reservado</th>
                <th className="py-2 pr-3 text-right">Disponible</th>
                <th className="py-2 pr-3 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr
                  key={i.id.toString()}
                  className={
                    i.por_debajo_minimo
                      ? "border-b border-zelanda-beige-200 bg-estado-vencida/5"
                      : "border-b border-zelanda-beige-200"
                  }
                >
                  <td className="py-2 pr-3 font-medium text-zelanda-verde-900">
                    {i.nombre}
                  </td>
                  <td className="py-2 pr-3 text-zelanda-verde-700">
                    {i.categoria}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {i.stock_actual} {i.unidad}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {i.stock_reservado}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium ${
                      i.por_debajo_minimo ? "text-estado-vencida" : ""
                    }`}
                  >
                    {i.stock_disponible}
                  </td>
                  <td className="py-2 pr-3 text-right">{i.stock_minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Wrench className="h-4 w-4 text-zelanda-verde-700" /> Herramientas{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({herramientas.length})
          </span>
        </h2>
        <ul className="mt-3 divide-y divide-zelanda-beige-200">
          {herramientas.map((h) => (
            <li
              key={h.id.toString()}
              className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 text-sm"
            >
              <span className="text-zelanda-verde-900">{h.nombre}</span>
              <span className="text-zelanda-verde-700">{h.categoria}</span>
              <span className="font-medium">×{h.total}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
