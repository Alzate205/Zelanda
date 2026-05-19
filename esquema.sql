-- ============================================================
-- HACIENDA LA ZELANDA · ESQUEMA DE BASE DE DATOS
-- Versión 1.0 · Mayo 2026
-- Target: Supabase (PostgreSQL 15 + PostGIS)
-- ============================================================

-- Habilitar PostGIS para datos geográficos
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE rol_usuario       AS ENUM ('JEFE','BODEGA','ALMACEN','TRABAJADOR');
CREATE TYPE estado_arbol      AS ENUM ('SALUDABLE','CON_NOVEDAD','MUERTO','REMOVIDO');
CREATE TYPE area_tarea        AS ENUM ('CULTIVO','APICULTURA');
CREATE TYPE estado_asignacion AS ENUM ('PENDIENTE','EN_CURSO','COMPLETADA','CANCELADA');
CREATE TYPE tipo_registro     AS ENUM ('TRAMO','SUELTOS');
CREATE TYPE tipo_novedad      AS ENUM ('PLAGA','DANO_FISICO','ENFERMEDAD','OBSERVACION','OTRO');
CREATE TYPE categoria_item    AS ENUM ('CULTIVO','COSECHA','APICULTURA');
CREATE TYPE estado_despacho   AS ENUM ('ABIERTO','CERRADO');
CREATE TYPE tipo_item         AS ENUM ('HERRAMIENTA','INSUMO');
CREATE TYPE metodo_medicion   AS ENUM ('CANASTA','BASCULA');
CREATE TYPE tipo_salida       AS ENUM ('VENTA','CONSUMO','PERDIDA','OTRO');
CREATE TYPE tipo_movimiento   AS ENUM ('RESERVA','CONSUMO','DEVOLUCION','AJUSTE','INGRESO');

