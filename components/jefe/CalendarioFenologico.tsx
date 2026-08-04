import { Sprout, Droplets, TrendingUp, Scissors, Package, RotateCcw } from 'lucide-react';
import type { Fase, FenologiaMes, FaseDetalle } from '@/lib/fenologia';

const ICONO: Record<Fase, typeof Sprout> = {
  FLORACION: Sprout,
  CUAJADO: Droplets,
  DESARROLLO: TrendingUp,
  MADURACION: Scissors,
  COSECHA: Package,
  POSTCOSECHA: RotateCcw,
};

function BloqueFase({ detalle, secundaria }: { detalle: FaseDetalle; secundaria?: boolean }) {
  const Icono = ICONO[detalle.fase];

  return (
    <div
      className={
        secundaria
          ? 'rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50 p-3'
          : 'rounded-xl border border-zelanda-verde-200 bg-zelanda-verde-50 p-3'
      }
    >
      <div className="flex items-center gap-2">
        <Icono
          className={`h-4 w-4 shrink-0 ${
            secundaria ? 'text-zelanda-verde-600' : 'text-zelanda-verde-700'
          }`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-serif text-[15px] leading-tight text-zelanda-verde-900">
            {detalle.nombre}
          </p>
          <p className="text-[12px] text-zelanda-verde-700">{detalle.descripcion}</p>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1">
        {detalle.recomendaciones.map((r) => (
          <li key={r} className="flex gap-2 text-[13px] leading-snug text-zelanda-verde-800">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zelanda-verde-400" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CalendarioFenologico({ fenologia }: { fenologia: FenologiaMes }) {
  return (
    <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-base text-zelanda-verde-900">Fase del cultivo</h2>
        <span className="text-[11px] text-zelanda-verde-700">Aguacate Hass</span>
      </div>

      <div className="space-y-2.5">
        <BloqueFase detalle={fenologia.principal} />
        {fenologia.secundaria ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              En paralelo
            </p>
            <BloqueFase detalle={fenologia.secundaria} secundaria />
          </>
        ) : null}
      </div>
    </section>
  );
}
