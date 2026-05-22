# Gestión de personas y acceso desde la UI del jefe

**Fecha:** 2026-05-21
**Autor:** Samuel Alzate (con Claude)
**Estado:** Diseño aprobado, pendiente plan de implementación.

## Contexto y motivación

El CRUD de equipo en `/jefe/equipo` ya existe y cubre lo esencial: crear miembro (persona + vinculación + acceso opcional), listar, ver detalle con histórico, editar datos personales, cambiar/cerrar vinculación, y activar/desactivar persona+acceso juntos.

Quedan tres huecos que hoy obligan al jefe a meterse a la base de datos por SQL:

1. **Editar la vinculación activa sin cerrarla.** Si te equivocaste en el salario, el rol_finca, el periodo de pago o la tarifa, el único camino es "cerrar+abrir nueva", lo que ensucia el histórico con vinculaciones de 1 hora de duración.
2. **Gestionar el acceso al sistema después de creada la persona.** Si la creaste sin acceso y después necesita, no hay UI. Tampoco para cambiar su rol de TRABAJADOR a BODEGA, ni para resetear contraseña olvidada.
3. **Capturar fecha de nacimiento.** La columna `personas.fecha_nacimiento` ya existe en BD (schema.prisma:841), la vista de detalle la pinta — pero los formularios de crear y editar la ignoran, así que siempre aparece "—".

El objetivo de este paquete es cerrar esos tres huecos sin meterse en territorios más grandes (fotos con Storage, fechas custom para vinculaciones, soft-delete real, auditoría, email de reset).

## Alcance

### Dentro

- Campo `fecha_nacimiento` en formularios de crear y editar persona, con validación (fecha válida y no futura).
- Nuevo modo "Editar vinculación activa" en el formulario de edición existente, que hace `UPDATE` directo sobre la fila activa sin tocar histórico.
- Nueva ruta `/jefe/equipo/[id]/acceso` con tres acciones según estado del usuario:
  - **Sin usuario:** formulario para crear acceso (email + password + rol).
  - **Con usuario:** formulario para cambiar rol + formulario para resetear contraseña.

### Fuera (explícito)

- Foto de la persona (requiere Supabase Storage + re-escalado, mejor paquete aparte).
- Fechas distintas a "hoy" para cerrar o abrir vinculaciones.
- Soft-delete real de personas (`deleted_at`). El flag `activo` cubre lo importante.
- Auditoría de quién cambió qué.
- Email de reset de contraseña. La finca tiene conectividad pobre; la contraseña temporal entregada en mano funciona mejor.
- Separar el estado activo de persona vs. acceso. Confirmado: siguen juntos (botón único "Desactivar/Reactivar").

## Decisiones de diseño

### Estructura de rutas

Híbrido de dos rutas, en vez de un mega-form o cinco sub-páginas:

- `/jefe/equipo/[id]/editar` — persona (incluyendo fecha_nacimiento) + vinculación (cuatro modos: dejar, editar, cambiar, cerrar).
- `/jefe/equipo/[id]/acceso` — todo lo relacionado a Supabase Auth: crear acceso, cambiar rol, resetear contraseña.

Justificación: una sola página para "datos del miembro" (persona+vinculación) y otra para "acceso al sistema" mantiene cada formulario enfocado y no fuerza al jefe a navegar a 5 sub-páginas.

### Editar vinculación activa: cuarto modo

El selector de modo del formulario de edición pasa de 3 opciones a 4:

| Modo | Comportamiento |
|---|---|
| **Dejar como está** (default) | Solo guarda datos de persona. |
| **Editar la activa** (nuevo) | `UPDATE` sobre la fila con `fecha_fin IS NULL`. Campos editables: `rol_finca`, `salario_base`, `periodo_pago`, `tarifa_jornal`. El `tipo` NO se cambia aquí — para eso está "Cambiar a otro tipo". |
| **Cambiar a otro tipo** | Cierra la activa con fecha de hoy, abre nueva con el tipo seleccionado. Lógica existente. |
| **Cerrar (sin abrir nueva)** | Cierra la activa con fecha de hoy. La persona queda "sin vinculación". Lógica existente. |

Caso de borde: si por alguna razón hay más de una vinculación activa para la persona (estado inconsistente que no debería ocurrir bajo uso normal), el modo "editar" devuelve error y pide al jefe que arregle la inconsistencia manualmente antes de seguir. Esto evita que un `updateMany` modifique varias filas a la vez sin que el jefe lo note.

### Gestión de acceso: una ruta con tres flujos condicionales

La página `/jefe/equipo/[id]/acceso` lee `persona.usuarios` y decide qué renderizar:

**Si `persona.usuarios.length === 0` → Crear acceso**

- Campos: email (debe contener `@`), password (≥ 8 caracteres), rol (radio: JEFE / BODEGA / ALMACEN / TRABAJADOR).
- Action `crearAccesoParaPersona`: reusa el patrón de `crearMiembro`. Llama `crearClienteSupabaseAdmin().auth.admin.createUser()` con `email_confirm: true`, después `prisma.usuarios.create()` con el `id` retornado por Supabase y `persona_id` enlazado.
- Rollback: si falla el insert en `usuarios`, se borra el usuario de Supabase Auth.

