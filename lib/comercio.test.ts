import { describe, it, expect } from 'vitest';
import { totalCompra, pesoCanastas, resumenVentas, resumenCompras, margenMes } from './comercio';

describe('totalCompra', () => {
  it('suma cantidad × costo_unitario de cada item', () => {
    const total = totalCompra([
      { cantidad: 10, costo_unitario: 5_000 }, // 50.000
      { cantidad: 2, costo_unitario: 8_000 }, // 16.000
    ]);
    expect(total).toBe(66_000);
  });

  it('soporta cantidades decimales (litros/kg) redondeando a 2 decimales', () => {
    expect(totalCompra([{ cantidad: 2.5, costo_unitario: 12_000 }])).toBe(30_000);
    expect(totalCompra([{ cantidad: 1.333, costo_unitario: 300 }])).toBe(399.9);
  });

  it('sin items da 0', () => {
    expect(totalCompra([])).toBe(0);
  });
});

describe('pesoCanastas', () => {
  it('peso = canastas × capacidad', () => {
    expect(pesoCanastas(20, 23)).toBe(460);
    expect(pesoCanastas(15, 22.5)).toBe(337.5);
  });

  it('valores no positivos dan 0', () => {
    expect(pesoCanastas(0, 23)).toBe(0);
    expect(pesoCanastas(10, 0)).toBe(0);
  });
});

describe('resumenVentas', () => {
  it('calcula kg, ingreso, ticket promedio y precio promedio por kg', () => {
    const r = resumenVentas([
      { cantidad_kg: 1_000, precio_total: 4_000_000 },
      { cantidad_kg: 1_000, precio_total: 4_500_000 },
    ]);
    expect(r.totalKg).toBe(2_000);
    expect(r.totalIngreso).toBe(8_500_000);
    expect(r.nVentas).toBe(2);
    expect(r.ticketPromedio).toBe(4_250_000);
    expect(r.precioPromedioKg).toBe(4_250); // 8.500.000 / 2.000
  });

  it('precio_total nulo cuenta como 0 ingreso', () => {
    const r = resumenVentas([{ cantidad_kg: 500, precio_total: null }]);
    expect(r.totalIngreso).toBe(0);
    expect(r.totalKg).toBe(500);
  });

  it('sin ventas no divide por cero', () => {
    const r = resumenVentas([]);
    expect(r.ticketPromedio).toBe(0);
    expect(r.precioPromedioKg).toBe(0);
  });
});

describe('resumenCompras', () => {
  it('suma totales, items y calcula ticket promedio', () => {
    const r = resumenCompras([
      { total: 1_500_000, nItems: 3 },
      { total: 800_000, nItems: 1 },
    ]);
    expect(r.totalGastado).toBe(2_300_000);
    expect(r.itemsTotales).toBe(4);
    expect(r.nCompras).toBe(2);
    expect(r.ticketPromedio).toBe(1_150_000);
  });

  it('sin compras no divide por cero', () => {
    expect(resumenCompras([]).ticketPromedio).toBe(0);
  });
});

describe('margenMes', () => {
  it('margen = ingresos − (compras + pagos)', () => {
    const r = margenMes({ ingresos: 8_500_000, costoCompras: 2_300_000, costoPagos: 4_900_000 });
    expect(r.costos).toBe(7_200_000);
    expect(r.margen).toBe(1_300_000);
    expect(r.porcentaje).toBeCloseTo(15.29, 1);
  });

  it('margen negativo cuando los costos superan los ingresos', () => {
    const r = margenMes({ ingresos: 1_000_000, costoCompras: 800_000, costoPagos: 500_000 });
    expect(r.margen).toBe(-300_000);
  });

  it('sin ingresos el porcentaje es 0 (no divide por cero)', () => {
    expect(margenMes({ ingresos: 0, costoCompras: 100_000, costoPagos: 0 }).porcentaje).toBe(0);
  });
});

// ===========================================================================
// Simulación de un MES comercial completo: items → total compra → gasto →
// margen contra ingresos por ventas.
// ===========================================================================

describe('Simulación de un mes comercial', () => {
  // Compras: 2 compras armadas desde sus items
  const totalCompra1 = totalCompra([{ cantidad: 30, costo_unitario: 50_000 }]); // 1.500.000
  const totalCompra2 = totalCompra([
    { cantidad: 5, costo_unitario: 100_000 }, // 500.000
    { cantidad: 3, costo_unitario: 100_000 }, // 300.000
  ]); // 800.000

  const compras = resumenCompras([
    { total: totalCompra1, nItems: 1 },
    { total: totalCompra2, nItems: 2 },
  ]);

  // Ventas del mes
  const ventas = resumenVentas([
    { cantidad_kg: 1_000, precio_total: 4_000_000 },
    { cantidad_kg: 1_000, precio_total: 4_500_000 },
  ]);

  // Pagos a personas (lo que pagó la nómina ese mes)
  const costoPagos = 4_900_000;

  const margen = margenMes({
    ingresos: ventas.totalIngreso,
    costoCompras: compras.totalGastado,
    costoPagos,
  });

  it('las compras suman lo esperado', () => {
    expect(totalCompra1).toBe(1_500_000);
    expect(totalCompra2).toBe(800_000);
    expect(compras.totalGastado).toBe(2_300_000);
  });

  it('las ventas suman lo esperado', () => {
    expect(ventas.totalIngreso).toBe(8_500_000);
    expect(ventas.totalKg).toBe(2_000);
    expect(ventas.precioPromedioKg).toBe(4_250);
  });

  it('el margen del mes cierra: 8.5M − (2.3M compras + 4.9M nómina) = 1.3M', () => {
    expect(margen.costos).toBe(7_200_000);
    expect(margen.margen).toBe(1_300_000);
    expect(margen.porcentaje).toBeCloseTo(15.29, 1);
  });
});
