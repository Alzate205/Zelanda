import Link from "next/link";
import { AlertTriangle, Plus, Clock, Check } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KPI } from "@/components/ui/KPI";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";

export const metadata = { title: "Bodega" };

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function tituloFecha(fecha: Date): string {
  const texto = FORMATEADOR_FECHA.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fmtHora(d: Date): string {
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PaginaInicioBodega() {
  const usuario = await requerirUsuario("BODEGA");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [abiertos, cerradosHoy, stockBajo, stockBajoTotal] = await Promise.all([
    prisma.despachos.findMany({
      where: { estado: "ABIERTO" },
      orderBy: { fecha: "desc" },
      take: 5,
      include: {
        persona: { select: { id: true, nombre_completo: true } },
        asignacion: {
          select: {
            tipos_tarea: { select: { nombre: true } },
            lotes: { select: { nombre: true } },
            apiarios: { select: { nombre: true } },
          },
        },
        despacho_items: {
          select: {
            id: true,
            cantidad: true,
            tipo_item: true,
            herramientas: { select: { nombre: true } },
            insumos: { select: { nombre: true, unidad: true } },
          },
        },
      },
    }),
    prisma.despachos.count({
      where: { estado: "CERRADO", fecha_devolucion: { gte: inicioDia } },
    }),
    prisma.$queryRaw<
      { id: bigint; nombre: string; unidad: string; stock_disponible: string }[]
    >`
      SELECT id, nombre, unidad, stock_disponible::text
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
      ORDER BY nombre
      LIMIT 5
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
    `,
  ]);

  const totalStockBajo = Number(stockBajoTotal[0]?.total ?? 0);
  const fechaHoy = tituloFecha(new Date());

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Bodega · {usuario.nombre_completo.split(" ")[0]}</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Despachos del día
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {fechaHoy} · {abiertos.length}{" "}
          {abiertos.length === 1 ? "abierto" : "abiertos"}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <KPI
          href="/bodega/despachos"
          etiqueta="Abiertos"
          valor={abiertos.length}
        />
        <KPI etiqueta="Cerrados" valor={cerradosHoy} pie="Hoy" />
        <KPI
          href="/bodega/inventario"
          etiqueta="Bajo stock"
          valor={totalStockBajo}
          acento={totalStockBajo > 0 ? "ocre" : "verde"}
        />
      </div>

      <Link
        href="/bodega/despachos/nuevo"
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        <Plus className="h-[18px] w-[18px]" /> Nuevo despacho
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Abiertos
          </h2>
          {abiertos.length > 0 ? (
            <span className="text-[11.5px] font-semibold text-estado-vencida">
              {abiertos.length}
            </span>
          ) : null}
        </div>
        {abiertos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            No hay despachos abiertos.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {abiertos.map((d) => {
              const tarea = d.asignacion?.tipos_tarea?.nombre;
              const lote =
                d.asignacion?.lotes?.nombre ??
                d.asignacion?.apiarios?.nombre ??
                null;
              const subtitulo = tarea
                ? `${tarea}${lote ? ` · ${lote}` : ""}`
                : "Sin asignación";
              return (
                <article
                  key={d.id.toString()}
                  className="rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
                >
                  <div className="flex items-center gap-2.5">
                    <AvatarIniciales
                      id={String(d.persona.id)}
                      nombre={d.persona.nombre_completo}
                      tamano="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                        {d.persona.nombre_completo}
                      </p>
                      <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                        {subtitulo}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[11.5px] text-zelanda-verde-700">
                      <Clock className="h-3 w-3" /> {fmtHora(d.fecha)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-col gap-1 border-t border-zelanda-beige-200 pt-2">
                    {d.despacho_items.slice(0, 4).map((it) => {
                      const nombre =
                        it.tipo_item === "HERRAMIENTA"
                          ? (it.herramientas?.nombre ?? "Herramienta")
                          : (it.insumos?.nombre ?? "Insumo");
                      const tipoLabel =
                        it.tipo_item === "HERRAMIENTA"
                          ? "herramienta"
                          : `insumo · ${it.insumos?.unidad ?? ""}`;
                      return (
                        <div
                          key={it.id.toString()}
                          className="flex justify-between text-[13px]"
                        >
                          <span className="text-zelanda-verde-900">
                            {Number(it.cantidad).toLocaleString("es-CO", {
                              maximumFractionDigits: 2,
                            })}
                            × {nombre}
                          </span>
                          <span className="text-[11px] text-zelanda-verde-700">
                            {tipoLabel}
                          </span>
                        </div>
                      );
                    })}
                    {d.despacho_items.length > 4 ? (
                      <p className="text-[11px] text-zelanda-verde-700/70">
                        y {d.despacho_items.length - 4} más
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/bodega/despachos/${d.id}`}
                      className="flex h-9 flex-1 items-center justify-center rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/bodega/despachos/${d.id}`}
                      className="flex h-9 flex-[1.4] items-center justify-center gap-2 rounded-[10px] bg-zelanda-verde-700 px-3 text-[13.5px] font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
                    >
                      <Check className="h-4 w-4" /> Cerrar despacho
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {stockBajo.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Alertas de stock
          </h2>
          <div className="flex flex-col gap-2">
            {stockBajo.map((i) => (
              <div
                key={i.id.toString()}
                className="flex items-center gap-3 rounded-xl border border-l-[3px] border-l-zelanda-ocre-400 border-zelanda-beige-200 bg-white px-3 py-2.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-zelanda-ocre-50 text-zelanda-ocre-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm text-zelanda-verde-900">
                    {i.nombre}
                  </p>
                  <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    Stock {i.stock_disponible} {i.unidad}
                  </p>
                </div>
                <Link
                  href={`/bodega/inventario/insumos/${i.id}/ingresar`}
                  className="rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-2 text-[13.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
                >
                  Reponer
                </Link>
              </div>
            ))}
            {totalStockBajo > stockBajo.length ? (
              <p className="mt-1 text-xs text-zelanda-verde-700/70">
                y {totalStockBajo - stockBajo.length} más — ver{" "}
                <Link href="/bodega/inventario" className="underline">
                  inventario
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
