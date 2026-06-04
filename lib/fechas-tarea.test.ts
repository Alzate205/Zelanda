import { describe, it, expect } from 'vitest';
import { calcularResumen } from './fechas-tarea';

const DIA = 24 * 60 * 60 * 1000;
const HOY = new Date(Date.UTC(2026, 5, 15));

function haceDias(n: number): Date {
  return new Date(HOY.getTime() - n * DIA);
}

describe('calcularResumen — estado de alertas de tareas', () => {
  it('sin historial cuando nunca se completó', () => {
    const r = calcularResumen(null, 30, HOY);
    expect(r.estado).toBe('sin_historial');
    expect(r.proxima).toBeNull();
    expect(r.dias_para_proxima).toBeNull();
  });

  it('al día cuando falta más que el umbral de alerta', () => {
    // completada hace 10 días, frecuencia 30 → próxima en 20 días (> 7)
    const r = calcularResumen(haceDias(10), 30, HOY);
    expect(r.estado).toBe('aldia');
    expect(r.dias_para_proxima).toBe(20);
  });

  it('próxima cuando faltan 7 días o menos (umbral default)', () => {
    // completada hace 25 días, frecuencia 30 → próxima en 5 días
    const r = calcularResumen(haceDias(25), 30, HOY);
    expect(r.estado).toBe('proxima');
    expect(r.dias_para_proxima).toBe(5);
  });

  it('vencida cuando la próxima fecha ya pasó', () => {
    // completada hace 40 días, frecuencia 30 → venció hace 10 días
    const r = calcularResumen(haceDias(40), 30, HOY);
    expect(r.estado).toBe('vencida');
    expect(r.dias_para_proxima).toBeLessThanOrEqual(0);
  });

  it('respeta un umbral de alerta configurable', () => {
    // próxima en 12 días: con umbral 7 está "al día", con umbral 14 está "próxima"
    const completada = haceDias(18); // 30 − 18 = 12 días para la próxima
    expect(calcularResumen(completada, 30, HOY, 7).estado).toBe('aldia');
    expect(calcularResumen(completada, 30, HOY, 14).estado).toBe('proxima');
  });

  it('el día exacto del umbral cuenta como próxima (≤)', () => {
    const completada = haceDias(23); // próxima en 7 días
    expect(calcularResumen(completada, 30, HOY, 7).estado).toBe('proxima');
  });
});
