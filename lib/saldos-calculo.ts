/**
 * Núcleo PURO del cálculo de saldos (sin Prisma, sin I/O).
 *
 * Toda la lógica de dinero vive acá para poder testearla exhaustivamente sin
 * base de datos. `lib/saldos.ts` se encarga de leer de Prisma y delegar acá.
 *
 * Reglas de negocio (ver finca):
 *  - FIJO: devenga salario diario × días efectivos (días del período − ausencias descontables).
 *  - JORNALERO: devenga la suma de los jornales registrados en el período.
 *  - CONTRATISTA: devenga el monto pactado de los servicios EN_CURSO/TERMINADO del período.
 *  - Destajo (solo FIJO/JORNALERO) según esquema_pago_destajo:
 *      NUNCA           → no suma destajo.
 *      ADICIONAL       → suma el destajo además del pago base.
 *      REEMPLAZA_DIA   → por cada día con destajo descuenta el pago de ese día
 *                        (salario diario para FIJO, tarifa del jornal para JORNALERO)
 *                        y suma el destajo.
 *      SOLO_DESTAJO    → el devengado es únicamente el destajo.
 *  - saldo = devengado − pagado (pagos del período).
 */

import type { TipoVinculacion, TipoPeriodoPago, EsquemaPagoDestajo } from '@/types';

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
  devengado: number;
  pagado: number;
  saldo: number;
  detalles: {
    dias_periodo: number;
    dias_ausencia_desc: number;
    dias_efectivos: number;
    salario_diario: number;
    pago_base: number;
    jornales_count: number;
    jornales_total: number;
    servicios_count: number;
    servicios_total_pactado: number;
    extras_destajo: number;
    extras_destajo_items: ExtraDestajo[];
    dias_con_destajo: number;
    pagos_count: number;
    adelantos_total: number;
  };
};

export type TarifaConTipo = {
  id: bigint;
  tipo_tarea_id: bigint;
  esquema_pago: string;
  monto: number;
  vigente_desde: Date;
  vigente_hasta: Date | null;
  lote_id: bigint | null;
  tipo_tarea_nombre: string;
};

// --- Entradas puras (ya normalizadas a number/Date desde la capa Prisma) ---

export type VinculacionSaldo = {
  tipo: TipoVinculacion | null;
  salario_base: number | null;
  periodo_pago: TipoPeriodoPago | null;
  tarifa_jornal: number | null;
  esquema_pago_destajo: EsquemaPagoDestajo | null;
} | null;

export type JornalSaldo = { tarifa_aplicada: number; fecha: Date };
export type ServicioSaldo = { monto_pactado: number };
export type PagoSaldo = { monto: number; tipo: string };
export type RegistroAvanceSaldo = {
  cantidad_arboles: number;
  fecha_registro: Date;
  tipo_tarea_id: bigint;
  lote_id: bigint | null;
  tipo_tarea_nombre: string;
};
export type CosechaSaldo = { peso_kg: number; fecha: Date; lote_id: bigint | null };

export type DatosPersonaSaldo = {
  persona_id: bigint;
  nombre: string;
  vinculacion: VinculacionSaldo;
  jornales: JornalSaldo[];
  /** Cantidad de días de ausencia descontable en el período. */
  ausencias_descontables: number;
  servicios: ServicioSaldo[];
  pagos: PagoSaldo[];
  registros_avance: RegistroAvanceSaldo[];
  cosechas: CosechaSaldo[];
};

// --- Helpers puros ---

export function diasEstandar(periodo: TipoPeriodoPago | null): number {
  if (periodo === 'QUINCENAL') return 15;
  if (periodo === 'SEMANAL') return 7;
  return 30;
}

