import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { calcularBalance, type BalanceHidrico } from '@/lib/balance-hidrico';
import { franjasDelDia, resumenDelDia, type BloqueLluvia } from '@/lib/clima-dia';
import {
  medirAcuerdo,
  confianzaPorDistancia,
  type Acuerdo,
  type Confianza,
} from '@/lib/clima-acuerdo';
import {
  evaluarReglasAgro,
  evaluarRiesgoHongos,
  type ReglasAgro,
  type RiesgoHongos,
} from '@/lib/clima-reglas';

export type DiaPronostico = {
  fecha: string; // YYYY-MM-DD
  tmin: number;
  tmax: number;
  lluvia_mm: number;
  /**
   * Probabilidad MEDIA del día. Antes acá iba la máxima horaria, que en el
   * trópico andino da 100 % casi todos los días: era una constante disfrazada
   * de dato, y el jefe dejó de creerle al pronóstico por eso.
   */
  prob_lluvia: number;
  viento_max: number;
  /** Cómo se reparte la lluvia en el día. Es lo que decide si se puede trabajar. */
  bloques: BloqueLluvia[];
  /** Frase corta y accionable: "Seco en la mañana, llueve en la tarde (18 mm)". */
  resumen: string;
  /** Cuánto creerle. Medido entre modelos si se pudo; si no, por distancia. */
  confianza: Confianza;
  /** Qué tan de acuerdo están los modelos entre sí. Null si no llegaron. */
  acuerdo: Acuerdo | null;
};

export type ClimaFinca = {
  dias: DiaPronostico[];
  reglas: ReglasAgro;
  /** Riesgo de enfermedad fúngica derivado de la lluvia y humedad ya ocurridas. */
  hongos: RiesgoHongos;
  /** Lluvia real caída en los últimos 7 días (mm), según Open-Meteo. */
  lluvia_7dias_mm: number;
  /** Lluvia real de las últimas 72 h (mm). Alimenta el riesgo de encharcamiento. */
  lluvia_72h_mm: number;
  /** Humedad relativa media de las últimas 48 h (%). */
  humedad_media_48h: number;
  /**
   * Agua que entró contra agua que se fue en los últimos 7 días. Mira hacia
   * atrás a propósito: lo que decide si hay que regar hoy es el agua que ya
   * está (o no está) en el suelo, no la que el modelo cree que va a caer.
   */
  balance: BalanceHidrico;
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

/**
 * Lluvia diaria según varios modelos, para saber si están de acuerdo.
 *
 * Va en una llamada aparte y se trata como opcional: si no llega, el pronóstico
 * se muestra igual y la confianza vuelve a estimarse por distancia. Se pide
 * aparte y no en la llamada principal porque `models=` cambia la forma de toda
 * la respuesta, y un fallo acá no puede tumbar el pronóstico entero.
 */
const MODELOS = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'jma_seamless'];

async function lluviaPorModelo(lat: number, lng: number): Promise<Map<string, number[]> | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&daily=precipitation_sum&timezone=America%2FBogota&forecast_days=7` +
        `&models=${MODELOS.join(',')}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { daily?: Record<string, unknown> };
    const daily = j.daily;
    if (!daily || !Array.isArray(daily.time)) return null;
    const fechas = daily.time as string[];
    const claves = Object.keys(daily).filter((k) => k.startsWith('precipitation_sum'));
    if (claves.length < 3) return null;
    const porFecha = new Map<string, number[]>();
    fechas.forEach((f, i) => {
      porFecha.set(
        f,
        claves.map((k) => Number((daily[k] as (number | null)[])[i])).filter(Number.isFinite)
      );
    });
    return porFecha;
  } catch {
    return null;
  }
}

