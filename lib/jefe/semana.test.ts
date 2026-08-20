import { describe, it, expect } from 'vitest';
import { construirPlanDeSemana, lunesDeLaSemana } from './semana';
import type { EstadoDeTarea } from '@/lib/fechas-tarea';

const NOMBRES = {
  lote: (id: string) => ({ l1: 'Armenia', l2: 'Barcelona', l3: 'Calarcá' }[id]),
  tipo: (id: string) => ({ t1: 'Plateo químico', t2: 'Riego' }[id]),
};

// Lunes 5 de enero de 2026.
const LUNES = new Date(2026, 0, 5);
const dia = (n: number) => new Date(2026, 0, 5 + n);

function estado(
  destino: string,
  tipo: string,
  est: EstadoDeTarea['estado'],
  proxima: Date | null,
  diasParaProxima: number | null = 3
): EstadoDeTarea {
  return {
    destino_id: destino,
    tipo_tarea_id: tipo,
    estado: est,
    ultima: est === 'sin_historial' ? null : new Date(2025, 11, 1),
    proxima,
    dias_para_proxima: est === 'sin_historial' ? null : diasParaProxima,
    frecuencia_dias: 90,
  };
}

function asignacion(lote: string, tipo: string, fecha: Date, persona = 'Diego') {
  return {
    id: `a-${lote}-${tipo}`,
    lote_id: lote,
    tipo_tarea_id: tipo,
    fecha_inicio: fecha,
    persona,
    estado: 'PENDIENTE',
  };
}

const plan = (entrada: Partial<Parameters<typeof construirPlanDeSemana>[0]>) =>
  construirPlanDeSemana({
    estados: [],
    asignaciones: [],
    nombres: NOMBRES,
    lunes: LUNES,
    hoy: LUNES,
    ...entrada,
  });

describe('lunesDeLaSemana', () => {
  it('un miércoles devuelve el lunes de esa semana', () => {
    expect(lunesDeLaSemana(dia(2))).toEqual(LUNES);
  });

  it('el lunes se devuelve a sí mismo', () => {
    expect(lunesDeLaSemana(LUNES)).toEqual(LUNES);
  });

  it('el domingo cierra su semana en vez de abrir la siguiente', () => {
    // Si el domingo devolviera el lunes siguiente, ese día el jefe abriría la
    // app y vería la semana que todavía no empezó.
    expect(lunesDeLaSemana(dia(6))).toEqual(LUNES);
  });
});

