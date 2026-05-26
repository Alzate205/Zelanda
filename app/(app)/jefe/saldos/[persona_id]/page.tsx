import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { calcularSaldoPersona, periodoMes } from '@/lib/saldos';
import { mesBogota } from '@/lib/fecha';

export const metadata = { title: 'Saldo de la persona' };

const ETIQUETA_VINC: Record<string, string> = {
  FIJO: 'Fijo',
  JORNALERO: 'Jornalero',
  CONTRATISTA: 'Contratista',
  FAMILIAR: 'Familia',
};

const ETIQUETA_TIPO_PAGO: Record<string, string> = {
  SALARIO: 'Salario',
  ADELANTO: 'Adelanto',
  JORNAL: 'Jornal',
  SERVICIO: 'Servicio',
  BONO: 'Bono',
  AJUSTE: 'Ajuste',
  OTRO: 'Otro',
};

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  // DATE fields de Prisma llegan como UTC midnight; timeZone 'UTC' evita corrimiento al día anterior.
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return mesBogota();
  }
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaSaldoPersona({
  params,
  searchParams,
}: {
  params: Promise<{ persona_id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');
  const { persona_id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const personaId = BigInt(idRaw);

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  const periodo = periodoMes(anio, mes);

  const saldo = await calcularSaldoPersona(personaId, periodo);
  if (!saldo) notFound();

  // Eventos detallados del periodo para mostrar el desglose
  const [jornales, ausencias, servicios, pagos] = await Promise.all([
    prisma.jornales.findMany({
      where: {
        persona_id: personaId,
        fecha: { gte: periodo.desde, lte: periodo.hasta },
        borrado_en: null,
      },
      orderBy: { fecha: 'asc' },
      include: { lotes: { select: { nombre: true } } },
    }),
    prisma.ausencias.findMany({
      where: {
        persona_id: personaId,
        fecha: { gte: periodo.desde, lte: periodo.hasta },
        borrado_en: null,
      },
      orderBy: { fecha: 'asc' },
    }),
    prisma.servicios_contratados.findMany({
      where: {
        persona_id: personaId,
        fecha_inicio: { gte: periodo.desde, lte: periodo.hasta },
      },
      orderBy: { fecha_inicio: 'asc' },
    }),
    prisma.pagos.findMany({
      where: {
        persona_id: personaId,
        fecha: { gte: periodo.desde, lte: periodo.hasta },
        borrado_en: null,
      },
      orderBy: { fecha: 'asc' },
    }),
  ]);

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

  return (
    <div className="space-y-5">
      <Link
        href={`/jefe/saldos?mes=${aClaveMes(anio, mes)}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Saldos
      </Link>

      <header>
        <Eyebrow>
          {MESES[mes]} {anio} ·{' '}
          {saldo.tipo_vinculacion ? ETIQUETA_VINC[saldo.tipo_vinculacion] : 'Sin vinculación'}
        </Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{saldo.nombre}</h1>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Link
          href={`/jefe/saldos/${personaId}?mes=${mesAnterior}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <ChevronLeft className="h-4 w-4" /> Ant
        </Link>
        <p className="font-serif text-[15px] text-zelanda-verde-900">
          {MESES[mes]} {anio}
        </p>
        <Link
          href={`/jefe/saldos/${personaId}?mes=${mesSiguiente}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Sig <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Devengado
            </p>
            <p className="mt-1 font-serif text-[18px] text-zelanda-verde-900">
              {fmtMonto(saldo.devengado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Pagado
            </p>
            <p className="mt-1 font-serif text-[18px] text-zelanda-verde-900">
              {fmtMonto(saldo.pagado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Saldo
            </p>
            <p
              className={`mt-1 font-serif text-[18px] ${
                saldo.saldo > 0
                  ? 'text-zelanda-verde-900'
                  : saldo.saldo === 0
                  ? 'text-estado-aldia'
                  : 'text-estado-vencida'
              }`}
            >
              {fmtMonto(saldo.saldo)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            href={`/jefe/pagos/nuevo?persona_id=${personaId}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-zelanda-verde-700 px-3 py-1.5 text-[12.5px] font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar pago
          </Link>
        </div>
      </section>

      {saldo.tipo_vinculacion === 'FIJO' ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">Desglose como fijo</h2>
          <ul className="space-y-1.5 text-[13px] text-zelanda-verde-800">
            <li className="flex justify-between">
              <span>Salario base</span>
              <span className="font-semibold">{fmtMonto(saldo.salario_base ?? 0)}</span>
            </li>
            <li className="flex justify-between">
              <span>Salario diario</span>
              <span className="font-semibold">{fmtMonto(saldo.detalles.salario_diario)}</span>
            </li>
            <li className="flex justify-between">
              <span>Días del mes</span>
              <span className="font-semibold">{saldo.detalles.dias_periodo}</span>
            </li>
            <li className="flex justify-between">
              <span>Ausencias que descuentan</span>
              <span className="font-semibold">−{saldo.detalles.dias_ausencia_desc}</span>
            </li>
            <li className="flex justify-between border-t border-zelanda-beige-200 pt-1.5">
              <span className="font-semibold">Días efectivos</span>
              <span className="font-semibold">{saldo.detalles.dias_efectivos}</span>
            </li>
          </ul>
        </section>
      ) : null}

      {saldo.detalles.extras_destajo_items.length > 0 ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-serif text-base text-zelanda-verde-900">Destajo del mes</h2>
            <span className="text-[11.5px] text-zelanda-verde-700">
              {saldo.esquema_pago_destajo === 'ADICIONAL'
                ? 'suma al salario'
                : saldo.esquema_pago_destajo === 'REEMPLAZA_DIA'
                ? 'reemplaza días con destajo'
                : saldo.esquema_pago_destajo === 'SOLO_DESTAJO'
                ? 'único pago'
                : 'no aplica'}
            </span>
          </div>
          <ul className="space-y-1.5">
            {saldo.detalles.extras_destajo_items.map((x, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-[10px] border border-zelanda-beige-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[13.5px] text-zelanda-verde-900">
                    {fmtFecha(x.fecha)} · {x.concepto}
                  </p>
                  <p className="text-[11.5px] text-zelanda-verde-700">
                    {x.cantidad.toLocaleString('es-CO', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    {x.unidad} × {fmtMonto(x.tarifa)}
                  </p>
                </div>
                <span className="font-serif text-[14px] text-zelanda-verde-900">
                  {fmtMonto(x.monto)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center justify-between border-t border-zelanda-beige-200 pt-2 text-[13.5px]">
            <span className="font-semibold text-zelanda-verde-900">Total destajo</span>
            <span className="font-serif text-[15px] text-zelanda-verde-900">
              {fmtMonto(saldo.detalles.extras_destajo)}
            </span>
          </p>
          {saldo.esquema_pago_destajo === 'REEMPLAZA_DIA' && saldo.detalles.dias_con_destajo > 0 ? (
            <p className="mt-1 text-[11.5px] text-zelanda-verde-700">
              {saldo.detalles.dias_con_destajo} día(s) con destajo · base se descuenta proporcional
            </p>
          ) : null}
        </section>
      ) : saldo.esquema_pago_destajo &&
        saldo.esquema_pago_destajo !== 'NUNCA' &&
        (saldo.tipo_vinculacion === 'FIJO' || saldo.tipo_vinculacion === 'JORNALERO') ? (
        <section className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-zelanda-beige-50 p-4 text-center">
          <p className="text-[12.5px] text-zelanda-verde-700">
            Esta persona tiene esquema de destajo configurado, pero no hubo registros (árboles
            trabajados o kg cosechados) con tarifas vigentes este mes.
          </p>
        </section>
      ) : null}

      {jornales.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Jornales del mes ({jornales.length})
          </h2>
          <ul className="space-y-1.5">
            {jornales.map((j) => (
              <li
                key={String(j.id)}
                className="flex items-center justify-between rounded-[10px] border border-zelanda-beige-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[13.5px] text-zelanda-verde-900">
                    {fmtFecha(j.fecha)}
                    {j.lotes ? ` · Lote ${j.lotes.nombre}` : ''}
                  </p>
                  {j.descripcion_actividad ? (
                    <p className="text-[11.5px] text-zelanda-verde-700">
                      {j.descripcion_actividad}
                    </p>
                  ) : null}
                </div>
                <span className="font-serif text-[14px] text-zelanda-verde-900">
                  {fmtMonto(Number(j.tarifa_aplicada))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {servicios.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Contratos del mes ({servicios.length})
          </h2>
          <ul className="space-y-1.5">
            {servicios.map((s) => (
              <li
                key={String(s.id)}
                className="rounded-[10px] border border-zelanda-beige-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13.5px] font-semibold text-zelanda-verde-900">
                    {s.descripcion}
                  </p>
                  <span className="font-serif text-[14px] text-zelanda-verde-900">
                    {fmtMonto(Number(s.monto_pactado))}
                  </span>
                </div>
                <p className="text-[11.5px] text-zelanda-verde-700">
                  Desde {fmtFecha(s.fecha_inicio)} · {s.estado}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ausencias.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Ausencias del mes ({ausencias.length})
          </h2>
          <ul className="space-y-1.5">
            {ausencias.map((a) => (
              <li
                key={String(a.id)}
                className="flex items-center justify-between rounded-[10px] border border-zelanda-beige-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[13.5px] text-zelanda-verde-900">
                    {fmtFecha(a.fecha)} · {a.tipo}
                  </p>
                  {a.observaciones ? (
                    <p className="text-[11.5px] text-zelanda-verde-700">{a.observaciones}</p>
                  ) : null}
                </div>
                <span className="text-[11.5px] text-zelanda-verde-700">
                  {a.descontable ? 'Descuenta' : 'No descuenta'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pagos.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Pagos del mes ({pagos.length})
          </h2>
          <ul className="space-y-1.5">
            {pagos.map((p) => (
              <li
                key={String(p.id)}
                className="flex items-center justify-between rounded-[10px] border border-zelanda-beige-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[13.5px] text-zelanda-verde-900">
                    {fmtFecha(p.fecha)} · {ETIQUETA_TIPO_PAGO[p.tipo] ?? p.tipo}
                  </p>
                  {p.metodo_pago ? (
                    <p className="text-[11.5px] text-zelanda-verde-700">{p.metodo_pago}</p>
                  ) : null}
                </div>
                <span className="font-serif text-[14px] text-zelanda-verde-900">
                  {fmtMonto(Number(p.monto))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
