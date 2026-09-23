# Job Application Tracker: plan técnico

> Documento de diseño previo a la implementación. Los límites de los free tiers cambian a menudo: donde cito cifras son orientativas. Lo importante es **qué deja de funcionar** si se superan.

---

## 0. Resumen de decisiones

| Decisión | Recomendación | Motivo principal |
|---|---|---|
| Repositorio | **Monorepo** con pnpm workspaces (Turborepo opcional) | Tipos compartidos, un único CI y un solo enlace de portfolio |
| Frontend | Next.js (App Router) + TS + Tailwind + shadcn/ui en **Vercel Hobby** | Gratis y sin fricción para Next.js |
| Backend | NestJS + TS en Docker, en **Render Free** | Gratis sin tarjeta y portable vía Docker |
| Base de datos | PostgreSQL en **Neon Free** | Postgres estándar, se apaga cuando no se usa (scale-to-zero), branching |
| ORM | **Prisma** | No hay razón fuerte para cambiarlo en este dominio |
| Autenticación | Google OAuth **implementado en NestJS**, sesión en cookie httpOnly y allowlist en el backend | El backend es la única autoridad |
| Cookies entre dominios | **Next.js reescribe `/api/*` hacia el backend** (patrón BFF) | Evita cookies de terceros y casi todo CORS |
| Colas / Redis | **No** al principio. La tabla `emails` actúa como cola. Si hiciera falta, pg-boss (usa Postgres) | El volumen es mínimo y BullMQ gasta la cuota gratis de Upstash |
| Sincronización automática | **Cron externo gratis** (cron-job.org o GitHub Actions) llama a `POST /internal/sync` y se usa Gmail History API | Render Free se duerme, así que un cron dentro del proceso no sirve |
| Gmail push (watch + Pub/Sub) | **Opcional y tardío** | Necesita un proyecto GCP con facturación; el polling basta |
| IA | Puerto `LlmProvider` con adaptadores y prefiltro por reglas | Proveedor intercambiable y coste mínimo |
| Contenido de emails | **No se guarda el cuerpo**. Solo metadatos y datos extraídos. Gmail es la fuente de verdad y se puede volver a descargar | Minimizar datos personales |

---

## 1. Monorepo vs. dos repositorios

**Recomiendo la opción A: monorepo.**

| Criterio | Monorepo | Dos repos |
|---|---|---|
| Tipos y contratos API compartidos | Directo (`packages/shared`) | Hay que publicar un paquete npm o duplicar tipos |
| Cambios que tocan API y UI | Una sola PR, atómica | Dos PRs coordinadas |
| CI/CD | Un workflow | Dos workflows duplicados |
| Portfolio | Un enlace que enseña el sistema completo | Fragmentado |
| Complejidad | Algo de configuración de workspaces | Menos al inicio y más fricción después |
| Despliegue | Vercel y Render permiten indicar el *root directory* | Trivial |

**Cómo mantenerlo simple:**
- pnpm workspaces es suficiente. Turborepo solo aporta caché y orquestación de tareas. Lo añadiría cuando el CI tarde más de unos pocos minutos, o desde el principio si te interesa por portfolio (es un único `turbo.json`).
- Solo 2 apps y 2 o 3 paquetes. Nada de `packages/ui` o `packages/db` mientras un único consumidor los use.
- **Prisma vive en `apps/api`**, no en un paquete, porque el frontend nunca accede a la base de datos.

**Alternativas descartadas:**
- *Solo Next.js* (API routes + Server Actions, todo en Vercel): es más simple de alojar, pero los tiempos máximos de las funciones complican las sincronizaciones largas y renuncias a NestJS, que quieres para tu perfil.
- *Supabase todo en uno* (auth, DB, edge functions, pg_cron): es tentador, pero te acopla a ese proveedor y deja NestJS casi sin papel.

---

## 2. Stack definitivo

| Capa | Elección | Notas |
|---|---|---|
| Runtime | Node.js **24 LTS** | Fijado con `.nvmrc` y `engines` |
| Package manager | **pnpm 10** | Fijado con el campo `packageManager` |
| Frontend | Next.js, React, TS, Tailwind, **shadcn/ui**, **TanStack Query**, **TanStack Table**, Recharts (charts de shadcn), react-hook-form | |
| Backend | NestJS, TS, **nestjs-pino**, @nestjs/terminus, @nestjs/throttler, google-auth-library / googleapis | |
| Validación | **Zod** en `packages/shared`, compartido por web y api (nestjs-zod) | Una sola fuente de verdad de los contratos. Alternativa: class-validator + OpenAPI generado |
| DB | PostgreSQL 17 + Prisma | La extensión `pg_trgm` para búsqueda difusa |
| Tests | **Vitest** (web y api; en Nest con SWC), Supertest, Testcontainers, **Playwright** | Si Vitest da fricción con Nest, Jest en la api es aceptable |
| Calidad | ESLint (flat config), Prettier, TS `strict`, lint-staged + husky (opcional) | |
| Errores | Sentry, plan gratuito Developer | |

Único cambio sobre tu stack: **Zod como contrato compartido**. Es la mayor ventaja práctica del monorepo.

---

## 3. Backend: módulos de NestJS

Evitaría llamar **`JobsModule`** a los trabajos en segundo plano, porque en este dominio "job" significa "oferta de empleo". Uso `SyncModule` para eso.

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| **ConfigModule** | Carga y **valida las variables de entorno con Zod al arrancar** (falla rápido) | — |
| **PrismaModule** (global) | `PrismaService`, ciclo de vida de la conexión | Config |
| **AuthModule** | Login con Google, verificación del ID token, **allowlist**, sesiones, `SessionGuard` global que deniega por defecto, decorador `@Public()` | Users, Prisma |
| **UsersModule** | Entidad usuario (fina; existe para que todo tenga `userId` y el paso a multiusuario sea posible) | Prisma |
| **GmailModule** | *Adaptador de infraestructura*: OAuth de conexión a Gmail, cifrado de tokens, cliente Gmail (list, get, history, watch). **Sin lógica de negocio.** Expone una interfaz `MailProvider` con una implementación falsa basada en fixtures para dev y tests | Config, Prisma, Crypto |
| **SyncModule** | Orquesta la sincronización inicial e incremental, el lock, `sync_runs` y el endpoint `/internal/sync` protegido con secreto | Gmail, Emails |
| **EmailsModule** | Persiste metadatos y ejecuta el **pipeline** (normalizar, filtrar, clasificar, extraer, asociar). Expone la bandeja "needs review" | Classification, Applications |
| **ClassificationModule** | Interfaces `EmailClassifier` y `DataExtractor`. `RulesClassifier` al principio y `AiClassifier` en la fase 7. **Lógica pura sin base de datos**, así que es fácil de testear | Ai (fase 7) |
| **ApplicationsModule** | CRUD, **matching**, **máquina de estados** del status y eventos (`ApplicationEventsService` dentro del mismo módulo) | Prisma |
| **StatisticsModule** | Consultas agregadas de solo lectura para el dashboard | Prisma |
| **AiModule** (fase 7) | Puerto `LlmProvider`, adaptadores, prompts versionados, control de presupuesto y uso | Config, Prisma |
| **HealthModule** | `/health/live` y `/health/ready` | Prisma |
| `common/` (no es módulo de dominio) | Guards, decorators, filtros de excepción, `EncryptionService`, config de logging y redacción | — |

