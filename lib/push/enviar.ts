import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configurado = false;

function configurarVapid() {
  if (configurado) return;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !subject) {
    console.warn("VAPID env vars faltantes; push no se enviará");
    return;
  }
  webpush.setVapidDetails(subject, publica, privada);
  configurado = true;
}

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  url?: string;
  tag?: string;
};

export async function enviarPushAUsuarios(
  usuarioIds: string[],
  payload: PayloadPush,
): Promise<void> {
  if (usuarioIds.length === 0) return;
  configurarVapid();
  if (!configurado) return;

  const subs = await prisma.push_subscriptions.findMany({
    where: { usuario_id: { in: usuarioIds } },
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.push_subscriptions
            .delete({ where: { id: s.id } })
            .catch(() => {});
        } else {
          console.warn(
            `Push error (${code}) endpoint=${s.endpoint.slice(0, 40)}`,
          );
        }
      }
    }),
  );
}
