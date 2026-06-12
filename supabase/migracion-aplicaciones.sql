-- ============================================================
-- Trazabilidad de aplicaciones: lote del despacho + costo congelado
-- al cierre. Ver docs/superpowers/specs/2026-06-12-aplicaciones-insumos-lote-design.md
-- ============================================================

ALTER TABLE despachos
  ADD COLUMN IF NOT EXISTS lote_id BIGINT REFERENCES lotes(id);

ALTER TABLE despacho_items
  ADD COLUMN IF NOT EXISTS costo_unitario_snapshot NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_despachos_lote ON despachos(lote_id);

-- Backfill: despachos históricos vinculados a una asignación de lote
-- heredan su lote. Recupera trazabilidad pasada sin trabajo manual.
UPDATE despachos d
SET lote_id = a.lote_id
FROM asignaciones a
WHERE d.asignacion_id = a.id
  AND d.lote_id IS NULL
  AND a.lote_id IS NOT NULL;
