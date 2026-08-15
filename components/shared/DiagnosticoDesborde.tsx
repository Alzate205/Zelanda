'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Panel de diagnóstico de desbordamiento horizontal. Se activa agregando
 * `?diag=1` a cualquier URL de la app.
 *
 * Existe porque el desbordamiento reportado en celulares reales no se
 * reproduce en emulación (Chromium y WebKit, de 320 a 412 px, dan cero
 * elementos fuera de pantalla). En vez de seguir adivinando, se mide en el
 * dispositivo donde sí ocurre.
 *
 * Temporal: quitar cuando el problema esté resuelto.
 */

type Culpable = {
  etiqueta: string;
  izq: number;
  der: number;
  ancho: number;
};

type Medicion = {
  innerWidth: number;
  scrollWidth: number;
  clientWidth: number;
  scrollX: number;
  dpr: number;
  fontHtml: string;
  fontBody: string;
  ua: string;
  culpables: Culpable[];
};

function medir(): Medicion {
  const w = window.innerWidth;
  const culpables: Culpable[] = [];
  document.querySelectorAll('*').forEach((n) => {
    if (n.closest('[data-diag]')) return; // no medirse a sí mismo
    const b = n.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    if (b.right > w + 1 || b.left < -1) {
      const el = n as HTMLElement;
      const clase = String(el.className ?? '').slice(0, 70);
      culpables.push({
        etiqueta: `${n.tagName.toLowerCase()}${clase ? ` .${clase}` : ''}`,
        izq: Math.round(b.left),
        der: Math.round(b.right),
        ancho: Math.round(b.width),
      });
    }
  });
  return {
    innerWidth: w,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollX: Math.round(window.scrollX),
    dpr: window.devicePixelRatio,
    fontHtml: getComputedStyle(document.documentElement).fontSize,
    fontBody: getComputedStyle(document.body).fontSize,
    ua: navigator.userAgent,
    culpables: culpables.slice(0, 15),
  };
}

export function DiagnosticoDesborde() {
  const params = useSearchParams();
  const activo = params.get('diag') === '1';
  const [m, setM] = useState<Medicion | null>(null);
  const [copiado, setCopiado] = useState(false);

  const remedir = useCallback(() => setM(medir()), []);

  useEffect(() => {
    if (!activo) return;
    remedir();
    const id = setInterval(remedir, 1500);
    window.addEventListener('resize', remedir);
    window.addEventListener('scroll', remedir);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', remedir);
      window.removeEventListener('scroll', remedir);
    };
  }, [activo, remedir]);

  if (!activo || !m) return null;

  const desborda = m.scrollWidth > m.clientWidth;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(m, null, 2));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* si falla, el texto está a la vista */
    }
  }

  return (
    <div
      data-diag
      className="fixed inset-x-0 bottom-0 z-[9999] max-h-[55vh] overflow-auto border-t-4 border-red-600 bg-black/95 p-3 font-mono text-[11px] leading-tight text-green-300"
    >
      <div className="mb-2 flex items-center gap-2">
        <strong className={desborda ? 'text-red-400' : 'text-green-400'}>
          {desborda ? `DESBORDA ${m.scrollWidth - m.clientWidth}px` : 'sin desborde'}
        </strong>
        <button
          type="button"
          onClick={remedir}
          className="rounded bg-green-800 px-2 py-1 text-white"
        >
          medir
        </button>
        <button type="button" onClick={copiar} className="rounded bg-blue-800 px-2 py-1 text-white">
          {copiado ? 'copiado' : 'copiar'}
        </button>
      </div>
      <div>
        inner={m.innerWidth} scroll={m.scrollWidth} client={m.clientWidth} scrollX={m.scrollX}
      </div>
      <div>
        dpr={m.dpr} fontHtml={m.fontHtml} fontBody={m.fontBody}
      </div>
      <div className="mt-2 mb-1 text-yellow-300">
        {m.culpables.length === 0
          ? 'ningun elemento fuera'
          : `${m.culpables.length} elementos fuera:`}
      </div>
      {m.culpables.map((c, i) => (
        <div key={i} className="mb-1 break-all">
          <span className="text-white">
            [{c.izq}→{c.der}] w={c.ancho}
          </span>{' '}
          {c.etiqueta}
        </div>
      ))}
      <div className="mt-2 break-all text-[10px] text-gray-400">{m.ua}</div>
    </div>
  );
}