**Dirección de dependencias** (sin ciclos):

```
Auth ─► Users
Sync ─► Gmail
Sync ─► Emails ─► Classification ─► Ai
          └────► Applications
Statistics ─► (Prisma, solo lectura)
```

**API REST** con prefijo `/api/v1`:
- `auth/google`, `auth/google/callback`, `auth/me`, `auth/logout`
- `gmail/connect`, `gmail/callback`, `gmail/status`, `DELETE gmail` (desconecta y borra datos)
- `sync/run` (manual, con sesión), `internal/sync` (cron, con secreto)
- `applications` (CRUD, filtros, paginación), `applications/:id/events`
- `emails/review` (clasificación dudosa), `emails/:id/reclassify`
- `stats/summary`, `stats/timeline`, `stats/status-distribution`, `stats/funnel`, `stats/by-source`

---

## 4. Modelo de datos conceptual

Convenciones:
- PK de tipo `uuid` (v7 si la versión de Prisma lo soporta, porque es ordenable).
- Todas las fechas en `timestamptz` UTC.
- `created_at` y `updated_at` en todas las tablas.
- Enums de Postgres para status y categorías.

### users
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| google_sub | text | **UNIQUE**. ID estable de Google; se usa para identificar, no el email |
| email | text | UNIQUE |
| name, avatar_url | text | |
| last_login_at | timestamptz | |

### sessions
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK a users (on delete cascade) |
| token_hash | text | **UNIQUE**. SHA-256 del token; el token en claro solo existe en la cookie |
| expires_at, last_seen_at | timestamptz | Índice en `expires_at` para limpiar sesiones caducadas |
| user_agent | text | Opcional |

### gmail_connections
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK a users. UNIQUE(user_id, google_email) |
| google_email | text | |
| scopes | text[] | Scopes concedidos realmente |
| refresh_token_enc | text | **Cifrado con AES-256-GCM** |
| key_version | int | Para rotar la clave |
| status | enum | `ACTIVE`, `NEEDS_REAUTH`, `REVOKED`, `ERROR` |
| last_history_id | text | Cursor incremental de Gmail |
| last_synced_at | timestamptz | |
| sync_locked_until | timestamptz | Lock por lease para evitar sincronizaciones concurrentes |
| watch_expires_at | timestamptz | Solo si se usa Gmail watch |

### sync_runs (auditoría y métricas de sincronización)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| connection_id | uuid | FK a gmail_connections |
| type | enum | `INITIAL`, `INCREMENTAL`, `MANUAL`, `FALLBACK` |
| status | enum | `RUNNING`, `SUCCESS`, `PARTIAL`, `FAILED` |
| started_at, finished_at | timestamptz | Índice (connection_id, started_at desc) |
| page_token | text | Checkpoint para reanudar la sincronización inicial por tramos |
| messages_listed, fetched, processed, failed | int | |
| error_code | text | **Código, nunca el mensaje completo con datos** |

### companies
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| name | text | |
| normalized_name | text | **UNIQUE**, en minúsculas y sin "S.L.", "Inc", etc. Índice trigram |
| domain | text | Índice. Clave para el matching por remitente |

Es una tabla pequeña, pero aporta mucho al matching y a las estadísticas por empresa.

### applications
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK a users |
| company_id | uuid | FK a companies |
| role_title | text | Índice trigram |
| location | text | |
| work_mode | enum | `REMOTE`, `HYBRID`, `ONSITE`, `UNKNOWN` |
| salary_min, salary_max | int | Nullable |
| salary_currency, salary_period | text / enum | |
| source | enum | `LINKEDIN`, `INDEED`, `INFOJOBS`, `COMPANY_SITE`, `REFERRAL`, `RECRUITER`, `OTHER` |
| job_url | text | Nullable. Índice (para matching) |
| external_job_id | text | ID de oferta del ATS si se extrae |
| status | enum | Ver abajo |
| applied_at | timestamptz | |
| last_activity_at | timestamptz | |
| origin | enum | `EMAIL`, `MANUAL` |
| needs_review | bool | Creada automáticamente con poca confianza |
| locked_fields | text[] | Campos editados a mano que la automatización **no puede sobrescribir** |
| notes | text | |
| archived | bool | |

Índices: (user_id, status), (user_id, last_activity_at desc), (user_id, applied_at), company_id.

**ApplicationStatus:** `APPLIED`, `SCREENING`, `INTERVIEWING`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `GHOSTED`. "Activa" significa cualquiera excepto `ACCEPTED`, `REJECTED`, `WITHDRAWN` y `GHOSTED`. `GHOSTED` se puede calcular tras N días sin actividad.

### application_events (historial)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| application_id | uuid | FK a applications (cascade). Índice (application_id, occurred_at) |
| type | enum | `APPLIED`, `CONFIRMATION_RECEIVED`, `RECRUITER_CONTACT`, `INTERVIEW_SCHEDULED`, `TECHNICAL_INTERVIEW_SCHEDULED`, `OFFER_RECEIVED`, `REJECTED`, `WITHDRAWN`, `STATUS_CHANGED`, `NOTE` |
| from_status, to_status | enum | Nullable |
| occurred_at | timestamptz | Fecha del email, no la del procesamiento |
| source | enum | `EMAIL`, `MANUAL`, `SYSTEM` |
| email_id | uuid | FK a emails, nullable, **UNIQUE**. Un email genera como máximo un evento (idempotencia) |
| metadata | jsonb | Por ejemplo la fecha de entrevista extraída |

### email_threads
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| connection_id | uuid | FK a gmail_connections |
| gmail_thread_id | text | **UNIQUE(connection_id, gmail_thread_id)** |
| application_id | uuid | FK nullable. **El hilo es la señal de matching más fiable** |
| first_message_at, last_message_at | timestamptz | |
| message_count | int | |

### emails (solo metadatos)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| connection_id | uuid | FK a gmail_connections |
| thread_id | uuid | FK a email_threads |
| gmail_message_id | text | **UNIQUE(connection_id, gmail_message_id)**. Es la clave de idempotencia |
| rfc822_message_id | text | Permite abrir el email en Gmail vía búsqueda `rfc822msgid:` |
| from_email, from_name | text | |
| from_domain | text | Índice |
| subject | text | |
| received_at | timestamptz | Índice |
| gmail_labels | text[] | |
| category | enum | `APPLICATION_SUBMITTED`, `APPLICATION_CONFIRMATION`, `RECRUITER_REPLY`, `INTERVIEW`, `TECHNICAL_INTERVIEW`, `REJECTION`, `OFFER`, `JOB_ALERT`, `IRRELEVANT`, `UNKNOWN` |
| confidence | real | 0 a 1 |
| classifier | text | `rules@v3`, `ai:claude-haiku-4-5@prompt-v2`… |
| extracted | jsonb | Empresa, puesto, salario, URL… |
| processing_status | enum | `PENDING`, `PROCESSED`, `SKIPPED`, `NEEDS_REVIEW`, `FAILED`. Índice (processing_status, next_attempt_at) |
| attempts | int | |
| next_attempt_at | timestamptz | |
| error_code | text | |
| application_id | uuid | FK nullable |

