import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { subirFoto } from '@/lib/supabase/storage';

const MAX_BYTES = 6 * 1024 * 1024;

// Sube la foto y devuelve su ruta. El avance en sí viaja aparte (puede ir por la
// cola offline), así que la foto se resuelve antes y solo se manda el path.
export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'TRABAJADOR' || usuario.persona_id === null) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 });
  }

  const foto = form.get('foto');
  if (!(foto instanceof File) || foto.size === 0) {
    return NextResponse.json({ error: 'No llegó la foto' }, { status: 400 });
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La foto es demasiado pesada' }, { status: 400 });
  }

  const res = await subirFoto(foto, 'avance');
  if ('error' in res) {
    return NextResponse.json({ error: 'No se pudo guardar la foto' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, path: res.path });
}
