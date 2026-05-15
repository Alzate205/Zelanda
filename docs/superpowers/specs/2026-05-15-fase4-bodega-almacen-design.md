# Fase 4 — Bodega y Almacén (diseño)

> Fecha: 2026-05-15
> Autor: Samuel Alzate + Claude

## 1. Objetivo

Cerrar el ciclo de inventario de la finca: que Diego (BODEGA) despache y reciba herramientas/insumos, y que Rocío (ALMACEN) registre las cosechas de aguacate y sus salidas. El jefe ve todo en modo lectura.

## 2. Contexto operativo

- Catálogo de insumos: ~5–15 productos. Domina el químico de fumigación.
- Aguacate de exportación: solo entra al almacén lo que pasa la pre-selección en campo. Sin calidades.
- Salidas pueden ser VENTA, CONSUMO familiar, PERDIDA, OTRO. Hay acopio.
- Diego registra ingresos de stock cuando llegan compras.
- Despacho puede o no estar ligado a una asignación (mixto opcional).

## 3. Alcance

Sub-proyecto único que cubre:
1. Catálogo de herramientas e insumos (CRUD desde bodega).
2. Despachos: crear (con reserva de stock) y cerrar (con consumo real + devolución).
3. Ingreso de stock (insumos).
4. Cosechas: alta por CANASTA o BÁSCULA.
5. Salidas: alta con 4 tipos.
6. Vistas del jefe (lectura): inventario, almacén, tarjetas en dashboard.

Quedan fuera: reportes avanzados (consumo por lote, productividad por persona), filtros sofisticados, edición de despachos cerrados, descuento automático de herramientas perdidas.

## 4. Cambio de esquema

Una sola migración: `supabase/migracion-fase4-bodega-almacen.sql`

```sql
BEGIN;

ALTER TABLE despachos
  ADD COLUMN IF NOT EXISTS asignacion_id BIGINT REFERENCES asignaciones(id);

CREATE INDEX IF NOT EXISTS idx_despachos_asignacion ON despachos(asignacion_id);

COMMIT;
```

Razón: permitir asociar opcional un despacho a una asignación específica para trazabilidad futura.

## 5. Estructura de carpetas

```
app/(app)/
  bodega/
    page.tsx                          ← inicio bodega
    catalogo/
      page.tsx                        ← lista herramientas + insumos
      acciones.ts                     ← CRUD ambos + ingreso stock
      herramientas/nueva/page.tsx
      herramientas/[id]/editar/page.tsx
      insumos/nuevo/page.tsx
      insumos/[id]/editar/page.tsx
    despachos/
      page.tsx                        ← lista del día
      acciones.ts                     ← crear, cerrar
      nuevo/page.tsx
      [id]/page.tsx                   ← detalle + cerrar
  almacen/
    page.tsx                          ← inicio almacén
    cosechas/
      page.tsx
      acciones.ts
      nueva/page.tsx
    salidas/
      page.tsx
      acciones.ts
      nueva/page.tsx
  jefe/
    inventario/page.tsx               ← stock insumos + herramientas
    almacen-vista/page.tsx            ← stock kg + cosechas + salidas
```

## 6. Catálogos

### Herramientas

Campos: `nombre` (único), `categoria` (CULTIVO/COSECHA/APICULTURA), `total` (int ≥ 0), `activo`.

Validaciones:
- Nombre obligatorio y único (manejar UNIQUE de BD).
- Categoría debe ser uno de los 3 valores.
- No desactivar si tiene `despacho_items` con `despacho.estado = 'ABIERTO'`.

### Insumos

Campos: `nombre` (único), `categoria`, `unidad` (texto libre: L, kg, unidades, m, etc.), `stock_minimo` (numeric ≥ 0), `costo_unitario` (numeric opcional), `activo`.

**Stock no se edita aquí.** `stock_actual` y `stock_reservado` solo cambian vía despacho o ingreso de stock.

Validaciones:
- Nombre obligatorio y único.
- Unidad obligatoria.
- `stock_minimo` ≥ 0.
- `costo_unitario` opcional pero si está, > 0.

### Pantalla `/bodega/catalogo`

Dos secciones (apiladas en móvil, lado a lado en desktop):
- Sección HERRAMIENTAS con botón "Nueva". Cada fila: nombre, categoría, total, toggle activo.
- Sección INSUMOS con botón "Nuevo". Cada fila: nombre, unidad, stock_disponible (calculado), botón "Ingresar stock", toggle activo. Si `stock_disponible ≤ stock_minimo` la fila destacada en `text-estado-vencida`.

## 7. Despachos

### Crear despacho `/bodega/despachos/nuevo`

