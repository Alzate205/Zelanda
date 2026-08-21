import { CloudRain, Droplets } from 'lucide-react';
import type { ClimaFinca } from '@/lib/jefe/clima';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** La fecha llega como YYYY-MM-DD; se ancla a mediodía para no correr el día. */
function etiquetaDia(fecha: string, indice: number): string {
  if (indice === 0) return 'Hoy';
  const d = new Date(`${fecha}T12:00:00`);
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()}`;
}

export function ResumenClima({ clima }: { clima: ClimaFinca }) {
  return (
    <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-base text-zelanda-verde-900">Clima</h2>
        <span className="text-[11px] text-zelanda-verde-700">próximos 7 días</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 px-2.5 py-1 text-[12px] text-zelanda-verde-800">
          <CloudRain className="h-3.5 w-3.5" aria-hidden />
          {clima.lluvia_72h_mm} mm en 72 h
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 px-2.5 py-1 text-[12px] text-zelanda-verde-800">
          <Droplets className="h-3.5 w-3.5" aria-hidden />
          {clima.humedad_media_48h} % humedad
        </span>
      </div>

      {clima.dias[0] ? (
        <p className="m-0 mt-2 text-[13px] text-zelanda-verde-900">
          <strong className="font-semibold">Hoy:</strong> {clima.dias[0].resumen}
          {clima.dias[1] ? (
            <span className="text-zelanda-verde-700"> · Mañana: {clima.dias[1].resumen}</span>
          ) : null}
        </p>
      ) : null}

      <div className="-mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1">
          {clima.dias.map((d, i) => (
            <div
              key={d.fecha}
              className="min-w-[68px] flex-1 rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50 p-2 text-center"
            >
              <p className="text-[11px] font-semibold text-zelanda-verde-700">
                {etiquetaDia(d.fecha, i)}
              </p>
              <p className="mt-1 font-serif text-[15px] text-zelanda-verde-900">
                {Math.round(d.tmax)}°
              </p>
              <p className="text-[11px] text-zelanda-verde-700">{Math.round(d.tmin)}°</p>
              <p className="mt-1 text-[11px] font-semibold text-zelanda-verde-600">
                {Math.round(d.lluvia_mm)} mm
              </p>
              <p className="text-[10px] text-zelanda-verde-700/70">{Math.round(d.prob_lluvia)}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