export function diasInclusivos(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function periodoMes(anio: number, mes: number): PeriodoSaldo {
  // Date.UTC garantiza medianoche UTC independientemente del timezone del servidor.
  const desde = new Date(Date.UTC(anio, mes, 1));
  const hasta = new Date(Date.UTC(anio, mes + 1, 1) - 1); // último ms del mes
  return { desde, hasta };
}

/**
 * Devuelve la tarifa vigente en una fecha para un tipo_tarea con uno de los
 * esquemas dados. Preferencia: tarifa con lote_id que coincida; si no, la
 * sin lote. Más reciente gana en empate.
 */
export function tarifaVigente(
  tarifas: TarifaConTipo[],
  tipoTareaId: bigint,
  fecha: Date,
  esquemas: string[],
  loteId: bigint | null
): TarifaConTipo | null {
  const candidatas = tarifas.filter(
    (t) =>
      t.tipo_tarea_id === tipoTareaId &&
      esquemas.includes(t.esquema_pago) &&
      t.vigente_desde.getTime() <= fecha.getTime() &&
      (t.vigente_hasta === null || t.vigente_hasta.getTime() >= fecha.getTime())
  );
  if (candidatas.length === 0) return null;
  const conLote = candidatas.filter((t) => t.lote_id === loteId);
  const escogidas = conLote.length > 0 ? conLote : candidatas.filter((t) => t.lote_id === null);
  if (escogidas.length === 0) return null;
  return escogidas.sort((a, b) => b.vigente_desde.getTime() - a.vigente_desde.getTime())[0];
}

/**
 * Cálculo PURO del saldo de una persona en un período.
 * No toca la base de datos: recibe datos ya normalizados.
 */
export function calcularSaldoPersona(
  datos: DatosPersonaSaldo,
  tarifas: TarifaConTipo[],
  periodo: PeriodoSaldo
): SaldoPersona {
  const diasPeriodo = diasInclusivos(periodo.desde, periodo.hasta);

  const vinc = datos.vinculacion;
  const tipo = vinc?.tipo ?? null;
  const salarioBase = vinc?.salario_base ?? null;
  const periodoPago = vinc?.periodo_pago ?? null;
  const tarifaJornal = vinc?.tarifa_jornal ?? null;
  const esquemaDestajo = vinc?.esquema_pago_destajo ?? null;

  const jorns = datos.jornales;
  const servs = datos.servicios;
  const pgs = datos.pagos;
  const regs = datos.registros_avance;
  const coss = datos.cosechas;

  const diasAusenciaDesc = datos.ausencias_descontables;
  const diasEfectivos = Math.max(0, diasPeriodo - diasAusenciaDesc);
  // MENSUAL: el salario cubre todo el mes, así que el divisor son los días reales
  // del período (28/30/31). Un mes completo paga el salario exacto y cada ausencia
  // descuenta proporcionalmente. QUINCENAL/SEMANAL conservan su divisor canónico
  // (15/7) porque el mes contiene varias de esas unidades.
  const diasEst = periodoPago === 'MENSUAL' ? diasPeriodo : diasEstandar(periodoPago);
  const salarioDiario = salarioBase != null && diasEst > 0 ? salarioBase / diasEst : 0;
  const jornalesTotal = jorns.reduce((acc, j) => acc + j.tarifa_aplicada, 0);
  const serviciosTotalPactado = servs.reduce((acc, s) => acc + s.monto_pactado, 0);

  // Calcular extras_destajo
  const extras: ExtraDestajo[] = [];
  const diasConDestajoSet = new Set<string>();

  // Por árboles (registros_avance × tarifa POR_ARBOL/POR_HECTAREA)
  for (const r of regs) {
    if (r.cantidad_arboles <= 0) continue;
    const tarifa = tarifaVigente(
      tarifas,
      r.tipo_tarea_id,
      r.fecha_registro,
      ['POR_ARBOL', 'POR_HECTAREA'],
      r.lote_id ?? null
    );
    if (!tarifa) continue;
    const monto = r.cantidad_arboles * tarifa.monto;
    extras.push({
      fecha: r.fecha_registro,
      concepto: `${r.tipo_tarea_nombre} (${r.cantidad_arboles} árboles)`,
      cantidad: r.cantidad_arboles,
      unidad: tarifa.esquema_pago === 'POR_HECTAREA' ? 'ha' : 'árbol',
      tarifa: tarifa.monto,
      monto,
    });
    diasConDestajoSet.add(r.fecha_registro.toISOString().slice(0, 10));
  }

  // Por kg cosechado (cosechas × tarifa POR_KG)
  for (const c of coss) {
    const kg = c.peso_kg;
    if (kg <= 0) continue;
    const tarifasKg = tarifas.filter(
      (t) =>
        t.esquema_pago === 'POR_KG' &&
        t.vigente_desde.getTime() <= c.fecha.getTime() &&
        (t.vigente_hasta === null || t.vigente_hasta.getTime() >= c.fecha.getTime())
    );
    if (tarifasKg.length === 0) continue;
    const cosechaPorLote = tarifasKg.find(
      (t) => /cosecha/i.test(t.tipo_tarea_nombre) && t.lote_id === c.lote_id
    );
    const cosechaGlobal = tarifasKg.find(
      (t) => /cosecha/i.test(t.tipo_tarea_nombre) && t.lote_id === null
    );
    const cualquiera = tarifasKg.find((t) => t.lote_id === c.lote_id) ?? tarifasKg[0];
    const tarifa = cosechaPorLote ?? cosechaGlobal ?? cualquiera;
    const monto = kg * tarifa.monto;
    extras.push({
      fecha: c.fecha,
      concepto: `Cosecha (${kg.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg)`,
      cantidad: kg,
      unidad: 'kg',
      tarifa: tarifa.monto,
      monto,
    });
    diasConDestajoSet.add(c.fecha.toISOString().slice(0, 10));
  }

  const extrasDestajoTotal = extras.reduce((acc, x) => acc + x.monto, 0);
  const diasConDestajo = diasConDestajoSet.size;

  // Para REEMPLAZA_DIA JORNALERO: mapa de fecha → tarifa_aplicada del jornal de ese día
  const jornalTarifaPorFecha = new Map<string, number>();
  for (const j of jorns) {
    const k = j.fecha.toISOString().slice(0, 10);
    jornalTarifaPorFecha.set(k, (jornalTarifaPorFecha.get(k) ?? 0) + j.tarifa_aplicada);
  }

  const pagado = pgs.reduce((acc, p) => acc + p.monto, 0);
  const adelantosTotal = pgs
    .filter((p) => p.tipo === 'ADELANTO')
    .reduce((acc, p) => acc + p.monto, 0);

  // Calcular pago base según tipo
  let pagoBase = 0;
  if (tipo === 'FIJO' && salarioBase != null) {
    pagoBase = salarioDiario * diasEfectivos;
  } else if (tipo === 'JORNALERO') {
    pagoBase = jornalesTotal;
  } else if (tipo === 'CONTRATISTA') {
    pagoBase = serviciosTotalPactado;
  }

  // Aplicar esquema_pago_destajo al devengado
  let devengado = pagoBase;
  if (tipo === 'FIJO' || tipo === 'JORNALERO') {
    switch (esquemaDestajo) {
      case 'ADICIONAL':
        devengado = pagoBase + extrasDestajoTotal;
        break;
      case 'REEMPLAZA_DIA':
        if (tipo === 'FIJO') {
          devengado = pagoBase - salarioDiario * diasConDestajo + extrasDestajoTotal;
        } else {
          let descuentoJornales = 0;
          for (const dia of diasConDestajoSet) {
            descuentoJornales += jornalTarifaPorFecha.get(dia) ?? 0;
          }
          devengado = pagoBase - descuentoJornales + extrasDestajoTotal;
        }
        break;
      case 'SOLO_DESTAJO':
        devengado = extrasDestajoTotal;
        break;
      case 'NUNCA':
      case null:
      default:
        devengado = pagoBase;
        break;
    }
  }

  // El peso colombiano no maneja centavos: redondeamos los montos a enteros para
  // evitar residuos de punto flotante (p. ej. dividir el salario entre 31 días).
  const devengadoRedondeado = Math.round(devengado);

  return {
    persona_id: datos.persona_id,
    nombre: datos.nombre,
    tipo_vinculacion: tipo,
    salario_base: salarioBase,
    periodo_pago: periodoPago,
    tarifa_jornal: tarifaJornal,
    esquema_pago_destajo: esquemaDestajo,
    devengado: devengadoRedondeado,
    pagado,
    saldo: devengadoRedondeado - pagado,
    detalles: {
      dias_periodo: diasPeriodo,
      dias_ausencia_desc: diasAusenciaDesc,
      dias_efectivos: diasEfectivos,
      salario_diario: Math.round(salarioDiario),
      pago_base: Math.round(pagoBase),
      jornales_count: jorns.length,
      jornales_total: jornalesTotal,
      servicios_count: servs.length,
      servicios_total_pactado: serviciosTotalPactado,
      extras_destajo: extrasDestajoTotal,
      extras_destajo_items: extras.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
      dias_con_destajo: diasConDestajo,
      pagos_count: pgs.length,
      adelantos_total: adelantosTotal,
    },
  };
}
