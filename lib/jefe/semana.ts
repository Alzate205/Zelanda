import type { EstadoDeTarea } from '@/lib/fechas-tarea';

/**
 * Arma la semana del jefe: qué hay asignado cada día y qué vence sin que nadie
 * lo tenga encargado.
 *
 * Es pura y está aparte de la pantalla porque decide cosas que sólo se pueden
 * comprobar moviendo el calendario: en qué día cae cada tarea, qué queda fuera
 * de la semana, y sobre todo que un lote que ya tiene a alguien asignado no
 * aparezca además como hueco. Ese último caso es el que haría que el jefe
 * mandara dos personas al mismo lote.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

export type AsignacionDeSemana = {
  id: string;
  lote_id: string;
  tipo_tarea_id: string;
  fecha_inicio: Date;
  persona: string;
  estado: string;
};

export type Nombres = {
  lote: (id: string) => string | undefined;
  tipo: (id: string) => string | undefined;
};

export type TareaDeDia = {
  clave: string;
  lote_id: string;
  lote_nombre: string;
  tipo_tarea_id: string;
  tipo_nombre: string;
  /** Null cuando es un hueco: vence ese día y nadie lo tiene encargado. */
  asignada: { id: string; persona: string; estado: string } | null;
};

export type DiaDeSemana = {
  fecha: Date;
  esHoy: boolean;
  tareas: TareaDeDia[];
};

export type TareaAtrasada = TareaDeDia & {
  /** Días de retraso; null cuando nunca se hizo. */
  dias_vencida: number | null;
};

export type PlanDeSemana = {
  dias: DiaDeSemana[];
  atrasadas: TareaAtrasada[];
  /** Cuántas nunca se hicieron, que se cuentan aparte de las vencidas. */
  sinEmpezar: number;
};

/** Medianoche del día de `fecha`, sin la hora. */
function soloDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function mismoDia(a: Date, b: Date): boolean {
  return soloDia(a).getTime() === soloDia(b).getTime();
}

/**
 * El lunes de la semana a la que pertenece `fecha`.
 *
 * `getDay()` devuelve 0 para domingo, así que el domingo cuenta como el
 * séptimo día de la semana que termina y no como el primero de la que empieza:
 * de lo contrario, el domingo el jefe vería la semana siguiente.
 */
export function lunesDeLaSemana(fecha: Date): Date {
  const d = soloDia(fecha);
  const diaSemana = d.getDay();
  const restar = diaSemana === 0 ? 6 : diaSemana - 1;
  return new Date(d.getTime() - restar * MS_DIA);
}

function clave(loteId: string, tipoId: string): string {
  return `${loteId}_${tipoId}`;
}

export function construirPlanDeSemana(entrada: {
  estados: EstadoDeTarea[];
  asignaciones: AsignacionDeSemana[];
  nombres: Nombres;
  lunes: Date;
  hoy: Date;
}): PlanDeSemana {
  const { estados, asignaciones, nombres, lunes, hoy } = entrada;
  const inicio = soloDia(lunes);
  const dias: DiaDeSemana[] = Array.from({ length: 7 }, (_, i) => ({
    fecha: new Date(inicio.getTime() + i * MS_DIA),
    esHoy: mismoDia(new Date(inicio.getTime() + i * MS_DIA), hoy),
    tareas: [],
  }));
  const fin = new Date(inicio.getTime() + 7 * MS_DIA);

  const nombrar = (loteId: string, tipoId: string): TareaDeDia => ({
    clave: clave(loteId, tipoId),
    lote_id: loteId,
    lote_nombre: nombres.lote(loteId) ?? 'lote',
    tipo_tarea_id: tipoId,
    tipo_nombre: nombres.tipo(tipoId) ?? 'Tarea',
    asignada: null,
  });

  // Lo que ya tiene alguien encargado dentro de la semana. Se anota la clave
  // para no volver a mostrarlo como hueco ni como atrasado más abajo.
  const cubiertas = new Set<string>();
  for (const a of asignaciones) {
    const dia = dias.find((d) => mismoDia(d.fecha, a.fecha_inicio));
    cubiertas.add(clave(a.lote_id, a.tipo_tarea_id));
    if (!dia) continue; // asignada fuera de esta semana
    dia.tareas.push({
      ...nombrar(a.lote_id, a.tipo_tarea_id),
      asignada: { id: a.id, persona: a.persona, estado: a.estado },
    });
  }

  const atrasadas: TareaAtrasada[] = [];
  let sinEmpezar = 0;

  for (const e of estados) {
    const k = clave(e.destino_id, e.tipo_tarea_id);
    if (cubiertas.has(k)) continue;

    if (e.estado === 'sin_historial') {
      sinEmpezar++;
      continue;
    }
    if (e.estado === 'vencida') {
      atrasadas.push({
        ...nombrar(e.destino_id, e.tipo_tarea_id),
        dias_vencida: e.dias_para_proxima,
      });
      continue;
    }
    // Al día o próxima: cae en la semana sólo si su fecha está dentro.
    if (!e.proxima) continue;
    const cae = soloDia(e.proxima);
    if (cae < inicio || cae >= fin) continue;
    const dia = dias.find((d) => mismoDia(d.fecha, cae));
    dia?.tareas.push(nombrar(e.destino_id, e.tipo_tarea_id));
  }

  // Dentro de cada día, primero lo que ya tiene dueño.
  for (const d of dias) {
    d.tareas.sort((a, b) => Number(!!b.asignada) - Number(!!a.asignada));
  }
  // Las que llevan más tiempo esperando, primero.
  atrasadas.sort((a, b) => (a.dias_vencida ?? 0) - (b.dias_vencida ?? 0));

  return { dias, atrasadas, sinEmpezar };
}
