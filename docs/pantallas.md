# FincApp — Hacienda La Zelanda: Guía de Pantallas

> **Para Claude Design:** Este documento describe todas las pantallas del sistema FincApp.
> Lee primero la sección de Convenciones Visuales para establecer el lenguaje visual del proyecto,
> luego cada pantalla con su contexto, datos y estados.

---

## Convenciones Visuales

### Identidad y paleta

La app representa una **finca aguacatera en el Quindío, Colombia**. La estética es **sobria, institucional y profesional** — no gamificada, no infantil. Es una herramienta de trabajo usada en campo con guantes.

| Token | Valor |
|---|---|
| `zelanda-verde-900` | Verde muy oscuro — títulos principales |
| `zelanda-verde-800` | Verde oscuro — texto de cuerpo importante |
| `zelanda-verde-700` | Verde medio — texto secundario, iconos |
| `zelanda-verde-400` | Verde medio claro — bordes hover, acentos |
| `zelanda-verde-50` | Verde muy pálido — fondos tintados |
| `zelanda-ocre-800` | Ocre oscuro — texto de advertencias |
| `zelanda-ocre-400` | Ocre medio — bordes de advertencia |
| `zelanda-ocre-50` | Ocre pálido — fondo de advertencias |
| `zelanda-beige-300` | Beige — bordes de cards y separadores |
| `zelanda-beige-200` | Beige claro — bordes muy suaves |
| `zelanda-beige-100` | Beige muy claro — hover sobre fondos blancos |
| `zelanda-beige-50` | Casi blanco — fondo alternativo de secciones |

**Fondo general de la app:** `bg-zelanda-beige-50` (beige muy pálido). No es blanco puro.

**Acento primario de acción:** verde (`zelanda-verde-700` / `zelanda-verde-800`). Sin azules de Material Design.

### Tipografía

| Uso | Fuente |
|---|---|
| Títulos y encabezados (`<h1>`, `<h2>`) | **Georgia** (font-serif). Estilo institucional, clásico. |
| Cuerpo, etiquetas, botones | Sistema/Calibri (font-sans). Limpio y legible. |

El contraste tipográfico entre el serif de los títulos y el sans-serif del cuerpo es parte central de la identidad visual.

### Iconografía

**Lucide React** exclusivamente. Sin emojis en UI (solo si el usuario los escribe en inputs de texto libre). Los iconos se usan en tamaño `h-4 w-4` (16px) para UI general y `h-5 w-5` (20px) para acciones destacadas.

### Layout general

- **Mobile-first siempre.** Las pantallas se diseñan para celular (375px+). La vista de escritorio es secundaria y escala naturalmente.
- **Bottom navigation** según rol (no sidebar lateral). Visible en todas las pantallas protegidas.
- **Header de página** con gradiente verde oscuro en la parte superior del layout de la app.
- **Contenido** en padding `px-4 py-6` con `max-w-lg mx-auto` en móvil.
- **Fondo de página:** `bg-zelanda-beige-50`.

### Cards

```
rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave
```

- Esquinas redondeadas, sombra muy suave, fondo blanco sobre beige del fondo.
- Cards de alerta/advertencia: `bg-zelanda-ocre-50 border-zelanda-ocre-400`.
- Cards de éxito/resuelto: `bg-zelanda-verde-50/40 border-zelanda-verde-300`.
- Cards de sección en formularios: mismos estilos pero con `p-5`.

### Botones

| Variante | Estilo |
|---|---|
| Primario (acción principal) | `bg-zelanda-verde-700 text-white rounded-lg px-4 py-2.5 font-medium` — alto contraste |
| Secundario / outline | `border border-zelanda-beige-300 bg-white text-zelanda-verde-700 rounded-lg` |
| Destructivo | `border border-red-300 text-red-700 rounded-lg` |
| Link dentro de card | `text-zelanda-verde-700 underline text-xs` |
| Botones de campo (táctil) | Mínimo `min-h-[44px]` — para uso con guantes |

Los botones de acción principal en formularios son `w-full` en móvil.

### Badges / Etiquetas

Componente `BadgeBase` con variantes de `tono`:
- `alerta` → fondo ocre, texto ocre oscuro.
- `info` → fondo verde pálido, texto verde oscuro.
- `danger` → fondo rojo pálido, texto rojo.

### Inputs y formularios

- `rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2 text-sm w-full`
- Con icono a la izquierda: `pl-9` y posición absoluta del icono.
- `min-h-touch` (44px) en campos para asegurar táctil fácil.
- Labels: `text-xs font-medium text-zelanda-verde-800 uppercase tracking-wide mb-1`.
- Inputs select: mismo estilo que text inputs.
- Textareas: `resize-none` con alto fijo.

