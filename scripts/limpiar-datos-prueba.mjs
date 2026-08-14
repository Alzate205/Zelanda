/**
 * Borra los datos de prueba para dejar la base lista para el uso real de la finca.
 *
 * QUÉ BORRA (todo lo transaccional):
 *   avances, asignaciones, despachos y sus items, movimientos de insumo,
 *   novedades, cosechas (fruta y miel), salidas, compras y sus items,
 *   pagos, jornales, ausencias, servicios contratados, recordatorios,
 *   y los árboles (dejando `lotes.total_arboles` en 0).
 *
 * QUÉ CONSERVA:
 *   lotes, apiarios, instalaciones, tipos de tarea, frecuencias por lote,
 *   personas, vinculaciones y usuarios (¡tu cuenta de jefe!),
 *   herramientas, insumos, clientes, proveedores y tarifas.
 *
 * Con --incluir-catalogos borra además herramientas, insumos, clientes,
 * proveedores y tarifas, que en el prototipo también son de prueba.
 *
 * Las personas y los usuarios NO se tocan nunca: borrar un usuario te deja
 * fuera de tu propia app. Se listan al final para que decidas a mano en
 * /jefe/equipo.
 *
 * Uso:
 *   npm run limpiar:prueba              → SIMULACIÓN (cuenta y muestra, no toca nada)
 *   npm run limpiar:prueba:aplicar      → borra de verdad
 *
 * La simulación es el modo por defecto a propósito, igual que en importar-kml.mjs.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const aplicar = process.argv.includes('--aplicar');
const incluirCatalogos = process.argv.includes('--incluir-catalogos');

/** Qué se borra. El ORDEN no importa acá: se calcula solo desde las FK reales. */
const TRANSACCIONAL = [
  'registros_avance',
  'cosechas_miel',
  'movimientos_insumo',
  'despacho_items',
  'despachos',
  'asignaciones',
  'novedades',
  'cosechas',
  'salidas_cosecha',
  'compras_items',
  'compras',
  'pagos',
  'jornales',
  'ausencias',
  'servicios_contratados',
  'recordatorios',
  'arboles',
];

const CATALOGOS = ['herramientas', 'insumos', 'clientes', 'proveedores', 'tarifas_tarea'];

/**
 * Ordena las tablas para borrar: una tabla solo se puede borrar cuando ya no
 * queda ninguna otra, de las pendientes, que le apunte con una FK.
 *
 * Se calcula desde `information_schema` en vez de escribirse a mano: el orden
 * a ojo se equivoca en cuanto alguien agrega una columna nueva, y el error
 * solo aparece al ejecutar el borrado de verdad.
 */
async function ordenarPorDependencias(tablas) {
  const aristas = await prisma.$queryRaw`
    SELECT tc.table_name::text AS hijo, ccu.table_name::text AS padre
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `;

  const pendientes = new Set(tablas);
  const orden = [];
  while (pendientes.size > 0) {
    // Una tabla está lista si nada pendiente (salvo ella misma) la referencia.
    const lista = [...pendientes].find(
      (t) => !aristas.some((a) => a.padre === t && a.hijo !== t && pendientes.has(a.hijo))
    );
    if (!lista) {
      throw new Error(
        `Ciclo de FK entre: ${[...pendientes].join(', ')}. Hay que resolverlo a mano.`
      );
    }
    orden.push(lista);
    pendientes.delete(lista);
  }
  return orden;
}

async function contar(tablas) {
  const filas = [];
  for (const t of tablas) {
    filas.push({ tabla: t, n: await prisma[t].count() });
  }
  return filas;
}

async function main() {
  const objetivo = incluirCatalogos ? [...TRANSACCIONAL, ...CATALOGOS] : TRANSACCIONAL;

  console.log(aplicar ? '=== BORRANDO DE VERDAD ===\n' : '=== SIMULACIÓN (no se toca nada) ===\n');

  const antes = await contar(objetivo);
  const total = antes.reduce((acc, f) => acc + f.n, 0);
  for (const f of antes) {
    if (f.n > 0) console.log(`  ${f.tabla.padEnd(24)} ${f.n}`);
  }
  if (total === 0) {
    console.log('  (no hay nada que borrar)');
  } else {
    console.log(`\n  TOTAL A BORRAR: ${total} registros`);
  }

  if (!incluirCatalogos) {
    const cat = await contar(CATALOGOS);
    const totalCat = cat.reduce((acc, f) => acc + f.n, 0);
    if (totalCat > 0) {
      console.log(
        `\n  Se conservan ${totalCat} registros de catálogo (herramientas, insumos, clientes,` +
          ' proveedores, tarifas).\n  Corre con --incluir-catalogos si también son de prueba.'
      );
    }
  }

  if (!aplicar) {
    const orden = await ordenarPorDependencias(objetivo);
    console.log(`\n  Orden de borrado calculado desde las FK:\n    ${orden.join(' → ')}`);
    console.log('\nNada se tocó. Para borrar de verdad: npm run limpiar:prueba:aplicar');
  } else if (total > 0) {
    const orden = await ordenarPorDependencias(objetivo);
    // Todo en una transacción: si una FK se queja a mitad de camino, no queda
    // la base medio borrada. O se va todo, o no se va nada.
    const resultados = await prisma.$transaction([
      ...orden.map((tabla) => prisma[tabla].deleteMany({})),
      // Los árboles se recrean desde "total de árboles" al editar el lote: si
      // queda un número viejo ahí, la app muestra un total que no existe.
      prisma.lotes.updateMany({ where: { total_arboles: { not: 0 } }, data: { total_arboles: 0 } }),
    ]);
    orden.forEach((tabla, i) => {
      if (resultados[i].count > 0) {
        console.log(`  borrados ${String(resultados[i].count).padStart(6)} de ${tabla}`);
      }
    });
    console.log(`  reseteado total_arboles en ${resultados[orden.length].count} lotes`);
    console.log('\nListo.');
  }

  const personas = await prisma.personas.findMany({
    select: { nombre_completo: true, activo: true },
    orderBy: { nombre_completo: 'asc' },
  });
  const usuarios = await prisma.usuarios.count();
  console.log(
    `\nSIN TOCAR — ${personas.length} personas y ${usuarios} usuarios:` +
      `\n  ${personas.map((p) => p.nombre_completo).join(', ') || '(ninguna)'}` +
      '\n  Bórralas a mano desde /jefe/equipo si son de prueba.' +
      '\n  Ojo: no borres el usuario con el que entras a la app.'
  );
}

main()
  .catch((e) => {
    console.error('\nFALLÓ:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
