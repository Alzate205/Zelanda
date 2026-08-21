import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CircleAlert, Plus } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estadoDeTareas } from '@/lib/fechas-tarea';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { hoyEnBogota } from '@/lib/fecha';
import { construirPlanDeSemana, lunesDeLaSemana } from '@/lib/jefe/semana';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ClimaDelDia } from '@/components/jefe/ClimaDelDia';
import { obtenerClimaFinca, type DiaPronostico } from '@/lib/jefe/clima';
import { Atrasadas } from './_atrasadas';

export const metadata: Metadata = { title: 'La semana' };
export const dynamic = 'force-dynamic';

const MS_DIA = 24 * 60 * 60 * 1000;

const DIA_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MES_CORTO = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Lo máximo que la planificación espera por el pronóstico antes de seguir sin él. */
const PRESUPUESTO_CLIMA_MS = 2500;

/** Cuántas semanas se puede mirar hacia adelante o hacia atrás. */
const TOPE_SEMANAS = 26;

function aISO(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(
    f.getDate()
  ).padStart(2, '0')}`;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'pendiente',
  EN_CURSO: 'en curso',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada',
};

export default async function PaginaSemana({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  await requerirUsuario('JEFE');
  const config = await obtenerConfiguracion();
  const { semana } = await searchParams;

  const hoy = hoyEnBogota();
  // `semana` es un desplazamiento en semanas respecto de la actual. Se acota
  // para que una dirección escrita a mano no dispare una consulta absurda.
  const desplazamiento = Math.max(-TOPE_SEMANAS, Math.min(TOPE_SEMANAS, Number(semana) || 0));
  const lunes = new Date(lunesDeLaSemana(hoy).getTime() + desplazamiento * 7 * MS_DIA);
  const domingo = new Date(lunes.getTime() + 6 * MS_DIA);
  const finExclusivo = new Date(lunes.getTime() + 7 * MS_DIA);

  const [lotes, tiposCultivo, frecuenciasOverride, completadasLote, asignacionesSemana] =
    await Promise.all([
      prisma.lotes.findMany({ where: { deleted_at: null }, select: { id: true, nombre: true } }),
      prisma.tipos_tarea.findMany({
        where: { area: 'CULTIVO', activo: true },
        select: { id: true, nombre: true, frecuencia_dias_default: true },
      }),
      prisma.frecuencias_lote.findMany({
        select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
      }),
      prisma.asignaciones.groupBy({
        by: ['lote_id', 'tipo_tarea_id'],
        where: { estado: 'COMPLETADA', lote_id: { not: null } },
        _max: { fecha_completada: true },
      }),
      // Sólo las que siguen vivas: una cancelada no cubre el hueco.
      prisma.asignaciones.findMany({
        where: {
          lote_id: { not: null },
          estado: { in: ['PENDIENTE', 'EN_CURSO', 'COMPLETADA'] },
          fecha_inicio: { gte: lunes, lt: finExclusivo },
        },
        select: {
          id: true,
          lote_id: true,
          tipo_tarea_id: true,
          fecha_inicio: true,
          estado: true,
          persona: { select: { nombre_completo: true } },
        },
      }),
    ]);

  const estados = estadoDeTareas({
    destinos: lotes.map((l) => String(l.id)),
    tipos: tiposCultivo.map((t) => ({
      id: String(t.id),
      frecuencia_dias_default: t.frecuencia_dias_default,
    })),
    frecuenciasPropias: frecuenciasOverride.map((f) => ({
      destino_id: String(f.lote_id),
      tipo_tarea_id: String(f.tipo_tarea_id),
      frecuencia_dias: f.frecuencia_dias,
    })),
    ultimas: completadasLote
      .filter((c) => c.lote_id !== null)
      .map((c) => ({
        destino_id: String(c.lote_id),
        tipo_tarea_id: String(c.tipo_tarea_id),
        fecha: c._max.fecha_completada,
      })),
    diasAlerta: config.alerta_dias_anticipacion,
  });

  // El pronóstico solo alcanza unos días, así que solo se pinta en las semanas
  // que lo cruzan.
  //
  // Va con presupuesto de tiempo: acá el jefe viene a ver sus tareas, y el
  // clima es una ayuda. Si el pronóstico no está caliente en la caché, se
  // renuncia a él en esta carga en vez de dejar la pantalla esperando a un
  // servicio de afuera. En la siguiente ya estará.
  const climaPorFecha = new Map<string, DiaPronostico>();
  try {
    const clima = await Promise.race([
      obtenerClimaFinca(),
      new Promise<null>((r) => setTimeout(() => r(null), PRESUPUESTO_CLIMA_MS)),
    ]);
    if (clima) for (const d of clima.dias) climaPorFecha.set(d.fecha, d);
  } catch {
    // sin pronóstico: las etiquetas simplemente no salen
  }

  // Si casi toda la semana está en duda, se avisa una vez acá arriba en vez de
  // repetirlo en cada día.
  const diasConPronostico = [...climaPorFecha.values()];
  const climaDudoso =
    diasConPronostico.length >= 3 &&
    diasConPronostico.filter((d) => d.confianza === 'baja').length >= diasConPronostico.length / 2;

  const plan = construirPlanDeSemana({
    estados,
    asignaciones: asignacionesSemana.map((a) => ({
      id: String(a.id),
      lote_id: String(a.lote_id),
      tipo_tarea_id: String(a.tipo_tarea_id),
      fecha_inicio: a.fecha_inicio,
      persona: a.persona?.nombre_completo ?? '—',
      estado: a.estado,
    })),
    nombres: {
      lote: (id) => lotes.find((l) => String(l.id) === id)?.nombre,
      tipo: (id) => tiposCultivo.find((t) => String(t.id) === id)?.nombre,
    },
    lunes,
    hoy,
  });

  const rotulo =
    lunes.getMonth() === domingo.getMonth()
      ? `${lunes.getDate()} al ${domingo.getDate()} de ${MES_CORTO[lunes.getMonth()]}`
      : `${lunes.getDate()} ${MES_CORTO[lunes.getMonth()]} al ${domingo.getDate()} ${
          MES_CORTO[domingo.getMonth()]
        }`;

  const enlaceSemana = (n: number) => (n === 0 ? '/jefe/semana' : `/jefe/semana?semana=${n}`);

  return (
    <div className="space-y-4">
      <div>
        <Eyebrow>Jefe · Planificación</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">La semana</h1>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-zelanda-beige-200 bg-white px-2 py-2 shadow-suave">
        <Link
          href={enlaceSemana(desplazamiento - 1)}
          aria-label="Semana anterior"
          className="min-h-touch min-w-touch flex items-center justify-center rounded-xl text-zelanda-verde-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">{rotulo}</p>
          {desplazamiento !== 0 ? (
            <Link href="/jefe/semana" className="text-[11.5px] text-zelanda-verde-700 underline">
              Volver a esta semana
            </Link>
          ) : (
            <p className="m-0 text-[11.5px] text-zelanda-verde-700">Semana actual</p>
          )}
        </div>
        <Link
          href={enlaceSemana(desplazamiento + 1)}
          aria-label="Semana siguiente"
          className="min-h-touch min-w-touch flex items-center justify-center rounded-xl text-zelanda-verde-700"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <Atrasadas atrasadas={plan.atrasadas} sinEmpezar={plan.sinEmpezar} />

      {climaDudoso ? (
        <p className="m-0 flex items-start gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-2 text-[12.5px] text-zelanda-verde-700">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Esta semana los modelos de clima no coinciden. Los días en beige pueden cambiar: volvé a
            mirar antes de comprometer la cuadrilla.
          </span>
        </p>
      ) : null}

      <div className="space-y-2">
        {plan.dias.map((d) => (
          <section
            key={aISO(d.fecha)}
            className={`rounded-2xl border p-3 shadow-suave ${
              d.esHoy
                ? 'border-zelanda-verde-300 bg-zelanda-verde-50'
                : 'border-zelanda-beige-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zelanda-verde-700">
                {DIA_CORTO[d.fecha.getDay()]} {d.fecha.getDate()}
              </span>
              {d.esHoy ? (
                <span className="rounded-full bg-zelanda-verde-700 px-2 py-0.5 text-[10px] font-medium text-zelanda-beige-50">
                  hoy
                </span>
              ) : null}
              <ClimaDelDia dia={climaPorFecha.get(aISO(d.fecha))} />
            </div>

            {d.tareas.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-zelanda-verde-700/60">Sin nada previsto.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {d.tareas.map((t) =>
                  t.asignada ? (
                    <li key={t.clave}>
                      <Link
                        href={`/jefe/asignaciones/${t.asignada.id}`}
                        className="flex min-h-touch items-center justify-between gap-2 rounded-xl bg-zelanda-beige-50 px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] text-zelanda-verde-900">
                            {t.tipo_nombre} · {t.lote_nombre}
                          </span>
                          <span className="block text-[11.5px] text-zelanda-verde-700">
                            {t.asignada.persona} ·{' '}
                            {ETIQUETA_ESTADO[t.asignada.estado] ?? t.asignada.estado.toLowerCase()}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ) : (
                    // Hueco: vence ese día y nadie lo tiene encargado. Lleva al
                    // asistente ya cargado con este lote y esta tarea.
                    <li key={t.clave}>
                      <Link
                        href={`/jefe/asignaciones/nueva?lote_id=${t.lote_id}&tipo_tarea_id=${t.tipo_tarea_id}`}
                        className="flex min-h-touch items-center justify-between gap-2 rounded-xl border border-dashed border-zelanda-ocre-300 bg-zelanda-ocre-50/60 px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] text-zelanda-verde-900">
                            {t.tipo_nombre} · {t.lote_nombre}
                          </span>
                          <span className="block text-[11.5px] text-zelanda-ocre-600">
                            sin asignar
                          </span>
                        </span>
                        <Plus className="h-4 w-4 shrink-0 text-zelanda-ocre-600" aria-hidden />
                      </Link>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="flex items-start gap-2 px-1 text-[11.5px] text-zelanda-verde-700/70">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Las tareas sin asignar salen del ciclo de cada lote. Tocá una para crear la asignación.
      </p>
    </div>
  );
}
