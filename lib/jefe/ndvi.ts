import 'server-only';
import { prisma } from '@/lib/prisma';
import { crearClienteSupabaseAdmin } from '@/lib/supabase/admin';

export type InfoNdvi =
  | { disponible: false; razon: string }
  | { disponible: true; bbox: [number, number, number, number]; desde: string; hasta: string };

function credenciales(): { id: string; secreto: string } | null {
  // trim: un espacio o salto de línea pegado al copiar el valor en Vercel
  // hace que CDSE responda invalid_client.
  const id = process.env.CDSE_CLIENT_ID?.trim();
  const secreto = process.env.CDSE_CLIENT_SECRET?.trim();
  if (!id || !secreto) return null;
  return { id, secreto };
}

async function bboxFinca(): Promise<[number, number, number, number] | null> {
  try {
    const filas = await prisma.$queryRaw<
      { xmin: number; ymin: number; xmax: number; ymax: number }[]
    >`
      SELECT ST_XMin(poligono::geometry) AS xmin, ST_YMin(poligono::geometry) AS ymin,
             ST_XMax(poligono::geometry) AS xmax, ST_YMax(poligono::geometry) AS ymax
      FROM finca WHERE poligono IS NOT NULL LIMIT 1
    `;
    const f = filas[0];
    if (!f) return null;
    // Margen del 10% alrededor del borde
    const dx = (f.xmax - f.xmin) * 0.1;
    const dy = (f.ymax - f.ymin) * 0.1;
    return [f.xmin - dx, f.ymin - dy, f.xmax + dx, f.ymax + dy];
  } catch {
    return null;
  }
}

async function tokenCdse(): Promise<string | null> {
  const cred = credenciales();
  if (!cred) return null;
  const res = await fetch(
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cred.id,
        client_secret: cred.secreto,
      }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) {
    // El motivo real (invalid_client, secret con espacios, etc.) solo se ve
    // acá: en pantalla el mensaje es genérico.
    console.error('CDSE token:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

// Evalscript: NDVI en 5 niveles con contraste alto; nubes y sombras
// transparentes. En una finca mayormente sana, separar "sano" de "muy sano"
// es lo que hace visible la variación de vigor entre zonas.
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(s) {
  if (s.dataMask === 0 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10) {
    return [0, 0, 0, 0];
  }
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  if (ndvi < 0.3) return [0.75, 0.22, 0.17, 0.9];
  if (ndvi < 0.5) return [0.9, 0.55, 0.2, 0.9];
  if (ndvi < 0.65) return [0.95, 0.85, 0.3, 0.9];
  if (ndvi < 0.75) return [0.55, 0.78, 0.35, 0.9];
  return [0.08, 0.45, 0.22, 0.9];
}`;

function rangoUltimos30Dias(): { desde: string; hasta: string } {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 30 * 86400000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

const generarNdvi = async (
  bbox: [number, number, number, number]
): Promise<{ png_base64: string; bbox: [number, number, number, number] } | { error: string }> => {
  const token = await tokenCdse();
  if (!token) return { error: 'Credenciales CDSE no configuradas o inválidas' };

  const { desde, hasta } = rangoUltimos30Dias();
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: { from: desde, to: hasta },
              maxCloudCoverage: 40,
              mosaickingOrder: 'leastCC',
            },
          },
        ],
      },
      output: {
        width: 1024,
        height: 1024,
        responses: [{ identifier: 'default', format: { type: 'image/png' } }],
      },
      evalscript: EVALSCRIPT,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { error: `CDSE respondió ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  return { png_base64: buf.toString('base64'), bbox };
};

// --- Persistencia en Supabase Storage ------------------------------------
// El PNG se guarda en el bucket privado `ndvi`, un archivo por día. Antes
// vivía en unstable_cache, pero el base64 ronda el límite de 2 MB por
// entrada del data cache de Vercel: si lo pasaba, el cache fallaba en
// silencio y cada toque del botón volvía a gastar processing units de
// Copernicus. De paso queda histórico de imágenes. Los errores nunca se
// persisten. Versión en el nombre para invalidar al cambiar el evalscript;
// hash del bbox para regenerar si se edita el borde de la finca.

const BUCKET_NDVI = 'ndvi';
const VERSION_NDVI = 'v3';
const DIAS_HISTORICO = 60;

function fechaBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function hashBbox(bbox: [number, number, number, number]): string {
  const texto = bbox.map((n) => n.toFixed(4)).join(',');
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = (h * 33) ^ texto.charCodeAt(i);
  return (h >>> 0).toString(36);
}

async function leerNdviGuardado(nombre: string): Promise<string | null> {
  try {
    const supabase = crearClienteSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET_NDVI).download(nombre);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer()).toString('base64');
  } catch {
    return null;
  }
}

async function guardarNdvi(nombre: string, png_base64: string): Promise<void> {
  const supabase = crearClienteSupabaseAdmin();
  const cuerpo = Buffer.from(png_base64, 'base64');
  const subir = () =>
    supabase.storage
      .from(BUCKET_NDVI)
      .upload(nombre, cuerpo, { contentType: 'image/png', upsert: true });

  let { error } = await subir();
  if (error && /bucket/i.test(error.message)) {
    await supabase.storage.createBucket(BUCKET_NDVI, { public: false });
    ({ error } = await subir());
  }
  if (error) {
    // Sin persistencia igual servimos la imagen recién generada.
    console.error('NDVI storage:', error.message);
    return;
  }

  // Limpieza: borrar imágenes con más de DIAS_HISTORICO días.
  const corte = new Date(Date.now() - DIAS_HISTORICO * 86400000).toISOString().slice(0, 10);
  const { data: archivos } = await supabase.storage.from(BUCKET_NDVI).list();
  const viejos = (archivos ?? [])
    .map((a) => a.name)
    .filter((n) => {
      const fecha = n.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
      return fecha !== undefined && fecha < corte;
    });
  if (viejos.length > 0) await supabase.storage.from(BUCKET_NDVI).remove(viejos);
}

/** Imagen NDVI del día (Sentinel-2 revisita cada ~5 días): la sirve desde
 *  Storage si ya se generó hoy, o la pide a Copernicus y la guarda. */
export async function obtenerNdvi(): Promise<
  { png_base64: string; bbox: [number, number, number, number] } | { error: string }
> {
  const bbox = await bboxFinca();
  if (!bbox) return { error: 'La finca no tiene borde delimitado' };

  const nombre = `ndvi-${VERSION_NDVI}-${fechaBogota()}-${hashBbox(bbox)}.png`;
  const guardado = await leerNdviGuardado(nombre);
  if (guardado) return { png_base64: guardado, bbox };

  const r = await generarNdvi(bbox);
  if ('error' in r) {
    console.error('NDVI:', r.error);
    return r;
  }
  await guardarNdvi(nombre, r.png_base64);
  return r;
}

export async function infoNdvi(): Promise<InfoNdvi> {
  if (!credenciales()) {
    return { disponible: false, razon: 'Falta configurar CDSE_CLIENT_ID y CDSE_CLIENT_SECRET' };
  }
  const bbox = await bboxFinca();
  if (!bbox) return { disponible: false, razon: 'La finca no tiene borde delimitado' };
  const { desde, hasta } = rangoUltimos30Dias();
  return { disponible: true, bbox, desde, hasta };
}
