# Productividad por trabajador en la ficha de persona

**Fecha:** 2026-05-22
**Autor:** Samuel Alzate (con Claude)
**Estado:** Diseño aprobado, pendiente plan de implementación.

## Contexto y motivación

La ficha de persona (`/jefe/equipo/[id]`) muestra datos personales, vinculación activa, histórico y acceso al sistema, pero **no muestra actividad operativa**. El jefe no puede ver desde la UI cuánto recolectó la persona, cuántos árboles atendió, ni cuántas tareas completó.

El reporte global de la finca (`/jefe/reportes`) tiene un top 10 de recolectores a nivel finca, pero por persona no hay nada. El objetivo es agregar una sección "Productividad" en la ficha individual con métricas por trabajador en los últimos 30 días y acumulado lifetime.

## Alcance

### Dentro

- Sección "Productividad" en `/jefe/equipo/[id]`, posicionada después de "Vinculación activa" y antes de "Histórico de vinculaciones".
- 4 métricas con valor de **últimos 30 días** + **acumulado lifetime**: cosecha (kg), árboles atendidos, novedades reportadas, tareas completadas.
- Mensaje placeholder cuando la persona no tiene actividad registrada.

### Fuera (explícito)

- Gráficos temporales (cosecha/árboles por mes). YAGNI.
- Comparativa con otros trabajadores. El reporte global ya tiene top 10.
- Ausencias / jornales / días trabajados. No hay schema (capa financiera Fase 2).
- Eficiencia (kg/día, árboles/día). YAGNI hasta que se pida.
- Selector de período personalizado. Los 30 días + lifetime cubren.
- Sección en ficha del propio trabajador (`/mi-perfil`). YAGNI: el jefe es quien necesita métricas para gestionar.
- Migración SQL ni índices nuevos. Volúmenes actuales soportan la carga.

## Decisiones de diseño

### Qué cuenta como "árbol atendido"

`registros_avance.tipo_registro` es un enum con valores: `TRAMO`, `SUELTOS`, `NOVEDAD`. Cada registro tiene `cantidad_arboles` precalculado.

- **TRAMO** y **SUELTOS** son acciones de tarea ejecutada sobre árboles (podar, fertilizar, etc.). Cuentan como "árboles atendidos".
- **NOVEDAD** es un reporte puntual sobre un árbol específico (plaga, daño, observación). NO se cuenta como atendido — se contabiliza aparte como "novedad reportada".

Esto evita inflar el contador de "árboles atendidos" con observaciones, que son trabajo distinto.

### Qué cuenta como "tarea completada"

`asignaciones.estado = 'COMPLETADA'` con `fecha_completada` no nula. Para el filtro de últimos 30 días, se compara `fecha_completada >= NOW() - INTERVAL '30 days'`. Para el lifetime, es `COUNT(*) WHERE estado = 'COMPLETADA'`.

(Las asignaciones CANCELADAS no cuentan. PENDIENTES y EN_PROGRESO tampoco.)

### Periodo

- **Últimos 30 días:** desde `NOW() - INTERVAL '30 days'` hasta ahora.
- **Acumulado:** lifetime, sin filtro de fecha.

No hay selector de período personalizado. Si el jefe necesita ver "último año" o "último mes específico", el reporte global tiene 12 meses por mes; la ficha individual queda con esos dos números.

### Layout

Grid `sm:grid-cols-2 lg:grid-cols-4` con 4 tiles. Cada tile:
- Header con ícono Lucide + nombre de la métrica
- Valor grande: `últimos 30 días`
- Texto chico debajo: `XXX total` (acumulado)

Ejemplo visual de un tile:
```
[icono] Cosecha
125.50 kg
3,450.00 kg total
```

### Mensaje sin actividad

Si los 4 acumulados son 0 (persona sin actividad alguna — familia, contratista que nunca registró nada, etc.), no se renderizan los tiles. En su lugar:

> "Sin actividad operativa registrada para esta persona."

Esto evita pantalla con cuatro ceros que se ve raro.

## Componentes y archivos

```
app/(app)/jefe/equipo/[id]/page.tsx           [MODIFICAR]
├── Agregar queries de productividad al Promise.all (o nuevo bloque)
└── Renderizar nueva sección "Productividad" entre "Vinculación activa" e "Histórico"
```

Un solo archivo. Las queries usan `$queryRaw` cuando son agregaciones SQL que Prisma no expresa limpio, y `prisma.X.aggregate/count` cuando sí.

### Queries detalladas

