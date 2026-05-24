# Auditoría técnica y UX — FincApp (Hacienda La Zelanda)

Fecha: 2026-05-24
Autor: Copilot CLI (reporte generado por IA)

Resumen ejecutivo

- El proyecto está maduro: README, CLAUDE.md y esquema.sql definen claramente la arquitectura (Next.js App Router, Supabase, Prisma, PWA, offline).
- Áreas críticas a tratar primero: CI/CD (ausente), pruebas (unit/E2E), escaneo de seguridad/secrets, políticas RLS y backups, y observabilidad.
- Mejora rápida de DX: scripts npm más completos, Prettier + ESLint integration, husky + lint-staged.
- UX/Performance: auditoría de accesibilidad (contraste, focus), optimización de imágenes y service worker cache strategy.

Metodología

Inspección de: CLAUDE.md, README.md, esquema.sql, carpeta `app/`, `components/`, `lib/`, `supabase/`, `prisma/` y scripts principales. Se buscó patrones comunes (carga offline, manejo de fotos, push, sync). Recomendaciones mezclan correcciones de seguridad, calidad y mejoras de producto.

Prioridad alta (arreglos inmediatos)

1. CI/CD: configurar GitHub Actions para ejecutar: `npm ci`, `npm run lint` (args), `npm run build`, `npm run test` y Lighthouse/Performance (opcional). Añadir job de CodeQL y Dependabot.
2. Tests: agregar Vitest + React Testing Library y un pipeline básico de tests. Cobertura mínima para funciones críticas (offline sync, API routes, utilidades). Añadir E2E con Playwright (flujo trabajador offline → sync).
3. Secrets/Seguridad: ejecutar escaneo de secretos, añadir CodeQL y Snyk/Dependabot alerts. Verificar que SUPABASE_SERVICE_ROLE_KEY nunca llegue al cliente (NO usar NEXT_PUBLIC_* para secrets). Incluir `.env.example` completo (incluir VAPID_PUBLIC_KEY).
4. Backups & Migrations: documentar proceso de backup de Supabase y usar Prisma Migrate con migraciones versionadas (si no está en uso). Añadir scripts de verificación de migraciones (ya hay scripts: good).
5. Observabilidad: integrar Sentry (server + client) y registro de errores en SyncEngine para diagnosticar reintentos y fallos.

Prioridad media

- Formateo y lint: añadir Prettier, estandarizar eslint script (por ejemplo: `eslint "./**/*.{ts,tsx}" --max-warnings=0`). Añadir `format` y `check:format`.
- Husky + lint-staged: impedir commits con code style roto.
- Dependencias: plan de upgrades y pinning de versiones (usar Dependabot config con grouping).
- Tests de accesibilidad: añadir axe-core y una job en CI que ejecute chequeos a páginas críticas.
- Documentación: `CONTRIBUTING.md`, `PR_TEMPLATE.md`, actualizar README con comandos `lint`, `test`, `format`, dev env y despliegue.

Prioridad baja (mejoras de producto y UX)

- Storybook para componentes UI (ayuda a QA y desarrollo de UI).
- Mejora de PWA: revisar `sw.js` estrategia de cache (cache-first vs network-first según ruta). Añadir gestión de actualizaciones/hard-reload para SW.
- Optimizaciones Leaflet: lazy-loading de tiles, límites de zoom, clusterización para grandes cantidades de marcadores si se requiere.

Hallazgos por archivo (resumen: archivos inspeccionados)

- `package.json`
  - Añadir scripts: `lint` (con args), `format`, `test`, `check:types`.
  - Agregar devDependencies sugeridos: `prettier`, `husky`, `lint-staged`, `vitest`, `@testing-library/react`, `playwright`, `axe-core/puppeteer`.

- `next.config.ts`
  - Actualmente vacío. Configurar `images.domains`, headers de seguridad (Content-Security-Policy), y experimental features si se usan.