**Qué no se guarda:** cuerpo, HTML, adjuntos ni destinatarios (to/cc). El snippet queda desactivado por defecto.

### ai_runs (fase 7)
| Campo | Tipo | Notas |
|---|---|---|
| id, email_id | uuid | FK a emails. Índice created_at |
| provider, model, prompt_version | text | |
| input_tokens, output_tokens, latency_ms | int | |
| cost_usd_estimate | numeric | Para el límite de presupuesto mensual |
| status | enum | `OK`, `INVALID_OUTPUT`, `ERROR`, `SKIPPED_BUDGET` |

**Relaciones principales:**

```
users 1─N sessions
users 1─N gmail_connections 1─N email_threads 1─N emails
users 1─N applications N─1 companies
applications 1─N application_events 0..1─1 emails
applications 1─N email_threads, applications 1─N emails
emails 1─N ai_runs
```

---

## 5. Autenticación y autorización

### Flujo

```
Navegador ──► app.vercel.app/api/v1/auth/google   (rewrite de Next al backend)
          ◄── 302 a Google (scopes: openid email profile, state + PKCE)
Google    ──► app.vercel.app/api/v1/auth/google/callback ──► NestJS
NestJS:  1. valida state y PKCE, intercambia el code
         2. verifica el ID token (firma, iss, aud = CLIENT_ID, exp, email_verified)
         3. ALLOWLIST: ¿sub/email en ALLOWED_GOOGLE_EMAILS? Si no → 403, sin crear usuario
         4. upsert del usuario, crea la sesión (token aleatorio de 32 bytes; guarda su hash)
         5. Set-Cookie: sid=…; HttpOnly; Secure; SameSite=Lax; Path=/
          ──► 302 /dashboard
Cada request ──► SessionGuard global: cookie → hash → sesión válida → usuario en allowlist
```

### Decisiones clave

- **Login y conexión con Gmail son dos flujos OAuth separados**, sobre el mismo OAuth client con autorización incremental. El login solo pide `openid email profile`, y `gmail.readonly` se pide en "Conectar Gmail". Así se aplica el mínimo privilegio y el login sigue funcionando aunque se revoque Gmail.
- **NestJS es la única autoridad de autenticación.** Descarto Auth.js en Next porque crearía dos fuentes de verdad y obligaría a Nest a validar JWT de otro sistema.
- **Sesiones opacas en DB en vez de JWT.** Para un solo usuario son más simples, **revocables al instante** y no hay que gestionar rotación ni blacklist de JWT.
- **Next.js reescribe `/api/*` hacia el backend.** El frontend en Vercel y el backend en Render son *sites* distintos, y las cookies de terceros están bloqueadas o en retirada. Con el rewrite, la cookie es de primera parte en el dominio de Vercel. Sin dominio propio (de pago), es la solución más limpia. Hay que verificar pronto (fase 3) que Vercel propaga bien `Set-Cookie` en el rewrite. El plan B es un Route Handler de Next que actúe de proxy.

### Cómo se impide que otra cuenta de Google acceda

1. Allowlist en el callback. Se compara preferiblemente `google_sub` (estable) además del email, con `email_verified = true`.
2. `SessionGuard` global que **deniega por defecto** con `APP_GUARD`. Solo `@Public()` en health y auth.
3. En cada request el guard vuelve a comprobar que el usuario sigue en la allowlist. Si cambias la variable de entorno, las sesiones viejas mueren.
4. **Todas las consultas se filtran por `userId`** de la sesión, nunca por un parámetro del cliente. Evita IDOR y prepara el multiusuario.
5. El middleware de Next que redirige a `/login` es **solo UX**, no seguridad.
6. Endpoints internos (cron): header `X-Cron-Secret` comparado con `timingSafeEqual` y rate limit.

---

## 6. Integración con Gmail

### 6.1 OAuth 2.0 y la trampa del modo "Testing"

- Proyecto en Google Cloud Console (gratis), Gmail API habilitada, OAuth client de tipo "Web". Mejor **dos clients**: uno para dev (redirect a localhost) y otro para prod.
- `access_type=offline` + `prompt=consent` en la conexión de Gmail, para obtener el refresh token.
- **Punto crítico:** si la pantalla de consentimiento está en **"Testing"**, los refresh tokens de scopes que no son básicos **caducan a los 7 días**, y la sincronización automática se rompería cada semana.
  - **Solución:** poner la app en estado **"In production"** sin verificar. Google exime de verificación a las apps de uso personal (menos de 100 usuarios conocidos). Verás el aviso "Google no ha verificado esta app" y lo aceptas tú mismo.
  - La verificación formal de un scope *restricted* exige una auditoría de seguridad (CASA) de pago. No la necesitas.
  - Conviene revisar la política vigente de Google al llegar a la fase 4.
- Aunque la app esté en producción, **cualquiera podría completar el consentimiento de Google, pero el backend lo rechaza** con la allowlist.

### 6.2 Scopes

| Scope | Qué permite | Veredicto |
|---|---|---|
| `gmail.metadata` | Solo cabeceras y etiquetas; **no permite el parámetro `q` de búsqueda** ni leer el cuerpo | Demasiado limitado: sin cuerpo no se extraen salario, ubicación ni URL |
| **`gmail.readonly`** | Leer mensajes | **Recomendado.** El cuerpo se procesa en memoria y se descarta |
| `gmail.modify` | Además, aplicar etiquetas | Solo si más adelante quieres etiquetar emails en Gmail. No al principio |

### 6.3 Tokens

| Token | Vida | Dónde |
|---|---|---|
| Authorization code | Segundos, un solo uso | Nunca se persiste ni se loguea |
| **Access token** | Unos 60 minutos | **Solo en memoria** del proceso. Se renueva bajo demanda con google-auth-library |
| **Refresh token** | Larga (hasta que se revoque) | DB, **cifrado con AES-256-GCM**: IV aleatorio por cifrado, formato `v1:iv:ciphertext:tag`, clave de 32 bytes en la variable `TOKEN_ENCRYPTION_KEY` y `key_version` para rotar. Detrás de una interfaz `EncryptionService`, para migrar después a KMS (AWS/GCP) sin tocar el resto |
| ID token de login | Corta | Se verifica y se descarta |

Ningún token de Google llega nunca al navegador. Si Google rota el refresh token (evento `tokens` del cliente), se persiste el nuevo.

### 6.4 Sincronización inicial (backfill)

