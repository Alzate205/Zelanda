import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioNuevaAsignacion } from "./FormularioNuevaAsignacion";

export const metadata: Metadata = { title: "Nueva asignación" };

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

  const [lotes, apiarios, tipos, personas] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.apiarios.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipos_tarea.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, area: true },
      orderBy: [{ area: "asc" }, { nombre: "asc" }],
    }),
    prisma.personas.findMany({
      where: {
        deleted_at: null,
        activo: true,
        vinculaciones: { some: { fecha_fin: null } },
      },
      select: { id: true, nombre_completo: true },
      orderBy: { nombre_completo: "asc" },
    }),
  ]);

  return (
    <FormularioNuevaAsignacion
      lotes={lotes.map((l) => ({ id: String(l.id), nombre: l.nombre }))}
      apiarios={apiarios.map((a) => ({ id: String(a.id), nombre: a.nombre }))}
      tipos={tipos.map((t) => ({ id: String(t.id), nombre: t.nombre, area: t.area }))}
      personas={personas.map((p) => ({ id: String(p.id), nombre_completo: p.nombre_completo }))}
      preselect={{
        lote_id: sp.lote_id ?? null,
        apiario_id: sp.apiario_id ?? null,
        tipo_tarea_id: sp.tipo_tarea_id ?? null,
      }}
    />
  );
}
