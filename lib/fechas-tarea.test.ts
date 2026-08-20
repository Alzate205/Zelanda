import { describe, it, expect } from 'vitest';
import { calcularResumen, estadoDeTareas } from './fechas-tarea';

const DIA = 24 * 60 * 60 * 1000;
const HOY = new Date(Date.UTC(2026, 5, 15));

function haceDias(n: number): Date {
  return new Date(HOY.getTime() - n * DIA);
}

describe('calcularResumen — estado de alertas de tareas', () => {
  it('sin historial cuando nunca se completó', () => {
    const r = calcularResumen(null, 30, HOY);
    expect(r.estado).toBe('sin_historial');
    expect(r.proxima).toBeNull();
    expect(r.dias_para_proxima).toBeNull();
  });

  it('al día cuando falta más que el umbral de alerta', () => {
    // completada hace 10 días, frecuencia 30 → próxima en 20 días (> 7)
    const r = calcularResumen(haceDias(10), 30, HOY);
    expect(r.estado).toBe('aldia');
    expect(r.dias_para_proxima).toBe(20);
  });

  it('próxima cuando faltan 7 días o menos (umbral default)', () => {
    // completada hace 25 días, frecuencia 30 → próxima en 5 días
    const r = calcularResumen(haceDias(25), 30, HOY);
    expect(r.estado).toBe('proxima');
    expect(r.dias_para_proxima).toBe(5);
  });

  it('vencida cuando la próxima fecha ya pasó', () => {
    // completada hace 40 días, frecuencia 30 → venció hace 10 días
    const r = calcularResumen(haceDias(40), 30, HOY);
    expect(r.estado).toBe('vencida');
    expect(r.dias_para_proxima).toBeLessThanOrEqual(0);
  });

  it('respeta un umbral de alerta configurable', () => {
    // próxima en 12 días: con umbral 7 está "al día", con umbral 14 está "próxima"
    const completada = haceDias(18); // 30 − 18 = 12 días para la próxima
    expect(calcularResumen(completada, 30, HOY, 7).estado).toBe('aldia');
    expect(calcularResumen(completada, 30, HOY, 14).estado).toBe('proxima');
  });

  it('el día exacto del umbral cuenta como próxima (≤)', () => {
    const completada = haceDias(23); // próxima en 7 días
    expect(calcularResumen(completada, 30, HOY, 7).estado).toBe('proxima');
  });
});

// === El ciclo de repetición, lote por lote ===
//
// Esto es lo que no se puede comprobar usando la app: habría que esperar meses.
// Acá el reloj se mueve a mano y se verifica el ciclo entero.

