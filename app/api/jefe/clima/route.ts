import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { obtenerClimaFinca } from '@/lib/jefe/clima';

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'JEFE') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }
  try {
    const clima = await obtenerClimaFinca();
    return NextResponse.json({ ok: true, data: clima });
  } catch {
    return NextResponse.json({ ok: false, error: 'Pronóstico no disponible' }, { status: 502 });
  }
}
