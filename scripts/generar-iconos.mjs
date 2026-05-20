// Genera iconos PWA a partir de public/icons/image.png (o el archivo configurado).
// Uso: npm i -D sharp && node scripts/generar-iconos.mjs && npm un sharp
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const FUENTE = "public/icons/image.png";
const FONDO = { r: 0x3d, g: 0x5c, b: 0x42, alpha: 1 }; // zelanda-verde-700

await mkdir("public/icons", { recursive: true });

for (const size of [192, 512]) {
  // Tamaño interior con padding ~10% para que el logo respire
  const padding = Math.round(size * 0.08);
  const interior = size - padding * 2;

  // Redimensionar manteniendo aspect ratio para que entre dentro del cuadrado interior
  const resized = await sharp(FUENTE)
    .resize(interior, interior, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // Componer sobre fondo verde cuadrado
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: FONDO,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(`public/icons/icon-${size}.png`);

  console.log(`Generated public/icons/icon-${size}.png`);
}
