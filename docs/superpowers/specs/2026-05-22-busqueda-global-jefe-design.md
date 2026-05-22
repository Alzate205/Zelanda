# Búsqueda global para el jefe

**Fecha:** 2026-05-22
**Autor:** Samuel Alzate (con Claude)
**Estado:** Diseño aprobado, pendiente plan de implementación.

## Contexto y motivación

Hoy el jefe puede llegar a un árbol específico solo navegando lote → buscar número, a una persona solo entrando a `/jefe/equipo` y scrolleando, a una herramienta/insumo entrando a inventario. No hay atajo. El `HeaderApp` global tiene avatar + logout, nada más.

El objetivo es agregar un buscador global accesible siempre desde el header, **solo para el rol JEFE** (los otros roles tienen vistas específicas y no necesitan esto). Permite encontrar rápido árbol, lote, persona, herramienta o insumo desde cualquier pantalla.

## Alcance

### Dentro

- Botón lupa en `HeaderApp`, visible solo para JEFE.
- Modal client component con input + resultados agrupados por categoría.
- Endpoint API `GET /api/jefe/buscar?q=...` con queries paralelas.
- Búsqueda en 5 categorías: árbol (parseo de sintaxis), lotes, personas, herramientas, insumos.
- Parsing de sintaxis `"Lote N"` o `"N Lote"` para resultado directo de árbol.

### Fuera (explícito)

- Atajo de teclado (Ctrl+K / Cmd+K). Es mobile-first.
- Búsqueda fuzzy / tolerancia a typos. YAGNI.
- Historial de búsquedas recientes. YAGNI.
- Búsqueda en novedades, asignaciones, despachos. Se agregan después si surge necesidad.
- Highlighting del término en los resultados. YAGNI.
- Migración SQL ni nuevos índices. Los volúmenes (15 lotes, decenas de personas/items) lo permiten con `ILIKE`.
- Buscar para roles BODEGA, ALMACEN, TRABAJADOR. Tienen vistas específicas suficientes.

## Decisiones de diseño

### Ubicación del botón en el header

`HeaderApp` es un server component compartido por los 4 roles. El botón lupa se renderiza condicional a `usuario.rol === "JEFE"`. Se ubica entre el avatar/nombre (que es `flex-1`) y el botón de logout, antes del logout.

El botón abre el modal. Para mantener la separación cliente/servidor, el componente nuevo `BuscadorGlobal` es un client component que internamente gestiona su estado `abierto/cerrado`. El botón disparador vive dentro de `BuscadorGlobal`, no en `HeaderApp` directamente — `HeaderApp` simplemente renderiza `<BuscadorGlobal />` (sin props) cuando el rol es JEFE.

### Modal

- Fullscreen en mobile (`fixed inset-0`), centrado con `max-w-2xl` en `sm:`.
- Backdrop semi-transparente, click cierra.
- Tecla `Escape` cierra.
- `autoFocus` en el input al abrir.
- Input grande con debounce 200ms antes de fetch.
- Estado de carga muestra "Buscando..."; sin resultados muestra "Sin coincidencias."; query vacío muestra hint "Escribí un nombre, cédula o número."

### Parsing de sintaxis para árbol

Si el query trimmed matchea uno de:
- `^(\d+)\s+(.+)$` → grupo 1 = número, grupo 2 = nombre lote (ej. "1234 Salento")
- `^(.+?)\s+(\d+)$` → grupo 1 = nombre lote, grupo 2 = número (ej. "Salento 1234")

Para cada match, buscar lote por `nombre ILIKE` (case-insensitive, exacto sin %). Si encuentra **un** lote y `1 <= numero <= total_arboles`, devolver resultado especial.

Si ambas regex matchean (ej. "100 200" sería ambiguo), se prueba la primera y si no encuentra lote, se prueba la segunda. Si ninguna devuelve match, no se incluye resultado de árbol.

El número en la URL final es solo `numero_placa` (no necesitamos el `arbol.id`, la ruta es `/jefe/lotes/<lote_id>/arbol/<numero>`).

### Categorías y queries

