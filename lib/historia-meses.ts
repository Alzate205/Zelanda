/** Lista de meses 'YYYY-MM' entre desde y hasta, ambos inclusive. */
export function listaMeses(desde: string, hasta: string): string[] {
  const [aD, mD] = desde.split('-').map(Number);
  const [aH, mH] = hasta.split('-').map(Number);
  const meses: string[] = [];
  let anio = aD;
  let mes = mD;
  while (anio < aH || (anio === aH && mes <= mH)) {
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }
  return meses;
}
