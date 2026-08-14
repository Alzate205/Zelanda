import { describe, it, expect } from 'vitest';
import { validarSql, LIMITE_FILAS } from './validar-sql';

/** Falla el test con el motivo si la consulta fue rechazada. */
const sqlDe = (r: ReturnType<typeof validarSql>) => {
  if (!r.ok) throw new Error(`se esperaba que pasara, pero: ${r.motivo}`);
  return r.sql;
};

describe('validarSql — consultas legítimas', () => {
  it('acepta un SELECT simple', () => {
    const r = validarSql('SELECT nombre FROM lotes');
    expect(r.ok).toBe(true);
  });

  it('acepta un CTE con WITH', () => {
    const r = validarSql('WITH x AS (SELECT 1 AS n) SELECT n FROM x');
    expect(r.ok).toBe(true);
  });

  it('acepta joins y agregaciones', () => {
    const r = validarSql(
      'SELECT l.nombre, SUM(c.peso_kg) FROM cosechas c JOIN lotes l ON l.id = c.lote_id GROUP BY l.nombre'
    );
    expect(r.ok).toBe(true);
  });

  it('acepta las vistas seguras aunque nombren la entidad vedada', () => {
    expect(validarSql('SELECT nombre_completo FROM v_ia_personas').ok).toBe(true);
    expect(validarSql('SELECT nombre FROM v_ia_clientes').ok).toBe(true);
    expect(validarSql('SELECT nombre FROM v_ia_proveedores').ok).toBe(true);
  });

  it('no confunde columnas que contienen un verbo prohibido', () => {
    // `created_at` contiene "create"; `deleted_at` contiene "delete".
    const r = validarSql('SELECT created_at, deleted_at, updated_at FROM lotes');
    expect(r.ok).toBe(true);
  });
});

describe('validarSql — el LIMIT', () => {
  it('agrega un LIMIT cuando la consulta no lo trae', () => {
    expect(sqlDe(validarSql('SELECT nombre FROM lotes'))).toBe(
      `SELECT nombre FROM lotes LIMIT ${LIMITE_FILAS}`
    );
  });

  it('respeta el LIMIT que ya venía', () => {
    expect(sqlDe(validarSql('SELECT nombre FROM lotes LIMIT 5'))).toBe(
      'SELECT nombre FROM lotes LIMIT 5'
    );
  });

  it('quita el punto y coma final sin romper la consulta', () => {
    expect(sqlDe(validarSql('SELECT nombre FROM lotes;  '))).toBe(
      `SELECT nombre FROM lotes LIMIT ${LIMITE_FILAS}`
    );
  });
});

describe('validarSql — escritura y DDL', () => {
  const casos = [
    ['DELETE FROM cosechas', /delete/i],
    ['DROP TABLE lotes', /drop/i],
    ['UPDATE lotes SET nombre = %27x%27', /update/i],
    ['INSERT INTO lotes VALUES (1)', /insert/i],
    ['TRUNCATE cosechas', /truncate/i],
    ['GRANT ALL ON lotes TO public', /grant/i],
    ['ALTER TABLE lotes ADD COLUMN x int', /alter/i],
  ] as const;

  for (const [sql, esperado] of casos) {
    it(`rechaza ${sql.split(' ')[0]}`, () => {
      const r = validarSql(sql);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(esperado);
    });
  }

  it('rechaza una escritura escondida detrás de un SELECT válido', () => {
    const r = validarSql('SELECT 1; DROP TABLE lotes');
    expect(r.ok).toBe(false);
  });
});

describe('validarSql — evasiones', () => {
  it('rechaza sentencias encadenadas con punto y coma', () => {
    const r = validarSql('SELECT nombre FROM lotes; SELECT 1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/una sentencia/i);
  });

  it('rechaza comentarios de línea', () => {
    const r = validarSql('SELECT nombre FROM lotes -- y algo más');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/comentario/i);
  });

  it('rechaza comentarios de bloque', () => {
    expect(validarSql('SELECT /* oculto */ nombre FROM lotes').ok).toBe(false);
  });

  it('rechaza lo que no empieza con SELECT o WITH', () => {
    const r = validarSql('EXPLAIN SELECT nombre FROM lotes');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/SELECT o WITH/);
  });

  it('rechaza la consulta vacía', () => {
    expect(validarSql('   ').ok).toBe(false);
  });
});

describe('validarSql — objetos vedados', () => {
  it('rechaza el esquema auth aunque venga en un UNION', () => {
    const r = validarSql('SELECT nombre FROM lotes UNION SELECT email FROM auth.users');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/auth/i);
  });

  it('rechaza los catálogos internos de PostgreSQL', () => {
    expect(validarSql('SELECT * FROM pg_catalog.pg_tables').ok).toBe(false);
    expect(validarSql('SELECT pg_sleep(10)').ok).toBe(false);
  });

  it('rechaza information_schema', () => {
    expect(validarSql('SELECT table_name FROM information_schema.tables').ok).toBe(false);
  });

  it('rechaza las tablas crudas con datos personales y sugiere la vista', () => {
    const r = validarSql('SELECT cedula FROM personas');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/v_ia_personas/);
  });

  it('rechaza usuarios y push_subscriptions', () => {
    expect(validarSql('SELECT * FROM usuarios').ok).toBe(false);
    expect(validarSql('SELECT * FROM push_subscriptions').ok).toBe(false);
  });
});
