## Sub-fase 5.2a (Modo offline trabajador)

Aplicar `migracion-fase5-offline-trabajador.sql` en SQL Editor de Supabase. Idempotente, se puede correr varias veces.

Después: `npm run db:pull` para refrescar el cliente Prisma (o usar `db:generate` si el schema ya quedó alineado a mano).

## Sub-fase 5.2b (Modo offline bodega/almacén/jefe)

Aplicar `migracion-fase5-offline-bodega-almacen.sql` en SQL Editor. Idempotente.
Después: `npm run db:generate` para refrescar el cliente Prisma.
