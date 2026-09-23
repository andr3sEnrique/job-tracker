# 0005 · El estado se deriva del historial de eventos

**Contexto.** Los emails llegan desordenados (una sincronización inicial procesa meses de golpe,
un email tardío puede confirmar una candidatura ya rechazada) y el usuario puede deshacer
clasificaciones.

**Decisión.** El estado de una candidatura se recalcula reproduciendo sus eventos en orden
cronológico con una máquina de estados que solo avanza; los cambios manuales y del sistema
(`GHOSTED`) fijan el estado explícitamente.

**Consecuencias.**

- El orden de llegada no importa y deshacer es exacto.
- Recalcular cuesta una consulta por candidatura afectada: despreciable.
- La lógica es pura y está cubierta por tests unitarios.
