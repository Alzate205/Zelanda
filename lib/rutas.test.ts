import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ninguna pantalla debe quedar sin forma de llegar.
 *
 * Pasó con dos: el inventario del jefe y "Tipos de tarea". La segunda es la que
 * configura cada cuántos días toca cada tarea —el número que decide qué lote
 * sale vencido en el mapa— y no se podía abrir desde ningún lado. Nadie se
 * enteró hasta que el dueño de la finca preguntó cómo editar esa frecuencia.
 *
 * Una pantalla sin enlace no falla, no rompe nada y no aparece en ninguna
 * prueba: simplemente no existe para quien usa la app. Este test la encuentra.
 */

const BARRA = /\\/g;

function archivos(dir: string, ext: string[], out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/**
 * Pantallas que se dejaron sin acceso a propósito, con el motivo.
 * Sacar algo de acá exige explicar por qué deja de ser alcanzable.
 */
const SIN_ACCESO_A_PROPOSITO: Record<string, string> = {
  '/jefe/asistente': 'oculta hasta que se apruebe contratar la IA (consume la API y factura)',
};

describe('rutas de la app', () => {
  it('todas las pantallas tienen alguna forma de llegar', () => {
    const rutas = archivos('app/(app)', ['page.tsx'])
      .map((p) => '/' + p.replace(BARRA, '/').replace('app/(app)/', '').replace('/page.tsx', ''))
      // Las rutas con :id se llegan desde una lista; no se pueden buscar como texto.
      .filter((r) => !r.includes('['));

    const fuentes = [
      ...archivos('app', ['.tsx', '.ts']),
      ...archivos('components', ['.tsx', '.ts']),
    ];
    const texto = fuentes.map((f) => {
      // revalidatePath() invalida caché, no lleva a ninguna parte. Contarlo como
      // enlace escondía justamente las pantallas que este test busca.
      const s = fs.readFileSync(f, 'utf8').replace(/revalidatePath\([^)]*\)/g, '');
      return [f.replace(BARRA, '/'), s] as const;
    });

    const huerfanas = rutas.filter((ruta) => {
      if (ruta in SIN_ACCESO_A_PROPOSITO) return false;
      return !texto.some(([archivo, s]) => {
        // Un enlace desde la propia pantalla no sirve para llegar a ella.
        if (archivo.includes('app/(app)' + ruta + '/')) return false;
        return (
          s.includes(`"${ruta}"`) ||
          s.includes(`'${ruta}'`) ||
          s.includes('`' + ruta) ||
          s.includes(`"${ruta}/`) ||
          s.includes(`'${ruta}/`)
        );
      });
    });

    expect(huerfanas).toEqual([]);
  });
});
