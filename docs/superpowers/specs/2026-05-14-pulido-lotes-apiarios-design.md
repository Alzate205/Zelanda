# Pulido lotes + apiarios + perfil — Spec de diseño

**Fecha:** 2026-05-14
**Autor:** Samuel Alzate (con Claude)
**Estado:** Aprobado por el usuario

---

## 1. Contexto

Tras desplegar el núcleo `personas + vinculaciones`, el usuario eligió pulir lo ya construido antes de avanzar a Fase 3 (tareas y asignaciones). Huecos concretos en lo existente:

1. **Lote** tiene lista (en el mapa) y detalle, pero **no se puede editar**. Hoy no hay forma de corregir nombre, hectáreas o notas desde la UI.
2. **Apiario** solo aparece como marker pendiente en el mapa. No hay card en la lista, ni detalle, ni edición. El usuario quiere que el apiario tenga "el mismo trato" que el lote (lista + detalle + editar) para ver cuántas colmenas hay, su ubicación, y poder ajustar esos datos cuando cambien.
3. **Mi perfil / cambiar contraseña** — hoy ningún usuario (ni siquiera el jefe) puede ver sus propios datos ni cambiar su contraseña desde la app. Es transversal a los 4 roles.
4. **Cerrar vinculación sin abrir otra** — hoy el formulario de editar miembro solo permite *cambiar* la vinculación a otra. Falta el caso real de "jornalero que no volvió" o "fijo que salió y aún no se sabe si vuelve". Cierra la vinculación activa y la persona queda sin vinculación activa.

Este spec define ese pulido. **No incluye polígonos ni coordenadas** (postergados hasta captura en campo). **No incluye foto de persona, buscar/filtrar equipo, ni crear lote/apiario nuevo** (YAGNI hasta que duelan).

---

## 2. Alcance

### Sí incluye

1. **Editar lote**: pantalla `/jefe/lotes/[id]/editar` con campos editables (nombre, hectáreas, fecha_siembra, notas).
2. **Detalle apiario**: pantalla `/jefe/apiarios/[id]` con info y botón "Editar".
3. **Editar apiario**: pantalla `/jefe/apiarios/[id]/editar` con campos editables (nombre, total_colmenas, ubicacion_descripcion, activo).
4. **Sección de apiarios en `/jefe/lotes`**: bajo el mapa, debajo del grid de lotes, con su propio grid de cards clickeables al detalle.
5. **Mi perfil** `/mi-perfil`: pantalla transversal con datos personales editables (nombre, cédula, teléfono, notas) + sección de cambiar contraseña.
6. **Cerrar vinculación sin abrir otra**: tercera opción en el formulario de editar miembro (además de "no cambiar nada" y "cambiar a otra"). Sólo cierra `fecha_fin` de la activa.
7. **Header con acceso a Mi perfil**: el avatar + nombre del header pasa a ser un Link a `/mi-perfil`. El botón de cerrar sesión sigue donde está.

### No incluye (YAGNI)

- Crear nuevo lote o nuevo apiario (los 15 lotes y los 2 apiarios están seedeados y son fijos por ahora).
- Eliminar lote o apiario (los lotes son fijos; los apiarios tienen flag `activo` para "ocultar").
- Editar polígono de lote o coordenadas de apiario (postergado hasta captura en campo).
- Editar `total_arboles` (se calculará desde el conteo real cuando se carguen árboles).
- Foto de persona (requiere setup Supabase Storage; se hará cuando aporte valor operativo).
- Buscar/filtrar equipo (hoy hay 1 persona; se hará cuando duela).
- Toggle "ver inactivos" en equipo (la lista ya muestra todas ordenadas por activo desc).
- Cambios en RLS (las policies para `lotes`, `apiarios`, `personas` y `vinculaciones` ya existen).
- Renombrar el ítem "Lotes" del bottom nav.

---

## 3. Decisiones de diseño

### 3.1 Apiario sigue el mismo patrón que lote y persona

