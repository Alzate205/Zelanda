import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularResumen } from "@/lib/fechas-tarea";
import { WizardNuevaAsignacion } from "./WizardNuevaAsignacion";

export const metadata: Metadata = { title: "Nueva asignación" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  lote_id?: string;
  apiario_id?: string;
  tipo_tarea_id?: string;
}>;

export default async function PaginaNuevaAsignacion({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;

  const [lotes, apiarios, tipos, personas, completadasLote, frecuenciasOverride] =
    await Promise.all([
      prisma.lotes.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          nombre: true,
          total_arboles: true,
          hectareas: true,
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.apiarios.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, total_colmenas: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.tipos_tarea.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, area: true, frecuencia_dias_default: true },
        orderBy: [{ area: "asc" }, { nombre: "asc" }],
      }),
      prisma.personas.findMany({
        where: {
          deleted_at: null,
          activo: true,
          vinculaciones: { some: { fecha_fin: null } },
        },
        select: {
          id: true,
          nombre_completo: true,
          vinculaciones: {
            where: { fecha_fin: null },
            select: { tipo: true, rol_finca: true },
            take: 1,
          },
        },
        orderBy: { nombre_completo: "asc" },
      }),
      prisma.asignaciones.groupBy({
        by: ["lote_id", "tipo_tarea_id"],
        where: { estado: "COMPLETADA", lote_id: { not: null } },
        _max: { fecha_completada: true },
      }),
      prisma.frecuencias_lote.findMany({
        select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
      }),
    ]);

  // Carga actual: asignaciones abiertas por persona
  const cargaPorPersona = await prisma.asignaciones.groupBy({
    by: ["persona_id"],
    where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } },
    _count: { _all: true },
  });
  const mapaCarga = new globalThis.Map<string, number>();
  for (const c of cargaPorPersona) {
    mapaCarga.set(String(c.persona_id), c._count._all);
  }

  // Últimos lotes trabajados por persona (los 2 más recientes)
  const recientesPorPersona = await prisma.asignaciones.findMany({
    where: { lote_id: { not: null } },
    orderBy: { fecha_inicio: "desc" },
    take: 200,
    select: {
      persona_id: true,
      lotes: { select: { nombre: true } },
    },
  });
  const mapaRecientes = new globalThis.Map<string, string[]>();
  for (const r of recientesPorPersona) {
    const key = String(r.persona_id);
    const lista = mapaRecientes.get(key) ?? [];
    if (lista.length < 2 && r.lotes && !lista.includes(r.lotes.nombre)) {
      lista.push(r.lotes.nombre);
      mapaRecientes.set(key, lista);
    }
  }

  // Estado por lote (peor estado de sus tipos de tarea de cultivo)
  const tiposCultivo = tipos.filter((t) => t.area === "CULTIVO");
  const mapaFreq = new globalThis.Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }
  const mapaUltimaLote = new globalThis.Map<string, Date | null>();
  for (const c of completadasLote) {
    if (c.lote_id) {
      mapaUltimaLote.set(
        `${c.lote_id}_${c.tipo_tarea_id}`,
        c._max.fecha_completada,
      );
    }
  }

  type EstadoLote = "vencida" | "proxima" | "aldia";
  const lotesEnriquecidos = lotes.map((l) => {
    let estado: EstadoLote = "aldia";
    let proximaTarea = "—";
    let menorDias = Number.POSITIVE_INFINITY;
    let tipoMasUrgenteId: string | null = null;

    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const r = calcularResumen(ultima, freq);

      if (
        r.estado === "vencida" ||
        r.estado === "sin_historial"
      ) {
        if (estado !== "vencida") {
          estado = "vencida";
          tipoMasUrgenteId = String(t.id);
          proximaTarea = `${t.nombre} vencida`;
          menorDias = r.dias_para_proxima ?? -999;
        } else if ((r.dias_para_proxima ?? -999) < menorDias) {
          tipoMasUrgenteId = String(t.id);
          proximaTarea = `${t.nombre} vencida`;
          menorDias = r.dias_para_proxima ?? -999;
        }
      } else if (r.estado === "proxima") {
        if (estado === "aldia") {
          estado = "proxima";
          tipoMasUrgenteId = String(t.id);
          proximaTarea = `${t.nombre} en ${r.dias_para_proxima} d`;
          menorDias = r.dias_para_proxima ?? 999;
        } else if (
          estado === "proxima" &&
          (r.dias_para_proxima ?? 999) < menorDias
        ) {
          tipoMasUrgenteId = String(t.id);
          proximaTarea = `${t.nombre} en ${r.dias_para_proxima} d`;
          menorDias = r.dias_para_proxima ?? 999;
        }
      }
    }

    if (estado === "aldia") {
      // mostrar la siguiente tarea más próxima (positiva)
      let proxDias = Number.POSITIVE_INFINITY;
      for (const t of tiposCultivo) {
        const key = `${l.id}_${t.id}`;
        const ultima = mapaUltimaLote.get(key) ?? null;
        const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
        const r = calcularResumen(ultima, freq);
        if (
          r.estado === "aldia" &&
          r.dias_para_proxima !== null &&
          r.dias_para_proxima < proxDias
        ) {
          proxDias = r.dias_para_proxima;
          proximaTarea = `${t.nombre} en ${r.dias_para_proxima} d`;
        }
      }
    }

    return {
      id: String(l.id),
      nombre: l.nombre,
      total_arboles: l.total_arboles,
      hectareas: l.hectareas !== null ? Number(l.hectareas) : null,
      estado,
      proxima_tarea: proximaTarea,
      tipo_sugerido_id: tipoMasUrgenteId,
    };
  });

  const apiariosEnriquecidos = apiarios.map((a) => ({
    id: String(a.id),
    nombre: a.nombre,
    total_colmenas: a.total_colmenas,
  }));

  const tiposEnriquecidos = tipos.map((t) => ({
    id: String(t.id),
    nombre: t.nombre,
    area: t.area as "CULTIVO" | "APICULTURA",
    freq: t.frecuencia_dias_default,
  }));

  const ETIQUETA_VINC: Record<string, string> = {
    FIJO: "Fijo",
    JORNALERO: "Jornalero",
    CONTRATISTA: "Contratista",
    FAMILIAR: "Familiar",
  };

  const personasEnriquecidas = personas.map((p) => {
    const v = p.vinculaciones[0];
    return {
      id: String(p.id),
      nombre_completo: p.nombre_completo,
      vinculo: v ? (ETIQUETA_VINC[v.tipo] ?? v.tipo) : "—",
      rol_finca: v?.rol_finca ?? null,
      carga: mapaCarga.get(String(p.id)) ?? 0,
      ultimos: mapaRecientes.get(String(p.id)) ?? [],
    };
  });

  return (
    <WizardNuevaAsignacion
      lotes={lotesEnriquecidos}
      apiarios={apiariosEnriquecidos}
      tipos={tiposEnriquecidos}
      personas={personasEnriquecidas}
      preselect={{
        lote_id: sp.lote_id ?? null,
        apiario_id: sp.apiario_id ?? null,
        tipo_tarea_id: sp.tipo_tarea_id ?? null,
      }}
    />
  );
}
