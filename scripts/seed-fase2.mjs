/**
 * Seed inicial para Fase 2.
 * Idempotente — se puede correr varias veces.
 *
 * Inserta:
 *   - 15 lotes (nombres de CLAUDE.md §2, sin polígono y total_arboles=0)
 *   - 2 apiarios (El Cedro 12 colmenas, La Quebrada 8 colmenas)
 *   - 8 tipos_tarea predefinidos (CLAUDE.md §5.2)
 *
 * Uso:
 *   npm run seed:fase2
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOTES = [
  "Armenia",
  "Calarcá",
  "Circasia",
  "Córdoba",
  "Filandia",
  "Génova",
  "La Tebaida",
  "Montenegro",
  "Pijao",
  "Quimbaya",
  "Salento",
  "Buenavista",
  "Barcelona",
  "Pueblo Tapao",
  "La Cabaña",
];

const APIARIOS = [
  { nombre: "El Cedro", ubicacion_descripcion: "Sector norte", total_colmenas: 12 },
  { nombre: "La Quebrada", ubicacion_descripcion: "Sector sur", total_colmenas: 8 },
];

const TIPOS_TAREA = [
  { nombre: "Plateo químico",   frecuencia_dias_default:  90, area: "CULTIVO",    icono: "shovel" },
  { nombre: "Poda",             frecuencia_dias_default: 180, area: "CULTIVO",    icono: "scissors" },
  { nombre: "Fertilización",    frecuencia_dias_default:  60, area: "CULTIVO",    icono: "sprout" },
  { nombre: "Control de plagas", frecuencia_dias_default: 45, area: "CULTIVO",    icono: "bug" },
  { nombre: "Riego",            frecuencia_dias_default:  15, area: "CULTIVO",    icono: "droplet" },
  { nombre: "Cosecha",          frecuencia_dias_default: 120, area: "CULTIVO",    icono: "basket" },
  { nombre: "Visita al apiario", frecuencia_dias_default: 21, area: "APICULTURA", icono: "bee" },
  { nombre: "Cosecha de miel",  frecuencia_dias_default:  90, area: "APICULTURA", icono: "honey" },
];

function morir(msg) {
  console.error("✗", msg);
  process.exit(1);
}

try {
  // --- Lotes ---
  let lotesCreados = 0;
  for (const nombre of LOTES) {
    const existente = await prisma.lotes.findUnique({ where: { nombre } });
    if (!existente) {
      await prisma.lotes.create({
        data: { nombre, total_arboles: 0 },
      });
      lotesCreados += 1;
    }
  }
  console.log(`✓ Lotes: ${lotesCreados} nuevos, ${LOTES.length - lotesCreados} ya existían (total ${LOTES.length}).`);

  // --- Apiarios ---
  let apiariosCreados = 0;
  for (const ap of APIARIOS) {
    const existente = await prisma.apiarios.findFirst({ where: { nombre: ap.nombre } });
    if (!existente) {
      await prisma.apiarios.create({ data: ap });
      apiariosCreados += 1;
    }
  }
  console.log(`✓ Apiarios: ${apiariosCreados} nuevos, ${APIARIOS.length - apiariosCreados} ya existían (total ${APIARIOS.length}).`);

  // --- Tipos de tarea ---
  let tiposCreados = 0;
  for (const tt of TIPOS_TAREA) {
    const existente = await prisma.tipos_tarea.findUnique({ where: { nombre: tt.nombre } });
    if (!existente) {
      await prisma.tipos_tarea.create({ data: tt });
      tiposCreados += 1;
    }
  }
  console.log(`✓ Tipos de tarea: ${tiposCreados} nuevos, ${TIPOS_TAREA.length - tiposCreados} ya existían (total ${TIPOS_TAREA.length}).`);

  console.log("");
  console.log("Seed Fase 2 completado.");
} catch (e) {
  morir(e?.message ?? String(e));
} finally {
  await prisma.$disconnect();
}
