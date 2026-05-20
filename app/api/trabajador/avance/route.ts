import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  id_local: string;
  asignacion_id: string;
  tipo_registro: "TRAMO" | "SUELTOS" | "VISITA";
  arbol_desde: number | null;
  arbol_hasta: number | null;
  arboles_lista: number[];
  observaciones: string | null;
};

function esUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

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

  if (!esUuid(body.id_local)) {
    return NextResponse.json({ error: "id_local inválido" }, { status: 400 });
  }

  // Idempotencia: si ya existe, devolver OK
  const existente = await prisma.registros_avance.findUnique({
    where: { id_local: body.id_local },
    select: { id: true },
  });
  if (existente) {
    return NextResponse.json({ ok: true, id: String(existente.id), duplicado: true });
  }

  if (!/^\d+$/.test(body.asignacion_id)) {
    return NextResponse.json({ error: "asignacion_id inválido" }, { status: 400 });
  }
  const asignacionId = BigInt(body.asignacion_id);
  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: { lotes: { select: { total_arboles: true } } },
  });
  if (!asignacion) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  if (BigInt(usuario.persona_id) !== asignacion.persona_id) {
    return NextResponse.json({ error: "No es tu asignación" }, { status: 403 });
  }
  if (asignacion.estado !== "PENDIENTE" && asignacion.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Asignación cerrada" }, { status: 409 });
  }

  const observaciones = body.observaciones?.trim() || null;

  if (body.tipo_registro === "VISITA") {
    if (asignacion.apiario_id === null) {
      return NextResponse.json({ error: "VISITA solo aplica a apiario" }, { status: 400 });
    }
    const creado = await prisma.$transaction(async (tx) => {
      const r = await tx.registros_avance.create({
        data: {
          id_local: body.id_local,
          asignacion_id: asignacionId,
          persona_id: BigInt(usuario.persona_id!),
          tipo_registro: "VISITA",
          cantidad_arboles: 0,
          arboles_lista: [],
          observaciones,
        },
      });
      await tx.asignaciones.update({
        where: { id: asignacionId },
        data: { estado: "COMPLETADA", fecha_completada: new Date() },
      });
      return r;
    });
    return NextResponse.json({ ok: true, id: String(creado.id) });
  }

  if (asignacion.lote_id === null) {
    return NextResponse.json({ error: "TRAMO/SUELTOS solo aplica a lote" }, { status: 400 });
  }
  const totalArboles = asignacion.lotes?.total_arboles ?? 0;
  if (totalArboles <= 0) {
    return NextResponse.json({ error: "Lote sin árboles cargados" }, { status: 409 });
  }

  let cantidad = 0;
  let arbol_desde: number | null = null;
  let arbol_hasta: number | null = null;
  let arboles_lista: number[] = [];

  if (body.tipo_registro === "TRAMO") {
    const d = body.arbol_desde;
    const h = body.arbol_hasta;
    if (typeof d !== "number" || typeof h !== "number" || d < 1 || h < 1 || d > totalArboles || h > totalArboles) {
      return NextResponse.json({ error: `Números fuera de rango (1..${totalArboles})` }, { status: 400 });
    }
    if (d > h) return NextResponse.json({ error: "Desde > Hasta" }, { status: 400 });
    arbol_desde = d;
    arbol_hasta = h;
    cantidad = h - d + 1;
  } else if (body.tipo_registro === "SUELTOS") {
    const lista = Array.isArray(body.arboles_lista) ? body.arboles_lista : [];
    if (lista.length === 0 || lista.some((n) => !Number.isInteger(n) || n < 1)) {
      return NextResponse.json({ error: "Lista de árboles inválida" }, { status: 400 });
    }
    const fueraRango = lista.filter((n) => n > totalArboles);
    if (fueraRango.length > 0) {
      return NextResponse.json({
        error: `Números fuera de rango: ${fueraRango.slice(0, 5).join(", ")}`,
      }, { status: 400 });
    }
    arboles_lista = lista;
    cantidad = lista.length;
  } else {
    return NextResponse.json({ error: "tipo_registro inválido" }, { status: 400 });
  }

  const nuevoTotal = asignacion.arboles_completados + cantidad;
  const debeCompletar = nuevoTotal >= totalArboles;

  const creado = await prisma.$transaction(async (tx) => {
    const r = await tx.registros_avance.create({
      data: {
        id_local: body.id_local,
        asignacion_id: asignacionId,
        persona_id: BigInt(usuario.persona_id!),
        tipo_registro: body.tipo_registro === "TRAMO" ? "TRAMO" : "SUELTOS",
        arbol_desde,
        arbol_hasta,
        arboles_lista,
        cantidad_arboles: cantidad,
        observaciones,
      },
    });
    await tx.asignaciones.update({
      where: { id: asignacionId },
      data: {
        arboles_completados: nuevoTotal,
        ultimo_arbol_trabajado:
          arbol_hasta !== null
            ? Math.max(asignacion.ultimo_arbol_trabajado, arbol_hasta)
            : asignacion.ultimo_arbol_trabajado,
        estado: debeCompletar ? "COMPLETADA" : "EN_CURSO",
        fecha_completada: debeCompletar ? new Date() : null,
      },
    });
    return r;
  });

  return NextResponse.json({ ok: true, id: String(creado.id) });
}
