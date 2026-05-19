-- ============================================================
-- FASE 5: tabla push_subscriptions para notificaciones push
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_subscriptions(usuario_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_select_propio ON push_subscriptions;
CREATE POLICY push_select_propio ON push_subscriptions FOR SELECT
  USING (usuario_id = auth.uid() OR public.es_jefe());

DROP POLICY IF EXISTS push_insert_propio ON push_subscriptions;
CREATE POLICY push_insert_propio ON push_subscriptions FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS push_delete_propio ON push_subscriptions;
CREATE POLICY push_delete_propio ON push_subscriptions FOR DELETE
  USING (usuario_id = auth.uid() OR public.es_jefe());

COMMIT;
