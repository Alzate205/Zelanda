import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  asignacion_id: string;
  kg: number;
  notas: string | null;
};

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "TRABAJADOR" || usuario.persona_id === null) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!/^\d+$/.test(body.asignacion_id)) {
    return NextResponse.json({ error: "asignacion_id inválido" }, { status: 400 });
  }
  if (typeof body.kg !== "number" || !Number.isFinite(body.kg) || body.kg <= 0) {
    return NextResponse.json({ error: "Kg debe ser positivo" }, { status: 400 });
  }

  const asignacionId = BigInt(body.asignacion_id);
  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: { tipos_tarea: { select: { area: true, nombre: true } } },
  });
  if (!asignacion) {
    return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  }
  if (BigInt(usuario.persona_id) !== asignacion.persona_id) {
    return NextResponse.json({ error: "No es tu asignación" }, { status: 403 });
  }
  if (asignacion.estado !== "PENDIENTE" && asignacion.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Asignación cerrada" }, { status: 409 });
  }
  if (asignacion.apiario_id === null) {
    return NextResponse.json({ error: "Cosecha de miel requiere apiario" }, { status: 400 });
  }
  if (asignacion.tipos_tarea.area !== "APICULTURA") {
    return NextResponse.json({ error: "Tipo de tarea inválido" }, { status: 400 });
  }

  const notas = body.notas?.trim() || null;

  const creada = await prisma.$transaction(async (tx) => {
    const c = await tx.cosechas_miel.create({
      data: {
        apiario_id: asignacion.apiario_id!,
        persona_id: BigInt(usuario.persona_id!),
        asignacion_id: asignacionId,
        kg: body.kg,
        notas,
        registrado_por_usuario_id: usuario.id,
      },
    });
    await tx.asignaciones.update({
      where: { id: asignacionId },
      data: { estado: "COMPLETADA", fecha_completada: new Date() },
    });
    return c;
  });

  return NextResponse.json({ ok: true, id: String(creada.id) });
}
