'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, CalendarCheck, Search, Pencil } from 'lucide-react';
import { ConfirmarBorrado } from '@/components/ui/ConfirmarBorrado';
import { borrarJornal } from './acciones';

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function tituloFecha(d: Date): string {
  const texto = FORMATEADOR_FECHA.format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function claveFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Jornal = {
  id: bigint;
  fecha: Date;
  tarifa_aplicada: unknown;
  descripcion_actividad: string | null;
  notas: string | null;
  persona: { nombre_completo: string };
  lotes: { nombre: string } | null;
};

interface Props {
  jornales: Jornal[];
}

export function ListaJornales({ jornales }: Props) {
  const [busqueda, setBusqueda] = useState('');

  const lista = busqueda
    ? jornales.filter((j) =>
        j.persona.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
      )
    : jornales;

  // Agrupar por fecha la lista filtrada
  const grupos = new Map<string, Jornal[]>();
  for (const j of lista) {
    const k = claveFecha(j.fecha);
    const arr = grupos.get(k) ?? [];
    arr.push(j);
    grupos.set(k, arr);
  }
  const ordenados = Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  if (jornales.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
        <CalendarCheck className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
        <p className="mt-3 font-serif text-base text-zelanda-verde-900">Sin jornales registrados</p>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Registrá cada día trabajado de un jornalero. La tarifa queda congelada al momento de
          registrar; si cambia después, los registros anteriores no se ven afectados.
        </p>
        <Link
          href="/jefe/jornales/nuevo"
          className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Registrar primer jornal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zelanda-verde-700/50" />
        <input
          type="search"
          placeholder="Buscar por persona…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-xl border border-zelanda-beige-200 bg-white py-2 pl-9 pr-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      {busqueda && (
        <p className="text-[12px] text-zelanda-verde-700">
          {lista.length} resultado{lista.length !== 1 ? 's' : ''}
        </p>
      )}

      {busqueda && lista.length === 0 ? (
        <p className="text-center text-sm text-zelanda-verde-700 py-6">
          Sin resultados para &ldquo;{busqueda}&rdquo;
        </p>
      ) : (
        <div className="space-y-5">
          {ordenados.map(([clave, grupo]) => {
            const fecha = new Date(`${clave}T00:00:00`);
            const totalDia = grupo.reduce((acc, j) => acc + Number(j.tarifa_aplicada), 0);
            return (
              <section key={clave}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-serif text-base text-zelanda-verde-900">
                    {tituloFecha(fecha)}
                  </h2>
                  <span className="text-[11.5px] text-zelanda-verde-700">
                    {grupo.length} {grupo.length === 1 ? 'persona' : 'personas'} ·{' '}
                    {fmtMonto(totalDia)}
                  </span>
                </div>
                <ul className="space-y-2">
                  {grupo.map((j) => (
                    <li
                      key={String(j.id)}
                      className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                            {j.persona.nombre_completo}
                          </p>
                          <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                            {j.descripcion_actividad ?? 'Jornal del día'}
                            {j.lotes ? ` · Lote ${j.lotes.nombre}` : ''}
                          </p>
                        </div>
                        <span className="font-serif text-[18px] text-zelanda-verde-900">
                          {fmtMonto(Number(j.tarifa_aplicada))}
                        </span>
                      </div>
                      {j.notas ? (
                        <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">{j.notas}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Link
                          href={`/jefe/jornales/${j.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Link>
                        <ConfirmarBorrado
                          action={borrarJornal}
                          id={j.id}
                          mensaje={`¿Anular el jornal de ${j.persona.nombre_completo}? El registro quedará para trazabilidad.`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
