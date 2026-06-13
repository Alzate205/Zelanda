# Smoke e2e de flujos críticos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un smoke Playwright que encadena login → asignar tarea → registrar avance contra Supabase real, con seed/teardown de usuarios test y lote real en solo lectura.

**Architecture:** Tres scripts Node (`credenciales.mjs` compartido, `e2e-seed.mjs`, `e2e-teardown.mjs`) gestionan el ciclo de vida de dos usuarios test directamente en Supabase/Prisma. Playwright los lanza vía `globalSetup`/`globalTeardown` (wrappers que invocan `node --env-file`). Un único `describe.serial` recorre los tres flujos por la UI real.

**Tech Stack:** Playwright `@playwright/test`, `@supabase/supabase-js` (admin), Prisma, Node 20+ (`--env-file` nativo).

Spec de referencia: `docs/superpowers/specs/2026-06-13-e2e-flujos-criticos-design.md`.

---

## Notas de contexto para el ejecutor (leer antes de empezar)

- **Working tree:** la rama de trabajo es `e2e-flujos-criticos` (ya creada, con el spec commiteado). Trabajá ahí.
- **Modelos Prisma relevantes:** `personas` (id BigInt **manual**, no autoincrement — usar `MAX(id)+1`), `vinculaciones` (FK `persona_id`, `fecha_fin: null` = activa), `usuarios` (id = UUID de `auth.users`, FK `onDelete: Cascade` → borrar el auth user borra la fila `usuarios`), `asignaciones` (FK `persona_id`, `creado_por_usuario_id`), `registros_avance` (FK `persona_id`, `asignacion_id`).
- **Enums:** `TipoVinculacion` = `FIJO | JORNALERO | CONTRATISTA | FAMILIAR`. `rol_usuario` incluye `JEFE` y `TRABAJADOR`.
- **Orden de borrado obligatorio** (por las FK NoAction): `registros_avance` → `asignaciones` → borrar auth users (cascade borra `usuarios`) → `vinculaciones` → `personas`.
- **Verificación contra BD real:** los scripts seed/teardown se prueban corriéndolos de verdad contra Supabase (Tasks 2–4). El e2e completo (Task 7) necesita el dev server corriendo o lo levanta el `webServer` de Playwright.
- **Patrón de referencia:** `scripts/crear-primer-jefe.mjs` ya hace casi todo el alta (auth admin + personas + vinculaciones + usuarios); reusar su forma.

---

## Estructura de archivos

| Archivo                                     | Responsabilidad                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `tests/e2e/credenciales.mjs` (crear)        | Fuente única de emails/passwords/nombres test + lote/tarea elegidos.        |
| `scripts/e2e-seed.mjs` (crear)              | Alta idempotente de jefe-test y trabajador-test + pre-limpieza.             |
| `scripts/e2e-teardown.mjs` (crear)          | Borrado robusto de artefactos test en orden por FK.                         |
| `tests/e2e/global-setup.ts` (crear)         | Lanza el seed con `--env-file`.                                             |
| `tests/e2e/global-teardown.ts` (crear)      | Lanza el teardown con `--env-file`.                                         |
| `tests/e2e/flujos-criticos.spec.ts` (crear) | El smoke de los 3 flujos.                                                   |
| `playwright.config.ts` (modificar)          | Cablear `globalSetup`/`globalTeardown`.                                     |
| `package.json` (modificar)                  | Scripts `test:e2e:seed` / `test:e2e:teardown` para verificación standalone. |

---

## Task 1: Módulo de credenciales compartido

**Files:**

- Create: `tests/e2e/credenciales.mjs`

- [ ] **Step 1: Crear el archivo de constantes**

```js
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
```

- [ ] **Step 2: Verificar que importa sin error**

