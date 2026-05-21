import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || (usuario.rol !== "ALMACEN" && usuario.rol !== "JEFE")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [personas, lotes, stockRows] = await Promise.all([
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, total_arboles: true },
    }),
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
  ]);

  return NextResponse.json({
    personas: personas.map((p) => ({
      id: String(p.id),
      nombre: p.nombre_completo,
    })),
    lotes: lotes.map((l) => ({
      id: String(l.id),
      nombre: l.nombre,
      total_arboles: l.total_arboles,
    })),
    stock_almacen_kg: Number(stockRows[0]?.stock_kg ?? 0),
    ts: new Date().toISOString(),
  });
}
