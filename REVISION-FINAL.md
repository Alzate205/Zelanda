# Revisión final de Zelanda

Estado de la revisión exhaustiva antes de entregar. Archivo de trabajo, no se
commitea. Sirve para retomar donde iba si se corta la sesión.

`[ok]` revisado sin hallazgos · `[!]` hallazgo abierto · `[fix]` ya corregido ·
`[ ]` pendiente

---

## 1. Seguridad y permisos

- [ok] **Páginas: 107/107.** Todas llaman `requerirUsuario` con el rol de su
  área. Las 3 sin guarda son públicas a propósito: `/`, `/login`, `/splash`.
  Dos que parecían flojas resultaron _más_ estrictas que un rol:
  `/trabajador/avance/[id]` exige que la asignación sea de esa persona
  (`persona_id`), no sólo que seas trabajador.
- [ok] **Server actions: 70/70 autenticadas.** Las de `mi-perfil` usan siempre
  el id de la sesión y nunca uno que venga del cliente, así que no se puede
  editar el perfil ajeno.
- [ok] **Rutas de API: 20/20 con guarda.**
- [fix] **Los dos crons fallaban abiertos sin `CRON_SECRET`.** Comparaban contra
  `` `Bearer ${process.env.CRON_SECRET}` ``; sin la variable eso queda contra el
  texto `"Bearer undefined"` y ese header exacto pasaba. En producción no había
  agujero (la variable está en Production y Preview, verificado con
  `vercel env ls`). PR #52, con 5 tests.
- [!] **Cambiar contraseña no pide la actual** (`cambiarMiContrasena`). En una
  finca donde los celulares se prestan, alguien puede tomar el teléfono
  desbloqueado de un compañero y dejarlo afuera de su cuenta. **Decisión del
  jefe**, puede ser aceptable.
- [ ] Reglas RLS en Supabase: la app entra por Prisma, pero conviene saber qué
      pasa si alguien usa la clave anon.

## 2. Aislamiento de las pruebas ← lo más serio que salió

- [!] **El e2e de CI corre contra la base de producción.** Comprobado por
  coincidencia exacta de horarios: la corrida de CI del PR #52 fue de 05:27:53 a
  05:31:12 UTC, y a las 05:32 los usuarios de prueba ya no estaban. Lo mismo en
  las corridas de 04:11 y 04:28.

  Consecuencias:

  1. Cada push siembra y borra datos en la base real de la finca.
  2. **Durante los ~3 minutos que dura CI, el lote "E2E Lote Test" con 50
     árboles y cuatro usuarios de prueba aparecen en la app.** Si el jefe la
     abre en ese momento, ve datos falsos.
  3. No hay red de seguridad: un error futuro en el teardown pega directo en
     los datos reales.

  El teardown de hoy está bien acotado (borra por nombre exacto `E2E Lote Test`
  y por los correos de prueba), así que no destruye nada real. El problema es
  que no haya separación.

  **Recomendación:** un proyecto Supabase aparte para CI. El plan gratuito de
  Supabase permite dos proyectos, así que no cuesta plata.

## 3. Que nada quede inalcanzable

- [fix] Atajo "Apiarios" iba a `/jefe/apiarios/1` fijo: **La Quebrada no se
  podía abrir desde ningún lado.** PR #51.
- [ok] No quedan otros enlaces con id escrito a mano.
- [ok] Ningún `#ancla` en el código, **y no puede haberlo**: el que scrollea es
  un `<main>` con `overflow-y-auto` (`app/(app)/layout.tsx:22`), no la ventana.
  Medido: `scrollY=0` con la sección a 1859px.
- [!] **32 de las 107 pantallas no se probaban nunca.** La lista de
  `scripts/pantallas.mjs` cubría 68. Las que faltaban son casi todos los
  formularios de edición y los detalles — incluida
  `/jefe/lotes/[id]/frecuencias`, justo lo que más le importa al jefe.
  Hecho: `scripts/barrido-completo.mjs` saca las rutas del sistema de archivos y
  los ids de la base, así que una pantalla nueva entra sola.
