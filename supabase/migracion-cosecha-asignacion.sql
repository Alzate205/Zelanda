-- Ata cada cosecha de aguacate a la tarea que la produjo.
--
-- Hasta ahora la cosecha guardaba lote, persona y fecha, pero no la asignación.
-- Por eso el jefe podía ver en una tarea qué árboles tocó el trabajador, pero
-- no cuántos kilos salieron: ese dato vivía suelto en el módulo de almacén.
-- La cosecha de miel ya tenía esta referencia; esto empareja las dos.
--
-- La columna es NULLABLE a propósito: las cosechas ya registradas no tienen
-- forma de saber a qué tarea pertenecían, y adivinarlo por fecha y lote
-- mezclaría cosechas de tareas distintas del mismo día. Se quedan sin atar, y
-- eso es más honesto que inventarles un vínculo.

BEGIN;

ALTER TABLE public.cosechas
  ADD COLUMN IF NOT EXISTS asignacion_id BIGINT;

ALTER TABLE public.cosechas
  DROP CONSTRAINT IF EXISTS cosechas_asignacion_id_fkey;

ALTER TABLE public.cosechas
  ADD CONSTRAINT cosechas_asignacion_id_fkey
  FOREIGN KEY (asignacion_id) REFERENCES public.asignaciones(id);

-- Buscar las cosechas de una tarea es justo lo que hace la pantalla del jefe.
CREATE INDEX IF NOT EXISTS idx_cosechas_asignacion
  ON public.cosechas (asignacion_id);

COMMIT;