Run: `node --input-type=module -e "import('./tests/e2e/credenciales.mjs').then(m => console.log(m.E2E_JEFE.email, m.E2E_LOTE))"`
Expected: imprime `e2e-jefe@zelanda.test Armenia`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/credenciales.mjs
git commit -m "test(e2e): constantes compartidas de usuarios/recursos test"
```

---

## Task 2: Script de seed

**Files:**

- Create: `scripts/e2e-seed.mjs`

- [ ] **Step 1: Crear el script de seed**

```js
// scripts/e2e-seed.mjs
// Alta idempotente de los usuarios test (jefe + trabajador) en Supabase.
// Reusa el patrón de scripts/crear-primer-jefe.mjs.
// Uso: node --env-file=.env.local --env-file=.env scripts/e2e-seed.mjs

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { E2E_JEFE, E2E_TRABAJADOR } from '../tests/e2e/credenciales.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient();

async function resolverAuthIdPorEmail(email) {
  let pagina = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
    pagina += 1;
  }
}

async function asegurarAuthUser(email, password, nombre) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  });
  if (!error) return data.user.id;
  if (!/already registered|already exists/i.test(error.message)) {
    throw new Error(`createUser ${email}: ${error.message}`);
  }
  const id = await resolverAuthIdPorEmail(email);
  if (!id) throw new Error(`El email ${email} ya existe pero no pude resolver su id.`);
  return id;
}

async function asegurarPersona(nombre) {
  let persona = await prisma.personas.findFirst({ where: { nombre_completo: nombre } });
  if (!persona) {
    const filas = await prisma.$queryRaw`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas`;
    const nextId = filas[0].next_id;
    persona = await prisma.personas.create({
      data: { id: nextId, nombre_completo: nombre, activo: true },
    });
  }
  return persona;
}

async function asegurarVinculacionActiva(personaId, tipo, rolFinca) {
  const activa = await prisma.vinculaciones.findFirst({
    where: { persona_id: personaId, fecha_fin: null },
  });
  if (!activa) {
    await prisma.vinculaciones.create({
      data: { persona_id: personaId, tipo, rol_finca: rolFinca, notas: 'Usuario de test e2e.' },
    });
  }
}

async function asegurarUsuario(authId, email, nombre, rol, personaId) {
  const data = { email, nombre_completo: nombre, rol, persona_id: personaId, activo: true };
  const existente = await prisma.usuarios.findUnique({ where: { id: authId } });
  if (existente) {
    await prisma.usuarios.update({ where: { id: authId }, data });
  } else {
    await prisma.usuarios.create({ data: { id: authId, ...data } });
  }
}

