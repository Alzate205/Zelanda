'use client';

import { Calendar, Sprout, Scissors, Droplets, Bug, TrendingUp } from 'lucide-react';

type FaseFenologica = {
  nombre: string;
  descripcion: string;
  recomendacion: string;
  icono: typeof Calendar;
};

const FASES_FENOLOGICAS: Record<string, FaseFenologica> = {
  floracion: {
    nombre: 'Floración',
    descripcion: 'Emisión de flores y polinización',
    recomendacion:
      'Asegurar presencia de polinizadores. Evitar aplicaciones de pesticidas durante horas de vuelo de abejas.',
    icono: Sprout,
  },
  cuajado: {
    nombre: 'Cuajado de frutos',
    descripcion: 'Formación inicial del fruto',
    recomendacion:
      'Mantener humedad adecuada. Monitorear estrés hídrico. Aplicar boro si es necesario.',
    icono: Droplets,
  },
  desarrollo: {
    nombre: 'Desarrollo del fruto',
    descripcion: 'Crecimiento y llenado del fruto',
    recomendacion:
      'Riego constante. Fertilización nitrogenada. Control de plagas como trips y ácaros.',
    icono: TrendingUp,
  },
  maduracion: {
    nombre: 'Maduración',
    descripcion: 'Fruto alcanzando tamaño y contenido de aceite óptimo',
    recomendacion:
      'Reducir riego gradualmente. Monitorear punto de cosecha (20-23% materia seca).',
    icono: Scissors,
  },
  postcosecha: {
    nombre: 'Post-cosecha',
    descripcion: 'Recuperación del árbol después de la cosecha',
    recomendacion:
      'Poda sanitaria. Fertilización de recuperación. Control de enfermedades del suelo.',
    icono: Calendar,
  },
};

export function CalendarioFenologico() {
  // En producción, esto se calcularía basado en la fecha y variedad de aguacate
  // Para Hass en Colombia, las fases típicas varían por región
  const faseActual = 'desarrollo'; // Esto vendría de un cálculo real
  const diasEnFase = 45; // Días estimados en la fase actual
  const diasParaSiguienteFase = 30; // Días estimados para siguiente fase

  const fase = FASES_FENOLOGICAS[faseActual];
  const IconoFase = fase.icono;

  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/90 p-4 shadow-card backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 font-serif text-sm text-zelanda-verde-900">
          Calendario Fenológico - Aguacate Hass
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-zelanda-verde-700">
          Fase actual
        </span>
      </div>

      {/* Fase actual */}
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-gradient-to-br from-zelanda-verde-100 to-zelanda-beige-200 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zelanda-verde-600 text-zelanda-beige-50">
          <IconoFase className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-serif text-lg text-zelanda-verde-900">{fase.nombre}</p>
          <p className="m-0 text-xs text-zelanda-verde-700">{fase.descripcion}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-zelanda-verde-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Día {diasEnFase}
            </span>
            <span className="text-[10px] text-zelanda-verde-600">
              ~{diasParaSiguienteFase} días para siguiente fase
            </span>
          </div>
        </div>
      </div>

      {/* Recomendación */}
      <div className="mb-4 rounded-lg bg-amber-50 p-3">
        <p className="m-0 text-[11px] leading-relaxed text-amber-900">
          <strong className="text-amber-800">Recomendación clave:</strong> {fase.recomendacion}
        </p>
      </div>

      {/* Todas las fases */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zelanda-verde-700">
          Ciclo completo
        </p>
        <div className="space-y-2">
          {Object.entries(FASES_FENOLOGICAS).map(([key, f]) => {
            const Icono = f.icono;
            const esActual = key === faseActual;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg p-2 ${
                  esActual
                    ? 'bg-zelanda-verde-100 ring-1 ring-zelanda-verde-300'
                    : 'bg-white/60'
                }`}
              >
                <Icono
                  className={`h-4 w-4 ${esActual ? 'text-zelanda-verde-700' : 'text-zelanda-verde-500'}`}
                />
                <span
                  className={`text-xs ${esActual ? 'font-semibold text-zelanda-verde-900' : 'text-zelanda-verde-700'}`}
                >
                  {f.nombre}
                </span>
                {esActual && (
                  <Bug className="ml-auto h-3 w-3 text-red-500" aria-label="Monitorear plagas" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Próximas labores por fase */}
      <div className="mt-3 rounded-lg bg-zelanda-verde-50 p-2">
        <p className="m-0 text-[10px] leading-tight text-zelanda-verde-800">
          <strong>Próximo hito:</strong>{' '}
          {faseActual === 'desarrollo'
            ? 'Iniciar monitoreo de materia seca en 2 semanas para determinar punto óptimo de cosecha.'
            : faseActual === 'floracion'
              ? 'Programar aplicación de biostimulantes post-floración en 10 días.'
              : 'Continuar con programa de manejo integrado según calendario.'}
        </p>
      </div>
    </div>
  );
}
