"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstalarPWABanner() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evento || oculto) return null;

  return (
    <div className="fixed inset-x-3 bottom-[88px] z-30 flex items-center gap-3 rounded-2xl border border-zelanda-beige-200 bg-white p-3.5 shadow-[0_20px_50px_rgba(20,44,26,0.28)]">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-zelanda-verde-700 to-zelanda-verde-900">
        <Image
          src="/logo-zelanda.png"
          alt=""
          width={52}
          height={52}
          style={{ height: 52, width: "auto" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-base text-zelanda-verde-900">
          Instala FincApp
        </p>
        <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-zelanda-verde-700">
          Funciona sin internet en campo. Sin tienda de apps.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await evento.prompt();
              const { outcome } = await evento.userChoice;
              if (outcome === "accepted") setEvento(null);
            }}
            className="h-9 flex-1 rounded-[10px] bg-zelanda-verde-700 px-3 text-[13.5px] font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={() => setOculto(true)}
            className="h-9 rounded-[10px] px-3 text-[13.5px] font-medium text-zelanda-verde-800"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
