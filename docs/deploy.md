# Despliegue (free tier)

```
Navegador ──► Vercel (Next.js) ──/api/* rewrite──► Render (NestJS, Docker) ──► Neon (Postgres)
                    ▲                                     ▲
             GitHub Actions cron ── POST /api/v1/internal/sync (X-Cron-Secret)
```

Todo cabe en los planes gratuitos, sin tarjeta. Orden recomendado: **Neon → Render → Vercel →
Google → cron**, porque cada paso necesita una URL del anterior.

## 1. Base de datos: Neon

1. Crea un proyecto en [neon.tech](https://neon.tech) (región cercana a Render, p. ej.
   _AWS Europe Central (Frankfurt)_).
2. En **Connect**, copia dos cadenas:
   - **Pooled** (host con `-pooler`): será `DATABASE_URL`.
   - **Direct** (sin `-pooler`): será `DIRECT_URL`. Prisma aplica las migraciones por la
     directa, porque PgBouncer (pooled) no soporta todo lo que usan.
3. Ambas deben terminar en `?sslmode=require`.

## 2. API: Render

1. [render.com](https://render.com) → **New → Blueprint** → elige este repositorio. Render lee
   [`render.yaml`](../render.yaml): servicio Docker gratuito en Frankfurt, health check en
   `/api/v1/health/ready` y despliegue automático de `main` **solo si el CI pasa**.
2. Rellena las variables que pide (`sync: false`):

   | Variable                | Valor                                                                |
   | ----------------------- | -------------------------------------------------------------------- |
   | `DATABASE_URL`          | Cadena pooled de Neon                                                |
   | `DIRECT_URL`            | Cadena directa de Neon                                               |
   | `FRONTEND_URL`          | La URL de Vercel (paso 3). Pon un valor provisional y cámbialo luego |
   | `GOOGLE_CLIENT_ID/...`  | Del cliente OAuth **de producción** (paso 4)                         |
   | `ALLOWED_GOOGLE_EMAILS` | Tu email (o varios, separados por comas)                             |
   | `ANTHROPIC_API_KEY`     | Solo si activas la IA (`AI_PROVIDER=anthropic`)                      |

   `COOKIE_SECRET`, `CRON_SECRET` y `TOKEN_ENCRYPTION_KEY` los genera Render. **Guarda una copia
   de `TOKEN_ENCRYPTION_KEY`** en tu gestor de contraseñas: sin ella hay que reconectar Gmail.

3. Al arrancar, el contenedor aplica las migraciones (`prisma migrate deploy`) y luego inicia la
   API. Comprueba `https://<servicio>.onrender.com/api/v1/health/ready` → `{"status":"ok"}`.

> Render Free se duerme tras ~15 min sin tráfico y tarda 30–60 s en despertar. La web reintenta
> las lecturas y muestra "Despertando el servidor…" mientras tanto.

## 3. Web: Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
2. **Root Directory**: `apps/web`. El resto lo fija [`apps/web/vercel.json`](../apps/web/vercel.json)
   (instala el monorepo con pnpm y construye con Turborepo, que compila antes `@jat/shared`).
3. Variables de entorno:
   - `API_INTERNAL_URL` = `https://<servicio>.onrender.com` (sin barra final).
   - `NEXT_PUBLIC_CONTACT_EMAIL` (opcional) = email de contacto que muestra `/privacy`.
4. Despliega y copia la URL de producción (p. ej. `https://job-tracker.vercel.app`). Vuelve a
   Render y pon esa URL en `FRONTEND_URL`.

Los rewrites se evalúan al construir: si cambias `API_INTERNAL_URL`, **vuelve a desplegar**.

## 4. Google Cloud (producción)

Sigue [setup-google-cloud.md](setup-google-cloud.md) creando un **cliente OAuth nuevo** para
producción:

- Origen autorizado: `https://job-tracker.vercel.app`
- URIs de redirección:
  - `https://job-tracker.vercel.app/api/v1/auth/google/callback`
  - `https://job-tracker.vercel.app/api/v1/gmail/callback`

En **Branding** ya puedes rellenar lo que faltaba para publicar la app:

| Campo                  | Valor                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Página principal       | `https://job-tracker.vercel.app/welcome`                                                                       |
| Política de privacidad | `https://job-tracker.vercel.app/privacy`                                                                       |
| Dominio autorizado     | `job-tracker.vercel.app` (`vercel.app` es un sufijo público, así que tu subdominio cuenta como dominio propio) |

Después: **Audience → Publish app**. Con la app publicada los refresh tokens de Gmail ya no
caducan cada 7 días.

## 5. Sincronización automática

En GitHub → **Settings → Secrets and variables → Actions** crea:

- `SYNC_URL` = `https://job-tracker.vercel.app/api/v1/internal/sync` (pasa por Vercel, así
  también despierta la API).
- `CRON_SECRET` = el valor que generó Render.

El workflow [`sync-cron.yml`](../.github/workflows/sync-cron.yml) se ejecuta cada 30 minutos.
Pruébalo con **Actions → Automatic sync → Run workflow**. GitHub desactiva los crons de repos
sin actividad en 60 días; si pasa, basta con reactivarlo (o usar cron-job.org con la misma URL
y la cabecera `X-Cron-Secret`).

## 6. Comprobación final

- [ ] `/welcome` y `/privacy` cargan sin sesión.
- [ ] El login con tu cuenta funciona y una cuenta fuera de la allowlist ve "no tiene acceso".
- [ ] Conectar Gmail → Sincronizar → aparecen candidaturas.
- [ ] `curl -X POST -H "X-Cron-Secret: x" https://…/api/v1/internal/sync` → `401`.
- [ ] En Ajustes aparece "Automática: hace …" tras la primera ejecución del cron.
- [ ] Uptime (opcional): un monitor gratuito de UptimeRobot a `/api/v1/health/live` avisa si la
      API cae. Si lo pones cada 5 min, la API no se dormirá, pero consumirá las 750 h gratuitas.

## Rotar secretos

- **`COOKIE_SECRET`**: cámbialo y reinicia. Solo invalida los logins en curso.
- **`CRON_SECRET`**: cámbialo en Render y en GitHub a la vez.
- **Sesiones**: borrar la fila en `sessions` (o cambiar de navegador y cerrar sesión) revoca al
  momento; quitar un email de `ALLOWED_GOOGLE_EMAILS` corta su acceso en la siguiente petición.
- **`TOKEN_ENCRYPTION_KEY`**: los tokens guardan la versión de clave, pero hoy solo hay una. Para
  rotarla: desconecta Gmail, cambia la clave y vuelve a conectar.
