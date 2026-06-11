'use client';

import { CloudRain, Wind, ThermometerSnowflake, CheckCircle2 } from 'lucide-react';
import type { ClimaFinca } from '@/lib/jefe/clima';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function diaCorto(fecha: string, i: number): string {
  if (i === 0) return 'Hoy';
  const d = new Date(`${fecha}T12:00:00-05:00`);
  return DIAS_CORTO[d.getDay()];
}

export function PanelClima({ clima }: { clima: ClimaFinca | 'error' | null }) {
  if (clima === null) {
    return (
      <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 text-center text-sm text-zelanda-verde-700 shadow-card backdrop-blur-md">
        Cargando pronóstico…
      </div>
    );
  }
  if (clima === 'error') {
    return (
      <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 text-center text-sm text-zelanda-verde-700 shadow-card backdrop-blur-md">
        Pronóstico no disponible. Reintentá con señal.
      </div>
    );
  }

  const { reglas, dias } = clima;
  const bannerClase = reglas.riesgo_helada
    ? 'bg-estado-vencida/15 text-estado-vencida'
    : reglas.ventana_fumigacion
    ? 'bg-zelanda-verde-600/15 text-zelanda-verde-800'
    : 'bg-zelanda-ocre-500/20 text-zelanda-ocre-700';
  const BannerIcono = reglas.riesgo_helada
    ? ThermometerSnowflake
    : reglas.ventana_fumigacion
    ? CheckCircle2
    : reglas.motivo.includes('viento')
    ? Wind
    : CloudRain;

  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
        Clima de la finca · 7 días
      </p>

      <div
        className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium ${bannerClase}`}
      >
        <BannerIcono className="h-4 w-4 shrink-0" aria-hidden />
        <span>{reglas.riesgo_helada ? 'Riesgo de helada esta noche' : reglas.motivo}</span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {dias.map((d, i) => (
          <div key={d.fecha} className="rounded-lg bg-white/70 px-0.5 py-1.5">
            <p className="m-0 text-[10px] font-semibold text-zelanda-verde-800">
              {diaCorto(d.fecha, i)}
            </p>
            <p className="m-0 mt-0.5 text-[10px] text-zelanda-verde-700">
              {Math.round(d.prob_lluvia)}%
            </p>
            <p className="m-0 text-[10px] text-zelanda-verde-700">{Math.round(d.lluvia_mm)} mm</p>
            <p className="m-0 mt-0.5 text-[10.5px] text-zelanda-verde-900">
              {Math.round(d.tmin)}–{Math.round(d.tmax)}°
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
