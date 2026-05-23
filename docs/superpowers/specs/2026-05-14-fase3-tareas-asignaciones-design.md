# Fase 3 — Tareas y asignaciones (con apicultura) — Spec de diseño

**Fecha:** 2026-05-14
**Autor:** Samuel Alzate (con Claude)
**Estado:** Aprobado por el usuario

---

## 1. Contexto

Con el núcleo `personas + vinculaciones`, los pulidos de lote/apiario/perfil ya desplegados, el sistema tiene infraestructura pero **no tiene operación real**. Fase 3 es lo que convierte FincApp en una app útil de campo: jefe asigna tareas, trabajador ejecuta y reporta, sistema calcula próximas fechas y alerta de lo vencido.

CLAUDE.md §5.2 describe esto a grandes rasgos. Este spec lo aterriza decisión por decisión.

**Alcance integrado:** apicultura entra en Fase 3 (no Fase 5 como decía CLAUDE.md). Razón: la operación real mezcla "mañana abejas, tarde recolección" en un mismo trabajador; separar las dos cosas en fases distintas hace que la app no refleje la realidad.

---

## 2. Alcance final

### Sí incluye (12 módulos)

1. **Schema migration**: `asignaciones.lote_id` nullable + `asignaciones.apiario_id` nullable + CHECK XOR; `tipo_registro` agrega `VISITA`.
2. **Supabase Storage**: bucket `fotos` + RLS + helper upload + componente `SubirFoto`.
3. **Carga de árboles**: `total_arboles` editable en form de editar lote + Server Action "generar/sincronizar árboles" (1..N).
4. **Catálogo de tipos de tarea**: CRUD del jefe sobre `tipos_tarea`. Los 8 default ya seedeados son editables (excepto `area`, que se bloquea para preservar coherencia histórica).
5. **Frecuencias por lote y por apiario**: pantalla de override por entidad.
6. **Asignaciones CRUD del jefe**: lista filtrable + crear + detalle + cancelar/reabrir.
7. **Lista de tareas del trabajador**: home rediseñada `/trabajador`.
8. **Avance TRAMO/SUELTOS** para asignaciones de lote (cultivo).
9. **Avance VISITA** para asignaciones de apiario (apicultura).
10. **Reporte de novedad**: cualquier persona, sobre árbol específico, con foto opcional.
11. **Dashboard del jefe** `/jefe`: alertas vencidas + próximas + novedades sin resolver.
12. **Sección "Tareas y estado"** en detalle de lote/apiario.

### No incluye (YAGNI / postergar)

- Ficha individual de árbol detallada (Pokédex). La vista del árbol son sus novedades.
- Multi-selección de trabajadores en una sola acción de "crear asignación". Por ahora jefe crea N asignaciones individuales si necesita varios trabajadores.
- Auto-creación de la siguiente asignación al completar una.
- PWA offline / IndexedDB / sync (sigue siendo Fase 5).
- Push notifications.
- Registro detallado de cosecha de miel (kg por colmena). En esta fase la cosecha de miel se documenta como observación libre en un registro VISITA.

---

## 3. Decisiones de diseño

### 3.1 Una asignación = una persona; un destino (lote XOR apiario)
El schema actual ya tiene `persona_id` singular. Si tres jornaleros platean el lote Armenia juntos, son tres asignaciones. Cada uno trackea su propio avance.

### 3.2 Una persona puede tener varias asignaciones abiertas
El índice `idx_asign_persona_estado` está diseñado para esto. Trabajador entra a la app y ve todas sus asignaciones PENDIENTE + EN_CURSO. No hay límite.

### 3.3 Auto-COMPLETADA cuando termina el avance
- **Cultivo**: cuando `arboles_completados >= lote.total_arboles`, el último `registros_avance` marca la asignación como COMPLETADA con `fecha_completada = NOW()`.
- **Apicultura**: al primer `registros_avance` de tipo VISITA, la asignación se marca como COMPLETADA. Cada visita = una asignación = un evento.

