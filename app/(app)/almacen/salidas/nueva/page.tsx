import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioSalida } from "./_formulario";

export const metadata = { title: "Nueva salida" };

export default async function PaginaNuevaSalida() {
  await requerirUsuario("ALMACEN");
  const rows = await prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `;
  const stock = Number(rows[0]?.stock_kg ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva salida
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Stock disponible: {stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
      </header>
      <FormularioSalida stockMax={stock} />
    </div>
  );
}