Formulario:
1. **Persona destinataria** (select de personas activas con vinculación vigente).
2. **Asignación** (opcional, select de asignaciones PENDIENTE/EN_CURSO de esa persona). Por simplicidad inicial: select estático que carga al cargar la página todas las asignaciones activas; cliente filtra por persona elegida. Si la lista queda vacía, "Sin asignación".
3. **Items** (lista dinámica, mínimo 1):
   - Cada fila tiene tipo (HERRAMIENTA / INSUMO), selector del catálogo activo (filtrado por tipo), cantidad.
   - Botones "+ Herramienta" y "+ Insumo" agregan filas.
   - Cada fila tiene botón eliminar.
4. **Notas** (texto, opcional).
5. Botón "Despachar".

Acción `crearDespacho` (transacción Prisma):
```
1. Validar al menos 1 item.
2. Para cada item INSUMO: consultar stock_disponible. Si la cantidad solicitada > disponible → error.
3. INSERT despachos (persona_id, asignacion_id, despachado_por_usuario_id, estado='ABIERTO').
4. Para cada item:
   - INSERT despacho_items.
   - Si INSUMO: UPDATE insumos SET stock_reservado += cantidad
                INSERT movimientos_insumo (tipo='RESERVA', cantidad = -cantidad).
5. revalidatePath + redirect a /bodega/despachos.
```

Errores se muestran arriba del formulario (`EstadoEdicion`).

### Cerrar despacho `/bodega/despachos/[id]`

Pantalla muestra: persona, asignación (si la hay), fecha, items.

Para cada item:
- HERRAMIENTA: checkbox "Devuelta" (default `true`).
- INSUMO: input `cantidad_consumida` numérico, default = cantidad original, rango `[0, cantidad_original]`.

Botón "Cerrar despacho". Acción `cerrarDespacho` (transacción):
```
Para cada item:
  Si HERRAMIENTA: UPDATE despacho_items SET devuelto = checkbox.
  Si INSUMO:
    UPDATE despacho_items SET cantidad_consumida = X.
    UPDATE insumos SET stock_actual -= X, stock_reservado -= cantidad_original.
    INSERT movimientos_insumo (tipo='CONSUMO', cantidad = -X).
    IF cantidad_original > X:
      INSERT movimientos_insumo (tipo='DEVOLUCION', cantidad = +(cantidad_original - X)).
UPDATE despachos SET estado='CERRADO', fecha_devolucion=NOW().
```

No se permite cerrar dos veces (validar `estado='ABIERTO'`).

### Lista `/bodega/despachos`

Sección ABIERTOS (cardlist), sección CERRADOS HOY. Cada card: persona, hora, items count, link al detalle.

### Inicio bodega `/bodega`

Tarjetas:
- "Despachos abiertos hoy" (link a `/bodega/despachos`).
- "Stock bajo" — lista de insumos con `por_debajo_minimo = TRUE`.
- "Cerrados hoy" — número simple.

## 8. Ingreso de stock

Desde `/bodega/catalogo` cada insumo tiene botón "Ingresar". Abre `/bodega/catalogo/insumos/[id]/ingreso` con form:
- Cantidad (numeric > 0).
- Notas (texto opcional, ej: "compra a CampoFuerte 2026-05-12").

Acción `ingresarStock`:
```
UPDATE insumos SET stock_actual += cantidad.
INSERT movimientos_insumo (tipo='INGRESO', cantidad = +cantidad, usuario=actual, notas).
revalidatePath('/bodega/catalogo').
```

## 9. Almacén — cosechas

### `/almacen/cosechas/nueva`

Formulario:
- Persona recolectora (select activas).
- Lote (select 15).
- Método (radio CANASTA / BÁSCULA).
- Si CANASTA: `cantidad_canastas` int > 0 + `capacidad_canasta_kg` numeric > 0. Mostrar peso calculado debajo.
- Si BÁSCULA: `peso_kg` numeric > 0.
- Notas (opcional).

Acción `crearCosecha`:
```
Validar campos según método.
Si CANASTA: peso_kg = canastas * capacidad.
INSERT cosechas (trabajador_id=persona_id, lote_id, recibido_por_usuario_id, metodo_medicion, ...).
```

Nota: en el esquema el campo se llama `trabajador_id` pero la FK apunta a `personas` post-migración. Confirmar en `prisma/schema.prisma`.

### `/almacen/cosechas`

Lista últimas 50 cosechas, ordenadas por fecha DESC. Cada fila: fecha, recolector, lote, método, peso_kg.

## 10. Almacén — salidas

### `/almacen/salidas/nueva`