try {
  // Jefe test
  const jefeAuthId = await asegurarAuthUser(E2E_JEFE.email, E2E_JEFE.password, E2E_JEFE.nombre);
  const jefePersona = await asegurarPersona(E2E_JEFE.nombre);
  await asegurarVinculacionActiva(jefePersona.id, 'FAMILIAR', 'Jefe de finca');
  await asegurarUsuario(jefeAuthId, E2E_JEFE.email, E2E_JEFE.nombre, 'JEFE', jefePersona.id);

  // Trabajador test
  const trabAuthId = await asegurarAuthUser(
    E2E_TRABAJADOR.email,
    E2E_TRABAJADOR.password,
    E2E_TRABAJADOR.nombre
  );
  const trabPersona = await asegurarPersona(E2E_TRABAJADOR.nombre);
  await asegurarVinculacionActiva(trabPersona.id, 'JORNALERO', 'Trabajador de campo');
  await asegurarUsuario(
    trabAuthId,
    E2E_TRABAJADOR.email,
    E2E_TRABAJADOR.nombre,
    'TRABAJADOR',
    trabPersona.id
  );

  // Pre-limpieza defensiva: asignaciones/avances de corridas previas interrumpidas.
  await prisma.registros_avance.deleteMany({ where: { persona_id: trabPersona.id } });
  await prisma.asignaciones.deleteMany({ where: { persona_id: trabPersona.id } });

  console.log('✓ Seed e2e listo. jefe:', jefeAuthId, '· trabajador:', trabAuthId);
} catch (e) {
  console.error('✗ Seed e2e falló:', e?.message ?? String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
```

- [ ] **Step 2: Commit (se verifica en Task 4 junto al teardown)**

```bash
git add scripts/e2e-seed.mjs
git commit -m "test(e2e): script de seed de usuarios test"
```

---

## Task 3: Script de teardown

**Files:**

- Create: `scripts/e2e-teardown.mjs`

- [ ] **Step 1: Crear el script de teardown**

```js
// scripts/e2e-teardown.mjs
// Borrado robusto e idempotente de los artefactos de test e2e.
// Orden por FK: registros_avance → asignaciones → auth users (cascade usuarios)
//   → vinculaciones → personas.
// Uso: node --env-file=.env.local --env-file=.env scripts/e2e-teardown.mjs

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { E2E_JEFE, E2E_TRABAJADOR } from '../tests/e2e/credenciales.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient();

async function resolverAuthIdPorEmail(email) {
  let pagina = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
    pagina += 1;
  }
}

try {
  const personas = await prisma.personas.findMany({
    where: { nombre_completo: { in: [E2E_JEFE.nombre, E2E_TRABAJADOR.nombre] } },
    select: { id: true },
  });
  const personaIds = personas.map((p) => p.id);

  if (personaIds.length > 0) {
    await prisma.registros_avance.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.asignaciones.deleteMany({ where: { persona_id: { in: personaIds } } });
  }

  // Borrar auth users (cascade borra la fila en `usuarios`). Trabajador primero.
  for (const email of [E2E_TRABAJADOR.email, E2E_JEFE.email]) {
    const id = await resolverAuthIdPorEmail(email);
    if (id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) console.warn(`· deleteUser ${email}: ${error.message}`);
    }
  }

  if (personaIds.length > 0) {
    await prisma.vinculaciones.deleteMany({ where: { persona_id: { in: personaIds } } });
    await prisma.personas.deleteMany({ where: { id: { in: personaIds } } });
  }

  console.log('✓ Teardown e2e listo. personas borradas:', personaIds.length);
} catch (e) {
  console.error('✗ Teardown e2e falló:', e?.message ?? String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/e2e-teardown.mjs
git commit -m "test(e2e): script de teardown de artefactos test"
```

---

## Task 4: Verificar seed + teardown contra Supabase real

**Files:**

- Modify: `package.json` (sección `scripts`)

- [ ] **Step 1: Agregar scripts de conveniencia en `package.json`**

En el objeto `"scripts"`, después de la línea `"test:e2e": "playwright test",`, agregar:

```json
    "test:e2e:seed": "node --env-file=.env.local --env-file=.env scripts/e2e-seed.mjs",
    "test:e2e:teardown": "node --env-file=.env.local --env-file=.env scripts/e2e-teardown.mjs",
```

- [ ] **Step 2: Correr el seed y verificar que crea los usuarios**

Run: `npm run test:e2e:seed`
Expected: imprime `✓ Seed e2e listo. jefe: <uuid> · trabajador: <uuid>` y exit 0.

- [ ] **Step 3: Verificar idempotencia (segunda corrida no falla)**

Run: `npm run test:e2e:seed`
Expected: vuelve a imprimir `✓ Seed e2e listo. ...` y exit 0 (reusa los existentes, no duplica).

- [ ] **Step 4: Verificar en BD que existen los usuarios test**

Run:

```bash
node --env-file=.env.local --env-file=.env --input-type=module -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const u = await p.usuarios.findMany({ where: { email: { contains: '@zelanda.test' } }, select: { email: true, rol: true, persona_id: true } }); console.log(u); await p.\$disconnect();"
```

Expected: dos filas — una `JEFE` y una `TRABAJADOR`, ambas con `persona_id` no nulo.

- [ ] **Step 5: Correr el teardown y verificar que limpia**

Run: `npm run test:e2e:teardown`
Expected: imprime `✓ Teardown e2e listo. personas borradas: 2` y exit 0.

- [ ] **Step 6: Verificar que no quedó nada**

Run:

```bash
node --env-file=.env.local --env-file=.env --input-type=module -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const u = await p.usuarios.findMany({ where: { email: { contains: '@zelanda.test' } } }); const per = await p.personas.findMany({ where: { nombre_completo: { contains: 'E2E ' } } }); console.log('usuarios:', u.length, 'personas:', per.length); await p.\$disconnect();"
```

Expected: `usuarios: 0 personas: 0`.

- [ ] **Step 7: Commit**

```bash
git add package.json
git commit -m "test(e2e): scripts npm para seed/teardown standalone"
```

---

## Task 5: Wrappers de global setup/teardown + cableado en Playwright

**Files:**

- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/global-teardown.ts`
- Modify: `playwright.config.ts:3-21`

- [ ] **Step 1: Crear `tests/e2e/global-setup.ts`**

```ts
import { execFileSync } from 'node:child_process';

// Playwright corre en un proceso Node que NO carga .env.local automáticamente,
// así que lanzamos el seed con el mismo patrón --env-file de los scripts del repo.
export default function globalSetup() {
  execFileSync('node', ['--env-file=.env.local', '--env-file=.env', 'scripts/e2e-seed.mjs'], {
    stdio: 'inherit',
  });
}
```

- [ ] **Step 2: Crear `tests/e2e/global-teardown.ts`**

```ts
import { execFileSync } from 'node:child_process';

// Corre tras la suite, pase o falle, para no dejar usuarios/artefactos test.
export default function globalTeardown() {
  execFileSync('node', ['--env-file=.env.local', '--env-file=.env', 'scripts/e2e-teardown.mjs'], {
    stdio: 'inherit',
  });
}
```

- [ ] **Step 3: Cablear en `playwright.config.ts`**

Reemplazar el bloque `export default defineConfig({ ... })` para agregar `globalSetup` y `globalTeardown` justo después de `testDir`. El archivo completo queda:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 4: Verificar que el setup corre y deja los usuarios (sin tests aún)**

Run: `npx playwright test --grep "home page"`
Expected: el `globalSetup` imprime `✓ Seed e2e listo...`, el test `home.spec.ts` pasa, y el `globalTeardown` imprime `✓ Teardown e2e listo...`. (Confirma que el cableado funciona end-to-end aunque el spec de flujos aún no exista.)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/global-setup.ts tests/e2e/global-teardown.ts playwright.config.ts
git commit -m "test(e2e): global setup/teardown que orquestan seed y limpieza"
```

---

## Task 6: El spec de los 3 flujos

**Files:**

- Create: `tests/e2e/flujos-criticos.spec.ts`

- [ ] **Step 1: Escribir el spec**

```ts
import { test, expect, type Page } from '@playwright/test';
import { E2E_JEFE, E2E_TRABAJADOR, E2E_LOTE, E2E_TIPO_TAREA } from './credenciales.mjs';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#identificador').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe.serial('Flujos críticos', () => {
  test('login → asignar tarea → registrar avance', async ({ browser }) => {
    // ── Paso 1: login jefe ───────────────────────────────────────────────
    const ctxJefe = await browser.newContext();
    const pageJefe = await ctxJefe.newPage();
    await login(pageJefe, E2E_JEFE.email, E2E_JEFE.password);
    await expect(pageJefe).toHaveURL(/\/jefe$/);

    // ── Paso 2: asignar tarea (wizard de 4 pasos) ────────────────────────
    await pageJefe.goto('/jefe/asignaciones/nueva');

    // Paso 1 wizard: buscar el lote y seleccionarlo (el buscador oculta los
    // "sugeridos", así que sólo queda una fila que matchea el nombre).
    await pageJefe.getByPlaceholder(/Buscar lote/).fill(E2E_LOTE);
    await pageJefe.getByRole('button', { name: new RegExp(E2E_LOTE) }).click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2 wizard: elegir el tipo de tarea de cultivo.
    await pageJefe.getByRole('button', { name: new RegExp(E2E_TIPO_TAREA) }).click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3 wizard: elegir al trabajador test (carga 0 → aparece en "Disponibles").
    await pageJefe.getByRole('button', { name: new RegExp(E2E_TRABAJADOR.nombre) }).click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 4 wizard: confirmar.
    await pageJefe.getByRole('button', { name: 'Crear asignación' }).click();
    await expect(pageJefe).toHaveURL(/\/jefe\/asignaciones$/);
    await expect(pageJefe.getByText(E2E_TRABAJADOR.nombre).first()).toBeVisible();

    // ── Paso 3: registrar avance (contexto/sesión nuevos) ────────────────
    const ctxTrab = await browser.newContext();
    const pageTrab = await ctxTrab.newPage();
    await login(pageTrab, E2E_TRABAJADOR.email, E2E_TRABAJADOR.password);
    await expect(pageTrab).toHaveURL(/\/trabajador$/);

    await pageTrab.goto('/trabajador/tareas');
    await pageTrab
      .getByRole('link', { name: new RegExp(E2E_TIPO_TAREA) })
      .first()
      .click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/avance\//);

    // Avance TRAMO 1–5 (lote real con miles de árboles → queda EN_CURSO).
    await pageTrab.locator('#desde').fill('1');
    await pageTrab.locator('#hasta').fill('5');
    await pageTrab.getByRole('button', { name: /Registrar/ }).click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/exito\//);

    await ctxJefe.close();
    await ctxTrab.close();
  });
});
```

- [ ] **Step 2: Correr el spec y verificar que pasa**

Run: `npx playwright test flujos-criticos`
Expected: el `globalSetup` siembra, el test `login → asignar tarea → registrar avance` pasa, el `globalTeardown` limpia. Exit 0.

- [ ] **Step 3: Si algún selector falla, ajustarlo**

Si el run falla por un selector (texto/rol que no matchea), abrir el reporte para ver el estado real:

Run: `npx playwright test flujos-criticos --debug` (o revisar `playwright-report/`)

Ajustar el selector ofensivo en `tests/e2e/flujos-criticos.spec.ts` (preferir `getByRole`/`getByText`/`getByLabel`; acotar por contenedor si el texto es ambiguo). Repetir Step 2 hasta que pase. **No** agregar `data-testid` a la UI salvo que los selectores por texto resulten inviables (fuera de alcance de este plan).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/flujos-criticos.spec.ts
git commit -m "test(e2e): smoke de login, asignar tarea y registrar avance"
```

