'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Database, ChevronDown, AlertCircle } from 'lucide-react';

type Consulta = { sql: string; filas: number };

type Turno = {
  pregunta: string;
  respuesta: string;
  consultas: Consulta[];
  estado: string | null;
  error: string | null;
};

const SUGERENCIAS = [
  '¿Cuánto cosechamos este año por lote?',
  '¿Qué lote rinde más por hectárea?',
  '¿Cuánto llevo gastado en insumos este año?',
  '¿Cómo controlo la antracnosis en Hass?',
];

function BloqueSQL({ consultas }: { consultas: Consulta[] }) {
  const [abierto, setAbierto] = useState(false);
  if (consultas.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 px-2.5 py-1 text-[11px] text-zelanda-verde-700 transition hover:bg-zelanda-beige-100"
      >
        <Database className="h-3 w-3" aria-hidden />
        {consultas.length === 1 ? 'Ver la consulta' : `Ver las ${consultas.length} consultas`}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {abierto ? (
        <div className="mt-1.5 space-y-1.5">
          {consultas.map((c, i) => (
            <div key={i} className="overflow-x-auto rounded-lg bg-zelanda-verde-900 p-2.5">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zelanda-beige-100">
                {c.sql}
              </pre>
              <p className="mt-1.5 text-[10px] text-zelanda-beige-100/60">
                {c.filas} {c.filas === 1 ? 'fila' : 'filas'}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatAsistente() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [entrada, setEntrada] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos]);

  async function preguntar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || ocupado) return;

    setEntrada('');
    setOcupado(true);
    setTurnos((t) => [
      ...t,
      { pregunta, respuesta: '', consultas: [], estado: 'Pensando…', error: null },
    ]);

    const actualizar = (cambio: Partial<Turno>) =>
      setTurnos((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, ...cambio } : x)));

    try {
      const res = await fetch('/api/jefe/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta }),
      });

      if (!res.ok || !res.body) {
        const cuerpo = await res.json().catch(() => ({ error: 'No se pudo responder.' }));
        actualizar({ estado: null, error: cuerpo.error ?? 'No se pudo responder.' });
        return;
      }

      // NDJSON: se acumula el buffer y se procesa línea completa por línea completa.
      const lector = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lineas = buffer.split('\n');
        buffer = lineas.pop() ?? '';

        for (const linea of lineas) {
          if (!linea.trim()) continue;
          const ev = JSON.parse(linea);

          if (ev.tipo === 'estado') actualizar({ estado: ev.texto });
          else if (ev.tipo === 'sql') {
            setTurnos((t) =>
              t.map((x, i) =>
                i === t.length - 1
                  ? { ...x, consultas: [...x.consultas, { sql: ev.sql, filas: ev.filas }] }
                  : x
              )
            );
          } else if (ev.tipo === 'texto') {
            setTurnos((t) =>
              t.map((x, i) =>
                i === t.length - 1 ? { ...x, respuesta: x.respuesta + ev.texto, estado: null } : x
              )
            );
          } else if (ev.tipo === 'error') actualizar({ estado: null, error: ev.texto });
          else if (ev.tipo === 'fin') actualizar({ estado: null });
        }
      }
    } catch {
      actualizar({ estado: null, error: 'Se cortó la conexión.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {turnos.length === 0 ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <p className="text-[13px] text-zelanda-verde-800">
            Preguntá sobre los datos de la finca en tus palabras. También responde dudas agronómicas
            sobre el Hass.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => preguntar(s)}
                className="rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50 px-3 py-2 text-left text-[13px] text-zelanda-verde-800 transition hover:border-zelanda-verde-300"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {turnos.map((t, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-zelanda-verde-700 px-3.5 py-2 text-[14px] text-zelanda-beige-50">
            {t.pregunta}
          </p>

          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave">
            {t.estado ? (
              <p className="flex items-center gap-2 text-[13px] text-zelanda-verde-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zelanda-verde-600" />
                {t.estado}
              </p>
            ) : null}

            {t.respuesta ? (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zelanda-verde-900">
                {t.respuesta}
              </p>
            ) : null}

            {t.error ? (
              <p className="flex items-start gap-2 text-[13px] text-zelanda-ocre-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t.error}
              </p>
            ) : null}

            <BloqueSQL consultas={t.consultas} />
          </section>
        </div>
      ))}

      <div ref={finRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(entrada);
        }}
        className="sticky bottom-20 flex gap-2 rounded-2xl border border-zelanda-beige-200 bg-white p-2 shadow-card"
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Preguntá algo…"
          disabled={ocupado}
          className="min-w-0 flex-1 bg-transparent px-2 text-[15px] text-zelanda-verde-900 outline-none placeholder:text-zelanda-verde-700/50"
        />
        <button
          type="submit"
          disabled={ocupado || !entrada.trim()}
          aria-label="Enviar"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-xl bg-zelanda-verde-700 px-3 text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-40"
        >
          <Send className="h-[18px] w-[18px]" />
        </button>
      </form>
    </div>
  );
}
