'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// MapLibre usa window/document: solo cliente.
const CentroControl = dynamic(() => import('./CentroControl').then((m) => m.CentroControl), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70svh] items-center justify-center text-sm text-zelanda-verde-700">
      Cargando centro de control…
    </div>
  ),
});

export function CentroControlCargador(props: ComponentProps<typeof CentroControl>) {
  return <CentroControl {...props} />;
}
