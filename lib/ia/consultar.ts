import 'server-only';
import { PrismaClient } from '@prisma/client';
import { validarSql } from './validar-sql';

/**
 * Ejecuta el SQL que escribió el modelo, con el rol restringido.
 *
 * Usa una conexión propia (DATABASE_URL_IA → rol `zelanda_ia`), separada de la
 * que usa el resto de la app. Esa separación es la que hace que el asistente no
 * pueda escribir: su usuario de base de datos carece del permiso, sin importar
 * qué diga el prompt o qué deje pasar la validación.
 */

const MAX_FILAS_AL_MODELO = 100;
const TIMEOUT_MS = 10_000;

let cliente: PrismaClient | null | undefined;

function obtenerClienteLectura(): PrismaClient | null {
  if (cliente !== undefined) return cliente;

  const url = process.env.DATABASE_URL_IA;
  cliente = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
  return cliente;
}

export type ResultadoConsulta =
  | { ok: true; filas: unknown[]; truncado: boolean; sql: string }
  | { ok: false; error: string };

export async function consultarDatos(sqlCrudo: string): Promise<ResultadoConsulta> {
  const validacion = validarSql(sqlCrudo);
  if (!validacion.ok) {
    return { ok: false, error: validacion.motivo };
  }

  const prisma = obtenerClienteLectura();
  if (!prisma) {
    return { ok: false, error: 'La conexión de solo lectura no está configurada.' };
  }

  try {
    const filas = await prisma.$transaction(
      async (tx) => {
        // El timeout corre del lado del motor: una consulta pesada se corta sola
        // en vez de dejar la petición colgada.
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
        return tx.$queryRawUnsafe<unknown[]>(validacion.sql);
      },
      { timeout: TIMEOUT_MS + 2_000 }
    );

    // Lo que vuelve al modelo se factura, así que se recorta acá también.
    const truncado = filas.length > MAX_FILAS_AL_MODELO;

    return {
      ok: true,
      filas: truncado ? filas.slice(0, MAX_FILAS_AL_MODELO) : filas,
      truncado,
      sql: validacion.sql,
    };
  } catch (e) {
    // El mensaje del motor vuelve al modelo para que reformule (tabla mal escrita,
    // columna inexistente, permiso denegado). No expone nada que el rol no viera ya.
    const mensaje = e instanceof Error ? e.message.split('\n').slice(-3).join(' ') : 'error';
    return { ok: false, error: `La consulta falló: ${mensaje}` };
  }
}

/**
 * Serializa filas para el modelo. Prisma devuelve BigInt y Decimal, que
 * `JSON.stringify` no sabe convertir — sin esto la llamada revienta.
 */
export function serializarFilas(filas: unknown[]): string {
  return JSON.stringify(filas, (_clave, valor) => {
    if (typeof valor === 'bigint') return valor.toString();
    if (valor && typeof valor === 'object' && 'toFixed' in valor) return String(valor);
    return valor;
  });
}
