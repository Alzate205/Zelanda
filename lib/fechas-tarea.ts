import 'server-only';

export type EstadoAlerta = 'aldia' | 'proxima' | 'vencida' | 'sin_historial';

export type ResumenTarea = {
  ultima: Date | null;
  proxima: Date | null;
  estado: EstadoAlerta;
  dias_para_proxima: number | null;
};

const MS_DIA = 24 * 60 * 60 * 1000;

export function calcularResumen(
  ultimaCompletada: Date | null,
  frecuenciaDias: number,
  ahora: Date = new Date(),
  diasAlerta: number = 7
): ResumenTarea {
  if (!ultimaCompletada) {
    return {
      ultima: null,
      proxima: null,
      estado: 'sin_historial',
      dias_para_proxima: null,
    };
  }

  const proxima = new Date(ultimaCompletada.getTime() + frecuenciaDias * MS_DIA);
  const dias = Math.ceil((proxima.getTime() - ahora.getTime()) / MS_DIA);

  let estado: EstadoAlerta;
  if (dias <= 0) estado = 'vencida';
  else if (dias <= diasAlerta) estado = 'proxima';
  else estado = 'aldia';

  return { ultima: ultimaCompletada, proxima, estado, dias_para_proxima: dias };
}

export function formatearDias(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 0) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}

export function etiquetaEstado(estado: EstadoAlerta): string {
  switch (estado) {
    case 'aldia':
      return 'Al día';
    case 'proxima':
      return 'Próxima';
    case 'vencida':
      return 'Vencida';
    case 'sin_historial':
      return 'Nunca hecho';
  }
}

export function tonoEstado(estado: EstadoAlerta): 'aldia' | 'proxima' | 'vencida' | 'neutro' {
  switch (estado) {
    case 'aldia':
      return 'aldia';
    case 'proxima':
      return 'proxima';
    case 'vencida':
      return 'vencida';
    case 'sin_historial':
      return 'vencida';
  }
}

// === Ciclo de repetición por lote ===
//
// Cada lote lleva su propio reloj para cada tarea: si hoy se platea el lote
// Armenia, el que vuelve a vencer en 90 días es Armenia, no los demás. Como en
// la finca alcanza a hacerse a lo sumo un lote por día, eso es exactamente lo
// que hace falta que funcione bien.
//
// Este cálculo estaba escrito a mano en cinco archivos —la pantalla de alertas,
// el detalle del lote, el asistente de nueva asignación, el mapa y el aviso
// diario—, cada uno armando sus propios mapas con la misma convención de clave.
// Cinco copias de una regla de negocio que nadie podía probar. Acá queda una
// sola, pura y testeable.

/** Última vez que se completó una tarea en un destino (lote o apiario). */
export type UltimaCompletada = {
  destino_id: string;
  tipo_tarea_id: string;
  fecha: Date | null;
};

/** Frecuencia propia de un lote, que pisa la del tipo de tarea. */
export type FrecuenciaPropia = {
  destino_id: string;
  tipo_tarea_id: string;
  frecuencia_dias: number;
};

export type TipoConFrecuencia = {
  id: string;
  frecuencia_dias_default: number;
};

export type EstadoDeTarea = ResumenTarea & {
  destino_id: string;
  tipo_tarea_id: string;
  /** Los días que se usaron, ya resueltos entre el propio y el del tipo. */
  frecuencia_dias: number;
};

/** La clave que empareja un destino con un tipo de tarea. Una sola definición. */
function clave(destinoId: string, tipoId: string): string {
  return `${destinoId}_${tipoId}`;
}

/**
 * Resuelve el estado de cada combinación destino × tarea.
 *
 * `diasAlerta` es con cuánta anticipación se avisa; sale de la configuración de
 * la finca, no de un número fijo.
 */
export function estadoDeTareas(entrada: {
  destinos: string[];
  tipos: TipoConFrecuencia[];
  frecuenciasPropias: FrecuenciaPropia[];
  ultimas: UltimaCompletada[];
  ahora?: Date;
  diasAlerta?: number;
}): EstadoDeTarea[] {
  const { destinos, tipos, frecuenciasPropias, ultimas } = entrada;
  const ahora = entrada.ahora ?? new Date();
  const diasAlerta = entrada.diasAlerta ?? 7;

  const propias = new Map<string, number>();
  for (const f of frecuenciasPropias) {
    propias.set(clave(f.destino_id, f.tipo_tarea_id), f.frecuencia_dias);
  }
  const ultimaPor = new Map<string, Date | null>();
  for (const u of ultimas) {
    ultimaPor.set(clave(u.destino_id, u.tipo_tarea_id), u.fecha);
  }

  const salida: EstadoDeTarea[] = [];
  for (const destino of destinos) {
    for (const tipo of tipos) {
      const k = clave(destino, tipo.id);
      const frecuencia = propias.get(k) ?? tipo.frecuencia_dias_default;
      const resumen = calcularResumen(ultimaPor.get(k) ?? null, frecuencia, ahora, diasAlerta);
      salida.push({
        ...resumen,
        destino_id: destino,
        tipo_tarea_id: tipo.id,
        frecuencia_dias: frecuencia,
      });
    }
  }
  return salida;
}
