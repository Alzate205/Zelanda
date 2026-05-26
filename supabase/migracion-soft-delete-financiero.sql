-- Soft-delete para registros financieros críticos
-- Evita borrado permanente accidental; permite trazabilidad completa.
-- Las listas filtran borrado_en IS NULL; los saldos también los excluyen.

-- pagos
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_pagos_borrado_en ON pagos(borrado_en);

-- jornales
ALTER TABLE jornales
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_jornales_borrado_en ON jornales(borrado_en);

-- ausencias
ALTER TABLE ausencias
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_ausencias_borrado_en ON ausencias(borrado_en);

-- tarifas_tarea
ALTER TABLE tarifas_tarea
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_tarifas_tarea_borrado_en ON tarifas_tarea(borrado_en);

-- compras
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS borrado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_compras_borrado_en ON compras(borrado_en);
