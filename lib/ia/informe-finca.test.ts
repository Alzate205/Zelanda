import { describe, it, expect } from 'vitest';
import {
  redactarInforme,
  partesInforme,
  unirInforme,
  CLAVES_SECCION,
  type DatosInforme,
} from './informe-finca';

/** Datos mínimos: todo vacío. Sirve para probar que ninguna sección revienta. */
function datosVacios(): DatosInforme {
  return {
    fecha_corte: '2026-08-14',
    alertas: [],
    contadores: {
      total_lotes: 15,
      total_arboles: 30000,
      hectareas: 42.5,
      lotes_aldia: 15,
      lotes_proxima: 0,
      lotes_vencida: 0,
      tareas_activas: 0,
      tareas_cerradas_hoy: 0,
      cosecha_mes_kg: 0,
      cosecha_mes_anterior_kg: 0,
      stock_almacen_kg: 0,
      stock_bajo: 0,
      despachos_abiertos: 0,
    },
    vencidas: [],
    proximas: [],
    novedades_pendientes: [],
    carencias: [],
    lotes: [],
    cosecha_por_anio: [],
    clima: null,
    fenologia: null,
    inventario_bajo: [],
    finanzas: {
      meses: [],
      ventas_por_cliente: [],
      compras_por_proveedor: [],
      nomina: { devengado: 0, pagado: 0, personas: [] },
    },
  };
}

function datosCompletos(): DatosInforme {
  return {
    ...datosVacios(),
    alertas: [
      {
        id: 'plateo-vencido',
        severidad: 'CRITICO',
        titulo: 'Plateo vencido en Pijao',
        evidencia: 'Vencida hace 22 días.',
        accion: 'Asignar plateo esta semana.',
      },
      {
        id: 'stock-bajo',
        severidad: 'AVISO',
        titulo: 'Stock bajo de fungicida',
        evidencia: 'Quedan 3 L.',
        accion: 'Comprar antes del próximo ciclo.',
      },
    ],
    contadores: {
      ...datosVacios().contadores,
      lotes_vencida: 2,
      tareas_activas: 7,
      cosecha_mes_kg: 12500,
      cosecha_mes_anterior_kg: 9800,
      stock_almacen_kg: 1430,
      stock_bajo: 1,
      despachos_abiertos: 2,
    },
    vencidas: [
      {
        lote_id: '3',
        lote_nombre: 'Pijao',
        tipo_id: '1',
        tipo_nombre: 'Plateo químico',
        dias_para_proxima: -22,
        estado: 'vencida',
      },
    ],
    proximas: [
      {
        lote_id: '5',
        lote_nombre: 'Salento',
        tipo_id: '2',
        tipo_nombre: 'Fertilización',
        dias_para_proxima: 4,
        estado: 'proxima',
      },
    ],
    novedades_pendientes: [
      { id: '9', tipo: 'PLAGA', arbol_numero: 412, lote_nombre: 'Circasia', fecha: '2026-08-01' },
    ],
    carencias: [{ lote_id: '3', insumo: 'Mancozeb', hasta: '2026-08-20' }],
    lotes: [
      {
        nombre: 'Pijao',
        hectareas: 3.2,
        total_arboles: 1800,
        cosecha_anio_kg: 21000,
        prediccion_kg: 24000,
      },
      {
        nombre: 'Salento',
        hectareas: 2.0,
        total_arboles: 1500,
        cosecha_anio_kg: 9000,
        prediccion_kg: null,
      },
    ],
    cosecha_por_anio: [
      { anio: 2025, kg: 48000 },
      { anio: 2026, kg: 30000 },
    ],
    fenologia: {
      principal: 'Cosecha',
      secundaria: 'Postcosecha',
      recomendaciones: ['Revisar madurez antes de recolectar.'],
    },
    inventario_bajo: [{ nombre: 'Fungicida X', disponible: 3, minimo: 10, unidad: 'L' }],
    finanzas: {
      meses: [
        { mes: '2026-07', ingresos: 8000000, costos: 5000000 },
        { mes: '2026-08', ingresos: 4000000, costos: 4500000 },
      ],
      ventas_por_cliente: [{ cliente: 'Frutas del Eje', kg: 5200, ingresos: 15600000 }],
      compras_por_proveedor: [{ proveedor: 'Agroinsumos QY', total: 3200000 }],
      nomina: {
        devengado: 6000000,
        pagado: 4500000,
        personas: [
          { nombre: 'Juan Pérez Gómez', devengado: 2000000, pagado: 1500000 },
          { nombre: 'María Restrepo', devengado: 4000000, pagado: 3000000 },
        ],
      },
    },
    clima: {
      lluvia_7dias_mm: 45,
      dias: [
        { fecha: '2026-08-14', tmin: 16, tmax: 27, lluvia_mm: 12, prob_lluvia: 80 },
        { fecha: '2026-08-15', tmin: 15, tmax: 28, lluvia_mm: 0, prob_lluvia: 10 },
      ],
      notas: ['Ventana de fumigación el 15 de agosto.'],
    },
  };
}

