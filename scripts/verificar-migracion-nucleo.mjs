/**
 * Verificación de migración núcleo personas.
 * Reporta:
 *  - Tablas existentes en public schema
 *  - Conteos clave (trabajadores, personas, vinculaciones, usuarios)
 *  - Existencia de funciones RLS
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/verificar-migracion-nucleo.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ok(label, val) { console.log(`  ✓ ${label}: ${val}`); }
function warn(label, msg) { console.log(`  ⚠ ${label}: ${msg}`); }

try {
  console.log("--- Tablas en public ---");
  const tablas = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const nombres = tablas.map((t) => t.table_name);
  ok("Total tablas", nombres.length);
  console.log("    " + nombres.join(", "));

  const tieneTrabajadores = nombres.includes("trabajadores");
  const tienePersonas = nombres.includes("personas");
  const tieneVinculaciones = nombres.includes("vinculaciones");

  console.log("\n--- Estado de migración ---");
  if (tieneTrabajadores && !tienePersonas) {
    warn("Estado", "Pre-migración (trabajadores existe, personas no)");
  } else if (!tieneTrabajadores && tienePersonas) {
    ok("Estado", "Post-migración (trabajadores eliminado, personas creada)");
  } else if (tieneTrabajadores && tienePersonas) {
    warn("Estado", "Migración INCOMPLETA (ambas tablas existen)");
  } else {
    warn("Estado", "Inconsistente (ninguna tabla de persona)");
  }

  console.log("\n--- Conteos ---");
  if (tieneTrabajadores) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM trabajadores`);
    ok("trabajadores rows", c[0].n);
  }
  if (tienePersonas) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM personas`);
    ok("personas rows", c[0].n);
  }
  if (tieneVinculaciones) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM vinculaciones`);
    ok("vinculaciones rows", c[0].n);
    const tipos = await prisma.$queryRawUnsafe(`
      SELECT tipo::text, COUNT(*)::int AS n FROM vinculaciones GROUP BY tipo
    `);
    for (const r of tipos) ok(`  vinculaciones tipo=${r.tipo}`, r.n);
  }
  const cUsuarios = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM usuarios`);
  ok("usuarios rows", cUsuarios[0].n);

  console.log("\n--- Columnas FK ---");
  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('trabajador_id', 'persona_id')
    ORDER BY table_name, column_name
  `);
  for (const c of cols) ok(`${c.table_name}.${c.column_name}`, "exists");

  console.log("\n--- Funciones RLS ---");
  const fns = await prisma.$queryRawUnsafe(`
    SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND proname IN ('trabajador_id_actual', 'persona_id_actual')
  `);
  const haytrab = fns.some((f) => f.proname === "trabajador_id_actual");
  const haypers = fns.some((f) => f.proname === "persona_id_actual");
  if (haytrab) warn("trabajador_id_actual", "todavía existe");
  if (haypers) ok("persona_id_actual", "existe");
  if (!haytrab && !haypers) warn("Funciones RLS", "ninguna existe");

  console.log("\n--- Enums ---");
  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typtype = 'e' AND typname IN
      ('tipo_vinculacion', 'tipo_periodo_pago', 'esquema_pago_destajo')
    ORDER BY typname
  `);
  for (const e of enums) ok(`enum ${e.typname}`, "existe");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
