# Decisiones pendientes

Documento vivo. Acumula preguntas, decisiones menores y refinamientos que no bloquean el avance del proyecto pero que en algún momento hay que responder y aplicar.

**Convención:**
- Cada decisión tiene un ID, una pregunta, un contexto, una propuesta tentativa y una sección "Cómo aplicar" cuando se resuelva.
- Estado: `[ ] abierta` · `[~] propuesta tentativa` · `[x] resuelta`.
- Al resolver: se marca `[x]`, se anota la decisión final y se aplica al código/schema.

---

## D-001 — `metodo_pago` en `pagos`: texto libre o enum
**Estado:** `[~]` propuesta tentativa
**Contexto:** Cuando el jefe registra un pago, anota el método (efectivo, transferencia bancaria, Nequi, Daviplata, …). ¿Va como texto libre o como enum cerrado?
**Propuesta tentativa:** Texto libre por simplicidad. Si después se quiere reporte por método, normalizar con un autocomplete UI.
**Cómo aplicar cuando se resuelva:** Mantener TEXT en la columna o cambiar a un enum con `ALTER TYPE`. Si pasa a enum, agregar al spec.

## D-002 — `tarifas_tarea.lote_id`: override por lote sí/no
**Estado:** `[ ]` abierta
**Contexto:** Diseñé `tarifas_tarea` con un `lote_id` opcional para permitir tarifas distintas según lote (ej. lote con pendiente fuerte paga más por kg cosechado). ¿La finca usa esto en la realidad o todas las tarifas son globales?
**Propuesta tentativa:** Mantener la columna por si acaso. Cost ~0 si no se usa.
**Cómo aplicar cuando se resuelva:** Si nunca se va a usar, hacer `ALTER TABLE … DROP COLUMN lote_id`. Si sí, validar lookup en queries.

## D-003 — `tipo_pago`: incluir `REEMBOLSO`?
**Estado:** `[ ]` abierta
**Contexto:** ¿Hay casos donde la finca le repuso a alguien algo que pagó de su bolsillo (ej. trabajador compró gasolina para la motobomba)? Si sí, ese pago no encaja en SALARIO/JORNAL/SERVICIO/BONO/AJUSTE.
**Propuesta tentativa:** Agregar `REEMBOLSO` al enum por si acaso.
**Cómo aplicar cuando se resuelva:** `ALTER TYPE tipo_pago ADD VALUE 'REEMBOLSO'`.

## D-004 — Bottom nav del JEFE: 5 items con "Finanzas" o 4 con "Más"?
**Estado:** `[ ]` abierta (se decide al llegar a Fase 2)
**Contexto:** Cuando aparezcan las pantallas de Finanzas (pagos, servicios, configuración), no caben en el bottom nav actual de 4 items (Inicio · Lotes · Equipo · Alertas).
**Propuesta tentativa:** Reemplazar "Alertas" por "Finanzas" o agregar un 5° item "Más" que abra un menú overflow con todo lo administrativo.

## D-005 — `ausencias.descontable`: default según tipo?
**Estado:** `[ ]` abierta
**Contexto:** ¿`VACACIONES` e `INCAPACIDAD` por ley no descuentan? ¿O se prefiere decidirlo cada vez manualmente?
**Propuesta tentativa:** Default por tipo: `FALSE` para VACACIONES e INCAPACIDAD; `TRUE` para FALTA_INJUSTIFICADA, LICENCIA, PERMISO. El jefe puede overrride en la UI.

## D-006 — `vinculaciones.fecha_inicio`: default `CURRENT_DATE`?
**Estado:** `[~]` propuesta tentativa
**Contexto:** El default `CURRENT_DATE` simplifica el alta pero esconde un dato importante (cuándo empezó realmente la vinculación, especialmente al cargar datos históricos).
**Propuesta tentativa:** El formulario de alta pre-llena con hoy pero permite cambiar. En el alta del primer jefe (script), forzar a especificar.
**Cómo aplicar cuando se resuelva:** Confirma comportamiento de la UI.

## D-007 — Apellido separado del nombre?
**Estado:** `[ ]` abierta
**Contexto:** Actualmente `personas.nombre_completo` es un solo TEXT. ¿Conviene partir en `nombres` (compuestos) + `apellidos` (compuestos) para ordenar alfabéticamente por apellido (común en Colombia, listas, reportes)?
**Propuesta tentativa:** Dejarlo en `nombre_completo` por ahora. Si se necesita ordenar por apellido, calcular con `regexp_split` o agregar columnas computadas.

## D-008 — `pagos` tipo `AJUSTE` requiere `motivo_diferencia`?
**Estado:** `[ ]` abierta
**Contexto:** ¿Forzar a que un `AJUSTE` siempre tenga una explicación textual?
**Propuesta tentativa:** Sí. CHECK constraint: `tipo='AJUSTE' ⇒ motivo_diferencia IS NOT NULL`.

## D-009 — `esquema_pago_destajo='SOLO_DESTAJO'` válido para FIJO?
**Estado:** `[ ]` abierta
**Contexto:** Para un FIJO, `SOLO_DESTAJO` técnicamente significa que existe `salario_base` pero nunca aplica. ¿Permitir o prohibir por CHECK?
**Propuesta tentativa:** Prohibir para FIJO. Solo válido para JORNALERO. Si un fijo solo cobra destajo, debería ser JORNALERO o tener un acuerdo via `BONO`/`AJUSTE`.

## D-010 — `tarifas_tarea` overlap permitido o exclusivo?
**Estado:** `[ ]` abierta
**Contexto:** Dos tarifas vigentes para el mismo `(tipo_tarea, lote)` en la misma fecha: ¿error de constraint o "la más reciente gana"?
**Propuesta tentativa:** No forzar. La UI alerta al jefe si ya hay una vigente y le sugiere cerrar la anterior antes de crear la nueva. EXCLUDE constraint si después se vuelve problema.

## D-011 — `jornales.descripcion_actividad`: texto libre o FK a `tipos_tarea`?
**Estado:** `[ ]` abierta
**Contexto:** Si el jornalero hizo cosecha ese día, ¿queremos saberlo estructuradamente (para que el cálculo de destajo sepa qué tarifa aplicar) o solo como texto?
**Propuesta tentativa:** Si el jornal está asociado a una actividad pagada por destajo, debería existir un `registros_avance` o `cosecha` paralelo del cual sale el destajo. El jornal en sí queda como "vino a trabajar, tarifa X". `descripcion_actividad` como texto libre y opcional.

## D-012 — CLAUDE.md: subrol APICULTOR
**Estado:** `[~]` propuesta tentativa
**Contexto:** CLAUDE.md §4.4 dice "Sub-rol APICULTOR: trabajador con flag es_apicultor=true. Solo a estos se les asignan tareas de apicultura". En el brainstorm 2026-05-11, se aclaró que no hay apicultor designado — las tareas se reparten.
**Propuesta tentativa:** Eliminar la mención del sub-rol APICULTOR de CLAUDE.md. Las tareas de apicultura se asignan a cualquier trabajador.
**Cómo aplicar cuando se resuelva:** Editar CLAUDE.md §4.4, §5.5; quitar `es_apicultor` del schema/Prisma.

## D-013 — Captura de polígonos (delim)
**Estado:** `[ ]` diferida intencionalmente
**Contexto:** Pendiente para el final (decisión pendiente). Dibujo sobre satelital, sin GPS en sitio.
**Propuesta tentativa:** Usar `leaflet-draw` cuando llegue el momento.
**Cómo aplicar cuando se resuelva:** Spec aparte cuando se vaya a implementar.
