-- Performance optimization: Add missing indices for bodega and other critical queries
-- Migration: 2026-05-26
-- Purpose: Speed up frequently-used queries on despacho_items, insumos, and cosechas

-- Index on despacho_items.despacho_id
-- Used when fetching all items for a given despacho
CREATE INDEX IF NOT EXISTS idx_despacho_items_despacho_id
  ON despacho_items(despacho_id);

-- Index on despacho_items.herramienta_id
-- Used when querying available herramientas and their loaned quantities
CREATE INDEX IF NOT EXISTS idx_despacho_items_herramienta_id
  ON despacho_items(herramienta_id_id);

-- Index on despacho_items.insumo_id
-- Used when querying consumed/available insumos
CREATE INDEX IF NOT EXISTS idx_despacho_items_insumo_id
  ON despacho_items(insumo_id_id);

-- Index on insumos.activo
-- insumos are frequently filtered by this flag in bodega snapshot
CREATE INDEX IF NOT EXISTS idx_insumos_activo
  ON insumos(activo);

-- Composite index on cosechas(persona_id, fecha DESC)
-- Used to find recent cosechas by a specific person, useful for reportes
CREATE INDEX IF NOT EXISTS idx_cosechas_persona_fecha
  ON cosechas(persona_id, fecha DESC);