Formulario:
- Tipo (radio: VENTA / CONSUMO / PERDIDA / OTRO).
- Cantidad_kg numeric > 0.
- Si VENTA: `cliente_detalle` texto obligatorio, `precio_total` numeric opcional.
- Si otro tipo: cliente_detalle y precio ocultos (o cliente_detalle opcional).
- Notas opcional.

Acción `crearSalida`:
```
Consultar v_stock_almacen.stock_kg.
Si cantidad_kg > stock_kg → error "Stock insuficiente".
INSERT salidas_cosecha.
```

### `/almacen/salidas`

Lista últimas 50. Fila: fecha, tipo (badge color), cantidad_kg, cliente_detalle (si lo hay).

## 11. Inicio almacén `/almacen`

- Stock actual en kg (grande, desde `v_stock_almacen`).
- Cosechas del día: count + total kg.
- Salidas del día: count + total kg.
- Botones rápidos: "Registrar cosecha", "Registrar salida".

## 12. Vistas del jefe

### `/jefe/inventario`

Tabla insumos (todos los activos): nombre, categoría, unidad, stock_actual, reservado, disponible, mínimo. Filas bajo mínimo destacadas.

Tabla herramientas: nombre, categoría, total.

Sin edición.

### `/jefe/almacen-vista`

- Stock actual (kg).
- Tabla últimas 30 cosechas.
- Tabla últimas 30 salidas.
- Filtros opcionales: rango fechas, lote (cosechas), tipo (salidas).

### Dashboard del jefe `/jefe`

Agregar 3 tarjetas nuevas en sección "Operación":
- "Stock bajo" → N insumos → link `/jefe/inventario`.
- "Despachos abiertos" → N → link `/bodega/despachos` (sí, jefe ve la pantalla de bodega en modo lectura — controlar permisos para no permitir abrir/cerrar).
- "Stock almacén" → X kg → link `/jefe/almacen-vista`.

Alternativa más limpia: el jefe tiene su propia `/jefe/despachos-vista` solo de lectura. **Decisión:** primero tarjeta linkea a `/bodega/despachos`, y la página verifica si rol=JEFE, oculta botones de acción y muestra solo lectura. Si crece la complejidad, separar después.

## 13. Permisos (RLS y server actions)

Server actions verifican rol con `requerirUsuario(...)`:
- `crearDespacho`, `cerrarDespacho`, `ingresarStock`, CRUD catálogo → BODEGA.
- `crearCosecha`, `crearSalida` → ALMACEN.
- Vistas del jefe → JEFE.

Páginas usan `requerirUsuario` para redirect.

RLS en Supabase: confirmar que las políticas existentes (`supabase/policies.sql`) cubren las tablas tocadas. Si no, agregar políticas para `despachos`, `despacho_items`, `movimientos_insumo`, `cosechas`, `salidas_cosecha`, `herramientas`, `insumos` permitiendo SELECT/INSERT/UPDATE solo a roles autorizados.

## 14. UX

- Mobile-first siempre. Inputs y botones `min-h-touch` (44px).
- Sin emojis.
- Paleta zelanda existente.
- Mensajes de error claros, en español, sin jergas técnicas.
- Para acciones destructivas potenciales (desactivar item, cerrar despacho con devolución cero) confirmar inline.

## 15. Bottom nav

Actualizar `components/shared/BottomNav.tsx`:
- BODEGA: Inicio (`/bodega`), Catálogo (`/bodega/catalogo`), Despachos (`/bodega/despachos`), Perfil.
- ALMACEN: Inicio (`/almacen`), Cosechas (`/almacen/cosechas`), Salidas (`/almacen/salidas`), Perfil.
- JEFE: sin cambios.

## 16. Decisiones explícitas (resumen)

| # | Decisión | Razón |
|---|---|---|
| 1 | `asignacion_id` opcional en despachos | Mixto: trazabilidad cuando se quiera, sin obligar |
| 2 | Sin calidades en cosecha | Pre-selección en campo, solo entra exportable |
| 3 | Stock no editable directo | Solo cambia por movimientos auditados |
| 4 | Herramienta no devuelta no descuenta total | Decisión manual de Diego cuando se confirma pérdida |
| 5 | Jefe ve `/bodega/despachos` en lectura | Evita duplicar pantallas; render condicional por rol |
| 6 | `costo_unitario` opcional | Útil para reportes futuros, no obliga ahora |
| 7 | Selector de asignación carga todas y filtra cliente | Más simple que cambiar dinámicamente del server |
| 8 | Sin edición de despachos cerrados | Auditoría preservada; correcciones via ajuste manual de stock futuro |
