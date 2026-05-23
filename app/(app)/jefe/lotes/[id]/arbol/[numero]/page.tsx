import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Sprout,
  AlertCircle,
  Camera,
  Plus,
  Leaf,
  Bug,
  Apple,
  Scissors,
  Droplets,
  Check,
  type LucideIcon,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFotoFirmada } from "@/lib/supabase/storage";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { formatearFechaCorta } from "@/lib/utils";
import { EditorArbol } from "./_editor";

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function parsearNumero(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return n > 0 ? n : null;
}

function aniosDesde(fecha: Date): {
  display: string;
  anios: number;
  dias: number;
} {
  const ms = Date.now() - fecha.getTime();
  const dias = Math.floor(ms / 86400000);
  const meses = Math.floor(dias / 30.4375);
  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses - anios * 12;
  let display: string;
  if (dias < 30) {
    display = `${dias} d`;
  } else if (anios < 2) {
    display = `${meses} m`;
  } else if (mesesRestantes > 0) {
    display = `${anios}a ${mesesRestantes}m`;
  } else {
    display = `${anios}a`;
  }
  return { display, anios, dias };
}

const ICONOS_TAREA: Record<string, LucideIcon> = {
  riego: Droplets,
  poda: Scissors,
  fertilizacion: Sprout,
  plagas: Bug,
  cosecha: Apple,
  plateo: Leaf,
};

function iconoPorTarea(nombre: string): LucideIcon {
  const n = nombre.toLowerCase();
  if (n.includes("rieg")) return ICONOS_TAREA.riego;
  if (n.includes("poda")) return ICONOS_TAREA.poda;
  if (n.includes("fert")) return ICONOS_TAREA.fertilizacion;
  if (n.includes("plag")) return ICONOS_TAREA.plagas;
  if (n.includes("cosech")) return ICONOS_TAREA.cosecha;
  if (n.includes("plateo")) return ICONOS_TAREA.plateo;
  return Leaf;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}): Promise<Metadata> {
  const { id, numero } = await params;
  const loteId = parsearId(id);
  const num = parsearNumero(numero);
  if (!loteId || !num) return { title: "Árbol no encontrado" };
  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { nombre: true },
  });
  return { title: `Árbol ${num} · Lote ${lote?.nombre ?? "?"}` };
}

type RegistroArbol = {
  id: string;
  fecha_registro: Date;
  tipo_registro: string;
  observaciones: string | null;
  tipo_tarea_nombre: string;
  persona_nombre: string;
};

