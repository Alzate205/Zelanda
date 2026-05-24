import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Badge } from "@/components/ui/Badge";
import { cambiarEstadoServicio, borrarServicio } from "../acciones";

export const metadata = { title: "Servicio contratado" };
export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  ACUERDO: "Acuerdo",
  EN_CURSO: "En curso",
  TERMINADO: "Terminado",
  CANCELADO: "Cancelado",
};

const ESTADO_BADGE: Record<string, "aldia" | "proxima" | "vencida" | "neutro"> =
  {
    ACUERDO: "proxima",
    EN_CURSO: "aldia",
    TERMINADO: "neutro",
    CANCELADO: "vencida",
  };

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

export default async function PaginaDetalleServicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const servicio = await prisma.servicios_contratados.findUnique({
    where: { id },
    include: {
      persona: { select: { id: true, nombre_completo: true } },
      lotes: { select: { nombre: true } },
      pagos: {
        orderBy: { fecha: "desc" },
      },
    },
  });

  if (!servicio) notFound();

  const pactado = Number(servicio.monto_pactado);
  const pagado = servicio.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const saldo = pactado - pagado;
  const estadoBadge = ESTADO_BADGE[servicio.estado] ?? "neutro";

  const proxEstado: Record<string, string | null> = {
    ACUERDO: "EN_CURSO",
    EN_CURSO: "TERMINADO",
    TERMINADO: null,
    CANCELADO: null,
  };
  const siguiente = proxEstado[servicio.estado];

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/servicios"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Servicios
      </Link>

      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>Servicio · {servicio.persona.nombre_completo}</Eyebrow>
            <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
              {servicio.descripcion}
            </h1>
            <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
              {fmtFecha(servicio.fecha_inicio)}
              {servicio.fecha_fin
                ? ` → ${fmtFecha(servicio.fecha_fin)}`
                : " → en curso"}
              {servicio.lotes ? ` · Lote ${servicio.lotes.nombre}` : ""}
            </p>
          </div>
          <Badge estado={estadoBadge}>{ETIQUETA_ESTADO[servicio.estado]}</Badge>
        </div>
      </header>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Pactado
            </p>
            <p className="mt-1 font-serif text-[18px] text-zelanda-verde-900">
              {fmtMonto(pactado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Pagado
            </p>
            <p className="mt-1 font-serif text-[18px] text-zelanda-verde-900">
              {fmtMonto(pagado)}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Saldo
            </p>
            <p
              className={`mt-1 font-serif text-[18px] ${
                saldo > 0
                  ? "text-zelanda-verde-900"
                  : saldo === 0
                    ? "text-estado-aldia"
                    : "text-estado-vencida"
              }`}
            >
              {fmtMonto(saldo)}
            </p>
          </div>
        </div>

        {servicio.notas ? (
          <p className="mt-3 rounded-[8px] bg-zelanda-beige-100 px-3 py-2 text-[12.5px] text-zelanda-verde-800">
            {servicio.notas}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {siguiente ? (
            <form action={cambiarEstadoServicio}>
              <input type="hidden" name="id" value={String(servicio.id)} />
              <input type="hidden" name="estado" value={siguiente} />
              <button
                type="submit"
                className="rounded-[10px] bg-zelanda-verde-700 px-3 py-1.5 text-[12.5px] font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800"
              >
                Marcar como {ETIQUETA_ESTADO[siguiente]}
              </button>
            </form>
          ) : null}
          {servicio.estado !== "CANCELADO" && servicio.estado !== "TERMINADO" ? (
            <form action={cambiarEstadoServicio}>
              <input type="hidden" name="id" value={String(servicio.id)} />
              <input type="hidden" name="estado" value="CANCELADO" />
              <button
                type="submit"
                className="rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-1.5 text-[12.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
              >
                Cancelar contrato
              </button>
            </form>
          ) : null}
          <form action={borrarServicio} className="ml-auto">
            <input type="hidden" name="id" value={String(servicio.id)} />
            <button
              type="submit"
              className="rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-3 py-1.5 text-[12.5px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
            >
              Borrar
            </button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Pagos
          </h2>
          <Link
            href={`/jefe/pagos/nuevo?servicio_id=${servicio.id}&persona_id=${servicio.persona.id}&tipo=SERVICIO`}
            className="inline-flex items-center gap-1 rounded-[10px] bg-zelanda-verde-700 px-2.5 py-1.5 text-[12px] font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar pago
          </Link>
        </div>
        {servicio.pagos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-6 text-center text-sm text-zelanda-verde-700">
            Aún no hay pagos para este contrato.
          </p>
        ) : (
          <ul className="space-y-2">
            {servicio.pagos.map((p) => (
              <li
                key={String(p.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-serif text-[15px] text-zelanda-verde-900">
                      {fmtMonto(Number(p.monto))}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                      {fmtFecha(p.fecha)}
                      {p.metodo_pago ? ` · ${p.metodo_pago}` : ""}
                    </p>
                  </div>
                </div>
                {p.notas ? (
                  <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">
                    {p.notas}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
