# 0003 · El contenido de los emails nunca se guarda

**Contexto.** El correo es de los datos más sensibles que existen, y `gmail.readonly` es un
scope restringido de Google.

**Decisión.** El cuerpo se descarga, se clasifica en memoria y se descarta. Solo se guardan
metadatos de los candidatos (remitente, asunto, fecha, ids) y el resultado estructurado. Del
correo descartado por el prefiltro, solo id y fecha. Los logs no llevan cabeceras, query strings
ni textos.

**Consecuencias.**

- Una filtración de la base de datos no expone correos.
- Reclasificar (mejores reglas o IA) obliga a volver a descargar el cuerpo de Gmail: es barato y
  lo hace el botón "Reprocesar".
- La interfaz enlaza al mensaje en Gmail en lugar de mostrarlo.
