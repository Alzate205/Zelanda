import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Sprout,
  AlertCircle,
  Camera,
  Calendar,
  History,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFotoFirmada } from "@/lib/supabase/storage";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  SALUDABLE: "Saludable",
  CON_NOVEDAD: "Con novedad",
  MUERTO: "Muerto",
  REMOVIDO: "Removido",
};

const TONO_ESTADO: Record<string, "info" | "alerta" | "neutro"> = {
  SALUDABLE: "info",
  CON_NOVEDAD: "alerta",
  MUERTO: "neutro",
  REMOVIDO: "neutro",
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

function aniosDesde(fecha: Date): string {
  const ms = Date.now() - fecha.getTime();
  const dias = Math.floor(ms / 86400000);
  if (dias < 30) return `${dias} día${dias === 1 ? "" : "s"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 24) return `${meses} mes${meses === 1 ? "" : "es"}`;
  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses - anios * 12;
  return mesesRestantes > 0
    ? `${anios} año${anios === 1 ? "" : "s"} ${mesesRestantes} m`
    : `${anios} año${anios === 1 ? "" : "s"}`;
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
      lotes: { select: { id: true, nombre: true, total_arboles: true } },
    },
  });

  if (!arbol) notFound();

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

  const conteoTareas = new Map<string, number>();
  for (const r of registros) {
    conteoTareas.set(
      r.tipo_tarea_nombre,
      (conteoTareas.get(r.tipo_tarea_nombre) ?? 0) + 1,
    );
  }
  const conteoArr = [...conteoTareas.entries()].sort((a, b) => b[1] - a[1]);

  const novedadesAbiertas = novedades.filter((n) => !n.resuelta).length;
  const tonoActual = TONO_ESTADO[arbol.estado] ?? "neutro";

  return (
    <div className="space-y-5">
      <Link
        href={`/jefe/lotes/${arbol.lote_id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lote {arbol.lotes.nombre}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Árbol
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-serif text-3xl text-zelanda-verde-900">
          <Sprout className="h-7 w-7 shrink-0 text-zelanda-verde-600" />
          Nº {arbol.numero_placa}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Lote {arbol.lotes.nombre} · de {arbol.lotes.total_arboles.toLocaleString("es-CO")} árboles
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BadgeBase tono={tonoActual}>{ETIQUETA_ESTADO[arbol.estado] ?? arbol.estado}</BadgeBase>
          {novedadesAbiertas > 0 ? (
            <BadgeBase tono="alerta">
              {novedadesAbiertas} novedad{novedadesAbiertas === 1 ? "" : "es"} sin resolver
            </BadgeBase>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Información</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Siembra
            </dt>
            <dd className="mt-0.5 text-zelanda-verde-900">
              {arbol.fecha_siembra ? formatearFechaCorta(arbol.fecha_siembra) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Edad
            </dt>
            <dd className="mt-0.5 text-zelanda-verde-900">
              {arbol.fecha_siembra ? aniosDesde(arbol.fecha_siembra) : "—"}
            </dd>
          </div>
        </dl>
        {arbol.notas ? (
          <p className="mt-4 whitespace-pre-wrap border-t border-zelanda-beige-200 pt-4 text-sm leading-relaxed text-zelanda-verde-700">
            {arbol.notas}
          </p>
        ) : null}
      </section>

      {conteoArr.length > 0 ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <Calendar className="h-4 w-4 text-zelanda-verde-700" />
            Intervenciones acumuladas
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {conteoArr.map(([nombre, count]) => (
              <li
                key={nombre}
                className="flex items-baseline justify-between rounded-lg border border-zelanda-beige-200 px-3 py-2"
              >
                <span className="text-sm text-zelanda-verde-900">{nombre}</span>
                <span className="font-serif text-lg text-zelanda-verde-700">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <History className="h-4 w-4 text-zelanda-verde-700" />
          Historial de tareas
          <span className="text-sm font-normal text-zelanda-verde-700">({registros.length})</span>
        </h2>
        {registros.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Aún no hay tareas registradas sobre este árbol.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {registros.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zelanda-beige-200 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-zelanda-verde-900">
                    {r.tipo_tarea_nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700">
                    {formatearFechaCorta(r.fecha_registro)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-zelanda-verde-700">
                  Por {r.persona_nombre} · {r.tipo_registro.toLowerCase()}
                </p>
                {r.observaciones ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs text-zelanda-verde-800">
                    {r.observaciones}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <AlertCircle className="h-4 w-4 text-zelanda-ocre-600" />
            Novedades
            <span className="text-sm font-normal text-zelanda-verde-700">({novedades.length})</span>
          </h2>
        </div>
        {novedades.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Sin novedades registradas.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedades.map((n) => (
              <li key={String(n.id)}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="block rounded-lg border border-zelanda-beige-200 px-3 py-2 transition hover:bg-zelanda-beige-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <BadgeBase tono={n.resuelta ? "neutro" : "alerta"}>
                      {ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo}
                    </BadgeBase>
                    {n.resuelta ? <BadgeBase tono="info">Resuelta</BadgeBase> : null}
                    <span className="text-xs text-zelanda-verde-700">
                      {formatearFechaCorta(n.fecha)}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-zelanda-verde-900">
                    {n.descripcion}
                  </p>
                  <p className="mt-0.5 text-xs text-zelanda-verde-700">
                    Reportado por {n.persona.nombre_completo}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {fotosValidas.length > 0 ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <Camera className="h-4 w-4 text-zelanda-verde-700" />
            Galería
            <span className="text-sm font-normal text-zelanda-verde-700">({fotosValidas.length})</span>
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fotosValidas.map((f) => (
              <Link
                key={f.id}
                href={`/jefe/novedades/${f.id}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-zelanda-beige-200"
              >
                <Image
                  src={f.url}
                  alt={`Foto ${ETIQUETA_NOVEDAD[f.tipo] ?? f.tipo}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover transition group-hover:opacity-90"
                  unoptimized
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
