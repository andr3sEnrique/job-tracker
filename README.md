# Job Application Tracker

Dashboard privado para gestionar candidaturas de empleo. El objetivo final es alimentarlo
automáticamente desde Gmail: clasificar los emails, extraer los datos y mantener el historial de
cada candidatura.

> **Estado: fase 2 (backend + base de datos).** Tracker manual completo: la web habla con una
> API NestJS sobre PostgreSQL. La autenticación (fase 3) todavía no existe: **no despliegues la API
> con datos reales** hasta entonces. Ver el [plan técnico](docs/PLAN_TECNICO.md).

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
  web/                  Next.js: dashboard (proxy /api/* → api)
  api/                  NestJS: REST API, Prisma schema, migraciones y seed
packages/
  shared/               Enums y schemas Zod (contratos de la API)
  tsconfig/             tsconfig base compartidos
  eslint-config/        Config ESLint compartida
docs/                   Plan técnico y decisiones
docker-compose.yml      PostgreSQL local (+ perfil `full` con la API en contenedor)
```

## Requisitos

- Node.js 22 LTS o superior (`nvm use` lee `.nvmrc`)
- pnpm 10 (`corepack enable pnpm`)
- Docker (PostgreSQL local y tests de integración)

## Puesta en marcha

```bash
pnpm install
pnpm dev          # levanta PostgreSQL, aplica migraciones y arranca api + web
pnpm db:seed      # (opcional) carga 46 candidaturas de ejemplo
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1 (health: `/api/v1/health/ready`)

No hace falta `.env`: todas las variables tienen valores por defecto para desarrollo (ver
[.env.example](.env.example)). Para trabajar solo en la UI sin API: `pnpm dev:mock`.

## Scripts

| Script                  | Qué hace                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | PostgreSQL + migraciones + api y web en modo watch                   |
| `pnpm dev:mock`         | Solo la web, con datos en memoria                                    |
| `pnpm build`            | Build de producción de todo el workspace                             |
| `pnpm lint`             | ESLint en todos los paquetes                                         |
| `pnpm typecheck`        | `tsc --noEmit` (genera antes el cliente Prisma y los tipos de rutas) |
| `pnpm test`             | Tests unitarios y de componentes (Vitest)                            |
| `pnpm test:integration` | Tests de la API contra PostgreSQL real (Testcontainers)              |
| `pnpm db:seed`          | Datos de ejemplo (`-- --force` para reemplazarlos)                   |
| `pnpm db:studio`        | Prisma Studio                                                        |
| `pnpm format`           | Prettier                                                             |

## API (fase 2)

Todas las rutas cuelgan de `/api/v1` y validan la entrada con los schemas Zod de `@jat/shared`.

| Método | Ruta                            | Descripción                                       |
| ------ | ------------------------------- | ------------------------------------------------- |
| GET    | `/applications`                 | Listado con búsqueda, filtros, orden y paginación |
| POST   | `/applications`                 | Alta manual (crea el evento inicial)              |
| GET    | `/applications/:id`             | Detalle con historial de eventos                  |
| PATCH  | `/applications/:id`             | Edición parcial (bloquea los campos editados)     |
| POST   | `/applications/:id/status`      | Cambio de estado (registra un evento)             |
| POST   | `/applications/:id/notes`       | Añade una nota al historial                       |
| DELETE | `/applications/:id`             | Borra la candidatura y su historial               |
| GET    | `/stats/dashboard`              | KPIs, series y actividad reciente                 |
| GET    | `/health/live`, `/health/ready` | Liveness y readiness (públicas)                   |

**Autorización provisional:** hasta la fase 3, un guard global asigna cada petición al usuario
`OWNER_EMAIL`. El resto del código ya trabaja con `request.user` y filtra siempre por `userId`,
así que la fase 3 solo sustituye ese guard.

## Cómo está organizada la web

- **`src/lib/api`**: interfaz `ApiClient` con dos implementaciones: HTTP (valida cada respuesta
  con Zod) y mock en memoria (`NEXT_PUBLIC_API_MODE=mock`).
- **Proxy**: `next.config.ts` reescribe `/api/*` hacia la API, así que el navegador solo habla con
  un origen (sin CORS y con cookies de primera parte para la fase 3).
- **`src/lib/mocks`**: dataset determinista y la lógica de filtrado y estadísticas, con tests.
  Sirve de referencia para los endpoints de la API.
- **Estado en la URL**: filtros, orden y paginación de `/applications` viven en los search params,
  validados con los schemas de `@jat/shared`.
- **Responsive**: la sidebar pasa a drawer y la tabla a tarjetas por debajo de `md`.

## Roadmap

1. ~~Foundation + frontend~~
2. **Backend (NestJS) + base de datos** ← _actual_
3. Autenticación (Google OAuth, allowlist en backend)
4. Integración con Gmail
5. Clasificación de emails (reglas)
6. Sincronización automática
7. Extracción con IA
8. Endurecimiento para producción
