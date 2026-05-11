import { requerirUsuario } from "@/lib/auth";
import { FormularioNuevoMiembro } from "./FormularioNuevoMiembro";

export const metadata = { title: "Nuevo miembro" };

export default async function PaginaNuevoMiembro() {
  await requerirUsuario("JEFE");
  return <FormularioNuevoMiembro />;
}
