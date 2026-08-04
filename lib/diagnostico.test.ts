import { describe, it, expect } from 'vitest';
import { diagnosticar } from './diagnostico';
import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { ClimaFinca } from '@/lib/jefe/clima';

/** Mediodía UTC = 7am Bogotá. Abril está en cosecha principal; agosto no. */
const EN_COSECHA = new Date(Date.UTC(2026, 3, 15, 12));
const FUERA_DE_COSECHA = new Date(Date.UTC(2026, 7, 15, 12));

const haceDias = (n: number, desde: Date) =>
  new Date(desde.getTime() - n * 86_400_000).toISOString();

const snapshotLimpio = (): SnapshotJefe => ({
  vencidas: [],
  proximas: [],
  novedades_pendientes: [],
  recordatorios: [],
  contadores: {
    stock_bajo: 0,
    despachos_abiertos: 0,
    stock_almacen_kg: 0,
    total_lotes: 15,
    total_arboles: 30000,
    lotes_aldia: 15,
    lotes_proxima: 0,
    lotes_vencida: 0,
    tareas_activas: 0,
    tareas_cerradas_hoy: 0,
    cosecha_mes_kg: 0,
    cosecha_mes_anterior_kg: 0,
  },
  personas: [],
  ts: EN_COSECHA.toISOString(),
});

const climaLimpio = (): ClimaFinca => ({
  dias: [{ fecha: '2026-04-15', tmin: 14, tmax: 26, lluvia_mm: 0, prob_lluvia: 5, viento_max: 8 }],
  reglas: {
    ventana_fumigacion: false,
    motivo: 'Lluvia en las próximas horas',
    riesgo_helada: false,
  },
  hongos: { pudricion_raiz: false, antracnosis: false },
  lluvia_7dias_mm: 0,
  lluvia_72h_mm: 0,
  humedad_media_48h: 60,
  actualizado: EN_COSECHA.toISOString(),
});

const ids = (as: { id: string }[]) => as.map((a) => a.id);

describe('diagnosticar — sin datos que alerten', () => {
  it('con todo en orden no devuelve ninguna alerta', () => {
    expect(diagnosticar(snapshotLimpio(), climaLimpio(), EN_COSECHA)).toEqual([]);
  });

  it('sin clima disponible no falla y sólo evalúa lo operativo', () => {
    const s = snapshotLimpio();
    s.contadores.stock_bajo = 2;
    const alertas = diagnosticar(s, null, EN_COSECHA);
    expect(ids(alertas)).toEqual(['stock-bajo']);
  });
});

describe('diagnosticar — reglas de clima', () => {
  it('la pudrición de raíz cita los milímetros que la dispararon', () => {
    const c = climaLimpio();
    c.hongos.pudricion_raiz = true;
    c.lluvia_72h_mm = 58;
    const [alerta] = diagnosticar(snapshotLimpio(), c, EN_COSECHA);
    expect(alerta.id).toBe('pudricion-raiz');
    expect(alerta.severidad).toBe('CRITICO');
    expect(alerta.evidencia).toContain('58');
    expect(alerta.accion).toMatch(/drenaje/i);
  });

  it('la antracnosis cita la humedad y pide preventivo foliar', () => {
    const c = climaLimpio();
    c.hongos.antracnosis = true;
    c.humedad_media_48h = 91;
    const [alerta] = diagnosticar(snapshotLimpio(), c, EN_COSECHA);
    expect(alerta.id).toBe('antracnosis');
    expect(alerta.evidencia).toContain('91');
    expect(alerta.accion).toMatch(/foliar/i);
  });

  it('la helada usa la mínima real del pronóstico', () => {
    const c = climaLimpio();
    c.reglas.riesgo_helada = true;
    c.dias[0].tmin = 1.2;
    const [alerta] = diagnosticar(snapshotLimpio(), c, EN_COSECHA);
    expect(alerta.id).toBe('helada');
    expect(alerta.evidencia).toContain('1.2');
  });

  it('la ventana de fumigación es sólo un aviso', () => {
    const c = climaLimpio();
    c.reglas.ventana_fumigacion = true;
    c.reglas.motivo = 'Buena ventana para fumigar';
    const [alerta] = diagnosticar(snapshotLimpio(), c, EN_COSECHA);
    expect(alerta.id).toBe('ventana-fumigacion');
    expect(alerta.severidad).toBe('AVISO');
  });
});

