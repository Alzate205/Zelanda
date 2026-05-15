-- supabase/migracion-fase3-apicultura.sql

BEGIN;

-- 1. asignaciones acepta lote O apiario (XOR)
ALTER TABLE public.asignaciones
  ALTER COLUMN lote_id DROP NOT NULL;

ALTER TABLE public.asignaciones
  ADD COLUMN IF NOT EXISTS apiario_id BIGINT
  REFERENCES public.apiarios(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_asign_lote_xor_apiario'
  ) THEN
    ALTER TABLE public.asignaciones
      ADD CONSTRAINT chk_asign_lote_xor_apiario
      CHECK (
        (lote_id IS NOT NULL AND apiario_id IS NULL) OR
        (lote_id IS NULL AND apiario_id IS NOT NULL)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_asign_apiario
  ON public.asignaciones(apiario_id);

COMMIT;

-- 2. tipo_registro suma VISITA (debe ir FUERA del BEGIN/COMMIT en Postgres)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'VISITA'
      AND enumtypid = 'public.tipo_registro'::regtype
  ) THEN
    ALTER TYPE public.tipo_registro ADD VALUE 'VISITA';
  END IF;
END
$$;
