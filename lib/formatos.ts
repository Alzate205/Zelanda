/**
 * Formatea un string numerico con puntos como separador de miles (es-CO).
 * Ejemplos: "1234567" -> "1.234.567", "-1234" -> "-1.234"
 */
export function formatearMiles(valor: string): string {
  if (!valor) return "";
  const negativo = valor.startsWith("-");
  const digitos = valor.replace(/[^\d]/g, "");
  if (!digitos) return negativo ? "-" : "";
  const conPuntos = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return negativo ? `-${conPuntos}` : conPuntos;
}

/**
 * Normaliza un string ingresado por el usuario (con puntos de miles)
 * y opcionalmente signo negativo, dejando solo digitos y el signo.
 * Pensado para `onChange` de inputs controlados.
 */
export function normalizarEntradaNumerica(
  valor: string,
  permitirNegativo = false,
): string {
  const negativo = permitirNegativo && valor.trim().startsWith("-");
  const digitos = valor.replace(/[^\d]/g, "");
  return negativo && digitos ? `-${digitos}` : digitos;
}

/**
 * Convierte un string con formato "1.234.567" a numero plano.
 * Devuelve NaN si la entrada es invalida (el caller decide).
 */
export function parsearMonto(valor: string): number {
  if (!valor) return NaN;
  return Number(valor.replace(/\./g, ""));
}
