# Hacienda La Zelanda — Sistema FincApp

> **Para Claude Code:** este archivo es la fuente de verdad del proyecto. Léelo entero antes de empezar cualquier tarea. Si alguna decisión no está aquí, **pregúntale al usuario** antes de improvisar.

---

## 1. Resumen ejecutivo

**FincApp** es un sistema de gestión integral para la **Hacienda La Zelanda**, una finca familiar de **aguacate Hass** en el Quindío, Colombia. Es una **PWA (Progressive Web App)** con capacidad offline, accesible desde celular sin instalación de tienda.

El usuario es **Alber**, estudiante de Ingeniería de Software (6º semestre). Maneja conceptos técnicos. No hay que explicarle qué es una FK, un trigger, un endpoint, etc.

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
| Frontend | **Next.js 14+ (App Router)** + React + TypeScript |
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

La capa financiera (cálculo de saldos, pagos, tarifas configurables, servicios contratados con pagos parciales, jornales, ausencias) está diseñada como **Fase 2 futura** — ver `docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md`.

### 5.7 Alertas
- Tarea vencida
- Tarea próxima a vencer (< 7 días)
- Stock de insumo bajo
- Despacho abierto al final del día
- Novedad crítica reportada

---

## 6. Esquema de base de datos

El SQL base está en **`esquema.sql`**. La migración a `personas` + `vinculaciones` (que reemplaza `trabajadores`) está en **`supabase/migracion-nucleo-personas.sql`**. Las RLS están en **`supabase/policies.sql`**. Estado actual: 18 tablas + 2 vistas (`v_insumos_stock`, `v_stock_almacen`), incluyendo `personas` y `vinculaciones`. La capa financiera (5 tablas adicionales: pagos, tarifas_tarea, servicios_contratados, jornales, ausencias) es **diseño futuro** — ver `docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md`.

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

### 🎯 Fase 1 — Infraestructura base (ACTUAL)
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

### Fase 2 — Mapa y lotes
- Cargar los 15 lotes (sin polígono real al inicio, solo nombres)
- Implementar Leaflet con vista satelital
- Vista de detalle de lote
- Trabajo de campo paralelo: capturar polígonos reales

### Fase 3 — Tareas y asignaciones
- CRUD de tipos de tarea
- Configuración de frecuencias por lote
- Flujo de asignación (jefe → trabajador)
- Registro de avance (3 modos)
- Cálculo de próximas fechas y alertas

### Fase 4 — Bodega y almacén
- Catálogos de herramientas e insumos
- Flujos de despacho y devolución (con reserva/consumo)
- Flujos de recepción y salida de cosecha
- Reportes básicos

### Fase 5 — Apicultura y refinamientos
- Módulo de apiarios
- Tareas de apicultura
- Modo offline completo (PWA + IndexedDB + sync)
- Notificaciones push

### Fase 6 — Futuro (no hacer aún)
Productividad detallada, costos, pagos, clima, compras, ventas, reportes avanzados, códigos QR en placas.

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

### Para Alber:
- Cuando arranques con Claude Code, lo primero es decirle: *"Lee CLAUDE.md y esquema.sql, luego empezamos la Fase 1"*.
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

**Versión del documento:** 1.0 · Mayo 2026
**Autor:** Samuel Alzate