### Chips de filtro

```
rounded-full px-3 py-1.5 text-xs font-medium shrink-0
```
- Activo: `bg-zelanda-verde-700 text-white`
- Inactivo: `border border-zelanda-beige-300 bg-white text-zelanda-verde-700`

Se presentan en scroll horizontal (`overflow-x-auto`) con `gap-1.5`.

### Headers de sección dentro de página

```html
<p class="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">Subtítulo en mayúsculas</p>
<h1 class="mt-1 font-serif text-2xl text-zelanda-verde-900">Título principal</h1>
```

### Navegación de vuelta (back)

```html
<a class="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700">
  <ChevronLeft /> Nombre de la sección
</a>
```

### Estados vacíos

```
rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700
```

Texto descriptivo según contexto (ej. "No hay asignaciones activas.").

### Avatares

Círculo con iniciales del nombre completo sobre gradiente generado por ID de persona. No se usan fotos de perfil en listas. Tamaño `h-9 w-9` en listas, `h-16 w-16` en perfil.

### Contadores de items

`text-xs text-zelanda-verde-700` con texto natural:
- "3 asignaciones" / "1 asignación"
- "2 de 15 novedades" (cuando hay filtros activos)

---

## Pantallas por rol

---

## Auth

### Login (`/login`)

**Propósito:** Punto de entrada único para los 4 roles. No hay registro público.

**Layout:** Pantalla completa centrada verticalmente. Logo o nombre de la finca en grande. Sin header ni bottom nav.

**Datos:**
- Campo: Usuario (acepta nombre de usuario o correo electrónico)
- Campo: Contraseña
- Botón: "Ingresar"

**Estados:**
- Error de credenciales: mensaje inline bajo el formulario.
- Loading: botón deshabilitado con texto "Ingresando...".

**Post-login:** Redirige a `/jefe`, `/bodega`, `/almacen` o `/trabajador` según el rol de la cuenta.

---

## Perfil (todos los roles)

### Mi Perfil (`/mi-perfil`)

**Propósito:** Datos personales del usuario autenticado. Accesible desde el header en todos los roles.

**Layout:** Card central con avatar grande, datos, y sección de seguridad.

**Datos mostrados:**
- Avatar con iniciales (grande, `h-16 w-16`)
- Nombre completo
- Correo electrónico
- Rol (badge)
- Tipo de vinculación y rol en la finca (si aplica)
- Teléfono (si tiene)

**Acciones:**
- Cambiar contraseña: campo contraseña nueva + confirmar + botón guardar.
- Mensaje de confirmación en verde al guardar.

---

## Rol JEFE

El jefe tiene **bottom nav** con 5 tabs: Dashboard, Mapa, Asignaciones, Equipo, Reportes.

### Dashboard Jefe (`/jefe`)

**Propósito:** Vista de control diaria. El jefe ve el estado de la finca de un vistazo.

**Layout:** Lista vertical de bloques, scroll. Sin tabs internos.

**Bloques (de arriba a abajo):**

1. **Saludo + fecha** — "Buenos días, [nombre]" + fecha actual.

2. **Bloque Alertas** — Máx. 5 items. Si hay más, link "Ver todas las alertas (N)".
   - Items agrupados por tipo de tarea cuando vienen del mismo lote+tipo.
   - Cada item: icono de severidad (rojo=vencida, ámbar=próxima), texto, link a detalle.

3. **Bloque Vencidas** — Tareas vencidas agrupadas por tipo de tarea.
   - Cada grupo: header con nombre del tipo + contador, flecha expand/collapse.
   - Expandido: lista de lotes afectados, cada uno con link a asignación + nombre del tipo.
   - En expandido: widget `AsignarMasivoBox` para crear asignación a varios lotes de un golpe.

4. **Bloque Próximas a vencer** — Igual que vencidas pero ámbar. Tareas en los próximos 7 días.

5. **Bloque Resumen de bodega** — Stock bajo (insumos con disponible ≤ mínimo). Card ocre si hay alertas.

6. **Bloque Resumen de almacén** — Stock actual de cosecha en kg. Link a detalle.

7. **Accesos rápidos** — Grid 2×N de links: Inventario bodega, Vista almacén, Asignaciones, Equipo, Mapa, Reportes.

**Estados:**
- Sin alertas: mensaje "Todo en orden, sin alertas activas".
- Loading: esqueleto (placeholder gris).

---

### Alertas (`/jefe/alertas`)

**Propósito:** Lista completa de todas las alertas del sistema, con búsqueda y filtros.

**Layout:** Buscador + chips de filtro + bloques de severidad.

