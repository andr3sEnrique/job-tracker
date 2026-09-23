# Google Cloud: OAuth para el login

Configuración única para que "Continuar con Google" funcione. Es gratis y no requiere tarjeta.

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
4. **URIs de redirección autorizados**: `http://localhost:3000/api/v1/auth/google/callback`
5. Crea y copia el _Client ID_ y el _Client secret_.

La redirección apunta a la **web** (puerto 3000), no a la API: el callback pasa por el proxy
`/api` de Next.js para que la cookie de sesión sea del mismo origen que la aplicación.

Para producción crea **otro cliente** con el dominio real (por ejemplo
`https://job-tracker.vercel.app/api/v1/auth/google/callback`). Tener clientes separados evita
que credenciales de desarrollo sirvan en producción.

## 4. Variables de entorno

En el `.env` de la raíz del repositorio:

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
ALLOWED_GOOGLE_EMAILS=tu.email@gmail.com
```

Reinicia `pnpm dev`. Si quieres ver los datos de ejemplo con tu cuenta:

```bash
pnpm db:seed -- --force
```

## Cómo se protege el acceso

- La API rechaza cualquier email fuera de `ALLOWED_GOOGLE_EMAILS`, **antes** de crear el usuario,
  y lo vuelve a comprobar en cada petición (quitarlo de la lista revoca el acceso al momento).
- Solo se aceptan emails verificados por Google, y el ID token se valida (firma, audiencia,
  emisor y caducidad).
- Flujo Authorization Code con **PKCE** y parámetro `state` en una cookie firmada de un solo uso.
- La sesión es un token aleatorio en una cookie `HttpOnly`, `SameSite=Lax` (y `Secure` +
  prefijo `__Host-` en HTTPS). En la base de datos solo se guarda su hash SHA-256.
- Todas las rutas de la API exigen sesión salvo las marcadas `@Public()` (health y login).