### 3.4 No auto-creación de la próxima asignación
Cuando una asignación se completa, el lote/apiario queda "al día" para ese tipo. El sistema calcula la próxima_fecha (= ultima_completada + frecuencia) y muestra alertas, pero la siguiente asignación la crea el jefe manualmente. Auto-generación se puede pensar en una fase futura cuando haya datos reales de cuándo se atiende vs cuándo el sistema sugiere.

### 3.5 Frecuencia: override por entidad sobre default global
Para `(lote_id, tipo_tarea_id)`: si hay row en `frecuencias_lote` → usa esa; si no → `tipos_tarea.frecuencia_dias_default`. La tabla `frecuencias_lote` no tiene `apiario_id` hoy → para apiarios, igual lógica con un agregado al schema o usando solo el default global. **Decisión:** apiarios usan solo el default global del tipo (no se overridean por apiario). Razón: hay solo 2 apiarios; si un día se necesita override por apiario, agregamos otra tabla o ampliamos `frecuencias_lote`. YAGNI por ahora.

### 3.6 Próxima fecha: sin historial = "nunca hecho" = vencida desde día 1
Para un `(lote, tipo)` sin ninguna asignación COMPLETADA, mostramos "Sin historial" en la columna "última" y la próxima_fecha es indeterminada — la mostramos como **vencida** (rojo) con etiqueta "Nunca hecho". Razón: si el sistema no sabe cuándo se hizo, hay que hacerlo o registrar manualmente cuándo se hizo. Esto fuerza a que cada (lote, tipo) tenga al menos una primera asignación COMPLETADA antes de quedar "al día".

### 3.7 Apicultura: tipo de registro VISITA, sin TRAMO/SUELTOS
Cada visita es un evento atómico. El form de avance para asignaciones de apiario tiene un solo flujo (descripción + foto opcional + completar). Las cosechas de miel se documentan en `observaciones` del registro VISITA (kg, calidad, etc.). Si después se necesita estructura, se agrega otra tabla.

### 3.8 Schema migration: asignaciones soporta lote o apiario, no ambos
```sql
ALTER TABLE asignaciones ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE asignaciones ADD COLUMN apiario_id BIGINT REFERENCES apiarios(id);
ALTER TABLE asignaciones ADD CONSTRAINT chk_asign_lote_xor_apiario
  CHECK (
    (lote_id IS NOT NULL AND apiario_id IS NULL) OR
    (lote_id IS NULL AND apiario_id IS NOT NULL)
  );
CREATE INDEX idx_asign_apiario ON asignaciones(apiario_id);

ALTER TYPE tipo_registro ADD VALUE 'VISITA';
```

### 3.9 Carga de árboles: jefe decide N por lote, generación idempotente
- Form de editar lote agrega input `total_arboles` (hoy excluido).
- Al guardar, si `total_arboles` aumenta vs los árboles ya generados, el Server Action genera filas `arboles` con `numero_placa = max(existente) + 1 .. nuevo_total`.
- Si baja, **no borra** — alerta visible: "Hay árboles cargados por encima del nuevo total. Manejarlos manualmente si necesario." Preservamos histórico de novedades y asignaciones.
- Si quedan árboles huérfanos por encima del total, la UI los muestra pero el "% completado" se calcula sobre `total_arboles` actual (el jefe define la verdad).
- Botón explícito "Generar árboles faltantes" en el detalle del lote (alternativa a editar lote — para sincronizar sin cambiar total).

### 3.10 Apicultura: frecuencias_lote NO se usa para apiarios
Decisión 3.5 — apiarios usan solo el default global. La query de "próxima fecha" para apiario solo lee `tipos_tarea.frecuencia_dias_default`.

### 3.11 Fotos solo en novedades en esta fase
`registros_avance.foto_path` existe en schema pero la UI no permite subir foto en TRAMO/SUELTOS/VISITA. Solo novedades aceptan foto. Si en uso real surge la necesidad de foto en avance, se agrega después.

### 3.12 RLS: aprovechar las ya existentes
Las RLS de `asignaciones`, `registros_avance`, `novedades` ya están definidas en `supabase/policies.sql`. Verificar:
- Jefe: CRUD completo de todo.
- Trabajador: ve sus asignaciones, crea registros_avance de sus asignaciones, crea novedades.
- Bodega/Almacén: ¿qué ven? Hoy probablemente no tocan asignaciones. Verificar policies actuales y ajustar si hace falta (sin abrir el alcance demasiado).

