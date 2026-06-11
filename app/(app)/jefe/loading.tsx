import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoJefe() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando panel">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-28" />
        <Esqueleto className="h-7 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
      <Esqueleto className="h-40" />
      <Esqueleto className="h-40" />
    </div>
  );
}