**Bloques de severidad:**
- Crítico (rojo) — tareas vencidas + despachos abiertos al final del día
- Advertencia (ámbar) — tareas próximas, stock bajo
- Info (azul/verde) — novedades, recordatorios

**Filtros (chips horizontales con scroll):**
- Todas | Tareas | Novedades | Stock | Despachos | Apiario

**Buscador:**
- Busca por texto en título + detalle + nombre del grupo.
- Resultados en tiempo real, sin petición al servidor.

**Agrupación dentro de bloque:**
- Las alertas del mismo tipo de tarea + mismo destino (lote o apiario) se agrupan bajo un header.
- Header del grupo: nombre del tipo de tarea + contador de lotes afectados.
- Expand/collapse por grupo.
- En expandido: lista de lotes + `AsignarMasivoBox` (selector de persona + "Asignar N").
- Alertas sin grupo (novedades, stock, despachos): se muestran individuales con link directo.

**Datos por ítem individual:**
- Icono de severidad
- Título (ej. "Plateo químico vencido")
- Detalle (ej. "Lote Armenia · Vencida hace 12 días")
- Flecha o link al destino (asignación nueva, ficha de insumo, despacho)

---

### Mapa (`/jefe/lotes`) — vista de mapa

**Propósito:** Mapa satelital interactivo con los 15 lotes coloreados por estado de tareas.

**Layout:** Mapa a pantalla completa (Leaflet, satelital). Panel deslizable desde abajo con lista de lotes.

**Leyenda de colores de polígonos:**
- Verde: tareas al día
- Ámbar: alguna tarea próxima (< 7 días)
- Rojo: alguna tarea vencida
- Gris: sin datos / lote sin tareas configuradas

**Panel inferior (lista):**
- Cada lote: nombre, estado (badge de color), click → detalle del lote.

**Instalaciones** (puntos de interés sobre el mapa):
- Casa principal, Bodega, Almacén, Apiario El Cedro, Apiario La Quebrada.
- Cada uno con icono y popup al hacer tap.

---

### Detalle de Lote (`/jefe/lotes/[id]`)

**Propósito:** Vista detallada de un lote: estado de tareas, novedades, acceso a árboles.

**Layout:** Header con nombre del lote + badge de estado. Tabs o bloques verticales.

**Secciones:**

1. **Resumen de tareas** — Lista de tipos de tarea configurados para el lote:
   - Nombre, última fecha, próxima fecha, estado (badge), progreso de árboles si aplica.
   - Link "Ver asignaciones" por tarea.

2. **Novedades recientes** — Últimas novedades del lote. Link "Ver todas".

3. **Accesos:**
   - Botón "Mapa de árboles" → `/jefe/lotes/[id]/mapa-arboles`
   - Botón "Reporte del lote" → `/jefe/lotes/[id]/reporte`
   - Botón "Frecuencias específicas" → `/jefe/lotes/[id]/frecuencias`
   - Botón "Editar lote" → `/jefe/lotes/[id]/editar`

---

### Mapa de Árboles (`/jefe/lotes/[id]/mapa-arboles`)

**Propósito:** Cuadrícula visual o mapa de todos los árboles del lote. Tipo "heat map" de estado.

**Layout:** Grid de pequeños cuadrados, uno por árbol. Coloreados por estado o última novedad.

**Leyenda:**
- Verde: sin novedad activa
- Ámbar: novedad observación
- Rojo: novedad plaga/enfermedad/daño activa

**Interacción:** Tap en árbol → link a ficha del árbol (`/jefe/lotes/[id]/arbol/[numero]`).

**Controles:** Toggle para ver por estado de tarea o por novedad activa.

---

### Ficha de Árbol (`/jefe/lotes/[id]/arbol/[numero]`)

**Propósito:** "Pokédex" del árbol individual. Historial completo de tareas y novedades.

**Layout:** Header con número de árbol + lote. Secciones en scroll.

**Secciones:**

1. **Datos básicos** — Número de placa, lote, estado general.

2. **Historial de tareas** — Lista de registros de avance en los que este árbol aparece (TRAMO o SUELTOS). Fecha, tipo de tarea, persona.

3. **Novedades** — Lista de todas las novedades de este árbol (con badge resuelto/pendiente). Link a detalle de cada novedad.

4. **Fotos** — Galería de fotos adjuntas a novedades.

---

### Reporte de Lote (`/jefe/lotes/[id]/reporte`)

**Propósito:** Estadísticas históricas del lote: tareas completadas, cosecha, novedades.

**Layout:** Secciones con cards de métricas y tablas simples.

