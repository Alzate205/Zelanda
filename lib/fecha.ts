/**
 * Utilitarios para manejar fechas en zona horaria de Bogotá (UTC-5)
 * Crítico para operaciones financieras: pagos, saldos, ausencias, jornales
 *
 * IMPORTANTE: La variable de entorno TZ=America/Bogota debe estar configurada
 * en .env.local (local) y en Vercel dashboard (production)
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
