import "server-only";

export type EstadoAlerta = "aldia" | "proxima" | "vencida" | "sin_historial";

export type ResumenTarea = {
  ultima: Date | null;
  proxima: Date | null;
  estado: EstadoAlerta;
  dias_para_proxima: number | null;
};

const MS_DIA = 24 * 60 * 60 * 1000;

export function calcularResumen(
  ultimaCompletada: Date | null,
  frecuenciaDias: number,
  ahora: Date = new Date(),
): ResumenTarea {
  if (!ultimaCompletada) {
    return {
      ultima: null,
      proxima: null,
      estado: "sin_historial",
      dias_para_proxima: null,
    };
  }

  const proxima = new Date(ultimaCompletada.getTime() + frecuenciaDias * MS_DIA);
  const dias = Math.ceil((proxima.getTime() - ahora.getTime()) / MS_DIA);

  let estado: EstadoAlerta;
  if (dias <= 0) estado = "vencida";
  else if (dias <= 7) estado = "proxima";
  else estado = "aldia";

  return { ultima: ultimaCompletada, proxima, estado, dias_para_proxima: dias };
}

export function formatearDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 0) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}

export function etiquetaEstado(estado: EstadoAlerta): string {
  switch (estado) {
    case "aldia": return "Al día";
    case "proxima": return "Próxima";
    case "vencida": return "Vencida";
    case "sin_historial": return "Nunca hecho";
  }
}

export function tonoEstado(estado: EstadoAlerta): "aldia" | "proxima" | "vencida" | "neutro" {
  switch (estado) {
    case "aldia": return "aldia";
    case "proxima": return "proxima";
    case "vencida": return "vencida";
    case "sin_historial": return "vencida";
  }
}
