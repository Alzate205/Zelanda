/**
 * Lee un monto en pesos escrito como lo escribe la gente acá: punto de miles y
 * coma decimal ("1.250.000", "12,5").
 *
 * Devuelve null si no hay un número de verdad. Esa distinción importa: usar
 * `Number(raw)` a secas convertía el campo vacío en 0, así que un jornal al que
 * se le olvidó la tarifa se guardaba como un jornal de cero pesos sin que nadie
 * se enterara.
 */
export function parsearMontoCop(raw: string): number | null {
  const limpio = raw.trim();
  if (limpio === '') return null;

  const negativo = limpio.startsWith('-');
  const cuerpo = (negativo ? limpio.slice(1) : limpio).replace(/\s/g, '');

  // Punto de miles: solo se descarta si separa grupos de tres dígitos.
  const sinMiles = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cuerpo) ? cuerpo.replace(/\./g, '') : cuerpo;
  const normalizado = sinMiles.replace(',', '.');

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}
