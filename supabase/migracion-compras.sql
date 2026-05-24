-- ============================================================
-- Fase 7 paso 3 - Compras y proveedores
-- Modela entradas de insumos: proveedor + cabecera (compra) +
-- items por insumo. Al insertar items, automaticamente se crea
-- un movimiento_insumo de tipo INGRESO y se sube stock_actual del
-- insumo (via trigger en compras_items).
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

-- 1) Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id                          BIGSERIAL PRIMARY KEY,
  nombre                      TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  contacto                    TEXT,
  telefono                    TEXT,
  nit                         TEXT,
  notas                       TEXT,
  activo                      BOOLEAN NOT NULL DEFAULT TRUE,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);

DROP TRIGGER IF EXISTS trg_proveedores_updated_at ON proveedores;
CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedores_select ON proveedores;
CREATE POLICY proveedores_select ON proveedores FOR SELECT
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS proveedores_insert ON proveedores;
CREATE POLICY proveedores_insert ON proveedores FOR INSERT
  WITH CHECK ((public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario) AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS proveedores_update ON proveedores;
CREATE POLICY proveedores_update ON proveedores FOR UPDATE
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS proveedores_delete ON proveedores;
CREATE POLICY proveedores_delete ON proveedores FOR DELETE
  USING (public.es_jefe());

-- 2) Compras (header)
CREATE TABLE IF NOT EXISTS compras (
  id                          BIGSERIAL PRIMARY KEY,
  proveedor_id                BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
  proveedor_detalle           TEXT,
  fecha                       DATE NOT NULL DEFAULT CURRENT_DATE,
  total                       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  numero_factura              TEXT,
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (proveedor_id IS NOT NULL OR (proveedor_detalle IS NOT NULL AND length(trim(proveedor_detalle)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id) WHERE proveedor_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_compras_updated_at ON compras;
CREATE TRIGGER trg_compras_updated_at
  BEFORE UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compras_select ON compras;
CREATE POLICY compras_select ON compras FOR SELECT
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS compras_insert ON compras;
CREATE POLICY compras_insert ON compras FOR INSERT
  WITH CHECK ((public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario) AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS compras_update ON compras;
CREATE POLICY compras_update ON compras FOR UPDATE
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS compras_delete ON compras;
CREATE POLICY compras_delete ON compras FOR DELETE
  USING (public.es_jefe());

-- 3) Compras items (detalle)
CREATE TABLE IF NOT EXISTS compras_items (
  id                          BIGSERIAL PRIMARY KEY,
  compra_id                   BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  insumo_id                   BIGINT NOT NULL REFERENCES insumos(id) ON DELETE NO ACTION,
  cantidad                    NUMERIC(12, 3) NOT NULL CHECK (cantidad > 0),
  costo_unitario              NUMERIC(12, 2) NOT NULL CHECK (costo_unitario >= 0),
  subtotal                    NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  notas                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_items_compra ON compras_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_items_insumo ON compras_items(insumo_id);

ALTER TABLE compras_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compras_items_select ON compras_items;
CREATE POLICY compras_items_select ON compras_items FOR SELECT
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS compras_items_insert ON compras_items;
CREATE POLICY compras_items_insert ON compras_items FOR INSERT
  WITH CHECK (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS compras_items_update ON compras_items;
CREATE POLICY compras_items_update ON compras_items FOR UPDATE
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

DROP POLICY IF EXISTS compras_items_delete ON compras_items;
CREATE POLICY compras_items_delete ON compras_items FOR DELETE
  USING (public.es_jefe() OR public.rol_actual() = 'BODEGA'::public.rol_usuario);

-- 4) Trigger: al insertar/borrar items, ajustar stock y crear movimiento INGRESO
CREATE OR REPLACE FUNCTION ajustar_stock_por_compra_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE insumos
      SET stock_actual = stock_actual + NEW.cantidad,
          costo_unitario = NEW.costo_unitario
      WHERE id = NEW.insumo_id;

    SELECT registrado_por_usuario_id INTO v_usuario FROM compras WHERE id = NEW.compra_id;

    INSERT INTO movimientos_insumo (insumo_id, tipo, cantidad, usuario_id, notas)
      VALUES (NEW.insumo_id, 'INGRESO'::tipo_movimiento, NEW.cantidad, v_usuario,
              'Compra #' || NEW.compra_id::text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE insumos
      SET stock_actual = GREATEST(0, stock_actual - OLD.cantidad)
      WHERE id = OLD.insumo_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_items_stock ON compras_items;
CREATE TRIGGER trg_compras_items_stock
  AFTER INSERT OR DELETE ON compras_items
  FOR EACH ROW
  EXECUTE FUNCTION ajustar_stock_por_compra_item();

-- 5) Trigger: al insertar/borrar items, recalcular total de la compra
CREATE OR REPLACE FUNCTION recalcular_total_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra_id BIGINT;
BEGIN
  v_compra_id := COALESCE(NEW.compra_id, OLD.compra_id);
  UPDATE compras
    SET total = COALESCE((SELECT SUM(subtotal) FROM compras_items WHERE compra_id = v_compra_id), 0)
    WHERE id = v_compra_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_items_total ON compras_items;
CREATE TRIGGER trg_compras_items_total
  AFTER INSERT OR DELETE OR UPDATE ON compras_items
  FOR EACH ROW
  EXECUTE FUNCTION recalcular_total_compra();

COMMIT;
