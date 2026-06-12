-- ============================================================
-- Ficha técnica del químico en insumos (trazabilidad v2).
-- Ver docs/superpowers/specs/2026-06-12-ficha-tecnica-carencia-design.md
-- ============================================================

BEGIN;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS ingrediente_activo TEXT NULL,
  ADD COLUMN IF NOT EXISTS registro_ica TEXT NULL,
  ADD COLUMN IF NOT EXISTS periodo_carencia_dias INTEGER NULL,
  ADD COLUMN IF NOT EXISTS periodo_reingreso_horas INTEGER NULL;

COMMIT;