**Datos:**
- Árboles totales en el lote
- Tareas completadas por tipo (últimos 12 meses)
- Cosecha registrada por período
- Novedades por tipo y estado

---

### Frecuencias por Lote (`/jefe/lotes/[id]/frecuencias`)

**Propósito:** Sobreescribir la frecuencia default de cada tipo de tarea para este lote específico.

**Layout:** Lista de tipos de tarea con input de días al lado.

**Datos por tipo:**
- Nombre del tipo
- Frecuencia default del sistema (días)
- Input: frecuencia específica para este lote (vacío = usa default)
- Botón guardar por fila o botón global "Guardar cambios"

---

### Editar Lote (`/jefe/lotes/[id]/editar`)

**Propósito:** Editar nombre del lote.

**Layout:** Formulario simple: campo nombre + botón guardar.

---

### Polígono de Lote (`/jefe/lotes/[id]/poligono`)

**Propósito:** Dibujar o editar el polígono del lote sobre el mapa satelital.

**Layout:** Mapa satelital a pantalla completa con herramienta de dibujo de polígono.

**Instrucciones:** Texto de ayuda flotante: "Toca el mapa para colocar vértices. Cierra el polígono tocando el primer punto."

**Acciones:**
- Deshacer último punto
- Limpiar todo
- Guardar polígono

---

### Instalaciones (`/jefe/instalaciones`)

**Propósito:** Ver y gestionar los puntos de interés fijos de la finca (Casa, Bodega, Almacén, Apiarios).

**Layout:** Lista de instalaciones con su estado de ubicación capturada.

**Datos por instalación:**
- Nombre
- Tipo (casa, bodega, almacén, apiario)
- Estado: "Ubicación capturada" (verde) o "Sin ubicación" (gris)
- Link "Editar ubicación"

**Acciones:**
- Botón "Nueva instalación" → `/jefe/instalaciones/nueva`

---

### Nueva Instalación (`/jefe/instalaciones/nueva`)

**Propósito:** Crear un nuevo punto de interés.

**Layout:** Formulario: nombre + tipo (select) + botón guardar.

---

### Editar Ubicación de Instalación (`/jefe/instalaciones/[id]/ubicacion`)

**Propósito:** Colocar el pin de la instalación en el mapa satelital.

**Layout:** Mapa satelital. Tap para colocar pin. Pin arrastrable.

**Acciones:** Guardar ubicación.

---

### Detalle Apiario (`/jefe/apiarios/[id]`)

**Propósito:** Ver el historial de visitas y cosechas de miel de un apiario.

**Layout:** Header con nombre del apiario + colmenas. Tabs Visitas / Cosechas.

**Tab Visitas:**
- Lista de visitas con fecha, persona, estado general (bien/problemas/crítico), notas.
- Badge de color según estado (verde/ámbar/rojo).

**Tab Cosechas:**
- Lista de cosechas de miel con fecha, persona, kilos.
- Total de kilos del período visible.

---

### Editar Ubicación Apiario (`/jefe/apiarios/[id]/ubicacion`)

**Propósito:** Fijar la posición del apiario en el mapa.

**Layout:** Igual que editar ubicación de instalación.

---

### Asignaciones (`/jefe/asignaciones`)

**Propósito:** Lista de asignaciones activas (abiertas). No muestra completadas salvo filtro.

**Layout:** Header "Asignaciones" + botón "Nueva" + lista.

**Filtros:**
- Tabs o chips: Activas | Completadas | Todas
- Opcionalmente por tipo de tarea o trabajador

**Datos por asignación:**
- Tipo de tarea (badge)
- Destino: "Lote Armenia" o "Apiario El Cedro"
- Trabajador asignado: avatar con iniciales + nombre
- Fecha de inicio y fecha límite
- Estado: badge (abierta / en progreso / completada / vencida)
- ChevronRight → link a detalle

---

### Nueva Asignación (`/jefe/asignaciones/nueva`)

**Propósito:** Crear una asignación: elegir tipo de tarea, destino (lote o apiario), trabajador, fecha.

**Layout:** Formulario vertical paso a paso o de una sola pantalla.

**Campos:**
- Tipo de tarea (select con lista de tipos activos)
- Destino: lote o apiario (según área del tipo de tarea)
- Trabajador: select de personas activas
- Fecha de inicio (date picker, default hoy)
- Notas opcionales

**Acciones:** Botón "Crear asignación". Mensaje de confirmación.

---

### Detalle de Asignación (`/jefe/asignaciones/[id]`)

**Propósito:** Ver el progreso de una asignación: qué árboles se cubrieron, por quién, cuándo.

**Layout:** Header con tipo de tarea + lote. Secciones en scroll.

**Secciones:**

