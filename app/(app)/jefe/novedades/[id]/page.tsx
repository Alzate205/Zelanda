import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFotoFirmada } from "@/lib/supabase/storage";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { marcarResuelta } from "./acciones";

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
        <div className="flex flex-wrap items-center gap-2">
          <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
          {n.resuelta ? (
            <BadgeBase tono="info">Resuelta</BadgeBase>
          ) : null}
          <span className="text-xs text-zelanda-verde-700">
            {formatearFechaCorta(n.fecha)}
          </span>
        </div>
        <h1 className="mt-2 font-serif text-2xl text-zelanda-verde-900">
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

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
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
        <p className="text-xs text-zelanda-verde-700">
          Resuelta el {formatearFechaCorta(n.fecha_resolucion!)}.
        </p>
      ) : (
        <form action={marcarResuelta}>
          <input type="hidden" name="novedad_id" value={String(n.id)} />
          <button
            type="submit"
            className="w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
          >
            Marcar resuelta
          </button>
        </form>
      )}
    </div>
  );
}
