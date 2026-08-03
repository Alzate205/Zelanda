'use client';

import { TrendingUp, TrendingDown, Calendar, Users, MapPin, Droplets } from 'lucide-react';
import type { SnapshotJefe } from '@/lib/offline/tipos';

type KPICard = {
  titulo: string;
  valor: string | number;
  cambio?: {
    valor: number;
    esPositivo: boolean;
  };
  icono: typeof TrendingUp;
  color: string;
  subtitulo?: string;
};

export function ResumenEjecutivo({ snapshot }: { snapshot: SnapshotJefe }) {
  const { contadores } = snapshot;

  // Calcular cambios porcentuales
  const cambioCosecha =
    contadores.cosecha_mes_anterior_kg > 0
      ? ((contadores.cosecha_mes_kg - contadores.cosecha_mes_anterior_kg) /
          contadores.cosecha_mes_anterior_kg) *
        100
      : 0;

  const kpis: KPICard[] = [
    {
      titulo: 'Cosecha del mes',
      valor: `${Math.round(contadores.cosecha_mes_kg).toLocaleString('es-CO')} kg`,
      cambio: {
        valor: Math.abs(cambioCosecha),
        esPositivo: cambioCosecha >= 0,
      },
      icono: TrendingUp,
      color: 'text-zelanda-verde-700',
      subtitulo: `vs ${contadores.cosecha_mes_anterior_kg > 0 ? Math.round(contadores.cosecha_mes_anterior_kg).toLocaleString('es-CO') + ' kg' : 'mes anterior'}`,
    },
    {
      titulo: 'Lotes al día',
      valor: `${contadores.lotes_aldia}/${contadores.total_lotes}`,
      cambio: {
        valor: Math.round((contadores.lotes_aldia / contadores.total_lotes) * 100),
        esPositivo: contadores.lotes_vencida === 0,
      },
      icono: MapPin,
      color: 'text-zelanda-verde-600',
      subtitulo: `${contadores.lotes_proxima} próximos · ${contadores.lotes_vencida} vencidos`,
    },
    {
      titulo: 'Tareas activas',
      valor: contadores.tareas_activas,
      cambio: {
        valor: contadores.tareas_cerradas_hoy,
        esPositivo: true,
      },
      icono: Users,
      color: 'text-zelanda-ocre-600',
      subtitulo: `${contadores.tareas_cerradas_hoy} completadas hoy`,
    },
    {
      titulo: 'Stock almacén',
      valor: `${Math.round(contadores.stock_almacen_kg).toLocaleString('es-CO')} kg`,
      icono: Droplets,
      color: 'text-blue-600',
      subtitulo: contadores.stock_bajo > 0 ? `⚠️ ${contadores.stock_bajo} insumos bajos` : 'Inventario saludable',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/90 p-4 shadow-card backdrop-blur-md print-limpio">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="m-0 font-serif text-base text-zelanda-verde-900">Resumen Ejecutivo</h3>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-lg bg-zelanda-verde-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zelanda-verde-700"
        >
          <Calendar className="h-3.5 w-3.5" />
          Imprimir
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => {
          const Icono = kpi.icono;
          return (
            <div
              key={kpi.titulo}
              className="rounded-xl bg-white/80 p-3 shadow-sm ring-1 ring-zelanda-beige-200"
            >
              <div className="mb-2 flex items-start justify-between">
                <Icono className={`h-5 w-5 ${kpi.color}`} />
                {kpi.cambio && (
                  <span
                    className={`flex items-center text-[10px] font-semibold ${
                      kpi.cambio.esPositivo ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {kpi.cambio.esPositivo ? (
                      <TrendingUp className="mr-0.5 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-0.5 h-3 w-3" />
                    )}
                    {kpi.cambio.valor.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="m-0 text-xl font-serif font-semibold text-zelanda-verde-900">
                {kpi.valor}
              </p>
              <p className="m-0 mt-1 text-[9px] uppercase tracking-wide text-zelanda-verde-700">
                {kpi.titulo}
              </p>
              {kpi.subtitulo && (
                <p className="m-0 mt-0.5 text-[10px] text-zelanda-verde-600">{kpi.subtitulo}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Información adicional para impresión */}
      <div className="mt-4 hidden print:block">
        <p className="text-[10px] text-zelanda-verde-700">
          Reporte generado el {new Date().toLocaleDateString('es-CO', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        <p className="text-[10px] text-zelanda-verde-700">
          Finca La Zelanda · Sistema de Gestión de Aguacates
        </p>
      </div>
    </div>
  );
}
