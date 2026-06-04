import { describe, it, expect } from 'vitest';
import {
  calcularSaldoPersona,
  tarifaVigente,
  diasEstandar,
  diasInclusivos,
  periodoMes,
  type DatosPersonaSaldo,
  type TarifaConTipo,
} from './saldos-calculo';

// ---------------------------------------------------------------------------
// Helpers para construir escenarios
// ---------------------------------------------------------------------------

/** Junio 2026 tiene 30 días: períodos limpios para sueldos MENSUAL (diasEstandar 30). */
const JUNIO = periodoMes(2026, 5);
/** Mayo 2026 tiene 31 días: para documentar el comportamiento de meses de 31. */
const MAYO = periodoMes(2026, 4);

function persona(over: Partial<DatosPersonaSaldo> = {}): DatosPersonaSaldo {
  return {
    persona_id: BigInt(1),
    nombre: 'Trabajador Test',
    vinculacion: null,
    jornales: [],
    ausencias_descontables: 0,
    servicios: [],
    pagos: [],
    registros_avance: [],
    cosechas: [],
    ...over,
  };
}

function tarifa(over: Partial<TarifaConTipo> = {}): TarifaConTipo {
  return {
    id: BigInt(1),
    tipo_tarea_id: BigInt(10),
    esquema_pago: 'POR_ARBOL',
    monto: 500,
    vigente_desde: new Date(Date.UTC(2026, 0, 1)),
    vigente_hasta: null,
    lote_id: null,
    tipo_tarea_nombre: 'Plateo químico',
    ...over,
  };
}

const dia = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m, d, h));

// ===========================================================================
// FIJO — sueldo prorrateado por días efectivos
// ===========================================================================

describe('FIJO — cálculo de salario', () => {
  it('mes completo sin ausencias paga el salario exacto (mes de 30 días)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
      }),
      [],
      JUNIO
    );
    expect(r.detalles.salario_diario).toBe(50_000); // 1.500.000 / 30
    expect(r.detalles.dias_efectivos).toBe(30);
    expect(r.devengado).toBe(1_500_000);
    expect(r.saldo).toBe(1_500_000); // sin pagos
  });

  it('descuenta los días de ausencia descontable del devengado', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
        ausencias_descontables: 2,
      }),
      [],
      JUNIO
    );
    // 28 días efectivos × 50.000 = 1.400.000
    expect(r.detalles.dias_efectivos).toBe(28);
    expect(r.devengado).toBe(1_400_000);
  });

  it('sin ausencias descontables NO descuenta nada (solo cuentan las descontables)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
        ausencias_descontables: 0,
      }),
      [],
      JUNIO
    );
    expect(r.devengado).toBe(1_500_000);
  });

  it('QUINCENAL: el salario_base es por quincena, un mes completo paga 2 quincenas', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 750_000,
          periodo_pago: 'QUINCENAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
      }),
      [],
      JUNIO
    );
    expect(r.detalles.salario_diario).toBe(50_000); // 750.000 / 15
    expect(r.devengado).toBe(1_500_000); // 50.000 × 30 días
  });

  it('mes de 31 días paga 31/30 del salario (comportamiento actual a confirmar)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
      }),
      [],
      MAYO
    );
    expect(r.detalles.dias_periodo).toBe(31);
    expect(r.devengado).toBe(1_550_000); // 50.000 × 31
  });
});

// ===========================================================================
// JORNALERO — suma de jornales registrados
// ===========================================================================

describe('JORNALERO — suma de jornales', () => {
  it('devenga la suma de los jornales del período', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: 50_000,
          esquema_pago_destajo: null,
        },
        jornales: [
          { tarifa_aplicada: 50_000, fecha: dia(2026, 5, 2) },
          { tarifa_aplicada: 50_000, fecha: dia(2026, 5, 3) },
          { tarifa_aplicada: 60_000, fecha: dia(2026, 5, 4) }, // tarifa distinta (snapshot)
        ],
      }),
      [],
      JUNIO
    );
    expect(r.detalles.jornales_count).toBe(3);
    expect(r.devengado).toBe(160_000);
  });

  it('un JORNALERO no usa salario_base aunque venga seteado', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: 9_999_999, // no debe influir
          periodo_pago: 'MENSUAL',
          tarifa_jornal: 50_000,
          esquema_pago_destajo: null,
        },
        jornales: [{ tarifa_aplicada: 50_000, fecha: dia(2026, 5, 2) }],
      }),
      [],
      JUNIO
    );
    expect(r.devengado).toBe(50_000);
  });
});

// ===========================================================================
// CONTRATISTA — monto pactado de servicios
// ===========================================================================