1. **Datos de asignación** — tipo, destino, trabajador, fechas.
2. **Progreso** — barra de progreso o lista de árboles cubiertos.
3. **Registros de avance** — lista de entradas (TRAMO/SUELTOS/VISITA) con fecha y persona.
4. **Acciones** — "Cerrar asignación" (solo jefe), "Reasignar".

---

### Equipo (`/jefe/equipo`)

**Propósito:** Lista de personas activas en la finca (todas las vinculaciones).

**Layout:** Buscador + lista de personas.

**Datos por persona:**
- Avatar con iniciales
- Nombre completo
- Tipo de vinculación + rol en la finca
- Badge de rol de app (TRABAJADOR, BODEGA, etc.) si tiene acceso
- ChevronRight → ficha de persona

**Acciones:**
- Botón "Agregar persona" → `/jefe/equipo/nuevo`

---

### Nueva Persona (`/jefe/equipo/nuevo`)

**Propósito:** Registrar una persona nueva en el sistema.

**Layout:** Formulario en secciones: datos personales + vinculación inicial.

**Campos personales:**
- Nombre completo
- Cédula
- Teléfono
- Fecha de nacimiento
- Notas

**Campos de vinculación:**
- Tipo (FIJO / JORNALERO / CONTRATISTA / FAMILIAR)
- Rol en finca (texto libre)
- Fecha inicio
- Salario base + período de pago (si FIJO)
- Tarifa jornal (si JORNALERO)

---

### Ficha de Persona (`/jefe/equipo/[id]`)

**Propósito:** Ver perfil completo, vinculaciones históricas, productividad y actividad reciente.

**Layout:** Header con avatar grande + nombre + tipo. Secciones en scroll.

**Secciones:**

1. **Datos personales** — cédula, teléfono, edad, notas.

2. **Vinculación actual** — tipo, rol, desde cuándo, datos de compensación.
   - Botón "Editar vinculación" → formulario inline.
   - Botón "Cerrar vinculación" → abre diálogo de confirmación + fecha fin.

3. **Historial de vinculaciones** — acordeón colapsable con vinculaciones anteriores.

4. **Productividad** — árboles atendidos en los últimos 30 / 90 / 365 días por tipo de tarea.

5. **Asignaciones recientes** — lista de asignaciones (activas y últimas completadas).

---

### Editar Persona (`/jefe/equipo/[id]/editar`)

**Propósito:** Editar datos personales (nombre, cédula, teléfono, notas).

**Layout:** Formulario con los campos de datos personales pre-cargados.

---

### Gestión de Acceso (`/jefe/equipo/[id]/acceso`)

**Propósito:** Asignar o cambiar el rol de app de una persona, crear cuenta o resetear contraseña.

**Layout:** Card con estado actual de acceso + acciones.

**Estados:**
- Sin cuenta de app: botón "Crear acceso" con select de rol + campo usuario.
- Con cuenta activa: badge de rol, botón "Cambiar rol", botón "Resetear contraseña".

---

### Tipos de Tarea (`/jefe/tareas`)

**Propósito:** Catálogo de tipos de tarea configurables.

**Layout:** Lista de tipos + botón "Nuevo tipo".

**Datos por tipo:**
- Nombre
- Área (cultivo / apicultura) — badge
- Frecuencia default en días
- Activo / inactivo (toggle)

---

### Nuevo Tipo de Tarea (`/jefe/tareas/nuevo`)

**Propósito:** Crear un nuevo tipo de tarea.

**Campos:** Nombre + área (select) + frecuencia default (días) + descripción opcional.

---

### Editar Tipo de Tarea (`/jefe/tareas/[id]/editar`)

**Propósito:** Modificar nombre, frecuencia o descripción de un tipo existente.

**Layout:** Igual que nuevo, con campos pre-cargados.

---

### Inventario Jefe — Vista Lectura (`/jefe/inventario`)

**Propósito:** Vista de solo lectura del inventario de bodega para el jefe.

**Layout:** Tabs Herramientas / Insumos.

**Tab Herramientas:**
- Lista con nombre, categoría, cantidad total, cantidad prestada.
- Sin acciones de edición.

**Tab Insumos:**
- Lista con nombre, categoría, unidad, stock actual, stock mínimo.
- Badge de alerta si disponible ≤ mínimo.
- Sin acciones de edición.

---

### Vista Almacén Jefe (`/jefe/almacen-vista`)

**Propósito:** Vista de solo lectura del stock de cosecha para el jefe.

**Layout:** Card con total en kg actual + tabla de movimientos recientes.

**Datos:**
- Stock actual calculado (suma cosechas - suma salidas) en kg
- Últimas 20 entradas (cosechas + salidas) con fecha, tipo, cantidad, lote.

