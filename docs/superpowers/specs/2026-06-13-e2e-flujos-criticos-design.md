# Smoke e2e de flujos críticos — Diseño

**Fecha:** 2026-06-13
**Autor:** Samuel Alzate (con Claude Code)
**Estado:** Aprobado para implementación

## 1. Objetivo

Crear una red de seguridad mínima de tests end-to-end (Playwright) que cubra los
tres flujos más críticos de FincApp, encadenados como un solo smoke:

1. **Login** (jefe y trabajador).
2. **Asignar tarea** (el jefe asigna una tarea de cultivo a un trabajador).
3. **Registrar avance** (el trabajador registra avance TRAMO sobre esa asignación).

Es el único punto pendiente del backlog de Fase 8. Hoy solo existe
`tests/e2e/home.spec.ts` (un smoke de que la home carga) y `playwright.config.ts`.

No buscamos cobertura exhaustiva ni tests de cada pantalla: un único camino feliz
que, si se rompe, avisa que algo grave pasó en el corazón de la app.

## 2. Decisiones tomadas (contexto)

| Decisión         | Valor                                             | Razón                                                                                                                   |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Base de datos    | Supabase **real** + cleanup                       | Es la única forma de loguear (auth real con cookies `@supabase/ssr`). No hay segundo entorno.                           |
| Usuarios de test | **Dedicados, creados y borrados** en cada corrida | Reconocibles, aislados del histórico de personas reales.                                                                |
| Lote del wizard  | **Lote real existente, solo lectura** ("Armenia") | `crearAsignacion` no muta el lote y el avance no toca `arboles`; el lote queda 100% intacto. Cero seed/cleanup de lote. |

## 3. Hallazgos del código que sustentan el diseño

Revisión de los flujos antes de diseñar:

- **Login** — `app/(auth)/login/acciones.ts::iniciarSesion` (server action). Selectores
  del formulario (`app/(auth)/login/formulario.tsx`): `#identificador`, `#password`,
  botón con texto **"Entrar"**. Redirección por rol: JEFE → `/jefe`, TRABAJADOR →
  `/trabajador` (`RUTA_INICIO_POR_ROL`).
- **Crear asignación** — `app/(app)/jefe/asignaciones/acciones.ts::crearAsignacion`
  inserta **una sola fila** en `asignaciones` (estado `PENDIENTE`). **No** actualiza
  la próxima fecha del lote ni ninguna otra tabla. El push al trabajador es
  best-effort (falla en silencio si no hay suscripción). El wizard
  (`WizardNuevaAsignacion.tsx`) tiene 4 pasos y **no usa `data-testid`** → selectores
  por texto/rol. La versión single (no la masiva) **no** deduplica asignaciones, así
  que re-correr puede crear varias — el teardown limpia todas las del persona-test.
- **Registrar avance** — `app/api/trabajador/avance/route.ts` (POST). Para TRAMO/SUELTOS
  crea `registros_avance` y actualiza `asignaciones` (`arboles_completados`, estado).
  **No toca la tabla `arboles`**: valida los números contra la columna
  `lotes.total_arboles`. El front (`FormAvance.tsx`) llama a `enviarAvance` que encola en
  IndexedDB y postea de inmediato cuando hay conexión (en headless Chromium
  `navigator.onLine === true` → va directo al servidor). Al terminar redirige a
  `/trabajador/exito/[asignacion_id]`.

**Consecuencia:** el cleanup es acotado — `registros_avance` + `asignaciones` del
persona-test, más los dos usuarios. El lote real nunca se modifica.

## 4. Arquitectura

### 4.1 Constantes compartidas — `tests/e2e/credenciales.mjs`

**Un único archivo** `tests/e2e/credenciales.mjs` (JS plano con named exports) es la
fuente de verdad de los datos de los usuarios test. Lo importan los tres consumidores:
`scripts/e2e-seed.mjs`, `scripts/e2e-teardown.mjs` (ambos Node) y
`flujos-criticos.spec.ts` (el loader TypeScript de Playwright importa `.mjs` sin
problema). Así no se duplican valores y no hace falta un twin `.ts`.

```js
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
export const E2E_LOTE = 'Armenia'; // lote real, solo lectura
export const E2E_TIPO_TAREA = 'Riego'; // tipo CULTIVO existente
```

Invariante: **un solo lugar con los valores**. Si el loader de Playwright diera
fricción al importar `.mjs`, la implementación puede renombrar a `.js`/`.ts`
manteniendo el archivo único; lo que no se permite es duplicar las constantes.

### 4.2 Seed — `scripts/e2e-seed.mjs`

Idempotente. Reusa el patrón de `scripts/crear-primer-jefe.mjs` (Supabase admin con
`SUPABASE_SERVICE_ROLE_KEY` + Prisma). Pasos:

1. **Pre-limpieza defensiva:** borrar `registros_avance` + `asignaciones` de un
   persona-test que haya quedado de una corrida previa interrumpida.
2. Crear/asegurar **jefe-test**: auth user (`email_confirm: true`) + `personas` +
   `vinculaciones` (FAMILIAR, "Jefe de finca") + `usuarios` (rol JEFE, activo).
3. Crear/asegurar **trabajador-test**: auth user + `personas` ("E2E Trabajador Test") +
   `vinculaciones` activa (tipo JORNALERO o FIJO, `fecha_fin: null`) + `usuarios`
   (rol TRABAJADOR, activo, `persona_id` enlazado).
