# Registro de aplicaciones de insumos por lote (trazabilidad)

**Fecha:** 2026-06-12
**Estado:** Aprobado por Samuel (brainstorming)
**Decisiones del usuario:** la base para certificación (ICA/GlobalGAP) es obligatoria · registra bodega al cerrar el despacho · casi siempre un lote por despacho · v1 incluye export CSV y costo por lote · ficha técnica del químico y alerta de carencia quedan para v2.

---

## 1. Problema

Hoy bodega registra que se despachó un insumo y cuánto se consumió (`despacho_items.cantidad_consumida`), y el trabajador registra que trabajó un lote, pero **nada conecta qué producto se aplicó en qué lote**. Para una finca de aguacate Hass que apunte a certificación o exportación, el registro de aplicaciones por lote es obligatorio. La cadena ya existe a medias: `despachos.asignacion_id` (opcional) → `asignaciones.lote_id`.

## 2. Enfoque elegido (A: columna + registro derivado)

Como casi siempre un despacho termina aplicado en un solo lote, basta persistir el lote en el despacho al cerrarlo. El "registro de aplicaciones" no es una tabla nueva: es una consulta derivada de despachos cerrados × items insumo consumidos. Cero duplicación de datos; el flujo offline casi no cambia.

Se descartó una tabla `aplicaciones` dedicada (más migración, riesgo de desincronización con bodega) y la opción sin migración (la vinculación a asignación es opcional, dejaría huecos inaceptables para certificación).

## 3. Migración — `supabase/migracion-aplicaciones.sql`

- `ALTER TABLE despachos ADD COLUMN lote_id BIGINT REFERENCES lotes(id);` (nullable: despachos de apiario/bodega/general no tienen lote).
- `ALTER TABLE despacho_items ADD COLUMN costo_unitario_snapshot NUMERIC(12,2);` — se llena al cerrar el despacho con el `insumos.costo_unitario` del momento, para que el costo histórico por lote no se distorsione cuando cambie el precio.
- `CREATE INDEX idx_despachos_lote ON despachos(lote_id);`
- **Backfill:** los despachos históricos con `asignacion_id` heredan el `lote_id` de su asignación (`UPDATE ... FROM asignaciones`). Recupera trazabilidad pasada sin trabajo manual.
- RLS: sin cambios (las políticas existentes de `despachos`/`despacho_items` cubren las columnas nuevas).
- Actualizar `prisma/schema.prisma` (espejo de las columnas) y regenerar el cliente.

## 4. Cierre de despacho (bodega) — donde nace el dato

En la pantalla de cerrar despacho (`/bodega/despachos/[id]`):

- Si el despacho tiene **items de insumo**, aparece el campo "¿En qué lote se aplicó?" (la cantidad consumida se define en esa misma pantalla, así que la visibilidad no depende del valor).
- Preseleccionado con el lote de la asignación vinculada (si la hay). Editable.
- Opción explícita **"Sin lote (bodega / apiario / general)"** para no bloquear casos legítimos; se guarda `lote_id = NULL`.
- Despachos solo de herramientas: el campo no aparece, nada cambia.
- El server action de cierre guarda `despachos.lote_id` y, por cada item insumo, `costo_unitario_snapshot` desde el catálogo.
- **Offline:** el payload de "cerrar despacho" en la cola (`lib/offline`) suma `lote_id`; al sincronizar se aplica igual que online. El tipo del item de cola y `sync.ts` se extienden.

## 5. Registro de aplicaciones — `/jefe/aplicaciones`

La vista auditable:

- Lista derivada: despachos `CERRADO` con items insumo `cantidad_consumida > 0`, uniendo insumo (nombre, unidad), lote, persona y tarea (vía `asignacion_id → tipos_tarea`).
- **Fecha de aplicación = `despachos.fecha`** (el día del trabajo), no la fecha de cierre: si bodega cierra al día siguiente, el registro queda en el día correcto.
- Columnas: fecha · producto · cantidad + unidad · lote · quién aplicó · tarea · costo (cantidad × snapshot, fallback a `costo_unitario` actual si el snapshot es NULL — cierres anteriores a la migración).
- Navegación mes a mes (mismo patrón de `/jefe/pagos` y `/jefe/ventas`) y filtro por lote.
- **Exportar CSV** del período visible (mismo patrón de los CSV de `/jefe/reportes`).
- Atajo en el dashboard del jefe (PanelCentral / atajos existentes).
- Solo rol JEFE.

## 6. Costo de insumos por lote — reportes avanzados

Sección nueva en `/jefe/reportes/avanzados`: ranking de lotes por costo de insumos del mes seleccionado (suma de cantidad × costo snapshot/fallback), con total como pie. Reusa el selector de mes existente de la página.

## 7. Lógica pura testeada

`lib/aplicaciones.ts` (pura, vitest):

- `costoAplicacion(cantidad, snapshot, costoActual)` — regla de fallback.
- `agruparCostoPorLote(filas)` — agregación para la sección de reportes.
- `filasCsvAplicaciones(filas)` — armado del CSV (escape de comas/comillas).

Las queries server-side viven en `lib/jefe/aplicaciones.ts` (patrón `lib/jefe/*` existente).

## 8. Casos borde y errores

| Caso                                             | Comportamiento                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Despacho sin asignación vinculada                | Selector de lote manual, sin preselección                                               |
| Despacho solo de herramientas                    | No se pide lote                                                                         |
| Insumo consumido para bodega/apiario/uso general | "Sin lote" → no aparece en el registro por lote (sí en movimientos de insumo, como hoy) |
| Cierres anteriores a la migración                | Sin snapshot → costo actual como fallback; lote solo si tenían asignación (backfill)    |
| Cierre offline                                   | `lote_id` viaja en la cola y se aplica al sincronizar                                   |
| Cambio de precio del insumo                      | No afecta registros viejos (snapshot)                                                   |

## 9. Qué NO incluye esta v1 (anotado para v2)

- Ficha técnica del químico en `insumos` (ingrediente activo, registro ICA, periodo de carencia/reingreso) — columnas futuras sin tocar este diseño.
- Alerta de carencia al registrar cosecha.
- Reparto de un despacho entre varios lotes (decisión: un lote por despacho refleja la operación real).
