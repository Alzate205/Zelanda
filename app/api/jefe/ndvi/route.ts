import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { infoNdvi, obtenerNdvi } from '@/lib/jefe/ndvi';

// La primera generación llama a Sentinel Hub (hasta ~30 s): margen amplio
// para que Vercel no corte la función antes de recibir la imagen.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'JEFE') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  if (request.nextUrl.searchParams.has('info')) {
    return NextResponse.json({ ok: true, data: await infoNdvi() });
  }

  const r = await obtenerNdvi();
  if ('error' in r) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 503 });
  }
  return new NextResponse(Buffer.from(r.png_base64, 'base64'), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