1. Guardar `historyId` con `users.getProfile` **antes** de empezar. Será el punto de partida del modo incremental y así no se pierde nada que llegue durante el backfill.
2. `messages.list` con una ventana configurable (por ejemplo 6 o 12 meses) y una query de prefiltro:
   - **Remitentes de ATS y portales:** greenhouse, lever, ashby, workday, smartrecruiters, workable, teamtailor, recruitee, personio, linkedin, indeed, infojobs, welcometothejungle, getmanfred, tecnoempleo…
   - **Palabras clave en asunto**, en ES, EN y FR si aplica: candidatura, application, entrevista, interview, oferta, offer…
3. **Descarga en dos etapas para ahorrar:**
   - `messages.get(format=metadata)` en batch trae cabeceras (From, Subject, Date, List-Unsubscribe, Message-ID) y el prefiltro por reglas decide.
   - `messages.get(format=full)` **solo para los candidatos**.
4. Se procesa **por tramos** (por ejemplo 100 mensajes por invocación) guardando `page_token` en `sync_runs`. Así la sincronización se reanuda si el proceso se duerme o se reinicia (Render Free).

### 6.5 Detectar emails nuevos

| Opción | Cómo funciona | Coste | Veredicto |
|---|---|---|---|
| **History API + polling** | `history.list(startHistoryId, historyTypes=messageAdded)` cada 15–30 minutos, lanzado por un cron externo | Gratis y ligero | **Recomendado** |
| `users.watch` + Pub/Sub push | Gmail publica en un topic de Pub/Sub, que llama por push a tu endpoint. Hay que renovar el watch antes de 7 días | Pub/Sub necesita un proyecto GCP **con facturación activada** (aunque quede dentro del free tier) | Opcional más adelante; aporta portfolio, pero no es necesario |

Si `history.list` devuelve **404** (el historyId ha caducado, normalmente tras una semana o más sin sincronizar), se hace un **fallback**: resync parcial desde `last_synced_at` menos un margen de 1 día.

### 6.6 Evitar procesar dos veces el mismo email

- **UNIQUE(connection_id, gmail_message_id)** con `upsert`. Aunque el mismo mensaje entre dos veces, no se duplica.
- **UNIQUE(email_id)** en `application_events`: un email produce como máximo un evento.
- `processing_status`: solo se procesan los emails `PENDING` o `FAILED` cuyo `next_attempt_at` ya ha pasado, seleccionados con `SELECT … FOR UPDATE SKIP LOCKED`.
- **Lock de sincronización** por conexión (`sync_locked_until`, un lease de unos minutos). Si coinciden el cron y un sync manual, el segundo sale sin hacer nada.
- Todo el pipeline es idempotente, así que reintentar es seguro.

### 6.7 Errores

| Error | Acción |
|---|---|
| `invalid_grant` al refrescar (revocado o caducado) | `status = NEEDS_REAUTH`, parar la sincronización, banner en la UI con "Reconectar Gmail" y evento en Sentry |
| 401 en una llamada | Refrescar una vez y reintentar |
| 429, 403 `rateLimitExceeded` o 5xx | Backoff exponencial con jitter y máximo de reintentos |
| Fallo al procesar un email | `attempts++` y `next_attempt_at` con backoff. Tras N intentos pasa a `FAILED` y aparece en la UI. **No bloquea el resto del lote** |
| History 404 | Fallback (ver 6.5) |

"Desconectar y borrar": se revoca el token en el endpoint de revocación de Google y se borran la conexión, los emails y los hilos. Las candidaturas se conservan, con opción de borrarlas también.

### 6.8 Minimización de datos

**Guardar solo** message ID, thread ID, RFC822 Message-ID, remitente (nombre, email y dominio), asunto, fecha, etiquetas, categoría, confianza, versión del clasificador y metadatos extraídos.

- **No hace falta guardar el cuerpo para reprocesar.** Gmail es la fuente de verdad: si mejoras el clasificador, vuelves a descargar el mensaje por su ID.
- **Para ver el email original**, un enlace a Gmail con la búsqueda `rfc822msgid:<id>` lo abre sin que tu app almacene el contenido.

---

## 7. Pipeline de procesamiento

```
Cron externo / botón "Sync" ─► POST /internal/sync | /sync/run
  │  (todo dentro del proceso NestJS, síncrono y en lotes acotados)
  ▼
[1] Fetch        GmailModule   history.list o list → ids nuevos
[2] Persist      EmailsModule  upsert de metadatos (status PENDING) ← idempotencia aquí
[3] Prefilter    Emails        reglas baratas con cabeceras (remitente, asunto, List-Unsubscribe)
                               → no candidato: SKIPPED / IRRELEVANT. No se descarga el cuerpo
[4] Fetch body   Gmail         format=full solo para candidatos (en memoria)
[5] Normalize    Emails        decodificar MIME, HTML→texto, quitar citas y firmas, truncar
[6] Classify     Classification  reglas (fase 5); IA solo si las reglas no están seguras (fase 7)
[7] Extract      Classification  plantillas conocidas (LinkedIn, Greenhouse…) + regex; IA después
[8] Match        Applications  hilo → URL / ID de oferta → empresa+dominio+puesto → nueva o revisión
[9] Upsert app   Applications  crear o actualizar respetando locked_fields
[10] Event       Applications  application_event con máquina de estados
[11] Finalize    Emails        PROCESSED o NEEDS_REVIEW; el cuerpo se descarta
```

**Matching**, por orden de fiabilidad:
1. El hilo de Gmail ya está vinculado a una candidatura.
2. La URL o el ID de oferta extraídos coinciden.
3. La empresa normalizada o el dominio del remitente (o el slug del ATS, como `boards.greenhouse.io/<empresa>`) coinciden, y el puesto es similar (trigram por encima de un umbral) entre las candidaturas activas.
4. Coincide la empresa y solo hay una candidatura activa con ella: se asocia con confianza media.
5. Si no hay match:
   - Un email de tipo "submitted" o "confirmation" crea una candidatura nueva.
   - Un rechazo o entrevista sin match también la crea, pero con `needs_review = true`, porque pudiste postular fuera de lo que se rastrea.

**Máquina de estados:**
- Los eventos siempre se añaden al historial.
- El status solo **avanza** según un ranking: una confirmación tardía no devuelve a `APPLIED` algo que está en `INTERVIEWING`.
- Los estados terminales (rechazo u oferta) se pueden alcanzar desde cualquier estado.
- Las ediciones manuales ganan y se registran en `locked_fields`.

**Bandeja de revisión:** los emails con confianza baja aparecen en la UI. La corrección manual es parte esencial del producto y además genera datos para evaluar el clasificador.

### ¿Hacen falta colas, Redis o BullMQ?

