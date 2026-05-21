import { requerirUsuario } from "@/lib/auth";
import { ListaPendientesAlmacen } from "./_lista-cliente";

export const metadata = { title: "Pendientes almacén" };

export default async function PaginaPendientesAlmacen() {
  await requerirUsuario("ALMACEN");
  return <ListaPendientesAlmacen />;
}
