// tests/e2e/credenciales.mjs
// Fuente única de los datos de los usuarios/recursos de test e2e.
// Importado por scripts/e2e-seed.mjs, scripts/e2e-teardown.mjs y
// tests/e2e/flujos-criticos.spec.ts. NO duplicar estos valores en otro lado.

export const E2E_JEFE = {
  email: 'e2e-jefe@zelanda.test',
  password: 'E2e-Test-Passw0rd!',
  nombre: 'E2E Jefe Test',
};

export const E2E_TRABAJADOR = {
  email: 'e2e-trabajador@zelanda.test',
  password: 'E2e-Test-Passw0rd!',
  nombre: 'E2E Trabajador Test',
};

// Bodega y almacén: sin estos usuarios, dos de los cuatro roles de la app no se
// probaban nunca — ni sus pantallas ni su navegación.
export const E2E_BODEGA = {
  email: 'e2e-bodega@zelanda.test',
  password: 'E2e-Test-Passw0rd!',
  nombre: 'E2E Bodega Test',
};

export const E2E_ALMACEN = {
  email: 'e2e-almacen@zelanda.test',
  password: 'E2e-Test-Passw0rd!',
  nombre: 'E2E Almacen Test',
};

// Lote propio del test: se crea en el seed y se borra en el teardown. Antes se
// usaba un lote real en solo lectura, pero registrar avance exige que el lote
// tenga árboles, y sembrarlos en un lote real ensucia los datos de la finca.
export const E2E_LOTE = 'E2E Lote Test';
export const E2E_LOTE_ARBOLES = 50;
export const E2E_TIPO_TAREA = 'Riego'; // tipo de tarea CULTIVO existente
