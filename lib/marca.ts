/**
 * El logo de la finca, en un solo lugar.
 *
 * La proporción estaba escrita a mano —1.68— en los cuatro componentes que
 * muestran el logo. Cuando se cambió la imagen por una de proporción distinta,
 * los cuatro quedaron reservando un espacio que ya no correspondía, y hay que
 * acordarse de tocar los cuatro. Acá se define una vez.
 */
export const LOGO_SRC = '/logo-zelanda.webp';

/** Alto dividido ancho de la imagen (474 x 819). */
export const LOGO_PROPORCION = 819 / 474;

/** Dimensiones para `next/image` a partir del alto que se quiera mostrar. */
export function dimensionesLogo(alto: number): { width: number; height: number } {
  return { width: Math.round(alto / LOGO_PROPORCION), height: alto };
}