---

### Novedades (`/jefe/novedades`)

**Propósito:** Gestión de novedades reportadas por los trabajadores. Tabs Pendientes / Resueltas.

**Layout:** Tabs (links) + buscador + filtros de tipo + lista.

**Tabs:**
- Pendientes (default)
- Resueltas

**Filtros de tipo (chips):**
- Todas | Plaga | Daño físico | Enfermedad | Observación | Otro

**Buscador:**
- Busca por descripción, lote, persona, número de árbol.

**Datos por novedad en lista:**
- Badge de tipo (color según tipo) + badge Resuelta (si aplica)
- Fecha
- "Árbol N · Lote X"
- Descripción (truncada)
- "por Nombre Persona"
- ChevronRight → detalle

---

### Detalle de Novedad (`/jefe/novedades/[id]`)

**Propósito:** Ver la novedad completa y gestionarla (resolver o reabrir).

**Layout:** Navegación de vuelta + header con badges + secciones.

**Header:**
- Badge tipo + badge "Resuelta" (si aplica) + fecha
- "Árbol N · Lote X"
- "Reportada por Nombre"
- Link "Ver historial del árbol →"

**Secciones (novedad pendiente):**
1. Card blanco con descripción completa (whitespace preservado)
2. Foto (si tiene) en card
3. Link ocre "Crear asignación para atender en el lote"
4. Card "Marcar como resuelta":
   - Textarea: notas de resolución (placeholder con ejemplos)
   - Botón "Marcar resuelta"

**Secciones (novedad resuelta):**
1. Card descripción
2. Foto (si tiene)
3. Card verde: icono ClipboardCheck + "Resuelta el [fecha]" + notas de resolución + link "Reabrir novedad"

---

### Reportes (`/jefe/reportes`)

**Propósito:** Resumen analítico anual de la finca con posibilidad de exportar cada sección a CSV.

**Layout:** Secciones verticales, una por área de análisis.

**Secciones (cada una con botón "Descargar CSV"):**

1. **Cosecha últimos 12 meses** — tabla por mes: kg totales, número de ingresos, lotes activos.

2. **Ranking de lotes por cosecha** — lote, kg totales, porcentaje del total.

3. **Top recolectores** — persona, cosechas, kg totales.

4. **Insumos consumidos (año)** — insumo, unidad, cantidad total consumida.

5. **Miel por apiario** — apiario, cosechas, kg totales.

6. **Top recolectores de miel** — persona, cosechas de miel, kg.

7. **Salidas de almacén (año)** — tipo de salida (venta/consumo/pérdida/otro), cantidad, kg.

**Botón CSV:** inline junto al título de cada sección. Deshabilitado si no hay datos.

---

## Rol BODEGA

El rol BODEGA tiene **bottom nav** con: Despachos, Inventario, Pendientes.

### Dashboard Bodega (`/bodega`)

**Propósito:** Vista principal del encargado de bodega: despachos de hoy abiertos.

**Layout:** Header "Bodega" + lista de despachos activos del día.

**Datos por despacho:**
- Nombre del trabajador (avatar + nombre)
- Lista de ítems despachados (herramientas prestadas + insumos)
- Estado: Abierto / Cerrado
- Botón "Ver despacho" → detalle

**Acciones:**
- Botón "Nuevo despacho" → `/bodega/despachos/nuevo`

---

### Lista de Despachos (`/bodega/despachos`)

**Propósito:** Historial de despachos con filtro por fecha y estado.

**Layout:** Filtros (hoy / esta semana / abiertos / cerrados) + lista.

**Datos por despacho:**
- Trabajador, fecha, estado (badge), número de ítems.

---

### Nuevo Despacho (`/bodega/despachos/nuevo`)

**Propósito:** Crear un despacho para un trabajador al inicio del día.

**Layout:** Formulario en pasos o pantalla única.

**Campos:**
- Trabajador (select de personas activas)
- Herramientas: selector múltiple con cantidad + condición de salida (para cada una)
- Insumos: selector con cantidad a despachar

**Acciones:** Botón "Crear despacho" → crea registros de préstamo y reserva de insumos.

---

### Detalle de Despacho (`/bodega/despachos/[id]`)

**Propósito:** Ver el despacho completo y cerrarlo al final del día.

**Layout:** Header con nombre del trabajador + fecha. Lista de ítems. Sección de cierre.

**Secciones:**

