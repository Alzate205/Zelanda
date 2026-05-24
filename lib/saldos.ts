import { prisma } from "@/lib/prisma";
import type { TipoVinculacion, TipoPeriodoPago } from "@/types";

export type PeriodoSaldo = { desde: Date; hasta: Date };

export type SaldoPersona = {
  persona_id: bigint;
  nombre: string;
  tipo_vinculacion: TipoVinculacion | null;
  salario_base: number | null;
  periodo_pago: TipoPeriodoPago | null;
  tarifa_jornal: number | null;
  // Devengado en el periodo
  devengado: number;
  // Pagado en el periodo (suma de pagos.monto, ajustes incluidos)
  pagado: number;
  // saldo = devengado - pagado
  saldo: number;
  // Detalles desglosados
  detalles: {
    dias_periodo: number;
    dias_ausencia_desc: number;
    dias_efectivos: number;
    salario_diario: number;
    jornales_count: number;
    jornales_total: number;
    servicios_count: number;
    servicios_total_pactado: number;
    pagos_count: number;
    adelantos_total: number;
  };
};

/**
 * Devuelve el numero de dias estandar segun el periodo de pago.
 * - MENSUAL = 30 dias
 * - QUINCENAL = 15
 * - SEMANAL = 7
 */
function diasEstandar(periodo: TipoPeriodoPago | null): number {
  if (periodo === "QUINCENAL") return 15;
  if (periodo === "SEMANAL") return 7;
  return 30;
}

/**
 * Cuenta dias inclusivos entre dos fechas (mismo dia = 1).
 */
function diasInclusivos(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Construye el periodo del mes natural especificado.
 */
export function periodoMes(anio: number, mes: number): PeriodoSaldo {
  const desde = new Date(anio, mes, 1);
  // Ultimo dia del mes
  const hasta = new Date(anio, mes + 1, 0);
  return { desde, hasta };
}

/**
 * Calcula saldos para todas las personas con vinculacion activa
 * en el periodo dado. Hace queries en bulk para evitar N+1.
 */
export async function calcularSaldosPeriodo(
  periodo: PeriodoSaldo,
): Promise<SaldoPersona[]> {
  const { desde, hasta } = periodo;
  const diasPeriodo = diasInclusivos(desde, hasta);

  // 1) Personas con vinculacion activa
  const personas = await prisma.personas.findMany({
    where: { deleted_at: null, activo: true },
    select: {
      id: true,
      nombre_completo: true,
      vinculaciones: {
        where: { fecha_fin: null },
        select: {
          tipo: true,
          salario_base: true,
          periodo_pago: true,
          tarifa_jornal: true,
        },
        orderBy: { fecha_inicio: "desc" },
        take: 1,
      },
    },
    orderBy: { nombre_completo: "asc" },
  });

  if (personas.length === 0) return [];

  const personaIds = personas.map((p) => p.id);

  // 2) Bulk: jornales en periodo agrupados por persona
  const jornales = await prisma.jornales.findMany({
    where: {
      persona_id: { in: personaIds },
      fecha: { gte: desde, lte: hasta },
    },
    select: { persona_id: true, tarifa_aplicada: true },
  });

  // 3) Bulk: ausencias descontables en periodo
  const ausencias = await prisma.ausencias.findMany({
    where: {
      persona_id: { in: personaIds },
      fecha: { gte: desde, lte: hasta },
      descontable: true,
    },
    select: { persona_id: true },
  });

  // 4) Bulk: servicios contratados que iniciaron en periodo
  const servicios = await prisma.servicios_contratados.findMany({
    where: {
      persona_id: { in: personaIds },
      fecha_inicio: { gte: desde, lte: hasta },
      estado: { not: "CANCELADO" },
    },
    select: { persona_id: true, monto_pactado: true },
  });

  // 5) Bulk: pagos en periodo
  const pagos = await prisma.pagos.findMany({
    where: {
      persona_id: { in: personaIds },
      fecha: { gte: desde, lte: hasta },
    },
    select: { persona_id: true, monto: true, tipo: true },
  });

  // Agrupar por persona_id
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

  const jornalesPorPersona = porPersona(jornales);
  const ausenciasPorPersona = porPersona(ausencias);
  const serviciosPorPersona = porPersona(servicios);
  const pagosPorPersona = porPersona(pagos);

  // Calcular saldo para cada persona
  return personas.map((p) => {
    const key = p.id.toString();
    const vinc = p.vinculaciones[0] ?? null;
    const tipo = (vinc?.tipo as TipoVinculacion | undefined) ?? null;
    const salarioBase = vinc?.salario_base ? Number(vinc.salario_base) : null;
    const periodoPago = (vinc?.periodo_pago as TipoPeriodoPago | undefined) ?? null;
    const tarifaJornal = vinc?.tarifa_jornal ? Number(vinc.tarifa_jornal) : null;

    const ausDesc = ausenciasPorPersona.get(key) ?? [];
    const jorns = jornalesPorPersona.get(key) ?? [];
    const servs = serviciosPorPersona.get(key) ?? [];
    const pgs = pagosPorPersona.get(key) ?? [];

    const diasAusenciaDesc = ausDesc.length;
    const diasEfectivos = Math.max(0, diasPeriodo - diasAusenciaDesc);
    const diasEst = diasEstandar(periodoPago);
    const salarioDiario =
      salarioBase != null && diasEst > 0 ? salarioBase / diasEst : 0;
    const jornalesTotal = jorns.reduce(
      (acc, j) => acc + Number(j.tarifa_aplicada),
      0,
    );
    const serviciosTotalPactado = servs.reduce(
      (acc, s) => acc + Number(s.monto_pactado),
      0,
    );
    const pagado = pgs.reduce((acc, p) => acc + Number(p.monto), 0);
    const adelantosTotal = pgs
      .filter((p) => p.tipo === "ADELANTO")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    let devengado = 0;
    if (tipo === "FIJO" && salarioBase != null) {
      devengado = salarioDiario * diasEfectivos;
    } else if (tipo === "JORNALERO") {
      devengado = jornalesTotal;
    } else if (tipo === "CONTRATISTA") {
      devengado = serviciosTotalPactado;
    }
    // FAMILIAR o sin vinculacion: devengado = 0

    return {
      persona_id: p.id,
      nombre: p.nombre_completo,
      tipo_vinculacion: tipo,
      salario_base: salarioBase,
      periodo_pago: periodoPago,
      tarifa_jornal: tarifaJornal,
      devengado,
      pagado,
      saldo: devengado - pagado,
      detalles: {
        dias_periodo: diasPeriodo,
        dias_ausencia_desc: diasAusenciaDesc,
        dias_efectivos: diasEfectivos,
        salario_diario: salarioDiario,
        jornales_count: jorns.length,
        jornales_total: jornalesTotal,
        servicios_count: servs.length,
        servicios_total_pactado: serviciosTotalPactado,
        pagos_count: pgs.length,
        adelantos_total: adelantosTotal,
      },
    };
  });
}

export async function calcularSaldoPersona(
  personaId: bigint,
  periodo: PeriodoSaldo,
): Promise<SaldoPersona | null> {
  const todos = await calcularSaldosPeriodo(periodo);
  return todos.find((s) => s.persona_id === personaId) ?? null;
}
