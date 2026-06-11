/**
 * Importa la delimitación real de la finca desde un KML de Google Earth.
 *
 * Qué casa por nombre (sin importar mayúsculas ni tildes):
 *   - Polígonos con nombre de lote  → lotes.poligono (+ hectáreas recalculadas)
 *   - Polígono llamado "Finca"      → finca.poligono (borde general)
 *   - Puntos con nombre de apiario  → apiarios.coordenadas ("El Cedro" o "Apiario El Cedro")
 *   - Puntos con nombre de instalación → instalaciones.coordenadas
 *
 * Uso:
 *   npm run importar:kml                    → SIMULACIÓN (muestra qué haría, no toca la BD)
 *   npm run importar:kml -- otra/ruta.kml   → simulación con otra ruta
 *   npm run importar:kml:aplicar            → escribe de verdad en la BD
 *
 * La simulación es el modo por defecto a propósito: npm en Windows a veces
 * se come los flags pasados con `--`, así que escribir exige el comando
 * explícito (el flag --aplicar va dentro del propio npm script).
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FLAGS = new Set(["--aplicar", "--dry"]);
const args = process.argv.slice(2).filter((a) => !FLAGS.has(a));
const dry = !process.argv.includes("--aplicar");
const ruta = args[0] ?? "datos/finca.kml";

function normalizar(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function parsearCoordenadas(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .map((trio) => {
      const [lng, lat] = trio.split(",").map(Number);
      return [lng, lat];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function extraerPlacemarks(kml) {
  const placemarks = [];
  const bloques = kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? [];
  for (const b of bloques) {
    const nombre = (b.match(/<name>([\s\S]*?)<\/name>/) ?? [])[1]?.trim();
    if (!nombre) continue;
    const poly = b.match(
      /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/,
    );
    if (poly) {
      const coords = parsearCoordenadas(poly[1]);
      if (coords.length >= 3)
        placemarks.push({ tipo: "poligono", nombre, coords });
      continue;
    }
    const punto = b.match(
      /<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/,
    );
    if (punto) {
      const coords = parsearCoordenadas(punto[1]);
      if (coords.length === 1) placemarks.push({ tipo: "punto", nombre, coords });
    }
  }
  return placemarks;
}

function wktPolygon(coords) {
  const anillo = [...coords];
  const [x0, y0] = anillo[0];
  const [xn, yn] = anillo[anillo.length - 1];
  if (x0 !== xn || y0 !== yn) anillo.push([x0, y0]);
  return `POLYGON((${anillo.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
}

function wktPoint([lng, lat]) {
  return `POINT(${lng} ${lat})`;
}

async function main() {
  let kml;
  try {
    kml = readFileSync(ruta, "utf8");
  } catch {
    console.error(`No pude leer el archivo: ${ruta}`);
    console.error("Exportá tu proyecto de Google Earth como KML y guardalo ahí,");
    console.error("o pasá la ruta: npm run importar:kml -- C:/ruta/al/archivo.kml");
    process.exit(1);
  }

  const placemarks = extraerPlacemarks(kml);
  if (placemarks.length === 0) {
    console.error(
      "El KML no tiene Placemarks con nombre. ¿Exportaste el proyecto correcto?",
    );
    process.exit(1);
  }
  console.log(`KML leído: ${placemarks.length} elementos con nombre.\n`);

  const [lotes, apiarios, instalaciones] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
    }),
    prisma.apiarios.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.instalaciones.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
  ]);

  const porNombreLote = new Map(lotes.map((l) => [normalizar(l.nombre), l]));
  const porNombreApiario = new Map(
    apiarios.map((a) => [normalizar(a.nombre), a]),
  );
  const porNombreInst = new Map(
    instalaciones.map((i) => [normalizar(i.nombre), i]),
  );

  const hechos = [];
  const ignorados = [];

  for (const p of placemarks) {
    const clave = normalizar(p.nombre);

    if (p.tipo === "poligono") {
      if (clave === "finca" || clave === "borde" || clave === "la zelanda") {
        const wkt = wktPolygon(p.coords);
        if (!dry) {
          const fila = await prisma.finca.findFirst();
          if (fila) {
            await prisma.$executeRawUnsafe(
              `UPDATE finca SET poligono = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
              wkt,
              fila.id,
            );
          } else {
            await prisma.$executeRawUnsafe(
              `INSERT INTO finca (nombre, poligono) VALUES ('Hacienda La Zelanda', ST_GeomFromText($1, 4326)::geography)`,
              wkt,
            );
          }
        }
        hechos.push(`Borde de la finca <- "${p.nombre}" (${p.coords.length} vértices)`);
        continue;
      }
      const lote = porNombreLote.get(clave);
      if (lote) {
        const wkt = wktPolygon(p.coords);
        if (!dry) {
          await prisma.$executeRawUnsafe(
            `UPDATE lotes
             SET poligono = ST_GeomFromText($1, 4326)::geography,
                 hectareas = ST_Area(ST_GeomFromText($1, 4326)::geography) / 10000,
                 updated_at = NOW()
             WHERE id = $2`,
            wkt,
            lote.id,
          );
        }
        hechos.push(`Lote ${lote.nombre} <- "${p.nombre}" (${p.coords.length} vértices)`);
        continue;
      }
      ignorados.push(
        `Polígono "${p.nombre}" — no coincide con ningún lote ni con "Finca"`,
      );
      continue;
    }

    // Puntos: apiario (con o sin prefijo "Apiario") o instalación
    const claveSinPrefijo = clave.replace(/^apiario\s+/, "");
    const apiario =
      porNombreApiario.get(clave) ?? porNombreApiario.get(claveSinPrefijo);
    if (apiario) {
      const wkt = wktPoint(p.coords[0]);
      if (!dry) {
        await prisma.$executeRawUnsafe(
          `UPDATE apiarios SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
          wkt,
          apiario.id,
        );
      }
      hechos.push(`Apiario ${apiario.nombre} <- "${p.nombre}"`);
      continue;
    }
    const inst = porNombreInst.get(clave);
    if (inst) {
      const wkt = wktPoint(p.coords[0]);
      if (!dry) {
        await prisma.$executeRawUnsafe(
          `UPDATE instalaciones SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
          wkt,
          inst.id,
        );
      }
      hechos.push(`Instalación ${inst.nombre} <- "${p.nombre}"`);
      continue;
    }
    ignorados.push(
      `Punto "${p.nombre}" — no coincide con ningún apiario ni instalación`,
    );
  }

  console.log(
    dry
      ? "=== SIMULACIÓN (no se tocó la BD; para aplicar: npm run importar:kml:aplicar) ==="
      : "=== IMPORTADO ===",
  );
  for (const h of hechos) console.log(`  [OK] ${h}`);
  if (ignorados.length > 0) {
    console.log("\n=== SIN COINCIDENCIA (revisá los nombres en Google Earth) ===");
    for (const i of ignorados) console.log(`  [??] ${i}`);
  }

  const lotesImportados = hechos.filter((h) => h.startsWith("Lote ")).length;
  console.log(
    `\nResumen: ${lotesImportados}/${lotes.length} lotes, ` +
      `${hechos.length} elementos en total, ${ignorados.length} sin coincidencia.`,
  );
  if (!dry && hechos.length > 0) {
    console.log(
      "\nNota: el mapa cachea las geometrías hasta 1 hora. Para verlas ya mismo,",
    );
    console.log(
      "abrí cualquier editor de polígono en la app y guardá (eso refresca el cache),",
    );
    console.log("o simplemente esperá a que expire.");
  }
}

main()
  .catch((e) => {
    console.error("Error importando:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
