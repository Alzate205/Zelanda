import { redirect, notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AsignacionCerradaSuccess } from "@/components/shared/AsignacionCerradaSuccess";

export const metadata = { title: "Tarea cerrada" };
export const dynamic = "force-dynamic";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function formatearDuracion(inicio: Date, fin: Date): string {
  const ms = fin.getTime() - inicio.getTime();
  if (ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const dias = Math.floor(h / 24);
  if (dias === 0) return `${h} h`;
  const hRest = h - dias * 24;
  return hRest > 0 ? `${dias} d ${hRest} h` : `${dias} d`;
}

function formatearProxima(diasFreq: number): string {
  if (diasFreq <= 0) return "—";
  if (diasFreq === 1) return "mañana";
  if (diasFreq < 30) return `en ${diasFreq} d`;
  const meses = Math.round(diasFreq / 30);
  return meses === 1 ? "en 1 mes" : `en ${meses} meses`;
}

export default async function PaginaExitoAsignacion({
  params,
}: {
  params: Promise<{ asignacion_id: string }>;
}) {
  await requerirUsuario("TRABAJADOR");
  const { asignacion_id } = await params;
  const id = parsearId(asignacion_id);
  if (!id) notFound();

  const asignacion = await prisma.asignaciones.findUnique({
    where: { id },
    include: {
      tipos_tarea: {
        select: { nombre: true, frecuencia_dias_default: true, area: true },
      },
      lotes: { select: { id: true, nombre: true } },
      apiarios: { select: { id: true, nombre: true } },
      _count: {
        select: {
          registros_avance: true,
        },
      },
    },
  });

  if (!asignacion) notFound();

  // Si todavía no está cerrada, mandamos al inicio del trabajador
  if (asignacion.estado !== "COMPLETADA" || !asignacion.fecha_completada) {
    redirect("/trabajador");
  }

  // Frecuencia override por lote si existe
  let freq = asignacion.tipos_tarea.frecuencia_dias_default;
  if (asignacion.lote_id) {
    const ov = await prisma.frecuencias_lote.findFirst({
      where: {
        lote_id: asignacion.lote_id,
        tipo_tarea_id: asignacion.tipo_tarea_id,
      },
      select: { frecuencia_dias: true },
    });
    if (ov) freq = ov.frecuencia_dias;
  }

  const novedadesCount = asignacion.lote_id
    ? await prisma.novedades.count({
        where: {
          arboles: { lote_id: asignacion.lote_id },
          fecha: {
            gte: asignacion.fecha_inicio,
            lte: asignacion.fecha_completada,
          },
        },
      })
    : 0;

  const destinoNombre =
    asignacion.lotes?.nombre ?? asignacion.apiarios?.nombre ?? "—";
  let totalUnidades = asignacion.arboles_completados;
  if (!asignacion.lote_id && asignacion.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: asignacion.apiario_id },
      select: { total_colmenas: true },
    });
    totalUnidades = ap?.total_colmenas ?? 0;
  }

  const duracion = formatearDuracion(
    asignacion.fecha_inicio,
    asignacion.fecha_completada,
  );
  const proxima = formatearProxima(freq);

  return (
    <AsignacionCerradaSuccess
      loteNombre={destinoNombre}
      tareaNombre={asignacion.tipos_tarea.nombre}
      arboles={totalUnidades}
      duracion={duracion}
      tramos={asignacion._count.registros_avance}
      novedades={novedadesCount}
      proxima={proxima}
      href="/trabajador"
    />
  );
}