---

## Task 7: Verificación end-to-end completa

**Files:** (ninguno — sólo verificación)

- [ ] **Step 1: Correr la suite e2e completa desde limpio**

Run: `npm run test:e2e`
Expected: corren `home.spec.ts` y `flujos-criticos.spec.ts`, ambos pasan; setup y teardown imprimen sus mensajes de éxito. Exit 0.

- [ ] **Step 2: Verificar que el teardown dejó la BD limpia**

Run:

```bash
node --env-file=.env.local --env-file=.env --input-type=module -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const u = await p.usuarios.count({ where: { email: { contains: '@zelanda.test' } } }); const per = await p.personas.count({ where: { nombre_completo: { contains: 'E2E ' } } }); console.log('usuarios:', u, 'personas:', per); await p.\$disconnect();"
```

Expected: `usuarios: 0 personas: 0`.

- [ ] **Step 3: Verificar lint/format de los archivos nuevos**

Run: `npx prettier --check "tests/e2e/**/*.{ts,mjs}" "scripts/e2e-*.mjs" playwright.config.ts`
Expected: `All matched files use Prettier code style!` (si falla, correr `npx prettier --write` sobre esos paths y re-commit).

- [ ] **Step 4: Commit final (si Step 3 reformateó algo)**

```bash
git add -A
git commit -m "test(e2e): formato de archivos del smoke"
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** §4.1 → Task 1; §4.2 → Task 2; §4.3 → Task 3; §4.4 → Task 5; §4.5 → Task 6; §5 (cómo se corre) → Tasks 4 y 7; §6 riesgos (selectores, basura, teardown siempre) → Step 3 de Task 6, pre-limpieza en seed, `globalTeardown`. Sin huecos.
- **Placeholders:** ninguno — todo el código de scripts y spec está completo.
- **Consistencia de tipos/nombres:** `E2E_JEFE`/`E2E_TRABAJADOR`/`E2E_LOTE`/`E2E_TIPO_TAREA` usados igual en seed, teardown y spec; orden de borrado coherente con las FK verificadas en el schema; nombres de modelos Prisma (`registros_avance`, `asignaciones`, `vinculaciones`, `personas`, `usuarios`) coinciden con `schema.prisma`.
