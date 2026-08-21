'use client';

import {
  CloudRain,
  Wind,
  ThermometerSnowflake,
  CheckCircle2,
  Clock,
  Droplets,
  Sprout,
} from 'lucide-react';
import type { ClimaFinca } from '@/lib/jefe/clima';
import { intensidad } from '@/lib/clima-dia';

/** Cuánta agua cae, en palabras. Un número de mm solo no le dice nada a nadie. */
const COLOR_INTENSIDAD: Record<string, string> = {
  seco: 'text-zelanda-verde-700/50',
  llovizna: 'text-zelanda-verde-700',
  lluvia: 'text-zelanda-ocre-700',
  aguacero: 'text-estado-vencida',
};

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

  const { reglas, dias, balance, hongos } = clima;
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

      {hongos?.pudricion_raiz || hongos?.antracnosis ? (
        <p className="m-0 mt-1.5 flex items-start gap-1.5 rounded-xl bg-estado-vencida/10 px-3 py-2 text-[12.5px] text-estado-vencida">
          <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {hongos.pudricion_raiz
              ? 'Suelo encharcado: riesgo de pudrición de raíz. Revisá drenajes antes de volver a regar.'
              : 'Follaje mojado y humedad alta: riesgo de antracnosis. Revisá la fruta próxima a cosecha.'}
          </span>
        </p>
      ) : null}

      {balance ? (
        <p
          className={`m-0 mt-1.5 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12.5px] ${
            balance.estado === 'deficit'
              ? 'bg-zelanda-ocre-500/20 text-zelanda-ocre-700'
              : balance.estado === 'exceso'
              ? 'bg-estado-vencida/10 text-estado-vencida'
              : 'bg-white/70 text-zelanda-verde-800'
          }`}
        >
          <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Últimos 7 días:</span> {balance.resumen}
          </span>
        </p>
      ) : null}

      {dias[0] ? (
        <p className="m-0 mt-2.5 flex items-start gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-[13px] text-zelanda-verde-900">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zelanda-verde-700" aria-hidden />
          <span>
            <strong className="font-semibold">Hoy:</strong> {dias[0].resumen}
          </span>
        </p>
      ) : null}
      {dias[1] ? (
        <p className="m-0 mt-1 pl-6 text-[12px] text-zelanda-verde-700">
          Mañana: {dias[1].resumen}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {dias.map((d, i) => {
          const nivel = intensidad(d.lluvia_mm);
          return (
            <div
              key={d.fecha}
              className={`rounded-lg bg-white/70 px-0.5 py-1.5 ${
                d.confianza === 'baja' ? 'opacity-55' : ''
              }`}
              title={`${d.resumen} · ${Math.round(d.prob_lluvia)} % de probabilidad media`}
            >
              <p className="m-0 text-[10px] font-semibold text-zelanda-verde-800">
                {diaCorto(d.fecha, i)}
              </p>
              <p className={`m-0 mt-0.5 text-[11.5px] font-semibold ${COLOR_INTENSIDAD[nivel]}`}>
                {Math.round(d.lluvia_mm)}
                <span className="text-[9px] font-normal"> mm</span>
              </p>
              <p className="m-0 text-[9.5px] text-zelanda-verde-700/70">
                {Math.round(d.prob_lluvia)}%
              </p>
              <p className="m-0 mt-0.5 text-[10.5px] text-zelanda-verde-900">
                {Math.round(d.tmin)}–{Math.round(d.tmax)}°
              </p>
            </div>
          );
        })}
      </div>

      <p className="m-0 mt-1.5 text-[10px] text-zelanda-verde-700/60">
        Los días en gris son los que los modelos no ven igual: ahí el número no es firme.
      </p>
    </div>
  );
}
