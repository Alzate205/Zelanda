import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizarError } from '@/lib/errores';
import { revalidarSnapshotAlmacen, revalidarDashboards } from '@/lib/revalidar';

type Body = {
  id_local: string;
  persona_id: string;
  lote_id: string;
  metodo: 'CANASTA' | 'BASCULA';
  cantidad_canastas: number | null;
  capacidad_canasta_kg: number | null;
  peso_kg: number;
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

  const existente = await prisma.cosechas.findUnique({
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
    return NextResponse.json({ error: 'persona_id inválido' }, { status: 400 });
  }
  if (!/^\d+$/.test(body.lote_id)) {
    return NextResponse.json({ error: 'lote_id inválido' }, { status: 400 });
  }
  if (body.metodo !== 'CANASTA' && body.metodo !== 'BASCULA') {
    return NextResponse.json({ error: 'Método inválido' }, { status: 400 });
  }

  let pesoKg: number;
  let cantidadCanastas: number | null = null;
  let capacidadCanastaKg: number | null = null;

  if (body.metodo === 'CANASTA') {
    const c = body.cantidad_canastas;
    const cap = body.capacidad_canasta_kg;
    if (!Number.isInteger(c) || (c ?? 0) <= 0) {
      return NextResponse.json(
        { error: 'Cantidad de canastas debe ser entero positivo' },
        { status: 400 }
      );
    }
    if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) {
      return NextResponse.json(
        { error: 'Capacidad de canasta debe ser positiva' },
        { status: 400 }
      );
    }
    cantidadCanastas = c;
    capacidadCanastaKg = cap;
    pesoKg = (c as number) * cap;
  } else {
    const p = body.peso_kg;
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) {
      return NextResponse.json({ error: 'Peso debe ser positivo' }, { status: 400 });
    }
    pesoKg = p;
  }

  try {
    const creada = await prisma.cosechas.create({
      data: {
        id_local: body.id_local,
        persona_id: BigInt(body.persona_id),
        lote_id: BigInt(body.lote_id),
        recibido_por_usuario_id: usuario.id,
        metodo_medicion: body.metodo,
        cantidad_canastas: cantidadCanastas,
        capacidad_canasta_kg: capacidadCanastaKg,
        peso_kg: pesoKg,
        notas: body.notas?.trim() || null,
      },
    });
    revalidarSnapshotAlmacen();
    revalidarDashboards();
    return NextResponse.json({ ok: true, id: String(creada.id) });
  } catch (e) {
    return NextResponse.json({ error: sanitizarError(e, 'api/almacen/cosecha') }, { status: 500 });
  }
}
