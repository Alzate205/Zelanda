import { requerirUsuario } from "@/lib/auth";
import { FormularioCliente } from "../_FormularioCliente";

export const metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
  await requerirUsuario("JEFE");
  return <FormularioCliente modo="crear" />;
}
