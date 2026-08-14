import type { Metadata } from 'next';
import { requerirUsuario } from '@/lib/auth';
import { FormularioNuevoLote } from './FormularioNuevoLote';

export const metadata: Metadata = { title: 'Crear lote' };

export default async function PaginaNuevoLote() {
  await requerirUsuario('JEFE');
  return <FormularioNuevoLote />;
}
