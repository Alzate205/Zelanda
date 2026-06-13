// scripts/e2e-teardown.mjs
// Borrado robusto e idempotente de los artefactos de test e2e.
// Orden por FK: registros_avance → asignaciones → auth users (cascade usuarios)
//   → vinculaciones → personas.
// Uso: node --env-file=.env.local --env-file=.env scripts/e2e-teardown.mjs

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { E2E_JEFE, E2E_TRABAJADOR } from '../tests/e2e/credenciales.mjs';

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

try {
  const personas = await prisma.personas.findMany({
    where: { nombre_completo: { in: [E2E_JEFE.nombre, E2E_TRABAJADOR.nombre] } },
    select: { id: true },
  });
  const personaIds = personas.map((p) => p.id);

  if (personaIds.length > 0) {
    await prisma.registros_avance.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.asignaciones.deleteMany({ where: { persona_id: { in: personaIds } } });
  }

  // Borrar auth users (cascade borra la fila en `usuarios`). Trabajador primero.
  for (const email of [E2E_TRABAJADOR.email, E2E_JEFE.email]) {
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

  console.log('✓ Teardown e2e listo. personas borradas:', personaIds.length);
} catch (e) {
  console.error('✗ Teardown e2e falló:', e?.message ?? String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
