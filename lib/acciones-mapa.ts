'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { puntoAWkt, arrayAWktPolygon, type LngLat } from '@/lib/geo';

export type EstadoEdicion = { error: string | null };

function parsePunto(raw: string): LngLat | null {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [lng, lat] = v;
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    return [lng, lat];
  } catch {
    return null;
  }
}

export async function guardarCoordsApiario(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('JEFE');
  const idRaw = String(formData.get('apiario_id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'Apiario inválido.' };
  const pto = parsePunto(String(formData.get('punto') ?? ''));
  if (!pto) return { error: 'Tocá la ubicación en el mapa antes de guardar.' };
  const wkt = puntoAWkt(pto[0], pto[1]);
  await prisma.$executeRawUnsafe(
    `UPDATE apiarios SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
    wkt,
    BigInt(idRaw)
  );
  revalidateTag('geo-finca');
  revalidatePath('/jefe/lotes');
  revalidatePath(`/jefe/apiarios/${idRaw}`);
  redirect(`/jefe/apiarios/${idRaw}`);
}

export async function guardarCoordsInstalacion(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('JEFE');
  const idRaw = String(formData.get('instalacion_id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'Instalación inválida.' };
  const pto = parsePunto(String(formData.get('punto') ?? ''));
  if (!pto) return { error: 'Tocá la ubicación en el mapa antes de guardar.' };
  const wkt = puntoAWkt(pto[0], pto[1]);
  await prisma.$executeRawUnsafe(
    `UPDATE instalaciones SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
    wkt,
    BigInt(idRaw)
  );
  revalidateTag('geo-finca');
  revalidatePath('/jefe/lotes');
  revalidatePath('/jefe/instalaciones');
  redirect('/jefe/instalaciones');
}

export async function crearInstalacion(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('JEFE');
  const nombre = String(formData.get('nombre') ?? '').trim();
  const tipo = String(formData.get('tipo') ?? '');
  const notas = String(formData.get('notas') ?? '').trim() || null;
  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!['CASA', 'BODEGA', 'ALMACEN', 'OTRO'].includes(tipo)) {
    return { error: 'Tipo inválido.' };
  }
  const creada = await prisma.instalaciones.create({
    data: {
      nombre,
      tipo: tipo as 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO',
      notas,
      activo: true,
    },
  });
  revalidateTag('geo-finca');
  revalidatePath('/jefe/instalaciones');
  redirect(`/jefe/instalaciones/${creada.id}/ubicacion`);
}

export async function guardarBordeFinca(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('JEFE');
  const verticesRaw = String(formData.get('vertices') ?? '[]');
  let vertices: LngLat[];
  try {
    vertices = JSON.parse(verticesRaw);
  } catch {
    return { error: 'Formato inválido.' };
  }
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return { error: 'El polígono necesita al menos 3 puntos.' };
  }
  for (const v of vertices) {
    if (
      !Array.isArray(v) ||
      v.length !== 2 ||
      typeof v[0] !== 'number' ||
      typeof v[1] !== 'number'
    ) {
      return { error: 'Coordenadas inválidas.' };
    }
  }
  let wkt: string;
  try {
    wkt = arrayAWktPolygon(vertices);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const fila = await prisma.finca.findFirst();
  if (fila) {
    await prisma.$executeRawUnsafe(
      `UPDATE finca SET poligono = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
      wkt,
      fila.id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO finca (nombre, poligono) VALUES ('Hacienda La Zelanda', ST_GeomFromText($1, 4326)::geography)`,
      wkt
    );
  }
  revalidateTag('geo-finca');
  revalidatePath('/jefe/lotes');
  revalidatePath('/jefe/instalaciones');
  redirect('/jefe/instalaciones');
}
