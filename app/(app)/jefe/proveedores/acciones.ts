"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoProveedor = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearProveedor(
  _prev: EstadoProveedor,
  formData: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario("JEFE");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const nit = String(formData.get("nit") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  try {
    await prisma.proveedores.create({
      data: {
        nombre,
        contacto: contacto || null,
        telefono: telefono || null,
        nit: nit || null,
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "proveedores/crear") };
  }

  revalidatePath("/jefe/proveedores");
  redirect("/jefe/proveedores");
}

export async function actualizarProveedor(
  _prev: EstadoProveedor,
  formData: FormData,
): Promise<EstadoProveedor> {
  await requerirUsuario("JEFE");

  const id = parsearId(String(formData.get("id") ?? ""));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const nit = String(formData.get("nit") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const activo = String(formData.get("activo") ?? "") === "on";

  if (!id) return { error: "Proveedor inválido." };
  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  try {
    await prisma.proveedores.update({
      where: { id },
      data: {
        nombre,
        contacto: contacto || null,
        telefono: telefono || null,
        nit: nit || null,
        notas: notas || null,
        activo,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "proveedores/actualizar") };
  }

  revalidatePath("/jefe/proveedores");
  redirect("/jefe/proveedores");
}

export async function borrarProveedor(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.proveedores.delete({ where: { id } });
  } catch {
    // best-effort: si tiene compras, el FK ON DELETE SET NULL las preserva
  }
  revalidatePath("/jefe/proveedores");
}
