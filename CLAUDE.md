# Hacienda La Zelanda — Sistema FincApp

> **Para Claude Code:** este archivo es la fuente de verdad del proyecto. Léelo entero antes de empezar cualquier tarea. Si alguna decisión no está aquí, **pregúntale al usuario** antes de improvisar.

---

## 1. Resumen ejecutivo

**FincApp** es un sistema de gestión integral para la **Hacienda La Zelanda**, una finca familiar de **aguacate Hass** en el Quindío, Colombia. Es una **PWA (Progressive Web App)** con capacidad offline, accesible desde celular sin instalación de tienda.

El usuario maneja conceptos técnicos (estudiante de Ingeniería de Software). No hay que explicarle qué es una FK, un trigger, un endpoint, etc.

El proyecto se desarrolla **en tiempos libres, sin presión de plazos**. No es comercial. No se va a vender a otras fincas (al menos por ahora).

---

## 2. Contexto operativo de la finca

| Dato | Valor |
|---|---|
| Nombre | Hacienda La Zelanda |
| Cultivo | **Solo aguacate Hass** (no hay otras variedades) |
| Ubicación | Quindío, Colombia |
| Lotes | 15, nombrados con municipios del Quindío |
| Árboles | ~30.000 (entre 1.500 y 2.300 por lote) |
| Numeración árboles | 1..N **dentro de cada lote**, con placa física. La misma numeración se repite entre lotes. |
| Topografía | Montañosa, hileras siguen curvas de nivel |
| Apiarios | 2 (Apiario El Cedro, 12 colmenas; Apiario La Quebrada, 8 colmenas) |
| Personal | 15-20 trabajadores (~10 fijos en campo) |
| Conectividad | Internet móvil **intermitente** — modo offline es **obligatorio** |

### Lotes (los 15 nombres exactos)

Armenia, Calarcá, Circasia, Córdoba, Filandia, Génova, La Tebaida, Montenegro, Pijao, Quimbaya, Salento, Buenavista, Barcelona, Pueblo Tapao, La Cabaña.

### Instalaciones (puntos de interés en el mapa)

Casa principal, Bodega, Almacén, Apiario El Cedro (sector norte), Apiario La Quebrada (sector sur).

---

## 3. Stack técnico

| Componente | Tecnología |
|---|---|
| Frontend | **Next.js 15.5 (App Router)** + React 19 + TypeScript |
| Estilos | **Tailwind CSS** |
| Mapas | **Leaflet** (con react-leaflet) |
| Iconografía | **Lucide React** |
| Backend | Next.js API Routes / Server Actions |
| Base de datos | **PostgreSQL 15+ con PostGIS** |
| ORM | **Prisma** |
| Auth | **Supabase Auth** |
| Hosting BD | **Supabase** (free tier) |
| Hosting App | **Vercel** (free tier) |
| Storage de fotos | **Supabase Storage** |
| Repositorio | GitHub privado |
| Tipo de app | **PWA con modo offline (IndexedDB local + sync)** |

### Filosofía técnica
- **Server Components por defecto**, Client Components solo donde haga falta interactividad.
- **Server Actions** para mutaciones simples; API Routes para lo que necesite endpoint REST claro.
- **Mínimo de triggers en BD**: solo invariantes simples (actualizar `arboles.estado` ante novedades). El resto en transacciones a nivel API.
- **RLS en Supabase**: cada tabla con políticas que controlan acceso según rol.
- **Mobile-first siempre**: la app se usa en celular en campo. Pantallas de escritorio son secundarias.

---

## 4. Roles de usuario

Hay **4 roles** con interfaces diferenciadas (mismo proyecto, vistas distintas según rol):

### 4.1 JEFE
- Visión general de la finca, alertas, métricas
- Configura tipos de tarea y frecuencias (default y por lote)
- Asigna tareas a trabajadores
- Consulta fichas de árboles, reportes históricos
- Gestiona equipo
- Vista de inventario y cosecha en modo lectura

### 4.2 BODEGA
- Despacha herramientas e insumos a trabajadores al inicio del día
- Recibe devoluciones al final
- Mantiene actualizado el inventario
- **Encargado en prototipo:** Diego Toro