| Pieza | ¿Aporta valor? | Decisión |
|---|---|---|
| **Redis + BullMQ** | Con decenas de emails al día, no. Además, **BullMQ hace polling constante y agota la cuota gratis de comandos de Upstash** | **No** |
| **Cola en Postgres** | La columna `processing_status` con `SKIP LOCKED` ya ofrece reintentos, backoff y dead-letter (estado `FAILED`) | **Sí**, desde la fase 4 |
| **pg-boss** | Cola sobre Postgres. Útil si llega a haber muchos tipos de job o concurrencia real | Solo si hace falta, sin infraestructura extra |
| **Cron dentro del proceso** (`@nestjs/schedule`) | Render Free se duerme tras unos 15 minutos sin tráfico, y un proceso dormido no ejecuta crons | **No** en Render Free (sí si migras a una VM o contenedor siempre encendido) |
| **Cron externo** (cron-job.org, GitHub Actions) | Despierta el backend y dispara la sincronización | **Sí**, en la fase 6 |
| **Webhooks** (Gmail push vía Pub/Sub) | Latencia casi nula, pero requiere facturación en GCP | Opcional |

**Dónde se ejecuta:** todo en el proceso de la API, **de forma síncrona dentro de la petición de sincronización y en lotes acotados** (por ejemplo, hasta 50 emails por invocación). Lo que queda pendiente se procesa en la siguiente llamada. No se responde con 202 para seguir trabajando en segundo plano, porque la instancia podría dormirse a mitad.

---

## 8. IA (fase 7)

### Arquitectura desacoplada

```
EmailsModule ─► EmailAnalyzer (dominio)          ← lo que le importa al negocio
                   │ usa
                   ▼
               LlmProvider (puerto genérico)      ← generateStructured<T>(prompt, zodSchema, tier)
                   │ implementan
       ┌───────────┼─────────────┬──────────────┐
  AnthropicAdapter  OpenAIAdapter  GeminiAdapter  OllamaAdapter (local/dev)
```

- **`EmailAnalyzer`** conoce el dominio: prompts versionados (`prompt_version`), esquema de salida y candidaturas candidatas para el matching.
- **`LlmProvider`** es genérico: recibe texto y un schema y devuelve un objeto validado más el uso de tokens. No sabe nada de emails.
- El adaptador se elige por variable de entorno (`AI_PROVIDER`, `AI_MODEL`). Cambiar de proveedor es cambiar esa variable y añadir un adaptador.
- La salida **siempre se valida con Zod** aunque el proveedor soporte *structured outputs*. Si la validación falla, se guarda `INVALID_OUTPUT` y se vuelve a las reglas.
- Opcionalmente los adaptadores pueden usar el AI SDK de Vercel por dentro. Tu puerto sigue siendo tuyo, así que no te acoplas a esa librería.
- Proveedor por defecto: un modelo pequeño y barato, como **Claude Haiku 4.5**, es suficiente para clasificar y extraer.

### Una sola llamada por email

La IA debe cubrir cuatro tareas: clasificar, extraer, detectar el cambio de estado y asociar a una candidatura. Todo se hace **en una única llamada**: el prompt recibe el email limpio y las 3 a 5 candidaturas candidatas preseleccionadas de forma determinista, y devuelve `{category, confidence, extracted, statusChange, matchApplicationId | "new"}`.

### Control de costes

1. El prefiltro de reglas y la descarga en dos etapas hacen que los emails irrelevantes **nunca lleguen a la IA**.
2. Si las reglas tienen alta confianza (plantillas conocidas de LinkedIn o Greenhouse), **no se llama a la IA**.
3. Entrada recortada: asunto, dominio del remitente y cuerpo limpio y truncado (unos 2–4k caracteres).
4. Nunca se reprocesa lo ya procesado. La tabla `ai_runs` funciona como caché y auditoría.
5. **Límite de presupuesto mensual** (`AI_MONTHLY_BUDGET_USD`): al superarlo se abre un circuit breaker y el sistema vuelve a solo reglas.
6. Para el backfill inicial, usar la **Batch API** del proveedor (más barata).

### Privacidad

- Usar APIs cuyos términos no entrenen con los datos (las APIs de pago de Anthropic y OpenAI no lo hacen por defecto).
- **Evitar tiers gratuitos que puedan usar los datos para entrenar** con emails reales.
- Redactar teléfonos y emails del cuerpo antes de enviarlo.
- Ollama sirve para desarrollo local, gratis y privado.

### Evaluación (valor de portfolio)

Un dataset de emails **anonimizados** como fixtures y un test que mide la precisión del clasificador de reglas o de IA. **Nunca se commitean emails reales.**

---

## 9. Frontend

### Rutas (App Router)

```
app/
├── (auth)/login/                 botón "Continuar con Google"
├── (dashboard)/                  layout con sidebar y topbar
│   ├── page.tsx                  Overview: KPIs + gráficos + actividad reciente
│   ├── applications/             tabla + búsqueda + filtros (estado en la URL)
│   │   ├── [id]/                 detalle + timeline de eventos + emails vinculados
│   │   └── new/                  alta manual
│   ├── review/                   emails de clasificación dudosa o sin asociar
│   └── settings/                 conexión Gmail, estado de sincronización, sync manual,
│                                 historial de sync_runs, desconectar y borrar datos
└── middleware.ts                 redirección a /login si no hay cookie (solo UX)
```

### Dashboard

- **KPIs:** total, activas, entrevistas, ofertas y rechazadas.
- **Gráficos:** candidaturas por semana (líneas o barras), distribución por estado (barras horizontales, más legibles que un donut), funnel aplicado → entrevista → oferta, y por fuente.
- **Tabla:** TanStack Table con ordenación, paginación y filtros por estado, fuente, rango de fechas, modalidad, empresa y búsqueda de texto. Los filtros se guardan en los search params para poder compartir o recargar la vista.
- **Detalle:** datos editables, timeline vertical de eventos, enlace "Abrir en Gmail" y notas.

### Decisiones

- **Fetching en cliente con TanStack Query** a través del proxy `/api`. Es un dashboard privado, sin SEO, con mucha interacción, y así se evita reenviar cookies desde Server Components a un backend externo. Los Server Components se usan para el layout y el shell.
- Formularios con react-hook-form y los **mismos schemas Zod** que valida el backend.
- **Responsive:** el sidebar pasa a un drawer (Sheet), la tabla a una lista de tarjetas en móvil y los KPIs a una rejilla de 2 columnas.
- Modo oscuro con los temas de shadcn: sale casi gratis.

---

## 10. Seguridad