```sql
-- Cosecha 30d
SELECT COALESCE(SUM(peso_kg), 0)::text AS kg
FROM cosechas
WHERE persona_id = $id
  AND fecha >= NOW() - INTERVAL '30 days'

-- Cosecha lifetime
SELECT COALESCE(SUM(peso_kg), 0)::text AS kg, COUNT(*)::int AS n
FROM cosechas
WHERE persona_id = $id

-- Árboles atendidos 30d
SELECT COALESCE(SUM(cantidad_arboles), 0)::int AS arboles
FROM registros_avance
WHERE persona_id = $id
  AND tipo_registro IN ('TRAMO', 'SUELTOS')
  AND fecha_registro >= NOW() - INTERVAL '30 days'

-- Árboles atendidos lifetime
SELECT COALESCE(SUM(cantidad_arboles), 0)::int AS arboles
FROM registros_avance
WHERE persona_id = $id
  AND tipo_registro IN ('TRAMO', 'SUELTOS')

-- Novedades 30d
SELECT COUNT(*)::int AS n
FROM registros_avance
WHERE persona_id = $id
  AND tipo_registro = 'NOVEDAD'
  AND fecha_registro >= NOW() - INTERVAL '30 days'

-- Novedades lifetime
SELECT COUNT(*)::int AS n
FROM registros_avance
WHERE persona_id = $id
  AND tipo_registro = 'NOVEDAD'

-- Tareas completadas 30d
SELECT COUNT(*)::int AS n
FROM asignaciones
WHERE persona_id = $id
  AND estado = 'COMPLETADA'
  AND fecha_completada >= NOW() - INTERVAL '30 days'

-- Tareas completadas lifetime
SELECT COUNT(*)::int AS n
FROM asignaciones
WHERE persona_id = $id
  AND estado = 'COMPLETADA'
```

8 queries en total, ejecutadas en `Promise.all`. Para Prisma vamos a usar `aggregate` y `count` cuando se pueda (más limpio) y `$queryRaw` solo si hace falta — en este caso la mayoría se expresa con Prisma client nativo:

```ts
// Cosecha
prisma.cosechas.aggregate({
  where: { persona_id, fecha: { gte: new Date(Date.now() - 30*24*60*60*1000) } },
  _sum: { peso_kg: true },
})
prisma.cosechas.aggregate({
  where: { persona_id },
  _sum: { peso_kg: true },
})

// Árboles atendidos
prisma.registros_avance.aggregate({
  where: {
    persona_id,
    tipo_registro: { in: ['TRAMO', 'SUELTOS'] },
    fecha_registro: { gte: hace30dias },
  },
  _sum: { cantidad_arboles: true },
})
// ... idem sin filtro de fecha

// Novedades
prisma.registros_avance.count({
  where: {
    persona_id,
    tipo_registro: 'NOVEDAD',
    fecha_registro: { gte: hace30dias },
  },
})
// ... idem sin filtro

// Tareas completadas
prisma.asignaciones.count({
  where: {
    persona_id,
    estado: 'COMPLETADA',
    fecha_completada: { gte: hace30dias },
  },
})
prisma.asignaciones.count({
  where: { persona_id, estado: 'COMPLETADA' },
})
```

8 queries via Prisma client. Limpio, sin SQL crudo.

## Flujos paso a paso

### Flujo 1: Ver productividad de una persona activa

1. Jefe entra a `/jefe/equipo` → click en una persona (ej. Diego Toro).
2. `/jefe/equipo/[id]` se carga. El server component ejecuta `findUnique` + las 8 queries de productividad en paralelo.
3. Renderiza: header + datos personales + vinculación activa + **productividad (4 tiles con valores)** + histórico + acceso.
4. Cada tile muestra: ícono + nombre + valor 30d + "X total".

### Flujo 2: Persona sin actividad (ej. propietario familia)

1. Jefe entra a la ficha de un familiar que nunca registró nada.
2. Las 8 queries devuelven 0 / null.
3. Como los 4 acumulados son 0, en lugar de los tiles se muestra:
   > "Sin actividad operativa registrada para esta persona."

## Manejo de errores

- `aggregate` con `_sum` cuando no hay rows devuelve `{ _sum: { peso_kg: null } }`. Se castea a `Number(_sum.peso_kg ?? 0)`.
- `count` siempre devuelve número, mínimo 0.
- Si la persona no existe → `notFound()` (comportamiento actual, no se cambia).
- Sesión no JEFE → `requerirUsuario("JEFE")` (comportamiento actual).

## Pruebas y verificación

Sin tests automatizados. Verificación manual:

**Checklist:**
1. Login JEFE → `/jefe/equipo/[id]` para una persona con cosechas y tareas completadas.
2. Ver sección "Productividad" entre "Vinculación activa" y "Histórico".
3. Los 4 tiles muestran números coherentes con consultas SQL manuales en Supabase.
4. Para una persona sin actividad (ej. familia), ver mensaje "Sin actividad operativa registrada...".
5. Verificar que el cálculo de "árboles atendidos" excluye registros tipo NOVEDAD.
6. Verificar que "tareas completadas" cuenta solo `estado = COMPLETADA` (no PENDIENTE/EN_PROGRESO/CANCELADA).
7. Verificar que el filtro de 30 días es correcto (un registro de hace 35 días no aparece en 30d, pero sí en acumulado).
8. Build pasa: `npm run build` compila sin errores TS.

## Notas operacionales

- Sin migración SQL.
- Sin cambios en `schema.prisma`.
- Despliegue: PR/merge a `main` + auto-deploy.
- Performance esperada: las 8 queries en paralelo con índices existentes (`idx_registros_asignacion` no aplica directamente, pero filtrar por `persona_id` es full-scan de tabla chica). Para los volúmenes actuales (decenas de personas, miles de registros) está OK. Si crece a cientos de miles de registros, agregar `CREATE INDEX ix_registros_persona ON registros_avance(persona_id)` y similares en `cosechas` y `asignaciones`.