describe('construirPlanDeSemana', () => {
  it('siempre son siete días, aunque no haya nada', () => {
    const p = plan({});
    expect(p.dias).toHaveLength(7);
    expect(p.dias.every((d) => d.tareas.length === 0)).toBe(true);
  });

  it('marca cuál es hoy', () => {
    const p = plan({ hoy: dia(2) });
    expect(p.dias.filter((d) => d.esHoy)).toHaveLength(1);
    expect(p.dias[2].esHoy).toBe(true);
  });

  it('pone cada tarea que vence en el día que le toca', () => {
    const p = plan({
      estados: [estado('l1', 't2', 'proxima', dia(0)), estado('l2', 't2', 'proxima', dia(3))],
    });
    expect(p.dias[0].tareas.map((t) => t.lote_nombre)).toEqual(['Armenia']);
    expect(p.dias[3].tareas.map((t) => t.lote_nombre)).toEqual(['Barcelona']);
    expect(p.dias[1].tareas).toHaveLength(0);
  });

  it('un lote ya asignado no aparece además como hueco', () => {
    // Es el error que haría al jefe mandar dos personas al mismo lote.
    const p = plan({
      estados: [estado('l1', 't2', 'proxima', dia(2))],
      asignaciones: [asignacion('l1', 't2', dia(2))],
    });
    const delDia = p.dias[2].tareas;
    expect(delDia).toHaveLength(1);
    expect(delDia[0].asignada?.persona).toBe('Diego');
  });

  it('tampoco aparece como hueco si se asignó otro día de la semana', () => {
    const p = plan({
      estados: [estado('l1', 't2', 'proxima', dia(4))],
      asignaciones: [asignacion('l1', 't2', dia(1))],
    });
    expect(p.dias[4].tareas).toHaveLength(0);
    expect(p.dias[1].tareas[0].asignada).not.toBeNull();
  });

  it('una asignada que ya estaba vencida sale de la lista de atrasadas', () => {
    const p = plan({
      estados: [estado('l1', 't1', 'vencida', dia(-20), -20)],
      asignaciones: [asignacion('l1', 't1', dia(1))],
    });
    expect(p.atrasadas).toHaveLength(0);
    expect(p.dias[1].tareas[0].asignada).not.toBeNull();
  });

  it('lo vencido va aparte y no se cuela en los días', () => {
    const p = plan({
      estados: [
        estado('l1', 't1', 'vencida', dia(-30), -30),
        estado('l2', 't1', 'vencida', dia(-2), -2),
      ],
    });
    expect(p.dias.every((d) => d.tareas.length === 0)).toBe(true);
    expect(p.atrasadas.map((a) => a.lote_nombre)).toEqual(['Armenia', 'Barcelona']);
  });

  it('las que llevan más tiempo vencidas van primero', () => {
    const p = plan({
      estados: [
        estado('l2', 't1', 'vencida', dia(-2), -2),
        estado('l1', 't1', 'vencida', dia(-40), -40),
      ],
    });
    expect(p.atrasadas[0].lote_nombre).toBe('Armenia');
  });

  it('las que nunca se hicieron se cuentan aparte, no se listan', () => {
    // Hoy son 92: listadas, tapaban todo lo demás.
    const p = plan({
      estados: [
        estado('l1', 't1', 'sin_historial', null),
        estado('l2', 't1', 'sin_historial', null),
        estado('l3', 't1', 'vencida', dia(-5), -5),
      ],
    });
    expect(p.sinEmpezar).toBe(2);
    expect(p.atrasadas).toHaveLength(1);
  });

  it('lo que vence después del domingo no entra en la semana', () => {
    const p = plan({ estados: [estado('l1', 't2', 'aldia', dia(9), 9)] });
    expect(p.dias.every((d) => d.tareas.length === 0)).toBe(true);
    expect(p.atrasadas).toHaveLength(0);
  });

  it('el domingo es parte de la semana', () => {
    const p = plan({ estados: [estado('l1', 't2', 'proxima', dia(6))] });
    expect(p.dias[6].tareas).toHaveLength(1);
  });

  it('una asignación de otra semana no aparece, pero igual cubre su hueco', () => {
    // Si el plateo de Armenia se asignó para la semana que viene, mostrarlo
    // como hueco de ésta haría que se asignara dos veces.
    const p = plan({
      estados: [estado('l1', 't2', 'proxima', dia(3))],
      asignaciones: [asignacion('l1', 't2', dia(10))],
    });
    expect(p.dias.every((d) => d.tareas.length === 0)).toBe(true);
  });

  it('dentro de un día, lo que ya tiene dueño va primero', () => {
    const p = plan({
      estados: [estado('l2', 't2', 'proxima', dia(2))],
      asignaciones: [asignacion('l1', 't1', dia(2))],
    });
    expect(p.dias[2].tareas[0].asignada).not.toBeNull();
    expect(p.dias[2].tareas[1].asignada).toBeNull();
  });

  it('no deja el nombre en blanco si el lote ya no existe', () => {
    const p = plan({ estados: [estado('borrado', 'fantasma', 'proxima', dia(1))] });
    expect(p.dias[1].tareas[0].lote_nombre).toBe('lote');
    expect(p.dias[1].tareas[0].tipo_nombre).toBe('Tarea');
  });
});
