import type { RolUsuario, TipoVinculacion } from "@/types";

export const NOMBRE_APP = "La Zelanda";

export const LOTES_NOMBRES = [
  "Armenia",
  "Calarcá",
  "Circasia",
  "Córdoba",
  "Filandia",
  "Génova",
  "La Tebaida",
  "Montenegro",
  "Pijao",
  "Quimbaya",
  "Salento",
  "Buenavista",
  "Barcelona",
  "Pueblo Tapao",
  "La Cabaña",
] as const;

export const RUTA_INICIO_POR_ROL: Record<RolUsuario, string> = {
  JEFE: "/jefe",
  BODEGA: "/bodega",
  ALMACEN: "/almacen",
  TRABAJADOR: "/trabajador",
};

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  JEFE: "Jefe",
  BODEGA: "Bodega",
  ALMACEN: "Almacén",
  TRABAJADOR: "Trabajador",
};

export const ETIQUETA_TIPO_VINCULACION: Record<TipoVinculacion, string> = {
  FIJO: "Fijo",
  JORNALERO: "Jornalero",
  CONTRATISTA: "Contratista",
  FAMILIAR: "Familia",
};
