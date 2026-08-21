'use client';

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  // Arranca en `true` a propósito: en el servidor no existe `navigator`, y
  // renderizar "sin señal" en el HTML haría parpadear la app en cada carga.
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    const sincronizar = () => setOnline(navigator.onLine);
    // Abrir la app ya sin señal —lo normal en el lote— no dispara ningún
    // evento, así que sin esta primera lectura la app se quedaba diciendo que
    // había conexión hasta que la señal cambiara.
    sincronizar();
    window.addEventListener('online', sincronizar);
    window.addEventListener('offline', sincronizar);
    return () => {
      window.removeEventListener('online', sincronizar);
      window.removeEventListener('offline', sincronizar);
    };
  }, []);

  return online;
}
