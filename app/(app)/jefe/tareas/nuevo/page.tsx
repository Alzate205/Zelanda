import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { FormularioNuevoTipo } from "./FormularioNuevoTipo";

export const metadata: Metadata = { title: "Nuevo tipo de tarea" };

export default async function PaginaNuevoTipo() {
  await requerirUsuario("JEFE");
  return <FormularioNuevoTipo />;
}
