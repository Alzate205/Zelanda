import { describe, it, expect } from 'vitest';
import { validarDatosLote, confirmacionBorradoValida } from './lotes';

describe('validarDatosLote', () => {
  it('acepta lo mínimo: solo el nombre', () => {
    const r = validarDatosLote({ nombre: 'El Guayabo' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.nombre).toBe('El Guayabo');
      expect(r.datos.hectareas).toBeNull();
      expect(r.datos.total_arboles).toBe(0);
    }
  });

  it('recorta espacios y colapsa los de en medio', () => {
    const r = validarDatosLote({ nombre: '  La   Cabaña  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.nombre).toBe('La Cabaña');
  });

  it('rechaza el nombre vacío', () => {
    expect(validarDatosLote({ nombre: '   ' }).ok).toBe(false);
  });

  it('convierte hectáreas y total de árboles', () => {
    const r = validarDatosLote({ nombre: 'Pijao', hectareas: '3,5', total_arboles: '1800' });
    expect(r.ok).toBe(true);
    // Coma decimal: en la finca se escribe así.
    if (r.ok) expect(r.datos.hectareas).toBe(3.5);
    if (r.ok) expect(r.datos.total_arboles).toBe(1800);
  });

  it('rechaza números imposibles', () => {
    expect(validarDatosLote({ nombre: 'X', hectareas: '-1' }).ok).toBe(false);
    expect(validarDatosLote({ nombre: 'X', hectareas: 'abc' }).ok).toBe(false);
    expect(validarDatosLote({ nombre: 'X', total_arboles: '-5' }).ok).toBe(false);
    expect(validarDatosLote({ nombre: 'X', total_arboles: '1.5' }).ok).toBe(false);
  });

  it('pone techo al total de árboles para atajar un dedazo', () => {
    // Un lote de la finca llega a ~2.300. Un 0 de más no debe crear 300.000 filas.
    const r = validarDatosLote({ nombre: 'X', total_arboles: '500000' });
    expect(r.ok).toBe(false);
  });
});

describe('confirmacionBorradoValida', () => {
  it('acepta el nombre exacto', () => {
    expect(confirmacionBorradoValida('Pijao', 'Pijao')).toBe(true);
  });

  it('perdona mayúsculas, tildes y espacios sobrantes', () => {
    expect(confirmacionBorradoValida(' calarca ', 'Calarcá')).toBe(true);
    expect(confirmacionBorradoValida('LA CABAÑA', 'La Cabaña')).toBe(true);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(confirmacionBorradoValida('Pijao2', 'Pijao')).toBe(false);
    expect(confirmacionBorradoValida('', 'Pijao')).toBe(false);
    expect(confirmacionBorradoValida('borrar', 'Pijao')).toBe(false);
  });
});
