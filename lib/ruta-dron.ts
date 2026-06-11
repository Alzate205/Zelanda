// Orden de visita del vuelo de dron: vecino más cercano sobre los
// centroides. Para 15 lotes es más que suficiente y es determinista.

export function ordenarPorCercania(paradas: { id: string; centro: [number, number] }[]): string[] {
  if (paradas.length === 0) return [];
  const pendientes = [...paradas];
  const ruta: string[] = [];
  let actual = pendientes.shift() as (typeof paradas)[number];
  ruta.push(actual.id);
  while (pendientes.length > 0) {
    let mejor = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const dx = pendientes[i].centro[0] - actual.centro[0];
      const dy = pendientes[i].centro[1] - actual.centro[1];
      const d = dx * dx + dy * dy;
      if (d < mejorDist) {
        mejorDist = d;
        mejor = i;
      }
    }
    actual = pendientes.splice(mejor, 1)[0];
    ruta.push(actual.id);
  }
  return ruta;
}
