import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFotoFirmada } from "@/lib/supabase/storage";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { reabrirNovedad } from "./acciones";
import { FormularioResolverNovedad } from "./_resolver";

export const metadata: Metadata = { title: "Novedad" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function DetalleNovedad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const n = await prisma.novedades.findUnique({
    where: { id: idBig },
    include: {
      arboles: {
        select: {
          numero_placa: true,
          lote_id: true,
          lotes: { select: { id: true, nombre: true } },
        },
      },
      persona: { select: { nombre_completo: true } },
    },
  });

  if (!n) notFound();

  const urlFoto = n.foto_path ? await urlFotoFirmada(n.foto_path) : null;

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/novedades"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Novedades
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reporte de campo
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
          {n.resuelta ? <BadgeBase tono="info">Resuelta</BadgeBase> : null}
          <span className="text-[11.5px] text-zelanda-verde-700">
            {formatearFechaCorta(n.fecha)}
          </span>
        </div>
        <h1 className="mt-1.5 font-serif text-2xl text-zelanda-verde-900">
          Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Reportada por {n.persona.nombre_completo}
        </p>
        <Link
          href={`/jefe/lotes/${n.arboles.lote_id}/arbol/${n.arboles.numero_placa}`}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-zelanda-beige-300 px-2.5 py-1 text-xs text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Ver historial del árbol →
        </Link>
      </header>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">Descripción</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zelanda-verde-800">
          {n.descripcion}
        </p>
      </section>

      {urlFoto ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-card">
          <Image
            src={urlFoto}
            alt="Foto de la novedad"
            width={800}
            height={600}
            className="h-auto w-full rounded-lg object-cover"
            unoptimized
          />
        </section>
      ) : null}

      {n.resuelta ? (
        <section className="rounded-xl border border-zelanda-verde-300 bg-zelanda-verde-50/40 p-4 shadow-card">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-zelanda-verde-700" />
            <p className="text-sm font-medium text-zelanda-verde-900">
              Resuelta el {formatearFechaCorta(n.fecha_resolucion!)}
            </p>
          </div>
          {n.notas_resolucion ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zelanda-verde-800">
              {n.notas_resolucion}
            </p>
          ) : (
            <p className="mt-2 text-xs italic text-zelanda-verde-700/70">
              Sin notas de resolución.
            </p>
          )}
          <form action={reabrirNovedad} className="mt-3">
            <input type="hidden" name="novedad_id" value={String(n.id)} />
            <button
              type="submit"
              className="text-xs text-zelanda-verde-700 underline hover:text-zelanda-verde-900"
            >
              Reabrir novedad
            </button>
          </form>
        </section>
      ) : (
        <>
          <Link
            href={`/jefe/asignaciones/nueva?lote_id=${n.arboles.lote_id}`}
            className="flex items-center justify-center gap-2 rounded-lg border border-zelanda-ocre-400 bg-zelanda-ocre-50 px-4 py-3 text-sm font-medium text-zelanda-ocre-800 transition hover:bg-zelanda-ocre-100"
          >
            <Plus className="h-4 w-4" />
            Crear asignación para atender en el lote
          </Link>
          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Marcar como resuelta
            </h2>
            <p className="mt-1 text-xs text-zelanda-verde-700">
              Dejá nota de qué se hizo para que el histórico quede claro.
            </p>
            <div className="mt-3">
              <FormularioResolverNovedad novedadId={String(n.id)} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
