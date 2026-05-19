// Genera iconos placeholder de PWA para Hacienda La Zelanda.
// Uso: node scripts/generar-iconos.mjs
// Requiere sharp instalado temporalmente: npm i -D sharp && node ... && npm un sharp
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (size) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#3D5C42"/>
  <text x="50%" y="55%" font-family="Georgia, serif" font-size="${Math.floor(size * 0.6)}" fill="white" text-anchor="middle" dominant-baseline="middle">Z</text>
</svg>`;

await mkdir("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`Generated public/icons/icon-${size}.png`);
}