"Lista → detalle → editar" en todas las entidades de la app. Refuerza la regla "general antes que específico" del usuario.

### 3.2 Apiarios en `/jefe/lotes`, no en ruta aparte

Lotes y apiarios juntos en la misma pantalla (en secciones separadas debajo del mapa). Evita meter un ítem nuevo en el bottom nav y mantiene la idea de "esta es la pantalla del territorio de la finca". La ruta del detalle sí va aparte (`/jefe/apiarios/[id]`) porque conceptualmente son entidades distintas.

### 3.3 Soft-delete vs activo

- **Lote** usa `deleted_at` (soft-delete) porque tiene historia (árboles, cosechas, asignaciones). No se elimina en este pulido.
- **Apiario** usa flag `activo` (catálogo) según el esquema existente. El toggle "Activo" en el formulario de editar es la única forma de "ocultar" un apiario.

### 3.4 `total_arboles` no editable

El total real saldrá del conteo de filas en `arboles` cuando se carguen. Permitir editarlo a mano abre la puerta a desincronización.

### 3.5 Validación de nombre único en lote

`lotes.nombre` tiene `@unique`. Antes del `update`, el Server Action verifica si el nombre ya existe en otro lote (excluyendo el actual) y devuelve un error amigable.

### 3.6 Mi perfil: ruta transversal (fuera de `/jefe`, `/bodega`, etc.)

`/mi-perfil` vive directo bajo `(app)/` porque los 4 roles deben poder acceder. `requerirUsuario()` sin rol específico.

### 3.7 Cambiar contraseña: vía Supabase Auth

`supabase.auth.updateUser({ password })` desde el Server Action en server-side, usando el cliente Supabase con la cookie del usuario actual (no service role). Esto exige tener configurado un Supabase server client para acciones — ya está en el proyecto (lo usa el login).

### 3.8 Edición de "mi persona" desde Mi perfil

Solo edita campos de su `personas` (nombre, cédula, teléfono, notas). **No** puede editar su propia `vinculación` (eso es función del jefe). **No** puede cambiar su `rol_app` ni su email. Para todo eso, debe pedirle al jefe.

### 3.9 Estado "sin vinculación" tras cerrar la activa

Cuando un jefe usa la opción nueva de cerrar vinculación sin abrir otra, la persona queda con `vinculaciones` históricas pero ninguna activa. La lista la marca con badge "Sin vinculación" (ya existe ese badge). No se desactiva la persona automáticamente — el jefe decide después si la desactiva.

---

## 4. Arquitectura

### 4.1 Rutas y archivos

| Ruta | Tipo | Archivo |
|---|---|---|
| `/jefe/lotes` | Modificada | `app/(app)/jefe/lotes/page.tsx` — agrega sección "Apiarios" |
| `/jefe/lotes/[id]` | Modificada | `app/(app)/jefe/lotes/[id]/page.tsx` — agrega botón "Editar" |
| `/jefe/lotes/[id]/editar` | Nueva | `page.tsx` + `FormularioEditarLote.tsx` |
| `/jefe/lotes/[id]/acciones.ts` | Nuevo | Server Action `actualizarLote` |
| `/jefe/apiarios/[id]` | Nueva | `app/(app)/jefe/apiarios/[id]/page.tsx` |
| `/jefe/apiarios/[id]/editar` | Nueva | `page.tsx` + `FormularioEditarApiario.tsx` |
| `/jefe/apiarios/[id]/acciones.ts` | Nuevo | Server Action `actualizarApiario` |
| `/mi-perfil` | Nueva | `page.tsx` + `FormularioMisDatos.tsx` + `FormularioCambiarContrasena.tsx` |
| `/mi-perfil/acciones.ts` | Nuevo | Server Actions `actualizarMisDatos` + `cambiarMiContrasena` |
| `/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx` | Modificado | Agrega 3ª opción: "Cerrar la vinculación activa" |
| `/jefe/equipo/[id]/acciones.ts` | Modificado | `actualizarPersonaYVinculacion` soporta modo "cerrar" sin abrir nueva |
| `components/shared/HeaderApp.tsx` | Modificado | Avatar + nombre se vuelven `<Link href="/mi-perfil">` |

