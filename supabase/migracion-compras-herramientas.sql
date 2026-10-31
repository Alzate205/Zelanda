-- Compras de herramientas (APLICADA en producción el 2026-10-30)
--
-- Hoy una compra solo puede llevar insumos, así que comprar un machete o una
-- escalera no queda registrado y "Saldos" no lo ve. Con esto cada item lleva
-- un insumo O una herramienta; comprar herramientas suma a herramientas.total.
-- Aditiva e idempotente. Después de aplicarla hay que actualizar
-- prisma/schema.prisma (insumo_id opcional + herramienta_id), el formulario de
-- compra y borrarCompra (revertir herramientas.total).

BEGIN;

ALTER TABLE compras_items ALTER COLUMN insumo_id DROP NOT NULL;

ALTER TABLE compras_items
  ADD COLUMN IF NOT EXISTS herramienta_id BIGINT REFERENCES herramientas(id);

CREATE INDEX IF NOT EXISTS idx_compras_items_herramienta ON compras_items(herramienta_id);

ALTER TABLE compras_items DROP CONSTRAINT IF EXISTS chk_compras_items_un_objeto;
ALTER TABLE compras_items ADD CONSTRAINT chk_compras_items_un_objeto
  CHECK ((insumo_id IS NULL) <> (herramienta_id IS NULL));

ALTER TABLE compras_items DROP CONSTRAINT IF EXISTS chk_compras_items_herramienta_entera;
ALTER TABLE compras_items ADD CONSTRAINT chk_compras_items_herramienta_entera
  CHECK (herramienta_id IS NULL OR cantidad = trunc(cantidad));

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
    IF NEW.insumo_id IS NOT NULL THEN
      UPDATE insumos
        SET stock_actual = stock_actual + NEW.cantidad,
            costo_unitario = NEW.costo_unitario
        WHERE id = NEW.insumo_id;
      SELECT registrado_por_usuario_id INTO v_usuario FROM compras WHERE id = NEW.compra_id;
      INSERT INTO movimientos_insumo (insumo_id, tipo, cantidad, usuario_id, notas)
        VALUES (NEW.insumo_id, 'INGRESO'::tipo_movimiento, NEW.cantidad, v_usuario,
                'Compra #' || NEW.compra_id::text);
    ELSE
      UPDATE herramientas SET total = total + NEW.cantidad::int WHERE id = NEW.herramienta_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.insumo_id IS NOT NULL THEN
      UPDATE insumos SET stock_actual = GREATEST(0, stock_actual - OLD.cantidad)
        WHERE id = OLD.insumo_id;
    ELSE
      UPDATE herramientas SET total = GREATEST(0, total - OLD.cantidad::int)
        WHERE id = OLD.herramienta_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMIT;
