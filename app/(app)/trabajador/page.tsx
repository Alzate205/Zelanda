import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListaTareasCliente } from "./_lista-tareas-cliente";
import type { SnapshotTrabajador } from "@/lib/offline/tipos";

export const metadata = { title: "Mis tareas" };
export const dynamic = "force-dynamic";

export default async function PaginaInicioTrabajador() {
  const usuario = await requerirUsuario("TRABAJADOR");
  const nombrePila = usuario.nombre_completo.split(" ")[0];

  let snapshot: SnapshotTrabajador | null = null;
  if (usuario.persona_id !== null) {
    const personaId = BigInt(usuario.persona_id);
    const asignaciones = await prisma.asignaciones.findMany({
      where: { persona_id: personaId, estado: { in: ["PENDIENTE", "EN_CURSO"] } },
      orderBy: { fecha_inicio: "asc" },
      include: {
        tipos_tarea: { select: { id: true, nombre: true, area: true } },
        lotes: { select: { id: true, nombre: true, total_arboles: true } },
      },
    });
    const apiarioIds = Array.from(
      new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
    );
    const apiarios = apiarioIds.length
      ? await prisma.apiarios.findMany({
          where: { id: { in: apiarioIds } },
          select: { id: true, nombre: true, total_colmenas: true },
        })
      : [];
    const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a]));
    const lotes = await prisma.lotes.findMany({
      where: { deleted_at: null, total_arboles: { gt: 0 } },
      select: { id: true, nombre: true, total_arboles: true },
      orderBy: { nombre: "asc" },
    });

    snapshot = {
      ts: new Date().toISOString(),
      lotes: lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        total_arboles: l.total_arboles,
        ts_cache: Date.now(),
      })),
      asignaciones: asignaciones.map((a) => {
        const ap = a.apiario_id ? mapaApiario.get(String(a.apiario_id)) : null;
        return {
          id: String(a.id),
          persona_id: String(a.persona_id),
          tipo_tarea_id: String(a.tipo_tarea_id),
          tipo_tarea_nombre: a.tipos_tarea.nombre,
          tipo_tarea_area: a.tipos_tarea.area,
          lote_id: a.lote_id ? String(a.lote_id) : null,
          lote_nombre: a.lotes?.nombre ?? null,
          total_arboles: a.lotes?.total_arboles ?? null,
          arboles_completados: a.arboles_completados,
          ultimo_arbol_trabajado: a.ultimo_arbol_trabajado,
          apiario_id: a.apiario_id ? String(a.apiario_id) : null,
          apiario_nombre: ap?.nombre ?? null,
          total_colmenas: ap?.total_colmenas ?? null,
          estado: a.estado,
          fecha_inicio: a.fecha_inicio.toISOString(),
          ts_cache: Date.now(),
        };
      }),
    };
  }

  return <ListaTareasCliente nombrePila={nombrePila} snapshotInicial={snapshot} />;
}
