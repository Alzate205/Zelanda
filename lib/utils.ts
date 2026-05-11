type ClassValue = string | number | null | false | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const stack: ClassValue[] = [...inputs];
  while (stack.length) {
    const v = stack.shift();
    if (!v) continue;
    if (Array.isArray(v)) {
      stack.unshift(...v);
    } else if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    }
  }
  return out.join(" ");
}

export function formatearFechaCorta(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function diasHastaHoy(fecha: Date | string): number {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
