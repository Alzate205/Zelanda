"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const EditorPunto = dynamic(() => import("./EditorPunto"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

type LngLat = [number, number];

export function EditorPuntoCargador({
  inicial,
  hiddenName,
}: {
  inicial: LngLat | null;
  hiddenName: string;
}) {
  const [punto, setPunto] = useState<LngLat | null>(inicial);
  return (
    <>
      <EditorPunto inicial={inicial} onChange={setPunto} />
      <input
        type="hidden"
        name={hiddenName}
        value={punto ? JSON.stringify(punto) : ""}
      />
    </>
  );
}
