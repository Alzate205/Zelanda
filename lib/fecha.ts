/**
 * Utilitarios para manejar fechas en zona horaria de Bogotá (UTC-5)
 * Crítico para operaciones financieras: pagos, saldos, ausencias, jornales
 *
 * Usa Intl.DateTimeFormat con timeZone: 'America/Bogota' explícito
 * para asegurar consistencia sin depender de variables de entorno.
 */

/**
 * Obtiene la fecha actual en Bogotá (medianoche del día actual en esa zona)
 * Útil para comparaciones de fechas en operaciones de pagos/saldos
 */
export function hoyEnBogota(): Date {
  const ahora = new Date();
  const formatter = new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Bogota',
  });

  const [dia, mes, año] = formatter
    .formatToParts(ahora)
    .filter((p) => ['day', 'month', 'year'].includes(p.type))
    .map((p) => p.value);

  return new Date(`${año}-${mes}-${dia}T00:00:00`);
}

/**
 * Obtiene el timestamp actual en segundos (para comparaciones de sincronización)
 */
export function ahoraEnBogota(): number {
  return Date.now();
}

/**
 * Hora del día (0-23) en Bogotá. `hourCycle: 'h23'` evita que la medianoche
 * salga como 24, que es lo que devuelve `hour12: false` en algunos runtimes.
 */
export function horaEnBogota(fecha: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'America/Bogota',
    }).format(fecha)
  );
}

/**
 * Saludo según el momento del día en la finca. Se calcula en el servidor y
 * viaja como prop, para que no haya desajuste de hidratación con el reloj
 * del celular.
 */
export function saludoPorHora(fecha: Date = new Date()): string {
  const hora = horaEnBogota(fecha);
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Formatea una fecha para mostrar en Bogotá (ej: "26 de mayo de 2026")
 */
export function formatearFechaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

/**
 * Formatea una fecha con hora en Bogotá (ej: "26/05/2026 14:30")
 */
export function formatearFechaConHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

/**
 * Obtiene el primer día del mes actual en Bogotá
 */
export function primerDiaDelMesEnBogota(): Date {
  const hoy = hoyEnBogota();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

/**
 * Obtiene el último día del mes actual en Bogotá
 */
export function ultimoDiaDelMesEnBogota(): Date {
  const hoy = hoyEnBogota();
  return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
}

/**
 * Compara dos fechas ignorando la hora (útil para ausencias, jornales)
 * Retorna:
 *  - Negativo si fecha1 < fecha2
 *  - 0 si son el mismo día
 *  - Positivo si fecha1 > fecha2
 */
export function compararFechas(fecha1: Date, fecha2: Date): number {
  const f1 = new Date(fecha1.toLocaleDateString('en-CA')); // YYYY-MM-DD
  const f2 = new Date(fecha2.toLocaleDateString('en-CA'));
  return f1.getTime() - f2.getTime();
}

/**
 * Obtiene el nombre del mes en Bogotá
 */
export function nombreDelMes(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

/**
 * Obtiene el año de una fecha en Bogotá
 */
export function obtenerAño(fecha: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
    .formatToParts(fecha)
    .reduce(
      (acc, part) => {
        if (part.type === 'year') acc.year = parseInt(part.value, 10);
        return acc;
      },
      { year: 0 }
    );
  return parts.year;
}

/**
 * Retorna los límites del mes indicado expresados como TIMESTAMPTZ en UTC.
 * Usar para filtrar campos TIMESTAMPTZ (ej: salidas_cosecha.fecha, cosechas.fecha).
 * Para campos DATE (pagos, jornales, compras, etc.) usar periodoMes() de lib/saldos es suficiente.
 * Colombia es UTC-5 (sin cambio de horario): medianoche Bogotá = 05:00 UTC.
 */
export function periodoMesBogota(anio: number, mes: number): { desde: Date; hasta: Date } {
  const desde = new Date(Date.UTC(anio, mes, 1, 5, 0, 0, 0));
  const hasta = new Date(Date.UTC(anio, mes + 1, 1, 4, 59, 59, 999));
  return { desde, hasta };
}

/**
 * Retorna el año y mes actuales en Bogotá.
 * Usar en parsearMes() de páginas financieras en vez de new Date()
 * para evitar que el mes por defecto sea incorrecto entre medianoche UTC y las 5am UTC.
 */
export function mesBogota(): { anio: number; mes: number } {
  const hoy = hoyEnBogota();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
}

/**
 * Formatea un campo DATE de Prisma (que llega como UTC midnight) para mostrar en UI.
 * Usa timeZone 'UTC' explícito para evitar corrimiento al día anterior en servidores no-UTC.
 */
export function formatearFechaDateCorta(fecha: Date, incluirAnio = false): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    ...(incluirAnio ? { year: '2-digit' } : {}),
    timeZone: 'UTC',
  }).format(fecha);
}

/**
 * Obtiene el mes (0-11) de una fecha en Bogotá
 */
export function obtenerMes(fecha: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'America/Bogota',
  })
    .formatToParts(fecha)
    .reduce(
      (acc, part) => {
        if (part.type === 'month') acc.month = parseInt(part.value, 10) - 1;
        return acc;
      },
      { month: 0 }
    );
  return parts.month;
}
