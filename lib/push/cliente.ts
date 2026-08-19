/**
 * Lógica de suscripción push del navegador, compartida.
 *
 * Antes vivía duplicada en PushPrompt y PushToggle, y las copias se separaron:
 * el cartel recibió seis arreglos seguidos (iPhone, Safari, worker que no
 * arranca) y el toggle de Mi Perfil se quedó con la versión original rota. Como
 * en Android el cartel deja de aparecer apenas se toca el permiso una vez, el
 * toggle es la única puerta que queda — y era la mala. Una sola copia evita que
 * vuelva a pasar.
 */

/** Cuánto se espera a que el servicio de avisos conteste antes de rendirse. */
const TOPE_SUSCRIPCION = 15000;
/** Cuánto se espera a que el worker de la app termine de arrancar. */
const TOPE_ARRANQUE = 10000;

/**
 * Se agotó la espera. Distinto de un rechazo: nadie dijo que no, no contestaron.
 *
 * Tiene tipo propio porque cambia la decisión de qué hacer después. Un rechazo
 * de verdad puede depender de la forma de la clave y conviene reintentar con
 * otra; un silencio no: el navegador atiende los registros push de a uno, así
 * que si el primero quedó colgado los siguientes se cuelgan igual.
 */
export class ErrorTope extends Error {
  constructor(public readonly que: string) {
    super(`sin respuesta de ${que}`);
    this.name = 'ErrorTope';
  }
}

/** Acota una espera que puede no terminar nunca. */
export function conTope<T>(promesa: Promise<T>, ms: number, que: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, reject) => setTimeout(() => reject(new ErrorTope(que)), ms)),
  ]);
}

export function esIPhone(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

export function estaInstalada(): boolean {
  const navegadorIOS = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navegadorIOS.standalone === true
  );
}

export function soportaPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  );
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Plana = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Plana);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Deja el worker listo y activo, registrándolo si hace falta.
 *
 * Conviene llamarla al montar la pantalla, no al tocar el botón: en iPhone hay
 * que llegar a `subscribe()` sin esperas de por medio (ver `activarPush`).
 */
export async function obtenerRegistro(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration();
  if (existente?.active) return existente;
  if (!existente) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      throw new Error(`no se pudo registrar: ${detalle}`);
    }
  }
  return conTope(navigator.serviceWorker.ready, TOPE_ARRANQUE, 'el arranque de la app');
}

function mismaClave(sub: PushSubscription, clave: Uint8Array): boolean {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return false;
  const bytes = new Uint8Array(actual as ArrayBuffer);
  return bytes.length === clave.length && bytes.every((b, i) => b === clave[i]);
}

/**
 * Consigue la suscripción push, reusando la que ya haya si sirve.
 *
 * Solo se da de baja la vieja si cambió la clave: en iPhone, dar de baja y
 * volver a suscribir enseguida hace que el servicio de Apple conteste
 * "internal service error".
 */
export async function suscribir(
  reg: ServiceWorkerRegistration,
  claveTexto: string,
  claveBytes: Uint8Array
): Promise<PushSubscription> {
  const vieja = await reg.pushManager.getSubscription();
  if (vieja) {
    if (mismaClave(vieja, claveBytes)) return vieja;
    try {
      await vieja.unsubscribe();
    } catch {
      /* si no deja darla de baja, igual intentamos suscribir */
    }
  }

  // La especificación acepta la clave como texto base64url o como bytes, y
  // Safari no trata las dos formas igual: con los bytes devuelve
  // "AbortError: Failed due to internal service error". Se prueba primero el
  // texto, que es lo que mejor le sienta, y los bytes quedan de respaldo para
  // los navegadores que solo entienden esa forma.
  const formas: (string | Uint8Array)[] = [claveTexto, claveBytes];

  let ultimo: unknown = null;
  for (const forma of formas) {
    try {
      return await conTope(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: forma as unknown as BufferSource,
        }),
        TOPE_SUSCRIPCION,
        'el servicio de avisos'
      );
    } catch (e) {
      ultimo = e;
      // Si no contestaron, probar otra forma de la clave es tiempo perdido: el
      // navegador atiende los registros de a uno y el pedido anterior sigue
      // colgado, así que el siguiente espera detrás y vence igual. Antes esto
      // eran cuatro intentos encadenados: un minuto de "Activando..." para
      // terminar mostrando el mismo silencio.
      if (e instanceof ErrorTope) throw e;
    }
  }
  throw ultimo;
}

/**
 * Traduce el fallo a algo accionable, nombrando el paso que se cayó.
 * El texto crudo va detrás para poder pasarlo si hay que investigar.
 */
