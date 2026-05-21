import { requerirUsuario } from "@/lib/auth";
import { ListaPendientesBodega } from "./_lista-cliente";

export const metadata = { title: "Pendientes bodega" };

export default async function PaginaPendientesBodega() {
  await requerirUsuario("BODEGA");
  return <ListaPendientesBodega />;
}
