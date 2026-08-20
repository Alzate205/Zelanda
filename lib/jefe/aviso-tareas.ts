import type { EstadoDeTarea } from '@/lib/fechas-tarea';

/**
 * Arma el texto del aviso diario de tareas.
 *
 * Está aparte del cron y sin dependencias para poder probarlo: el aviso llega
 * una vez por día y en producción, así que verificar a mano si dice lo correcto
 * significaría esperar días por cada cambio.
 *
 * Nombra qué tarea y en qué lote. Antes decía sólo "16 vencidas, 0 próximas", y
 * con eso hay que abrir la app y buscar para saber qué hacer. En una finca donde
 * alcanza a hacerse un lote por día, saber cuál es el lote ES el aviso.
 */

/** Cuántas tareas se nombran antes de resumir el resto. */
export const MAX_NOMBRADAS = 3;

export type NombresDeTareas = {
  lote: (id: string) => string | undefined;
  tipo: (id: string) => string | undefined;
};

export type AvisoTareas = {
  hayAlgoQueDecir: boolean;
  titulo: string;
  cuerpo: string;
  vencidas: number;
  nuncaHechas: number;
  proximas: number;
  nombradas: string[];
};

function plural(n: number, singular: string, varias: string): string {
  return `${n} ${n === 1 ? singular : varias}`;
}

export function construirAvisoTareas(
  estados: EstadoDeTarea[],
  nombres: NombresDeTareas
): AvisoTareas {
  // Se separan a propósito. "Vencida" es una tarea que cumplió su ciclo y toca
  // repetir; "nunca hecha" es una que no arrancó todavía. En una finca que
  // recién carga sus lotes las segundas son decenas y, mezcladas, tapaban por
  // completo a las primeras — que son las que este aviso existe para recordar.
  const vencidas = estados.filter((e) => e.estado === 'vencida');
  const nuncaHechas = estados.filter((e) => e.estado === 'sin_historial');
  const proximas = estados.filter((e) => e.estado === 'proxima');

  const vacio: AvisoTareas = {
    hayAlgoQueDecir: false,
    titulo: '',
    cuerpo: '',
    vencidas: 0,
    nuncaHechas: 0,
    proximas: 0,
    nombradas: [],
  };
  if (vencidas.length + nuncaHechas.length + proximas.length === 0) return vacio;

  // Las que llevan más tiempo vencidas van primero.
  const urgentes = [...vencidas].sort(
    (a, b) => (a.dias_para_proxima ?? 0) - (b.dias_para_proxima ?? 0)
  );
  const nombradas = urgentes
    .slice(0, MAX_NOMBRADAS)
    .map(
      (e) =>
        `${nombres.tipo(e.tipo_tarea_id) ?? 'Tarea'} en ${nombres.lote(e.destino_id) ?? 'lote'}`
    );

  const titulo =
    vencidas.length > 0
      ? plural(vencidas.length, 'tarea vencida', 'tareas vencidas')
      : nuncaHechas.length > 0
      ? plural(nuncaHechas.length, 'tarea sin empezar', 'tareas sin empezar')
      : plural(proximas.length, 'tarea por vencer', 'tareas por vencer');

  const partes: string[] = [];
  if (nombradas.length > 0) {
    const restantes = vencidas.length - nombradas.length;
    partes.push(nombradas.join(', ') + (restantes > 0 ? ` y ${restantes} más` : ''));
  }
  // El título ya dice el número que encabeza; repetirlo en el cuerpo era decir
  // dos veces lo mismo ("92 tareas sin empezar · 92 sin empezar").
  if (nuncaHechas.length > 0 && vencidas.length > 0) {
    partes.push(`${nuncaHechas.length} sin empezar`);
  }
  if (proximas.length > 0 && (vencidas.length > 0 || nuncaHechas.length > 0)) {
    partes.push(`${proximas.length} por vencer`);
  }

  return {
    hayAlgoQueDecir: true,
    titulo,
    // Sin nada más que agregar, el cuerpo invita a mirar en vez de repetir.
    cuerpo: partes.length > 0 ? partes.join(' · ') : 'Tocá para ver cuáles.',
    vencidas: vencidas.length,
    nuncaHechas: nuncaHechas.length,
    proximas: proximas.length,
    nombradas,
  };
}