| Categoría | Query | Limit | Donde se filtra |
|---|---|---|---|
| Árbol específico | parsing arriba | 0 o 1 | match exacto de nombre de lote |
| Lotes | `nombre ILIKE %q%` | 5 | `deleted_at IS NULL` |
| Personas | `nombre_completo ILIKE %q%` OR `cedula ILIKE %q%` | 5 | `deleted_at IS NULL` |
| Herramientas | `nombre ILIKE %q%` | 5 | `activo = true` |
| Insumos | `nombre ILIKE %q%` | 5 | `activo = true` |

Orden dentro de cada categoría: alfabético por nombre.

Si `q.length < 2` el endpoint devuelve `{ vacio: true }` sin consultar nada. Esto evita queries con `%a%` que tocarían demasiados rows.

### Endpoint

`GET /api/jefe/buscar?q=<string>` (API route, no server action — server actions están atadas a forms; este es un fetch puro con debounce desde el cliente).

Respuesta:
```ts
type Resultado = {
  vacio?: boolean;
  arbol: { lote_id: string; lote_nombre: string; numero: number } | null;
  lotes: { id: string; nombre: string }[];
  personas: { id: string; nombre_completo: string; cedula: string | null }[];
  herramientas: { id: string; nombre: string; categoria: string }[];
  insumos: { id: string; nombre: string; categoria: string; unidad: string }[];
};
```

Sesión:
- `await requerirUsuario("JEFE")` al inicio. Si falla redirige al login (consistente con páginas), pero como es API route mejor devolver 403 explícito si el rol no es JEFE.

### Rendering

Bloque de resultados ordenado:
1. Si `arbol` existe → tile destacado arriba con ícono `Sprout`, texto "Árbol #N en `<lote>`", link a `/jefe/lotes/<lote_id>/arbol/<numero>`.
2. Cada categoría con resultados se renderiza como sección con header (ícono Lucide + nombre categoría) y lista de filas.
3. Cada fila es un `<Link>` que cierra el modal antes de navegar.

| Categoría | Ícono | Destino |
|---|---|---|
| Árbol | `Sprout` | `/jefe/lotes/<id>/arbol/<n>` |
| Lote | `Map` | `/jefe/lotes/<id>` |
| Persona | `User` | `/jefe/equipo/<id>` |
| Herramienta | `Wrench` | `/bodega/inventario/herramientas/<id>/editar` |
| Insumo | `FlaskConical` | `/bodega/inventario/insumos/<id>/historial` |

Si una categoría no tiene resultados, no se renderiza su header. Si **ninguna** categoría tiene resultados (y no hay árbol), muestra "Sin coincidencias."

### Performance

Volúmenes actuales:
- 15 lotes (siempre)
- ~30-50 personas esperables
- Decenas de herramientas e insumos
- ~30k árboles pero NO se consultan directamente; el árbol sale del parsing + lote (1 query)

`ILIKE %q%` sin índice trigram es aceptable a estos volúmenes. No agregamos índices.

Cliente: debounce 200ms en cada keystroke para evitar saturar. Cancelación de fetch en flight si llega nuevo keystroke (`AbortController`).

## Componentes y archivos

```
components/shared/
├── HeaderApp.tsx                       [MODIFICAR]
│   └── Render <BuscadorGlobal /> si rol === "JEFE"
└── BuscadorGlobal.tsx                  [NUEVO — client]
    ├── Botón lupa que abre modal
    ├── Modal con input + lista de resultados
    ├── Debounce + AbortController
    └── Cierra con ESC, X, backdrop, o click en resultado

app/api/jefe/buscar/
└── route.ts                            [NUEVO — GET handler]
    ├── Valida sesión JEFE → 403 si no
    ├── Parsea q
    ├── Ejecuta parseo árbol + queries en Promise.all
    └── Devuelve JSON
```

## Flujos paso a paso

### Flujo 1: Buscar persona por nombre

1. Jefe entra a cualquier pantalla → tap lupa en header.
2. Modal abre con input enfocado.
3. Tipea "Diego" → 200ms después, fetch `/api/jefe/buscar?q=Diego`.
4. Recibe `{ personas: [{ id, nombre_completo: "Diego Toro", ... }], ... }`.
5. Modal muestra sección "Personas" con la fila.
6. Tap fila → modal cierra, navega a `/jefe/equipo/<id>`.

### Flujo 2: Buscar árbol "Salento 100"

