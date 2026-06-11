import Link from 'next/link';
import { Hexagon, Map as MapIcon } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { obtenerGeoFinca } from '@/lib/geo-finca';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

export const metadata = { title: 'Lotes' };

export default async function PaginaLotes() {
  await requerirUsuario('JEFE');

  const { lotesParaMapa, apiariosParaMapa, instParaMapa, bordeFinca } = await obtenerGeoFinca();

  const lotesSinPoligono = lotesParaMapa.filter((l) => l.geojson === null).length;
  const apSinPto = apiariosParaMapa.filter((a) => a.geojson === null).length;
  const instSinPto = instParaMapa.filter((i) => i.geojson === null).length;
  const sinBorde = bordeFinca === null;
  const totalPendiente = lotesSinPoligono + apSinPto + instSinPto + (sinBorde ? 1 : 0);

  const partesPendientes: string[] = [];
  if (lotesSinPoligono > 0)
    partesPendientes.push(`${lotesSinPoligono} lote${lotesSinPoligono === 1 ? '' : 's'}`);
  if (apSinPto > 0) partesPendientes.push(`${apSinPto} apiario${apSinPto === 1 ? '' : 's'}`);
  if (instSinPto > 0)
    partesPendientes.push(`${instSinPto} instalación${instSinPto === 1 ? '' : 'es'}`);
  if (sinBorde) partesPendientes.push('borde de la finca');

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Cultivo y apicultura</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Lotes y apiarios</h1>
        <p className="mt-0.5 text-sm text-zelanda-verde-700">
          {lotesParaMapa.length} lotes · {apiariosParaMapa.length} apiarios
        </p>
      </header>

      {totalPendiente > 0 && (
        <div className="rounded-lg border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-4 py-3 text-sm">
          <p className="font-medium text-zelanda-verde-800">Captura pendiente</p>
          <p className="mt-1 text-zelanda-verde-700">Faltan: {partesPendientes.join(', ')}.</p>
          <Link
            href="/jefe/instalaciones"
            className="mt-2 inline-block text-xs font-medium text-zelanda-verde-700 underline"
          >
            Ir a captura →
          </Link>
        </div>
      )}

      <Link
        href="/jefe"
        className="flex items-center justify-between rounded-2xl border border-zelanda-verde-300 bg-gradient-to-r from-zelanda-verde-700 to-zelanda-verde-800 px-4 py-3.5 text-zelanda-beige-50 shadow-card"
      >
        <span>
          <span className="block font-serif text-base">Abrir el mapa 3D</span>
          <span className="block text-xs text-zelanda-beige-100/80">
            Centro de control con relieve y semáforo de tareas
          </span>
        </span>
        <MapIcon className="h-5 w-5 shrink-0" aria-hidden />
      </Link>

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Lotes <span className="text-sm text-zelanda-verde-700">({lotesParaMapa.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {lotesParaMapa.map((lote) => (
            <Link
              key={lote.id}
              href={`/jefe/lotes/${lote.id}`}
              className="block rounded-2xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-lg text-zelanda-verde-900">{lote.nombre}</h3>
                <Badge estado="aldia" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
                <span>{lote.total_arboles.toLocaleString('es-CO')} árboles</span>
                {lote.hectareas != null ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{lote.hectareas.toFixed(1)} ha</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Apiarios{' '}
          <span className="text-sm text-zelanda-verde-700">({apiariosParaMapa.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {apiariosParaMapa.map((a) => (
            <Link
              key={a.id}
              href={`/jefe/apiarios/${a.id}`}
              className="block rounded-2xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <div className="flex items-center gap-2">
                <Hexagon className="h-4 w-4 shrink-0 text-zelanda-ocre-500" />
                <h3 className="font-serif text-lg text-zelanda-verde-900">{a.nombre}</h3>
              </div>
              <div className="mt-1 text-xs text-zelanda-verde-700">
                {a.total_colmenas} colmenas
                {a.ubicacion_descripcion ? ` · ${a.ubicacion_descripcion}` : ''}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
