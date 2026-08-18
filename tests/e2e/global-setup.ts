import { execFileSync } from 'node:child_process';

// Playwright corre en un proceso Node que NO carga .env.local automáticamente,
// así que lanzamos el seed con el mismo patrón --env-file de los scripts del repo.
//
// `--env-file-if-exists` en vez de `--env-file`: en CI no hay archivos .env
// —las credenciales llegan como variables de entorno— y Node aborta si el
// archivo no está. Eso hacía fallar la suite antes del primer test.
export default function globalSetup() {
  execFileSync(
    'node',
    ['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', 'scripts/e2e-seed.mjs'],
    { stdio: 'inherit' }
  );
}