**Si `persona.usuarios.length === 1` → Dos formularios visibles en la misma página**

1. **Cambiar rol:** muestra rol actual + select con los 4 valores válidos. Action `cambiarRolUsuario` hace `UPDATE usuarios SET rol = ? WHERE id = ?`. Sin restricciones cruzadas (no hay regla "solo un JEFE", el sistema permite varios).
2. **Resetear contraseña:** dos inputs (nueva + confirmación), ambos ≥ 8 caracteres y deben coincidir. Action `resetearContrasenaUsuario` llama `crearClienteSupabaseAdmin().auth.admin.updateUserById(id, { password })`. Mensaje de éxito: "Contraseña actualizada. Compártesela al usuario."

(Caso `length > 1`: no debería ocurrir; si ocurre, la página muestra error y no permite acciones. La relación `personas.usuarios` no tiene constraint de unicidad pero el flujo de creación siempre crea un solo usuario por persona.)

### Validaciones

| Campo | Regla |
|---|---|
| `fecha_nacimiento` | Opcional. Si se envía, debe parsear como fecha válida y ser ≤ hoy. |
| `rol_finca` (editar) | Texto libre, opcional (igual que hoy). |
| `salario_base` (editar, tipo FIJO) | Número finito > 0. |
| `periodo_pago` (editar, tipo FIJO) | Enum: MENSUAL / QUINCENAL / SEMANAL. |
| `tarifa_jornal` (editar, tipo JORNALERO) | Número finito > 0. |
| `email` (crear acceso) | Contiene `@`. Si Supabase devuelve `already registered`, mensaje: "Ese correo ya está registrado en el sistema." |
| `password` (crear acceso o resetear) | ≥ 8 caracteres. En reset, debe coincidir con confirmación. |
| `rol` (crear o cambiar) | Enum: JEFE / BODEGA / ALMACEN / TRABAJADOR. |

Todas las actions devuelven `{ error: string \| null; exito: string \| null }` para mantener el patrón existente con `useActionState`.

## Componentes y archivos

```
app/(app)/jefe/equipo/
├── acciones.ts                              [MODIFICAR]
│   └── crearMiembro: aceptar fecha_nacimiento
├── nuevo/
│   └── FormularioNuevoMiembro.tsx           [MODIFICAR]
│       └── input fecha_nacimiento
├── [id]/
│   ├── page.tsx                             [MODIFICAR]
│   │   └── link "Gestionar acceso" → /jefe/equipo/[id]/acceso
│   ├── acciones.ts                          [MODIFICAR]
│   │   ├── actualizarPersonaYVinculacion: aceptar fecha_nacimiento + modo "editar"
│   │   └── (nueva acción interna) editar in-place de vinc activa
│   ├── editar/
│   │   ├── page.tsx                         [SIN CAMBIOS estructurales]
│   │   └── FormularioEditarMiembro.tsx      [MODIFICAR]
│   │       ├── input fecha_nacimiento
│   │       └── radio modo "editar" + sub-form
│   └── acceso/                              [NUEVO]
│       ├── page.tsx                         [server component]
│       ├── acciones.ts                      [crearAccesoParaPersona,
│       │                                     cambiarRolUsuario,
│       │                                     resetearContrasenaUsuario]
│       ├── FormularioCrearAcceso.tsx        [client]
│       ├── FormularioCambiarRol.tsx         [client]
│       └── FormularioResetContrasena.tsx    [client]
```

## Flujos paso a paso

### Flujo 1: Crear miembro con fecha de nacimiento

1. Jefe va a `/jefe/equipo/nuevo`.
2. Llena nombre, cédula, teléfono, **fecha de nacimiento (nuevo, opcional)**, notas.
3. Selecciona tipo de vinculación y rellena campos correspondientes.
4. Opcional: marca "Crear acceso al sistema" y llena email/password/rol.
5. Submit → `crearMiembro` action persiste persona (con fecha_nacimiento), vinculación y opcionalmente acceso.
6. Redirige a `/jefe/equipo` con la persona creada visible en la lista.

### Flujo 2: Editar vinculación activa sin cerrarla

1. Jefe ve detalle de persona, hace click en "Editar".
2. En la sección "Vinculación", elige radio "Editar la activa".
3. Aparece sub-form con los campos correspondientes al `tipo` de la vinculación activa (no se puede cambiar el tipo aquí).
4. Modifica salario / rol_finca / tarifa / periodo según aplique.
5. Submit → `actualizarPersonaYVinculacion` con `modo=editar` hace `UPDATE` sobre la vinculación con `fecha_fin IS NULL`.
6. Redirige al detalle, histórico intacto.

### Flujo 3: Dar acceso a persona existente

