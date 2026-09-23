# Google Cloud: login y acceso a Gmail

Configuración única para que funcionen "Continuar con Google" (fase 3) y "Conectar Gmail" (fase 4).
Es gratis y no requiere tarjeta.

## 1. Proyecto

1. Entra en <https://console.cloud.google.com/> y crea un proyecto (por ejemplo `job-tracker`).

## 2. Pantalla de consentimiento (Google Auth Platform)

1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o _Google Auth Platform → Branding_).
2. Tipo de usuario: **Externo**.
3. Nombre de la app, email de asistencia y email de contacto del desarrollador: los tuyos.
4. **Público / Audience**: añade tu cuenta de Google como _test user_.
5. Scopes: no hace falta añadir ninguno. El login solo usa `openid`, `email` y `profile`, que no
   son sensibles.

> Mientras solo pidamos esos tres scopes, el modo **Testing** es suficiente. En la fase 4, al
> añadir `gmail.readonly`, habrá que pasar la app a **In production** (sin verificación, uso
> personal); si no, Google caduca los refresh tokens cada 7 días. Ver `PLAN_TECNICO.md` §6.1.

## 3. Cliente OAuth

1. **Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**.
3. **Orígenes de JavaScript autorizados**: `http://localhost:3000`
4. **URIs de redirección autorizados** (las dos):
   - `http://localhost:3000/api/v1/auth/google/callback` (login)
   - `http://localhost:3000/api/v1/gmail/callback` (conectar Gmail)
5. Crea y copia el _Client ID_ y el _Client secret_.

La redirección apunta a la **web** (puerto 3000), no a la API: el callback pasa por el proxy
`/api` de Next.js para que la cookie de sesión sea del mismo origen que la aplicación.

Para producción crea **otro cliente** con el dominio real (por ejemplo
`https://job-tracker.vercel.app/api/v1/auth/google/callback`). Tener clientes separados evita
que credenciales de desarrollo sirvan en producción. Los pasos completos están en
[deploy.md](deploy.md#4-google-cloud-producción).

## 4. Acceso a Gmail (fase 4)

1. **APIs y servicios → Biblioteca** → busca **Gmail API** → **Habilitar**.
2. **Google Auth Platform → Data Access → Add or remove scopes** → añade
   `https://www.googleapis.com/auth/gmail.readonly` (solo lectura) → guarda.
3. **Google Auth Platform → Audience → Publish app** → confirma. El estado pasa a
   **In production**. Google pide antes una página principal y una política de privacidad
   públicas: son `/welcome` y `/privacy` de la app desplegada (ver [deploy.md](deploy.md)).

¿Por qué publicar? `gmail.readonly` es un scope _restringido_. En modo **Testing**, Google caduca
los refresh tokens a los 7 días y la sincronización dejaría de funcionar cada semana. Una app
personal (menos de 100 usuarios que conoces) puede estar en producción **sin verificación**;
la verificación formal de scopes restringidos exige una auditoría de pago que no hace falta.

La consecuencia es que, al conectar Gmail, Google muestra **"Google no ha verificado esta app"**.
Es esperado: pulsa **Configuración avanzada → Ir a job-tracker (no seguro)**. Aunque la app sea
"pública", nadie más puede usarla: la API rechaza cualquier cuenta fuera de la allowlist.

En la pantalla de permisos, **marca la casilla de lectura de Gmail**: Google permite desmarcar
scopes y, sin ese permiso, la conexión se rechaza.

## 5. Variables de entorno

En el `.env` de la raíz del repositorio:

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
ALLOWED_GOOGLE_EMAILS=tu.email@gmail.com
# Cifra el refresh token de Gmail en la base de datos (openssl rand -base64 32).
# En desarrollo hay una clave por defecto; en producción es obligatoria.
TOKEN_ENCRYPTION_KEY=
```

Reinicia `pnpm dev`. Si quieres ver los datos de ejemplo con tu cuenta:

```bash
pnpm db:seed -- --force
```

## Qué se guarda de tu correo

- Se listan solo los mensajes que coinciden con remitentes de ATS/portales de empleo o con
  palabras clave en el asunto, de los últimos 180 días (`GMAIL_INITIAL_SYNC_DAYS`).
- De los relevantes se guarda **remitente, asunto, fecha, etiquetas y el Message-ID**. Nunca el
  cuerpo, adjuntos ni destinatarios.
- De los descartados solo quedan los identificadores y la fecha (para no volver a procesarlos).
- "Desconectar" revoca el acceso en Google y borra todo lo anterior.

Para desarrollar sin tocar tu buzón real: `MAIL_PROVIDER=fake` sirve 240 emails sintéticos.

## Cómo se protege el acceso

- La API rechaza cualquier email fuera de `ALLOWED_GOOGLE_EMAILS`, **antes** de crear el usuario,
  y lo vuelve a comprobar en cada petición (quitarlo de la lista revoca el acceso al momento).
- Solo se aceptan emails verificados por Google, y el ID token se valida (firma, audiencia,
  emisor y caducidad).
- Flujo Authorization Code con **PKCE** y parámetro `state` en una cookie firmada de un solo uso.
- La sesión es un token aleatorio en una cookie `HttpOnly`, `SameSite=Lax` (y `Secure` +
  prefijo `__Host-` en HTTPS). En la base de datos solo se guarda su hash SHA-256.
- Todas las rutas de la API exigen sesión salvo las marcadas `@Public()` (health y login).
- El refresh token de Gmail se cifra con AES-256-GCM, ligado al usuario propietario; los
  access tokens duran una hora y nunca se guardan ni llegan al navegador.
