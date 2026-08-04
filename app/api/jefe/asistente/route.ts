import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { obtenerUsuarioActual } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import { obtenerClienteIA, MODELO, MAX_TOKENS } from '@/lib/ia/cliente';
import { ESQUEMA_FINCA, INSTRUCCIONES } from '@/lib/ia/esquema';
import { consultarDatos, serializarFilas } from '@/lib/ia/consultar';

/**
 * Asistente: traduce una pregunta en lenguaje natural a SQL, la ejecuta con el
 * rol de solo lectura y redacta la respuesta.
 *
 * Responde en NDJSON (una línea JSON por evento) en vez de un único payload:
 * una pregunta con análisis tarda entre 10 y 20 segundos, y sin señal de avance
 * la pantalla parece colgada. Los eventos también exponen el SQL usado, que es
 * lo que permite comprobar de dónde salió cada número.
 */

/** Vueltas de consulta antes de cortar. Evita un ida y vuelta infinito. */
const MAX_VUELTAS = 4;

type Evento =
  | { tipo: 'estado'; texto: string }
  | { tipo: 'sql'; sql: string; filas: number }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'error'; texto: string }
  | { tipo: 'fin' };

const HERRAMIENTA = {
  name: 'consultar_datos',
  description:
    'Consulta la base de datos de la finca con SQL de solo lectura. Devuelve las filas en JSON.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: {
        type: 'string',
        description: 'Consulta SELECT o WITH de PostgreSQL. Una sola sentencia, sin punto y coma.',
      },
    },
    required: ['sql'],
  },
};

export async function POST(req: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'JEFE') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }

  const cliente = obtenerClienteIA();
  if (!cliente) {
    return NextResponse.json(
      { ok: false, error: 'El asistente no está configurado.' },
      { status: 503 }
    );
  }

  let pregunta: string;
  try {
    const cuerpo = (await req.json()) as { pregunta?: unknown };
    if (typeof cuerpo.pregunta !== 'string' || cuerpo.pregunta.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'Falta la pregunta' }, { status: 400 });
    }
    pregunta = cuerpo.pregunta.trim().slice(0, 2000);
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 });
  }

  const codificador = new TextEncoder();

  const stream = new ReadableStream({
    async start(controlador) {
      const emitir = (e: Evento) =>
        controlador.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));

      try {
        const mensajes: Anthropic.MessageParam[] = [{ role: 'user', content: pregunta }];

        for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          emitir({ tipo: 'estado', texto: vuelta === 0 ? 'Pensando…' : 'Revisando los datos…' });

          const respuesta = await cliente.messages.create({
            model: MODELO,
            max_tokens: MAX_TOKENS,
            system: [
              {
                type: 'text',
                text: `${ESQUEMA_FINCA}\n\n${INSTRUCCIONES}`,
                // El esquema no cambia entre preguntas: cachearlo lo cobra al 10 %.
                cache_control: { type: 'ephemeral' },
              },
            ],
            tools: [HERRAMIENTA],
            messages: mensajes,
          });

          const usos = respuesta.content.filter((b) => b.type === 'tool_use');

          // Sin consultas pendientes: lo que haya escrito es la respuesta final.
          if (usos.length === 0) {
            for (const bloque of respuesta.content) {
              if (bloque.type === 'text') emitir({ tipo: 'texto', texto: bloque.text });
            }
            emitir({ tipo: 'fin' });
            controlador.close();
            return;
          }

          emitir({ tipo: 'estado', texto: 'Consultando los datos de la finca…' });
          mensajes.push({ role: 'assistant', content: respuesta.content });

          const resultados = [];
          for (const uso of usos) {
            const sql = String((uso.input as { sql?: unknown }).sql ?? '');
            const r = await consultarDatos(sql);

            if (r.ok) {
              emitir({ tipo: 'sql', sql: r.sql, filas: r.filas.length });
              const datos = serializarFilas(r.filas);
              resultados.push({
                type: 'tool_result' as const,
                tool_use_id: uso.id,
                content: r.truncado ? `${datos}\n(resultado recortado)` : datos,
              });
            } else {
              // El motivo del rechazo vuelve al modelo para que reformule.
              resultados.push({
                type: 'tool_result' as const,
                tool_use_id: uso.id,
                content: r.error,
                is_error: true,
              });
            }
          }

          mensajes.push({ role: 'user', content: resultados });
        }

        emitir({
          tipo: 'error',
          texto: 'No pude resolverlo en varios intentos. Probá con una pregunta más específica.',
        });
        emitir({ tipo: 'fin' });
        controlador.close();
      } catch (e) {
        emitir({ tipo: 'error', texto: sanitizarError(e, 'asistente') });
        emitir({ tipo: 'fin' });
        controlador.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
