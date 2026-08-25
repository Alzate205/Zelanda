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
//   badge-96                 → la silueta chiquita de la barra de estado de
//                              Android en los avisos push. Android le ignora el
//                              color y usa sólo el canal alfa como recorte: si
//                              el icono es opaco, el aviso sale como un cuadrado
//                              blanco. Por eso éste va blanco sobre transparente
//                              y sale del monocromo, no del logo a color.
//
// El monocromo (512x512-monochrome.png) no se regenera acá: es una silueta que
// no depende del logo a color.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FUENTE = 'public/icons/logoFinal.png';
const SILUETA = 'public/icons/512x512-monochrome.png';
const FONDO = { r: 0xf5, g: 0xf1, b: 0xe8, alpha: 1 }; // zelanda-beige-50
const BLANCO = { r: 255, g: 255, b: 255 };

/** Margen como fracción del lado, por tipo de icono. */
const MARGEN_NORMAL = 0.1;
const MARGEN_RECORTABLE = 0.2;
const MARGEN_BADGE = 0.07;

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

async function generarBadge(destino, lado, margen) {
  const pad = Math.round(lado * margen);
  const interior = lado - pad * 2;

  // Sólo interesa la forma, así que se trabaja sobre el canal alfa del
  // monocromo. `trim` no sirve acá: el archivo trae motas sueltas de un par de
  // píxeles y el recorte quedaría atado a ellas, así que primero se descartan
  // quedándose con la mancha conexa más grande.
  const { data, info } = await sharp(SILUETA)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const forma = manchaMasGrande(data, info.width, info.height);

  // El paso por PNG es a propósito: encadenar resize+extend sobre un buffer
  // crudo de un solo canal devuelve más canales de los que entraron, y el
  // `joinChannel` de abajo sale corrido. Releerlo como PNG fija el formato.
  const encuadrada = await sharp(forma.data, {
    raw: { width: forma.ancho, height: forma.alto, channels: 1 },
  })
    .resize(interior, interior, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .extend({
      top: pad,
      bottom: lado - interior - pad,
      left: pad,
      right: lado - interior - pad,
      background: { r: 0, g: 0, b: 0 },
    })
    .png()
    .toBuffer();
  const alfa = await sharp(encuadrada).extractChannel(0).raw().toBuffer();

  await sharp({ create: { width: lado, height: lado, channels: 3, background: BLANCO } })
    .joinChannel(alfa, { raw: { width: lado, height: lado, channels: 1 } })
    .png()
    .toFile(destino);

  console.log(`✓ ${destino}  (${lado}x${lado}, blanco sobre transparente)`);
}

/**
 * De una máscara en escala de grises, devuelve la mancha conexa más grande ya
 * recortada a su caja: descarta motas sueltas y deja el dibujo encuadrado.
 */
function manchaMasGrande(alfa, ancho, alto) {
  const etiqueta = new Int32Array(ancho * alto);
  const tam = [0];
  let actual = 0;
  const pila = [];

  for (let i = 0; i < alfa.length; i++) {
    if (alfa[i] < 128 || etiqueta[i]) continue;
    actual++;
    tam[actual] = 0;
    etiqueta[i] = actual;
    pila.push(i);
    while (pila.length) {
      const p = pila.pop();
      tam[actual]++;
      const x = p % ancho;
      const y = (p - x) / ancho;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
        const q = ny * ancho + nx;
        if (alfa[q] >= 128 && !etiqueta[q]) {
          etiqueta[q] = actual;
          pila.push(q);
        }
      }
    }
  }

  let mayor = 1;
  for (let c = 1; c < tam.length; c++) if (tam[c] > tam[mayor]) mayor = c;

  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (etiqueta[y * ancho + x] !== mayor) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const orig = (y + y0) * ancho + (x + x0);
      data[y * w + x] = etiqueta[orig] === mayor ? alfa[orig] : 0;
    }
  }
  return { data, ancho: w, alto: h };
}

await generar('public/icons/icon-192.png', 192, MARGEN_NORMAL);
await generar('public/icons/icon-512.png', 512, MARGEN_NORMAL);
await generar('public/icons/icon-maskable-512.png', 512, MARGEN_RECORTABLE);
await generarBadge('public/icons/badge-96.png', 96, MARGEN_BADGE);
