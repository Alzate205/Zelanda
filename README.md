# FincApp · Hacienda La Zelanda

Sistema de gestión integral para la Hacienda La Zelanda (finca familiar de aguacate Hass en el Quindío, Colombia). PWA con modo offline.

La fuente de verdad del proyecto está en [CLAUDE.md](./CLAUDE.md). El esquema de base de datos en [esquema.sql](./esquema.sql) y las políticas RLS en [supabase/policies.sql](./supabase/policies.sql).

## CI/CD y Calidad

[![CI Workflow](https://github.com/Alzate205/Zelanda/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Alzate205/Zelanda/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Alzate205/Zelanda/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/Alzate205/Zelanda/actions/workflows/codeql.yml)
[![E2E Tests](https://github.com/Alzate205/Zelanda/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/Alzate205/Zelanda/actions/workflows/e2e.yml)

El proyecto tiene **integración completa de DevOps**:
- **CI/CD**: GitHub Actions ejecuta tests, lint, build y upload de sourcemaps en cada push a `main`
- **Testing**: Unit tests con [Vitest](https://vitest.dev/) + E2E con [Playwright](https://playwright.dev/)
- **Code Quality**: [Prettier](https://prettier.io/) + ESLint + pre-commit hooks ([Husky](https://typicode.github.io/husky/))
- **Security**: [CodeQL](https://codeql.github.com/) + [Dependabot](https://github.com/dependabot)
- **Observability**: [Sentry](https://sentry.io/) para error tracking y performance monitoring

Consulta [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) para instrucciones de desarrollo.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS v3 · Lucide React
- Prisma 6 · PostgreSQL 15 + PostGIS (Supabase)
- Supabase Auth · Supabase Storage

## Requisitos

- Node.js 20+ (probado en 22)
- npm 10+
- Un proyecto en [Supabase](https://supabase.com) (free tier sirve)

## Configuración local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar variables de entorno y rellenar con valores reales del proyecto Supabase:

   ```bash
   cp .env.example .env.local
   cp .env.example .env
   ```

   - `.env.local` lo consume Next.js (variables `NEXT_PUBLIC_*` y `SUPABASE_SERVICE_ROLE_KEY`).
   - `.env` lo consume Prisma CLI (`DATABASE_URL`, `DIRECT_URL`).

3. En el SQL Editor de Supabase, ejecutar en orden:

   1. [esquema.sql](./esquema.sql) — crea tablas, vistas, enums, triggers
   2. [supabase/policies.sql](./supabase/policies.sql) — activa RLS y define políticas por rol

4. Regenerar el cliente Prisma (opcional, `npm install` ya lo hace):

   ```bash
   npm run db:generate
   ```

5. Arrancar el dev server:

   ```bash
   npm run dev
   ```

   La app queda en `http://localhost:3000`.

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server Next.js en `http://localhost:3000` |
| `npm run build` | Genera cliente Prisma y compila para producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | Corre ESLint sobre el proyecto |
| `npm run db:generate` | Regenera el cliente Prisma a partir del schema |
| `npm run db:pull` | Sincroniza `schema.prisma` desde la BD real |
| `npm run db:push` | Empuja `schema.prisma` a la BD (usar con cuidado) |
| `npm run db:studio` | Abre Prisma Studio en el navegador |

## Estructura

Ver [CLAUDE.md §7](./CLAUDE.md) para la convención de carpetas y nombres.

## Estado actual

Fase 1 — Infraestructura base. Ver [CLAUDE.md §9](./CLAUDE.md) para el roadmap.
