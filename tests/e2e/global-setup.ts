import { execFileSync } from 'node:child_process';

// Playwright corre en un proceso Node que NO carga .env.local automáticamente,
// así que lanzamos el seed con el mismo patrón --env-file de los scripts del repo.
export default function globalSetup() {
  execFileSync('node', ['--env-file=.env.local', '--env-file=.env', 'scripts/e2e-seed.mjs'], {
    stdio: 'inherit',
  });
}
