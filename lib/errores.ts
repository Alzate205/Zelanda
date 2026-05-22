export function sanitizarError(e: unknown, contexto: string): string {
  const msg = (e as Error)?.message ?? "desconocido";
  console.error(`[${contexto}]`, msg);
  return "Ocurrió un error inesperado. Intentá de nuevo.";
}