### 4.2 Patrón de Server Actions

Copia del patrón ya establecido en `app/(app)/jefe/equipo/[id]/acciones.ts`:

```ts
"use server";

export type EstadoEdicion = { error: string | null };

export async function actualizarLote(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  // … validar id, parsear campos, validar reglas …
  // … prisma.lotes.update(…)
  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath("/jefe/lotes");
  redirect(`/jefe/lotes/${loteId}`);
}
```

Igual para `actualizarApiario`, `actualizarMisDatos`, `cambiarMiContrasena`.

### 4.3 Patrón de Formularios

Copia del patrón en `FormularioEditarMiembro.tsx`:
- `useActionState(accion, ESTADO_INICIAL)`
- Inputs con clases `inputBase` y `labelBase` definidas inline
- Botón "Cancelar" → Link al detalle (o al perfil)
- Botón "Guardar" → submit, deshabilitado mientras `pendiente`
- Error en bloque rojo arriba de los botones

---

## 5. Componentes y datos

### 5.1 Editar lote — campos y validaciones

| Campo | Tipo | Validación | Default |
|---|---|---|---|
| nombre | string | requerido, no vacío, único entre lotes activos (excluyendo el actual) | valor actual |
| hectareas | decimal opcional | si presente: `Number.isFinite` y >= 0 | valor actual |
| fecha_siembra | date opcional | si presente: fecha válida | valor actual |
| notas | string opcional | sin validación | valor actual |

### 5.2 Detalle apiario — secciones

```
← Apiarios (link al listado)

APIARIO (eyebrow)
Apiario El Cedro (h1)
[Editar] (link al editar)

Sección "Información"
  Colmenas       12
  Ubicación      Sector norte de la finca
  Estado         Activo

Sección "Visitas y cosechas"
  Las tareas y cosechas de miel aparecerán aquí en la Fase 3.
```

### 5.3 Editar apiario — campos y validaciones

| Campo | Tipo | Validación | Default |
|---|---|---|---|
| nombre | string | requerido, no vacío | valor actual |
| total_colmenas | int | requerido, entero >= 0 | valor actual |
| ubicacion_descripcion | string opcional | sin validación | valor actual |
| activo | boolean | toggle/checkbox | valor actual |

### 5.4 Lista `/jefe/lotes` — sección nueva de apiarios

Después del grid de lotes:

```tsx
<section>
  <h2 className="font-serif …">Apiarios <span>(2)</span></h2>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {apiarios.map((a) => (
      <Link href={`/jefe/apiarios/${a.id}`} key={…} className="…">
        <div className="flex items-center gap-2">
          <Hexagon className="h-4 w-4 text-zelanda-ocre-500" />
          <h3>{a.nombre}</h3>
        </div>
        <div className="text-xs …">
          {a.total_colmenas} colmenas
          {a.ubicacion_descripcion ? ` · ${a.ubicacion_descripcion}` : ""}
        </div>
      </Link>
    ))}
  </div>
</section>
```

El ícono `Hexagon` de lucide-react diferencia visualmente apiario de lote sin recurrir a emojis.

### 5.5 Mi perfil — estructura

Pantalla `/mi-perfil` con dos secciones independientes (dos `<form>` separados):

**Sección "Mis datos"** (`FormularioMisDatos.tsx`):
- Lectura: rol_app (badge), vinculación activa (badge, si tiene), email (read-only)
- Editable: nombre_completo, cedula, telefono, notas
- Botón "Guardar" → Server Action `actualizarMisDatos`

**Sección "Cambiar contraseña"** (`FormularioCambiarContrasena.tsx`):
- Editable: contrasena_nueva, contrasena_confirmacion
- Validación cliente y servidor: mínimo 6 caracteres, las dos coinciden
- Botón "Cambiar contraseña" → Server Action `cambiarMiContrasena`
- Mensaje de éxito separado del error