| Área | Medida |
|---|---|
| **OAuth** | `state` y **PKCE**. Redirect URIs exactos registrados en Google. Verificación completa del ID token. Login y Gmail separados |
| **Tokens** | Refresh token cifrado con AES-256-GCM y clave en variable de entorno. Access token solo en memoria. Nada llega al navegador |
| **Cookies** | `HttpOnly; Secure; SameSite=Lax`, rotación al hacer login, expiración de 7 a 30 días |
| **Sesión vs. JWT** | Sesión opaca en DB, revocable. En DB solo se guarda el hash del token |
| **CORS** | Con el proxy, el navegador solo habla con su propio origen. El backend **no habilita CORS** (o solo para `FRONTEND_URL`) |
| **CSRF** | SameSite=Lax, comprobación del header `Origin` en métodos que modifican estado y un header personalizado obligatorio (`X-Requested-With`) |
| **XSS** | React escapa por defecto. **Nunca `dangerouslySetInnerHTML`**, y además no se guarda el HTML de los emails. CSP estricta en Next y helmet en Nest |
| **SQL injection** | Prisma parametriza. En las estadísticas, `$queryRaw` con tagged template, **nunca `$queryRawUnsafe`** |
| **Secretos** | Solo en los paneles de Vercel, Render y GitHub Secrets. `.env` en `.gitignore`, `.env.example` sin valores. GitHub secret scanning y push protection activados |
| **Variables de entorno** | Validadas con Zod al arrancar. La web solo expone `NEXT_PUBLIC_*` que no sean sensibles |
| **Rate limiting** | @nestjs/throttler (en memoria basta con una sola instancia): estricto en `/auth/*`, `/sync/*` e `/internal/*` |
| **API** | Guard global que deniega por defecto. `/internal/*` con secreto comparado en tiempo constante. Swagger desactivado en producción o detrás de la autenticación |
| **Gmail scopes** | Solo `gmail.readonly`, sin permiso para enviar ni modificar |
| **Datos personales** | Minimización (sin cuerpos), borrado completo disponible, Neon con TLS, backups cifrados si se hacen |
| **Dependencias** | Dependabot, `pnpm audit` en CI y lockfile commiteado |
| **Repo público** | Recomendado por portfolio. Ni secretos, ni emails reales en fixtures, ni la allowlist en el código (va en variable de entorno) |

### Qué NO debe aparecer nunca en los logs

- Access, refresh e ID tokens de Google, y authorization codes.
- Cookies de sesión, header `Authorization`, `X-Cron-Secret` y el parámetro `state` de OAuth.
- `TOKEN_ENCRYPTION_KEY`, API keys de IA y `DATABASE_URL`.
- **Cuerpos o snippets de email, ni asuntos completos.** Se loguea el `gmail_message_id` o el `email.id` interno.
- Direcciones de email completas (enmascarar, por ejemplo `a***@gmail.com`).
- Prompts y respuestas de IA con contenido de emails.
- Bodies de request y response de endpoints de auth y Gmail.

Se implementa con `redact` de pino, `sendDefaultPii: false` y un `beforeSend` en Sentry que elimina cookies, headers y bodies.

---

## 11. Deployment con free tiers

| Servicio | Proveedor | Aloja | Limitaciones relevantes | Si se supera el límite |
|---|---|---|---|---|
| Frontend | **Vercel Hobby** | Next.js y el proxy `/api` | Solo uso no comercial; cuotas de ancho de banda e invocaciones (sobradas) | Proyecto pausado hasta el siguiente ciclo |
| Backend | **Render Free** (web service con Docker) | NestJS | **Se duerme tras unos 15 minutos sin tráfico** y el arranque en frío tarda de 30 a 60 s. Unas 750 horas al mes por workspace, 512 MB de RAM y CPU limitada | Servicio suspendido hasta fin de mes |
| Base de datos | **Neon Free** | PostgreSQL | Unos 0,5 GB y límite de horas de cómputo. Se suspende tras minutos sin uso (reanudar tarda menos de 1 s). Historial de restauración corto | **La DB deja de responder** hasta el siguiente mes |
| OAuth y Gmail API | **Google Cloud** | Credenciales | Gratis y **sin facturación**. Cuotas por usuario amplias | 429, gestionado con backoff |
| Cron | **cron-job.org** (o GitHub Actions `schedule`) | Llama a `/internal/sync` cada 15–30 min | GH Actions: la ejecución se puede retrasar, cada ejecución consume minutos (2.000 al mes en repos privados, ilimitados en públicos) y el cron se desactiva tras 60 días sin actividad en el repo | La sincronización automática se para; el botón manual sigue funcionando |
| Errores | **Sentry Developer** | api y web | Cuota mensual de eventos | Se descartan eventos |
| Uptime | **UptimeRobot / Better Stack** | Ping a `/health/live` | Intervalo de unos 5 minutos | Sin alertas |
| IA (fase 7) | Anthropic / OpenAI | — | **No tiene free tier fiable y privado** | Ver abajo |

**Estimaciones:**
- **Almacenamiento:** con solo metadatos, una fila de email ocupa alrededor de 1–2 KB. 0,5 GB alcanzan para cientos de miles de emails, así que no será el cuello de botella.
- **Arranque en frío de Render:** la primera carga del dashboard tras un rato de inactividad tarda unos 30–60 s.
  - Opción aceptable: un skeleton con el mensaje "despertando servidor".
  - Un ping de uptime cada 5 minutos la mantiene despierta y cabe en las 750 horas si es el único servicio, pero consume toda la cuota.

**Partes que no caben razonablemente en free tiers:**
- **IA:** con un prefiltro bueno serán pocos emails al día y el coste esperado es de céntimos al mes, pero no es cero. Alternativas a coste 0: solo reglas, que ya cubren la mayoría de plantillas de ATS, u Ollama en local para experimentar.
- **Gmail push con Pub/Sub:** requiere una cuenta de facturación en GCP. Alternativa: polling.

**Alternativa para el backend:**
- **Google Cloud Run**: es más profesional, permite scale-to-zero y tiene un free tier generoso, pero **requiere tarjeta y facturación activa**. Sería la migración natural y encaja con Pub/Sub.
- Descarto Fly.io y Railway: ya no tienen un free tier permanente.
- Oracle Cloud Always Free (VM) es realmente gratis y siempre encendida, pero exige tarjeta, a menudo no hay capacidad disponible y la operación es manual.

**Portabilidad:**
- El backend es una imagen Docker estándar, así que puede ir a Cloud Run, ECS/Fargate o Azure Container Apps.
- La DB es Postgres estándar: se migra con `pg_dump` a RDS o Cloud SQL.
- El cron se sustituye por Cloud Scheduler o EventBridge.
- Next.js puede autoalojarse con `output: standalone`.
- No hay SDKs de proveedores en el dominio: Gmail, IA y cifrado están detrás de interfaces.

---

## 12. Entorno de desarrollo

- **Node 24 LTS**, **pnpm 10** (campo `packageManager`), Docker Desktop.
- **docker-compose:**
  - Perfil por defecto: solo `postgres:17` (con volumen y healthcheck). Las apps corren nativas con hot reload, que es lo más rápido.
  - Perfil `full`: `api` y `web` también en contenedores, para probar la imagen de producción.
- **Gmail en local:** `MAIL_PROVIDER=fake` usa el adaptador de fixtures anonimizados. Así se desarrolla el pipeline completo **sin tocar tu correo real**. `MAIL_PROVIDER=gmail` usa el OAuth client de dev.
- **Seed:** empresas, candidaturas y eventos ficticios para trabajar el dashboard. También sirve para un modo demo público de portfolio.

**Variables de entorno** (`.env.example`):

