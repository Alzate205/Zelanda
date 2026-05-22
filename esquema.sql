-- ============================================================
-- HACIENDA LA ZELANDA · ESQUEMA DE BASE DE DATOS
-- Versión consolidada 2.0 · Mayo 2026
-- Target: Supabase (PostgreSQL 15 + PostGIS)
--
-- Este archivo refleja el estado ACTUAL de la BD tras todas las
-- migraciones acumuladas en carpeta `supabase/`. Es la fuente de
-- verdad para creación desde cero. Para aplicar incrementalmente
-- sobre una BD ya viva, usar los SQL parciales en `supabase/`.
--
-- Diferencias clave vs. v1 original:
--  • Reemplazada tabla `trabajadores` por `personas` + `vinculaciones`
--    (4 tipos de vínculo: FIJO, JORNALERO, CONTRATISTA, FAMILIAR).
--  • `usuarios.persona_id` (antes `trabajador_id`) + `usuarios.username`.
--  • `tipo_registro` enum agrega VISITA (apicultura).
--  • Tabla `cosechas_miel` (módulo apicultura).
--  • Columnas `id_local` UUID en tablas con soporte offline.
--  • `despacho_items.condicion_devolucion` para herramientas dañadas/sucias.
--  • Enum `estado_apiario` (BIEN / CON_PROBLEMAS / CRITICO).
--  • Enum `tipo_instalacion` ampliado: CASA / BODEGA / ALMACEN / OTRO.
--  • Tabla `push_subscriptions` para notificaciones (Fase 5.1).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE rol_usuario          AS ENUM ('JEFE','BODEGA','ALMACEN','TRABAJADOR');
CREATE TYPE tipo_vinculacion     AS ENUM ('FIJO','JORNALERO','CONTRATISTA','FAMILIAR');
CREATE TYPE tipo_periodo_pago    AS ENUM ('MENSUAL','QUINCENAL','SEMANAL');
CREATE TYPE esquema_pago_destajo AS ENUM ('NUNCA','ADICIONAL','REEMPLAZA_DIA','SOLO_DESTAJO');
CREATE TYPE estado_arbol         AS ENUM ('SALUDABLE','CON_NOVEDAD','MUERTO','REMOVIDO');
CREATE TYPE area_tarea           AS ENUM ('CULTIVO','APICULTURA');
CREATE TYPE estado_asignacion    AS ENUM ('PENDIENTE','EN_CURSO','COMPLETADA','CANCELADA');
CREATE TYPE tipo_registro        AS ENUM ('TRAMO','SUELTOS','VISITA');
CREATE TYPE tipo_novedad         AS ENUM ('PLAGA','DANO_FISICO','ENFERMEDAD','OBSERVACION','OTRO');
CREATE TYPE categoria_item       AS ENUM ('CULTIVO','COSECHA','APICULTURA');
CREATE TYPE estado_despacho      AS ENUM ('ABIERTO','CERRADO');
CREATE TYPE tipo_item            AS ENUM ('HERRAMIENTA','INSUMO');
CREATE TYPE metodo_medicion      AS ENUM ('CANASTA','BASCULA');
CREATE TYPE tipo_salida          AS ENUM ('VENTA','CONSUMO','PERDIDA','OTRO');
CREATE TYPE tipo_movimiento      AS ENUM ('RESERVA','CONSUMO','DEVOLUCION','AJUSTE','INGRESO');
CREATE TYPE estado_apiario       AS ENUM ('BIEN','CON_PROBLEMAS','CRITICO');
CREATE TYPE tipo_instalacion     AS ENUM ('CASA','BODEGA','ALMACEN','OTRO');