### 5.6 Modificación al formulario de editar miembro

En `FormularioEditarMiembro.tsx`, cambiar el patrón de "checkbox cambiar vinculación" a un select con 3 opciones:

```
Vinculación actual: Familia (Propietario)

¿Qué hacer con la vinculación?
( ) Dejarla como está
( ) Cambiar a otro tipo
( ) Cerrarla (sin abrir nueva)
```

Si elige "Cambiar a otro tipo": muestra los campos actuales del formulario (tipo, rol_finca, salario/tarifa según tipo).
Si elige "Cerrarla": muestra una advertencia ("Esta persona quedará sin vinculación activa") y nada más.

En `acciones.ts`, `actualizarPersonaYVinculacion` recibe `modo_vinculacion` con valor `dejar | cambiar | cerrar`.

### 5.7 Modificación al header

`HeaderApp.tsx` envuelve el bloque del avatar + nombre + rol en un `<Link href="/mi-perfil">`. El botón de logout queda como está.

---

## 6. Flujo de datos

### Editar lote
1. Usuario en `/jefe/lotes/[id]` → clic "Editar" → navega a `/jefe/lotes/[id]/editar`.
2. Page carga el lote por ID; si no existe o está soft-deleted → `notFound()`.
3. Form muestra valores actuales en defaultValue.
4. Submit → Server Action valida, actualiza, `revalidatePath` y `redirect` al detalle.
5. Si validación falla, vuelve al form con el mensaje de error.

### Editar apiario
Idéntico al flujo de lote.

### Mi perfil — guardar datos
1. Usuario clic en avatar/nombre del header → navega a `/mi-perfil`.
2. Page carga `personas` del usuario actual + email (de `usuarios` + `auth.users`).
3. Form muestra datos actuales.
4. Submit → Server Action `actualizarMisDatos`:
   - `requerirUsuario()` (sin rol específico)
   - Obtiene `persona_id` del usuario actual
   - Si `persona_id` es null → `{ error: "Tu cuenta no está vinculada a una persona; pídele al jefe que te asocie." }`
   - Actualiza `personas` con los nuevos datos
   - `revalidatePath("/mi-perfil")` y se queda en la página con mensaje de éxito
5. Si falla, vuelve al form con error.

### Mi perfil — cambiar contraseña
1. Usuario llena ambos campos.
2. Submit → Server Action `cambiarMiContrasena`:
   - `requerirUsuario()`
   - Valida que ambas contraseñas coincidan
   - Valida longitud mínima
   - Llama a `supabase.auth.updateUser({ password })` con el cliente server (cookie del usuario actual)
   - Si éxito → mensaje "Contraseña actualizada"
   - Si error de Supabase → `{ error: errorSupabase.message }`

### Cerrar vinculación sin abrir otra
1. En `FormularioEditarMiembro`, el jefe elige "Cerrarla (sin abrir nueva)".
2. Submit → `actualizarPersonaYVinculacion`:
   - Si `modo_vinculacion === "cerrar"`: `updateMany` sobre `vinculaciones.fecha_fin = today` donde `persona_id = id AND fecha_fin IS NULL`. **No** crea nueva.
3. Redirige al detalle. El detalle muestra "Sin vinculación activa" y el histórico cerrado.

### Lista con apiarios
1. Page `/jefe/lotes` carga lotes + apiarios en paralelo (ya lo hace hoy).
2. Renderiza mapa + sección "Lotes" (existente) + sección "Apiarios" (nueva).

---

## 7. Errores y casos borde

