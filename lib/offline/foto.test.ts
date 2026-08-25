import { describe, it, expect, vi, beforeEach } from 'vitest';

// `resolverFotoDeItem` habla con IndexedDB y con la red. Acá interesa sólo la
// decisión que toma según lo que responde el servidor, así que las dos puertas
// se reemplazan por dobles.
const item: { foto_path: string | null; foto_blob: Blob | null; foto_nombre: string | null } = {
  foto_path: null,
  foto_blob: null,
  foto_nombre: 'plaga.jpg',
};
const parches: Array<Record<string, unknown>> = [];

vi.mock('./db', () => ({
  abrirDb: async () => ({ get: async () => item }),
}));
vi.mock('./cola', () => ({
  parchearItem: async (_t: string, _id: string, parche: Record<string, unknown>) => {
    parches.push(parche);
  },
}));

const { resolverFotoDeItem } = await import('./foto');

function respuesta(status: number, cuerpo: unknown = {}) {
  return {
    status,
    json: async () => cuerpo,
  } as unknown as Response;
}

beforeEach(() => {
  parches.length = 0;
  item.foto_path = null;
  item.foto_blob = new Blob(['x']);
  item.foto_nombre = 'plaga.jpg';
});

describe('resolverFotoDeItem', () => {
  it('cuando la foto sube, devuelve el path y suelta el blob', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(200, { path: 'novedades/abc.jpg' }))
    );
    const r = await resolverFotoDeItem('novedad', 'id-1');
    expect(r).toEqual({ ok: true, foto_path: 'novedades/abc.jpg', fotoPerdida: false });
    expect(parches[0]).toMatchObject({ foto_path: 'novedades/abc.jpg', foto_blob: null });
  });

  it('si el fallo es del momento, no da la foto por perdida: se reintenta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(503))
    );
    const r = await resolverFotoDeItem('novedad', 'id-1');
    expect(r.ok).toBe(false);
    // El blob sigue guardado: la foto no se pierde.
    expect(parches).toHaveLength(0);
  });

  it('si el servidor rechaza la foto, avisa que se perdió y deja subir el registro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(413, { error: 'La foto pesa demasiado' }))
    );
    const r = await resolverFotoDeItem('novedad', 'id-1');
    // Éste es el punto: el registro sube igual, pero queda constancia de que la
    // foto no está. Sin `fotoPerdida`, arriba se anunciaba "registro subido" a
    // secas y el trabajador creía que había mandado la evidencia.
    expect(r).toEqual({ ok: true, foto_path: null, fotoPerdida: true });
    expect(parches[0]).toMatchObject({ foto_blob: null });
  });

  it('un registro que nunca tuvo foto no cuenta como foto perdida', async () => {
    item.foto_blob = null;
    const r = await resolverFotoDeItem('novedad', 'id-1');
    expect(r).toEqual({ ok: true, foto_path: null, fotoPerdida: false });
  });
});
