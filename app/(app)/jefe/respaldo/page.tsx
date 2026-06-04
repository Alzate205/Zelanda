import Link from 'next/link';
import { ChevronLeft, Download, Database } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { Eyebrow } from '@/components/ui/Eyebrow';

export const metadata = { title: 'Respaldo de datos' };

const EXPORTS: { tabla: string; titulo: string; sub: string }[] = [
  { tabla: 'pagos', titulo: 'Pagos', sub: 'Salarios, jornales, adelantos, bonos, ajustes' },
  { tabla: 'jornales', titulo: 'Jornales', sub: 'Días trabajados con su tarifa' },
  { tabla: 'ausencias', titulo: 'Ausencias', sub: 'Faltas, incapacidades, permisos' },
  { tabla: 'servicios', titulo: 'Servicios contratados', sub: 'Contratos puntuales' },
  { tabla: 'compras', titulo: 'Compras', sub: 'Compras de insumos a proveedores' },
  { tabla: 'ventas', titulo: 'Ventas y salidas', sub: 'Salidas de cosecha del almacén' },
  { tabla: 'cosechas', titulo: 'Cosechas', sub: 'Ingresos de aguacate al almacén' },
];

export default async function PaginaRespaldo() {
  await requerirUsuario('JEFE');

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
        <Eyebrow>Finca · Respaldo</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Respaldo de datos</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Descargá una copia de tus datos en CSV (se abre en Excel). Guardalos periódicamente como
          respaldo fuera de la app.
        </p>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50 px-4 py-3 text-[12.5px] text-zelanda-verde-800">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-zelanda-verde-700" />
        <p className="m-0">
          Cada archivo incluye el histórico completo (excepto registros anulados). Abrilos con Excel
          o Google Sheets.
        </p>
      </div>

      <ul className="space-y-2">
        {EXPORTS.map((e) => (
          <li key={e.tabla}>
            <a
              href={`/api/jefe/exportar?tabla=${e.tabla}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-300"
            >
              <div className="min-w-0">
                <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">{e.titulo}</p>
                <p className="m-0 mt-0.5 text-[12px] text-zelanda-verde-700">{e.sub}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-[13px] font-semibold text-zelanda-beige-50">
                <Download className="h-4 w-4" /> CSV
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