### 4.3 ALMACEN
- Recibe cosecha entrante (por canastas o báscula)
- Registra lote de origen, recolector, cantidad
- Registra salidas (venta, consumo, pérdida)
- **Encargado en prototipo:** Rocío Marín

### 4.4 TRABAJADOR
- Ve sus tareas asignadas
- Ve qué tiene prestado de bodega
- Registra avance (tramo continuo / árboles sueltos / novedad)
- Adjunta fotos opcionales

> **Sobre apicultura:** Las tareas de apicultura (visita al apiario, cosecha de miel) se asignan a cualquier trabajador disponible. No hay sub-rol "apicultor" — el conocimiento se reparte en el equipo y el despacho de equipo apícola va a quien tenga la asignación.

---

## 5. Módulos del sistema

### 5.1 Lotes y Árboles
- Mapa satelital con polígonos de los 15 lotes (coloreados por estado: verde al día, ámbar próxima, rojo vencida)
- Detalle de lote: tareas con progreso, vista de cuadrícula de árboles, novedades
- Ficha técnica individual por árbol ("Pokédex"): historial de tareas, novedades, fotos

### 5.2 Tareas y Asignaciones
Tipos de tarea predefinidos (configurables por el jefe):

| Tarea | Frecuencia default (días) | Área |
|---|---|---|
| Plateo químico | 90 | cultivo |
| Poda | 180 | cultivo |
| Fertilización | 60 | cultivo |
| Control de plagas | 45 | cultivo |
| Riego | 15 | cultivo |
| Cosecha | 120 | cultivo |
| Visita al apiario | 21 | apicultura |
| Cosecha de miel | 90 | apicultura |

**Cada lote puede tener frecuencias específicas que sobreescriben las default.**

### Flujo de asignación
1. Jefe selecciona lote y crea asignación (tarea + trabajador)
2. Trabajador ve asignación en su pantalla
3. Trabajador registra avance de 3 formas posibles:
   - **TRAMO**: del árbol X al Y (continuo)
   - **SUELTOS**: lista de números específicos
   - **NOVEDAD**: reporte puntual sobre un árbol (plaga, daño, observación)
4. Sistema actualiza progreso y calcula próxima fecha programada
5. Alertas cuando faltan menos de 7 días o ya está vencida

### 5.3 Bodega
- **Herramientas** (durables): se prestan y devuelven. Categorías: cultivo, cosecha, apicultura
- **Insumos** (consumibles): se descuentan del stock. Mismas categorías
- Modelo de stock de insumos: **reserva + consumo real**
  - Al despachar: se *reserva* (`stock_reservado` sube)
  - Al cerrar despacho: se registra `cantidad_consumida` y se aplica:
    - `stock_actual -= cantidad_consumida`
    - `stock_reservado -= cantidad` (la original)
    - Lo no consumido vuelve al disponible
- Alertas cuando `(stock_actual - stock_reservado) <= stock_minimo`

### 5.4 Almacén de cosecha
- Ingreso: trabajador recolector + lote + método (canasta o báscula) + cantidad
- Método CANASTA: `canastas × capacidad` = `peso_kg`
- Método BASCULA: `peso_kg` directo
- Salidas: venta, consumo familiar, pérdida, otro
- **Stock del almacén = vista calculada** (suma cosechas - suma salidas)

### 5.5 Apicultura
- 2 apiarios visibles en mapa
- Tareas específicas (visita al apiario, cosecha de miel) asignables a **cualquier trabajador disponible**. No requiere rol designado.
- Equipo específico en bodega (trajes, ahumador, etc.)

### 5.6 Personas y Vínculos
La operación de la finca involucra 4 perfiles, modelados como **`personas`** (identidad invariante) + **`vinculaciones`** (cada relación con la finca en el tiempo, con histórico):

- **FIJO**: empleado con sueldo periódico (mensual/quincenal/semanal).
- **JORNALERO**: contratado por días, con tarifa por jornal.
- **CONTRATISTA**: contratado por servicios puntuales (puente, cortar madera, cerca). Cobra por servicio.
- **FAMILIAR**: familia / propietarios, sin compensación vía app.

