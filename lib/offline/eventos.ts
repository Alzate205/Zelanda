// Emisor de eventos para que las pantallas reaccionen a cambios en la cola.

type Listener = () => void;

const listeners: Set<Listener> = new Set();

export function suscribirseACambios(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitirCambio(): void {
  listeners.forEach((fn) => fn());
}
