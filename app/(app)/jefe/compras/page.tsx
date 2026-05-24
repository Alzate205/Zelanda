import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Package,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KPI } from "@/components/ui/KPI";

export const metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function fmtMonto(n: number): string {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  const hoy = new Date();
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
  }
  const [a, m] = raw.split("-");
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}`;
}

export default async function PaginaCompras({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario("JEFE");

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  const desde = new Date(anio, mes, 1);
  const hasta = new Date(anio, mes + 1, 0, 23, 59, 59, 999);

  const compras = await prisma.compras.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    orderBy: { fecha: "desc" },
    include: {
      proveedor: { select: { id: true, nombre: true } },
      items: { select: { cantidad: true } },
    },
  });

  const totalGastado = compras.reduce((acc, c) => acc + Number(c.total), 0);
  const itemsTotales = compras.reduce((acc, c) => acc + c.items.length, 0);

  // Ranking por proveedor
  const porProveedor = new Map<
    string,
    { nombre: string; proveedorId: string | null; total: number; count: number }
  >();
  for (const c of compras) {
    const key = c.proveedor ? String(c.proveedor.id) : c.proveedor_detalle ?? "(sin proveedor)";
    const nombre = c.proveedor
      ? c.proveedor.nombre
      : c.proveedor_detalle ?? "(sin proveedor)";
    const prev = porProveedor.get(key) ?? {
      nombre,
      proveedorId: c.proveedor ? String(c.proveedor.id) : null,
      total: 0,
      count: 0,
    };
    prev.total += Number(c.total);
    prev.count += 1;
    porProveedor.set(key, prev);
  }
  const rankingProveedores = Array.from(porProveedor.values()).sort(
    (a, b) => b.total - a.total,
  );

  const mesAnterior =
    mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente =
    mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

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
          <Eyebrow>Negocio · Compras</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Costos de insumos
          </h1>
        </div>
        <Link
          href="/jefe/compras/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Link
          href={`/jefe/compras?mes=${mesAnterior}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <ChevronLeft className="h-4 w-4" /> Ant
        </Link>
        <div className="text-center">
          <p className="font-serif text-[16px] text-zelanda-verde-900">
            {MESES[mes]} {anio}
          </p>
          <p className="text-[11px] text-zelanda-verde-700">
            {compras.length} {compras.length === 1 ? "compra" : "compras"}
          </p>
        </div>
        <Link
          href={`/jefe/compras?mes=${mesSiguiente}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Sig <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <KPI
          etiqueta="Gastado"
          valor={fmtMonto(totalGastado)}
          pie={`${compras.length} compras`}
          acento="ocre"
        />
        <KPI
          etiqueta="Items"
          valor={itemsTotales}
          pie={`insumos distintos`}
        />
        <KPI
          etiqueta="Proveedores"
          valor={rankingProveedores.length}
          pie="distintos en el mes"
        />
        <KPI
          etiqueta="Ticket promedio"
          valor={fmtMonto(compras.length > 0 ? totalGastado / compras.length : 0)}
          pie={compras.length > 0 ? `${compras.length} operaciones` : "—"}
        />
      </div>

      {rankingProveedores.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Por proveedor
          </h2>
          <ul className="space-y-2">
            {rankingProveedores.map((r, i) => (
              <li key={i}>
                <div className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
                  <div className="flex items-center justify-between">
                    <p className="font-serif text-[14.5px] text-zelanda-verde-900">
                      {r.nombre}
                    </p>
                    <span className="font-serif text-[15px] text-zelanda-verde-900">
                      {fmtMonto(r.total)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    {r.count} {r.count === 1 ? "compra" : "compras"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Compras del mes
        </h2>
        {compras.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
            <p className="mt-3 font-serif text-base text-zelanda-verde-900">
              Sin compras este mes
            </p>
            <p className="mt-1 text-sm text-zelanda-verde-700">
              Registrá las compras de insumos para llevar costos y actualizar
              stock automáticamente.
            </p>
            <Link
              href="/jefe/compras/nueva"
              className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              <Plus className="h-4 w-4" /> Registrar primera
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {compras.map((c) => (
              <li key={String(c.id)}>
                <Link
                  href={`/jefe/compras/${c.id}`}
                  className="block rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[14.5px] text-zelanda-verde-900">
                        {c.proveedor
                          ? c.proveedor.nombre
                          : c.proveedor_detalle ?? "(sin proveedor)"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-zelanda-verde-700">
                        <Package className="h-3 w-3" />
                        {c.items.length}{" "}
                        {c.items.length === 1 ? "item" : "items"} · {fmtFecha(c.fecha)}
                        {c.numero_factura ? ` · Fact. ${c.numero_factura}` : ""}
                      </p>
                    </div>
                    <span className="font-serif text-[16px] text-zelanda-verde-900">
                      {fmtMonto(Number(c.total))}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
