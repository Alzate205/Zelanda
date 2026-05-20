export function generarUuid(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("crypto.randomUUID no disponible");
  }
  return crypto.randomUUID();
}