1. **Herramientas prestadas** — nombre, categoría, condición de salida, input de condición de regreso.
2. **Insumos despachados** — nombre, cantidad despachada, input de cantidad consumida real.
3. **Cerrar despacho:**
   - Para cada insumo: confirmar cantidad consumida.
   - Para cada herramienta: registrar condición de regreso.
   - Botón "Cerrar despacho" → actualiza stock, cierra registros.

**Estado cerrado:** muestra todo en modo lectura con condiciones de regreso.

---

### Inventario Bodega (`/bodega/inventario`)

**Propósito:** Gestión completa del catálogo de herramientas e insumos.

**Layout:** Tabs Herramientas / Insumos + buscador.

**Tab Herramientas:**
- Lista: nombre, categoría, cantidad total, prestadas ahora.
- Botón "Nueva herramienta" → `/bodega/inventario/herramientas/nueva`
- Tap en ítem → editar (`/bodega/inventario/herramientas/[id]/editar`)

**Tab Insumos:**
- Lista: nombre, categoría, unidad, stock disponible (actual - reservado), mínimo.
- Badge de alerta si disponible ≤ mínimo.
- Botón "Nuevo insumo" → `/bodega/inventario/insumos/nuevo`
- Tap en ítem → editar o ingresar stock

---

### Nueva Herramienta (`/bodega/inventario/herramientas/nueva`)

**Propósito:** Agregar una herramienta al catálogo.

**Campos:** Nombre + categoría (select: cultivo/cosecha/apicultura) + cantidad total + descripción opcional.

---

### Editar Herramienta (`/bodega/inventario/herramientas/[id]/editar`)

**Propósito:** Modificar datos de una herramienta. Toggle activo/inactivo.

**Campos:** Igual que nueva, con datos pre-cargados + toggle activo.

---

### Nuevo Insumo (`/bodega/inventario/insumos/nuevo`)

**Propósito:** Agregar un insumo al catálogo.

**Campos:** Nombre + categoría + unidad (texto libre, ej. "litros", "kg", "bolsas") + stock inicial + stock mínimo.

---

### Editar Insumo (`/bodega/inventario/insumos/[id]/editar`)

**Propósito:** Modificar datos de un insumo. Toggle activo/inactivo.

**Campos:** Igual que nuevo + toggle activo.

---

### Ingresar Stock de Insumo (`/bodega/inventario/insumos/[id]/ingresar`)

**Propósito:** Registrar una entrada de stock (compra, donación).

**Campos:** Cantidad + notas opcionales + fecha.

---

### Historial de Insumo (`/bodega/inventario/insumos/[id]/historial`)

**Propósito:** Ver todos los movimientos de stock de un insumo: ingresos y consumos.

**Layout:** Lista cronológica con tipo de movimiento (entrada/consumo), cantidad, fecha, nota.

---

### Pendientes Bodega (`/bodega/pendientes`)

**Propósito:** Cola de acciones offline que aún no se han sincronizado con el servidor.

**Layout:** Lista de operaciones pendientes con su estado (pendiente / error / reintentando).

**Tipos de pendientes:**
- Despacho creado offline
- Despacho cerrado offline

**Acciones:** Botón "Reintentar" por ítem con error. Botón "Reintentar todos".

---

## Rol ALMACÉN

El rol ALMACÉN tiene **bottom nav** con: Dashboard, Cosecha, Salidas, Pendientes.

### Dashboard Almacén (`/almacen`)

**Propósito:** Vista rápida del stock actual de cosecha.

**Layout:** Card grande con kg actuales + accesos a cosecha y salidas.

**Datos:**
- Stock actual en kg (calculado en tiempo real)
- Número de ingresos del día
- Link "Registrar cosecha"
- Link "Registrar salida"

---

### Cosecha — Lista (`/almacen/cosecha`)

**Propósito:** Historial de ingresos de cosecha.

**Layout:** Filtros de fecha + lista cronológica.

**Datos por ingreso:**
- Fecha, lote, recolector, método (CANASTA/BASCULA), cantidad (canastas o kg), kg resultantes.

---

### Nueva Cosecha (`/almacen/cosecha/nueva`)

**Propósito:** Registrar un ingreso de cosecha al almacén.

**Campos:**
- Lote (select de los 15 lotes)
- Recolector (select de personas activas)
- Método: CANASTA (canastas × capacidad en kg) o BASCULA (peso directo en kg)
- Si CANASTA: número de canastas + capacidad por canasta (kg)
- Si BASCULA: peso total (kg)
- Fecha (default hoy)
- Notas opcionales

**Cálculo:** muestra kg resultantes en tiempo real al cambiar campos.

---

### Salidas — Lista (`/almacen/salidas`)

**Propósito:** Historial de salidas del almacén.

**Layout:** Filtros de tipo + lista cronológica.

