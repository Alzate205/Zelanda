import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { obtenerHistoriaMes, obtenerRangoHistoria } from '@/lib/jefe/historia';

export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'JEFE') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const mes = request.nextUrl.searchParams.get('mes');
  if (mes === null) {
    const rango = await obtenerRangoHistoria();
    return NextResponse.json({ ok: true, data: rango });
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ ok: false, error: 'Mes inválido (YYYY-MM)' }, { status: 400 });
  }
  const datos = await obtenerHistoriaMes(mes);
  return NextResponse.json({ ok: true, data: datos });
}