---

## 4. Arquitectura — Rutas y archivos

### Jefe

| Ruta | Tipo | Archivo |
|---|---|---|
| `/jefe` | Modificada | `page.tsx` — dashboard con alertas + novedades sin resolver |
| `/jefe/tareas` | Nueva | `page.tsx` — catálogo de tipos |
| `/jefe/tareas/nuevo` | Nueva | `page.tsx` + `FormularioNuevoTipo.tsx` |
| `/jefe/tareas/[id]/editar` | Nueva | `page.tsx` + `FormularioEditarTipo.tsx` |
| `/jefe/tareas/acciones.ts` | Nuevo | `crearTipoTarea`, `actualizarTipoTarea`, `cambiarEstadoTipo` |
| `/jefe/asignaciones` | Nueva | `page.tsx` con filtros |
| `/jefe/asignaciones/nueva` | Nueva | `page.tsx` + `FormularioNuevaAsignacion.tsx` |
| `/jefe/asignaciones/[id]` | Nueva | `page.tsx` con historial de registros |
| `/jefe/asignaciones/acciones.ts` | Nuevo | `crearAsignacion`, `cancelarAsignacion`, `reabrirAsignacion` |
| `/jefe/novedades` | Nueva | `page.tsx` lista |
| `/jefe/novedades/[id]` | Nueva | `page.tsx` + acciones para resolver |
| `/jefe/novedades/acciones.ts` | Nuevo | `marcarResuelta` |
| `/jefe/lotes/[id]/frecuencias` | Nueva | `page.tsx` + `FormularioFrecuencias.tsx` + `acciones.ts` |
| `/jefe/lotes/[id]/page.tsx` | Modificada | agregar sección "Tareas y estado" + "Novedades del lote" |
| `/jefe/lotes/[id]/editar/page.tsx` | Modificada | agregar campo `total_arboles` + acción genera árboles |
| `/jefe/lotes/[id]/acciones.ts` | Modificada | extender `actualizarLote` para manejar `total_arboles` y generar |
| `/jefe/apiarios/[id]/page.tsx` | Modificada | agregar sección "Tareas y estado" |
| `/jefe/apiarios/[id]/frecuencias` | (no creada) | apiarios usan solo default global; no UI de override |

### Trabajador

| Ruta | Tipo | Archivo |
|---|---|---|
| `/trabajador` | Modificada | `page.tsx` — lista de mis tareas activas |
| `/trabajador/avance/[asignacion_id]` | Nueva | `page.tsx` + `FormAvance.tsx` (TRAMO/SUELTOS para cultivo, VISITA para apicultura) |
| `/trabajador/avance/[asignacion_id]/acciones.ts` | Nuevo | `registrarAvance` |
| `/trabajador/novedad/nueva` | Nueva | `page.tsx` + `FormularioNovedad.tsx` + `acciones.ts` |

### Compartido

| Archivo | Descripción |
|---|---|
| `lib/fechas-tarea.ts` | helpers `proximaFecha(lote, tipo)`, `estadoAlerta(fecha)`, `formatearDiasRestantes` |
| `lib/supabase/storage.ts` | helpers `subirFoto(file, path)`, `urlFoto(path)` |
| `components/shared/SubirFoto.tsx` | client component upload mobile-friendly |
| `supabase/migracion-fase3-apicultura.sql` | el SQL de §3.8 |

### Bottom nav

| Rol | Items actuales | Items finales |
|---|---|---|
| JEFE | Inicio, Lotes, Equipo | Inicio (dashboard), Lotes, Tareas (asignaciones), Equipo |
| TRABAJADOR | Inicio (mis tareas) | Inicio (mis tareas), Reportar novedad (botón sticky inferior en la home, no FAB ni nav item — más discoverable y no requiere agregar ítem al nav) |
| BODEGA, ALMACEN | sin cambios |

---

## 5. Componentes y datos

