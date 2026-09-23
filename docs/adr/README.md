# Architecture Decision Records

Decisiones de arquitectura con su contexto, por si alguien (o yo dentro de un año) se pregunta
"¿por qué así?". Formato breve: contexto, decisión, consecuencias.

| ADR                                   | Decisión                                      |
| ------------------------------------- | --------------------------------------------- |
| [0001](0001-bff-rewrite.md)           | Next.js reescribe `/api/*` hacia NestJS (BFF) |
| [0002](0002-opaque-sessions.md)       | Sesiones opacas en base de datos, no JWT      |
| [0003](0003-no-email-bodies.md)       | El contenido de los emails nunca se guarda    |
| [0004](0004-postgres-as-queue.md)     | La tabla `emails` es la cola; sin Redis       |
| [0005](0005-derived-status.md)        | El estado se deriva del historial de eventos  |
| [0006](0006-rules-first-ai-second.md) | Reglas primero, IA solo como segunda opinión  |
| [0007](0007-external-cron.md)         | Sincronización automática con un cron externo |
