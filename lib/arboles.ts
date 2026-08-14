/**
 * Creación masiva de árboles.
 *
 * Un lote real de La Zelanda tiene entre 1.500 y 2.300 árboles, y la finca
 * entera ~30.000. Insertarlos en un solo `createMany` arma una sentencia
 * enorme contra el pooler de Supabase; partirla en tandas la vuelve predecible
 * sin costar nada.
 */

/** Filas por sentencia. Mil es cómodo para el pooler y sigue siendo rápido. */
export const TAMANO_TANDA_ARBOLES = 1000;

/**
 * Números de placa de `desde` a `hasta` (ambos inclusive), agrupados en tandas.
 * Devuelve vacío si no hay nada que crear.
 */
export function tandasDePlacas(
  desde: number,
  hasta: number,
  tamano: number = TAMANO_TANDA_ARBOLES
): number[][] {
  if (hasta < desde) return [];
  const tandas: number[][] = [];
  for (let inicio = desde; inicio <= hasta; inicio += tamano) {
    const fin = Math.min(inicio + tamano - 1, hasta);
    const tanda: number[] = [];
    for (let n = inicio; n <= fin; n++) tanda.push(n);
    tandas.push(tanda);
  }
  return tandas;
}