describe('CONTRATISTA — servicios pactados', () => {
  it('devenga la suma del monto pactado de los servicios', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'CONTRATISTA',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
        servicios: [{ monto_pactado: 500_000 }, { monto_pactado: 300_000 }],
      }),
      [],
      JUNIO
    );
    expect(r.detalles.servicios_count).toBe(2);
    expect(r.devengado).toBe(800_000);
  });

  it('al CONTRATISTA no se le aplica destajo (aunque haya registros)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'CONTRATISTA',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
        servicios: [{ monto_pactado: 500_000 }],
        registros_avance: [
          {
            cantidad_arboles: 100,
            fecha_registro: dia(2026, 5, 5, 14),
            tipo_tarea_id: BigInt(10),
            lote_id: null,
            tipo_tarea_nombre: 'Plateo químico',
          },
        ],
      }),
      [tarifa({ monto: 500 })],
      JUNIO
    );
    expect(r.devengado).toBe(500_000); // solo el servicio
  });
});

// ===========================================================================
// Destajo — esquema_pago_destajo
// ===========================================================================

describe('Destajo — esquemas de pago', () => {
  const registro100Arboles = {
    cantidad_arboles: 100,
    fecha_registro: dia(2026, 5, 5, 14),
    tipo_tarea_id: BigInt(10),
    lote_id: null,
    tipo_tarea_nombre: 'Plateo químico',
  };

  it('NUNCA: calcula el destajo en el detalle pero NO lo suma al devengado', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: 'NUNCA',
        },
        registros_avance: [registro100Arboles],
      }),
      [tarifa({ monto: 500 })],
      JUNIO
    );
    expect(r.detalles.extras_destajo).toBe(50_000); // 100 × 500
    expect(r.devengado).toBe(1_500_000); // pero no se suma
  });

  it('ADICIONAL: suma el destajo además del salario base', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: 'ADICIONAL',
        },
        registros_avance: [registro100Arboles],
      }),
      [tarifa({ monto: 500 })],
      JUNIO
    );
    expect(r.devengado).toBe(1_550_000); // 1.500.000 + 50.000
  });

  it('SOLO_DESTAJO: el devengado es únicamente el destajo (ignora salario y jornales)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: 50_000,
          esquema_pago_destajo: 'SOLO_DESTAJO',
        },
        jornales: [{ tarifa_aplicada: 50_000, fecha: dia(2026, 5, 5) }],
        registros_avance: [registro100Arboles],
      }),
      [tarifa({ monto: 500 })],
      JUNIO
    );
    expect(r.devengado).toBe(50_000); // solo el destajo, no los jornales
  });

  it('REEMPLAZA_DIA (FIJO): descuenta el salario diario por cada día con destajo', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: 'REEMPLAZA_DIA',
        },
        registros_avance: [{ ...registro100Arboles, cantidad_arboles: 160 }], // 160 × 500 = 80.000
      }),
      [tarifa({ monto: 500 })],
      JUNIO
    );
    // 1.500.000 − 50.000 (1 día) + 80.000 = 1.530.000
    expect(r.detalles.dias_con_destajo).toBe(1);
    expect(r.devengado).toBe(1_530_000);
  });

  it('REEMPLAZA_DIA (JORNALERO): descuenta la tarifa del jornal del día con destajo', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: 50_000,
          esquema_pago_destajo: 'REEMPLAZA_DIA',
        },
        jornales: [
          { tarifa_aplicada: 50_000, fecha: dia(2026, 5, 5) }, // mismo día que el destajo
          { tarifa_aplicada: 50_000, fecha: dia(2026, 5, 6) },
        ],
        registros_avance: [{ ...registro100Arboles, fecha_registro: dia(2026, 5, 5, 14) }], // 100 × 500 = 70.000? -> 50.000
      }),
      [tarifa({ monto: 700 })], // 100 × 700 = 70.000
      JUNIO
    );
    // jornales_total = 100.000; descuento del día con destajo (5 jun) = 50.000; + destajo 70.000
    // 100.000 − 50.000 + 70.000 = 120.000
    expect(r.detalles.jornales_total).toBe(100_000);
    expect(r.devengado).toBe(120_000);
  });

  it('destajo por kg cosechado usa la tarifa POR_KG', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: 50_000,
          esquema_pago_destajo: 'SOLO_DESTAJO',
        },
        cosechas: [{ peso_kg: 200, fecha: dia(2026, 5, 8, 14), lote_id: BigInt(3) }],
      }),
      [
        tarifa({
          esquema_pago: 'POR_KG',
          monto: 300,
          tipo_tarea_nombre: 'Cosecha',
          lote_id: null,
        }),
      ],
      JUNIO
    );
    expect(r.devengado).toBe(60_000); // 200 kg × 300
  });
});

