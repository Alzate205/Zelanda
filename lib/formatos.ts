/**
 * Formatea un string numerico con puntos como separador de miles (es-CO).
 * Ejemplos: "1234567" -> "1.234.567", "-1234" -> "-1.234"
 */
export function formatearMiles(valor: string): string {
  if (!valor) return '';
  const negativo = valor.startsWith('-');
  const digitos = valor.replace(/[^\d]/g, '');
  if (!digitos) return negativo ? '-' : '';
  const conPuntos = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negativo ? `-${conPuntos}` : conPuntos;
}

/**
 * Normaliza un string ingresado por el usuario (con puntos de miles)
 * y opcionalmente signo negativo, dejando solo digitos y el signo.
 * Pensado para `onChange` de inputs controlados.
 */
export function normalizarEntradaNumerica(valor: string, permitirNegativo = false): string {
  const negativo = permitirNegativo && valor.trim().startsWith('-');
  const digitos = valor.replace(/[^\d]/g, '');
  return negativo && digitos ? `-${digitos}` : digitos;
}

/**
 * Convierte un string con formato "1.234.567" a numero plano.
 * Devuelve NaN si la entrada es invalida (el caller decide).
 */
export function parsearMonto(valor: string): number {
  if (!valor) return NaN;
  return Number(valor.replace(/\./g, ''));
}

/**
 * Lee una cantidad decimal escrita a mano, con coma o con punto.
 *
 * El teclado del celular en español manda la coma: "0,5". Con `type="number"`
 * el navegador daba por invalido ese valor y entregaba el campo vacio, asi que
 * medio kilo de miel llegaba como cero y el formulario respondia que debia ser
 * positivo. Devuelve NaN si no hay un numero; el caller decide que hacer.
 */
export function parsearDecimal(valor: string): number {
  const limpio = valor.trim().replace(',', '.');
  if (!limpio) return NaN;
  // Una sola coma o punto decimal, con signo opcional: nada de "1.2.3".
  if (!/^-?\d*\.?\d+$/.test(limpio)) return NaN;
  return Number(limpio);
}

/**
 * Muestra una cantidad de inventario: stock, kilos, litros.
 *
 * Existe por un error que se veía en la app: el stock se guarda como
 * NUMERIC(12,3), así que diez litros viven en la base como `10.000`. Cuando ese
 * valor viajaba a la pantalla convertido a texto con `::text` y se pintaba tal
 * cual, en español se leía "diez mil litros". Un encargado mirando el
 * inventario veía mil veces lo que había.
 *
 * Acá se interpreta el valor como número y se vuelve a escribir en formato
 * es-CO, que además pone el punto de miles donde corresponde: `10.000` (diez)
 * sale como "10", y diez mil de verdad sale como "10.000".
 *
 * Los decimales que no aportan se van: 0,5 L se escribe "0,5" y no "0,500".
 */
export function formatearCantidad(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '0';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
}

/**
 * Escribe un número con decimales en formato colombiano.
 *
 * `toFixed()` escribe el decimal con punto —"5.6 ha", "-402.0%"— porque es
 * formato inglés, y en la misma pantalla los montos van con formato de acá
 * ("$ 1.000.000"). Mezclar los dos no es sólo feo: el punto significa miles en
 * un lugar y decimales en el otro, así que "1.250 kg" se puede leer como mil
 * doscientos cincuenta o como uno con veinticinco.
 *
 * Acá siempre sale con coma decimal y punto de miles, como el resto de la app.
 */
export function formatearDecimal(valor: number | string | null | undefined, decimales = 1): string {
  // `Number(null)` da 0, así que sin esta guarda un dato faltante se mostraría
  // como "0,0" y parecería un cero medido.
  if (valor === null || valor === undefined || valor === '') return '0';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