-- ============================================================
-- IDENTIDAD
-- ============================================================
CREATE TABLE trabajadores (
  id              BIGSERIAL PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  cedula          TEXT UNIQUE,
  telefono        TEXT,
  rol_finca       TEXT NOT NULL,
  es_apicultor    BOOLEAN NOT NULL DEFAULT FALSE,
  salario_base    NUMERIC(12,2),
  fecha_ingreso   DATE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE usuarios (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol             rol_usuario NOT NULL,
  trabajador_id   BIGINT REFERENCES trabajadores(id),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suscripciones push (Fase 5)
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
  trabajador_id            BIGINT NOT NULL REFERENCES trabajadores(id),
  lote_id                  BIGINT NOT NULL REFERENCES lotes(id),
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

CREATE INDEX idx_asign_trabajador_estado ON asignaciones(trabajador_id, estado);
CREATE INDEX idx_asign_lote_tarea        ON asignaciones(lote_id, tipo_tarea_id);

CREATE TABLE registros_avance (
  id              BIGSERIAL PRIMARY KEY,
  asignacion_id   BIGINT NOT NULL REFERENCES asignaciones(id),
  trabajador_id   BIGINT NOT NULL REFERENCES trabajadores(id),
  tipo_registro   tipo_registro NOT NULL,
  arbol_desde     INTEGER,
  arbol_hasta     INTEGER,
  arboles_lista   INTEGER[],
  cantidad_arboles INTEGER NOT NULL,
  observaciones   TEXT,
  foto_path       TEXT,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (tipo_registro = 'TRAMO'   AND arbol_desde IS NOT NULL AND arbol_hasta IS NOT NULL)
    OR
    (tipo_registro = 'SUELTOS' AND arboles_lista IS NOT NULL AND array_length(arboles_lista,1) > 0)
  )
);

CREATE INDEX idx_registros_asignacion ON registros_avance(asignacion_id);

-- ============================================================
-- NOVEDADES (FK estricta a arboles.id)
-- ============================================================
CREATE TABLE novedades (
  id                BIGSERIAL PRIMARY KEY,
  arbol_id          BIGINT NOT NULL REFERENCES arboles(id),
  trabajador_id     BIGINT NOT NULL REFERENCES trabajadores(id),
  tipo              tipo_novedad NOT NULL,
  descripcion       TEXT NOT NULL,
  foto_path         TEXT,
  resuelta          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_resolucion  TIMESTAMPTZ,
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Vista para stock disponible (lo que se puede despachar)
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
  trabajador_id               BIGINT NOT NULL REFERENCES trabajadores(id),
  despachado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  estado                      estado_despacho NOT NULL DEFAULT 'ABIERTO',
  fecha                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_devolucion            TIMESTAMPTZ,
  notas                       TEXT,
  asignacion_id               BIGINT REFERENCES asignaciones(id)
);

CREATE INDEX idx_despachos_trabajador_estado ON despachos(trabajador_id, estado);
CREATE INDEX idx_despachos_asignacion ON despachos(asignacion_id);

CREATE TABLE despacho_items (
  id              BIGSERIAL PRIMARY KEY,
  despacho_id     BIGINT NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  tipo_item       tipo_item NOT NULL,
  herramienta_id  BIGINT REFERENCES herramientas(id),
  insumo_id       BIGINT REFERENCES insumos(id),
  cantidad        NUMERIC(12,3) NOT NULL,
  cantidad_consumida NUMERIC(12,3),  -- al cerrar, cuánto se gastó realmente (insumos)
  devuelto        BOOLEAN NOT NULL DEFAULT FALSE,  -- aplica a herramientas

  CHECK (
    (tipo_item = 'HERRAMIENTA' AND herramienta_id IS NOT NULL AND insumo_id IS NULL)
    OR
    (tipo_item = 'INSUMO' AND insumo_id IS NOT NULL AND herramienta_id IS NULL)
  )
);

-- Log de movimientos de insumo (reserva, consumo, devolución, ajuste, ingreso)
CREATE TABLE movimientos_insumo (
  id               BIGSERIAL PRIMARY KEY,
  insumo_id        BIGINT NOT NULL REFERENCES insumos(id),
  tipo             tipo_movimiento NOT NULL,
  cantidad         NUMERIC(12,3) NOT NULL,  -- positiva: ingreso/devolucion. negativa: consumo/reserva
  despacho_item_id BIGINT REFERENCES despacho_items(id),
  usuario_id       UUID REFERENCES usuarios(id),
  notas            TEXT,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mov_insumo ON movimientos_insumo(insumo_id, fecha);

-- ============================================================
-- COSECHA
-- ============================================================
CREATE TABLE cosechas (
  id                       BIGSERIAL PRIMARY KEY,
  trabajador_id            BIGINT NOT NULL REFERENCES trabajadores(id),
  lote_id                  BIGINT NOT NULL REFERENCES lotes(id),
  recibido_por_usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  metodo_medicion          metodo_medicion NOT NULL,
  cantidad_canastas        INTEGER,
  capacidad_canasta_kg     NUMERIC(6,2),
  peso_kg                  NUMERIC(10,2) NOT NULL,
  fecha                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas                    TEXT,

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
  notas                       TEXT
);

CREATE INDEX idx_salidas_fecha ON salidas_cosecha(fecha);

-- Vista del stock actual del almacén
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

-- ============================================================
-- TRIGGER: estado de árbol según novedades activas
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_estado_arbol()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Si hay novedad sin resolver, el árbol está CON_NOVEDAD
    IF NEW.resuelta = FALSE THEN
      UPDATE arboles SET estado = 'CON_NOVEDAD', updated_at = NOW()
      WHERE id = NEW.arbol_id AND estado = 'SALUDABLE';
    ELSE
      -- Si se resolvió y no quedan más activas, volver a SALUDABLE
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

-- Aplicar a tablas con updated_at
CREATE TRIGGER trg_upd_trabajadores  BEFORE UPDATE ON trabajadores  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_usuarios      BEFORE UPDATE ON usuarios      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_lotes         BEFORE UPDATE ON lotes         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_arboles       BEFORE UPDATE ON arboles       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_asignaciones  BEFORE UPDATE ON asignaciones  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
