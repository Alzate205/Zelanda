import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { subirFoto } from '@/lib/supabase/storage';

const MAX_BYTES = 6 * 1024 * 1024;
const CARPETAS = ['avance', 'novedades'] as const;
type Carpeta = (typeof CARPETAS)[number];

function esCarpeta(v: string): v is Carpeta {
  return (CARPETAS as readonly string[]).includes(v);
}

/**
 * Sube una foto y devuelve su ruta. Va separado del registro al que pertenece
 * porque el registro puede viajar por la cola offline: primero se resuelve la
 * foto, y al cuerpo solo se le manda el path.
 */
export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 });
  }

  const carpetaCruda = String(form.get('carpeta') ?? 'avance');
  if (!esCarpeta(carpetaCruda)) {
    return NextResponse.json({ error: 'Carpeta inválida' }, { status: 400 });
  }

  const foto = form.get('foto');
  if (!(foto instanceof File) || foto.size === 0) {
    return NextResponse.json({ error: 'No llegó la foto' }, { status: 400 });
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La foto es demasiado pesada' }, { status: 400 });
  }

  const res = await subirFoto(foto, carpetaCruda);
  if ('error' in res) {
    console.error('Falló subir foto a storage:', res.error);
    return NextResponse.json({ error: 'No se pudo guardar la foto' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, path: res.path });
}
