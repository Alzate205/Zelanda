// Crea unas pocas tarifas para que la pantalla no arranque vacía.
//
// Los montos son PROVISIONALES y los puso el programador, no la finca: en la
// base no había ninguna tarifa ni ningún jornal de referencia de dónde sacarlos.
// El único número con algún respaldo es el jornal de 50.000, que es el que usa
// el seed de pruebas del propio proyecto. Van con una nota que lo dice, para que
// nadie los tome por buenos sin mirarlos.
//
// Se crean sólo esquemas POR_JORNAL a propósito: un precio por kilo o por árbol
// depende de acuerdos que no están en ningún lado del repositorio, y poner un
// número inventado ahí sería peor que dejarlo vacío.
//
//   npm run tarifas:iniciales           → muestra qué crearía
//   npm run tarifas:iniciales -- --crear → las crea

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const crear = process.argv.includes('--crear');

const NOTA = 'Monto provisional puesto para arrancar. Revisalo antes de pagar con él.';
const MONTO_JORNAL = 50000;

/** Tareas de campo que se pagan por día trabajado. */
const TAREAS = ['Plateo químico', 'Poda', 'Fertilización'];

const jefe = await prisma.usuarios.findFirst({
  where: { rol: 'JEFE', activo: true },
  select: { id: true, nombre_completo: true },
  orderBy: { created_at: 'asc' },
});
if (!jefe) {
  console.error('✗ No hay ningún usuario JEFE activo a quien atribuir las tarifas.');
  process.exit(1);
}

const yaHay = await prisma.tarifas_tarea.count({ where: { borrado_en: null } });
if (yaHay > 0) {
  console.log(`Ya hay ${yaHay} tarifa(s) cargada(s). No se toca nada.`);
  await prisma.$disconnect();
  process.exit(0);
}

const tipos = await prisma.tipos_tarea.findMany({
  where: { nombre: { in: TAREAS }, activo: true },
  select: { id: true, nombre: true },
});

if (tipos.length === 0) {
  console.error('✗ No se encontró ninguno de los tipos de tarea esperados.');
  process.exit(1);
}

console.log(`\nSe atribuyen a: ${jefe.nombre_completo}\n`);
console.log('Tarifas a crear:');
for (const t of tipos) {
  console.log(`  · ${t.nombre} — por jornal — $ ${MONTO_JORNAL.toLocaleString('es-CO')}`);
}
const faltan = TAREAS.filter((n) => !tipos.some((t) => t.nombre === n));
if (faltan.length) console.log(`  (no se encontraron: ${faltan.join(', ')})`);

if (!crear) {
  console.log('\nPara crearlas: npm run tarifas:iniciales -- --crear\n');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.tarifas_tarea.createMany({
  data: tipos.map((t) => ({
    tipo_tarea_id: t.id,
    esquema_pago: 'POR_JORNAL',
    monto: MONTO_JORNAL,
    unidad: 'jornal',
    notas: NOTA,
    registrado_por_usuario_id: jefe.id,
  })),
});

console.log(`\n✓ ${tipos.length} tarifas creadas, todas marcadas como provisionales.`);
console.log('  Se editan o borran desde Jefe → Tarifas.\n');

await prisma.$disconnect();
