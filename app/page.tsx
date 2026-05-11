import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { RUTA_INICIO_POR_ROL } from "@/lib/constantes";

export default async function PaginaInicio() {
  const usuario = await obtenerUsuarioActual();
  if (usuario && usuario.activo) {
    redirect(RUTA_INICIO_POR_ROL[usuario.rol]);
  }
  redirect("/login");
}