```
# api
NODE_ENV, PORT, LOG_LEVEL
DATABASE_URL            # Neon: conexión pooled
DIRECT_URL              # Neon: conexión directa, para migraciones
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GOOGLE_LOGIN_REDIRECT_URI, GOOGLE_GMAIL_REDIRECT_URI
ALLOWED_GOOGLE_EMAILS   # allowlist
TOKEN_ENCRYPTION_KEY    # 32 bytes en base64
CRON_SECRET
FRONTEND_URL
MAIL_PROVIDER           # gmail | fake
SENTRY_DSN
AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY, AI_MONTHLY_BUDGET_USD   # fase 7
# web
API_INTERNAL_URL        # destino del rewrite
NEXT_PUBLIC_SENTRY_DSN
```

**Scripts de la raíz:**

| Script | Qué hace |
|---|---|
| `pnpm dev` | Levanta Postgres (`docker compose up -d --wait`), aplica migraciones y arranca web y api en paralelo |
| `pnpm build` / `lint` / `typecheck` / `format` | Sobre todo el workspace |
| `pnpm test` / `test:integration` / `test:e2e` | Unitarios / con DB (Testcontainers) / Playwright |
| `pnpm db:migrate` / `db:seed` / `db:studio` / `db:reset` | Prisma |

**Arranque local en tres pasos:**

```bash
cp .env.example .env
pnpm install
pnpm dev
```

---

## 13. Testing

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unit | Vitest | Clasificador de reglas y extractores (con fixtures), matching, máquina de estados, normalización (MIME/HTML), `EncryptionService`, normalización de nombres de empresa |
| Integración | Vitest + Supertest + Testcontainers (Postgres real) + `FakeMailProvider` | Pipeline de sincronización de principio a fin contra DB real, idempotencia, guards y allowlist, endpoints de estadísticas |
| E2E | Playwright (pocos tests) | Login (con una estrategia de test **solo disponible si `NODE_ENV=test` y un flag explícito**, que el arranque en producción rechaza), dashboard, filtros, detalle y edición manual |
| Evaluación | Script o test con el dataset anonimizado | Precisión y recall del clasificador (reglas y después IA) |

**Prioridad**, de más a menos importante:
1. Clasificación y extracción.
2. Matching y máquina de estados.
3. **Idempotencia**: el mismo mensaje procesado dos veces da el mismo resultado.
4. **Seguridad**: otra cuenta recibe 403, sin sesión 401, y `/internal` sin secreto 401.
5. Cifrado de tokens.
6. Fallback del history 404 y manejo de `invalid_grant`.
7. UI (lo mínimo).

No hay que perseguir un porcentaje de cobertura; importa cubrir el núcleo del dominio.

---

## 14. CI/CD (GitHub Actions)

**`ci.yml`**, en cada PR y push a `main`:

```
checkout → setup pnpm + Node 24 (con caché) → pnpm install --frozen-lockfile
→ lint → typecheck → test (unit + integración con Postgres como service container)
→ build (web y api) → docker build de la api (sin push, solo valida el Dockerfile)
```

Todo en un job (o dos en paralelo, web y api). Si activas Turborepo, `--filter=...[origin/main]` ejecuta solo lo afectado.

**Deployment:**
- **Vercel:** integración con Git. Hace un preview por PR y despliega a producción al hacer merge en `main`. No hace falta workflow.
- **Render:** auto-deploy desde `main` con la opción de esperar a que pase el CI ("after CI checks pass").
- **Migraciones:** `prisma migrate deploy` en el comando de arranque del contenedor. Es aceptable con una sola instancia, y los *pre-deploy commands* de Render no suelen estar en el plan gratuito. Regla: migraciones siempre compatibles hacia atrás (primero expandir, después contraer).
- **Extras:** `dependabot.yml` semanal y branch protection en `main` (CI obligatorio).
- **`sync-cron.yml`** solo si eliges GitHub Actions como cron en vez de cron-job.org.

---

## 15. Observabilidad

| Aspecto | Solución gratuita | Notas |
|---|---|---|
| Logs | **nestjs-pino** con JSON a stdout, **request ID** de correlación y redacción | Render guarda logs con poca retención. Más adelante: Better Stack Logs o Grafana Cloud (free) |
| Errores | **Sentry** en api y web, con release asociada al commit | Scrubbing de datos personales |
| Health checks | `@nestjs/terminus`: `/health/live` (proceso) y `/health/ready` (ping a DB) | Monitor en UptimeRobot / Better Stack |
| Métricas de negocio | **`sync_runs` y `ai_runs` en la DB**, visibles en `/settings/system`: última sincronización, emails procesados, errores y coste de IA | Barato y muy demostrable |
| Métricas técnicas (fase 8, opcional) | `prom-client` con `/metrics` protegido, o push OTLP a **Grafana Cloud free** | Buen punto de portfolio (dashboards de Grafana) sin coste |

---

## 16. Estructura del repositorio

```
job-application-tracker/
├── apps/
│   ├── web/                          # Next.js (Vercel)
│   │   ├── src/
│   │   │   ├── app/                  # rutas: (auth), (dashboard)
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui
│   │   │   │   ├── layout/           # sidebar, topbar, responsive shell
│   │   │   │   ├── dashboard/        # KPIs, charts
│   │   │   │   └── applications/     # tabla, filtros, timeline, formularios
│   │   │   ├── lib/                  # api-client, query-client, utils
│   │   │   ├── hooks/
│   │   │   └── middleware.ts
│   │   ├── e2e/                      # Playwright
│   │   └── next.config.ts            # rewrites /api → backend, headers CSP
│   │
│   └── api/                          # NestJS (Render, Docker)
│       ├── src/
│       │   ├── main.ts / app.module.ts
│       │   ├── config/               # schema Zod del entorno
│       │   ├── common/               # guards, decorators, filters, crypto, logging
│       │   ├── prisma/               # PrismaModule
│       │   └── modules/
│       │       ├── auth/  users/  gmail/  sync/  emails/
│       │       ├── classification/   # rules/, extractors/, interfaces
│       │       ├── applications/     # matching, state machine, events
│       │       ├── statistics/  health/
│       │       └── ai/               # fase 7: port + adapters + prompts
│       ├── prisma/                   # schema.prisma, migrations/, seed.ts
│       ├── test/
│       │   ├── integration/
│       │   └── fixtures/emails/      # SOLO emails anonimizados o sintéticos
│       └── Dockerfile                # multi-stage, usuario no root
│
├── packages/
│   ├── shared/                       # schemas Zod, enums (status, categorías), tipos DTO
│   ├── eslint-config/                # config ESLint compartida
│   └── tsconfig/                     # tsconfig base (strict)
│
├── docs/
│   ├── architecture.md               # diagramas (Mermaid), flujos
│   ├── adr/                          # Architecture Decision Records (monorepo, sesiones, sin Redis…)
│   ├── security.md                   # modelo de amenazas, política de datos y logs
│   ├── setup-google-cloud.md         # OAuth client, consent screen, scopes
│   └── runbooks/                     # reautorizar Gmail, rotar clave, restaurar DB
│
├── .github/
│   ├── workflows/ci.yml              # (+ sync-cron.yml si se usa GH como cron)
│   ├── dependabot.yml
│   └── pull_request_template.md
│
├── docker-compose.yml                # postgres (+ perfil full: api, web)
├── render.yaml                       # Blueprint de Render (infra como código ligera)
├── .env.example  .nvmrc  .prettierrc  .gitignore
├── package.json  pnpm-workspace.yaml  turbo.json (opcional)
└── README.md                         # qué es, arquitectura, cómo ejecutarlo, capturas
```

