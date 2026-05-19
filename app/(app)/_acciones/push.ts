"use server";

import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

export async function suscribirPush(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const endpoint = String(formData.get("endpoint") ?? "");
  const p256dh = String(formData.get("p256dh") ?? "");
  const auth = String(formData.get("auth") ?? "");
  const userAgent =
    String(formData.get("userAgent") ?? "").slice(0, 500) || null;

  if (!endpoint || !p256dh || !auth) return;

  await prisma.push_subscriptions.upsert({
    where: { endpoint },
    create: {
      usuario_id: usuario.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    update: {
      usuario_id: usuario.id,
      p256dh,
      auth,
      user_agent: userAgent,
    },
  });
}

export async function desuscribirPush(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const endpoint = String(formData.get("endpoint") ?? "");
  if (!endpoint) return;

  await prisma.push_subscriptions
    .deleteMany({ where: { endpoint, usuario_id: usuario.id } })
    .catch(() => {});
}
