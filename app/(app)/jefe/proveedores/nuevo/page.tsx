import { requerirUsuario } from "@/lib/auth";
import { FormularioProveedor } from "../_FormularioProveedor";

export const metadata = { title: "Nuevo proveedor" };

export default async function PaginaNuevoProveedor() {
  await requerirUsuario("JEFE");
  return <FormularioProveedor modo="crear" />;
}
