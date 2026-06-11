import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoLotes() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando mapa">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-32" />
        <Esqueleto className="h-7 w-44" />
      </div>
      <Esqueleto className="h-[60vh] rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5">
        <Esqueleto className="h-16" />
        <Esqueleto className="h-16" />
      </div>
    </div>
  );
}
