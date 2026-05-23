# Reporte global de la finca

**Fecha:** 2026-05-22
**Autor:** Samuel Alzate (con Claude)
**Estado:** Diseño aprobado, pendiente plan de implementación.

## Contexto y motivación

El jefe puede ver hoy:

- **Reporte por lote** (`/jefe/lotes/[id]/reporte`): cosecha acumulada del lote, 12 meses con barras, top 5 recolectores del lote, insumos consumidos del lote.
- **Almacén** (`/jefe/almacen-vista`): stock actual + últimas 30 cosechas + últimas 30 salidas.

No hay vista que consolide datos a nivel finca: cuánto se cosechó en total, qué lotes rinden más, quiénes son los recolectores top de toda la operación, qué insumos se gastan más, ni cómo se reparten las salidas (venta vs consumo vs pérdida).

El objetivo de este paquete es agregar **una sola vista `/jefe/reportes`** que responda esas preguntas con datos que ya están en BD.

## Alcance

### Dentro

- Nueva ruta `/jefe/reportes` (server component, dynamic) con 7 secciones de reporte de solo lectura.
- Tarjeta "Reportes" en el dashboard del jefe (`/jefe`, sección Configuración) que linkea a la nueva ruta.
- Patrón visual consistente con `/jefe/lotes/[id]/reporte`: tiles, barras `<div>` con `width: %`, sin librerías de gráficos.

### Fuera (explícito)

- Selector de período personalizado. Las secciones con tiempo muestran "últimos 12 meses" fijo; los acumulados son lifetime.
- Exportar a CSV / PDF.
- Librerías de gráficos (recharts, chart.js, etc).
- Comparativa interanual (año vs año).
- Productividad por trabajador en el sentido "árboles atendidos vía `registros_avance`". Eso es vista por persona, paquete futuro.
- Filtros por estado o por trabajador.
- Refresco automático / polling. La página se recarga manualmente.

## Decisiones de diseño

### Patrón visual

Sigue el lenguaje de `/jefe/lotes/[id]/reporte`:

- Tiles grandes con cifras (`font-serif text-4xl text-zelanda-verde-900`).
- Listas con `<ul>` + `<li>` grid de dos columnas.
- Barras de progreso CSS puras: `<div class="h-2 rounded-full bg-zelanda-beige-200">` + `<div class="h-full bg-zelanda-verde-700" style="width: X%">`.
- Iconos de Lucide en el header de cada sección.
- Mensaje "Sin datos" cuando una sección está vacía.

### Estructura de archivos

Un solo archivo `page.tsx`, server component, queries en `Promise.all`. Mantiene el patrón del reporte por lote (262 líneas hoy). Si crece mucho, splitteamos secciones a componentes en una iteración futura — pero no se splittea preventivamente.

### Aguacate y miel se separan

`cosechas` (aguacate) y `cosechas_miel` (apiarios) son tablas distintas con unidades comparables (kg) pero realidades distintas. Sumarlas en un mismo total sería engañoso. El reporte tiene secciones independientes: las cifras de cosecha aguacate no incluyen miel, y la sección de miel sólo se renderiza si hay datos.

### Las salidas se cuentan de `salidas_cosecha`

`salidas_cosecha` es solo aguacate (no hay tabla equivalente para miel). El desglose por tipo (VENTA / CONSUMO / PERDIDA / OTRO) se calcula con `SUM(cantidad_kg) GROUP BY tipo` filtrando últimos 12 meses.

### Stock del almacén

Se toma de la vista existente `v_stock_almacen` (ya usada en `/jefe/almacen-vista`). Es una sola fila escalar.

## Secciones del reporte

### 1. Resumen acumulado (4 tiles)

| Tile | Query / fuente | Display |
|---|---|---|
| Cosecha total finca | `SUM(cosechas.peso_kg)` lifetime | `XXX,XXX.XX kg` |
| # cosechas | `COUNT(*) FROM cosechas` | `XXX cosechas` |
| Salidas totales | `SUM(salidas_cosecha.cantidad_kg)` lifetime | `XXX,XXX.XX kg` |
| Stock actual | `v_stock_almacen.stock_kg` | `XXX,XXX.XX kg` |

