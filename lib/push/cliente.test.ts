import { describe, expect, it, vi, afterEach } from 'vitest';
import { ErrorTope, conTope, suscribir, suscribirAhora, urlBase64ToUint8Array } from './cliente';

// Clave VAPID pública de ejemplo (65 bytes en base64url), solo para las pruebas.
const CLAVE =
  'BFV-rSiRW3XcQz8bGZ0mXKqK8h3_bZ3vC5rQ1dTfJc9nP7sYw2xVaGkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq';

function registroFalso(pushManager: Partial<PushManager>): ServiceWorkerRegistration {
  return { pushManager } as unknown as ServiceWorkerRegistration;
}

function suscripcionFalsa(clave?: Uint8Array): PushSubscription {
  return {
    options: clave
      ? { applicationServerKey: clave.buffer.slice(0) as ArrayBuffer }
      : { applicationServerKey: null },
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('conTope', () => {
  it('rechaza con ErrorTope cuando la promesa no contesta a tiempo', async () => {
    vi.useFakeTimers();
    const nunca = new Promise<string>(() => {});
    const carrera = conTope(nunca, 1000, 'el servicio de avisos');
    const esperado = expect(carrera).rejects.toBeInstanceOf(ErrorTope);
    await vi.advanceTimersByTimeAsync(1000);
    await esperado;
  });

  it('deja pasar el valor si contesta a tiempo', async () => {
    await expect(conTope(Promise.resolve('ok'), 1000, 'algo')).resolves.toBe('ok');
  });
});

describe('suscribir', () => {
  it('no reintenta con la otra forma de clave cuando no hubo respuesta', async () => {
    // El navegador atiende los registros push de a uno: si el primero quedó
    // colgado, los siguientes esperan detrás y vencen igual. Reintentar solo
    // multiplicaba la espera (eran 4 intentos = 60s de "Activando...").
    vi.useFakeTimers();
    const subscribe = vi.fn(() => new Promise<PushSubscription>(() => {}));
    const reg = registroFalso({
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: subscribe as unknown as PushManager['subscribe'],
    });

    const intento = suscribir(reg, CLAVE, urlBase64ToUint8Array(CLAVE));
    const esperado = expect(intento).rejects.toBeInstanceOf(ErrorTope);
    await vi.advanceTimersByTimeAsync(15000);
    await esperado;

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('prueba la clave como bytes cuando el navegador rechaza el texto', async () => {
    // Es el arreglo para Safari: con los bytes contesta "internal service
    // error", con el texto anda. El respaldo tiene que sobrevivir.
    const buena = suscripcionFalsa();
    const abort = Object.assign(new Error('internal service error'), { name: 'AbortError' });
    const subscribe = vi
      .fn()
      .mockRejectedValueOnce(abort)
      .mockResolvedValueOnce(buena) as unknown as PushManager['subscribe'];
    const reg = registroFalso({
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe,
    });

    await expect(suscribir(reg, CLAVE, urlBase64ToUint8Array(CLAVE))).resolves.toBe(buena);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect((subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0].applicationServerKey).toBe(
      CLAVE
    );
    expect(
      (subscribe as ReturnType<typeof vi.fn>).mock.calls[1][0].applicationServerKey
    ).toBeInstanceOf(Uint8Array);
  });

  it('reusa la suscripción existente si la clave no cambió', async () => {
    // Dar de baja y volver a suscribir enseguida es justo lo que rompe en iPhone.
    const bytes = urlBase64ToUint8Array(CLAVE);
    const vieja = suscripcionFalsa(bytes);
    const subscribe = vi.fn();
    const reg = registroFalso({
      getSubscription: vi.fn().mockResolvedValue(vieja),
      subscribe: subscribe as unknown as PushManager['subscribe'],
    });

    await expect(suscribir(reg, CLAVE, bytes)).resolves.toBe(vieja);
    expect(subscribe).not.toHaveBeenCalled();
    expect(vieja.unsubscribe).not.toHaveBeenCalled();
  });

  it('da de baja la vieja y suscribe de nuevo si la clave cambió', async () => {
    const bytes = urlBase64ToUint8Array(CLAVE);
    const vieja = suscripcionFalsa(new Uint8Array([1, 2, 3]));
    const nueva = suscripcionFalsa();
    const reg = registroFalso({
      getSubscription: vi.fn().mockResolvedValue(vieja),
      subscribe: vi.fn().mockResolvedValue(nueva) as unknown as PushManager['subscribe'],
    });

    await expect(suscribir(reg, CLAVE, bytes)).resolves.toBe(nueva);
    expect(vieja.unsubscribe).toHaveBeenCalled();
  });
});

describe('suscribirAhora', () => {
  it('no consulta la suscripción vieja cuando ya se la pasan', async () => {
    // Ese `await` corre justo antes de subscribe(), y en iPhone alcanza para
    // que se pierda la activación del toque y la promesa quede colgada.
    const getSubscription = vi.fn();
    const buena = suscripcionFalsa();
    const reg = registroFalso({
      getSubscription,
      subscribe: vi.fn().mockResolvedValue(buena) as unknown as PushManager['subscribe'],
    });

    await expect(suscribirAhora(reg, CLAVE, null)).resolves.toBe(buena);
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it('reusa la suscripción previa que le pasan si la clave no cambió', async () => {
    const vieja = suscripcionFalsa(urlBase64ToUint8Array(CLAVE));
    const subscribe = vi.fn();
    const reg = registroFalso({
      getSubscription: vi.fn(),
      subscribe: subscribe as unknown as PushManager['subscribe'],
    });

    await expect(suscribirAhora(reg, CLAVE, vieja)).resolves.toBe(vieja);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