- [ok] **Barrido de las 107 pantallas a 390px: ninguna rota.** 79 limpias de
  entrada; las 15 marcadas "a revisar" y los 2 "error" resultaron **todos falsos
  positivos**, comprobados uno por uno en caliente:

  - 7 contenedores de Leaflet y 3 tiras de chips de filtro: scrollean por
    dentro **a propósito**.
  - `/jefe/lotes/[id]` +16px en `space-y-5`: es el encabezado a sangre completa
    (`-mx-4`, línea 161). El margen negativo derecho suma al `scrollWidth`, pero
    el `<main>` lo absorbe. Comprobado forzando `scrollLeft` en 8 pantallas a
    320/360/390/412px: **exceso 0px, no se desliza ninguna**.
  - `/jefe/asignaciones/[id]/editar` rebota al detalle: correcto, la 28 está
    completada. Y el enlace "Editar" **no se muestra** en completadas (aparece
    "Reabrir"), así que a esa redirección sólo se llega escribiendo la URL.
  - `/jefe/asistente` rebota: es lo que pediste, está oculta a propósito.
  - `/jefe/instalaciones` y `/trabajador/arbol/1/1`: en caliente dan 200 en 3,3s
    y 5,6s. Era la primera compilación de dev.
  - `/page.tsx` 404: bug de mi script, no de la app. Corregido.

  Corregida también la heurística: ahora comprueba si la pantalla **se desliza
  de verdad** (forzando `scrollLeft`) en vez de comparar `scrollWidth`, que era
  lo que producía los 15 falsos positivos.

- [ ] Barrido a 320px con el detector corregido (corriendo).
- [!] **`informe-ia` puede reventar por el pool de conexiones.** Durante el
  barrido tiró `Timed out fetching a new connection from the connection pool`.
  Causa: `connection_limit=1` sin `pool_timeout` configurado (Prisma usa 10s por
  defecto), y `recolectar-informe` hace 10 consultas que con límite 1 **no
  paralelizan** (ya medido: 4137ms vs 4061ms). En caliente y sin carga da 200.
  Esto valida el pendiente del `connection_limit`. **Decisión tuya**, es
  configuración de producción.

## 4. Datos y uso

- [fix] Dos cantidades salían con punto decimal (`toFixed`) en avisos de stock:
  "-1.250 L" se lee como mil doscientos cincuenta cuando es uno con veinticinco.
  PR #52.
- [!] **La foto de una novedad se pierde en silencio.** En `crearNovedad`, si
  falla la subida se guarda `foto_path = null` y no se avisa. El trabajador cree
  que mandó la evidencia de la plaga y no llegó.
  `app/(app)/trabajador/novedad/nueva/acciones.ts:57`. **Falta decidir qué
  mostrar.**
- [ok] Sin `console.log` en el código de la app. Sin TODO ni FIXME.
- [ok] El overlay de diagnóstico (`DiagnosticoDesborde`) sólo aparece con
  `?diag=1`; devuelve `null` el resto del tiempo. Su comentario dice "temporal":
  se puede quitar antes de entregar, pero no se ve.
- [ok] Los tres `eslint-disable exhaustive-deps` del cliente de alertas son
  correctos: `filtrar` sólo cierra sobre `query` y `tipo`, que sí están en las
  dependencias.
- [ ] Estados vacíos: **clientes, proveedores, compras, novedades, servicios
      contratados y jornales están todos en cero.** Hay que ver qué muestra cada
      pantalla así.
- [ ] Validación de formularios.

## 5. Pendientes que dependen del jefe

- [ ] **Limpieza de datos de prueba.** Bloqueada esperando decisión. El ensayo
      en seco borra 1570 registros: 1520 árboles, 2 cosechas (2.330 kg) y 4 pagos
      ($5.020.000).
- [ ] **Tarifas reales.** Las 3 cargadas las inventé yo, marcadas provisionales.
- [ ] `connection_limit` / región de Vercel en `cle1`. Opcional.
- [ ] Push en iPhone. Aplazado.
- [ ] 3D en Android: nunca medido en aparato real.

## 6. PR abiertos (los tres en verde, sin mergear)

