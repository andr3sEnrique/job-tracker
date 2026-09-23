# Job Application Tracker

Dashboard privado para gestionar candidaturas de empleo. El objetivo final es alimentarlo
automáticamente desde Gmail: clasificar los emails, extraer los datos y mantener el historial de
cada candidatura.

> **Estado: fase 1 (foundation + frontend).** La UI funciona con datos de ejemplo generados de
> forma determinista. Backend, autenticación y Gmail llegan en las siguientes fases. Ver el
> [plan técnico](docs/PLAN_TECNICO.md).

## Stack

| Capa     | Tecnología                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo                                                                  |
| Web      | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query/Table, Recharts |
| Shared   | Zod 4: enums y contratos compartidos por web y api                                           |
| Api      | NestJS + Prisma + PostgreSQL _(fase 2)_                                                      |
| Calidad  | TypeScript strict, ESLint, Prettier, Vitest, GitHub Actions                                  |

## Estructura

```
apps/
  web/                  Next.js: dashboard
packages/
  shared/               Enums y schemas Zod (contratos de la API)
  tsconfig/             tsconfig base compartidos
  eslint-config/        Config ESLint compartida
docs/                   Plan técnico y decisiones
docker-compose.yml      PostgreSQL local (fase 2)
```

## Requisitos

- Node.js 22 LTS o superior (`nvm use` lee `.nvmrc`)
- pnpm 10 (`corepack enable pnpm`)
- Docker, solo a partir de la fase 2

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

La web queda en http://localhost:3000.

## Scripts

| Script           | Qué hace                                                |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Arranca `shared` en modo watch y la web                 |
| `pnpm build`     | Build de producción de todo el workspace                |
| `pnpm lint`      | ESLint en todos los paquetes                            |
| `pnpm typecheck` | `tsc --noEmit` (la web genera antes los tipos de rutas) |
| `pnpm test`      | Tests unitarios y de componentes (Vitest)               |
| `pnpm format`    | Prettier                                                |
| `pnpm db:up`     | Levanta PostgreSQL con Docker (fase 2)                  |

## Cómo está organizada la web

- **`src/lib/api`**: interfaz `ApiClient` y su implementación mock. En la fase 2 se sustituye por
  un cliente HTTP con la misma forma, así que los componentes no cambian.
- **`src/lib/mocks`**: dataset determinista y la lógica de filtrado y estadísticas, con tests.
  Sirve de referencia para los endpoints de la API.
- **Estado en la URL**: filtros, orden y paginación de `/applications` viven en los search params,
  validados con los schemas de `@jat/shared`.
- **Responsive**: la sidebar pasa a drawer y la tabla a tarjetas por debajo de `md`.

## Roadmap

1. **Foundation + frontend** ← _actual_
2. Backend (NestJS) + base de datos
3. Autenticación (Google OAuth, allowlist en backend)
4. Integración con Gmail
5. Clasificación de emails (reglas)
6. Sincronización automática
7. Extracción con IA
8. Endurecimiento para producción
