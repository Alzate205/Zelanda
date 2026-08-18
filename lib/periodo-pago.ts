/**
 * Periodos que cubre un pago de salario.
 *
 * La tabla de pagos ya guarda `cubre_desde` y `cubre_hasta`, así que la
 * periodicidad no necesita una columna propia: se escribe como el rango que el
 * pago cubre de verdad, y de ese rango se lee después la etiqueta. Así el dato
 * sirve para dos cosas —saber qué se pagó y verlo de un vistazo en la lista—
 * en vez de quedar solo como un rótulo.
 */

export type PeriodoPago = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL';

/** Días que dura cada periodicidad, para convertir montos entre una y otra. */
export const DIAS_POR_PERIODO: Record<PeriodoPago, number> = {
  MENSUAL: 30,
  QUINCENAL: 15,
  SEMANAL: 7,
};

export const ETIQUETA_PERIODO: Record<PeriodoPago, string> = {
  MENSUAL: 'Mensual',
  QUINCENAL: 'Quincenal',
  SEMANAL: 'Semanal',
};

function aFecha(iso: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function ultimoDia(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Rango que cubre un pago, según la fecha en que se paga y la periodicidad.
 *
 * Se calcula como lo cuenta una nómina, no restando días sueltos: el mes
 * completo, la quincena del 1 al 15 o del 16 al cierre, y la semana como los
 * siete días que terminan el día del pago.
 */
export function periodoCubierto(
  fechaPago: string,
  periodo: PeriodoPago
): { desde: string; hasta: string } | null {
  const f = aFecha(fechaPago);
  if (!f) return null;
  const { anio, mes, dia } = f;

  if (periodo === 'MENSUAL') {
    return { desde: iso(anio, mes, 1), hasta: iso(anio, mes, ultimoDia(anio, mes)) };
  }

  if (periodo === 'QUINCENAL') {
    return dia <= 15
      ? { desde: iso(anio, mes, 1), hasta: iso(anio, mes, 15) }
      : { desde: iso(anio, mes, 16), hasta: iso(anio, mes, ultimoDia(anio, mes)) };
  }

  // SEMANAL: los siete días que terminan el día del pago, cruzando de mes sin problema.
  const fin = new Date(Date.UTC(anio, mes - 1, dia));
  const inicio = new Date(fin.getTime() - 6 * 86400000);
  return {
    desde: iso(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, inicio.getUTCDate()),
    hasta: iso(anio, mes, dia),
  };
}

/**
 * Nombra el periodo a partir del rango guardado, para la lista de pagos.
 *
 * Los meses tienen entre 28 y 31 días y las quincenas entre 13 y 16, así que se
 * reconocen por tramos. Si el rango no se parece a ninguno —porque el jefe puso
 * las fechas a mano— devuelve null y la lista muestra las fechas tal cual.
 */
export function etiquetaPeriodoCubierto(desde: Date, hasta: Date): string | null {
  const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1;
  if (dias === 7) return ETIQUETA_PERIODO.SEMANAL;
  if (dias >= 13 && dias <= 16) return ETIQUETA_PERIODO.QUINCENAL;
  if (dias >= 28 && dias <= 31) return ETIQUETA_PERIODO.MENSUAL;
  return null;
}
