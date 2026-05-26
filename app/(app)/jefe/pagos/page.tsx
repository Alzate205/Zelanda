import Link from 'next/link';
import { Plus, DollarSign, ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { borrarPago } from './acciones';

export const metadata = { title: 'Pagos' };

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
  });
}

export default async function PaginaPagos() {
  await requerirUsuario('JEFE');

  const pagos = await prisma.pagos.findMany({
    orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    include: {
      persona: { select: { nombre_completo: true } },
    },
    take: 200,
  });

  const totalMes = pagos
    .filter((p) => {
      const f = new Date(p.fecha);
      const hoy = new Date();
      return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    })
    .reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Finanzas · Pagos</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Pagos registrados</h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {pagos.length} {pagos.length === 1 ? 'pago' : 'pagos'} · {fmtMonto(totalMes)} este mes
          </p>
        </div>
        <Link
          href="/jefe/pagos/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      {pagos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <DollarSign className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">Sin pagos registrados</p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Acá vas a ver el histórico de todo lo que la finca le pagó a personas: sueldos,
            jornales, servicios, bonos y adelantos.
          </p>
          <Link
            href="/jefe/pagos/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Registrar primer pago
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {pagos.map((p) => {
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

                <div className="mt-2 flex justify-end">
                  <form action={borrarPago}>
                    <input type="hidden" name="id" value={String(p.id)} />
                    <button
                      type="submit"
                      className="rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-3 py-1.5 text-[12px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
                    >
                      Borrar
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
