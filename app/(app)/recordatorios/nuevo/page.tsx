import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioRecordatorio } from "./FormularioRecordatorio";

export const metadata = { title: "Nuevo recordatorio" };

export default async function PaginaNuevoRecordatorio() {
  const usuario = await requerirUsuario();

  const personas =
    usuario.rol === "JEFE"
      ? await prisma.personas.findMany({
          where: { activo: true, deleted_at: null },
          select: { id: true, nombre_completo: true },
          orderBy: { nombre_completo: "asc" },
        })
      : [];

  return (
    <FormularioRecordatorio
      esJefe={usuario.rol === "JEFE"}
      personaPropiaId={
        usuario.persona_id !== null ? String(usuario.persona_id) : null
      }
      personaPropiaNombre={usuario.nombre_completo}
      personas={personas.map((p) => ({
        id: String(p.id),
        nombre_completo: p.nombre_completo,
      }))}
    />
  );
}
