// Fuente única de baldosas satelitales para todos los mapas de la app.
// Se usan las imágenes de Google (las mismas de Google Earth): en la zona
// de la finca son mucho más recientes y con más zoom que Esri World Imagery.
// Endpoint no oficial: si deja de responder, volver a
// https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}

export const SUBDOMINIOS_SATELITE = ['mt0', 'mt1', 'mt2', 'mt3'];

/** Plantilla para react-leaflet (usa {s} + subdomains). */
export const URL_SATELITE_LEAFLET = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

/** Lista expandida para MapLibre (no soporta {s}). */
export const URLS_SATELITE_MAPLIBRE = SUBDOMINIOS_SATELITE.map(
  (s) => `https://${s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`
);

export const ATRIBUCION_SATELITE = 'Imágenes © Google';

export const MAXZOOM_SATELITE = 20;
