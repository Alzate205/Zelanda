import { describe, it, expect } from 'vitest';
import {
  calcularSaldoPersona,
  periodoMes,
  type DatosPersonaSaldo,
  type TarifaConTipo,
} from './saldos-calculo';

/**
 * Simulación de un MES COMPLETO de trabajo en la finca (junio 2026, 30 días)
 * con 5 personas de perfiles distintos. Verifica de punta a punta que el
 * devengado, lo pagado y el saldo cierren correctamente, incluyendo el total
 * de la finca.
 */

const JUNIO = periodoMes(2026, 5);
const dia = (d: number, h = 0) => new Date(Date.UTC(2026, 5, d, h));

// Tarifa de cosecha por kg, vigente todo 2026
const TARIFA_COSECHA: TarifaConTipo = {
  id: BigInt(99),
  tipo_tarea_id: BigInt(99),
  esquema_pago: 'POR_KG',
  monto: 200,
  vigente_desde: new Date(Date.UTC(2026, 0, 1)),
  vigente_hasta: null,
  lote_id: null,
  tipo_tarea_nombre: 'Cosecha',
};

function base(over: Partial<DatosPersonaSaldo>): DatosPersonaSaldo {
  return {
    persona_id: BigInt(1),
    nombre: 'X',
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

/** Genera N jornales en días consecutivos, todos con la misma tarifa. */
function jornalesDias(cantidad: number, tarifa: number) {
  return Array.from({ length: cantidad }, (_, i) => ({
    tarifa_aplicada: tarifa,
    fecha: dia(i + 1),
  }));
}

describe('Simulación de un mes de trabajo (junio 2026)', () => {
  // --- Ana: FIJA mensual, con 1 falta y pagos parciales ---
  const ana = base({
    persona_id: BigInt(1),
    nombre: 'Ana',
    vinculacion: {
      tipo: 'FIJO',
      salario_base: 1_500_000,
      periodo_pago: 'MENSUAL',
      tarifa_jornal: null,
      esquema_pago_destajo: null,
    },
    ausencias_descontables: 1,
    pagos: [
      { monto: 500_000, tipo: 'ADELANTO' },
      { monto: 900_000, tipo: 'SALARIO' },
    ],
  });

  // --- Beto: JORNALERO, 22 jornales, pago parcial ---
  const beto = base({
    persona_id: BigInt(2),
    nombre: 'Beto',
    vinculacion: {
      tipo: 'JORNALERO',
      salario_base: null,
      periodo_pago: null,
      tarifa_jornal: 50_000,
      esquema_pago_destajo: null,
    },
    jornales: jornalesDias(22, 50_000),
    pagos: [{ monto: 1_000_000, tipo: 'JORNAL' }],
  });

  // --- Carlos: JORNALERO con destajo ADICIONAL (cosecha), pago parcial ---
  const carlos = base({
    persona_id: BigInt(3),
    nombre: 'Carlos',
    vinculacion: {
      tipo: 'JORNALERO',
      salario_base: null,
      periodo_pago: null,
      tarifa_jornal: 50_000,
      esquema_pago_destajo: 'ADICIONAL',
    },
    jornales: jornalesDias(20, 50_000),
    cosechas: [{ peso_kg: 500, fecha: dia(25, 14), lote_id: null }], // 500 × 200 = 100.000
    pagos: [{ monto: 600_000, tipo: 'JORNAL' }],
  });

  // --- Diego: CONTRATISTA, un servicio, pago parcial ---
  const diego = base({
    persona_id: BigInt(4),
    nombre: 'Diego',
    vinculacion: {
      tipo: 'CONTRATISTA',
      salario_base: null,
      periodo_pago: null,
      tarifa_jornal: null,
      esquema_pago_destajo: null,
    },
    servicios: [{ monto_pactado: 800_000 }],
    pagos: [{ monto: 400_000, tipo: 'SERVICIO' }],
  });

  // --- Elena: FIJA mensual con destajo REEMPLAZA_DIA (2 días de cosecha) ---
  const elena = base({
    persona_id: BigInt(5),
    nombre: 'Elena',
    vinculacion: {
      tipo: 'FIJO',
      salario_base: 1_500_000,
      periodo_pago: 'MENSUAL',
      tarifa_jornal: null,
      esquema_pago_destajo: 'REEMPLAZA_DIA',
    },
    cosechas: [
      { peso_kg: 300, fecha: dia(10, 14), lote_id: null }, // 60.000
      { peso_kg: 200, fecha: dia(12, 14), lote_id: null }, // 40.000
    ],
    pagos: [{ monto: 1_500_000, tipo: 'SALARIO' }],
  });

  const tarifas = [TARIFA_COSECHA];
  const rAna = calcularSaldoPersona(ana, tarifas, JUNIO);
  const rBeto = calcularSaldoPersona(beto, tarifas, JUNIO);
  const rCarlos = calcularSaldoPersona(carlos, tarifas, JUNIO);
  const rDiego = calcularSaldoPersona(diego, tarifas, JUNIO);
  const rElena = calcularSaldoPersona(elena, tarifas, JUNIO);

  it('Ana (FIJA con 1 falta): devenga 29/30 del salario', () => {
    expect(rAna.detalles.dias_efectivos).toBe(29);
    expect(rAna.devengado).toBe(1_450_000); // 50.000 × 29
    expect(rAna.pagado).toBe(1_400_000);
    expect(rAna.saldo).toBe(50_000);
  });

  it('Beto (JORNALERO): devenga la suma de 22 jornales', () => {
    expect(rBeto.detalles.jornales_count).toBe(22);
    expect(rBeto.devengado).toBe(1_100_000);
    expect(rBeto.saldo).toBe(100_000);
  });

  it('Carlos (JORNALERO + destajo ADICIONAL): jornales + cosecha', () => {
    expect(rCarlos.detalles.jornales_total).toBe(1_000_000);
    expect(rCarlos.detalles.extras_destajo).toBe(100_000); // 500 kg × 200
    expect(rCarlos.devengado).toBe(1_100_000);
    expect(rCarlos.saldo).toBe(500_000);
  });

  it('Diego (CONTRATISTA): devenga el servicio pactado', () => {
    expect(rDiego.devengado).toBe(800_000);
    expect(rDiego.saldo).toBe(400_000);
  });

  it('Elena (FIJA + REEMPLAZA_DIA): los 2 días de destajo reemplazan 2 días de salario', () => {
    expect(rElena.detalles.dias_con_destajo).toBe(2);
    expect(rElena.detalles.extras_destajo).toBe(100_000);
    // 1.500.000 − (50.000 × 2) + 100.000 = 1.500.000
    expect(rElena.devengado).toBe(1_500_000);
    expect(rElena.saldo).toBe(0);
  });

  it('Totales de la finca cuadran (devengado, pagado, saldo)', () => {
    const todos = [rAna, rBeto, rCarlos, rDiego, rElena];
    const devengado = todos.reduce((a, r) => a + r.devengado, 0);
    const pagado = todos.reduce((a, r) => a + r.pagado, 0);
    const saldo = todos.reduce((a, r) => a + r.saldo, 0);

    expect(devengado).toBe(5_950_000);
    expect(pagado).toBe(4_900_000);
    expect(saldo).toBe(1_050_000);
    expect(saldo).toBe(devengado - pagado); // coherencia interna
  });
});