**Sobre `infrastructure/`:** no lo crearía hasta tener infraestructura como código real (por ejemplo Terraform al migrar a GCP o AWS). Hoy `render.yaml` y `docker-compose.yml` bastan. Una carpeta vacía o con poco contenido solo añade ruido.

---

## 17. Roadmap

Consejo transversal: **desplegar desde la fase 1**, para descubrir pronto los problemas de infraestructura (proxy, cookies, cold starts). No se sube ningún dato real a producción antes de terminar la fase 3.

| Fase | Objetivo | Funcionalidades | Componentes | Depende de | Al terminar funciona… |
|---|---|---|---|---|---|
| **1. Foundation + frontend** | Esqueleto profesional | Monorepo, ESLint/Prettier, tsconfig strict, `packages/shared`, CI (lint, typecheck, test, build), docker-compose, UI del dashboard con **datos mock** (layout responsive, KPIs, tabla, detalle, timeline) | web, shared, CI | — | Dashboard navegable con mocks, desplegado en Vercel y con CI en verde |
| **2. Backend + DB** | Tracker manual real | NestJS, Config con Zod, Prisma y modelo inicial (users, companies, applications, events), CRUD, máquina de estados, statistics, health, logging, seed, web conectada vía proxy | api, web, DB | 1 | Tracker **manual** completo en local; api en Render y DB en Neon (sin datos reales aún) |
| **3. Autenticación** | App privada de verdad | Login con Google en Nest, sesiones, guard global, allowlist, logout, verificación del proxy de cookies, rate limit, helmet/CSP | api (Auth, Users), web | 2 | **Solo tú entras**, otra cuenta recibe 403, y ya se puede usar en producción como tracker manual |
| **4. Integración con Gmail** | Leer correo de forma segura | Conectar Gmail (flujo separado), cifrado del refresh token, `MailProvider` (real y fake), sincronización inicial por tramos, descarga en dos etapas, prefiltro, persistencia mínima, `sync_runs`, botón "Sync", desconectar y borrar | api (Gmail, Sync, Emails), web (settings) | 3 | Emails candidatos listados en la app sin guardar cuerpos; resync idempotente |
| **5. Clasificación (reglas)** | Candidaturas automáticas | `RulesClassifier`, extractores por plantilla (LinkedIn, ATS comunes), matching, creación y actualización de candidaturas y eventos, bandeja de revisión, `locked_fields`, dataset de evaluación | api (Classification, Applications), web (review) | 4 | El backfill genera candidaturas con historial y los casos dudosos se revisan a mano |
| **6. Sincronización automática** | Sin abrir la app | History API, fallback por 404, lock, `/internal/sync` con secreto, cron externo cada 15–30 min, reintentos con backoff, gestión de `NEEDS_REAUTH` y banner. Watch/Pub/Sub opcional | api (Sync, Gmail), cron | 5 | Los emails nuevos aparecen solos; los errores de token se ven y se recuperan |
| **7. IA** | Más precisión y menos reglas | `LlmProvider` y adaptadores, `EmailAnalyzer` con una llamada, validación Zod, `ai_runs`, límite de presupuesto, fallback a reglas, comparación contra el dataset | api (Ai, Classification) | 5 (y 6 recomendable) | Mejor clasificación y extracción; proveedor cambiable por variable de entorno; coste acotado y visible |
| **8. Endurecimiento para producción** | Calidad demostrable | Sentry, página de estado del sistema, uptime, E2E con Playwright, backups (pg_dump cifrado, opcional), rotación de claves, revisión de seguridad, ADRs, README con capturas, modo demo con datos ficticios, métricas en Grafana (opcional) | Todos | 1–7 | Proyecto robusto, observado y documentado, listo para enseñar |

---

## 18. Riesgos y decisiones abiertas

1. **Estado de la consent screen de Google:** "In production" sin verificar. Hay que confirmar la política vigente en la fase 4. En "Testing", la sincronización automática se rompe cada 7 días.
2. **Rewrite de Vercel con `Set-Cookie`:** validarlo pronto, en la fase 3. El plan B es un Route Handler que actúe de proxy.
3. **Arranque en frío de Render:** decidir si se acepta o si se mantiene la instancia despierta con el ping de uptime.
4. **Idiomas de los emails:** definir las listas de palabras clave (ES y EN, y FR si se reciben emails en francés).
5. **Repo público o privado:** recomiendo público por portfolio, con disciplina estricta sobre secretos y fixtures.

---

## Recommended Architecture

```
                         ┌──────────────────────────────┐
                         │          Navegador           │
                         └──────────────┬───────────────┘
                                        │ HTTPS (cookie sid: HttpOnly, Secure, SameSite=Lax)
                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│ VERCEL (Hobby)  ·  apps/web  ·  Next.js + React + TS + shadcn/ui      │
│  UI dashboard (TanStack Query/Table, Recharts)                        │
│  rewrites: /api/*  ──────────────────────────────┐  (mismo origen,    │
└──────────────────────────────────────────────────┼───  sin CORS)  ────┘
                                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ RENDER (Free, Docker)  ·  apps/api  ·  NestJS                         │
│                                                                       │
│  SessionGuard global (deny-by-default + allowlist)   Throttler, Helmet│
│                                                                       │
│  Auth ─ Users        Applications (matching, state machine, events)   │
│  Gmail (adapter) ─ Sync ─ Emails (pipeline) ─ Classification          │
│  Statistics   Health   Ai (port) ─► [Anthropic | OpenAI | Ollama]     │
│                                         (fase 7, presupuesto limitado)│
│  Cola = tabla emails (processing_status + SKIP LOCKED)  · sin Redis   │
└───────┬──────────────────────────┬───────────────────────▲────────────┘
        │ Prisma (TLS)             │ OAuth2 + Gmail API    │ POST /internal/sync
        ▼                          ▼  (gmail.readonly)     │ (X-Cron-Secret)
┌───────────────────┐   ┌─────────────────────────┐   ┌────┴──────────────────┐
│ NEON (Free)       │   │ GOOGLE                  │   │ cron-job.org /        │
│ PostgreSQL        │   │  OAuth (login + Gmail)  │   │ GitHub Actions        │
│ metadatos, sin    │   │  Gmail API: list / get /│   │ cada 15–30 min        │
│ cuerpos de email; │   │  history (incremental)  │   └───────────────────────┘
│ refresh token     │   └─────────────────────────┘
│ cifrado AES-GCM   │
└───────────────────┘
   Observabilidad: pino (JSON, redactado) · Sentry (Free) · /health + UptimeRobot
   CI: GitHub Actions (lint → typecheck → test → build) · CD: Vercel + Render desde main
```
