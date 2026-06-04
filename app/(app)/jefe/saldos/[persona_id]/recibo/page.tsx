import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { calcularSaldoPersona, periodoMes } from '@/lib/saldos';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { mesBogota } from '@/lib/fecha';
import { BotonImprimir } from '@/components/ui/BotonImprimir';

export const metadata = { title: 'Recibo' };
export const dynamic = 'force-dynamic';

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

const ETIQUETA_VINC: Record<string, string> = {
  FIJO: 'Fijo',
  JORNALERO: 'Jornalero',
  CONTRATISTA: 'Contratista',
  FAMILIAR: 'Familia',
};

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return mesBogota();
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

export default async function PaginaRecibo({
  params,
  searchParams,
}: {
  params: Promise<{ persona_id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');
  const { persona_id } = await params;
  const { mes: mesRaw } = await searchParams;
  if (!/^\d+$/.test(persona_id)) notFound();

  const { anio, mes } = parsearMes(mesRaw);
  const periodo = periodoMes(anio, mes);
  const [saldo, config] = await Promise.all([
    calcularSaldoPersona(BigInt(persona_id), periodo),
    obtenerConfiguracion(),
  ]);
  if (!saldo) notFound();

  const d = saldo.detalles;
  const claveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  // Renglones del devengado según el tipo de vínculo
  const renglones: { concepto: string; monto: number }[] = [];
  if (saldo.tipo_vinculacion === 'FIJO') {
    renglones.push({
      concepto: `Salario (${d.dias_efectivos} de ${d.dias_periodo} días${
        d.dias_ausencia_desc > 0 ? `, ${d.dias_ausencia_desc} de ausencia` : ''
      })`,
      monto: d.pago_base,
    });
  } else if (saldo.tipo_vinculacion === 'JORNALERO') {
    renglones.push({ concepto: `Jornales (${d.jornales_count})`, monto: d.jornales_total });
  } else if (saldo.tipo_vinculacion === 'CONTRATISTA') {
    renglones.push({
      concepto: `Servicios contratados (${d.servicios_count})`,
      monto: d.servicios_total_pactado,
    });
  }
  for (const ex of d.extras_destajo_items) {
    renglones.push({ concepto: `${ex.concepto} — destajo`, monto: ex.monto });
  }
  // Ajuste por REEMPLAZA_DIA: el devengado puede diferir de la suma de renglones
  const sumaRenglones = renglones.reduce((a, r) => a + r.monto, 0);
  const ajusteDestajo = saldo.devengado - sumaRenglones;

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/jefe/saldos/${persona_id}?mes=${claveMes}`}
          className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al saldo
        </Link>
        <BotonImprimir />
      </div>

      <article className="print-limpio rounded-2xl border border-zelanda-beige-200 bg-white p-6 shadow-suave">
        <header className="border-b border-zelanda-beige-300 pb-4">
          <h1 className="m-0 font-serif text-xl text-zelanda-verde-900">{config.finca_nombre}</h1>
          {(config.finca_telefono || config.finca_correo) && (
            <p className="m-0 mt-0.5 text-[12px] text-zelanda-verde-700">
              {[config.finca_telefono, config.finca_correo].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="m-0 mt-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-zelanda-verde-700">
            Comprobante de liquidación
          </p>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="m-0 text-[11px] uppercase tracking-[0.1em] text-zelanda-verde-700">
              Trabajador
            </p>
            <p className="m-0 font-serif text-[16px] text-zelanda-verde-900">{saldo.nombre}</p>
          </div>
          <div>
            <p className="m-0 text-[11px] uppercase tracking-[0.1em] text-zelanda-verde-700">
              Período
            </p>
            <p className="m-0 font-serif text-[16px] text-zelanda-verde-900">
              {MESES[mes]} {anio}
            </p>
          </div>
          {saldo.tipo_vinculacion && (
            <div>
              <p className="m-0 text-[11px] uppercase tracking-[0.1em] text-zelanda-verde-700">
                Vínculo
              </p>
              <p className="m-0 text-[14px] text-zelanda-verde-900">
                {ETIQUETA_VINC[saldo.tipo_vinculacion] ?? saldo.tipo_vinculacion}
              </p>
            </div>
          )}
        </div>

        {/* Devengado */}
        <div className="mt-5">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-zelanda-verde-700">
            Devengado
          </p>
          <table className="mt-2 w-full text-[13px] tabular-nums">
            <tbody>
              {renglones.map((r, i) => (
                <tr key={i} className="border-b border-zelanda-beige-100">
                  <td className="py-1.5 pr-2 text-zelanda-verde-800">{r.concepto}</td>
                  <td className="py-1.5 text-right text-zelanda-verde-900">{fmtMonto(r.monto)}</td>
                </tr>
              ))}
              {Math.abs(ajusteDestajo) >= 1 && (
                <tr className="border-b border-zelanda-beige-100">
                  <td className="py-1.5 pr-2 text-zelanda-verde-800">
                    Ajuste por días reemplazados por destajo
                  </td>
                  <td className="py-1.5 text-right text-zelanda-verde-900">
                    {fmtMonto(ajusteDestajo)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-2 pr-2 font-semibold text-zelanda-verde-900">Total devengado</td>
                <td className="py-2 text-right font-semibold text-zelanda-verde-900">
                  {fmtMonto(saldo.devengado)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumen */}
        <div className="mt-5 rounded-xl bg-zelanda-beige-50 p-4 text-[14px] tabular-nums">
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>Devengado</span>
            <span className="font-semibold">{fmtMonto(saldo.devengado)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2 text-zelanda-verde-800">
            <span>Pagado en el período ({d.pagos_count})</span>
            <span className="font-semibold">− {fmtMonto(saldo.pagado)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2 border-t border-zelanda-beige-300 pt-2 font-serif text-[18px]">
            <span className="text-zelanda-verde-900">Saldo</span>
            <span className={saldo.saldo < 0 ? 'text-estado-vencida' : 'text-zelanda-verde-900'}>
              {fmtMonto(saldo.saldo)}
            </span>
          </div>
          <p className="m-0 mt-1 text-right text-[11px] text-zelanda-verde-700">
            {saldo.saldo > 0 ? 'Por pagar' : saldo.saldo === 0 ? 'Al día' : 'Sobrepagado'}
          </p>
        </div>

        <footer className="mt-6 grid grid-cols-2 gap-6 pt-6 text-center text-[11px] text-zelanda-verde-700">
          <div className="border-t border-zelanda-verde-900/40 pt-1">Firma trabajador</div>
          <div className="border-t border-zelanda-verde-900/40 pt-1">Firma responsable</div>
        </footer>

        <p className="m-0 mt-4 text-[10px] text-zelanda-verde-700">
          Generado el {fmtFecha(new Date())} desde FincApp · {config.finca_nombre}. Documento
          informativo, no constituye desprendible de nómina legal.
        </p>
      </article>
    </div>
  );
}
