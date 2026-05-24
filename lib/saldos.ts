import { prisma } from "@/lib/prisma";
import type {
  TipoVinculacion,
  TipoPeriodoPago,
  EsquemaPagoDestajo,
} from "@/types";

export type PeriodoSaldo = { desde: Date; hasta: Date };

export type ExtraDestajo = {
  fecha: Date;
  concepto: string;
  cantidad: number;
  unidad: string;
  tarifa: number;
  monto: number;
};

export type SaldoPersona = {
  persona_id: bigint;
  nombre: string;
  tipo_vinculacion: TipoVinculacion | null;
  salario_base: number | null;
  periodo_pago: TipoPeriodoPago | null;
  tarifa_jornal: number | null;
  esquema_pago_destajo: EsquemaPagoDestajo | null;
  // Devengado en el periodo (lo que la finca le debe pagar)
  devengado: number;
  // Pagado en el periodo (suma de pagos.monto)
  pagado: number;
  // saldo = devengado - pagado
  saldo: number;
  // Detalles desglosados
  detalles: {
    dias_periodo: number;
    dias_ausencia_desc: number;
    dias_efectivos: number;
    salario_diario: number;
    pago_base: number; // salario o suma de jornales
    jornales_count: number;
    jornales_total: number;
    servicios_count: number;
    servicios_total_pactado: number;
    extras_destajo: number;
    extras_destajo_items: ExtraDestajo[];
    dias_con_destajo: number; // solo aplica si REEMPLAZA_DIA
    pagos_count: number;
    adelantos_total: number;
  };
};

function diasEstandar(periodo: TipoPeriodoPago | null): number {
  if (periodo === "QUINCENAL") return 15;
  if (periodo === "SEMANAL") return 7;
  return 30;
}

