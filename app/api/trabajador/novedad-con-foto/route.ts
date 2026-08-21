import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subirFoto } from '@/lib/supabase/storage';

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const form = await req.formData();
  const lote = String(form.get('lote_id') ?? '');
  const placa = parseInt(String(form.get('numero_placa') ?? ''), 10);
  const tipo = String(form.get('tipo') ?? '');
  const descripcion = String(form.get('descripcion') ?? '').trim();
  const foto = form.get('foto');

  if (!/^\d+$/.test(lote)) return NextResponse.json({ error: 'lote_id inválido' }, { status: 400 });
  if (!Number.isInteger(placa) || placa < 1)
    return NextResponse.json({ error: 'numero_placa inválido' }, { status: 400 });
  if (!['PLAGA', 'DANO_FISICO', 'ENFERMEDAD', 'OBSERVACION', 'OTRO'].includes(tipo))
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  if (!descripcion) return NextResponse.json({ error: 'Descripción obligatoria' }, { status: 400 });

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: BigInt(lote), numero_placa: placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol)
    return NextResponse.json({ error: `No existe el árbol ${placa} en ese lote` }, { status: 404 });

  let foto_path: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const res = await subirFoto(foto, 'novedades');
    if ('error' in res) {
      // Guardar la novedad sin la foto dejaba al trabajador creyendo que la
      // había mandado. Mejor que falle y la vuelva a intentar con la foto.
      console.error('Falló subir foto de novedad:', res.error);
      return NextResponse.json(
        { error: 'No se pudo guardar la foto. Intentá de nuevo.' },
        { status: 502 }
      );
    }
    foto_path = res.path;
  }

  const creada = await prisma.novedades.create({
    data: {
      arbol_id: arbol.id,
      persona_id: BigInt(usuario.persona_id),
      tipo: tipo as never,
      descripcion,
      foto_path,
      resuelta: false,
    },
  });

  return NextResponse.json({ ok: true, id: String(creada.id) });
}