> **Nota sobre los mockups:** los emojis (🟢 🟡 🔴 ⚠ ⏰ 🔍 🐝 🪲 💧 🌳) que aparecen en los wireframes de esta sección son **solo ilustrativos**. La UI real usa íconos lucide-react + badges con la paleta `estado.{aldia,proxima,vencida,neutro}` de Tailwind, sin emojis (regla del proyecto, CLAUDE.md §8).

### 5.1 Catálogo de tipos de tarea

**Campos editables:**
| Campo | Tipo | Validación |
|---|---|---|
| nombre | string | requerido, único |
| descripcion | string opcional | — |
| frecuencia_dias_default | int | requerido, > 0 |
| area | enum (CULTIVO/APICULTURA) | requerido al crear; **bloqueado** al editar |
| color | string opcional | formato hex `#RRGGBB` |
| icono | string opcional | nombre lucide en kebab-case |
| activo | boolean | toggle |

**Validaciones de Server Action:**
- Crear: nombre único, frecuencia > 0, área válida.
- Editar: igual; bloquear cambio de `area` con error explícito.
- Desactivar: permitido aunque haya asignaciones abiertas; las asignaciones siguen, solo no se pueden crear nuevas.

### 5.2 Frecuencias por lote

UI: tabla de los tipos CULTIVO con dos columnas:
- Default: `tipos_tarea.frecuencia_dias_default`
- Override (input): vacío = usar default; número = override

Submit:
- Para cada tipo: si tiene número distinto del default → upsert en `frecuencias_lote`. Si vacío y había row → delete.

### 5.3 Asignaciones — Crear

Form del jefe:
```
Destino       (○ Lote   ○ Apiario)
[Selector según destino — solo entidades activas]
Tipo de tarea (filtrado por area según destino)
Persona       (vinculadas activamente, cualquier vinculación)
Fecha inicio  (date, default hoy)
[Crear asignación]
```

Server Action: valida (destino consistente con tipo.area), inserta. `creado_por_usuario_id = usuario actual`.

### 5.4 Asignación — Detalle (jefe)

```
← Asignaciones
[Tipo de tarea]  ·  Lote Armenia (o Apiario El Cedro)
Persona: [Diego Toro] · Estado: [EN CURSO]
Fecha inicio: 2026-05-14
Fecha completada: —

Progreso: 845 / 1820 árboles (cultivo) | "Sin registrar" (apicultura)
Último: árbol 845

--- Historial de registros ---
[14 may 09:30]  TRAMO  desde 800 hasta 845 (46 árboles)
                Notas: Lluvia, hice solo la mitad

[Cancelar asignación] (si está abierta)
[Reabrir asignación] (si está completada)
```

### 5.5 Trabajador — home rediseñada

```
[Avatar] Hola, Diego
         Jornalero

Mis tareas activas (3)
──────────────────────
[💧] Plateo químico              [En curso]
     Lote Armenia · 845/1820 árboles
     [Continuar avance]

[🌳] Cosecha
     Lote Calarcá · 0/2000 árboles
     [Empezar]

[🐝] Visita al apiario
     Apiario El Cedro · 12 colmenas
     [Empezar]

──────────────────────
[+] Reportar novedad
```

*Los íconos van con lucide-react, no emoji. Aquí solo para ilustrar.*

### 5.6 Trabajador — Avance TRAMO/SUELTOS (cultivo)

Pantalla con tabs (segmented control) **TRAMO** / **SUELTOS**:

**TRAMO:**
```
Desde árbol  [______]
Hasta árbol  [______]
Notas        [______________]
[ Registrar tramo ]
```

Validación cliente y servidor:
- desde, hasta requeridos, ambos enteros >= 1 y <= total_arboles del lote.
- desde <= hasta.
- cantidad_arboles = hasta - desde + 1.

**SUELTOS:**
```
Números (separados por coma o espacio)
[ 12, 45, 67, 89 ]
Notas        [______________]
[ Registrar sueltos ]
```

Validación:
- Parsea: split por coma/espacio, filtra vacíos, valida cada uno como int >= 1 y <= total_arboles.
- Devuelve `arboles_lista: number[]`.
- cantidad_arboles = `arboles_lista.length`.