export function motivo(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);

  if (texto.includes('arranque de la app') || texto.includes('no se pudo registrar')) {
    // Pasó de verdad: la app quedó instalada desde un enlace de prueba de
    // Vercel, que pide iniciar sesión y por eso responde el sw.js con una
    // redirección. Un worker que redirige no se registra nunca, así que la
    // parte offline y los avisos no arrancan. Mostrar la dirección es lo que
    // permite darse cuenta sin tener que adivinar.
    return (
      `El motor de la app no arrancó en ${location.host}. ` +
      'Si esa no es la dirección de siempre, la app quedó instalada desde un enlace ' +
      'de prueba: borrala de la pantalla de inicio e instalala de nuevo desde la buena.'
    );
  }
  if (texto.includes('registro en el servidor')) {
    return 'El permiso quedó dado pero no se pudo guardar en el servidor. Probá de nuevo con señal.';
  }
  if (esIPhone() && !estaInstalada()) {
    return 'En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio.';
  }
  // Un silencio no es un rechazo. Decir "el celular rechazó la suscripción"
  // mandaba a buscar el problema en el teléfono, cuando lo que pasó es que la
  // app se cansó de esperar una respuesta que nunca llegó.
  if (e instanceof ErrorTope) {
    return (
      'El servicio de avisos del celular no contestó. Casi siempre es la señal: ' +
      'probá con wifi o en un punto con mejor cobertura y volvé a intentar. ' +
      'Si igual no contesta, mostrale esto al jefe: ' +
      `sin respuesta de ${e.que} en ${location.host}.`
    );
  }
  if (e instanceof Error && e.name === 'AbortError') {
    return (
      'El servicio de avisos de Apple rechazó el registro. Revisá que el Modo de ' +
      'bajo consumo esté apagado y que haya internet estable, y probá de nuevo. ' +
      'Si La Zelanda no aparece en Ajustes → Notificaciones, es que iOS nunca ' +
      'llegó a registrarla.'
    );
  }
  const nombre = e instanceof Error && e.name && e.name !== 'Error' ? `${e.name}: ` : '';
  return `El celular rechazó la suscripción en ${location.host}. Mostrale esto al jefe: ${nombre}${texto}`;
}

/** Nombre corto del navegador: es lo primero que hay que saber para reproducir. */
function navegador(): string {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'Chrome iOS';
  if (/FxiOS/.test(ua)) return 'Firefox iOS';
  if (/EdgiOS|Edg/.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'otro';
}

function sistema(): string {
  const ua = navigator.userAgent;
  const ios = /OS (\d+)[._](\d+)/.exec(ua);
  if (/iP(hone|od|ad)/.test(ua)) return `iOS ${ios ? `${ios[1]}.${ios[2]}` : '?'}`;
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  return 'otro';
}

/**
 * Retrato del estado del celular en el momento del fallo.
 *
 * Con "no contestó" a secas no se puede avanzar. Va en el propio aviso para que
 * se pueda leer y mandar sin abrir herramientas de desarrollo, que en un
 * celular no están a mano. Sin el navegador y el sistema no se puede siquiera
 * intentar reproducir, y sin el estado del worker no se distingue "arrancó" de
 * "quedó esperando su turno".
 */
export async function retrato(): Promise<string> {
  const partes: string[] = [];
  partes.push(`${navegador()} · ${sistema()}`);
  try {
    partes.push(`permiso ${Notification.permission}`);
  } catch {
    partes.push('permiso ?');
  }
  partes.push(estaInstalada() ? 'instalada sí' : 'instalada NO');
  partes.push(navigator.onLine ? 'red sí' : 'red NO');
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      partes.push('worker NO');
    } else {
      // "worker /" no distinguía un worker activo de uno que quedó instalando
      // y nunca tomó control, que es justo el caso en que subscribe() no
      // contesta.
      const fase = reg.active
        ? 'activo'
        : reg.installing
        ? 'instalando'
        : reg.waiting
        ? 'esperando'
        : 'sin arrancar';
      partes.push(`worker ${fase} en ${reg.scope.replace(location.origin, '') || '/'}`);
      const previa = await reg.pushManager.getSubscription();
      partes.push(previa ? 'suscripción previa sí' : 'suscripción previa no');
    }
  } catch {
    partes.push('worker ?');
  }
  return partes.join(' · ');
}

/**
 * Pide el permiso y suscribe, en ese orden y sin nada en el medio.
 *
 * El orden importa en iPhone: `subscribe()` exige correr dentro de la ventana
 * de activación que abre el toque del usuario, y cada `await` intermedio la
 * cierra. Antes se registraba el worker entre el permiso y la suscripción, y
 * para cuando se llamaba a `subscribe()` el gesto ya había vencido; WebKit en
 * ese caso no rechaza, deja la promesa colgada para siempre. Por eso el
 * registro se recibe ya hecho (`reg`, precalentado al montar la pantalla) y
 * cuando el permiso ya está dado ni siquiera se pasa por `requestPermission`.
 */
export async function activarPush(
  reg: ServiceWorkerRegistration,
  clavePublica: string
): Promise<PushSubscription | null> {
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;
  }
  return suscribir(reg, clavePublica, urlBase64ToUint8Array(clavePublica));
}
