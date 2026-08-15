'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { crearClienteSupabaseAdmin } from '@/lib/supabase/admin';
import { sanitizarError } from '@/lib/errores';
import { validarUsername, validarClave, emailDesdeUsername } from '@/lib/acceso';
import type { RolUsuario } from '@/types';

export type EstadoAcceso = { error: string | null; exito: string | null };
const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === 'JEFE' || v === 'BODEGA' || v === 'ALMACEN' || v === 'TRABAJADOR';
}

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearAccesoParaPersona(
  _prev: EstadoAcceso,
  formData: FormData
): Promise<EstadoAcceso> {
  await requerirUsuario('JEFE');

  const personaId = parsearId(String(formData.get('persona_id') ?? ''));
  if (!personaId) return { ...ESTADO_INICIAL, error: 'ID de persona inválido.' };

  const rolRaw = String(formData.get('rol') ?? '');

  // El acceso se crea con nombre de usuario: en la finca casi nadie tiene
  // correo. El email que exige Supabase se arma solo y nunca se muestra.
  const vUser = validarUsername(String(formData.get('username') ?? ''));
  if (!vUser.ok) return { ...ESTADO_INICIAL, error: vUser.error };
  const username = vUser.username;
  const email = emailDesdeUsername(username);

  const password = String(formData.get('password') ?? '');
  const vClave = validarClave(password);
  if (!vClave.ok) return { ...ESTADO_INICIAL, error: vClave.error };

  if (!esRolValido(rolRaw)) {
    return { ...ESTADO_INICIAL, error: 'Rol inválido.' };
  }
  const rol = rolRaw;

  const usuarioRepetido = await prisma.usuarios.findFirst({
    where: { username },
    select: { id: true },
  });
  if (usuarioRepetido) {
    return { ...ESTADO_INICIAL, error: `Ya hay alguien con el usuario "${username}".` };
  }

  const persona = await prisma.personas.findUnique({
    where: { id: personaId },
    include: { usuarios: { select: { id: true } } },
  });
  if (!persona || persona.deleted_at) {
    return { ...ESTADO_INICIAL, error: 'Persona no encontrada.' };
  }
  if (persona.usuarios.length > 0) {
    return { ...ESTADO_INICIAL, error: 'Esta persona ya tiene acceso al sistema.' };
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: persona.nombre_completo },
  });

  if (authError || !authData?.user) {
    const yaRegistrado = /already registered|already exists/i.test(authError?.message ?? '');
    return {
      ...ESTADO_INICIAL,
      error: yaRegistrado
        ? `Ya hay alguien con el usuario "${username}".`
        : `Error al crear el acceso: ${authError?.message ?? 'desconocido'}.`,
    };
  }

  try {
    await prisma.usuarios.create({
      data: {
        id: authData.user.id,
        email,
        // Sin esto el login por nombre de usuario no encuentra a nadie: es
        // la columna que consulta `resolverEmail` en el inicio de sesión.
        username,
        nombre_completo: persona.nombre_completo,
        rol,
        persona_id: personaId,
        activo: true,
      },
    });
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return { ...ESTADO_INICIAL, error: sanitizarError(e, 'acceso/enlazar') };
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath('/jefe/equipo');
  redirect(`/jefe/equipo/${personaId}`);
}

export async function cambiarRolUsuario(
  _prev: EstadoAcceso,
  formData: FormData
): Promise<EstadoAcceso> {
  await requerirUsuario('JEFE');

  const personaIdRaw = String(formData.get('persona_id') ?? '');
  const personaId = parsearId(personaIdRaw);
  if (!personaId) return { ...ESTADO_INICIAL, error: 'ID de persona inválido.' };

  const usuarioId = String(formData.get('usuario_id') ?? '').trim();
  if (!usuarioId) return { ...ESTADO_INICIAL, error: 'ID de usuario inválido.' };

  const rolRaw = String(formData.get('rol') ?? '');
  if (!esRolValido(rolRaw)) {
    return { ...ESTADO_INICIAL, error: 'Rol inválido.' };
  }

  try {
    await prisma.usuarios.update({
      where: { id: usuarioId },
      data: { rol: rolRaw },
    });
  } catch (e) {
    return {
      ...ESTADO_INICIAL,
      error: sanitizarError(e, 'acceso/cambiar-rol'),
    };
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath(`/jefe/equipo/${personaId}/acceso`);
  revalidatePath('/jefe/equipo');
  return { error: null, exito: 'Rol actualizado.' };
}

export async function resetearContrasenaUsuario(
  _prev: EstadoAcceso,
  formData: FormData
): Promise<EstadoAcceso> {
  await requerirUsuario('JEFE');

  const usuarioId = String(formData.get('usuario_id') ?? '').trim();
  if (!usuarioId) return { ...ESTADO_INICIAL, error: 'ID de usuario inválido.' };

  const nueva = String(formData.get('contrasena_nueva') ?? '');
  const confirm = String(formData.get('contrasena_confirmacion') ?? '');

  const vClave = validarClave(nueva, confirm);
  if (!vClave.ok) return { ...ESTADO_INICIAL, error: vClave.error };

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, {
    password: nueva,
  });

  if (error) {
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo resetear: ${error.message}`,
    };
  }

  return {
    error: null,
    exito: 'Contraseña actualizada. Compártesela al usuario.',
  };
}
