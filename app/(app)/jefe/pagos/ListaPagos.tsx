'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, DollarSign, Search, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmarBorrado } from '@/components/ui/ConfirmarBorrado';
import { borrarPago } from './acciones';

const ETIQUETA_TIPO: Record<string, string> = {
  SALARIO: 'Salario',
  ADELANTO: 'Adelanto',
  JORNAL: 'Jornal',
  SERVICIO: 'Servicio',
  BONO: 'Bono',
  AJUSTE: 'Ajuste',
  OTRO: 'Otro',
};

const ESTADO_POR_TIPO: Record<string, 'aldia' | 'proxima' | 'vencida' | 'neutro'> = {
  SALARIO: 'aldia',
  JORNAL: 'aldia',
  SERVICIO: 'aldia',
  BONO: 'proxima',
  ADELANTO: 'neutro',
  AJUSTE: 'vencida',
  OTRO: 'neutro',
};

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

type Pago = {
  id: bigint;
  fecha: Date;
  tipo: string;
  monto: unknown;
  metodo_pago: string | null;
  cubre_desde: Date | null;
  cubre_hasta: Date | null;
  motivo_diferencia: string | null;
  notas: string | null;
  persona: { nombre_completo: string };
};

interface Props {
  pagos: Pago[];
  totalMes: number;
}

export function ListaPagos({ pagos, totalMes }: Props) {
  const [busqueda, setBusqueda] = useState('');

  const lista = busqueda
    ? pagos.filter((p) => p.persona.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()))
    : pagos;

  if (pagos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
        <DollarSign className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
        <p className="mt-3 font-serif text-base text-zelanda-verde-900">Sin pagos registrados</p>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Acá vas a ver el histórico de todo lo que la finca le pagó a personas: sueldos, jornales,
          servicios, bonos y adelantos.
        </p>
        <Link
          href="/jefe/pagos/nuevo"
          className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Registrar primer pago
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-zelanda-verde-700">
        {pagos.length} {pagos.length === 1 ? 'pago' : 'pagos'} · {fmtMonto(totalMes)} este mes
      </p>

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
        <ul className="space-y-2">
          {lista.map((p) => {
            const monto = Number(p.monto);
            const estado = ESTADO_POR_TIPO[p.tipo] ?? 'neutro';
            return (
              <li
                key={String(p.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                      {p.persona.nombre_completo}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                      {fmtFecha(p.fecha)}
                      {p.metodo_pago ? ` · ${p.metodo_pago}` : ''}
                      {p.cubre_desde && p.cubre_hasta
                        ? ` · cubre ${fmtFecha(p.cubre_desde)} → ${fmtFecha(p.cubre_hasta)}`
                        : ''}
                    </p>
                  </div>
                  <Badge estado={estado}>{ETIQUETA_TIPO[p.tipo] ?? p.tipo}</Badge>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span
                    className={`font-serif text-[22px] ${
                      monto < 0 ? 'text-estado-vencida' : 'text-zelanda-verde-900'
                    }`}
                  >
                    {fmtMonto(monto)}
                  </span>
                </div>

                {p.motivo_diferencia ? (
                  <p className="m-0 mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
                    <span className="font-semibold">Motivo:</span> {p.motivo_diferencia}
                  </p>
                ) : null}

                {p.notas ? (
                  <p className="m-0 mt-1.5 text-[11.5px] text-zelanda-verde-700">{p.notas}</p>
                ) : null}

                <div className="mt-2 flex items-center justify-end gap-2">
                  <Link
                    href={`/jefe/pagos/${p.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <ConfirmarBorrado
                    action={borrarPago}
                    id={p.id}
                    mensaje={`¿Anular el pago de ${fmtMonto(monto)} a ${
                      p.persona.nombre_completo
                    }? El registro quedará para trazabilidad.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
