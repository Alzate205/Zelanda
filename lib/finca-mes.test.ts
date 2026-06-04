import { describe, it, expect } from 'vitest';
import {
  calcularSaldoPersona,
  periodoMes,
  type DatosPersonaSaldo,
  type TarifaConTipo,
} from './saldos-calculo';
import { totalCompra, resumenCompras, resumenVentas, margenMes } from './comercio';

/**
 * TEST GENERAL — simulación de un mes completo de la Hacienda La Zelanda.
 *
 * Integra TODOS los módulos de dinero en un solo escenario y verifica que el
 * estado financiero de la finca cierre de punta a punta:
 *   nómina (saldos) + compras de insumos + ventas de cosecha → P&L del mes.
 *
 * Se distinguen dos perspectivas, ambas correctas:
 *   - CAJA: margen = ingresos − compras − lo efectivamente PAGADO a personas.
 *   - DEVENGADO: ganancia = ingresos − compras − lo que se DEBÍA pagar (costo real
 *     del trabajo del mes, esté pagado o no).
 * La diferencia entre ambas es exactamente el saldo pendiente con los trabajadores.
 */

const JUNIO = periodoMes(2026, 5);
const dia = (d: number, h = 0) => new Date(Date.UTC(2026, 5, d, h));

const TARIFA_COSECHA: TarifaConTipo = {
  id: BigInt(1),
  tipo_tarea_id: BigInt(1),
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

describe('TEST GENERAL — mes completo de la finca (junio 2026)', () => {
  // ---------------------------------------------------------------------------
  // 1) NÓMINA — 3 perfiles distintos
  // ---------------------------------------------------------------------------
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
    pagos: [{ monto: 1_400_000, tipo: 'SALARIO' }],
  });

  const beto = base({
    persona_id: BigInt(2),
    nombre: 'Beto',
    vinculacion: {
      tipo: 'JORNALERO',
      salario_base: null,
      periodo_pago: null,
      tarifa_jornal: 50_000,
      esquema_pago_destajo: 'ADICIONAL',
    },
    jornales: Array.from({ length: 20 }, (_, i) => ({
      tarifa_aplicada: 50_000,
      fecha: dia(i + 1),
    })),
    cosechas: [{ peso_kg: 500, fecha: dia(25, 14), lote_id: null }], // 500 × 200 = 100.000
    pagos: [{ monto: 700_000, tipo: 'JORNAL' }],
  });

  const carlos = base({
    persona_id: BigInt(3),
    nombre: 'Carlos',
    vinculacion: {
      tipo: 'CONTRATISTA',
      salario_base: null,
      periodo_pago: null,
      tarifa_jornal: null,
      esquema_pago_destajo: null,
    },
    servicios: [{ monto_pactado: 800_000 }],
    pagos: [{ monto: 800_000, tipo: 'SERVICIO' }],
  });

  const tarifas = [TARIFA_COSECHA];
  const saldos = [ana, beto, carlos].map((p) => calcularSaldoPersona(p, tarifas, JUNIO));

  const nominaDevengada = saldos.reduce((a, s) => a + s.devengado, 0);
  const nominaPagada = saldos.reduce((a, s) => a + s.pagado, 0);
  const saldoPendiente = saldos.reduce((a, s) => a + s.saldo, 0);

  // ---------------------------------------------------------------------------
  // 2) COMPRAS de insumos
  // ---------------------------------------------------------------------------
  const compra1 = totalCompra([{ cantidad: 30, costo_unitario: 50_000 }]); // 1.500.000
  const compras = resumenCompras([{ total: compra1, nItems: 1 }]);

  // ---------------------------------------------------------------------------
  // 3) VENTAS de cosecha
  // ---------------------------------------------------------------------------
  const ventas = resumenVentas([{ cantidad_kg: 1_500, precio_total: 6_000_000 }]);

  // ---------------------------------------------------------------------------
  // 4) P&L del mes
  // ---------------------------------------------------------------------------
  const margenCaja = margenMes({
    ingresos: ventas.totalIngreso,
    costoCompras: compras.totalGastado,
    costoPagos: nominaPagada,
  });
  const margenDevengado = margenMes({
    ingresos: ventas.totalIngreso,
    costoCompras: compras.totalGastado,
    costoPagos: nominaDevengada,
  });

  it('cada trabajador devenga y queda con el saldo correcto', () => {
    const [sAna, sBeto, sCarlos] = saldos;
    expect(sAna.devengado).toBe(1_450_000); // 29/30 del salario por 1 falta
    expect(sAna.saldo).toBe(50_000);

    expect(sBeto.devengado).toBe(1_100_000); // 20 jornales + 100.000 destajo
    expect(sBeto.saldo).toBe(400_000);

    expect(sCarlos.devengado).toBe(800_000); // servicio
    expect(sCarlos.saldo).toBe(0);
  });

  it('la nómina de la finca cuadra', () => {
    expect(nominaDevengada).toBe(3_350_000);
    expect(nominaPagada).toBe(2_900_000);
    expect(saldoPendiente).toBe(450_000);
    expect(saldoPendiente).toBe(nominaDevengada - nominaPagada); // coherencia
  });

  it('compras y ventas cuadran', () => {
    expect(compras.totalGastado).toBe(1_500_000);
    expect(ventas.totalIngreso).toBe(6_000_000);
    expect(ventas.precioPromedioKg).toBe(4_000); // 6.000.000 / 1.500 kg
  });

  it('P&L en CAJA: ingresos − compras − pagado = 1.600.000', () => {
    expect(margenCaja.costos).toBe(4_400_000); // 1.5M compras + 2.9M pagado
    expect(margenCaja.margen).toBe(1_600_000);
  });

  it('P&L DEVENGADO: ingresos − compras − nómina devengada = 1.150.000', () => {
    expect(margenDevengado.margen).toBe(1_150_000);
  });

  it('la diferencia entre caja y devengado es exactamente el saldo pendiente', () => {
    expect(margenCaja.margen - margenDevengado.margen).toBe(saldoPendiente);
  });
});
