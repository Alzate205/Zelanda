import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { evaluarReglasAgro, type ReglasAgro } from '@/lib/clima-reglas';

export type DiaPronostico = {
  fecha: string; // YYYY-MM-DD
  tmin: number;
  tmax: number;
  lluvia_mm: number;
  prob_lluvia: number;
  viento_max: number;
};

export type ClimaFinca = {
  dias: DiaPronostico[];
  reglas: ReglasAgro;
  /** Lluvia real caída en los últimos 7 días (mm), según Open-Meteo. */
  lluvia_7dias_mm: number;
  actualizado: string;
};

const CENTRO_FINCA = { lat: 4.9409, lng: -75.5165 };

async function centroideFinca(): Promise<{ lat: number; lng: number }> {
  try {
    const filas = await prisma.$queryRaw<{ lng: number; lat: number }[]>`
      SELECT ST_X(ST_Centroid(poligono::geometry)) AS lng,
             ST_Y(ST_Centroid(poligono::geometry)) AS lat
      FROM finca WHERE poligono IS NOT NULL LIMIT 1
    `;
    if (filas[0]?.lat && filas[0]?.lng) return filas[0];
  } catch {
    // sin borde cargado: usar centro por defecto
  }
  return CENTRO_FINCA;
}

const obtenerClimaUncached = async (): Promise<ClimaFinca> => {
  const { lat, lng } = await centroideFinca();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=precipitation,precipitation_probability` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=America%2FBogota&forecast_days=7&past_days=7`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const j = (await res.json()) as {
    hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] };
    daily: {
      time: string[];
      temperature_2m_min: number[];
      temperature_2m_max: number[];
      precipitation_sum: number[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
    };
  };

  // Con past_days=7 el daily trae 7 días pasados + 7 de pronóstico.
  // Los pasados suman la lluvia real caída; el pronóstico arranca hoy.
  const hoyBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date()
  );
  const lluvia7dias = j.daily.time.reduce(
    (acc, fecha, i) => (fecha < hoyBogota ? acc + (j.daily.precipitation_sum[i] ?? 0) : acc),
    0
  );

  const dias: DiaPronostico[] = j.daily.time
    .map((fecha, i) => ({
      fecha,
      tmin: j.daily.temperature_2m_min[i],
      tmax: j.daily.temperature_2m_max[i],
      lluvia_mm: j.daily.precipitation_sum[i],
      prob_lluvia: j.daily.precipitation_probability_max[i],
      viento_max: j.daily.wind_speed_10m_max[i],
    }))
    .filter((d) => d.fecha >= hoyBogota);

  // Próximas 6 horas desde ahora. Las horas vienen en hora de Bogotá SIN
  // offset ("2026-06-12T14:00"): hay que anclarlas a -05:00 o el servidor
  // (UTC) las corre 5 horas y la ventana de fumigación queda desplazada.
  const ahora = new Date();
  const idxAhora = j.hourly.time.findIndex((t) => new Date(`${t}:00-05:00`) >= ahora);
  const desde = idxAhora === -1 ? 0 : idxAhora;
  const lluvia6h = j.hourly.precipitation.slice(desde, desde + 6).reduce((a, b) => a + b, 0);
  const prob6h = Math.max(0, ...j.hourly.precipitation_probability.slice(desde, desde + 6));

  const reglas = evaluarReglasAgro({
    lluviaProximas6hMm: lluvia6h,
    probMaxProximas6h: prob6h,
    vientoMaxHoyKmh: dias[0]?.viento_max ?? 0,
    tminProximaNocheC: Math.min(dias[0]?.tmin ?? 99, dias[1]?.tmin ?? 99),
  });

  return {
    dias,
    reglas,
    lluvia_7dias_mm: Math.round(lluvia7dias),
    actualizado: new Date().toISOString(),
  };
};

/** Pronóstico cacheado 30 min. Clave versionada: v2 agrega lluvia_7dias_mm. */
export const obtenerClimaFinca = unstable_cache(obtenerClimaUncached, ['clima-finca', 'v2'], {
  revalidate: 1800,
});
