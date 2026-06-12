'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
  Map as MapIcon,
  Users,
  Hexagon,
  Bell,
  DollarSign,
  Briefcase,
  CalendarCheck,
  UserMinus,
  Wallet,
  TrendingUp,
  ShoppingCart,
  Truck,
  FlaskConical,
  Settings,
  History,
  Download,
  X,
} from 'lucide-react';
import type { SnapshotJefe, AlertaTareaJefe } from '@/lib/offline/tipos';
import { ETIQUETA_NOVEDAD } from '@/lib/constantes';
import { AlertaItem } from '@/components/shared/AlertaItem';
import { Atajo } from '@/components/shared/Atajo';

function describirActualizacion(ts: number | null): string {
  if (ts === null) return 'Sin sincronizar';
  const diffMs = Date.now() - ts;
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'Actualizado hace un momento';
  if (minutos < 60) return `Actualizado hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Actualizado hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Actualizado hace ${dias} d`;
}

function subtituloAlerta(alerta: AlertaTareaJefe): string {
  if (alerta.estado === 'sin_historial') {
    return `Sin historial · Lote ${alerta.lote_nombre}`;
  }
  if (alerta.estado === 'vencida') {
    const dias = Math.abs(alerta.dias_para_proxima ?? 0);
    return `Vencida hace ${dias} ${dias === 1 ? 'día' : 'días'} · Lote ${alerta.lote_nombre}`;
  }
  const dias = alerta.dias_para_proxima ?? 0;
  if (dias === 0) return `Hoy · Lote ${alerta.lote_nombre}`;
  if (dias === 1) return `Mañana · Lote ${alerta.lote_nombre}`;
  return `En ${dias} días · Lote ${alerta.lote_nombre}`;
}