1. Jefe ve detalle de persona que no tiene usuario. En la sección "Acceso al sistema" ve botón "Dar acceso al sistema".
2. Click → navega a `/jefe/equipo/[id]/acceso`.
3. La página detecta que no hay usuario, renderiza form de creación.
4. Jefe llena email, password (mín 8), elige rol.
5. Submit → `crearAccesoParaPersona` crea usuario en Supabase Auth + fila en `usuarios` enlazada al `persona_id`.
6. Si falla el insert en `usuarios`, rollback del Supabase Auth.
7. Redirige al detalle de persona, que ahora muestra la sección de acceso con email y rol.

### Flujo 4: Cambiar rol de un usuario

1. Jefe ve detalle de persona con acceso, hace click en "Gestionar acceso".
2. La página detecta usuario existente, muestra los dos formularios.
3. En "Cambiar rol", jefe selecciona nuevo rol y submit.
4. `cambiarRolUsuario` hace `UPDATE usuarios SET rol = ? WHERE id = ?`.
5. Mensaje de éxito visible. La página se revalida y muestra el nuevo rol.

### Flujo 5: Resetear contraseña

1. Mismo punto de entrada que el anterior.
2. En "Resetear contraseña", jefe escribe nueva contraseña y confirmación.
3. Submit → `resetearContrasenaUsuario` valida (≥ 8, coinciden) y llama `supabaseAdmin.auth.admin.updateUserById(id, { password })`.
4. Mensaje: "Contraseña actualizada. Compártesela al usuario."
5. El usuario afectado puede iniciar sesión con la nueva contraseña; sus sesiones previas no se invalidan (Supabase no las invalida automáticamente en este flujo, y no es requisito invalidarlas).

## Manejo de errores

- **Email duplicado al crear acceso:** Supabase devuelve mensaje con "already registered" o "already exists". La action lo detecta con regex y devuelve "Ese correo ya está registrado en el sistema."
- **Rollback al crear acceso:** si Supabase crea el user pero `prisma.usuarios.create` falla, se llama `supabaseAdmin.auth.admin.deleteUser(authData.user.id)` para no dejar huérfano.
- **Fecha de nacimiento futura:** la action valida y devuelve "La fecha de nacimiento no puede ser futura."
- **Edición de vinc activa con tipo inconsistente:** si el form envía un `tipo` distinto al de la vinc activa, la action ignora ese campo (el tipo no se cambia en modo "editar").
- **Múltiples vinculaciones activas:** la action de "editar" cuenta vinculaciones con `fecha_fin IS NULL` antes de actualizar. Si hay > 1, devuelve error: "Hay más de una vinculación activa para esta persona. Pídele al admin que revise la base de datos."
- **Persona inexistente o borrada:** todas las pages hacen `notFound()` si la persona no existe o tiene `deleted_at` (aunque hoy ese campo no se setea desde la UI, la consulta lo respeta por consistencia).
- **Sesión no JEFE:** todas las pages y actions empiezan con `await requerirUsuario("JEFE")`.

## Pruebas y verificación

No hay suite de tests automatizados en el proyecto (verificado: no existe `vitest.config` ni `jest.config`). La verificación es manual contra la base de datos real, siguiendo este checklist:

**Crear y leer fecha_nacimiento:**
- Crear persona con fecha → ver detalle → la fecha aparece formateada.
- Crear persona sin fecha → ver detalle → muestra "—".
- Editar persona y agregar fecha → guardar → ver detalle → la fecha aparece.
- Intentar fecha futura → mensaje de error visible.

**Editar vinculación activa:**
- Persona FIJO con salario 1.000.000. Editar → cambiar a 1.200.000 → guardar → ver detalle → salario actualizado, histórico **sin entrada nueva**.
- Persona JORNALERO con tarifa 50.000. Editar → cambiar a 60.000 → guardar → tarifa actualizada, histórico sin entrada nueva.
- Persona sin vinculación activa → el radio "Editar la activa" está deshabilitado.

**Crear acceso para persona existente:**
- Persona sin usuario → click "Dar acceso" → llenar email/pass/rol → guardar → vuelve al detalle, ahora muestra "Acceso al sistema".
- Intentar con email ya usado → error claro.
- Intentar password < 8 caracteres → error claro.

**Cambiar rol:**
- Persona TRABAJADOR → cambiar a BODEGA → recargar → ver detalle → rol nuevo visible.
- Verificar que las RLS de Supabase responden al nuevo rol (probar logueándose con ese usuario y verificando que ve la UI de bodega).

**Resetear contraseña:**
- Resetear con nueva contraseña → cerrar sesión del afectado → login con nueva contraseña → ok.
- Intentar contraseñas que no coinciden → error claro.

## Notas operacionales

- No requiere migración SQL nueva. Todas las columnas existen en el schema actual (`personas.fecha_nacimiento`, `usuarios.rol`, `vinculaciones.*`).
- No requiere cambios en `prisma/schema.prisma` ni en RLS policies.
- El despliegue es solo código: PR + merge a main + auto-deploy en Vercel.
