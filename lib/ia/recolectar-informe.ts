import { prisma } from '@/lib/prisma';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { obtenerClimaFinca } from '@/lib/jefe/clima';
import { diagnosticar } from '@/lib/diagnostico';
import { faseDelMes } from '@/lib/fenologia';
import { hoyEnBogota, mesBogota, periodoMesBogota } from '@/lib/fecha';
import { calcularSaldosPeriodo } from '@/lib/saldos';
import type { DatosInforme } from './informe-finca';

/**
 * Recolecta el estado de la finca para el informe copiable.
 *
 * Reusa lo que ya calcula el centro de control (snapshot, diagnóstico, clima,
 * fenología) y le suma el histórico que esa pantalla no necesita: cosecha por
 * lote y por año, y el movimiento financiero de los últimos meses.
 *
 * Toda la redacción vive en `informe-finca.ts`; acá solo se consulta.
 */

/** Meses de histórico financiero. Seis cubre una temporada sin inflar el texto. */
const MESES_FINANZAS = 6;

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

function isoDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** El clima es de un tercero: si falla, el informe sale igual sin esa sección. */
async function climaOpcional() {
  try {
    return await obtenerClimaFinca();
  } catch {
    return null;
  }
}

export async function recolectarDatosFinca(): Promise<DatosInforme> {
  const hoy = hoyEnBogota();
  const anioActual = hoy.getFullYear();
  const inicioAnio = new Date(Date.UTC(anioActual, 0, 1));

  const [snapshot, clima] = await Promise.all([construirSnapshotJefe(), climaOpcional()]);

  const [lotesRaw, cosechaAnioPorLote, cosechaPorAnio, inventarioBajo, hectareasRow] =
    await Promise.all([
      prisma.lotes.findMany({
        where: { deleted_at: null },
        select: { id: true, nombre: true, hectareas: true, total_arboles: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.cosechas.groupBy({
        by: ['lote_id'],
        where: { fecha: { gte: inicioAnio } },
        _sum: { peso_kg: true },
      }),
      prisma.$queryRaw<{ anio: number; kg: string }[]>`
        SELECT EXTRACT(YEAR FROM fecha)::int AS anio, SUM(peso_kg)::text AS kg
        FROM cosechas
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<
        { nombre: string; unidad: string; stock_disponible: string; stock_minimo: string }[]
      >`
        SELECT nombre, unidad, stock_disponible::text, stock_minimo::text
        FROM v_insumos_stock
        WHERE stock_disponible <= stock_minimo
        ORDER BY nombre ASC
      `,
      prisma.lotes.aggregate({
        where: { deleted_at: null },
        _sum: { hectareas: true },
      }),
    ]);

  const kgPorLote = new Map(
    cosechaAnioPorLote.map((c) => [String(c.lote_id), Number(c._sum.peso_kg ?? 0)])
  );
  const prediccionPorLote = new Map(
    (snapshot.prediccion_por_lote ?? []).map((p) => [p.lote_id, p.kg_esperado])
  );

  const lotes = lotesRaw.map((l) => ({
    nombre: l.nombre,
    hectareas: l.hectareas === null ? null : Number(l.hectareas),
    total_arboles: l.total_arboles,
    cosecha_anio_kg: kgPorLote.get(String(l.id)) ?? 0,
    prediccion_kg: prediccionPorLote.get(String(l.id)) ?? null,
  }));

  // ── Finanzas: los últimos MESES_FINANZAS meses, incluido el actual ──────
  const { anio: anioMes, mes: mesActual } = mesBogota();
  const periodos: Array<{ clave: string; desde: Date; hasta: Date }> = [];
  for (let i = MESES_FINANZAS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anioMes, mesActual - i, 1));
    const { desde, hasta } = periodoMesBogota(d.getUTCFullYear(), d.getUTCMonth());
    periodos.push({ clave: aClaveMes(d.getUTCFullYear(), d.getUTCMonth()), desde, hasta });
  }
  const desdeFinanzas = periodos[0].desde;
  const hastaFinanzas = periodos[periodos.length - 1].hasta;

  const [ventas, compras, pagosPeriodo, ventasPorCliente, comprasPorProveedor] = await Promise.all([
    prisma.salidas_cosecha.findMany({
      where: { tipo: 'VENTA', fecha: { gte: desdeFinanzas, lte: hastaFinanzas } },
      select: { fecha: true, precio_total: true },
    }),
    prisma.compras.findMany({
      where: { borrado_en: null, fecha: { gte: desdeFinanzas, lte: hastaFinanzas } },
      select: { fecha: true, total: true },
    }),
    prisma.pagos.findMany({
      where: { borrado_en: null, fecha: { gte: desdeFinanzas, lte: hastaFinanzas } },
      select: { fecha: true, monto: true },
    }),
    prisma.$queryRaw<{ cliente: string; kg: string; ingresos: string }[]>`
        SELECT COALESCE(c.nombre, s.cliente_detalle, 'Sin identificar') AS cliente,
               SUM(s.cantidad_kg)::text AS kg,
               COALESCE(SUM(s.precio_total), 0)::text AS ingresos
        FROM salidas_cosecha s
        LEFT JOIN clientes c ON c.id = s.cliente_id
        WHERE s.tipo = 'VENTA'
          AND s.fecha >= ${desdeFinanzas}
          AND s.fecha <= ${hastaFinanzas}
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 15
      `,
    prisma.$queryRaw<{ proveedor: string; total: string }[]>`
        SELECT COALESCE(p.nombre, co.proveedor_detalle, 'Sin identificar') AS proveedor,
               SUM(co.total)::text AS total
        FROM compras co
        LEFT JOIN proveedores p ON p.id = co.proveedor_id
        WHERE co.borrado_en IS NULL
          AND co.fecha >= ${desdeFinanzas}
          AND co.fecha <= ${hastaFinanzas}
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 15
      `,
  ]);

  const meses = periodos.map((p) => {
    const enRango = (f: Date) => f >= p.desde && f <= p.hasta;
    const ingresos = ventas
      .filter((v) => enRango(v.fecha))
      .reduce((acc, v) => acc + Number(v.precio_total ?? 0), 0);
    const costoCompras = compras
      .filter((c) => enRango(c.fecha))
      .reduce((acc, c) => acc + Number(c.total), 0);
    const costoPagos = pagosPeriodo
      .filter((x) => enRango(x.fecha))
      .reduce((acc, x) => acc + Number(x.monto), 0);
    return { mes: p.clave, ingresos, costos: costoCompras + costoPagos };
  });

  // Nómina del mes en curso. Los nombres se pasan al redactor, que los anonimiza.
  const saldos = await calcularSaldosPeriodo(periodoMesBogota(anioMes, mesActual));
  const conMovimiento = saldos.filter((s) => s.devengado > 0 || s.pagado > 0);

  return {
    fecha_corte: isoDia(hoy),
    alertas: diagnosticar(snapshot, clima, hoy).map((a) => ({
      id: a.id,
      severidad: a.severidad,
      titulo: a.titulo,
      evidencia: a.evidencia,
      accion: a.accion,
    })),
    contadores: {
      total_lotes: snapshot.contadores.total_lotes,
      total_arboles: snapshot.contadores.total_arboles,
      hectareas: Number(hectareasRow._sum.hectareas ?? 0),
      lotes_aldia: snapshot.contadores.lotes_aldia,
      lotes_proxima: snapshot.contadores.lotes_proxima,
      lotes_vencida: snapshot.contadores.lotes_vencida,
      tareas_activas: snapshot.contadores.tareas_activas,
      tareas_cerradas_hoy: snapshot.contadores.tareas_cerradas_hoy,
      cosecha_mes_kg: snapshot.contadores.cosecha_mes_kg,
      cosecha_mes_anterior_kg: snapshot.contadores.cosecha_mes_anterior_kg,
      stock_almacen_kg: snapshot.contadores.stock_almacen_kg,
      stock_bajo: snapshot.contadores.stock_bajo,
      despachos_abiertos: snapshot.contadores.despachos_abiertos,
    },
    vencidas: snapshot.vencidas.map((t) => ({
      lote_id: t.lote_id,
      lote_nombre: t.lote_nombre,
      tipo_id: t.tipo_id,
      tipo_nombre: t.tipo_nombre,
      dias_para_proxima: t.dias_para_proxima,
      estado: t.estado,
    })),
    proximas: snapshot.proximas.map((t) => ({
      lote_id: t.lote_id,
      lote_nombre: t.lote_nombre,
      tipo_id: t.tipo_id,
      tipo_nombre: t.tipo_nombre,
      dias_para_proxima: t.dias_para_proxima,
      estado: t.estado,
    })),
    novedades_pendientes: snapshot.novedades_pendientes,
    carencias: (snapshot.carencias_por_lote ?? []).map((c) => ({
      lote_id: c.lote_id,
      insumo: c.insumo,
      hasta: c.hasta,
    })),
    lotes,
    cosecha_por_anio: cosechaPorAnio.map((c) => ({ anio: c.anio, kg: Number(c.kg) })),
    clima: clima
      ? {
          lluvia_7dias_mm: clima.lluvia_7dias_mm,
          balance_agua: clima.balance
            ? {
                acumulado_mm: clima.balance.acumulado_mm,
                estado: clima.balance.estado,
                resumen: clima.balance.resumen,
              }
            : null,
          dias: clima.dias.map((d) => ({
            fecha: d.fecha,
            tmin: d.tmin,
            tmax: d.tmax,
            lluvia_mm: d.lluvia_mm,
            prob_lluvia: d.prob_lluvia,
          })),
          notas: notasClima(clima),
        }
      : null,
    fenologia: fenologiaInforme(hoy),
    inventario_bajo: inventarioBajo.map((i) => ({
      nombre: i.nombre,
      disponible: Number(i.stock_disponible),
      minimo: Number(i.stock_minimo),
      unidad: i.unidad,
    })),
    finanzas: {
      meses,
      ventas_por_cliente: ventasPorCliente.map((v) => ({
        cliente: v.cliente,
        kg: Number(v.kg),
        ingresos: Number(v.ingresos),
      })),
      compras_por_proveedor: comprasPorProveedor.map((c) => ({
        proveedor: c.proveedor,
        total: Number(c.total),
      })),
      nomina: {
        devengado: conMovimiento.reduce((acc, s) => acc + s.devengado, 0),
        pagado: conMovimiento.reduce((acc, s) => acc + s.pagado, 0),
        personas: conMovimiento.map((s) => ({
          nombre: s.nombre,
          devengado: s.devengado,
          pagado: s.pagado,
        })),
      },
    },
  };
}

function notasClima(clima: Awaited<ReturnType<typeof obtenerClimaFinca>>): string[] {
  const notas: string[] = [];
  notas.push(
    clima.reglas.ventana_fumigacion
      ? `Ventana de fumigación abierta: ${clima.reglas.motivo}`
      : `Sin ventana de fumigación: ${clima.reglas.motivo}`
  );
  if (clima.reglas.riesgo_helada) notas.push('Riesgo de helada en el pronóstico.');
  if (clima.hongos.pudricion_raiz) {
    notas.push(`Riesgo de pudrición de raíz: ${clima.lluvia_72h_mm} mm de lluvia en 72 h.`);
  }
  if (clima.hongos.antracnosis) {
    notas.push(`Riesgo de antracnosis: humedad media de ${clima.humedad_media_48h} % en 48 h.`);
  }
  return notas;
}

function fenologiaInforme(hoy: Date) {
  const f = faseDelMes(hoy);
  return {
    principal: f.principal.nombre,
    secundaria: f.secundaria?.nombre ?? null,
    recomendaciones: f.principal.recomendaciones,
  };
}