export default async function FichaArbol({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id, numero } = await params;

  const loteId = parsearId(id);
  const num = parsearNumero(numero);
  if (!loteId || !num) notFound();

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: loteId, numero_placa: num, deleted_at: null },
    include: {
      lotes: {
        select: {
          id: true,
          nombre: true,
          total_arboles: true,
          fecha_siembra: true,
        },
      },
    },
  });

  if (!arbol) notFound();

  const [arbolesGenerados, cosechaAgg, cosechasPorAnio] = await Promise.all([
    prisma.arboles.count({
      where: { lote_id: loteId, deleted_at: null },
    }),
    prisma.cosechas.aggregate({
      where: { lote_id: loteId },
      _sum: { peso_kg: true },
    }),
    prisma.$queryRaw<
      { anio: string; kg_total: string; n_cosechas: number }[]
    >`
      SELECT
        EXTRACT(YEAR FROM fecha)::text AS anio,
        SUM(peso_kg)::text                 AS kg_total,
        COUNT(*)::int                       AS n_cosechas
      FROM cosechas
      WHERE lote_id = ${loteId}
      GROUP BY EXTRACT(YEAR FROM fecha)
      ORDER BY anio ASC
    `,
  ]);
  const cosechaTotalLote = Number(cosechaAgg._sum.peso_kg ?? 0);
  const promedioKg =
    arbolesGenerados > 0 ? cosechaTotalLote / arbolesGenerados : 0;

  const anioActual = new Date().getFullYear();
  const cosechasHistorial = cosechasPorAnio.map((c) => {
    const kgArbolEstimado =
      arbolesGenerados > 0 ? Number(c.kg_total) / arbolesGenerados : 0;
    return {
      anio: c.anio,
      kg: Number(c.kg_total),
      kg_arbol: kgArbolEstimado,
      n_cosechas: c.n_cosechas,
      parcial: Number(c.anio) === anioActual,
    };
  });
  const maxKgArbol = cosechasHistorial.reduce(
    (m, c) => Math.max(m, c.kg_arbol),
    0,
  );
  const mejorAnio = cosechasHistorial.reduce<typeof cosechasHistorial[number] | null>(
    (a, c) => (a === null || c.kg_arbol > a.kg_arbol ? c : a),
    null,
  );

  const fechaSiembraEfectiva = arbol.fecha_siembra ?? arbol.lotes.fecha_siembra;
  const fechaSiembraOrigen = arbol.fecha_siembra
    ? "árbol"
    : arbol.lotes.fecha_siembra
      ? "lote"
      : null;
  const edad = fechaSiembraEfectiva
    ? aniosDesde(fechaSiembraEfectiva)
    : { display: "—", anios: 0, dias: 0 };

  const [novedades, registrosRaw] = await Promise.all([
    prisma.novedades.findMany({
      where: { arbol_id: arbol.id },
      orderBy: { fecha: "desc" },
      include: { persona: { select: { nombre_completo: true } } },
    }),
    prisma.$queryRaw<
      Array<{
        id: bigint;
        fecha_registro: Date;
        tipo_registro: string;
        observaciones: string | null;
        tipo_tarea_nombre: string;
        persona_nombre: string;
      }>
    >`
      SELECT
        r.id,
        r.fecha_registro,
        r.tipo_registro::text AS tipo_registro,
        r.observaciones,
        t.nombre AS tipo_tarea_nombre,
        p.nombre_completo AS persona_nombre
      FROM registros_avance r
      JOIN asignaciones a ON a.id = r.asignacion_id
      JOIN tipos_tarea t ON t.id = a.tipo_tarea_id
      JOIN personas p ON p.id = r.persona_id
      WHERE a.lote_id = ${loteId}
        AND (
          (r.arbol_desde IS NOT NULL
           AND r.arbol_hasta IS NOT NULL
           AND ${num} BETWEEN r.arbol_desde AND r.arbol_hasta)
          OR ${num} = ANY(r.arboles_lista)
        )
      ORDER BY r.fecha_registro DESC
      LIMIT 100
    `,
  ]);

  const registros: RegistroArbol[] = registrosRaw.map((r) => ({
    ...r,
    id: String(r.id),
  }));

  const fotos = await Promise.all(
    novedades
      .filter((n) => n.foto_path)
      .map(async (n) => ({
        id: String(n.id),
        url: await urlFotoFirmada(n.foto_path as string),
        tipo: n.tipo,
        fecha: n.fecha,
      })),
  );
  const fotosValidas = fotos.filter((f) => f.url) as Array<{
    id: string;
    url: string;
    tipo: string;
    fecha: Date;
  }>;

  const conteoTareas = new globalThis.Map<
    string,
    { total: number; ultima: Date }
  >();
  for (const r of registros) {
    const actual = conteoTareas.get(r.tipo_tarea_nombre);
    if (!actual) {
      conteoTareas.set(r.tipo_tarea_nombre, {
        total: 1,
        ultima: r.fecha_registro,
      });
    } else {
      actual.total += 1;
      if (r.fecha_registro > actual.ultima) actual.ultima = r.fecha_registro;
    }
  }
  const conteoArr = [...conteoTareas.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  );
  const totalIntervenciones = conteoArr.reduce(
    (acc, [, v]) => acc + v.total,
    0,
  );

  const novedadesResueltas = novedades.filter((n) => n.resuelta).length;
  const novedadesAbiertas = novedades.length - novedadesResueltas;

  const arbolIdLegible = `${arbol.lotes.nombre.slice(0, 2).toUpperCase()}-${String(arbol.numero_placa).padStart(3, "0")}`;

  const estadoVisual = novedadesAbiertas > 0 ? "vencida" : "aldia";
  const badgeTexto = novedadesAbiertas > 0 ? "Con novedad" : "Saludable";

  return (
    <div className="-mx-4 -mt-4">
      <div
        className="px-4 pb-5 pt-3 text-zelanda-beige-50"
        style={{
          background:
            "radial-gradient(circle at 85% -10%, rgba(193,150,88,0.32), transparent 55%)," +
            "radial-gradient(circle at 0% 100%, rgba(58,92,68,0.3), transparent 60%)," +
            "linear-gradient(180deg, var(--tw-color-zelanda-verde-700, #2d4a35), var(--tw-color-zelanda-verde-900, #142c1a))",
        }}
      >
        <div className="flex items-center gap-2">
          <Link
            href={`/jefe/lotes/${arbol.lote_id}`}
            aria-label="Volver"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Pokédex · ficha técnica
            </p>
            <h1 className="mt-0.5 font-serif text-[18px] font-medium leading-tight">
              {arbolIdLegible} · Lote {arbol.lotes.nombre}
            </h1>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3.5">
          <div
            className="flex h-[92px] w-[92px] items-center justify-center rounded-[22px] border-2 border-white/30 font-serif text-[38px] font-semibold text-zelanda-beige-50"
            style={{
              background:
                "linear-gradient(160deg, rgba(251,247,240,0.18), rgba(251,247,240,0.05))",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              letterSpacing: "-0.03em",
            }}
          >
            #{arbol.numero_placa}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]">
                Hass
              </span>
              <Badge estado={estadoVisual}>{badgeTexto}</Badge>
            </div>
            <p className="m-0 font-serif text-[20px] leading-tight">Hass</p>
            <p className="m-0 mt-1 text-[11.5px] text-zelanda-beige-100/75">
              Lote {arbol.lotes.nombre} · de{" "}
              {arbol.lotes.total_arboles.toLocaleString("es-CO")} árboles
            </p>
            {fechaSiembraEfectiva ? (
              <p className="m-0 mt-0.5 text-[11px] text-zelanda-beige-100/65">
                Sembrado {formatearFechaCorta(fechaSiembraEfectiva)}
                {fechaSiembraOrigen === "lote" ? " (del lote)" : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          <HeroMini
            valor={edad.display}
            unidad={edad.anios > 0 ? "edad" : "días"}
            sub={
              edad.dias > 0
                ? `${edad.dias.toLocaleString("es-CO")} d`
                : "sin fecha"
            }
          />
          <HeroMini
            valor={promedioKg.toFixed(1)}
            unidad="kg / árbol"
            sub="promedio lote"
          />
          <HeroMini
            valor={totalIntervenciones}
            unidad="tareas"
            sub="registradas"
          />
          <HeroMini
            valor={novedades.length}
            unidad="novedades"
            sub={`${novedadesAbiertas} activas`}
          />
        </div>
      </div>

      <div className="space-y-5 px-4 pt-5">
        <section>
          <div className="flex items-center justify-between">
            <Eyebrow>Información</Eyebrow>
            <EditorArbol
              arbolId={String(arbol.id)}
              estadoInicial={arbol.estado}
              notasIniciales={arbol.notas}
            />
          </div>
          <Card className="mt-2 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Siembra
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  {fechaSiembraEfectiva
                    ? formatearFechaCorta(fechaSiembraEfectiva)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Edad
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  {edad.display}
                </dd>
              </div>
            </dl>
            {arbol.notas ? (
              <p className="mt-4 whitespace-pre-wrap border-t border-zelanda-beige-200 pt-4 text-sm leading-relaxed text-zelanda-verde-700">
                {arbol.notas}
              </p>
            ) : null}
          </Card>
        </section>

        {cosechaTotalLote > 0 ? (
          <section>
            <Eyebrow>Cosecha acumulada</Eyebrow>
            <Card lift className="mt-2 border-zelanda-ocre-200 p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[32px] leading-none text-zelanda-verde-900">
                  {promedioKg.toFixed(1)}
                </span>
                <span className="text-[13px] text-zelanda-verde-700">
                  kg estimados (promedio del lote)
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">
                Lote {arbol.lotes.nombre}:{" "}
                <strong className="text-zelanda-verde-900">
                  {cosechaTotalLote.toLocaleString("es-CO", {
                    maximumFractionDigits: 0,
                  })}
                </strong>{" "}
                kg ÷ {arbolesGenerados.toLocaleString("es-CO")} árboles
                {mejorAnio !== null
                  ? ` · mejor año ${mejorAnio.anio} (${mejorAnio.kg_arbol.toFixed(1)} kg/árbol)`
                  : ""}
              </p>

              {cosechasHistorial.length > 0 ? (
                <>
                  <div
                    className="mt-3.5 grid items-end gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${cosechasHistorial.length}, 1fr)`,
                      height: "70px",
                    }}
                  >
                    {cosechasHistorial.map((c) => {
                      const altura =
                        maxKgArbol > 0
                          ? Math.max(
                              4,
                              Math.round((c.kg_arbol / maxKgArbol) * 60),
                            )
                          : 4;
                      const esMejor = mejorAnio?.anio === c.anio;
                      return (
                        <div
                          key={c.anio}
                          className="flex flex-col items-center justify-end gap-1"
                          title={`${c.anio}: ${c.kg_arbol.toFixed(1)} kg/árbol`}
                        >
                          <span className="text-[10px] font-semibold text-zelanda-verde-900">
                            {c.kg_arbol.toFixed(1)}
                          </span>
                          <div
                            className={`relative w-full rounded-t-[4px] ${
                              esMejor
                                ? "bg-zelanda-ocre-500"
                                : c.parcial
                                  ? "bg-zelanda-verde-300"
                                  : "bg-zelanda-verde-600"
                            }`}
                            style={{ height: `${altura}px` }}
                          >
                            {c.parcial ? (
                              <span
                                className="absolute inset-0 rounded-t-[4px]"
                                style={{
                                  background:
                                    "repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.25) 4px 6px)",
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="mt-1.5 grid gap-2 text-center text-[10.5px] text-zelanda-verde-700"
                    style={{
                      gridTemplateColumns: `repeat(${cosechasHistorial.length}, 1fr)`,
                    }}
                  >
                    {cosechasHistorial.map((c) => (
                      <span key={c.anio}>
                        {c.anio.slice(2)}
                        {c.parcial ? "*" : ""}
                      </span>
                    ))}
                  </div>
                  {cosechasHistorial.some((c) => c.parcial) ? (
                    <p className="mt-1.5 text-right text-[10px] text-zelanda-verde-700">
                      * Año en curso
                    </p>
                  ) : null}
                </>
              ) : null}

              <p className="mt-2 text-[10.5px] text-zelanda-verde-700/70">
                La producción individual no se mide; mostramos el promedio por
                árbol del lote para cada año.
              </p>
            </Card>
          </section>
        ) : null}

        {conteoArr.length > 0 ? (
          <section>
            <Eyebrow>Intervenciones totales</Eyebrow>
            <p className="mt-1 text-[12px] text-zelanda-verde-700">
              Este árbol ha recibido{" "}
              <strong className="text-zelanda-verde-900">
                {totalIntervenciones}
              </strong>{" "}
              intervenciones
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {conteoArr.map(([nombre, info]) => {
                const Icono = iconoPorTarea(nombre);
                const dias = Math.floor(
                  (Date.now() - info.ultima.getTime()) / 86400000,
                );
                const ultima =
                  dias === 0
                    ? "hoy"
                    : dias === 1
                      ? "ayer"
                      : dias < 30
                        ? `hace ${dias} d`
                        : `hace ${Math.floor(dias / 30)} m`;
                return (
                  <div
                    key={nombre}
                    className="flex items-center gap-2.5 rounded-xl border border-zelanda-beige-200 bg-white px-3 py-2.5"
                  >
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-zelanda-beige-100 text-zelanda-verde-600">
                      <Icono className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-[22px] leading-none text-zelanda-verde-900">
                          {info.total}
                        </span>
                        <span className="text-[10.5px] text-zelanda-verde-700">
                          ×
                        </span>
                      </div>
                      <p className="m-0 mt-0.5 text-[11px] font-semibold text-zelanda-verde-900">
                        {nombre}
                      </p>
                      <p className="m-0 text-[10px] text-zelanda-verde-700">
                        última: {ultima}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {novedades.length > 0 ? (
          <section>
            <Eyebrow>Historial de novedades</Eyebrow>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <NovedadStat
                valor={novedades.length}
                label="Total"
                color="text-zelanda-verde-700"
                bg="bg-zelanda-verde-50 border-zelanda-verde-200"
              />
              <NovedadStat
                valor={novedadesResueltas}
                label="Resueltas"
                color="text-zelanda-verde-800"
                bg="bg-zelanda-verde-100 border-zelanda-verde-200"
              />
              <NovedadStat
                valor={novedadesAbiertas}
                label="Activas"
                color="text-[#7b2a23]"
                bg="bg-[#fcefec] border-[#e8b3ad]"
                destacado={novedadesAbiertas > 0}
              />
            </div>
          </section>
        ) : null}

        {registros.length > 0 ? (
          <section>
            <Eyebrow>Línea de vida</Eyebrow>
            <div className="relative mt-3 pl-[18px]">
              <span
                className="absolute bottom-2 left-[7px] top-2 w-0.5"
                style={{
                  background:
                    "linear-gradient(180deg, var(--tw-color-zelanda-beige-300, #e1cba0), var(--tw-color-zelanda-verde-300, #92b29f))",
                }}
              />
              {registros.slice(0, 8).map((r, i) => (
                <div
                  key={r.id}
                  className={`relative pl-[18px] ${i === registros.slice(0, 8).length - 1 ? "" : "pb-4"}`}
                >
                  <span
                    className="absolute -left-[10px] top-1.5 h-[11px] w-[11px] rounded-full border-2 border-zelanda-verde-500 bg-white"
                    aria-hidden
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="m-0 font-serif text-[13.5px] text-zelanda-verde-900">
                      {r.tipo_tarea_nombre}
                    </p>
                    <span className="whitespace-nowrap text-[10.5px] text-zelanda-verde-700">
                      {formatearFechaCorta(r.fecha_registro)}
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    Por {r.persona_nombre}
                    {r.observaciones ? ` · ${r.observaciones}` : ""}
                  </p>
                </div>
              ))}
              {registros.length > 8 ? (
                <p className="mt-1 pl-[18px] text-[11px] text-zelanda-verde-700/70">
                  y {registros.length - 8} registros anteriores
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {novedades.length > 0 ? (
          <section>
            <Eyebrow>Novedades</Eyebrow>
            <ul className="mt-2 space-y-2">
              {novedades.map((n) => (
                <li key={String(n.id)}>
                  <Link
                    href={`/jefe/novedades/${n.id}`}
                    className="block rounded-xl border border-zelanda-beige-200 bg-white px-3 py-2.5 shadow-suave transition hover:border-zelanda-verde-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge estado={n.resuelta ? "aldia" : "vencida"}>
                        {n.resuelta ? (
                          <>
                            <Check className="h-3 w-3" /> Resuelta
                          </>
                        ) : (
                          ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo
                        )}
                      </Badge>
                      <span className="text-[11.5px] text-zelanda-verde-700">
                        {formatearFechaCorta(n.fecha)}
                      </span>
                    </div>
                    <p className="m-0 mt-1.5 line-clamp-2 text-[13.5px] text-zelanda-verde-900">
                      {n.descripcion}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-zelanda-verde-700">
                      Por {n.persona.nombre_completo}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {fotosValidas.length > 0 ? (
          <section>
            <Eyebrow>Galería · {fotosValidas.length} fotos</Eyebrow>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {fotosValidas.map((f, i) => (
                <Link
                  key={f.id}
                  href={`/jefe/novedades/${f.id}`}
                  className={`relative aspect-[1/1.2] overflow-hidden rounded-[9px] border border-zelanda-beige-200 ${
                    i === fotosValidas.length - 1 && novedadesAbiertas > 0
                      ? "outline outline-2 -outline-offset-2 outline-estado-vencida"
                      : ""
                  }`}
                >
                  <Image
                    src={f.url}
                    alt={`Foto ${ETIQUETA_NOVEDAD[f.tipo] ?? f.tipo}`}
                    fill
                    sizes="25vw"
                    className="object-cover"
                    unoptimized
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex gap-2 pb-2 pt-2">
          <Link
            href={`/trabajador/novedad/nueva?lote_id=${arbol.lote_id}&numero_placa=${arbol.numero_placa}`}
            className="flex min-h-touch flex-[1.4] items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <AlertCircle className="h-[18px] w-[18px]" />
            Reportar novedad
          </Link>
          <Link
            href={`/jefe/novedades`}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            <Camera className="h-[18px] w-[18px]" />
            Histórico
          </Link>
          <Plus aria-hidden className="hidden" />
        </div>
      </div>
    </div>
  );
}

function HeroMini({
  valor,
  unidad,
  sub,
}: {
  valor: React.ReactNode;
  unidad: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-[10px] border border-white/20 px-2 py-1.5 text-center text-zelanda-beige-50"
      style={{ background: "rgba(251,247,240,0.10)" }}
    >
      <p className="m-0 font-serif text-[18px] leading-none">{valor}</p>
      <p className="m-0 mt-0.5 text-[9.5px] uppercase tracking-[0.04em] text-zelanda-beige-100/70">
        {unidad}
      </p>
      <p className="m-0 mt-0.5 text-[9px] text-zelanda-beige-100/55">{sub}</p>
    </div>
  );
}

function NovedadStat({
  valor,
  label,
  color,
  bg,
  destacado,
}: {
  valor: number;
  label: string;
  color: string;
  bg: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-[11px] border px-2.5 py-2.5 text-center ${bg} ${destacado ? "border-[1.5px]" : ""}`}
    >
      <p className={`m-0 font-serif text-[20px] leading-none ${color}`}>
        {valor}
      </p>
      <p
        className={`m-0 mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${color}`}
      >
        {label}
      </p>
    </div>
  );
}
