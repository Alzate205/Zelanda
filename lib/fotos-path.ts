/**
 * Las fotos se suben aparte y al registro solo llega su ruta, que viaja por el
 * cuerpo que manda el cliente. Aceptarla a ojo cerrado dejaría que cualquiera
 * apuntara un registro a un archivo ajeno del bucket, así que se exige la forma
 * exacta que produce /api/trabajador/foto: carpeta conocida y nombre simple.
 */
export type CarpetaFoto = 'avance' | 'novedades';

const MAX_LARGO = 300;
const NOMBRE = /^[A-Za-z0-9._-]+$/;

export function pathFotoValido(v: unknown, carpeta: CarpetaFoto): string | null {
  if (typeof v !== 'string') return null;
  const p = v.trim();
  if (p.length === 0 || p.length > MAX_LARGO) return null;
  const prefijo = `${carpeta}/`;
  if (!p.startsWith(prefijo)) return null;
  const nombre = p.slice(prefijo.length);
  if (!NOMBRE.test(nombre)) return null;
  return p;
}