describe('estadoDeTareas — el ciclo de cada lote va por su cuenta', () => {
  const PLATEO = { id: 't1', frecuencia_dias_default: 90 };
  const RIEGO = { id: 't2', frecuencia_dias_default: 15 };

  /** Un día concreto a mediodía, para que la hora no sea la que decide nada. */
  const dia = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12, 0, 0));

  const buscar = (lista: ReturnType<typeof estadoDeTareas>, destino: string, tipo: string) =>
    lista.find((e) => e.destino_id === destino && e.tipo_tarea_id === tipo)!;

  it('hacer la tarea hoy la deja al día y la vence al cumplirse la frecuencia', () => {
    const hecha = dia(0);
    const base = {
      destinos: ['loteA'],
      tipos: [PLATEO],
      frecuenciasPropias: [],
      ultimas: [{ destino_id: 'loteA', tipo_tarea_id: 't1', fecha: hecha }],
    };

    // Al día siguiente todavía falta muchísimo.
    expect(buscar(estadoDeTareas({ ...base, ahora: dia(1) }), 'loteA', 't1').estado).toBe('aldia');

    // Una semana antes de los 90 días ya avisa.
    expect(buscar(estadoDeTareas({ ...base, ahora: dia(84) }), 'loteA', 't1').estado).toBe(
      'proxima'
    );

    // El día 90 vence.
    expect(buscar(estadoDeTareas({ ...base, ahora: dia(90) }), 'loteA', 't1').estado).toBe(
      'vencida'
    );

    // Y sigue vencida si nadie la hace.
    expect(buscar(estadoDeTareas({ ...base, ahora: dia(120) }), 'loteA', 't1').estado).toBe(
      'vencida'
    );
  });

  it('platear un lote no toca el reloj de los otros', () => {
    // El caso real de la finca: es tan grande que se hace un lote por día.
    const lista = estadoDeTareas({
      destinos: ['loteA', 'loteB', 'loteC'],
      tipos: [PLATEO],
      frecuenciasPropias: [],
      ultimas: [
        { destino_id: 'loteA', tipo_tarea_id: 't1', fecha: dia(0) }, // recién hecho
        { destino_id: 'loteB', tipo_tarea_id: 't1', fecha: dia(-85) }, // le falta poco
        { destino_id: 'loteC', tipo_tarea_id: 't1', fecha: dia(-100) }, // ya venció
      ],
      ahora: dia(1),
    });

    expect(buscar(lista, 'loteA', 't1').estado).toBe('aldia');
    expect(buscar(lista, 'loteB', 't1').estado).toBe('proxima');
    expect(buscar(lista, 'loteC', 't1').estado).toBe('vencida');
  });

  it('cada tarea del mismo lote lleva su propio reloj', () => {
    // Regar cada 15 días no reinicia el plateo, que va cada 90.
    const lista = estadoDeTareas({
      destinos: ['loteA'],
      tipos: [PLATEO, RIEGO],
      frecuenciasPropias: [],
      ultimas: [
        { destino_id: 'loteA', tipo_tarea_id: 't1', fecha: dia(-100) }, // plateo vencido
        { destino_id: 'loteA', tipo_tarea_id: 't2', fecha: dia(-1) }, // riego recién hecho
      ],
      ahora: dia(0),
    });

    expect(buscar(lista, 'loteA', 't1').estado).toBe('vencida');
    expect(buscar(lista, 'loteA', 't2').estado).toBe('aldia');
  });

  it('volver a hacerla reinicia el ciclo desde la última vez', () => {
    const base = {
      destinos: ['loteA'],
      tipos: [PLATEO],
      frecuenciasPropias: [],
      ahora: dia(100),
    };

    // Con la de hace 100 días, está vencida.
    expect(
      buscar(
        estadoDeTareas({
          ...base,
          ultimas: [{ destino_id: 'loteA', tipo_tarea_id: 't1', fecha: dia(0) }],
        }),
        'loteA',
        't1'
      ).estado
    ).toBe('vencida');

    // Se rehace el día 95: el reloj arranca de nuevo y vuelve a estar al día.
    expect(
      buscar(
        estadoDeTareas({
          ...base,
          ultimas: [{ destino_id: 'loteA', tipo_tarea_id: 't1', fecha: dia(95) }],
        }),
        'loteA',
        't1'
      ).estado
    ).toBe('aldia');
  });

  it('la frecuencia propia del lote le gana a la del tipo de tarea', () => {
    // Un lote bajo que se riega más seguido que el resto.
    const lista = estadoDeTareas({
      destinos: ['loteA', 'loteB'],
      tipos: [RIEGO],
      frecuenciasPropias: [{ destino_id: 'loteA', tipo_tarea_id: 't2', frecuencia_dias: 7 }],
      ultimas: [
        { destino_id: 'loteA', tipo_tarea_id: 't2', fecha: dia(-8) },
        { destino_id: 'loteB', tipo_tarea_id: 't2', fecha: dia(-8) },
      ],
      ahora: dia(0),
    });

    // Mismo día de riego, distinto resultado: A va cada 7, B cada 15.
    expect(buscar(lista, 'loteA', 't2').frecuencia_dias).toBe(7);
    expect(buscar(lista, 'loteA', 't2').estado).toBe('vencida');
    expect(buscar(lista, 'loteB', 't2').frecuencia_dias).toBe(15);
    expect(buscar(lista, 'loteB', 't2').estado).toBe('proxima');
  });

  it('un lote sin historial aparece como nunca hecho, no como al día', () => {
    // Importa: si saliera "al día", un lote que nunca se plateó no avisaría
    // nunca y quedaría olvidado.
    const lista = estadoDeTareas({
      destinos: ['loteNuevo'],
      tipos: [PLATEO],
      frecuenciasPropias: [],
      ultimas: [],
      ahora: dia(0),
    });
    expect(buscar(lista, 'loteNuevo', 't1').estado).toBe('sin_historial');
  });

  it('la anticipación del aviso sale de la configuración, no de un número fijo', () => {
    const base = {
      destinos: ['loteA'],
      tipos: [RIEGO],
      frecuenciasPropias: [],
      ultimas: [{ destino_id: 'loteA', tipo_tarea_id: 't2', fecha: dia(-5) }],
      ahora: dia(0),
    };
    // Faltan 10 días. Con 7 de anticipación todavía está al día.
    expect(buscar(estadoDeTareas({ ...base, diasAlerta: 7 }), 'loteA', 't2').estado).toBe('aldia');
    // Con 14, ya avisa.
    expect(buscar(estadoDeTareas({ ...base, diasAlerta: 14 }), 'loteA', 't2').estado).toBe(
      'proxima'
    );
  });

  it('el día exacto del vencimiento ya cuenta como vencida', () => {
    // El borde importa: si contara como "próxima", el aviso llegaría un día
    // tarde y en una finca eso es un día de trabajo perdido.
    const lista = estadoDeTareas({
      destinos: ['loteA'],
      tipos: [RIEGO],
      frecuenciasPropias: [],
      ultimas: [{ destino_id: 'loteA', tipo_tarea_id: 't2', fecha: dia(0) }],
      ahora: dia(15),
    });
    expect(buscar(lista, 'loteA', 't2').estado).toBe('vencida');
    expect(buscar(lista, 'loteA', 't2').dias_para_proxima).toBeLessThanOrEqual(0);
  });
});

