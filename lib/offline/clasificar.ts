/**
 * Qué hacer con la respuesta del servidor al subir un registro de la cola.
 *
 * - `ok`: guardado, se puede sacar de la cola.
 * - `permanente`: el servidor rechazó los datos. Reintentar no cambia nada, así
 *   que se marca con error y el trabajador decide si borrarlo.
 * - `reintentar`: el problema es del servidor o del momento, no del registro.
 *   Se deja pendiente para volver a intentarlo.
 *
 * La regla vive aparte porque la usan dos caminos —el envío directo y el motor
 * de sincronización— y tienen que decidir igual.
 */
export type Clasificacion = 'ok' | 'permanente' | 'reintentar';

export function clasificarRespuesta(status: number): Clasificacion {
  if (status >= 200 && status < 300) return 'ok';
  // 408 (timeout) y 429 (demasiadas peticiones) son 4xx que sí se arreglan solos.
  if (status === 408 || status === 429) return 'reintentar';
  if (status >= 400 && status < 500) return 'permanente';
  return 'reintentar';
}
