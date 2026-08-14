'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import { validarDatosLote } from '@/lib/lotes';
import { tandasDePlacas } from '@/lib/arboles';

export type EstadoCreacionLote = { error: string | null };

export async function crearLote(
  _prev: EstadoCreacionLote,
  formData: FormData
): Promise<EstadoCreacionLote> {
  await requerirUsuario('JEFE');

  const validacion = validarDatosLote({
    nombre: String(formData.get('nombre') ?? ''),
    hectareas: String(formData.get('hectareas') ?? ''),
    total_arboles: String(formData.get('total_arboles') ?? '0'),
  });
  if (!validacion.ok) return { error: validacion.error };
  const { nombre, hectareas, total_arboles } = validacion.datos;

  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null },
    select: { id: true },
  });
  if (duplicado) return { error: 'Ya hay un lote con ese nombre.' };

  let loteId: bigint;
  try {
    const creado = await prisma.lotes.create({
      data: { nombre, hectareas, total_arboles },
      select: { id: true },
    });
    loteId = creado.id;

    // Mismo criterio que al editar: por tandas, que un lote real son miles.
    for (const tanda of tandasDePlacas(1, total_arboles)) {
      await prisma.arboles.createMany({
        data: tanda.map((numero_placa) => ({ lote_id: loteId, numero_placa })),
        skipDuplicates: true,
      });
    }
  } catch (e) {
    return { error: sanitizarError(e, 'jefe/lotes/crear') };
  }

  revalidatePath('/jefe/lotes');
  revalidatePath('/jefe');
  redirect(`/jefe/lotes/${loteId}`);
}
