import { requerirUsuario } from "@/lib/auth";
import { ListaPendientesCliente } from "./_lista-cliente";

export const metadata = { title: "Pendientes" };

export default async function PaginaPendientes() {
  await requerirUsuario("TRABAJADOR");
  return <ListaPendientesCliente />;
}
