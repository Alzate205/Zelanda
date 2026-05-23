-- Agregar notas al resolver una novedad.
-- El jefe deja constancia de qué se hizo para resolverla.

ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS notas_resolucion TEXT NULL;
