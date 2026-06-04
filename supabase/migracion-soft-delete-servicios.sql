-- Soft-delete para servicios contratados (consistencia con demás módulos financieros)
ALTER TABLE servicios_contratados
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_servicios_borrado_en ON servicios_contratados(borrado_en);