export function PanelCentral({
  snapshot,
  tsCache,
  onCerrar,
}: {
  snapshot: SnapshotJefe;
  tsCache: number | null;
  onCerrar: () => void;
}) {
  const { vencidas, proximas, novedades_pendientes } = snapshot;
  const recordatorios = snapshot.recordatorios ?? [];

  const alertasOrdenadas: Array<{
    key: string;
    estado: 'vencida' | 'proxima' | 'neutro' | 'aldia';
    icono: typeof AlertTriangle;
    titulo: string;
    sub: string;
    href: string;
  }> = [];
  for (const v of vencidas.slice(0, 4)) {
    alertasOrdenadas.push({
      key: `v_${v.tipo_id}_${v.lote_id}`,
      estado: 'vencida',
      icono: AlertTriangle,
      titulo: `${v.tipo_nombre} — ${v.lote_nombre}`,
      sub: subtituloAlerta(v),
      href: `/jefe/asignaciones/nueva?lote_id=${v.lote_id}&tipo_tarea_id=${v.tipo_id}`,
    });
  }
  for (const p of proximas) {
    if (alertasOrdenadas.length >= 4) break;
    alertasOrdenadas.push({
      key: `p_${p.tipo_id}_${p.lote_id}`,
      estado: 'proxima',
      icono: Clock,
      titulo: `${p.tipo_nombre} — ${p.lote_nombre}`,
      sub: subtituloAlerta(p),
      href: `/jefe/asignaciones/nueva?lote_id=${p.lote_id}&tipo_tarea_id=${p.tipo_id}`,
    });
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-zelanda-beige-50/[0.97] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-zelanda-beige-200 px-4 py-3">
        <h2 className="m-0 font-serif text-lg text-zelanda-verde-900">Panel del jefe</h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Volver al mapa"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zelanda-verde-700 hover:bg-zelanda-beige-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 font-serif text-base text-zelanda-verde-900">Alertas recientes</h3>
            <Link
              href="/jefe/alertas"
              className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
            >
              Ver todas
            </Link>
          </div>
          {alertasOrdenadas.length === 0 && novedades_pendientes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
              Todo al día por ahora.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alertasOrdenadas.map((a) => (
                <AlertaItem
                  key={a.key}
                  estado={a.estado}
                  icono={a.icono}
                  titulo={a.titulo}
                  sub={a.sub}
                  href={a.href}
                />
              ))}
              {novedades_pendientes.slice(0, 2).map((n) => (
                <AlertaItem
                  key={`nov_${n.id}`}
                  estado="neutro"
                  icono={AlertCircle}
                  titulo={`${ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo} — Árbol ${n.arbol_numero}`}
                  sub={`Lote ${n.lote_nombre}`}
                  href={`/jefe/novedades/${n.id}`}
                />
              ))}
              {recordatorios
                .filter((r) => r.estado !== 'proximo')
                .slice(0, 3)
                .map((r) => (
                  <AlertaItem
                    key={`rec_${r.id}`}
                    estado={r.estado === 'vencido' ? 'vencida' : 'proxima'}
                    icono={Bell}
                    titulo={r.titulo}
                    sub={
                      r.estado === 'hoy'
                        ? `Hoy · Para ${r.asignado_a_nombre}`
                        : `Vencido · Para ${r.asignado_a_nombre}`
                    }
                    href="/recordatorios"
                  />
                ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base text-zelanda-verde-900">Atajos</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Atajo
              href="/jefe/asignaciones/nueva"
              icono={Plus}
              titulo="Asignar tarea"
              sub="Crear nueva"
            />
            <Atajo href="/jefe/lotes" icono={MapIcon} titulo="Lotes" sub="Lista y apiarios" />
            <Atajo
              href="/jefe/equipo"
              icono={Users}
              titulo="Equipo"
              sub={`${snapshot.personas.length} personas`}
            />
            <Atajo
              href="/recordatorios"
              icono={Bell}
              titulo="Recordatorios"
              sub={
                recordatorios.length > 0
                  ? `${recordatorios.length} ${
                      recordatorios.length === 1 ? 'pendiente' : 'pendientes'
                    }`
                  : 'Notas con fecha'
              }
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base text-zelanda-verde-900">Más</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Atajo
              href="/jefe/tarifas"
              icono={DollarSign}
              titulo="Tarifas"
              sub="Catálogo de pagos"
            />
            <Atajo
              href="/jefe/pagos"
              icono={DollarSign}
              titulo="Pagos"
              sub="Histórico de salidas"
            />
            <Atajo
              href="/jefe/servicios"
              icono={Briefcase}
              titulo="Servicios"
              sub="Contratos puntuales"
            />
            <Atajo
              href="/jefe/jornales"
              icono={CalendarCheck}
              titulo="Jornales"
              sub="Días trabajados"
            />
            <Atajo
              href="/jefe/ausencias"
              icono={UserMinus}
              titulo="Ausencias"
              sub="Faltas y permisos"
            />
            <Atajo href="/jefe/saldos" icono={Wallet} titulo="Saldos" sub="Cuánto se debe" />
            <Atajo
              href="/jefe/ventas"
              icono={TrendingUp}
              titulo="Ventas"
              sub="Ingresos por cliente"
            />
            <Atajo href="/jefe/clientes" icono={Users} titulo="Clientes" sub="Compradores" />
            <Atajo
              href="/jefe/compras"
              icono={ShoppingCart}
              titulo="Compras"
              sub="Costos de insumos"
            />
            <Atajo
              href="/jefe/aplicaciones"
              icono={FlaskConical}
              titulo="Aplicaciones"
              sub="Insumos por lote"
            />
            <Atajo
              href="/jefe/proveedores"
              icono={Truck}
              titulo="Proveedores"
              sub="A quién compramos"
            />
            <Atajo
              href="/jefe/reportes"
              icono={ChevronRight}
              titulo="Reportes"
              sub="Cosecha y lotes"
            />
            <Atajo href="/jefe/apiarios/1" icono={Hexagon} titulo="Apiarios" sub="Visitas y miel" />
            <Atajo
              href="/jefe/configuracion"
              icono={Settings}
              titulo="Configuración"
              sub="Parámetros de la finca"
            />
            <Atajo
              href="/jefe/movimientos"
              icono={History}
              titulo="Movimientos"
              sub="Quién registró y anuló"
            />
            <Atajo
              href="/jefe/respaldo"
              icono={Download}
              titulo="Respaldo"
              sub="Exportar datos a CSV"
            />
          </div>
        </section>

        <p className="pb-2 pt-1 text-center text-[11px] text-zelanda-verde-700/70">
          {describirActualizacion(tsCache)}
        </p>
      </div>
    </div>
  );
}
