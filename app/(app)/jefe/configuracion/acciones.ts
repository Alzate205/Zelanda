'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import type { TipoPeriodoPago } from '@prisma/client';

export type EstadoConfig = { error: string | null };

const PERIODOS_VALIDOS: TipoPeriodoPago[] = ['MENSUAL', 'QUINCENAL', 'SEMANAL'];

export async function guardarConfiguracion(
  _prev: EstadoConfig,
  formData: FormData
): Promise<EstadoConfig> {
  const usuario = await requerirUsuario('JEFE');

  const fincaNombre = String(formData.get('finca_nombre') ?? '').trim();
  const fincaTelefono = String(formData.get('finca_telefono') ?? '').trim();
  const fincaCorreo = String(formData.get('finca_correo') ?? '').trim();

  const canastasRaw = String(formData.get('canasta_kg_default') ?? '').trim();
  const alertaDiasRaw = String(formData.get('alerta_dias_anticipacion') ?? '').trim();
  const horaCierre = String(formData.get('despacho_hora_corte') ?? '').trim();
  const stockMinimoRaw = String(formData.get('insumo_stock_minimo_default') ?? '').trim();

  const jornalTarifaRaw = String(formData.get('jornal_tarifa_default') ?? '').trim();
  const fijoSalarioRaw = String(formData.get('fijo_salario_default') ?? '').trim();
  const fijoPeriodoRaw = String(formData.get('fijo_periodo_pago_default') ?? '').trim();

  if (!fincaNombre) return { error: 'El nombre de la finca no puede estar vacío.' };

  const canasta = Number(canastasRaw.replace(/\./g, ''));
  if (!Number.isFinite(canasta) || canasta <= 0) {
    return { error: 'Capacidad de canasta debe ser mayor a 0.' };
  }

  const alertaDias = parseInt(alertaDiasRaw, 10);
  if (!Number.isFinite(alertaDias) || alertaDias < 1 || alertaDias > 60) {
    return { error: 'Días de anticipación debe estar entre 1 y 60.' };
  }

  if (!/^\d{2}:\d{2}$/.test(horaCierre)) {
    return { error: 'Hora de corte debe tener formato HH:MM.' };
  }

  const stockMinimo = Number(stockMinimoRaw.replace(/\./g, ''));
  if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: 'Stock mínimo por defecto debe ser 0 o mayor.' };
  }

  let jornalTarifa: number | null = null;
  if (jornalTarifaRaw) {
    jornalTarifa = Number(jornalTarifaRaw.replace(/\./g, ''));
    if (!Number.isFinite(jornalTarifa) || jornalTarifa <= 0) {
      return { error: 'Tarifa jornal por defecto debe ser mayor a 0.' };
    }
  }

  let fijoSalario: number | null = null;
  if (fijoSalarioRaw) {
    fijoSalario = Number(fijoSalarioRaw.replace(/\./g, ''));
    if (!Number.isFinite(fijoSalario) || fijoSalario <= 0) {
      return { error: 'Salario base por defecto debe ser mayor a 0.' };
    }
  }

  const fijoPeriodo: TipoPeriodoPago | null =
    fijoPeriodoRaw && PERIODOS_VALIDOS.includes(fijoPeriodoRaw as TipoPeriodoPago)
      ? (fijoPeriodoRaw as TipoPeriodoPago)
      : null;

  try {
    await prisma.configuracion_finca.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        finca_nombre: fincaNombre,
        finca_telefono: fincaTelefono || null,
        finca_correo: fincaCorreo || null,
        canasta_kg_default: canasta,
        alerta_dias_anticipacion: alertaDias,
        despacho_hora_corte: horaCierre,
        insumo_stock_minimo_default: stockMinimo,
        jornal_tarifa_default: jornalTarifa,
        fijo_salario_default: fijoSalario,
        fijo_periodo_pago_default: fijoPeriodo,
        updated_by: usuario.id,
      },
      update: {
        finca_nombre: fincaNombre,
        finca_telefono: fincaTelefono || null,
        finca_correo: fincaCorreo || null,
        canasta_kg_default: canasta,
        alerta_dias_anticipacion: alertaDias,
        despacho_hora_corte: horaCierre,
        insumo_stock_minimo_default: stockMinimo,
        jornal_tarifa_default: jornalTarifa,
        fijo_salario_default: fijoSalario,
        fijo_periodo_pago_default: fijoPeriodo,
        updated_at: new Date(),
        updated_by: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, 'configuracion/guardar') };
  }

  revalidatePath('/jefe/configuracion');
  return { error: null };
}
