# Trazabilidad v2: ficha técnica del químico + alerta de carencia

**Fecha:** 2026-06-12
**Estado:** Aprobado por Samuel (brainstorming)
**Decisiones del usuario:** la alerta de carencia **avisa pero permite** registrar la cosecha (la realidad manda; offline no se puede bloquear) · visibilidad: aviso en el formulario de cosecha del almacén + advertencia al asignar tarea de cosecha + panel del lote en el mapa · el periodo de reingreso **solo se guarda y muestra** (sin alertas: la ventana es corta y llegaría vencida).

Continúa el spec `2026-06-12-aplicaciones-insumos-lote-design.md` (v1: registro de aplicaciones).

---

## 1. Problema

El registro de aplicaciones (v1) dice qué se aplicó en qué lote, pero la app no sabe nada del producto: ni su ingrediente activo ni su **periodo de carencia** (días que deben pasar entre la aplicación y la cosecha). Cosechar un lote en carencia produce fruta no apta — el error más caro de prevenir en una finca que apunta a certificación.

## 2. Enfoque elegido (A: una sola fuente de carencias)

Una función servidor `carenciasActivas()` calcula desde los datos existentes (despachos cerrados con lote × insumos consumidos con carencia configurada) qué lotes están en carencia y hasta cuándo. Esa única fuente alimenta los tres puntos de contacto. Sin tablas nuevas ni estado materializado.

Se descartaron: calcular en cada punto por separado (duplicación que se desincroniza) y una columna `en_carencia_hasta` en lotes mantenida por trigger (estado que invalidar cuando cambia la ficha o se anula un despacho).

## 3. Migración — `supabase/migracion-ficha-tecnica.sql`

```sql
ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS ingrediente_activo TEXT NULL,
  ADD COLUMN IF NOT EXISTS registro_ica TEXT NULL,
  ADD COLUMN IF NOT EXISTS periodo_carencia_dias INTEGER NULL,
  ADD COLUMN IF NOT EXISTS periodo_reingreso_horas INTEGER NULL;
```

- Todas opcionales, sin backfill: se llenan a mano por producto cuando se conozca la etiqueta.
- Espejo en `prisma/schema.prisma` (`model insumos`).
- Envuelta en `BEGIN`/`COMMIT` como las demás.

## 4. Ficha técnica en bodega

- **Formulario de insumos** (`app/(app)/bodega/inventario/insumos/_formulario.tsx`, compartido por nuevo/editar): sección nueva "Ficha técnica (químicos)" con los 4 campos, todos opcionales, debajo de los campos de stock. Carencia y reingreso como números enteros (días / horas).
- **Detalle del insumo** (`/bodega/inventario/insumos/[id]`): bloque "Ficha técnica" visible solo cuando algún campo tiene valor.
- Server actions de crear/editar insumo aceptan y persisten los campos nuevos.

## 5. Cálculo — `lib/carencia.ts` (pura, testeada) + `lib/jefe/carencias.ts` (server)

**Pura** (`lib/carencia.ts`, vitest):

```ts
export type AplicacionConCarencia = {
  lote_id: string;
  insumo: string;
  fecha_aplicacion: Date;
  carencia_dias: number;
};

export type CarenciaLote = { lote_id: string; insumo: string; hasta: string }; // hasta: YYYY-MM-DD (Bogotá)

/** Por lote, la carencia activa que más lejos llega (si hay varias, gana la más larga). */
export function carenciasPorLote(
  aplicaciones: AplicacionConCarencia[],
  hoy: string
): CarenciaLote[];
```

- `hasta` = día de la aplicación (Bogotá) + `carencia_dias`. Activa si `hasta >= hoy`.
- Varias aplicaciones en el mismo lote → gana la fecha `hasta` más lejana.
- Sin carencia configurada o despacho sin lote → no participa.

**Server** (`lib/jefe/carencias.ts`): `carenciasActivas()` consulta despachos `CERRADO` con `lote_id` de los últimos 90 días cuyos items insumo consumidos tengan `periodo_carencia_dias > 0`, pasa por la función pura y devuelve `CarenciaLote[]`. Cacheada con `unstable_cache` 5 min (una ventana de días tolera 5 min de retraso).

## 6. Almacén: aviso al registrar cosecha

- **Página de cosecha nueva**: el server pasa `carencias` al formulario. Al elegir un lote en carencia aparece un banner ámbar persistente: _"Este lote está en carencia hasta el 26/06 por Glifosato — la fruta podría no ser apta."_ El registro **no se bloquea**.
- **Offline**: las carencias viajan como prop server-rendered del formulario (igual que la lista de lotes); el service worker cachea la página, así que sin señal el banner funciona con los datos de la última visita. No hace falta tocar el snapshot del almacén.
- **API de cosecha** (`/api/almacen/cosecha`): al aceptar un registro (online o sincronizado) de un lote en carencia, manda push a los jefes: _"Se registró cosecha del lote Salento en carencia (Glifosato, hasta el 26/06)"_, tag `cosecha-carencia`. El registro se guarda normal; el push nunca falla el request (try/catch como el push de stock bajo).

## 7. Jefe: panel del lote + wizard de asignación

- **Snapshot del jefe**: campo opcional nuevo `carencias_por_lote?: CarenciaLote[]`.
- **PanelLote** (mapa): línea "En carencia hasta el 26/06 · Glifosato" en ámbar cuando el lote está en carencia. Funciona offline (snapshot).
- **Wizard de asignación** (`/jefe/asignaciones/nueva`): si la tarea elegida tiene nombre que contenga "cosecha" (insensible a mayúsculas — heurística: los tipos de tarea son configurables) y el lote elegido está en carencia, el paso de confirmación muestra la advertencia. No bloquea.

## 8. Casos borde

| Caso                                                | Comportamiento                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Insumo sin carencia configurada                     | Nunca genera alerta (la ficha es opcional)                                                                                                                    |
| Despacho cerrado "Sin lote"                         | No genera carencia                                                                                                                                            |
| Carencia que venció ayer                            | No aparece (comparación por día de Bogotá)                                                                                                                    |
| Dos aplicaciones solapadas en el mismo lote         | Gana la fecha `hasta` más lejana                                                                                                                              |
| Cosecha registrada offline                          | Banner desde el snapshot local; push al jefe al sincronizar                                                                                                   |
| Se edita la carencia del insumo después de aplicado | El cálculo usa el valor actual de la ficha (la etiqueta del producto no cambia retroactivamente; si se corrige un error de tipeo, corrige también el cálculo) |
| Tarea "Cosecha de miel" (apiario, sin lote)         | No aplica: la advertencia requiere lote                                                                                                                       |

## 9. Tests

- `lib/carencia.test.ts` (vitest): activa/vencida, la más larga gana, sin carencia, borde exacto (`hasta === hoy` → activa).
- Lo demás: lint + types + build + prueba manual de los tres puntos de contacto.

## 10. Qué NO incluye

- Alertas de reingreso (solo se guarda y muestra en la ficha).
- Bloqueo del registro de cosecha.
- Snapshot histórico de la carencia al momento de la aplicación (se usa la ficha actual).
- Detalle del lote (`/jefe/lotes/[id]`): el usuario eligió no incluirlo.