- `middleware.ts`
  - Lógica clara de redirección. Revisar las secciones que intentan mutar cookies en Server Components (hay try/catch, ok). Añadir manejo de errores y logs.

- `lib/prisma.ts`
  - Correcta gestión de instancia global de Prisma. Recomendar `binaryTargets` en schema si multiplataforma se usa.

- `lib/supabase/*` y `lib/supabase/admin.ts`
  - Buen patrón: `admin` usa service role. Verificar que `NEXT_PUBLIC_*` no contenga secretos en producción.

- `lib/offline/*` (sync, cola, db)
  - Arquitectura offline sólida (IndexedDB, cola, backoff). Recomendaciones:
    - Exponer métricas (nº reintentos, errores permanentes) y logs con Sentry.
    - Hacer configurable BACKOFFS_MS y MAX_INTENTOS via ENV o constante central.
    - Considerar usar AbortController en fetch para cancelar peticiones si el usuario cierra la app.

- `components/shared/SubirFoto.tsx`
  - Excelente reescalado y fallback. Recomendaciones:
    - Normalizar orientación EXIF antes de dibujar en canvas (rotación en fotos de móviles).
    - Añadir `aria-describedby` y mensajes accesibles para errores.

- Push (PushToggle / PushPrompt)
  - Verificar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en `.env.example`. Manejar navegadores sin soporte Push (Safari) con mensajes alternativos.

- `supabase/policies.sql` y `esquema.sql`
  - Esquema bien pensado (personas + vinculaciones). Recomendación: revisar políticas RLS puntualmente con auditoría de roles; añadir tests de integración que validen RLS (supabase emulación o entorno de staging).

- `public/sw.js` y `manifest.webmanifest`
  - Verificar que los iconos incluyen `purpose: maskable` y que `manifest` tiene shortcuts (CLAUDE.md menciona shortcuts). Añadir tests manuales para instalación PWA y actualizaciones.

Automatización / CI sugerido (ejemplo de jobs)

- workflow/main.yml
  - jobs: lint, typecheck, build, test, e2e (playwright), lighthouse (optional), codeql/scan.
- Dependabot configurado para PRs semanales y grouping para `react`/`next`/`prisma`.

Calidad de código y DX

- Enforzar TypeScript `strict: true` (ya está), pero añadir `noImplicitAny` checks si faltan. Revisar usos de `any` detectados por grep y refactorear.
- Buscar `// @ts-ignore` y `eslint-disable` y justificar su uso en comentarios (o eliminarlos).

Checklist propuesto (acciones concretas)

1. Añadir GitHub Actions con jobs base y CodeQL. (alta)
2. Añadir Vitest + React Testing Library + Playwright + primer conjunto de tests (alta).
3. Añadir Prettier + husky + lint-staged y ajustar `package.json` scripts (media).
4. Agregar Dependabot y configurar actualizaciones automáticas (media).
5. Integrar Sentry y exponer logs de SyncEngine (alta).
6. Revisar RLS y crear tests de integración para políticas (alta).
7. Añadir `docs/AUDIT.md` (este archivo) y `CONTRIBUTING.md` (media).

Próximos pasos que puedo ejecutar ahora

- Crear PRs con los cambios de DX (prettier, lint scripts, husky).  
- Implementar CI básico en `.github/workflows/ci.yml`.  
- Añadir primer test con Vitest para `lib/formatos.ts` o `lib/uuid` para demostrar flujo.

Si querés, puedo empezar aplicando las tareas de la "Checklist" en orden (crear PRs) o generar issues/epics en GitHub para priorizar. Decime cómo preferís proceder.

Notas finales

El proyecto está técnicamente sólido y pensado para operación real en campo (offline, PWA, reescalado de fotos). La auditoría se centra en operacionalizar calidad (CI, tests, observabilidad) y cerrar huecos de seguridad/entrega continua. Si querés, puedo generar PRs automáticos con los cambios de DX y un ejemplo de pipeline.
