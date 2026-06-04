import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { generarCSV } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const f = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const n = (v: unknown) => (v == null ? '' : Number(v));

type Tabla = 'pagos' | 'jornales' | 'ausencias' | 'servicios' | 'compras' | 'ventas' | 'cosechas';

const TABLAS: Tabla[] = [
  'pagos',
  'jornales',
  'ausencias',
  'servicios',
  'compras',
  'ventas',
  'cosechas',
];

async function construirCSV(tabla: Tabla): Promise<string> {
  switch (tabla) {
    case 'pagos': {
      const rows = await prisma.pagos.findMany({
        where: { borrado_en: null },
        include: { persona: { select: { nombre_completo: true } } },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        [
          'Fecha',
          'Persona',
          'Tipo',
          'Monto',
          'Método',
          'Cubre desde',
          'Cubre hasta',
          'Motivo',
          'Notas',
        ],
        rows.map((r) => [
          f(r.fecha),
          r.persona.nombre_completo,
          r.tipo,
          n(r.monto),
          r.metodo_pago ?? '',
          f(r.cubre_desde),
          f(r.cubre_hasta),
          r.motivo_diferencia ?? '',
          r.notas ?? '',
        ])
      );
    }
    case 'jornales': {
      const rows = await prisma.jornales.findMany({
        where: { borrado_en: null },
        include: {
          persona: { select: { nombre_completo: true } },
          lotes: { select: { nombre: true } },
        },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        ['Fecha', 'Persona', 'Tarifa', 'Lote', 'Actividad', 'Notas'],
        rows.map((r) => [
          f(r.fecha),
          r.persona.nombre_completo,
          n(r.tarifa_aplicada),
          r.lotes?.nombre ?? '',
          r.descripcion_actividad ?? '',
          r.notas ?? '',
        ])
      );
    }
    case 'ausencias': {
      const rows = await prisma.ausencias.findMany({
        where: { borrado_en: null },
        include: { persona: { select: { nombre_completo: true } } },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        ['Fecha', 'Persona', 'Tipo', 'Descontable', 'Observaciones'],
        rows.map((r) => [
          f(r.fecha),
          r.persona.nombre_completo,
          r.tipo,
          r.descontable ? 'Sí' : 'No',
          r.observaciones ?? '',
        ])
      );
    }
    case 'servicios': {
      const rows = await prisma.servicios_contratados.findMany({
        where: { borrado_en: null },
        include: {
          persona: { select: { nombre_completo: true } },
          lotes: { select: { nombre: true } },
        },
        orderBy: { fecha_inicio: 'desc' },
      });
      return generarCSV(
        ['Inicio', 'Fin', 'Persona', 'Descripción', 'Lote', 'Monto pactado', 'Estado', 'Notas'],
        rows.map((r) => [
          f(r.fecha_inicio),
          f(r.fecha_fin),
          r.persona.nombre_completo,
          r.descripcion,
          r.lotes?.nombre ?? '',
          n(r.monto_pactado),
          r.estado,
          r.notas ?? '',
        ])
      );
    }
    case 'compras': {
      const rows = await prisma.compras.findMany({
        where: { borrado_en: null },
        include: { proveedor: { select: { nombre: true } } },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        ['Fecha', 'Proveedor', 'Total', 'Factura', 'Notas'],
        rows.map((r) => [
          f(r.fecha),
          r.proveedor?.nombre ?? r.proveedor_detalle ?? '',
          n(r.total),
          r.numero_factura ?? '',
          r.notas ?? '',
        ])
      );
    }
    case 'ventas': {
      const rows = await prisma.salidas_cosecha.findMany({
        include: { clientes: { select: { nombre: true } } },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        ['Fecha', 'Tipo', 'Cliente', 'Cantidad (kg)', 'Precio total', 'Notas'],
        rows.map((r) => [
          f(r.fecha),
          r.tipo,
          r.clientes?.nombre ?? r.cliente_detalle ?? '',
          n(r.cantidad_kg),
          n(r.precio_total),
          r.notas ?? '',
        ])
      );
    }
    case 'cosechas': {
      const rows = await prisma.cosechas.findMany({
        include: {
          persona: { select: { nombre_completo: true } },
          lotes: { select: { nombre: true } },
        },
        orderBy: { fecha: 'desc' },
      });
      return generarCSV(
        ['Fecha', 'Recolector', 'Lote', 'Método', 'Canastas', 'Peso (kg)', 'Notas'],
        rows.map((r) => [
          f(r.fecha),
          r.persona.nombre_completo,
          r.lotes.nombre,
          r.metodo_medicion,
          r.cantidad_canastas ?? '',
          n(r.peso_kg),
          r.notas ?? '',
        ])
      );
    }
  }
}

export async function GET(req: NextRequest) {
  await requerirUsuario('JEFE');

  const tabla = req.nextUrl.searchParams.get('tabla') as Tabla | null;
  if (!tabla || !TABLAS.includes(tabla)) {
    return NextResponse.json({ ok: false, error: 'Tabla inválida.' }, { status: 400 });
  }

  const csv = await construirCSV(tabla);
  const hoy = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="zelanda-${tabla}-${hoy}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
