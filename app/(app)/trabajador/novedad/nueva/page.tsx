import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioNovedad } from "./FormularioNovedad";

export const metadata: Metadata = { title: "Reportar novedad" };

export default async function PaginaNuevaNovedad({
  searchParams,
}: {
  searchParams: Promise<{ lote_id?: string; numero_placa?: string }>;
}) {
  await requerirUsuario();
  const sp = await searchParams;

  const lotes = await prisma.lotes.findMany({
    where: { deleted_at: null, total_arboles: { gt: 0 } },
    select: { id: true, nombre: true, total_arboles: true },
    orderBy: { nombre: "asc" },
  });

  const loteInicial = sp.lote_id && /^\d+$/.test(sp.lote_id) ? sp.lote_id : null;
  const numeroInicial =
    sp.numero_placa && /^\d+$/.test(sp.numero_placa) ? sp.numero_placa : null;

  return (
    <FormularioNovedad
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        totalArboles: l.total_arboles,
      }))}
      loteInicial={loteInicial}
      numeroInicial={numeroInicial}
    />
  );
}