**Lógica del Server Action** (`registrarAvance`):
1. Verificar que la asignación es del usuario actual y está PENDIENTE o EN_CURSO.
2. Verificar que `asignacion.lote_id IS NOT NULL` (es de cultivo).
3. Crear `registros_avance` con tipo + datos.
4. Actualizar `asignaciones.arboles_completados += cantidad_arboles`.
5. Para TRAMO: `ultimo_arbol_trabajado = max(ultimo_arbol_trabajado, hasta)`.
6. Si era PENDIENTE → cambia a EN_CURSO.
7. Si `arboles_completados >= lote.total_arboles` → estado = COMPLETADA, fecha_completada = NOW().
8. `revalidatePath` + `redirect` a `/trabajador`.

### 5.7 Trabajador — VISITA (apicultura)

```
← Visita al apiario
   Apiario El Cedro · 12 colmenas

Observaciones (qué se hizo, hallazgos, kg de miel cosechada, etc.)
[ Texto multilínea... ]

(opcional) [ Subir foto ]

[ Marcar como completada ]
```

Server Action: similar a TRAMO/SUELTOS pero más simple — crea `registros_avance` con tipo VISITA, observaciones, foto_path (si hay). Marca asignación como COMPLETADA inmediatamente.

### 5.8 Novedades — Reportar

```
← Reportar novedad

Lote          [v Selector de lotes activos]
Árbol (núm)   [ input numérico autocompleta 1..total_arboles del lote ]

Tipo          [v PLAGA / DAÑO FÍSICO / ENFERMEDAD / OBSERVACIÓN / OTRO]
Descripción   [ Texto multilínea... ]

(opcional)    [ Subir foto ]

[ Reportar ]
```

Server Action: valida lote, busca `arboles.id` por `(lote_id, numero_placa)`. Si no existe el árbol con ese número → error. Sube foto a Storage si hay. Crea novedad.

### 5.9 Novedades — Lista del jefe

Filtro default: `resuelta = false`, orden fecha DESC. Card cada novedad:
```
[🪲] PLAGA           hace 2 días
Árbol 142 · Lote Armenia
Reportada por Diego Toro
"Manchas anaranjadas en hojas..."
[miniatura si hay foto]
```

Tap → detalle con foto grande y descripción completa + botón "Marcar resuelta" + (opcional) campo "comentario al resolver".

### 5.10 Dashboard del jefe `/jefe`

```
Buenos días, Samuel

⚠ Vencidas (3)
──────────────
Plateo químico · Lote Calarcá  · vencida hace 15 días
Fertilización  · Lote Armenia  · vencida hace 8 días
Visita al apiario · El Cedro    · nunca hecho

⏰ Próximas (5)
──────────────
Poda           · Lote Filandia  · vence en 2 días
Cosecha        · Lote Salento   · vence en 5 días
...

🔍 Novedades sin resolver (4)
──────────────
PLAGA · Árbol 142 · Lote Armenia  · hace 2 días
DAÑO_FISICO · Árbol 88 · Lote Calarcá · hace 5 días
...
```

Tap en cualquier item → navega a la entidad correspondiente.

### 5.11 Detalle de lote — sección "Tareas y estado"

```
Tareas y estado
─────────────────────────
Plateo químico        Última: 14 may  · Próxima: 12 ago  · 🟢 Al día
                                                            [Asignar ahora]
Poda                  Última: 02 nov  · Próxima: hoy     · 🟡 Próxima
                                                            [Asignar ahora]
Fertilización         Última: 01 mar  · Próxima: 30 abr  · 🔴 Vencida
                                                            [Asignar ahora]
Control de plagas     Sin historial                       · 🔴 Nunca hecho
                                                            [Asignar ahora]
Riego                 ...
Cosecha               ...
```

"Asignar ahora" → atajo a `/jefe/asignaciones/nueva?lote_id=X&tipo_tarea_id=Y`.

### 5.12 Detalle de apiario — sección "Tareas y estado"

Igual pero con los 2 tipos APICULTURA.

---

## 6. Flujo de datos