Grid `sm:grid-cols-2 lg:grid-cols-4`.

### 2. Cosecha últimos 12 meses

Barras por mes (igual al patrón del lote, pero sumando todos los lotes).

```sql
SELECT TO_CHAR(fecha, 'YYYY-MM') AS ym,
       SUM(peso_kg)::text AS total_kg,
       COUNT(*)::int AS n_cosechas
FROM cosechas
WHERE fecha >= NOW() - INTERVAL '12 months'
GROUP BY ym
ORDER BY ym DESC
```

Vacío → "Sin cosechas en los últimos 12 meses."

### 3. Ranking de lotes

Los 15 lotes ordenados por `kg_total` descendente. Una fila por lote, con cuatro columnas visuales: nombre, kg total, kg/árbol (cuando `total_arboles > 0`), kg/ha (cuando `hectareas > 0`). Barra proporcional al mayor kg_total del set.

```sql
SELECT l.id, l.nombre, l.total_arboles, l.hectareas::text AS hectareas,
       COALESCE(SUM(c.peso_kg), 0)::text AS kg_total
FROM lotes l
LEFT JOIN cosechas c ON c.lote_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.nombre, l.total_arboles, l.hectareas
ORDER BY SUM(c.peso_kg) DESC NULLS LAST, l.nombre ASC
```

`kg/árbol` se calcula en JS: `kg_total / total_arboles` con 2 decimales (`—` si `total_arboles === 0`). `kg/ha` igual con `hectareas` (Decimal en BD → Number en JS; `—` si `hectareas` es null o 0).

Vacío → no aplica porque siempre hay 15 lotes; los que tienen 0 kg muestran "—" en las métricas derivadas.

### 4. Top 10 recolectores de la finca

```sql
SELECT c.persona_id, p.nombre_completo,
       SUM(c.peso_kg)::text AS total_kg,
       COUNT(c.id)::int AS n_cosechas
FROM cosechas c
JOIN personas p ON p.id = c.persona_id
GROUP BY c.persona_id, p.nombre_completo
ORDER BY SUM(c.peso_kg) DESC
LIMIT 10
```

Por fila: nombre + `total_kg` + `n_cosechas`.

Vacío → "Sin recolectores registrados."

### 5. Insumos consumidos (finca completa)

```sql
SELECT i.id AS insumo_id, i.nombre, i.unidad,
       SUM(di.cantidad_consumida)::text AS total
FROM despacho_items di
JOIN insumos i ON i.id = di.insumo_id
WHERE di.tipo_item = 'INSUMO'
  AND di.cantidad_consumida IS NOT NULL
  AND di.cantidad_consumida > 0
GROUP BY i.id, i.nombre, i.unidad
ORDER BY SUM(di.cantidad_consumida) DESC
```

Por fila: nombre + cantidad + unidad.

Vacío → "Sin insumos consumidos."

### 6. Miel (apicultura) — condicional

Sólo se renderiza si `cosechas_miel` tiene al menos una fila.

Sub-secciones:
- Total kg miel acumulado: `SUM(cosechas_miel.kg)`.
- Ranking apiarios: por `apiario.nombre`, ordenado por kg desc.
- Top 5 recolectores de miel: similar a top recolectores de aguacate pero sobre `cosechas_miel`.

```sql
-- Ranking apiarios
SELECT a.nombre, SUM(cm.kg)::text AS total_kg
FROM cosechas_miel cm
JOIN apiarios a ON a.id = cm.apiario_id
GROUP BY a.id, a.nombre
ORDER BY SUM(cm.kg) DESC

-- Top recolectores de miel
SELECT cm.persona_id, p.nombre_completo, SUM(cm.kg)::text AS total_kg
FROM cosechas_miel cm
JOIN personas p ON p.id = cm.persona_id
GROUP BY cm.persona_id, p.nombre_completo
ORDER BY SUM(cm.kg) DESC
LIMIT 5
```

