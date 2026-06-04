/**
 * Generación de CSV simple y segura para exportar/respaldar datos.
 * Usa `;` como separador (Excel en español lo abre directo) y comillas
 * cuando el valor contiene separador, comillas o saltos de línea.
 */

function escaparCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  let s: string;
  if (valor instanceof Date) {
    s = valor.toISOString();
  } else if (typeof valor === 'bigint') {
    s = valor.toString();
  } else if (typeof valor === 'object') {
    s = JSON.stringify(valor);
  } else {
    s = String(valor);
  }
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generarCSV(columnas: string[], filas: unknown[][]): string {
  const lineas = [columnas.map(escaparCelda).join(';')];
  for (const fila of filas) {
    lineas.push(fila.map(escaparCelda).join(';'));
  }
  // BOM para que Excel detecte UTF-8 (tildes y ñ correctas)
  return '﻿' + lineas.join('\r\n');
}