-- ============================================================
-- IDENTIDAD: personas + vinculaciones + usuarios
-- ============================================================
-- personas: identidad invariante (no tiene autoincrement; se asigna en código).
CREATE TABLE personas (
  id               BIGINT PRIMARY KEY,
  nombre_completo  TEXT NOT NULL,
  cedula           TEXT UNIQUE,
  telefono         TEXT,
  fecha_nacimiento DATE,
  foto_path        TEXT,
  notas            TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- vinculaciones: cada relación de una persona con la finca en el tiempo.
-- Una persona puede tener varias en histórico, solo una activa (fecha_fin IS NULL).
CREATE TABLE vinculaciones (
  id                   BIGSERIAL PRIMARY KEY,
  persona_id           BIGINT NOT NULL REFERENCES personas(id),
  tipo                 tipo_vinculacion NOT NULL,
  rol_finca            TEXT,
  fecha_inicio         DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin            DATE,
  salario_base         NUMERIC(12,2),
  periodo_pago         tipo_periodo_pago,
  tarifa_jornal        NUMERIC(12,2),
  esquema_pago_destajo esquema_pago_destajo,
  notas                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vinculaciones_persona ON vinculaciones(persona_id);

-- usuarios: cuenta de acceso al sistema, opcionalmente ligada a una persona.
CREATE TABLE usuarios (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE,
  nombre_completo TEXT NOT NULL,
  rol             rol_usuario NOT NULL,
  persona_id      BIGINT REFERENCES personas(id),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_usuarios_username ON usuarios(username) WHERE username IS NOT NULL;

-- Suscripciones de notificaciones push (Fase 5.1).
CREATE TABLE push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_usuario ON push_subscriptions(usuario_id);

-- ============================================================
-- GEOGRAFÍA / CULTIVO
-- ============================================================
CREATE TABLE lotes (
  id              BIGSERIAL PRIMARY KEY,
  nombre          TEXT UNIQUE NOT NULL,
  total_arboles   INTEGER NOT NULL DEFAULT 0,
  hectareas       NUMERIC(6,2),
  fecha_siembra   DATE,
  poligono        GEOGRAPHY(POLYGON, 4326),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_lotes_poligono ON lotes USING GIST(poligono);

CREATE TABLE arboles (
  id            BIGSERIAL PRIMARY KEY,
  lote_id       BIGINT NOT NULL REFERENCES lotes(id),
  numero_placa  INTEGER NOT NULL,
  estado        estado_arbol NOT NULL DEFAULT 'SALUDABLE',
  fecha_siembra DATE,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  UNIQUE(lote_id, numero_placa)
);
CREATE INDEX idx_arboles_lote ON arboles(lote_id);

-- ============================================================
-- TAREAS
-- ============================================================
CREATE TABLE tipos_tarea (
  id                       BIGSERIAL PRIMARY KEY,
  nombre                   TEXT UNIQUE NOT NULL,
  descripcion              TEXT,
  frecuencia_dias_default  INTEGER NOT NULL,
  area                     area_tarea NOT NULL,
  color                    TEXT,
  icono                    TEXT,
  activo                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE frecuencias_lote (
  id              BIGSERIAL PRIMARY KEY,
  lote_id         BIGINT NOT NULL REFERENCES lotes(id),
  tipo_tarea_id   BIGINT NOT NULL REFERENCES tipos_tarea(id),
  frecuencia_dias INTEGER NOT NULL,

  UNIQUE(lote_id, tipo_tarea_id)
);

CREATE TABLE asignaciones (
  id                       BIGSERIAL PRIMARY KEY,
  persona_id               BIGINT NOT NULL REFERENCES personas(id),
  lote_id                  BIGINT REFERENCES lotes(id),
  apiario_id               BIGINT, -- FK añadida después de crear apiarios
  tipo_tarea_id            BIGINT NOT NULL REFERENCES tipos_tarea(id),
  fecha_inicio             DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_completada         TIMESTAMPTZ,
  estado                   estado_asignacion NOT NULL DEFAULT 'PENDIENTE',
  ultimo_arbol_trabajado   INTEGER NOT NULL DEFAULT 0,
  arboles_completados      INTEGER NOT NULL DEFAULT 0,
  creado_por_usuario_id    UUID NOT NULL REFERENCES usuarios(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asign_persona_estado ON asignaciones(persona_id, estado);
CREATE INDEX idx_asign_lote_tarea     ON asignaciones(lote_id, tipo_tarea_id);
CREATE INDEX idx_asign_apiario        ON asignaciones(apiario_id);

CREATE TABLE registros_avance (
  id              BIGSERIAL PRIMARY KEY,
  asignacion_id   BIGINT NOT NULL REFERENCES asignaciones(id),
  persona_id      BIGINT NOT NULL REFERENCES personas(id),
  tipo_registro   tipo_registro NOT NULL,
  arbol_desde     INTEGER,
  arbol_hasta     INTEGER,
  arboles_lista   INTEGER[],
  cantidad_arboles INTEGER NOT NULL,
  observaciones   TEXT,
  foto_path       TEXT,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_local        UUID UNIQUE,
  estado_apiario  estado_apiario,

  CHECK (
    (tipo_registro = 'TRAMO'   AND arbol_desde IS NOT NULL AND arbol_hasta IS NOT NULL)
    OR
    (tipo_registro = 'SUELTOS' AND arboles_lista IS NOT NULL AND array_length(arboles_lista,1) > 0)
    OR
    (tipo_registro = 'VISITA'  AND estado_apiario IS NOT NULL)
  )
);
CREATE INDEX idx_registros_asignacion ON registros_avance(asignacion_id);

-- ============================================================
-- NOVEDADES (FK estricta a arboles.id)
-- ============================================================
CREATE TABLE novedades (
  id                BIGSERIAL PRIMARY KEY,
  arbol_id          BIGINT NOT NULL REFERENCES arboles(id),
  persona_id        BIGINT NOT NULL REFERENCES personas(id),
  tipo              tipo_novedad NOT NULL,
  descripcion       TEXT NOT NULL,
  foto_path         TEXT,
  resuelta          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_resolucion  TIMESTAMPTZ,
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_local          UUID UNIQUE
);
CREATE INDEX idx_novedades_arbol ON novedades(arbol_id);
CREATE INDEX idx_novedades_activas ON novedades(arbol_id) WHERE resuelta = FALSE;

-- ============================================================
-- BODEGA
-- ============================================================
CREATE TABLE herramientas (
  id        BIGSERIAL PRIMARY KEY,
  nombre    TEXT UNIQUE NOT NULL,
  categoria categoria_item NOT NULL,
  total     INTEGER NOT NULL DEFAULT 0,
  activo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE insumos (
  id              BIGSERIAL PRIMARY KEY,
  nombre          TEXT UNIQUE NOT NULL,
  categoria       categoria_item NOT NULL,
  unidad          TEXT NOT NULL,
  stock_actual    NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_reservado NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo    NUMERIC(12,3) NOT NULL DEFAULT 0,
  costo_unitario  NUMERIC(12,2),
  activo          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE VIEW v_insumos_stock AS
SELECT
  id,
  nombre,
  categoria,
  unidad,
  stock_actual,
  stock_reservado,
  (stock_actual - stock_reservado) AS stock_disponible,
  stock_minimo,
  (stock_actual - stock_reservado) <= stock_minimo AS por_debajo_minimo,
  costo_unitario,
  activo
FROM insumos;

CREATE TABLE despachos (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  despachado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  estado                      estado_despacho NOT NULL DEFAULT 'ABIERTO',
  fecha                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_devolucion            TIMESTAMPTZ,
  notas                       TEXT,
  asignacion_id               BIGINT REFERENCES asignaciones(id),
  id_local                    UUID UNIQUE
);
CREATE INDEX idx_despachos_persona_estado ON despachos(persona_id, estado);
CREATE INDEX idx_despachos_asignacion     ON despachos(asignacion_id);

CREATE TABLE despacho_items (
  id                   BIGSERIAL PRIMARY KEY,
  despacho_id          BIGINT NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  tipo_item            tipo_item NOT NULL,
  herramienta_id       BIGINT REFERENCES herramientas(id),
  insumo_id            BIGINT REFERENCES insumos(id),
  cantidad             NUMERIC(12,3) NOT NULL,
  cantidad_consumida   NUMERIC(12,3),  -- al cerrar, cuánto se gastó realmente (insumos)
  devuelto             BOOLEAN NOT NULL DEFAULT FALSE,  -- aplica a herramientas
  condicion_devolucion TEXT,  -- texto libre: "dañada", "sucia", etc

  CHECK (
    (tipo_item = 'HERRAMIENTA' AND herramienta_id IS NOT NULL AND insumo_id IS NULL)
    OR
    (tipo_item = 'INSUMO' AND insumo_id IS NOT NULL AND herramienta_id IS NULL)
  )
);

CREATE TABLE movimientos_insumo (
  id               BIGSERIAL PRIMARY KEY,
  insumo_id        BIGINT NOT NULL REFERENCES insumos(id),
  tipo             tipo_movimiento NOT NULL,
  cantidad         NUMERIC(12,3) NOT NULL,
  despacho_item_id BIGINT REFERENCES despacho_items(id),
  usuario_id       UUID REFERENCES usuarios(id),
  notas            TEXT,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mov_insumo ON movimientos_insumo(insumo_id, fecha);

-- ============================================================
-- COSECHA (aguacate)
-- ============================================================
CREATE TABLE cosechas (
  id                       BIGSERIAL PRIMARY KEY,
  persona_id               BIGINT NOT NULL REFERENCES personas(id),
  lote_id                  BIGINT NOT NULL REFERENCES lotes(id),
  recibido_por_usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  metodo_medicion          metodo_medicion NOT NULL,
  cantidad_canastas        INTEGER,
  capacidad_canasta_kg     NUMERIC(6,2),
  peso_kg                  NUMERIC(10,2) NOT NULL,
  fecha                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas                    TEXT,
  id_local                 UUID UNIQUE,

  CHECK (
    (metodo_medicion = 'CANASTA' AND cantidad_canastas IS NOT NULL AND capacidad_canasta_kg IS NOT NULL)
    OR
    (metodo_medicion = 'BASCULA')
  )
);
CREATE INDEX idx_cosechas_fecha      ON cosechas(fecha);
CREATE INDEX idx_cosechas_lote_fecha ON cosechas(lote_id, fecha);

CREATE TABLE salidas_cosecha (
  id                          BIGSERIAL PRIMARY KEY,
  tipo                        tipo_salida NOT NULL,
  cantidad_kg                 NUMERIC(10,2) NOT NULL CHECK (cantidad_kg > 0),
  cliente_detalle             TEXT,
  precio_total                NUMERIC(12,2),
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  fecha                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas                       TEXT,
  id_local                    UUID UNIQUE
);
CREATE INDEX idx_salidas_fecha ON salidas_cosecha(fecha);

CREATE VIEW v_stock_almacen AS
SELECT
  COALESCE((SELECT SUM(peso_kg)     FROM cosechas),        0) -
  COALESCE((SELECT SUM(cantidad_kg) FROM salidas_cosecha), 0)
  AS stock_kg;

-- ============================================================
-- APICULTURA
-- ============================================================
CREATE TABLE apiarios (
  id                      BIGSERIAL PRIMARY KEY,
  nombre                  TEXT NOT NULL,
  ubicacion_descripcion   TEXT,
  coordenadas             GEOGRAPHY(POINT, 4326),
  total_colmenas          INTEGER NOT NULL DEFAULT 0,
  activo                  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_apiarios_coord ON apiarios USING GIST(coordenadas);

-- FK pendiente desde asignaciones (se agrega ahora que existe apiarios).
ALTER TABLE asignaciones
  ADD CONSTRAINT fk_asignaciones_apiario
  FOREIGN KEY (apiario_id) REFERENCES apiarios(id);

CREATE TABLE cosechas_miel (
  id                          BIGSERIAL PRIMARY KEY,
  apiario_id                  BIGINT NOT NULL REFERENCES apiarios(id),
  persona_id                  BIGINT NOT NULL REFERENCES personas(id),
  asignacion_id               BIGINT REFERENCES asignaciones(id),
  kg                          NUMERIC(8,2) NOT NULL,
  fecha                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX ix_cosechas_miel_apiario_fecha ON cosechas_miel(apiario_id, fecha DESC);

-- ============================================================
-- MAPA: instalaciones (puntos) y borde de la finca (polígono)
-- ============================================================
CREATE TABLE instalaciones (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  tipo        tipo_instalacion NOT NULL,
  coordenadas GEOGRAPHY(POINT, 4326),
  notas       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_instalaciones_coord ON instalaciones USING GIST(coordenadas);

CREATE TABLE finca (
  id         BIGSERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  poligono   GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: estado de árbol según novedades activas
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_estado_arbol()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.resuelta = FALSE THEN
      UPDATE arboles SET estado = 'CON_NOVEDAD', updated_at = NOW()
      WHERE id = NEW.arbol_id AND estado = 'SALUDABLE';
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM novedades
        WHERE arbol_id = NEW.arbol_id AND resuelta = FALSE AND id != NEW.id
      ) THEN
        UPDATE arboles SET estado = 'SALUDABLE', updated_at = NOW()
        WHERE id = NEW.arbol_id AND estado = 'CON_NOVEDAD';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_novedad_estado_arbol
AFTER INSERT OR UPDATE OF resuelta ON novedades
FOR EACH ROW EXECUTE FUNCTION actualizar_estado_arbol();

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_personas      BEFORE UPDATE ON personas      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_vinculaciones BEFORE UPDATE ON vinculaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_usuarios      BEFORE UPDATE ON usuarios      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_lotes         BEFORE UPDATE ON lotes         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_arboles       BEFORE UPDATE ON arboles       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_asignaciones  BEFORE UPDATE ON asignaciones  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- NOTAS DE OPERACIÓN
-- ============================================================
-- • Las políticas Row Level Security viven en `supabase/policies.sql`.
-- • Las migraciones incrementales aplicadas sobre BD vivas están en
--   `supabase/migracion-*.sql` con su orden documentado en
--   `supabase/INSTRUCCIONES.md`.
-- • El cliente Prisma se regenera con `npm run db:generate`. Si pulleás
--   cambios de schema desde la BD: `npm run db:pull`.
-- • La capa financiera (5 tablas adicionales: pagos, jornales, ausencias,
--   tarifas_tarea, servicios_contratados) es Fase 2 futura, ver
--   `docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md`.
