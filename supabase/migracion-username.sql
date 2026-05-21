-- Agregar username opcional a usuarios para permitir login sin email completo.
-- Si está NULL, el usuario solo puede entrar con su email.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS username TEXT NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_usuarios_username
  ON usuarios(username) WHERE username IS NOT NULL;
