/**
 * Validación de los datos de un lote.
 *
 * Vive aparte de las server actions para poder testearla sin BD: es la puerta
 * por la que entra la carga real de la finca, y un error acá se paga creando
 * miles de árboles equivocados.
 */

/** Un lote de La Zelanda llega a ~2.300 árboles. El techo ataja un dedazo. */
export const MAX_ARBOLES_POR_LOTE = 10_000;

export type DatosLote = {
  nombre: string;
  hectareas: number | null;
  total_arboles: number;
};

export type ResultadoValidacion = { ok: true; datos: DatosLote } | { ok: false; error: string };

export function normalizarNombreLote(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Sin tildes, sin mayúsculas, sin espacios de sobra. Para comparar nombres. */
function plano(raw: string): string {
  return normalizarNombreLote(raw).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function validarDatosLote(entrada: {
  nombre: string;
  hectareas?: string | null;
  total_arboles?: string | null;
}): ResultadoValidacion {
  const nombre = normalizarNombreLote(entrada.nombre ?? '');
  if (!nombre) return { ok: false, error: 'El nombre del lote es obligatorio.' };

  let hectareas: number | null = null;
  const haRaw = (entrada.hectareas ?? '').trim();
  if (haRaw) {
    // En la finca se escribe con coma decimal.
    const h = Number(haRaw.replace(',', '.'));
    if (!Number.isFinite(h) || h < 0) {
      return { ok: false, error: 'Hectáreas debe ser un número mayor o igual a cero.' };
    }
    hectareas = h;
  }

  let total_arboles = 0;
  const arbRaw = (entrada.total_arboles ?? '').trim();
  if (arbRaw) {
    if (!/^\d+$/.test(arbRaw)) {
      return { ok: false, error: 'Total de árboles debe ser un número entero.' };
    }
    total_arboles = parseInt(arbRaw, 10);
    if (total_arboles > MAX_ARBOLES_POR_LOTE) {
      return {
        ok: false,
        error: `Total de árboles no puede pasar de ${MAX_ARBOLES_POR_LOTE.toLocaleString(
          'es-CO'
        )}. ¿Sobró un cero?`,
      };
    }
  }

  return { ok: true, datos: { nombre, hectareas, total_arboles } };
}

/** Borrar un lote exige escribir su nombre: evita el borrado de un dedazo. */
export function confirmacionBorradoValida(escrito: string, nombreLote: string): boolean {
  const e = plano(escrito ?? '');
  return e.length > 0 && e === plano(nombreLote);
}