Si no hay cosechas de miel registradas, la sección entera no aparece (no muestra "Sin datos").

### 7. Salidas del almacén — desglose por tipo (últimos 12 meses)

```sql
SELECT tipo, SUM(cantidad_kg)::text AS total_kg, COUNT(*)::int AS n_salidas
FROM salidas_cosecha
WHERE fecha >= NOW() - INTERVAL '12 months'
GROUP BY tipo
ORDER BY SUM(cantidad_kg) DESC
```

Por fila: badge con tipo (VENTA / CONSUMO / PERDIDA / OTRO, mismo color que en `/jefe/almacen-vista`), kg total, % del total de los últimos 12 meses (suma de los 4 tipos del periodo), # salidas. Barra proporcional sobre el mayor `total_kg` del set.

Vacío → "Sin salidas registradas en los últimos 12 meses."

## Acceso desde el dashboard

Modificar `app/(app)/jefe/_dashboard-cliente.tsx`: en la sección "Configuración" (la que se acaba de agregar con la tarjeta "Tipos de tarea"), agregar una segunda tarjeta "Reportes" que linkea a `/jefe/reportes`.

```tsx
<Link
  href="/jefe/reportes"
  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
>
  <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
    Reportes
  </p>
  <p className="mt-1 font-serif text-base text-zelanda-verde-900">
    Cosecha, lotes, recolectores
  </p>
</Link>
```

## Manejo de errores

- Las queries usan `prisma.$queryRaw` y devuelven `Number()` o `Decimal.toString()` según corresponda. Los `BigInt` se convierten con `Number(...)` para mostrar (cifras pequeñas) o `toString()` para keys de React.
- Si una sección no tiene datos, muestra un mensaje placeholder y no rompe la página.
- Si `v_stock_almacen` no devuelve fila (caso teórico), el tile muestra `0 kg`.
- Sesión no JEFE → `await requerirUsuario("JEFE")` redirige al login (patrón existente).

## Pruebas y verificación

No hay suite de tests automatizados en el proyecto. Verificación manual:

**Checklist:**
1. Login como JEFE → dashboard `/jefe` → ver tarjeta "Reportes" en sección Configuración.
2. Click → `/jefe/reportes` carga sin errores en consola.
3. **Tile resumen:** los cuatro números coinciden con queries manuales en SQL Editor de Supabase.
4. **12 meses:** barras visibles, valores cuadran con `SELECT TO_CHAR(fecha, 'YYYY-MM'), SUM(peso_kg) FROM cosechas WHERE fecha >= NOW() - INTERVAL '12 months' GROUP BY 1`.
5. **Ranking lotes:** los 15 lotes aparecen; los que tienen cosechas están arriba, los vacíos abajo con "—" en métricas derivadas; barra proporcional correcta.
6. **Top 10 recolectores:** orden descendente correcto, nombres y kg correctos.
7. **Insumos:** lista coincide con consulta SQL; si no hay insumos consumidos, muestra placeholder.
8. **Miel:** si no hay cosechas de miel registradas, sección NO aparece; si hay, aparece con sus 3 sub-secciones.
9. **Salidas por tipo:** si hay salidas en los últimos 12 meses, los 4 tipos aparecen con kg y %; sin salidas, placeholder.
10. **Sesión no-jefe:** logueado como TRABAJADOR/BODEGA/ALMACEN, intentar `/jefe/reportes` → redirige al dashboard de su rol (comportamiento de `requerirUsuario`).
11. **Build:** `npm run build` compila sin errores TS.

## Notas operacionales

- No requiere migración SQL.
- No requiere cambios en `schema.prisma`.
- Despliegue: PR/merge a `main` + auto-deploy en Vercel (flujo individual, sin colaboradores).
- Performance esperada: las queries se ejecutan en paralelo (`Promise.all`), todas con índices existentes (`idx_cosechas_fecha`, `idx_cosechas_lote`, `idx_salidas_fecha`). Tiempo estimado < 500ms con los volúmenes actuales.
