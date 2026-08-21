// scripts/e2e-teardown.mjs
// Borrado robusto e idempotente de los artefactos de test e2e.
// Orden por FK: registros_avance → asignaciones → auth users (cascade usuarios)
//   → vinculaciones → personas.
// Uso: node --env-file=.env.local --env-file=.env scripts/e2e-teardown.mjs

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import {
  E2E_JEFE,
  E2E_TRABAJADOR,
  E2E_BODEGA,
  E2E_ALMACEN,
  E2E_LOTE,
} from '../tests/e2e/credenciales.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient();

async function resolverAuthIdPorEmail(email) {
  let pagina = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
    pagina += 1;
  }
}

/** Las fotos de prueba también son basura: se van del storage con el registro. */
async function borrarFotos(paths) {
  if (paths.length === 0) return;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    await sb.storage.from('fotos').remove(paths);
  } catch (e) {
    console.warn('No se pudieron borrar fotos de prueba del storage:', e?.message ?? e);
  }
}

try {
  const personas = await prisma.personas.findMany({
    where: {
      nombre_completo: {
        in: [E2E_JEFE.nombre, E2E_TRABAJADOR.nombre, E2E_BODEGA.nombre, E2E_ALMACEN.nombre],
      },
    },
    select: { id: true },
  });
  const personaIds = personas.map((p) => p.id);

  if (personaIds.length > 0) {
    // Las novedades van primero y por persona, no por lote: un test puede
    // reportar sobre un árbol de un lote real, y ahí el borrado por lote de
    // test no las alcanza. Sin esto, la FK impide borrar a la persona y el
    // teardown deja datos de prueba en la base de la finca.
    const novedades = await prisma.novedades.findMany({
      where: { persona_id: { in: personaIds } },
      select: { id: true, foto_path: true },
    });
    await borrarFotos(novedades.map((n) => n.foto_path).filter(Boolean));
    await prisma.novedades.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.registros_avance.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.asignaciones.deleteMany({ where: { persona_id: { in: personaIds } } });
  }

  // Borrar auth users (cascade borra la fila en `usuarios`). Trabajador primero.
  for (const email of [
    E2E_TRABAJADOR.email,
    E2E_JEFE.email,
    E2E_BODEGA.email,
    E2E_ALMACEN.email,
  ]) {
    const id = await resolverAuthIdPorEmail(email);
    if (id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) console.warn(`· deleteUser ${email}: ${error.message}`);
    }
  }

  if (personaIds.length > 0) {
    await prisma.vinculaciones.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.personas.deleteMany({ where: { id: { in: personaIds } } });
  }

  // Lote de test: borrado real, no soft-delete. No debe quedar rondando en la
  // lista de lotes de la finca. Hijos primero: novedades → árboles → lote.
  const loteTest = await prisma.lotes.findFirst({
    where: { nombre: E2E_LOTE },
    select: { id: true },
  });
  let arbolesBorrados = 0;
  if (loteTest) {
    const arboles = await prisma.arboles.findMany({
      where: { lote_id: loteTest.id },
      select: { id: true },
    });
    const arbolIds = arboles.map((a) => a.id);
    if (arbolIds.length > 0) {
      await prisma.novedades.deleteMany({ where: { arbol_id: { in: arbolIds } } });
    }
    // Puede haber avances de otra persona si una corrida quedó a medias.
    const asigs = await prisma.asignaciones.findMany({
      where: { lote_id: loteTest.id },
      select: { id: true },
    });
    if (asigs.length > 0) {
      const asigIds = asigs.map((a) => a.id);
      await prisma.registros_avance.deleteMany({ where: { asignacion_id: { in: asigIds } } });
      await prisma.despachos.deleteMany({ where: { asignacion_id: { in: asigIds } } });
    }
    await prisma.asignaciones.deleteMany({ where: { lote_id: loteTest.id } });
    arbolesBorrados = (await prisma.arboles.deleteMany({ where: { lote_id: loteTest.id } })).count;
    await prisma.lotes.delete({ where: { id: loteTest.id } });
  }

  console.log(
    '✓ Teardown e2e listo. personas borradas:',
    personaIds.length,
    loteTest ? `· lote de test y ${arbolesBorrados} árboles borrados` : '· sin lote de test'
  );
} catch (e) {
  console.error('✗ Teardown e2e falló:', e?.message ?? String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
