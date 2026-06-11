import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetClaims, mockSingle } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockSingle: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock('./supabase/server', () => ({
  crearClienteSupabaseServidor: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mockSingle })),
      })),
    })),
  })),
}));

import { obtenerUsuarioActual } from './auth';

describe('obtenerUsuarioActual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve null si no hay sesión (claims vacíos)', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });
    expect(await obtenerUsuarioActual()).toBeNull();
  });

  it('devuelve null si getClaims da error', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: 'token inválido' },
    });
    expect(await obtenerUsuarioActual()).toBeNull();
  });

  it('devuelve el usuario cuando hay claims y fila en usuarios', async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: 'uuid-1' } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'uuid-1',
        email: 'jefe@zelanda.co',
        nombre_completo: 'Samuel Alzate',
        rol: 'JEFE',
        persona_id: 1,
        activo: true,
      },
      error: null,
    });
    const usuario = await obtenerUsuarioActual();
    expect(usuario?.rol).toBe('JEFE');
    expect(usuario?.id).toBe('uuid-1');
  });

  it('devuelve null si no hay fila en usuarios', async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: 'uuid-2' } },
      error: null,
    });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    expect(await obtenerUsuarioActual()).toBeNull();
  });
});
