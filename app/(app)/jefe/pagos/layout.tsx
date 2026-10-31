import { notFound } from 'next/navigation';
import { MODULO_NOMINA } from '@/lib/modulos';

// Pantalla del módulo de nómina: apagado, responde 404. Ver lib/modulos.ts.
export default function LayoutNomina({ children }: { children: React.ReactNode }) {
  if (!MODULO_NOMINA) notFound();
  return children;
}