Una persona puede transitar entre vínculos en el tiempo (jornalero → fijo, fijo que sale y vuelve como contratista). Cada cambio cierra la vinculación anterior y abre una nueva, preservando histórico.

Datos por **persona**: nombre completo, cédula, teléfono, fecha de nacimiento, foto, notas, activo.

Datos por **vinculación**: tipo, rol_finca (texto libre), fecha_inicio, fecha_fin, salario_base + periodo_pago (solo FIJO), tarifa_jornal (solo JORNALERO), esquema_pago_destajo (solo FIJO/JORNALERO).

La capa financiera (pagos, tarifas configurables, servicios contratados con pagos parciales, jornales, ausencias, vista de saldos por persona) está implementada en Fase 6 — ver §9 más abajo. La lógica de destajo (cantidad × tarifa por kg/árbol/ha) está pendiente y requiere mapear `registros_avance` a `tarifas_tarea` con esquema POR_KG / POR_ARBOL / POR_HECTAREA.

### 5.7 Alertas
- Tarea vencida
- Tarea próxima a vencer (< 7 días)
- Stock de insumo bajo
- Despacho abierto al final del día
- Novedad crítica reportada

---

## 6. Esquema de base de datos

El SQL base está en **`esquema.sql`**. La migración a `personas` + `vinculaciones` (que reemplaza `trabajadores`) está en **`supabase/migracion-nucleo-personas.sql`**. Las RLS están en **`supabase/policies.sql`**. Las migraciones de la capa financiera viven en `supabase/migracion-{tarifas-tarea,pagos,servicios-contratados,jornales,ausencias,recordatorios}.sql`. Estado actual: 24 tablas + 2 vistas (`v_insumos_stock`, `v_stock_almacen`), incluyendo `personas` y `vinculaciones` y las 6 tablas de Fase 6 (recordatorios, tarifas_tarea, pagos, servicios_contratados, jornales, ausencias).

### Decisiones de diseño clave

| Decisión | Razón |
|---|---|
| `personas` + `vinculaciones` reemplazan `trabajadores` | La realidad operacional tiene 4 perfiles (fijos, jornaleros, contratistas, familia) y una persona puede transitar entre ellos. Histórico preservado. |
| `novedades.arbol_id` con FK estricta a `arboles.id` | La numeración se repite entre lotes, por eso no sirve `(lote_id, numero_placa)` solo |
| Stock cosecha como **vista** | Evita desincronización |
| Stock insumos con `stock_actual` + `stock_reservado` | Soporta reserva + consumo real |
| Soft-delete solo en `personas`, `lotes`, `arboles` | Mantiene historia donde importa; en eventos (cosecha, asignación, etc.) no se borra nunca |
| `tipos_tarea`, `herramientas`, `insumos` usan flag `activo` en vez de soft-delete | Son catálogos |
| Triggers mínimos | Solo para invariantes; lógica compleja en API |

---

## 7. Convenciones de código

### Nombres
- **Tablas y columnas en BD**: `snake_case` en español (`trabajadores`, `lote_id`)
- **Modelos Prisma**: igual que tabla (`trabajadores`)
- **Variables y funciones en TS**: `camelCase` en español (`obtenerLotes`, `loteActual`)
- **Componentes React**: `PascalCase` en español (`MapaFinca`, `FichaArbol`)
- **Tipos / Enums TS**: `PascalCase` (`RolUsuario`, `EstadoArbol`)
- **Constantes globales**: `UPPER_SNAKE_CASE`

### Estructura de carpetas (Next.js App Router)

```
/app
  /(auth)
    /login
  /(app)              ← rutas protegidas, requieren auth
    /layout.tsx       ← layout con bottom nav según rol
    /jefe
    /bodega
    /almacen
    /trabajador
  /api
    /auth
    /...
/components
  /ui                 ← componentes base (Button, Card, etc.)
  /mapa
  /lotes
  /tareas
  /bodega
  /almacen
  /shared
/lib
  /supabase.ts        ← cliente Supabase
  /prisma.ts          ← cliente Prisma
  /utils.ts
  /offline            ← lógica de sync offline
/prisma
  /schema.prisma
/types
  /index.ts           ← tipos compartidos
```

