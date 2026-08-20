import { describe, it, expect } from 'vitest';
import { construirAvisoTareas } from './aviso-tareas';
import type { EstadoDeTarea } from '@/lib/fechas-tarea';

const NOMBRES = {
  lote: (id: string) => ({ l1: 'Armenia', l2: 'Barcelona', l3: 'Calarcá' }[id]),
  tipo: (id: string) => ({ t1: 'Plateo químico', t2: 'Riego' }[id]),
};

function tarea(
  destino: string,
  tipo: string,
  estado: EstadoDeTarea['estado'],
  diasParaProxima: number | null = -1
): EstadoDeTarea {
  return {
    destino_id: destino,
    tipo_tarea_id: tipo,
    estado,
    ultima: estado === 'sin_historial' ? null : new Date(),
    proxima: estado === 'sin_historial' ? null : new Date(),
    dias_para_proxima: estado === 'sin_historial' ? null : diasParaProxima,
    frecuencia_dias: 90,
  };
}

describe('construirAvisoTareas', () => {
  it('dice qué tarea y en qué lote, no sólo cuántas', () => {
    // El aviso viejo decía "16 vencidas" y había que abrir la app para saber
    // qué hacer. Con un lote por día, el nombre del lote es el aviso.
    const aviso = construirAvisoTareas([tarea('l1', 't1', 'vencida', -5)], NOMBRES);
    expect(aviso.titulo).toBe('1 tarea vencida');
    expect(aviso.cuerpo).toContain('Plateo químico en Armenia');
  });

  it('nombra las más vencidas primero', () => {
    const aviso = construirAvisoTareas(
      [
        tarea('l1', 't1', 'vencida', -2),
        tarea('l2', 't1', 'vencida', -30), // la que más espera
        tarea('l3', 't1', 'vencida', -10),
      ],
      NOMBRES
    );
    expect(aviso.nombradas[0]).toBe('Plateo químico en Barcelona');
  });

  it('nombra unas pocas y resume el resto', () => {
    const muchas = ['l1', 'l2', 'l3', 'l1', 'l2'].map((l, i) =>
      tarea(l, i % 2 === 0 ? 't1' : 't2', 'vencida', -i - 1)
    );
    const aviso = construirAvisoTareas(muchas, NOMBRES);
    expect(aviso.nombradas).toHaveLength(3);
    expect(aviso.cuerpo).toContain('y 2 más');
  });

  it('separa las que cumplieron ciclo de las que nunca se hicieron', () => {
    // Mezcladas, las decenas de "nunca hechas" de una finca que recién carga
    // sus lotes tapaban por completo a las que de verdad toca repetir.
    const aviso = construirAvisoTareas(
      [
        tarea('l1', 't1', 'vencida', -3),
        tarea('l2', 't1', 'sin_historial'),
        tarea('l3', 't1', 'sin_historial'),
      ],
      NOMBRES
    );
    expect(aviso.titulo).toBe('1 tarea vencida');
    expect(aviso.cuerpo).toContain('Plateo químico en Armenia');
    expect(aviso.cuerpo).toContain('2 sin empezar');
    expect(aviso.nombradas).toEqual(['Plateo químico en Armenia']);
  });

  it('no repite el número del título en el cuerpo', () => {
    // Decía "92 tareas sin empezar · 92 sin empezar".
    const aviso = construirAvisoTareas(
      [tarea('l1', 't1', 'sin_historial'), tarea('l2', 't1', 'sin_historial')],
      NOMBRES
    );
    expect(aviso.titulo).toBe('2 tareas sin empezar');
    expect(aviso.cuerpo).not.toContain('2 sin empezar');
    expect(aviso.cuerpo).toBe('Tocá para ver cuáles.');
  });

  it('cuando no hay nada, no hay aviso', () => {
    expect(construirAvisoTareas([], NOMBRES).hayAlgoQueDecir).toBe(false);
    expect(construirAvisoTareas([tarea('l1', 't1', 'aldia', 40)], NOMBRES).hayAlgoQueDecir).toBe(
      false
    );
  });

  it('usa singular cuando es una sola', () => {
    expect(construirAvisoTareas([tarea('l1', 't1', 'proxima', 3)], NOMBRES).titulo).toBe(
      '1 tarea por vencer'
    );
  });

  it('aguanta un lote o un tipo que ya no existe', () => {
    // Si alguien borra un lote entre el cálculo y el aviso, el texto no puede
    // quedar en "undefined".
    const aviso = construirAvisoTareas([tarea('borrado', 'inexistente', 'vencida', -1)], NOMBRES);
    expect(aviso.cuerpo).toBe('Tarea en lote');
  });
});
