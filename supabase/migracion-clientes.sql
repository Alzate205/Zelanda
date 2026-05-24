-- ============================================================
-- Fase 7 paso 2 - Ventas: tabla clientes
-- Entidad reusable para los compradores de la cosecha. Conectada
-- opcionalmente con `salidas_cosecha.cliente_id` (la columna
-- `cliente_detalle` se mantiene como fallback de texto libre).
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS clientes (
  id                          BIGSERIAL PRIMARY KEY,
  nombre                      TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  contacto                    TEXT,
  telefono                    TEXT,
  notas                       TEXT,
  activo                      BOOLEAN NOT NULL DEFAULT TRUE,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_select ON clientes;
CREATE POLICY clientes_select ON clientes FOR SELECT
  USING (public.es_jefe() OR public.rol_actual() = 'ALMACEN'::public.rol_usuario);

DROP POLICY IF EXISTS clientes_insert ON clientes;
CREATE POLICY clientes_insert ON clientes FOR INSERT
  WITH CHECK ((public.es_jefe() OR public.rol_actual() = 'ALMACEN'::public.rol_usuario) AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS clientes_update ON clientes;
CREATE POLICY clientes_update ON clientes FOR UPDATE
  USING (public.es_jefe() OR public.rol_actual() = 'ALMACEN'::public.rol_usuario);

DROP POLICY IF EXISTS clientes_delete ON clientes;
CREATE POLICY clientes_delete ON clientes FOR DELETE
  USING (public.es_jefe());

-- FK opcional desde salidas_cosecha
DO $$ BEGIN
  ALTER TABLE salidas_cosecha
    ADD COLUMN cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_salidas_cliente
  ON salidas_cosecha(cliente_id)
  WHERE cliente_id IS NOT NULL;

COMMIT;