1. Tap lupa → tipea "Salento 100".
2. Parsing: regex 2 matchea → nombre = "Salento", número = 100.
3. Backend: `lotes.findFirst({ where: { nombre: { equals: "Salento", mode: "insensitive" } } })` → encuentra lote Salento (id=X, total_arboles=2150).
4. 100 está entre 1 y 2150 → devuelve `arbol: { lote_id: X, lote_nombre: "Salento", numero: 100 }`.
5. Modal renderiza tile arriba: "Árbol #100 en Salento".
6. También muestra "Salento" en sección Lotes (porque el ILIKE matchea).
7. Tap el árbol → navega a `/jefe/lotes/<X>/arbol/100`.

### Flujo 3: Buscar por cédula

1. Tap lupa → tipea "1090".
2. Parsing: regex 1 matchea solo si después del número hay texto. "1090" solo no parsea como árbol → `arbol: null`.
3. Backend: ILIKE busca personas con `cedula ILIKE %1090%` o `nombre_completo ILIKE %1090%`.
4. Devuelve coincidencias en `personas`.
5. Si no hay matches, muestra "Sin coincidencias."

### Flujo 4: Query vacío o muy corto

1. Modal abre → input vacío → no fetch.
2. Tipea 1 carácter → no fetch (q.length < 2).
3. Tipea 2do carácter → fetch.

### Flujo 5: Acceso desde rol no-JEFE

1. Usuario BODEGA loguea, ve header sin lupa (no se renderiza).
2. Si manipula URL y hace `GET /api/jefe/buscar?q=x` → backend devuelve 403.

## Manejo de errores

- **Sesión no-JEFE en el endpoint:** 403 con `{ error: "Solo el rol JEFE puede usar la búsqueda global." }`.
- **q.length < 2:** 200 con `{ vacio: true }`. Frontend lo trata como "estado inicial", no como error.
- **Error de DB en el endpoint:** 500 con `{ error: string }`. Frontend muestra "No se pudo buscar, intenta de nuevo."
- **Fetch cancelado (AbortError):** no muestra nada, no es error real.
- **Parsing de sintaxis árbol que matchea pero lote no existe:** `arbol: null`. El usuario igual ve resultados de lotes/personas/etc si los hay.
- **Número fuera de rango `1..total_arboles`:** `arbol: null`.

## Pruebas y verificación

Proyecto sin tests automatizados. Verificación manual:

**Checklist:**
1. Login como JEFE → header muestra ícono lupa.
2. Logout, login como BODEGA → header **no** muestra lupa.
3. Logout, login como TRABAJADOR → header **no** muestra lupa.
4. Login JEFE → tap lupa → modal abre con input enfocado.
5. ESC → modal cierra.
6. Tap fuera (backdrop) → modal cierra.
7. Tap X → modal cierra.
8. Input vacío → muestra hint.
9. Tipear "a" → no fetch, sigue mostrando hint.
10. Tipear "al" → fetch ocurre (verificar en Network tab del browser).
11. Buscar nombre de persona existente → aparece en sección Personas → click → navega y modal se cierra.
12. Buscar nombre de lote (ej. "Sale") → aparece "Salento" en Lotes.
13. Buscar "Salento 1" → aparece resultado de árbol + "Salento" en lotes.
14. Buscar "1 Salento" → mismo resultado de árbol.
15. Buscar "Salento 99999" (número fuera de rango) → no aparece árbol, solo lote.
16. Buscar herramienta por nombre existente → aparece + click → va a `/bodega/inventario/herramientas/<id>/editar`.
17. Buscar insumo → mismo.
18. Buscar cédula → aparece persona.
19. Texto sin matches → "Sin coincidencias."
20. Manipular URL: como BODEGA hacer fetch a `/api/jefe/buscar?q=test` → 403.
21. Build: `npm run build` pasa sin errores TS.

## Notas operacionales

- Sin migración SQL.
- Sin cambios en `prisma/schema.prisma`.
- Despliegue: PR/merge a `main` + auto-deploy en Vercel.
- Si más adelante los volúmenes crecen (cientos de personas, miles de herramientas) y `ILIKE` se vuelve lento, evaluar trigram index (`CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (nombre gin_trgm_ops)`). Por ahora YAGNI.
