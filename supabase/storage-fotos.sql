-- supabase/storage-fotos.sql
-- Bucket privado "fotos" + RLS para usuarios autenticados.

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: autenticados pueden subir al bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'fotos_insert_autenticados'
  ) THEN
    CREATE POLICY "fotos_insert_autenticados"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'fotos');
  END IF;
END
$$;

-- Policy: autenticados pueden leer del bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'fotos_select_autenticados'
  ) THEN
    CREATE POLICY "fotos_select_autenticados"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'fotos');
  END IF;
END
$$;
