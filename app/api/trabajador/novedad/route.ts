import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  id_local: string;
  lote_id: string;
  numero_placa: number;
  tipo: "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
  descripcion: string;
};

function esUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const TIPOS_VALIDOS = ["PLAGA", "DANO_FISICO", "ENFERMEDAD", "OBSERVACION", "OTRO"];

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
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

  const existente = await prisma.novedades.findUnique({
    where: { id_local: body.id_local },
    select: { id: true },
  });
  if (existente) {
    return NextResponse.json({ ok: true, id: String(existente.id), duplicado: true });
  }

  if (!/^\d+$/.test(body.lote_id)) {
    return NextResponse.json({ error: "lote_id inválido" }, { status: 400 });
  }
  if (!Number.isInteger(body.numero_placa) || body.numero_placa < 1) {
    return NextResponse.json({ error: "numero_placa inválido" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  const descripcion = body.descripcion?.trim();
  if (!descripcion) {
    return NextResponse.json({ error: "Descripción obligatoria" }, { status: 400 });
  }

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: BigInt(body.lote_id), numero_placa: body.numero_placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol) {
    return NextResponse.json(
      { error: `No existe el árbol ${body.numero_placa} en ese lote` },
      { status: 404 },
    );
  }

  const creada = await prisma.novedades.create({
    data: {
      id_local: body.id_local,
      arbol_id: arbol.id,
      persona_id: BigInt(usuario.persona_id),
      tipo: body.tipo,
      descripcion,
      foto_path: null,
      resuelta: false,
    },
  });

  // Push a jefes (best effort)
  try {
    const ETIQUETA: Record<string, string> = {
      PLAGA: "Plaga",
      DANO_FISICO: "Daño físico",
      ENFERMEDAD: "Enfermedad",
      OBSERVACION: "Observación",
      OTRO: "Otro",
    };
    const detalle = await prisma.arboles.findUnique({
      where: { id: arbol.id },
      select: { numero_placa: true, lotes: { select: { nombre: true } } },
    });
    const jefes = await prisma.usuarios.findMany({
      where: { rol: "JEFE", activo: true },
      select: { id: true },
    });
    if (detalle && jefes.length > 0) {
      const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
      await enviarPushAUsuarios(
        jefes.map((j) => j.id),
        {
          titulo: `Novedad: ${ETIQUETA[body.tipo] ?? body.tipo}`,
          cuerpo: `Árbol ${detalle.numero_placa} · Lote ${detalle.lotes.nombre}`,
          url: `/jefe/novedades/${creada.id}`,
          tag: `novedad-${creada.id}`,
        },
      );
    }
  } catch (e) {
    console.warn("Push novedad falló:", e);
  }

  return NextResponse.json({ ok: true, id: String(creada.id) });
}
