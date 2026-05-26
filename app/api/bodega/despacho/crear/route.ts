import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizarError } from '@/lib/errores';
import { notificarStockBajoSiCorresponde, snapshotDisponiblesAntes } from '@/lib/push/stock-bajo';
import { revalidarDespachos } from '@/lib/revalidar';

type ItemBody = {
  tipo: 'HERRAMIENTA' | 'INSUMO';
  ref_id: string;
  cantidad: number;
};

type Body = {
  id_local: string;
  persona_id: string;
  asignacion_id: string | null;
  items: ItemBody[];
  notas: string | null;
};

function esUuid(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'BODEGA') {
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

  // Idempotencia: si ya existe el despacho con ese id_local, devolver OK.
  const existente = await prisma.despachos.findUnique({
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

  if (!/^\d+$/.test(body.persona_id)) {
    return NextResponse.json({ error: 'Persona inválida.' }, { status: 400 });
  }
  const personaId = BigInt(body.persona_id);

  let asignacionId: bigint | null = null;
  if (body.asignacion_id !== null && body.asignacion_id !== undefined) {
    const raw = String(body.asignacion_id).trim();
    if (raw.length > 0) {
      if (!/^\d+$/.test(raw)) {
        return NextResponse.json({ error: 'Asignación inválida.' }, { status: 400 });
      }
      asignacionId = BigInt(raw);
    }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos un item al despacho.' }, { status: 400 });
  }

  for (const it of body.items) {
    if (it.tipo !== 'HERRAMIENTA' && it.tipo !== 'INSUMO') {
      return NextResponse.json({ error: 'Tipo de item inválido.' }, { status: 400 });
    }
    if (!/^\d+$/.test(String(it.ref_id))) {
      return NextResponse.json({ error: 'Referencia de item inválida.' }, { status: 400 });
    }
    const c = Number(it.cantidad);
    if (!Number.isFinite(c) || c <= 0) {
      return NextResponse.json(
        { error: 'Cantidad inválida en uno de los items.' },
        { status: 400 }
      );
    }
  }

  const notas = body.notas ? String(body.notas).trim() || null : null;

  // Sumar cantidades por insumo (los duplicados se suman)
  const insumosNecesarios = new Map<string, number>();
  for (const it of body.items) {
    if (it.tipo === 'INSUMO') {
      insumosNecesarios.set(
        String(it.ref_id),
        (insumosNecesarios.get(String(it.ref_id)) ?? 0) + Number(it.cantidad)
      );
    }
  }

  for (const [refId, cantidad] of insumosNecesarios) {
    const stock = await prisma.$queryRaw<
      { stock_disponible: string; nombre: string; unidad: string }[]
    >`
      SELECT stock_disponible::text, nombre, unidad
      FROM v_insumos_stock
      WHERE id = ${BigInt(refId)}
    `;
    if (stock.length === 0) {
      return NextResponse.json({ error: 'Insumo inexistente.' }, { status: 409 });
    }
    const disponible = Number(stock[0].stock_disponible);
    if (disponible < cantidad) {
      return NextResponse.json(
        {
          error: `Stock insuficiente de ${stock[0].nombre} (disponible: ${disponible} ${stock[0].unidad}, pedido: ${cantidad})`,
        },
        { status: 409 }
      );
    }
  }

  const insumoIdsPush = body.items
    .filter((it) => it.tipo === 'INSUMO')
    .map((it) => BigInt(it.ref_id));
  const disponiblesAntes = await snapshotDisponiblesAntes(insumoIdsPush);

  let despachoId: bigint;
  try {
    despachoId = await prisma.$transaction(async (tx) => {
      const despacho = await tx.despachos.create({
        data: {
          id_local: body.id_local,
          persona_id: personaId,
          asignacion_id: asignacionId,
          despachado_por_usuario_id: usuario.id,
          estado: 'ABIERTO',
          notas,
        },
      });

      for (const it of body.items) {
        const cantidad = Number(it.cantidad);
        const itemCreado = await tx.despacho_items.create({
          data: {
            despacho_id: despacho.id,
            tipo_item: it.tipo,
            herramienta_id: it.tipo === 'HERRAMIENTA' ? BigInt(it.ref_id) : null,
            insumo_id: it.tipo === 'INSUMO' ? BigInt(it.ref_id) : null,
            cantidad,
          },
        });

        if (it.tipo === 'INSUMO') {
          await tx.insumos.update({
            where: { id: BigInt(it.ref_id) },
            data: { stock_reservado: { increment: cantidad } },
          });
          await tx.movimientos_insumo.create({
            data: {
              insumo_id: BigInt(it.ref_id),
              tipo: 'RESERVA',
              cantidad: -cantidad,
              despacho_item_id: itemCreado.id,
              usuario_id: usuario.id,
            },
          });
        }
      }

      return despacho.id;
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: sanitizarError(e, 'api/bodega/despacho/crear'),
      },
      { status: 500 }
    );
  }

  try {
    await notificarStockBajoSiCorresponde(insumoIdsPush, disponiblesAntes);
  } catch (e) {
    console.warn('Push stock bajo falló:', e);
  }

  revalidarDespachos();
  return NextResponse.json({ ok: true, id: String(despachoId) });
}
