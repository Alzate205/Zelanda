# Asistente de IA sobre los datos de la finca — diseño

**Fecha:** 2026-08-03
**Estado:** aprobado, pendiente de implementar

## Problema

El dueño exporta datos de la finca, los pega en un chat de IA externo y pregunta lo
que quiere saber. Funciona, pero el ciclo es manual, los datos quedan desactualizados
apenas se exportan, y hay que repetirlo cada vez.

La idea es traer eso adentro de FincApp: preguntar en lenguaje natural y que responda
con los datos reales de Supabase, en vivo.

## Alcance

Cuatro tipos de pregunta, todos en la misma pantalla:

1. **Consultas concretas** — "¿cuánto cosechamos en Pijao este año?"
2. **Análisis y comparaciones** — "¿qué lote me da más plata por hectárea?"
3. **Consejo agronómico general** — "¿cómo controlo la antracnosis?" (no toca la BD)
4. **Redacción de reportes** — "armame un resumen del mes"

Los tipos 1 y 2 consultan la base; 3 y 4 salen del modelo.

## Decisiones tomadas

| Decisión        | Elegido                                 | Por qué                                                                                                                                                |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acceso a datos  | SQL de solo lectura con rol restringido | Un set fijo de funciones se queda corto justo en las preguntas interesantes. Con un rol sin permiso de escritura, el peor caso posible es una lectura. |
| Datos sensibles | Plata sí, datos personales no           | Necesita costos para responder sobre rentabilidad. Cédulas y teléfonos no aportan a ninguna respuesta útil.                                            |
| Modelo          | `claude-sonnet-5`                       | Traducir pregunta a SQL y redactar el resultado no requiere el modelo más caro. Cambiar a `claude-opus-5` es una línea.                                |
| Estado inicial  | Apagado                                 | Sin `ANTHROPIC_API_KEY` la pantalla informa que no está configurado. La API es pago por uso: sin preguntas no hay factura.                             |
| Historial       | No se persiste                          | Menos superficie de datos y menos costo. Se puede repreguntar dentro de una sesión.                                                                    |

## Seguridad — tres capas

La garantía de que el asistente no puede dañar la base **no depende del prompt**.

### Capa 1 — rol de PostgreSQL

`zelanda_ia` con `GRANT SELECT` sobre una lista explícita de tablas. Sin `INSERT`,
`UPDATE`, `DELETE` ni `DROP`. Sin acceso al esquema `auth` de Supabase, que contiene
credenciales (`users`, `sessions`, `refresh_tokens`, `mfa_factors`, `oauth_clients`).

Aunque el modelo escribiera `DROP TABLE`, Postgres lo rechaza: no es una promesa, es
un permiso que no existe.

### Capa 2 — vistas en lugar de tablas

El rol no alcanza `personas`, `clientes` ni `proveedores` directamente. Ve vistas que
omiten las columnas sensibles:

| Vista              | Expone                      | Oculta                                               |
| ------------------ | --------------------------- | ---------------------------------------------------- |
| `v_ia_personas`    | id, nombre_completo, activo | cedula, telefono, fecha_nacimiento, foto_path, notas |
| `v_ia_clientes`    | id, nombre, activo          | contacto, telefono, notas                            |
| `v_ia_proveedores` | id, nombre, activo          | contacto, nit, telefono, notas                       |

Ninguna consulta puede llegar a esas columnas, porque no están en el objeto que el rol
puede leer.

### Capa 3 — validación antes de ejecutar

`lib/ia/validar-sql.ts` decide si una consulta se ejecuta. Rechaza:

- Todo lo que no empiece con `SELECT` o `WITH`
- Sentencias encadenadas con `;`
- Palabras de escritura y DDL (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`,
  `GRANT`, `TRUNCATE`, `COPY`)
- Referencias al esquema `auth`, a `usuarios`, a `push_subscriptions` y a `pg_`
- Comentarios (`--`, `/* */`), que se usan para esconder carga útil

Y fuerza un `LIMIT` si la consulta no lo trae. La ejecución corre con
`statement_timeout` de 10 s.

Es una función pura, sin BD ni red, así que se testea entera con vitest — el mismo
patrón de `lib/diagnostico.ts` y `lib/fenologia.ts`.

## Arquitectura

```
lib/ia/
  esquema.ts          descripción de las tablas legibles (constante, se cachea)
  validar-sql.ts      + validar-sql.test.ts  ← la pieza de seguridad
  cliente.ts          cliente Anthropic; null si falta la API key
  consultar.ts        ejecuta el SQL con el rol restringido

app/api/jefe/asistente/route.ts    orquesta pregunta → SQL → datos → respuesta
app/(app)/jefe/asistente/page.tsx  pantalla
components/jefe/ChatAsistente.tsx  chat

supabase/migracion-rol-ia.sql      rol zelanda_ia + las tres vistas
```

### Dos conexiones a la misma base

| Cliente              | Rol          | Uso                              |
| -------------------- | ------------ | -------------------------------- |
| `prisma` (existente) | dueño        | Toda la app                      |
| `sqlIA` (nuevo)      | `zelanda_ia` | Solo las consultas del asistente |

Credenciales distintas: el asistente no puede escribir porque su conexión no tiene el
permiso, no porque el código se lo pida.

### Flujo de una pregunta

1. El usuario (rol JEFE) escribe una pregunta.
2. La API route llama al modelo con el esquema en el prompt y una herramienta
   `consultar_datos(sql)`.
3. Si el modelo pide la herramienta, el SQL pasa por `validarSql`. Si es rechazado, se
   devuelve el motivo al modelo como resultado de error, y el modelo reformula.
4. La consulta válida se ejecuta con `sqlIA` y el resultado vuelve al modelo.
5. El modelo redacta la respuesta, que se transmite a la pantalla mientras se genera.

El SQL usado queda visible en la UI, desplegable. No es decoración: es lo que permite
comprobar que un número salió de los datos y no de una invención.

## Costo

Medido sobre el esquema real: 31 tablas, 380 columnas, ~2.300 tokens de descripción.

Cada pregunta son dos llamadas a la API (escribir el SQL, redactar la respuesta).
Estimación de ~US$0,034 por pregunta con Sonnet 5, dominada por los tokens de salida.

| Uso             | Costo mensual estimado |
| --------------- | ---------------------- |
| 2 preguntas/día | ~US$2                  |
| 5 preguntas/día | ~US$5                  |

Sin suscripción ni mínimo: un mes sin usarlo no cuesta nada. Los precios y el tamaño
del esquema son exactos; el conteo de tokens es una estimación por longitud de texto
(±20 %) hasta poder medirlo con el contador real de la API.

El `LIMIT` forzado es también un control de costo: una consulta que devuelva miles de
filas multiplicaría el costo de esa pregunta.

## Lo que este diseño no resuelve

- **Las preguntas y los datos que las responden viajan a la API de Anthropic.** Si se
  pregunta por sueldos, esos montos salen del servidor. Es inherente a usar un modelo
  alojado.
- **El modelo puede escribir SQL correcto que responda la pregunta equivocada.** Por eso
  la consulta queda visible.
- **No hay memoria entre sesiones.** Cada conversación arranca limpia.

## Tests

- `validar-sql.test.ts` — cada regla de rechazo dispara con su caso y no dispara sin él;
  el `LIMIT` se agrega cuando falta y se respeta cuando ya está; los casos de evasión
  (comentarios, `;` encadenado, `UNION` contra `auth`) quedan cubiertos.

Los componentes no llevan test: son presentación sobre datos ya validados.
