# Capa financiera — DRAFT futuro

**Fecha:** 2026-05-11
**Estado:** Borrador para Fase 2. NO implementar todavía. Se refina cuando llegue su turno (después de tener el núcleo `personas + vinculaciones` funcionando y usable en producción).
**Autor:** Claude + Alber

## Por qué este doc es DRAFT

Aplicando el principio "general antes que específico" (ver memoria de feedback):
- Primero implementamos el **núcleo** (personas + vinculaciones, ver el spec hermano `2026-05-11-personas-vinculaciones-design.md`).
- Cuando ese núcleo esté en producción y usable, releemos este DRAFT, resolvemos las preguntas de `docs/decisiones-pendientes.md` que aplican, y redactamos un spec definitivo para implementar la capa financiera.

Este DRAFT recoge el trabajo de brainstorm hecho el 2026-05-11 sobre el modelo financiero para no perder el análisis.

## Resumen del modelo previsto

Cinco tablas + tres enums adicionales:

- `tarifas_tarea` — configuración editable de tarifas por tipo_tarea, con vigencia temporal y override opcional por lote
- `servicios_contratados` — contratos puntuales con contratistas (descripción, monto pactado, fechas, estado)
- `pagos` — registro único de todos los pagos a personas (genérico, con tipo discriminador y referencias opcionales)
- `jornales` — un registro por día trabajado de jornalero, con snapshot de la tarifa
- `ausencias` — días de ausencia justificada o no, con flag `descontable`

Más la lógica de **cálculo de saldo** por tipo de vinculación (FIJO, JORNALERO, CONTRATISTA, FAMILIAR), aplicando el `esquema_pago_destajo` definido en `vinculaciones` (NUNCA / ADICIONAL / REEMPLAZA_DIA / SOLO_DESTAJO).

## SQL tentativo

```sql
CREATE TYPE esquema_pago_actividad AS ENUM (
  'POR_JORNAL', 'POR_KG', 'POR_ARBOL', 'POR_HECTAREA', 'POR_HORA', 'OTRO'
);

CREATE TYPE tipo_pago AS ENUM (
  'SALARIO','ADELANTO','JORNAL','SERVICIO','BONO','AJUSTE','OTRO'
  -- considerar REEMBOLSO (D-003)
);

CREATE TYPE estado_servicio AS ENUM (
  'ACUERDO','EN_CURSO','TERMINADO','CANCELADO'
);

CREATE TYPE tipo_ausencia AS ENUM (
  'FALTA_INJUSTIFICADA','INCAPACIDAD','VACACIONES','LICENCIA','PERMISO'
);

CREATE TABLE tarifas_tarea (
  id                          BIGSERIAL PRIMARY KEY,
  tipo_tarea_id               BIGINT NOT NULL REFERENCES tipos_tarea(id),
  esquema_pago                esquema_pago_actividad NOT NULL,
  monto                       NUMERIC(12,2) NOT NULL,
  unidad                      TEXT,
  vigente_desde               DATE NOT NULL,
  vigente_hasta               DATE,
  lote_id                     BIGINT REFERENCES lotes(id),   -- D-002 pendiente
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE servicios_contratados (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  descripcion                 TEXT NOT NULL,
  lote_id                     BIGINT REFERENCES lotes(id),
  monto_pactado               NUMERIC(12,2) NOT NULL CHECK (monto_pactado > 0),
  fecha_inicio                DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin                   DATE,
  estado                      estado_servicio NOT NULL DEFAULT 'ACUERDO',
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE pagos (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  monto                       NUMERIC(12,2) NOT NULL,
  fecha                       DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo                        tipo_pago NOT NULL,
  servicio_id                 BIGINT REFERENCES servicios_contratados(id),
  cubre_desde                 DATE,
  cubre_hasta                 DATE,
  monto_sugerido              NUMERIC(12,2),
  motivo_diferencia           TEXT,
  metodo_pago                 TEXT,           -- D-001
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((tipo = 'AJUSTE') OR (monto > 0)),
  CHECK ((tipo = 'SERVICIO' AND servicio_id IS NOT NULL) OR (tipo <> 'SERVICIO')),
  CHECK (
    (cubre_desde IS NULL AND cubre_hasta IS NULL)
    OR (cubre_desde IS NOT NULL AND cubre_hasta IS NOT NULL AND cubre_hasta >= cubre_desde)
  )
);

CREATE TABLE jornales (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  fecha                       DATE NOT NULL DEFAULT CURRENT_DATE,
  tarifa_aplicada             NUMERIC(12,2) NOT NULL,
  lote_id                     BIGINT REFERENCES lotes(id),
  descripcion_actividad       TEXT,           -- D-011
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, fecha)
);

CREATE TABLE ausencias (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  fecha                       DATE NOT NULL,
  tipo                        tipo_ausencia NOT NULL,
  descontable                 BOOLEAN NOT NULL DEFAULT TRUE,   -- D-005
  observaciones               TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, fecha)
);
```

## Lógica de cálculo de saldo (resumen)

Dado un periodo `[desde, hasta]`:

**FIJO:**
```
dias_efectivos = días_periodo - días_ausencia(descontable=true)
salario_diario = vinculacion.salario_base / días_estándar(periodo_pago)
pago_sueldo = salario_diario × dias_efectivos
extras_destajo = SUM(cantidad_actividad × tarifa_vigente_en_fecha)

según esquema_pago_destajo:
  NUNCA          → total = pago_sueldo
  ADICIONAL      → total = pago_sueldo + extras_destajo
  REEMPLAZA_DIA  → total = pago_sueldo - salario_diario × días_con_destajo + extras_destajo

saldo = total - SUM(pagos.tipo='ADELANTO' en periodo)
```

**JORNALERO:** suma de jornales + extras destajo según esquema - adelantos.

**CONTRATISTA:** por servicio, `monto_pactado - SUM(pagos del servicio)`.

**FAMILIAR:** no aplica saldo.

## Pantallas previstas

- `/jefe/configuracion` (hub)
- `/jefe/configuracion/tarifas` (CRUD tarifas_tarea con vigencia)
- `/jefe/configuracion/tipos-tarea`
- `/jefe/servicios` (lista + alta)
- `/jefe/servicios/[id]` (detalle + pagos)
- `/jefe/pagos` (tablero de saldos + lista de pagos)
- `/jefe/pagos/nuevo` (alta con sugerencia)
- `/jefe/ausencias`

## Decisiones pendientes que afectan esta capa

Ver `docs/decisiones-pendientes.md`: D-001 a D-011 son específicas de capa financiera.

## Siguiente paso cuando se reabra este DRAFT

1. Releer `docs/decisiones-pendientes.md` y resolver las que aplican.
2. Reescribir como spec definitivo (no DRAFT).
3. Plan de implementación vía `writing-plans` con fases incrementales (configuración → servicios → pagos → jornales → ausencias → cálculo).