### Idioma
**Todo en español** (UI, comentarios, nombres de variables). Esto es para la finca, no es código que vaya a leer alguien en inglés.

### Comentarios
Solo donde aporten valor: explicar **por qué**, no qué. El código bien nombrado explica el qué.

### Manejo de errores
- API: respuestas con `{ ok: false, error: string }` o `{ ok: true, data: T }`
- UI: mensajes amigables, sin mostrar stack traces al usuario
- Logs detallados solo en servidor

---

## 8. Decisiones de UX

### Visual
- **Paleta sobria**: verdes oscuros + ocres + beige. Sin saturación juvenil.
- **Tipografía**: Georgia para títulos (estilo institucional), Calibri/sistema para cuerpo.
- **Iconografía**: Lucide React. **Sin emojis** en la UI principal (excepto cuando sean parte de input del usuario).
- **Tono**: profesional, no infantil. Es una finca seria, no una app gamificada.
- **Mobile first**: pantallas pensadas para uso en campo, con un pulgar, con guantes a veces.

### Componentes de UX importantes
- **Bottom nav** según rol (no sidebar)
- **Headers** con gradiente sutil verde oscuro
- **Cards con sombra suave** (no bordes duros)
- **Botones grandes** para acciones de campo (mínimo 44x44 px)
- **Avatares con iniciales** sobre gradiente generado por id (no fotos personales)

### Prototipo de referencia
El prototipo `zelanda_app.jsx` (entregado en la conversación previa) es **la guía visual y de UX**. Cuando construyas pantallas, replica su estética y estructura. Datos de ese prototipo son ficticios; lo real viene de Supabase.

---

## 9. Hoja de ruta de desarrollo

> Construir en fases. **No empezar una fase sin terminar la anterior**. Cada fase debe quedar funcionando y probada en uso real antes de pasar a la siguiente.

### ✅ Fase 0 — Definición (COMPLETADA)
Prototipo navegable, documento maestro, esquema de BD.

### ✅ Fase 1 — Infraestructura base (COMPLETADA — desplegada 2026-05-11)
**Objetivo:** tener un Next.js desplegado en Vercel con login funcional y los 4 roles.

Pasos:
1. Inicializar proyecto Next.js 14+ con TypeScript y Tailwind
2. Configurar Prisma con schema básico (espejo del `esquema.sql`)
3. Conectar a Supabase (BD ya creada con el script SQL)
4. Configurar Supabase Auth con email/password
5. Crear flujo de login con redirección según rol
6. Crear layouts diferenciados por rol con bottom nav
7. Configurar RLS policies básicas en Supabase
8. Deploy a Vercel con variables de entorno

### ✅ Fase 2 — Mapa y lotes (COMPLETADA)
- 15 lotes cargados, Leaflet con vista satelital, detalle de lote, polígonos reales capturables.

### ✅ Fase 3 — Tareas y asignaciones (COMPLETADA)
- CRUD de tipos de tarea, frecuencias por lote, flujo de asignación, registro de avance (TRAMO/SUELTOS/VISITA), cálculo de próximas fechas y alertas.

### ✅ Fase 4 — Bodega y almacén (COMPLETADA)
- Catálogos, despacho/devolución (reserva + consumo), recepción y salida de cosecha, reporte por lote.

### ✅ Fase 5 — Apicultura y refinamientos (COMPLETADA)
- Módulo de apiarios ✅ (visita con estado general bien/problemas/crítico, push automático al jefe si crítico, cosecha de miel con kg, detalle apiario con historial)
- Notificaciones push ✅ (sub-fase 5.1)
- Modo offline trabajador ✅ (sub-fase 5.2a — ver tareas, registrar avance/novedad, sync con backoff, pantalla `/trabajador/pendientes`)
- Modo offline bodega/almacén/jefe ✅ (sub-fase 5.2b — crear/cerrar despacho offline, cosecha + salida offline, jefe dashboard cacheado; pantallas `/bodega/pendientes` y `/almacen/pendientes`)
- Fotos offline con re-escalado a 1280px ✅ (sub-fase 5.2c — `SubirFoto` comprime client-side a 1280 px de lado mayor y JPEG calidad 0.85 antes de enviar al servidor, vía DataTransfer API)