describe('los relojes de cada lote no se fusionan nunca', () => {
  const PLATEO = { id: 't1', frecuencia_dias_default: 90 };
  const dia = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12, 0, 0));
  const buscar = (lista: ReturnType<typeof estadoDeTareas>, destino: string) =>
    lista.find((e) => e.destino_id === destino && e.tipo_tarea_id === 't1')!;

  /**
   * El caso que hay que tener claro para poder planificar la semana: la misma
   * tarea hecha en dos lotes con dos semanas de diferencia vence con esas mismas
   * dos semanas de diferencia. Si los relojes se fusionaran, el jefe planearía
   * los dos para el mismo día y uno de los dos quedaría mal.
   */
  it('Armenia hoy y Calarcá dos semanas después vencen con dos semanas de diferencia', () => {
    const ultimas = [
      { destino_id: 'armenia', tipo_tarea_id: 't1', fecha: dia(0) },
      { destino_id: 'calarca', tipo_tarea_id: 't1', fecha: dia(14) },
    ];
    const base = { destinos: ['armenia', 'calarca'], tipos: [PLATEO], frecuenciasPropias: [] };

    // Las próximas fechas están separadas exactamente por los mismos 14 días.
    const enElDia14 = estadoDeTareas({ ...base, ultimas, ahora: dia(14) });
    const proximaArmenia = buscar(enElDia14, 'armenia').proxima!;
    const proximaCalarca = buscar(enElDia14, 'calarca').proxima!;
    const diferenciaDias =
      (proximaCalarca.getTime() - proximaArmenia.getTime()) / (24 * 60 * 60 * 1000);
    expect(diferenciaDias).toBe(14);

    // El día 90 vence Armenia y Calarcá todavía no.
    const enElDia90 = estadoDeTareas({ ...base, ultimas, ahora: dia(90) });
    expect(buscar(enElDia90, 'armenia').estado).toBe('vencida');
    expect(buscar(enElDia90, 'calarca').estado).not.toBe('vencida');

    // Recién el día 104 vence Calarcá.
    const enElDia104 = estadoDeTareas({ ...base, ultimas, ahora: dia(104) });
    expect(buscar(enElDia104, 'calarca').estado).toBe('vencida');
  });

  it('con muchos lotes, cada uno vence el día que le toca y ninguno arrastra a otro', () => {
    // Un lote por día durante una semana: siete relojes distintos.
    const destinos = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
    const ultimas = destinos.map((d, i) => ({
      destino_id: d,
      tipo_tarea_id: 't1',
      fecha: dia(i),
    }));

    for (let i = 0; i < destinos.length; i++) {
      // El día en que vence el lote i: ese vence, y ninguno posterior.
      const lista = estadoDeTareas({
        destinos,
        tipos: [PLATEO],
        frecuenciasPropias: [],
        ultimas,
        ahora: dia(90 + i),
      });
      expect(buscar(lista, destinos[i]).estado).toBe('vencida');
      for (let j = i + 1; j < destinos.length; j++) {
        expect(buscar(lista, destinos[j]).estado).not.toBe('vencida');
      }
    }
  });

  it('completar una tarea en un lote no mueve la fecha de ningún otro', () => {
    const base = {
      destinos: ['armenia', 'calarca'],
      tipos: [PLATEO],
      frecuenciasPropias: [],
      ahora: dia(50),
    };
    const antes = estadoDeTareas({
      ...base,
      ultimas: [
        { destino_id: 'armenia', tipo_tarea_id: 't1', fecha: dia(0) },
        { destino_id: 'calarca', tipo_tarea_id: 't1', fecha: dia(10) },
      ],
    });
    // Se rehace sólo Armenia.
    const despues = estadoDeTareas({
      ...base,
      ultimas: [
        { destino_id: 'armenia', tipo_tarea_id: 't1', fecha: dia(50) },
        { destino_id: 'calarca', tipo_tarea_id: 't1', fecha: dia(10) },
      ],
    });

    expect(buscar(despues, 'armenia').proxima).not.toEqual(buscar(antes, 'armenia').proxima);
    expect(buscar(despues, 'calarca').proxima).toEqual(buscar(antes, 'calarca').proxima);
  });
});
