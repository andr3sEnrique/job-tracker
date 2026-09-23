# 0002 · Sesiones opacas en base de datos, no JWT

**Contexto.** Hay un único usuario (o muy pocos) y una sola instancia de API. La prioridad es
poder revocar el acceso al momento.

**Decisión.** Token aleatorio en una cookie `HttpOnly`; en la base de datos solo su SHA-256. Cada
petición valida la sesión y vuelve a comprobar la allowlist.

**Consecuencias.**

- Cerrar sesión, borrar la cuenta o quitar un email de la allowlist corta el acceso en la
  siguiente petición. Con JWT habría que esperar a que caduque o mantener una lista negra.
- Una consulta por petición: irrelevante a esta escala.
- Robar la base de datos no da sesiones válidas (solo hashes).
