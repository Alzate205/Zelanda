import { execFileSync } from 'node:child_process';

// Corre tras la suite, pase o falle, para no dejar usuarios/artefactos test.
// `--env-file-if-exists`: en CI no hay archivos .env y Node aborta si faltan.
export default function globalTeardown() {
  execFileSync(
    'node',
    ['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', 'scripts/e2e-teardown.mjs'],
    { stdio: 'inherit' }
  );
}
