# 0006 · Reglas primero, IA solo como segunda opinión

**Contexto.** La mayoría de los emails de empleo vienen de plantillas de ATS y plataformas.
Mandarlo todo a un LLM costaría dinero, añadiría latencia y sacaría datos del servidor sin
necesidad.

**Decisión.** Un clasificador de reglas (EN/FR/ES) decide primero. La IA solo se consulta si la
categoría es desconocida o poco segura, o si falta la empresa o el puesto. Va detrás de un
puerto genérico (`LlmProvider`); está desactivada por defecto y tiene presupuesto mensual.

**Consecuencias.**

- Coste de céntimos al mes y privacidad por defecto.
- Cualquier fallo de la IA deja el resultado de las reglas: nunca bloquea el procesamiento.
- Cambiar de modelo o de proveedor es una variable de entorno más un adaptador.
- El dataset sintético mide reglas e IA con los mismos casos.
