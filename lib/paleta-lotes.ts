const PALETA = [
  "#3b6e8f", // azul acero
  "#c87439", // naranja terracota
  "#5a8a4f", // verde oliva
  "#9c5a8a", // púrpura suave
  "#d4a04a", // dorado
  "#3d7050", // verde profundo
  "#a85048", // ladrillo
  "#6b6e9e", // azul lavanda
  "#8a6a3a", // marrón cálido
  "#4e8090", // teal apagado
  "#9a8845", // mostaza tierra
  "#7a5a8e", // ciruela
];

export function colorDeLote(loteId: number | bigint | string): string {
  const n = typeof loteId === "string" ? Number(loteId) : Number(loteId);
  if (!Number.isFinite(n)) return PALETA[0];
  return PALETA[Math.abs(Math.floor(n)) % PALETA.length];
}
