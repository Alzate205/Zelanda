# Contributing

Gracias por contribuir a FincApp.

Pasos básicos para desarrollar localmente:

1. Clonar y configurar variables de entorno (`.env.local`, `.env`) según `.env.example`.
2. Instalar dependencias: `npm ci`.
3. Preparar hooks: `npm run prepare` (husky).
4. Ejecutar tests unitarios: `npm run test`.
5. Ejecutar E2E localmente: `npm run build && npm run start` y en otro terminal `npx playwright test`.

Convenciones:
- Commits en español, tipo: `feat:`, `fix:`, `chore:`, `docs:`.
- Abrir PRs contra `main`. Crear ramas descriptivas: `mejoras/<tema>`.

Formato y lint:
- Formatear: `npm run format` (Prettier)
- Lint: `npm run lint` (ESLint)

Observabilidad:
- Sentry: añadir `SENTRY_DSN` (server) y `NEXT_PUBLIC_SENTRY_DSN` (client) en secretos.

Gracias por tu contribución.
