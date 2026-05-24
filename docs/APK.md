# Generar APK distribuible con PWABuilder

> **Resumen**: la app ya cumple los requisitos de PWA instalable. Para
> distribuir un APK por WhatsApp / instalación manual (sin Play Store),
> usás **PWABuilder** desde el navegador. No requiere código nuevo.

## Por qué un APK (y no solo PWA en el navegador)

La PWA ya se puede "Agregar a pantalla de inicio" desde Chrome en Android
y funciona como app nativa (gracias al manifest + service worker + el
banner `InstalarPWABanner`).

Un APK es útil cuando:

- **Distribución controlada**: querés mandarle el archivo a los trabajadores
  por WhatsApp en lugar de pedirles que abran la URL.
- **Instalación más simple para gente no técnica**: descargar e instalar
  es más intuitivo que el flujo "menú → instalar app".
- **Permisos de Android nativos**: el APK puede declarar permisos
  específicos (cámara, ubicación, almacenamiento) que se piden al instalar.
- **Marca**: aparece en la lista de apps con el ícono, sin barra del
  navegador.

## Pre-requisitos

1. **La app debe estar desplegada** y accesible públicamente vía HTTPS
   (Vercel ya lo hace). PWABuilder analiza la URL en vivo.
2. **El `manifest.webmanifest` debe estar completo** (id, name,
   short_name, start_url, scope, icons 192+512, theme_color,
   background_color, display). ✅ Ya lo está.
3. **Service worker registrado** y activo. ✅ Ya lo está (`/sw.js` +
   `RegistroSW`).
4. **Íconos**: al menos `192x192` y `512x512` PNG, con variantes
   `purpose: "any"` y `purpose: "maskable"`. ✅ Ya están.

## Paso a paso

### 1. Verificar el deploy

Asegurate que la última versión está desplegada en Vercel y abre la URL
de producción en el celular para confirmar que funciona.

### 2. Ir a PWABuilder

Abrí https://www.pwabuilder.com/ en una computadora.

### 3. Pegar la URL

En el input "Enter the URL of your PWA below", pegá la URL de producción
(p. ej. `https://zelanda.vercel.app`) y presioná **Start**.

### 4. Revisar el score

PWABuilder evalúa la app y muestra un puntaje. Lo esperado:

- **Manifest**: 30/30 (o cercano)
- **Service Worker**: ✅ válido
- **Security**: ✅ HTTPS

Si algún campo del manifest le falta, lo va a marcar. Volvé al código,
arreglalo, redeploy, y reanalizá.

### 5. Generar el paquete Android

Click en **Package for Stores** → **Android**.

PWABuilder ofrece varias opciones; para distribución por fuera de Play
Store la más útil es:

- **Other Android**: genera un APK firmado con una clave que PWABuilder
  crea para vos. Te lo da en un ZIP con:
  - `app-release-signed.apk`: el APK listo para instalar
  - `signing.keystore`: la clave de firma (guardala, la necesitás si en el
    futuro querés publicar a Play Store con la misma "identidad" de app)
  - `signing-key-info.txt`: la info de la clave (alias, contraseñas)

> **Importante**: guardá el `signing.keystore` y las contraseñas en un
> lugar seguro (1Password, drive privado, etc.). Sin ese archivo no podés
> publicar updates de la "misma" app después.

### 6. Distribuir el APK

Mandalo por WhatsApp a los trabajadores. Para instalar deben:

1. Tocar el archivo `.apk`.
2. Android va a pedir habilitar "Instalar apps de fuentes desconocidas"
   (a veces solo para Chrome o WhatsApp). Aceptar.
3. Tocar **Instalar**.

La app queda en la lista normal de apps con el ícono del aguacate.

## Actualizaciones

Cuando hay cambios y desplegás a Vercel, la PWA dentro del APK los va a
recibir automáticamente (porque el contenido se carga desde la URL).

**Excepción**: si cambiás `start_url`, `name`, `id`, íconos, permisos
nativos o algo del manifest que se "horneó" al APK, necesitás regenerar
el APK y redistribuirlo.

## Alternativa: TWA con Bubblewrap

PWABuilder por debajo genera una **TWA (Trusted Web Activity)**. Si en
algún momento querés hacerlo a mano (más control), Google ofrece
`@bubblewrap/cli`. Para el caso de uso de La Zelanda, PWABuilder web
alcanza.

## Cuándo regenerar el APK

- Cambio mayor de marca (nombre, ícono)
- Quitar/agregar `share_target` o permisos nativos
- Cambio de `start_url` o `scope`
- Nueva versión mayor que querés señalizar a los usuarios

Para el resto (features, bug fixes, UI), basta con redeploy de Vercel.
