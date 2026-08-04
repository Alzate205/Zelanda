import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Cliente de la API de Claude, o null si la finca todavía no lo activó.
 *
 * El asistente arranca apagado a propósito: la API es de pago por uso, así que
 * sin ANTHROPIC_API_KEY no hay llamadas y no hay factura. La pantalla detecta
 * el null y avisa en vez de romperse.
 */

/**
 * Sonnet 5 alcanza de sobra para traducir una pregunta a SQL y redactar el
 * resultado, a la mitad del costo de Opus. Para cambiarlo, esta línea.
 */
export const MODELO = 'claude-sonnet-5';

/** Tope de tokens por respuesta. Acota el costo de una pregunta que se desmadre. */
export const MAX_TOKENS = 4096;

let cache: Anthropic | null | undefined;

export function obtenerClienteIA(): Anthropic | null {
  if (cache !== undefined) return cache;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cache = apiKey ? new Anthropic({ apiKey }) : null;
  return cache;
}

/** `true` cuando el asistente está configurado y puede usarse. */
export function iaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(process.env.DATABASE_URL_IA);
}