### 🎯 Mejoras agregadas después del roadmap original
- Pokédex de árbol con heat-map, mapa de árboles por lote y bar chart de cosecha por año ✅
- Login con username (además de email) ✅
- Condición de devolución de herramienta ✅
- Edición de vinculación activa sin cerrar histórico ✅
- Gestión de acceso (crear / cambiar rol / resetear contraseña) ✅
- Reportes globales de la finca (`/jefe/reportes`) con bar charts y CSV ✅
- Búsqueda global desde el header (solo JEFE) ✅
- Productividad por trabajador en ficha de persona ✅
- Pulido PWA "feel nativa" (no pull-to-refresh, safe areas, status bar integrado, `InstalarPWABanner` con `beforeinstallprompt`) ✅
- Diseño visual del mockup de Claude Design aplicado a toda la app ✅ (heroes verdes con back en detalles, KPIs unificados, badges de estado, cards `rounded-2xl shadow-suave`, eyebrows `text-[10.5px] tracking-[0.18em]`, mascota del aguacate en login/splash/empty states)
- Wizard de "Asignar tarea" en 4 pasos con `Stepper` (lote/apiario → tipo → persona → confirmar) ✅
- Wizard de "Nuevo despacho" en 3 pasos con `Stepper` (persona → items con `FilaCantidad` +/- → confirmar) ✅
- Pantalla de éxito `AsignacionCerradaSuccess` al cerrar la última avance que completa una asignación ✅
- Cerrar despacho con `FilaCondicion` (Buen estado / Usada / Dañada) por herramienta y `FilaConsumo` con `+/-` y barra de % por insumo ✅

### ✅ Fase 6 — Capa financiera (COMPLETADA)
- **Recordatorios** ✅ (tabla `recordatorios`, lista en `/recordatorios`, push automático a las 7am Colombia vía Vercel cron, muestra en dashboard del jefe y del trabajador)
- **Tarifas por tarea** ✅ (`/jefe/tarifas` — catálogo con vigencia temporal, esquema POR_JORNAL/POR_KG/POR_ARBOL/POR_HECTAREA/POR_HORA/OTRO, override opcional por lote)
- **Pagos genéricos** ✅ (`/jefe/pagos` — tabla central de salidas de plata con tipos SALARIO/ADELANTO/JORNAL/SERVICIO/BONO/AJUSTE/OTRO, separador de miles en input)
- **Servicios contratados** ✅ (`/jefe/servicios` — contratos puntuales con estado ACUERDO/EN_CURSO/TERMINADO/CANCELADO, saldo por contrato, pagos parciales conectados con `pagos.servicio_id`, opción de crear contratista nuevo sin cuenta)
- **Jornales** ✅ (`/jefe/jornales` — un registro por persona/día con snapshot de tarifa, autosugerencia desde vinculación, UNIQUE(persona_id, fecha))
- **Ausencias** ✅ (`/jefe/ausencias` — días no trabajados con tipos FALTA/INCAPACIDAD/VACACIONES/LICENCIA/PERMISO y flag `descontable` con default por tipo)
- **Vista de saldos** ✅ (`/jefe/saldos` — calcula devengado – pagado por persona y mes, con navegación mes a mes; detalle por persona con desglose completo de jornales, contratos, ausencias y pagos del mes)
- **Separador de miles** ✅ (util `lib/formatos.ts` aplicado a todos los inputs de plata: pagos, tarifas, salario_base, tarifa_jornal, monto_pactado de servicios, tarifa de jornales)

