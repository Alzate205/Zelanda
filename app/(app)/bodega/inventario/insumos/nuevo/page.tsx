import { requerirUsuario } from "@/lib/auth";
import { FormularioInsumo } from "../_formulario";

export const metadata = { title: "Nuevo insumo" };

export default async function PaginaNuevoInsumo() {
  await requerirUsuario("BODEGA");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo insumo
        </h1>
      </header>
      <FormularioInsumo modo="crear" />
    </div>
  );
}