### 6.1 Carga de árboles
1. Jefe edita un lote, cambia `total_arboles` de 0 a 1820.
2. Server Action `actualizarLote` detecta el delta:
   - `total_arboles` subió de N a M (M > N).
   - Genera `arboles` con `numero_placa = N+1 .. M`, `lote_id = lote.id`.
   - Usar `prisma.arboles.createMany({ data, skipDuplicates: true })`.
3. Mensaje de éxito muestra cantidad generada.

### 6.2 Asignación → Avance → Completada
1. Jefe crea asignación (Diego, lote Armenia, plateo).
2. Diego entra a `/trabajador`, ve la asignación nueva.
3. Tap → `/trabajador/avance/123` muestra form TRAMO/SUELTOS.
4. Registra "desde 1, hasta 200" → Server Action incrementa `arboles_completados` de 0 a 200, estado pasa a EN_CURSO.
5. Más tarde otra sesión: "desde 201, hasta 1820" → completado, estado COMPLETADA, fecha_completada = NOW().

### 6.3 Visita al apiario
1. Jefe crea asignación (Diego, apiario El Cedro, visita).
2. Diego entra → tap → `/trabajador/avance/124` muestra form VISITA.
3. Diego escribe observaciones, sube foto, marca completada.
4. Server Action crea registros_avance VISITA + marca asignación COMPLETADA.

### 6.4 Novedad
1. Diego trabajando en plateo encuentra un árbol con plaga.
2. Tap "Reportar novedad" en bottom nav del trabajador.
3. Selecciona lote Armenia, escribe "142", tipo PLAGA, descripción, sube foto.
4. Server Action crea novedad.
5. Aparece en `/jefe` dashboard inmediatamente (la página revalida en cada visita).

### 6.5 Resolver novedad
1. Jefe revisa dashboard, tap en novedad de Diego.
2. Lee, ve foto, decide enviar a alguien o aplicar fungicida.
3. Después de atender, vuelve a la app y marca "Resuelta".
4. `resuelta = true`, `fecha_resolucion = NOW()`. Sale del dashboard.

---

## 7. Errores y casos borde

- **Crear asignación con tipo de área distinto al destino:** validación en Server Action. Ej. lote_id + tipo de tarea APICULTURA → error "Tipo de tarea no compatible con destino".
- **Cargar árboles cuando no hay diferencial:** si `total_arboles` no cambió, no genera nada (idempotente).
- **Bajar `total_arboles`:** no borra árboles existentes; alerta visual al jefe en edición ("Hay árboles por encima del nuevo total; manejarlos manualmente si necesario.").
- **Registrar avance TRAMO con `hasta` > `total_arboles`:** error en Server Action.
- **Registrar SUELTOS con un número que no existe:** error en Server Action.
- **Registrar avance en asignación que no es suya:** error 403 (debería bloquear la página y el action por defensa).
- **Registrar avance en asignación COMPLETADA o CANCELADA:** error "Asignación cerrada".
- **Doble completar:** si dos registros llegan al mismo tiempo y ambos quieren marcar COMPLETADA, el segundo recibe error (constraint o check en code). Aceptable.
- **Novedad sin árbol cargado (lote con total_arboles = 0):** la UI no permite reportar — selector de árbol está deshabilitado o muestra "Sin árboles cargados en este lote".
- **Asignar a persona sin vinculación activa:** la query de personas en el select solo trae las activas con vinculación; igual el Server Action revalida.
- **Cambiar `area` de tipo de tarea con asignaciones históricas:** **bloqueado**, error explícito "No se puede cambiar el área de un tipo que ya tiene historia".
- **Foto que no sube por error de red:** Server Action permite continuar guardando la novedad sin foto y muestra "Foto no se pudo subir; novedad guardada sin foto." En vez de bloquear todo.

---

## 8. Testing

Sin framework de tests. Validación manual + build/lint.

