import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type FilaInsumoStock = {
  id: bigint;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: string;
  stock_reservado: string;
  stock_minimo: string;
  stock_disponible: string;
};

type FilaHerramientaPrestada = {
  herramienta_id: bigint;
  prestadas: string;
};

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "BODEGA") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Herramientas activas + cuántas hay prestadas (en despachos abiertos, no devueltas).
  const herramientasRaw = await prisma.herramientas.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      categoria: true,
      total: true,
    },
  });

  const prestadasRaw = await prisma.$queryRaw<FilaHerramientaPrestada[]>`
    SELECT di.herramienta_id, COALESCE(SUM(di.cantidad), 0)::text AS prestadas
    FROM despacho_items di
    INNER JOIN despachos d ON d.id = di.despacho_id
    WHERE di.tipo_item = 'HERRAMIENTA'
      AND di.devuelto = false
      AND d.estado = 'ABIERTO'
      AND di.herramienta_id IS NOT NULL
    GROUP BY di.herramienta_id
  `;
  const mapaPrestadas = new Map<string, number>();
  for (const f of prestadasRaw) {
    mapaPrestadas.set(String(f.herramienta_id), Number(f.prestadas));
  }

  const herramientas = herramientasRaw.map((h) => {
    const prestadas = mapaPrestadas.get(String(h.id)) ?? 0;
    const total = h.total;
    return {
      id: String(h.id),
      nombre: h.nombre,
      categoria: String(h.categoria),
      unidad: "unidades",
      total,
      prestadas,
      disponibles: Math.max(total - prestadas, 0),
    };
  });

  // Insumos desde v_insumos_stock.
  const insumosRaw = await prisma.$queryRaw<FilaInsumoStock[]>`
    SELECT id, nombre, categoria::text AS categoria, unidad,
           stock_actual::text, stock_reservado::text,
           stock_minimo::text, stock_disponible::text
    FROM v_insumos_stock
    WHERE activo = true
    ORDER BY nombre ASC
  `;
  const insumos = insumosRaw.map((i) => ({
    id: String(i.id),
    nombre: i.nombre,
    categoria: i.categoria,
    unidad: i.unidad,
    stock_actual: Number(i.stock_actual),
    stock_reservado: Number(i.stock_reservado),
    stock_minimo: Number(i.stock_minimo),
    stock_disponible: Number(i.stock_disponible),
  }));

  // Personas activas con vinculación vigente.
  const personasRaw = await prisma.personas.findMany({
    where: {
      activo: true,
      deleted_at: null,
      vinculaciones: { some: { fecha_fin: null } },
    },
    orderBy: { nombre_completo: "asc" },
    select: { id: true, nombre_completo: true },
  });
  const personas = personasRaw.map((p) => ({
    id: String(p.id),
    nombre: p.nombre_completo,
  }));

  // Asignaciones PENDIENTE/EN_CURSO.
  const asignacionesRaw = await prisma.asignaciones.findMany({
    where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } },
    orderBy: { fecha_inicio: "asc" },
    select: {
      id: true,
      persona_id: true,
      tipos_tarea: { select: { nombre: true } },
      lotes: { select: { nombre: true } },
      apiarios: { select: { nombre: true } },
    },
  });
  const asignaciones = asignacionesRaw.map((a) => ({
    id: String(a.id),
    persona_id: String(a.persona_id),
    etiqueta: `${a.tipos_tarea.nombre} · ${
      a.lotes?.nombre ?? a.apiarios?.nombre ?? "—"
    }`,
  }));

  // Despachos abiertos del usuario actual.
  const despachosRaw = await prisma.despachos.findMany({
    where: {
      estado: "ABIERTO",
      despachado_por_usuario_id: usuario.id,
    },
    orderBy: { fecha: "desc" },
    include: {
      persona: { select: { nombre_completo: true } },
      despacho_items: {
        include: {
          herramientas: { select: { nombre: true } },
          insumos: { select: { nombre: true, unidad: true } },
        },
      },
    },
  });
  const despachos_abiertos = despachosRaw.map((d) => ({
    id: String(d.id),
    persona_nombre: d.persona.nombre_completo,
    fecha_despacho: d.fecha.toISOString(),
    items: d.despacho_items.map((it) => ({
      id: String(it.id),
      tipo: it.tipo_item as "HERRAMIENTA" | "INSUMO",
      nombre:
        it.tipo_item === "HERRAMIENTA"
          ? it.herramientas?.nombre ?? "?"
          : it.insumos?.nombre ?? "?",
      unidad:
        it.tipo_item === "HERRAMIENTA" ? "unidades" : it.insumos?.unidad ?? "",
      cantidad: Number(it.cantidad),
    })),
  }));

  return NextResponse.json({
    herramientas,
    insumos,
    personas,
    asignaciones,
    despachos_abiertos,
    ts: new Date().toISOString(),
  });
}