describe('redactarInforme', () => {
  it('encabeza con la fecha de corte y advierte que es una foto', () => {
    const texto = redactarInforme(datosVacios());
    expect(texto).toContain('2026-08-14');
    // El dueño puede copiar el lunes y preguntar el jueves: la advertencia importa.
    expect(texto.toLowerCase()).toContain('foto');
  });

  it('da contexto de la finca para que el modelo no lo pregunte', () => {
    const texto = redactarInforme(datosVacios());
    expect(texto).toContain('Hass');
    expect(texto).toContain('Quindío');
  });

  it('incluye todas las secciones cuando hay datos', () => {
    const texto = redactarInforme(datosCompletos());
    for (const seccion of [
      'Alertas',
      'Tareas',
      'Producción',
      'Sanidad',
      'Clima',
      'Fenología',
      'Inventario',
      'Finanzas',
    ]) {
      expect(texto).toContain(seccion);
    }
  });

  it('nunca deja salir el nombre de una persona: las anonimiza', () => {
    const texto = redactarInforme(datosCompletos());
    expect(texto).not.toContain('Juan Pérez Gómez');
    expect(texto).not.toContain('María Restrepo');
    expect(texto).toContain('Trabajador 1');
    expect(texto).toContain('Trabajador 2');
  });

  it('conserva los nombres de lotes, clientes y proveedores', () => {
    const texto = redactarInforme(datosCompletos());
    expect(texto).toContain('Pijao');
    expect(texto).toContain('Frutas del Eje');
    expect(texto).toContain('Agroinsumos QY');
  });

  it('calcula el margen a partir de ingresos y costos', () => {
    const texto = redactarInforme(datosCompletos());
    // Julio: 8.000.000 - 5.000.000 = 3.000.000
    expect(texto).toContain('3.000.000');
    // Agosto cierra en rojo: -500.000
    expect(texto).toContain('-500.000');
  });

  it('deriva kg por hectárea y por árbol de cada lote', () => {
    const texto = redactarInforme(datosCompletos());
    // Pijao: 21.000 kg / 3,2 ha = 6.563 kg/ha
    expect(texto).toContain('6.563');
    // Pijao: 21.000 kg / 1.800 árboles = 11,7 kg/árbol
    expect(texto).toContain('11,7');
  });

  it('marca las secciones vacías en vez de omitirlas en silencio', () => {
    const texto = redactarInforme(datosVacios());
    // Que una sección esté vacía es información: significa "no hay problemas ahí".
    expect(texto.toLowerCase()).toContain('sin alertas');
    expect(texto).toContain('Clima');
  });

  it('cierra con preguntas sugeridas para arrancar la conversación', () => {
    const texto = redactarInforme(datosCompletos());
    expect(texto).toContain('¿');
  });

  it('no incluye cédulas ni teléfonos en ningún caso', () => {
    const texto = redactarInforme(datosCompletos());
    expect(texto.toLowerCase()).not.toContain('cédula');
    expect(texto.toLowerCase()).not.toContain('teléfono');
  });
});

describe('secciones elegibles', () => {
  it('rearmar con todas da exactamente el mismo texto que el informe completo', () => {
    const d = datosCompletos();
    expect(unirInforme(partesInforme(d), CLAVES_SECCION)).toBe(redactarInforme(d));
  });

  it('deja fuera lo que no se eligió y conserva lo demás', () => {
    const texto = redactarInforme(datosCompletos(), ['clima', 'fenologia']);
    expect(texto).toContain('Clima');
    expect(texto).toContain('Fenología');
    expect(texto).not.toContain('## Finanzas');
    expect(texto).not.toContain('## Inventario');
  });

  it('el contexto y el cierre van siempre, aunque no se elija ninguna sección', () => {
    // Sin ellos el modelo no sabe qué finca es ni qué se espera de él.
    const texto = redactarInforme(datosCompletos(), []);
    expect(texto).toContain('Hacienda La Zelanda');
    expect(texto).toContain('aguacate Hass');
    expect(texto.length).toBeGreaterThan(200);
  });
});
