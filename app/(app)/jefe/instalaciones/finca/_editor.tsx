"use client";

import dynamic from "next/dynamic";

const EditorBorde = dynamic(() => import("./_editor-cliente"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[65vh] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

export function EditorBordeCargador(props: { geojsonInicial: string | null }) {
  return <EditorBorde {...props} />;
}
