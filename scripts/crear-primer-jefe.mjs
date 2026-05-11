/**
 * Crea el primer usuario JEFE de la finca (idempotente).
 *
 * Uso (PowerShell o bash, desde la raíz del proyecto):
 *
 *   node --env-file=.env.local --env-file=.env scripts/crear-primer-jefe.mjs \
 *     <email> <password> "<Nombre Completo>"
 *
 * - Crea el auth.user en Supabase (email_confirm=true).
 * - Crea fila en `trabajadores` con rol_finca="Jefe de finca".
 * - Crea fila en `usuarios` enlazando auth.users.id ↔ trabajadores.id.
 * - Si ya existe un usuario con ese email, no falla: solo lo deja como está.
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const [, , emailArg, passwordArg, ...nombreParts] = process.argv;
const email = (emailArg ?? "").trim().toLowerCase();
const password = passwordArg ?? "";
const nombre = nombreParts.join(" ").trim();

function morir(msg) {
  console.error("✗", msg);
  process.exit(1);
}

if (!email || !password || !nombre) {
  console.error(
    "Uso: node --env-file=.env.local --env-file=.env scripts/crear-primer-jefe.mjs <email> <password> \"<Nombre Completo>\"",
  );
  process.exit(1);
}
if (password.length < 8) morir("La contraseña debe tener al menos 8 caracteres.");
if (!email.includes("@")) morir("Email inválido.");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) morir("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
if (!serviceKey) morir("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient();

try {
  // 1) Asegurar auth.user. Si ya existe, recuperamos su id.
  let userId;
  const { data: creado, error: errCreate } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  });

  if (errCreate) {
    const yaExiste = /already registered|already exists/i.test(errCreate.message);
    if (!yaExiste) morir(`Auth: ${errCreate.message}`);

    // listUsers no admite filtro por email en versiones viejas; paginamos.
    let pagina = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: pagina,
        perPage: 200,
      });
      if (error) morir(`Auth listUsers: ${error.message}`);
      const u = data.users.find((u) => u.email?.toLowerCase() === email);
      if (u) {
        userId = u.id;
        break;
      }
      if (data.users.length < 200) break;
      pagina += 1;
    }
    if (!userId) morir("El email ya existe en auth pero no pude resolver su id.");
    console.log("·  Auth user ya existía:", userId);
  } else {
    userId = creado.user.id;
    console.log("✓  Auth user creado:", userId);
  }

  // 2) Asegurar fila en `trabajadores` (por cedula si la tuvieran, o por nombre).
  //    Como no tenemos cédula aún, usamos upsert por (nombre_completo, rol_finca='Jefe de finca').
  let trabajador = await prisma.trabajadores.findFirst({
    where: { nombre_completo: nombre, rol_finca: "Jefe de finca" },
  });
  if (!trabajador) {
    trabajador = await prisma.trabajadores.create({
      data: {
        nombre_completo: nombre,
        rol_finca: "Jefe de finca",
        es_apicultor: false,
        activo: true,
      },
    });
    console.log("✓  Trabajador creado: id =", Number(trabajador.id));
  } else {
    console.log("·  Trabajador ya existía: id =", Number(trabajador.id));
  }

  // 3) Upsert fila en `usuarios`.
  const usuarioExistente = await prisma.usuarios.findUnique({ where: { id: userId } });
  if (usuarioExistente) {
    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        email,
        nombre_completo: nombre,
        rol: "JEFE",
        trabajador_id: trabajador.id,
        activo: true,
      },
    });
    console.log("·  Fila en `usuarios` actualizada.");
  } else {
    await prisma.usuarios.create({
      data: {
        id: userId,
        email,
        nombre_completo: nombre,
        rol: "JEFE",
        trabajador_id: trabajador.id,
        activo: true,
      },
    });
    console.log("✓  Fila en `usuarios` creada.");
  }

  console.log("");
  console.log("Listo. Puedes iniciar sesión en /login con:");
  console.log("   email   :", email);
  console.log("   rol     : JEFE");
  console.log("   nombre  :", nombre);
} catch (e) {
  morir(e?.message ?? String(e));
} finally {
  await prisma.$disconnect();
}