const obtenerClimaUncached = async (): Promise<ClimaFinca> => {
  const { lat, lng } = await centroideFinca();
  const modelosPorFecha = await lluviaPorModelo(lat, lng);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=precipitation,precipitation_probability,relative_humidity_2m` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_mean,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
    `&timezone=America%2FBogota&forecast_days=7&past_days=7`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const j = (await res.json()) as {
    hourly: {
      time: string[];
      precipitation: number[];
      precipitation_probability: number[];
      relative_humidity_2m: number[];
    };
    daily: {
      time: string[];
      temperature_2m_min: number[];
      temperature_2m_max: number[];
      precipitation_sum: number[];
      precipitation_probability_mean: number[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
      et0_fao_evapotranspiration: number[];
    };
  };

  // Con past_days=7 el daily trae 7 días pasados + 7 de pronóstico.
  // Los pasados suman la lluvia real caída; el pronóstico arranca hoy.
  const hoyBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date()
  );
  // Los 7 días ya pasados: lo que de verdad recibió y perdió el lote.
  const balance = calcularBalance(
    j.daily.time
      .map((fecha, i) => ({
        fecha,
        lluvia_mm: j.daily.precipitation_sum[i] ?? 0,
        et0_mm: j.daily.et0_fao_evapotranspiration[i] ?? 0,
      }))
      .filter((d) => d.fecha < hoyBogota)
  );

  const lluvia7dias = j.daily.time.reduce(
    (acc, fecha, i) => (fecha < hoyBogota ? acc + (j.daily.precipitation_sum[i] ?? 0) : acc),
    0
  );

  // Las horas de cada día, para poder decir a qué hora llueve y no solo cuánto.
  const horasPorFecha = new Map<string, { hora: number; mm: number; prob: number }[]>();
  j.hourly.time.forEach((t, i) => {
    const [fecha, hhmm] = t.split('T');
    const lista = horasPorFecha.get(fecha) ?? [];
    lista.push({
      hora: Number(hhmm.slice(0, 2)),
      mm: j.hourly.precipitation[i] ?? 0,
      prob: j.hourly.precipitation_probability[i] ?? 0,
    });
    horasPorFecha.set(fecha, lista);
  });

  const dias: DiaPronostico[] = j.daily.time
    .map((fecha, i) => ({ fecha, i }))
    .filter(({ fecha }) => fecha >= hoyBogota)
    .map(({ fecha, i }, indiceDesdeHoy) => {
      const bloques = franjasDelDia(horasPorFecha.get(fecha) ?? []);
      const lluvia_mm = j.daily.precipitation_sum[i];
      // El valor que enseña la app entra en la comparación: si se sale del
      // rango de los demás, el desacuerdo es justamente con lo que se muestra.
      const acuerdo = medirAcuerdo([lluvia_mm, ...(modelosPorFecha?.get(fecha) ?? [])]);
      return {
        fecha,
        tmin: j.daily.temperature_2m_min[i],
        tmax: j.daily.temperature_2m_max[i],
        lluvia_mm,
        prob_lluvia: j.daily.precipitation_probability_mean[i] ?? 0,
        viento_max: j.daily.wind_speed_10m_max[i],
        bloques,
        resumen: resumenDelDia(bloques),
        confianza: acuerdo?.confianza ?? confianzaPorDistancia(indiceDesdeHoy),
        acuerdo,
      };
    });

  // Próximas 6 horas desde ahora. Las horas vienen en hora de Bogotá SIN
  // offset ("2026-06-12T14:00"): hay que anclarlas a -05:00 o el servidor
  // (UTC) las corre 5 horas y la ventana de fumigación queda desplazada.
  const ahora = new Date();
  const idxAhora = j.hourly.time.findIndex((t) => new Date(`${t}:00-05:00`) >= ahora);
  const desde = idxAhora === -1 ? 0 : idxAhora;
  const lluvia6h = j.hourly.precipitation.slice(desde, desde + 6).reduce((a, b) => a + b, 0);
  const prob6h = Math.max(0, ...j.hourly.precipitation_probability.slice(desde, desde + 6));

  // Ventanas hacia atrás: el riesgo de hongos depende del agua que ya cayó,
  // no del pronóstico. Si no ubicamos "ahora" quedan vacías y no se alerta.
  const sumar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const inicioVentana = (horas: number) => Math.max(0, desde - horas);
  const lluvia72h = sumar(j.hourly.precipitation.slice(inicioVentana(72), desde));
  const lluvia48h = sumar(j.hourly.precipitation.slice(inicioVentana(48), desde));
  const humedad48h = j.hourly.relative_humidity_2m.slice(inicioVentana(48), desde);
  const humedadMedia48h = humedad48h.length ? sumar(humedad48h) / humedad48h.length : 0;

  const hongos = evaluarRiesgoHongos({
    lluvia72hMm: lluvia72h,
    lluvia48hMm: lluvia48h,
    humedadMedia48hPct: humedadMedia48h,
  });

  const reglas = evaluarReglasAgro({
    lluviaProximas6hMm: lluvia6h,
    probMaxProximas6h: prob6h,
    vientoMaxHoyKmh: dias[0]?.viento_max ?? 0,
    tminProximaNocheC: Math.min(dias[0]?.tmin ?? 99, dias[1]?.tmin ?? 99),
  });

  return {
    dias,
    reglas,
    hongos,
    balance,
    lluvia_7dias_mm: Math.round(lluvia7dias),
    lluvia_72h_mm: Math.round(lluvia72h),
    humedad_media_48h: Math.round(humedadMedia48h),
    actualizado: new Date().toISOString(),
  };
};

/** Pronóstico cacheado 30 min. Clave versionada: v6 mide la confianza por el acuerdo entre modelos. */
export const obtenerClimaFinca = unstable_cache(obtenerClimaUncached, ['clima-finca', 'v6'], {
  revalidate: 1800,
});
