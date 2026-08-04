import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { KPI } from '@/components/ui/KPI';
import type { SnapshotJefe } from '@/lib/offline/tipos';

const fmtKg = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`;

function Variacion({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior <= 0) {
    return <span className="text-zelanda-verde-700">sin base del mes anterior</span>;
  }

  const pct = ((actual - anterior) / anterior) * 100;
  const sinCambio = Math.abs(pct) < 1;
  const Icono = sinCambio ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  const color = sinCambio
    ? 'text-zelanda-verde-700'
    : pct > 0
    ? 'text-zelanda-verde-600'
    : 'text-zelanda-ocre-600';

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icono className="h-3 w-3" aria-hidden />
      {sinCambio ? 'igual que' : `${Math.abs(Math.round(pct))} % vs`} el mes anterior
    </span>
  );
}

export function ResumenEjecutivo({ snapshot }: { snapshot: SnapshotJefe }) {
  const { contadores: c } = snapshot;

  return (
    <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
      <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">Resumen del mes</h2>

      <div className="grid grid-cols-2 gap-3">
        <KPI
          etiqueta="Cosecha del mes"
          valor={fmtKg(c.cosecha_mes_kg)}
          pie={<Variacion actual={c.cosecha_mes_kg} anterior={c.cosecha_mes_anterior_kg} />}
        />
        <KPI
          etiqueta="Lotes al día"
          valor={`${c.lotes_aldia}/${c.total_lotes}`}
          pie={`${c.lotes_proxima} próximos · ${c.lotes_vencida} vencidos`}
          acento={c.lotes_vencida > 0 ? 'ocre' : 'verde'}
          href="/jefe/lotes"
        />
        <KPI
          etiqueta="Tareas activas"
          valor={c.tareas_activas}
          pie={`${c.tareas_cerradas_hoy} cerradas hoy`}
          href="/jefe/asignaciones"
        />
        <KPI
          etiqueta="Stock en almacén"
          valor={fmtKg(c.stock_almacen_kg)}
          pie="listo para despachar"
          href="/jefe/almacen-vista"
        />
      </div>
    </section>
  );
}
