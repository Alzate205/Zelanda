/**
 * Portero de las consultas que escribe el modelo.
 *
 * Es la tercera capa de defensa, no la única: el rol `zelanda_ia` no tiene
 * permiso de escritura y las vistas ya ocultan los datos personales. Esto
 * ataja lo que igual no debería llegar a la base, y sobre todo evita gastar
 * una consulta (y plata) en algo que Postgres iba a rechazar.
 *
 * Ante la duda, rechaza. Un falso positivo cuesta que el modelo reformule;
 * un falso negativo cuesta una consulta que no queríamos.
 */

export type ResultadoValidacion = { ok: true; sql: string } | { ok: false; motivo: string };

/** Tope de filas cuando la consulta no trae uno. Es control de costo, no sólo de carga. */
export const LIMITE_FILAS = 500;

/** Verbos de escritura y DDL. Se comparan como palabra completa: `created_at` no cuenta. */
const PALABRAS_PROHIBIDAS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'copy',
  'vacuum',
  'reindex',
  'refresh',
  'call',
  'do',
  'execute',
  'prepare',
  'listen',
  'notify',
  'lock',
  'set',
  'reset',
];

/** Objetos que el asistente no debe tocar aunque el rol llegara a permitirlos. */
const OBJETOS_VEDADOS = [
  { patron: /\bauth\s*\./i, nombre: 'el esquema auth (credenciales)' },
  { patron: /\bstorage\s*\./i, nombre: 'el esquema storage' },
  { patron: /\bpg_/i, nombre: 'los catálogos internos de PostgreSQL' },
  { patron: /\binformation_schema\b/i, nombre: 'information_schema' },
  { patron: /\busuarios\b/i, nombre: 'la tabla usuarios' },
  { patron: /\bpush_subscriptions\b/i, nombre: 'la tabla push_subscriptions' },
  // Las tablas crudas con datos personales: existen vistas v_ia_* para eso.
  { patron: /\bpersonas\b/i, nombre: 'la tabla personas (usá v_ia_personas)' },
  { patron: /\bclientes\b/i, nombre: 'la tabla clientes (usá v_ia_clientes)' },
  { patron: /\bproveedores\b/i, nombre: 'la tabla proveedores (usá v_ia_proveedores)' },
];

export function validarSql(sqlCrudo: string): ResultadoValidacion {
  const sql = sqlCrudo.trim().replace(/;\s*$/, '');

  if (sql.length === 0) {
    return { ok: false, motivo: 'La consulta está vacía.' };
  }

  // Los comentarios son el escondite clásico para colar carga útil.
  if (sql.includes('--') || sql.includes('/*')) {
    return { ok: false, motivo: 'No se permiten comentarios en la consulta.' };
  }

  // Un `;` que sobrevivió al trim significa más de una sentencia.
  if (sql.includes(';')) {
    return { ok: false, motivo: 'Sólo se permite una sentencia por consulta.' };
  }

  // El verbo prohibido se busca antes que la forma: ante `DELETE FROM x`, saber
  // que el problema es el DELETE le sirve más al modelo que "debe empezar con SELECT".
  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (new RegExp(`\\b${palabra}\\b`, 'i').test(sql)) {
      return { ok: false, motivo: `La consulta no puede usar ${palabra.toUpperCase()}.` };
    }
  }

  if (!/^\s*(select|with)\b/i.test(sql)) {
    return { ok: false, motivo: 'La consulta debe empezar con SELECT o WITH.' };
  }

  for (const { patron, nombre } of OBJETOS_VEDADOS) {
    if (patron.test(sql)) {
      return { ok: false, motivo: `La consulta no puede leer ${nombre}.` };
    }
  }

  // El LIMIT acota el resultado que vuelve al modelo, que es lo que se factura.
  const conLimite = /\blimit\b/i.test(sql) ? sql : `${sql} LIMIT ${LIMITE_FILAS}`;

  return { ok: true, sql: conLimite };
}
