import { prisma } from '@/lib/prisma';
import {
  calcularSaldoPersona as calcularSaldoPersonaPuro,
  periodoMes,
  type DatosPersonaSaldo,
  type PeriodoSaldo,
  type SaldoPersona,
  type ExtraDestajo,
  type TarifaConTipo,
} from './saldos-calculo';

export { periodoMes };
export type { PeriodoSaldo, SaldoPersona, ExtraDestajo };

export async function calcularSaldosPeriodo(periodo: PeriodoSaldo): Promise<SaldoPersona[]> {
  const { desde, hasta } = periodo;

  // Incluir personas inactivas que tuvieron vinculación activa durante el período
  const vinculacionEnPeriodo = {
    fecha_inicio: { lte: hasta },
    OR: [{ fecha_fin: null }, { fecha_fin: { gte: desde } }],
  };

  const personas = await prisma.personas.findMany({
    where: {
      deleted_at: null,
      vinculaciones: { some: vinculacionEnPeriodo },
    },
    select: {
      id: true,
      nombre_completo: true,
      vinculaciones: {
        where: vinculacionEnPeriodo,
        select: {
          tipo: true,
          salario_base: true,
          periodo_pago: true,
          tarifa_jornal: true,
          esquema_pago_destajo: true,
        },
        orderBy: { fecha_inicio: 'desc' },
        take: 1,
      },
    },
    orderBy: { nombre_completo: 'asc' },
  });

  if (personas.length === 0) return [];

  const personaIds = personas.map((p) => p.id);

  const [jornales, ausencias, servicios, pagos, registrosAvance, cosechas, tarifasRaw] =
    await Promise.all([
      prisma.jornales.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha: { gte: desde, lte: hasta },
          borrado_en: null,
        },
        select: { persona_id: true, tarifa_aplicada: true, fecha: true },
      }),
      prisma.ausencias.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha: { gte: desde, lte: hasta },
          descontable: true,
          borrado_en: null,
        },
        select: { persona_id: true },
      }),
      prisma.servicios_contratados.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha_inicio: { gte: desde, lte: hasta },
          // Solo servicios que efectivamente se prestaron (no meros acuerdos sin iniciar)
          estado: { in: ['EN_CURSO', 'TERMINADO'] },
          borrado_en: null,
        },
        select: { persona_id: true, monto_pactado: true },
      }),
      prisma.pagos.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha: { gte: desde, lte: hasta },
          borrado_en: null,
        },
        select: { persona_id: true, monto: true, tipo: true },
      }),
      prisma.registros_avance.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha_registro: { gte: desde, lte: new Date(hasta.getTime() + 86399999) },
        },
        select: {
          persona_id: true,
          cantidad_arboles: true,
          fecha_registro: true,
          asignaciones: {
            select: {
              tipo_tarea_id: true,
              lote_id: true,
              tipos_tarea: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.cosechas.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha: { gte: desde, lte: new Date(hasta.getTime() + 86399999) },
        },
        select: { persona_id: true, peso_kg: true, fecha: true, lote_id: true },
      }),
      prisma.tarifas_tarea.findMany({
        where: {
          esquema_pago: { in: ['POR_ARBOL', 'POR_HECTAREA', 'POR_KG'] },
          borrado_en: null,
          OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: desde } }],
        },
        select: {
          id: true,
          tipo_tarea_id: true,
          esquema_pago: true,
          monto: true,
          vigente_desde: true,
          vigente_hasta: true,
          lote_id: true,
          tipos_tarea: { select: { nombre: true } },
        },
      }),
    ]);

  // Normalizar tarifas (Decimal → number)
  const tarifas: TarifaConTipo[] = tarifasRaw.map((t) => ({
    id: t.id,
    tipo_tarea_id: t.tipo_tarea_id,
    esquema_pago: String(t.esquema_pago),
    monto: Number(t.monto),
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta,
    lote_id: t.lote_id,
    tipo_tarea_nombre: t.tipos_tarea.nombre,
  }));

  // Agrupar por persona
  function porPersona<T extends { persona_id: bigint }>(arr: T[]) {
    const map = new Map<string, T[]>();
    for (const item of arr) {
      const k = item.persona_id.toString();
      const list = map.get(k) ?? [];
      list.push(item);
      map.set(k, list);
    }
    return map;
  }

  const jornalesPP = porPersona(jornales);
  const ausenciasPP = porPersona(ausencias);
  const serviciosPP = porPersona(servicios);
  const pagosPP = porPersona(pagos);
  const registrosPP = porPersona(registrosAvance);
  const cosechasPP = porPersona(cosechas);

  return personas.map((p) => {
    const key = p.id.toString();
    const vinc = p.vinculaciones[0] ?? null;

    const datos: DatosPersonaSaldo = {
      persona_id: p.id,
      nombre: p.nombre_completo,
      vinculacion: vinc
        ? {
            tipo: vinc.tipo,
            salario_base: vinc.salario_base != null ? Number(vinc.salario_base) : null,
            periodo_pago: vinc.periodo_pago,
            tarifa_jornal: vinc.tarifa_jornal != null ? Number(vinc.tarifa_jornal) : null,
            esquema_pago_destajo: vinc.esquema_pago_destajo,
          }
        : null,
      jornales: (jornalesPP.get(key) ?? []).map((j) => ({
        tarifa_aplicada: Number(j.tarifa_aplicada),
        fecha: j.fecha,
      })),
      ausencias_descontables: (ausenciasPP.get(key) ?? []).length,
      servicios: (serviciosPP.get(key) ?? []).map((s) => ({
        monto_pactado: Number(s.monto_pactado),
      })),
      pagos: (pagosPP.get(key) ?? []).map((pg) => ({
        monto: Number(pg.monto),
        tipo: String(pg.tipo),
      })),
      registros_avance: (registrosPP.get(key) ?? []).map((r) => ({
        cantidad_arboles: r.cantidad_arboles,
        fecha_registro: r.fecha_registro,
        tipo_tarea_id: r.asignaciones.tipo_tarea_id,
        lote_id: r.asignaciones.lote_id ?? null,
        tipo_tarea_nombre: r.asignaciones.tipos_tarea.nombre,
      })),
      cosechas: (cosechasPP.get(key) ?? []).map((c) => ({
        peso_kg: Number(c.peso_kg),
        fecha: c.fecha,
        lote_id: c.lote_id,
      })),
    };

    return calcularSaldoPersonaPuro(datos, tarifas, periodo);
  });
}

export async function calcularSaldoPersona(
  personaId: bigint,
  periodo: PeriodoSaldo
): Promise<SaldoPersona | null> {
  const todos = await calcularSaldosPeriodo(periodo);
  return todos.find((s) => s.persona_id === personaId) ?? null;
}
