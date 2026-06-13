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

export const E2E_LOTE = 'Armenia'; // lote real existente, solo lectura
export const E2E_TIPO_TAREA = 'Riego'; // tipo de tarea CULTIVO existente
