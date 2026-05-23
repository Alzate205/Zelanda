import { requerirUsuario } from "@/lib/auth";
import { FormularioHerramienta } from "../_formulario";

export const metadata = { title: "Nueva herramienta" };

export default async function PaginaNuevaHerramienta() {
  await requerirUsuario("BODEGA");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva herramienta
        </h1>
      </header>
      <FormularioHerramienta modo="crear" />
    </div>
  );
}
