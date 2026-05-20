import { requerirUsuario } from "@/lib/auth";
import { HeaderApp } from "@/components/shared/HeaderApp";
import { BottomNav } from "@/components/shared/BottomNav";
import { PushPrompt } from "@/components/shared/PushPrompt";
import { SyncEngineInit } from "@/components/shared/SyncEngineInit";
import { BannerOffline } from "@/components/shared/BannerOffline";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();

  return (
    <div className="flex min-h-screen flex-col bg-zelanda-beige-50">
      <HeaderApp usuario={usuario} />
      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-6">
        {children}
      </main>
      <BottomNav rol={usuario.rol} />
      <PushPrompt />
      <SyncEngineInit />
      <BannerOffline />
    </div>
  );
}