4. Salir con código 0 e imprimir un resumen.

La vinculación activa del trabajador es obligatoria: sin ella no aparece en el paso 3
del wizard ni se le puede setear `persona_id`.

### 4.3 Teardown — `scripts/e2e-teardown.mjs`

Robusto e idempotente. Borra **por persona/email**, no por id puntual, para tolerar
estado parcial:

1. Resolver `persona_id` del trabajador-test por nombre/email.
2. Borrar `registros_avance` de esa persona, luego `asignaciones` de esa persona
   (en ese orden por las FK).
3. Borrar `vinculaciones` y `personas` de ambos usuarios test.
4. Borrar las filas `usuarios` y los `auth.users` (vía `supabase.auth.admin.deleteUser`)
   de ambos.

Debe correr **siempre**, incluso si el spec falla (ver `globalTeardown`).

### 4.4 Integración con Playwright — `playwright.config.ts`

Agregar `globalSetup` y `globalTeardown`. Como Playwright corre en un proceso Node que
**no** carga `.env.local` automáticamente (a diferencia de `next dev`), los wrappers
lanzan los `.mjs` con el mismo patrón de env de los scripts existentes:

```ts
// tests/e2e/global-setup.ts
import { execFileSync } from 'node:child_process';
export default function () {
  execFileSync('node', ['--env-file=.env.local', '--env-file=.env', 'scripts/e2e-seed.mjs'], {
    stdio: 'inherit',
  });
}
```

`global-teardown.ts` es análogo con `scripts/e2e-teardown.mjs`. Requiere Node 20+
(`--env-file` nativo), que ya usa el proyecto.

El `webServer` actual (`npm run dev`, `reuseExistingServer: !CI`) se mantiene: el dev
server carga `.env.local` con las credenciales reales de Supabase. `home.spec.ts` no
se toca.

### 4.5 El spec — `tests/e2e/flujos-criticos.spec.ts`

`test.describe.serial` (los pasos dependen del anterior). Un solo worker para esta
suite (la serie comparte estado en la BD).

**Paso 1 — Login jefe:**

- `goto('/login')`, llenar `#identificador` con el email del jefe-test, `#password`,
  click "Entrar".
- Assert: URL termina en `/jefe`.

**Paso 2 — Asignar tarea (mismo contexto, ya logueado como jefe):**

- `goto('/jefe/asignaciones/nueva')`.
- Paso 1 wizard: buscar "Armenia" en el buscador, click en la fila del lote → "Continuar".
- Paso 2 wizard: click en la tarjeta "Riego" → "Continuar".
- Paso 3 wizard: click en la fila "E2E Trabajador Test" → "Continuar".
- Paso 4 wizard: click "Crear asignación".
- Assert: URL termina en `/jefe/asignaciones` y aparece una asignación con
  "Riego" + "Armenia" + "E2E Trabajador Test".

**Paso 3 — Registrar avance (contexto nuevo, sesión limpia):**

- Crear un `browser.newContext()` para no arrastrar cookies del jefe.
- Login como trabajador-test (mismo procedimiento del paso 1) → assert `/trabajador`.
- `goto('/trabajador/tareas')`, abrir la asignación de "Riego" (link a
  `/trabajador/avance/[id]`).
- Tab "Tramo" (default), `desde=1`, `hasta=5`, click "Registrar".
- Assert: URL coincide con `/trabajador/exito/...`.

**Selectores:** preferir `getByRole`/`getByText`/`getByLabel` sobre CSS. Donde el texto
sea ambiguo, acotar por contenedor. Si algún selector resulta frágil en la
implementación, se ajusta ahí (riesgo conocido, ver §6).

## 5. Cómo se corre

```
npm run test:e2e        # seed → tests → teardown (global setup/teardown)
```

Con el dev server ya corriendo, Playwright lo reusa. `PLAYWRIGHT_BASE_URL` permite
apuntar a otra URL si hiciera falta. Requiere `.env.local` con las claves de Supabase
(incluida `SUPABASE_SERVICE_ROLE_KEY`) — ya presente en el entorno de desarrollo.

## 6. Riesgos y mitigaciones

| Riesgo                                                | Mitigación                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selectores del wizard frágiles (no hay `data-testid`) | Usar roles/texto; ajustar en implementación. Si se vuelve recurrente, evaluar agregar `data-testid` mínimos en un paso posterior (fuera de alcance de este spec). |
| Corrida interrumpida deja basura                      | Seed pre-limpia; teardown borra por persona; ambos idempotentes.                                                                                                  |
| El spec falla y el teardown no corre                  | `globalTeardown` de Playwright corre tras la suite pase o falle.                                                                                                  |
| `--env-file` requiere Node 20+                        | Ya es requisito del proyecto (scripts existentes lo usan).                                                                                                        |
| La asignación queda EN_CURSO (no completa)            | Esperado y aceptable para un smoke; el redirect a `/exito` ocurre igual.                                                                                          |

## 7. Fuera de alcance

- Tests de los flujos offline (cola IndexedDB, sync con backoff).
- Flujos de bodega, almacén, apicultura, financiero.
- Visual regression / accesibilidad.
- Integración en CI (se documenta cómo correrlo local; CI es un paso futuro).
- Agregar `data-testid` a la UI (solo si los selectores por texto resultan inviables).
