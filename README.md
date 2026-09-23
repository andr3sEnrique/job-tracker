# Job Application Tracker

Dashboard privado para gestionar candidaturas de empleo. El objetivo final es alimentarlo
automáticamente desde Gmail: clasificar los emails, extraer los datos y mantener el historial de
cada candidatura.

> **Estado: fase 6 (sincronización automática).** Los emails de Gmail se clasifican con reglas
> (EN/FR/ES) y crean o actualizan candidaturas y su historial; los casos dudosos van a una bandeja
> de revisión. Tras la carga inicial, la sincronización es incremental (Gmail History API) y se
> lanza sola desde un cron externo o un temporizador interno. El contenido de los emails nunca se
> guarda. Ver el [plan técnico](docs/PLAN_TECNICO.md).

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

Para iniciar sesión necesitas un cliente OAuth de Google y tu email en la allowlist: sigue
[docs/setup-google-cloud.md](docs/setup-google-cloud.md) (5 minutos) y copia
[.env.example](.env.example) a `.env`. El resto de variables tienen valores por defecto.

Para trabajar solo en la UI, sin API ni login: `pnpm dev:mock`.

## Scripts

| Script                  | Qué hace                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm dev`              | PostgreSQL + migraciones + api y web en modo watch                    |
| `pnpm dev:mock`         | Solo la web, con datos en memoria                                     |
| `pnpm build`            | Build de producción de todo el workspace                              |
| `pnpm lint`             | ESLint en todos los paquetes                                          |
| `pnpm typecheck`        | `tsc --noEmit` (genera antes el cliente Prisma y los tipos de rutas)  |
| `pnpm test`             | Tests unitarios y de componentes (Vitest)                             |
| `pnpm test:integration` | Tests de la API contra PostgreSQL real (Testcontainers)               |
| `pnpm db:seed`          | Datos de ejemplo (`-- --force` los reemplaza, `-- --clear` los borra) |
| `pnpm db:studio`        | Prisma Studio                                                         |
| `pnpm format`           | Prettier                                                              |

## API

Todas las rutas cuelgan de `/api/v1` y validan la entrada con los schemas Zod de `@jat/shared`.

| Método | Ruta                            | Descripción                                            |
| ------ | ------------------------------- | ------------------------------------------------------ |
| GET    | `/applications`                 | Listado con búsqueda, filtros, orden y paginación      |
| POST   | `/applications`                 | Alta manual (crea el evento inicial)                   |
| GET    | `/applications/:id`             | Detalle con historial de eventos                       |
| PATCH  | `/applications/:id`             | Edición parcial (bloquea los campos editados)          |
| POST   | `/applications/:id/status`      | Cambio de estado (registra un evento)                  |
| POST   | `/applications/:id/notes`       | Añade una nota al historial                            |
| DELETE | `/applications/:id`             | Borra la candidatura y su historial                    |
| GET    | `/stats/dashboard`              | KPIs, series y actividad reciente                      |
| GET    | `/gmail/connect`                | Autoriza acceso de solo lectura a Gmail (PKCE)         |
| GET    | `/gmail/callback`               | Guarda el refresh token cifrado                        |
| GET    | `/gmail/status`                 | Estado de la conexión, recuentos y última sync         |
| DELETE | `/gmail`                        | Revoca el acceso y borra los emails guardados          |
| POST   | `/sync/run`                     | Procesa un tramo de la sincronización (`hasMore`)      |
| POST   | `/internal/sync`                | Sync de todos los buzones + mantenimiento (cron)       |
| GET    | `/emails`                       | Emails relevantes, su clasificación y candidatura      |
| POST   | `/emails/:id/resolve`           | Revisión: confirmar, ignorar, asignar o crear          |
| POST   | `/emails/reprocess`             | Rehace todo lo derivado de emails (conserva lo manual) |
| GET    | `/health/live`, `/health/ready` | Liveness y readiness (públicas)                        |

**Seguridad:** todas las rutas exigen sesión salvo `health`, el login y `/internal/sync` (guard
global que deniega por defecto). `/internal/sync` no usa cookies: exige la cabecera
`X-Cron-Secret` (comparada en tiempo constante) y no existe si `CRON_SECRET` no está definido. Las peticiones que modifican datos requieren además la cabecera
`X-Requested-With` y un `Origin` válido (CSRF), y el login tiene rate limiting. Detalles en
[docs/setup-google-cloud.md](docs/setup-google-cloud.md#cómo-se-protege-el-acceso).

## Cómo se procesa un email

```
Gmail ─► prefiltro (cabeceras) ─► metadatos guardados
                                    │  al sincronizar, de más antiguo a más reciente:
                                    ▼
      cuerpo (solo en memoria) ─► clasificador ─► extractor ─► asociación ─► evento
                                   (reglas)       empresa,      hilo → URL →    + estado
                                                  puesto, URL   empresa+puesto  recalculado