- **#50** alertas del jefe a bodega
- **#51** atajo de apiarios
- **#52** guarda de cron + formatos

Rama `revision/integracion` junta los tres para poder probar el estado final.
`tsc` en cero, lint limpio, 291 tests.

---

## Notas de entorno

- El Bash de Windows colapsa `\\` a `\` **aun dentro de un heredoc citado**.
  Cualquier script con backslash literal sale roto: usar `String.fromCharCode(92)`.
- `gh pr edit --body` falla por un campo deprecado de GitHub (Projects classic).
  Sirve `gh api -X PATCH repos/.../pulls/N -F body=@archivo`.
- El servidor de dev se cae solo cada tanto; conviene comprobarlo antes de
  cualquier barrido largo.

## Foto (decisión del jefe: "que se pueda con la foto en todo momento")

- [fix] La foto ya no exige señal: el blob se guarda en IndexedDB y sube solo. (`lib/offline/foto.ts`)
- [fix] Novedad sin señal ya puede llevar foto (antes el campo se escondía).
- [fix] Avance ya no obliga a elegir entre la foto y guardar el trabajo.
- [fix] Los dos fallos silenciosos de subida ahora avisan en vez de guardar sin foto.
- [fix] Validación del path de foto unificada en `lib/fotos-path.ts` (estaba duplicada y distinta).
- [ok] tsc 0, eslint 0, 296 tests, `npm run build` pasa.
- [ok] El exit 4 del build era el DLL de Prisma bloqueado por dev servers duplicados, no un error.

## Contraseña (decisión del jefe: "es una finca real, no son niños")

- [ok] No se pide la contraseña actual para cambiarla. Se deja como está.

## Validación de montos

- [fix] `Number('')` = 0 dejaba guardar jornal de $0 y tarifa de $0 sin avisar.
- [fix] Parseo de montos unificado en `lib/monto.ts` (estaba copiado en 9 archivos), con 7 tests.
- [ok] pagos, servicios, equipo, configuración ya rechazaban el vacío con `<= 0`.

## RLS en Supabase (verificado contra la base real)

- [ok] 33/34 tablas de `public` con RLS activo y policies. La 34ª es `spatial_ref_sys` (PostGIS, sin datos de la finca).
- [ok] Ninguna policy abierta a `anon`: las de rol `{public}` gatean por `auth.uid()`/`es_jefe()`.
- [ok] `cosechas_miel` tiene `USING (true)` pero `TO authenticated` — cualquier usuario de la finca ve la miel, que es lo esperado.
- [ok] `v_insumos_stock` y `v_stock_almacen` tienen `security_invoker=on`: la RLS de las tablas de abajo sí aplica.
- [ok] Probado con la anon key contra el REST API: personas, pagos, jornales, usuarios, cosechas_miel y novedades devuelven `[]`.
- [ok] Bucket `fotos` privado, sin policy de DELETE ni UPDATE, y `upsert: false`. Se sirve por URL firmada.

## Estados vacíos

- [ok] clientes, proveedores, compras, servicios, jornales: ícono + explicación + acción.
- [fix] novedades era la única con una frase suelta; ahora sigue el mismo patrón.

## Barrido a 320px contra build de producción (107 pantallas)

- [ok] **0 desbordes horizontales** en las 107 pantallas, en los 4 roles. El "se desliza" quedó cerrado.
- [ok] 91 ok · 3 redirecciones esperadas (`/`, `/login`, `/jefe/asistente` para JEFE).
- [!] `/jefe` y `/jefe/saldos` tiraron `P2024` (pool de Prisma agotado) durante el barrido. Ver abajo.

## Pool de conexiones a la base — DECISIÓN DEL JEFE

Medido desde esta máquina con las 15 consultas en paralelo que hace `/jefe`:

- `connection_limit=1` (lo que hay hoy): 8,5 s · 8,3 s · 8,6 s — con `pool_timeout` de 10 s.
  El margen es de 1,5 s, y durante el barrido se pasó: la pantalla de inicio del
  jefe murió con error de servidor.
- `connection_limit=5&pool_timeout=20`: 3,3 s · 3,1 s · 3,1 s.
- `connection_limit=10&pool_timeout=20`: 2,7 s (ya casi no mejora).

Recomendación: dejarlo en `connection_limit=5&pool_timeout=20` en la variable
`DATABASE_URL` de Vercel. Es un cambio de configuración de producción, no de
código, así que lo decide el jefe.

Aclaración honesta: esto NO explica que el e2e local sea lento e inestable.
Eso es la latencia de esta máquina hasta `aws-1-us-east-2` (~500 ms por consulta,
y cada pantalla hace varias). En Vercel, en la región de la base, no aplica.

## Probado en navegador de verdad (no solo por código)

- [ok] Sin señal el campo de foto sigue estando, la foto se guarda como blob en
  IndexedDB, se ve en Pendientes y sube sola al volver la conexión (`tests/e2e/foto-sin-senal.spec.ts`).
- [fix] `useOnlineStatus` nunca leía `navigator.onLine`: abrir la app ya sin señal
  decía que sí había.
- [fix] Un registro en "subiendo" cuyo envío se abortaba quedaba varado para siempre.
- [fix] Un avance parcial rebotaba al trabajador al inicio sin confirmarle nada.
- [fix] "Seguir con esta tarea" enlazaba a la misma URL y no hacía nada.
- [fix] El teardown e2e dejaba novedades de prueba (y fotos) en la base de la finca.

## Estado final de las pruebas

- [ok] 303 tests unitarios · tsc 0 · eslint 0 · `npm run build` pasa.
- [ok] e2e: los 4 specs pasan (flujos críticos incluido, 57 s).
- [!] El e2e local es lento e inestable: la misma corrida tardó 5 s una vez y
  más de 60 s otra. Servidor sin un solo error en el log. Es la distancia hasta
  la región de la base (~500 ms por consulta) más el túnel de Sentry
  (`tunnelRoute: '/monitoring'`, que hace pasar cada evento por el servidor).
  En CI, que corre dentro del datacenter, no se ve. No es la app.

## Datos que siguen en la base (borrado pendiente de tu OK)

- 1520 árboles · 16 lotes · 4 personas · 10 asignaciones
- 2 cosechas · 4 pagos · 0 jornales · 0 novedades
- 3 tarifas de $50.000 (Plateo químico, Poda, Fertilización) — son valores que
  inventé yo de relleno, hay que poner los reales antes de entregar.

## El service worker nunca se registraba (lo más grave de toda la revisión)

> Este arreglo va en un PR aparte a propósito: enciende 489 líneas de `sw.js`
> que nunca corrieron para un usuario real, y si da problemas hay que poder
> revertirlo sin llevarse por delante la foto, el clima y los montos.

El registro vivía dentro de `window.addEventListener('load', ...)`, pero el
`<Script strategy="afterInteractive">` de Next corre muchas veces DESPUÉS de que
`load` ya disparó: el listener quedaba esperando un evento que ya había pasado.

Consecuencia: sin caché de navegación, sin pantallas de respaldo sin señal y sin
caché de baldosas. La capa offline entera —la premisa de la app— estaba muerta
salvo para quien activara notificaciones push, que registra el SW por su cuenta.

Medido en `/jefe`, build de producción:

- Antes: 0 registros, 0 cachés, 70-83 baldosas y **2.596 KB de red en CADA visita**.
- Después: 1 registro, 83 baldosas servidas por el SW, **0 KB de red**.

Aparte: `/jefe` responde en 90 ms en el servidor de Vercel. Lo que se veía como
"8 segundos" era `networkidle` esperando esas baldosas. LCP real: 452 ms.

## Corrección a lo que dije antes sobre el pool

Los errores `P2024` del barrido salieron de mi `localhost`, NO de producción.
Desde acá cada consulta cuesta ~500 ms; en Vercel, misma región que la base,
~5 ms. Producción nunca estuvo rota por esto. El cambio a
`connection_limit=5&pool_timeout=20` quedó aplicado igual: no hace daño y da
margen, pero no arregló lo que dije que arreglaba.
