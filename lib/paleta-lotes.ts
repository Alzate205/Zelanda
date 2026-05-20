const PALETA = [
  "#5a8264", // verde bosque
  "#c89045", // ocre
  "#7a9d6e", // verde claro
  "#a87858", // terracota suave
  "#6b8e5a", // verde oliva
  "#d4a866", // ámbar tierra
  "#8ca984", // verde grisáceo
  "#b58866", // cobre
  "#3d7050", // verde oscuro
  "#c0a060", // mostaza
  "#7c9070", // verde musgo
  "#9c7548", // madera
];

export function colorDeLote(loteId: number | bigint | string): string {
  const n = typeof loteId === "string" ? Number(loteId) : Number(loteId);
  if (!Number.isFinite(n)) return PALETA[0];
  return PALETA[Math.abs(Math.floor(n)) % PALETA.length];
}
