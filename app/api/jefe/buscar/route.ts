import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizarError } from "@/lib/errores";

export const dynamic = "force-dynamic";

type ResultadoArbol = {
  lote_id: string;
  lote_nombre: string;
  numero: number;
};

type Respuesta = {
  vacio?: boolean;
  arbol: ResultadoArbol | null;
  lotes: { id: string; nombre: string }[];
  personas: { id: string; nombre_completo: string; cedula: string | null }[];
  herramientas: { id: string; nombre: string; categoria: string }[];
  insumos: { id: string; nombre: string; categoria: string; unidad: string }[];
};

async function buscarArbolParseado(q: string): Promise<ResultadoArbol | null> {
  const trimmed = q.trim();
  const candidatos: { nombre: string; numero: number }[] = [];

  const m1 = trimmed.match(/^(\d+)\s+(.+)$/);
  if (m1) {
    candidatos.push({ nombre: m1[2].trim(), numero: parseInt(m1[1], 10) });
  }
  const m2 = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (m2) {
    candidatos.push({ nombre: m2[1].trim(), numero: parseInt(m2[2], 10) });
  }

  for (const c of candidatos) {
    if (c.numero < 1) continue;
    const lote = await prisma.lotes.findFirst({
      where: {
        deleted_at: null,
        nombre: { equals: c.nombre, mode: "insensitive" },
      },
      select: { id: true, nombre: true, total_arboles: true },
    });
    if (lote && c.numero >= 1 && c.numero <= lote.total_arboles) {
      return {
        lote_id: String(lote.id),
        lote_nombre: lote.nombre,
        numero: c.numero,
      };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "JEFE") {
    return NextResponse.json(
      { error: "Solo el rol JEFE puede usar la búsqueda global." },
      { status: 403 },
    );
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    const vacio: Respuesta = {
      vacio: true,
      arbol: null,
      lotes: [],
      personas: [],
      herramientas: [],
      insumos: [],
    };
    return NextResponse.json(vacio, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const [arbol, lotes, personas, herramientas, insumos] = await Promise.all([
      buscarArbolParseado(q),
      prisma.lotes.findMany({
        where: {
          deleted_at: null,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true },
      }),
      prisma.personas.findMany({
        where: {
          deleted_at: null,
          OR: [
            { nombre_completo: { contains: q, mode: "insensitive" } },
            { cedula: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { nombre_completo: "asc" },
        take: 5,
        select: { id: true, nombre_completo: true, cedula: true },
      }),
      prisma.herramientas.findMany({
        where: {
          activo: true,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true, categoria: true },
      }),
      prisma.insumos.findMany({
        where: {
          activo: true,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true, categoria: true, unidad: true },
      }),
    ]);

    const respuesta: Respuesta = {
      arbol,
      lotes: lotes.map((l) => ({ id: String(l.id), nombre: l.nombre })),
      personas: personas.map((p) => ({
        id: String(p.id),
        nombre_completo: p.nombre_completo,
        cedula: p.cedula,
      })),
      herramientas: herramientas.map((h) => ({
        id: String(h.id),
        nombre: h.nombre,
        categoria: h.categoria,
      })),
      insumos: insumos.map((i) => ({
        id: String(i.id),
        nombre: i.nombre,
        categoria: i.categoria,
        unidad: i.unidad,
      })),
    };

    return NextResponse.json(respuesta, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: sanitizarError(e, "api/jefe/buscar") },
      { status: 500 },
    );
  }
}