### ✅ Fase 7 paso 1 — Destajo en saldos (COMPLETADA)
- **Cálculo de destajo extra** ✅ (`lib/saldos.ts` ahora recorre `registros_avance` y `cosechas` en el período, busca la `tarifas_tarea` vigente al momento del evento — preferencia: tarifa específica por lote, luego global — y suma los extras al saldo)
- **Aplicación del `esquema_pago_destajo`** ✅ (NUNCA / ADICIONAL / REEMPLAZA_DIA / SOLO_DESTAJO) tanto para FIJOS como para JORNALEROS. REEMPLAZA_DIA descuenta `salario_diario` (FIJO) o `tarifa_jornal` (JORNALERO) por cada día con destajo.
- **UI de destajo** ✅ — en `/jefe/saldos` cada persona muestra el total de destajo si lo hay; en el detalle se ve cada evento con fecha, concepto, cantidad × tarifa = monto.
- **Selector `esquema_pago_destajo`** ✅ en formularios de equipo (nuevo y editar), tanto en modo "editar vinculación activa" como en "cambiar vinculación".

### ✅ Fase 7 paso 2 — Ventas y clientes (COMPLETADA)
- **Tabla `clientes`** ✅ (entidad reusable: nombre, contacto, teléfono, notas, flag `activo`). RLS jefe + almacén.
- **FK `salidas_cosecha.cliente_id`** ✅ opcional (mantiene `cliente_detalle` texto libre como fallback para retrocompatibilidad).
- **`/jefe/clientes`** ✅ — lista activos/inactivos con stats por cliente (n° ventas, kg, ingresos), CRUD con activar/desactivar para preservar histórico.
- **`/jefe/ventas`** ✅ — dashboard mes a mes con KPIs (ingresos, kg vendidos, ticket promedio, precio promedio/kg, n° clientes distintos), ranking por cliente y lista detallada de ventas del mes.
- **`/almacen/salidas/nueva`** ✅ extendido con segmentado "Ya registrado / Texto libre" para elegir cliente (manteniendo soporte offline vía `enviarSalida`); precio total con separador de miles.
- **Atajos "Ventas" y "Clientes"** ✅ en el dashboard del jefe.

### ✅ Fase 7 paso 3 — Compras y proveedores (COMPLETADA)
- **Tabla `proveedores`** ✅ (nombre, contacto, NIT, teléfono, notas, flag `activo`). RLS jefe + bodega.
- **Tablas `compras` (cabecera) + `compras_items` (detalle)** ✅ con `subtotal` calculado como columna generada `cantidad * costo_unitario`. Total de la cabecera se actualiza vía trigger al insertar/borrar/actualizar items.
- **Trigger automático `ajustar_stock_por_compra_item`** ✅ al insertar item: sube `insumos.stock_actual += cantidad`, refresca `insumos.costo_unitario`, crea `movimientos_insumo` tipo INGRESO. Al borrar: revierte el stock.
- **`/jefe/proveedores`** ✅ — CRUD completo con stats por proveedor (n° compras, total gastado), activar/desactivar.
- **`/jefe/compras`** ✅ — dashboard mensual con KPIs (gastado, items, n° proveedores distintos, ticket promedio), ranking por proveedor y lista con navegación mes a mes.
- **`/jefe/compras/nueva`** ✅ — formulario con segmentado "Ya registrado / Nuevo" para proveedor (auto-crea proveedor al guardar si es nuevo), items dinámicos (agregar/quitar filas) con autosugerencia de costo desde `insumos.costo_unitario`, subtotal por item y total en vivo, separador de miles en cantidades y precios. Server action en transacción.
- **`/jefe/compras/[id]`** ✅ — detalle con listado de items, total, factura, notas. Botón "Borrar compra (revierte stock)" usa el trigger de borrado.
- **Atajos "Compras" y "Proveedores"** ✅ en el dashboard del jefe.

### ✅ Fase 7 paso 4 — Reportes avanzados (COMPLETADA)
- **`/jefe/reportes/avanzados`** ✅ — nueva página accesible desde el principal con 4 secciones:
  - **Resumen financiero del mes** con selector navegable mes a mes: KPIs (ingresos · costos · margen) y desglose línea por línea (ventas, compras de insumos, pagos a personas) con margen calculado y porcentaje.
  - **Cosecha año actual vs año anterior**: bar chart de doble columna por mes (12 barras pareadas), variación porcentual anual con flecha (TrendingUp/Down) y leyenda.
  - **Productividad por lote**: ranking ordenado por kg/hectárea con barras de progreso, kg/árbol como métrica secundaria, total kg y hectáreas como pie.
  - **Cosecha anual (tendencia histórica)**: bar chart por año (todos los años con datos) en toneladas.
