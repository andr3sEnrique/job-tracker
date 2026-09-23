# 0007 · Sincronización automática con un cron externo

**Contexto.** Render Free duerme el proceso tras ~15 minutos sin tráfico: un temporizador
interno no se ejecutaría. Gmail push (Pub/Sub) exige facturación en Google Cloud.

**Decisión.** Un cron externo (GitHub Actions cada 30 min) llama a `POST /internal/sync`, que
despierta la API y sincroniza todos los buzones. El endpoint no usa cookies: exige un secreto en
cabecera comparado en tiempo constante. Tras la carga inicial se usa la Gmail History API; si el
historial caducó, una búsqueda por fecha.

**Consecuencias.**

- Gratis y sin estado en el cron.
- Existe también un temporizador interno opcional (`SCHEDULER_ENABLED`) para hosts siempre
  encendidos.
- Si se migra a Cloud Run, el cron pasa a Cloud Scheduler y se puede añadir push.