// ===========================================================================
// Pagos y saldo
// ===========================================================================

describe('Pagos y saldo', () => {
  it('saldo = devengado − pagado', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'FIJO',
          salario_base: 1_500_000,
          periodo_pago: 'MENSUAL',
          tarifa_jornal: null,
          esquema_pago_destajo: null,
        },
        pagos: [
          { monto: 1_000_000, tipo: 'SALARIO' },
          { monto: 200_000, tipo: 'ADELANTO' },
        ],
      }),
      [],
      JUNIO
    );
    expect(r.pagado).toBe(1_200_000);
    expect(r.saldo).toBe(300_000); // 1.500.000 − 1.200.000
    expect(r.detalles.adelantos_total).toBe(200_000);
  });

  it('si se pagó de más, el saldo queda negativo (sobrepagado)', () => {
    const r = calcularSaldoPersona(
      persona({
        vinculacion: {
          tipo: 'JORNALERO',
          salario_base: null,
          periodo_pago: null,
          tarifa_jornal: 50_000,
          esquema_pago_destajo: null,
        },
        jornales: [{ tarifa_aplicada: 50_000, fecha: dia(2026, 5, 2) }],
        pagos: [{ monto: 80_000, tipo: 'JORNAL' }],
      }),
      [],
      JUNIO
    );
    expect(r.devengado).toBe(50_000);
    expect(r.saldo).toBe(-30_000);
  });
});

// ===========================================================================
// tarifaVigente — selección de tarifa
// ===========================================================================

describe('tarifaVigente', () => {
  it('prefiere la tarifa específica del lote sobre la global', () => {
    const tarifas = [
      tarifa({ id: BigInt(1), monto: 500, lote_id: null }),
      tarifa({ id: BigInt(2), monto: 800, lote_id: BigInt(3) }),
    ];
    const t = tarifaVigente(
      tarifas,
      BigInt(10),
      dia(2026, 5, 5),
      ['POR_ARBOL', 'POR_HECTAREA'],
      BigInt(3)
    );
    expect(t?.id).toBe(BigInt(2));
    expect(t?.monto).toBe(800);
  });

  it('cae a la tarifa global si no hay específica para el lote', () => {
    const tarifas = [tarifa({ id: BigInt(1), monto: 500, lote_id: null })];
    const t = tarifaVigente(
      tarifas,
      BigInt(10),
      dia(2026, 5, 5),
      ['POR_ARBOL', 'POR_HECTAREA'],
      BigInt(7)
    );
    expect(t?.id).toBe(BigInt(1));
  });

  it('ignora tarifas cuya vigencia no cubre la fecha', () => {
    const tarifas = [
      tarifa({
        id: BigInt(1),
        monto: 500,
        vigente_desde: dia(2026, 0, 1),
        vigente_hasta: dia(2026, 3, 30), // hasta abril
      }),
    ];
    const t = tarifaVigente(tarifas, BigInt(10), dia(2026, 5, 5), ['POR_ARBOL'], null);
    expect(t).toBeNull();
  });

  it('en empate, gana la vigencia más reciente', () => {
    const tarifas = [
      tarifa({ id: BigInt(1), monto: 500, vigente_desde: dia(2026, 0, 1) }),
      tarifa({ id: BigInt(2), monto: 650, vigente_desde: dia(2026, 4, 1) }),
    ];
    const t = tarifaVigente(tarifas, BigInt(10), dia(2026, 5, 5), ['POR_ARBOL'], null);
    expect(t?.id).toBe(BigInt(2));
  });
});

// ===========================================================================
// Helpers de fechas
// ===========================================================================

describe('helpers de período', () => {
  it('diasEstandar según período de pago', () => {
    expect(diasEstandar('MENSUAL')).toBe(30);
    expect(diasEstandar('QUINCENAL')).toBe(15);
    expect(diasEstandar('SEMANAL')).toBe(7);
    expect(diasEstandar(null)).toBe(30);
  });

  it('diasInclusivos cuenta ambos extremos', () => {
    expect(diasInclusivos(JUNIO.desde, JUNIO.hasta)).toBe(30);
    expect(diasInclusivos(MAYO.desde, MAYO.hasta)).toBe(31);
  });

  it('periodoMes arma el rango correcto del mes', () => {
    const p = periodoMes(2026, 5); // junio
    expect(p.desde.getUTCMonth()).toBe(5);
    expect(p.desde.getUTCDate()).toBe(1);
    expect(p.hasta.getUTCMonth()).toBe(5);
    expect(p.hasta.getUTCDate()).toBe(30);
  });
});
