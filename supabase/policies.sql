-- ============================================================
-- HACIENDA LA ZELANDA · RLS POLICIES (FASE 1)
-- Ejecutar DESPUÉS de esquema.sql en el SQL Editor de Supabase.
-- Idempotente: se puede correr varias veces sin error.
-- ============================================================

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS public.rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.trabajador_id_actual()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trabajador_id FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.es_jefe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'JEFE'::public.rol_usuario AND activo
  );
$$;

GRANT EXECUTE ON FUNCTION public.rol_actual()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.trabajador_id_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_jefe()              TO authenticated;

-- ============================================================
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE public.trabajadores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arboles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_tarea        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frecuencias_lote   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_avance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herramientas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despacho_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salidas_cosecha    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apiarios           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- usuarios
-- ============================================================

DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
CREATE POLICY usuarios_select ON public.usuarios FOR SELECT
  USING (id = auth.uid() OR public.es_jefe());

DROP POLICY IF EXISTS usuarios_jefe_insert ON public.usuarios;
CREATE POLICY usuarios_jefe_insert ON public.usuarios FOR INSERT
  WITH CHECK (public.es_jefe());

DROP POLICY IF EXISTS usuarios_self_or_jefe_update ON public.usuarios;
CREATE POLICY usuarios_self_or_jefe_update ON public.usuarios FOR UPDATE
  USING (id = auth.uid() OR public.es_jefe())
  WITH CHECK (id = auth.uid() OR public.es_jefe());

DROP POLICY IF EXISTS usuarios_jefe_delete ON public.usuarios;
CREATE POLICY usuarios_jefe_delete ON public.usuarios FOR DELETE
  USING (public.es_jefe());

-- ============================================================
-- trabajadores
-- ============================================================

DROP POLICY IF EXISTS trabajadores_select ON public.trabajadores;
CREATE POLICY trabajadores_select ON public.trabajadores FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS trabajadores_jefe_write ON public.trabajadores;
CREATE POLICY trabajadores_jefe_write ON public.trabajadores FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- lotes, arboles
-- ============================================================

DROP POLICY IF EXISTS lotes_select ON public.lotes;
CREATE POLICY lotes_select ON public.lotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS lotes_jefe_write ON public.lotes;
CREATE POLICY lotes_jefe_write ON public.lotes FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

DROP POLICY IF EXISTS arboles_select ON public.arboles;
CREATE POLICY arboles_select ON public.arboles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS arboles_jefe_write ON public.arboles;
CREATE POLICY arboles_jefe_write ON public.arboles FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- tipos_tarea, frecuencias_lote
-- ============================================================

DROP POLICY IF EXISTS tipos_tarea_select ON public.tipos_tarea;
CREATE POLICY tipos_tarea_select ON public.tipos_tarea FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS tipos_tarea_jefe_write ON public.tipos_tarea;
CREATE POLICY tipos_tarea_jefe_write ON public.tipos_tarea FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

DROP POLICY IF EXISTS frecuencias_lote_select ON public.frecuencias_lote;
CREATE POLICY frecuencias_lote_select ON public.frecuencias_lote FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS frecuencias_lote_jefe_write ON public.frecuencias_lote;
CREATE POLICY frecuencias_lote_jefe_write ON public.frecuencias_lote FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- asignaciones
-- ============================================================

DROP POLICY IF EXISTS asignaciones_select ON public.asignaciones;
CREATE POLICY asignaciones_select ON public.asignaciones FOR SELECT
  USING (
    public.es_jefe()
    OR trabajador_id = public.trabajador_id_actual()
  );

DROP POLICY IF EXISTS asignaciones_jefe_write ON public.asignaciones;
CREATE POLICY asignaciones_jefe_write ON public.asignaciones FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- El trabajador puede actualizar el progreso (último árbol, estado, etc.)
-- pero no puede reasignarse a otro trabajador (el CHECK lo impide).
DROP POLICY IF EXISTS asignaciones_trabajador_update ON public.asignaciones;
CREATE POLICY asignaciones_trabajador_update ON public.asignaciones FOR UPDATE
  USING (trabajador_id = public.trabajador_id_actual())
  WITH CHECK (trabajador_id = public.trabajador_id_actual());

-- ============================================================
-- registros_avance
-- ============================================================

DROP POLICY IF EXISTS registros_avance_select ON public.registros_avance;
CREATE POLICY registros_avance_select ON public.registros_avance FOR SELECT
  USING (
    public.es_jefe()
    OR trabajador_id = public.trabajador_id_actual()
  );