describe('diagnosticar — reglas operativas', () => {
  it('una novedad de más de 7 días escala a crítica', () => {
    const s = snapshotLimpio();
    s.novedades_pendientes = [
      {
        id: '1',
        tipo: 'PLAGA',
        arbol_numero: 42,
        lote_nombre: 'Pijao',
        fecha: haceDias(12, EN_COSECHA),
      },
    ];
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.id).toBe('novedades-sin-resolver');
    expect(alerta.severidad).toBe('CRITICO');
    expect(alerta.evidencia).toContain('12 días');
    expect(alerta.evidencia).toContain('Pijao');
    expect(alerta.href).toBe('/jefe/novedades');
  });

  it('una novedad reciente todavía no alerta', () => {
    const s = snapshotLimpio();
    s.novedades_pendientes = [
      {
        id: '1',
        tipo: 'PLAGA',
        arbol_numero: 42,
        lote_nombre: 'Pijao',
        fecha: haceDias(3, EN_COSECHA),
      },
    ];
    expect(diagnosticar(s, climaLimpio(), EN_COSECHA)).toEqual([]);
  });

  it('las tareas vencidas muestran hasta tres ejemplos', () => {
    const s = snapshotLimpio();
    s.contadores.lotes_vencida = 4;
    s.vencidas = ['Pijao', 'Salento', 'Génova', 'Armenia'].map((lote, i) => ({
      lote_nombre: lote,
      lote_id: String(i),
      tipo_nombre: 'Plateo químico',
      tipo_id: '1',
      dias_para_proxima: -10,
      estado: 'vencida' as const,
    }));
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.titulo).toContain('4 lotes');
    expect(alerta.evidencia).toContain('Pijao');
    expect(alerta.evidencia).not.toContain('Armenia'); // sólo los primeros tres
    expect(alerta.href).toBe('/jefe/asignaciones/nueva');
  });

  it('un solo lote vencido usa singular', () => {
    const s = snapshotLimpio();
    s.contadores.lotes_vencida = 1;
    s.vencidas = [
      {
        lote_nombre: 'Pijao',
        lote_id: '1',
        tipo_nombre: 'Poda',
        tipo_id: '2',
        dias_para_proxima: -3,
        estado: 'vencida',
      },
    ];
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.titulo).toBe('1 lote con tareas vencidas');
  });

  it('cuenta los lotes del contador, no de la lista truncada a 10', () => {
    // `vencidas` sólo trae las 10 más urgentes: contarla subestima los lotes.
    const s = snapshotLimpio();
    s.contadores.lotes_vencida = 15;
    s.vencidas = Array.from({ length: 10 }, (_, i) => ({
      lote_nombre: 'Circasia',
      lote_id: '1',
      tipo_nombre: `Tarea ${i}`,
      tipo_id: String(i),
      dias_para_proxima: -20,
      estado: 'vencida' as const,
    }));
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.titulo).toBe('15 lotes con tareas vencidas');
  });

  it('la carencia sólo alerta si estamos en temporada de cosecha', () => {
    const s = snapshotLimpio();
    s.carencias_por_lote = [{ lote_id: '1', insumo: 'Lorsban', hasta: '2026-04-20' }];

    const enCosecha = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(ids(enCosecha)).toContain('carencia-en-cosecha');

    const fueraDeCosecha = diagnosticar(s, climaLimpio(), FUERA_DE_COSECHA);
    expect(ids(fueraDeCosecha)).not.toContain('carencia-en-cosecha');
  });

  it('el stock bajo apunta a crear la compra', () => {
    const s = snapshotLimpio();
    s.contadores.stock_bajo = 3;
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.titulo).toBe('3 insumos bajo el mínimo');
    expect(alerta.href).toBe('/jefe/compras/nueva');
  });

  it('los despachos abiertos son un aviso al cierre del día', () => {
    const s = snapshotLimpio();
    s.contadores.despachos_abiertos = 1;
    const [alerta] = diagnosticar(s, climaLimpio(), EN_COSECHA);
    expect(alerta.id).toBe('despachos-abiertos');
    expect(alerta.titulo).toBe('1 despacho sin cerrar');
    expect(alerta.severidad).toBe('AVISO');
  });
});

describe('diagnosticar — priorización', () => {
  it('ordena crítico antes que alerta y alerta antes que aviso', () => {
    const s = snapshotLimpio();
    s.contadores.despachos_abiertos = 1; // AVISO
    s.contadores.stock_bajo = 1; // ALERTA
    s.novedades_pendientes = [
      {
        id: '1',
        tipo: 'PLAGA',
        arbol_numero: 7,
        lote_nombre: 'Salento',
        fecha: haceDias(30, EN_COSECHA),
      },
    ]; // CRITICO

    const c = climaLimpio();
    c.hongos.pudricion_raiz = true; // CRITICO

    const alertas = diagnosticar(s, c, EN_COSECHA);
    expect(alertas.map((a) => a.severidad)).toEqual(['CRITICO', 'CRITICO', 'ALERTA', 'AVISO']);
  });

  it('toda alerta trae evidencia y acción, nunca una conclusión suelta', () => {
    const s = snapshotLimpio();
    s.contadores.stock_bajo = 1;
    s.contadores.despachos_abiertos = 1;
    s.contadores.lotes_vencida = 1;
    s.vencidas = [
      {
        lote_nombre: 'Pijao',
        lote_id: '1',
        tipo_nombre: 'Riego',
        tipo_id: '3',
        dias_para_proxima: -1,
        estado: 'vencida',
      },
    ];
    for (const alerta of diagnosticar(s, climaLimpio(), EN_COSECHA)) {
      expect(alerta.evidencia.length).toBeGreaterThan(0);
      expect(alerta.accion.length).toBeGreaterThan(0);
    }
  });
});
