import { Suspense } from 'react';
import { requerirUsuario } from '@/lib/auth';
import { HeaderApp } from '@/components/shared/HeaderApp';
import { DiagnosticoDesborde } from '@/components/shared/DiagnosticoDesborde';
import { BottomNav } from '@/components/shared/BottomNav';
import { PushPrompt } from '@/components/shared/PushPrompt';
import { SyncEngineInit } from '@/components/shared/SyncEngineInit';
import { BannerOffline } from '@/components/shared/BannerOffline';
import { SesionLocal } from '@/components/shared/SesionLocal';
import { InstalarPWABanner } from '@/components/shared/InstalarPWABanner';
import { BarraListoTeclado } from '@/components/shared/BarraListoTeclado';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();

  return (
    <div className="alto-app flex flex-col bg-zelanda-beige-50">
      <HeaderApp usuario={usuario} />
      <main
        className="mx-auto w-full max-w-screen-md flex-1 px-4 py-6 scroll-smooth"
        style={{ scrollPaddingTop: '120px' }}
      >
        {children}
      </main>
      {/* El trabajador navega solo entre sus tareas: sin nav no hay dónde perderse. */}
      {usuario.rol === 'TRABAJADOR' ? null : <BottomNav rol={usuario.rol} />}
      <PushPrompt />
      <SyncEngineInit />
      <SesionLocal usuarioId={usuario.id} rol={usuario.rol} />
      <BannerOffline rol={usuario.rol} />
      <InstalarPWABanner />
      <BarraListoTeclado />
      {/* Temporal: panel de diagnóstico, se activa con ?diag=1 en la URL. */}
      <Suspense fallback={null}>
        <DiagnosticoDesborde />
      </Suspense>
    </div>
  );
}