- **Link destacado** en `/jefe/reportes` (banner verde claro con icono `BarChart3`) que lleva a los reportes avanzados.

### ✅ Fase 7 paso 5 — APK distribuible (COMPLETADA)
- **Manifest mejorado** ✅ (`public/manifest.webmanifest` ahora incluye `id`, `scope`, `lang`, `dir`, `categories`, `prefer_related_applications: false`, íconos separados por `purpose` (any + maskable), y 4 `shortcuts` para acciones comunes: mis tareas, asignar, registrar cosecha, saldos).
- **Metadata del layout** ✅ refinada (descripción alineada con manifest, `applicationName: "La Zelanda"` consistente, `formatDetection.telephone: false` para que Android no convierta números en links de llamada).
- **Documentación** ✅ — `docs/APK.md` con paso a paso para generar el APK con PWABuilder, distribuir por WhatsApp, gestionar la `signing.keystore` y entender cuándo regenerar.

**Cómo generar el APK** (resumen):
1. Deploy en Vercel.
2. Abrir https://www.pwabuilder.com/, pegar la URL.
3. **Package for Stores → Android → Other Android**.
4. Descargar el ZIP, conservar `signing.keystore` en lugar seguro.
5. Distribuir el `.apk` por WhatsApp.

### Fase 8 — Futuro (no hacer aún)
Sin definir. Cuando se necesite, anotar aquí.

---

## 10. Cómo trabajar con este proyecto

### Para Claude Code:
1. **Lee este archivo entero** antes de cualquier tarea.
2. **Lee `esquema.sql`** para entender la BD.
3. **Pregunta antes de improvisar** decisiones de producto o diseño no documentadas.
4. **Respeta el stack y convenciones** definidos arriba.
5. **Mobile-first siempre**. Si una pantalla no funciona en celular, no está terminada.
6. **No agregues dependencias** sin consultar. Mantener el `package.json` limpio.
7. **No uses emojis** en UI a menos que el usuario los pida explícitamente.
8. **Idioma siempre español** en código y UI.
9. **Commits descriptivos** en español: `feat: agregar pantalla de asignaciones`, `fix: corregir cálculo de stock`.
10. **Al terminar una tarea**, lista qué hiciste y qué falta para cerrar la fase actual.

### Para el dueño del proyecto:
- Cuando arranques con Claude Code, lo primero es decirle: *"Lee CLAUDE.md y esquema.sql, luego seguimos"*.
- Si Claude Code propone algo que se desvía de este doc, decirle: *"Eso no está en CLAUDE.md, ¿deberíamos actualizarlo o seguir el plan?"*.
- Actualiza este archivo cuando tomen decisiones nuevas. Es la fuente de verdad.

---

## 11. Variables de entorno (referencia)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # solo server-side

# Database (Prisma)
DATABASE_URL=                       # connection pooled
DIRECT_URL=                         # connection directa para migrations

# App
NEXT_PUBLIC_APP_NAME=La Zelanda
```

---

## 12. Glosario rápido

- **Lote**: cada una de las 15 zonas de cultivo, nombrada como un municipio del Quindío
- **Plateo (químico)**: limpieza con herbicida del círculo de tierra al pie del árbol
- **Asignación**: instrucción del jefe a un trabajador para hacer X tarea en Y lote
- **Registro de avance**: cuando el trabajador reporta qué hizo (tramo o sueltos)
- **Novedad**: evento puntual sobre un árbol específico (plaga, daño, observación)
- **Despacho**: salida de herramientas/insumos de bodega hacia un trabajador
- **Cosecha**: ingreso de aguacate al almacén
- **Apiario**: zona con colmenas de abejas
- **Pokédex**: nombre cariñoso para la ficha técnica individual de cada árbol

---

**Versión del documento:** 1.1 · Mayo 2026 (Fase 5 cerrada, diseño visual aplicado, wizards y SubirFoto con re-escalado)
**Autor:** Samuel Alzate