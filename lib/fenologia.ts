import { obtenerMes } from '@/lib/fecha';

/**
 * Calendario fenológico del aguacate Hass en La Zelanda.
 *
 * Calibrado con los dos picos de cosecha de la finca: principal de marzo a
 * junio y traviesa de octubre a diciembre. La floración que origina cada
 * cosecha ocurre ~9 meses antes.
 *
 * Con dos cosechas al año siempre hay ciclos solapados, por eso cada mes
 * puede declarar una fase secundaria: mostrar una sola sería impreciso.
 */

export type Fase =
  | 'FLORACION'
  | 'CUAJADO'
  | 'DESARROLLO'
  | 'MADURACION'
  | 'COSECHA'
  | 'POSTCOSECHA';

export type FaseDetalle = {
  fase: Fase;
  nombre: string;
  descripcion: string;
  recomendaciones: string[];
};

export type FenologiaMes = {
  principal: FaseDetalle;
  secundaria: FaseDetalle | null;
};

export const DETALLE_FASE: Record<Fase, FaseDetalle> = {
  FLORACION: {
    fase: 'FLORACION',
    nombre: 'Floración',
    descripcion: 'Emisión de flores y polinización',
    recomendaciones: [
      'Revisar los apiarios: la polinización depende de las abejas.',
      'No fumigar en horas de vuelo de abejas (media mañana y media tarde).',
      'Evitar el estrés hídrico, que provoca caída de flor.',
    ],
  },
  CUAJADO: {
    fase: 'CUAJADO',
    nombre: 'Cuajado de frutos',
    descripcion: 'Formación inicial del fruto',
    recomendaciones: [
      'Mantener humedad pareja: el déficit en esta fase tumba fruto recién cuajado.',
      'Evaluar aplicación de boro y calcio.',
      'Monitorear trips, que marcan el fruto joven.',
    ],
  },
  DESARROLLO: {
    fase: 'DESARROLLO',
    nombre: 'Desarrollo del fruto',
    descripcion: 'Crecimiento y llenado del fruto',
    recomendaciones: [
      'Riego constante y fertilización nitrogenada.',
      'Control de ácaros y trips.',
      'Revisar tutorado en ramas muy cargadas.',
    ],
  },
  MADURACION: {
    fase: 'MADURACION',
    nombre: 'Maduración',
    descripcion: 'El fruto alcanza tamaño y contenido de aceite',
    recomendaciones: [
      'Reducir el riego de forma gradual.',
      'Muestrear materia seca: el punto de corte está entre 20 % y 23 %.',
      'Planificar canastas y personal para la cosecha.',
    ],
  },
  COSECHA: {
    fase: 'COSECHA',
    nombre: 'Cosecha',
    descripcion: 'Recolección del fruto',
    recomendaciones: [
      'Verificar que ningún lote esté en período de carencia antes de recolectar.',
      'Cosechar temprano y a la sombra para evitar golpe de calor.',
      'Registrar cada entrada al almacén por lote y recolector.',
    ],
  },
  POSTCOSECHA: {
    fase: 'POSTCOSECHA',
    nombre: 'Post-cosecha',
    descripcion: 'Recuperación del árbol tras la cosecha',
    recomendaciones: [
      'Poda sanitaria: retirar ramas secas y enfermas.',
      'Fertilización de recuperación.',
      'Revisar drenajes antes del siguiente ciclo de lluvias.',
    ],
  },
};

/**
 * Fase por mes, indexado 0-11 igual que `obtenerMes` y `mesBogota`.
 */
export const FASES_POR_MES: { principal: Fase; secundaria: Fase | null }[] = [
  { principal: 'FLORACION', secundaria: 'DESARROLLO' }, // enero
  { principal: 'FLORACION', secundaria: 'DESARROLLO' }, // febrero
  { principal: 'COSECHA', secundaria: 'CUAJADO' }, // marzo
  { principal: 'COSECHA', secundaria: 'CUAJADO' }, // abril
  { principal: 'COSECHA', secundaria: 'DESARROLLO' }, // mayo
  { principal: 'COSECHA', secundaria: 'DESARROLLO' }, // junio
  { principal: 'POSTCOSECHA', secundaria: 'DESARROLLO' }, // julio
  { principal: 'DESARROLLO', secundaria: null }, // agosto
  { principal: 'MADURACION', secundaria: null }, // septiembre
  { principal: 'COSECHA', secundaria: null }, // octubre
  { principal: 'COSECHA', secundaria: null }, // noviembre
  { principal: 'COSECHA', secundaria: 'FLORACION' }, // diciembre
];

/** Meses (0-11) en los que la finca está recolectando. */
export const MESES_DE_COSECHA = FASES_POR_MES.reduce<number[]>(
  (acc, m, i) => (m.principal === 'COSECHA' ? [...acc, i] : acc),
  []
);

/**
 * Fase fenológica de una fecha, resuelta en hora de Bogotá.
 */
export function faseDelMes(fecha: Date): FenologiaMes {
  const mes = FASES_POR_MES[obtenerMes(fecha)];
  return {
    principal: DETALLE_FASE[mes.principal],
    secundaria: mes.secundaria ? DETALLE_FASE[mes.secundaria] : null,
  };
}

/** `true` si en esa fecha la finca está en temporada de cosecha. */
export function esTemporadaDeCosecha(fecha: Date): boolean {
  return FASES_POR_MES[obtenerMes(fecha)].principal === 'COSECHA';
}