```

- **Clasificador** (`apps/api/src/classification`): reglas por prioridad (rechazo > oferta >
  técnica > entrevista > envío > confirmación > alerta > recruiter). Detrás de la interfaz
  `EmailClassifier`, para añadir IA en la fase 7 sin tocar el resto.
- **Estado derivado del historial**: el estado de una candidatura se recalcula reproduciendo
  sus eventos con una máquina de estados que solo avanza, así que el orden de llegada de los
  emails no importa y deshacer (ignorar un email) es consistente.
- **Lo manual gana**: los campos editados a mano nunca se sobrescriben con datos de emails.
- **Evaluación**: `fake-mailbox.data.ts` contiene emails sintéticos EN/FR/ES con la categoría,
  empresa y puesto esperados; `dataset.spec.ts` exige acertarlos todos. Cuando un email real se
  clasifique mal, se añade aquí una versión anonimizada.

## Sincronización automática

| Tipo          | Cuándo                                                  | Cómo                                    |
| ------------- | ------------------------------------------------------- | --------------------------------------- |
| `INITIAL`     | Primera vez                                             | Búsqueda de los últimos 180 días        |
| `RESCAN`      | Cambiaron las reglas del prefiltro                      | Igual, reevaluando lo descartado        |
| `INCREMENTAL` | Resto de veces                                          | History API desde el último `historyId` |
| `FALLBACK`    | Gmail ya no tiene ese historial (≈ 1 semana, error 404) | Búsqueda desde la última sync − 1 día   |

- **Quién la lanza** (`sync_runs.trigger`): el botón (`USER`), el temporizador interno
  (`SCHEDULER`, con `SCHEDULER_ENABLED=true`) o un cron externo (`CRON`) que llama a
  `POST /api/v1/internal/sync`. En hosting gratuito la instancia se duerme y un temporizador
  interno no corre, así que en producción se usa el cron:
  [`.github/workflows/sync-cron.yml`](.github/workflows/sync-cron.yml) (secretos
  `SYNC_URL` y `CRON_SECRET`) o cualquier servicio tipo cron-job.org.
- **Tramos y reanudación**: cada llamada procesa un tramo acotado en tiempo; el checkpoint vive en
  `sync_runs`, y un lock con caducidad evita que el botón y el cron procesen lo mismo a la vez.
- **Mantenimiento** tras cada sync automática: las candidaturas en `APPLIED`/`SCREENING` sin
  actividad en 30 días (`GHOSTED_AFTER_DAYS`) pasan a `GHOSTED` con un evento `SYSTEM` (cualquier
  email posterior las reabre), y se borran las sesiones caducadas.

## Cómo está organizada la web

- **`src/lib/api`**: interfaz `ApiClient` con dos implementaciones: HTTP (valida cada respuesta
  con Zod) y mock en memoria (`NEXT_PUBLIC_API_MODE=mock`).
- **Proxy**: `next.config.ts` reescribe `/api/*` hacia la API, así que el navegador solo habla con
  un origen (sin CORS y con la cookie de sesión como cookie de primera parte).
- **`src/proxy.ts`**: redirige a `/login` si no hay cookie de sesión. Es solo UX; quien autoriza
  es la API.
- **`src/lib/mocks`**: dataset determinista y la lógica de filtrado y estadísticas, con tests.
  Sirve de referencia para los endpoints de la API.
- **Estado en la URL**: filtros, orden y paginación de `/applications` viven en los search params,
  validados con los schemas de `@jat/shared`.
- **Responsive**: la sidebar pasa a drawer y la tabla a tarjetas por debajo de `md`.

## Roadmap

1. ~~Foundation + frontend~~
2. ~~Backend (NestJS) + base de datos~~
3. ~~Autenticación (Google OAuth, allowlist en backend)~~
4. ~~Integración con Gmail~~
5. ~~Clasificación de emails (reglas)~~
6. **Sincronización automática** ← _actual_
7. Extracción con IA
8. Endurecimiento para producción
