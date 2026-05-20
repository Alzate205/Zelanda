-- ============================================================
-- FASE Mapa: tablas instalaciones + finca + seeds + RLS
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

-- Enum tipo_instalacion
DO $$ BEGIN
  CREATE TYPE tipo_instalacion AS ENUM ('CASA','BODEGA','ALMACEN','OTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla instalaciones
CREATE TABLE IF NOT EXISTS instalaciones (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo tipo_instalacion NOT NULL,
  coordenadas GEOGRAPHY(POINT, 4326),
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_instalaciones_coord ON instalaciones USING GIST(coordenadas);

-- Tabla finca (1 sola fila esperada)
CREATE TABLE IF NOT EXISTS finca (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  poligono GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds idempotentes
INSERT INTO finca (nombre) SELECT 'Hacienda La Zelanda'
WHERE NOT EXISTS (SELECT 1 FROM finca);

INSERT INTO instalaciones (nombre, tipo)
SELECT v.nombre, v.tipo::tipo_instalacion FROM (VALUES
  ('Casa principal','CASA'),
  ('Bodega','BODEGA'),
  ('Almacén','ALMACEN')
) v(nombre, tipo)
WHERE NOT EXISTS (SELECT 1 FROM instalaciones WHERE instalaciones.nombre = v.nombre);

-- RLS
ALTER TABLE instalaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instalaciones_select ON instalaciones;
CREATE POLICY instalaciones_select ON instalaciones FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS instalaciones_jefe_write ON instalaciones;
CREATE POLICY instalaciones_jefe_write ON instalaciones FOR ALL
  USING (public.es_jefe()) WITH CHECK (public.es_jefe());

ALTER TABLE finca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finca_select ON finca;
CREATE POLICY finca_select ON finca FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS finca_jefe_write ON finca;
CREATE POLICY finca_jefe_write ON finca FOR ALL
  USING (public.es_jefe()) WITH CHECK (public.es_jefe());

COMMIT;
