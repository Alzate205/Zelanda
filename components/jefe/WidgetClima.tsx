'use client';

import { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, Wind, Thermometer, Droplets } from 'lucide-react';

type ClimaData = {
  temperatura: number;
  sensacionTermica: number;
  humedad: number;
  viento: number;
  probabilidadLluvia: number;
  condicion: 'soleado' | 'nublado' | 'lluvioso' | 'tormentoso';
  pronostico: Array<{
    dia: string;
    tempMax: number;
    tempMin: number;
    condicion: 'soleado' | 'nublado' | 'lluvioso' | 'tormentoso';
    lluviaProb: number;
  }>;
};

const CONDICION_ICONO = {
  soleado: Sun,
  nublado: Cloud,
  lluvioso: CloudRain,
  tormentoso: CloudRain,
};

export function WidgetClima() {
  const [clima, setClima] = useState<ClimaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulación de datos de clima - en producción se conectaría a API externa
    // Usamos datos típicos del Quindío para zona cafetera/aguacatera
    const mockClima: ClimaData = {
      temperatura: 24,
      sensacionTermica: 26,
      humedad: 78,
      viento: 12,
      probabilidadLluvia: 35,
      condicion: 'nublado',
      pronostico: [
        { dia: 'Hoy', tempMax: 26, tempMin: 18, condicion: 'nublado', lluviaProb: 35 },
        { dia: 'Mañana', tempMax: 25, tempMin: 17, condicion: 'lluvioso', lluviaProb: 65 },
        { dia: 'Mié', tempMax: 27, tempMin: 18, condicion: 'soleado', lluviaProb: 10 },
        { dia: 'Jue', tempMax: 28, tempMin: 19, condicion: 'soleado', lluviaProb: 5 },
        { dia: 'Vie', tempMax: 26, tempMin: 18, condicion: 'nublado', lluviaProb: 25 },
      ],
    };

    // En producción: fetch('/api/clima') o servicio externo como OpenWeather
    setTimeout(() => {
      setClima(mockClima);
      setLoading(false);
    }, 500);
  }, []);

  if (loading || !clima) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-20 w-20 animate-spin rounded-full border-2 border-zelanda-verde-300 border-t-zelanda-verde-700" />
      </div>
    );
  }

  const IconoCondicion = CONDICION_ICONO[clima.condicion];

  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/90 p-4 shadow-card backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 font-serif text-sm text-zelanda-verde-900">Clima en la finca</h3>
        <span className="text-[10px] uppercase tracking-wide text-zelanda-verde-700">
          Actualizado ahora
        </span>
      </div>

      {/* Clima actual */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-zelanda-verde-100 to-zelanda-beige-200">
          <IconoCondicion className="h-8 w-8 text-zelanda-verde-700" />
        </div>
        <div>
          <p className="m-0 text-3xl font-serif text-zelanda-verde-900">{clima.temperatura}°C</p>
          <p className="m-0 text-xs text-zelanda-verde-700">Sensación: {clima.sensacionTermica}°C</p>
          <p className="m-0 text-xs capitalize text-zelanda-verde-600">{clima.condicion}</p>
        </div>
      </div>

      {/* Detalles */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <Droplets className="mx-auto mb-1 h-4 w-4 text-zelanda-verde-600" />
          <p className="m-0 text-sm font-semibold text-zelanda-verde-900">{clima.humedad}%</p>
          <p className="m-0 text-[9px] uppercase tracking-wide text-zelanda-verde-700">Humedad</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <Wind className="mx-auto mb-1 h-4 w-4 text-zelanda-verde-600" />
          <p className="m-0 text-sm font-semibold text-zelanda-verde-900">{clima.viento} km/h</p>
          <p className="m-0 text-[9px] uppercase tracking-wide text-zelanda-verde-700">Viento</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <CloudRain className="mx-auto mb-1 h-4 w-4 text-zelanda-verde-600" />
          <p className="m-0 text-sm font-semibold text-zelanda-verde-900">{clima.probabilidadLluvia}%</p>
          <p className="m-0 text-[9px] uppercase tracking-wide text-zelanda-verde-700">Lluvia</p>
        </div>
      </div>

      {/* Pronóstico */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zelanda-verde-700">
          Pronóstico 5 días
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {clima.pronostico.map((dia, idx) => {
            const IconoDia = CONDICION_ICONO[dia.condicion];
            return (
              <div
                key={idx}
                className="flex min-w-[70px] flex-col items-center rounded-lg bg-white/60 p-2"
              >
                <span className="text-[9px] font-medium text-zelanda-verde-700">{dia.dia}</span>
                <IconoDia className="my-1 h-5 w-5 text-zelanda-verde-600" />
                <span className="text-xs font-semibold text-zelanda-verde-900">
                  {dia.tempMax}°
                </span>
                <span className="text-[9px] text-zelanda-verde-600">{dia.tempMin}°</span>
                <span
                  className={`mt-1 text-[8px] ${dia.lluviaProb > 50 ? 'text-blue-600' : 'text-zelanda-verde-600'}`}
                >
                  {dia.lluviaProb}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recomendaciones para aguacate */}
      <div className="mt-3 rounded-lg bg-zelanda-verde-50 p-2">
        <p className="m-0 text-[10px] leading-tight text-zelanda-verde-800">
          <strong>Recomendación:</strong>{' '}
          {clima.probabilidadLluvia > 50
            ? 'Alta probabilidad de lluvia. Evite aplicaciones foliares hoy.'
            : clima.humedad > 75
              ? 'Humedad alta favorable para enfermedades fúngicas. Monitorear lotes.'
              : 'Condiciones favorables para labores de campo.'}
        </p>
      </div>
    </div>
  );
}
