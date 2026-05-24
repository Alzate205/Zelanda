import Link from "next/link";
import { Plus, Users, ChevronLeft, Edit } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Badge } from "@/components/ui/Badge";
import { borrarCliente } from "./acciones";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

function fmtMonto(n: number): string {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default async function PaginaClientes() {
  await requerirUsuario("JEFE");

  const clientes = await prisma.clientes.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { salidas_cosecha: true } },
      salidas_cosecha: {
        where: { tipo: "VENTA" },
        select: { cantidad_kg: true, precio_total: true },
      },
    },
  });

  const activos = clientes.filter((c) => c.activo);
  const inactivos = clientes.filter((c) => !c.activo);

  function fila(c: (typeof clientes)[number]) {
    const totalKg = c.salidas_cosecha.reduce(
      (acc, s) => acc + Number(s.cantidad_kg),
      0,
    );
    const totalIngreso = c.salidas_cosecha.reduce(
      (acc, s) => acc + Number(s.precio_total ?? 0),
      0,
    );
    return (
      <li
        key={String(c.id)}
        className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
              {c.nombre}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
              {c.contacto ? c.contacto : "Sin contacto registrado"}
              {c.telefono ? ` · ${c.telefono}` : ""}
            </p>
          </div>
          {!c.activo ? <Badge estado="neutro">Inactivo</Badge> : null}
        </div>

        {c.salidas_cosecha.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
            <div>
              <span className="block text-zelanda-verde-700">Ventas</span>
              <span className="font-semibold text-zelanda-verde-900">
                {c.salidas_cosecha.length}
              </span>
            </div>
            <div>
              <span className="block text-zelanda-verde-700">Total kg</span>
              <span className="font-semibold text-zelanda-verde-900">
                {totalKg.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div>
              <span className="block text-zelanda-verde-700">Ingresos</span>
              <span className="font-semibold text-zelanda-verde-900">
                {fmtMonto(totalIngreso)}
              </span>
            </div>
          </div>
        ) : null}

        {c.notas ? (
          <p className="mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
            {c.notas}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <Link
            href={`/jefe/clientes/${c.id}/editar`}
            className="inline-flex items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-1.5 text-[11.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            <Edit className="h-3 w-3" /> Editar
          </Link>
          {c._count.salidas_cosecha === 0 ? (
            <form action={borrarCliente}>
              <input type="hidden" name="id" value={String(c.id)} />
              <button
                type="submit"
                className="rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-3 py-1.5 text-[11.5px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
              >
                Borrar
              </button>
            </form>
          ) : null}
        </div>
      </li>
    );
  }

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
          <Eyebrow>Negocio · Clientes</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Compradores
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {activos.length} activos · {inactivos.length} inactivos
          </p>
        </div>
        <Link
          href="/jefe/clientes/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Sin clientes registrados
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Registrá a quién le vendés la cosecha. Cada venta queda asociada a
            su cliente y permite ver ingresos por comprador.
          </p>
          <Link
            href="/jefe/clientes/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Registrar primero
          </Link>
        </div>
      ) : (
        <>
          {activos.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Activos
              </h2>
              <ul className="space-y-2">{activos.map(fila)}</ul>
            </section>
          ) : null}
          {inactivos.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Inactivos
              </h2>
              <ul className="space-y-2">{inactivos.map(fila)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
