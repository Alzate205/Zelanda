import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KPI } from "@/components/ui/KPI";
import { Card } from "@/components/ui/Card";
import { FormularioCosecha } from "./cosecha/nueva/_formulario";

export const metadata = { title: "Almacén" };

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

type MovimientoFila = {
  key: string;
  tipo: "ingreso" | "salida";
  titulo: string;
  subtitulo: string;
  kg: number;
  fecha: Date;
};

export default async function PaginaInicioAlmacen() {
  const usuario = await requerirUsuario("ALMACEN");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [
    stockRows,
    cosechasHoy,
    salidasHoy,
    lotes,
    personas,
    ultimasCosechas,
    ultimasSalidas,
  ] = await Promise.all([
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { cantidad_kg: true },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.cosechas.findMany({
      where: { fecha: { gte: inicioDia } },
      orderBy: { fecha: "desc" },
      take: 6,
      include: {
        persona: { select: { nombre_completo: true } },
        lotes: { select: { nombre: true } },
      },
    }),
    prisma.salidas_cosecha.findMany({
      where: { fecha: { gte: inicioDia } },
      orderBy: { fecha: "desc" },
      take: 4,
    }),
  ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  const ingresosKg = Number(cosechasHoy._sum.peso_kg ?? 0);
  const salidasKg = Number(salidasHoy._sum.cantidad_kg ?? 0);
  const fechaHoy = tituloFecha(new Date());

  const lotesDistintosHoy = new globalThis.Set(
    ultimasCosechas.map((c) => c.lotes.nombre),
  ).size;

  const personasForm = personas.map((p) => ({
    id: String(p.id),
    nombre: p.nombre_completo,
  }));
  const lotesForm = lotes.map((l) => ({
    id: String(l.id),
    nombre: l.nombre,
  }));

  const movimientos: MovimientoFila[] = [
    ...ultimasCosechas.map(
      (c): MovimientoFila => ({
        key: `c_${c.id}`,
        tipo: "ingreso",
        titulo: `${c.lotes.nombre} · ${c.persona.nombre_completo}`,
        subtitulo: `${c.metodo_medicion === "CANASTA" ? "Canastas" : "Báscula"} · ${fmtHora(c.fecha)}`,
        kg: Number(c.peso_kg),
        fecha: c.fecha,
      }),
    ),
    ...ultimasSalidas.map(
      (s): MovimientoFila => ({
        key: `s_${s.id}`,
        tipo: "salida",
        titulo: `Salida · ${s.cliente_detalle ?? s.tipo}`,
        subtitulo: `${s.tipo} · ${fmtHora(s.fecha)}`,
        kg: Number(s.cantidad_kg),
        fecha: s.fecha,
      }),
    ),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Almacén · {usuario.nombre_completo.split(" ")[0]}</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Cosecha entrante
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {fechaHoy} · stock{" "}
          <strong className="text-zelanda-verde-900">
            {stock.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg
          </strong>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <KPI
          href="/almacen/cosecha"
          etiqueta="Ingresos hoy"
          valor={`${ingresosKg.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg`}
          pie={`${lotesDistintosHoy} ${lotesDistintosHoy === 1 ? "lote" : "lotes"}`}
        />
        <KPI
          href="/almacen/salidas"
          etiqueta="Salidas hoy"
          valor={`${salidasKg.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg`}
          pie={`${salidasHoy._count._all} ${salidasHoy._count._all === 1 ? "salida" : "salidas"}`}
          acento="ocre"
        />
      </div>

      <Card lift className="border-zelanda-verde-300 p-4">
        <Eyebrow>Registrar ingreso</Eyebrow>
        <div className="mt-2">
          <FormularioCosecha
            personas={personasForm}
            lotes={lotesForm}
            compacto
          />
        </div>
      </Card>

      <div className="flex gap-2">
        <Link
          href="/almacen/cosecha"
          className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Ver historial
        </Link>
        <Link
          href="/almacen/salidas/nueva"
          className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <Plus className="h-[16px] w-[16px]" /> Salida
        </Link>
      </div>

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Hoy
        </h2>
        {movimientos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            Sin movimientos todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {movimientos.map((m) => {
              const esIngreso = m.tipo === "ingreso";
              return (
                <div
                  key={m.key}
                  className={`flex items-center gap-3 rounded-xl border border-l-[3px] border-zelanda-beige-200 bg-white px-3 py-2.5 ${
                    esIngreso
                      ? "border-l-zelanda-verde-500"
                      : "border-l-zelanda-ocre-500"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${
                      esIngreso
                        ? "bg-zelanda-verde-50 text-zelanda-verde-700"
                        : "bg-zelanda-ocre-50 text-zelanda-ocre-700"
                    }`}
                  >
                    {esIngreso ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13.5px] text-zelanda-verde-900">
                      {m.titulo}
                    </p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                      {m.subtitulo}
                    </p>
                  </div>
                  <span className="font-serif text-[18px] text-zelanda-verde-900">
                    {esIngreso ? "+" : "−"}
                    {m.kg.toLocaleString("es-CO", { maximumFractionDigits: 0 })}{" "}
                    <span className="text-[11px] text-zelanda-verde-700">
                      kg
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