function diasInclusivos(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function periodoMes(anio: number, mes: number): PeriodoSaldo {
  const desde = new Date(anio, mes, 1);
  const hasta = new Date(anio, mes + 1, 0);
  return { desde, hasta };
}

type TarifaConTipo = {
  id: bigint;
  tipo_tarea_id: bigint;
  esquema_pago: string;
  monto: number;
  vigente_desde: Date;
  vigente_hasta: Date | null;
  lote_id: bigint | null;
  tipo_tarea_nombre: string;
};

/**
 * Devuelve la tarifa vigente en una fecha para un tipo_tarea con uno de los
 * esquemas dados. Preferencia: tarifa con lote_id que coincida; si no, la
 * sin lote. Mas reciente gana en empate.
 */
function tarifaVigente(
  tarifas: TarifaConTipo[],
  tipoTareaId: bigint,
  fecha: Date,
  esquemas: string[],
  loteId: bigint | null,
): TarifaConTipo | null {
  const candidatas = tarifas.filter(
    (t) =>
      t.tipo_tarea_id === tipoTareaId &&
      esquemas.includes(t.esquema_pago) &&
      t.vigente_desde.getTime() <= fecha.getTime() &&
      (t.vigente_hasta === null || t.vigente_hasta.getTime() >= fecha.getTime()),
  );
  if (candidatas.length === 0) return null;
  // Preferir match por lote
  const conLote = candidatas.filter((t) => t.lote_id === loteId);
  const escogidas = conLote.length > 0 ? conLote : candidatas.filter((t) => t.lote_id === null);
  if (escogidas.length === 0) return null;
  // La mas reciente
  return escogidas.sort(
    (a, b) => b.vigente_desde.getTime() - a.vigente_desde.getTime(),
  )[0];
}

export async function calcularSaldosPeriodo(
  periodo: PeriodoSaldo,
): Promise<SaldoPersona[]> {
  const { desde, hasta } = periodo;
  const diasPeriodo = diasInclusivos(desde, hasta);

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
          esquema_pago_destajo: true,
        },
        orderBy: { fecha_inicio: "desc" },
        take: 1,
      },
    },
    orderBy: { nombre_completo: "asc" },
  });

  if (personas.length === 0) return [];

  const personaIds = personas.map((p) => p.id);

  // Bulk queries
  const [jornales, ausencias, servicios, pagos, registrosAvance, cosechas, tarifasRaw] =
    await Promise.all([
      prisma.jornales.findMany({
        where: { persona_id: { in: personaIds }, fecha: { gte: desde, lte: hasta } },
        select: { persona_id: true, tarifa_aplicada: true, fecha: true },
      }),
      prisma.ausencias.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha: { gte: desde, lte: hasta },
          descontable: true,
        },
        select: { persona_id: true },
      }),
      prisma.servicios_contratados.findMany({
        where: {
          persona_id: { in: personaIds },
          fecha_inicio: { gte: desde, lte: hasta },
          estado: { not: "CANCELADO" },
        },
        select: { persona_id: true, monto_pactado: true },
      }),
      prisma.pagos.findMany({
        where: { persona_id: { in: personaIds }, fecha: { gte: desde, lte: hasta } },
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
          esquema_pago: { in: ["POR_ARBOL", "POR_HECTAREA", "POR_KG"] },
          OR: [
            { vigente_hasta: null },
            { vigente_hasta: { gte: desde } },
          ],
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

  // Normalizar tarifas
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
    const tipo = (vinc?.tipo as TipoVinculacion | undefined) ?? null;
    const salarioBase = vinc?.salario_base ? Number(vinc.salario_base) : null;
    const periodoPago = (vinc?.periodo_pago as TipoPeriodoPago | undefined) ?? null;
    const tarifaJornal = vinc?.tarifa_jornal ? Number(vinc.tarifa_jornal) : null;
    const esquemaDestajo =
      (vinc?.esquema_pago_destajo as EsquemaPagoDestajo | undefined) ?? null;

    const ausDesc = ausenciasPP.get(key) ?? [];
    const jorns = jornalesPP.get(key) ?? [];
    const servs = serviciosPP.get(key) ?? [];
    const pgs = pagosPP.get(key) ?? [];
    const regs = registrosPP.get(key) ?? [];
    const coss = cosechasPP.get(key) ?? [];

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

    // Calcular extras_destajo
    const extras: ExtraDestajo[] = [];
    const diasConDestajoSet = new Set<string>();

    // Por arboles (registros_avance × tarifa POR_ARBOL/POR_HECTAREA)
    for (const r of regs) {
      if (r.cantidad_arboles <= 0) continue;
      const tarifa = tarifaVigente(
        tarifas,
        r.asignaciones.tipo_tarea_id,
        r.fecha_registro,
        ["POR_ARBOL", "POR_HECTAREA"],
        r.asignaciones.lote_id ?? null,
      );
      if (!tarifa) continue;
      const monto = r.cantidad_arboles * tarifa.monto;
      extras.push({
        fecha: r.fecha_registro,
        concepto: `${r.asignaciones.tipos_tarea.nombre} (${r.cantidad_arboles} árboles)`,
        cantidad: r.cantidad_arboles,
        unidad: tarifa.esquema_pago === "POR_HECTAREA" ? "ha" : "árbol",
        tarifa: tarifa.monto,
        monto,
      });
      diasConDestajoSet.add(r.fecha_registro.toISOString().slice(0, 10));
    }

    // Por kg cosechado (cosechas × tarifa POR_KG)
    for (const c of coss) {
      const kg = Number(c.peso_kg);
      if (kg <= 0) continue;
      // Buscar tarifa POR_KG: probar primero con tipo_tarea "Cosecha" si existe;
      // si no, cualquier tarifa POR_KG vigente.
      const tarifasKg = tarifas.filter(
        (t) =>
          t.esquema_pago === "POR_KG" &&
          t.vigente_desde.getTime() <= c.fecha.getTime() &&
          (t.vigente_hasta === null || t.vigente_hasta.getTime() >= c.fecha.getTime()),
      );
      if (tarifasKg.length === 0) continue;
      // Preferir Cosecha + lote match
      const cosechaPorLote = tarifasKg.find(
        (t) => /cosecha/i.test(t.tipo_tarea_nombre) && t.lote_id === c.lote_id,
      );
      const cosechaGlobal = tarifasKg.find(
        (t) => /cosecha/i.test(t.tipo_tarea_nombre) && t.lote_id === null,
      );
      const cualquiera = tarifasKg.find((t) => t.lote_id === c.lote_id) ?? tarifasKg[0];
      const tarifa = cosechaPorLote ?? cosechaGlobal ?? cualquiera;
      const monto = kg * tarifa.monto;
      extras.push({
        fecha: c.fecha,
        concepto: `Cosecha (${kg.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg)`,
        cantidad: kg,
        unidad: "kg",
        tarifa: tarifa.monto,
        monto,
      });
      diasConDestajoSet.add(c.fecha.toISOString().slice(0, 10));
    }

    const extrasDestajoTotal = extras.reduce((acc, x) => acc + x.monto, 0);
    const diasConDestajo = diasConDestajoSet.size;

    const pagado = pgs.reduce((acc, p) => acc + Number(p.monto), 0);
    const adelantosTotal = pgs
      .filter((p) => p.tipo === "ADELANTO")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    // Calcular pago base segun tipo
    let pagoBase = 0;
    if (tipo === "FIJO" && salarioBase != null) {
      pagoBase = salarioDiario * diasEfectivos;
    } else if (tipo === "JORNALERO") {
      pagoBase = jornalesTotal;
    } else if (tipo === "CONTRATISTA") {
      pagoBase = serviciosTotalPactado;
    }

    // Aplicar esquema_pago_destajo al devengado
    let devengado = pagoBase;
    if (tipo === "FIJO" || tipo === "JORNALERO") {
      switch (esquemaDestajo) {
        case "ADICIONAL":
          devengado = pagoBase + extrasDestajoTotal;
          break;
        case "REEMPLAZA_DIA":
          // Por cada dia con destajo, descontar el salario diario y sumar destajo
          if (tipo === "FIJO") {
            devengado = pagoBase - salarioDiario * diasConDestajo + extrasDestajoTotal;
          } else {
            // Para JORNALERO: el destajo reemplaza al jornal de ese dia
            // Aproximacion: descontar tarifa_jornal por dia con destajo
            const tarifaDia = tarifaJornal ?? 0;
            devengado = pagoBase - tarifaDia * diasConDestajo + extrasDestajoTotal;
          }
          break;
        case "SOLO_DESTAJO":
          devengado = extrasDestajoTotal;
          break;
        case "NUNCA":
        case null:
        default:
          // No suma destajo
          devengado = pagoBase;
          break;
      }
    }

    return {
      persona_id: p.id,
      nombre: p.nombre_completo,
      tipo_vinculacion: tipo,
      salario_base: salarioBase,
      periodo_pago: periodoPago,
      tarifa_jornal: tarifaJornal,
      esquema_pago_destajo: esquemaDestajo,
      devengado,
      pagado,
      saldo: devengado - pagado,
      detalles: {
        dias_periodo: diasPeriodo,
        dias_ausencia_desc: diasAusenciaDesc,
        dias_efectivos: diasEfectivos,
        salario_diario: salarioDiario,
        pago_base: pagoBase,
        jornales_count: jorns.length,
        jornales_total: jornalesTotal,
        servicios_count: servs.length,
        servicios_total_pactado: serviciosTotalPactado,
        extras_destajo: extrasDestajoTotal,
        extras_destajo_items: extras.sort(
          (a, b) => a.fecha.getTime() - b.fecha.getTime(),
        ),
        dias_con_destajo: diasConDestajo,
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
