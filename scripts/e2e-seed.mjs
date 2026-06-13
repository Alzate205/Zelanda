// scripts/e2e-seed.mjs
// Alta idempotente de los usuarios test (jefe + trabajador) en Supabase.
// Reusa el patrón de scripts/crear-primer-jefe.mjs.
// Uso: node --env-file=.env.local --env-file=.env scripts/e2e-seed.mjs

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

async function asegurarAuthUser(email, password, nombre) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  });
  if (!error) return data.user.id;
  // El mensaje de Supabase varía ("has already been registered", "already exists"…),
  // así que matcheamos de forma laxa antes de resolver el id existente.
  if (!/already.*(registered|exists)/i.test(error.message)) {
    throw new Error(`createUser ${email}: ${error.message}`);
  }
  const id = await resolverAuthIdPorEmail(email);
  if (!id) throw new Error(`El email ${email} ya existe pero no pude resolver su id.`);
  return id;
}

async function asegurarPersona(nombre) {
  let persona = await prisma.personas.findFirst({ where: { nombre_completo: nombre } });
  if (!persona) {
    const filas = await prisma.$queryRaw`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas`;
    const nextId = filas[0].next_id;
    persona = await prisma.personas.create({
      data: { id: nextId, nombre_completo: nombre, activo: true },
    });
  }
  return persona;
}

async function asegurarVinculacionActiva(personaId, tipo, rolFinca, extra = {}) {
  const activa = await prisma.vinculaciones.findFirst({
    where: { persona_id: personaId, fecha_fin: null },
  });
  if (!activa) {
    // El check chk_vinc_campos_por_tipo exige campos según el tipo:
    // JORNALERO requiere tarifa_jornal; FIJO requiere salario_base+periodo_pago;
    // CONTRATISTA/FAMILIAR no llevan ninguno. `extra` aporta lo que pida el tipo.
    await prisma.vinculaciones.create({
      data: {
        persona_id: personaId,
        tipo,
        rol_finca: rolFinca,
        notas: 'Usuario de test e2e.',
        ...extra,
      },
    });
  }
}

async function asegurarUsuario(authId, email, nombre, rol, personaId) {
  const data = { email, nombre_completo: nombre, rol, persona_id: personaId, activo: true };
  const existente = await prisma.usuarios.findUnique({ where: { id: authId } });
  if (existente) {
    await prisma.usuarios.update({ where: { id: authId }, data });
  } else {
    await prisma.usuarios.create({ data: { id: authId, ...data } });
  }
}

try {
  // Jefe test
  const jefeAuthId = await asegurarAuthUser(E2E_JEFE.email, E2E_JEFE.password, E2E_JEFE.nombre);
  const jefePersona = await asegurarPersona(E2E_JEFE.nombre);
  await asegurarVinculacionActiva(jefePersona.id, 'FAMILIAR', 'Jefe de finca');
  await asegurarUsuario(jefeAuthId, E2E_JEFE.email, E2E_JEFE.nombre, 'JEFE', jefePersona.id);

  // Trabajador test
  const trabAuthId = await asegurarAuthUser(
    E2E_TRABAJADOR.email,
    E2E_TRABAJADOR.password,
    E2E_TRABAJADOR.nombre
  );
  const trabPersona = await asegurarPersona(E2E_TRABAJADOR.nombre);
  await asegurarVinculacionActiva(trabPersona.id, 'JORNALERO', 'Trabajador de campo', {
    tarifa_jornal: 50000,
  });
  await asegurarUsuario(
    trabAuthId,
    E2E_TRABAJADOR.email,
    E2E_TRABAJADOR.nombre,
    'TRABAJADOR',
    trabPersona.id
  );

  // Pre-limpieza defensiva: asignaciones/avances de corridas previas interrumpidas.
  await prisma.registros_avance.deleteMany({ where: { persona_id: trabPersona.id } });
  await prisma.asignaciones.deleteMany({ where: { persona_id: trabPersona.id } });

  console.log('✓ Seed e2e listo. jefe:', jefeAuthId, '· trabajador:', trabAuthId);
} catch (e) {
  console.error('✗ Seed e2e falló:', e?.message ?? String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
