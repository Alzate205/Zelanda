-- Arregla el CHECK de registros_avance para que acepte VISITA.
--
-- El constraint original se escribió cuando tipo_registro solo tenía TRAMO y
-- SUELTOS. La migración de apicultura agregó el valor VISITA al enum pero no
-- tocó el CHECK, así que Postgres rechazaba (23514) todo registro de visita al
-- apiario: el trabajador completaba la visita, la API respondía 500 y el
-- registro se quedaba dando vueltas en la cola offline para siempre.
--
-- VISITA no lleva árboles: ni tramo ni lista. Por eso su rama del CHECK no
-- exige nada más que el tipo.
--
-- Idempotente: se puede correr varias veces.

BEGIN;

ALTER TABLE public.registros_avance
  DROP CONSTRAINT IF EXISTS registros_avance_check;

ALTER TABLE public.registros_avance
  ADD CONSTRAINT registros_avance_check CHECK (
    (
      tipo_registro = 'TRAMO'
      AND arbol_desde IS NOT NULL
      AND arbol_hasta IS NOT NULL
    )
    OR (
      tipo_registro = 'SUELTOS'
      AND arboles_lista IS NOT NULL
      AND array_length(arboles_lista, 1) > 0
    )
    OR tipo_registro = 'VISITA'
  );

COMMIT;
