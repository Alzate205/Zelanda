// Genera los iconos de la app a partir del logo.
//
//   npm run iconos
//
// El fondo es el beige del arranque de la app, el mismo que declara
// `background_color` en el manifiesto: así el icono y la pantalla de carga se
// ven como una sola cosa y no como dos piezas distintas.
//
// Se generan dos juegos porque Android los usa distinto:
//
//   icon-192 / icon-512      → purpose "any". Se muestran tal cual, con un
//                              margen chico para que el dibujo respire.
//   icon-maskable-512        → purpose "maskable". Android los recorta con la
//                              forma que tenga el lanzador, muchas veces un
//                              círculo, y sólo garantiza el 80% central. Con el
//                              margen chico le cortaba el tallo y la hoja al
//                              aguacate, así que éste lleva margen del 20%.
//
// El monocromo (512x512-monochrome.png) no se regenera acá: es una silueta que
// no depende del logo a color.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FUENTE = 'public/icons/logoFinal.png';
const FONDO = { r: 0xf5, g: 0xf1, b: 0xe8, alpha: 1 }; // zelanda-beige-50

/** Margen como fracción del lado, por tipo de icono. */
const MARGEN_NORMAL = 0.1;
const MARGEN_RECORTABLE = 0.2;

await mkdir('public/icons', { recursive: true });

async function generar(destino, lado, margen) {
  const pad = Math.round(lado * margen);
  const interior = lado - pad * 2;

  // `trim` saca el espacio vacío del archivo original: sin eso, el margen
  // real dependería de cuánto aire trajera la imagen de origen.
  const logo = await sharp(FUENTE)
    .trim({ threshold: 1 })
    .resize(interior, interior, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(destino);

  console.log(`✓ ${destino}  (${lado}x${lado}, margen ${Math.round(margen * 100)}%)`);
}

await generar('public/icons/icon-192.png', 192, MARGEN_NORMAL);
await generar('public/icons/icon-512.png', 512, MARGEN_NORMAL);
await generar('public/icons/icon-maskable-512.png', 512, MARGEN_RECORTABLE);
