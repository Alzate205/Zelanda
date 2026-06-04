import Link from 'next/link';
import { ChevronLeft, FilePlus2, Ban } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';

export const metadata = { title: 'Movimientos' };
export const dynamic = 'force-dynamic';

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFechaHora(d: Date): string {
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

type Evento = {
  fecha: Date;
  accion: 'creó' | 'anuló';
  modulo: string;
  detalle: string;
  actor: string;
};

export default async function PaginaMovimientos() {
  await requerirUsuario('JEFE');

  const [pagos, jornales, ausencias, servicios] = await Promise.all([
    prisma.pagos.findMany({
      include: {
        persona: { select: { nombre_completo: true } },
        usuarios: { select: { nombre_completo: true } },
        borrado_por_u: { select: { nombre_completo: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 120,
    }),
    prisma.jornales.findMany({
      include: {
        persona: { select: { nombre_completo: true } },
        usuarios: { select: { nombre_completo: true } },
        borrado_por_u: { select: { nombre_completo: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 120,
    }),
    prisma.ausencias.findMany({
      include: {
        persona: { select: { nombre_completo: true } },
        usuarios: { select: { nombre_completo: true } },
        borrado_por_u: { select: { nombre_completo: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 120,
    }),
    prisma.servicios_contratados.findMany({
      include: {
        persona: { select: { nombre_completo: true } },
        usuarios: { select: { nombre_completo: true } },
        borrado_por_u: { select: { nombre_completo: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 120,
    }),
  ]);

  const eventos: Evento[] = [];

  for (const p of pagos) {
    const detalle = `${p.tipo} de ${fmtMonto(Number(p.monto))} a ${p.persona.nombre_completo}`;
    eventos.push({
      fecha: p.created_at,
      accion: 'creó',
      modulo: 'Pago',
      detalle,
      actor: p.usuarios?.nombre_completo ?? '—',
    });
    if (p.borrado_en) {
      eventos.push({
        fecha: p.borrado_en,
        accion: 'anuló',
        modulo: 'Pago',
        detalle,
        actor: p.borrado_por_u?.nombre_completo ?? '—',
      });
    }
  }

  for (const j of jornales) {
    const detalle = `${fmtMonto(Number(j.tarifa_aplicada))} a ${j.persona.nombre_completo}`;
    eventos.push({
      fecha: j.created_at,
      accion: 'creó',
      modulo: 'Jornal',
      detalle,
      actor: j.usuarios?.nombre_completo ?? '—',
    });
    if (j.borrado_en) {
      eventos.push({
        fecha: j.borrado_en,
        accion: 'anuló',
        modulo: 'Jornal',
        detalle,
        actor: j.borrado_por_u?.nombre_completo ?? '—',
      });
    }
  }

  for (const a of ausencias) {
    const detalle = `${a.tipo} de ${a.persona.nombre_completo}`;
    eventos.push({
      fecha: a.created_at,
      accion: 'creó',
      modulo: 'Ausencia',
      detalle,
      actor: a.usuarios?.nombre_completo ?? '—',
    });
    if (a.borrado_en) {
      eventos.push({
        fecha: a.borrado_en,
        accion: 'anuló',
        modulo: 'Ausencia',
        detalle,
        actor: a.borrado_por_u?.nombre_completo ?? '—',
      });
    }
  }

  for (const s of servicios) {
    const detalle = `${s.descripcion} (${fmtMonto(Number(s.monto_pactado))}) — ${
      s.persona.nombre_completo
    }`;
    eventos.push({
      fecha: s.created_at,
      accion: 'creó',
      modulo: 'Servicio',
      detalle,
      actor: s.usuarios?.nombre_completo ?? '—',
    });
    if (s.borrado_en) {
      eventos.push({
        fecha: s.borrado_en,
        accion: 'anuló',
        modulo: 'Servicio',
        detalle,
        actor: s.borrado_por_u?.nombre_completo ?? '—',
      });
    }
  }

  eventos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  const recientes = eventos.slice(0, 80);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <Eyebrow>Finca · Auditoría</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Movimientos</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Quién registró y quién anuló cada movimiento de dinero. Las anulaciones quedan acá aunque
          ya no aparezcan en las listas.
        </p>
      </header>

      {recientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {recientes.map((e, i) => {
            const anulado = e.accion === 'anuló';
            return (
              <li
                key={i}
                className={`rounded-xl border bg-white p-3 shadow-suave ${
                  anulado ? 'border-estado-vencida/30' : 'border-zelanda-beige-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      anulado
                        ? 'bg-estado-vencida/10 text-estado-vencida'
                        : 'bg-zelanda-verde-700/10 text-zelanda-verde-700'
                    }`}
                  >
                    {anulado ? <Ban className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] text-zelanda-verde-900">
                      <span className="font-semibold">{e.actor}</span>{' '}
                      <span className={anulado ? 'text-estado-vencida' : 'text-zelanda-verde-700'}>
                        {e.accion}
                      </span>{' '}
                      {e.modulo.toLowerCase()}: {e.detalle}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-zelanda-verde-700">
                      {fmtFechaHora(e.fecha)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
