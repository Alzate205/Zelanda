// Colores de identidad de los lotes, compartidos por todos los mapas.
//
// Es una sola paleta a propósito: el mapa 2D y el centro de control 3D tienen
// que pintar el mismo lote del mismo color, o el color deja de servir para
// reconocerlo al pasar de una pantalla a otra.

const PALETA = [
  '#3b6e8f', // azul acero
  '#c87439', // naranja terracota
  '#5a8a4f', // verde oliva
  '#9c5a8a', // púrpura suave
  '#d4a04a', // dorado
  '#3d7050', // verde profundo
  '#a85048', // ladrillo
  '#6b6e9e', // azul lavanda
  '#8a6a3a', // marrón cálido
  '#4e8090', // teal apagado
  '#9a8845', // mostaza tierra
  '#7a5a8e', // ciruela
  // La finca tiene 16 lotes y con 12 colores cuatro habrían quedado repetidos
  // apenas se terminaran de dibujar los polígonos que faltan. Estos ocho se
  // eligieron en los huecos de tono que dejaban los anteriores, y variando
  // también el brillo: dos tonos parecidos se distinguen igual si uno es
  // claramente más oscuro que el otro.
  '#87963b', // oliva claro
  '#2f6f7a', // petróleo
  '#c2856b', // terracota claro
  '#6a4f7d', // morado oscuro
  '#4f9d78', // jade
  '#8f3f52', // vino
  '#5a7fb5', // azul cielo
  '#a9a05c', // arena
];

/**
 * Reparte los colores entre un conjunto de lotes, sin repetir.
 *
 * El reparto va por orden de creación (el id es un entero que crece), no por
 * el orden en que llegue el arreglo ni por nombre. Así, cuando se registra un
 * lote nuevo, se lleva el siguiente color libre y ninguno de los que ya estaban
 * cambia de color: si el mapa te cambiara los colores cada vez que agregás un
 * lote, dejaría de servir para reconocerlos.
 *
 * Pasados los colores de la paleta se vuelve a empezar. Con 20 lotes o menos
 * no se repite ninguno; la finca tiene 16.
 */
export function asignarColoresLotes(ids: Array<number | bigint | string>): Map<string, string> {
  const textos = ids.map((id) => String(id));
  const ordenados = [...new Set(textos)].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    // Si algún id no es numérico se ordena como texto: peor reparto, pero
    // estable, que es lo único que no se puede perder.
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const mapa = new Map<string, string>();
  ordenados.forEach((id, i) => mapa.set(id, PALETA[i % PALETA.length]));
  return mapa;
}

/**
 * Cuántos lotes se pueden pintar antes de que un color se repita.
 *
 * Si la finca llega a tener más lotes que esto, hay que sumar colores acá: el
 * reparto vuelve a empezar y dos lotes distintos salen del mismo color.
 */
export const COLORES_DISPONIBLES = PALETA.length;
