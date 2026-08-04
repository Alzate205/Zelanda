import { describe, it, expect } from 'vitest';
import {
  faseDelMes,
  esTemporadaDeCosecha,
  FASES_POR_MES,
  MESES_DE_COSECHA,
  DETALLE_FASE,
} from './fenologia';

/** Mediodía UTC = 7am en Bogotá, así el día no se corre al mes anterior. */
const enMes = (mes1a12: number) => new Date(Date.UTC(2026, mes1a12 - 1, 15, 12, 0, 0));

describe('FASES_POR_MES', () => {
  it('cubre los 12 meses', () => {
    expect(FASES_POR_MES).toHaveLength(12);
  });

  it('cada fase declarada tiene detalle con recomendaciones', () => {
    for (const mes of FASES_POR_MES) {
      expect(DETALLE_FASE[mes.principal].recomendaciones.length).toBeGreaterThan(0);
      if (mes.secundaria) {
        expect(DETALLE_FASE[mes.secundaria].recomendaciones.length).toBeGreaterThan(0);
      }
    }
  });

  it('la fase secundaria nunca repite la principal', () => {
    for (const mes of FASES_POR_MES) {
      if (mes.secundaria) expect(mes.secundaria).not.toBe(mes.principal);
    }
  });
});

describe('faseDelMes', () => {
  it('marzo a junio es cosecha principal', () => {
    for (const mes of [3, 4, 5, 6]) {
      expect(faseDelMes(enMes(mes)).principal.fase).toBe('COSECHA');
    }
  });

  it('octubre a diciembre es cosecha traviesa', () => {
    for (const mes of [10, 11, 12]) {
      expect(faseDelMes(enMes(mes)).principal.fase).toBe('COSECHA');
    }
  });

  it('enero y febrero son floración', () => {
    expect(faseDelMes(enMes(1)).principal.fase).toBe('FLORACION');
    expect(faseDelMes(enMes(2)).principal.fase).toBe('FLORACION');
  });

  it('julio es post-cosecha, después del pico principal', () => {
    expect(faseDelMes(enMes(7)).principal.fase).toBe('POSTCOSECHA');
  });

  it('septiembre madura el fruto de la traviesa', () => {
    expect(faseDelMes(enMes(9)).principal.fase).toBe('MADURACION');
  });

  it('agosto y septiembre no tienen fase secundaria', () => {
    expect(faseDelMes(enMes(8)).secundaria).toBeNull();
    expect(faseDelMes(enMes(9)).secundaria).toBeNull();
  });

  it('marzo cosecha la principal mientras cuaja la traviesa', () => {
    const marzo = faseDelMes(enMes(3));
    expect(marzo.principal.fase).toBe('COSECHA');
    expect(marzo.secundaria?.fase).toBe('CUAJADO');
  });

  it('en floración recuerda cuidar las abejas', () => {
    const recomendaciones = faseDelMes(enMes(1)).principal.recomendaciones.join(' ');
    expect(recomendaciones).toMatch(/abeja/i);
  });

  it('en cosecha recuerda revisar la carencia', () => {
    const recomendaciones = faseDelMes(enMes(4)).principal.recomendaciones.join(' ');
    expect(recomendaciones).toMatch(/carencia/i);
  });
});

describe('esTemporadaDeCosecha', () => {
  it('es verdadero en los 7 meses de los dos picos', () => {
    expect(MESES_DE_COSECHA).toHaveLength(7);
    for (const mes of [3, 4, 5, 6, 10, 11, 12]) {
      expect(esTemporadaDeCosecha(enMes(mes))).toBe(true);
    }
  });

  it('es falso fuera de temporada', () => {
    for (const mes of [1, 2, 7, 8, 9]) {
      expect(esTemporadaDeCosecha(enMes(mes))).toBe(false);
    }
  });
});
