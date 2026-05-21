-- Agregar condición de devolución a despacho_items.
-- Reemplaza la idea de "devuelto sí/no" con "en qué estado se devolvió".

ALTER TABLE despacho_items
  ADD COLUMN IF NOT EXISTS condicion_devolucion TEXT NULL;