- **Nombre de lote duplicado:** Server Action chequea `prisma.lotes.findFirst({ where: { nombre, NOT: { id }, deleted_at: null } })`. Si existe → `{ error: "Ya hay otro lote con ese nombre" }`.
- **Total colmenas negativo o no entero:** validación numérica.
- **Apiario no encontrado en detalle:** `notFound()`.
- **Lote soft-deleted:** `notFound()`.
- **Mi perfil — persona_id null:** mostrar mensaje claro de "pídele al jefe que te asocie". No bloquear el cambio de contraseña en ese caso (un usuario puede no tener persona y querer cambiar su contraseña igual).
- **Mi perfil — contraseñas no coinciden:** validación en cliente Y servidor.
- **Mi perfil — Supabase rechaza el password:** error de Supabase devuelto tal cual.
- **Cerrar vinculación cuando no hay activa:** botón no aparece o `updateMany` no hace nada. Idempotente. Sin error.
- **Permisos:**
  - Lote y apiario: `requerirUsuario("JEFE")`.
  - Mi perfil: `requerirUsuario()` sin rol.
  - Cerrar vinculación: `requerirUsuario("JEFE")` (ya en `actualizarPersonaYVinculacion`).
- **Concurrencia:** sin manejo especial.

---

## 8. Testing

No hay framework de tests configurado. Validación manual en navegador + móvil.

### Lote
1. Detalle `/jefe/lotes/1` → ver botón "Editar".
2. Clic "Editar" → form pre-llenado.
3. Cambiar `notas`, guardar → vuelta al detalle con datos nuevos.
4. Cambiar `hectareas` a `-5` → error visible.
5. Intentar dejar `nombre` vacío → error visible.
6. Cambiar nombre al de otro lote existente → error "Ya hay otro lote con ese nombre".
7. Móvil: form se ve bien.

### Apiario
1. `/jefe/lotes` → ver sección "Apiarios" con 2 cards.
2. Clic en card → detalle con info correcta.
3. Clic "Editar" → form pre-llenado.
4. Cambiar `total_colmenas` a `15`, guardar → vuelve al detalle con 15.
5. Toggle `activo = false`, guardar → vuelve al detalle con estado "Inactivo".
6. Recargar `/jefe/lotes` → apiario inactivo ya no aparece en el grid (la query filtra por `activo=true`).

### Mi perfil
1. Logueado como jefe → click en avatar/nombre del header → llega a `/mi-perfil`.
2. Ver datos personales pre-llenados.
3. Cambiar teléfono, guardar → mensaje de éxito visible, datos persisten al recargar.
4. Cambiar contraseña con valores que coinciden → mensaje éxito.
5. Cerrar sesión, volver a entrar con contraseña nueva → ok.
6. Volver a /mi-perfil, intentar cambiar contraseña con valores que no coinciden → error visible.
7. Logout y login con otro rol (bodega, almacén, trabajador si hay) → /mi-perfil funciona también.

### Cerrar vinculación
1. Crear/elegir un miembro con vinculación FAMILIAR activa.
2. Editar → elegir "Cerrarla (sin abrir nueva)" → Guardar.
3. Detalle muestra "Sin vinculación activa".
4. Histórico muestra la FAMILIAR con fecha_fin = hoy.
5. Lista de equipo muestra badge "Sin vinculación".

### Header
1. Click en avatar del header → llega a `/mi-perfil` desde cualquier rol.
2. Click en botón logout sigue funcionando.

### Build y lint
- `npm run build` debe pasar limpio.
- `npm run lint` sin warnings nuevos.

---

## 9. Plan de migración / despliegue

- No hay cambios de schema Prisma.
- No hay cambios de RLS.
- No hay scripts SQL.
- Solo cambios de código: rutas nuevas + lógica de Server Actions + UI.
- Despliegue: push a `main` → Vercel auto-deploya.
- Sin downtime esperado.

---

## 10. Decisiones pendientes (para `docs/decisiones-pendientes.md`)

- D-014: ¿Auto-desactivar persona al cerrar su vinculación activa? Por ahora **NO** (el jefe decide). Si después se siente molesto, revisar.

---

## 11. Próximos pasos después del pulido

Volver a la conversación de "qué sigue":
- Fase 3 (tareas y asignaciones) — el bloque principal pendiente.
- Otros pulidos pendientes según prioridad: foto de persona, buscar/filtrar equipo, crear apiario nuevo (si compran un tercero).
