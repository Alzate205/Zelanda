-- Rol de solo lectura para el asistente de IA.
--
-- Ejecutar en el SQL Editor de Supabase. Antes de correrlo, reemplazar
-- 'CAMBIAR_ESTA_CLAVE' por una contraseña generada al azar, y guardarla en la
-- variable de entorno DATABASE_URL_IA.
--
-- La garantía de que el asistente no puede escribir no está en el código de la
-- app: está acá. Este rol carece del permiso, así que un INSERT o un DROP
-- fallan en el motor aunque el modelo los escriba y la validación los deje pasar.

-- ── El rol ──────────────────────────────────────────────────────────────────
DROP ROLE IF EXISTS zelanda_ia;
CREATE ROLE zelanda_ia WITH LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';

-- Puede conectarse y mirar el esquema public, nada más.
GRANT CONNECT ON DATABASE postgres TO zelanda_ia;
GRANT USAGE ON SCHEMA public TO zelanda_ia;

-- Sin permisos heredados por defecto: lo que no se otorgue abajo, no existe
-- para este rol. Incluye cualquier tabla que se cree en el futuro.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM zelanda_ia;

-- ── Vistas que omiten los datos personales ──────────────────────────────────
-- El asistente necesita nombres para poder decir "Diego rindió más", pero no
-- tiene por qué ver cédulas ni teléfonos: no aportan a ninguna respuesta útil.

CREATE OR REPLACE VIEW v_ia_personas AS
SELECT id, nombre_completo, activo, created_at
FROM personas
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW v_ia_clientes AS
SELECT id, nombre, activo, created_at
FROM clientes;

CREATE OR REPLACE VIEW v_ia_proveedores AS
SELECT id, nombre, activo, created_at
FROM proveedores;

GRANT SELECT ON v_ia_personas, v_ia_clientes, v_ia_proveedores TO zelanda_ia;

-- ── Tablas legibles ─────────────────────────────────────────────────────────
-- Cultivo y operación.
GRANT SELECT ON
  lotes, arboles, apiarios, instalaciones, finca,
  tipos_tarea, frecuencias_lote, asignaciones, registros_avance, novedades,
  cosechas, cosechas_miel, salidas_cosecha,
  herramientas, insumos, despachos, despacho_items, movimientos_insumo,
  recordatorios, configuracion_finca
TO zelanda_ia;

-- Plata: hace falta para responder sobre rentabilidad y costos.
GRANT SELECT ON
  compras, compras_items, pagos, jornales, ausencias,
  tarifas_tarea, servicios_contratados, vinculaciones
TO zelanda_ia;

-- ── Lo que queda fuera, explícitamente ──────────────────────────────────────
-- personas, clientes, proveedores  → sólo vía las vistas v_ia_* de arriba
-- usuarios, push_subscriptions     → identidad y credenciales de notificación
-- esquema auth (Supabase)          → users, sessions, refresh_tokens, mfa_*
-- esquema storage                  → archivos
--
-- No se otorga nada sobre ellos: el REVOKE de arriba y la ausencia de GRANT
-- bastan. Se listan acá para que quede escrito por qué no están.

-- ── Verificación ────────────────────────────────────────────────────────────
-- Después de ejecutar, esto debe devolver sólo las tablas y vistas otorgadas:
--
--   SELECT table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'zelanda_ia'
--   ORDER BY table_name;
--
-- Y esto debe fallar con "permission denied":
--
--   SET ROLE zelanda_ia;
--   SELECT cedula FROM personas;
--   DELETE FROM cosechas;
--   RESET ROLE;
