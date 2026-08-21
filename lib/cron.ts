import type { NextRequest } from 'next/server';

/**
 * Comprueba que quien llama es de verdad el cron de Vercel.
 *
 * Antes cada ruta de cron traía su propia copia de estas cuatro líneas, y la
 * comparación era directamente contra `Bearer ${process.env.CRON_SECRET}`. Si
 * la variable falta, eso queda comparando contra el texto `"Bearer undefined"`
 * y **cualquiera que mande ese header exacto pasa**: la guarda falla abierta
 * justo cuando está mal configurada, que es cuando más falta hace.
 *
 * Hoy la variable está puesta en producción, así que no había agujero abierto.
 * Esto es para que siga sin haberlo el día que alguien cree un entorno nuevo y
 * se le olvide.
 *
 * Devuelve `null` si la llamada es legítima, o el motivo del rechazo.
 */
export function motivoRechazoCron(req: NextRequest): 'sin-secreto' | 'token-invalido' | null {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return 'sin-secreto';
  if (req.headers.get('authorization') !== `Bearer ${secreto}`) return 'token-invalido';
  return null;
}