### Smoke test integral
1. **Carga árboles**: editar lote Armenia, poner `total_arboles = 100`, guardar. Verificar BD: 100 filas `arboles`. Subir a 150, verificar 150 filas (50 nuevas).
2. **Catálogo de tipos**: editar "Plateo químico", cambiar frecuencia default a 100, guardar. Crear nuevo tipo "Recolección extra" área CULTIVO. Desactivarlo. Confirmar que no aparece en selector de "Crear asignación".
3. **Frecuencias por lote**: en lote Armenia, override "Plateo químico" de 100 → 60 días. Guardar. Confirmar que el detalle de lote muestra 60 en la fila de plateo.
4. **Asignar cultivo**: crear asignación (Diego, Armenia, plateo). Verificar que aparece en `/trabajador` cuando se loguea Diego.
5. **TRAMO**: Diego registra 1-50. Confirmar `arboles_completados = 50`, estado = EN_CURSO. Segundo registro 51-100, estado se mantiene EN_CURSO. Al llegar a 100 (== total), estado pasa a COMPLETADA con fecha_completada.
6. **SUELTOS**: nueva asignación, registrar "5, 10, 15" → arboles_completados = 3.
7. **Reabrir**: jefe reabre la asignación COMPLETADA del paso 5, verificar estado vuelve a EN_CURSO.
8. **Apicultura**: crear asignación (Diego, apiario El Cedro, visita). Diego registra VISITA con observaciones + foto. Asignación queda COMPLETADA.
9. **Novedad**: Diego reporta novedad PLAGA en árbol 7 de lote Armenia, con foto. Verificar que aparece en `/jefe` dashboard. Jefe la marca resuelta, desaparece del dashboard.
10. **Próximas fechas**: en detalle de lote Armenia, ver "Plateo químico · Última: 14 may · Próxima: 13 jul · Al día". Avanzar el reloj mental 60 días → debería estar próxima. 90 días → vencida.
11. **Build + lint** limpios.

---

## 9. Plan de migración / despliegue

### Pre-migración
- Verificar que no haya asignaciones existentes (debería ser 0 porque nadie ha creado asignaciones aún).
- Si las hay, todas con `lote_id` NOT NULL, así que pasan la nueva CHECK constraint sin cambios.

### Pasos
1. Ejecutar `supabase/migracion-fase3-apicultura.sql` en Supabase SQL editor.
2. `npx prisma db pull` para sincronizar `schema.prisma`.
3. Verificar que Prisma reconoce el nuevo enum value y la columna nullable.
4. Implementar el resto del plan en commits sucesivos.
5. Push a `main` al final del plan.

### Rollback
Si algo sale mal:
```sql
ALTER TABLE asignaciones DROP CONSTRAINT chk_asign_lote_xor_apiario;
ALTER TABLE asignaciones DROP COLUMN apiario_id;
ALTER TABLE asignaciones ALTER COLUMN lote_id SET NOT NULL;
-- No se puede DROP VALUE en enum sin recrearlo; ignorar el VISITA (no se usa hasta que llega el código).
```

### Sin downtime
Pre-migración no hay datos. Post-migración el código aún no usa los cambios. Cuando se hace push, todo coordina.

---

## 10. Decisiones pendientes (para `docs/decisiones-pendientes.md`)

- D-015: ¿Frecuencias por apiario (override del default)? Por ahora no — apiarios usan solo default global. Revisar si después se siente que hace falta.
- D-016: ¿Auto-crear la siguiente asignación al completar una? Por ahora NO. Si en uso el jefe siente la necesidad, agregamos un flag al tipo `auto_renovar`.
- D-017: ¿Registro detallado de cosecha de miel (kg, calidad, colmena específica)? Hoy en `observaciones` de VISITA. Si después se necesita estructura, tabla nueva `cosechas_miel`.
- D-018: ¿Multi-selección de trabajadores en crear-asignación? Si en uso real duele crear N asignaciones, sumarlo.
- D-019: ¿Ficha de árbol detallada (Pokédex completo)? La vista actual del árbol son sus novedades en `/jefe/novedades`. Pokédex separado se evalúa después.

---

## 11. Próximos pasos después de Fase 3

- **Fase 4** — Bodega y almacén (despachos, devoluciones, cosecha de aguacate, salidas).
- **Sub-fase Capa financiera** — pagos, tarifas, jornales, ausencias, servicios contratados (ver `2026-05-11-capa-financiera-DRAFT.md`).
- **Fase 5** — PWA offline, push notifications, captura de polígonos de lotes y coordenadas de apiarios.
