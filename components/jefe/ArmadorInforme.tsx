'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { BotonCopiarInforme } from './BotonCopiarInforme';
import {
  unirInforme,
  CLAVES_SECCION,
  type ClaveSeccion,
  type PartesInforme,
} from '@/lib/ia/informe-finca';

function miles(texto: string): string {
  return `~${Math.max(1, Math.round(texto.length / 1000))} mil caracteres`;
}

/**
 * Deja armar el informe a medida antes de copiarlo.
 *
 * El texto se rearma en el navegador con las piezas que ya vinieron del
 * servidor: marcar y desmarcar no cuesta ni una consulta. Lo que sí vuelve al
 * servidor es "Actualizar datos", porque para eso hay que releer la finca.
 */
export function ArmadorInforme({
  partes,
  generadoEn,
}: {
  partes: PartesInforme;
  generadoEn: string;
}) {
  const router = useRouter();
  const [refrescando, iniciarRefresco] = useTransition();
  const [elegidas, setElegidas] = useState<ClaveSeccion[]>(CLAVES_SECCION);

  const informe = unirInforme(partes, elegidas);
  const todas = elegidas.length === partes.secciones.length;

  function alternar(clave: ClaveSeccion) {
    setElegidas((previas) =>
      previas.includes(clave) ? previas.filter((c) => c !== clave) : [...previas, clave]
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-base text-zelanda-verde-900">Qué llevar</h2>
          <button
            type="button"
            onClick={() => setElegidas(todas ? [] : CLAVES_SECCION)}
            className="rounded-lg border border-zelanda-beige-300 px-2.5 py-1 text-xs font-semibold text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          >
            {todas ? 'Quitar todas' : 'Marcar todas'}
          </button>
        </div>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Quitá lo que no venga al caso y el informe queda más corto y más al grano.
        </p>

        <ul className="mt-3 space-y-1.5">
          {partes.secciones.map((s) => {
            const marcada = elegidas.includes(s.clave);
            return (
              <li key={s.clave}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-2.5 transition ${
                    marcada
                      ? 'border-zelanda-verde-700 bg-zelanda-verde-50'
                      : 'border-zelanda-beige-300 bg-white hover:bg-zelanda-beige-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternar(s.clave)}
                    className="mt-0.5 h-5 w-5 flex-shrink-0 accent-zelanda-verde-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold text-zelanda-verde-900">
                        {s.titulo}
                      </span>
                      <span className="whitespace-nowrap text-[11px] tabular-nums text-zelanda-verde-700/60">
                        {s.texto.length.toLocaleString('es-CO')}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-zelanda-verde-700">
                      {s.descripcion}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[12px] text-zelanda-verde-700/70">
          El contexto de la finca y las preguntas del final van siempre: sin eso la IA no sabe de
          qué le estás hablando.
        </p>
      </section>

      <BotonCopiarInforme texto={informe} />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-zelanda-beige-200 bg-white px-4 py-3 shadow-suave">
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-semibold text-zelanda-verde-900">
            Datos de {generadoEn}
          </p>
          <p className="m-0 text-[12px] text-zelanda-verde-700/70">
            El informe es una foto del momento en que se generó.
          </p>
        </div>
        <button
          type="button"
          onClick={() => iniciarRefresco(() => router.refresh())}
          disabled={refrescando}
          className="flex min-h-touch flex-shrink-0 items-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-3.5 text-[13px] font-semibold text-zelanda-verde-800 transition hover:bg-zelanda-beige-200 disabled:opacity-60"
        >
          <RotateCw className={`h-4 w-4 ${refrescando ? 'animate-spin' : ''}`} />
          {refrescando ? 'Actualizando…' : 'Actualizar datos'}
        </button>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-base text-zelanda-verde-900">Lo que se va a copiar</h2>
          <span className="text-xs tabular-nums text-zelanda-verde-700">{miles(informe)}</span>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-zelanda-beige-200 bg-white p-4 text-[12.5px] leading-relaxed text-zelanda-verde-900 shadow-suave">
          {informe}
        </pre>
      </section>
    </div>
  );
}
