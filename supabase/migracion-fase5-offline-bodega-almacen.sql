-- Sub-fase 5.2b: idempotencia para sync offline de bodega y almacén.

ALTER TABLE despachos ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE cosechas ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE salidas_cosecha ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_despachos_id_local
  ON despachos(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cosechas_id_local
  ON cosechas(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_salidas_cosecha_id_local
  ON salidas_cosecha(id_local) WHERE id_local IS NOT NULL;