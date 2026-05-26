import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizarError } from '@/lib/errores';
import { revalidarSnapshotAlmacen, revalidarDashboards } from '@/lib/revalidar';

type Body = {
  id_local: string;
  tipo: 'VENTA' | 'CONSUMO' | 'PERDIDA' | 'OTRO';
  cantidad_kg: number;
  cliente_detalle: string | null;
  cliente_id: string | null;
  precio_total: number | null;
  notas: string | null;
};

function parsearBigInt(raw: string | null | undefined): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function esUuid(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

function esTipoValido(v: string): v is 'VENTA' | 'CONSUMO' | 'PERDIDA' | 'OTRO' {
  return v === 'VENTA' || v === 'CONSUMO' || v === 'PERDIDA' || v === 'OTRO';
}

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'ALMACEN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!esUuid(body.id_local)) {
    return NextResponse.json({ error: 'id_local inválido' }, { status: 400 });
  }

  const existente = await prisma.salidas_cosecha.findUnique({
    where: { id_local: body.id_local },
    select: { id: true },
  });
  if (existente) {
    return NextResponse.json({
      ok: true,
      id: String(existente.id),
      duplicado: true,
    });
  }

  if (!esTipoValido(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  if (
    typeof body.cantidad_kg !== 'number' ||
    !Number.isFinite(body.cantidad_kg) ||
    body.cantidad_kg <= 0
  ) {
    return NextResponse.json({ error: 'Cantidad debe ser positiva' }, { status: 400 });
  }

  const cliente = body.cliente_detalle?.trim() || null;
  const clienteId = parsearBigInt(body.cliente_id);
  if (body.tipo === 'VENTA' && !cliente && !clienteId) {
    return NextResponse.json({ error: 'Para ventas, indica el cliente' }, { status: 400 });
  }

  let precio: number | null = null;
  if (body.tipo === 'VENTA' && body.precio_total !== null) {
    if (
      typeof body.precio_total !== 'number' ||
      !Number.isFinite(body.precio_total) ||
      body.precio_total <= 0
    ) {
      return NextResponse.json({ error: 'Precio total debe ser positivo' }, { status: 400 });
    }
    precio = body.precio_total;
  }

  const stockRows = await prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `;
  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  if (body.cantidad_kg > stock) {
    return NextResponse.json(
      { error: `Stock insuficiente. Disponible: ${stock.toFixed(2)} kg` },
      { status: 409 }
    );
  }

  try {
    const creada = await prisma.salidas_cosecha.create({
      data: {
        id_local: body.id_local,
        tipo: body.tipo,
        cantidad_kg: body.cantidad_kg,
        cliente_detalle: cliente,
        cliente_id: clienteId,
        precio_total: precio,
        registrado_por_usuario_id: usuario.id,
        notas: body.notas?.trim() || null,
      },
    });
    revalidarSnapshotAlmacen();
    revalidarDashboards();
    return NextResponse.json({ ok: true, id: String(creada.id) });
  } catch (e) {
    return NextResponse.json({ error: sanitizarError(e, 'api/almacen/salida') }, { status: 500 });
  }
}
