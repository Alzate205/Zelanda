/**
 * Núcleo PURO del cálculo comercial (ventas, compras, márgenes), sin Prisma.
 * Centraliza y permite testear el dinero que se muestra en los dashboards.
 *
 * Convenciones de la BD:
 *  - compras_items.subtotal = cantidad × costo_unitario (columna generada).
 *  - compras.total = SUM(subtotal) de sus items (trigger).
 *  - cosechas.peso_kg (método canasta) = canastas × capacidad.
 */

const redondear2 = (x: number): number => Math.round(x * 100) / 100;

/** Total de una compra = suma de cantidad × costo_unitario de cada item. */
export function totalCompra(items: { cantidad: number; costo_unitario: number }[]): number {
  return redondear2(items.reduce((acc, it) => acc + it.cantidad * it.costo_unitario, 0));
}

/** Peso resultante del método CANASTA: canastas × capacidad por canasta. */
export function pesoCanastas(canastas: number, capacidadKg: number): number {
  if (canastas <= 0 || capacidadKg <= 0) return 0;
  return redondear2(canastas * capacidadKg);
}

export type ResumenVentas = {
  totalKg: number;
  totalIngreso: number;
  nVentas: number;
  ticketPromedio: number;
  precioPromedioKg: number;
};

export function resumenVentas(
  ventas: { cantidad_kg: number; precio_total: number | null }[]
): ResumenVentas {
  const totalKg = ventas.reduce((acc, v) => acc + v.cantidad_kg, 0);
  const totalIngreso = ventas.reduce((acc, v) => acc + (v.precio_total ?? 0), 0);
  const nVentas = ventas.length;
  return {
    totalKg,
    totalIngreso,
    nVentas,
    ticketPromedio: nVentas > 0 ? totalIngreso / nVentas : 0,
    precioPromedioKg: totalKg > 0 ? totalIngreso / totalKg : 0,
  };
}

export type ResumenCompras = {
  totalGastado: number;
  nCompras: number;
  itemsTotales: number;
  ticketPromedio: number;
};

export function resumenCompras(compras: { total: number; nItems: number }[]): ResumenCompras {
  const totalGastado = compras.reduce((acc, c) => acc + c.total, 0);
  const itemsTotales = compras.reduce((acc, c) => acc + c.nItems, 0);
  const nCompras = compras.length;
  return {
    totalGastado,
    nCompras,
    itemsTotales,
    ticketPromedio: nCompras > 0 ? totalGastado / nCompras : 0,
  };
}

export type MargenMes = { costos: number; margen: number; porcentaje: number };

/** Margen del mes = ingresos − (compras + pagos a personas). */
export function margenMes(p: {
  ingresos: number;
  costoCompras: number;
  costoPagos: number;
}): MargenMes {
  const costos = p.costoCompras + p.costoPagos;
  const margen = p.ingresos - costos;
  return {
    costos,
    margen,
    porcentaje: p.ingresos > 0 ? (margen / p.ingresos) * 100 : 0,
  };
}
