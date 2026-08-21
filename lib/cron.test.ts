import { describe, it, expect, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { motivoRechazoCron } from './cron';

const pedido = (auth: string | null) =>
  ({ headers: { get: (k: string) => (k === 'authorization' ? auth : null) } } as NextRequest);

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe('motivoRechazoCron', () => {
  it('deja pasar al cron con el token correcto', () => {
    process.env.CRON_SECRET = 'secreto-de-verdad';
    expect(motivoRechazoCron(pedido('Bearer secreto-de-verdad'))).toBeNull();
  });

  it('rechaza un token que no es', () => {
    process.env.CRON_SECRET = 'secreto-de-verdad';
    expect(motivoRechazoCron(pedido('Bearer otra-cosa'))).toBe('token-invalido');
  });

  it('rechaza cuando no viene ningún token', () => {
    process.env.CRON_SECRET = 'secreto-de-verdad';
    expect(motivoRechazoCron(pedido(null))).toBe('token-invalido');
  });

  it('sin CRON_SECRET rechaza a todos, incluido "Bearer undefined"', () => {
    // Éste es el motivo de que exista este módulo. La versión anterior comparaba
    // contra `Bearer ${process.env.CRON_SECRET}`: sin la variable eso queda
    // comparando contra el texto "Bearer undefined", y ese header exacto
    // entraba. La guarda fallaba abierta justo en el entorno mal configurado.
    delete process.env.CRON_SECRET;
    expect(motivoRechazoCron(pedido('Bearer undefined'))).toBe('sin-secreto');
    expect(motivoRechazoCron(pedido(null))).toBe('sin-secreto');
    expect(motivoRechazoCron(pedido('Bearer '))).toBe('sin-secreto');
  });

  it('con CRON_SECRET vacía tampoco pasa nadie', () => {
    process.env.CRON_SECRET = '';
    expect(motivoRechazoCron(pedido('Bearer '))).toBe('sin-secreto');
  });
});