DROP POLICY IF EXISTS registros_avance_trabajador_insert ON public.registros_avance;
CREATE POLICY registros_avance_trabajador_insert ON public.registros_avance FOR INSERT
  WITH CHECK (trabajador_id = public.trabajador_id_actual());

DROP POLICY IF EXISTS registros_avance_jefe_all ON public.registros_avance;
CREATE POLICY registros_avance_jefe_all ON public.registros_avance FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- novedades
-- ============================================================

DROP POLICY IF EXISTS novedades_select ON public.novedades;
CREATE POLICY novedades_select ON public.novedades FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS novedades_trabajador_insert ON public.novedades;
CREATE POLICY novedades_trabajador_insert ON public.novedades FOR INSERT
  WITH CHECK (trabajador_id = public.trabajador_id_actual());

DROP POLICY IF EXISTS novedades_jefe_write ON public.novedades;
CREATE POLICY novedades_jefe_write ON public.novedades FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- herramientas, insumos
-- ============================================================

DROP POLICY IF EXISTS herramientas_select ON public.herramientas;
CREATE POLICY herramientas_select ON public.herramientas FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS herramientas_bodega_write ON public.herramientas;
CREATE POLICY herramientas_bodega_write ON public.herramientas FOR ALL
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('BODEGA','JEFE'));

DROP POLICY IF EXISTS insumos_select ON public.insumos;
CREATE POLICY insumos_select ON public.insumos FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS insumos_bodega_write ON public.insumos;
CREATE POLICY insumos_bodega_write ON public.insumos FOR ALL
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('BODEGA','JEFE'));

-- ============================================================
-- despachos, despacho_items, movimientos_insumo
-- ============================================================

DROP POLICY IF EXISTS despachos_select ON public.despachos;
CREATE POLICY despachos_select ON public.despachos FOR SELECT
  USING (
    public.es_jefe()
    OR public.rol_actual()::text = 'BODEGA'
    OR trabajador_id = public.trabajador_id_actual()
  );

DROP POLICY IF EXISTS despachos_bodega_write ON public.despachos;
CREATE POLICY despachos_bodega_write ON public.despachos FOR ALL
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('BODEGA','JEFE'));

DROP POLICY IF EXISTS despacho_items_select ON public.despacho_items;
CREATE POLICY despacho_items_select ON public.despacho_items FOR SELECT
  USING (
    public.es_jefe()
    OR public.rol_actual()::text = 'BODEGA'
    OR EXISTS (
      SELECT 1 FROM public.despachos d
      WHERE d.id = despacho_items.despacho_id
        AND d.trabajador_id = public.trabajador_id_actual()
    )
  );

DROP POLICY IF EXISTS despacho_items_bodega_write ON public.despacho_items;
CREATE POLICY despacho_items_bodega_write ON public.despacho_items FOR ALL
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('BODEGA','JEFE'));

DROP POLICY IF EXISTS movimientos_insumo_select ON public.movimientos_insumo;
CREATE POLICY movimientos_insumo_select ON public.movimientos_insumo FOR SELECT
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'));

DROP POLICY IF EXISTS movimientos_insumo_bodega_write ON public.movimientos_insumo;
CREATE POLICY movimientos_insumo_bodega_write ON public.movimientos_insumo FOR ALL
  USING (public.rol_actual()::text IN ('BODEGA','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('BODEGA','JEFE'));

-- ============================================================
-- cosechas, salidas_cosecha
-- ============================================================

DROP POLICY IF EXISTS cosechas_select ON public.cosechas;
CREATE POLICY cosechas_select ON public.cosechas FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS cosechas_almacen_write ON public.cosechas;
CREATE POLICY cosechas_almacen_write ON public.cosechas FOR ALL
  USING (public.rol_actual()::text IN ('ALMACEN','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('ALMACEN','JEFE'));

DROP POLICY IF EXISTS salidas_cosecha_select ON public.salidas_cosecha;
CREATE POLICY salidas_cosecha_select ON public.salidas_cosecha FOR SELECT
  USING (public.rol_actual()::text IN ('ALMACEN','JEFE'));

DROP POLICY IF EXISTS salidas_cosecha_almacen_write ON public.salidas_cosecha;
CREATE POLICY salidas_cosecha_almacen_write ON public.salidas_cosecha FOR ALL
  USING (public.rol_actual()::text IN ('ALMACEN','JEFE'))
  WITH CHECK (public.rol_actual()::text IN ('ALMACEN','JEFE'));

-- ============================================================
-- apiarios
-- ============================================================

DROP POLICY IF EXISTS apiarios_select ON public.apiarios;
CREATE POLICY apiarios_select ON public.apiarios FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS apiarios_jefe_write ON public.apiarios;
CREATE POLICY apiarios_jefe_write ON public.apiarios FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());
