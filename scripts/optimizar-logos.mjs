// Convierte el logo PNG (1.2 MB) a WebP liviano. Uso: node scripts/optimizar-logos.mjs
import sharp from "sharp";

const salida = await sharp("public/logo-zelanda.png")
  .resize({ width: 800, height: 800, fit: "inside" })
  .webp({ quality: 88 })
  .toFile("public/logo-zelanda.webp");

console.log(
  `logo-zelanda.webp: ${salida.width}x${salida.height}, ${salida.size} bytes`,
);
