import Link from "next/link";
import { Home, PackageOpen, Warehouse, MapPin, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Instalaciones" };

type LucideIcon = typeof Home;

const ICONO: Record<string, LucideIcon> = {
  CASA: Home,
  BODEGA: PackageOpen,
  ALMACEN: Warehouse,
  OTRO: MapPin,
};

const ETIQUETA: Record<string, string> = {
  CASA: "Casa",
  BODEGA: "Bodega",
  ALMACEN: "Almacén",
  OTRO: "Otro",
};

export default async function PaginaInstalaciones() {
  await requerirUsuario("JEFE");

  const [instalaciones, fincaRows] = await Promise.all([
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        tipo: string;
        tiene_coords: boolean;
      }[]
    >`
      SELECT id, nombre, tipo::text, coordenadas IS NOT NULL AS tiene_coords
      FROM instalaciones
      WHERE activo = TRUE
      ORDER BY tipo, nombre
    `,
    prisma.$queryRaw<{ tiene: boolean }[]>`
      SELECT poligono IS NOT NULL AS tiene FROM finca LIMIT 1
    `,
  ]);
  const fincaTieneBorde = fincaRows[0]?.tiene === true;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Mapa
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Instalaciones y borde de la finca
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Capturá una sola vez la ubicación de cada elemento. Después podés editar si hace falta.
        </p>
      </header>

      <Link
        href="/jefe/instalaciones/finca"
        className="block rounded-xl border border-zelanda-ocre-300 bg-zelanda-ocre-50 p-4 shadow-card transition hover:border-zelanda-ocre-500"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Borde de la finca
            </p>
            <p className="mt-1 font-serif text-lg text-zelanda-verde-900">
              Hacienda La Zelanda
            </p>
            <p className="mt-1 text-xs text-zelanda-verde-700">
              {fincaTieneBorde ? "Capturado" : "Pendiente de capturar"}
            </p>
          </div>
          <span className="text-sm text-zelanda-verde-700">
            {fincaTieneBorde ? "Editar →" : "Capturar →"}
          </span>
        </div>
      </Link>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Instalaciones ({instalaciones.length})
          </h2>
          <Link
            href="/jefe/instalaciones/nueva"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-1.5 text-xs text-zelanda-verde-700"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Link>
        </div>
        {instalaciones.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            Sin instalaciones registradas.
          </p>
        ) : (
          <ul className="space-y-2">
            {instalaciones.map((i) => {
              const Icono = ICONO[i.tipo] ?? MapPin;
              return (
                <li key={i.id.toString()}>
                  <Link
                    href={`/jefe/instalaciones/${i.id}/ubicacion`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave transition hover:border-zelanda-verde-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zelanda-beige-100 text-zelanda-verde-700">
                        <Icono className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zelanda-verde-900">
                          {i.nombre}
                        </p>
                        <p className="text-xs text-zelanda-verde-700">
                          {ETIQUETA[i.tipo] ?? i.tipo} ·{" "}
                          {i.tiene_coords ? "Capturado" : "Pendiente"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zelanda-verde-700">
                      {i.tiene_coords ? "Editar →" : "Capturar →"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
