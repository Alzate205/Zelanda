import Link from 'next/link';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { calcularSaldosPeriodo, periodoMes } from '@/lib/saldos';

export const metadata = { title: 'Saldos' };
const ETIQUETA_VINC: Record<string, string> = {
  FIJO: 'Fijo',
  JORNALERO: 'Jornalero',
  CONTRATISTA: 'Contratista',
  FAMILIAR: 'Familia',
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

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  const hoy = new Date();
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
  }
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaSaldos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  const periodo = periodoMes(anio, mes);
  const saldos = await calcularSaldosPeriodo(periodo);

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

  // Totales
  const totalDevengado = saldos.reduce((acc, s) => acc + s.devengado, 0);
  const totalPagado = saldos.reduce((acc, s) => acc + s.pagado, 0);
  const totalSaldo = totalDevengado - totalPagado;

  // Ordenar: saldo descendente (mayor deuda arriba), familiares al final
  const ordenados = [...saldos].sort((a, b) => {
    if (a.tipo_vinculacion === 'FAMILIAR' && b.tipo_vinculacion !== 'FAMILIAR') return 1;
    if (b.tipo_vinculacion === 'FAMILIAR' && a.tipo_vinculacion !== 'FAMILIAR') return -1;
    return b.saldo - a.saldo;
  });

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
        <Eyebrow>Finanzas · Saldos</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">¿Cuánto se debe?</h1>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Link
          href={`/jefe/saldos?mes=${mesAnterior}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <ChevronLeft className="h-4 w-4" /> Ant
        </Link>
        <div className="text-center">
          <p className="font-serif text-[16px] text-zelanda-verde-900">
            {MESES[mes]} {anio}
          </p>
          <p className="text-[11px] text-zelanda-verde-700">
            {ordenados.length} {ordenados.length === 1 ? 'persona' : 'personas'}
          </p>
        </div>
        <Link
          href={`/jefe/saldos?mes=${mesSiguiente}`}
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
            <p className="mt-1 font-serif text-[16px] text-zelanda-verde-900">
              {fmtMonto(totalDevengado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Pagado
            </p>
            <p className="mt-1 font-serif text-[16px] text-zelanda-verde-900">
              {fmtMonto(totalPagado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Saldo
            </p>
            <p
              className={`mt-1 font-serif text-[16px] ${
                totalSaldo > 0
                  ? 'text-zelanda-verde-900'
                  : totalSaldo === 0
                  ? 'text-estado-aldia'
                  : 'text-estado-vencida'
              }`}
            >
              {fmtMonto(totalSaldo)}
            </p>
          </div>
        </div>
      </section>

      {ordenados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <Wallet className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">Sin personas activas</p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Agregá miembros al equipo para ver saldos.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ordenados.map((s) => {
            const aplicaSaldo = s.tipo_vinculacion !== null && s.tipo_vinculacion !== 'FAMILIAR';
            return (
              <li key={String(s.persona_id)}>
                <Link
                  href={`/jefe/saldos/${s.persona_id}?mes=${aClaveMes(anio, mes)}`}
                  className="block rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                        {s.nombre}
                      </p>
                      <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                        {s.tipo_vinculacion ? ETIQUETA_VINC[s.tipo_vinculacion] : 'Sin vinculación'}
                      </p>
                    </div>
                    {aplicaSaldo ? (
                      <Badge estado={s.saldo > 0 ? 'proxima' : s.saldo === 0 ? 'aldia' : 'vencida'}>
                        {s.saldo > 0 ? 'Por pagar' : s.saldo === 0 ? 'Al día' : 'Sobrepagado'}
                      </Badge>
                    ) : (
                      <Badge estado="neutro">N/A</Badge>
                    )}
                  </div>
                  {aplicaSaldo ? (
                    <>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
                        <div>
                          <span className="block text-zelanda-verde-700">Dev.</span>
                          <span className="font-semibold text-zelanda-verde-900">
                            {fmtMonto(s.devengado)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zelanda-verde-700">Pag.</span>
                          <span className="font-semibold text-zelanda-verde-900">
                            {fmtMonto(s.pagado)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zelanda-verde-700">Saldo</span>
                          <span
                            className={`font-semibold ${
                              s.saldo > 0
                                ? 'text-zelanda-verde-900'
                                : s.saldo === 0
                                ? 'text-estado-aldia'
                                : 'text-estado-vencida'
                            }`}
                          >
                            {fmtMonto(s.saldo)}
                          </span>
                        </div>
                      </div>
                      {s.detalles.extras_destajo > 0 ? (
                        <p className="mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1 text-[11px] text-zelanda-verde-800">
                          + {fmtMonto(s.detalles.extras_destajo)} en destajo
                          {s.detalles.extras_destajo_items.length > 1
                            ? ` (${s.detalles.extras_destajo_items.length} eventos)`
                            : ''}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-2 text-center text-[11px] text-zelanda-verde-700/70">
        Devengado: salario prorrateado (fijos) · jornales (jornaleros) · contratos iniciados en el
        mes (contratistas). Destajo (kg cosechados, árboles trabajados) se aplica según el esquema
        configurado en la vinculación. Pagado: suma de todos los pagos del mes.
      </p>
    </div>
  );
}
