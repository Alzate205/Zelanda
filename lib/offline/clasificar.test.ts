import { describe, it, expect } from 'vitest';
import { clasificarRespuesta } from './clasificar';

describe('clasificarRespuesta', () => {
  it('acepta cualquier 2xx', () => {
    expect(clasificarRespuesta(200)).toBe('ok');
    expect(clasificarRespuesta(201)).toBe('ok');
    expect(clasificarRespuesta(204)).toBe('ok');
  });

  it('descarta los errores de datos: el reintento nunca los va a arreglar', () => {
    expect(clasificarRespuesta(400)).toBe('permanente');
    expect(clasificarRespuesta(401)).toBe('permanente');
    expect(clasificarRespuesta(403)).toBe('permanente');
    expect(clasificarRespuesta(404)).toBe('permanente');
    expect(clasificarRespuesta(409)).toBe('permanente');
  });

  it('reintenta cuando el servidor falla', () => {
    expect(clasificarRespuesta(500)).toBe('reintentar');
    expect(clasificarRespuesta(502)).toBe('reintentar');
    expect(clasificarRespuesta(503)).toBe('reintentar');
    expect(clasificarRespuesta(504)).toBe('reintentar');
  });

  it('reintenta el timeout y el rate limit, aunque sean 4xx', () => {
    expect(clasificarRespuesta(408)).toBe('reintentar');
    expect(clasificarRespuesta(429)).toBe('reintentar');
  });

  it('ante un código raro prefiere reintentar antes que dar por bueno', () => {
    // Nada fuera de 2xx confirma que se guardó, y descartar el registro
    // perdería el trabajo del día.
    expect(clasificarRespuesta(302)).toBe('reintentar');
    expect(clasificarRespuesta(0)).toBe('reintentar');
  });
});
