## Sub-fase 5.2a (Modo offline trabajador)

Aplicar `migracion-fase5-offline-trabajador.sql` en SQL Editor de Supabase. Idempotente, se puede correr varias veces.

Después: `npm run db:pull` para refrescar el cliente Prisma (o usar `db:generate` si el schema ya quedó alineado a mano).

## Sub-fase 5.2b (Modo offline bodega/almacén/jefe)

Aplicar `migracion-fase5-offline-bodega-almacen.sql` en SQL Editor. Idempotente.
Después: `npm run db:generate` para refrescar el cliente Prisma.

## Módulo apicultura

Aplicar `migracion-apicultura.sql` en SQL Editor. Idempotente.
Crea enum `estado_apiario`, columna `registros_avance.estado_apiario`, tabla `cosechas_miel` con RLS.
Después: `npm run db:generate`.

## Condición de devolución de herramientas

Aplicar `migracion-despacho-condicion.sql` en SQL Editor. Idempotente.
Agrega columna `despacho_items.condicion_devolucion` (texto) para registrar si la herramienta
volvió dañada, sucia, etc.

## Login con username

Aplicar `migracion-username.sql` en SQL Editor. Idempotente.
Agrega columna `usuarios.username` (texto opcional, único). Cada usuario lo setea desde
`/mi-perfil`. Después puede iniciar sesión con username o con email.
