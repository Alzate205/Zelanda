import { execFileSync } from 'node:child_process';

// Corre tras la suite, pase o falle, para no dejar usuarios/artefactos test.
export default function globalTeardown() {
  execFileSync('node', ['--env-file=.env.local', '--env-file=.env', 'scripts/e2e-teardown.mjs'], {
    stdio: 'inherit',
  });
}
