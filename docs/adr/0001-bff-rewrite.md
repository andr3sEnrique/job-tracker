# 0001 · Next.js reescribe `/api/*` hacia NestJS

**Contexto.** La web (Vercel) y la API (Render) viven en dominios distintos. Una cookie de
sesión puesta por la API sería de terceros para la web, y los navegadores las bloquean.

**Decisión.** Next.js hace de BFF: `rewrites()` envía `/api/*` a la API. El navegador solo habla
con un origen.

**Consecuencias.**

- La cookie es de primera parte, `SameSite=Lax` y `__Host-`; no hay CORS que configurar.
- Los callbacks de OAuth apuntan a la web, no a la API.
- Cada petición pasa por Vercel (latencia extra mínima) y `API_INTERNAL_URL` se fija al construir.
