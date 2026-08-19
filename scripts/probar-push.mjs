// Manda un aviso de prueba a los dispositivos registrados, y antes revisa que
// la configuración esté sana.
//
// Existe porque "activé las notificaciones y no me llega nada" tiene demasiadas
// causas posibles —clave mal puesta, par que no corresponde, suscripción que
// nunca se guardó, servicio de Apple o Google que rechaza— y desde el celular
// no se distingue ninguna. Acá cada paso se revisa por separado y se dice cuál
// falló.
//
//   npm run probar:push              → revisa y lista, sin enviar nada
//   npm run probar:push -- --enviar  → además manda el aviso de prueba

import crypto from 'node:crypto';
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const enviar = process.argv.includes('--enviar');

function base64urlABuffer(txt) {
  const relleno = '='.repeat((4 - (txt.length % 4)) % 4);
  return Buffer.from((txt + relleno).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function aBase64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fallar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

console.log('\n=== Configuración VAPID ===\n');

const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privada = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publica) fallar('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY.');
if (!privada) fallar('Falta VAPID_PRIVATE_KEY.');
if (!subject) fallar('Falta VAPID_SUBJECT.');

// Un espacio o un salto de línea de más al pegar la clave en el panel no se ve
// por ningún lado y rompe todo, así que se revisa explícitamente.
for (const [nombre, valor] of [
  ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', publica],
  ['VAPID_PRIVATE_KEY', privada],
]) {
  if (valor !== valor.trim()) {
    fallar(`${nombre} tiene espacios o saltos de línea alrededor. Volvé a pegarla limpia.`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) {
    fallar(`${nombre} tiene caracteres que no son de base64url. ¿Quedó con comillas?`);
  }
}

const pubBuf = base64urlABuffer(publica);
const privBuf = base64urlABuffer(privada);
console.log(
  `  pública : ${publica.slice(0, 12)}… (${publica.length} chars → ${pubBuf.length} bytes)`
);
console.log(
  `  privada : ${privada.slice(0, 8)}… (${privada.length} chars → ${privBuf.length} bytes)`
);
console.log(`  subject : ${subject}`);

if (pubBuf.length !== 65 || pubBuf[0] !== 0x04) {
  fallar(
    'La clave pública no es un punto P-256 sin comprimir (deberían ser 65 bytes empezando en 0x04).'
  );
}
if (privBuf.length !== 32) {
  fallar('La clave privada no mide 32 bytes.');
}

// Que las dos claves sean válidas por separado no alcanza: tienen que ser el
// par. Si no corresponden, el servicio de avisos rechaza cada envío con 403 y
// en el celular eso se ve como "activé y no me llega nada". Node valida que el
// punto público sea el que corresponde al escalar privado al construir la
// clave, así que si no son pareja, esto tira.
try {
  crypto.createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: aBase64url(pubBuf.subarray(1, 33)),
      y: aBase64url(pubBuf.subarray(33, 65)),
      d: privada,
    },
  });
  console.log('\n  ✓ La clave pública y la privada son pareja.');
} catch {
  fallar(
    'La clave pública NO corresponde a la privada. Los avisos se van a rechazar siempre.\n' +
      '  Generá un par nuevo con "npx web-push generate-vapid-keys" y poné LAS DOS,\n' +
      '  acá y en Vercel. Ojo: al cambiarlas, las suscripciones viejas dejan de servir\n' +
      '  y hay que volver a activar los avisos en cada celular.'
  );
}

webpush.setVapidDetails(subject, publica, privada);

console.log('\n=== Dispositivos registrados ===\n');

const subs = await prisma.push_subscriptions.findMany({
  include: { usuarios: { select: { nombre_completo: true } } },
});

if (subs.length === 0) {
  console.log('  (ninguno)\n');
  console.log('  Nadie completó la activación. Si en un celular decía "activadas",');
  console.log('  la suscripción no llegó a guardarse en el servidor.\n');
  await prisma.$disconnect();
  process.exit(0);
}

for (const s of subs) {
  const ua = s.user_agent ?? '';
  const equipo = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'otro';
  const servicio = new URL(s.endpoint).host;
  console.log(`  · ${s.usuarios?.nombre_completo ?? '?'} — ${equipo} — ${servicio}`);
}

if (!enviar) {
  console.log('\n  Para mandarles un aviso de prueba: npm run probar:push -- --enviar\n');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('\n=== Enviando aviso de prueba ===\n');

// El tag va único por envío a propósito. Dos avisos con el mismo tag no se
// apilan: el segundo reemplaza al primero, y encima lo hace en silencio. Con un
// tag fijo, mandar la prueba tres veces mostraba una sola notificación y parecía
// que se estuvieran perdiendo. La hora en el cuerpo termina de despejar la duda:
// se ve de un vistazo si el aviso es el de recién o uno viejo que quedó ahí.
const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' });
const payload = JSON.stringify({
  titulo: 'La Zelanda',
  cuerpo: `Aviso de prueba de las ${hora}. Si ves esto, las notificaciones funcionan.`,
  url: '/',
  tag: `prueba-${Date.now()}`,
});

let bien = 0;
for (const s of subs) {
  const quien = `${s.usuarios?.nombre_completo ?? '?'} (${new URL(s.endpoint).host})`;
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload
    );
    console.log(`  ✓ ${quien}`);
    bien++;
  } catch (e) {
    const codigo = e?.statusCode ?? '?';
    const detalle = String(e?.body ?? e?.message ?? '')
      .trim()
      .slice(0, 200);
    console.log(`  ✗ ${quien} → ${codigo} ${detalle}`);
    if (codigo === 403) {
      console.log('     403 = el servicio rechaza la firma: las claves VAPID no son las');
      console.log('     que se usaron para registrar este dispositivo.');
    }
    if (codigo === 404 || codigo === 410) {
      console.log('     La suscripción ya no existe: hay que volver a activar en ese celular.');
    }
  }
}

console.log(`\n  ${bien} de ${subs.length} aceptados por el servicio de avisos.`);
console.log('  Aceptado no es lo mismo que entregado: el aviso puede tardar unos segundos.\n');

await prisma.$disconnect();
