# 0004 · La tabla `emails` es la cola; sin Redis

**Contexto.** Decenas de emails al día. En free tier, Redis gestionado limita comandos y BullMQ
hace polling constante; un worker aparte no cabe (y se dormiría).

**Decisión.** Cada email guarda `processing_status`, `attempts` y `next_attempt_at`. La
sincronización procesa lotes acotados en tiempo dentro de la propia petición y deja
`hasMore` para la siguiente; los checkpoints viven en `sync_runs` y un lease evita dos
sincronizaciones a la vez.

**Consecuencias.**

- Cero infraestructura extra, y todo se reanuda aunque el proceso se duerma a mitad.
- La latencia depende de la frecuencia del cron (30 min), aceptable para candidaturas.
- Si algún día hiciera falta, pg-boss (también sobre Postgres) es el siguiente paso.
