import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoJefe() {
  return (
    <div className="relative -mx-4 -my-6 h-[70svh]" role="status" aria-label="Cargando mapa">
      <Esqueleto className="h-full w-full rounded-none" />
      <div className="absolute left-3 top-3">
        <Esqueleto className="h-16 w-44 bg-zelanda-beige-300/60" />
      </div>
      <div className="absolute inset-x-3 bottom-3">
        <Esqueleto className="h-16 bg-zelanda-beige-300/60" />
      </div>
    </div>
  );
}
