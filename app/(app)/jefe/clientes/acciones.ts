"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoCliente = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearCliente(
  _prev: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  const usuario = await requerirUsuario("JEFE");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!nombre) return { error: "El nombre del cliente es obligatorio." };

  try {
    await prisma.clientes.create({
      data: {
        nombre,
        contacto: contacto || null,
        telefono: telefono || null,
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "clientes/crear") };
  }

  revalidatePath("/jefe/clientes");
  redirect("/jefe/clientes");
}

export async function actualizarCliente(
  _prev: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  await requerirUsuario("JEFE");

  const id = parsearId(String(formData.get("id") ?? ""));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const activo = String(formData.get("activo") ?? "") === "on";

  if (!id) return { error: "Cliente inválido." };
  if (!nombre) return { error: "El nombre del cliente es obligatorio." };

  try {
    await prisma.clientes.update({
      where: { id },
      data: {
        nombre,
        contacto: contacto || null,
        telefono: telefono || null,
        notas: notas || null,
        activo,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "clientes/actualizar") };
  }

  revalidatePath("/jefe/clientes");
  redirect("/jefe/clientes");
}

export async function borrarCliente(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.clientes.delete({ where: { id } });
  } catch {
    // best-effort: si tiene ventas, el FK ON DELETE SET NULL las preserva
  }
  revalidatePath("/jefe/clientes");
}