**Datos por salida:**
- Fecha, tipo (venta/consumo/pérdida/otro), kg, destino/notas.

---

### Nueva Salida (`/almacen/salidas/nueva`)

**Propósito:** Registrar una salida del almacén (venta, consumo familiar, pérdida).

**Campos:**
- Tipo de salida (select: VENTA / CONSUMO / PERDIDA / OTRO)
- Cantidad en kg
- Fecha
- Notas / destino

---

### Pendientes Almacén (`/almacen/pendientes`)

**Propósito:** Cola de acciones offline pendientes de sincronización.

**Layout:** Lista de cosechas y salidas creadas offline con estado de sync.

---

## Rol TRABAJADOR

El rol TRABAJADOR tiene **bottom nav** con: Mis Tareas, Préstamos, Pendientes.

### Mis Tareas (`/trabajador/tareas`)

**Propósito:** Lista de asignaciones activas del trabajador autenticado.

**Layout:** Lista de asignaciones agrupadas por estado (urgente primero).

**Datos por asignación:**
- Tipo de tarea (badge)
- Destino: lote o apiario
- Fecha límite + días restantes (o "Vencida" en rojo)
- Progreso si aplica

**Acciones:**
- Tap → detalle de asignación con botón "Registrar avance"

---

### Dashboard Trabajador (`/trabajador`)

**Propósito:** Pantalla de inicio del trabajador: resumen rápido del día.

**Layout:** Saludo + resumen de tareas pendientes + acceso a novedad rápida.

**Datos:**
- Número de tareas activas
- Tarea más urgente (si hay vencidas, resaltada)
- Botón "Reportar novedad" → `/trabajador/novedad/nueva`

---

### Registrar Avance (`/trabajador/avance/[asignacion_id]`)

**Propósito:** El trabajador reporta qué hizo en la asignación.

**Layout:** Selector de modo + formulario según modo.

**Modos:**

1. **TRAMO** — Del árbol N al árbol M (continuo en hilera).
   - Campos: árbol inicio (número) + árbol fin (número).
   - Validación: fin ≥ inicio, ambos dentro del rango del lote.

2. **SUELTOS** — Lista de árboles específicos.
   - Campo: lista de números separados por coma o input repetible.

3. **VISITA** — Para tareas de apiario (sin árboles).
   - Campos: estado general (BIEN / PROBLEMAS / CRÍTICO) + notas.
   - Si CRÍTICO: push automático al jefe.

**Campos comunes:**
- Notas opcionales
- Foto (adjuntar desde cámara o galería) — opcional

**Acciones:** Botón "Guardar avance". Funciona offline (encola en IndexedDB).

---

### Ficha de Árbol — Trabajador (`/trabajador/arbol/[lote_id]/[numero]`)

**Propósito:** El trabajador consulta el historial de un árbol específico.

**Layout:** Igual que la ficha de árbol del jefe pero en modo lectura simplificada.

**Datos:**
- Número de árbol, lote
- Últimas 5 tareas realizadas
- Novedades activas (si las hay, resaltadas en ámbar/rojo)

---

### Nueva Novedad (`/trabajador/novedad/nueva`)

**Propósito:** Reportar un evento puntual sobre un árbol.

**Campos:**
- Lote (select)
- Árbol (número, input numérico)
- Tipo de novedad (select: PLAGA / DANO_FISICO / ENFERMEDAD / OBSERVACION / OTRO)
- Descripción (textarea)
- Foto (opcional, desde cámara)

**Acciones:** Botón "Reportar". Funciona offline.

---

### Mis Préstamos (`/trabajador/prestamos`)

**Propósito:** Ver qué herramientas tiene el trabajador prestadas actualmente.

**Layout:** Lista de herramientas prestadas (del despacho abierto más reciente).

**Datos por herramienta:**
- Nombre, categoría, condición al sacar.

**Estado vacío:** "No tenés herramientas prestadas en este momento."

---

### Pendientes Trabajador (`/trabajador/pendientes`)

**Propósito:** Cola de acciones offline pendientes (avances, novedades registradas sin conexión).

**Layout:** Lista de items con estado (pendiente / error / sincronizado).

**Acciones:** Reintentar item con error. Reintentar todos.

---

## Pantallas auxiliares y de sistema

### Raíz (`/`)

**Propósito:** Redirección automática. Si autenticado → rol correspondiente. Si no → `/login`.

No tiene UI propia.

### No encontrado (404)

**Propósito:** Página de error para rutas no existentes o registros eliminados.

**Layout:** Mensaje "No encontrado" + link "Volver al inicio".

---

*Documento generado el 2026-05-22 · FincApp v1 · Hacienda La Zelanda*
