import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListaNovedadesCliente, type NovedadResumen } from "./_lista-cliente";

export const metadata = { title: "Novedades" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ resueltas?: string }>;

export default async function PaginaNovedades({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;
  const verResueltas = sp.resueltas === "si";

  const novedades = await prisma.novedades.findMany({
    where: { resuelta: verResueltas },
    orderBy: { fecha: "desc" },
    take: 200,
    include: {
      arboles: {
        select: {
          numero_placa: true,
          lotes: { select: { nombre: true } },
        },
      },
      persona: { select: { nombre_completo: true } },
    },
  });

  const resumen: NovedadResumen[] = novedades.map((n) => ({
    id: String(n.id),
    tipo: n.tipo,
    arbol_numero: n.arboles.numero_placa,
    lote_nombre: n.arboles.lotes.nombre,
    persona_nombre: n.persona.nombre_completo,
    descripcion: n.descripcion,
    fecha: n.fecha.toISOString(),
    resuelta: n.resuelta,
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reportes de campo
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Novedades
        </h1>
      </header>

      <ListaNovedadesCliente novedades={resumen} verResueltas={verResueltas} />
    </div>
  );
}
